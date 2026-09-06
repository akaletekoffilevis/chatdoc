// Authentification simple : emails + mots de passe (scrypt natif), sessions
// stockées en fichier JSON dans data/. Aucune dépendance externe.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA, 'users.json');
const SES_FILE = path.join(DATA, 'sessions.json');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function readJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getUsers() { return readJson(USERS_FILE, {}); }
function saveUsers(u) { writeJson(USERS_FILE, u); }
function getSessions() { return readJson(SES_FILE, {}); }
function saveSessions(s) { writeJson(SES_FILE, s); }

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, SCRYPT.keylen, SCRYPT).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(pw, salt, SCRYPT.keylen, SCRYPT).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function register(email, password) {
  const e = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: 'Email invalide' };
  if (!password || password.length < 6) return { error: 'Mot de passe : 6 caractères minimum' };
  const users = getUsers();
  if (users[e]) return { error: 'Cet email est déjà inscrit' };
  users[e] = { email: e, pass: hashPassword(password), created: Date.now(), plan: 'free' };
  saveUsers(users);
  return { ok: true, user: { email: e } };
}

function login(email, password) {
  const e = normalizeEmail(email);
  const users = getUsers();
  const u = users[e];
  if (!u || !verifyPassword(password, u.pass)) return { error: 'Email ou mot de passe incorrect' };
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = getSessions();
  sessions[token] = { email: e, created: Date.now() };
  saveSessions(sessions);
  return { ok: true, token, user: { email: e } };
}

function logout(token) {
  const sessions = getSessions();
  delete sessions[token];
  saveSessions(sessions);
}

function getUserByToken(token) {
  if (!token) return null;
  const sessions = getSessions();
  return sessions[token] ? sessions[token].email : null;
}

function deleteUser(email) {
  const users = getUsers();
  if (users[email]) { delete users[email]; saveUsers(users); return true; }
  return false;
}

module.exports = { register, login, logout, getUserByToken, normalizeEmail, deleteUser };