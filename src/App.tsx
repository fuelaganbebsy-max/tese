import { useEffect } from 'react';
import { PlaceholderScene } from './scene/PlaceholderScene';
import { ParamPanel } from './ui/ParamPanel';
import { TopBar } from './ui/TopBar';
import { SideNav } from './ui/SideNav';
import { ViewportHud } from './ui/ViewportHud';
import { DataPanel } from './ui/DataPanel';
import { useBeamStore } from './store/beamStore';
import { useColumnStore } from './store/columnStore';
import { useMemberStore } from './store/memberStore';
import { MEMBER_TYPES, getMemberEntry } from './memberRegistry';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const MEMBERS_WITH_UI = MEMBER_TYPES;

export default function App() {
  useKeyboardShortcuts();

  // Responsive initial layout — apply to both stores
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      const patch = {
        sideNavCollapsed: w < 1100,
        dataPanelCollapsed: w < 900,
        inspectorCollapsed: w < 760,
      };
      useBeamStore.getState().setUi(patch);
      useColumnStore.getState().setUi(patch);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const activeType = useMemberStore((s) => s.activeType);
  const hasUi = MEMBERS_WITH_UI.includes(activeType);

  const renderScene = () => {
    const entry = getMemberEntry(activeType);
    if (!entry) return <PlaceholderScene type={activeType} />;
    const SceneComp = entry.sceneComponent;
    return <SceneComp />;
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
            {hasUi && <ViewportHud />}
          </div>
          {/* Lower Section: 2D View & Data Table */}
          {hasUi && <DataPanel />}
        </main>
        {hasUi && <ParamPanel />}
      </div>
    </div>
  );
}
