const fs = require('fs');

let cached;

async function getPdfJs() {
  if (!cached) {
    cached = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return cached;
}

async function extractText(filePath) {
  const { getDocument } = await getPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    standardFontDataUrl: await standardFontUrl(),
  }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => (it.str || '')).join(' ') + '\n';
  }
  if (typeof doc.destroy === 'function') await doc.destroy();
  return text;
}

async function standardFontUrl() {
  const path = require('path');
  const nodeModules = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts');
  return require('url').pathToFileURL(nodeModules + path.sep).href;
}

module.exports = { extractText };