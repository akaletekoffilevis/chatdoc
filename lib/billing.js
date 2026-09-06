// Facturation & quota.
// Mode gratuit (démo) : essai plafonné en nombre de documents et de questions.
// Mode Stripe : si STRIPE_SECRET_KEY est renseigné, le bouton "Passer Premium"
// ouvre un Checkout Session ; l'activation est détectée en fin de session
// (mode_checkout) ou via webhook (à brancher). Si aucun mode payant actif,
// un bouton "Premium (démo)" active simplement le mode illimité.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = path.join(__dirname, '..', 'data', 'billing.json');

const TRIAL_LIMIT = {
  documents: 3, // documents indexables en essai
  questions: 20, // questions posables en essai
};

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); } catch (e) { stripe = null; }
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { activated: false, demo: false, telemetry: {} }; }
}

function writeState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function telemetry() {
  const s = readState();
  return s.telemetry || { docs: 0, questions: 0 };
}

function isPremium() {
  const s = readState();
  return !!(s.activated || s.demo);
}

// Comptabilise un usage. Renvoie { ok, remaining, reason }.
function consume(kind) {
  const s = readState();
  const t = s.telemetry || (s.telemetry = {});
  if (isPremium()) {
    t[kind] = (t[kind] || 0) + 1;
    writeState(s);
    return { ok: true, remaining: Infinity, reason: null };
  }
  const used = t[kind] || 0;
  const limit = TRIAL_LIMIT[kind];
  if (used >= limit) {
    writeState(s);
    return { ok: false, remaining: 0, reason: `Quota d'essai atteint (${kind === 'documents' ? 'documents' : 'questions'}).` };
  }
  t[kind] = used + 1;
  writeState(s);
  return { ok: true, remaining: limit - used - 1, reason: null };
}

function quotaLeft() {
  if (isPremium()) return { documents: Infinity, questions: Infinity, premium: true };
  const t = telemetry();
  return {
    documents: Math.max(0, TRIAL_LIMIT.documents - (t.documents || 0)),
    questions: Math.max(0, TRIAL_LIMIT.questions - (t.questions || 0)),
    premium: false,
  };
}

async function createCheckout(req) {
  if (!stripe) {
    return { url: null, demo: true, message: 'Aucune STRIPE_SECRET_KEY → activation démo.' };
  }
  const origin = `${req.protocol}://${req.get('host')}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#tarif`,
  });
  return { url: session.url, demo: false, message: null };
}

// Validation du paiement après retour du portail Stripe.
async function validateSession(sessionId) {
  if (!stripe || !sessionId) return false;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (paid) activate('stripe');
  return paid;
}

function activate(mode) {
  const s = readState();
  s.activated = true;
  if (mode === 'demo') s.demo = true;
  s.activatedAt = Date.now();
  s.method = mode;
  writeState(s);
}

module.exports = {
  TRIAL_LIMIT,
  consume,
  quotaLeft,
  isPremium,
  activate,
  createCheckout,
  validateSession,
  telemetry,
};