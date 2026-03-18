import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Download, Merge, Scissors, 
  RotateCw, Trash2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  FileOutput, Shield, PenTool, Layers, FileSearch, Loader, Minimize2
} from 'lucide-react';
import * as pdfLib from 'pdf-lib';
import ThemeToggle from './components/ThemeToggle';
import './App.scss';

interface PDFFile {
  id: string;
  name: string;
  file: File;
  pageCount: number;
  pages: number[];
}

type Tool = 'view' | 'merge' | 'split' | 'rotate' | 'compress' | 'extract';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pdf-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const [files, setFiles] = useState<PDFFile[]>([]);
  const [currentFile, setCurrentFile] = useState<PDFFile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState<Tool>('view');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<pdfLib.PDFDocument | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [compressionQuality, setCompressionQuality] = useState(80);
  const [splitRange, setSplitRange] = useState({ from: 1, to: 1 });
  const [rotateAngle, setRotateAngle] = useState(90);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pdf-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const loadPDF = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDocument = await pdfLib.PDFDocument.load(arrayBuffer);
      const pageCount = pdfDocument.getPageCount();
      
      const newFile: PDFFile = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        file,
        pageCount,
        pages: Array.from({ length: pageCount }, (_, i) => i + 1)
      };
      
      setFiles(prev => [...prev, newFile]);
      setCurrentFile(newFile);
      setPdfDoc(pdfDocument);
      setTotalPages(pageCount);
      setCurrentPage(1);
      setActiveTool('view');
      showAlert('success', `Loaded "${file.name}" with ${pageCount} pages`);
    } catch {
      showAlert('error', 'Failed to load PDF. Please ensure the file is a valid PDF.');
    }
  };

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const pdfFiles = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      showAlert('error', 'Please select valid PDF files');
      return;
    }
    pdfFiles.forEach(loadPDF);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      if (currentFile?.id === id) {
        const remaining = newFiles[0] || null;
        setCurrentFile(remaining);
        if (remaining) {
          loadPDF(remaining.file);
        } else {
          setPdfDoc(null);
          setTotalPages(0);
        }
      }
      return newFiles;
    });
  };

  const switchFile = async (file: PDFFile) => {
    setCurrentFile(file);
    await loadPDF(file.file);
  };

  useEffect(() => {
    if (!currentFile || !pdfDoc) return;
    
    const loadPage = async () => {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
      
      const arrayBuffer = await currentFile.file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(currentPage);
      
      const scale = zoom / 100;
      const viewport = page.getViewport({ scale: scale * 1.5 });
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
    };
    
    loadPage();
  }, [currentFile, currentPage, zoom, pdfDoc]);

  const saveBlob = (pdfBytes: Uint8Array, filename: string) => {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mergePDFs = async () => {
    if (files.length < 2) {
      showAlert('error', 'Please add at least 2 PDFs to merge');
      return;
    }
    
    setIsProcessing(true);
    try {
      const mergedPdf = await pdfLib.PDFDocument.create();
      
      for (const file of files) {
        const arrayBuffer = await file.file.arrayBuffer();
        const pdf = await pdfLib.PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      
      const pdfBytes = await mergedPdf.save();
      saveBlob(pdfBytes, 'merged.pdf');
      showAlert('success', `Successfully merged ${files.length} PDFs`);
    } catch {
      showAlert('error', 'Failed to merge PDFs');
    }
    setIsProcessing(false);
  };

  const splitPDF = async () => {
    if (!currentFile) return;
    
    setIsProcessing(true);
    try {
      const arrayBuffer = await currentFile.file.arrayBuffer();
      const pdf = await pdfLib.PDFDocument.load(arrayBuffer);
      
      const { from, to } = splitRange;
      const newPdf = await pdfLib.PDFDocument.create();
      const pages = await newPdf.copyPages(pdf, Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
      pages.forEach(page => newPdf.addPage(page));
      
      const pdfBytes = await newPdf.save();
      saveBlob(pdfBytes, `${currentFile.name.replace('.pdf', '')}_pages_${from}-${to}.pdf`);
      showAlert('success', `Extracted pages ${from}-${to}`);
    } catch {
      showAlert('error', 'Failed to split PDF');
    }
    setIsProcessing(false);
  };

  const rotatePDF = async () => {
    if (!pdfDoc) return;
    
    setIsProcessing(true);
    try {
      const pages = pdfDoc.getPages();
      const targetPage = pages[currentPage - 1];
      const currentRotation = targetPage.getRotation().angle;
      targetPage.setRotation(pdfLib.degrees(currentRotation + rotateAngle));
      
      const pdfBytes = await pdfDoc.save();
      
      if (currentFile) {
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
        const newFileObj = new File([blob], currentFile.name, { type: 'application/pdf' });
        await loadPDF(newFileObj);
        showAlert('success', `Rotated page ${currentPage} by ${rotateAngle}°`);
      }
    } catch {
      showAlert('error', 'Failed to rotate PDF');
    }
    setIsProcessing(false);
  };

  const compressPDF = async () => {
    if (!currentFile) return;
    
    setIsProcessing(true);
    try {
      const arrayBuffer = await currentFile.file.arrayBuffer();
      const pdf = await pdfLib.PDFDocument.load(arrayBuffer);
      
      const pdfBytes = await pdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      
      const originalSize = currentFile.file.size;
      const newSize = blob.size;
      const reduction = Math.round((1 - newSize / originalSize) * 100);
      
      saveBlob(pdfBytes, `${currentFile.name.replace('.pdf', '')}_compressed.pdf`);
      showAlert('success', `Compressed: ${formatFileSize(originalSize)} → ${formatFileSize(newSize)} (${reduction > 0 ? '-' : '+'}${Math.abs(reduction)}%)`);
    } catch {
      showAlert('error', 'Failed to compress PDF');
    }
    setIsProcessing(false);
  };

  const downloadCurrentPDF = async () => {
    if (!pdfDoc || !currentFile) return;
    
    setIsProcessing(true);
    try {
      const pdfBytes = await pdfDoc.save();
      saveBlob(pdfBytes, currentFile.name);
      showAlert('success', 'PDF downloaded');
    } catch {
      showAlert('error', 'Failed to download PDF');
    }
    setIsProcessing(false);
  };

  return (
    <div className="app-container">
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <FileText size={24} />
          </div>
          <div className="title-area">
            <h1>PDF Toolkit</h1>
            <p>Browser-based PDF manipulation</p>
          </div>
        </div>
        <div className="privacy-badge">
          <Shield />
          No server · 100% private
        </div>
      </header>

      {alert && (
        <div className={`alert ${alert.type}`} style={{ position: 'fixed', top: 80, right: 20, zIndex: 1000, maxWidth: 400 }}>
          {alert.message}
        </div>
      )}

      <main className="main-layout">
        <aside className="sidebar">
          <div 
            className={`panel upload-zone ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} className="icon" />
            <h2>Drop PDFs here</h2>
            <p>or click to browse files</p>
            <input 
              type="file" 
              multiple 
              accept=".pdf,application/pdf" 
              className="hidden-input"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
          </div>

          {files.length > 0 && (
            <div className="panel">
              <h3>
                <Layers size={16} className="panel-icon" />
                Files ({files.length})
              </h3>
              <div className="file-list">
                {files.map(file => (
                  <div 
                    key={file.id} 
                    className={`file-item ${currentFile?.id === file.id ? 'active' : ''}`}
                    onClick={() => switchFile(file)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="file-icon">
                      <FileText size={18} />
                    </div>
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">{file.pageCount} pages</div>
                    </div>
                    <div className="file-actions">
                      <button 
                        className="icon-btn danger" 
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                        aria-label="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
            <h3>
              <PenTool size={16} className="panel-icon" />
              Tools
            </h3>
            <div className="tool-grid">
              <button 
                className={`tool-btn ${activeTool === 'view' ? 'active' : ''}`}
                onClick={() => setActiveTool('view')}
              >
                <FileSearch size={20} />
                View
              </button>
              <button 
                className={`tool-btn ${activeTool === 'merge' ? 'active' : ''}`}
                onClick={() => setActiveTool('merge')}
                disabled={files.length < 2}
              >
                <Merge size={20} />
                Merge
              </button>
              <button 
                className={`tool-btn ${activeTool === 'split' ? 'active' : ''}`}
                onClick={() => setActiveTool('split')}
                disabled={!currentFile}
              >
                <Scissors size={20} />
                Split
              </button>
              <button 
                className={`tool-btn ${activeTool === 'rotate' ? 'active' : ''}`}
                onClick={() => setActiveTool('rotate')}
                disabled={!currentFile}
              >
                <RotateCw size={20} />
                Rotate
              </button>
              <button 
                className={`tool-btn ${activeTool === 'compress' ? 'active' : ''}`}
                onClick={() => setActiveTool('compress')}
                disabled={!currentFile}
              >
                <Minimize2 size={20} />
                Compress
              </button>
              <button 
                className={`tool-btn ${activeTool === 'extract' ? 'active' : ''}`}
                onClick={() => setActiveTool('extract')}
                disabled={!currentFile}
              >
                <FileOutput size={20} />
                Extract
              </button>
            </div>
          </div>

          {activeTool === 'split' && currentFile && (
            <div className="panel">
              <h3>
                <Scissors size={16} className="panel-icon" />
                Split Options
              </h3>
              <div className="setting-row">
                <label>Page Range</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    min={1} 
                    max={totalPages} 
                    value={splitRange.from}
                    onChange={e => setSplitRange(prev => ({ ...prev, from: parseInt(e.target.value) || 1 }))}
                  />
                  <span>to</span>
                  <input 
                    type="number" 
                    min={1} 
                    max={totalPages} 
                    value={splitRange.to}
                    onChange={e => setSplitRange(prev => ({ ...prev, to: parseInt(e.target.value) || totalPages }))}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>of {totalPages}</span>
                </div>
              </div>
              <button className="primary-btn" onClick={splitPDF} disabled={isProcessing}>
                {isProcessing ? <Loader size={16} /> : <Download size={16} />}
                Extract Pages
              </button>
            </div>
          )}

          {activeTool === 'rotate' && currentFile && (
            <div className="panel">
              <h3>
                <RotateCw size={16} className="panel-icon" />
                Rotate Page {currentPage}
              </h3>
              <div className="setting-row">
                <label>Rotation Angle</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[90, 180, 270].map(angle => (
                    <button
                      key={angle}
                      className={`secondary-btn ${rotateAngle === angle ? 'active' : ''}`}
                      onClick={() => setRotateAngle(angle)}
                      style={{ flex: 1, minWidth: 60 }}
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
              </div>
              <button className="primary-btn" onClick={rotatePDF} disabled={isProcessing}>
                {isProcessing ? <Loader size={16} /> : <RotateCw size={16} />}
                Apply Rotation
              </button>
            </div>
          )}

          {activeTool === 'merge' && files.length >= 2 && (
            <div className="panel">
              <h3>
                <Merge size={16} className="panel-icon" />
                Merge PDFs
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {files.length} files selected for merging
              </p>
              <button className="primary-btn" onClick={mergePDFs} disabled={isProcessing}>
                {isProcessing ? <Loader size={16} /> : <Download size={16} />}
                Download Merged PDF
              </button>
            </div>
          )}

          {activeTool === 'compress' && currentFile && (
            <div className="panel">
              <h3>
                <Minimize2 size={16} className="panel-icon" />
                Compress PDF
              </h3>
              <div className="setting-row">
                <label>Quality: {compressionQuality}%</label>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={compressionQuality}
                  onChange={e => setCompressionQuality(parseInt(e.target.value))}
                />
              </div>
              <button className="primary-btn" onClick={compressPDF} disabled={isProcessing}>
                {isProcessing ? <Loader size={16} /> : <Minimize2 size={16} />}
                Compress & Download
              </button>
            </div>
          )}

          {activeTool === 'extract' && currentFile && (
            <div className="panel">
              <h3>
                <FileOutput size={16} className="panel-icon" />
                Extract All Pages
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Extract all {totalPages} pages as a new PDF
              </p>
              <button className="primary-btn" onClick={downloadCurrentPDF} disabled={isProcessing}>
                {isProcessing ? <Loader size={16} /> : <Download size={16} />}
                Download Copy
              </button>
            </div>
          )}

          {currentFile && (
            <div className="action-buttons">
              <button className="secondary-btn" onClick={downloadCurrentPDF} disabled={isProcessing}>
                <Download size={16} />
                Save PDF
              </button>
            </div>
          )}
        </aside>

        <section className="viewer-area">
          <div className="viewer-panel">
            <div className="viewer-toolbar">
              <div className="page-info">
                <button 
                  className="icon-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  Page 
                  <input 
                    type="number" 
                    min={1} 
                    max={totalPages || 1} 
                    value={currentPage}
                    onChange={e => setCurrentPage(Math.min(totalPages, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                  of {totalPages || 0}
                </span>
                <button 
                  className="icon-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              
              <div className="zoom-controls">
                <button 
                  className="icon-btn"
                  onClick={() => setZoom(z => Math.max(25, z - 25))}
                  aria-label="Zoom out"
                >
                  <ZoomOut size={18} />
                </button>
                <span>{zoom}%</span>
                <button 
                  className="icon-btn"
                  onClick={() => setZoom(z => Math.min(300, z + 25))}
                  aria-label="Zoom in"
                >
                  <ZoomIn size={18} />
                </button>
              </div>

              <div className="toolbar-actions">
                {currentFile && (
                  <button 
                    className="icon-btn"
                    onClick={() => { setRotateAngle(90); rotatePDF(); }}
                    aria-label="Quick rotate 90°"
                    title="Rotate 90°"
                    disabled={isProcessing}
                  >
                    <RotateCw size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="viewer-content">
              {currentFile ? (
                <>
                  <canvas ref={canvasRef} />
                  {isProcessing && (
                    <div className="processing-overlay">
                      <div className="spinner" />
                      <p>Processing...</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <FileText />
                  </div>
                  <h3>No PDF Loaded</h3>
                  <p>Upload a PDF file to view, edit, merge, or compress it entirely in your browser.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
