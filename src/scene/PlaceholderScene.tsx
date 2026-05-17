import type { MemberType } from '../config';
import { MEMBER_LABELS } from '../config';

export function PlaceholderScene({ type }: { type: MemberType }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#121212]">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-[64px] text-on-surface-variant/30">construction</span>
        <div>
          <h3 className="text-xl font-bold text-on-surface/70">{MEMBER_LABELS[type]} ({type})</h3>
          <p className="text-sm text-on-surface-variant/50 mt-2">该构件模块正在开发中…</p>
          <p className="text-xs text-on-surface-variant/30 mt-1 font-mono">Phase 路线已规划，敬请期待</p>
        </div>
      </div>
    </div>
  );
}
