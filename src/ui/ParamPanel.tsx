import { useState, useRef, useEffect } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import type { BeamParams, ConcreteGrade, RebarGrade, SeismicLevel, Span, HaunchSpec } from '../domain/kl/types';
import type { ColumnParams, ColumnLongitudinalMode, ColumnSectionType } from '../domain/kz/types';
import { useMemberStore } from '../store/memberStore';
import { getMemberEntry } from '../memberRegistry';
import { useAiStore } from './ai/aiStore';
import { getProvider } from './ai/providers';
import { densifiedZoneLength, laE } from '../domain/codes/22G101';
import { maxTopBarsPerRow } from '../domain/codes/maxBarsPerRow';

const COMMON_DIA = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
const STIRRUP_DIA = [6, 8, 10, 12];
const GRADES: RebarGrade[] = ['HPB300', 'HRB400', 'HRB500'];
const CONCRETES: ConcreteGrade[] = ['C25', 'C30', 'C35', 'C40', 'C45', 'C50'];
const SEISMICS: SeismicLevel[] = [1, 2, 3, 4];

/** 梁纵向钢筋单排最大根数（根据梁宽、保护层、箍筋直径、纵筋直径、箍筋肢数计算） */
function maxBarsPerRow(b: number, cover: number, stirrupDia: number, barDia: number, legs: number): number {
  // 可用净宽 = 梁宽 - 两侧(保护层+箍筋直径) - 内部箍筋竖肢占位
  const innerLegs = Math.max(0, legs / 2 - 1);
  const available = b - 2 * (cover + stirrupDia) - innerLegs * stirrupDia;
  // 最小净距: max(25, barDia)
  const minSpacing = Math.max(25, barDia);
  // n根筋需要: n*barDia + (n-1)*minSpacing ≤ available
  const n = Math.floor((available + minSpacing) / (barDia + minSpacing));
  return Math.max(1, n);
}

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
  evenOnly = false,
  diaOptions = COMMON_DIA,
}: {
  label: string;
  value: { grade: RebarGrade; diameter: number; count: number };
  onChange: (b: { grade: RebarGrade; diameter: number; count: number }) => void;
  evenOnly?: boolean;
  diaOptions?: readonly number[];
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
          {diaOptions.map((d) => (
            <option key={d} value={d}>⌀{d}</option>
          ))}
        </select>
        <input
          type="number"
          min={evenOnly ? 2 : 1}
          max={20}
          step={evenOnly ? 2 : 1}
          className="bg-surface-container-lowest border border-white/10 rounded focus:border-primary-fixed-dim h-7 px-2 font-mono text-[10px] text-on-surface text-center"
          value={value.count}
          onChange={(e) => {
            let n = Math.max(evenOnly ? 2 : 1, Number(e.target.value));
            if (evenOnly && n % 2 !== 0) n += 1;
            onChange({ ...value, count: n });
          }}
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
  beamWidth,
  cover,
}: {
  idx: number;
  total: number;
  span: Span;
  onChange: (s: Span) => void;
  beamWidth: number;
  cover: number;
}) {
  const maxRow1 = maxBarsPerRow(beamWidth, cover, span.stirrup.diameter, span.bottom.diameter, span.stirrup.legs);
  const row2Count = span.bottomRow2?.count ?? 0;
  const row2CornerCount = Math.min(2, row2Count);
  const row2MidCount = Math.max(0, row2Count - 2);
  const topThrough = useBeamStore((s) => s.params.topThrough);
  const setParams = useBeamStore((s) => s.setParams);
  const view = useBeamStore((s) => s.view);
  const setView = useBeamStore((s) => s.setView);
  return (
    <div className="rounded-lg border border-white/5 bg-surface-container-highest/30 overflow-hidden">
      <div className="px-3 py-2 bg-surface-container-highest/50 border-b border-white/5 flex items-center justify-between">
        <span className="font-label-numeric text-[10px] text-primary-fixed-dim font-mono">第 {idx + 1} / {total} 跨</span>
        <div className="flex items-center gap-2">
          <span className="font-label-numeric text-[10px] text-on-surface-variant font-mono">ln = {span.ln}mm</span>
          <label className="relative inline-flex items-center cursor-pointer" title="显示/隐藏净跨标注">
            <input
              type="checkbox"
              checked={!!view.showAnnotationNetSpan}
              onChange={() => setView({ showAnnotationNetSpan: !view.showAnnotationNetSpan })}
              className="sr-only peer"
            />
            <div className="w-7 h-3.5 bg-surface-container-highest rounded-full peer peer-checked:bg-blue-400/50 after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3.5" />
          </label>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <NumField label="净跨 ln" value={span.ln} onChange={(v) => onChange({ ...span, ln: v })} step={100} min={1000} max={15000} unit="mm" />
          <NumField label="左支座 hc" value={span.hcLeft} onChange={(v) => onChange({ ...span, hcLeft: v })} step={50} min={200} max={1200} unit="mm" />
          <NumField label="右支座 hc" value={span.hcRight} onChange={(v) => onChange({ ...span, hcRight: v })} step={50} min={200} max={1200} unit="mm" />
        </div>

        {/* ── 上部钢筋 ── */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="text-[10px] tracking-widest text-on-surface-variant font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            上部钢筋
          </div>
          <BundleEditor
            label="上部贯通筋"
            value={topThrough}
            onChange={(b) => setParams((p) => ({ ...p, topThrough: b }))}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <BundleEditor
                label="左支座负筋"
                value={span.topLeftSupport ?? { grade: 'HRB400', diameter: 25, count: 2 }}
                onChange={(b) => onChange({ ...span, topLeftSupport: b })}
              />
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-5" title="显示/隐藏左支座负筋伸出长度标注">
              <input
                type="checkbox"
                checked={!!view.showAnnotationTopLeft}
                onChange={() => setView({ showAnnotationTopLeft: !view.showAnnotationTopLeft })}
                className="sr-only peer"
              />
              <div className="w-7 h-3.5 bg-surface-container-highest rounded-full peer peer-checked:bg-purple-400/50 after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3.5" />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <BundleEditor
                label="右支座负筋"
                value={span.topRightSupport ?? { grade: 'HRB400', diameter: 25, count: 2 }}
                onChange={(b) => onChange({ ...span, topRightSupport: b })}
              />
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-5" title="显示/隐藏右支座负筋伸出长度标注">
              <input
                type="checkbox"
                checked={!!view.showAnnotationTopRight}
                onChange={() => setView({ showAnnotationTopRight: !view.showAnnotationTopRight })}
                className="sr-only peer"
              />
              <div className="w-7 h-3.5 bg-surface-container-highest rounded-full peer peer-checked:bg-purple-400/50 after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3.5" />
            </label>
          </div>
        </div>

        {/* ── 中部钢筋 ── */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="text-[10px] tracking-widest text-on-surface-variant font-bold flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              中部钢筋
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={!!span.midBarEnabled} className="sr-only peer"
                onChange={(e) => onChange({
                  ...span,
                  midBarEnabled: e.target.checked,
                  midConstructionBar: e.target.checked ? (span.midConstructionBar ?? { grade: 'HRB400', diameter: 12, count: 2 }) : span.midConstructionBar,
                })} />
              <div className="w-8 h-4 bg-surface-container-highest rounded-full peer peer-checked:bg-primary-fixed-dim/60 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          {span.midBarEnabled && (
            <div className="pl-2 border-l-2 border-green-400/30 space-y-2">
              <div className="flex gap-1.5">
                {([
                  { key: 'construction' as const, label: '构造钢筋' },
                  { key: 'torsion' as const, label: '扭筋' },
                ]).map((opt) => (
                  <button key={opt.key}
                    onClick={() => onChange({ ...span, midBarType: opt.key })}
                    className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors duration-150 ${
                      (span.midBarType ?? 'construction') === opt.key
                        ? 'bg-primary-fixed-dim/20 border-primary-fixed-dim text-primary-fixed-dim'
                        : 'bg-surface-container-lowest border-white/10 text-on-surface-variant hover:border-primary-fixed-dim/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {(span.midBarType ?? 'construction') === 'construction' ? (
                <BundleEditor
                  label="构造钢筋（侧面纵向构造筋）"
                  value={span.midConstructionBar ?? { grade: 'HRB400', diameter: 12, count: 2 }}
                  onChange={(b) => onChange({ ...span, midConstructionBar: b })}
                  evenOnly
                />
              ) : (
                <BundleEditor
                  label="扭筋（受扭纵向钢筋）"
                  value={span.midTorsionBar ?? { grade: 'HRB400', diameter: 14, count: 2 }}
                  onChange={(b) => onChange({ ...span, midTorsionBar: b })}
                  evenOnly
                />
              )}
            </div>
          )}
        </div>

        {/* ── 下部钢筋 ── */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="text-[10px] tracking-widest text-on-surface-variant font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            下部钢筋
          </div>
          <BundleEditor label="下部一排纵筋" value={span.bottom} onChange={(b) => {
            const newMax = maxBarsPerRow(beamWidth, cover, span.stirrup.diameter, b.diameter, span.stirrup.legs);
            if (b.count <= newMax) {
              onChange({ ...span, bottom: b, bottomRow2: undefined });
            } else {
              onChange({
                ...span,
                bottom: { ...b, count: newMax },
                bottomRow2: { grade: b.grade, diameter: b.diameter, count: b.count - newMax },
              });
            }
          }} />
          <div className="text-[10px] text-on-surface-variant flex items-center gap-2">
            <span>单排最大 <b className="text-primary-fixed-dim">{maxRow1}</b> 根</span>
            {span.bottomRow2 && (
              <span className="text-amber-400">→ 一排{span.bottom.count} + 二排{row2Count}</span>
            )}
          </div>
          {span.bottomRow2 && (
            <div className="pl-2 border-l-2 border-amber-400/30 space-y-2">
              <div className="text-[10px] text-on-surface-variant font-bold">下部第二排</div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-blue-400">角部钢筋（伸入支座弯锚）</span>
                <span className="font-mono text-primary-fixed-dim">{row2CornerCount}⌀{span.bottomRow2.diameter} {span.bottomRow2.grade}</span>
              </div>
              {row2MidCount > 0 && (
                <>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-green-400">中间钢筋</span>
                    <span className="font-mono text-primary-fixed-dim">{row2MidCount}⌀{span.bottomRow2.diameter} {span.bottomRow2.grade}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={!!span.bottomRow2MidAnchor} className="sr-only peer"
                        onChange={(e) => onChange({ ...span, bottomRow2MidAnchor: e.target.checked })} />
                      <div className="w-7 h-4 bg-surface-container-highest rounded-full peer peer-checked:bg-primary-fixed-dim/60 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
                    </label>
                    <span className="text-[10px] text-on-surface-variant">{span.bottomRow2MidAnchor ? '中间筋伸入支座' : '中间筋不伸入支座（0.8ln）'}</span>
                  </div>
                </>
              )}
              <BundleEditor label="二排规格" value={span.bottomRow2} onChange={(b) => onChange({ ...span, bottomRow2: b })} />
            </div>
          )}
        </div>

        {/* ── 箍筋 ── */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] tracking-widest text-on-surface-variant font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">grid_4x4</span>
              箍筋
            </div>
            <label className="relative inline-flex items-center cursor-pointer" title="显示/隐藏加密区长度标注">
              <input
                type="checkbox"
                checked={!!view.showAnnotationStirrup}
                onChange={() => setView({ showAnnotationStirrup: !view.showAnnotationStirrup })}
                className="sr-only peer"
              />
              <div className="w-7 h-3.5 bg-surface-container-highest rounded-full peer peer-checked:bg-primary-fixed-dim/60 after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3.5" />
            </label>
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
            diaOptions={STIRRUP_DIA}
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

type LocalMsg = { role: 'user' | 'assistant'; content: string; error?: string };
type AssistantMode = 'model' | 'knowledge' | 'optimize';

type CopilotCommandResult = {
  nextParams: BeamParams;
  reply: string;
};

function summarizeBeam(params: BeamParams): string {
  const firstSpan = params.spans[0];
  return `当前 KL：${params.b}x${params.h}mm，${params.concrete}，抗震 ${params.seismic} 级，保护层 ${params.cover}mm；上部通筋 ${params.topThrough.count}Φ${params.topThrough.diameter} ${params.topThrough.grade}；首跨下部筋 ${firstSpan.bottom.count}Φ${firstSpan.bottom.diameter}，箍筋 Φ${firstSpan.stirrup.diameter}@${firstSpan.stirrup.spacingDense}/${firstSpan.stirrup.spacingSparse}。`;
}

function getOptimizationAdvice(params: BeamParams): string {
  const firstSpan = params.spans[0];
  const denseLen = densifiedZoneLength(params.h, params.seismic);
  const topCapacity = maxTopBarsPerRow(params.b, params.topThrough.diameter, params.cover);
  const bottomCapacity = maxBarsPerRow(
    params.b,
    params.cover,
    firstSpan.stirrup.diameter,
    firstSpan.bottom.diameter,
    firstSpan.stirrup.legs
  );
  const topLae = laE(params.topThrough.grade, params.topThrough.diameter, params.concrete, params.seismic);
  const bottomLae = laE(firstSpan.bottom.grade, firstSpan.bottom.diameter, params.concrete, params.seismic);
  const issues: string[] = [];

  if (params.topThrough.count > topCapacity) {
    issues.push(`上部通筋 ${params.topThrough.count}Φ${params.topThrough.diameter} 超过当前梁宽 ${params.b}mm、保护层 ${params.cover}mm 下单排建议容量 ${topCapacity} 根。建议拆成两排，或减小直径、加宽梁截面，并同步复核净距。`);
  } else {
    issues.push(`上部通筋 ${params.topThrough.count}Φ${params.topThrough.diameter} 未超过单排建议容量 ${topCapacity} 根，但仍需结合支座负筋叠加区复核净距。`);
  }

  if (firstSpan.bottom.count > bottomCapacity) {
    issues.push(`首跨下部筋 ${firstSpan.bottom.count}Φ${firstSpan.bottom.diameter} 超过按当前箍筋肢数估算的单排容量 ${bottomCapacity} 根。建议设置第二排底筋，或调整梁宽/钢筋直径。`);
  } else {
    issues.push(`首跨下部筋 ${firstSpan.bottom.count}Φ${firstSpan.bottom.diameter} 单排排布容量初判可行，建议继续检查跨中弯矩所需 As。`);
  }

  if (firstSpan.stirrup.spacingDense > 100 && params.seismic <= 2) {
    issues.push(`当前抗震 ${params.seismic} 级，箍筋加密区间距 ${firstSpan.stirrup.spacingDense}mm 偏宽。建议优先采用 @100 或按设计计算进一步收紧，并按 22G101 梁端加密区构造复核。`);
  }

  if (firstSpan.stirrup.spacingSparse > Math.min(200, params.h / 2)) {
    issues.push(`非加密区箍筋间距 ${firstSpan.stirrup.spacingSparse}mm 可能偏大；按常用构造宜同时受 200mm 和 h/2 控制，当前 h/2=${Math.round(params.h / 2)}mm。建议改为 @200 或更小。`);
  }

  if (firstSpan.stirrup.legs === 2 && params.b >= 350) {
    issues.push(`梁宽 ${params.b}mm 时仍采用 2 肢箍，宽梁横向约束可能不足。建议评估改为 4 肢箍或复合箍。`);
  }

  if (params.cover < 25) {
    issues.push(`保护层 ${params.cover}mm 偏小。建议普通梁不低于常用 25mm，并按环境类别、耐久性和设计说明取值。`);
  }

  const firstRow = Math.round(firstSpan.ln / 3);
  const secondRow = Math.round(firstSpan.ln / 4);
  return `优化建议已开启，我按现行 22G101 构造规则和 GB 50010 常用控制项，对当前模型做离线初审：\n\n当前模型：${summarizeBeam(params)}\n\n主要问题与建议：\n${issues.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n关键构造取值：\n1. 梁端箍筋加密区长度：抗震 ${params.seismic} 级，取 ${denseLen}mm。\n2. 上部通筋抗震锚固长度 laE：${topLae}mm；下部筋 laE：${bottomLae}mm。\n3. 支座负筋伸出：第一排 ln/3=${firstRow}mm，第二排 ln/4=${secondRow}mm。\n\n可直接执行的修改建议示例：\n- “箍筋加密间距改为100”\n- “箍筋改为4肢”\n- “梁宽改为350”\n- “混凝土改为C35”\n\n以上为构造和模型一致性初审，最终仍需结合内力计算书、设计总说明、22G101 节点和 GB 50010 条文复核。`;
}

function getOfflineAnswer(text: string, params: BeamParams, optimMode: boolean): string {
  const compact = text.replace(/\s+/g, '').toLowerCase();
  const firstSpan = params.spans[0];
  const denseLen = Math.max(500, params.h * 1.5);
  const current = summarizeBeam(params);
  const ln = firstSpan.ln;

  if (/负筋|負筋|支座筋|支座钢筋|支座鋼筋/.test(compact) && /第一排|一排|第二排|二排|伸出|伸入|长度|長度|多少/.test(compact)) {
    const firstRow = Math.round(ln / 3);
    const secondRow = Math.round(ln / 4);
    return `按常用 22G101 梁支座负筋构造，支座负筋从支座边向跨内伸出：第一排取 ln/3，第二排取 ln/4。\n\n当前净跨 ln = ${ln}mm，所以：\n第一排负筋伸出长度 = ${firstRow}mm；\n第二排负筋伸出长度 = ${secondRow}mm。\n\n如果是中间支座，两侧相邻跨不等时，通常分别按相邻跨净跨取值，并以设计说明和图集节点为准。`;
  }

  if (/加密区|加密區|箍筋.*范围|箍筋.*範圍|箍筋.*长度|箍筋.*長度/.test(compact)) {
    return `${current}\n\n框架梁箍筋加密区通常从支座边起算，按抗震构造取值时常用控制项是梁高倍数和 500mm 的较大值。按当前梁高 ${params.h}mm 估算，加密区长度可先按 max(1.5h, 500) = ${denseLen}mm 控制，当前加密间距为 ${firstSpan.stirrup.spacingDense}mm，非加密区间距为 ${firstSpan.stirrup.spacingSparse}mm。\n\n实际出图前还需要结合抗震等级、梁端塑性铰区、设计说明和 22G101/GB 50010 的具体条文复核。`;
  }

  if (/锚固|錨固|lae|la|弯锚|彎錨/.test(compact)) {
    return `${current}\n\n锚固长度需要由钢筋等级、直径、混凝土强度、抗震等级共同确定。当前上部通筋为 ${params.topThrough.grade} Φ${params.topThrough.diameter}，混凝土 ${params.concrete}，抗震 ${params.seismic} 级；软件当前展示的 laE 可作为本模型的计算参考值。\n\n构造判断时重点看三件事：支座宽度是否满足直锚，直锚不足时是否采用弯锚，弯折段和水平段是否满足图集构造。`;
  }

  if (/通长筋|通長筋|通常钢筋|通常鋼筋|贯通筋|貫通筋|架立筋|上部.*架立筋|区别|差别|差異/.test(compact)) {
    return `通长筋/贯通筋是沿梁长连续布置、参与梁端和跨中受力及构造连续性的钢筋；架立筋主要用于固定箍筋、形成钢筋骨架，通常不作为主要受力钢筋控制。\n\n在当前模型里，“上部通筋”会贯穿整根梁并影响 3D 显示和 BOM；支座负筋、下部筋则按各跨或支座区域分别统计。`;
  }

  if (/保护层|保護層|cover/.test(compact)) {
    return `${current}\n\n保护层厚度影响钢筋净距、可排布根数、耐久性和防火性能。当前保护层为 ${params.cover}mm。一般不能只为了排筋方便随意减小保护层，出图时应按环境类别、构件类型和设计说明取值。`;
  }

  if (/工程量|重量|bom|清单|统计|統計/.test(compact)) {
    return `BOM 会按当前模型参数重新统计各类钢筋的规格、长度、数量和重量。你可以用自然语言直接改参数，例如“上部通筋改为2根，直径不变”或“箍筋加密间距改为100”，工程量会随模型同步刷新。`;
  }

  if (/优化|優化|建议|建議|合理|检查|檢查|诊断|診斷|不合理|问题|問題/.test(compact) || optimMode) {
    return getOptimizationAdvice(params);
  }

  return `${current}\n\n我现在处于离线问答状态，不需要配置模型 API Key。可以回答当前构件相关的常见开放问题，也可以直接执行参数修改。\n\n你可以继续问：箍筋加密区怎么取、锚固长度怎么看、通长筋和架立筋区别、当前配筋是否合理；也可以说“梁高改为650”“混凝土改为C35”“下部钢筋改为4根直径22”。`;
}

function cnNumberToDigit(text: string): number | undefined {
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  return map[text];
}

function firstNumber(text: string): number | undefined {
  const digit = text.match(/\d+(?:\.\d+)?/);
  if (digit) return Number(digit[0]);
  const cn = text.match(/[一二两三四五六七八九十]/);
  return cn ? cnNumberToDigit(cn[0]) : undefined;
}

function extractCount(text: string): number | undefined {
  const match = text.match(/(\d+|[一二两三四五六七八九十])\s*(?:根|支|肢)/);
  if (!match) return undefined;
  return /^\d/.test(match[1]) ? Number(match[1]) : cnNumberToDigit(match[1]);
}

function extractDiameter(text: string): number | undefined {
  if (/直径不变|直徑不變|直径保持|直徑保持/.test(text)) return undefined;
  const match =
    text.match(/(?:直径|直徑|dia|diameter|[dDΦφØø])\s*(?:为|改为|=|:|：)?\s*(\d+)/) ??
    text.match(/(\d+)\s*(?:mm)?\s*(?:钢筋|鋼筋|筋)/);
  return match ? Number(match[1]) : undefined;
}

function extractGrade(text: string): RebarGrade | undefined {
  const match = text.toUpperCase().match(/\b(HPB300|HRB400|HRB500)\b/);
  return match?.[1] as RebarGrade | undefined;
}

function extractConcrete(text: string): ConcreteGrade | undefined {
  const match = text.toUpperCase().match(/\bC(25|30|35|40|45|50)\b/);
  return match ? (`C${match[1]}` as ConcreteGrade) : undefined;
}

function extractSeismic(text: string): SeismicLevel | undefined {
  const match = text.match(/抗震\s*(?:等级|等級)?\s*(?:改为|调整为|设为|为|=|:|：)?\s*([一二三四1234])/);
  if (!match) return undefined;
  const raw = match[1];
  const value = /^\d$/.test(raw) ? Number(raw) : cnNumberToDigit(raw);
  return value && value >= 1 && value <= 4 ? (value as SeismicLevel) : undefined;
}

function extractMmValue(text: string, keywords: string[]): number | undefined {
  for (const keyword of keywords) {
    const idx = text.indexOf(keyword);
    if (idx >= 0) {
      return firstNumber(text.slice(idx));
    }
  }
  return undefined;
}

function parseCopilotCommand(text: string, params: BeamParams): CopilotCommandResult | null {
  const compact = text.replace(/\s+/g, '');
  const isQuestion = /[?？]|怎么|如何|为何|为什么|為何|為什麼|解释|說明|说明|区别|差别|差異|是什么|是什麼|确定|確定|范围|範圍|多少|几个|幾個/.test(compact);
  if (isQuestion && !/改|修改|调整|調整|设为|設為|设置|設定|变为|變為|改为|改成|设成|換成|换成|采用|取为|取成|应用|套用|增加|减少|增大|减小|=/.test(compact)) {
    return null;
  }

  const hasCommandIntent = /改|修改|调整|調整|设为|設為|设置|設定|变为|變為|改为|改成|设成|換成|换成|采用|取为|取成|应用|套用|增加|减少|增大|减小|=/.test(compact);
  if (!hasCommandIntent) return null;

  const actions: string[] = [];
  let handled = false;
  let next: BeamParams = params;

  const update = (patch: Partial<BeamParams>) => {
    next = { ...next, ...patch };
    handled = true;
  };

  const count = extractCount(compact);
  const diameter = extractDiameter(compact);
  const grade = extractGrade(compact);

  if (
    /上部|顶部|通筋|贯通筋|貫通筋/.test(compact) &&
    !/支座|负筋|負筋|区别|差别|差異|怎么|如何|为什么|為什麼|解释|說明|说明/.test(compact) &&
    (count !== undefined || diameter !== undefined || grade !== undefined)
  ) {
    const current = next.topThrough;
    update({
      topThrough: {
        ...current,
        count: count ?? current.count,
        diameter: diameter ?? current.diameter,
        grade: grade ?? current.grade,
      },
    });
    actions.push(`上部通筋已调整为 ${count ?? current.count} 根 HRB/HPB 等级 ${grade ?? current.grade}，直径 ${diameter ?? current.diameter}mm`);
  }

  if (
    /下部|底部|底筋/.test(compact) &&
    !/区别|差别|差異|怎么|如何|为什么|為什麼|解释|說明|说明/.test(compact) &&
    (count !== undefined || diameter !== undefined || grade !== undefined)
  ) {
    next = {
      ...next,
      spans: next.spans.map((span) => ({
        ...span,
        bottom: {
          ...span.bottom,
          count: count ?? span.bottom.count,
          diameter: diameter ?? span.bottom.diameter,
          grade: grade ?? span.bottom.grade,
        },
      })),
    };
    handled = true;
    actions.push(`下部纵筋已应用到全部跨：${count ?? next.spans[0].bottom.count} 根，直径 ${diameter ?? next.spans[0].bottom.diameter}mm`);
  }

  if (/箍筋|箍/.test(compact) && !/怎么|如何|为什么|為什麼|解释|說明|说明|范围|範圍|确定|確定/.test(compact)) {
    const dense = extractMmValue(compact, ['加密间距', '加密区间距', '加密']);
    const sparse = extractMmValue(compact, ['非加密间距', '非加密区间距', '普通间距', '间距']);
    const legs = /四肢|4肢|4支/.test(compact) ? 4 : /两肢|二肢|2肢|2支/.test(compact) ? 2 : undefined;
    if (diameter === undefined && grade === undefined && dense === undefined && sparse === undefined && legs === undefined) {
      return null;
    }
    next = {
      ...next,
      spans: next.spans.map((span) => ({
        ...span,
        stirrup: {
          ...span.stirrup,
          diameter: diameter ?? span.stirrup.diameter,
          grade: grade ?? span.stirrup.grade,
          spacingDense: dense ?? span.stirrup.spacingDense,
          spacingSparse: sparse ?? span.stirrup.spacingSparse,
          legs: (legs ?? span.stirrup.legs) as 2 | 4,
        },
      })),
    };
    handled = true;
    actions.push('箍筋参数已应用到全部跨');
  }

  const width = extractMmValue(compact, ['梁宽', '宽度', 'b=']);
  if (width !== undefined) {
    update({ b: width });
    actions.push(`梁宽 b 已改为 ${width}mm`);
  }

  const height = extractMmValue(compact, ['梁高', '高度', 'h=']);
  if (height !== undefined) {
    update({ h: height });
    actions.push(`梁高 h 已改为 ${height}mm`);
  }

  const cover = extractMmValue(compact, ['保护层', '保護層']);
  if (cover !== undefined) {
    update({ cover });
    actions.push(`保护层厚度已改为 ${cover}mm`);
  }

  const concrete = extractConcrete(compact);
  if (concrete) {
    update({ concrete });
    actions.push(`混凝土强度等级已改为 ${concrete}`);
  }

  const seismic = extractSeismic(compact);
  if (seismic) {
    update({ seismic });
    actions.push(`抗震等级已改为 ${seismic} 级`);
  }

  if (!handled) return null;

  return {
    nextParams: next,
    reply: `已执行：${actions.join('；')}。模型与工程量已同步刷新。`,
  };
}

function AiCopilot() {
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('model');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<LocalMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const params = useBeamStore((s) => s.params);
  const setParams = useBeamStore((s) => s.setParams);
  const apiKeys = useAiStore((s) => s.apiKeys);
  const activeProviderId = useAiStore((s) => s.activeProviderId);
  const activeModel = useAiStore((s) => s.activeModel);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleModeChange = (mode: AssistantMode) => {
    setAssistantMode(mode);
    if (mode === 'optimize') {
      setMsgs([{ role: 'assistant', content: getOptimizationAdvice(params) }]);
      return;
    }
    setMsgs([]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    const lastUserQuestion = [...msgs].reverse().find((m) => m.role === 'user')?.content;
    const answerText =
      /直接回答|回答我的问题|回答我的問題|不是这个|不是這個|没回答|沒有回答/.test(text) && lastUserQuestion
        ? lastUserQuestion
        : text;

    const localCommand = assistantMode === 'model' ? parseCopilotCommand(answerText, params) : null;
    if (localCommand) {
      setParams(() => localCommand.nextParams);
      setMsgs((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: localCommand.reply }]);
      return;
    }

    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text });
    setMsgs((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    const systemPrompt = assistantMode === 'optimize'
      ? `你是资深建筑结构工程师，任务是对当前3D框架梁 KL 模型做规范与图集初审。当前参数如下：\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\`\n\n回答要求：\n1. 必须基于现行 22G101 图集构造规则和 GB 50010 常用控制项指出模型中可能不合理的地方。\n2. 每条建议都要包含：问题、判断依据或计算值、修改意见。\n3. 重点检查：纵筋单排净距与排布容量、支座负筋伸出长度、锚固 laE、箍筋加密区长度、箍筋加密/非加密间距、箍筋肢数、保护层、材料等级与抗震等级匹配。\n4. 可以给出可直接执行的自然语言修改命令，例如“箍筋加密间距改为100”“梁宽改为350”。\n5. 不要只泛泛提醒复核；如果参数足够，必须给出当前模型的具体数值判断。`
      : assistantMode === 'knowledge'
      ? '你是资深建筑结构工程师，精通22G101平法图集、GB50010和常见施工构造。请做专业知识拓展，解释概念、构造依据、适用场景和注意事项，不要修改模型参数。'
      : '你是模型交互助手。优先把用户自然语言转换为当前钢筋模型参数修改；无法修改时，再简要说明可执行的命令格式。';

    const provider = getProvider(activeProviderId);
    if (!provider || !apiKeys[activeProviderId]) {
      setMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: assistantMode === 'optimize'
            ? getOptimizationAdvice(params)
            : getOfflineAnswer(answerText, params, false),
        };
        return next;
      });
      setIsStreaming(false);
      return;
    }

    try {
      let full = '';
      await provider.chatStream(
        history,
        systemPrompt,
        apiKeys[activeProviderId],
        (chunk) => {
          full += chunk;
          setMsgs((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: full };
            return next;
          });
        },
        { model: activeModel }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败';
      setMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], error: errMsg };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between sticky top-0 bg-surface-container-high/90 backdrop-blur-md z-10">
        <div className="flex w-full items-center gap-1 rounded-full border border-white/10 bg-surface-container-lowest/70 p-0.5">
          {([
            ['model', '模型交互'],
            ['knowledge', '专业知识拓展'],
            ['optimize', '优化建议'],
          ] as const).map(([mode, label]) => {
            const active = assistantMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={`flex-1 rounded-full px-2.5 py-1 text-[11px] transition-all ${
                  active
                    ? 'bg-primary-fixed-dim text-on-primary shadow-[0_0_12px_rgba(0,218,243,0.25)]'
                    : 'text-on-surface-variant/60 hover:text-on-surface hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3">
        {msgs.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-[18px] text-on-surface-variant/40 text-center leading-relaxed px-4">
              {assistantMode === 'model' && '输入自然语言修改模型参数'}
              {assistantMode === 'knowledge' && '提问平法、规范和构造知识'}
              {assistantMode === 'optimize' && '切换到优化建议后会生成当前模型诊断'}
            </p>
          </div>
        )}
        {msgs.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 border border-primary-container/30 mt-0.5">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: '20px' }}>auto_awesome</span>
              </div>
            )}
            <div className={`max-w-[92%] rounded-lg px-3 py-2.5 text-[24px] leading-relaxed whitespace-pre-wrap break-words ${
              msg.role === 'user'
                ? 'bg-blue-600/80 text-white rounded-tr-sm'
                : 'bg-surface-container-highest/50 border border-white/5 text-on-surface-variant rounded-tl-sm'
            }`}>
              {msg.error
                ? <span className="text-red-400">{msg.error}</span>
                : !msg.content && isStreaming && i === msgs.length - 1
                ? <span className="text-on-surface-variant/40">思考中…</span>
                : msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/5 bg-surface-container-highest/20 shrink-0">
        <div className="px-3 pt-2 flex items-center gap-1.5 text-[20px] text-on-surface-variant/60">
          <span className="material-symbols-outlined text-[22px] text-primary-fixed-dim">bolt</span>
          <span>
            {assistantMode === 'model' && '模型交互模式'}
            {assistantMode === 'knowledge' && '专业知识拓展模式'}
            {assistantMode === 'optimize' && '优化建议模式'}
            {!apiKeys[activeProviderId] && '，离线可用'}
          </span>
        </div>
        <div className="p-3 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isStreaming}
            className="w-full bg-surface-container-lowest border border-white/10 rounded-full py-3 pl-4 pr-12 text-[24px] text-on-surface focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors placeholder:text-on-surface-variant/40 disabled:opacity-50"
            placeholder={
              assistantMode === 'model'
                ? '例如：梁高改为650...'
                : assistantMode === 'knowledge'
                ? '例如：箍筋加密区怎么取...'
                : '针对当前构件提问...'
            }
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container hover:bg-primary-container/20 transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[24px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Column Parameters Tab Content ---------- */

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

/* ---------- Beam Parameters Tab Content ---------- */

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

/* ---------- Inspector root ---------- */

export function ParamPanel({ panelWidth = 340 }: { panelWidth?: number }) {
  const [activeTab, setActiveTab] = useState<'params' | 'ai'>('params');
  const activeType = useMemberStore((s) => s.activeType);
  const isBeam = activeType === 'KL' || activeType === 'L' || activeType === 'WKL' || activeType === 'XL';
  const collapsed = isBeam
    ? useBeamStore((s) => s.ui.inspectorCollapsed)
    : useColumnStore((s) => s.ui.inspectorCollapsed);
  const setUi = isBeam
    ? useBeamStore((s) => s.setUi)
    : useColumnStore((s) => s.setUi);

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

  const fontScale = Math.max(1, Math.min(2, 1 + (panelWidth - 340) * 0.003));

  return (
    <aside
      data-panel-scale=""
      className="bg-[#0d0d0d] border-l border-white/5 flex flex-col h-full shrink-0 z-30 w-full"
      style={{ '--ps': fontScale } as React.CSSProperties}
    >
      <style>{`
        [data-panel-scale] {
          font-size: calc(14px * var(--ps));
        }
        [data-panel-scale] .text-body-sm,
        [data-panel-scale] .font-body-sm {
          font-size: calc(12px * var(--ps)) !important;
        }
        [data-panel-scale] .text-body-md,
        [data-panel-scale] .font-body-md {
          font-size: calc(14px * var(--ps)) !important;
        }
        [data-panel-scale] .text-label-numeric,
        [data-panel-scale] .font-label-numeric {
          font-size: calc(13px * var(--ps)) !important;
        }
        [data-panel-scale] .text-\\[10px\\] {
          font-size: calc(10px * var(--ps)) !important;
        }
        [data-panel-scale] .text-\\[11px\\] {
          font-size: calc(11px * var(--ps)) !important;
        }
        [data-panel-scale] .text-\\[14px\\] {
          font-size: calc(14px * var(--ps)) !important;
        }
        [data-panel-scale] .text-\\[18px\\] {
          font-size: calc(18px * var(--ps)) !important;
        }
      `}</style>
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
      {activeTab === 'params' ? (() => {
        const entry = getMemberEntry(activeType);
        if (!entry) return null;
        const ParamContentComp = entry.paramContentComponent;
        return <ParamContentComp />;
      })() : <AiCopilot />}

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
