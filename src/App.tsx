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
    <div className="h-screen w-screen overflow-hidden flex flex-col text-[13px] surface-0">
      <TopBar />
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]">
        <SideNav />
        <main className="flex-1 flex flex-col min-w-0 z-10 surface-0">
          <div className="flex-1 relative flex flex-col border-b divider min-h-0 viewport-bg">
            <BeamScene />
            <ViewportHud />
          </div>
          <DataPanel />
        </main>
        <ParamPanel />
      </div>
    </div>
  );
}
