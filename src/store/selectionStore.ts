import { create } from 'zustand';
import type { CutShape } from '../domain/rebarShape';

interface SelectionState {
  /** 当前点选钢筋的下料形状；null 表示未选中 */
  selected: CutShape | null;
  /** 选中标识，用于 3D 高亮（memberType + 唯一 key） */
  selectedKey: string | null;
  select: (shape: CutShape, key: string) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selected: null,
  selectedKey: null,
  select: (shape, key) => set({ selected: shape, selectedKey: key }),
  clear: () => set({ selected: null, selectedKey: null }),
}));
