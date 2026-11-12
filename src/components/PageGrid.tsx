import { useRef, type Dispatch, type KeyboardEvent } from 'react';
import { Check, Download, GripVertical, Loader, RotateCw, Trash2, Undo2 } from 'lucide-react';
import type { PDFFile } from '../types';
import { isDirty, type EditorAction, type EditorState } from '../state/editor';
import { useReorder } from '../hooks/useReorder';
import { Thumbnail } from './Thumbnail';

interface PageGridProps {
  file: PDFFile;
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  busy: boolean;
  onPreview: (pageNum: number) => void;
  onSave: () => void;
  onDiscard: () => void;
}

export function PageGrid({ file, state, dispatch, busy, onPreview, onSave, onDiscard }: PageGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const fileId = file.id;
  const { draggedIndex, overIndex, getItemProps } = useReorder(gridRef, (from, to) =>
    dispatch({ type: 'move', fileId, from, to }),
  );

  const dirty = isDirty(state);
  const visibleCount = state.order.length - state.deleted.size;
  const selectedCount = state.selected.size;

  return (
    <>
      <div className="selection-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-btn" onClick={() => dispatch({ type: 'selectAll', fileId })}>
            <Check size={14} /> Select all
          </button>
          <button
            className="toolbar-btn"
            onClick={() => dispatch({ type: 'clearSelection', fileId })}
            disabled={selectedCount === 0}
          >
            Clear selection
          </button>
        </div>

        <div className="toolbar-center" aria-live="polite">
          <span>
            {selectedCount > 0 ? `${selectedCount} of ${visibleCount} selected` : `${visibleCount} pages`}
          </span>
          {dirty && <span className="changes-indicator">• Unsaved changes</span>}
        </div>

        <div className="toolbar-right">
          {dirty && (
            <button className="toolbar-btn discard-btn" onClick={onDiscard}>
              <Undo2 size={14} /> Discard
            </button>
          )}
          <button className="toolbar-btn primary-btn" onClick={onSave} disabled={busy || visibleCount === 0}>
            {busy ? <Loader size={14} className="spin" /> : <Download size={14} />}
            {selectedCount > 0 ? `Save ${selectedCount} selected` : 'Save as PDF'}
          </button>
        </div>
      </div>

      <p className="grid-hint" id="page-grid-help">
        Drag to reorder (long-press on touch). Keyboard: Alt+arrows move, Enter previews, Space selects, R rotates, Delete removes.
      </p>

      <div className="thumbnail-grid" ref={gridRef} role="list" aria-describedby="page-grid-help">
        {state.order.map((pageNum, index) => {
          const isDeleted = state.deleted.has(pageNum);
          const isSelected = state.selected.has(pageNum);
          const rotation = state.rotations.get(pageNum) ?? 0;
          const { onKeyDown: reorderKeyDown, ...dragProps } = getItemProps(index, state.order.length);

          const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
            reorderKeyDown(e);
            if (e.defaultPrevented || e.target !== e.currentTarget) return;
            if (e.key === 'Enter' && !isDeleted) onPreview(pageNum);
            else if (e.key === ' ') {
              e.preventDefault();
              dispatch({ type: 'toggleSelect', fileId, pageNum });
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
              dispatch({ type: 'toggleDelete', fileId, pageNum });
            } else if ((e.key === 'r' || e.key === 'R') && !isDeleted) {
              dispatch({ type: 'rotate', fileId, pageNum, angle: e.shiftKey ? -90 : 90 });
            } else return;
            e.preventDefault();
          };

          const classes = [
            'thumbnail-item',
            isSelected && 'selected',
            isDeleted && 'deleted',
            draggedIndex === index && 'dragging',
            overIndex === index && draggedIndex !== index && 'drag-over',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={pageNum}
              role="listitem"
              tabIndex={0}
              className={classes}
              aria-label={`Page ${pageNum}, position ${index + 1}${isSelected ? ', selected' : ''}${isDeleted ? ', marked for deletion' : ''}${rotation ? `, rotated ${rotation}°` : ''}`}
              {...dragProps}
              onKeyDown={handleKeyDown}
            >
              <label className="thumbnail-checkbox">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDeleted}
                  onChange={() => dispatch({ type: 'toggleSelect', fileId, pageNum })}
                  aria-label={`Select page ${pageNum}`}
                />
              </label>

              <GripVertical className="drag-handle" size={14} aria-hidden="true" />

              <button
                type="button"
                className="thumb-preview-btn"
                onClick={() => onPreview(pageNum)}
                disabled={isDeleted}
                tabIndex={-1}
                aria-label={`Preview page ${pageNum}`}
              >
                <Thumbnail
                  doc={file.doc}
                  fileId={fileId}
                  pageNum={pageNum}
                  rotation={rotation}
                  className="thumbnail-canvas"
                  alt=""
                />
              </button>

              <div className="thumbnail-footer">
                <span className={`page-number${isDeleted ? ' strikethrough' : ''}`}>
                  <span className="page-label">Page </span>
                  {pageNum}
                </span>
                <div className="thumbnail-actions">
                  {!isDeleted && (
                    <button
                      className="rotate-btn"
                      onClick={() => dispatch({ type: 'rotate', fileId, pageNum, angle: 90 })}
                      aria-label={`Rotate page ${pageNum} 90 degrees`}
                      title="Rotate 90°"
                    >
                      <RotateCw size={12} />
                    </button>
                  )}
                  {isDeleted ? (
                    <button
                      className="restore-btn"
                      onClick={() => dispatch({ type: 'toggleDelete', fileId, pageNum })}
                      aria-label={`Restore page ${pageNum}`}
                      title="Restore page"
                    >
                      <Check size={12} />
                    </button>
                  ) : (
                    <button
                      className="delete-btn"
                      onClick={() => dispatch({ type: 'toggleDelete', fileId, pageNum })}
                      aria-label={`Remove page ${pageNum}`}
                      title="Remove page"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {isDeleted && (
                <div className="deleted-badge" aria-hidden="true">
                  <Trash2 size={12} /> REMOVED
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
