import { useEffect } from 'react';
import { BeamScene } from './scene/BeamScene';
import { ParamPanel } from './ui/ParamPanel';
import { TopBar } from './ui/TopBar';
import { SideNav } from './ui/SideNav';
import { ViewportHud } from './ui/ViewportHud';
import { DataPanel } from './ui/DataPanel';
import { useBeamStore } from './store/beamStore';

export default function App() {
  const setUi = useBeamStore((s) => s.setUi);

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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col font-body-md text-body-md bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative w-full">
        <SideNav />
        {/* Middle Column: Canvas & Data */}
        <main className="flex-1 flex flex-col p-gutter gap-gutter overflow-y-auto relative z-10 min-w-[400px] bg-[#121212]">
          {/* 3D Canvas Area */}
          <div className="flex-1 rounded-xl bg-surface-container/50 backdrop-blur-[20px] border border-white/5 relative overflow-hidden flex flex-col shadow-2xl min-h-[300px]" style={{ borderColor: 'rgba(0, 218, 243, 0.1)' }}>
            <BeamScene />
            <ViewportHud />
          </div>
          {/* Lower Section: 2D View & Data Table */}
          <DataPanel />
        </main>
        <ParamPanel />
      </div>
    </div>
  );
}
