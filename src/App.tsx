import { useEffect, useCallback } from 'react';
import { BeamScene } from './scene/BeamScene';
import { ColumnScene } from './scene/ColumnScene';
import { PlaceholderScene } from './scene/PlaceholderScene';
import { ParamPanel } from './ui/ParamPanel';
import { TopBar } from './ui/TopBar';
import { SideNav } from './ui/SideNav';
import { ViewportHud } from './ui/ViewportHud';
import { DataPanel } from './ui/DataPanel';
import { useBeamStore } from './store/beamStore';
import { useMemberStore } from './store/memberStore';

export default function App() {
  const setUi = useBeamStore((s) => s.setUi);
  const undo = useBeamStore((s) => s.undo);
  const redo = useBeamStore((s) => s.redo);
  const setView = useBeamStore((s) => s.setView);

  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      setUi({
        sideNavCollapsed: w < 1100,
        dataPanelCollapsed: w < 900,
        inspectorCollapsed: w < 760,
      });
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [setUi]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Ctrl+Z / Ctrl+Shift+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    // 1-4: toggle view layers
    const viewKeys: Record<string, string> = {
      '1': 'showConcrete', '2': 'showColumns', '3': 'showLongitudinal', '4': 'showStirrups',
    };
    if (viewKeys[e.key]) {
      const k = viewKeys[e.key];
      const current = useBeamStore.getState().view;
      setView({ [k]: !(current as unknown as Record<string, boolean>)[k] });
      return;
    }
    // [ ] toggle sidebar
    if (e.key === '[') {
      const ui = useBeamStore.getState().ui;
      setUi({ sideNavCollapsed: !ui.sideNavCollapsed });
    }
    if (e.key === ']') {
      const ui = useBeamStore.getState().ui;
      setUi({ inspectorCollapsed: !ui.inspectorCollapsed });
    }
  }, [undo, redo, setView, setUi]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const activeType = useMemberStore((s) => s.activeType);

  const renderScene = () => {
    switch (activeType) {
      case 'KL': return <BeamScene />;
      case 'KZ': return <ColumnScene />;
      default: return <PlaceholderScene type={activeType} />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col font-body-md text-body-md bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative w-full">
        <SideNav />
        {/* Middle Column: Canvas & Data */}
        <main className="flex-1 flex flex-col p-gutter gap-gutter overflow-y-auto relative z-10 min-w-[400px] bg-[#121212]">
          {/* 3D Canvas Area */}
          <div className="flex-1 rounded-xl bg-surface-container/50 backdrop-blur-[20px] border border-white/5 relative overflow-hidden flex flex-col shadow-2xl min-h-[300px]" style={{ borderColor: 'rgba(0, 218, 243, 0.1)' }}>
            {renderScene()}
            {(activeType === 'KL') && <ViewportHud />}
          </div>
          {/* Lower Section: 2D View & Data Table */}
          {(activeType === 'KL') && <DataPanel />}
        </main>
        {(activeType === 'KL') && <ParamPanel />}
      </div>
    </div>
  );
}
