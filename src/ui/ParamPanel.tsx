import { useBeamStore } from '../store/beamStore';
import type { BeamParams, ConcreteGrade, RebarGrade, SeismicLevel, Span } from '../domain/kl/types';

const COMMON_DIA = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
const GRADES: RebarGrade[] = ['HPB300', 'HRB400', 'HRB500'];
const CONCRETES: ConcreteGrade[] = ['C25', 'C30', 'C35', 'C40', 'C45', 'C50'];
const SEISMICS: SeismicLevel[] = [1, 2, 3, 4];

function NumInput({ label, value, onChange, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-300 whitespace-nowrap">{label}</span>
      <input
        type="number"
        className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Select<T extends string | number>({ label, value, options, onChange, fmt }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void; fmt?: (v: T) => string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-300 whitespace-nowrap">{label}</span>
      <select
        className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const next = (typeof value === 'number' ? Number(raw) : raw) as T;
          onChange(next);
        }}
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>{fmt ? fmt(o) : String(o)}</option>
        ))}
      </select>
    </label>
  );
}

function BundleEditor({ label, value, onChange }: {
  label: string;
  value: { grade: RebarGrade; diameter: number; count: number };
  onChange: (b: { grade: RebarGrade; diameter: number; count: number }) => void;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <select
        className="px-1 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100"
        value={value.grade} onChange={(e) => onChange({ ...value, grade: e.target.value as RebarGrade })}
      >
        {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <select
        className="px-1 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100"
        value={value.diameter} onChange={(e) => onChange({ ...value, diameter: Number(e.target.value) })}
      >
        {COMMON_DIA.map((d) => <option key={d} value={d}>{`d${d}`}</option>)}
      </select>
      <input
        type="number" min={1} max={20}
        className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100"
        value={value.count} onChange={(e) => onChange({ ...value, count: Math.max(1, Number(e.target.value)) })}
      />
    </div>
  );
}

function SpanEditor({ idx, span, onChange }: { idx: number; span: Span; onChange: (s: Span) => void }) {
  return (
    <div className="space-y-2 p-3 rounded border border-slate-700 bg-slate-900/40">
      <div className="font-medium text-slate-200">第 {idx + 1} 跨</div>
      <NumInput label="净跨 ln (mm)" value={span.ln} onChange={(v) => onChange({ ...span, ln: v })} step={100} />
      <NumInput label="左支座宽 (mm)" value={span.hcLeft} onChange={(v) => onChange({ ...span, hcLeft: v })} step={50} />
      <NumInput label="右支座宽 (mm)" value={span.hcRight} onChange={(v) => onChange({ ...span, hcRight: v })} step={50} />
      <BundleEditor label="下部" value={span.bottom} onChange={(b) => onChange({ ...span, bottom: b })} />
      <BundleEditor
        label="左负筋"
        value={span.topLeftSupport ?? { grade: 'HRB400', diameter: 25, count: 2 }}
        onChange={(b) => onChange({ ...span, topLeftSupport: b })}
      />
      <BundleEditor
        label="右负筋"
        value={span.topRightSupport ?? { grade: 'HRB400', diameter: 25, count: 2 }}
        onChange={(b) => onChange({ ...span, topRightSupport: b })}
      />
      <div className="pt-2 border-t border-slate-800">
        <div className="text-xs text-slate-400 mb-1">箍筋</div>
        <BundleEditor
          label="规格"
          value={{ grade: span.stirrup.grade, diameter: span.stirrup.diameter, count: span.stirrup.legs }}
          onChange={(b) => onChange({ ...span, stirrup: { ...span.stirrup, grade: b.grade, diameter: b.diameter, legs: (b.count >= 4 ? 4 : 2) as 2 | 4 } })}
        />
        <div className="grid grid-cols-2 gap-2 mt-1">
          <NumInput label="加密@" value={span.stirrup.spacingDense} onChange={(v) => onChange({ ...span, stirrup: { ...span.stirrup, spacingDense: v } })} step={25} />
          <NumInput label="非加密@" value={span.stirrup.spacingSparse} onChange={(v) => onChange({ ...span, stirrup: { ...span.stirrup, spacingSparse: v } })} step={25} />
        </div>
      </div>
    </div>
  );
}

export function ParamPanel() {
  const params = useBeamStore((s) => s.params);
  const setParams = useBeamStore((s) => s.setParams);
  const view = useBeamStore((s) => s.view);
  const setView = useBeamStore((s) => s.setView);
  const reset = useBeamStore((s) => s.reset);

  const update = (patch: Partial<BeamParams>) => setParams((p) => ({ ...p, ...patch }));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-slate-100">
      <div>
        <h2 className="text-base font-semibold mb-2 text-blue-300">框架梁 KL · 平法可视化</h2>
        <p className="text-xs text-slate-400">参数变更实时刷新 3D 模型 · 单位 mm</p>
      </div>

      <section className="space-y-2 p-3 rounded border border-slate-700 bg-slate-900/40">
        <div className="font-medium text-slate-200">截面与全局</div>
        <NumInput label="梁宽 b" value={params.b} onChange={(v) => update({ b: v })} step={50} />
        <NumInput label="梁高 h" value={params.h} onChange={(v) => update({ h: v })} step={50} />
        <NumInput label="保护层 c" value={params.cover} onChange={(v) => update({ cover: v })} step={5} />
        <Select label="混凝土" value={params.concrete} options={CONCRETES} onChange={(v) => update({ concrete: v })} />
        <Select label="抗震等级" value={params.seismic} options={SEISMICS} onChange={(v) => update({ seismic: v })}
          fmt={(v) => ['一级', '二级', '三级', '四级'][(v as number) - 1]} />
        <BundleEditor label="上部贯通" value={params.topThrough} onChange={(b) => update({ topThrough: b })} />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-200">跨数：{params.spans.length}</div>
          <div className="flex gap-1">
            <button
              className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500"
              onClick={() => setParams((p) => ({
                ...p,
                spans: [...p.spans, { ...p.spans[p.spans.length - 1] }],
              }))}
            >+ 加一跨</button>
            <button
              className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
              disabled={params.spans.length <= 1}
              onClick={() => setParams((p) => ({ ...p, spans: p.spans.slice(0, -1) }))}
            >− 删一跨</button>
          </div>
        </div>
        {params.spans.map((sp, i) => (
          <SpanEditor key={i} idx={i} span={sp}
            onChange={(s) => setParams((p) => ({ ...p, spans: p.spans.map((x, k) => (k === i ? s : x)) }))} />
        ))}
      </section>

      <section className="space-y-2 p-3 rounded border border-slate-700 bg-slate-900/40">
        <div className="font-medium text-slate-200">视图开关</div>
        {([
          ['showConcrete', '混凝土'],
          ['showLongitudinal', '纵筋'],
          ['showStirrups', '箍筋'],
        ] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={view[k]} onChange={(e) => setView({ [k]: e.target.checked } as any)} />
            <span>{label}</span>
          </label>
        ))}
        <button className="mt-2 w-full px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600" onClick={reset}>恢复默认参数</button>
      </section>
    </div>
  );
}
