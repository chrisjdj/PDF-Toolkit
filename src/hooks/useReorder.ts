import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from 'react';

const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE_PX = 10;
const INDEX_ATTR = 'data-reorder-index';

/**
 * Reordering for a list/grid of items:
 *  - mouse: HTML5 drag and drop
 *  - touch: long-press to pick up, drag, release (normal swipes still scroll)
 *  - keyboard: Alt + Arrow keys on a focused item
 */
export function useReorder(containerRef: RefObject<HTMLElement | null>, onMove: (from: number, to: number) => void) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  });

  const reset = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  // Touch: native listeners so touchmove can be non-passive (needed to preventDefault while dragging).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timer: number | undefined;
    let start: { index: number; x: number; y: number } | null = null;
    let armed = false;
    let over: number | null = null;
    let suppressClickUntil = 0;

    const indexAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest(`[${INDEX_ATTR}]`);
      if (!el || !container.contains(el)) return null;
      return Number(el.getAttribute(INDEX_ATTR));
    };

    const cancel = () => {
      window.clearTimeout(timer);
      start = null;
      armed = false;
      over = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return cancel();
      const target = e.target as Element;
      if (target.closest('button, input, label, a')) return;
      const item = target.closest(`[${INDEX_ATTR}]`);
      if (!item) return;
      const t = e.touches[0];
      start = { index: Number(item.getAttribute(INDEX_ATTR)), x: t.clientX, y: t.clientY };
      timer = window.setTimeout(() => {
        if (!start) return;
        armed = true;
        over = start.index;
        navigator.vibrate?.(20);
        setDraggedIndex(start.index);
        setOverIndex(start.index);
      }, LONG_PRESS_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      if (!armed) {
        if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > MOVE_TOLERANCE_PX) cancel(); // it's a scroll
        return;
      }
      e.preventDefault();
      const idx = indexAt(t.clientX, t.clientY);
      if (idx !== null && idx !== over) {
        over = idx;
        setOverIndex(idx);
      }
    };

    const onTouchEnd = () => {
      if (armed && start) {
        if (over !== null && over !== start.index) onMoveRef.current(start.index, over);
        suppressClickUntil = Date.now() + 400;
        setDraggedIndex(null);
        setOverIndex(null);
      }
      cancel();
    };

    const onClickCapture = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onContextMenu = (e: Event) => {
      if (start) e.preventDefault(); // long-press shouldn't open the context menu
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    container.addEventListener('click', onClickCapture, true);
    container.addEventListener('contextmenu', onContextMenu);
    return () => {
      cancel();
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      container.removeEventListener('click', onClickCapture, true);
      container.removeEventListener('contextmenu', onContextMenu);
    };
  }, [containerRef]);

  const getItemProps = (index: number, count: number) => ({
    [INDEX_ATTR]: index,
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    onDragOver: (e: DragEvent) => {
      if (draggedIndex === null) return; // let OS file drops bubble up
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overIndex !== index) setOverIndex(index);
    },
    onDrop: (e: DragEvent) => {
      if (draggedIndex === null) return;
      e.preventDefault();
      e.stopPropagation();
      if (draggedIndex !== index) onMove(draggedIndex, index);
      reset();
    },
    onDragEnd: reset,
    onKeyDown: (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
      if (!delta) return;
      const to = index + delta;
      if (to < 0 || to >= count) return;
      e.preventDefault();
      onMove(index, to);
    },
  });

  return { draggedIndex, overIndex, getItemProps };
}
