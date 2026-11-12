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

export function PopupPage({ doc, fileName, pageNum, rotation, position, total, onPrev, onNext, onClose }: PopupPageProps) {
  const [zoom, setZoom] = useState(100);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const canPrev = position > 1;
  const canNext = position < total;
  const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP));

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

  // Focus management: focus the dialog on open, restore focus on close, lock page scroll.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        return;
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
      case 'Tab': {
        // Keep focus inside the dialog.
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const label = `Page ${pageNum} of ${fileName}`;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="popup-content"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${label}`}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="popup-header">
          <div className="popup-title" title={fileName}>{fileName}</div>
          <div className="popup-header-center">
            <button className="popup-btn" onClick={onPrev} disabled={!canPrev} aria-label="Previous page">
              <ChevronLeft size={20} />
            </button>
            <span aria-live="polite">
              Page {pageNum} <span className="popup-position">({position} of {total})</span>
            </span>
            <button className="popup-btn" onClick={onNext} disabled={!canNext} aria-label="Next page">
              <ChevronRight size={20} />
            </button>
          </div>
          <button ref={closeRef} className="popup-close" onClick={onClose} aria-label="Close preview">
            <X size={20} />
          </button>
        </div>

        <div className="popup-body" ref={bodyRef}>
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

        <div className="popup-footer">
          <button className="popup-btn" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="zoom-value" aria-live="polite">{zoom}%</span>
          <button className="popup-btn" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button className="popup-btn fit-btn" onClick={() => setZoom(100)} aria-label="Fit page to window">
            Fit
          </button>
          <span className="popup-hint">← → to navigate · Esc to close</span>
        </div>
      </div>
    </div>
  );
}
