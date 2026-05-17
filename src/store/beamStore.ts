import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BeamParams } from '../domain/kl/types';
import { defaultBeam } from '../domain/kl/derive';

interface ViewState {
  showConcrete: boolean;
  showStirrups: boolean;
  showLongitudinal: boolean;
  showAnnotations: boolean;
  showColumns: boolean;
}

interface UiState {
  sideNavCollapsed: boolean;
  inspectorCollapsed: boolean;
  dataPanelCollapsed: boolean;
}

type CameraCommand = 'top' | 'reset' | null;
const MAX_HISTORY = 20;

interface BeamStore {
  params: BeamParams;
  view: ViewState;
  ui: UiState;
  cameraCommand: CameraCommand;
  _history: BeamParams[];
  _future: BeamParams[];
  setParams: (updater: (p: BeamParams) => BeamParams) => void;
  setView: (patch: Partial<ViewState>) => void;
  setUi: (patch: Partial<UiState>) => void;
  setCameraCommand: (cmd: CameraCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}

export const useBeamStore = create<BeamStore>()(persist(
  (set, get) => ({
  params: defaultBeam(),
  view: { showConcrete: true, showStirrups: true, showLongitudinal: true, showAnnotations: true, showColumns: true },
  ui: { sideNavCollapsed: false, inspectorCollapsed: false, dataPanelCollapsed: false },
  cameraCommand: null,
  _history: [],
  _future: [],
  setParams: (updater) => set((s) => {
    const newHistory = [...s._history, s.params].slice(-MAX_HISTORY);
    return { params: updater(s.params), _history: newHistory, _future: [] };
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
    params: defaultBeam(),
    _history: [...s._history, s.params].slice(-MAX_HISTORY),
    _future: [],
  })),
}),
  {
    name: 'rebar-3d-beam',
    version: 1,
    partialize: (state) => ({ params: state.params, view: state.view }),
  },
));
