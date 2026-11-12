import type { PDFDocument } from '@cantoo/pdf-lib';

type PdfLib = typeof import('@cantoo/pdf-lib');

/** A page to place in an output document. `rotation` is added on top of the page's own rotation. */
export interface PageRef {
  fileId: string;
  file: File;
  pageNum: number; // 1-based
  rotation: number;
}

let pdfLibPromise: Promise<PdfLib> | null = null;
/** pdf-lib is ~550 KB, so it is only fetched the first time the user exports something. */
function loadPdfLib(): Promise<PdfLib> {
  pdfLibPromise ??= import('@cantoo/pdf-lib');
  return pdfLibPromise;
}

/**
 * Loads a document with pdf-lib. Files that are encrypted with only an owner password
 * (they open without a password but restrict editing) are decrypted with the empty user password.
 */
async function loadDocument(lib: PdfLib, bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await lib.PDFDocument.load(bytes);
  } catch (err) {
    if (err instanceof lib.EncryptedPDFError) {
      return lib.PDFDocument.load(bytes, { password: '' });
    }
    throw err;
  }
}

/** Builds a new PDF from pages of one or more source files, in the given order. */
export async function buildPdf(pages: PageRef[]): Promise<Uint8Array> {
  const lib = await loadPdfLib();
  const out = await lib.PDFDocument.create();

  // Copy every needed page of a source in a single copyPages() call so shared resources
  // (fonts, images) are copied once instead of once per page.
  const indicesByFile = new Map<string, { file: File; indices: number[] }>();
  for (const p of pages) {
    const entry = indicesByFile.get(p.fileId) ?? { file: p.file, indices: [] };
    if (!entry.indices.includes(p.pageNum - 1)) entry.indices.push(p.pageNum - 1);
    indicesByFile.set(p.fileId, entry);
  }

  const copied = new Map<string, Map<number, ReturnType<PDFDocument['getPage']>>>();
  for (const [fileId, { file, indices }] of indicesByFile) {
    const src = await loadDocument(lib, new Uint8Array(await file.arrayBuffer()));
    const valid = indices.filter(i => i >= 0 && i < src.getPageCount());
    const copiedPages = await out.copyPages(src, valid);
    copied.set(fileId, new Map(valid.map((idx, k) => [idx, copiedPages[k]])));
  }

  for (const p of pages) {
    const page = copied.get(p.fileId)?.get(p.pageNum - 1);
    if (!page) continue;
    if (p.rotation % 360 !== 0) {
      page.setRotation(lib.degrees((page.getRotation().angle + p.rotation) % 360));
    }
    out.addPage(page);
  }

  return out.save({ useObjectStreams: true });
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

interface QpdfInstance {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
  };
  callMain(args: string[]): number;
}

/** Runs qpdf (WASM, loaded on demand) to rebuild the file with maximum lossless stream compression. */
async function qpdfOptimize(input: Uint8Array): Promise<Uint8Array> {
  const { default: createQpdf } = await import('qpdf-wasm-esm-embedded');
  // The factory resolves once the WASM runtime is ready; it must be awaited before using FS.
  const qpdf = (await createQpdf({
    noInitialRun: true,
    print: () => {},
    printErr: () => {},
  } as Partial<EmscriptenModule>)) as unknown as QpdfInstance;

  qpdf.FS.writeFile('in.pdf', input);
  qpdf.callMain([
    '--object-streams=generate',
    '--compress-streams=y',
    '--recompress-flate',
    '--compression-level=9',
    'in.pdf',
    'out.pdf',
  ]);
  try {
    return qpdf.FS.readFile('out.pdf');
  } catch {
    throw new Error('qpdf could not process this file');
  }
}

export interface ImageOptions {
  maxDimension: number; // longest side in pixels
  quality: number; // 0..1 JPEG quality
}

/**
 * Lossy pass: re-encodes JPEG images that are larger than needed. Only touches plain
 * 8-bit RGB/Gray JPEGs without masks, and keeps the original when re-encoding doesn't help.
 */
