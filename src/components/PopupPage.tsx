import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';

interface PopupPageProps {
  isOpen: boolean;
  currentPage: number;
  totalPages: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  zoomValue: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  children: React.ReactNode;
}

export const PopupPage: React.FC<PopupPageProps> = ({
  isOpen,
  currentPage,
  totalPages,
  onClose,
  onPrev,
  onNext,
  zoomValue,
  onZoomIn,
  onZoomOut,
  onFit,
  children,
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <div className="popup-header-left">
            <button 
              className="popup-btn popup-nav prev"
              onClick={onPrev}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button 
              className="popup-btn popup-nav next"
              onClick={onNext}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button className="popup-close" onClick={onClose} aria-label="Close preview">
            <X size={20} />
          </button>
        </div>
        
        <div className="popup-body">
          {children}
        </div>
        
        <div className="popup-footer">
          <button className="popup-btn popup-zoom-btn" onClick={onZoomOut} aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="zoom-value">{zoomValue}%</span>
          <button className="popup-btn popup-zoom-btn" onClick={onZoomIn} aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button className="popup-btn popup-zoom-btn fit-btn" onClick={onFit} aria-label="Fit to screen">
            Fit
          </button>
        </div>
      </div>
    </div>
  );
};
