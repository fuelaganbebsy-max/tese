import { useState, useRef, useEffect } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import type { BeamParams, ConcreteGrade, RebarGrade, SeismicLevel, Span, HaunchSpec } from '../domain/kl/types';
import type { ColumnParams, ColumnSectionType } from '../domain/kz/types';
import { useMemberStore } from '../store/memberStore';
import { getMemberEntry } from '../memberRegistry';
import { useAiStore } from './ai/aiStore';
import { getProvider } from './ai/providers';

const COMMON_DIA = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
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
}: {
  label: string;
  value: { grade: RebarGrade; diameter: number; count: number };
  onChange: (b: { grade: RebarGrade; diameter: number; count: number }) => void;
  evenOnly?: boolean;
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

function AiCopilot() {
  const [optimMode, setOptimMode] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<LocalMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const params = useBeamStore((s) => s.params);
  const apiKeys = useAiStore((s) => s.apiKeys);
  const activeProviderId = useAiStore((s) => s.activeProviderId);
  const activeModel = useAiStore((s) => s.activeModel);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleToggle = () => {
    const next = !optimMode;
    setOptimMode(next);
    if (next && msgs.length === 0) {
      setMsgs([{ role: 'assistant', content: '已加载当前构件参数，可以针对该配筋方案提问。' }]);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');

    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text });
    setMsgs((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    const systemPrompt = optimMode
      ? `你是资深建筑结构工程师。当前3D模型（框架梁KL）参数如下：\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\`\n\n请基于以上参数，结合22G101图集和GB50010规范，回答用户问题并给出优化建议。`
      : '你是资深建筑结构工程师，精通22G101平法图集和GB50010等规范，回答结构工程相关问题。';

    const provider = getProvider(activeProviderId);
    if (!provider || !apiKeys[activeProviderId]) { setIsStreaming(false); return; }

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
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-[18px]">smart_toy</span>
          <span className="font-body-sm text-body-sm font-medium text-on-surface">AI 结构助手</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] transition-colors ${optimMode ? 'text-primary-fixed-dim' : 'text-on-surface-variant/50'}`}>
            优化建议
          </span>
          <button
            role="switch"
            aria-checked={optimMode}
            onClick={handleToggle}
            title={optimMode ? '关闭优化建议模式' : '开启后可针对当前构件提问'}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              optimMode ? 'bg-primary-fixed-dim' : 'bg-white/20'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                optimMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3">
        {msgs.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-[12px] text-on-surface-variant/40 text-center leading-relaxed">
              开启「优化建议」后<br />可针对当前构件提问
            </p>
          </div>
        )}
        {msgs.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 border border-primary-container/30 mt-0.5">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: '12px' }}>auto_awesome</span>
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg px-2.5 py-2 text-[12px] leading-relaxed ${
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
        <div className="p-3 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isStreaming}
            className="w-full bg-surface-container-lowest border border-white/10 rounded-full py-2 pl-4 pr-10 text-body-sm font-body-sm text-on-surface focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors placeholder:text-on-surface-variant/40 disabled:opacity-50"
            placeholder={optimMode ? '针对当前构件提问…' : '输入问题…'}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container hover:bg-primary-container/20 transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
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

export function ColumnParamContent() {
  const params = useColumnStore((s) => s.params);
  const setParams = useColumnStore((s) => s.setParams);
  const update = (patch: Partial<ColumnParams>) => setParams((p) => ({ ...p, ...patch }));

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
            <NumField label="净高 Hn" value={params.Hn} onChange={(v) => update({ Hn: v })} step={100} min={2000} max={8000} unit="mm" />
            <NumField label="层数" value={params.floors} onChange={(v) => update({ floors: v })} step={1} min={1} max={100} />
          </div>
          <NumField label="层高" value={params.floorHeight} onChange={(v) => update({ floorHeight: v })} step={100} min={2000} max={8000} unit="mm" />
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
              options={COMMON_DIA as unknown as number[]}
              onChange={(v) => update({ stirrup: { ...params.stirrup, diameter: v } })}
              fmt={(v) => `⌀${v}`}
            />
            <NumField label="加密间距" value={params.stirrup.spacingDense} onChange={(v) => update({ stirrup: { ...params.stirrup, spacingDense: v } })} step={25} min={50} max={200} unit="mm" />
            <NumField label="非加密间距" value={params.stirrup.spacingSparse} onChange={(v) => update({ stirrup: { ...params.stirrup, spacingSparse: v } })} step={25} min={50} max={400} unit="mm" />
            <SelectField
              label="肢数"
              value={params.stirrup.legs}
              options={[2, 4]}
              onChange={(v) => update({ stirrup: { ...params.stirrup, legs: v as 2 | 4 } })}
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
