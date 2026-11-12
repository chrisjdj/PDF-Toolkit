import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/**
 * Loads pdf.js on first use (it is ~400 KB) and wires up its worker.
 * Subsequent calls return the same module.
 */
export function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export type OpenResult =
  | { ok: true; doc: PDFDocumentProxy }
  | { ok: false; reason: 'password' | 'invalid' };

/**
 * Opens a PDF with pdf.js. Password-protected (user password) files are reported, not thrown.
 * Note: pdf.js may transfer `bytes` to its worker, so callers must not reuse the buffer.
 */
export async function openPdf(bytes: Uint8Array): Promise<OpenResult> {
  const pdfjs = await getPdfjs();
  try {
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    return { ok: true, doc };
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    return { ok: false, reason: name === 'PasswordException' ? 'password' : 'invalid' };
  }
}
