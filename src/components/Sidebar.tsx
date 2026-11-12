import { useState, type ReactNode } from 'react';
import { Download, FileText, GitMerge, Layers, Loader, Minimize2, PenTool, Plus, Scissors, Trash2 } from 'lucide-react';
import type { PDFFile, Tool } from '../types';
import { pagesForExport, visiblePages, type EditorState } from '../state/editor';
import { useFileDrop } from '../hooks/useFileDrop';
import { fileColor, formatFileSize, parsePageRanges } from '../lib/utils';

interface SidebarProps {
  files: PDFFile[];
  currentFile: PDFFile | null;
  editorState: EditorState | undefined;
  activeTool: Tool;
  busy: boolean;
  loadingFiles: number;
  mergeCount: number;
  onToolChange: (tool: Tool) => void;
  onSelectFile: (fileId: string) => void;
  onRemoveFile: (fileId: string) => void;
  onOpenPicker: () => void;
  onFiles: (files: FileList) => void;
  onSplit: (pages: number[], rangeText: string) => void;
  onCompress: (strong: boolean) => void;
  onMerge: () => void;
}

/**
 * Controls column. Rendered inside <aside class="tool-layout__sidebar">. The only upload
 * CTA before any file is open lives in the workspace (empty state), so this column shows
 * just the tool picker until files exist.
 */
