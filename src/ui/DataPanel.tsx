import { useMemo, useState, useRef, useCallback } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import { deriveColumn } from '../domain/kz/derive';
import type { ColumnParams } from '../domain/kz/types';
import { useMemberStore } from '../store/memberStore';
import { derive } from '../domain/kl/derive';
import { splitSupportRows } from '../geometry/buildLongitudinal';
import { getMemberEntry } from '../memberRegistry';

function SectionCutButton() {
  const show = useBeamStore((s) => s.view.showSectionCut);
  const setView = useBeamStore((s) => s.setView);
  return (
    <label className="relative inline-flex items-center cursor-pointer gap-2" title="在3D模型中显示剖切面">
      <input
        type="checkbox"
        checked={!!show}
        onChange={() => setView({ showSectionCut: !show })}
        className="sr-only peer"
      />
      <div className="w-8 h-4 bg-surface-container-highest rounded-full peer peer-checked:bg-primary-fixed-dim/60 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
      <span className="text-[10px] text-on-surface-variant font-mono">{show ? '剖面' : '剖面'}</span>
    </label>
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
        <span className="px-2 py-1 rounded bg-surface-container-highest border border-white/5 text-[10px] text-on-surface-variant font-mono">
          剖面
        </span>
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

/* ---------- Column Quantities Table ---------- */

function buildColumnRows(params: ColumnParams, d: ReturnType<typeof deriveColumn>) {
  const rows: RebarRow[] = [];
  const barGroups = [
    { mark: 'Z1', kind: 'corner', note: '角筋' },
    { mark: 'Z2', kind: 'bMid', note: 'b边中部筋' },
    { mark: 'Z3', kind: 'hMid', note: 'h边中部筋' },
  ] as const;

  for (const group of barGroups) {
    const bars = d.barPositions.filter((pos) => pos.kind === group.kind);
    if (bars.length === 0) continue;
    const bundle = bars[0].bundle;
    rows.push({
      mark: group.mark,
      dia: bundle.diameter,
      grade: bundle.grade,
      length: params.Hn,
      qty: bars.length,
      note: group.note,
      highlight: group.kind === 'corner',
    });
  }

  const hoopUnitCount = Math.max(1, d.hoopLines.length / 4);
  const perimeter = 2 * (params.b - 2 * params.cover) + 2 * (params.h - 2 * params.cover) + 2 * 75 + 2 * 11.9 * params.stirrup.diameter;
  const hoopLength = Math.round(perimeter * hoopUnitCount);
  rows.push({
    mark: 'G1',
    dia: params.stirrup.diameter,
    grade: params.stirrup.grade,
    length: hoopLength,
    qty: d.denseStirrupYs.length,
    note: `加密区箍筋 ${d.stirrupLegs.x}×${d.stirrupLegs.y}@${params.stirrup.spacingDense}`,
  });
  if (d.sparseStirrupYs.length > 0) {
    rows.push({
      mark: 'G2',
      dia: params.stirrup.diameter,
      grade: params.stirrup.grade,
      length: hoopLength,
      qty: d.sparseStirrupYs.length,
      note: `非加密区箍筋 ${d.stirrupLegs.x}×${d.stirrupLegs.y}@${params.stirrup.spacingSparse}`,
    });
  }
  return rows;
}

function ColumnQuantitiesTable() {
  const params = useColumnStore((s) => s.params);
  const d = useMemo(() => deriveColumn(params), [params]);
  const rows = useMemo(() => buildColumnRows(params, d), [params, d]);

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
        <h3 className="font-body-md text-body-md font-medium text-on-surface flex items-center gap-2 font-bold">
          <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">table_chart</span>
          钢筋工程量 <span className="text-on-surface-variant text-[11px] font-normal ml-1">(BOM Data)</span>
        </h3>
        <button onClick={exportCsv} className="text-primary-fixed-dim text-[11px] hover:underline font-label-numeric text-label-numeric font-mono active:scale-95 transition-transform">
          导出 CSV
        </button>
      </div>
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
    </div>
  );
}

interface RebarRow {
  mark: string;
  dia: number;
  grade: string;
  length: number;
  qty: number;
  note?: string;
  highlight?: boolean;
}

function buildRows(params: ReturnType<typeof useBeamStore.getState>['params'], d: ReturnType<typeof derive>): RebarRow[] {
  const rows: RebarRow[] = [];
  const tt = params.topThrough;
  if (params.topBarType === 'erection') {
    // 架立筋：每跨独立，与左右支座负筋搭接 150mm
    params.spans.forEach((sp, i) => {
      const ext = d.topSupportExtend[i];
      const lj = Math.max(0, sp.ln - ext.left - ext.right + 2 * 150);
      rows.push({
        mark: `JL${i + 1}`,
        dia: tt.diameter,
        grade: tt.grade,
        length: lj,
        qty: tt.count,
        note: `第${i + 1}跨架立筋（搭接150）`,
        highlight: true,
      });
    });
  } else {
    const topLen = d.totalLength + 2 * (d.topAnchor.horizontal + d.topAnchor.vertical) - 2 * params.cover;
    rows.push({
      mark: 'T1',
      dia: tt.diameter,
      grade: tt.grade,
      length: topLen,
      qty: tt.count,
      note: '上部贯通',
      highlight: true,
    });
  }

  params.spans.forEach((sp, i) => {
    const ba = d.bottomAnchorPerSpan[i];
    const totalSpanWithSupports = sp.ln + sp.hcLeft / 2 + sp.hcRight / 2;
    const bottomLen = totalSpanWithSupports + 2 * (ba.horizontal + ba.vertical);
    rows.push({ mark: `B${i + 1}`, dia: sp.bottom.diameter, grade: sp.bottom.grade, length: bottomLen, qty: sp.bottom.count, note: `第${i + 1}跨下部` });

    const ext = d.topSupportExtend[i];
    if (sp.topLeftSupport) {
      rows.push({ mark: `N${i + 1}L`, dia: sp.topLeftSupport.diameter, grade: sp.topLeftSupport.grade, length: ext.left + sp.hcLeft + d.topAnchor.horizontal, qty: sp.topLeftSupport.count, note: `第${i + 1}跨左支座负筋` });
    }
    if (sp.topRightSupport) {
      rows.push({ mark: `N${i + 1}R`, dia: sp.topRightSupport.diameter, grade: sp.topRightSupport.grade, length: ext.right + sp.hcRight + d.topAnchor.horizontal, qty: sp.topRightSupport.count, note: `第${i + 1}跨右支座负筋` });
    }

    const sLen = 2 * (params.b - 2 * params.cover) + 2 * (params.h - 2 * params.cover) + 2 * 75 + 2 * 11.9 * sp.stirrup.diameter;
    rows.push({ mark: `S${i + 1}`, dia: sp.stirrup.diameter, grade: sp.stirrup.grade, length: Math.round(sLen), qty: d.spans[i].stirrupXs.length, note: `第${i + 1}跨箍筋` });
  });

  return rows;
}

// v4 -- beam section per 22G101-1 p2-41, dynamic based on cut position
function SectionView() {
  const params = useBeamStore((s) => s.params);
  const view = useBeamStore((s) => s.view);
  const d = useMemo(() => derive(params), [params]);
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ w: 400, h: 420 });
  const [anchor, setAnchor] = useState({ right: 16, bottom: 16 });
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

  // 剖切位置 (0~1 → 实际 X)
  const xCut = (view.sectionCutX ?? 0.5) * d.totalLength;

  // 找到剖切位置所在的跨
  let spanIdx = 0;
  for (let i = 0; i < d.spans.length; i++) {
    const ds = d.spans[i];
    if (xCut >= ds.x0 - params.spans[i].hcLeft && xCut <= ds.x1 + params.spans[i].hcRight) {
      spanIdx = i;
      break;
    }
    if (i === d.spans.length - 1) spanIdx = i;
  }
  const sp = params.spans[spanIdx];
  const ds = d.spans[spanIdx];
  const tt = params.topThrough;

  // 判断剖切位置处各类钢筋是否存在
  const inSpan = xCut >= ds.x0 && xCut <= ds.x1;
  const distFromLeft = xCut - ds.x0;
  const distFromRight = ds.x1 - xCut;

  // 上部支座负筋: 一排伸入 ln/3, 二排伸入 ln/4 (22G101-1)
  const ext = d.topSupportExtend[spanIdx];
  const hasTopLeftRow1 = distFromLeft <= ext.left;
  const hasTopLeftRow2 = distFromLeft <= ext.left * 0.75;       // ln/4
  const hasTopRightRow1 = distFromRight <= ext.right;
  const hasTopRightRow2 = distFromRight <= ext.right * 0.75;
  const topLeftCount = hasTopLeftRow1 ? (sp.topLeftSupport?.count ?? 0) : 0;
  const topRightCount = hasTopRightRow1 ? (sp.topRightSupport?.count ?? 0) : 0;
  // 选取当前剖切处控制的支座负筋束
  const activeSupBundle = topLeftCount >= topRightCount ? sp.topLeftSupport : sp.topRightSupport;
  const activeSupCount = Math.max(topLeftCount, topRightCount);
  const activeSupDia = activeSupBundle?.diameter ?? tt.diameter;
  // 上部贯通筋 / 架立筋: 架立筋仅在跨中(支座负筋伸入端点 ± 150mm 搭接)区间存在
  const isErection = params.topBarType === 'erection';
  const archPresent = inSpan && distFromLeft >= ext.left - 150 && distFromRight >= ext.right - 150;
  const effThruCount = isErection ? (archPresent ? tt.count : 0) : tt.count;
  const hasErectionBars = isErection && effThruCount > 0;
  // 按表查最大单排根数, 超出则分两排 (架立筋模式: 支座范围无贯通筋占用排位)
  const supThruCount = isErection ? 0 : tt.count;
  const supSplit = splitSupportRows(params.b, params.cover, tt.diameter, supThruCount, activeSupDia, activeSupCount);
  const topRow1Count = effThruCount + supSplit.row1; // 第一排总数
  // 二排仅在 ln/4 区间内存在
  const inRow2Zone = (topLeftCount > 0 && hasTopLeftRow2) || (topRightCount > 0 && hasTopRightRow2);
  const topRow2Count = inRow2Zone ? supSplit.row2 : 0;
  const topTotalCount = topRow1Count;

  // 下部一排：在跨内始终存在
  const botCount = inSpan ? sp.bottom.count : 0;

  // 下部二排
  const row2 = sp.bottomRow2;
  let row2Count = 0;
  if (row2 && row2.count > 0 && inSpan) {
    if (sp.bottomRow2MidAnchor) {
      // 全部伸入支座 → 全跨存在
      row2Count = row2.count;
    } else {
      // 角筋全跨, 中间筋仅在 0.1ln ~ 0.9ln
      const cornerCount = Math.min(2, row2.count);
      const midCount = row2.count - cornerCount;
      const shrink = 0.1 * sp.ln;
      const midPresent = distFromLeft >= shrink && distFromRight >= shrink;
      row2Count = cornerCount + (midPresent ? midCount : 0);
    }
  }

  // SVG 绘图参数
  const W = 200;
  const aspect = params.h / params.b;
  const H = Math.min(W * aspect, 280);
  const innerPad = 14;
  const scale = (W - innerPad * 2) / params.b;
  const c = params.cover * scale;
  const stirDia = sp.stirrup.diameter * scale;
  const dTop = tt.diameter * scale;
  const dBot = sp.bottom.diameter * scale;

  // 箍筋内框边界
  const sx0 = innerPad + c + stirDia / 2;
  const sx1 = W - innerPad - c - stirDia / 2;
  const sy0 = innerPad + c + stirDia / 2;
  const sy1 = H - innerPad - c - stirDia / 2;

  const barOff = Math.max(dTop / 2, 3) + 1;
  const topY = sy0 + barOff;
  const botY = sy1 - barOff;

  // 上部钢筋 X 坐标 — 架立筋模式：负筋全宽分布，架立筋紧贴角筋内侧
  let topXs: number[] = [];
  if (hasErectionBars) {
    // 支座负筋全宽分布
    const supCount = supSplit.row1;
    const supXs = Array.from({ length: supCount }, (_, i) =>
      supCount === 1 ? (sx0 + sx1) / 2 : sx0 + barOff + (i * (sx1 - sx0 - 2 * barOff)) / (supCount - 1)
    );
    // 架立筋紧贴左右两根角筋内侧
    const rEre = Math.max(dTop / 2, 3);
    const gap = rEre + rEre + 1;
    let eX: number[];
    if (effThruCount >= 2 && supCount >= 2) {
      // 有角筋：架立筋紧贴
      eX = [supXs[0] + gap, supXs[supCount - 1] - gap];
    } else if (effThruCount >= 2) {
      // 无角筋（跨中）：架立筋居中均匀排列
      eX = [(sx0 + sx1) / 2 - gap, (sx0 + sx1) / 2 + gap];
    } else {
      eX = [(sx0 + sx1) / 2];
    }
    // 合并：负筋在外侧，架立筋在之间（内侧）
    topXs = [...supXs.slice(0, Math.ceil(supCount / 2)), ...eX, ...supXs.slice(Math.ceil(supCount / 2))];
  } else {
    // 贯通筋模式或无架立筋：所有上部一排钢筋均匀排列
    topXs = Array.from({ length: Math.max(topTotalCount, 1) }, (_, i) =>
      topTotalCount <= 1 ? (sx0 + sx1) / 2 : sx0 + barOff + (i * (sx1 - sx0 - 2 * barOff)) / (topTotalCount - 1)
    );
  }
  // 下部一排 X 坐标
  const botXs = Array.from({ length: botCount }, (_, i) =>
    botCount === 1 ? (sx0 + sx1) / 2 : sx0 + barOff + (i * (sx1 - sx0 - 2 * barOff)) / (botCount - 1)
  );
  // 下部二排
  const dBot2 = row2 ? row2.diameter * scale : 0;
  const clearGap = Math.max(25, sp.bottom.diameter) * scale;
  const botY2 = botY - dBot / 2 - clearGap - dBot2 / 2;
  const botXs2 = Array.from({ length: row2Count }, (_, i) =>
    row2Count === 1 ? (sx0 + sx1) / 2 : sx0 + barOff + (i * (sx1 - sx0 - 2 * barOff)) / (row2Count - 1)
  );

  // 中部钢筋（构造筋/扭筋）— 根据参数面板开关显示
  const midEnabled = sp.midBarEnabled && inSpan;
  const midType = sp.midBarType ?? 'construction';
  const midBundle = midType === 'torsion'
    ? (sp.midTorsionBar ?? { grade: 'HRB400', diameter: 14, count: 2 })
    : (sp.midConstructionBar ?? { grade: 'HRB400', diameter: 12, count: 2 });
  const midCount = midEnabled ? midBundle.count : 0;
  const midDia = midBundle.diameter * scale;
  const midColor = midType === 'torsion' ? '#26c6da' : '#66bb6a';
  // 中部钢筋: 两腰各布 count/2 根, 总根数=输入纵筋数; 沿高度均分(count_perSide+1 段)
  const midLeftCount = Math.ceil(midCount / 2);
  const midRightCount = Math.floor(midCount / 2);
  const computeYs = (n: number) => {
    if (n <= 0) return [] as number[];
    const mYTop = topY + dTop / 2;
    const mYBot = (row2Count > 0 ? botY2 : botY) - (row2Count > 0 ? dBot2 / 2 : dBot / 2);
    return Array.from({ length: n }, (_, i) => mYTop + ((i + 1) / (n + 1)) * (mYBot - mYTop));
  };
  const midLeftYs = computeYs(midLeftCount);
  const midRightYs = computeYs(midRightCount);

  // 标注：区分贯通筋/架立筋 和 支座筋
  const throughLeftCount = Math.ceil(effThruCount / 2);
  const throughRightCount = effThruCount - throughLeftCount;

  const svgW = expanded ? size.w - 32 : W;
  const svgH = expanded ? size.h - 72 : H;
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
        </h3>
        <SectionCutButton />
      </div>
      <div className="flex-1 p-4 flex flex-col items-center justify-center relative bg-surface-container-lowest gap-2">
        <svg width={svgW} height={svgH} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* 混凝土截面轮廓 */}
          <rect x={innerPad} y={innerPad} width={W - innerPad * 2} height={H - innerPad * 2} fill="rgba(59,73,76,0.1)" stroke="rgba(59,73,76,0.6)" strokeWidth={2} />

          {/* 箍筋 — 封闭矩形 + 闭合接头处 135° 弯钩 (22G101-1 p2-41)
              两端钢筋于角部相遇, 各向梁内侧 135° 斜伸 max(10d, 75mm) ≈ 10d 示意 */}
          <rect x={sx0} y={sy0} width={sx1 - sx0} height={sy1 - sy0} fill="none" stroke="#78909c" strokeWidth={2.5} rx={3} />
          {(() => {
            // 剖切面示意: 箍筋 135° 弯钩平直段示意长度 (实际为 max(10d, 75mm), 此处取约 5d 便于阅图)
            // 弯钩位置: 紧贴左上角主筋(红色)外侧, 不穿过主筋
            const hookLen = 5 * sp.stirrup.diameter * scale;
            const dx = hookLen * Math.SQRT1_2;
            // 顶边弯钩: 从顶边、位于角部主筋右侧出发, 向右下斜伸
            const topHookStartX = sx0 + barOff + dTop / 2 + 1;
            // 左边弯钩: 从左边、位于角部主筋下侧出发, 向右下斜伸
            const leftHookStartY = topY + dTop / 2 + 1;
            return (
              <g>
                <line x1={topHookStartX} y1={sy0} x2={topHookStartX + dx} y2={sy0 + dx} stroke="#78909c" strokeWidth={2.5} strokeLinecap="round" />
                <line x1={sx0} y1={leftHookStartY} x2={sx0 + dx} y2={leftHookStartY + dx} stroke="#78909c" strokeWidth={2.5} strokeLinecap="round" />
              </g>
            );
          })()}

          {/* 内箍筋 (legs=4): 包绕上部中间两根主筋, 顶-左角 135° 弯钩 (样式与外箍筋一致) */}
          {sp.stirrup.legs === 4 && topXs.length >= 4 && (() => {
            // 取上部中间两根主筋 (索引 m1, m2): 内箍筋两根竖肢正切于这两根筋的外侧
            const m1 = Math.floor(topXs.length / 2) - 1;
            const m2 = Math.floor(topXs.length / 2);
            const ix0 = topXs[m1] - dTop / 2;     // 左竖肢: 切于左侧中部主筋的外左
            const ix1 = topXs[m2] + dTop / 2;     // 右竖肢: 切于右侧中部主筋的外右
            const hookLen = 5 * sp.stirrup.diameter * scale;
            const dx = hookLen * Math.SQRT1_2;
            // 弯钩避开中部主筋 (位于 topXs[m1]): 紧贴该主筋右侧 + 1
            const topHookStartX = topXs[m1] + dTop / 2 + 1;
            const leftHookStartY = topY + dTop / 2 + 1;
            return (
              <g>
                <rect x={ix0} y={sy0} width={ix1 - ix0} height={sy1 - sy0} fill="none" stroke="#78909c" strokeWidth={2.5} rx={3} />
                <line x1={topHookStartX} y1={sy0} x2={topHookStartX + dx} y2={sy0 + dx} stroke="#78909c" strokeWidth={2.5} strokeLinecap="round" />
                <line x1={ix0} y1={leftHookStartY} x2={ix0 + dx} y2={leftHookStartY + dx} stroke="#78909c" strokeWidth={2.5} strokeLinecap="round" />
              </g>
            );
          })()}


          {/* 中部钢筋（构造筋绿色/扭筋青色, 两腰总根数=输入根数） */}
          {midLeftYs.map((my, i) => (
            <circle key={`midL${i}`} cx={sx0 + barOff} cy={my} r={Math.max(midDia / 2, 2.5)} fill={midColor} filter="url(#glow)" />
          ))}
          {midRightYs.map((my, i) => (
            <circle key={`midR${i}`} cx={sx1 - barOff} cy={my} r={Math.max(midDia / 2, 2.5)} fill={midColor} filter="url(#glow)" />
          ))}
          {/* 拉筋 (构造筋/扭筋均需; 22G101-1 p2-41): 水平拉结两腰中部钢筋, 两端 135° 弯钩 ≥ 10d
              弯钩沿水平方向回弯 135°, 即指向梁内(右下/左下), 长度 ≈ 10d */}
          {midEnabled && midLeftYs.map((my, i) => {
            if (i >= midRightYs.length) return null;
            // 拉筋: 一条 path 从左切点出发, 弧形绕过左构造筋外皮 → 水平段 → 弧形绕过右构造筋外皮 → 135° 斜尾入梁内
            const cxL = sx0 + barOff;
            const cxR = sx1 - barOff;
            const r = midDia / 2;
            const yTop = my - r;       // 顶切点
            const yBot = my + r;       // 底切点
            const hookLen = (10 / 3) * midBundle.diameter * scale;
            const hd = hookLen * Math.SQRT1_2;
            // 整条拉筋绘制为一条平滑路径:
            //   左端: 从底切点 (cxL, yBot) 出发, 左端 135° 斜尾起点 = (cxL - hd, yBot + hd)
            //   依次: 斜尾 → 弧形绕左构造筋外皮(底→左→顶) → 水平段顶切线 → 弧形绕右构造筋外皮(顶→右→底) → 右端斜尾
            // 弧 sweep-flag: 左弧从 (cxL, yBot) 经左外侧到 (cxL, yTop) 走 sweep=1 (在 SVG 中沿外侧上行)
            //                右弧从 (cxR, yTop) 经右外侧到 (cxR, yBot) 走 sweep=1
            const path = [
              `M ${cxL + hd} ${yBot + hd}`,                                    // 左端 135° 斜尾远端
              `L ${cxL} ${yBot}`,                                              // 至左底切点
              `A ${r} ${r} 0 0 1 ${cxL} ${yTop}`,                              // 弧形绕左构造筋外皮(底→左→顶, sweep=1 增角方向 90°→180°→270°)
              `L ${cxR} ${yTop}`,                                              // 水平段顶切线
              `A ${r} ${r} 0 0 1 ${cxR} ${yBot}`,                              // 弧形绕右构造筋外皮(顶→右→底)
              `L ${cxR - hd} ${yBot + hd}`,                                    // 右端 135° 斜尾远端
            ].join(' ');
            return (
              <path key={`tie${i}`} d={path} stroke="#78909c" strokeWidth={1.5} fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
            );
          })}

          {/* 上部钢筋一排 (贯通筋红色 / 架立筋粉色, 支座负筋紫色) */}
          {topXs.map((cx, i) => {
            // 架立筋模式：架立筋在中间（紧贴角筋内侧），负筋在两侧
            // 贯通筋模式：贯通筋在外侧，支座负筋在内侧
            const isErectionBar = isErection && hasErectionBars && i >= Math.ceil(supSplit.row1 / 2) && i < Math.ceil(supSplit.row1 / 2) + effThruCount;
            const isThrough = isErection ? isErectionBar : (i < throughLeftCount || i >= topXs.length - throughRightCount);
            const thruColor = isErection ? '#ec407a' : '#ef5350';
            return (
              <circle key={`t${i}`} cx={cx} cy={topY} r={Math.max(dTop / 2, 3)}
                fill={isThrough ? thruColor : '#ab47bc'} filter="url(#glow)" />
            );
          })}
          {/* 上部钢筋二排 (支座负筋, 紫色, 在第一排正下方按净距) */}
          {topRow2Count > 0 && (() => {
            const dSup = activeSupDia * scale;
            const clearGap = Math.max(25, activeSupDia) * scale;
            const topY2 = topY + dTop / 2 + clearGap + dSup / 2;
            const xs2 = Array.from({ length: topRow2Count }, (_, i) =>
              topRow2Count === 1 ? (sx0 + sx1) / 2 : sx0 + barOff + (i * (sx1 - sx0 - 2 * barOff)) / (topRow2Count - 1)
            );
            return xs2.map((cx, i) => (
              <circle key={`t2-${i}`} cx={cx} cy={topY2} r={Math.max(dSup / 2, 3)} fill="#26c6da" filter="url(#glow)" />
            ));
          })()}

          {/* 下部一排钢筋 (橙色) */}
          {botXs.map((cx, i) => (
            <circle key={`b${i}`} cx={cx} cy={botY} r={Math.max(dBot / 2, 3)} fill="#ffa726" filter="url(#glow)" />
          ))}

          {/* 下部二排钢筋 */}
          {botXs2.map((cx, i) => {
            const isCorner = i === 0 || i === botXs2.length - 1;
            return (
              <circle key={`b2-${i}`} cx={cx} cy={botY2} r={Math.max(dBot2 / 2, 2.5)}
                fill={isCorner ? '#42a5f5' : '#66bb6a'} filter="url(#glow)" />
            );
          })}

        </svg>
      </div>
    </div>
    </>
  );
}

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

