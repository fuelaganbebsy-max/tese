import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BeamParams } from '../domain/kl/types';
import { defaultBeam, defaultBeamBySubtype } from '../domain/kl/derive';
import type { MemberType } from '../config';

interface ViewState {
  showConcrete: boolean;
  showStirrups: boolean;
  showLongitudinal: boolean;
  showAnnotations: boolean;
  showColumns: boolean;
  showSectionCut: boolean;
  sectionCutX: number;
  showAnnotationTopLeft: boolean;
  showAnnotationTopRight: boolean;
  showAnnotationStirrup: boolean;
  showAnnotationNetSpan: boolean;
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
  loadSubtype: (subtype: MemberType) => void;
}

export const useBeamStore = create<BeamStore>()(persist(
  (set, get) => ({
  params: defaultBeam(),
  view: { showConcrete: true, showStirrups: true, showLongitudinal: true, showAnnotations: true, showColumns: true, showSectionCut: false, sectionCutX: 0.5, showAnnotationTopLeft: true, showAnnotationTopRight: true, showAnnotationStirrup: true, showAnnotationNetSpan: true },
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
  loadSubtype: (subtype) => set((s) => ({
    params: defaultBeamBySubtype(subtype),
    _history: [...s._history, s.params].slice(-MAX_HISTORY),
    _future: [],
  })),
}),
  {
    name: 'rebar-3d-beam',
    version: 9,
    partialize: (state) => ({ params: state.params, view: state.view }),
    migrate: (persisted: any) => {
      try {
        if (persisted && persisted.params) {
          const p = persisted.params;
          delete p.verticalHaunch;
          delete p.horizontalHaunch;
          // v5→v6: add beam-column gap
          if (p.beamColumnGapFront == null) p.beamColumnGapFront = 150;
          if (!p.verticalHaunchLeft) p.verticalHaunchLeft = { enabled: false, depth: 200, length: 800 };
          if (!p.verticalHaunchRight) p.verticalHaunchRight = { enabled: false, depth: 200, length: 800 };
          if (!p.horizontalHaunchLeft) p.horizontalHaunchLeft = { enabled: false, depth: 100, length: 600 };
          if (!p.horizontalHaunchRight) p.horizontalHaunchRight = { enabled: false, depth: 100, length: 600 };
          if (!p.horizontalHaunchFront) p.horizontalHaunchFront = { enabled: false, depth: 100, length: 600 };
          if (!p.horizontalHaunchBack) p.horizontalHaunchBack = { enabled: false, depth: 100, length: 600 };
        }
        // v6→v7: add showSectionCut / sectionCutX to view
        if (persisted && persisted.view) {
          if (persisted.view.showSectionCut == null) persisted.view.showSectionCut = false;
          if (persisted.view.sectionCutX == null) persisted.view.sectionCutX = 0.5;
        }
        // v7→v8: add annotation toggle defaults
        if (persisted && persisted.view) {
          if (persisted.view.showAnnotationTopLeft == null) persisted.view.showAnnotationTopLeft = true;
          if (persisted.view.showAnnotationTopRight == null) persisted.view.showAnnotationTopRight = true;
          if (persisted.view.showAnnotationStirrup == null) persisted.view.showAnnotationStirrup = true;
        }
        // v8→v9: add net span annotation toggle
        if (persisted && persisted.view) {
          if (persisted.view.showAnnotationNetSpan == null) persisted.view.showAnnotationNetSpan = true;
        }
        return persisted;
      } catch {
        // 迁移失败时清除坏数据，使用全新默认值
        return undefined;
      }
    },
  },
));