export function Sidebar(props: SidebarProps) {
  const { files, currentFile, editorState, activeTool, busy, loadingFiles, mergeCount } = props;
  const list = useFileDrop(props.onFiles);

  return (
    <>
      {files.length > 0 && (
        <section
          className={`card files-card${list.isDragging ? ' is-dragging' : ''}`}
          aria-labelledby="files-title"
          {...list.dropProps}
        >
          <div className="card__header">
            <h2 id="files-title" className="card__title">
              <Layers size={16} aria-hidden="true" />
              Files ({files.length})
            </h2>
          </div>
          <div className="card__body">
            <ul className="file-list">
              {files.map(file => {
                const active = currentFile?.id === file.id;
                return (
                  <li key={file.id} className={`file-item${active ? ' is-active' : ''}`}>
                    <button
                      type="button"
                      className="file-item__select"
                      onClick={() => props.onSelectFile(file.id)}
                      aria-current={active ? 'true' : undefined}
                    >
                      <span className="file-item__icon" style={{ color: fileColor(file.colorIndex) }} aria-hidden="true">
                        <FileText size={18} />
                      </span>
                      <span className="file-item__info">
                        <span className="file-item__name" title={file.name}>{file.name}</span>
                        <span className="file-item__meta">
                          {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'} · {formatFileSize(file.size)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--icon btn--sm"
                      onClick={() => props.onRemoveFile(file.id)}
                      aria-label={`Remove ${file.name}`}
                      title="Remove file"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn--dashed btn--block" onClick={props.onOpenPicker} disabled={loadingFiles > 0}>
              {loadingFiles > 0 ? <Loader size={16} className="spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {loadingFiles > 0 ? 'Opening…' : 'Add more files'}
            </button>
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="tools-title">
        <div className="card__header">
          <h2 id="tools-title" className="card__title">
            <PenTool size={16} aria-hidden="true" />
            Tools
          </h2>
        </div>
        <div className="card__body">
          <div className="segmented segmented--block tool-switch" role="group" aria-label="Choose a tool">
            <ToolButton tool="split" label="Split" icon={<Scissors size={16} aria-hidden="true" />} activeTool={activeTool} onToolChange={props.onToolChange} disabled={!currentFile} />
            <ToolButton tool="compress" label="Compress" icon={<Minimize2 size={16} aria-hidden="true" />} activeTool={activeTool} onToolChange={props.onToolChange} disabled={!currentFile} />
            <ToolButton tool="merge" label="Merge" icon={<GitMerge size={16} aria-hidden="true" />} activeTool={activeTool} onToolChange={props.onToolChange} disabled={files.length === 0} />
          </div>
          {files.length === 0 && <p className="field__hint">Open a PDF to start using the tools.</p>}
        </div>
      </section>

      {activeTool === 'split' && currentFile && editorState && (
        <SplitPanel key={currentFile.id} file={currentFile} state={editorState} busy={busy} onSplit={props.onSplit} />
      )}
      {activeTool === 'compress' && currentFile && editorState && (
        <CompressPanel state={editorState} busy={busy} onCompress={props.onCompress} />
      )}
      {activeTool === 'merge' && files.length > 0 && (
        <section className="card" aria-labelledby="merge-title">
          <div className="card__header">
            <h2 id="merge-title" className="card__title">
              <GitMerge size={16} aria-hidden="true" />
              Merge PDFs
            </h2>
          </div>
          <div className="card__body">
            <p className="panel-text">
              Pick pages from your PDFs, drag the queue into order, then merge them into one document.
            </p>
            <button type="button" className="btn btn--primary btn--block" onClick={props.onMerge} disabled={busy || mergeCount === 0}>
              {busy ? <Loader size={16} className="spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              {mergeCount > 0 ? `Merge ${mergeCount} pages` : 'Merge & download'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function ToolButton({
  tool,
  label,
  icon,
  activeTool,
  onToolChange,
  disabled,
}: { tool: Tool; label: string; icon: ReactNode; disabled: boolean } & Pick<SidebarProps, 'activeTool' | 'onToolChange'>) {
  return (
    <button
      type="button"
      className="segmented__item"
      onClick={() => onToolChange(tool)}
      disabled={disabled}
      aria-pressed={activeTool === tool}
    >
      {icon}
      {label}
    </button>
  );
}

function SplitPanel({ file, state, busy, onSplit }: { file: PDFFile; state: EditorState; busy: boolean; onSplit: SidebarProps['onSplit'] }) {
  const [text, setText] = useState(`1-${file.pageCount}`);
  const parsed = parsePageRanges(text, file.pageCount);
  const count = parsed ? parsed.filter(p => !state.deleted.has(p)).length : 0;
  const error =
    parsed === null
      ? 'Use page numbers and ranges, e.g. 1-3, 7, 10-'
      : count === 0
        ? 'No pages left in that range (removed pages are skipped)'
        : null;

  return (
    <section className="card" aria-labelledby="split-title">
      <div className="card__header">
        <h2 id="split-title" className="card__title">
          <Scissors size={16} aria-hidden="true" />
          Extract pages
        </h2>
      </div>
      <form
        className="card__body"
        onSubmit={e => {
          e.preventDefault();
          if (parsed && !error) onSplit(parsed, text);
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="split-range">
            Pages <span className="field__value">of {file.pageCount}</span>
          </label>
          <input
            id="split-range"
            className="input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={text}
            onChange={e => setText(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby="split-help"
            placeholder="e.g. 1-3, 7, 10-"
          />
          <p id="split-help" className={error ? 'field__error' : 'field__hint'}>
            {error ?? `${count} ${count === 1 ? 'page' : 'pages'}, in the order shown, with your rotations`}
          </p>
        </div>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !!error}>
          {busy ? <Loader size={16} className="spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
          Extract pages
        </button>
      </form>
    </section>
  );
}

function CompressPanel({ state, busy, onCompress }: { state: EditorState; busy: boolean; onCompress: SidebarProps['onCompress'] }) {
  const [strong, setStrong] = useState(false);
  const pageCount = pagesForExport(state).length;
  const scope = state.selected.size > 0 ? `${pageCount} selected pages` : `all ${visiblePages(state).length} pages`;

  return (
    <section className="card" aria-labelledby="compress-title">
      <div className="card__header">
        <h2 id="compress-title" className="card__title">
          <Minimize2 size={16} aria-hidden="true" />
          Compress PDF
        </h2>
      </div>
      <div className="card__body">
        <fieldset className="field option-group">
          <legend className="sr-only">Compression level</legend>
          <label className="radio-card">
            <input type="radio" name="compress-level" checked={!strong} onChange={() => setStrong(false)} />
            <span>
              <span className="radio-card__title">Lossless</span>
              <span className="radio-card__desc">Repacks and recompresses the file structure. No quality change.</span>
            </span>
          </label>
          <label className="radio-card">
            <input type="radio" name="compress-level" checked={strong} onChange={() => setStrong(true)} />
            <span>
              <span className="radio-card__title">Strong</span>
              <span className="radio-card__desc">Also shrinks large photos/scans (max 1600 px, JPEG). Best for scanned documents.</span>
            </span>
          </label>
        </fieldset>
        <p className="panel-text">Applies to {scope}, including your edits.</p>
        <button type="button" className="btn btn--primary btn--block" onClick={() => onCompress(strong)} disabled={busy}>
          {busy ? <Loader size={16} className="spin" aria-hidden="true" /> : <Minimize2 size={16} aria-hidden="true" />}
          Compress & download
        </button>
      </div>
    </section>
  );
}
