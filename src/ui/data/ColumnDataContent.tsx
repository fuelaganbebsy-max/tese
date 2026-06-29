import { useMemo, useState, useRef, useCallback } from 'react';
import { useColumnStore } from '../../store/columnStore';
import { deriveColumn } from '../../domain/kz/derive';
import type { ColumnParams } from '../../domain/kz/types';
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
  const derived = useMemo(() => deriveColumn(params), [params]);
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ w: 400, h: 360 });
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const onMove = (ev: MouseEvent) => setSize({ w: Math.max(220, startRef.current.w + startRef.current.x - ev.clientX), h: Math.max(180, startRef.current.h + startRef.current.y - ev.clientY) });
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size]);
  const W = 200;
  const dim = Math.max(params.b, params.h);
  const aspect = params.h / params.b;
  const H = Math.min(W * Math.max(aspect, 1), 240);
  const innerPad = 14;
  const scale = (W - innerPad * 2) / dim;
  const toSvgX = (x: number) => innerPad + (x + params.b / 2) * scale;
  const toSvgY = (y: number) => innerPad + (params.h / 2 - y) * scale;
  const cornerBars = derived.barPositions.filter((pos) => pos.kind === 'corner');
  const topLeftBar = cornerBars.reduce((best, pos) => (
    !best || pos.x < best.x || (pos.x === best.x && pos.y > best.y) ? pos : best
  ), undefined as (typeof cornerBars)[number] | undefined);

  return (
    <div
      className={expanded ? 'rounded-xl flex flex-col overflow-hidden shadow-2xl' : 'w-1/3 rounded-xl bg-surface-container/80 backdrop-blur-[20px] border border-white/5 flex flex-col overflow-hidden'}
      style={expanded ? { position: 'fixed', bottom: 16, right: 16, width: size.w, height: size.h, zIndex: 9999, background: 'rgba(13,13,13,0.97)', border: '1px solid rgba(0,218,243,0.25)', boxShadow: '0 8px 48px rgba(0,0,0,0.8)' } : {}}
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
        onDoubleClick={() => setExpanded(v => !v)}
        title={expanded ? '双击还原' : '双击放大'}
      >
        <h3 className="font-body-md text-body-md font-medium text-on-surface font-bold">
          剖切面 <span className="text-on-surface-variant text-[11px] ml-1">(Section A-A)</span>
        </h3>
        <div className="flex items-center gap-2">
          <SectionCutToggle />
          <span className="px-2 py-1 rounded bg-surface-container-highest border border-white/5 text-[10px] text-on-surface-variant font-mono">
            剖面
          </span>
        </div>
      </div>
      <div className="flex-1 p-4 flex items-center justify-center relative bg-surface-container-lowest">
        <svg width={expanded ? size.w - 32 : W} height={expanded ? size.h - 72 : H} viewBox={`0 0 ${W} ${H}`}>
          <rect x={innerPad} y={innerPad} width={W - innerPad * 2} height={H - innerPad * 2} fill="none" stroke="rgba(59,73,76,0.5)" strokeWidth={2} />
          {/* grid lines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={`h${f}`} x1={innerPad} y1={innerPad + f * (H - innerPad * 2)} x2={W - innerPad} y2={innerPad + f * (H - innerPad * 2)} stroke="rgba(59,73,76,0.3)" strokeWidth={0.5} />
          ))}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={`v${f}`} x1={innerPad + f * (W - innerPad * 2)} y1={innerPad} x2={innerPad + f * (W - innerPad * 2)} y2={H - innerPad} stroke="rgba(59,73,76,0.3)" strokeWidth={0.5} />
          ))}
          {/* 轴线参考十字 */}
          <line x1={innerPad} y1={H/2} x2={W - innerPad} y2={H/2} stroke="#4dd0e1" strokeWidth={1} strokeDasharray="5,4" opacity={0.7} />
          <line x1={W/2} y1={innerPad} x2={W/2} y2={H - innerPad} stroke="#4dd0e1" strokeWidth={1} strokeDasharray="5,4" opacity={0.7} />
          <circle cx={innerPad + 8} cy={H/2} r={6} fill="none" stroke="#4dd0e1" strokeWidth={0.8} opacity={0.7} />
          <text x={innerPad + 8} y={H/2 + 1.5} textAnchor="middle" dominantBaseline="central" fill="#4dd0e1" fontSize={7} opacity={0.8} fontFamily="sans-serif">①</text>
          <circle cx={W/2} cy={innerPad + 8} r={6} fill="none" stroke="#4dd0e1" strokeWidth={0.8} opacity={0.7} />
          <text x={W/2} y={innerPad + 8} textAnchor="middle" dominantBaseline="central" fill="#4dd0e1" fontSize={7} opacity={0.8} fontFamily="sans-serif">②</text>
          {/* Stirrup outer hoop + m×n cross ties */}
          {derived.hoopLines.map((line, i) => (
            <g key={i}>
              <line
                x1={toSvgX(line.x1)}
                y1={toSvgY(line.y1)}
                x2={toSvgX(line.x2)}
                y2={toSvgY(line.y2)}
                stroke={line.kind === 'outer' ? '#78909c' : '#607d8b'}
                strokeWidth={line.kind === 'outer' ? 2 : 1.5}
                strokeLinecap="round"
              />
              {line.kind === 'crossTie' && (() => {
                const hookLen = 4 * params.stirrup.diameter * scale;
                const hd = hookLen * Math.SQRT1_2;
                const sx1 = toSvgX(line.x1);
                const sy1 = toSvgY(line.y1);
                const sx2 = toSvgX(line.x2);
                const sy2 = toSvgY(line.y2);
                const vertical = Math.abs(line.x1 - line.x2) < 1e-6;
                // 两端各画一个 135° 弯钩：沿拉筋方向折回截面内侧，垂直分量取同一侧
                const hooks = vertical
                  ? [
                      { x: sx1, y: sy1, dx: hd, dy: sy1 < sy2 ? hd : -hd },
                      { x: sx2, y: sy2, dx: hd, dy: sy2 < sy1 ? hd : -hd },
                    ]
                  : [
                      { x: sx1, y: sy1, dx: sx1 < sx2 ? hd : -hd, dy: hd },
                      { x: sx2, y: sy2, dx: sx2 < sx1 ? hd : -hd, dy: hd },
                    ];
                return (
                  <>
                    {hooks.map((hk, hi) => (
                      <line key={hi} x1={hk.x} y1={hk.y} x2={hk.x + hk.dx} y2={hk.y + hk.dy} stroke="#607d8b" strokeWidth={1.5} strokeLinecap="round" />
                    ))}
                  </>
                );
              })()}
            </g>
          ))}
          {/* 135° stirrup hook, matched to the frame beam section style. */}
          {topLeftBar && (() => {
            const outerTop = derived.hoopLines.find((line) => line.kind === 'outer' && Math.abs(line.y1 - line.y2) < 1e-6 && line.y1 > 0);
            const outerLeft = derived.hoopLines.find((line) => line.kind === 'outer' && Math.abs(line.x1 - line.x2) < 1e-6 && line.x1 < 0);
            if (!outerTop || !outerLeft) return null;
            const hookLen = 5 * params.stirrup.diameter * scale;
            const hd = hookLen * Math.SQRT1_2;
            const barR = Math.max((topLeftBar.bundle.diameter * scale) / 2, 2.5);
            const topHookStartX = toSvgX(topLeftBar.x) + barR + 1;
            const topHookY = toSvgY(outerTop.y1);
            const leftHookStartY = toSvgY(topLeftBar.y) + barR + 1;
            const leftHookX = toSvgX(outerLeft.x1);
            return (
              <g>
                <line x1={topHookStartX} y1={topHookY} x2={topHookStartX + hd} y2={topHookY + hd} stroke="#78909c" strokeWidth={2} strokeLinecap="round" />
                <line x1={leftHookX} y1={leftHookStartY} x2={leftHookX + hd} y2={leftHookStartY + hd} stroke="#78909c" strokeWidth={2} strokeLinecap="round" />
              </g>
            );
          })()}
          {/* Rebar dots */}
          {derived.barPositions.map((pos, i) => {
            const cx = toSvgX(pos.x);
            const cy = toSvgY(pos.y);
            const dia = pos.bundle.diameter * scale;
            const color = pos.kind === 'corner' ? '#ef5350' : pos.kind === 'bMid' ? '#ffa726' : '#42a5f5';
            return (
              <circle key={i} cx={cx} cy={cy} r={Math.max(dia / 2, 2.5)} fill={color} filter="drop-shadow(0 0 4px rgba(0,218,243,0.6))" />
            );
          })}
        </svg>
      </div>
    </div>
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
  rows.push({
    mark: 'G1',
    dia: params.stirrup.diameter,
    grade: params.stirrup.grade,
    length: hoopLength,
    qty: d.denseStirrupYs.length * floors,
    note: `加密区箍筋 ${d.stirrupLegs.x}×${d.stirrupLegs.y}@${params.stirrup.spacingDense}`,
  });
  if (d.sparseStirrupYs.length > 0) {
    const sparseQty = Math.max(0, d.sparseStirrupYs.length * (floors - 1));
    if (sparseQty > 0) {
      rows.push({
        mark: 'G2',
        dia: params.stirrup.diameter,
        grade: params.stirrup.grade,
        length: hoopLength,
        qty: sparseQty,
        note: `非加密区箍筋 ${d.stirrupLegs.x}×${d.stirrupLegs.y}@${params.stirrup.spacingSparse}`,
      });
    }
  }
  return rows;
}

function ColumnQuantitiesTable() {
  const params = useColumnStore((s) => s.params);
  const d = useMemo(() => deriveColumn(params), [params]);
  const rows = useMemo(() => buildColumnRows(params, d), [params, d]);
  const [tab, setTab] = useState<'bom' | 'cut'>('bom');

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
    <div className="flex-1 rounded-xl bg-surface-container/80 backdrop-blur-[20px] border border-white/5 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0">
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
