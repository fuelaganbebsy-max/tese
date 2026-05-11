import { useBeamStore } from '../store/beamStore';
import type { BeamParams, ConcreteGrade, RebarGrade, SeismicLevel, Span } from '../domain/kl/types';

const COMMON_DIA = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
const GRADES: RebarGrade[] = ['HPB300', 'HRB400', 'HRB500'];
const CONCRETES: ConcreteGrade[] = ['C25', 'C30', 'C35', 'C40', 'C45', 'C50'];
const SEISMICS: SeismicLevel[] = [1, 2, 3, 4];

/* ---------- Atoms ---------- */

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-[11px] tracking-[0.12em] text-primary flex items-center gap-2 border-b border-white/5 pb-2 font-medium">
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[11px] tracking-wider text-white/60">{children}</label>
      {hint && <span className="font-mono text-[10px] text-primary">{hint}</span>}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  unit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative flex items-center surface-0 border divider-strong rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-colors h-8">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-2 h-full text-white/40 hover:text-primary border-r divider"
        >
          <span className="material-symbols-outlined text-[14px]">remove</span>
        </button>
        <input
          type="number"
          className="flex-1 min-w-0 bg-transparent px-2 font-mono text-[11px] text-white/90 text-center"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="px-2 h-full text-white/40 hover:text-primary border-l divider"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
        </button>
        {unit && (
          <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[9px] text-white/30 font-mono pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  fmt,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  fmt?: (v: T) => string;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <select
        className="w-full surface-0 border divider-strong rounded focus:border-primary focus:ring-1 focus:ring-primary/40 h-8 px-2 font-mono text-[11px] text-white/90 transition-colors"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const next = (typeof value === 'number' ? Number(raw) : raw) as T;
          onChange(next);
        }}
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)} className="bg-[#121212]">
            {fmt ? fmt(o) : String(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

function BundleEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { grade: RebarGrade; diameter: number; count: number };
  onChange: (b: { grade: RebarGrade; diameter: number; count: number }) => void;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel hint={`${value.count}⌀${value.diameter} ${value.grade}`}>{label}</FieldLabel>
      <div className="grid grid-cols-3 gap-1.5">
        <select
          className="surface-0 border divider-strong rounded focus:border-primary h-7 px-1.5 font-mono text-[10px] text-white/90"
          value={value.grade}
          onChange={(e) => onChange({ ...value, grade: e.target.value as RebarGrade })}
        >
          {GRADES.map((g) => (
            <option key={g} value={g} className="bg-[#121212]">
              {g}
            </option>
          ))}
        </select>
        <select
          className="surface-0 border divider-strong rounded focus:border-primary h-7 px-1.5 font-mono text-[10px] text-white/90"
          value={value.diameter}
          onChange={(e) => onChange({ ...value, diameter: Number(e.target.value) })}
        >
          {COMMON_DIA.map((d) => (
            <option key={d} value={d} className="bg-[#121212]">
              ⌀{d}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={20}
          className="surface-0 border divider-strong rounded focus:border-primary h-7 px-2 font-mono text-[10px] text-white/90 text-center"
          value={value.count}
          onChange={(e) => onChange({ ...value, count: Math.max(1, Number(e.target.value)) })}
        />
      </div>
    </div>
  );
}

/* ---------- Span editor ---------- */

function SpanEditor({
  idx,
  total,
  span,
  onChange,
}: {
  idx: number;
  total: number;
  span: Span;
  onChange: (s: Span) => void;
}) {
  return (
    <div className="rounded-md border divider-strong surface-2 overflow-hidden">
      <div className="px-3 py-2 surface-3 border-b divider flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-primary">第 {idx + 1} / {total} 跨</span>
        </div>
        <span className="font-mono text-[10px] text-white/50">ln = {span.ln}mm</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <NumField label="净跨 ln" value={span.ln} onChange={(v) => onChange({ ...span, ln: v })} step={100} unit="mm" />
          <NumField label="左支座 hc" value={span.hcLeft} onChange={(v) => onChange({ ...span, hcLeft: v })} step={50} unit="mm" />
          <NumField label="右支座 hc" value={span.hcRight} onChange={(v) => onChange({ ...span, hcRight: v })} step={50} unit="mm" />
        </div>
        <BundleEditor label="下部纵筋" value={span.bottom} onChange={(b) => onChange({ ...span, bottom: b })} />
        <BundleEditor
          label="左支座负筋"
          value={span.topLeftSupport ?? { grade: 'HRB400', diameter: 25, count: 2 }}
          onChange={(b) => onChange({ ...span, topLeftSupport: b })}
        />
        <BundleEditor
          label="右支座负筋"
          value={span.topRightSupport ?? { grade: 'HRB400', diameter: 25, count: 2 }}
          onChange={(b) => onChange({ ...span, topRightSupport: b })}
        />
        <div className="pt-2 border-t divider space-y-2">
          <div className="text-[10px] tracking-widest text-white/50 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">grid_4x4</span>
            箍筋
          </div>
          <BundleEditor
            label="规格（等级 / 直径 / 肢数）"
            value={{ grade: span.stirrup.grade, diameter: span.stirrup.diameter, count: span.stirrup.legs }}
            onChange={(b) =>
              onChange({
                ...span,
                stirrup: { ...span.stirrup, grade: b.grade, diameter: b.diameter, legs: (b.count >= 4 ? 4 : 2) as 2 | 4 },
              })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <NumField
              label="加密间距"
              value={span.stirrup.spacingDense}
              onChange={(v) => onChange({ ...span, stirrup: { ...span.stirrup, spacingDense: v } })}
              step={25}
              unit="mm"
            />
            <NumField
              label="非加密间距"
              value={span.stirrup.spacingSparse}
              onChange={(v) => onChange({ ...span, stirrup: { ...span.stirrup, spacingSparse: v } })}
              step={25}
              unit="mm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Inspector root ---------- */

export function ParamPanel() {
  const params = useBeamStore((s) => s.params);
  const setParams = useBeamStore((s) => s.setParams);
  const reset = useBeamStore((s) => s.reset);
  const collapsed = useBeamStore((s) => s.ui.inspectorCollapsed);
  const setUi = useBeamStore((s) => s.setUi);

  const update = (patch: Partial<BeamParams>) => setParams((p) => ({ ...p, ...patch }));

  if (collapsed) {
    return (
      <aside className="surface-1 border-l divider-strong flex flex-col h-full shrink-0 z-30 w-10 relative items-center py-3 gap-2">
        <button
          onClick={() => setUi({ inspectorCollapsed: false })}
          title="展开参数面板"
          className="w-8 h-8 flex items-center justify-center rounded text-white/60 hover:text-primary hover:bg-white/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <div className="w-8 h-8 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[18px]">tune</span>
        </div>
        <div className="flex-1" />
        <div className="rotate-180 [writing-mode:vertical-rl] text-[11px] tracking-widest text-white/40">
          参数
        </div>
      </aside>
    );
  }

  return (
    <aside className="surface-1 border-l divider-strong flex flex-col h-full shrink-0 z-30 w-[300px] relative">
      {/* Header */}
      <div className="h-12 border-b divider flex items-center justify-between px-4 surface-2 shrink-0">
        <span className="text-[12px] tracking-wider text-white/90 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">tune</span>
          参数面板
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={reset}
            title="恢复默认"
            className="text-white/40 hover:text-primary transition-colors flex items-center gap-1 text-[11px] tracking-wider px-2 h-7 rounded hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            重置
          </button>
          <button
            onClick={() => setUi({ inspectorCollapsed: true })}
            title="收起"
            className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-primary hover:bg-white/5 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 surface-1">
        {/* Dimensions */}
        <div className="space-y-3">
          <SectionHeader icon="straighten" label="截面尺寸" />
          <div className="grid grid-cols-2 gap-3">
            <NumField label="梁宽 b" value={params.b} onChange={(v) => update({ b: v })} step={50} unit="mm" />
            <NumField label="梁高 h" value={params.h} onChange={(v) => update({ h: v })} step={50} unit="mm" />
          </div>
        </div>

        {/* Material */}
        <div className="space-y-3">
          <SectionHeader icon="category" label="材料与护层" />
          <SelectField
            label="混凝土等级"
            value={params.concrete}
            options={CONCRETES}
            onChange={(v) => update({ concrete: v })}
          />
          <SelectField
            label="抗震等级"
            value={params.seismic}
            options={SEISMICS}
            onChange={(v) => update({ seismic: v })}
            fmt={(v) => `抗震${['一', '二', '三', '四'][(v as number) - 1]}级（等级 ${['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][(v as number) - 1]}）`}
          />
          <div className="space-y-2 pt-1">
            <FieldLabel hint={`${params.cover}mm`}>保护层 c</FieldLabel>
            <input
              type="range"
              min={15}
              max={50}
              value={params.cover}
              onChange={(e) => update({ cover: Number(e.target.value) })}
              className="w-full accent-primary h-0.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[9px] text-white/30">
              <span>15</span>
              <span>25</span>
              <span>50</span>
            </div>
          </div>
        </div>

        {/* Top through */}
        <div className="space-y-3">
          <SectionHeader icon="horizontal_rule" label="上部贯通筋" />
          <BundleEditor label="上部贯通" value={params.topThrough} onChange={(b) => update({ topThrough: b })} />
        </div>

        {/* Spans */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="text-[11px] tracking-[0.12em] text-primary flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined text-[14px]">view_week</span>
              跨列表 · 共 {params.spans.length} 跨
            </div>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  setParams((p) => ({
                    ...p,
                    spans: [...p.spans, { ...p.spans[p.spans.length - 1] }],
                  }))
                }
                className="w-7 h-7 flex items-center justify-center rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                title="增加一跨"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
              </button>
              <button
                disabled={params.spans.length <= 1}
                onClick={() => setParams((p) => ({ ...p, spans: p.spans.slice(0, -1) }))}
                className="w-7 h-7 flex items-center justify-center rounded border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="删除末跨"
              >
                <span className="material-symbols-outlined text-[14px]">remove</span>
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {params.spans.map((sp, i) => (
              <SpanEditor
                key={i}
                idx={i}
                total={params.spans.length}
                span={sp}
                onChange={(s) => setParams((p) => ({ ...p, spans: p.spans.map((x, k) => (k === i ? s : x)) }))}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Status footer */}
      <div className="border-t divider surface-2 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          <span className="text-[10px] tracking-widest text-white/50">实时同步</span>
        </div>
        <span className="font-mono text-[10px] text-white/40">单位 · mm</span>
      </div>
    </aside>
  );
}
