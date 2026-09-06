const test = require('node:test');
const assert = require('node:assert');
const { RAGEngine } = require('../lib/rag');

test('similarité cosinus : identiques = 1', () => {
  const engine = new RAGEngine();
  const a = [0.5, 0.5, 0.5];
  assert.ok(Math.abs(engine._similarity(a, a) - 1) < 1e-9);
});

test('similarité cosinus : orthogonaux = 0', () => {
  const engine = new RAGEngine();
  assert.ok(Math.abs(engine._similarity([1, 0, 0], [0, 1, 0])) < 1e-9);
});

test('similarité cosinus : proches > éloignés', () => {
  const engine = new RAGEngine();
  const base = [1, 1, 1];
  const near = [0.9, 0.9, 0.8];
  const far = [-1, -1, -1];
  assert.ok(engine._similarity(base, near) > engine._similarity(base, far));
});

test('ask sur document inconnu -> erreur', async () => {
  const engine = new RAGEngine();
  await assert.rejects(() => engine.ask('user1', 'nope', 'question'), /introuvable/);
});

test('documents scopes par utilisateur', async () => {
  const engine = new RAGEngine();
  engine._userDocs('alice').set('d1', { id: 'd1', name: 'a', chunks: [], created: 1 });
  engine._userDocs('bob').set('d2', { id: 'd2', name: 'b', chunks: [], created: 1 });
  const ids = (arr) => arr.map((d) => d.id);
  assert.deepStrictEqual(ids(engine.listDocuments('alice')), ['d1']);
  assert.deepStrictEqual(ids(engine.listDocuments('bob')), ['d2']);
});

test('search trie les chunks par pertinence', () => {
  const engine = new RAGEngine();
  const doc = {
    chunks: [
      { text: 'chunk A', emb: [1, 0.1, 0] },
      { text: 'chunk B', emb: [0.9, 0.2, 0] },
    ],
  };
  const hits = engine._search(doc, [1, 0.1, 0], 2);
  assert.strictEqual(hits[0].text, 'chunk A');
  assert.ok(hits[0].score >= hits[1].score);
});