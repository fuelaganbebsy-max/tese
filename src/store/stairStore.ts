import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StairParams } from '../domain/at/types';
import { defaultStair, normalizeStairParams } from '../domain/at/derive';

interface ViewState {
  showConcrete: boolean;
  showRebar: boolean;
  showAnnotations: boolean;
  showSectionCut: boolean;
  sectionCutX: number;
}

interface UiState {
  sideNavCollapsed: boolean;
  inspectorCollapsed: boolean;
  dataPanelCollapsed: boolean;
}

type CameraCommand = 'reset' | null;
const MAX_HISTORY = 20;

interface StairStore {
  params: StairParams;
  view: ViewState;
  ui: UiState;
  cameraCommand: CameraCommand;
  _history: StairParams[];
  _future: StairParams[];
  setParams: (updater: (p: StairParams) => StairParams) => void;
  setView: (patch: Partial<ViewState>) => void;
  setUi: (patch: Partial<UiState>) => void;
  setCameraCommand: (cmd: CameraCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}

export const useStairStore = create<StairStore>()(persist(
  (set, get) => ({
    params: defaultStair(),
    view: { showConcrete: true, showRebar: true, showAnnotations: true, showSectionCut: false, sectionCutX: 0.5 },
    ui: { sideNavCollapsed: false, inspectorCollapsed: false, dataPanelCollapsed: false },
    cameraCommand: null,
    _history: [],
    _future: [],
    setParams: (updater) => set((s) => {
      const newHistory = [...s._history, s.params].slice(-MAX_HISTORY);
      return { params: normalizeStairParams(updater(s.params)), _history: newHistory, _future: [] };
    }),
    setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
    setUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
    setCameraCommand: (cmd) => set({ cameraCommand: cmd }),
    undo: () => set((s) => {
      if (s._history.length === 0) return s;
      const prev = s._history[s._history.length - 1];
      return {
        params: prev,
        _history: s._history.slice(0, -1),
        _future: [s.params, ...s._future].slice(0, MAX_HISTORY),
      };
    }),
    redo: () => set((s) => {
      if (s._future.length === 0) return s;
      const next = s._future[0];
      return {
        params: next,
        _history: [...s._history, s.params].slice(-MAX_HISTORY),
        _future: s._future.slice(1),
      };
    }),
    canUndo: () => get()._history.length > 0,
    canRedo: () => get()._future.length > 0,
    reset: () => set((s) => ({
      params: defaultStair(),
      _history: [...s._history, s.params].slice(-MAX_HISTORY),
      _future: [],
    })),
  }),
  {
    name: 'rebar-3d-stair',
    version: 1,
    partialize: (state) => ({ params: state.params, view: state.view }),
    migrate: (persisted: any) => {
      try {
        if (persisted?.view) {
          persisted.view.showSectionCut = persisted.view.showSectionCut ?? false;
          persisted.view.sectionCutX = persisted.view.sectionCutX ?? 0.5;
        }
        if (persisted?.params) {
          persisted.params = normalizeStairParams(persisted.params);
        }
        return persisted;
      } catch {
        return undefined;
      }
    },
  },
));
