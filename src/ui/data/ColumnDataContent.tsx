import { useMemo, useState, useRef, useCallback } from 'react';
import { useColumnStore } from '../../store/columnStore';
import { deriveColumn, calcBarPositionsForSection } from '../../domain/kz/derive';
import type { ColumnParams } from '../../domain/kz/types';
import { getParamsForFloor } from '../../domain/kz/types';
import { buildColumnLongitudinal, makeColumnLayout } from '../../geometry/buildColumnLongitudinal';
import { RebarCutView } from '../RebarCutView';

/**
 * 柱(KZ) 数据面板内容（钢筋工程量 / 剖面 / 下料简图）。
 * 由 src/ui/DataPanel.tsx 拆出，仅供柱模块使用，与框架梁解耦。
 * 注：RebarCutView / selectionStore 为全模块共用的"选中钢筋→剖面图"基础设施，保持共享。
 */

/* ---------- Slide toggle (segmented control) ---------- */

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

/* ---------- Column Section View ---------- */

function ColumnSectionView() {
  const params = useColumnStore((s) => s.params);
  const view = useColumnStore((s) => s.view);
  const derived = useMemo(() => deriveColumn(params), [params]);
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ w: 400, h: 360 });
  const [anchor, setAnchor] = useState({ right: 16, bottom: 16 });
  const [zoom, setZoom] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
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
    const onMove = (ev: MouseEvent) => setSize({ w: Math.max(220, startRef.current.w + startRef.current.x - ev.clientX), h: Math.max(180, startRef.current.h + startRef.current.y - ev.clientY) });
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size]);

  // 根据剖切面 Y 位置判断当前剖到下层还是上层柱段
  const floors = params.floors ?? 1;
  const COLUMN_EXTEND = 500;
  const BEAM_HEIGHT = 600;
  const totalH = floors * (params.Hn + BEAM_HEIGHT) + BEAM_HEIGHT + COLUMN_EXTEND;
  const yPos = (view.sectionCutY ?? 0.5) * totalH - COLUMN_EXTEND;
  const storyH = params.Hn + BEAM_HEIGHT;
  const isUpper = floors >= 2 && yPos >= storyH;

  // 以下层截面作为剖切面 2D 视图的固定参考系，
  // 上层截面按真实 b/h 和偏移量在该参考系内绘制：
  // - 居中时上层截面居中且随尺寸缩小；
  // - 偏心时对齐边保持不动，仅未对齐边收缩。
  const lowerB = params.b;
  const lowerH = params.h;
  const b = isUpper ? (params.topB ?? params.b) : params.b;
  const h = isUpper ? (params.topH ?? params.h) : params.h;
  const offsetX = isUpper ? (params.topOffsetX ?? 0) : 0;
  const offsetZ = isUpper ? (params.topOffsetZ ?? 0) : 0;

  const barPositions = useMemo(() => {
    if (!isUpper) return derived.barPositions;
    const upperParams = getParamsForFloor(params, true);
    return calcBarPositionsForSection(upperParams, { b, h }).map((p) => ({ ...p, x: p.x + offsetX, y: p.y + offsetZ }));
  }, [isUpper, params, derived.barPositions, b, h, offsetX, offsetZ]);

  const W = 200;
  const dim = Math.max(lowerB, lowerH);
  const aspect = lowerH / lowerB;
  const H = Math.min(W * Math.max(aspect, 1), 240);
  const innerPad = 14;
  const scale = (W - innerPad * 2) / dim;
  const toSvgX = (x: number) => innerPad + (x + lowerB / 2) * scale;
  const toSvgY = (y: number) => innerPad + (lowerH / 2 - y) * scale;

  // 混凝土截面轮廓（按实际 b/h 绘制，不再撑满整个 viewBox）
  const rectX = toSvgX(-b / 2 + offsetX);
  const rectY = toSvgY(h / 2 + offsetZ);
  const rectW = b * scale;
  const rectH = h * scale;

  // 箍筋外框 — 按角筋外边界包裹，确保箍筋包住4个角筋
  const barPosXs = barPositions.map((p) => toSvgX(p.x));
  const barPosYs = barPositions.map((p) => toSvgY(p.y));
  const maxBarDia = Math.max(...barPositions.map((p) => p.bundle.diameter)) * scale;
  const barR = Math.max(maxBarDia / 2, 3);
  const gap = 2; // 箍筋内缘与纵筋外缘的间隙 (px)
  const sx0 = Math.min(...barPosXs) - barR - gap;
  const sy0 = Math.min(...barPosYs) - barR - gap;
  const sx1 = Math.max(...barPosXs) + barR + gap;
  const sy1 = Math.max(...barPosYs) + barR + gap;

  // 左上角角筋（用于弯钩定位）
  const cornerBars = barPositions.filter((pos) => pos.kind === 'corner');
  const topLeftBar = cornerBars.reduce((best, pos) => (
    !best || pos.x < best.x || (pos.x === best.x && pos.y > best.y) ? pos : best
  ), undefined as (typeof cornerBars)[number] | undefined);

  // 135° 弯钩参数 (skill: 5d 示意)
  const hookLen = 5 * params.stirrup.diameter * scale;
  const hd = hookLen * Math.SQRT1_2;

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
          剖切面 <span className="text-on-surface-variant text-[11px] ml-1">(Section A-A)</span>
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary-fixed-dim/15 text-primary-fixed-dim font-mono">
            {isUpper ? '上层' : '下层'}
          </span>
        </h3>
        <SectionCutToggle />
      </div>
      <div className="flex-1 p-4 flex items-center justify-center relative bg-surface-container-lowest overflow-hidden"
        onWheel={(e) => {
          if (!expanded) {
            e.preventDefault();
            setZoom((z) => Math.max(0.5, Math.min(5, z - e.deltaY * 0.002)));
          }
        }}
        style={{ cursor: zoom !== 1 && !expanded ? 'grab' : 'default' }}
      >
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.05s' }}>
        <svg width={expanded ? size.w - 32 : W} height={expanded ? size.h - 72 : H}
          viewBox={`${-36} -24 ${W + 64} ${H + 60}`}>
          <defs>
            <filter id="col-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* 混凝土截面轮廓 */}
          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="rgba(59,73,76,0.1)" stroke="rgba(59,73,76,0.6)" strokeWidth={2} />
          {/* 轴线 — 1轴（垂直于b边），A轴（垂直于h边） */}
          <line x1={-16} y1={H/2} x2={W + 18} y2={H/2} stroke="#4dd0e1" strokeWidth={1} strokeDasharray="8,6" opacity={0.8} />
          <line x1={W/2} y1={-18} x2={W/2} y2={H + 18} stroke="#4dd0e1" strokeWidth={1} strokeDasharray="8,6" opacity={0.8} />
          {/* A轴号（右端外侧，平行于b向尺寸） */}
          <circle cx={W + 14} cy={H/2} r={8} fill="rgba(0,0,0,0.6)" stroke="#4dd0e1" strokeWidth={1.2} opacity={0.9} />
          <text x={W + 14} y={H/2} textAnchor="middle" dominantBaseline="central" fill="#4dd0e1" fontSize={9} fontWeight="bold" opacity={0.95} fontFamily="sans-serif">A</text>
          {/* 1轴号（上端，平行于h向尺寸） */}
          <circle cx={W/2} cy={-10} r={8} fill="rgba(0,0,0,0.6)" stroke="#4dd0e1" strokeWidth={1.2} opacity={0.9} />
          <text x={W/2} y={-10} textAnchor="middle" dominantBaseline="central" fill="#4dd0e1" fontSize={9} fontWeight="bold" opacity={0.95} fontFamily="sans-serif">1</text>
          {/* 截面方向 b / h 标注 — 放在柱边中间，留间距 */}
          <text x={W/2} y={H + 36} textAnchor="middle" dominantBaseline="auto" fill="#b0bec5" fontSize={27} fontFamily="sans-serif" fontWeight="bold">b</text>
          <text x={innerPad - 40} y={H/2} textAnchor="start" dominantBaseline="central" fill="#b0bec5" fontSize={27} fontFamily="sans-serif" fontWeight="bold">h</text>
          {/* 外箍筋 — 圆角矩形 (skill: strokeWidth=2.5, rx=3) */}
          <rect x={sx0} y={sy0} width={sx1 - sx0} height={sy1 - sy0} fill="none" stroke="#78909c" strokeWidth={2.5} rx={3} />
          {/* 箍筋 135° 弯钩 — skill 画法：从角筋外缘+1px 出发，向截面内侧斜伸 */}
          {topLeftBar && (() => {
            const barRcorner = Math.max((topLeftBar.bundle.diameter * scale) / 2, 3);
            // 顶边弯钩：从角筋右侧边缘出发，向右下斜伸
            const topHookStartX = sx0 + barRcorner + gap + 1;
            // 左边弯钩：从角筋下侧边缘出发，向右下斜伸
            const leftHookStartY = sy0 + barRcorner + gap + 1;
            return (
              <g>
                <line x1={topHookStartX} y1={sy0} x2={topHookStartX + hd} y2={sy0 + hd} stroke="#78909c" strokeWidth={2.5} strokeLinecap="round" />
                <line x1={sx0} y1={leftHookStartY} x2={sx0 + hd} y2={leftHookStartY + hd} stroke="#78909c" strokeWidth={2.5} strokeLinecap="round" />
              </g>
            );
          })()}
          {/* 内箍筋 — 矩形箍包 bMid(黄) 和 hMid(蓝) 两组各4角 */}
          {(() => {
            const bMidBars = barPositions.filter((p) => p.kind === 'bMid');
            const hMidBars = barPositions.filter((p) => p.kind === 'hMid');
            const innerRects: { x: number; y: number; w: number; h: number }[] = [];
            const addInnerRect = (bars: typeof barPositions) => {
              if (bars.length < 4) return;
              const xs = bars.map((p) => toSvgX(p.x));
              const ys = bars.map((p) => toSvgY(p.y));
              const ix0 = Math.min(...xs) - barR - gap;
              const iy0 = Math.min(...ys) - barR - gap;
              const ix1 = Math.max(...xs) + barR + gap;
              const iy1 = Math.max(...ys) + barR + gap;
              innerRects.push({ x: ix0, y: iy0, w: ix1 - ix0, h: iy1 - iy0 });
            };
            addInnerRect(bMidBars);
            addInnerRect(hMidBars);
            if (innerRects.length === 0) return null;
            return (
              <g>
                {innerRects.map((r, i) => (
                  <g key={i}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#78909c" strokeWidth={2} rx={2} />
                    {/* 左上角 135° 弯钩：顶边向右下斜伸 */}
                    <line x1={r.x + barR + gap + 1} y1={r.y} x2={r.x + barR + gap + 1 + hd} y2={r.y + hd} stroke="#78909c" strokeWidth={2} strokeLinecap="round" />
                    {/* 左边弯钩：从左边向右下斜伸 */}
                    <line x1={r.x} y1={r.y + barR + gap + 1} x2={r.x + hd} y2={r.y + barR + gap + 1 + hd} stroke="#78909c" strokeWidth={2} strokeLinecap="round" />
                  </g>
                ))}
              </g>
            );
          })()}
          {/* 纵筋圆点 (skill: 最小半径 3px, SVG glow filter) */}
          {barPositions.map((pos, i) => {
            const cx = toSvgX(pos.x);
            const cy = toSvgY(pos.y);
            const dia = pos.bundle.diameter * scale;
            const color = pos.kind === 'corner' ? '#ef5350' : pos.kind === 'bMid' ? '#ffa726' : '#42a5f5';
            return (
              <circle key={i} cx={cx} cy={cy} r={Math.max(dia / 2, 3)} fill={color} filter="url(#col-glow)" />
            );
          })}
        </svg>
        </div>
      </div>
    </div>
    </>
  );
}

