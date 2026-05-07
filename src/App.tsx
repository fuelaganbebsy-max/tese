import { BeamScene } from './scene/BeamScene';
import { ParamPanel } from './ui/ParamPanel';
import { DerivedPanel } from './ui/DerivedPanel';

export default function App() {
  return (
    <div className="h-screen w-screen flex bg-slate-950">
      <aside className="w-[340px] shrink-0 border-r border-slate-800 bg-slate-950">
        <ParamPanel />
      </aside>
      <main className="flex-1 relative">
        <BeamScene />
        <div className="absolute top-3 left-3 pointer-events-none">
          <DerivedPanel />
        </div>
        <div className="absolute bottom-3 left-3 text-[11px] text-slate-500">
          鼠标左键旋转 · 右键平移 · 滚轮缩放
        </div>
      </main>
    </div>
  );
}
