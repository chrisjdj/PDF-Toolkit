import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getCachedThumb, renderThumb, thumbKey, whenVisible } from '../lib/thumbnails';

/** Lazily renders a page thumbnail once its element scrolls near the viewport. */
export function useThumbnail<T extends Element>(doc: PDFDocumentProxy | undefined, fileId: string, pageNum: number) {
  const ref = useRef<T>(null);
  const key = thumbKey(fileId, pageNum);
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const src = getCachedThumb(key) ?? (loaded?.key === key ? loaded.url : undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el || !doc || getCachedThumb(key)) return;
    let cancelled = false;
    const stop = whenVisible(el, () => {
      renderThumb(doc, fileId, pageNum).then(url => {
        if (!cancelled && url) setLoaded({ key, url });
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [doc, fileId, pageNum, key]);

  return { ref, src };
}
