import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Download, Scissors, 
  RotateCw, Trash2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Shield, PenTool, Layers, Loader, Minimize2,
  X, Check, GripVertical
} from 'lucide-react';
import * as pdfLib from 'pdf-lib';
import ThemeToggle from './components/ThemeToggle';
import './App.scss';

interface PDFFile {
  id: string;
  name: string;
  file: File;
  pageCount: number;
  size: number;
}

type Tool = 'split' | 'rotate' | 'compress' | 'extract';

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
  const [pdfDoc, setPdfDoc] = useState<pdfLib.PDFDocument | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [compressionQuality, setCompressionQuality] = useState(80);
  const [splitRange, setSplitRange] = useState({ from: 1, to: 1 });

  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
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
  const thumbnailCache = useRef<Map<number, string>>(new Map());
  const popupCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfJsRef = useRef<any>(null);
  const isRenderingRef = useRef<Set<number>>(new Set());

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

  const renderAllThumbnails = useCallback(async () => {
    if (!currentFile || totalPages === 0) return;
    
    for (let i = 1; i <= totalPages; i++) {
      if (!thumbnailCache.current.has(i)) {
        await renderThumbnail(i);
      }
    }
  }, [currentFile, totalPages, pageRotations]);

  const renderThumbnail = useCallback(async (pageNum: number) => {
    if (!currentFile || isRenderingRef.current.has(pageNum)) return;
    
    isRenderingRef.current.add(pageNum);
    
    const existingDataUrl = thumbnailCache.current.get(pageNum);
    if (existingDataUrl) {
      const img = document.querySelector(`.thumbnail-img-${pageNum}`) as HTMLImageElement;
      if (img) {
        img.src = existingDataUrl;
      }
      isRenderingRef.current.delete(pageNum);
      return;
    }
    
    try {
      let pdfjsLib = pdfJsRef.current;
      if (!pdfjsLib) {
        pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
        pdfJsRef.current = pdfjsLib;
      }
      
      const arrayBuffer = await currentFile.file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum);
      
      const scale = 0.25;
      const viewport = page.getViewport({ scale });
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;
      
      const context = tempCanvas.getContext('2d');
      if (!context) return;
      
      const rotation = pageRotations.get(pageNum) || 0;
      
      if (rotation) {
        context.save();
        if (rotation === 90 || rotation === 270) {
          tempCanvas.width = viewport.height;
          tempCanvas.height = viewport.width;
          context.translate(tempCanvas.width / 2, tempCanvas.height / 2);
          context.rotate((rotation * Math.PI) / 180);
          context.translate(-viewport.height / 2, -viewport.width / 2);
        } else {
          context.translate(tempCanvas.width / 2, tempCanvas.height / 2);
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
      
      const dataUrl = tempCanvas.toDataURL('image/png');
      thumbnailCache.current.set(pageNum, dataUrl);
      
      const img = document.querySelector(`.thumbnail-img-${pageNum}`) as HTMLImageElement;
      if (img) {
        img.src = dataUrl;
      }
    } catch (err) {
      console.error('Error rendering thumbnail:', pageNum, err);
    } finally {
      isRenderingRef.current.delete(pageNum);
    }
  }, [currentFile, pageRotations]);

  const loadPDF = async (file: File, addToList = true) => {
    try {
      thumbnailCache.current.clear();
      pdfJsRef.current = null;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfDocument = await pdfLib.PDFDocument.load(arrayBuffer);
      const pageCount = pdfDocument.getPageCount();
      
      if (addToList) {
        const newFile: PDFFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          file,
          pageCount,
          size: file.size,
        };
        setFiles(prev => [...prev, newFile]);
        setCurrentFile(newFile);
      } else {
        setCurrentFile(prev => prev ? { ...prev, file, pageCount } : null);
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
    } catch {
      showAlert('error', 'Failed to load PDF. Please ensure the file is a valid PDF.');
    }
  };

  useEffect(() => {
    if (!currentFile || totalPages === 0) return;
    
    const timeoutId = setTimeout(() => {
      renderAllThumbnails();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [currentFile, totalPages, renderAllThumbnails]);

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const pdfFiles = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      showAlert('error', 'Please select valid PDF files');
      return;
    }
    pdfFiles.forEach(file => loadPDF(file));
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
          loadPDF(remaining.file, false);
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
    await loadPDF(file.file, false);
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
    thumbnailCache.current.delete(pageNum);
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
        const newPdf = await pdfLib.PDFDocument.create();
        
        for (const pageNum of orderedPages) {
          const pageIndex = pageNum - 1;
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
          
          const rotation = pageRotations.get(pageNum);
          if (rotation && rotation !== 0) {
            const currentRotation = copiedPage.getRotation().angle;
            copiedPage.setRotation(pdfLib.degrees(currentRotation + rotation));
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
    
    const sourcePdf = await pdfLib.PDFDocument.load(pdfBytes);
    const newPdf = await pdfLib.PDFDocument.create();
    
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
      
      const newPdf = await pdfLib.PDFDocument.create();
      
      for (const pageNum of pagesToExtract) {
        const pageIndex = pageNum - 1;
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
        
        const rotation = pageRotations.get(pageNum);
        if (rotation && rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(pdfLib.degrees(currentRotation + rotation));
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
    if (!currentFile || !pdfDoc) return;
    
    setIsProcessing(true);
    try {
      const newPdf = await pdfLib.PDFDocument.create();
      
      for (const pageNum of pageOrder) {
        if (deletedPages.has(pageNum)) continue;
        
        const pageIndex = pageNum - 1;
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
        
        const rotation = pageRotations.get(pageNum);
        if (rotation && rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(pdfLib.degrees(currentRotation + rotation));
        }
        
        newPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await newPdf.save();
      
      const originalSize = currentFile.file.size;
      const newSize = pdfBytes.length;
      const reduction = Math.round((1 - newSize / originalSize) * 100);
      
      saveBlob(pdfBytes, `${currentFile.name.replace('.pdf', '')}_compressed.pdf`);
      showAlert('success', `Compressed: ${formatFileSize(originalSize)} → ${formatFileSize(newSize)} (${reduction > 0 ? '-' : '+'}${Math.abs(reduction)}%)`);
    } catch {
      showAlert('error', 'Failed to compress PDF');
    }
    setIsProcessing(false);
  };

  const renderPopupPage = useCallback(async () => {
    if (!currentFile || !popupPage || !popupCanvasRef.current) return;
    
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
      
      const arrayBuffer = await currentFile.file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
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

  const closePopup = () => {
    setPopupPage(null);
  };

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
          <div 
            className={`panel upload-zone ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
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
        </aside>

        <section className="viewer-area">
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
                          ref={(el) => { 
                            if (el && thumbnailCache.current.has(pageNum)) {
                              el.src = thumbnailCache.current.get(pageNum)!;
                            } else if (el) {
                              renderThumbnail(pageNum);
                            }
                          }} 
                          className={`thumbnail-canvas thumbnail-img-${pageNum}`}
                          alt={`Page ${pageNum}`}
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
        </section>
      </main>

      {popupPage && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <div style={{ width: 32 }} />
              <span>Page {popupPage} of {totalPages}</span>
              <button className="popup-close" onClick={closePopup}>
                <X size={20} />
              </button>
            </div>
            
            <div className="popup-body">
              <button 
                className="popup-nav prev"
                onClick={() => setPopupPage(p => p !== null ? Math.max(1, p - 1) : 1)}
                disabled={popupPage === 1}
              >
                <ChevronLeft size={24} />
              </button>
              
              <canvas ref={popupCanvasRef} className="popup-canvas" />
              
              <button 
                className="popup-nav next"
                onClick={() => setPopupPage(p => p !== null ? Math.min(totalPages, p + 1) : 1)}
                disabled={popupPage === totalPages}
              >
                <ChevronRight size={24} />
              </button>
            </div>
            
            <div className="popup-footer">
              <button 
                className="popup-zoom-btn"
                onClick={() => setPopupZoom(z => Math.max(25, z - 25))}
              >
                <ZoomOut size={16} />
              </button>
              <span className="zoom-value">{popupZoom}%</span>
              <button 
                className="popup-zoom-btn"
                onClick={() => setPopupZoom(z => Math.min(300, z + 25))}
              >
                <ZoomIn size={16} />
              </button>
              <button 
                className="popup-zoom-btn fit-btn"
                onClick={() => setPopupZoom(100)}
              >
                Fit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
