import { useMemo, useRef, type Dispatch, type KeyboardEvent } from 'react';
import { Download, FilePlus, FileText, GitMerge, GripVertical, ListPlus, Loader, Plus, RotateCw, Trash2, X } from 'lucide-react';
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
    <>
      <section className="card merge-queue" aria-labelledby="merge-queue-title">
        <div className="section-header">
          <h2 id="merge-queue-title" className="card__title">
            <GitMerge size={16} aria-hidden="true" />
            Merge queue
            {queue.length > 0 && <span className="badge badge--accent">{queue.length} pages</span>}
          </h2>
          {queue.length > 0 && (
            <div className="section-header__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => dispatch({ type: 'clear' })}>
                <X size={16} aria-hidden="true" /> Clear all
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={onMerge} disabled={busy}>
                {busy ? <Loader size={16} className="spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                Merge & download
              </button>
            </div>
          )}
        </div>

        {queue.length > 0 ? (
          <div className="merge-queue__grid" ref={queueRef} role="list" aria-label="Pages to merge, in order">
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
                'merge-chip',
                draggedIndex === index && 'is-dragging',
                overIndex === index && draggedIndex !== index && 'is-drop-target',
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
                  <div className="merge-chip__media">
                    <button
                      type="button"
                      className="thumb-button"
                      tabIndex={-1}
                      onClick={() => onPreview(item.fileId, item.pageNum)}
                      aria-label={`Preview page ${item.pageNum} of ${file.name}`}
                    >
                      <Thumbnail
                        doc={file.doc}
                        fileId={file.id}
                        pageNum={item.pageNum}
                        rotation={item.rotation}
                        className="merge-chip__thumb"
                        alt=""
                      />
                    </button>
                    <span className="badge merge-chip__position" aria-hidden="true">{index + 1}</span>
                    <GripVertical className="drag-handle" size={16} aria-hidden="true" />
                  </div>
                  <span className="file-tag" title={file.name}>
                    <span className="file-tag__dot" style={{ background: fileColor(file.colorIndex) }} aria-hidden="true" />
                    <span className="file-tag__name">p.{item.pageNum} · {file.name}</span>
                  </span>
                  <div className="merge-chip__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon thumb-action"
                      onClick={() => dispatch({ type: 'rotate', uid: item.uid, angle: 90 })}
                      aria-label={`Rotate page ${item.pageNum} of ${file.name}`}
                      title="Rotate 90°"
                    >
                      <RotateCw size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--icon thumb-action"
                      onClick={() => dispatch({ type: 'remove', uid: item.uid })}
                      aria-label={`Remove page ${item.pageNum} of ${file.name} from queue`}
                      title="Remove from queue"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state empty-state--compact">
            <span className="empty-state__icon" aria-hidden="true">
              <ListPlus size={24} />
            </span>
            <h3>No pages in the queue yet</h3>
            <p>Tick pages below, or use “Add all”, to add them in the order you want.</p>
          </div>
        )}
      </section>

      <section className="card source-pdfs" aria-labelledby="source-pdfs-title">
        <div className="section-header">
          <h2 id="source-pdfs-title" className="card__title">
            <FilePlus size={16} aria-hidden="true" />
            Source PDFs
          </h2>
          <div className="section-header__actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={onAddFiles}>
              <Plus size={16} aria-hidden="true" /> Add PDFs
            </button>
          </div>
        </div>

        <div className="source-pdfs__list">
          {files.map(file => (
            <div key={file.id} className="source-file" style={{ borderLeftColor: fileColor(file.colorIndex) }}>
              <div className="source-file__header">
                <div className="source-file__info">
                  <FileText size={16} aria-hidden="true" style={{ color: fileColor(file.colorIndex) }} />
                  <span className="source-file__name" title={file.name}>{file.name}</span>
                  <span className="source-file__meta">{file.pageCount} pages</span>
                </div>
                <div className="source-file__actions">
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => dispatch({ type: 'addFile', fileId: file.id, pageCount: file.pageCount })}>
                    <Plus size={16} aria-hidden="true" /> Add all
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => dispatch({ type: 'clearFile', fileId: file.id })}>
                    <X size={16} aria-hidden="true" /> Clear
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger-ghost btn--icon btn--sm"
                    onClick={() => onRemoveFile(file.id)}
                    aria-label={`Remove ${file.name}`}
                    title="Remove file"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="source-file__pages">
                {Array.from({ length: file.pageCount }, (_, i) => i + 1).map(pageNum => {
                  const isSelected = queued.has(`${file.id}:${pageNum}`);
                  return (
                    <div key={pageNum} className={`source-page${isSelected ? ' is-selected' : ''}`}>
                      <button
                        type="button"
                        className="thumb-button"
                        onClick={() => onPreview(file.id, pageNum)}
                        aria-label={`Preview page ${pageNum} of ${file.name}`}
                      >
                        <Thumbnail doc={file.doc} fileId={file.id} pageNum={pageNum} className="source-page__thumb" alt="" />
                      </button>
                      <label className="thumb-check">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => dispatch({ type: 'toggle', fileId: file.id, pageNum })}
                          aria-label={`Add page ${pageNum} of ${file.name} to merge queue`}
                        />
                      </label>
                      <span className="badge source-page__num" aria-hidden="true">{pageNum}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
