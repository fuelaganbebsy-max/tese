import { useBeamStore } from '../store/beamStore';

interface NavItem {
  icon: string;
  label: string;
  active?: boolean;
  filled?: boolean;
}

export function SideNav() {
  const collapsed = useBeamStore((s) => s.ui.sideNavCollapsed);
  const setUi = useBeamStore((s) => s.setUi);

  const items: NavItem[] = [
    { icon: 'architecture', label: '梁' },
    { icon: 'layers', label: '板' },
    { icon: 'view_column', label: '柱', active: true, filled: true },
    { icon: 'view_quilt', label: '墙' },
    { icon: 'stairs', label: '楼梯' },
    { icon: 'foundation', label: '基础' },
  ];

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
        {items.map((it) => (
          <button
            key={it.label}
            title={it.label}
            className={`p-2 rounded-lg transition-all ${
              it.active
                ? 'bg-primary-container/10 text-primary-fixed-dim'
                : 'text-on-surface-variant opacity-70 hover:bg-white/5 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={it.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {it.icon}
            </span>
          </button>
        ))}
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
            铁锻工程 (IronForge)
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-70">V3.4 Engine</p>
        </div>
      </div>

      {/* CTA */}
      <div className="px-gutter mb-4">
        <button className="w-full flex items-center justify-center gap-2 py-2 rounded-DEFAULT bg-surface-container-highest border border-white/10 text-on-surface hover:border-primary-fixed-dim/50 hover:bg-white/5 transition-all active:scale-95 duration-150 group">
          <span className="material-symbols-outlined text-primary-fixed-dim group-hover:rotate-90 transition-transform duration-300 text-[18px]">
            add
          </span>
          <span className="font-body-sm text-body-sm font-medium">新建模块</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {items.map((it) => (
          <a
            key={it.label}
            href="#"
            className={
              it.active
                ? 'flex items-center gap-4 bg-primary-container/10 text-primary-fixed-dim border-r-4 border-primary-fixed-dim px-4 py-3 rounded-lg font-bold bg-white/5'
                : 'flex items-center gap-4 text-on-surface-variant px-4 py-3 opacity-70 hover:bg-white/5 hover:text-on-surface transition-all rounded-lg active:translate-x-1 duration-150'
            }
            onClick={(e) => e.preventDefault()}
          >
            <span
              className="material-symbols-outlined"
              style={it.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {it.icon}
            </span>
            <span className="font-label-numeric text-label-numeric font-mono">{it.label}</span>
          </a>
        ))}
      </div>

      {/* Footer Tabs */}
      <div className="px-2 mt-auto border-t border-white/5 pt-2">
        <a
          href="#"
          className="flex items-center gap-4 text-on-surface-variant px-4 py-3 opacity-70 hover:bg-white/5 hover:text-on-surface transition-all rounded-lg active:translate-x-1 duration-150"
          onClick={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-numeric text-label-numeric font-mono">设置</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-4 text-on-surface-variant px-4 py-3 opacity-70 hover:bg-white/5 hover:text-on-surface transition-all rounded-lg active:translate-x-1 duration-150"
          onClick={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined">contact_support</span>
          <span className="font-label-numeric text-label-numeric font-mono">支持</span>
        </a>
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
