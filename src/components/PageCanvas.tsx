import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

interface PageCanvasProps {
  doc: PDFDocumentProxy;
  pageNum: number;
  /** Extra rotation applied on top of the page's own rotation. */
  rotation: number;
  /** 100 = fit to the available area. */
  zoom: number;
  availableWidth: number;
  availableHeight: number;
  label: string;
}

const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * Renders a page sharply (device-pixel-ratio aware). Each render draws into a fresh canvas
 * that replaces the previous one when done, so rapid zoom/navigation never races on one canvas.
 */
export function PageCanvas({ doc, pageNum, rotation, zoom, availableWidth, availableHeight, label }: PageCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || availableWidth <= 0 || availableHeight <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const totalRotation = (page.rotate + rotation) % 360;
        const base = page.getViewport({ scale: 1, rotation: totalRotation });
        const fit = Math.min(availableWidth / base.width, availableHeight / base.height);
        const cssScale = fit * (zoom / 100);
        const dpr = window.devicePixelRatio || 1;
        let renderScale = cssScale * dpr;
        const pixels = base.width * base.height * renderScale * renderScale;
        if (pixels > MAX_CANVAS_PIXELS) renderScale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);

        const viewport = page.getViewport({ scale: renderScale, rotation: totalRotation });
        const canvas = document.createElement('canvas');
        canvas.className = 'popup-canvas';
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(base.width * cssScale)}px`;
        canvas.style.height = `${Math.floor(base.height * cssScale)}px`;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', label);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
        if (!cancelled) host.replaceChildren(canvas);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error('Preview render failed', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNum, rotation, zoom, availableWidth, availableHeight, label]);

  return <div ref={hostRef} className="popup-canvas-host" />;
}
