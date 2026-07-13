import { useMemo, useState, useRef, useCallback } from 'react';
import { useStairStore } from '../../store/stairStore';
import { useMemberStore } from '../../store/memberStore';
import { deriveStair, stairThicknessSegmentAtX } from '../../domain/at/derive';
import {
  deriveStairRebarLayout,
  type StairPoint2,
  type StairRebarLayout,
} from '../../domain/at/rebarLayout';
import { deriveStairQuantityRows } from '../../domain/at/quantities';
import { RebarCutView } from '../RebarCutView';
import type { StairParams } from '../../domain/at/types';

const MARGIN = 42;

/* ---------- 切换按钮 ---------- */
function SlideToggle<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="relative inline-flex p-0.5 rounded-lg bg-surface-container-highest/60 border border-white/5 select-none">
      <div
        className="absolute top-0.5 bottom-0.5 rounded-md bg-primary-fixed-dim/20 border border-primary-fixed-dim/40 transition-transform duration-200 ease-out"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 px-3 py-1 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
            value === o.value ? 'text-primary-fixed-dim' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const STROKE = {
  concrete: '#94a3b8',
  rebar: { bottom: '#facc15', top: '#fb7185', distribution: '#3b82f6' },
  axis: '#64748b',
  text: '#e2e8f0',
  dim: '#64748b',
  slabH: '#00daf3',
};

