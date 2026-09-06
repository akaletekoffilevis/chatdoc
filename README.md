# ChatDoc — discutez avec vos documents PDF

Micro-SaaS type « ChatPDF » : upload d'un PDF → extraction de texte → découpage
en chunks → recherche sémantique (embeddings) → chat basé uniquement sur le document.

Payant : essai gratuit (3 documents / 20 questions), puis abonnement Premium
(Stripe Checkout ou mode démo local).

## Démarrage

```bash
npm install
cp .env .env   # (déjà présent) — renseignez vos clés
./start.sh     # ou : node server.js
```

Ouvrir → http://localhost:4000

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | Clé API compatible OpenAI (obligatoire pour le chat). Accepte OpenAI, Groq, Mistral, LiteLLM, Ollama… |
| `OPENAI_BASE_URL` | Laisser vide pour OpenAI. Ex : `https://api.groq.com/openai/v1` |
| `EMBED_MODEL` | Modèle d'embedding (défaut `text-embedding-3-small`) |
| `CHAT_MODEL` | Modèle de chat (défaut `gpt-4o-mini`) |
| `STRIPE_SECRET_KEY` | Optionnel. Si présent, le bouton Premium ouvre un Checkout réel. |
| `STRIPE_PRICE_ID` | ID du prix d'abonnement Stripe (mode `subscription`). |

Sans `STRIPE_SECRET_KEY`, le bouton **Mode démo** active l'illimité localement
(souhaitable pour tester sans caisse).

## API

| Route | Description |
|---|---|
| `POST /api/upload` | `multipart/form-data`, champ `file` (PDF ≤ 50 Mo) → `{ docId }` |
| `GET /api/documents` | Liste des documents indexés |
| `DELETE /api/documents/:id` | Supprime un document |
| `POST /api/chat` | `{ docId, question }` → `{ answer }` (réponse fondée sur le document) |
| `GET /api/billing` | Quota restant (`{ documents, questions, premium }`) |
| `POST /api/billing/checkout` | Retourne l'URL Stripe (ou `demo: true` sans clé) |
| `POST /api/billing/demo` | Active le mode Premium démo |
| `GET /api/health` | État du serveur |

## Arborescence

```
chatdoc/
├── server.js          # API Express + routes
├── lib/
│   ├── pdf.js         # extraction texte (pdf.js / Mozilla)
│   ├── chunker.js     # découpage en chunks
│   ├── rag.js         # embeddings + similarité + chat
│   └── billing.js     # quotas + Stripe (ou démo)
├── public/index.html  # UI (accueil / upload / chat / tarifs)
├── docs/              # fichiers uploadés temporaires
└── data/billing.json  # état du quota (créé automatiquement)
```

## Prochaines étapes possibles

- Comptes utilisateurs (auth email + mot de passe simple).
- Webhook Stripe pour renouvellement/annulation automatique d'abonnement.
- OCR pour PDF scannés (Tesseract / OCRmyPDF).
- Multi-format (DOCX, TXT…).
- Déploiement (Railway / Render / VPS) avec base de données persistante.