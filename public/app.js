/* ChatDoc — SPA (router hash, 6 vues) */
'use strict';

/* ---------- Utilitaires ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function toast(msg, type = 'info') {
  const w = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  w.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ---------- API ---------- */
const TOKEN_KEY = 'chatdoc_token';
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.json !== false) headers['Content-Type'] = 'application/json';
  const t = getToken();
  if (t) headers['Authorization'] = 'Bearer ' + t;
  const r = await fetch(path, { ...opts, headers });
  let data = null;
  try { data = await r.json(); } catch {}
  if (r.status === 401 && getToken()) {
    clearToken();
    if (location.hash !== '#/auth') location.hash = '#/auth';
  }
  return { ok: r.ok, status: r.status, data };
}

/* ---------- État global ---------- */
const state = {
  me: null,        // { email, premium, quota }
  docs: [],        // [{ id, name, chunks, created }]
  currentDocId: null,
  chat: [],        // [{ role, content }]
};

async function loadMe() {
  const { ok, data } = await api('/api/auth/me');
  state.me = ok ? data : null;
  return state.me;
}
async function loadDocs() {
  const { ok, data } = await api('/api/documents');
  if (ok) state.docs = data;
  return state.docs;
}

const getDoc = (id) => state.docs.find((d) => d.id === id);

/* ---------- Icônes (inline SVG) ---------- */
const ICONS = {
  logo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1.3 2.3h5.4c.3-1.1.7-1.8 1.3-2.3A7 7 0 0 0 12 2z"/></svg>',
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
  files: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.2L3 21l1.8-6.4A8 8 0 1 1 21 12z"/></svg>',
  card: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  upload: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21 23 12 2 3v7l15 2-15 2z"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>',
};

/* ---------- Layout public (landing/auth) ---------- */
function publicNav(active) {
  return `
  <header class="topnav">
    <div class="container">
      <a href="#/" class="brand"><span class="brand-logo">${ICONS.logo}</span> ChatDoc</a>
      <nav class="nav-links">
        <a href="#/feats" data-scroll="feats">Fonctionnalités</a>
        <a href="#/pricing" data-scroll="pricing">Tarifs</a>
        <a href="#/faq" data-scroll="faq">FAQ</a>
      </nav>
      <div class="nav-actions">
        ${getToken() ? '<a class="btn btn-outline btn-sm" href="#/documents">Mon espace</a>' : `
        <a class="btn btn-ghost btn-sm" href="#/auth">Connexion</a>
        <a class="btn btn-primary btn-sm" href="#/auth?m=register">Créer un compte</a>`}
      </div>
    </div>
  </header>`;
}

/* ---------- Sidebar (connecté) ---------- */
function sidebar(item) {
  const u = state.me || {};
  const email = u.email || '';
  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '??';
  const nav = (href, icon, label, key) =>
    `<a href="${href}" class="nav-item ${item === key ? 'active' : ''}">${ICONS[icon]} ${label}</a>`;
  return `
  <aside class="sidebar">
    <a href="#/docs" class="brand"><span class="brand-logo">${ICONS.logo}</span> ChatDoc</a>
    <nav class="side-nav">
      <div class="nav-label">Espace de travail</div>
      ${nav('#/docs', 'files', 'Mes documents', 'docs')}
      ${nav('#/chat', 'chat', 'Discuter', 'chat')}
      <div class="nav-label">Compte</div>
      ${nav('#/account', 'card', 'Abonnement', 'account')}
    </nav>
    <div class="sidebar-foot">
      <div class="user-mini">
        <div class="avatar">${esc(initials)}</div>
        <div style="min-width:0">
          <div class="u-name">${esc(email.split('@')[0] || email)}</div>
          <div class="u-mail">${esc(email)}</div>
        </div>
      </div>
      <button class="btn btn-outline btn-sm btn-block" id="logoutBtn">${ICONS.logout} Se déconnecter</button>
    </div>
  </aside>`;
}

