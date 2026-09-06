const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// State isolé pour le test
process.env.STRIPE_SECRET_KEY = '';
const billing = require('../lib/billing');

const STATE = path.join(__dirname, '..', 'data', 'billing.json');
function backup() { try { return fs.readFileSync(STATE); } catch { return null; } }
function restore(b) { try { fs.writeFileSync(STATE, b); } catch { fs.rmSync(STATE, { force: true }); } }

test('quota initial : 3 documents / 20 questions', () => {
  const q = billing.quotaLeft('u@test.com');
  assert.strictEqual(q.documents, 3);
  assert.strictEqual(q.questions, 20);
  assert.strictEqual(q.premium, false);
});

test('consommation decroit le quota', () => {
  const email = 'c-' + Date.now() + '@test.com';
  billing.consume(email, 'documents');
  assert.strictEqual(billing.quotaLeft(email).documents, 2);
  billing.consume(email, 'questions');
  assert.strictEqual(billing.quotaLeft(email).questions, 19);
});

test('quota bloque apres limite', () => {
  const email = 'b-' + Date.now() + '@test.com';
  billing.consume(email, 'documents');
  billing.consume(email, 'documents');
  billing.consume(email, 'documents');
  const r = billing.consume(email, 'documents');
  assert.strictEqual(r.ok, false);
  assert.ok(/quota/i.test(r.reason));
});

test('demo active le premium', () => {
  const email = 'd-' + Date.now() + '@test.com';
  billing.activate(email, 'demo');
  assert.strictEqual(billing.isPremium(email), true);
  const q = billing.quotaLeft(email);
  assert.strictEqual(q.premium, true);
});

test('quotas disjoints entre utilisateurs', () => {
  const a = 'a-' + Date.now() + '@test.com';
  const b = 'b-' + Date.now() + '@test.com';
  billing.activate(a, 'demo');
  assert.strictEqual(billing.isPremium(a), true);
  assert.strictEqual(billing.isPremium(b), false);
  assert.strictEqual(billing.quotaLeft(b).documents, 3);
});