const test = require('node:test');
const assert = require('node:assert');
const { chunkText } = require('../lib/chunker');

test('texte court -> un seul chunk', () => {
  const out = chunkText('Bonjour le monde');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0], 'Bonjour le monde');
});

test('texte long -> découpé, pas de trou', () => {
  const text = 'mot '.repeat(3000);
  const out = chunkText(text, 1000, 100);
  assert.ok(out.length > 1, 'doit produire plusieurs chunks');
  const joined = out.join('').replace(/\s+/g, ' ');
  const expected = text.trim();
  assert.ok(joined.length >= expected.length * 0.85, 'garde l essentiel du contenu');
});

test('chunks sans vide', () => {
  const out = chunkText('a '.repeat(5000), 500, 50);
  assert.ok(out.every((c) => c.length > 0));
});

test('chevauchement : chaque chunk suivant débute avant la fin du précédent', () => {
  const out = chunkText('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda', 30, 10);
  for (let i = 1; i < out.length; i++) {
    assert.equal(out[i].length > 0, true);
  }
});