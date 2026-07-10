import { useMemo, useState, useRef, useCallback } from 'react';
import { useStairStore } from '../../store/stairStore';
import { useMemberStore } from '../../store/memberStore';
import { deriveStair } from '../../domain/at/derive';
import { buildStairRebar } from '../../geometry/buildStairRebar';
import { RebarCutView } from '../RebarCutView';
import type { StairParams } from '../../domain/at/types';
import type { StairBarResult } from '../../geometry/buildStairRebar';

const MARGIN = 42;
const STROKE = {
  concrete: '#94a3b8',
  rebar: { bottom: '#facc15', top: '#facc15', distribution: '#3b82f6' },
  axis: '#64748b',
  text: '#e2e8f0',
  dim: '#64748b',
};

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

/* ---------- 钢筋工程量 / 下料简图 ---------- */
interface RebarRow {
  mark: string;
  dia: number;
  grade: string;
  length: number;
  qty: number;
  note?: string;
}

function buildStairRows(params: StairParams, bars: StairBarResult[]): RebarRow[] {
  const rows: RebarRow[] = [];
  const groups = [
    { mark: 'B', kind: 'bottom' as const, label: '下部纵筋' },
    { mark: 'T', kind: 'top' as const, label: '上部纵筋' },
    { mark: 'D', kind: 'distribution' as const, label: '分布筋' },
  ];
  for (const g of groups) {
    const groupBars = bars.filter((b) => b.meta.kind === g.kind);
    if (groupBars.length === 0) continue;
    const spec = g.kind === 'bottom' ? params.bottomBar : g.kind === 'top' ? params.topBar : params.distributionBar;
    const avgLen = Math.round(groupBars.reduce((s, b) => s + b.meta.length, 0) / groupBars.length);
    rows.push({
      mark: g.mark,
      dia: spec.diameter,
      grade: spec.grade,
      length: avgLen,
      qty: groupBars.length,
      note: g.label,
    });
  }
  return rows;
}

