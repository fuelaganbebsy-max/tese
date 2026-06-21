import { useBeamStore } from '../../store/beamStore';
import type { Span } from '../../domain/kl/types';
import { maxBarsPerRow } from '../../domain/codes/maxBarsPerRow';
import { NumField } from '../fields/NumField';
import { BundleEditor, STIRRUP_DIA } from '../fields/BundleEditor';

export function SpanEditor({
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
  const topBarType = useBeamStore((s) => s.params.topBarType) ?? 'through';
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
          <div className="flex gap-1.5">
            {([
              { key: 'through' as const, label: '上部贯通筋' },
              { key: 'erection' as const, label: '架立筋' },
            ]).map((opt) => (
              <button key={opt.key}
                onClick={() => setParams((p) => ({ ...p, topBarType: opt.key }))}
                className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors duration-150 ${
                  topBarType === opt.key
                    ? 'bg-primary-fixed-dim/20 border-primary-fixed-dim text-primary-fixed-dim'
                    : 'bg-surface-container-lowest border-white/10 text-on-surface-variant hover:border-primary-fixed-dim/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <BundleEditor
            label={topBarType === 'erection' ? '架立筋（与支座负筋搭接 150mm）' : '上部贯通筋'}
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
