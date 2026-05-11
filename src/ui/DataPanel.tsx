import { useMemo, useState } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';

interface RebarRow {
  mark: string;
  dia: number;
  grade: string;
  length: number; // mm
  qty: number;
  note?: string;
  highlight?: boolean;
}

function buildRows(params: ReturnType<typeof useBeamStore.getState>['params'], d: ReturnType<typeof derive>): RebarRow[] {
  const rows: RebarRow[] = [];
  const tt = params.topThrough;
  // Top through: total length + bend anchors at both ends
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
    const totalSpanWithSupports = sp.ln + sp.hcLeft / 2 + sp.hcRight / 2; // schematic
    const bottomLen = totalSpanWithSupports + 2 * (ba.horizontal + ba.vertical);
    rows.push({
      mark: `B${i + 1}`,
      dia: sp.bottom.diameter,
      grade: sp.bottom.grade,
      length: bottomLen,
      qty: sp.bottom.count,
      note: `第${i + 1}跨下部`,
    });

    // Top support negative bars (left/right) – simplified length
    const ext = d.topSupportExtend[i];
    if (sp.topLeftSupport) {
      rows.push({
        mark: `N${i + 1}L`,
        dia: sp.topLeftSupport.diameter,
        grade: sp.topLeftSupport.grade,
        length: ext.left + sp.hcLeft + d.topAnchor.horizontal,
        qty: sp.topLeftSupport.count,
        note: `第${i + 1}跨左支座负筋`,
      });
    }
    if (sp.topRightSupport) {
      rows.push({
        mark: `N${i + 1}R`,
        dia: sp.topRightSupport.diameter,
        grade: sp.topRightSupport.grade,
        length: ext.right + sp.hcRight + d.topAnchor.horizontal,
        qty: sp.topRightSupport.count,
        note: `第${i + 1}跨右支座负筋`,
      });
    }

    // Stirrups
    const sLen =
      2 * (params.b - 2 * params.cover) + 2 * (params.h - 2 * params.cover) + 2 * 75 + 2 * 11.9 * sp.stirrup.diameter;
    rows.push({
      mark: `S${i + 1}`,
      dia: sp.stirrup.diameter,
      grade: sp.stirrup.grade,
      length: Math.round(sLen),
      qty: d.spans[i].stirrupXs.length,
      note: `第${i + 1}跨箍筋`,
    });
  });

  return rows;
}

function SectionView() {
  const params = useBeamStore((s) => s.params);
  // Build a simplified cross-section SVG
  const W = 220;
  const aspect = params.h / params.b;
  const H = Math.min(W * aspect, 260);
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
    <div className="w-[260px] shrink-0 border divider-strong rounded-md surface-0 relative flex items-center justify-center p-4">
      <div className="absolute top-3 left-3 text-[10px] tracking-widest text-white/40">
        截面 A-A · {params.b}×{params.h}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* concrete outline */}
        <rect
          x={innerPad}
          y={innerPad}
          width={W - innerPad * 2}
          height={H - innerPad * 2}
          fill="rgba(255,179,0,0.04)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
        />
        {/* cover dashed */}
        <rect
          x={x0}
          y={y0}
          width={x1 - x0}
          height={y1 - y0}
          fill="none"
          stroke="rgba(0,229,255,0.35)"
          strokeWidth={0.8}
          strokeDasharray="3 2"
        />
        {/* Stirrup */}
        <rect
          x={x0 - 2}
          y={y0 - 2}
          width={x1 - x0 + 4}
          height={y1 - y0 + 4}
          fill="none"
          stroke="#26A69A"
          strokeWidth={1}
        />
        {/* top bars */}
        {topXs.map((cx, i) => (
          <circle key={`t${i}`} cx={cx} cy={y0} r={Math.max(dia / 2, 2.5)} fill="#00E5FF" />
        ))}
        {/* bottom bars */}
        {botXs.map((cx, i) => (
          <circle key={`b${i}`} cx={cx} cy={y1} r={Math.max(dBot / 2, 2.5)} fill="#C3F5FF" />
        ))}
        {/* Dimension lines */}
        <line x1={innerPad} y1={H - 6} x2={W - innerPad} y2={H - 6} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
        <text x={W / 2} y={H - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontFamily="JetBrains Mono">
          {params.b}
        </text>
        <line x1={6} y1={innerPad} x2={6} y2={H - innerPad} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
        <text
          x={2}
          y={H / 2}
          fontSize="8"
          fill="rgba(255,255,255,0.5)"
          fontFamily="JetBrains Mono"
          transform={`rotate(-90 2 ${H / 2})`}
        >
          {params.h}
        </text>
      </svg>
    </div>
  );
}