async function recompressImages(bytes: Uint8Array, opts: ImageOptions): Promise<{ bytes: Uint8Array; count: number }> {
  const lib = await loadPdfLib();
  const { PDFName, PDFNumber, PDFArray, PDFRawStream, PDFStream } = lib;
  const doc = await loadDocument(lib, bytes);
  const ctx = doc.context;
  const N = (s: string) => PDFName.of(s);

  const isJpeg = (filter: unknown) =>
    filter === N('DCTDecode') ||
    (filter instanceof PDFArray && filter.size() === 1 && filter.lookup(0) === N('DCTDecode'));

  const isSupportedColorSpace = (cs: unknown): boolean => {
    if (cs === N('DeviceRGB') || cs === N('DeviceGray')) return true;
    if (cs instanceof PDFArray && cs.lookup(0) === N('ICCBased')) {
      const profile = cs.lookup(1);
      const n = profile instanceof PDFStream ? profile.dict.lookup(N('N')) : undefined;
      return n instanceof PDFNumber && (n.asNumber() === 3 || n.asNumber() === 1);
    }
    return false;
  };

  let count = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.lookup(N('Subtype')) !== N('Image')) continue;
    if (!isJpeg(dict.lookup(N('Filter')))) continue;
    if (dict.has(N('SMask')) || dict.has(N('Mask')) || dict.has(N('Decode')) || dict.has(N('ImageMask'))) continue;
    const bpc = dict.lookup(N('BitsPerComponent'));
    if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) continue;
    if (!isSupportedColorSpace(dict.lookup(N('ColorSpace')))) continue;

    const w = dict.lookup(N('Width'));
    const h = dict.lookup(N('Height'));
    if (!(w instanceof PDFNumber) || !(h instanceof PDFNumber)) continue;
    const scale = Math.min(1, opts.maxDimension / Math.max(w.asNumber(), h.asNumber()));
    const newW = Math.max(1, Math.round(w.asNumber() * scale));
    const newH = Math.max(1, Math.round(h.asNumber() * scale));

    try {
      const bitmap = await createImageBitmap(new Blob([obj.contents as BlobPart], { type: 'image/jpeg' }));
      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const c2d = canvas.getContext('2d');
      if (!c2d) continue;
      c2d.fillStyle = '#fff';
      c2d.fillRect(0, 0, newW, newH);
      c2d.drawImage(bitmap, 0, 0, newW, newH);
      bitmap.close();
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', opts.quality));
      if (!blob) continue;
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      if (jpeg.length >= obj.contents.length * 0.9) continue; // not worth it

      const newDict = dict.clone(ctx);
      newDict.set(N('Width'), PDFNumber.of(newW));
      newDict.set(N('Height'), PDFNumber.of(newH));
      newDict.set(N('ColorSpace'), N('DeviceRGB'));
      newDict.set(N('Filter'), N('DCTDecode'));
      newDict.delete(N('DecodeParms'));
      newDict.set(N('Length'), PDFNumber.of(jpeg.length));
      ctx.assign(ref, PDFRawStream.of(newDict, jpeg));
      count++;
    } catch {
      // Undecodable image (e.g. unusual JPEG variant): leave it untouched.
    }
  }

  if (count === 0) return { bytes, count };
  return { bytes: await doc.save({ useObjectStreams: true }), count };
}

export interface CompressResult {
  bytes: Uint8Array;
  imagesRecompressed: number;
}

/**
 * Compresses a PDF. `strong` also downsamples/re-encodes JPEG images (lossy).
 * Never returns something larger than the input.
 */
export async function compressPdf(input: Uint8Array, strong: boolean): Promise<CompressResult> {
  let working = input;
  let imagesRecompressed = 0;
  if (strong) {
    const r = await recompressImages(input, { maxDimension: 1600, quality: 0.72 });
    working = r.bytes;
    imagesRecompressed = r.count;
  }
  const optimized = await qpdfOptimize(working);
  const best = [input, working, optimized].reduce((a, b) => (b.length < a.length ? b : a));
  return { bytes: best, imagesRecompressed };
}
