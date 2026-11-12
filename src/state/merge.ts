import { createId, moveItem } from '../lib/utils';

export interface MergeItem {
  uid: string;
  fileId: string;
  pageNum: number;
  rotation: number;
}

export type MergeAction =
  | { type: 'toggle'; fileId: string; pageNum: number }
  | { type: 'addFile'; fileId: string; pageCount: number }
  | { type: 'clearFile'; fileId: string }
  | { type: 'remove'; uid: string }
  | { type: 'rotate'; uid: string; angle: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'clear' };

const same = (item: MergeItem, fileId: string, pageNum: number) =>
  item.fileId === fileId && item.pageNum === pageNum;

export function mergeReducer(queue: MergeItem[], action: MergeAction): MergeItem[] {
  switch (action.type) {
    case 'toggle':
      return queue.some(i => same(i, action.fileId, action.pageNum))
        ? queue.filter(i => !same(i, action.fileId, action.pageNum))
        : [...queue, { uid: createId(), fileId: action.fileId, pageNum: action.pageNum, rotation: 0 }];
    case 'addFile': {
      const present = new Set(queue.filter(i => i.fileId === action.fileId).map(i => i.pageNum));
      const added: MergeItem[] = [];
      for (let p = 1; p <= action.pageCount; p++) {
        if (!present.has(p)) added.push({ uid: createId(), fileId: action.fileId, pageNum: p, rotation: 0 });
      }
      return added.length ? [...queue, ...added] : queue;
    }
    case 'clearFile':
      return queue.filter(i => i.fileId !== action.fileId);
    case 'remove':
      return queue.filter(i => i.uid !== action.uid);
    case 'rotate':
      return queue.map(i =>
        i.uid === action.uid ? { ...i, rotation: (i.rotation + action.angle + 360) % 360 } : i,
      );
    case 'move':
      return moveItem(queue, action.from, action.to);
    case 'clear':
      return [];
  }
}
