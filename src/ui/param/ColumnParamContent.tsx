import { useColumnStore } from '../../store/columnStore';
import type { ColumnParams, ColumnLongitudinalMode, ColumnSectionType } from '../../domain/kz/types';
import { NumField } from '../fields/NumField';
import { SelectField } from '../fields/SelectField';
import { COMMON_DIA, STIRRUP_DIA, GRADES } from '../fields/BundleEditor';

const SECTION_TYPES: { value: ColumnSectionType; label: string }[] = [
  { value: 'rect', label: '矩形' },
  { value: 'circle', label: '圆形' },
];

const COLUMN_LONGITUDINAL_MODES: { value: ColumnLongitudinalMode; label: string }[] = [
  { value: 'uniform', label: '全部同配' },
  { value: 'grouped', label: '分组配筋' },
];

export function ColumnParamContent() {
  const params = useColumnStore((s) => s.params);
  const setParams = useColumnStore((s) => s.setParams);
  const update = (patch: Partial<ColumnParams>) => setParams((p) => ({ ...p, ...patch }));
  const longitudinalMode = params.longitudinalMode ?? 'uniform';
  const cornerBar = params.cornerBar ?? { ...params.longitudinal, count: 4 };
  const bSideMidBar = params.bSideMidBar ?? { ...params.longitudinal, count: Math.max(0, params.longitudinal.count - 2) };
  const hSideMidBar = params.hSideMidBar ?? { ...params.longitudinal, count: Math.max(0, params.longitudinal.count - 2) };
  const legsX = params.stirrup.legsX ?? (params.stirrup.legs === 4 ? 3 : 2);
  const legsY = params.stirrup.legsY ?? (params.stirrup.legs === 4 ? 3 : 2);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-white/10">
      <div className="p-5 flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h3 className="font-body-md text-body-md font-semibold text-on-surface tracking-wide font-bold">
            柱参数 <span className="text-on-surface-variant font-normal text-[11px]">(Column Props)</span>
          </h3>
          <span className="px-2 py-0.5 rounded bg-surface-container-lowest border border-white/5 font-label-numeric text-[10px] text-primary-fixed-dim font-mono">
            ID: KZ-1
          </span>
        </div>

        {/* Section type */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">截面类型</h4>
          <div className="flex gap-2">
            {SECTION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => update({ sectionType: t.value })}
                className={`flex-1 py-2 rounded border text-body-sm font-body-sm transition-colors ${
                  params.sectionType === t.value
                    ? 'bg-primary-fixed-dim/15 border-primary-fixed-dim/50 text-primary-fixed-dim font-medium'
                    : 'bg-surface-container-lowest border-white/10 text-on-surface-variant hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">截面尺寸</h4>
          {params.sectionType === 'rect' ? (
            <div className="grid grid-cols-2 gap-3">
              <NumField label="宽度 b" value={params.b} onChange={(v) => update({ b: v })} step={50} min={300} max={1200} unit="mm" />
              <NumField label="高度 h" value={params.h} onChange={(v) => update({ h: v })} step={50} min={300} max={1200} unit="mm" />
            </div>
          ) : (
            <NumField label="直径 D" value={params.D} onChange={(v) => update({ D: v })} step={50} min={300} max={1200} unit="mm" />
          )}
        </div>

        {/* Height */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">楼层参数</h4>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="层高" value={params.floorHeight} onChange={(v) => update({ floorHeight: v, Hn: v - params.beamHeight })} step={100} min={2000} max={8000} unit="mm" />
            <NumField label="梁高" value={params.beamHeight} onChange={(v) => update({ beamHeight: v, Hn: params.floorHeight - v })} step={50} min={300} max={1200} unit="mm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-body-sm text-[11px] text-on-surface-variant">净高 Hn</label>
            <div className="w-full bg-surface-container-lowest border border-white/10 rounded px-3 py-1.5 font-label-numeric text-label-numeric text-on-surface/60 text-right font-mono pr-10 relative">
              {params.Hn}
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-label-numeric text-[11px] text-on-surface-variant pointer-events-none font-mono">mm</span>
            </div>
          </div>
        </div>

        <div className="divider-gradient" />

        {/* Material */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">材质</h4>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="混凝土"
              value={params.concrete}
              options={['C25', 'C30', 'C35', 'C40', 'C45', 'C50'] as const}
              onChange={(v) => update({ concrete: v })}
            />
            <SelectField
              label="主筋等级"
              value={params.longitudinal.grade}
              options={GRADES}
              onChange={(v) => update({ longitudinal: { ...params.longitudinal, grade: v } })}
            />
          </div>
          <SelectField
            label="抗震等级"
            value={params.seismic}
            options={[1, 2, 3, 4] as const}
            onChange={(v) => update({ seismic: v })}
            fmt={(v) => `抗震${['一', '二', '三', '四'][(v as number) - 1]}级（等级 ${['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][(v as number) - 1]}）`}
          />
          <SelectField label="保护层厚度 c" value={params.cover} options={[20, 25, 30, 35, 40, 50]} onChange={(v) => update({ cover: v })} fmt={(v) => `${v} mm`} />
        </div>

        <div className="divider-gradient" />

        {/* Longitudinal */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">纵筋</h4>
          <div className="flex gap-2">
            {COLUMN_LONGITUDINAL_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => update({ longitudinalMode: mode.value })}
                className={`flex-1 py-1.5 rounded border text-[11px] font-mono transition-colors ${
                  longitudinalMode === mode.value
                    ? 'bg-primary-fixed-dim/15 border-primary-fixed-dim/50 text-primary-fixed-dim font-medium'
                    : 'bg-surface-container-lowest border-white/10 text-on-surface-variant hover:bg-white/5'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="等级"
              value={params.longitudinal.grade}
              options={GRADES}
              onChange={(v) => update({ longitudinal: { ...params.longitudinal, grade: v } })}
            />
            <SelectField
              label="直径"
              value={params.longitudinal.diameter}
              options={COMMON_DIA as unknown as number[]}
              onChange={(v) => update({ longitudinal: { ...params.longitudinal, diameter: v } })}
              fmt={(v) => `⌀${v}`}
            />
            <NumField label="每边根数" value={params.longitudinal.count} onChange={(v) => update({ longitudinal: { ...params.longitudinal, count: v } })} step={1} min={2} max={8} />
          </div>
          {longitudinalMode === 'grouped' && params.sectionType === 'rect' && (
            <div className="space-y-3 pl-2 border-l-2 border-primary-fixed-dim/30">
              <div className="grid grid-cols-3 gap-2">
                <SelectField
                  label="角筋直径"
                  value={cornerBar.diameter}
                  options={COMMON_DIA as unknown as number[]}
                  onChange={(v) => update({ cornerBar: { ...cornerBar, diameter: v, grade: params.longitudinal.grade, count: 4 } })}
                  fmt={(v) => `⌀${v}`}
                />
                <NumField label="b边中部/边" value={bSideMidBar.count} onChange={(v) => update({ bSideMidBar: { ...bSideMidBar, grade: params.longitudinal.grade, count: v } })} step={1} min={0} max={8} />
                <SelectField
                  label="b边直径"
                  value={bSideMidBar.diameter}
                  options={COMMON_DIA as unknown as number[]}
                  onChange={(v) => update({ bSideMidBar: { ...bSideMidBar, grade: params.longitudinal.grade, diameter: v } })}
                  fmt={(v) => `⌀${v}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="h边中部/边" value={hSideMidBar.count} onChange={(v) => update({ hSideMidBar: { ...hSideMidBar, grade: params.longitudinal.grade, count: v } })} step={1} min={0} max={8} />
                <SelectField
                  label="h边直径"
                  value={hSideMidBar.diameter}
                  options={COMMON_DIA as unknown as number[]}
                  onChange={(v) => update({ hSideMidBar: { ...hSideMidBar, grade: params.longitudinal.grade, diameter: v } })}
                  fmt={(v) => `⌀${v}`}
                />
              </div>
            </div>
          )}
        </div>

        <div className="divider-gradient" />

        {/* Stirrup */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">箍筋</h4>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="等级"
              value={params.stirrup.grade}
              options={GRADES}
              onChange={(v) => update({ stirrup: { ...params.stirrup, grade: v } })}
            />
            <SelectField
              label="直径"
              value={params.stirrup.diameter}
              options={STIRRUP_DIA as unknown as number[]}
              onChange={(v) => update({ stirrup: { ...params.stirrup, diameter: v } })}
              fmt={(v) => `⌀${v}`}
            />
            <NumField label="加密间距" value={params.stirrup.spacingDense} onChange={(v) => update({ stirrup: { ...params.stirrup, spacingDense: v } })} step={25} min={50} max={200} unit="mm" />
            <NumField label="非加密间距" value={params.stirrup.spacingSparse} onChange={(v) => update({ stirrup: { ...params.stirrup, spacingSparse: v } })} step={25} min={50} max={400} unit="mm" />
            <SelectField
              label="类型编号"
              value={params.stirrup.typeNo ?? 1}
              options={[1, 2, 3, 4]}
              onChange={(v) => update({ stirrup: { ...params.stirrup, typeNo: v as 1 | 2 | 3 | 4 } })}
              fmt={(v) => `类型${v}`}
            />
            <SelectField
              label="m 肢(b向)"
              value={legsX}
              options={[2, 3, 4, 5, 6]}
              onChange={(v) => update({ stirrup: { ...params.stirrup, legsX: v, legs: (v > 2 || legsY > 2 ? 4 : 2) as 2 | 4 } })}
              fmt={(v) => `${v}肢`}
            />
            <SelectField
              label="n 肢(h向)"
              value={legsY}
              options={[2, 3, 4, 5, 6]}
              onChange={(v) => update({ stirrup: { ...params.stirrup, legsY: v, legs: (legsX > 2 || v > 2 ? 4 : 2) as 2 | 4 } })}
              fmt={(v) => `${v}肢`}
            />
            <SelectField
              label="箍筋类型"
              value={params.stirrup.type}
              options={['rect', 'well', 'composite'] as const}
              onChange={(v) => update({ stirrup: { ...params.stirrup, type: v as 'rect' | 'well' | 'composite' } })}
              fmt={(v) => ({ rect: '矩形', well: '井字', composite: '复合' })[v]}
            />
          </div>
        </div>

        <button className="mt-2 w-full py-2 bg-surface-container border border-primary-fixed-dim/30 text-primary-fixed-dim font-body-sm text-body-sm rounded hover:bg-primary-fixed-dim hover:text-on-primary transition-colors duration-200">
          应用更新
        </button>
      </div>
    </div>
  );
}
