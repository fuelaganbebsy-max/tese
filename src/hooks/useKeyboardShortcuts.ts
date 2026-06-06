import { useEffect, useCallback } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import { useMemberStore } from '../store/memberStore';

interface BeamViewKeys {
  showConcrete: boolean;
  showColumns: boolean;
  showLongitudinal: boolean;
  showStirrups: boolean;
}

interface ColumnViewKeys {
  showConcrete: boolean;
  showLongitudinal: boolean;
  showStirrups: boolean;
}

const BEAM_VIEW_TOGGLE: Record<string, keyof BeamViewKeys> = {
  '1': 'showConcrete',
  '2': 'showColumns',
  '3': 'showLongitudinal',
  '4': 'showStirrups',
};

const COLUMN_VIEW_TOGGLE: Record<string, keyof ColumnViewKeys> = {
  '1': 'showConcrete',
  '2': 'showLongitudinal',
  '3': 'showStirrups',
};

/**
 * 通用键盘快捷键 —— 根据当前 activeType 自动操作对应的 store。
 */
export function useKeyboardShortcuts() {
  const activeType = useMemberStore((s) => s.activeType);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isBeam = activeType === 'KL' || activeType === 'L' || activeType === 'WKL' || activeType === 'XL';
      const store = isBeam ? useBeamStore : useColumnStore;

      // Ctrl+Z / Ctrl+Shift+Z — undo / redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if ('undo' in store.getState()) {
          e.shiftKey
            ? (store.getState() as any).redo()
            : (store.getState() as any).undo();
        }
        return;
      }

      // 1-4: toggle view layers
      const viewToggle = isBeam ? BEAM_VIEW_TOGGLE : COLUMN_VIEW_TOGGLE;
      if (viewToggle[e.key]) {
        const k = viewToggle[e.key];
        const current = store.getState().view;
        store.getState().setView({ [k]: !(current as any)[k] });
        return;
      }

      // [ ] toggle sidebar / inspector
      if (e.key === '[') {
        const ui = store.getState().ui;
        store.getState().setUi({ sideNavCollapsed: !ui.sideNavCollapsed });
        return;
      }
      if (e.key === ']') {
        const ui = store.getState().ui;
        store.getState().setUi({ inspectorCollapsed: !ui.inspectorCollapsed });
        return;
      }
    },
    [activeType],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
