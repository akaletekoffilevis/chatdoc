// Découpe un texte long en morceaux (~taille caractères) avec chevauchement léger.
function chunkText(text, chunkSize = 1500, overlap = 200) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= chunkSize) return [clean];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = start + chunkSize;
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end);
      if (lastSpace > start + chunkSize * 0.6) end = lastSpace;
    }
    chunks.push(clean.slice(start, end).trim());
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

module.exports = { chunkText };