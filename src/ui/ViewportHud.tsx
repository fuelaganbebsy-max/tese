import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';

export function ViewportHud() {
  const params = useBeamStore((s) => s.params);
  const view = useBeamStore((s) => s.view);
  const setView = useBeamStore((s) => s.setView);
  const d = useMemo(() => derive(params), [params]);

  const stirrupCount = d.spans.reduce((s, sp) => s + sp.stirrupXs.length, 0);

  return (
    <>
      {/* Top overlays */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none z-20 gap-3">
        <div className="glass-panel rounded-md px-3 py-2 pointer-events-auto flex gap-4 min-w-0 overflow-hidden">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] tracking-widest text-white/40 mb-0.5">当前梁</span>
            <span className="font-mono text-[11px] text-primary truncate">
              KL-1({params.spans.length}) {params.b}×{params.h}
            </span>
          </div>
          <div className="hidden md:flex w-px bg-white/10" />
          <div className="hidden md:flex flex-col">
            <span className="text-[10px] tracking-widest text-white/40 mb-0.5">混凝土</span>
            <span className="font-mono text-[11px] text-white/80">
              {params.concrete} · {['一', '二', '三', '四'][params.seismic - 1]}级
            </span>
          </div>
          <div className="hidden lg:flex w-px bg-white/10" />
          <div className="hidden lg:flex flex-col">
            <span className="text-[10px] tracking-widest text-white/40 mb-0.5">梁全长</span>
            <span className="font-mono text-[11px] text-white/80">
              {(d.totalLength / 1000).toFixed(3)} m
            </span>
          </div>
        </div>

        {/* View toggles */}
        <div className="glass-panel rounded-md flex pointer-events-auto overflow-hidden">
          {([
            ['showConcrete', 'deployed_code', '混凝土'],
            ['showColumns', 'view_column', '柱'],
            ['showLongitudinal', 'horizontal_rule', '纵筋'],
            ['showStirrups', 'grid_4x4', '箍筋'],
          ] as const).map(([k, icon, label], i, arr) => (
            <button
              key={k}
              title={label}
              onClick={() => setView({ [k]: !view[k] } as any)}
              className={[
                'w-9 h-9 flex items-center justify-center transition-colors',
                i < arr.length - 1 ? 'border-r border-white/5' : '',
                view[k]
                  ? 'text-primary bg-primary/10'
                  : 'text-white/40 hover:text-primary hover:bg-white/5',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between gap-3 pointer-events-none">
        <div className="glass-panel rounded-md px-3 py-1.5 pointer-events-auto flex items-center gap-3 font-mono text-[10px]">
          <span className="material-symbols-outlined text-white/30 text-[12px]">360</span>
          <span className="text-white/60">b{params.b}</span>
          <span className="text-white/60">h{params.h}</span>
          <span className="text-primary">c{params.cover}</span>
        </div>

        <div className="hidden md:flex glass-panel rounded-md px-3 py-1.5 pointer-events-auto items-center gap-3 font-mono text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          <span className="tracking-widest text-white/40">锚固 laE</span>
          <span className="text-primary">{d.topAnchor.laE.toFixed(0)}</span>
          <span className="text-white/10">|</span>
          <span className="tracking-widest text-white/40">加密区</span>
          <span className="text-primary">{d.densifiedZoneLen.toFixed(0)}</span>
          <span className="text-white/10">|</span>
          <span className="tracking-widest text-white/40">箍筋数</span>
          <span className="text-primary">{stirrupCount}</span>
        </div>

        <div className="hidden xl:block text-[10px] text-white/30 text-right leading-relaxed">
          左键旋转 · 右键平移 · 滚轮缩放
        </div>
      </div>
    </>
  );
}
