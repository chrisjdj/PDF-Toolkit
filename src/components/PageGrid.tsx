import { useRef, type Dispatch, type KeyboardEvent } from 'react';
import { CheckSquare, Download, GripVertical, Loader, RotateCw, Trash2, Undo2 } from 'lucide-react';
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
    <div className="card page-editor">
      <div className="editor-toolbar">
        <div className="editor-toolbar__group">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => dispatch({ type: 'selectAll', fileId })}>
            <CheckSquare size={16} aria-hidden="true" /> Select all
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => dispatch({ type: 'clearSelection', fileId })}
            disabled={selectedCount === 0}
          >
            Clear selection
          </button>
        </div>

        <div className="editor-toolbar__status" aria-live="polite">
          <span>{selectedCount > 0 ? `${selectedCount} of ${visibleCount} selected` : `${visibleCount} pages`}</span>
          {dirty && <span className="badge badge--warning">Unsaved changes</span>}
        </div>

        <div className="editor-toolbar__group editor-toolbar__group--end">
          {dirty && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={onDiscard}>
              <Undo2 size={16} aria-hidden="true" /> Discard
            </button>
          )}
          <button type="button" className="btn btn--primary btn--sm" onClick={onSave} disabled={busy || visibleCount === 0}>
            {busy ? <Loader size={16} className="spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            {selectedCount > 0 ? `Save ${selectedCount} selected` : 'Save as PDF'}
          </button>
        </div>
      </div>

      <p className="grid-hint" id="page-grid-help">
        Drag to reorder (long-press on touch). Keyboard: <kbd>Alt</kbd>+arrows move, <kbd>Enter</kbd> previews,{' '}
        <kbd>Space</kbd> selects, <kbd>R</kbd> rotates, <kbd>Delete</kbd> removes.
      </p>

      <div className="page-grid" ref={gridRef} role="list" aria-describedby="page-grid-help">
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
            'page-card',
            isSelected && 'is-selected',
            isDeleted && 'is-deleted',
            draggedIndex === index && 'is-dragging',
            overIndex === index && draggedIndex !== index && 'is-drop-target',
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
              <div className="page-card__media">
                <button
                  type="button"
                  className="thumb-button"
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
                    className="page-card__thumb"
                    alt=""
                  />
                </button>

                <label className="thumb-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDeleted}
                    onChange={() => dispatch({ type: 'toggleSelect', fileId, pageNum })}
                    aria-label={`Select page ${pageNum}`}
                  />
                </label>

                <GripVertical className="drag-handle" size={16} aria-hidden="true" />

                {isDeleted && (
                  <span className="badge badge--danger removed-badge" aria-hidden="true">
                    <Trash2 size={12} /> Removed
                  </span>
                )}
              </div>

              <div className="page-card__footer">
                <span className={`page-number${isDeleted ? ' strikethrough' : ''}`}>
                  <span className="page-number__label">Page </span>
                  {pageNum}
                </span>
                <div className="page-card__actions">
                  {!isDeleted && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon thumb-action"
                      onClick={() => dispatch({ type: 'rotate', fileId, pageNum, angle: 90 })}
                      aria-label={`Rotate page ${pageNum} 90 degrees`}
                      title="Rotate 90°"
                    >
                      <RotateCw size={16} aria-hidden="true" />
                    </button>
                  )}
                  {isDeleted ? (
                    <button
                      type="button"
                      className="btn btn--secondary btn--icon thumb-action"
                      onClick={() => dispatch({ type: 'toggleDelete', fileId, pageNum })}
                      aria-label={`Restore page ${pageNum}`}
                      title="Restore page"
                    >
                      <Undo2 size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--icon thumb-action"
                      onClick={() => dispatch({ type: 'toggleDelete', fileId, pageNum })}
                      aria-label={`Remove page ${pageNum}`}
                      title="Remove page"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
