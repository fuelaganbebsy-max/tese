import { useState } from 'react';
import { useBeamStore } from '../store/beamStore';
import { useMemberStore } from '../store/memberStore';
import {
  PARENT_TYPES,
  PARENT_LABELS,
  MEMBER_SUBTYPES,
  MEMBER_LABELS,
  MEMBER_ICONS,
  MEMBER_STATUS,
  getParentType,
  type MemberType,
} from '../config';

const STATUS_DOT: Record<string, string> = {
  ready: 'bg-green-400',
  dev: 'bg-amber-400 animate-pulse',
  planned: 'bg-white/20',
};

export function SideNav() {
  const collapsed = useBeamStore((s) => s.ui.sideNavCollapsed);
  const setUi = useBeamStore((s) => s.setUi);
  const activeType = useMemberStore((s) => s.activeType);
  const switchMember = useMemberStore((s) => s.switchMember);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('KL');

  const loadSubtype = useBeamStore((s) => s.loadSubtype);
  const BEAM_SUBTYPES: MemberType[] = ['KL', 'L', 'WKL', 'XL'];

  const handleSwitch = (type: MemberType) => {
    switchMember(type);
    if (BEAM_SUBTYPES.includes(type)) {
      loadSubtype(type);
    }
  };

  const parentFor = (t: MemberType) => getParentType(t);

  if (collapsed) {
    return (
      <nav className="bg-[#0d0d0d] border-r border-white/5 flex flex-col h-full py-gutter shrink-0 z-30 w-14 items-center gap-1">
        <button
          onClick={() => setUi({ sideNavCollapsed: false })}
          title="展开"
          className="p-2 rounded text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors mb-2"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
        {PARENT_TYPES.map((type) => {
          const subtypes = MEMBER_SUBTYPES[type];
          const isSingle = subtypes.length <= 1;
          // In collapsed mode, show parent icon as active if any child is active
          const hasActiveChild = subtypes.some((st) => st === activeType);
          return (
            <button
              key={type}
              title={PARENT_LABELS[type]}
              onClick={() => {
                // Single: switch to the only type. Multi: expand group first, switch to first child
                const target = isSingle ? subtypes[0] : subtypes[0];
                handleSwitch(target as MemberType);
              }}
              className={`p-2 rounded-lg transition-all relative ${
                hasActiveChild
                  ? 'bg-primary-container/10 text-primary-fixed-dim'
                  : 'text-on-surface-variant opacity-70 hover:bg-white/5 hover:text-on-surface'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={hasActiveChild ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {MEMBER_ICONS[subtypes[0]]}
              </span>
              <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${STATUS_DOT[MEMBER_STATUS[subtypes[0]]]}`} />
            </button>
          );
        })}
        <div className="mt-auto flex flex-col gap-1">
          <button title="设置" className="p-2 rounded-lg text-on-surface-variant opacity-70 hover:bg-white/5 hover:text-on-surface transition-all">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="bg-[#0d0d0d] border-r border-white/5 flex flex-col py-gutter shrink-0 z-30 w-full h-full"
    >
      {/* Header */}
      <div className="px-gutter mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center border border-white/5 shadow-inner">
          <span
            className="material-symbols-outlined text-primary-fixed-dim"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            precision_manufacturing
          </span>
        </div>
        <div>
          <h2 className="font-display-lg text-primary-fixed-dim text-[16px] leading-tight font-bold">
            Alpha-7 钢筋工程
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-70">22G101 全构件平台</p>
        </div>
      </div>

      {/* Member Type Groups */}
      <div className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {PARENT_TYPES.map((parentType) => {
          const subtypes = MEMBER_SUBTYPES[parentType] as readonly MemberType[];
          const isSingle = subtypes.length <= 1;
          const isExpanded = expandedGroup === parentType;
          const hasActiveChild = subtypes.some((st) => st === activeType);

          return (
            <div key={parentType} className="flex flex-col">
              {/* Parent header */}
              <button
                onClick={() => {
                  if (isSingle) {
                    handleSwitch(subtypes[0]);
                  } else {
                    setExpandedGroup(isExpanded ? null : parentType);
                  }
                }}
                className={
                  isSingle && hasActiveChild
                    ? 'flex items-center gap-4 bg-primary-container/10 text-primary-fixed-dim border-r-4 border-primary-fixed-dim px-4 py-3 rounded-lg font-bold bg-white/5 text-left'
                    : 'flex items-center gap-4 text-on-surface-variant px-4 py-3 opacity-70 hover:bg-white/5 hover:text-on-surface transition-all rounded-lg active:translate-x-1 duration-150 text-left'
                }
              >
                <span
                  className="material-symbols-outlined"
                  style={hasActiveChild ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {MEMBER_ICONS[subtypes[0]]}
                </span>
                <span className="font-label-numeric text-label-numeric font-mono flex-1">
                  {PARENT_LABELS[parentType]}
                </span>
                {!isSingle && (
                  <span className="material-symbols-outlined text-[16px] transition-transform duration-200"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    chevron_right
                  </span>
                )}
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[MEMBER_STATUS[subtypes[0]]]}`}
                  title={
                    MEMBER_STATUS[subtypes[0]] === 'ready' ? '可用' :
                    MEMBER_STATUS[subtypes[0]] === 'dev' ? '开发中' : '规划中'
                  }
                />
              </button>

              {/* Sub-items (only for multi-type groups) */}
              {!isSingle && isExpanded && (
                <div className="ml-1 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                  {subtypes.map((subtype) => {
                    const active = subtype === activeType;
                    const status = MEMBER_STATUS[subtype];
                    return (
                      <button
                        key={subtype}
                        onClick={() => handleSwitch(subtype)}
                        disabled={status === 'planned'}
                        className={
                          active
                            ? 'flex items-center gap-3 bg-primary-container/10 text-primary-fixed-dim border-r-4 border-primary-fixed-dim px-3 py-2 rounded-lg font-bold bg-white/5 text-left'
                            : 'flex items-center gap-3 text-on-surface-variant px-3 py-2 rounded-lg hover:bg-white/5 hover:text-on-surface transition-all text-left'
                        }
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: active ? 'var(--color-primary-fixed-dim)' :
                              status === 'ready' ? '#4ade80' :
                              status === 'dev' ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                            opacity: active ? 1 : status === 'planned' ? 0.5 : 0.8,
                          }}
                        />
                        <span className="font-label-numeric text-label-numeric font-mono flex-1">
                          {MEMBER_LABELS[subtype]}
                        </span>
                        <span className="font-mono text-[10px] text-on-surface-variant/60">{subtype}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-2 mt-auto border-t border-white/5 pt-2">
        <button
          className="flex items-center gap-4 text-on-surface-variant px-4 py-3 opacity-70 hover:bg-white/5 hover:text-on-surface transition-all rounded-lg w-full"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-numeric text-label-numeric font-mono">设置</span>
        </button>
        <button
          onClick={() => setUi({ sideNavCollapsed: true })}
          title="收起"
          className="flex items-center gap-4 text-on-surface-variant px-4 py-3 opacity-70 hover:bg-white/5 hover:text-on-surface transition-all rounded-lg w-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
          <span className="font-label-numeric text-label-numeric font-mono">收起</span>
        </button>
      </div>
    </nav>
  );
}
