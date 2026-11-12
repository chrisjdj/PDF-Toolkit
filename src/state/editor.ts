import { moveItem } from '../lib/utils';

/** Page edits for one file. Page numbers are the original 1-based numbers. */
export interface EditorState {
  order: number[];
  deleted: Set<number>;
  rotations: Map<number, number>;
  selected: Set<number>;
}

export type EditorAction =
  | { type: 'init'; fileId: string; pageCount: number }
  | { type: 'remove'; fileId: string }
  | { type: 'reset'; fileId: string }
  | { type: 'move'; fileId: string; from: number; to: number }
  | { type: 'toggleDelete'; fileId: string; pageNum: number }
  | { type: 'rotate'; fileId: string; pageNum: number; angle: number }
  | { type: 'toggleSelect'; fileId: string; pageNum: number }
  | { type: 'selectAll'; fileId: string }
  | { type: 'clearSelection'; fileId: string };

export type EditorStates = Record<string, EditorState>;

export function initialEditorState(pageCount: number): EditorState {
  return {
    order: Array.from({ length: pageCount }, (_, i) => i + 1),
    deleted: new Set(),
    rotations: new Map(),
    selected: new Set(),
  };
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function editorReducer(states: EditorStates, action: EditorAction): EditorStates {
  if (action.type === 'init') {
    return { ...states, [action.fileId]: initialEditorState(action.pageCount) };
  }
  if (action.type === 'remove') {
    const next = { ...states };
    delete next[action.fileId];
    return next;
  }

  const s = states[action.fileId];
  if (!s) return states;
  let updated: EditorState;

  switch (action.type) {
    case 'reset':
      updated = initialEditorState(s.order.length);
      break;
    case 'move':
      updated = { ...s, order: moveItem(s.order, action.from, action.to) };
      break;
    case 'toggleDelete': {
      const selected = new Set(s.selected);
      selected.delete(action.pageNum);
      updated = { ...s, deleted: toggle(s.deleted, action.pageNum), selected };
      break;
    }
    case 'rotate': {
      const rotations = new Map(s.rotations);
      const angle = ((rotations.get(action.pageNum) ?? 0) + action.angle + 360) % 360;
      if (angle === 0) rotations.delete(action.pageNum);
      else rotations.set(action.pageNum, angle);
      updated = { ...s, rotations };
      break;
    }
    case 'toggleSelect':
      if (s.deleted.has(action.pageNum)) return states;
      updated = { ...s, selected: toggle(s.selected, action.pageNum) };
      break;
    case 'selectAll':
      updated = { ...s, selected: new Set(s.order.filter(p => !s.deleted.has(p))) };
      break;
    case 'clearSelection':
      updated = { ...s, selected: new Set() };
      break;
  }
  return { ...states, [action.fileId]: updated };
}

export function isDirty(s: EditorState): boolean {
  return s.deleted.size > 0 || s.rotations.size > 0 || s.order.some((p, i) => p !== i + 1);
}

/** Pages in display order, excluding deleted ones. */
export function visiblePages(s: EditorState): number[] {
  return s.order.filter(p => !s.deleted.has(p));
}

/** Selected pages (display order) if anything is selected, otherwise all visible pages. */
export function pagesForExport(s: EditorState): number[] {
  const visible = visiblePages(s);
  return s.selected.size > 0 ? visible.filter(p => s.selected.has(p)) : visible;
}
