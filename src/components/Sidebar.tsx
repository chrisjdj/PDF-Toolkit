import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Download, FileText, GitMerge, Layers, Loader, Minimize2, PenTool, Plus, Scissors, Trash2, Upload } from 'lucide-react';
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

export function Sidebar(props: SidebarProps) {
  const { files, currentFile, editorState, activeTool, busy, loadingFiles, mergeCount } = props;
  const upload = useFileDrop(props.onFiles);
  const list = useFileDrop(props.onFiles);

  const onUploadKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      props.onOpenPicker();
    }
  };

  return (
    <aside className="sidebar" aria-label="Files and tools">
      {files.length === 0 && (
        <div
          className={`panel upload-zone${upload.isDragging ? ' drag-active' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF files"
          onClick={props.onOpenPicker}
          onKeyDown={onUploadKey}
          {...upload.dropProps}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--mouse-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
            e.currentTarget.style.setProperty('--mouse-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
          }}
        >
          {loadingFiles > 0 ? <Loader className="icon spin" size={48} /> : <Upload className="icon" size={48} />}
          <h2>{loadingFiles > 0 ? 'Opening…' : 'Drop PDFs here'}</h2>
          <p>or click to browse your files</p>
          <p className="hint">Your files never leave your device</p>
        </div>
      )}

      {files.length > 0 && (
        <section className={`panel${list.isDragging ? ' drag-active' : ''}`} aria-labelledby="files-title" {...list.dropProps}>
          <h3 id="files-title">
            <Layers size={16} className="panel-icon" />
            Files ({files.length})
          </h3>
          <ul className="file-list">
            {files.map(file => {
              const active = currentFile?.id === file.id;
              return (
                <li key={file.id} className={`file-item${active ? ' active' : ''}`}>
                  <button
                    className="file-select"
                    onClick={() => props.onSelectFile(file.id)}
                    aria-current={active ? 'true' : undefined}
                  >
                    <span className="file-icon" style={{ color: fileColor(file.colorIndex) }}>
                      <FileText size={18} />
                    </span>
                    <span className="file-info">
                      <span className="file-name" title={file.name}>{file.name}</span>
                      <span className="file-meta">
                        {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'} · {formatFileSize(file.size)}
                      </span>
                    </span>
                  </button>
                  <button className="icon-btn danger" onClick={() => props.onRemoveFile(file.id)} aria-label={`Remove ${file.name}`} title="Remove file">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="add-files-btn" onClick={props.onOpenPicker} disabled={loadingFiles > 0}>
            {loadingFiles > 0 ? <Loader size={16} className="spin" /> : <Plus size={16} />}
            {loadingFiles > 0 ? 'Opening…' : 'Add more files'}
          </button>
        </section>
      )}

      <section className="panel" aria-labelledby="tools-title">
        <h3 id="tools-title">
          <PenTool size={16} className="panel-icon" />
          Tools
        </h3>
        <div className="tool-grid" role="group" aria-label="Choose a tool">
          <ToolButton tool="split" label="Split" icon={<Scissors size={20} />} activeTool={activeTool} onToolChange={props.onToolChange} disabled={!currentFile} />
          <ToolButton tool="compress" label="Compress" icon={<Minimize2 size={20} />} activeTool={activeTool} onToolChange={props.onToolChange} disabled={!currentFile} />
          <ToolButton tool="merge" label="Merge" icon={<GitMerge size={20} />} activeTool={activeTool} onToolChange={props.onToolChange} disabled={files.length === 0} />
        </div>
      </section>

      {activeTool === 'split' && currentFile && editorState && (
        <SplitPanel key={currentFile.id} file={currentFile} state={editorState} busy={busy} onSplit={props.onSplit} />
      )}
      {activeTool === 'compress' && currentFile && editorState && (
        <CompressPanel state={editorState} busy={busy} onCompress={props.onCompress} />
      )}
      {activeTool === 'merge' && files.length > 0 && (
        <section className="panel" aria-labelledby="merge-title">
          <h3 id="merge-title">
            <GitMerge size={16} className="panel-icon" />
            Merge PDFs
          </h3>
          <p className="panel-text">
            Pick pages from your PDFs on the right, drag the queue into order, then merge them into one document.
          </p>
          <button className="primary-btn" onClick={props.onMerge} disabled={busy || mergeCount === 0}>
            {busy ? <Loader size={16} className="spin" /> : <Download size={16} />}
            {mergeCount > 0 ? `Merge ${mergeCount} pages` : 'Merge & download'}
          </button>
        </section>
      )}
    </aside>
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
      className={`tool-btn${activeTool === tool ? ' active' : ''}`}
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
    <section className="panel" aria-labelledby="split-title">
      <h3 id="split-title">
        <Scissors size={16} className="panel-icon" />
        Extract pages
      </h3>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (parsed && !error) onSplit(parsed, text);
        }}
      >
        <div className="setting-row">
          <label htmlFor="split-range">Pages (of {file.pageCount})</label>
          <input
            id="split-range"
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
          <p id="split-help" className={error ? 'field-error' : 'field-hint'}>
            {error ?? `${count} ${count === 1 ? 'page' : 'pages'}, in the order shown on the right, with your rotations`}
          </p>
        </div>
        <button type="submit" className="primary-btn" disabled={busy || !!error}>
          {busy ? <Loader size={16} className="spin" /> : <Download size={16} />}
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
    <section className="panel" aria-labelledby="compress-title">
      <h3 id="compress-title">
        <Minimize2 size={16} className="panel-icon" />
        Compress PDF
      </h3>
      <fieldset className="option-group">
        <legend className="sr-only">Compression level</legend>
        <label className={`option-card${!strong ? ' active' : ''}`}>
          <input type="radio" name="compress-level" checked={!strong} onChange={() => setStrong(false)} />
          <span>
            <strong>Lossless</strong>
            <span className="option-desc">Repacks and recompresses the file structure. No quality change.</span>
          </span>
        </label>
        <label className={`option-card${strong ? ' active' : ''}`}>
          <input type="radio" name="compress-level" checked={strong} onChange={() => setStrong(true)} />
          <span>
            <strong>Strong</strong>
            <span className="option-desc">Also shrinks large photos/scans (max 1600 px, JPEG). Best for scanned documents.</span>
          </span>
        </label>
      </fieldset>
      <p className="panel-text">Applies to {scope}, including your edits.</p>
      <button className="primary-btn" onClick={() => onCompress(strong)} disabled={busy}>
        {busy ? <Loader size={16} className="spin" /> : <Minimize2 size={16} />}
        Compress & download
      </button>
    </section>
  );
}