/* ---------- Section Cut Toggle ---------- */

function SectionCutToggle() {
  const show = useColumnStore((s) => s.view.showSectionCut);
  const setView = useColumnStore((s) => s.setView);
  return (
    <label className="relative inline-flex items-center cursor-pointer gap-2" title="在3D模型中显示剖切面">
      <input
        type="checkbox"
        checked={!!show}
        onChange={() => setView({ showSectionCut: !show })}
        className="sr-only peer"
      />
      <div className="w-8 h-4 bg-surface-container-highest rounded-full peer peer-checked:bg-primary-fixed-dim/60 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
      <span className="text-[10px] text-on-surface-variant font-mono">剖面</span>
    </label>
  );
}

/* ---------- Column Quantities Table ---------- */

const BOM_COLUMN_EXTEND = 500;
const BOM_BEAM_HEIGHT = 600;

interface RebarRow {
  mark: string;
  dia: number;
  grade: string;
  length: number;
  qty: number;
  note?: string;
  highlight?: boolean;
}

function buildColumnRows(params: ColumnParams, d: ReturnType<typeof deriveColumn>) {
  const rows: RebarRow[] = [];

  // 纵筋长度取自真实三维中心线（含搭接/连接、柱顶锚固、柱根插筋）
  const { bars } = buildColumnLongitudinal(params, d, makeColumnLayout(params.Hn, undefined, undefined, params.floors ?? 1));
  const connType = params.connectionType ?? 'tie';
  const connLabel = connType === 'tie' ? `绑扎搭接 llE=${d.lapLength}` : connType === 'mechanical' ? '机械连接' : '焊接';

  const barGroups = [
    { mark: 'Z1', kind: 'corner', note: '角筋' },
    { mark: 'Z2', kind: 'bMid', note: 'b边中部筋' },
    { mark: 'Z3', kind: 'hMid', note: 'h边中部筋' },
  ] as const;

  for (const group of barGroups) {
    const groupBars = d.barPositions.filter((pos) => pos.kind === group.kind);
    if (groupBars.length === 0) continue;
    const bundle = groupBars[0].bundle;
    const idxList: number[] = [];
    d.barPositions.forEach((pos, i) => { if (pos.kind === group.kind) idxList.push(i); });
    const segs = bars.filter((b) => idxList.some((i) =>
      b.barKey === `col-bar-${i}` || b.barKey === `col-bar-${i}-lo` || b.barKey === `col-bar-${i}-up`));
    const avgLen = segs.length > 0
      ? Math.round(segs.reduce((s, b) => s + b.meta.length, 0) / Math.max(1, idxList.length))
      : params.Hn;
    rows.push({
      mark: group.mark,
      dia: bundle.diameter,
      grade: bundle.grade,
      length: avgLen,
      qty: groupBars.length,
      note: `${group.note} · ${connLabel}`,
      highlight: group.kind === 'corner',
    });
  }

  const hoopUnitCount = Math.max(1, d.hoopLines.length / 4);
  const perimeter = 2 * (params.b - 2 * params.cover) + 2 * (params.h - 2 * params.cover) + 2 * 75 + 2 * 11.9 * params.stirrup.diameter;
  const hoopLength = Math.round(perimeter * hoopUnitCount);
  const floors = params.floors ?? 1;
  const netH = params.Hn;
  const hc = Math.max(params.b, params.h);
  const bh = BOM_BEAM_HEIGHT;
  const storyH = netH + bh;
  const spacingDense = params.stirrup.spacingDense;
  const spacingSparse = params.stirrup.spacingSparse;
  const denseLen = Math.max(Math.ceil(netH / 6), hc, 500);
  let totalDense = 0;
  let totalSparse = 0;
  let totalCore = 0;
  // 柱底伸出
  totalDense += Math.ceil(BOM_COLUMN_EXTEND / spacingDense);
  for (let f = 0; f < floors; f++) {
    // 核心区（梁高范围）
    totalCore += Math.ceil(bh / spacingDense);
    // 柱加密区 bottom + top
    totalDense += Math.ceil(denseLen / spacingDense) * 2;
    // 柱非加密区
    const sparseH = Math.max(0, netH - denseLen * 2);
    totalSparse += Math.ceil(sparseH / spacingSparse);
  }
  // 顶层核心区（屋面梁）
  totalCore += Math.ceil(bh / spacingDense);
  rows.push({
    mark: 'G1',
    dia: params.stirrup.diameter,
    grade: params.stirrup.grade,
    length: hoopLength,
    qty: totalDense,
    note: `柱加密区箍筋 ${d.stirrupLegs.x}×${d.stirrupLegs.y}@${params.stirrup.spacingDense}`,
  });
  if (totalSparse > 0) {
    rows.push({
      mark: 'G2',
      dia: params.stirrup.diameter,
      grade: params.stirrup.grade,
      length: hoopLength,
      qty: totalSparse,
      note: `非加密区箍筋 ${d.stirrupLegs.x}×${d.stirrupLegs.y}@${params.stirrup.spacingSparse}`,
    });
  }
  if (totalCore > 0) {
    rows.push({
      mark: 'G3',
      dia: params.stirrup.diameter,
      grade: params.stirrup.grade,
      length: hoopLength,
      qty: totalCore,
      note: `核心区箍筋 ${d.stirrupLegs.x}×${d.stirrupLegs.y}@${params.stirrup.spacingDense}`,
    });
  }
  return rows;
}

function ColumnQuantitiesTable() {
  const params = useColumnStore((s) => s.params);
  const d = useMemo(() => deriveColumn(params), [params]);
  const rows = useMemo(() => buildColumnRows(params, d), [params, d]);
  const [tab, setTab] = useState<'bom' | 'cut'>('bom');
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ w: 500, h: 420 });
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
    a.download = `rebar-bom-KZ1-${new Date().toISOString().slice(0, 10)}.csv`;
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

/* ---------- Data content wrapper (exported for registry) ---------- */

export function ColumnDataContent() {
  return (
    <>
      <ColumnQuantitiesTable />
      <ColumnSectionView />
    </>
  );
}