function quotaBar() {
  const q = (state.me && state.me.quota) || { documents: 0, questions: 0, premium: false };
  const premium = !!(state.me && state.me.premium);
  return `
  <div class="quota-bar">
    <div class="quota-item">
      <span class="q-num">${premium ? '∞' : q.documents}</span>
      <div class="q-label"><b>Documents</b><br>${premium ? 'illimités' : 'en essai'}</div>
    </div>
    <div class="quota-item">
      <span class="q-num">${premium ? '∞' : q.questions}</span>
      <div class="q-label"><b>Questions</b><br>${premium ? 'illimitées' : 'en essai'}</div>
    </div>
    <div class="quota-spacer"></div>
    <span class="quota-pill ${premium ? 'premium' : 'free'}">${premium ? 'PREMIUM' : 'ESSAI GRATUIT'}</span>
  </div>`;
}

function appShell(body) {
  return `
  <div class="shell">
    ${sidebar()}
    <main class="main">
      ${quotaBar()}
      ${body}
    </main>
  </div>`;
}

/* ---------- Router ---------- */
function render() {
  const hash = location.hash || '#/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  const app = $('#app');
  switch (path) {
    case '#/': app.innerHTML = viewLanding(); bindLanding(); break;
    case '#/auth': app.innerHTML = viewAuth(params.get('m')); bindAuth(); break;
    case '#/docs': requireAuth(() => { app.innerHTML = appShell(viewDocs()); bindDocs(); }); break;
    case '#/chat': requireAuth(() => { app.innerHTML = appShell(viewChat()); bindChat(); }); break;
    case '#/account': requireAuth(() => { app.innerHTML = appShell(viewAccount()); bindAccount(); }); break;
    default: app.innerHTML = viewLanding(); bindLanding(); location.hash = '#/';
  }
  updateScrollTarget();
}

function requireAuth(fn) {
  if (!getToken()) { location.hash = '#/auth'; return; }
  loadMe().then(() => {
    bindSidebarLogout();
    fn();
  });
}

function bindSidebarLogout() {
  $$('#logoutBtn, #logoutBtn2').forEach(b => b && b.removeEventListener('click', _logoutHandler));
  $$('#logoutBtn, #logoutBtn2').forEach(b => b && b.addEventListener('click', _logoutHandler));
}
async function _logoutHandler() {
  await api('/api/auth/logout', { method: 'POST', json: false }).catch(() => {});
  clearToken();
  toast('Déconnecté.', 'success');
  location.hash = '#/';
}