/* ---------- Beam mechanics view (qualitative M / V diagrams) ---------- */

function BeamMechanicsView() {
  const params = useBeamStore((s) => s.params);
  const activeType = useMemberStore((s) => s.activeType);
  const isFrame = activeType === 'KL' || activeType === 'WKL';

  const Ls = params.spans.map((s) => s.ln / 1000); // m
  const n = Ls.length;
  const leftFree = params.spans[0].hcLeft === 0;
  const rightFree = params.spans[n - 1].hcRight === 0;

  // 支座弯矩 (带符号, 负 = 上部受拉/支座负弯矩)
  const S: (number | null)[] = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    const Lref = Math.max(Ls[i - 1], Ls[i]);
    S[i] = -(Lref * Lref) / 11;
  }
  S[0] = leftFree ? null : isFrame ? -(Ls[0] * Ls[0]) / 24 : 0;
  S[n] = rightFree ? null : isFrame ? -(Ls[n - 1] * Ls[n - 1]) / 24 : 0;

  const spanData = Ls.map((L, i) => {
    const lFree = i === 0 && leftFree;
    const rFree = i === n - 1 && rightFree;
    if (rFree) return { ML: -(L * L) / 2, MR: 0, Mmid: -(L * L) / 8, Vl: L, Vr: 0 };
    if (lFree) return { ML: 0, MR: -(L * L) / 2, Mmid: -(L * L) / 8, Vl: 0, Vr: -L };
    return { ML: S[i] ?? 0, MR: S[i + 1] ?? 0, Mmid: (L * L) / 16, Vl: L / 2, Vr: -L / 2 };
  });

  const Mmax = Math.max(1e-6, ...spanData.flatMap((s) => [Math.abs(s.ML), Math.abs(s.MR), Math.abs(s.Mmid)]));
  const Vmax = Math.max(1e-6, ...spanData.flatMap((s) => [Math.abs(s.Vl), Math.abs(s.Vr)]));

  const VW = 320, VH = 226, pad = 26;
  const innerW = VW - pad * 2;
  const totalL = Ls.reduce((a, b) => a + b, 0) || 1;
  const cum: number[] = [0];
  Ls.forEach((L) => cum.push(cum[cum.length - 1] + L));
  const sx = (i: number) => pad + (cum[i] / totalL) * innerW;

  const beamY = 24;
  const momAxis = 98, momAmp = 40;
  const shrAxis = 190, shrAmp = 30;
  const mY = (M: number) => momAxis + (M / Mmax) * momAmp; // 正弯矩 (下部受拉) 画在轴线下方
  const vY = (V: number) => shrAxis - (V / Vmax) * shrAmp; // 正剪力画在轴线上方

  const SAMP = 18;
  const momentPaths = spanData.map((s, i) => {
    const x0 = sx(i), x1 = sx(i + 1);
    const a = -4 * s.Mmid + 2 * s.ML + 2 * s.MR;
    const b = (s.MR - s.ML) - a;
    const c = s.ML;
    let d = `M ${x0} ${momAxis}`;
    for (let k = 0; k <= SAMP; k++) {
      const t = k / SAMP;
      const M = a * t * t + b * t + c;
      d += ` L ${(x0 + (x1 - x0) * t).toFixed(2)} ${mY(M).toFixed(2)}`;
    }
    d += ` L ${x1} ${momAxis} Z`;
    return d;
  });
  const shearPaths = spanData.map((s, i) => {
    const x0 = sx(i), x1 = sx(i + 1);
    return `M ${x0} ${shrAxis} L ${x0} ${vY(s.Vl).toFixed(2)} L ${x1} ${vY(s.Vr).toFixed(2)} L ${x1} ${shrAxis} Z`;
  });

  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-surface-container-lowest gap-2">
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" style={{ maxWidth: 520 }}>
        {/* 均布荷载示意 (向下箭头) */}
        {Array.from({ length: 17 }).map((_, k) => {
          const x = pad + (k / 16) * innerW;
          const tip = beamY - 2;
          return (
            <g key={`q${k}`} stroke="rgba(120,144,156,0.6)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <line x1={x} y1={beamY - 13} x2={x} y2={tip} />
              <path d={`M ${x - 2.4} ${tip - 3.2} L ${x} ${tip} L ${x + 2.4} ${tip - 3.2}`} />
            </g>
          );
        })}
        <line x1={pad} y1={beamY - 13} x2={VW - pad} y2={beamY - 13} stroke="rgba(120,144,156,0.45)" strokeWidth={1} />
        <text x={VW - pad} y={beamY - 17} textAnchor="end" fontSize={8} fill="rgba(120,144,156,0.8)" fontFamily="monospace">q</text>

        {/* 梁轴线 */}
        <line x1={sx(0)} y1={beamY} x2={sx(n)} y2={beamY} stroke="#78909c" strokeWidth={3} strokeLinecap="round" />
        {/* 支座 */}
        {cum.map((_, i) => {
          const free = (i === 0 && leftFree) || (i === n && rightFree);
          if (free) return null;
          const x = sx(i);
          return <path key={`sup${i}`} d={`M ${x - 5} ${beamY + 11} L ${x + 5} ${beamY + 11} L ${x} ${beamY + 2} Z`} fill="#90a4ae" />;
        })}

        {/* 弯矩图 */}
        <line x1={pad} y1={momAxis} x2={VW - pad} y2={momAxis} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 3" />
        {momentPaths.map((d, i) => (
          <path key={`m${i}`} d={d} fill="rgba(0,218,243,0.16)" stroke="#00daf3" strokeWidth={1.4} strokeLinejoin="round" />
        ))}
        <text x={pad} y={momAxis - momAmp - 4} fontSize={9} fill="#00daf3" fontFamily="monospace" fontWeight="bold">弯矩 M (定性)</text>

        {/* 剪力图 */}
        <line x1={pad} y1={shrAxis} x2={VW - pad} y2={shrAxis} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 3" />
        {shearPaths.map((d, i) => (
          <path key={`v${i}`} d={d} fill="rgba(255,167,38,0.16)" stroke="#ffa726" strokeWidth={1.4} strokeLinejoin="round" />
        ))}
        <text x={pad} y={shrAxis - shrAmp - 4} fontSize={9} fill="#ffa726" fontFamily="monospace" fontWeight="bold">剪力 V (定性)</text>
      </svg>
      <p className="text-[10px] text-on-surface-variant text-center leading-snug">
        连续梁受均布荷载定性内力示意 · 仅按跨度比例绘制，未计入实际荷载与刚度
      </p>
    </div>
  );
}

