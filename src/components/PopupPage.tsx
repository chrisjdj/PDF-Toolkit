import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PageCanvas } from './PageCanvas';

interface PopupPageProps {
  doc: PDFDocumentProxy;
  fileName: string;
  pageNum: number;
  rotation: number;
  /** Position within the navigable sequence (1-based) and its length. */
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 400;
const ZOOM_STEP = 25;

/**
 * Page preview. Native <dialog> + showModal() provides the focus trap, Esc to close and an
 * inert background; page scroll is locked by `html:has(dialog[open])` in the shared styles.
 */
export function PopupPage({ doc, fileName, pageNum, rotation, position, total, onPrev, onNext, onClose }: PopupPageProps) {
  const [zoom, setZoom] = useState(100);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const canPrev = position > 1;
  const canNext = position < total;
  const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  const close = () => dialogRef.current?.close();

  // Open as a modal; restore focus to the opener when it goes away.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    // Ignore a stale 'close' event queued by a previous cleanup (StrictMode re-runs effects).
    const handleClose = () => {
      if (!dialog.open) onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
      previouslyFocused?.focus?.();
    };
  }, []);

  // Measure the area available for the page.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setArea({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  // Esc is handled natively by <dialog> (cancel → close).
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        if (canPrev) onPrev();
        return;
      case 'ArrowRight':
        if (canNext) onNext();
        return;
      case '+':
      case '=':
        zoomIn();
        return;
      case '-':
        zoomOut();
        return;
      case '0':
        setZoom(100);
        return;
    }
  };

  const label = `Page ${pageNum} of ${fileName}`;

  return (
    <dialog
      ref={dialogRef}
      className="dialog preview-dialog"
      aria-label={`Preview: ${label}`}
      onKeyDown={handleKeyDown}
      onClick={e => {
        // A click on the dialog element itself (the backdrop area) closes it.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog__header">
        <h2 className="dialog__title" title={fileName}>{fileName}</h2>
        <div className="preview-nav">
          <button type="button" className="btn btn--ghost btn--icon" onClick={onPrev} disabled={!canPrev} aria-label="Previous page">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="preview-nav__label" aria-live="polite">
            Page {pageNum} <span className="preview-nav__position">({position} of {total})</span>
          </span>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onNext} disabled={!canNext} aria-label="Next page">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <button ref={closeRef} type="button" className="btn btn--ghost btn--icon preview-close" onClick={close} aria-label="Close preview">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="dialog__body preview-body" ref={bodyRef}>
        <PageCanvas
          doc={doc}
          pageNum={pageNum}
          rotation={rotation}
          zoom={zoom}
          availableWidth={area.w}
          availableHeight={area.h}
          label={label}
        />
      </div>

      <div className="dialog__footer preview-footer">
        <button type="button" className="btn btn--secondary btn--icon" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
          <ZoomOut size={16} aria-hidden="true" />
        </button>
        <span className="preview-footer__zoom" aria-live="polite">{zoom}%</span>
        <button type="button" className="btn btn--secondary btn--icon" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
          <ZoomIn size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setZoom(100)} aria-label="Fit page to window">
          Fit
        </button>
        <span className="preview-footer__hint">
          <kbd>←</kbd> <kbd>→</kbd> navigate · <kbd>+</kbd> <kbd>−</kbd> zoom · <kbd>Esc</kbd> close
        </span>
      </div>
    </dialog>
  );
}
