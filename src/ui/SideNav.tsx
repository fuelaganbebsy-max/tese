import { useBeamStore } from '../store/beamStore';
import { useMemberStore } from '../store/memberStore';
import { MEMBER_TYPES, MEMBER_LABELS, MEMBER_ICONS, MEMBER_STATUS, type MemberType } from '../config';

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

  const handleSwitch = (type: MemberType) => {
    switchMember(type);
  };

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
        {MEMBER_TYPES.map((type) => {
          const active = type === activeType;
          const status = MEMBER_STATUS[type];
          return (
            <button
              key={type}
              title={`${MEMBER_LABELS[type]} (${type})${status === 'planned' ? ' — 开发中' : ''}`}
              onClick={() => handleSwitch(type)}
              className={`p-2 rounded-lg transition-all relative ${
                active
                  ? 'bg-primary-container/10 text-primary-fixed-dim'
                  : 'text-on-surface-variant opacity-70 hover:bg-white/5 hover:text-on-surface'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {MEMBER_ICONS[type]}
              </span>
              <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
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
      className="bg-[#0d0d0d] border-r border-white/5 flex flex-col py-gutter shrink-0 z-30 transition-[width] duration-200"
      style={{ width: 240 }}
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

      {/* Member Type Tabs */}
      <div className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {MEMBER_TYPES.map((type) => {
          const active = type === activeType;
          const status = MEMBER_STATUS[type];
          return (
            <button
              key={type}
              onClick={() => handleSwitch(type)}
              className={
                active
                  ? 'flex items-center gap-4 bg-primary-container/10 text-primary-fixed-dim border-r-4 border-primary-fixed-dim px-4 py-3 rounded-lg font-bold bg-white/5 text-left'
                  : 'flex items-center gap-4 text-on-surface-variant px-4 py-3 opacity-70 hover:bg-white/5 hover:text-on-surface transition-all rounded-lg active:translate-x-1 duration-150 text-left'
              }
            >
              <span
                className="material-symbols-outlined"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {MEMBER_ICONS[type]}
              </span>
              <span className="font-label-numeric text-label-numeric font-mono flex-1">{MEMBER_LABELS[type]}</span>
              <span className="font-mono text-[10px] text-on-surface-variant/60">{type}</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} title={status === 'ready' ? '可用' : status === 'dev' ? '开发中' : '规划中'} />
            </button>
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
