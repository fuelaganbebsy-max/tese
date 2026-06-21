import React, { useState } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import { useMemberStore } from '../store/memberStore';
import { getMemberEntry } from '../memberRegistry';
import { AiCopilot } from './param/AiCopilot';

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
