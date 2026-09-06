# ChatDoc — discutez avec vos documents

Micro-SaaS type « ChatPDF » : upload d'un document (PDF, DOCX, TXT, Markdown,
CSV) → extraction de texte (OCR automatique sur PDF scannés) → découpage en
chunks → recherche sémantique (embeddings) → chat basé uniquement sur le document.

Payant : essai gratuit (3 documents / 20 questions par compte), puis abonnement
Premium (Stripe Checkout ou mode démo local).

## Fonctionnalités

- **Comptes** : email + mot de passe (scrypt natif, sessions fichier), zéro dépendance auth.
- **Multi-format** : PDF (pdf.js), PDF scanné → OCR (`pdftoppm` + `tesseract` fra+eng), DOCX (`mammoth`), TXT/MD/CSV.
- **RAG** : embeddings via API compatible OpenAI (OpenAI, Groq, Mistral, LiteLLM, Ollama…).
- **Paiement** : Stripe Checkout (abonnement), webhook pour renouvellement/coupure auto.
- **Données** : quotas et comptes persistés dans `data/` (JSON) — montable en volume Docker.

## Démarrage local

```bash
npm install
cp .env.example .env   # si absent : mettez vos clés
./start.sh             # ou : node server.js
# dépendances système pour l'OCR : poppler-utils + tesseract-ocr(-fra,-eng)
```

Ouvrir → http://localhost:4000 — créez un compte, uploadez un fichier, posez des questions.
Sans clé IA (`GEMINI_API_KEY`/`OPENROUTER_API_KEY`/`OPENAI_API_KEY`), le chat
renvoie une erreur claire ; le reste (auth, upload, quota) fonctionne.

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `PORT` | Port du serveur (4000) |
| `OPENROUTER_API_KEY` | Clé OpenRouter (chat) — recommandé |
| `GEMINI_API_KEY` | Clé Google AI Studio (embeddings) — recommandé |
| `OPENAI_API_KEY` | Clé compatible OpenAI (secours chat + embeddings) |
| `OPENAI_BASE_URL` | Vide pour OpenAI. Ex : `https://api.groq.com/openai/v1` |
| `EMBED_MODEL` | Modèle d'embedding (ex. `gemini-embedding-2`) |
| `CHAT_MODEL` | Modèle de chat (ex. `openai/gpt-4o-mini`) |
| `STRIPE_SECRET_KEY` | Optionnel. Si présent → Stripe Checkout réel |
| `STRIPE_PRICE_ID` | ID du prix d'abonnement Stripe (`mode=subscription`) |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe (`/api/stripe/webhook`) |

**Dual-provider** : les embeddings et le chat peuvent venir de fournisseurs
différents. Le moteur RAG utilise `GEMINI_API_KEY` pour les embeddings s'il est
défini, sinon `OPENAI_API_KEY`/`OPENAI_BASE_URL`. Le chat utilise
`OPENROUTER_API_KEY` s'il est défini, sinon `OPENAI_API_KEY`.

Sans `STRIPE_SECRET_KEY`, le bouton **Mode démo** active l'illimité localement.

## API

| Route | Auth | Description |
|---|---|---|
| `POST /api/auth/register` | – | `{ email, password }` → `{ token }` |
| `POST /api/auth/login` | – | `{ email, password }` → `{ token }` |
| `POST /api/auth/logout` | Bearer | Invalide la session |
| `GET /api/auth/me` | Bearer | Profil + quota |
| `POST /api/upload` | Bearer | multipart `file` (PDF/DOCX/TXT/MD/CSV, ≤ 50 Mo) → `{ docId }` |
| `GET /api/documents` | Bearer | Liste des documents de l'utilisateur |
| `DELETE /api/documents/:id` | Bearer | Supprime un document |
| `POST /api/chat` | Bearer | `{ docId, question }` → `{ answer }` |
| `GET /api/billing` | Bearer | Quota (`{ documents, questions, premium }`) |
| `POST /api/billing/checkout` | Bearer | URL Stripe (ou `demo: true` sans clé) |
| `POST /api/billing/demo` | Bearer | Active le Premium démo |
| `POST /api/stripe/webhook` | – | Renouvellement / coupure auto d'abonnement |
| `GET /api/health` | – | État du serveur |

La clé d'API se passe en en-tête `Authorization: Bearer <token>`.

## Docker (déploiement VPS)

```bash
docker compose up -d --build
```

Le Dockerfile installe poppler-utils + tesseract (fra/eng). Volumes : `data/` et `docs/`.

## Arborescence

```
chatdoc/
├── server.js            # API Express
├── lib/
│   ├── auth.js          # comptes + sessions (scrypt natif)
│   ├── extract.js       # extraction multi-format + OCR
│   ├── chunker.js       # découpage en chunks
│   ├── rag.js           # embeddings + similarité + chat (scopé par user)
│   └── billing.js       # quotas + Stripe (scopé par user)
├── public/index.html    # UI (login / upload / chat / tarifs)
├── data/                # users, sessions, billing (persistant)
├── docs/                # fichiers temp d'upload
└── .github/workflows/ci.yml  # CI : tests + build
```

## Tests

```bash
npm test      # 22 tests (chunker, rag, auth, billing)
npm run build # vérification de syntaxe
```

## Prochaines étapes

- Déploiement Railway/Render (Buildpacks) avec volume persistant.
- Webhook Stripe branché sur un vrai compte (test mode).
- OCR PDF multi-pages parallélisé.
- Reset de mot de passe par email.