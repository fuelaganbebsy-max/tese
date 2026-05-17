export function TopBar() {
  return (
    <header className="bg-[#0d0d0d] border-b border-white/5 flex justify-between items-center w-full px-gutter h-16 shrink-0 z-50 backdrop-blur-md">
      {/* Brand / Search */}
      <div className="flex items-center gap-6 h-full">
        <div className="font-display-lg text-headline-md text-primary-fixed-dim tracking-tight flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary-fixed-dim"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            view_in_ar
          </span>
          Alpha-7 钢筋核心工程
        </div>
        {/* Search Bar */}
        <div className="relative w-64 ml-4 hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            className="w-full bg-surface-container-lowest border border-white/10 rounded-DEFAULT py-1.5 pl-9 pr-3 text-body-sm font-body-sm text-on-surface focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors placeholder:text-on-surface-variant/50"
            placeholder="搜索参数..."
            type="text"
          />
        </div>
      </div>

      {/* Trailing Actions */}
      <div className="flex items-center gap-3 h-full">
        {/* Icon Actions */}
        <div className="flex items-center gap-1 border-r border-white/10 pr-3 mr-1">
          {(['notifications', 'history', 'help'] as const).map((icon) => (
            <button
              key={icon}
              className="p-2 rounded-full text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors duration-200 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </button>
          ))}
        </div>
        {/* Secondary Action */}
        <button className="px-4 py-1.5 rounded-DEFAULT border border-white/10 text-on-surface font-body-sm text-body-sm hover:bg-white/5 transition-colors duration-200 active:scale-95">
          分享
        </button>
        {/* Primary Action */}
        <button className="px-4 py-1.5 rounded-DEFAULT bg-primary-fixed-dim text-on-primary font-body-sm text-body-sm font-semibold hover:bg-primary-fixed transition-colors duration-200 active:scale-95">
          导出
        </button>
        {/* Profile Image */}
        <div className="w-8 h-8 rounded-full bg-surface-container-high border border-white/10 overflow-hidden ml-2 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">person</span>
        </div>
      </div>
    </header>
  );
}
