import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface PDFFile {
  id: string;
  name: string;
  size: number;
  file: File;
  pageCount: number;
  doc: PDFDocumentProxy;
  /** Stable index into FILE_COLORS, assigned when the file is added. */
  colorIndex: number;
}

export type Tool = 'split' | 'compress' | 'merge';

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  id: number;
  type: AlertType;
  message: string;
}

/** Which page the preview dialog shows, and where its rotation comes from. */
export interface PreviewTarget {
  fileId: string;
  pageNum: number;
  source: 'editor' | 'merge';
}
