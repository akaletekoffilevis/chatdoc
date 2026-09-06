// Moteur RAG scopé par utilisateur : embeddings via API compatible OpenAI +
// recherche de similarité cosinus + chat. Deux fournisseurs indépendants :
//   - EMBEDDINGS : GEMINI_API_KEY (ou OPENAI_API_KEY si OPENAI_BASE_URL défini)
//   - CHAT       : OPENROUTER_API_KEY / OPENAI_API_KEY
class RAGEngine {
  constructor() {
    this.users = new Map(); // userId -> Map(docId -> doc)
    this.seq = 0;

    // Fournisseur « embeddings » : Gemini par défaut, sinon la base OpenAI.
    this.embedBase = (process.env.GEMINI_API_KEY
      ? 'https://generativelanguage.googleapis.com/v1beta/openai'
      : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''));
    this.embedKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
    this.embedModel = process.env.EMBED_MODEL
      || (process.env.GEMINI_API_KEY ? 'text-embedding-004' : 'text-embedding-3-small');

    // Fournisseur « chat » : OpenRouter d'abord, sinon base OpenAI.
    this.chatBase = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_BASE_URL)
      ? (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : (process.env.OPENAI_BASE_URL || '').replace(/\/$/, ''))
      : 'https://api.openai.com/v1';
    this.chatKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
    this.chatModel = process.env.CHAT_MODEL || 'openai/gpt-4o-mini';

    if (!this.embedKey) console.warn('\n⚠  Aucune clé embeddings (GEMINI_API_KEY / OPENAI_API_KEY).\n');
    if (!this.chatKey) console.warn('⚠  Aucune clé chat (OPENROUTER_API_KEY / OPENAI_API_KEY).\n');
  }

  _userDocs(userId) {
    if (!this.users.has(userId)) this.users.set(userId, new Map());
    return this.users.get(userId);
  }

  async _embed(texts) {
    const r = await fetch(`${this.embedBase}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.embedKey}` },
      body: JSON.stringify({ model: this.embedModel, input: texts }),
    });
    if (!r.ok) throw new Error(`Embeddings API ${r.status}: ${(await r.text()).slice(0, 240)}`);
    return (await r.json()).data.map((d) => d.embedding);
  }

  _similarity(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  _search(doc, queryEmb, topK = 6) {
    return doc.chunks
      .map((c) => ({ text: c.text, score: this._similarity(c.emb, queryEmb) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async addDocument(userId, name, chunks) {
    const embs = await this._embed(chunks);
    const id = `doc_${++this.seq}`;
    const embedded = chunks.map((c, i) => ({ text: c, emb: embs[i] }));
    const docs = this._userDocs(userId);
    docs.set(id, { id, name, chunks: embedded, created: Date.now() });
    return id;
  }

  removeDocument(userId, docId) {
    return this._userDocs(userId).delete(docId);
  }

  listDocuments(userId) {
    return [...this._userDocs(userId).values()].map((d) => ({
      id: d.id, name: d.name, chunks: d.chunks.length, created: d.created,
    }));
  }

  async ask(userId, docId, question) {
    const doc = this._userDocs(userId).get(docId);
    if (!doc) throw new Error('Document introuvable');
    const [qEmb] = await this._embed([question]);
    const hits = this._search(doc, qEmb);
    if (hits.length === 0 || hits[0].score < 0.2) {
      return "Je n'ai rien trouvé de pertinent dans le document pour répondre à cette question.";
    }
    const context = hits.map((h) => h.text).join('\n\n---\n\n');
    const r = await fetch(`${this.chatBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.chatKey}`,
        ...(this.chatBase.includes('openrouter') ? { 'X-Title': 'ChatDoc' } : {}),
      },
      body: JSON.stringify({
        model: this.chatModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: "Tu réponds UNIQUEMENT à partir du contexte fourni, en français. Si l'info n'y est pas, dis-le clairement. Cite les chiffres exacts du document." },
          { role: 'user', content: `CONTEXTE DU DOCUMENT « ${doc.name} » :\n${context}\n\nQUESTION : ${question}` },
        ],
      }),
    });
    if (!r.ok) throw new Error(`Chat API ${r.status}: ${(await r.text()).slice(0, 240)}`);
    return (await r.json()).choices[0].message.content;
  }
}

module.exports = { RAGEngine };