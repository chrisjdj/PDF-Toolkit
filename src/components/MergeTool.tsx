import { useMemo, useRef, type Dispatch, type KeyboardEvent } from 'react';
import { Check, Download, FilePlus, FileText, GitMerge, GripVertical, Loader, Plus, RotateCw, Trash2, X } from 'lucide-react';
import type { PDFFile } from '../types';
import type { MergeAction, MergeItem } from '../state/merge';
import { useReorder } from '../hooks/useReorder';
import { fileColor } from '../lib/utils';
import { Thumbnail } from './Thumbnail';

interface MergeToolProps {
  files: PDFFile[];
  queue: MergeItem[];
  dispatch: Dispatch<MergeAction>;
  busy: boolean;
  onMerge: () => void;
  onAddFiles: () => void;
  onRemoveFile: (fileId: string) => void;
  onPreview: (fileId: string, pageNum: number) => void;
}

export function MergeTool({ files, queue, dispatch, busy, onMerge, onAddFiles, onRemoveFile, onPreview }: MergeToolProps) {
  const queueRef = useRef<HTMLDivElement>(null);
  const { draggedIndex, overIndex, getItemProps } = useReorder(queueRef, (from, to) =>
    dispatch({ type: 'move', from, to }),
  );
  const filesById = useMemo(() => new Map(files.map(f => [f.id, f])), [files]);
  const queued = useMemo(() => new Set(queue.map(i => `${i.fileId}:${i.pageNum}`)), [queue]);

  return (
    <div className="merge-tool">
      <section className="merge-queue-panel" aria-labelledby="merge-queue-title">
        <div className="merge-queue-header">
          <h3 id="merge-queue-title">
            <GitMerge size={18} />
            Merge queue
          </h3>
          {queue.length > 0 && (
            <div className="toolbar-right">
              <span className="merge-count">{queue.length} pages</span>
              <button className="toolbar-btn" onClick={() => dispatch({ type: 'clear' })}>
                <X size={14} /> Clear all
              </button>
              <button className="toolbar-btn primary-btn" onClick={onMerge} disabled={busy}>
                {busy ? <Loader size={14} className="spin" /> : <Download size={14} />}
                Merge & download
              </button>
            </div>
          )}
        </div>

        {queue.length > 0 ? (
          <div className="merge-queue-grid" ref={queueRef} role="list" aria-label="Pages to merge, in order">
            {queue.map((item, index) => {
              const file = filesById.get(item.fileId);
              if (!file) return null;
              const { onKeyDown: reorderKeyDown, ...dragProps } = getItemProps(index, queue.length);
              const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                reorderKeyDown(e);
                if (e.defaultPrevented || e.target !== e.currentTarget) return;
                if (e.key === 'Enter') onPreview(item.fileId, item.pageNum);
                else if (e.key === 'Delete' || e.key === 'Backspace') dispatch({ type: 'remove', uid: item.uid });
                else if (e.key === 'r' || e.key === 'R') dispatch({ type: 'rotate', uid: item.uid, angle: e.shiftKey ? -90 : 90 });
                else return;
                e.preventDefault();
              };
              const classes = [
                'merge-queue-item',
                draggedIndex === index && 'dragging',
                overIndex === index && draggedIndex !== index && 'drag-over',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={item.uid}
                  role="listitem"
                  tabIndex={0}
                  className={classes}
                  aria-label={`Position ${index + 1}: page ${item.pageNum} of ${file.name}`}
                  {...dragProps}
                  onKeyDown={handleKeyDown}
                >
                  <GripVertical className="merge-drag-handle" size={14} aria-hidden="true" />
                  <span className="merge-page-num">{item.pageNum}</span>
                  <button
                    type="button"
                    className="thumb-preview-btn"
                    tabIndex={-1}
                    onClick={() => onPreview(item.fileId, item.pageNum)}
                    aria-label={`Preview page ${item.pageNum} of ${file.name}`}
                  >
                    <Thumbnail
                      doc={file.doc}
                      fileId={file.id}
                      pageNum={item.pageNum}
                      rotation={item.rotation}
                      className="merge-thumb-canvas"
                      alt=""
                    />
                  </button>
                  <div className="merge-source-badge" style={{ background: fileColor(file.colorIndex) }} title={file.name}>
                    {file.name}
                  </div>
                  <button
                    className="merge-rotate-btn"
                    onClick={() => dispatch({ type: 'rotate', uid: item.uid, angle: 90 })}
                    aria-label={`Rotate page ${item.pageNum} of ${file.name}`}
                    title="Rotate 90°"
                  >
                    <RotateCw size={10} />
                  </button>
                  <button
                    className="merge-remove-btn"
                    onClick={() => dispatch({ type: 'remove', uid: item.uid })}
                    aria-label={`Remove page ${item.pageNum} of ${file.name} from queue`}
                    title="Remove from queue"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="merge-empty">
            <p>No pages in the queue yet</p>
            <p className="muted-small">Tick pages below, or use “Add all”, to add them in the order you want.</p>
          </div>
        )}
      </section>

      <section className="source-pdfs" aria-labelledby="source-pdfs-title">
        <div className="source-pdfs-header">
          <h3 id="source-pdfs-title">
            <FilePlus size={18} />
            Source PDFs
          </h3>
          <button className="toolbar-btn" onClick={onAddFiles}>
            <Plus size={14} /> Add PDFs
          </button>
        </div>

        {files.map(file => (
          <div key={file.id} className="source-file-section" style={{ borderLeftColor: fileColor(file.colorIndex) }}>
            <div className="source-file-header">
              <div className="source-file-info">
                <FileText size={16} className="file-icon" />
                <span className="source-file-name" title={file.name}>{file.name}</span>
                <span className="source-file-meta">{file.pageCount} pages</span>
              </div>
              <div className="source-file-actions">
                <button className="toolbar-btn" onClick={() => dispatch({ type: 'addFile', fileId: file.id, pageCount: file.pageCount })}>
                  <Check size={12} /> Add all
                </button>
                <button className="toolbar-btn" onClick={() => dispatch({ type: 'clearFile', fileId: file.id })}>
                  <X size={12} /> Clear
                </button>
                <button className="icon-btn danger" onClick={() => onRemoveFile(file.id)} aria-label={`Remove ${file.name}`} title="Remove file">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="source-pages-grid">
              {Array.from({ length: file.pageCount }, (_, i) => i + 1).map(pageNum => {
                const isSelected = queued.has(`${file.id}:${pageNum}`);
                return (
                  <div key={pageNum} className={`source-page-item${isSelected ? ' selected' : ''}`}>
                    <label className="source-page-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => dispatch({ type: 'toggle', fileId: file.id, pageNum })}
                        aria-label={`Add page ${pageNum} of ${file.name} to merge queue`}
                      />
                    </label>
                    <button
                      type="button"
                      className="thumb-preview-btn"
                      onClick={() => onPreview(file.id, pageNum)}
                      aria-label={`Preview page ${pageNum} of ${file.name}`}
                    >
                      <Thumbnail doc={file.doc} fileId={file.id} pageNum={pageNum} className="source-thumb-canvas" alt="" />
                    </button>
                    <span className="source-page-num">{pageNum}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