function StairQuantitiesTable() {
  const params = useStairStore((s) => s.params);
  const rows = useMemo(() => deriveStairQuantityRows(params), [params]);
  const [tab, setTab] = useState<'bom' | 'cut'>('bom');
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ w: 500, h: 340 });
  const [anchor, setAnchor] = useState({ left: 16, bottom: 16 });
  const panelRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const toggleExpand = useCallback(() => {
    if (!expanded) {
      const r = panelRef.current?.getBoundingClientRect();
      if (r) setAnchor({ left: r.left, bottom: window.innerHeight - r.bottom });
    }
    setExpanded((v) => !v);
  }, [expanded]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const onMove = (ev: MouseEvent) => setSize({
      w: Math.max(320, startRef.current.w + (ev.clientX - startRef.current.x)),
      h: Math.max(220, startRef.current.h + (startRef.current.y - ev.clientY)),
    });
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size]);

  const totalSteel = rows.reduce((sum, row) => sum + row.weight, 0);

  const exportCsv = () => {
    const header = '编号,名称,规格,单根长度(m),数量,总长度(m),重量(kg)';
    const body = rows.map((row) => (
      `${row.mark},${row.name},${row.spec},${(row.length / 1000).toFixed(3)},${row.quantity},${(row.totalLength / 1000).toFixed(3)},${row.weight.toFixed(2)}`
    ));
    const footer = `合计,,,,,,${totalSteel.toFixed(2)}`;
    const csv = '\uFEFF' + [header, ...body, footer].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebar-bom-AT1-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {expanded && <div className="flex-1" aria-hidden />}
      <div
        ref={panelRef}
        className={expanded ? 'rounded-xl flex flex-col overflow-hidden shadow-2xl' : 'flex-1 rounded-xl bg-surface-container/80 backdrop-blur-[20px] border border-white/5 flex flex-col overflow-hidden'}
        style={expanded ? { position: 'fixed', bottom: anchor.bottom, left: anchor.left, width: size.w, height: size.h, zIndex: 9999, background: 'rgba(13,13,13,0.97)', border: '1px solid rgba(0,218,243,0.25)', boxShadow: '0 8px 48px rgba(0,0,0,0.8)' } : {}}
      >
        {expanded && (
          <div
            style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, cursor: 'ne-resize', zIndex: 10 }}
            onMouseDown={onResizeStart}
            title="拖动调整大小"
          />
        )}
        <div
          className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0 select-none"
          style={{ cursor: 'pointer' }}
          onDoubleClick={toggleExpand}
          title={expanded ? '双击还原' : '双击放大'}
        >
          <SlideToggle
            value={tab}
            onChange={setTab}
            options={[
              { value: 'bom', label: '钢筋工程量' },
              { value: 'cut', label: '下料简图' },
            ]}
          />
          {tab === 'bom' && (
            <button onClick={exportCsv} className="text-primary-fixed-dim text-[11px] hover:underline font-label-numeric text-label-numeric font-mono active:scale-95 transition-transform">
              导出 CSV
            </button>
          )}
        </div>
        {tab === 'cut' ? (
          <RebarCutView />
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-container-high/90 backdrop-blur-md z-10 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-2 font-label-numeric text-label-numeric text-[11px] uppercase tracking-wider text-on-surface-variant font-medium font-mono">编号</th>
                    <th className="px-4 py-2 font-label-numeric text-label-numeric text-[11px] uppercase tracking-wider text-on-surface-variant font-medium font-mono">规格</th>
                    <th className="px-4 py-2 font-label-numeric text-label-numeric text-[11px] uppercase tracking-wider text-on-surface-variant font-medium font-mono">长度</th>
                    <th className="px-4 py-2 font-label-numeric text-label-numeric text-[11px] uppercase tracking-wider text-on-surface-variant font-medium font-mono">数量</th>
                    <th className="px-4 py-2 font-label-numeric text-label-numeric text-[11px] uppercase tracking-wider text-on-surface-variant font-medium text-right font-mono">重量 (kg)</th>
                  </tr>
                </thead>
                <tbody className="font-label-numeric text-label-numeric text-[12px] text-on-surface font-mono">
                  {rows.map((row) => (
                      <tr key={row.mark} className="border-b border-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                        <td className="px-4 py-2 text-primary-fixed-dim font-mono">
                          <span className="block">{row.mark}</span>
                          <span className="block text-[10px] text-on-surface-variant font-sans whitespace-nowrap">{row.name}</span>
                        </td>
                        <td className="px-4 py-2 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-surface-container-highest border border-white/5 text-on-surface">
                            {row.spec}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono">{(row.length / 1000).toFixed(3)}m</td>
                        <td className="px-4 py-2 font-mono">{row.quantity}</td>
                        <td className="px-4 py-2 text-right group-hover:text-primary-fixed-dim transition-colors font-mono">
                          {row.weight.toFixed(2)}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/5 px-4 py-2 flex items-center justify-between bg-surface-container-highest/30">
              <span className="text-[11px] text-on-surface-variant">总钢筋估重</span>
              <span className="font-label-numeric text-label-numeric text-primary-fixed-dim font-mono font-bold">{totalSteel.toFixed(2)} kg</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- 第 1-8 页纵剖面 / 第 2-8 页 1-1 横截面 ---------- */
function StairSectionView() {
  const params = useStairStore((s) => s.params);
  const activeType = useMemberStore((s) => s.activeType);
  const derived = useMemo(() => deriveStair(params), [params]);
  const rebar = useMemo(() => deriveStairRebarLayout(params), [params]);
  const [size, setSize] = useState({ w: 420, h: 340 });
  const [anchor, setAnchor] = useState({ right: 16, bottom: 16 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const toggleExpand = useCallback(() => {
    if (!expanded) {
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom });
    }
    setExpanded((value) => !value);
  }, [expanded]);

  const onResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    startRef.current = { x: event.clientX, y: event.clientY, w: size.w, h: size.h };
    const onMove = (moveEvent: MouseEvent) => {
      setSize({
        w: Math.max(280, startRef.current.w + startRef.current.x - moveEvent.clientX),
        h: Math.max(220, startRef.current.h + startRef.current.y - moveEvent.clientY),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size]);

  const onPanStart = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const onPanMove = useCallback((event: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStartRef.current.panX + event.clientX - dragStartRef.current.x,
      y: dragStartRef.current.panY + event.clientY - dragStartRef.current.y,
    });
  }, [dragging]);

  const onPanEnd = useCallback(() => setDragging(false), []);
  const layout = derived.layout;
  const plotW = Math.max(1, size.w - MARGIN * 2);
  const plotH = Math.max(1, size.h - MARGIN * 2);
  const longitudinalPoints = [
    ...layout.concreteProfile,
    ...rebar.bottom.points,
    ...rebar.lowTop.points,
    ...rebar.highTop.points,
  ];
  const xMin = Math.min(-params.lowBeam.width, ...longitudinalPoints.map((point) => point.x));
  const xMax = Math.max(params.ln + params.highBeam.width, ...longitudinalPoints.map((point) => point.x));
  const yMin = Math.min(layout.lowBeamBottomY, layout.highBeamBottomY, ...longitudinalPoints.map((point) => point.y));
  const yMax = Math.max(layout.lowBeamTopY, layout.highBeamTopY, ...longitudinalPoints.map((point) => point.y));
  const scale = Math.min(plotW / Math.max(1, xMax - xMin + 240), plotH / Math.max(1, yMax - yMin + 240));
  const originX = MARGIN + (plotW - (xMax - xMin) * scale) / 2 - xMin * scale;
  const originY = MARGIN + (plotH - (yMax - yMin) * scale) / 2 + yMax * scale;
  const toSvg = (x: number, y: number) => ({ x: originX + x * scale, y: originY - y * scale });
  const polylinePath = (points: StairPoint2[], close = false) => points.map((point, index) => {
    const svgPoint = toSvg(point.x, point.y);
    return `${index === 0 ? 'M' : 'L'} ${svgPoint.x} ${svgPoint.y}`;
  }).join(' ') + (close ? ' Z' : '');

  const lowDatum = toSvg(0, 0);
  const highDatum = toSvg(params.ln, params.Hs);
  const lowBeamRect = {
    x: toSvg(-params.lowBeam.width, 0).x,
    y: toSvg(0, layout.lowBeamTopY).y,
    width: params.lowBeam.width * scale,
    height: params.lowBeam.height * scale,
  };
  const highBeamRect = {
    x: toSvg(params.ln, 0).x,
    y: toSvg(0, layout.highBeamTopY).y,
    width: params.highBeam.width * scale,
    height: params.highBeam.height * scale,
  };
  const labelY = toSvg(0, yMin).y + 18;
  const dimHsX = highBeamRect.x + highBeamRect.width + 18;
  const distributionRadius = Math.max(1.5, params.distributionBar.diameter * scale / 2);
  const cornerIndex = Math.max(1, Math.min(layout.treadCount - 1, Math.round(layout.treadCount / 2)));
  const slabDimX = cornerIndex * layout.run;
  const slabThickness = stairThicknessSegmentAtX(layout, params.h, slabDimX);
  const slabRootP = toSvg(slabThickness.root.x, slabThickness.root.y);
  const slabBottomP = toSvg(slabThickness.bottom.x, slabThickness.bottom.y);
  const slabDimMid = { x: (slabRootP.x + slabBottomP.x) / 2, y: (slabRootP.y + slabBottomP.y) / 2 };
  const textGapWorld = 40 / scale;
  const slabTextP = toSvg(
    slabThickness.bottom.x + layout.concretePitch.normal.x * textGapWorld,
    slabThickness.bottom.y + layout.concretePitch.normal.y * textGapWorld,
  );
  const dimLine = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE.dim} strokeWidth={0.7} markerEnd="url(#stair-arrow)" markerStart="url(#stair-arrow)" />
  );

  return (
    <>
      {expanded && <div className="w-1/3" aria-hidden />}
      <div
        ref={panelRef}
        className={expanded ? 'rounded-xl flex flex-col overflow-hidden shadow-2xl' : 'w-1/3 rounded-xl bg-surface-container/80 backdrop-blur-[20px] border border-white/5 flex flex-col overflow-hidden'}
        style={expanded ? { position: 'fixed', bottom: anchor.bottom, right: anchor.right, width: size.w, height: size.h, zIndex: 9999, background: 'rgba(13,13,13,0.97)', border: '1px solid rgba(0,218,243,0.25)', boxShadow: '0 8px 48px rgba(0,0,0,0.8)' } : {}}
      >
        {expanded && (
          <div
            style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, cursor: 'nw-resize', zIndex: 10 }}
            onMouseDown={onResizeStart}
            title="拖动调整大小"
          />
        )}
        <div
          className="px-3 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center gap-2 shrink-0 select-none"
          onDoubleClick={toggleExpand}
          title={expanded ? '双击还原' : '双击放大'}
        >
          <span className="text-[10px] text-on-surface-variant font-mono whitespace-nowrap">纵向剖切面 · {activeType}</span>
        </div>
        <div
          className="flex-1 p-2 flex items-center justify-center relative bg-surface-container-lowest overflow-hidden select-none"
          onMouseDown={onPanStart}
          onMouseMove={onPanMove}
          onMouseUp={onPanEnd}
          onMouseLeave={onPanEnd}
          onWheel={(event) => {
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
            setZoom((value) => Math.min(5, Math.max(0.5, value * factor)));
          }}
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <div className="w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 0.05s' }}>
            <svg viewBox={`0 0 ${size.w} ${size.h}`} className="w-full h-full" overflow="visible" role="img" aria-label="AT 楼梯纵向剖切面">
                <rect {...lowBeamRect} fill={STROKE.concrete} fillOpacity="0.35" stroke={STROKE.concrete} strokeWidth={1.5} />
                <text x={lowBeamRect.x + lowBeamRect.width / 2} y={lowBeamRect.y + lowBeamRect.height / 2} fill={STROKE.text} fontSize={10} textAnchor="middle" dominantBaseline="middle">低梯梁</text>
                <rect {...highBeamRect} fill={STROKE.concrete} fillOpacity="0.35" stroke={STROKE.concrete} strokeWidth={1.5} />
                <text x={highBeamRect.x + highBeamRect.width / 2} y={highBeamRect.y + highBeamRect.height / 2} fill={STROKE.text} fontSize={10} textAnchor="middle" dominantBaseline="middle">高梯梁</text>
                <path d={polylinePath(layout.concreteProfile, true)} fill={STROKE.concrete} fillOpacity="0.35" stroke={STROKE.concrete} strokeWidth={1.5} />
                <line x1={lowDatum.x} y1={lowDatum.y} x2={highDatum.x} y2={highDatum.y} stroke={STROKE.axis} strokeWidth={0.5} strokeDasharray="4 4" />
                <path d={polylinePath(rebar.bottom.points)} fill="none" stroke={STROKE.rebar.bottom} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                <path d={polylinePath(rebar.lowTop.points)} fill="none" stroke={STROKE.rebar.top} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                <path d={polylinePath(rebar.highTop.points)} fill="none" stroke={STROKE.rebar.top} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                {[...rebar.topDistributionStations, ...rebar.bottomDistributionStations].map((station, index) => {
                  const point = toSvg(station.x, station.y);
                  return <circle key={`${station.s}-${index}`} cx={point.x} cy={point.y} r={distributionRadius} fill={STROKE.rebar.distribution} />;
                })}
                {dimLine(lowDatum.x, labelY, highDatum.x, labelY)}
                <text x={(lowDatum.x + highDatum.x) / 2} y={labelY + 14} textAnchor="middle" fill={STROKE.text} fontSize={10}>ln={params.ln}</text>
                {dimLine(dimHsX, lowDatum.y, dimHsX, highDatum.y)}
                <text x={dimHsX + 8} y={(lowDatum.y + highDatum.y) / 2} fill={STROKE.text} fontSize={10} transform={`rotate(90 ${dimHsX + 8} ${(lowDatum.y + highDatum.y) / 2})`} textAnchor="middle">Hs={params.Hs}</text>
                <line x1={slabRootP.x} y1={slabRootP.y} x2={slabBottomP.x} y2={slabBottomP.y} stroke={STROKE.slabH} strokeWidth={0.7} markerStart="url(#stair-tick)" markerEnd="url(#stair-tick)" />
                <line x1={slabDimMid.x} y1={slabDimMid.y} x2={slabTextP.x} y2={slabTextP.y} stroke={STROKE.slabH} strokeWidth={0.7} />
                <text x={slabTextP.x} y={slabTextP.y - 8} fill={STROKE.slabH} fontSize={10} textAnchor="middle" dominantBaseline="middle">h={params.h}</text>
                <defs>
                  <marker id="stair-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse">
                    <path d="M0,1 L6,3 L0,5 Z" fill={STROKE.dim} />
                  </marker>
                  <marker id="stair-tick" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto">
                    <line x1="2" y1="10" x2="10" y2="2" stroke={STROKE.slabH} strokeWidth={2.4} />
                  </marker>
                </defs>
              </svg>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- 数据内容 wrapper ---------- */
export function StairDataContent() {
  return (
    <>
      <StairQuantitiesTable />
      <StairSectionView />
    </>
  );
}
