require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { extractText, SUPPORTED } = require('./lib/extract');
const { chunkText } = require('./lib/chunker');
const { RAGEngine } = require('./lib/rag');
const billing = require('./lib/billing');
const auth = require('./lib/auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Stripe webhook (raw body requis avant express.json) ---
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

const UPLOADS = path.join(__dirname, 'docs');
fs.mkdirSync(UPLOADS, { recursive: true });

const exts = SUPPORTED.map((e) => e.slice(1)).join('|');
const upload = multer({
  dest: UPLOADS,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (SUPPORTED.includes(ext)) cb(null, true);
    else cb(new Error(`Format non supporté : ${ext}. Formats acceptés : ${SUPPORTED.join(', ')}`));
  },
});

const engine = new RAGEngine();
const safeUnlink = (p) => { try { fs.unlinkSync(p); } catch {} };

// --- Middleware auth ---
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  const email = auth.getUserByToken(token);
  if (!email) return res.status(401).json({ error: 'Authentification requise. Connectez-vous.' });
  req.user = email;
  next();
}

// --- Auth routes ---
app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body || {};
  const r = auth.register(email, password);
  if (r.error) return res.status(400).json(r);
  const l = auth.login(email, password);
  res.json(l);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const r = auth.login(email, password);
  if (r.error) return res.status(401).json(r);
  res.json(r);
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  auth.logout(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ email: req.user, premium: billing.isPremium(req.user), quota: billing.quotaLeft(req.user) });
});

// --- Upload multi-format ---
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    const ext = '.' + req.file.originalname.split('.').pop().toLowerCase();
    const qLeft = billing.quotaLeft(req.user);
    if (!qLeft.premium && qLeft.documents <= 0) {
      safeUnlink(req.file.path);
      return res.status(402).json({ error: "Quota d'essai atteint (documents). Passez Premium.", quota: qLeft });
    }
    let text;
    try { text = await extractText(req.file.path, ext); }
    catch (e) { safeUnlink(req.file.path); return res.status(400).json({ error: "Erreur d'extraction : " + e.message }); }
    safeUnlink(req.file.path);
    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Aucun texte lisible dans ce fichier.' });
    }
    const chunks = chunkText(text);
    let docId;
    try { docId = await engine.addDocument(req.user, req.file.originalname, chunks); }
    catch (e) { return res.status(500).json({ error: `Indexation impossible — ${e.message}` }); }
    billing.consume(req.user, 'documents');
    res.json({ docId, originalName: req.file.originalname, chars: text.length, chunks: chunks.length, quota: billing.quotaLeft(req.user) });
  } catch (e) {
    safeUnlink(req.file && req.file.path);
    res.status(500).json({ error: e.message });
  }
});

// --- Documents ---
app.get('/api/documents', requireAuth, (req, res) => {
  res.json(engine.listDocuments(req.user));
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  engine.removeDocument(req.user, req.params.id);
  res.json({ removed: true });
});

// --- Chat ---
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !question) return res.status(400).json({ error: 'docId et question requis' });
    if (!billing.isPremium(req.user) && billing.quotaLeft(req.user).questions <= 0) {
      return res.status(402).json({ error: "Quota d'essai atteint (questions). Passez Premium.", quota: billing.quotaLeft(req.user) });
    }
    const answer = await engine.ask(req.user, docId, question);
    billing.consume(req.user, 'questions');
    res.json({ answer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Billing ---
app.get('/api/billing', requireAuth, (req, res) => {
  res.json(billing.quotaLeft(req.user));
});

app.post('/api/billing/checkout', requireAuth, async (req, res) => {
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json(await billing.createCheckout(req.user, origin));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/billing/success', async (req, res) => {
  try {
    const email = await billing.validateSession(req.query.session_id);
    res.redirect(`/#${email ? 'premium' : 'erreur'}`);
  } catch { res.redirect('/#erreur'); }
});

app.post('/api/billing/demo', requireAuth, (req, res) => {
  billing.activate(req.user, 'demo');
  res.json(billing.quotaLeft(req.user));
});

// --- Stripe webhook (Stripe vérifie + traite) ---
app.post('/api/stripe/webhook', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const result = await billing.handleWebhook(req.body, sig);
    res.json({ received: true, type: result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'ChatDoc' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`\n  ChatDoc prêt →  http://localhost:${PORT}\n`));