import { create } from 'zustand';
import type { BeamParams } from '../domain/kl/types';
import { defaultBeam } from '../domain/kl/derive';

interface ViewState {
  showConcrete: boolean;
  showStirrups: boolean;
  showLongitudinal: boolean;
  showAnnotations: boolean;
  showColumns: boolean;
}

interface BeamStore {
  params: BeamParams;
  view: ViewState;
  setParams: (updater: (p: BeamParams) => BeamParams) => void;
  setView: (patch: Partial<ViewState>) => void;
  reset: () => void;
}

export const useBeamStore = create<BeamStore>((set) => ({
  params: defaultBeam(),
  view: { showConcrete: true, showStirrups: true, showLongitudinal: true, showAnnotations: true, showColumns: true },
  setParams: (updater) => set((s) => ({ params: updater(s.params) })),
  setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
  reset: () => set({ params: defaultBeam() }),
}));
