import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import { useMemberStore } from '../store/memberStore';
import { derive } from '../domain/kl/derive';
import { deriveColumn } from '../domain/kz/derive';

export function ViewportHud() {
  const activeType = useMemberStore((s) => s.activeType);
  const isBeam = activeType === 'KL' || activeType === 'L' || activeType === 'WKL' || activeType === 'XL';

  const beamParams = useBeamStore((s) => s.params);
  const beamView = useBeamStore((s) => s.view);
  const beamSetView = useBeamStore((s) => s.setView);
  const beamSetCamera = useBeamStore((s) => s.setCameraCommand);
  const beamD = useMemo(() => derive(beamParams), [beamParams]);

  const colParams = useColumnStore((s) => s.params);
  const colView = useColumnStore((s) => s.view);
  const colSetView = useColumnStore((s) => s.setView);
  const colSetCamera = useColumnStore((s) => s.setCameraCommand);
  const colD = useMemo(() => deriveColumn(colParams), [colParams]);

  const view = isBeam ? beamView : colView;
  const setView = isBeam ? beamSetView : colSetView;
  const setCameraCommand = isBeam ? beamSetCamera : colSetCamera;

  const stirrupCount = isBeam
    ? beamD.spans.reduce((s, sp) => s + sp.stirrupXs.length, 0)
    : colD.stirrupYs.length;

  const dimLabel = isBeam
    ? `${beamParams.b}\u00d7${beamParams.h}`
    : colParams.sectionType === 'circle'
      ? `\u2205${colParams.D}`
      : `${colParams.b}\u00d7${colParams.h}`;

  return (
    <>
      {/* Viewport HUD Header */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
        {/* Left: Status badge */}
        <div className="pointer-events-auto flex items-center gap-2 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1.5 rounded-DEFAULT border border-white/10">
          <span className="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse" />
          <span className="font-label-numeric text-label-numeric text-on-surface text-[11px] font-mono">
            {isBeam ? `${activeType}-1(${beamParams.spans.length}) ${dimLabel} 渲染中` : `KZ-1 ${dimLabel} 渲染中`}
          </span>
        </div>

        {/* Right: View buttons */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            onClick={() => setCameraCommand('top')}
            className="w-8 h-8 rounded-DEFAULT bg-surface-container-highest/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-on-surface hover:text-primary-fixed-dim transition-colors active:scale-95"
            title="Top View"
          >
            <span className="font-label-numeric text-label-numeric text-[10px] font-bold font-mono">TOP</span>
          </button>
          <button
            onClick={() => setCameraCommand('reset')}
            className="w-8 h-8 rounded-DEFAULT bg-surface-container-highest/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-on-surface hover:text-primary-fixed-dim transition-colors active:scale-95"
            title="Reset Camera"
          >
            <span className="material-symbols-outlined text-[16px]">videocam</span>
          </button>
          {/* View toggles */}
          {([
            ['showConcrete', 'deployed_code', '混凝土'],
            ['showColumns', 'view_column', '柱'],
            ['showLongitudinal', 'horizontal_rule', '纵筋'],
            ['showStirrups', 'grid_4x4', '箍筋'],
          ] as const).map(([k, icon, label]) => (
            <button
              key={k}
              title={label}
              onClick={() => setView({ [k]: !view[k] } as any)}
              className={`w-8 h-8 rounded-DEFAULT backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors ${
                view[k]
                  ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim'
                  : 'bg-surface-container-highest/80 text-on-surface-variant hover:text-primary-fixed-dim'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Viewport Bottom HUD */}
      <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex justify-between items-end z-10">
        <div className="pointer-events-auto flex gap-2">
          <span className="px-2 py-1 rounded bg-surface-container-highest/90 border border-white/5 font-label-numeric text-label-numeric text-primary-fixed-dim text-[10px] font-mono">
            LOD: High
          </span>
          <span className="px-2 py-1 rounded bg-surface-container-highest/90 border border-white/5 font-label-numeric text-label-numeric text-on-surface-variant text-[10px] font-mono">
            箍筋: {stirrupCount}
          </span>
          {isBeam && (
            <span className="hidden md:inline-block px-2 py-1 rounded bg-surface-container-highest/90 border border-white/5 font-label-numeric text-label-numeric text-on-surface-variant text-[10px] font-mono">
              laE: {beamD.topAnchor.laE.toFixed(0)}
            </span>
          )}
        </div>

        <div className="hidden xl:block text-[10px] text-on-surface-variant/50 text-right leading-relaxed pointer-events-auto">
          左键旋转 · 右键平移 · 滚轮缩放
        </div>
      </div>
    </>
  );
}
