// Force Vite re-hash (2)
import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import { deriveColumn } from '../domain/kz/derive';
import type { ColumnParams } from '../domain/kz/types';
import { useMemberStore } from '../store/memberStore';
import { derive } from '../domain/kl/derive';
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
  const W = 200;
  const dim = Math.max(params.b, params.h);
  const aspect = params.h / params.b;
  const H = Math.min(W * Math.max(aspect, 1), 240);
  const innerPad = 14;
  const scale = (W - innerPad * 2) / dim;
  const c = params.cover * scale;
  const dia = params.longitudinal.diameter * scale;

  const x0 = innerPad + c;
  const x1 = W - innerPad - c;
  const y0 = innerPad + c;
  const y1 = H - innerPad - c;

  return (
    <div className="w-1/3 rounded-xl bg-surface-container/80 backdrop-blur-[20px] border border-white/5 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0">
        <h3 className="font-body-md text-body-md font-medium text-on-surface font-bold">
          剖切面 <span className="text-on-surface-variant text-[11px] ml-1">(Section A-A)</span>
        </h3>
        <SectionCutButton />
      </div>
      <div className="flex-1 p-4 flex items-center justify-center relative bg-surface-container-lowest">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect x={innerPad} y={innerPad} width={W - innerPad * 2} height={H - innerPad * 2} fill="none" stroke="rgba(59,73,76,0.5)" strokeWidth={2} />
          {/* grid lines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={`h${f}`} x1={innerPad} y1={innerPad + f * (H - innerPad * 2)} x2={W - innerPad} y2={innerPad + f * (H - innerPad * 2)} stroke="rgba(59,73,76,0.3)" strokeWidth={0.5} />
          ))}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={`v${f}`} x1={innerPad + f * (W - innerPad * 2)} y1={innerPad} x2={innerPad + f * (W - innerPad * 2)} y2={H - innerPad} stroke="rgba(59,73,76,0.3)" strokeWidth={0.5} />
          ))}
          {/* Stirrup outer hoop */}
          <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke="#666" strokeWidth={2} />
          {/* 135° stirrup hook at top-right corner (22G101-1 p2-7) - V4_FINAL */}
          <path d={`M ${x1} ${y0} l 10 0 l 5 -5`} stroke="#666" strokeWidth={2} fill="none" strokeLinejoin="round" />
          {/* Internal cross-ties */}
          {params.stirrup.legs === 4 && (
            <>
              <line x1={(x0 + x1) / 2} y1={y0} x2={(x0 + x1) / 2} y2={y1} stroke="#666" strokeWidth={1.5} />
              <line x1={x0} y1={(y0 + y1) / 2} x2={x1} y2={(y0 + y1) / 2} stroke="#666" strokeWidth={1.5} />
            </>
          )}
          {params.stirrup.legs === 6 && (
            <>
              <line x1={x0 + (x1 - x0) / 3} y1={y0} x2={x0 + (x1 - x0) / 3} y2={y1} stroke="#666" strokeWidth={1.5} />
              <line x1={x0 + 2 * (x1 - x0) / 3} y1={y0} x2={x0 + 2 * (x1 - x0) / 3} y2={y1} stroke="#666" strokeWidth={1.5} />
              <line x1={x0} y1={(y0 + y1) / 2} x2={x1} y2={(y0 + y1) / 2} stroke="#666" strokeWidth={1.5} />
            </>
          )}
          {/* Rebar dots */}
          {derived.barPositions.map((pos, i) => {
            const cx = innerPad + (pos.x + params.b / 2) * scale;
            const cy = innerPad + (params.h / 2 - pos.y) * scale;
            return (
              <circle key={i} cx={cx} cy={cy} r={Math.max(dia / 2, 2.5)} fill="#00daf3" filter="drop-shadow(0 0 4px rgba(0,218,243,0.6))" />
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
  const lg = params.longitudinal;
  // Longitudinal bars
  rows.push({
    mark: 'Z1',
    dia: lg.diameter,
    grade: lg.grade,
    length: params.Hn,
    qty: d.totalBars,
    note: '纵筋',
    highlight: true,
  });
  // Stirrups
  const perimeter = 2 * (params.b - 2 * params.cover) + 2 * (params.h - 2 * params.cover) + 2 * 75 + 2 * 11.9 * params.stirrup.diameter;
  rows.push({
    mark: 'G1',
    dia: params.stirrup.diameter,
    grade: params.stirrup.grade,
    length: Math.round(perimeter),
    qty: d.stirrupYs.length,
    note: `箍筋 (加密@${params.stirrup.spacingDense}, 非加密@${params.stirrup.spacingSparse})`,
  });
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

  // 上部支座负筋：左支座负筋延伸 ln/3 从左边界, 右支座负筋延伸 ln/3 从右边界
  const ext = d.topSupportExtend[spanIdx];
  const hasTopLeft = distFromLeft <= ext.left;
  const hasTopRight = distFromRight <= ext.right;
  const topLeftCount = hasTopLeft ? (sp.topLeftSupport?.count ?? 0) : 0;
  const topRightCount = hasTopRight ? (sp.topRightSupport?.count ?? 0) : 0;
  // 总上部钢筋 = 贯通筋 + 支座负筋（去重：取最大值，因为贯通筋已占位）
  const topTotalCount = tt.count + Math.max(topLeftCount, topRightCount);

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

  // 上部钢筋 X 坐标
  const topXs = Array.from({ length: topTotalCount }, (_, i) =>
    topTotalCount === 1 ? (sx0 + sx1) / 2 : sx0 + barOff + (i * (sx1 - sx0 - 2 * barOff)) / (topTotalCount - 1)
  );
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
  // y 均匀分布在上下主筋之间
  const midYs: number[] = [];
  if (midCount > 0) {
    const mYStart = topY + barOff + 2;
    const mYEnd = (row2Count > 0 ? botY2 : botY) - barOff - 2;
    for (let i = 0; i < midCount; i++) {
      midYs.push(midCount === 1
        ? (mYStart + mYEnd) / 2
        : mYStart + i * (mYEnd - mYStart) / (midCount - 1));
    }
  }

  // 标注：区分贯通筋和支座筋
  const throughEnd = tt.count;

  return (
    <div className="w-1/3 rounded-xl bg-surface-container/80 backdrop-blur-[20px] border border-white/5 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0">
        <h3 className="font-body-md text-body-md font-medium text-on-surface font-bold">
          剖切面 <span className="text-on-surface-variant text-[11px] ml-1">(Section A-A)</span>
        </h3>
        <SectionCutButton />
      </div>
      <div className="flex-1 p-4 flex flex-col items-center justify-center relative bg-surface-container-lowest gap-2">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* 混凝土截面轮廓 */}
          <rect x={innerPad} y={innerPad} width={W - innerPad * 2} height={H - innerPad * 2} fill="rgba(59,73,76,0.1)" stroke="rgba(59,73,76,0.6)" strokeWidth={2} />

          {/* 箍筋 — 封闭矩形 (加粗) + 左上角135°弯钩 (22G101-1 p2-39) */}
          <rect x={sx0} y={sy0} width={sx1 - sx0} height={sy1 - sy0} fill="none" stroke="#78909c" strokeWidth={2.5} rx={3} />
          {/* 左上角弯钩: 两根钩尾从顶边和左边向内斜伸 */}
          <path d={`M ${sx0 + 8} ${sy0} l 6 6`} stroke="#78909c" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <path d={`M ${sx0} ${sy0 + 8} l 6 6`} stroke="#78909c" strokeWidth={2.5} fill="none" strokeLinecap="round" />

          {/* 箍筋内肢 */}
          {sp.stirrup.legs === 4 && (
            <line x1={(sx0 + sx1) / 2} y1={sy0} x2={(sx0 + sx1) / 2} y2={sy1} stroke="#78909c" strokeWidth={1.5} />
          )}


          {/* 中部钢筋（构造筋绿色/扭筋青色, 两侧各count根） */}
          {midYs.map((my, i) => (
            <g key={`mid${i}`}>
              <circle cx={sx0 + barOff} cy={my} r={Math.max(midDia / 2, 2.5)} fill={midColor} filter="url(#glow)" />
              <circle cx={sx1 - barOff} cy={my} r={Math.max(midDia / 2, 2.5)} fill={midColor} filter="url(#glow)" />
            </g>
          ))}

          {/* 上部钢筋 (贯通筋红色, 支座负筋紫色) */}
          {topXs.map((cx, i) => (
            <circle key={`t${i}`} cx={cx} cy={topY} r={Math.max(dTop / 2, 3)}
              fill={i < throughEnd ? '#ef5350' : '#ab47bc'} filter="url(#glow)" />
          ))}

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
  );
}

function QuantitiesTable() {
  const params = useBeamStore((s) => s.params);
  const d = useMemo(() => derive(params), [params]);
  const rows = useMemo(() => buildRows(params, d), [params, d]);

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
