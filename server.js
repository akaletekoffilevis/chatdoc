require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { extractText } = require('./lib/pdf');
const { chunkText } = require('./lib/chunker');
const { RAGEngine } = require('./lib/rag');
const billing = require('./lib/billing');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const UPLOADS = path.join(__dirname, 'docs');
fs.mkdirSync(UPLOADS, { recursive: true });

const upload = multer({ dest: UPLOADS, limits: { fileSize: 50 * 1024 * 1024 } });

const engine = new RAGEngine();

// POST /api/upload — dépose un PDF, l'indexe pour le chat
// POST /api/upload — dépose un PDF, l'indexe pour le chat
const safeUnlink = (p) => { try { fs.unlinkSync(p); } catch {} };

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
      safeUnlink(req.file.path);
      return res.status(400).json({ error: 'Seuls les PDF sont acceptés' });
    }
    const quotaLeft = billing.quotaLeft();
    if (!quotaLeft.premium && quotaLeft.documents <= 0) {
      safeUnlink(req.file.path);
      return res.status(402).json({ error: 'Quota d\'essai atteint (documents). Passez Premium.', quota: quotaLeft });
    }
    const text = await extractText(req.file.path);
    safeUnlink(req.file.path);
    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Aucun texte lisible dans ce PDF (peut-être scanné sans OCR).' });
    }
    const chunks = chunkText(text);
    let docId;
    try {
      docId = await engine.addDocument(req.file.originalname, chunks);
    } catch (embedErr) {
      safeUnlink(req.file.path);
      return res.status(500).json({ error: `Indexation impossible — ${embedErr.message}` });
    }
    const used = billing.consume('documents');
    res.json({ docId, originalName: req.file.originalname, chars: text.length, chunks: chunks.length, quota: billing.quotaLeft(), used: used.ok });
  } catch (e) {
    safeUnlink(req.file && req.file.path);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/documents/:id — supprime un document indexé
app.delete('/api/documents/:id', (req, res) => {
  const removed = engine.removeDocument(req.params.id);
  res.json({ removed });
});

// GET /api/documents — liste les documents indexés
app.get('/api/documents', (req, res) => {
  res.json(engine.listDocuments());
});

// POST /api/chat — répond en s'appuyant uniquement sur les documents
app.post('/api/chat', async (req, res) => {
  try {
    const { docId, question } = req.body;
    if (!docId || !question) return res.status(400).json({ error: 'docId et question requis' });
    if (!billing.isPremium()) {
      const quota = billing.quotaLeft();
      if (quota.questions <= 0) {
        return res.status(402).json({ error: 'Quota d\'essai atteint (questions). Passez Premium.', quota });
      }
    }
    const answer = await engine.ask(docId, question);
    billing.consume('questions');
    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/billing — état du quota / abonnement
app.get('/api/billing', (req, res) => {
  res.json(billing.quotaLeft());
});

// POST /api/billing/checkout — crée une session Stripe (ou activation démo)
app.post('/api/billing/checkout', async (req, res) => {
  try {
    const result = await billing.createCheckout(req);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/billing/success — retour du paiement (validation session Stripe)
app.get('/api/billing/success', async (req, res) => {
  try {
    const paid = await billing.validateSession(req.query.session_id);
    res.redirect(`/#${paid ? 'premium' : 'erreur'}`);
  } catch (e) {
    res.redirect('/#erreur');
  }
});

// GET /api/billing/demo — active le mode Premium démo (sans payer)
app.post('/api/billing/demo', (req, res) => {
  billing.activate('demo');
  res.json(billing.quotaLeft());
});

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'ChatDoc' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  ChatDoc prêt →  http://localhost:${PORT}\n`);
});