function StairQuantitiesTable() {
  const params = useStairStore((s) => s.params);
  const rebar = useMemo(() => buildStairRebar(params), [params]);
  const rows = useMemo(() => buildStairRows(params, rebar.bars), [params, rebar]);
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

  const totalSteel = rows.reduce((s, r) => {
    const wPerM = 0.00617 * r.dia * r.dia;
    return s + (r.length / 1000) * r.qty * wPerM;
  }, 0);

  const exportCsv = () => {
    const header = '编号,等级,直径(mm),长度(m),数量,重量(kg),备注';
    const body = rows.map((r) => {
      const w = (r.length / 1000) * r.qty * 0.00617 * r.dia * r.dia;
      return `${r.mark},${r.grade},${r.dia},${(r.length / 1000).toFixed(2)},${r.qty},${w.toFixed(1)},${r.note ?? ''}`;
    });
    const footer = `合计,,,,, ${totalSteel.toFixed(2)},`;
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
                  {rows.map((r, i) => {
                    const wPerM = 0.00617 * r.dia * r.dia;
                    const weight = (r.length / 1000) * r.qty * wPerM;
                    return (
                      <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                        <td className="px-4 py-2 text-primary-fixed-dim font-mono">{r.mark}</td>
                        <td className="px-4 py-2 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-surface-container-highest border border-white/5 text-on-surface">
                            {r.grade} ∅{r.dia}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono">{(r.length / 1000).toFixed(2)}m</td>
                        <td className="px-4 py-2 font-mono">{r.qty}</td>
                        <td className="px-4 py-2 text-right group-hover:text-primary-fixed-dim transition-colors font-mono">
                          {weight.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
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

/* ---------- 顺着楼梯走向方向的剖切面 ---------- */
function StairSectionView() {
  const params = useStairStore((s) => s.params);
  const activeType = useMemberStore((s) => s.activeType);
  const derived = useMemo(() => deriveStair(params), [params]);
  const rebar = useMemo(() => buildStairRebar(params), [params]);
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
      const r = panelRef.current?.getBoundingClientRect();
      if (r) setAnchor({ right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom });
    }
    setExpanded((v) => !v);
  }, [expanded]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const onMove = (ev: MouseEvent) => {
      setSize({
        w: Math.max(280, startRef.current.w + startRef.current.x - ev.clientX),
        h: Math.max(200, startRef.current.h + startRef.current.y - ev.clientY),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size]);

  const onPanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const onPanMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
  }, [dragging]);

  const onPanEnd = useCallback(() => setDragging(false), []);

  const plotW = size.w - MARGIN * 2;
  const plotH = size.h - MARGIN * 2;
  const layout = derived.layout;

  const scale = useMemo(() => {
    const xRange = params.ln + params.lowBeam.width + params.highBeam.width + 400;
    const yRange = params.Hs + Math.max(params.lowBeam.height, params.highBeam.height) + 400;
    return Math.min(plotW / xRange, plotH / yRange) * zoom;
  }, [params, plotW, plotH, zoom]);

  const originX = MARGIN + (plotW - (params.ln + params.lowBeam.width + params.highBeam.width) * scale) / 2 + params.lowBeam.width * scale;
  const originY = MARGIN + plotH - (params.lowBeam.height + 100) * scale;
  const toSvg = (x: number, y: number) => ({ x: originX + x * scale, y: originY - y * scale });

  const treadPts: { x: number; y: number }[] = [];
  for (let i = 0; i < params.stepCount; i++) {
    const x = i * layout.run;
    const y = i * layout.rise;
    if (i > 0) treadPts.push({ x, y });
    if (i < params.stepCount - 1) treadPts.push({ x: x + layout.run, y });
  }

  const dx = params.h * layout.normal.x;
  const dy = params.h * layout.normal.y;
  const lowTop = toSvg(0, 0);
  const highTop = toSvg(params.ln, params.Hs);
  const lowBot = toSvg(dx, dy);
  const highBot = toSvg(params.ln + dx, params.Hs + dy);

  const lowBeamRect = {
    x: toSvg(-params.lowBeam.width, 0).x,
    y: toSvg(0, layout.lowBeamBottomY).y,
    w: params.lowBeam.width * scale,
    h: params.lowBeam.height * scale,
  };
  const highBeamRect = {
    x: toSvg(params.ln, 0).x,
    y: toSvg(0, layout.highBeamBottomY).y,
    w: params.highBeam.width * scale,
    h: params.highBeam.height * scale,
  };

  const slabPath = [
    `M ${lowTop.x} ${lowTop.y}`,
    ...treadPts.map((p) => { const s = toSvg(p.x, p.y); return `L ${s.x} ${s.y}`; }),
    `L ${highTop.x} ${highTop.y}`,
    `L ${highBot.x} ${highBot.y}`,
    `L ${lowBot.x} ${lowBot.y}`,
    'Z',
  ].join(' ');

  const rebarPath = (kind: 'bottom' | 'top', limit?: number) => rebar.bars
    .filter((b) => b.meta.kind === kind)
    .slice(0, limit ?? Infinity)
    .map((b) => {
      const pts = b.points.map((p) => toSvg(p.x, p.y));
      return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
    })
    .join(' ');

  const bottomBarPath = rebarPath('bottom', 1);
  const topBarPaths = rebarPath('top', 2);

  const dimLine = (x1: number, y1: number, x2: number, y2: number) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE.dim} strokeWidth={0.6} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
    </g>
  );

  const labelY = lowTop.y + 30;
  const dimHsX = highBeamRect.x + highBeamRect.w + 18;

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
          className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0 select-none"
          style={{ cursor: 'pointer' }}
          onDoubleClick={toggleExpand}
          title={expanded ? '双击还原' : '双击放大'}
        >
          <h3 className="font-body-md text-body-md font-medium text-on-surface font-bold">
            {activeType} 顺着楼梯走向方向的剖切面
          </h3>
        </div>
        <div
          className="flex-1 p-4 flex flex-col items-center justify-center relative bg-surface-container-lowest gap-2 overflow-hidden select-none"
          onMouseDown={onPanStart}
          onMouseMove={onPanMove}
          onMouseUp={onPanEnd}
          onMouseLeave={onPanEnd}
          onWheel={(e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            setZoom((z) => Math.min(5, Math.max(0.5, z * factor)));
          }}
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 0.05s' }}>
            <svg className="w-full h-full" style={{ minWidth: size.w, minHeight: size.h - 40 }}>
              <rect x={lowBeamRect.x} y={lowBeamRect.y} width={lowBeamRect.w} height={lowBeamRect.h} fill={STROKE.concrete} fillOpacity="0.25" stroke={STROKE.concrete} />
            <rect x={highBeamRect.x} y={highBeamRect.y} width={highBeamRect.w} height={highBeamRect.h} fill={STROKE.concrete} fillOpacity="0.25" stroke={STROKE.concrete} />
            <path d={slabPath} fill={STROKE.concrete} fillOpacity="0.35" stroke={STROKE.concrete} strokeWidth={1.5} />
            <line x1={lowTop.x} y1={lowTop.y} x2={highTop.x} y2={highTop.y} stroke={STROKE.axis} strokeWidth={0.5} strokeDasharray="4 4" />
            {bottomBarPath && <path d={bottomBarPath} fill="none" stroke={STROKE.rebar.bottom} strokeWidth={2.2} />}
            {topBarPaths && <path d={topBarPaths} fill="none" stroke={STROKE.rebar.top} strokeWidth={2.2} />}
            {dimLine(lowTop.x, labelY, highTop.x, labelY)}
            <text x={(lowTop.x + highTop.x) / 2} y={labelY + 14} textAnchor="middle" fill={STROKE.text} fontSize={10}>ln={params.ln}</text>
            {dimLine(dimHsX, lowTop.y, dimHsX, highTop.y)}
            <text x={dimHsX + 8} y={(lowTop.y + highTop.y) / 2} fill={STROKE.text} fontSize={10} transform={`rotate(90 ${dimHsX + 8} ${(lowTop.y + highTop.y) / 2})`}>Hs={params.Hs}</text>
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,1 L6,3 L0,5 L0,3.5 L0,2.5 Z" fill={STROKE.dim} />
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
