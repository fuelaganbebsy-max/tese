import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import { useStairStore } from '../store/stairStore';
import { useMemberStore } from '../store/memberStore';
import { derive } from '../domain/kl/derive';
import { deriveColumn } from '../domain/kz/derive';
import { deriveStair } from '../domain/at/derive';

export function ViewportHud() {
  const activeType = useMemberStore((s) => s.activeType);
  const isBeam = activeType === 'KL' || activeType === 'L' || activeType === 'WKL' || activeType === 'XL';
  const isStair = activeType.startsWith('A') || activeType.startsWith('B') || activeType.startsWith('C') || activeType.startsWith('D') || activeType.startsWith('E') || activeType.startsWith('F') || activeType.startsWith('G');

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

  const stairParams = useStairStore((s) => s.params);
  const stairView = useStairStore((s) => s.view);
  const stairSetView = useStairStore((s) => s.setView);
  const stairSetCamera = useStairStore((s) => s.setCameraCommand);
  const stairD = useMemo(() => deriveStair(stairParams), [stairParams]);

  const view = isBeam ? beamView : isStair ? stairView : colView;
  const setView = isBeam ? beamSetView : isStair ? stairSetView : colSetView;
  const setCameraCommand = isBeam ? beamSetCamera : isStair ? stairSetCamera : colSetCamera;

  const stirrupCount = isBeam
    ? beamD.spans.reduce((s, sp) => s + sp.stirrupXs.length, 0)
    : isStair
    ? stairD.totalBarCount
    : colD.stirrupYs.length;

  const dimLabel = isBeam
    ? `${beamParams.b}\u00d7${beamParams.h}`
    : isStair
    ? `${stairParams.ln}x${stairParams.Hs}`
    : `${colParams.b}\u00d7${colParams.h}`;
  const layerToggles = isBeam
    ? ([
      ['showConcrete', 'deployed_code', '混凝土'],
      ['showColumns', 'view_column', '柱'],
      ['showLongitudinal', 'horizontal_rule', '纵筋'],
      ['showStirrups', 'grid_4x4', '箍筋'],
    ] as const)
    : isStair
    ? ([
      ['showConcrete', 'deployed_code', '混凝土'],
      ['showRebar', 'horizontal_rule', '钢筋'],
      ['showAnnotations', 'title', '标注'],
    ] as const)
    : ([
      ['showConcrete', 'deployed_code', '混凝土'],
      ['showLongitudinal', 'horizontal_rule', '纵筋'],
      ['showStirrups', 'grid_4x4', '箍筋'],
    ] as const);

  return (
    <>
      {/* Viewport HUD Header */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
        {/* Left: Status badge */}
        <div className="pointer-events-auto flex items-center gap-2 bg-surface-container-highest/80 backdrop-blur-md px-3 py-1.5 rounded-DEFAULT border border-white/10">
          <span className="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse" />
          <span className="font-label-numeric text-label-numeric text-on-surface text-[11px] font-mono">
            {isBeam ? `${activeType}-1(${beamParams.spans.length}) ${dimLabel} 渲染中` : isStair ? `${activeType}-1 ${dimLabel} 渲染中` : `KZ-1 ${dimLabel} 渲染中`}
          </span>
        </div>

        {/* Right: View buttons */}
        <div className="pointer-events-auto flex flex-col gap-2">
          {!isStair && (
            <button
              onClick={() => (isBeam ? beamSetCamera : colSetCamera)('top')}
              className="w-8 h-8 rounded-DEFAULT bg-surface-container-highest/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-on-surface hover:text-primary-fixed-dim transition-colors active:scale-95"
              title="Top View"
            >
              <span className="font-label-numeric text-label-numeric text-[10px] font-bold font-mono">TOP</span>
            </button>
          )}
          <button
            onClick={() => setCameraCommand('reset')}
            className="w-8 h-8 rounded-DEFAULT bg-surface-container-highest/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-on-surface hover:text-primary-fixed-dim transition-colors active:scale-95"
            title="Reset Camera"
          >
            <span className="material-symbols-outlined text-[16px]">videocam</span>
          </button>
          {/* View toggles */}
          {layerToggles.map(([k, icon, label]) => (
            <button
              key={k}
              title={label}
              onClick={() => setView({ [k]: !(view as any)[k] } as any)}
              className={`w-8 h-8 rounded-DEFAULT backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors ${
                (view as any)[k]
                  ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim'
                  : 'bg-surface-container-highest/80 text-on-surface-variant hover:text-primary-fixed-dim'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Section Cut Slider */}
      {isBeam && beamView.showSectionCut && (
        <div className="absolute bottom-12 left-4 right-4 pointer-events-auto z-10 flex items-center gap-2">
          <input
            type="range"
            min={0} max={100} step={1}
            value={Math.round((beamView.sectionCutX ?? 0.5) * 100)}
            onChange={(e) => beamSetView({ sectionCutX: Number(e.target.value) / 100 })}
            className="flex-1"
          />
          <span className="text-[9px] text-primary-fixed-dim font-mono shrink-0 w-8 text-right">{Math.round((beamView.sectionCutX ?? 0.5) * 100)}%</span>
        </div>
      )}
      {!isBeam && !isStair && colView.showSectionCut && (
        <div className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-auto z-10 flex flex-col items-center gap-1">
          <span className="text-[8px] text-primary-fixed-dim/60 font-mono leading-none">▴</span>
          <input
            type="range"
            min={0} max={100} step={1}
            value={Math.round((colView.sectionCutY ?? 0.5) * 100)}
            onChange={(e) => colSetView({ sectionCutY: Number(e.target.value) / 100 })}
            className="w-4"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              accentColor: '#00daf3',
              height: '160px',
              appearance: 'auto',
              WebkitAppearance: 'slider-vertical',
              background: 'transparent',
              padding: 0,
            }}
          />
          <span className="text-[8px] text-primary-fixed-dim/60 font-mono leading-none">▾</span>
          <span className="text-[9px] text-primary-fixed-dim font-mono mt-0.5">{Math.round((colView.sectionCutY ?? 0.5) * 100)}%</span>
        </div>
      )}
      {/* Viewport Bottom HUD */}
      <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex justify-between items-end z-10">
        <div className="pointer-events-auto flex gap-2">
          <span className="px-2 py-1 rounded bg-surface-container-highest/90 border border-white/5 font-label-numeric text-label-numeric text-primary-fixed-dim text-[10px] font-mono">
            LOD: High
          </span>
          <span className="px-2 py-1 rounded bg-surface-container-highest/90 border border-white/5 font-label-numeric text-label-numeric text-on-surface-variant text-[10px] font-mono">
            {isStair ? '钢筋' : '箍筋'}: {stirrupCount}
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
