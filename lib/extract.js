// Extraction de texte multi-format : PDF (pdf.js) + OCR fallback (pdftoppm +
// tesseract) pour PDF scannés, TXT/MD/CSV (lecture directe), DOCX (mammoth).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const mammoth = require('mammoth');

const exec = promisify(execFile);

const SUPPORTED = ['.pdf', '.txt', '.md', '.csv', '.docx'];

let pdfjs;
async function pdfjsLib() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

// Extrait le texte d'un PDF via pdf.js (sous 50 chars de texte → considéré scanné).
async function extractPdf(filePath) {
  const { getDocument } = await pdfjsLib();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await getDocument({ data, disableWorker: true, isEvalSupported: false }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => (it.str || '')).join(' ') + '\n';
  }
  if (typeof doc.destroy === 'function') await doc.destroy();
  return text.trim();
}

// OCR d'un PDF scanné : chaque page → image (pdftoppm) → tesseract.
async function ocrPdf(filePath, chunks = 4) {
  const outDir = path.join(path.dirname(filePath), 'ocrtmp_' + Date.now());
  fs.mkdirSync(outDir, { recursive: true });
  try {
    await exec('pdftoppm', ['-png', '-r', '200', filePath, path.join(outDir, 'page')]);
    const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort();
    if (files.length === 0) return '';
    let text = '';
    for (const f of files) {
      text += await exec('tesseract', [path.join(outDir, f), 'stdout', '-l', 'fra+eng']).then((r) => r.stdout).catch(() => '');
    }
    return text.trim();
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

async function extractDocx(filePath) {
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value.trim();
}

async function extractText(filePath, ext) {
  ext = ext.toLowerCase();
  if (ext === '.pdf') {
    let text = await extractPdf(filePath);
    // PDF scanné (peu de texte) → OCR
    if (text.length < 50) {
      const ocr = await ocrPdf(filePath);
      if (ocr.length > 50) return ocr;
      return text;
    }
    return text;
  }
  if (ext === '.docx') return extractDocx(filePath);
  // txt, md, csv : lecture directe (utf8, tolérant)
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
}

module.exports = { extractText, SUPPORTED };