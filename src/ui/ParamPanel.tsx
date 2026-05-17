import { useState } from 'react';
import { useBeamStore } from '../store/beamStore';
import type { BeamParams, ConcreteGrade, RebarGrade, SeismicLevel, Span } from '../domain/kl/types';

const COMMON_DIA = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
const GRADES: RebarGrade[] = ['HPB300', 'HRB400', 'HRB500'];
const CONCRETES: ConcreteGrade[] = ['C25', 'C30', 'C35', 'C40', 'C45', 'C50'];
const SEISMICS: SeismicLevel[] = [1, 2, 3, 4];

/* ---------- Atoms ---------- */

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const isInvalid = value < min || (max !== undefined && value > max);
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body-sm text-[11px] text-on-surface-variant">{label}</label>
      <div className="relative">
        <input
          type="number"
          className={`w-full bg-surface-container-lowest border rounded px-3 py-1.5 font-label-numeric text-label-numeric text-on-surface focus:ring-1 outline-none text-right pr-10 font-mono transition-colors ${
            isInvalid
              ? 'border-error/60 focus:border-error focus:ring-error/40 text-error'
              : 'border-white/10 focus:border-primary-fixed-dim focus:ring-primary-fixed-dim'
          }`}
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(v);
          }}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-label-numeric text-[11px] text-on-surface-variant pointer-events-none font-mono">
            {unit}
          </span>
        )}
      </div>
      {isInvalid && (
        <span className="text-[10px] text-error/80">
          {value < min ? `最小值 ${min}` : `最大值 ${max}`}
        </span>
      )}
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
    <div className="flex flex-col gap-1">
      <label className="font-body-sm text-[11px] text-on-surface-variant">{label}</label>
      <select
        className="bg-surface-container-lowest border border-white/10 rounded px-2 py-1.5 font-label-numeric text-label-numeric text-on-surface focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none appearance-none font-mono"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const next = (typeof value === 'number' ? Number(raw) : raw) as T;
          onChange(next);
        }}
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="font-body-sm text-[11px] text-on-surface-variant">{label}</label>
        <span className="font-label-numeric text-[10px] text-primary-fixed-dim font-mono">
          {value.count}⌀{value.diameter} {value.grade}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <select
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-1.5 font-mono text-[10px] text-on-surface appearance-none"
          value={value.grade}
          onChange={(e) => onChange({ ...value, grade: e.target.value as RebarGrade })}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-1.5 font-mono text-[10px] text-on-surface appearance-none"
          value={value.diameter}
          onChange={(e) => onChange({ ...value, diameter: Number(e.target.value) })}
        >
          {COMMON_DIA.map((d) => (
            <option key={d} value={d}>⌀{d}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={20}
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-2 font-mono text-[10px] text-on-surface text-center"
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
    <div className="rounded-lg border border-white/5 bg-surface-container-highest/30 overflow-hidden">
      <div className="px-3 py-2 bg-surface-container-highest/50 border-b border-white/5 flex items-center justify-between">
        <span className="font-label-numeric text-[10px] text-primary-fixed-dim font-mono">第 {idx + 1} / {total} 跨</span>
        <span className="font-label-numeric text-[10px] text-on-surface-variant font-mono">ln = {span.ln}mm</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <NumField label="净跨 ln" value={span.ln} onChange={(v) => onChange({ ...span, ln: v })} step={100} min={1000} max={15000} unit="mm" />
          <NumField label="左支座 hc" value={span.hcLeft} onChange={(v) => onChange({ ...span, hcLeft: v })} step={50} min={200} max={1200} unit="mm" />
          <NumField label="右支座 hc" value={span.hcRight} onChange={(v) => onChange({ ...span, hcRight: v })} step={50} min={200} max={1200} unit="mm" />
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
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="text-[10px] tracking-widest text-on-surface-variant flex items-center gap-1">
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
              min={50}
              max={200}
              unit="mm"
            />
            <NumField
              label="非加密间距"
              value={span.stirrup.spacingSparse}
              onChange={(v) => onChange({ ...span, stirrup: { ...span.stirrup, spacingSparse: v } })}
              step={25}
              min={50}
              max={400}
              unit="mm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- AI Copilot Panel ---------- */

function AiCopilot() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Glassy header */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 sticky top-0 bg-surface-container-high/90 backdrop-blur-md z-10">
        <span className="material-symbols-outlined text-primary-container text-[18px]">smart_toy</span>
        <span className="font-body-sm text-body-sm font-medium text-on-surface">AI 结构助手</span>
      </div>
      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {/* AI Message */}
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 border border-primary-container/30">
            <span className="material-symbols-outlined text-primary-container text-[14px]">auto_awesome</span>
          </div>
          <div className="flex-1 bg-surface-container-highest/50 rounded-r-lg rounded-bl-lg p-3 border border-white/5 text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
            已分析当前梁配筋方案。根据GB50010-2010规范，体积配箍率偏高，存在优化空间。
            <br /><br />
            建议将加密区箍筋间距从 @100 调整为 @150。
          </div>
        </div>
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          <button className="px-3 py-1.5 rounded-full border border-primary-fixed-dim/40 bg-primary-fixed-dim/5 text-primary-fixed-dim font-body-sm text-[11px] hover:bg-primary-fixed-dim/10 transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span> 建议优化
          </button>
          <button className="px-3 py-1.5 rounded-full border border-white/10 bg-surface-container-lowest text-on-surface font-body-sm text-[11px] hover:bg-white/5 transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">rule</span> 查看规范
          </button>
        </div>
      </div>
      {/* Input */}
      <div className="p-3 border-t border-white/5 bg-surface-container-highest/20 shrink-0">
        <div className="relative">
          <input
            className="w-full bg-surface-container-lowest border border-white/10 rounded-full py-2 pl-4 pr-10 text-body-sm font-body-sm text-on-surface focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors placeholder:text-on-surface-variant/40"
            placeholder="输入优化指令..."
            type="text"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container hover:bg-primary-container/20 transition-colors">
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Parameters Tab Content ---------- */

function ParamContent() {
  const params = useBeamStore((s) => s.params);
  const setParams = useBeamStore((s) => s.setParams);
  const update = (patch: Partial<BeamParams>) => setParams((p) => ({ ...p, ...patch }));

  return (
    <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-white/10">
      {/* Parameter Adjustment Panel */}
      <div className="p-5 flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h3 className="font-body-md text-body-md font-semibold text-on-surface tracking-wide font-bold">
            截面参数 <span className="text-on-surface-variant font-normal text-[11px]">(Section Props)</span>
          </h3>
          <span className="px-2 py-0.5 rounded bg-surface-container-lowest border border-white/5 font-label-numeric text-[10px] text-primary-fixed-dim font-mono">
            ID: KL-1
          </span>
        </div>

        {/* Slider fields */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-body-sm text-body-sm text-on-surface-variant flex justify-between">
              <span>宽度 (Width) <i>b</i></span>
              <span className="font-label-numeric text-primary-fixed-dim font-mono">{params.b} mm</span>
            </label>
            <input
              type="range" min={150} max={800} value={Math.max(150, Math.min(800, params.b))} step={50}
              onChange={(e) => update({ b: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body-sm text-body-sm text-on-surface-variant flex justify-between">
              <span>高度 (Height) <i>h</i></span>
              <span className="font-label-numeric text-primary-fixed-dim font-mono">{params.h} mm</span>
            </label>
            <input
              type="range" min={200} max={1200} value={Math.max(200, Math.min(1200, params.h))} step={50}
              onChange={(e) => update({ h: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div className="divider-gradient" />

        {/* Properties Form */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">材质</h4>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="混凝土 (Concrete)"
              value={params.concrete}
              options={CONCRETES}
              onChange={(v) => update({ concrete: v })}
            />
            <SelectField
              label="主筋 (Main Rebar)"
              value={params.topThrough.grade}
              options={GRADES}
              onChange={(v) => update({ topThrough: { ...params.topThrough, grade: v } })}
            />
          </div>
          <SelectField
            label="抗震等级"
            value={params.seismic}
            options={SEISMICS}
            onChange={(v) => update({ seismic: v })}
            fmt={(v) => `抗震${['一', '二', '三', '四'][(v as number) - 1]}级（等级 ${['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][(v as number) - 1]}）`}
          />
          <div className="flex flex-col gap-1 pt-2">
            <label className="font-body-sm text-[11px] text-on-surface-variant">保护层厚度 (Cover Layer)</label>
            <div className="relative">
              <input
                type="number"
                className="w-full bg-surface-container-lowest border border-white/10 rounded px-3 py-1.5 font-label-numeric text-label-numeric text-on-surface focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none text-right pr-10 font-mono"
                value={params.cover}
                min={15}
                max={50}
                onChange={(e) => update({ cover: Math.max(15, Math.min(50, Number(e.target.value))) })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-label-numeric text-[11px] text-on-surface-variant pointer-events-none font-mono">mm</span>
            </div>
          </div>
        </div>

        <div className="divider-gradient" />

        {/* Top through */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">上部贯通筋</h4>
          <BundleEditor label="上部贯通" value={params.topThrough} onChange={(b) => update({ topThrough: b })} />
        </div>

        <div className="divider-gradient" />

        {/* Spans */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">
              跨列表 · 共 {params.spans.length} 跨
            </h4>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  setParams((p) => ({
                    ...p,
                    spans: [...p.spans, { ...p.spans[p.spans.length - 1] }],
                  }))
                }
                className="w-7 h-7 flex items-center justify-center rounded border border-primary-fixed-dim/30 text-primary-fixed-dim hover:bg-primary-fixed-dim/10 transition-colors"
                title="增加一跨"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
              </button>
              <button
                disabled={params.spans.length <= 1}
                onClick={() => setParams((p) => ({ ...p, spans: p.spans.slice(0, -1) }))}
                className="w-7 h-7 flex items-center justify-center rounded border border-white/10 text-on-surface-variant hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

        {/* Apply button */}
        <button className="mt-2 w-full py-2 bg-surface-container border border-primary-fixed-dim/30 text-primary-fixed-dim font-body-sm text-body-sm rounded hover:bg-primary-fixed-dim hover:text-on-primary transition-colors duration-200">
          应用更新
        </button>
      </div>
    </div>
  );
}

/* ---------- Inspector root ---------- */

export function ParamPanel() {
  const [activeTab, setActiveTab] = useState<'params' | 'ai'>('params');
  const collapsed = useBeamStore((s) => s.ui.inspectorCollapsed);
  const setUi = useBeamStore((s) => s.setUi);

  if (collapsed) {
    return (
      <aside className="bg-[#0d0d0d] border-l border-white/5 flex flex-col h-full shrink-0 z-30 w-10 items-center py-3 gap-2">
        <button
          onClick={() => setUi({ inspectorCollapsed: false })}
          title="展开参数面板"
          className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:text-primary-fixed-dim hover:bg-white/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <div className="w-8 h-8 flex items-center justify-center text-primary-fixed-dim">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            settings_input_component
          </span>
        </div>
        <div className="flex-1" />
        <div className="rotate-180 [writing-mode:vertical-rl] text-[11px] tracking-widest text-on-surface-variant/50">
          参数
        </div>
      </aside>
    );
  }

  return (
    <aside className="bg-[#0d0d0d] border-l border-white/5 flex flex-col h-full shrink-0 z-30" style={{ width: 280 }}>
      {/* Inspector Nav Tabs */}
      <div className="flex border-b border-white/10 shrink-0 bg-surface-container-highest/50">
        <button
          onClick={() => setActiveTab('params')}
          className={`flex-1 flex flex-col items-center justify-center p-3 font-body-sm text-body-sm font-bold transition-all ${
            activeTab === 'params'
              ? 'bg-primary-container/10 text-primary-fixed-dim border-b-2 border-primary-fixed-dim'
              : 'text-on-surface-variant hover:bg-white/5'
          }`}
        >
          <span
            className="material-symbols-outlined text-[18px] mb-1"
            style={activeTab === 'params' ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            settings_input_component
          </span>
          参数
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 flex flex-col items-center justify-center p-3 font-body-sm text-body-sm transition-all ${
            activeTab === 'ai'
              ? 'bg-primary-container/10 text-primary-fixed-dim border-b-2 border-primary-fixed-dim font-bold'
              : 'text-on-surface-variant hover:bg-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] mb-1">smart_toy</span>
          AI 助手
        </button>
      </div>

      {/* Content */}
      {activeTab === 'params' ? <ParamContent /> : <AiCopilot />}

      {/* Diagnostics Footer */}
      <div className="px-2 py-2 mt-auto border-t border-white/10 bg-surface-container-highest/50 shrink-0">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center text-on-surface-variant p-2 hover:bg-white/5 transition-all font-body-sm text-body-sm rounded active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px] mb-1">monitoring</span>
          诊断 Diagnostics
        </a>
      </div>
    </aside>
  );
}
