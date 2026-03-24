import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  FileText, Upload, Download, Scissors, 
  RotateCw, Trash2,
  Shield, PenTool, Layers, Loader, Minimize2,
  X, Check, GripVertical, GitMerge, Plus, FilePlus
} from 'lucide-react';
import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import qpdfWasm from 'qpdf-wasm-esm-embedded';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import ThemeToggle from './components/ThemeToggle';
import { PopupPage } from './components/PopupPage';
import { Footer } from './components/Footer';
import './App.scss';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const loadQpdf = () => Promise.resolve(qpdfWasm);

interface PDFFile {
  id: string;
  name: string;
  file: File;
  pageCount: number;
  size: number;
}

type Tool = 'split' | 'rotate' | 'compress' | 'extract' | 'merge';

interface MergePage {
  fileId: string;
  pageIndex: number;
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pdf-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const [files, setFiles] = useState<PDFFile[]>([]);
  const [currentFile, setCurrentFile] = useState<PDFFile | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>('split');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [splitRange, setSplitRange] = useState({ from: 1, to: 1 });

  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [mergeSelections, setMergeSelections] = useState<Set<string>>(new Set());
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());
  const [pageRotations, setPageRotations] = useState<Map<number, number>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [popupPage, setPopupPage] = useState<number | null>(null);
  const [popupZoom, setPopupZoom] = useState(100);
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchDragRef = useRef<{ pageNum: number; startX: number; startY: number; timestamp: number } | null>(null);
  const lastTouchDragTime = useRef<number>(0);
  const thumbnailCache = useRef<Map<string, string>>(new Map());
  const pdfDocCache = useRef<Map<string, { pdfDoc: any; pdfjsDoc: any }>>(new Map());
  const pdfjsLoadingTaskCache = useRef<Map<string, Promise<any>>>(new Map());
  const renderOperationId = useRef<number>(0);
  const popupCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfJsRef = useRef<any>(null);
  const isRenderingRef = useRef<Set<number>>(new Set());

  const [mergeOrder, setMergeOrder] = useState<MergePage[]>([]);
  const [mergeDraggedIndex, setMergeDraggedIndex] = useState<number | null>(null);
  const mergeDragOverIndexRef = useRef<number | null>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const mergeThumbCache = useRef<Map<string, string>>(new Map());
  const mergeRenderingRef = useRef<Set<string>>(new Set());
  const [mergeRotations, setMergeRotations] = useState<Map<string, number>>(new Map());
  const [mergePopupPage, setMergePopupPage] = useState<{ fileId: string; pageIndex: number } | null>(null);
  const filesRef = useRef<PDFFile[]>(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pdf-theme', theme);
  }, [theme]);

  useEffect(() => {
    pdfJsRef.current = pdfjsLib;
  }, []);

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

    const renderThumbnail = useCallback(async (pageNum: number, operationId?: number) => {
    if (!currentFile || isRenderingRef.current.has(pageNum)) return;
    
    const currentOpId = operationId ?? renderOperationId.current;
    if (currentOpId !== renderOperationId.current) return;
    
    const cacheKey = `${currentFile.id}-${pageNum}`;
    
    isRenderingRef.current.add(pageNum);
    
    const existingDataUrl = thumbnailCache.current.get(cacheKey);
    if (existingDataUrl) {
      const img = document.querySelector(`.thumbnail-img-${pageNum}`) as HTMLImageElement;
      if (img && currentOpId === renderOperationId.current) {
        img.src = existingDataUrl;
      }
      isRenderingRef.current.delete(pageNum);
      return;
    }
    
    try {
      const pdfjsLib = pdfJsRef.current;
      if (!pdfjsLib || !currentFile) return;
      
      if (currentOpId !== renderOperationId.current) return;
      
      const cached = pdfDocCache.current.get(currentFile.id);
      const pdfDoc = cached?.pdfjsDoc;
      if (!pdfDoc) return;
      
      const page = await pdfDoc.getPage(pageNum);
      
      const scale = 0.25;
      const viewport = page.getViewport({ scale });
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;
      
      const context = tempCanvas.getContext('2d');
      if (!context) return;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      const dataUrl = tempCanvas.toDataURL('image/png');
      const cacheKey = `${currentFile.id}-${pageNum}`;
      thumbnailCache.current.set(cacheKey, dataUrl);
      
      const img = document.querySelector(`.thumbnail-img-${pageNum}`) as HTMLImageElement;
      if (img && currentOpId === renderOperationId.current) {
        img.src = dataUrl;
      }
    } catch (err) {
      console.error('Error rendering thumbnail:', pageNum, err);
    } finally {
      isRenderingRef.current.delete(pageNum);
    }
  }, [currentFile, pageRotations]);

  const loadPDF = async (file: File, addToList = true, shouldRenderThumbnails = true, explicitFileId?: string) => {
    const arrayBuffer = await file.arrayBuffer();
    
    try {
      if (addToList && shouldRenderThumbnails) {
        thumbnailCache.current.clear();
      }
      
      const pdfDocument = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDocument.getPageCount();
      
      let fileId: string;
      
      if (addToList) {
        fileId = explicitFileId || Math.random().toString(36).substring(7);
        const newFile: PDFFile = {
          id: fileId,
          name: file.name,
          file,
          pageCount,
          size: file.size,
        };
        setFiles(prev => [...prev, newFile]);
        setCurrentFile(newFile);
      } else {
        fileId = explicitFileId || currentFile?.id || Math.random().toString(36).substring(7);
        setCurrentFile(prev => prev ? { ...prev, file, pageCount } : null);
      }
      
      if (shouldRenderThumbnails) {
        const pdfjsLib = pdfJsRef.current;
        if (pdfjsLib) {
          const pdfjsDoc = await pdfjsLib.getDocument({ 
            data: arrayBuffer
          }).promise;
          pdfDocCache.current.set(fileId, { pdfDoc: pdfDocument, pdfjsDoc });
        }
      }
      
      setPdfDoc(pdfDocument);
      setTotalPages(pageCount);
      setPageOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
      setActiveTool('split');
      setSelectedPages(new Set());
      setDeletedPages(new Set());
      setPageRotations(new Map());
      setHasChanges(false);
      showAlert('success', `Loaded "${file.name}" with ${pageCount} pages`);
    } catch (err: any) {
      if (err?.message?.includes('encrypted') || err?.message?.includes('password')) {
        showAlert('error', `Skipped "${file.name}" - Password protected PDFs are not supported.`);
        return;
      }
      console.error('PDF load error:', err?.message);
      showAlert('error', 'Failed to load PDF. Please ensure the file is a valid PDF.');
    }
  };

    const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const pdfFiles = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      showAlert('error', 'Please select valid PDF files');
      return;
    }
    
    const results = await Promise.all(pdfFiles.map(async (file) => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        return { file, valid: true };
      } catch (err: any) {
        if (err?.message?.includes('encrypted') || err?.message?.includes('password')) {
          return { file, valid: false, skipped: true };
        }
        return { file, valid: false, error: true };
      }
    }));
    
    const validFiles = results.filter(r => r.valid).map(r => r.file);
    const skippedFiles = results.filter(r => r.skipped).map(r => r.file.name);
    const invalidFiles = results.filter(r => r.error).map(r => r.file.name);
    
    if (skippedFiles.length > 0) {
      showAlert('error', `Skipped ${skippedFiles.length} password protected PDF(s): ${skippedFiles.join(', ')}`);
    }
    
    if (invalidFiles.length > 0) {
      showAlert('error', `Invalid PDF(s): ${invalidFiles.join(', ')}`);
    }
    
    if (validFiles.length > 0) {
      validFiles.forEach((file, index) => loadPDF(file, true, index === 0));
    }
  }, []);

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleFileDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
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
          loadPDF(remaining.file, false, true);
        } else {
          setPdfDoc(null);
          setTotalPages(0);
          setPageOrder([]);
        }
      }
      return newFiles;
    });
  };

  const switchFile = async (file: PDFFile) => {
    setCurrentFile(file);
    await loadPDF(file.file, false, true, file.id);
  };

  const toggleSelection = (pageNum: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allPages = new Set(pageOrder.filter(p => !deletedPages.has(p)));
    setSelectedPages(allPages);
  };

  const clearSelection = () => {
    setSelectedPages(new Set());
  };

  const toggleDelete = (pageNum: number) => {
    setDeletedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageNum);
      return newSet;
    });
    setHasChanges(true);
  };

  const handlePageDragStart = (e: React.DragEvent, pageNum: number) => {
    setDraggedPage(pageNum);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePageDragOver = (e: React.DragEvent, displayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(displayIndex);
  };

  const handlePageDragLeave = () => {
    setDragOverIndex(null);
  };

  const handlePageDrop = (e: React.DragEvent, targetPageNum: number) => {
    e.preventDefault();
    if (!draggedPage || draggedPage === targetPageNum) {
      setDraggedPage(null);
      setDragOverIndex(null);
      return;
    }

    setPageOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedPage);
      const targetIndex = newOrder.indexOf(targetPageNum);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedPage);
      
      return newOrder;
    });

    setDraggedPage(null);
    setDragOverIndex(null);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedPage(null);
    setDragOverIndex(null);
  };

  const handleTouchStart = (e: React.TouchEvent, pageNum: number) => {
    if (deletedPages.has(pageNum)) return;
    const touch = e.touches[0];
    touchDragRef.current = { pageNum, startX: touch.clientX, startY: touch.clientY, timestamp: Date.now() };
    lastTouchDragTime.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchDragRef.current) return;
    
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    
    const thumbnailItem = target.closest('.thumbnail-item') as HTMLElement;
    if (!thumbnailItem) return;
    
    const targetDisplayIndex = parseInt(thumbnailItem.dataset.displayIndex || '0');
    if (!isNaN(targetDisplayIndex) && targetDisplayIndex !== dragOverIndex) {
      setDragOverIndex(targetDisplayIndex);
    }
  };

  const handleTouchEnd = () => {
    if (!touchDragRef.current) return;
    
    const { pageNum } = touchDragRef.current;
    if (dragOverIndex !== null && pageOrder[dragOverIndex] !== pageNum) {
      const targetPageNum = pageOrder[dragOverIndex];
      
      setPageOrder(prev => {
        const newOrder = [...prev];
        const draggedIndex = newOrder.indexOf(pageNum);
        const targetIndex = newOrder.indexOf(targetPageNum);
        
        if (draggedIndex === -1 || targetIndex === -1) return prev;
        
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, pageNum);
        
        return newOrder;
      });
      
      setHasChanges(true);
    }
    
    lastTouchDragTime.current = Date.now();
    touchDragRef.current = null;
    setDraggedPage(null);
    setDragOverIndex(null);
  };

  const rotatePage = (pageNum: number, angle: number) => {
    if (!currentFile) return;
    setPageRotations(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(pageNum) || 0;
      newMap.set(pageNum, (current + angle) % 360);
      return newMap;
    });
    setHasChanges(true);
  };

  const applyChanges = async () => {
    if (!pdfDoc || !currentFile) return;
    
    setIsProcessing(true);
    try {
      const pagesToSave = selectedPages.size > 0 ? selectedPages : new Set(pageOrder.filter(p => !deletedPages.has(p)));
      const orderedPages = selectedPages.size > 0 
        ? pageOrder.filter(p => pagesToSave.has(p))
        : pageOrder.filter(p => !deletedPages.has(p));
      
      const hasRotations = Array.from(orderedPages).some(p => pageRotations.has(p) && pageRotations.get(p) !== 0);
      
      if (!hasRotations) {
        const pdfBytes = await extractPagesEfficient(currentFile.file, orderedPages);
        const filename = selectedPages.size > 0 
          ? `${currentFile.name.replace('.pdf', '')}_selected_pages.pdf`
          : `edited_${currentFile.name}`;
        downloadBlob(pdfBytes, filename);
      } else {
        const newPdf = await PDFDocument.create();
        
        for (const pageNum of orderedPages) {
          const pageIndex = pageNum - 1;
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
          
          const rotation = pageRotations.get(pageNum);
          if (rotation && rotation !== 0) {
            const currentRotation = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees(currentRotation + rotation));
          }
          
          newPdf.addPage(copiedPage);
        }
        
        const pdfBytes = await newPdf.save();
        const filename = selectedPages.size > 0 
          ? `${currentFile.name.replace('.pdf', '')}_selected_pages.pdf`
          : `edited_${currentFile.name}`;
        downloadBlob(pdfBytes, filename);
      }
      
      showAlert('success', 'PDF saved successfully!');
    } catch {
      showAlert('error', 'Failed to save PDF');
    }
    setIsProcessing(false);
  };

  const discardChanges = () => {
    setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
    setDeletedPages(new Set());
    setPageRotations(new Map());
    setSelectedPages(new Set());
    setHasChanges(false);
    showAlert('info', 'All changes discarded');
  };

  const downloadBlob = (pdfBytes: Uint8Array, filename: string) => {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const extractPagesEfficient = async (file: File, pages: number[]): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    const pdfStr = new TextDecoder('latin1').decode(pdfBytes);
    
    const startxrefMatch = pdfStr.match(/startxref\s*\n(\d+)/);
    if (!startxrefMatch) {
      return await extractWithPdfLib(file, pages);
    }
    
    const xrefPos = parseInt(startxrefMatch[1]);
    let xrefStart = pdfStr.lastIndexOf('xref', xrefPos);
    if (xrefStart > 0 && pdfStr[xrefStart - 1] !== '\n' && pdfStr[xrefStart - 1] !== ' ') {
      xrefStart = pdfStr.indexOf('xref', xrefPos);
    }
    
    const trailerMatch = pdfStr.match(/trailer\s*<<([\s\S]*?)>>/);
    if (!trailerMatch) {
      return await extractWithPdfLib(file, pages);
    }
    
    const trailer = trailerMatch[1];
    const rootMatch = trailer.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
    const pagesMatch = trailer.match(/\/Pages\s+(\d+)\s+(\d+)\s+R/);
    
    if (!rootMatch || !pagesMatch) {
      return await extractWithPdfLib(file, pages);
    }
    
    const rootObjNum = parseInt(rootMatch[1]);
    const pagesObjNum = parseInt(pagesMatch[1]);
    
    const parseXref = (content: string): Map<number, { offset: number; gen: number; inUse: boolean }> => {
      const offsets = new Map<number, { offset: number; gen: number; inUse: boolean }>();
      const lines = content.split(/\r?\n/);
      let currentSection = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^\d{10} \d{5} [fn]$/.test(trimmed)) {
          const parts = trimmed.split(/\s+/);
          const objNum = currentSection + parseInt(parts[0]);
          offsets.set(objNum, {
            offset: parseInt(parts[1]),
            gen: parseInt(parts[2]),
            inUse: parts[3] === 'n'
          });
        } else if (/^\d+$/.test(trimmed)) {
          currentSection = parseInt(trimmed);
        }
      }
      return offsets;
    };
    
    const xrefContent = pdfStr.substring(xrefStart, trailerMatch.index);
    const objectOffsets = parseXref(xrefContent);
    
    const getObjectRaw = (objNum: number): { data: string; start: number; end: number } | null => {
      const info = objectOffsets.get(objNum);
      if (!info || !info.inUse) return null;
      const start = info.offset;
      const end = pdfStr.indexOf('endobj', start);
      if (end === -1) return null;
      return {
        data: pdfStr.substring(start, end + 6),
        start: start,
        end: end + 6
      };
    };
    
    const getObjectRefs = (objStr: string): number[] => {
      const refs = objStr.match(/(\d+)\s+\d+\s+R/g) || [];
      return [...new Set(refs.map(r => parseInt(r.split(' ')[0])))];
    };
    
    const traversePages = (objNum: number, depth = 0): number[] => {
      if (depth > 10) return [];
      const obj = getObjectRaw(objNum);
      if (!obj) return [];
      
      const typeMatch = obj.data.match(/\/Type\s*\/(\w+)/);
      const type = typeMatch?.[1];
      
      if (type === 'Page') {
        return [objNum];
      }
      
      if (type === 'Pages') {
        const kidsMatch = obj.data.match(/\/Kids\s*\[([^\]]*)\]/);
        if (kidsMatch) {
          const kids = kidsMatch[1].match(/(\d+)\s+\d+\s+R/g) || [];
          const result: number[] = [];
          for (const kid of kids) {
            result.push(...traversePages(parseInt(kid.split(' ')[0]), depth + 1));
          }
          return result;
        }
      }
      
      return [];
    };
    
    const allPages = traversePages(pagesObjNum);
    const pageSet = new Set(pages.map(p => p - 1));
    const selectedPages = allPages.filter((_, idx) => pageSet.has(idx));
    
    const neededObjects = new Set<number>();
    const collectDeps = (objNum: number, depth = 0): void => {
      if (depth > 15 || neededObjects.has(objNum)) return;
      
      const obj = getObjectRaw(objNum);
      if (!obj) return;
      
      neededObjects.add(objNum);
      const refs = getObjectRefs(obj.data);
      for (const ref of refs) {
        collectDeps(ref, depth + 1);
      }
    };
    
    collectDeps(rootObjNum);
    collectDeps(pagesObjNum);
    for (const page of selectedPages) {
      collectDeps(page);
    }
    
    const sortedObjects = [...neededObjects].sort((a, b) => a - b);
    const objNumMap = new Map<number, number>();
    sortedObjects.forEach((oldNum, idx) => {
      objNumMap.set(oldNum, idx + 1);
    });
    
    const remapRefs = (str: string): string => {
      return str.replace(/(\d+)\s+\d+\s+R/g, (match, num) => {
        const newNum = objNumMap.get(parseInt(num));
        return newNum !== undefined ? `${newNum} 0 R` : match;
      });
    };
    
    const header = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
    
    const objStrs: string[] = [];
    const objLengths: number[] = [];
    for (const oldNum of sortedObjects) {
      const obj = getObjectRaw(oldNum);
      if (obj) {
        const remappedData = remapRefs(obj.data);
        const objStr = `${objNumMap.get(oldNum)} 0 obj\n${remappedData}\nendobj\n`;
        objStrs.push(objStr);
        objLengths.push(objStr.length);
      }
    }
    
    const body = objStrs.join('');
    const xrefOffset = header.length + body.length;
    
    let xref = `xref\n0 ${sortedObjects.length + 1}\n`;
    xref += `0000000000 65535 f \n`;
    
    let offset = header.length;
    for (let i = 0; i < objStrs.length; i++) {
      xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
      offset += objLengths[i];
    }
    
    const newRoot = objNumMap.get(rootObjNum) || 1;
    const newTrailer = `trailer\n<<\n/Size ${sortedObjects.length + 1}\n/Root ${newRoot} 0 R\n>>\nstartxref\n${xrefOffset}\n%%EOF`;
    
    const result = new TextEncoder().encode(header + body + xref + newTrailer);
    return result;
  };

  const extractWithPdfLib = async (file: File, pages: number[]): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    
    for (const pageNum of pages) {
      const pageIndex = pageNum - 1;
      if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
        newPdf.addPage(copiedPage);
      }
    }
    
    return await newPdf.save();
  };

  const saveBlob = downloadBlob;

  const splitPDF = async () => {
    if (!currentFile || !pdfDoc) return;
    
    setIsProcessing(true);
    try {
      const { from, to } = splitRange;
      const visiblePages = pageOrder.filter(p => !deletedPages.has(p));
      const pagesToExtract = visiblePages.filter(p => p >= from && p <= to);
      
      if (pagesToExtract.length === 0) {
        showAlert('error', 'No pages in the selected range');
        setIsProcessing(false);
        return;
      }
      
      const newPdf = await PDFDocument.create();
      
      for (const pageNum of pagesToExtract) {
        const pageIndex = pageNum - 1;
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
        
        const rotation = pageRotations.get(pageNum);
        if (rotation && rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees(currentRotation + rotation));
        }
        
        newPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await newPdf.save();
      saveBlob(pdfBytes, `${currentFile.name.replace('.pdf', '')}_pages_${from}-${to}.pdf`);
      showAlert('success', `Extracted pages ${from}-${to} (${pagesToExtract.length} pages, ordered as displayed)`);
    } catch {
      showAlert('error', 'Failed to split PDF');
    }
    setIsProcessing(false);
  };

  const compressPDF = async () => {
    if (!currentFile) return;
    
    setIsProcessing(true);
    try {
      const arrayBuffer = await currentFile.file.arrayBuffer();
      const inputBytes = new Uint8Array(arrayBuffer);
      
      const visiblePages = pageOrder.filter(p => !deletedPages.has(p));
      const pagesToCompress = selectedPages.size > 0 
        ? visiblePages.filter(p => selectedPages.has(p))
        : visiblePages;
      
      let pdfToCompress: Uint8Array;
      
      if (selectedPages.size > 0 && pagesToCompress.length > 0) {
        const sourcePdf = await PDFDocument.load(inputBytes);
        const newPdf = await PDFDocument.create();
        
        for (const pageNum of pagesToCompress) {
          const pageIndex = pageNum - 1;
          if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
            const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
            
            const rotation = pageRotations.get(pageNum);
            if (rotation && rotation !== 0) {
              const currentRotation = copiedPage.getRotation().angle;
              copiedPage.setRotation(degrees(currentRotation + rotation));
            }
            
            newPdf.addPage(copiedPage);
          }
        }
        
        pdfToCompress = await newPdf.save();
      } else {
        pdfToCompress = inputBytes;
      }
      
      const qpdfModule = await loadQpdf();
      const qpdf = qpdfModule({
        noInitialRun: true,
      }) as any;
      
      qpdf.FS.writeFile('input.pdf', pdfToCompress);
      
      await qpdf.callMain([
        '--object-streams=generate',
        'input.pdf',
        'output.pdf'
      ]);
      
      const outputBytes = qpdf.FS.readFile('output.pdf');
      const pdfBytes = new Uint8Array(outputBytes);
      
      const originalSize = currentFile.file.size;
      const newSize = pdfBytes.length;
      const reduction = Math.round((1 - newSize / originalSize) * 100);
      
      const pageInfo = selectedPages.size > 0 ? ` (${pagesToCompress.length} pages)` : '';
      saveBlob(pdfBytes, `${currentFile.name.replace('.pdf', '')}_compressed.pdf`);
      showAlert('success', `Compressed${pageInfo}: ${formatFileSize(originalSize)} → ${formatFileSize(newSize)} (${reduction > 0 ? '-' : '+'}${Math.abs(reduction)}%)`);
    } catch (err) {
      console.error('Compression error:', err);
      showAlert('error', 'Compression failed. Please try a different PDF.');
    }
    setIsProcessing(false);
  };

  const renderMergeThumbnail = useCallback(async (fileId: string, pageIndex: number) => {
    const cacheKey = `${fileId}-${pageIndex}`;
    
    if (mergeThumbCache.current.has(cacheKey)) {
      const img = document.querySelector(`.merge-thumb-${cacheKey.replace(/[^a-zA-Z0-9]/g, '-')}`) as HTMLImageElement;
      if (img && img.src.startsWith('data:image/gif')) {
        img.src = mergeThumbCache.current.get(cacheKey)!;
      }
      return;
    }
    
    if (mergeRenderingRef.current.has(cacheKey)) return;
    mergeRenderingRef.current.add(cacheKey);
    
    const file = filesRef.current.find(f => f.id === fileId);
    if (!file) {
      mergeRenderingRef.current.delete(cacheKey);
      return;
    }
    
    try {
      const pdfjsLib = pdfJsRef.current;
      if (!pdfjsLib) return;
      
      let pdf: any;
      const cached = pdfDocCache.current.get(fileId);
      if (cached?.pdfjsDoc) {
        pdf = cached.pdfjsDoc;
      } else {
        if (!pdfjsLoadingTaskCache.current) {
          pdfjsLoadingTaskCache.current = new Map();
        }
        
        let loadingPromise = pdfjsLoadingTaskCache.current.get(fileId);
        if (!loadingPromise) {
          loadingPromise = file.file.arrayBuffer().then((arrayBuffer) => 
            pdfjsLib.getDocument({ data: arrayBuffer }).promise
          ).then((loadedPdf) => {
             const currentCache = pdfDocCache.current.get(fileId) || { pdfDoc: null, pdfjsDoc: null };
             pdfDocCache.current.set(fileId, { ...currentCache, pdfjsDoc: loadedPdf });
             return loadedPdf;
          });
          pdfjsLoadingTaskCache.current.set(fileId, loadingPromise);
        }
        
        pdf = await loadingPromise;
      }
      const page = await pdf.getPage(pageIndex);
      
      const scale = 0.2;
      const viewport = page.getViewport({ scale });
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;
      
      const context = tempCanvas.getContext('2d');
      if (!context) {
        mergeRenderingRef.current.delete(cacheKey);
        return;
      }
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      const dataUrl = tempCanvas.toDataURL('image/png');
      mergeThumbCache.current.set(cacheKey, dataUrl);
      
      const img = document.querySelector(`.merge-thumb-${cacheKey.replace(/[^a-zA-Z0-9]/g, '-')}`) as HTMLImageElement;
      if (img) img.src = dataUrl;
    } catch (err) {
      console.error('Error rendering merge thumbnail:', cacheKey, err);
    } finally {
      mergeRenderingRef.current.delete(cacheKey);
    }
  }, []);

  const toggleMergeSelection = (fileId: string, pageIndex: number) => {
    const key = `${fileId}-${pageIndex}`;
    const isCurrentlySelected = mergeSelections.has(key);
    
    if (isCurrentlySelected) {
      setMergeSelections(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
      setMergeOrder(prev => prev.filter(p => !(p.fileId === fileId && p.pageIndex === pageIndex)));
    } else {
      setMergeSelections(prev => {
        const newSet = new Set(prev);
        newSet.add(key);
        return newSet;
      });
      setMergeOrder(prev => [...prev, { fileId, pageIndex }]);
    }
  };

  const selectAllInFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    
    const newSelectionKeys: string[] = [];
    const pagesToAdd: MergePage[] = [];
    
    for (let i = 1; i <= file.pageCount; i++) {
      const key = `${fileId}-${i}`;
      if (!mergeSelections.has(key)) {
        newSelectionKeys.push(key);
        pagesToAdd.push({ fileId, pageIndex: i });
      }
    }
    
    if (pagesToAdd.length > 0) {
      setMergeSelections(prev => new Set([...prev, ...newSelectionKeys]));
      setMergeOrder(prev => [...prev, ...pagesToAdd]);
    }
  };

  const clearSelectionInFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    
    setMergeSelections(prev => {
      const newSet = new Set(prev);
      for (let i = 1; i <= file.pageCount; i++) {
        newSet.delete(`${fileId}-${i}`);
      }
      return newSet;
    });
    setMergeOrder(prev => prev.filter(p => p.fileId !== fileId));
  };

  const removeFromMerge = (index: number) => {
    const item = mergeOrder[index];
    if (item) {
      const key = `${item.fileId}-${item.pageIndex}`;
      setMergeSelections(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
    setMergeOrder(prev => prev.filter((_, i) => i !== index));
  };

  const rotateMergePage = (fileId: string, pageIndex: number, angle: number) => {
    const key = `${fileId}-${pageIndex}`;
    setMergeRotations(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(key) || 0;
      newMap.set(key, (current + angle) % 360);
      return newMap;
    });
  };

  const openMergePopup = (fileId: string, pageIndex: number) => {
    setMergePopupPage({ fileId, pageIndex });
  };

  const clearMergeQueue = () => {
    setMergeOrder([]);
    setMergeRotations(new Map());
    setMergeSelections(new Set());
    showAlert('info', 'Merge queue cleared');
  };

  const handleMergeDragStart = (e: React.DragEvent, index: number) => {
    setMergeDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const updateMergeDragOverUI = (newIndex: number | null) => {
    if (mergeDragOverIndexRef.current === newIndex) return;
    
    if (mergeDragOverIndexRef.current !== null) {
      const oldEl = document.getElementById(`merge-item-${mergeDragOverIndexRef.current}`);
      if (oldEl) oldEl.classList.remove('drag-over');
    }
    
    if (newIndex !== null) {
      const newEl = document.getElementById(`merge-item-${newIndex}`);
      if (newEl) newEl.classList.add('drag-over');
    }
    
    mergeDragOverIndexRef.current = newIndex;
  };

  const handleMergeDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    updateMergeDragOverUI(index);
  };

  const handleMergeDragLeave = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientY < rect.top ||
      e.clientY >= rect.bottom ||
      e.clientX < rect.left ||
      e.clientX >= rect.right
    ) {
      updateMergeDragOverUI(null);
    }
  };

  const handleMergeDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    updateMergeDragOverUI(null);
    
    if (mergeDraggedIndex === null || mergeDraggedIndex === targetIndex) {
      setMergeDraggedIndex(null);
      return;
    }

    setMergeOrder(prev => {
      const newOrder = [...prev];
      const [dragged] = newOrder.splice(mergeDraggedIndex, 1);
      newOrder.splice(targetIndex, 0, dragged);
      return newOrder;
    });

    setMergeDraggedIndex(null);
  };

  const handleMergeDragEnd = () => {
    setMergeDraggedIndex(null);
    updateMergeDragOverUI(null);
  };

  const mergePDFs = async () => {
    if (mergeOrder.length === 0) {
      showAlert('error', 'No pages in merge queue');
      return;
    }
    
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();
      
      const loadedDocs = new Map<string, PDFDocument>();
      
      for (const mergePage of mergeOrder) {
        let sourceDoc = loadedDocs.get(mergePage.fileId);
        
        if (!sourceDoc) {
          const file = files.find(f => f.id === mergePage.fileId);
          if (!file) continue;
          const arrayBuffer = await file.file.arrayBuffer();
          sourceDoc = await PDFDocument.load(arrayBuffer);
          loadedDocs.set(mergePage.fileId, sourceDoc);
        }
        
        const pageIndex = mergePage.pageIndex - 1;
        if (pageIndex >= 0 && pageIndex < sourceDoc.getPageCount()) {
          const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [pageIndex]);
          
          const key = `${mergePage.fileId}-${mergePage.pageIndex}`;
          const rotation = mergeRotations.get(key);
          if (rotation && rotation !== 0) {
            const currentRotation = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees(currentRotation + rotation));
          }
          
          mergedPdf.addPage(copiedPage);
        }
      }
      
      const pdfBytes = await mergedPdf.save();
      downloadBlob(pdfBytes, 'merged.pdf');
      showAlert('success', `Merged ${mergeOrder.length} pages into a single PDF`);
    } catch {
      showAlert('error', 'Failed to merge PDFs');
    }
    setIsProcessing(false);
  };

  const renderPopupPage = useCallback(async () => {
    if (!currentFile || !popupPage || !popupCanvasRef.current) return;
    
    const pdfjsLib = pdfJsRef.current;
    if (!pdfjsLib) return;
    
    try {
      let pdf: any;
      const cached = pdfDocCache.current.get(currentFile.id);
      if (cached?.pdfjsDoc) {
        pdf = cached.pdfjsDoc;
      } else {
        const arrayBuffer = await currentFile.file.arrayBuffer();
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      }
      const page = await pdf.getPage(popupPage);
      
      const scale = (popupZoom / 100) * 1.5;
      const viewport = page.getViewport({ scale });
      
      const canvas = popupCanvasRef.current;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const context = canvas.getContext('2d');
      if (!context) return;
      
      const rotation = pageRotations.get(popupPage) || 0;
      
      if (rotation) {
        context.save();
        if (rotation === 90 || rotation === 270) {
          canvas.height = viewport.width;
          canvas.width = viewport.height;
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate((rotation * Math.PI) / 180);
          context.translate(-viewport.height / 2, -viewport.width / 2);
        } else {
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate((rotation * Math.PI) / 180);
          context.translate(-viewport.width / 2, -viewport.height / 2);
        }
      }
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      if (rotation) {
        context.restore();
      }
    } catch {
      console.error('Error rendering popup page');
    }
  }, [currentFile, popupPage, popupZoom, pageRotations]);

  useEffect(() => {
    renderPopupPage();
  }, [renderPopupPage]);

  useEffect(() => {
    if (!mergePopupPage) return;
    
    const file = files.find(f => f.id === mergePopupPage.fileId);
    if (!file) return;
    
    const canvas = document.getElementById('merge-popup-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const rotation = mergeRotations.get(`${mergePopupPage.fileId}-${mergePopupPage.pageIndex}`) || 0;
    
    const render = async () => {
      const pdfjsLib = pdfJsRef.current;
      if (!pdfjsLib) return;
      
      try {
        let pdf: any;
        const cached = pdfDocCache.current.get(file.id);
        if (cached?.pdfjsDoc) {
          pdf = cached.pdfjsDoc;
        } else {
          const arrayBuffer = await file.file.arrayBuffer();
          pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        }
        const page = await pdf.getPage(mergePopupPage.pageIndex);
        
        const scale = (popupZoom / 100) * 1.5;
        const viewport = page.getViewport({ scale });
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        if (rotation) {
          context.save();
          if (rotation === 90 || rotation === 270) {
            canvas.width = viewport.height;
            canvas.height = viewport.width;
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate((rotation * Math.PI) / 180);
            context.translate(-viewport.height / 2, -viewport.width / 2);
          } else {
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate((rotation * Math.PI) / 180);
            context.translate(-viewport.width / 2, -viewport.height / 2);
          }
        }
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        if (rotation) {
          context.restore();
        }
      } catch (err) {
        console.error('Error rendering merge popup:', err);
      }
    };
    
    render();
  }, [mergePopupPage, popupZoom, mergeRotations, files]);

  const closePopup = () => {
    setPopupPage(null);
  };  const renderThumbnailRef = useRef(renderThumbnail);
  const renderMergeThumbnailRef = useRef(renderMergeThumbnail);

  useEffect(() => {
    renderThumbnailRef.current = renderThumbnail;
  }, [renderThumbnail]);

  useEffect(() => {
    renderMergeThumbnailRef.current = renderMergeThumbnail;
  }, [renderMergeThumbnail]);

  const thumbnailObserverRef = useRef<IntersectionObserver | null>(null);
  const thumbnailRefCallback = useCallback((node: HTMLImageElement | null, fileId: string | undefined, pageNum: number) => {
    if (!node || !fileId) return;

    const cacheKey = `${fileId}-${pageNum}`;
    if (thumbnailCache.current.has(cacheKey)) {
      if (node.src.startsWith('data:image/gif')) {
        node.src = thumbnailCache.current.get(cacheKey)!;
      }
      return;
    }

    if (!thumbnailObserverRef.current) {
      thumbnailObserverRef.current = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLImageElement;
            const pNum = parseInt(target.dataset.page || '0');
            if (pNum) renderThumbnailRef.current(pNum);
            thumbnailObserverRef.current?.unobserve(target);
          }
        });
      }, { rootMargin: '250px' });
    }

    node.dataset.page = pageNum.toString();
    thumbnailObserverRef.current.observe(node);
  }, []);

  const mergeObserverRef = useRef<IntersectionObserver | null>(null);
  const mergeThumbnailRefCallback = useCallback((node: HTMLImageElement | null, fileId: string, pageNum: number) => {
    if (!node) return;

    const cacheKey = `${fileId}-${pageNum}`;
    if (mergeThumbCache.current.has(cacheKey)) {
       if (node.src.startsWith('data:image/gif')) {
         node.src = mergeThumbCache.current.get(cacheKey)!;
       }
       return;
    }

    if (!mergeObserverRef.current) {
      mergeObserverRef.current = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLImageElement;
            const fId = target.dataset.fileId;
            const pNum = parseInt(target.dataset.page || '0');
            if (fId && pNum) {
              renderMergeThumbnailRef.current(fId, pNum);
              mergeObserverRef.current?.unobserve(target);
            }
          }
        });
      }, { rootMargin: '250px' });
    }

    node.dataset.fileId = fileId;
    node.dataset.page = pageNum.toString();
    mergeObserverRef.current.observe(node);
  }, []);

  useEffect(() => {
    return () => {
      thumbnailObserverRef.current?.disconnect();
      mergeObserverRef.current?.disconnect();
    };
  }, []);



  const openPopup = (pageNum: number) => {
    setPopupPage(pageNum);
    setPopupZoom(100);
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
          {!currentFile && (
            <div 
              className={`panel upload-zone ${isDragging ? 'drag-active' : ''}`}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
              }}
            >
              <Upload className="icon" size={48} />
              <h2>Drop PDF here</h2>
              <p>or click to browse your files</p>
              <p className="hint">Your files never leave your device</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".pdf" 
                style={{ display: 'none' }}
                multiple
              />
            </div>
          )}

          {files.length > 0 && (
            <div 
              className={`panel ${isDragging ? 'drag-active' : ''}`}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
            >
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
                      <div className="file-meta">{file.pageCount} pages · {formatFileSize(file.size)}</div>
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
              <button 
                className="add-files-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={16} />
                Add More Files
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".pdf" 
                style={{ display: 'none' }}
                multiple
              />
            </div>
          )}

          <div className="panel">
            <h3>
              <PenTool size={16} className="panel-icon" />
              Tools
            </h3>
            <div className="tool-grid">
              <button 
                className={`tool-btn ${activeTool === 'split' ? 'active' : ''}`}
                onClick={() => setActiveTool('split')}
                disabled={!currentFile}
              >
                <Scissors size={20} />
                Split
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
                className={`tool-btn ${activeTool === 'merge' ? 'active' : ''}`}
                onClick={() => setActiveTool('merge')}
                disabled={files.length === 0}
              >
                <GitMerge size={20} />
                Merge
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

          {activeTool === 'compress' && currentFile && (
            <div className="panel">
              <h3>
                <Minimize2 size={16} className="panel-icon" />
                Compress PDF
              </h3>
              <p className="compress-info">
                Optimizes PDF file size while preserving text quality.
              </p>
              <button className="primary-btn" onClick={compressPDF} disabled={isProcessing}>
                {isProcessing ? <Loader size={16} /> : <Minimize2 size={16} />}
                Compress & Download
              </button>
            </div>
          )}

          {activeTool === 'merge' && files.length > 0 && (
            <div className="panel">
              <h3>
                <GitMerge size={16} className="panel-icon" />
                Merge PDF
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Select pages from uploaded PDFs to merge them into a single document.
              </p>
              <button className="primary-btn" onClick={mergePDFs} disabled={isProcessing || mergeOrder.length === 0}>
                {isProcessing ? <Loader size={16} /> : <Download size={16} />}
                Merge & Download
              </button>
            </div>
          )}
        </aside>

        <section className="viewer-area">
          {activeTool === 'merge' ? (
            <div className="merge-tool">
              <div className="merge-queue-panel">
                <div className="merge-queue-header">
                  <h3>
                    <GitMerge size={18} />
                    Merge Queue
                  </h3>
                  {mergeOrder.length > 0 && (
                    <div className="selection-toolbar">
                      <div className="toolbar-center">
                        <span>{mergeOrder.length} pages</span>
                      </div>
                      <div className="toolbar-right">
                        <button className="toolbar-btn" onClick={clearMergeQueue}>
                          <X size={14} />
                          Clear All
                        </button>
                        <button className="toolbar-btn primary-btn" onClick={mergePDFs} disabled={isProcessing}>
                          {isProcessing ? <Loader size={14} /> : <Download size={14} />}
                          Merge & Download
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {mergeOrder.length > 0 ? (
                  <div 
                    className="merge-queue-grid"
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {mergeOrder.map((mergePage, index) => {
                      const file = files.find(f => f.id === mergePage.fileId);
                      const cacheKey = `${mergePage.fileId}-${mergePage.pageIndex}`;
                      const itemKey = `merge-${mergePage.fileId}-${mergePage.pageIndex}`;
                      const rotation = mergeRotations.get(cacheKey) || 0;
                      
                      return (
                        <div
                          key={itemKey}
                          id={`merge-item-${index}`}
                          className={`merge-queue-item ${mergeDraggedIndex === index ? 'dragging' : ''}`}
                          draggable={true}
                          onDragStart={(e) => handleMergeDragStart(e, index)}
                          onDragOver={(e) => handleMergeDragOver(e, index)}
                          onDragLeave={handleMergeDragLeave}
                          onDrop={(e) => handleMergeDrop(e, index)}
                          onDragEnd={handleMergeDragEnd}
                        >
                          <GripVertical className="merge-drag-handle" size={14} />
                          <span className="merge-page-num">{mergePage.pageIndex}</span>
                          <img
                            src={mergeThumbCache.current.get(cacheKey) || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
                            className={`merge-thumb-canvas merge-thumb-${cacheKey.replace(/[^a-zA-Z0-9]/g, '-')}`}
                            alt={`Preview of page ${mergePage.pageIndex} from ${file?.name || 'document'}`}
                            onClick={(e) => { e.stopPropagation(); openMergePopup(mergePage.fileId, mergePage.pageIndex); }}
                            style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
                            ref={(el) => {
                              if (el) renderMergeThumbnail(mergePage.fileId, mergePage.pageIndex);
                            }}
                          />
                          <div className="merge-source-badge" style={{ background: `hsl(${file ? files.indexOf(file) * 60 : 0}, 70%, 50%)` }}>
                            {file?.name.substring(0, 8) || 'Unknown'}
                          </div>
                          <button 
                            className="merge-rotate-btn"
                            onClick={(e) => { e.stopPropagation(); rotateMergePage(mergePage.fileId, mergePage.pageIndex, 90); }}
                            title="Rotate 90°"
                          >
                            <RotateCw size={10} />
                          </button>
                          <button 
                            className="merge-remove-btn"
                            onClick={(e) => { e.stopPropagation(); removeFromMerge(index); }}
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
                    <p>No pages selected yet</p>
                    <p style={{ fontSize: '0.75rem' }}>Select pages from PDFs below to add them to the merge queue</p>
                  </div>
                )}
              </div>

              <div className="source-pdfs">
                <div className="source-pdfs-header">
                  <h3>
                    <FilePlus size={18} />
                    Source PDFs
                  </h3>
                  <button 
                    className="toolbar-btn"
                    onClick={() => mergeInputRef.current?.click()}
                  >
                    <Plus size={14} />
                    Add More
                  </button>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,application/pdf"
                    className="hidden-input"
                    ref={mergeInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFiles(e.target.files);
                      }
                      if (mergeInputRef.current) mergeInputRef.current.value = '';
                    }}
                  />
                </div>

                {files.map((file, fileIndex) => {
                  
                  return (
                    <div key={file.id} className="source-file-section" style={{ borderLeftColor: `hsl(${fileIndex * 60}, 70%, 50%)` }}>
                      <div className="source-file-header">
                        <div className="source-file-info">
                          <FileText size={16} className="file-icon" />
                          <span className="source-file-name">{file.name}</span>
                          <span className="source-file-meta">{file.pageCount} pages</span>
                        </div>
                        <div className="source-file-actions">
                          <button 
                            className="toolbar-btn"
                            onClick={() => selectAllInFile(file.id)}
                          >
                            <Check size={12} />
                            Select All
                          </button>
                          <button 
                            className="toolbar-btn"
                            onClick={() => clearSelectionInFile(file.id)}
                          >
                            <X size={12} />
                            Clear
                          </button>
                          <button 
                            className="icon-btn danger"
                            onClick={() => removeFile(file.id)}
                            title="Remove file"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="source-pages-grid">
                        {Array.from({ length: file.pageCount }, (_, i) => i + 1).map(pageNum => {
                          const isSelected = mergeSelections.has(`${file.id}-${pageNum}`);
                          
                          return (
                            <div
                              key={`source-${file.id}-${pageNum}`}
                              className={`source-page-item ${isSelected ? 'selected' : ''}`}
                            >
                              <div className="source-page-checkbox" onClick={() => toggleMergeSelection(file.id, pageNum)}>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => {}}
                                />
                              </div>
                              <img
                                src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                                className={`source-thumb-canvas merge-thumb-${file.id.replace(/[^a-zA-Z0-9]/g, '-')}-${pageNum}`}
                                ref={(el) => mergeThumbnailRefCallback(el, file.id, pageNum)}
                                alt={`Thumbnail of page ${pageNum} from ${file.name}`}
                                onClick={(e) => { e.stopPropagation(); openMergePopup(file.id, pageNum); }}
                              />
                              <span className="source-page-num">{pageNum}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="viewer-panel">
            {currentFile ? (
              <>
                <div className="selection-toolbar">
                  <div className="toolbar-left">
                    <button className="toolbar-btn" onClick={selectAll}>
                      <Check size={14} /> Select All
                    </button>
                    <button className="toolbar-btn" onClick={clearSelection}>
                      Clear Selection
                    </button>
                  </div>
                  
                  <div className="toolbar-center">
                    {selectedPages.size > 0 && (
                      <span>{selectedPages.size} of {totalPages - deletedPages.size} pages selected</span>
                    )}
                    {hasChanges && (
                      <span className="changes-indicator">• Unsaved changes</span>
                    )}
                  </div>
                  
                  <div className="toolbar-right">
                    {(hasChanges || selectedPages.size > 0) && (
                      <>
                        <button className="toolbar-btn discard-btn" onClick={discardChanges}>
                          Discard All
                        </button>
                        <button className="toolbar-btn primary-btn" onClick={applyChanges} disabled={isProcessing}>
                          {isProcessing ? <Loader size={14} /> : <Download size={14} />}
                          Save As PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="thumbnail-grid">
                  {pageOrder.map((pageNum, displayIndex) => {
                    const isDeleted = deletedPages.has(pageNum);
                    const isSelected = selectedPages.has(pageNum);
                    const isDragged = draggedPage === pageNum;
                    const isDragOver = dragOverIndex === displayIndex && !isDragged;
                    
                    return (
                      <div
                        key={`${pageNum}-${displayIndex}`}
                        data-display-index={displayIndex}
                        className={`thumbnail-item ${isSelected ? 'selected' : ''} ${isDeleted ? 'deleted' : ''} ${isDragged ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                        draggable
                        onDragStart={(e) => handlePageDragStart(e, pageNum)}
                        onDragOver={(e) => handlePageDragOver(e, displayIndex)}
                        onDragLeave={handlePageDragLeave}
                        onDrop={(e) => handlePageDrop(e, pageNum)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => handleTouchStart(e, pageNum)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onClick={() => {
                          if (Date.now() - lastTouchDragTime.current < 300) return;
                          if (!isDeleted) openPopup(pageNum);
                        }}
                      >
                        <div 
                          className="thumbnail-checkbox"
                          onClick={(e) => { e.stopPropagation(); if (!isDeleted) toggleSelection(pageNum); }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}}
                            disabled={isDeleted}
                          />
                        </div>
                        
                        <GripVertical className="drag-handle" size={14} />
                        
                        <img 
                          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                          ref={(el) => thumbnailRefCallback(el, currentFile?.id, pageNum)} 
                          className={`thumbnail-canvas thumbnail-img-${pageNum}`}
                          alt={`Thumbnail of page ${pageNum} from ${currentFile?.name || 'document'}`}
                          style={ (pageRotations.get(pageNum) ?? 0) ? { transform: `rotate(${pageRotations.get(pageNum) ?? 0}deg)`, transformOrigin: 'center center' } : undefined}
                        />
                        
                        <div className="thumbnail-footer">
                          <span className="page-number">
                            <span className={isDeleted ? 'strikethrough' : ''}>Page {pageNum}</span>
                          </span>
                          
                          <div className="thumbnail-actions">
                            {!isDeleted && (
                              <button 
                                className="rotate-btn"
                                onClick={(e) => { e.stopPropagation(); rotatePage(pageNum, 90); }}
                                title="Rotate 90°"
                              >
                                <RotateCw size={12} />
                              </button>
                            )}
                            
                            {!isDeleted ? (
                              <button 
                                className="delete-btn"
                                onClick={(e) => { e.stopPropagation(); toggleDelete(pageNum); }}
                                title="Mark as deleted"
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : (
                              <button 
                                className="restore-btn"
                                onClick={(e) => { e.stopPropagation(); toggleDelete(pageNum); }}
                                title="Restore page"
                              >
                                <Check size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {isDeleted && (
                          <div className="deleted-badge">
                            <Trash2 size={12} /> DELETED
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

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
          )}
        </section>
      </main>

      <PopupPage
        isOpen={popupPage !== null}
        currentPage={popupPage || 1}
        totalPages={totalPages}
        onClose={closePopup}
        onPrev={() => setPopupPage(p => p !== null ? Math.max(1, p - 1) : 1)}
        onNext={() => setPopupPage(p => p !== null ? Math.min(totalPages, p + 1) : 1)}
        zoomValue={popupZoom}
        onZoomIn={() => setPopupZoom(z => Math.min(300, z + 25))}
        onZoomOut={() => setPopupZoom(z => Math.max(25, z - 25))}
        onFit={() => setPopupZoom(100)}
      >
        <canvas ref={popupCanvasRef} className="popup-canvas" />
      </PopupPage>

      {mergePopupPage && (() => {
        const file = files.find(f => f.id === mergePopupPage.fileId);
        return (
          <PopupPage
            isOpen={true}
            currentPage={mergePopupPage.pageIndex}
            totalPages={file?.pageCount || 1}
            onClose={() => setMergePopupPage(null)}
            onPrev={() => {
              if (mergePopupPage.pageIndex > 1) {
                setMergePopupPage({ ...mergePopupPage, pageIndex: mergePopupPage.pageIndex - 1 });
              }
            }}
            onNext={() => {
              if (file && mergePopupPage.pageIndex < file.pageCount) {
                setMergePopupPage({ ...mergePopupPage, pageIndex: mergePopupPage.pageIndex + 1 });
              }
            }}
            zoomValue={popupZoom}
            onZoomIn={() => setPopupZoom(z => Math.min(300, z + 25))}
            onZoomOut={() => setPopupZoom(z => Math.max(25, z - 25))}
            onFit={() => setPopupZoom(100)}
          >
            <canvas className="popup-canvas merge-popup-canvas" id="merge-popup-canvas" />
          </PopupPage>
        );
      })()}
      <Footer />
    </div>
  );
}

export default App;
