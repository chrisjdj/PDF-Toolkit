import type { PDFDocumentProxy } from 'pdfjs-dist';

/** key -> object URL of a JPEG thumbnail */
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
const releasedFiles = new Set<string>();

const MAX_CONCURRENT = 3;
let active = 0;
const queue: Array<() => void> = [];

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      task().then(resolve, reject).finally(() => {
        active--;
        queue.shift()?.();
      });
    };
    if (active < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

export const thumbKey = (fileId: string, pageNum: number) => `${fileId}:${pageNum}`;

export const getCachedThumb = (key: string): string | undefined => cache.get(key);

/** Renders a page thumbnail (cached). Width is in CSS pixels; device pixel ratio is applied. */
export function renderThumb(
  doc: PDFDocumentProxy,
  fileId: string,
  pageNum: number,
  cssWidth = 180,
): Promise<string | null> {
  const key = thumbKey(fileId, pageNum);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = schedule(async () => {
    if (releasedFiles.has(fileId)) return null;
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min((cssWidth * dpr) / base.width, 2);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    if (releasedFiles.has(fileId)) {
      URL.revokeObjectURL(url);
      return null;
    }
    cache.set(key, url);
    return url;
  })
    .catch(() => null) // doc destroyed mid-render, etc.
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

/** Frees every thumbnail of a file that was removed. */
export function releaseFileThumbs(fileId: string): void {
  releasedFiles.add(fileId);
  const prefix = `${fileId}:`;
  for (const [key, url] of cache) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      cache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// One shared IntersectionObserver for every thumbnail on the page.
// ---------------------------------------------------------------------------
const visibleCallbacks = new Map<Element, () => void>();
let observer: IntersectionObserver | null = null;

export function whenVisible(el: Element, callback: () => void): () => void {
  observer ??= new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = visibleCallbacks.get(entry.target);
        visibleCallbacks.delete(entry.target);
        observer?.unobserve(entry.target);
        cb?.();
      }
    },
    { rootMargin: '300px' },
  );
  visibleCallbacks.set(el, callback);
  observer.observe(el);
  return () => {
    visibleCallbacks.delete(el);
    observer?.unobserve(el);
  };
}
