// Facturation & quota scopés par utilisateur.
// Essai gratuit plafonné / Premium (Stripe ou démo).
// State persisté dans data/billing.json : { [email]: { telemetry, activated, ... } }

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'billing.json');
const TRIAL_LIMIT = { documents: 3, questions: 20 };

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); } catch { stripe = null; }
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function writeState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function userState(email) {
  const all = readState();
  if (!all[email]) all[email] = { activated: false, demo: false, telemetry: {} };
  return { state: all[email], all };
}
function saveAllState(all) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(all, null, 2));
}

function isPremium(email) {
  const s = readState();
  return !!(s[email] && (s[email].activated || s[email].demo));
}

function telemetry(email) {
  return userState(email).state.telemetry || {};
}

function quotaLeft(email) {
  if (isPremium(email)) return { documents: Infinity, questions: Infinity, premium: true };
  const { state } = userState(email);
  const t = state.telemetry || {};
  return {
    documents: Math.max(0, TRIAL_LIMIT.documents - (t.documents || 0)),
    questions: Math.max(0, TRIAL_LIMIT.questions - (t.questions || 0)),
    premium: false,
  };
}

function consume(email, kind) {
  const { state, all } = userState(email);
  const t = (state.telemetry = state.telemetry || {});
  if (isPremium(email)) {
    t[kind] = (t[kind] || 0) + 1;
    saveAllState(all);
    return { ok: true, remaining: Infinity, reason: null };
  }
  const used = t[kind] || 0;
  const limit = TRIAL_LIMIT[kind];
  if (used >= limit) {
    saveAllState(all);
    return { ok: false, remaining: 0, reason: `Quota d'essai atteint (${kind}).` };
  }
  t[kind] = used + 1;
  saveAllState(all);
  return { ok: true, remaining: limit - used - 1, reason: null };
}

function activate(email, mode) {
  const { state, all } = userState(email);
  state.activated = true;
  state.activatedAt = Date.now();
  state.method = mode;
  if (mode === 'demo') state.demo = true;
  saveAllState(all);
}

async function createCheckout(email, origin) {
  if (!stripe) return { url: null, demo: true, message: 'Aucune STRIPE_SECRET_KEY → activation démo.' };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    customer_email: email,
    success_url: `${origin}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#tarif`,
  });
  return { url: session.url, demo: false, message: null };
}

async function validateSession(sessionId) {
  if (!stripe || !sessionId) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (paid && session.customer_email) {
    activate(session.customer_email, 'stripe');
    return session.customer_email;
  }
  return null;
}

// Webhook Stripe : vérifie la signature, gère les événements d'abonnement.
async function handleWebhook(rawBody, sig) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return null;
  const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      if (s.customer_email) activate(s.customer_email, 'stripe');
      break;
    }
    case 'customer.subscription.deleted': {
      const email = event.data.object?.customer_email;
      if (email) {
        const { state, all } = userState(email);
        state.activated = false;
        state.method = null;
        delete state.activatedAt;
        saveAllState(all);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const email = event.data.object?.customer_email;
      if (email) {
        const { state, all } = userState(email);
        state.activated = false;
        state.method = null;
        saveAllState(all);
      }
      break;
    }
  }
  return event.type;
}

module.exports = { TRIAL_LIMIT, consume, quotaLeft, isPremium, activate, createCheckout, validateSession, handleWebhook, telemetry };