function QuantitiesTable() {
  const params = useBeamStore((s) => s.params);
  const d = useMemo(() => derive(params), [params]);
  const rows = useMemo(() => buildRows(params, d), [params, d]);

  const totalSteel = rows.reduce((s, r) => {
    // weight kg = length(m) * qty * (0.00617 * dia^2)  (approx for round bar)
    const wPerM = 0.00617 * r.dia * r.dia;
    return s + (r.length / 1000) * r.qty * wPerM;
  }, 0);

  return (
    <div className="flex-1 border divider-strong rounded-md surface-0 overflow-hidden flex flex-col min-w-0">
      <div className="grid grid-cols-[60px_60px_80px_1fr_60px_1fr] surface-2 border-b divider px-4 py-2 text-[10px] tracking-wider text-white/50 sticky top-0">
        <div>编号</div>
        <div>直径</div>
        <div>等级</div>
        <div>长度</div>
        <div>根数</div>
        <div>备注</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono flex flex-col gap-0.5 text-[11px]">
        {rows.map((r, i) => (
          <div
            key={i}
            className={[
              'grid grid-cols-[60px_60px_80px_1fr_60px_1fr] px-3 py-1.5 rounded border transition-colors',
              r.highlight
                ? 'bg-primary/5 border-primary/20 text-primary'
                : 'border-transparent hover:bg-white/5 hover:border-white/5 text-white/70',
            ].join(' ')}
          >
            <div>{r.mark}</div>
            <div className={r.highlight ? '' : 'text-primary'}>⌀{r.dia}</div>
            <div>{r.grade}</div>
            <div className="text-white/80">{(r.length / 1000).toFixed(3)} m</div>
            <div>{r.qty}</div>
            <div className="text-white/40 truncate">{r.note}</div>
          </div>
        ))}
      </div>
      <div className="border-t divider px-4 py-2 flex items-center justify-between surface-2">
        <span className="text-[10px] tracking-widest text-white/40">总钢筋估重</span>
        <span className="font-mono text-[11px] text-primary">{totalSteel.toFixed(2)} kg</span>
      </div>
    </div>
  );
}

export function DataPanel() {
  const [tab, setTab] = useState<'section' | 'qty'>('section');
  const collapsed = useBeamStore((s) => s.ui.dataPanelCollapsed);
  const setUi = useBeamStore((s) => s.setUi);

  const tabs = [
    { id: 'section' as const, icon: 'architecture', label: '截面图' },
    { id: 'qty' as const, icon: 'table_chart', label: '钢筋下料' },
  ];

  return (
    <div
      className={`surface-1 border-t divider-strong flex flex-col shrink-0 z-20 relative rounded-none transition-[height] duration-200 ${
        collapsed ? 'h-10' : 'h-64'
      }`}
    >
      <div className="flex border-b divider px-3 surface-2 h-10 shrink-0 items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (collapsed) setUi({ dataPanelCollapsed: false });
            }}
            className={[
              'px-3 h-full border-b text-[12px] tracking-wider flex items-center gap-2 transition-colors',
              !collapsed && tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-white/40 hover:text-white/80',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline text-[10px] tracking-widest text-white/30">依据</span>
          <span className="hidden md:inline font-mono text-[10px] text-white/60">22G101-1</span>
          <button
            onClick={() => setUi({ dataPanelCollapsed: !collapsed })}
            title={collapsed ? '展开' : '收起'}
            className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-primary hover:bg-white/5 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              {collapsed ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="flex-1 flex p-3 gap-3 overflow-hidden">
          {tab === 'section' ? (
            <>
              <SectionView />
              <QuantitiesTable />
            </>
          ) : (
            <QuantitiesTable />
          )}
        </div>
      )}
    </div>
  );
}