function QuantitiesTable() {
  const params = useBeamStore((s) => s.params);
  const d = useMemo(() => derive(params), [params]);
  const rows = useMemo(() => buildRows(params, d), [params, d]);
  const [tab, setTab] = useState<'mechanics' | 'bom'>('bom');
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ w: 560, h: 420 });
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
    a.download = `rebar-bom-KL1-${new Date().toISOString().slice(0, 10)}.csv`;
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
        className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0 gap-2 select-none"
        style={{ cursor: 'pointer' }}
        onDoubleClick={toggleExpand}
        title={expanded ? '双击还原' : '双击放大'}
      >
        <SlideToggle
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mechanics', label: '力学模型' },
            { value: 'bom', label: '钢筋工程量' },
          ]}
        />
        {tab === 'bom' && (
          <button onClick={exportCsv} className="text-primary-fixed-dim text-[11px] hover:underline font-label-numeric text-label-numeric font-mono active:scale-95 transition-transform">
            导出 CSV
          </button>
        )}
      </div>
      {tab === 'mechanics' ? (
        <BeamMechanicsView />
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

/* ---------- Data content wrappers (exported for registry) ---------- */

export function BeamDataContent() {
  return (
    <>
      <QuantitiesTable />
      <SectionView />
    </>
  );
}

export function ColumnDataContent() {
  return (
    <>
      <ColumnQuantitiesTable />
      <ColumnSectionView />
    </>
  );
}

export function DataPanel() {
  const activeType = useMemberStore((s) => s.activeType);
  const isBeam = activeType === 'KL' || activeType === 'L' || activeType === 'WKL' || activeType === 'XL';
  const collapsed = isBeam
    ? useBeamStore((s) => s.ui.dataPanelCollapsed)
    : useColumnStore((s) => s.ui.dataPanelCollapsed);
  const setUi = isBeam
    ? useBeamStore((s) => s.setUi)
    : useColumnStore((s) => s.setUi);

  return (
    <div
      className={`flex shrink-0 z-20 relative ${
        collapsed ? 'h-10 transition-[height] duration-200' : 'h-full'
      }`}
      style={{ gap: 16 }}
    >
      {collapsed ? (
        <div className="w-full flex items-center px-4 bg-surface-container/80 border-t border-white/5">
          <button
            onClick={() => setUi({ dataPanelCollapsed: false })}
            className="flex items-center gap-2 text-on-surface-variant text-body-sm hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">expand_less</span>
            展开数据面板
          </button>
        </div>
      ) : (
        <>
          {(() => {
            const entry = getMemberEntry(activeType);
            if (!entry) return null;
            const DataContentComp = entry.dataContentComponent;
            return <DataContentComp />;
          })()}
          <button
            onClick={() => setUi({ dataPanelCollapsed: true })}
            title="收起"
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-primary-fixed-dim hover:bg-white/5 rounded transition-colors z-10"
          >
            <span className="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
        </>
      )}
    </div>
  );
}
