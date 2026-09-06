// Moteur RAG : embeddings via API compatible OpenAI (fonctionne avec OpenAI,
// Groq, Mistral, LiteLLM, Ollama… via OPENAI_BASE_URL) + recherche de similitude
// cosinus + chat basé uniquement sur les chunks pertinents.
class RAGEngine {
  constructor() {
    this.documents = new Map(); // id -> { name, chunks: [] , embedding: [...] (moyenne) }
    this.seq = 0;
    this.baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.modelEmbed = process.env.EMBED_MODEL || 'text-embedding-3-small';
    this.modelChat = process.env.CHAT_MODEL || 'gpt-4o-mini';
    if (!this.apiKey) {
      console.warn('\n⚠  Aucune OPENAI_API_KEY détectée. Le chat échouera. Voir .env\n');
    }
  }

  async _embed(texts) {
    const r = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.modelEmbed, input: texts }),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`Embeddings API ${r.status}: ${body.slice(0, 200)}`);
    }
    const json = await r.json();
    return json.data.map((d) => d.embedding);
  }

  addDocument(name, chunks) {
    return this._embed(chunks).then((embs) => {
      const id = `doc_${++this.seq}`;
      const embedded = chunks.map((c, i) => ({ text: c, emb: embs[i] }));
      const mean = embs[0].map((_, i) => embs.reduce((s, e) => s + e[i], 0) / embs.length);
      this.documents.set(id, { id, name, chunks: embedded, mean, created: Date.now() });
      return id;
    });
  }

  async removeDocument(id) {
    return this.documents.delete(id);
  }

  listDocuments() {
    return [...this.documents.values()].map((d) => ({ id: d.id, name: d.name, chunks: d.chunks.length, created: d.created }));
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

  async ask(docId, question) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error('Document introuvable');
    const [qEmb] = await this._embed([question]);
    const hits = this._search(doc, qEmb);
    if (hits.length === 0 || hits[0].score < 0.2) {
      return "Je n'ai rien trouvé de pertinent dans le document pour répondre à cette question.";
    }
    const context = hits.map((h) => h.text).join('\n\n---\n\n');
    const r = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.modelChat,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Tu réponds UNIQUEMENT à partir du contexte fourni, en français. Si l\'info n\'y est pas, dis-le clairement. Cite les chiffres exacts du document.' },
          { role: 'user', content: `CONTEXTE DU DOCUMENT « ${doc.name} » :\n${context}\n\nQUESTION : ${question}` },
        ],
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`Chat API ${r.status}: ${body.slice(0, 200)}`);
    }
    const json = await r.json();
    return json.choices[0].message.content;
  }
}

module.exports = { RAGEngine };