function updateScrollTarget() {
  const m = location.hash.match(/#\/\?s=([\w-]+)/) || [];
  const hash = location.hash;
  const parts = hash.split('?');
  if (parts[1]) {
    const p = new URLSearchParams(parts[1]);
    const s = p.get('s');
    if (s) {
      setTimeout(() => {
        const el = document.getElementById(s);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }
}

window.addEventListener('hashchange', render);

/* ---------- Landing ---------- */
function viewLanding() {
  return `
  ${publicNav()}
  <section class="hero">
    <div class="container">
      <div>
        <div class="hero-badge">${ICONS.spark} RAG local &nbsp;·&nbsp; Vos documents restent chez vous</div>
        <h1>Discutez avec vos documents, <span class="grad">pas avec Google.</span></h1>
        <p class="lead">ChatDoc indexe vos PDF, DOCX, textes et images scannées, puis répond précisément à vos questions — uniquement à partir de ce qu'ils contiennent.</p>
        <div class="hero-ctas">
          ${getToken()
            ? '<a class="btn btn-primary btn-lg" href="#/docs">Ouvrir mes documents</a>'
            : '<a class="btn btn-primary btn-lg" href="#/auth?m=register">Essayer gratuitement</a><a class="btn btn-outline btn-lg" href="#/pricing">Voir les tarifs</a>'}
        </div>
        <div class="hero-points">
          <span>${ICONS.check} 3 documents offerts</span>
          <span>${ICONS.check} Sans carte bancaire</span>
          <span>${ICONS.check} En français</span>
        </div>
      </div>
      <div>
        <div class="mock" aria-hidden="true">
          <div class="mock-head">
            <div class="mock-dots"><i></i><i></i><i></i></div>
            <span class="mock-file">📄 rapport-ventes-2025.pdf</span>
          </div>
          <div class="mock-body">
            <div class="bubble bot">Quel a été le chiffre d'affaires 2025 ?</div>
            <div class="bubble user">En 2025, le chiffre d'affaires s'élève à <b>2 450 000 FCFA</b>, en hausse de 18% par rapport à 2024.</div>
            <div class="bubble bot">La méthodologie est-elle expliquée ?</div>
            <div class="bubble user">Oui, pages 12-14 : enquête auprès de 500 utilisateurs et analyse des données. La PME citée est…</div>
            <div class="mock-input"><span>Poser une question sur le document…</span><i>${ICONS.send}</i></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="feats">
    <div class="container">
      <div class="section-head">
        <div class="section-eyebrow">Fonctionnalités</div>
        <h2>Tout pour travailler avec vos documents</h2>
        <p>Une interface simple, des réponses sourcées, et zéro fuite de données.</p>
      </div>
      <div class="feature-grid">
        <div class="card card-hover feature-card">
          <div class="feature-icon">📄</div>
          <h3 class="card-title">Multi-format</h3>
          <p class="card-sub">PDF, DOCX, TXT, Markdown, CSV — upload par glisser-déposer, jusqu'à 50 Mo.</p>
        </div>
        <div class="card card-hover feature-card">
          <div class="feature-icon teal">🔍</div>
          <h3 class="card-title">OCR intégré</h3>
          <p class="card-sub">PDF scannés (sans texte) récupérés automatiquement par OCR français/anglais.</p>
        </div>
        <div class="card card-hover feature-card">
          <div class="feature-icon violet">💬</div>
          <h3 class="card-title">Réponses sourcées</h3>
          <p class="card-sub">Le chat ne répond qu'à partir de vos documents. Pas d'hallucination, chiffres exacts.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--c-surface);border-block:1px solid var(--c-border)">
    <div class="container">
      <div class="section-head">
        <div class="section-eyebrow">Comment ça marche</div>
        <h2>Prêt en 30 secondes</h2>
      </div>
      <div class="steps">
        <div class="card card-hover step-card">
          <div class="step-num">1</div>
          <h3 class="card-title">Créez votre compte</h3>
          <p class="card-sub">Email + mot de passe. L'essai gratuit est inclus, sans carte bancaire.</p>
        </div>
        <div class="card card-hover step-card">
          <div class="step-num">2</div>
          <h3 class="card-title">Déposez vos fichiers</h3>
          <p class="card-sub">Glissez vos documents. Ils sont indexés et découpés automatiquement.</p>
        </div>
        <div class="card card-hover step-card">
          <div class="step-num">3</div>
          <h3 class="card-title">Posez vos questions</h3>
          <p class="card-sub">Obtenez des réponses précises, extraites du contexte réel de vos docs.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="pricing">
    <div class="container">
      <div class="section-head">
        <div class="section-eyebrow">Tarifs</div>
        <h2>Un prix simple, sans surprise</h2>
        <p>Essai gratuit puis 7 000 FCFA / mois (≈ 11 €). Annulable à tout moment.</p>
      </div>
      <div class="pricing-grid">
        <div class="card plan">
          <h3>Découverte</h3>
          <div class="price">0 FCFA<small></small></div>
          <p class="plan-sub">Pour tester ChatDoc</p>
          <ul>
            <li>${ICONS.check} 3 documents indexés</li>
            <li>${ICONS.check} 20 questions</li>
            <li>${ICONS.check} Multi-format</li>
            <li>${ICONS.check} OCR inclus</li>
          </ul>
          <a class="btn btn-outline" href="#/auth?m=register">Commencer</a>
        </div>
        <div class="card plan featured">
          <h3>Pro</h3>
          <div class="price">7 000 FCFA<small>/mois</small></div>
          <p class="plan-sub">Pour un usage régulier</p>
          <ul>
            <li>${ICONS.check} Documents illimités</li>
            <li>${ICONS.check} Questions illimitées</li>
            <li>${ICONS.check} Fichiers jusqu'à 50 Mo</li>
            <li>${ICONS.check} Soutien prioritaire</li>
          </ul>
          <a class="btn btn-primary" href="#/auth?m=register">Passer Pro</a>
        </div>
        <div class="card plan">
          <h3>Équipe</h3>
          <div class="price">—<small></small></div>
          <p class="plan-sub">Bientôt disponible</p>
          <ul>
            <li>${ICONS.check} Comptes multiples</li>
            <li>${ICONS.check} Document centralisés</li>
            <li>${ICONS.check} Facturation unique</li>
          </ul>
          <a class="btn btn-outline" href="#/auth?m=register">Bientôt</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="faq" style="background:var(--c-surface);border-block:1px solid var(--c-border)">
    <div class="container">
      <div class="section-head">
        <div class="section-eyebrow">FAQ</div>
        <h2>Questions fréquentes</h2>
      </div>
      <div style="max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px">
        <div class="card"><h3 class="card-title" style="font-size:16px">Mes documents sont-ils visibles par les autres ?</h3><p class="card-sub mb-0">Non. Chaque compte est isolé : vos fichiers, chat et quota ne sont accessibles qu'à vous.</p></div>
        <div class="card"><h3 class="card-title" style="font-size:16px">Que se passe-t-il si je dépasse l'essai gratuit ?</h3><p class="card-sub mb-0">Un simple rappel s'affiche ; passez Pro en un clic pour continuer.</p></div>
        <div class="card"><h3 class="card-title" style="font-size:16px">Puis-je scanner des documents papier ?</h3><p class="card-sub mb-0">Oui : l'OCR est intégré pour les PDF scannés, en français et en anglais.</p></div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <div class="brand-small muted">© 2026 ChatDoc — discutez avec vos documents</div>
      <div class="footer-links">
        <a href="#/pricing">Tarifs</a>
        <a href="#/faq">FAQ</a>
        <a href="#/auth">Connexion</a>
      </div>
    </div>
  </footer>`;
}

function bindLanding() {
  $$('[data-scroll]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const el = document.getElementById(a.dataset.scroll);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }));
}

/* ---------- Auth ---------- */
function viewAuth(mode) {
  const register = mode === 'register';
  return `
  ${publicNav()}
  <div class="auth-split">
    <div class="auth-left">
      <div class="brand" style="color:#fff;margin-bottom:40px"><span class="brand-logo">${ICONS.logo}</span> ChatDoc</div>
      <h1>Vos documents. Vos réponses.</h1>
      <p>Une interface épurée pour interroger vos fichiers en toute confidentialité.</p>
      <div class="auth-quotes">
        <div class="auth-quote">${ICONS.check} Aucune carte bancaire pour l'essai</div>
        <div class="auth-quote">${ICONS.check} Documents et quotas isolés par compte</div>
        <div class="auth-quote">${ICONS.check} OCR, PDF, DOCX, TXT, Markdown, CSV</div>
      </div>
    </div>
    <div class="auth-right">
      <div class="card auth-card">
        <h2>${register ? 'Créer un compte' : 'Bon retour'}</h2>
        <p class="auth-sub">${register ? '2 documents offerts pour tester.' : 'Connectez-vous pour retrouver vos documents.'}</p>
        <div class="alert alert-error hidden" id="authErr"></div>
        <form id="authForm" novalidate>
          <div class="field">
            <label for="aMail">Adresse email</label>
            <input class="input" type="email" id="aMail" placeholder="vous@exemple.com" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="aPass">Mot de passe</label>
            <input class="input" type="password" id="aPass" placeholder="6 caractères minimum" autocomplete="${register ? 'new-password' : 'current-password'}" required>
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">${register ? 'Créer mon compte' : 'Se connecter'}</button>
        </form>
        <div class="auth-switch">
          ${register ? 'Déjà inscrit ? <a id="toLogin">Se connecter</a>' : 'Pas encore de compte ? <a id="toRegister">En créer un</a>'}
        </div>
      </div>
    </div>
  </div>`;
}

function bindAuth() {
  const form = $('#authForm');
  const err = $('#authErr');
  const register = !!$('#toLogin');
  $('#toLogin')?.addEventListener('click', () => { location.hash = '#/auth'; });
  $('#toRegister')?.addEventListener('click', () => { location.hash = '#/auth?m=register'; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#aMail').value.trim();
    const password = $('#aPass').value;
    err.classList.add('hidden');
    if (!email || !password) { showErr(err, 'Remplis tous les champs.'); return; }
    const path = register ? '/api/auth/register' : '/api/auth/login';
    const btn = form.querySelector('button');
    btn.disabled = true;
    const { ok, data } = await api(path, { method: 'POST', body: JSON.stringify({ email, password }) });
    btn.disabled = false;
    if (!ok) { showErr(err, data?.error || 'Erreur de connexion.'); return; }
    setToken(data.token);
    toast(register ? 'Compte créé, bienvenue !' : 'Connecté.', 'success');
    location.hash = '#/docs';
  });
}
function showErr(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

/* ---------- Documents ---------- */
function viewDocs() {
  const docs = state.docs;
  const empty = docs.length === 0;
  const dcard = (d) => {
    const ext = (d.name.split('.').pop() || 'file').toLowerCase();
    const icon = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'txt' || ext === 'md' || ext === 'csv' ? 'txt' : 'file';
    return `
    <div class="card card-hover doc-card" data-id="${d.id}">
      <div class="doc-icon ${icon}">${extIcon(ext)}</div>
      <div class="doc-name" title="${esc(d.name)}">${esc(d.name)}</div>
      <div class="doc-meta">${d.chunks} morceaux · ajouté ${fmtDate(d.created)}</div>
      <div class="doc-actions">
        <button class="btn btn-primary btn-sm" data-open="${d.id}">Discuter</button>
        <button class="btn btn-ghost btn-sm" data-del="${d.id}">Supprimer</button>
      </div>
    </div>`;
  };
  return `
  <div class="page-head">
    <div>
      <h1>Mes documents</h1>
      <p>${docs.length} fichier${docs.length > 1 ? 's' : ''} indexé${docs.length > 1 ? 's' : ''}</p>
    </div>
    <button class="btn btn-primary" id="newDocBtn">${ICONS.upload} Ajouter un document</button>
  </div>
  <div class="dropzone hidden" id="dropzone">
    <div class="dz-icon">${ICONS.upload}</div>
    <h3>Glissez vos fichiers ici</h3>
    <p>ou cliquez pour parcourir — PDF, DOCX, TXT, MD, CSV · max 50 Mo</p>
    <div class="dz-formats">
      <span class="badge badge-danger">PDF</span><span class="badge badge-primary">DOCX</span>
      <span class="badge badge-accent">TXT</span><span class="badge badge-accent">MD</span><span class="badge badge-accent">CSV</span>
    </div>
    <input type="file" id="fileInput" class="hidden" accept=".pdf,.docx,.txt,.md,.csv" multiple>
  </div>
  <div class="mt-2">
    ${empty
      ? '<div class="card empty"><div class="empty-icon">🗂️</div><h3>Aucun document</h3><p>Ajoutez votre premier document pour commencer à discuter avec lui.</p><button class="btn btn-primary" id="newDocBtn2">${ICONS.upload} Ajouter un document</button></div>'
      : `<div class="docs-grid">${docs.map(dcard).join('')}</div>`}
  </div>`;
}

function extIcon(ext) {
  return { pdf: '📕', docx: '📘', txt: '📄', md: '📝', csv: '🧾', file: '📁' }[ext] || '📄';
}

function bindDocs() {
  const dz = $('#dropzone');
  const input = $('#fileInput');
  const open = (id) => {
    state.currentDocId = id;
    state.chat = [];
    location.hash = '#/chat';
  };
  $$('#newDocBtn, #newDocBtn2').forEach(b => b && b.addEventListener('click', () => enterDrop()));
  $$('[data-open]').forEach(b => b.addEventListener('click', () => open(b.dataset.open)));
  $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
    await api('/api/documents/' + b.dataset.del, { method: 'DELETE' });
    toast('Document supprimé.');
    state.docs = state.docs.filter(d => d.id !== b.dataset.del);
    if (state.currentDocId === b.dataset.del) state.currentDocId = null;
    render();
  }));
  function enterDrop() { dz.classList.remove('hidden'); input.click(); }
  dz.addEventListener('click', () => input.click());
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => { [...(e.dataTransfer.files || [])].forEach(uploadFile); });
  input.addEventListener('change', () => { [...input.files].forEach(uploadFile); input.value = ''; });
}

async function uploadFile(f) {
  const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
  if (!['.pdf', '.docx', '.txt', '.md', '.csv'].includes(ext)) { toast('Format non supporté : ' + ext, 'error'); return; }
  const fd = new FormData();
  fd.append('file', f);
  toast(`Indexation de « ${f.name} » en cours…`);
  const { ok, status, data } = await api('/api/upload', { method: 'POST', body: fd, json: false });
  if (status === 402) { toast(data?.error || 'Quota atteint', 'error'); location.hash = '#/account'; return; }
  if (!ok) { toast(data?.error || 'Erreur upload', 'error'); return; }
  toast('Document indexé avec succès.', 'success');
  await loadDocs(); await loadMe();
  render();
}

/* ---------- Chat ---------- */
function viewChat() {
  if (!state.currentDocId) state.currentDocId = state.docs[0]?.id;
  if (!state.currentDocId) {
    return `
    <div class="page-head"><div><h1>Discuter</h1><p>Choisissez un document pour commencer.</p></div></div>
    <div class="card empty">
      <div class="empty-icon">💬</div>
      <h3>Choisissez un document</h3>
      <p>Sélectionnez un document dans la liste pour poser vos premières questions.</p>
      <a class="btn btn-primary" href="#/docs">Voir mes documents</a>
    </div>`;
  }
  const doc = getDoc(state.currentDocId);
  const chat = state.chat;
  const sel = (d) => `<option value="${d.id}" ${d.id === state.currentDocId ? 'selected' : ''}>${esc(d.name)}</option>`;
  return `
  <div class="chat-wrap">
    <div class="chat-head">
      <div>
        <div class="ch-title">Discussion sur</div>
        <div class="ch-doc">${doc ? esc(doc.name) : '—'}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <select class="select" id="docSwitch" style="width:auto;min-width:180px">${state.docs.map(sel).join('')}</select>
        <a class="btn btn-outline btn-sm" href="#/docs">${ICONS.back} Documents</a>
      </div>
    </div>
    <div class="chat-messages" id="chatMsgs">
      ${chat.length === 0
        ? '<div class="msg bot">Document prêt. Posez votre première question sur « ' + (doc ? esc(doc.name) : '') + ' » — j\'y répondrai uniquement à partir de son contenu.</div>'
        : chat.map(m => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('')}
    </div>
    <div class="chat-input">
      <input class="input" id="chatInput" placeholder="Ex : quel est le chiffre d'affaires 2025 ?" autocomplete="off">
      <button class="btn btn-primary" id="chatSend">${ICONS.send}</button>
    </div>
  </div>`;
}

function bindChat() {
  const input = $('#chatInput');
  $('#docSwitch')?.addEventListener('change', e => {
    state.currentDocId = e.target.value;
    state.chat = [];
    render();
  });
  const send = () => askQuestion();
  $('#chatSend')?.addEventListener('click', send);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

async function askQuestion() {
  const input = $('#chatInput');
  const q = input.value.trim();
  if (!q || !state.currentDocId) return;
  state.chat.push({ role: 'user', content: q });
  input.value = '';
  renderChat();
  $('#chatMsgs').insertAdjacentHTML('beforeend', '<div class="msg bot typing">Réflexion en cours…</div>');
  $('#chatMsgs').scrollTop = $('#chatMsgs').scrollHeight;
  const { ok, status, data } = await api('/api/chat', { method: 'POST', body: JSON.stringify({ docId: state.currentDocId, question: q }) });
  $('#chatMsgs .typing')?.remove();
  if (status === 402) { toast(data?.error || 'Quota atteint', 'error'); state.chat.pop(); renderChat(); }
  else if (!ok) { state.chat.push({ role: 'bot', content: '⚠ ' + (data?.error || 'Erreur') }); renderChat(); }
  else {
    state.chat.push({ role: 'bot', content: data.answer });
    renderChat();
    await loadMe();
  }
}

function renderChat() {
  const box = $('#chatMsgs');
  if (!box) return;
  box.innerHTML = state.chat.map(m => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

/* ---------- Abonnement / compte ---------- */
function viewAccount() {
  const u = state.me || {};
  const q = u.quota || {};
  const premium = !!u.premium;
  return `
  <div class="page-head"><div><h1>Abonnement</h1><p>Gérez votre compte et votre formule.</p></div></div>
  <div class="stat-grid">
    <div class="card stat-card">
      <div class="stat-icon">📄</div>
      <div class="stat-num">${premium ? '∞' : q.documents || 0}</div>
      <div class="stat-label">Documents restants</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon">💬</div>
      <div class="stat-num">${premium ? '∞' : q.questions || 0}</div>
      <div class="stat-label">Questions restantes</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon">📚</div>
      <div class="stat-num">${state.docs.length}</div>
      <div class="stat-label">Documents indexés</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon">${premium ? '⭐' : '🎟️'}</div>
      <div class="stat-num">${premium ? 'PRO' : 'ESSAI'}</div>
      <div class="stat-label">Formule actuelle</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:24px">
    <h3 class="card-title">Votre compte</h3>
    <div class="row" style="margin-bottom:8px">
      <div class="avatar">${esc((u.email || 'xx').slice(0, 2).toUpperCase())}</div>
      <div><div style="font-weight:600">${esc(u.email || '')}</div><div class="muted" style="font-size:13px">Compte personnel</div></div>
      <div class="spacer"></div>
      <span class="badge ${premium ? 'badge-primary' : 'badge-accent'}">${premium ? 'PREMIUM' : 'ESSAI GRATUIT'}</span>
    </div>
    <div id="accountActions">
      ${premium
        ? '<p class="muted">Vous bénéficiez de l\'illimité. Merci de soutenir ChatDoc !</p>'
        : `<p class="muted">Passez Pro pour des documents et questions illimités — 7 000 FCFA / mois.</p>`
        }
    </div>
    <div class="row mt-2" id="accountBtns">
      ${premium ? '' : '<button class="btn btn-primary" id="upgradeBtn">Passer à Pro</button>'}
      <button class="btn btn-outline" id="demoBtn">${ICONS.spark} Mode démo (illimité)</button>
    </div>
  </div>

  <div class="card">
    <h3 class="card-title">Zone de danger</h3>
    <p class="card-sub">Se déconnecter de ce navigateur. Vos documents restent enregistrés.</p>
    <button class="btn btn-danger btn-sm" id="logoutBtn2">Se déconnecter</button>
  </div>`;
}

function bindAccount() {
  $('#upgradeBtn')?.addEventListener('click', async () => {
    const { ok, data } = await api('/api/billing/checkout', { method: 'POST', json: false });
    if (data?.url) location.href = data.url;
    else if (data?.demo) { toast('Premium activé (mode démo).', 'success'); await loadMe(); render(); }
    else toast(data?.error || 'Erreur de paiement', 'error');
  });
  $('#demoBtn')?.addEventListener('click', async () => {
    const { ok } = await api('/api/billing/demo', { method: 'POST', json: false });
    if (ok) { toast('Mode démo activé — illimité.', 'success'); await loadMe(); render(); }
  });
  $$('#logoutBtn, #logoutBtn2').forEach(b => b && b.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST', json: false }).catch(() => {});
    clearToken();
    toast('Déconnecté.');
    location.hash = '#/';
  }));
}

/* ---------- Init ---------- */
(async function init() {
  render();
  if (getToken()) {
    const me = await loadMe();
    if (me) await loadDocs();
  }
  window.addEventListener('hashchange', () => {
    if (getToken()) { loadMe().then(() => loadDocs()); }
  });
})();