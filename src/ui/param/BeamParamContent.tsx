import { useBeamStore } from '../../store/beamStore';
import type { BeamParams, ConcreteGrade, SeismicLevel } from '../../domain/kl/types';
import { SelectField } from '../fields/SelectField';
import { GRADES } from '../fields/BundleEditor';
import { SpanEditor } from './SpanEditor';

const CONCRETES: ConcreteGrade[] = ['C25', 'C30', 'C35', 'C40', 'C45', 'C50'];
const SEISMICS: SeismicLevel[] = [1, 2, 3, 4];

export function BeamParamContent() {
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

          {/* Beam-Column gap */}
          <div className="flex flex-col gap-1.5">
            <label className="font-body-sm text-body-sm text-on-surface-variant">梁前边距柱前边</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={Math.max(0, 600 - params.b)} value={Math.max(0, Math.min(600 - params.b, params.beamColumnGapFront ?? 150))} step={5}
                onChange={(e) => update({ beamColumnGapFront: Number(e.target.value) })}
                className="flex-1"
              />
              <div className="relative w-20 shrink-0">
                <input type="number" min={0} max={Math.max(0, 600 - params.b)} step={5}
                  value={params.beamColumnGapFront ?? 150}
                  onChange={(e) => update({ beamColumnGapFront: Math.max(0, Math.min(600 - params.b, Number(e.target.value))) })}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded px-2 py-1 font-label-numeric text-label-numeric text-on-surface focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none text-right pr-8 font-mono"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-label-numeric text-[10px] text-on-surface-variant pointer-events-none font-mono">mm</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              {[
                { label: '齐平', value: 0 },
                { label: '居中', value: Math.round((600 - params.b) / 2) },
                { label: '反齐', value: Math.max(0, 600 - params.b) },
              ].map((opt) => (
                <button key={opt.label}
                  onClick={() => update({ beamColumnGapFront: opt.value })}
                  className={`flex-1 py-1 rounded text-[11px] font-mono border transition-colors duration-150 ${
                    (params.beamColumnGapFront ?? 150) === opt.value
                      ? 'bg-primary-fixed-dim/20 border-primary-fixed-dim text-primary-fixed-dim'
                      : 'bg-surface-container-lowest border-white/10 text-on-surface-variant hover:border-primary-fixed-dim/40'
                  }`}
                >
                  {opt.label} ({opt.value})
                </button>
              ))}
            </div>
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
          <div className="pt-2">
            <SelectField label="保护层厚度 c" value={params.cover} options={[20, 25, 30, 35, 40, 50]} onChange={(v) => update({ cover: v })} fmt={(v) => `${v} mm`} />
          </div>
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
                beamWidth={params.b}
                cover={params.cover}
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
