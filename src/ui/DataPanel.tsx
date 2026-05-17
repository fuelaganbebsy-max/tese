import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';

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

function SectionView() {
  const params = useBeamStore((s) => s.params);
  const W = 200;
  const aspect = params.h / params.b;
  const H = Math.min(W * aspect, 240);
  const innerPad = 14;
  const c = params.cover * (W - innerPad * 2) / params.b;
  const tt = params.topThrough;
  const sp = params.spans[0];
  const dia = tt.diameter * (W - innerPad * 2) / params.b;
  const dBot = sp.bottom.diameter * (W - innerPad * 2) / params.b;

  const x0 = innerPad + c;
  const x1 = W - innerPad - c;
  const y0 = innerPad + c;
  const y1 = H - innerPad - c;

  const topXs = Array.from({ length: tt.count }, (_, i) =>
    tt.count === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (tt.count - 1)
  );
  const botXs = Array.from({ length: sp.bottom.count }, (_, i) =>
    sp.bottom.count === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (sp.bottom.count - 1)
  );

  return (
    <div className="w-1/3 rounded-xl bg-surface-container/80 backdrop-blur-[20px] border border-white/5 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0">
        <h3 className="font-body-md text-body-md font-medium text-on-surface font-bold">
          剖切面 <span className="text-on-surface-variant text-[11px] ml-1">(Section A-A)</span>
        </h3>
        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">crop</span>
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
          {/* Rebar dots */}
          {topXs.map((cx, i) => (
            <circle key={`t${i}`} cx={cx} cy={y0} r={Math.max(dia / 2, 3)} fill="#00daf3" filter="drop-shadow(0 0 4px rgba(0,218,243,0.6))" />
          ))}
          {botXs.map((cx, i) => (
            <circle key={`b${i}`} cx={cx} cy={y1} r={Math.max(dBot / 2, 3)} fill="#00daf3" />
          ))}
          {/* Side bars */}
          <circle cx={x0} cy={(y0 + y1) / 2} r={2.5} fill="none" stroke="#00daf3" strokeWidth={1} />
          <circle cx={x1} cy={(y0 + y1) / 2} r={2.5} fill="none" stroke="#00daf3" strokeWidth={1} />
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

export function DataPanel() {
  const collapsed = useBeamStore((s) => s.ui.dataPanelCollapsed);
  const setUi = useBeamStore((s) => s.setUi);

  return (
    <div
      className={`flex shrink-0 z-20 relative transition-[height] duration-200 ${
        collapsed ? 'h-10' : 'h-[280px]'
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
          <SectionView />
          <QuantitiesTable />
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
