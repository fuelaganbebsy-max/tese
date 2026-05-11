import { useBeamStore } from '../store/beamStore';

interface NavItem {
  icon: string;
  label: string;
  count: number;
  active?: boolean;
  disabled?: boolean;
}

export function SideNav() {
  const spans = useBeamStore((s) => s.params.spans.length);
  const collapsed = useBeamStore((s) => s.ui.sideNavCollapsed);
  const setUi = useBeamStore((s) => s.setUi);

  const items: NavItem[] = [
    { icon: 'view_in_ar', label: '框架梁', count: spans, active: true },
    { icon: 'layers', label: '楼板', count: 0, disabled: true },
    { icon: 'view_column', label: '柱', count: 2, disabled: true },
    { icon: 'stairs', label: '楼梯', count: 0, disabled: true },
    { icon: 'foundation', label: '基础', count: 0, disabled: true },
  ];

  return (
    <nav
      className={`surface-1 border-r divider-strong flex flex-col h-full py-4 shrink-0 z-40 relative transition-[width] duration-200 ${
        collapsed ? 'w-14' : 'w-[240px]'
      }`}
    >
      <div className={collapsed ? 'px-2 mb-4' : 'px-4 mb-4'}>
        <div className={`flex items-center gap-3 mb-4 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-primary text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              architecture
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white/90 leading-tight truncate">结构模块</div>
              <div className="font-mono text-[10px] text-white/40 mt-0.5">精细配筋</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button className="w-full bg-transparent border border-white/10 text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors text-[11px] uppercase tracking-wider h-8 rounded flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">add</span>
            新建模块
          </button>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto flex flex-col gap-1 ${collapsed ? 'px-2' : 'px-2'}`}>
        {items.map((it) => (
          <button
            key={it.label}
            disabled={it.disabled}
            title={collapsed ? it.label : undefined}
            className={[
              'w-full flex items-center gap-3 rounded-md text-left group transition-all',
              collapsed ? 'h-9 justify-center' : 'px-3 py-2',
              it.active
                ? 'text-primary bg-primary/5 border border-primary/20'
                : 'text-white/50 hover:text-white/90 hover:bg-white/5 border border-transparent',
              it.disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-white/50' : '',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">{it.icon}</span>
            {!collapsed && (
              <div className="flex-1 flex justify-between items-center">
                <span className="text-[12px] tracking-wider">{it.label}</span>
                <span className={`font-mono text-[10px] ${it.active ? 'text-primary/70' : 'text-white/30'}`}>
                  {String(it.count).padStart(2, '0')}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className={`pt-4 border-t border-white/5 mt-auto flex flex-col gap-1 pb-2 ${collapsed ? 'px-2' : 'px-2'}`}>
        <button
          onClick={() => setUi({ sideNavCollapsed: !collapsed })}
          title={collapsed ? '展开' : '收起'}
          className={`w-full flex items-center gap-3 rounded-md text-white/50 hover:text-white/90 hover:bg-white/5 transition-all ${
            collapsed ? 'h-9 justify-center' : 'px-3 py-2'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          {!collapsed && <span className="text-[12px] tracking-wider">收起</span>}
        </button>
        <button
          title={collapsed ? '设置' : undefined}
          className={`w-full flex items-center gap-3 rounded-md text-white/50 hover:text-white/90 hover:bg-white/5 transition-all ${
            collapsed ? 'h-9 justify-center' : 'px-3 py-2'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">settings</span>
          {!collapsed && <span className="text-[12px] tracking-wider">设置</span>}
        </button>
        <button
          title={collapsed ? '帮助' : undefined}
          className={`w-full flex items-center gap-3 rounded-md text-white/50 hover:text-white/90 hover:bg-white/5 transition-all ${
            collapsed ? 'h-9 justify-center' : 'px-3 py-2'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">contact_support</span>
          {!collapsed && <span className="text-[12px] tracking-wider">帮助</span>}
        </button>
      </div>
    </nav>
  );
}
