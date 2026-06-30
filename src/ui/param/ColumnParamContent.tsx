import { useColumnStore } from '../../store/columnStore';
import type {
  ColumnParams,
  ColumnLongitudinalMode,
} from '../../domain/kz/types';
import { NumField } from '../fields/NumField';
import { SelectField } from '../fields/SelectField';
import { COMMON_DIA, STIRRUP_DIA, GRADES } from '../fields/BundleEditor';

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
              <span className="text-[10px] text-on-surface-variant/50">= 层高 − 梁高</span>
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
              <span className="text-[10px] text-on-surface-variant/50">= 层高 − 梁高</span>
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
          </div>
        </div>

        <div className="divider-gradient" />

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
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
              <span className="text-[11px] text-on-surface-variant whitespace-nowrap">等级</span>
              <select
                className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
                value={params.longitudinal.grade}
                onChange={(e) => update({ longitudinal: { ...params.longitudinal, grade: e.target.value as any } })}
              >
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-on-surface-variant whitespace-nowrap">角筋直径</span>
                <select
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
                  value={cornerBar.diameter}
                  onChange={(e) => update({ cornerBar: { ...cornerBar, diameter: Number(e.target.value), grade: params.longitudinal.grade, count: 4 } })}
                >
                  {(COMMON_DIA as unknown as number[]).map((d) => <option key={d} value={d}>⌀{d}</option>)}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-on-surface-variant whitespace-nowrap">钢筋数量</span>
                <input type="number" value={params.longitudinal.count}
                  onChange={(e) => update({ longitudinal: { ...params.longitudinal, count: Number(e.target.value) } })}
                  step={1} min={2} max={8}
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono" />
                <span className="text-[10px] text-on-surface-variant/50 font-mono">根</span>
              </div>
            </div>
          </div>
          {longitudinalMode === 'grouped' && (
            <div className="space-y-3 pl-2 border-l-2 border-primary-fixed-dim/30">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-on-surface-variant whitespace-nowrap">b边中部</span>
                  <input type="number" value={bSideMidBar.count}
                    onChange={(e) => update({ bSideMidBar: { ...bSideMidBar, grade: params.longitudinal.grade, count: Number(e.target.value) } })}
                    step={1} min={0} max={8}
                    className="w-10 bg-surface-container-highest border border-white/10 rounded px-1 py-0.5 font-label-numeric text-label-numeric text-on-surface text-center outline-none focus:border-primary-fixed-dim font-mono" />
                  <span className="text-[10px] text-on-surface-variant/50 font-mono">根</span>
                  <span className="text-on-surface-variant mx-0.5">×</span>
                  <SelectField
                    label=""
                    value={bSideMidBar.diameter}
                    options={COMMON_DIA as unknown as number[]}
                    onChange={(v) => update({ bSideMidBar: { ...bSideMidBar, grade: params.longitudinal.grade, diameter: v } })}
                    fmt={(v) => `⌀${v}`}
                  />
                </div>
                <div className="flex-1 flex items-center gap-1 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-on-surface-variant whitespace-nowrap">h边中部</span>
                  <input type="number" value={hSideMidBar.count}
                    onChange={(e) => update({ hSideMidBar: { ...hSideMidBar, grade: params.longitudinal.grade, count: Number(e.target.value) } })}
                    step={1} min={0} max={8}
                    className="w-10 bg-surface-container-highest border border-white/10 rounded px-1 py-0.5 font-label-numeric text-label-numeric text-on-surface text-center outline-none focus:border-primary-fixed-dim font-mono" />
                  <span className="text-[10px] text-on-surface-variant/50 font-mono">根</span>
                  <span className="text-on-surface-variant mx-0.5">×</span>
                  <SelectField
                    label=""
                    value={hSideMidBar.diameter}
                    options={COMMON_DIA as unknown as number[]}
                    onChange={(v) => update({ hSideMidBar: { ...hSideMidBar, grade: params.longitudinal.grade, diameter: v } })}
                    fmt={(v) => `⌀${v}`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="divider-gradient" />

        {/* Stirrup */}
        <div className="space-y-3">
          <h4 className="font-body-sm text-body-sm font-medium text-on-surface font-bold">箍筋</h4>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-on-surface-variant whitespace-nowrap">等级</span>
                <select
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
                  value={params.stirrup.grade}
                  onChange={(e) => update({ stirrup: { ...params.stirrup, grade: e.target.value as any } })}
                >
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-on-surface-variant whitespace-nowrap">直径</span>
                <select
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
                  value={params.stirrup.diameter}
                  onChange={(e) => update({ stirrup: { ...params.stirrup, diameter: Number(e.target.value) } })}
                >
                  {(STIRRUP_DIA as unknown as number[]).map((d) => <option key={d} value={d}>⌀{d}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-on-surface-variant whitespace-nowrap">加密间距</span>
                <input type="number" value={params.stirrup.spacingDense}
                  onChange={(e) => update({ stirrup: { ...params.stirrup, spacingDense: Number(e.target.value) } })}
                  step={25} min={50} max={200}
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface text-right outline-none focus:border-primary-fixed-dim font-mono" />
                <span className="text-[10px] text-on-surface-variant/50 font-mono">mm</span>
              </div>
              <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-on-surface-variant whitespace-nowrap">非加密间距</span>
                <input type="number" value={params.stirrup.spacingSparse}
                  onChange={(e) => update({ stirrup: { ...params.stirrup, spacingSparse: Number(e.target.value) } })}
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
                  onChange={(e) => { const v = Number(e.target.value); update({ stirrup: { ...params.stirrup, legsX: v, legs: (v > 2 || legsY > 2 ? 4 : 2) as 2 | 4 } }); }}
                >
                  {[2, 3, 4, 5, 6].map((v) => <option key={v} value={v}>{v}肢</option>)}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-on-surface-variant whitespace-nowrap">n 肢(h向)</span>
                <select
                  className="flex-1 bg-surface-container-highest border border-white/10 rounded px-1.5 py-0.5 font-label-numeric text-label-numeric text-on-surface outline-none focus:border-primary-fixed-dim font-mono"
                  value={legsY}
                  onChange={(e) => { const v = Number(e.target.value); update({ stirrup: { ...params.stirrup, legsY: v, legs: (legsX > 2 || v > 2 ? 4 : 2) as 2 | 4 } }); }}
                >
                  {[2, 3, 4, 5, 6].map((v) => <option key={v} value={v}>{v}肢</option>)}
                </select>
              </div>
            </div>
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
