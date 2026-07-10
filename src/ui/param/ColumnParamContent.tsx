import { useState } from 'react';
import { useColumnStore } from '../../store/columnStore';
import type {
  ColumnParams,
  ColumnLongitudinalMode,
  ColumnTopRebar,
  ColumnStirrupSpec,
} from '../../domain/kz/types';
import { getParamsForFloor } from '../../domain/kz/types';
import type { RebarBundle } from '../../domain/kl/types';
import { NumField } from '../fields/NumField';
import { SelectField } from '../fields/SelectField';
import { COMMON_DIA, STIRRUP_DIA, GRADES } from '../fields/BundleEditor';

const COLUMN_LONGITUDINAL_MODES: { value: ColumnLongitudinalMode; label: string }[] = [
  { value: 'uniform', label: '全部同配' },
  { value: 'grouped', label: '分组配筋' },
];

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

/* ---------- Align toggle (mutually exclusive on/off per direction) ---------- */
function AlignToggle<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex gap-1 p-0.5 rounded-lg bg-surface-container-highest/60 border border-white/5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? null : o.value)}
          className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
            value === o.value
              ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim border border-primary-fixed-dim/40'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 纵筋模块（上下层复用） ---------- */
function LongitudinalPanel({
  params,
  isUpper,
  update,
}: {
  params: ColumnParams;
  isUpper: boolean;
  update: (patch: Partial<ColumnParams>) => void;
}) {
  const floorParams = getParamsForFloor(params, isUpper);
  const topRebar = params.topRebar ?? {};
  const mode = floorParams.longitudinalMode ?? 'uniform';
  const longitudinal = floorParams.longitudinal;
  const cornerBar = floorParams.cornerBar ?? { ...longitudinal, count: 4 };
  const uniformMid = Math.max(0, longitudinal.count - 2);
  const bSideMidBar = floorParams.bSideMidBar ?? { ...longitudinal, count: uniformMid };
  const hSideMidBar = floorParams.hSideMidBar ?? { ...longitudinal, count: uniformMid };

  const updateTopRebar = (patch: Partial<ColumnTopRebar>) =>
    update({ topRebar: { ...topRebar, ...patch } });

  const clearUniformOverrides = () => ({
    cornerBar: undefined,
    bSideMidBar: undefined,
    hSideMidBar: undefined,
  });
  const setMode = (v: ColumnLongitudinalMode) => {
    if (v === 'uniform') {
      // 切换到全部同配：清除分组 overrides，统一以 longitudinal 为准
      isUpper
        ? updateTopRebar({ longitudinalMode: v, ...clearUniformOverrides() })
        : update({ longitudinalMode: v, ...clearUniformOverrides() });
    } else {
      isUpper ? updateTopRebar({ longitudinalMode: v }) : update({ longitudinalMode: v });
    }
  };
  const setLongitudinalGrade = (grade: string) => {
    const next = { ...longitudinal, grade: grade as any };
    if (mode === 'uniform') {
      isUpper
        ? updateTopRebar({ longitudinal: next, ...clearUniformOverrides() })
        : update({ longitudinal: next, ...clearUniformOverrides() });
    } else {
      isUpper ? updateTopRebar({ longitudinal: next }) : update({ longitudinal: next });
    }
  };
  const setLongitudinalCount = (count: number) => {
    const next = { ...longitudinal, count };
    if (mode === 'uniform') {
      isUpper
        ? updateTopRebar({ longitudinal: next, ...clearUniformOverrides() })
        : update({ longitudinal: next, ...clearUniformOverrides() });
    } else {
      isUpper ? updateTopRebar({ longitudinal: next }) : update({ longitudinal: next });
    }
  };
  const setUniformDiameter = (diameter: number) => {
    const next = { ...longitudinal, diameter };
    isUpper
      ? updateTopRebar({ longitudinal: next, ...clearUniformOverrides() })
      : update({ longitudinal: next, ...clearUniformOverrides() });
  };
  const setCornerBar = (patch: Partial<RebarBundle>) => {
    const next = { ...cornerBar, ...patch };
    isUpper ? updateTopRebar({ cornerBar: next }) : update({ cornerBar: next });
  };
  const setBSideMidBar = (patch: Partial<RebarBundle>) => {
    const next = { ...bSideMidBar, ...patch };
    isUpper ? updateTopRebar({ bSideMidBar: next }) : update({ bSideMidBar: next });
  };
  const setHSideMidBar = (patch: Partial<RebarBundle>) => {
    const next = { ...hSideMidBar, ...patch };
    isUpper ? updateTopRebar({ hSideMidBar: next }) : update({ hSideMidBar: next });
  };

  return (
    <div className="space-y-3">
      <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">纵筋</h4>
      <div className="flex gap-2">
        {COLUMN_LONGITUDINAL_MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`flex-1 py-1.5 rounded border text-[11px] font-mono transition-colors ${
              mode === m.value
                ? 'bg-primary-fixed-dim/15 border-primary-fixed-dim/50 text-primary-fixed-dim font-medium'
                : 'bg-surface-container-lowest border-white/10 text-on-surface-variant hover:bg-white/5'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
          <span className="text-[11px] text-on-surface-variant whitespace-nowrap">等级</span>
          <select
            className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
            value={longitudinal.grade}
            onChange={(e) => setLongitudinalGrade(e.target.value)}
          >
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">{mode === 'uniform' ? '纵筋直径' : '角筋直径'}</span>
            <select
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
              value={cornerBar.diameter}
              onChange={(e) => {
                const d = Number(e.target.value);
                mode === 'uniform'
                  ? setUniformDiameter(d)
                  : setCornerBar({ diameter: d, grade: longitudinal.grade, count: 4 });
              }}
            >
              {(COMMON_DIA as unknown as number[]).map((d) => <option key={d} value={d}>⌀{d}</option>)}
            </select>
          </div>
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">{mode === 'uniform' ? '每边钢筋的数量' : '钢筋数量'}</span>
            <input type="number" value={longitudinal.count}
              onChange={(e) => setLongitudinalCount(Number(e.target.value))}
              step={1} min={2} max={8}
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono" />
            <span className="text-[10px] text-on-surface-variant/50 font-mono">根</span>
          </div>
        </div>
      </div>
      {mode === 'grouped' && (
        <div className="space-y-3 pl-2 border-l-2 border-primary-fixed-dim/30">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
              <span className="text-[10px] text-on-surface-variant whitespace-nowrap">b边中部</span>
              <input type="number" value={bSideMidBar.count}
                onChange={(e) => setBSideMidBar({ grade: longitudinal.grade, count: Number(e.target.value) })}
                step={1} min={0} max={8}
                className="w-10 bg-surface-container-highest border border-white/10 rounded px-1 py-0.5 font-label-numeric text-label-numeric text-on-surface text-center outline-none focus:border-primary-fixed-dim font-mono" />
              <span className="text-[10px] text-on-surface-variant/50 font-mono">根</span>
              <span className="text-on-surface-variant mx-0.5">×</span>
              <SelectField
                label=""
                value={bSideMidBar.diameter}
                options={COMMON_DIA as unknown as number[]}
                onChange={(v) => setBSideMidBar({ grade: longitudinal.grade, diameter: v })}
                fmt={(v) => `⌀${v}`}
              />
            </div>
            <div className="flex-1 flex items-center gap-1 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
              <span className="text-[10px] text-on-surface-variant whitespace-nowrap">h边中部</span>
              <input type="number" value={hSideMidBar.count}
                onChange={(e) => setHSideMidBar({ grade: longitudinal.grade, count: Number(e.target.value) })}
                step={1} min={0} max={8}
                className="w-10 bg-surface-container-highest border border-white/10 rounded px-1 py-0.5 font-label-numeric text-label-numeric text-on-surface text-center outline-none focus:border-primary-fixed-dim font-mono" />
              <span className="text-[10px] text-on-surface-variant/50 font-mono">根</span>
              <span className="text-on-surface-variant mx-0.5">×</span>
              <SelectField
                label=""
                value={hSideMidBar.diameter}
                options={COMMON_DIA as unknown as number[]}
                onChange={(v) => setHSideMidBar({ grade: longitudinal.grade, diameter: v })}
                fmt={(v) => `⌀${v}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 箍筋模块（上下层复用） ---------- */
function StirrupPanel({
  params,
  isUpper,
  update,
}: {
  params: ColumnParams;
  isUpper: boolean;
  update: (patch: Partial<ColumnParams>) => void;
}) {
  const floorParams = getParamsForFloor(params, isUpper);
  const topRebar = params.topRebar ?? {};
  const stirrup = floorParams.stirrup;
  const legsX = stirrup.legsX ?? (stirrup.legs === 4 ? 3 : 2);
  const legsY = stirrup.legsY ?? (stirrup.legs === 4 ? 3 : 2);

  const updateTopRebar = (patch: Partial<ColumnTopRebar>) =>
    update({ topRebar: { ...topRebar, ...patch } });

  const setStirrup = (patch: Partial<ColumnStirrupSpec>) => {
    const next = { ...stirrup, ...patch };
    isUpper ? updateTopRebar({ stirrup: next }) : update({ stirrup: next });
  };

  return (
    <div className="space-y-3">
      <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">箍筋</h4>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">等级</span>
            <select
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
              value={stirrup.grade}
              onChange={(e) => setStirrup({ grade: e.target.value as any })}
            >
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">直径</span>
            <select
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
              value={stirrup.diameter}
              onChange={(e) => setStirrup({ diameter: Number(e.target.value) })}
            >
              {(STIRRUP_DIA as unknown as number[]).map((d) => <option key={d} value={d}>⌀{d}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">加密间距</span>
            <input type="number" value={stirrup.spacingDense}
              onChange={(e) => setStirrup({ spacingDense: Number(e.target.value) })}
              step={25} min={50} max={200}
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono" />
            <span className="text-[10px] text-on-surface-variant/50 font-mono">mm</span>
          </div>
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">非加密间距</span>
            <input type="number" value={stirrup.spacingSparse}
              onChange={(e) => setStirrup({ spacingSparse: Number(e.target.value) })}
              step={25} min={50} max={400}
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono" />
            <span className="text-[10px] text-on-surface-variant/50 font-mono">mm</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">m 肢(b向)</span>
            <select
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
              value={legsX}
              onChange={(e) => { const v = Number(e.target.value); setStirrup({ legsX: v, legs: (v > 2 || legsY > 2 ? 4 : 2) as 2 | 4 }); }}
            >
              {[2, 3, 4, 5, 6].map((v) => <option key={v} value={v}>{v}肢</option>)}
            </select>
          </div>
          <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">n 肢(h向)</span>
            <select
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
              value={legsY}
              onChange={(e) => { const v = Number(e.target.value); setStirrup({ legsY: v, legs: (legsX > 2 || v > 2 ? 4 : 2) as 2 | 4 }); }}
            >
              {[2, 3, 4, 5, 6].map((v) => <option key={v} value={v}>{v}肢</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ColumnParamContent() {
  const params = useColumnStore((s) => s.params);
  const setParams = useColumnStore((s) => s.setParams);
  const update = (patch: Partial<ColumnParams>) => setParams((p) => ({ ...p, ...patch }));

  // 上层柱偏移：居中 / 偏心（上下/左右边对齐）
  const b = params.b;
  const h = params.h;
  const topB = params.topB ?? b;
  const topH = params.topH ?? h;
  const offsetX = params.topOffsetX ?? 0;
  const offsetZ = params.topOffsetZ ?? 0;
  const approx = (a: number, b: number) => Math.abs(a - b) < 0.1;
  const leftOffset = (topB - b) / 2;
  const rightOffset = (b - topB) / 2;
  const topOffset = (h - topH) / 2;
  const bottomOffset = (topH - h) / 2;
  // 上下对应 h 边（1轴/X 方向），左右对应 b 边（A轴/Z 方向），与右下角剖切面对应
  const vAlign: 'top' | 'bottom' | null = approx(offsetX, topOffset) ? 'top' : approx(offsetX, bottomOffset) ? 'bottom' : null;
  const hAlign: 'left' | 'right' | null = approx(offsetZ, leftOffset) ? 'left' : approx(offsetZ, rightOffset) ? 'right' : null;
  const [alignMode, setAlignModeState] = useState<'center' | 'eccentric'>(() => (offsetX === 0 && offsetZ === 0 ? 'center' : 'eccentric'));
  const setAlignMode = (mode: 'center' | 'eccentric') => {
    setAlignModeState(mode);
    if (mode === 'center') {
      update({ topOffsetX: 0, topOffsetZ: 0 });
    }
  };
  const setVAlign = (v: 'top' | 'bottom' | null) => {
    setAlignModeState('eccentric');
    update({ topOffsetX: v === 'top' ? topOffset : v === 'bottom' ? bottomOffset : 0 });
  };
  const setHAlign = (h: 'left' | 'right' | null) => {
    setAlignModeState('eccentric');
    update({ topOffsetZ: h === 'left' ? leftOffset : h === 'right' ? rightOffset : 0 });
  };

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

        {/* Material */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">材质</h4>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
              <span className="text-[11px] text-on-surface-variant whitespace-nowrap">混凝土</span>
              <select
                className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
                value={params.concrete}
                onChange={(e) => update({ concrete: e.target.value as any })}
              >
                {['C25', 'C30', 'C35', 'C40', 'C45', 'C50'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
              <span className="text-[11px] text-on-surface-variant whitespace-nowrap">主筋等级</span>
              <select
                className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
                value={params.longitudinal.grade}
                onChange={(e) => update({ longitudinal: { ...params.longitudinal, grade: e.target.value as any } })}
              >
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">抗震等级</span>
            <select
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
              value={params.seismic}
              onChange={(e) => update({ seismic: Number(e.target.value) as 1 | 2 | 3 | 4 })}
            >
              {[1, 2, 3, 4].map((v) => (
                <option key={v} value={v}>抗震{['一', '二', '三', '四'][v - 1]}级（等级 {['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][v - 1]}）</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
            <span className="text-[11px] text-on-surface-variant whitespace-nowrap">保护层厚度 c</span>
            <select
              className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
              value={params.cover}
              onChange={(e) => update({ cover: Number(e.target.value) })}
            >
              {[20, 25, 30, 35, 40, 50].map((v) => <option key={v} value={v}>{v} mm</option>)}
            </select>
          </div>
        </div>

        <div className="divider-gradient" />

        {/* ── 上层参数 ── */}
        <div className="rounded-xl border border-white/5 bg-surface-container-lowest/40 overflow-hidden">
          <div className="px-4 py-2.5 bg-primary-fixed-dim/10 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">arrow_upward</span>
            <h4 className="font-body-sm text-body-sm font-semibold text-on-surface font-bold">上层参数</h4>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5">
                <label className="font-body-sm text-[11px] text-on-surface-variant whitespace-nowrap">顶层层高</label>
                <input type="number" value={params.topFloorHeight ?? params.floorHeight}
                  onChange={(v) => { const bh = params.topBeamHeight ?? params.beamHeight; const val = Number((v.target as HTMLInputElement).value); update({ topFloorHeight: val, upperHn: val - bh }); }}
                  step={100} min={2000} max={8000}
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono min-w-0" />
                <span className="font-label-numeric text-[11px] text-on-surface-variant font-mono">mm</span>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5">
                <label className="font-body-sm text-[11px] text-on-surface-variant whitespace-nowrap">柱顶梁高</label>
                <input type="number" value={params.topBeamHeight ?? params.beamHeight}
                  onChange={(v) => { const fh = params.topFloorHeight ?? params.floorHeight; const val = Number((v.target as HTMLInputElement).value); update({ topBeamHeight: val, upperHn: fh - val }); }}
                  step={50} min={300} max={1200}
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono min-w-0" />
                <span className="font-label-numeric text-[11px] text-on-surface-variant font-mono">mm</span>
              </div>
            </div>
            <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-surface-container-highest/30 border border-white/5">
              <span className="text-[11px] text-on-surface-variant">上层净高</span>
              <span className="ml-auto font-label-numeric text-label-numeric text-primary-fixed-dim font-mono font-bold">{params.upperHn ?? params.Hn} mm</span>
              <span className="text-[10px] text-on-surface-variant/50">= 顶层层高 − 柱顶梁高</span>
            </div>
            {/* 顶层柱截面 — 可视化 b × h */}
            <div className="flex items-center gap-2 bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5">
              <label className="font-body-sm text-[11px] text-on-surface-variant whitespace-nowrap">顶层柱截面</label>
              <div className="flex-1 flex items-center gap-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1">
                <span className="text-[10px] text-primary-fixed-dim font-mono font-bold shrink-0">b</span>
                <input type="number" value={params.topB ?? params.b}
                  onChange={(e) => update({ topB: Number(e.target.value) })}
                  step={50} min={300} max={1200}
                  className="flex-1 w-0 bg-transparent font-label-numeric text-label-numeric text-on-surface text-right outline-none font-mono" />
                <span className="text-[10px] text-on-surface-variant/50 font-mono shrink-0">mm</span>
              </div>
              <span className="text-on-surface-variant font-bold shrink-0">×</span>
              <div className="flex-1 flex items-center gap-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1">
                <span className="text-[10px] text-primary-fixed-dim font-mono font-bold shrink-0">h</span>
                <input type="number" value={params.topH ?? params.h}
                  onChange={(e) => update({ topH: Number(e.target.value) })}
                  step={50} min={300} max={1200}
                  className="flex-1 w-0 bg-transparent font-label-numeric text-label-numeric text-on-surface text-right outline-none font-mono" />
                <span className="text-[10px] text-on-surface-variant/50 font-mono shrink-0">mm</span>
              </div>
            </div>
            {/* 上层柱偏移 — 居中 / 偏心（上下/左右边对齐） */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-body-sm text-[11px] text-on-surface-variant whitespace-nowrap">上层柱偏移</label>
                <SlideToggle
                  options={[
                    { value: 'center', label: '居中' },
                    { value: 'eccentric', label: '偏心' },
                  ]}
                  value={alignMode}
                  onChange={(v) => setAlignMode(v as 'center' | 'eccentric')}
                />
              </div>
              {alignMode === 'eccentric' && (
                <div className="grid grid-cols-2 gap-2 pl-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-on-surface-variant w-8">左右</span>
                    <AlignToggle
                      options={[
                        { value: 'left', label: '左边对齐' },
                        { value: 'right', label: '右边对齐' },
                      ]}
                      value={hAlign}
                      onChange={(v) => setHAlign(v as 'left' | 'right' | null)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-on-surface-variant w-8">上下</span>
                    <AlignToggle
                      options={[
                        { value: 'bottom', label: '下边对齐' },
                        { value: 'top', label: '上边对齐' },
                      ]}
                      value={vAlign}
                      onChange={(v) => setVAlign(v as 'top' | 'bottom' | null)}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-surface-container-highest/30 border border-white/5">
              <span className="text-[11px] text-on-surface-variant">上层柱边距</span>
              {alignMode === 'center' ? (
                <span className="ml-auto text-[10px] text-primary-fixed-dim font-mono font-bold leading-relaxed text-center">
                  b边在1轴线的左右两侧长度相等<br />
                  h边在A轴线的左右两侧长度相等
                </span>
              ) : (
                <span className="ml-auto font-label-numeric text-label-numeric text-primary-fixed-dim font-mono font-bold text-[10px] leading-relaxed text-center">
                  1轴(b边) 左 {topB / 2 - offsetZ} / 右 {topB / 2 + offsetZ} mm<br />
                  A轴(h边) 下 {topH / 2 - offsetX} / 上 {topH / 2 + offsetX} mm
                </span>
              )}
            </div>
            <LongitudinalPanel params={params} isUpper={true} update={update} />
            <StirrupPanel params={params} isUpper={true} update={update} />
          </div>
        </div>

        {/* ── 下层参数 ── */}
        <div className="rounded-xl border border-white/5 bg-surface-container-lowest/40 overflow-hidden">
          <div className="px-4 py-2.5 bg-primary-fixed-dim/10 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">arrow_downward</span>
            <h4 className="font-body-sm text-body-sm font-semibold text-on-surface font-bold">下层参数</h4>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5">
                <label className="font-body-sm text-[11px] text-on-surface-variant whitespace-nowrap">下层层高</label>
                <input type="number" value={params.floorHeight}
                  onChange={(v) => { const val = Number((v.target as HTMLInputElement).value); update({ floorHeight: val, Hn: val - params.beamHeight }); }}
                  step={100} min={2000} max={8000}
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono min-w-0" />
                <span className="font-label-numeric text-[11px] text-on-surface-variant font-mono">mm</span>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5">
                <label className="font-body-sm text-[11px] text-on-surface-variant whitespace-nowrap">中间梁高</label>
                <input type="number" value={params.beamHeight}
                  onChange={(v) => { const val = Number((v.target as HTMLInputElement).value); update({ beamHeight: val, Hn: params.floorHeight - val }); }}
                  step={50} min={300} max={1200}
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono min-w-0" />
                <span className="font-label-numeric text-[11px] text-on-surface-variant font-mono">mm</span>
              </div>
            </div>
            <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-surface-container-highest/30 border border-white/5">
              <span className="text-[11px] text-on-surface-variant">下层净高</span>
              <span className="ml-auto font-label-numeric text-label-numeric text-primary-fixed-dim font-mono font-bold">{params.Hn} mm</span>
              <span className="text-[10px] text-on-surface-variant/50">= 下层层高 − 中间梁高</span>
            </div>
            {/* 下层柱截面 — 可视化 b × h */}
            <div className="flex items-center gap-2 bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-1.5">
              <label className="font-body-sm text-[11px] text-on-surface-variant whitespace-nowrap">下层柱截面</label>
              <div className="flex-1 flex items-center gap-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1">
                <span className="text-[10px] text-primary-fixed-dim font-mono font-bold shrink-0">b</span>
                <input type="number" value={params.b}
                  onChange={(e) => update({ b: Number(e.target.value) })}
                  step={50} min={300} max={1200}
                  className="flex-1 w-0 bg-transparent font-label-numeric text-label-numeric text-on-surface text-right outline-none font-mono" />
                <span className="text-[10px] text-on-surface-variant/50 font-mono shrink-0">mm</span>
              </div>
              <span className="text-on-surface-variant font-bold shrink-0">×</span>
              <div className="flex-1 flex items-center gap-1 bg-surface-container-highest border border-white/10 rounded px-2 py-1">
                <span className="text-[10px] text-primary-fixed-dim font-mono font-bold shrink-0">h</span>
                <input type="number" value={params.h}
                  onChange={(e) => update({ h: Number(e.target.value) })}
                  step={50} min={300} max={1200}
                  className="flex-1 w-0 bg-transparent font-label-numeric text-label-numeric text-on-surface text-right outline-none font-mono" />
                <span className="text-[10px] text-on-surface-variant/50 font-mono shrink-0">mm</span>
              </div>
            </div>
            <LongitudinalPanel params={params} isUpper={false} update={update} />
            <StirrupPanel params={params} isUpper={false} update={update} />
          </div>
        </div>

        <div className="divider-gradient" />

        <button className="mt-2 w-full py-2 bg-surface-container border border-primary-fixed-dim/30 text-primary-fixed-dim font-body-sm text-body-sm rounded hover:bg-primary-fixed-dim hover:text-on-primary transition-colors duration-200">
          应用更新
        </button>
      </div>
    </div>
  );
}
