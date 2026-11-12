import { useCallback, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { FileText, GitMerge, Minimize2, PenTool, Scissors, Upload } from 'lucide-react';
import type { PDFFile, PreviewTarget, Tool } from './types';
import { editorReducer, isDirty, pagesForExport, visiblePages, type EditorState } from './state/editor';
import { mergeReducer } from './state/merge';
import { useTheme } from './hooks/useTheme';
import { useAlert } from './hooks/useAlert';
import { useFileDrop } from './hooks/useFileDrop';
import { openPdf } from './lib/pdfjs';
import { buildPdf, compressPdf, type PageRef } from './lib/pdfOps';
import { releaseFileThumbs } from './lib/thumbnails';
import { createId, downloadBlob, formatFileSize, isPdfFile, stripPdfExt } from './lib/utils';
import ThemeToggle from './components/ThemeToggle';
import { Header } from './components/Header';
import { AlertToast } from './components/AlertToast';
import { Sidebar } from './components/Sidebar';
import { PageGrid } from './components/PageGrid';
import { MergeTool } from './components/MergeTool';
import { PopupPage } from './components/PopupPage';
import { Footer } from './components/Footer';
import './App.scss';

const pageRefs = (file: PDFFile, state: EditorState, pages: number[]): PageRef[] =>
  pages.map(pageNum => ({ fileId: file.id, file: file.file, pageNum, rotation: state.rotations.get(pageNum) ?? 0 }));

function App() {
  const { theme, toggleTheme } = useTheme();
  const { alert, showAlert, dismiss } = useAlert();

  const [files, setFiles] = useState<PDFFile[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('split');
  const [editor, dispatchEditor] = useReducer(editorReducer, {});
  const [mergeQueue, dispatchMerge] = useReducer(mergeReducer, []);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(0);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorCounter = useRef(0);

  const filesById = useMemo(() => new Map(files.map(f => [f.id, f])), [files]);
  const currentFile = (currentFileId && filesById.get(currentFileId)) || null;
  const editorState = currentFile ? editor[currentFile.id] : undefined;
  const busy = busyMessage !== null;

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------
  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      const all = Array.from(list);
      const pdfs = all.filter(isPdfFile);
      const ignored = all.length - pdfs.length;
      if (pdfs.length === 0) {
        showAlert('error', 'Please choose PDF files.');
        return;
      }

      setLoadingFiles(n => n + pdfs.length);
      const added: PDFFile[] = [];
      const locked: string[] = [];
      const unreadable: string[] = [];

      // One at a time keeps memory flat for large batches; each file is parsed exactly once.
      for (const file of pdfs) {
        try {
          const result = await openPdf(new Uint8Array(await file.arrayBuffer()));
          if (result.ok) {
            const pdf: PDFFile = {
              id: createId(),
              name: file.name,
              size: file.size,
              file,
              pageCount: result.doc.numPages,
              doc: result.doc,
              colorIndex: colorCounter.current++,
            };
            added.push(pdf);
            dispatchEditor({ type: 'init', fileId: pdf.id, pageCount: pdf.pageCount });
          } else {
            (result.reason === 'password' ? locked : unreadable).push(file.name);
          }
        } catch {
          unreadable.push(file.name);
        } finally {
          setLoadingFiles(n => n - 1);
        }
      }

      if (added.length > 0) {
        setFiles(prev => [...prev, ...added]);
        setCurrentFileId(id => id ?? added[0].id);
      }

      const parts: string[] = [];
      if (added.length === 1) parts.push(`Opened “${added[0].name}” (${added[0].pageCount} pages)`);
      else if (added.length > 1) parts.push(`Opened ${added.length} files`);
      if (locked.length) parts.push(`Skipped password-protected: ${locked.join(', ')}`);
      if (unreadable.length) parts.push(`Couldn't read: ${unreadable.join(', ')}`);
      if (ignored) parts.push(`${ignored} non-PDF ${ignored === 1 ? 'file' : 'files'} ignored`);
      const type = added.length === 0 ? 'error' : locked.length || unreadable.length || ignored ? 'info' : 'success';
      showAlert(type, `${parts.join('. ')}.`);
    },
    [showAlert],
  );

  const removeFile = (fileId: string) => {
    const file = filesById.get(fileId);
    if (!file) return;
    const remaining = files.filter(f => f.id !== fileId);
    setFiles(remaining);
    dispatchEditor({ type: 'remove', fileId });
    dispatchMerge({ type: 'clearFile', fileId });
    setPreview(p => (p?.fileId === fileId ? null : p));
    if (currentFileId === fileId) setCurrentFileId(remaining[0]?.id ?? null);
    if (remaining.length === 0) setActiveTool('split');
    releaseFileThumbs(fileId);
    void file.doc.destroy();
  };

  const selectFile = (fileId: string) => {
    setCurrentFileId(fileId);
    if (activeTool === 'merge') setActiveTool('split');
  };

  // ---------------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------------
  const runTask = async (message: string, errorMessage: string, task: () => Promise<void>) => {
    if (busy) return;
    setBusyMessage(message);
    try {
      await task();
    } catch (err) {
      console.error(err);
      showAlert('error', errorMessage);
    } finally {
      setBusyMessage(null);
    }
  };

  const savePdf = () => {
    if (!currentFile || !editorState) return;
    const pages = pagesForExport(editorState);
    const suffix = editorState.selected.size > 0 ? '_selected' : '_edited';
    void runTask('Saving PDF…', 'Could not save this PDF.', async () => {
      const bytes = await buildPdf(pageRefs(currentFile, editorState, pages));
      downloadBlob(bytes, `${stripPdfExt(currentFile.name)}${suffix}.pdf`);
      showAlert('success', `Saved ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}.`);
    });
  };

  const splitPdf = (requested: number[], rangeText: string) => {
    if (!currentFile || !editorState) return;
    const wanted = new Set(requested);
    const pages = visiblePages(editorState).filter(p => wanted.has(p));
    if (pages.length === 0) {
      showAlert('error', 'No pages in that range.');
      return;
    }
    const label = rangeText.replace(/\s+/g, '').replace(/[^0-9,-]/g, '').replace(/,/g, '_').slice(0, 40);
    void runTask('Extracting pages…', 'Could not extract these pages.', async () => {
      const bytes = await buildPdf(pageRefs(currentFile, editorState, pages));
      downloadBlob(bytes, `${stripPdfExt(currentFile.name)}_pages_${label || 'selection'}.pdf`);
      showAlert('success', `Extracted ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}.`);
    });
  };

  const compress = (strong: boolean) => {
    if (!currentFile || !editorState) return;
    const unchanged = !isDirty(editorState) && editorState.selected.size === 0;
    const pages = pagesForExport(editorState);
    void runTask(strong ? 'Compressing images…' : 'Compressing…', 'Compression failed for this PDF.', async () => {
      const input = unchanged
        ? new Uint8Array(await currentFile.file.arrayBuffer())
        : await buildPdf(pageRefs(currentFile, editorState, pages));
      const { bytes, imagesRecompressed } = await compressPdf(input, strong);
      downloadBlob(bytes, `${stripPdfExt(currentFile.name)}_compressed.pdf`);

      const before = currentFile.size;
      const change = Math.round((1 - bytes.length / before) * 100);
      const images = imagesRecompressed > 0 ? ` ${imagesRecompressed} images optimised.` : '';
      if (change > 0) {
        showAlert('success', `${formatFileSize(before)} → ${formatFileSize(bytes.length)} (−${change}%).${images}`);
      } else {
        showAlert(
          'info',
          `This PDF is already well optimised (${formatFileSize(bytes.length)}).${strong ? '' : ' Try “Strong” for scanned documents.'}`,
        );
      }
    });
  };

  const mergePdfs = () => {
    const refs: PageRef[] = mergeQueue.flatMap(item => {
      const f = filesById.get(item.fileId);
      return f ? [{ fileId: f.id, file: f.file, pageNum: item.pageNum, rotation: item.rotation }] : [];
    });
    if (refs.length === 0) {
      showAlert('error', 'Add some pages to the merge queue first.');
      return;
    }
    void runTask('Merging…', 'Could not merge these PDFs.', async () => {
      downloadBlob(await buildPdf(refs), 'merged.pdf');
      showAlert('success', `Merged ${refs.length} pages into one PDF.`);
    });
  };

  const discardChanges = () => {
    if (!currentFile) return;
    dispatchEditor({ type: 'reset', fileId: currentFile.id });
    showAlert('info', 'Changes discarded.');
  };

  // ---------------------------------------------------------------------------
  // Preview dialog
  // ---------------------------------------------------------------------------
  const previewFile = preview ? filesById.get(preview.fileId) : undefined;
  let previewView: ReactNode = null;
  if (preview && previewFile) {
    const state = editor[previewFile.id];
    const sequence =
      preview.source === 'editor' && state
        ? visiblePages(state)
        : Array.from({ length: previewFile.pageCount }, (_, i) => i + 1);
    const index = Math.max(0, sequence.indexOf(preview.pageNum));
    const rotation =
      preview.source === 'editor'
        ? (state?.rotations.get(preview.pageNum) ?? 0)
        : (mergeQueue.find(i => i.fileId === preview.fileId && i.pageNum === preview.pageNum)?.rotation ?? 0);
    const goTo = (i: number) => setPreview({ ...preview, pageNum: sequence[i] });

    previewView = (
      <PopupPage
        key={previewFile.id}
        doc={previewFile.doc}
        fileName={previewFile.name}
        pageNum={preview.pageNum}
        rotation={rotation}
        position={index + 1}
        total={sequence.length}
        onPrev={() => index > 0 && goTo(index - 1)}
        onNext={() => index < sequence.length - 1 && goTo(index + 1)}
        onClose={() => setPreview(null)}
      />
    );
  }

  const viewerDrop = useFileDrop(handleFiles);

  return (
    <div className="app-container">
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      <Header />
      <AlertToast alert={alert} onDismiss={dismiss} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        hidden
        onChange={e => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <main className="main-layout">
        <Sidebar
          files={files}
          currentFile={currentFile}
          editorState={editorState}
          activeTool={activeTool}
          busy={busy}
          loadingFiles={loadingFiles}
          mergeCount={mergeQueue.length}
          onToolChange={setActiveTool}
          onSelectFile={selectFile}
          onRemoveFile={removeFile}
          onOpenPicker={openPicker}
          onFiles={handleFiles}
          onSplit={splitPdf}
          onCompress={compress}
          onMerge={mergePdfs}
        />

        <section
          id="workspace"
          tabIndex={-1}
          className={`viewer-area${viewerDrop.isDragging ? ' drag-active' : ''}`}
          aria-label="Workspace"
          {...viewerDrop.dropProps}
        >
          {activeTool === 'merge' && files.length > 0 ? (
            <MergeTool
              files={files}
              queue={mergeQueue}
              dispatch={dispatchMerge}
              busy={busy}
              onMerge={mergePdfs}
              onAddFiles={openPicker}
              onRemoveFile={removeFile}
              onPreview={(fileId, pageNum) => setPreview({ fileId, pageNum, source: 'merge' })}
            />
          ) : (
            <div className="viewer-panel">
              {currentFile && editorState ? (
                <PageGrid
                  file={currentFile}
                  state={editorState}
                  dispatch={dispatchEditor}
                  busy={busy}
                  onPreview={pageNum => setPreview({ fileId: currentFile.id, pageNum, source: 'editor' })}
                  onSave={savePdf}
                  onDiscard={discardChanges}
                />
              ) : (
                <EmptyState onOpenPicker={openPicker} loading={loadingFiles > 0} />
              )}
            </div>
          )}
        </section>
      </main>

      {previewView}

      {busyMessage && (
        <div className="processing-overlay" role="alert" aria-busy="true">
          <div className="spinner" />
          <p>{busyMessage}</p>
        </div>
      )}

      <Footer />
    </div>
  );
}

function EmptyState({ onOpenPicker, loading }: { onOpenPicker: () => void; loading: boolean }) {
  const features = [
    { icon: Scissors, title: 'Split', text: 'Extract any pages or ranges' },
    { icon: GitMerge, title: 'Merge', text: 'Combine pages from many PDFs' },
    { icon: Minimize2, title: 'Compress', text: 'Shrink files, even scans' },
    { icon: PenTool, title: 'Edit pages', text: 'Reorder, rotate, remove' },
  ];
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FileText aria-hidden="true" />
      </div>
      <h2>Drop PDFs anywhere here</h2>
      <p>Everything runs in your browser. Your files are never uploaded.</p>
      <button className="primary-btn" onClick={onOpenPicker} disabled={loading}>
        <Upload size={18} /> {loading ? 'Opening…' : 'Choose PDF files'}
      </button>
      <ul className="feature-tiles">
        {features.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon size={18} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
