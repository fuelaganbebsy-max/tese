import { useStairStore } from '../../store/stairStore';
import { useMemberStore } from '../../store/memberStore';
import { deriveStair } from '../../domain/at/derive';
import type { StairParams, StairTopAnchorMode, StairRebarSpec } from '../../domain/at/types';
import { NumField } from '../fields/NumField';
import { SelectField } from '../fields/SelectField';
import { BundleEditor, GRADES } from '../fields/BundleEditor';

const ANCHOR_MODES: { value: StairTopAnchorMode; label: string }[] = [
  { value: 'hinge', label: '铰接 (0.35lab)' },
  { value: 'full', label: '充分利用抗拉 (0.6lab)' },
];

const CONCRETE_OPTIONS: string[] = ['C25', 'C30', 'C35', 'C40', 'C45', 'C50'];

function formatCheckValue(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} mm` : '无效值';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold text-primary-fixed-dim uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  );
}

function RebarSpecEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StairRebarSpec;
  onChange: (v: StairRebarSpec) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-body-sm text-[11px] text-on-surface-variant">{label}</label>
        <span className="font-label-numeric text-[10px] text-primary-fixed-dim font-mono">
          {value.grade} ⌀{value.diameter} @{value.spacing}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <select
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-1.5 font-mono text-[10px] text-on-surface appearance-none"
          value={value.grade}
          onChange={(e) => onChange({ ...value, grade: e.target.value as StairRebarSpec['grade'] })}
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
          {[6, 8, 10, 12, 14, 16, 18, 20, 22, 25].map((d) => (
            <option key={d} value={d}>⌀{d}</option>
          ))}
        </select>
        <input
          type="number"
          min={50}
          max={500}
          step={10}
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-2 font-mono text-[10px] text-on-surface text-center"
          value={value.spacing}
          onChange={(e) => onChange({ ...value, spacing: Math.max(50, Number(e.target.value)) })}
        />
      </div>
    </div>
  );
}

export function StairParamContent() {
  const params = useStairStore((s) => s.params);
  const setParams = useStairStore((s) => s.setParams);
  const activeType = useMemberStore((s) => s.activeType);
  const update = (patch: Partial<StairParams>) => setParams((p) => ({ ...p, ...patch }));
  const failedChecks = deriveStair(params).checks.filter((check) => !check.ok);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-white/10">
      <div className="p-5 flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h3 className="font-body-md text-body-md font-semibold text-on-surface tracking-wide font-bold">
            {activeType} 楼梯参数 <span className="text-on-surface-variant font-normal text-[11px]">(Stair {activeType} Props)</span>
          </h3>
          <span className="px-2 py-0.5 rounded bg-surface-container-lowest border border-white/5 font-label-numeric text-[10px] text-primary-fixed-dim font-mono">
            ID: {activeType}-1
          </span>
        </div>

        <Section title="几何尺寸">
          <NumField label="水平投影长度 ln" value={params.ln} onChange={(v) => update({ ln: v })} unit="mm" min={1000} />
          <NumField label="踏步段总高度 Hs" value={params.Hs} onChange={(v) => update({ Hs: v })} unit="mm" min={500} />
          <NumField label="踏步级数" value={params.stepCount} onChange={(v) => update({ stepCount: Math.max(2, Math.round(v)) })} unit="级" min={2} step={1} />
          <NumField label="梯板厚度 h" value={params.h} onChange={(v) => update({ h: Number.isFinite(v) ? Math.max(0, v) : params.h })} unit="mm" min={0} />
          <NumField label="梯板宽度 b" value={params.b} onChange={(v) => update({ b: Math.max(600, v) })} unit="mm" min={600} />
          <SelectField
            label="保护层 c"
            value={params.cover}
            options={[15, 20, 25, 30, 40]}
            onChange={(v) => update({ cover: v })}
            fmt={(v) => `${v} mm`}
          />
        </Section>

        <Section title="材料">
          <SelectField
            label="混凝土强度等级"
            value={params.concrete}
            options={CONCRETE_OPTIONS}
            onChange={(v) => update({ concrete: v as StairParams['concrete'] })}
          />
        </Section>

        <Section title="梯梁支座">
          <NumField label="低端梯梁宽" value={params.lowBeam.width} onChange={(v) => update({ lowBeam: { ...params.lowBeam, width: Math.max(150, v) } })} unit="mm" min={150} />
          <NumField label="低端梯梁高" value={params.lowBeam.height} onChange={(v) => update({ lowBeam: { ...params.lowBeam, height: Math.max(200, v) } })} unit="mm" min={200} />
          <NumField label="低端梯梁横向长度" value={params.lowBeam.length} onChange={(v) => update({ lowBeam: { ...params.lowBeam, length: Math.max(1, v) } })} unit="mm" min={1} step={50} />
          <NumField label="高端梯梁宽" value={params.highBeam.width} onChange={(v) => update({ highBeam: { ...params.highBeam, width: Math.max(150, v) } })} unit="mm" min={150} />
          <NumField label="高端梯梁高" value={params.highBeam.height} onChange={(v) => update({ highBeam: { ...params.highBeam, height: Math.max(200, v) } })} unit="mm" min={200} />
          <NumField label="高端梯梁横向长度" value={params.highBeam.length} onChange={(v) => update({ highBeam: { ...params.highBeam, length: Math.max(1, v) } })} unit="mm" min={1} step={50} />
          {failedChecks.length > 0 && (
            <div className="space-y-2 pt-1">
              <h5 className="text-[10px] font-semibold text-on-surface-variant">校核提示</h5>
              {failedChecks.map((check, index) => {
                const isError = check.severity === 'error';
                return (
                  <div
                    key={`${check.code}-${check.end ?? index}`}
                    className={`border px-3 py-2 ${isError
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}
                  >
                    <div className="flex items-start gap-2 text-[11px] leading-4">
                      <span className="shrink-0 font-semibold">{isError ? '错误' : '警告'}</span>
                      <span>{check.message}</span>
                    </div>
                    {(check.required !== undefined || check.provided !== undefined) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-mono opacity-80">
                        {check.required !== undefined && <span>要求: {formatCheckValue(check.required)}</span>}
                        {check.provided !== undefined && <span>当前: {formatCheckValue(check.provided)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="配筋">
          <RebarSpecEditor label="下部纵筋" value={params.bottomBar} onChange={(v) => update({ bottomBar: v })} />
          <RebarSpecEditor label="上部纵筋" value={params.topBar} onChange={(v) => update({ topBar: v })} />
          <RebarSpecEditor label="分布筋" value={params.distributionBar} onChange={(v) => update({ distributionBar: v })} />
          <NumField label="上部纵筋跨内水平投影（ln/4）" value={params.topExtend ?? Math.round(params.ln / 4)} onChange={(v) => update({ topExtend: Math.max(0, v) })} unit="mm" min={0} />
          <SelectField
            label="上部纵筋支座锚固"
            value={params.topAnchorMode ?? 'hinge'}
            options={ANCHOR_MODES.map((m) => m.value)}
            onChange={(v) => update({ topAnchorMode: v as StairTopAnchorMode })}
            fmt={(v) => ANCHOR_MODES.find((m) => m.value === v)?.label ?? v}
          />
        </Section>

      </div>
    </div>
  );
}
