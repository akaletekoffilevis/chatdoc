const test = require('node:test');
const assert = require('node:assert');
const auth = require('../lib/auth');

test('register puis login OK', () => {
  const email = 'test-' + Date.now() + '@exemple.com';
  const reg = auth.register(email, 'secret123');
  assert.ok(reg.ok);
  const login = auth.login(email, 'secret123');
  assert.ok(login.ok);
  assert.strictEqual(login.user.email, email);
  assert.ok(login.token);
  assert.strictEqual(auth.getUserByToken(login.token), email);
});

test('register : email invalide rejete', () => {
  assert.ok(auth.register('pas-un-email', 'secret123').error);
});

test('register : mot de passe court rejete', () => {
  assert.ok(auth.register('a@b.com', 'abc').error);
});

test('register : email duplique rejete', () => {
  const email = 'dup-' + Date.now() + '@exemple.com';
  auth.register(email, 'secret123');
  assert.ok(auth.register(email, 'autre123').error);
});

test('login : mauvais mot de passe rejete', () => {
  const email = 'bad-' + Date.now() + '@exemple.com';
  auth.register(email, 'secret123');
  assert.ok(auth.login(email, 'faux').error);
});

test('logout invalide le token', () => {
  const email = 'out-' + Date.now() + '@exemple.com';
  auth.register(email, 'secret123');
  const l = auth.login(email, 'secret123');
  auth.logout(l.token);
  assert.strictEqual(auth.getUserByToken(l.token), null);
});

test('normalizeEmail en minuscules', () => {
  assert.strictEqual(auth.normalizeEmail('  User@Exemple.COM '), 'user@exemple.com');
});