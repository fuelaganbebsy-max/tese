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

interface StairPersistedState {
  params: StairParams;
  view: ViewState;
}

interface UiState {
  sideNavCollapsed: boolean;
  inspectorCollapsed: boolean;
  dataPanelCollapsed: boolean;
}

type CameraCommand = 'reset' | null;
const MAX_HISTORY = 20;

const defaultStairView = (): ViewState => ({
  showConcrete: true,
  showRebar: true,
  showAnnotations: true,
  showSectionCut: false,
  sectionCutX: 0.5,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isUsableStairParams(params: StairParams): boolean {
  const validBeam = (beam: StairParams['lowBeam']) => (
    isFinitePositive(beam.width)
    && isFinitePositive(beam.height)
    && isFinitePositive(beam.length)
  );
  const validRebar = (rebar: StairParams['bottomBar']) => (
    ['HPB300', 'HRB400', 'HRB500'].includes(rebar.grade)
    && isFinitePositive(rebar.diameter)
    && isFinitePositive(rebar.spacing)
  );

  return [params.ln, params.Hs, params.h, params.b, params.cover].every(isFinitePositive)
    && Number.isInteger(params.stepCount)
    && params.stepCount >= 2
    && ['C25', 'C30', 'C35', 'C40', 'C45', 'C50'].includes(params.concrete)
    && [1, 2, 3, 4].includes(params.seismic)
    && validBeam(params.lowBeam)
    && validBeam(params.highBeam)
    && validRebar(params.bottomBar)
    && validRebar(params.topBar)
    && validRebar(params.distributionBar)
    && (params.topExtend === undefined || (
      typeof params.topExtend === 'number'
      && Number.isFinite(params.topExtend)
      && params.topExtend >= 0
    ))
    && (params.topAnchorMode === undefined || ['hinge', 'full'].includes(params.topAnchorMode));
}

function normalizeStairView(input: unknown): ViewState {
  const defaults = defaultStairView();
  const view = isRecord(input) ? input : {};
  const booleanValue = (key: keyof Pick<ViewState, 'showConcrete' | 'showRebar' | 'showAnnotations' | 'showSectionCut'>) => (
    typeof view[key] === 'boolean' ? view[key] as boolean : defaults[key]
  );
  const sectionCutX = typeof view.sectionCutX === 'number'
    && Number.isFinite(view.sectionCutX)
    && view.sectionCutX >= 0
    && view.sectionCutX <= 1
    ? view.sectionCutX
    : defaults.sectionCutX;

  return {
    showConcrete: booleanValue('showConcrete'),
    showRebar: booleanValue('showRebar'),
    showAnnotations: booleanValue('showAnnotations'),
    showSectionCut: booleanValue('showSectionCut'),
    sectionCutX,
  };
}

export function migrateStairPersistedState(persisted: unknown, _version: number): StairPersistedState {
  try {
    const state = isRecord(persisted) ? persisted : {};
    const normalizedParams = normalizeStairParams(state.params);
    return {
      params: isUsableStairParams(normalizedParams) ? normalizedParams : defaultStair(),
      view: normalizeStairView(state.view),
    };
  } catch {
    return { params: defaultStair(), view: defaultStairView() };
  }
}

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
    view: defaultStairView(),
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
    version: 2,
    partialize: (state) => ({ params: state.params, view: state.view }),
    migrate: migrateStairPersistedState,
  },
));
