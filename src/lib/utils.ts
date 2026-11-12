export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${units[i]}`;
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** "Report.PDF" -> "Report" */
export function stripPdfExt(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

export function downloadBlob(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Moves the item at `from` to position `to`, returning a new array. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Parses a page selection like "1-3, 7, 10-" into page numbers (1-based) within [1, max].
 * Returns null when the text contains something that isn't a number or range.
 */
export function parsePageRanges(text: string, max: number): number[] | null {
  const parts = text.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const pages = new Set<number>();
  for (const part of parts) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 1;
      const end = m[2] ? parseInt(m[2], 10) : max;
      if (!m[1] && !m[2]) return null;
      const [lo, hi] = start <= end ? [start, end] : [end, start];
      for (let p = Math.max(1, lo); p <= Math.min(max, hi); p++) pages.add(p);
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= max) pages.add(p);
    } else {
      return null;
    }
  }
  return [...pages];
}

/** Distinct, colour-blind-friendly-ish hues for tagging source files in the merge view. */
export const FILE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ec4899',
  '#0ea5e9', '#f97316', '#8b5cf6', '#14b8a6',
  '#ef4444', '#84cc16',
];

export function fileColor(colorIndex: number): string {
  return FILE_COLORS[colorIndex % FILE_COLORS.length];
}
