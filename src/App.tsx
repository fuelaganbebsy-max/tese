import { useEffect, useState, useCallback } from 'react';
import { PlaceholderScene } from './scene/PlaceholderScene';
import { ParamPanel } from './ui/ParamPanel';
import { TopBar } from './ui/TopBar';
import { SideNav } from './ui/SideNav';
import { ViewportHud } from './ui/ViewportHud';
import { DataPanel } from './ui/DataPanel';
import { ResizeHandle } from './ui/ResizeHandle';
import { useBeamStore } from './store/beamStore';
import { useColumnStore } from './store/columnStore';
import { useMemberStore } from './store/memberStore';
import { MEMBER_TYPES, getMemberEntry } from './memberRegistry';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const MEMBERS_WITH_UI = MEMBER_TYPES;

const SIDE_MIN = 56;
const SIDE_MAX = 360;
const RIGHT_MIN = 200;
const RIGHT_MAX = 600;
const DATA_MIN = 80;

export default function App() {
  useKeyboardShortcuts();

  const [sideW, setSideW] = useState(240);
  const [rightW, setRightW] = useState(340);
  const [dataH, setDataH] = useState(220);

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
      if (w < 1100) setSideW(56);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const collapsed = useBeamStore((s) => s.ui.sideNavCollapsed);

  const handleSideResize = useCallback((delta: number) => {
    setSideW((w) => Math.min(SIDE_MAX, Math.max(SIDE_MIN, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightW((w) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w - delta)));
  }, []);

  const handleDataResize = useCallback((delta: number) => {
    setDataH((h) => Math.max(DATA_MIN, h - delta));
  }, []);

  const activeType = useMemberStore((s) => s.activeType);
  const hasUi = MEMBERS_WITH_UI.includes(activeType);

  const renderScene = () => {
    const entry = getMemberEntry(activeType);
    if (!entry) return <PlaceholderScene type={activeType} />;
    const SceneComp = entry.sceneComponent;
    return <SceneComp />;
  };

  const effectiveSideW = collapsed ? 56 : sideW;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col font-body-md text-body-md bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative w-full">
        {/* Left: SideNav */}
        <div className="shrink-0 h-full" style={{ width: effectiveSideW }}>
          <SideNav />
        </div>
        <ResizeHandle direction="horizontal" onResize={handleSideResize} />

        {/* Middle Column: Canvas & Data */}
        <main className="flex-1 flex flex-col p-gutter gap-0 overflow-hidden relative z-10 min-w-[300px] bg-[#121212]">
          {/* 3D Canvas Area */}
          <div className="flex-1 rounded-xl bg-surface-container/50 backdrop-blur-[20px] border border-white/5 relative overflow-hidden flex flex-col shadow-2xl min-h-[200px]" style={{ borderColor: 'rgba(0, 218, 243, 0.1)' }}>
            {renderScene()}
            {hasUi && <ViewportHud />}
          </div>

          {/* Vertical resize handle + Data panel */}
          {hasUi && (
            <>
              <ResizeHandle direction="vertical" onResize={handleDataResize} />
              <div className="shrink-0 overflow-hidden" style={{ height: dataH }}>
                <DataPanel />
              </div>
            </>
          )}
        </main>

        {/* Right: ParamPanel */}
        {hasUi && (
          <>
            <ResizeHandle direction="horizontal" onResize={handleRightResize} />
            <div className="shrink-0 h-full overflow-y-auto" style={{ width: rightW }}>
              <ParamPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
