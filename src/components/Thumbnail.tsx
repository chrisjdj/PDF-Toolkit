import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useThumbnail } from '../hooks/useThumbnail';

interface ThumbnailProps {
  doc: PDFDocumentProxy;
  fileId: string;
  pageNum: number;
  rotation?: number;
  className: string;
  alt: string;
}

/** A lazily rendered page image. Uses <span> so it can sit inside buttons. */
export function Thumbnail({ doc, fileId, pageNum, rotation = 0, className, alt }: ThumbnailProps) {
  const { ref, src } = useThumbnail<HTMLSpanElement>(doc, fileId, pageNum);
  return (
    <span ref={ref} className={`thumb-frame ${className}${src ? '' : ' is-loading'}`}>
      {src && (
        <img
          src={src}
          alt={alt}
          draggable={false}
          decoding="async"
          style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      )}
    </span>
  );
}
