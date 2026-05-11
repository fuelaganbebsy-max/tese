interface IconBtnProps {
  icon: string;
  title?: string;
  onClick?: () => void;
}

function IconBtn({ icon, title, onClick }: IconBtnProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white/60 hover:text-white/90"
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

export function TopBar() {
  return (
    <header className="surface-1 border-b divider-strong flex justify-between items-center w-full px-6 h-14 shrink-0 z-50 relative">
      <div className="flex items-center gap-3">
        <span
          className="material-symbols-outlined text-primary text-[22px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          view_in_ar
        </span>
        <h1 className="text-[15px] font-medium text-primary tracking-wide">钢构 3D · 平法可视化</h1>
        <span className="hidden md:inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-sm border border-white/10 text-[9px] tracking-widest text-white/50 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          22G101-1
        </span>
      </div>

      <div className="flex-1 ml-8 max-w-md hidden md:flex items-center">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[16px]">
            search
          </span>
          <input
            type="text"
            placeholder="搜索参数、模块..."
            className="w-full surface-0 border divider-strong rounded-full text-white/90 focus:border-primary focus:ring-1 focus:ring-primary/50 h-8 pl-9 pr-16 text-[12px] transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] text-white/40 bg-white/5 font-mono">Ctrl</kbd>
            <kbd className="px-1.5 py-0.5 rounded text-[9px] text-white/40 bg-white/5 font-mono">K</kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <IconBtn icon="notifications" title="通知" />
        <IconBtn icon="settings" title="设置" />
        <IconBtn icon="help" title="帮助" />
        <div className="h-4 w-px bg-white/10 mx-2" />
        <button className="bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors text-primary text-[11px] tracking-wider px-4 h-8 rounded-full flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]">download</span>
          导出 BIM
        </button>
        <div className="ml-2 w-8 h-8 rounded-full border border-white/10 bg-gradient-to-br from-primary/20 to-teal/10 flex items-center justify-center text-primary text-[12px] font-mono">
          SE
        </div>
      </div>
    </header>
  );
}
