import { useMemberStore } from '../store/memberStore';
import { useBeamStore } from '../store/beamStore';
import { useColumnStore } from '../store/columnStore';
import { getMemberEntry } from '../memberRegistry';

/**
 * 数据面板外壳：按当前构件类型从注册表取对应内容组件渲染。
 * 各构件的具体内容已拆分为独立文件，互不影响：
 *   - 框架梁(KL/梁类) → src/ui/data/BeamDataContent.tsx（私有，冻结）
 *   - 柱(KZ)          → src/ui/data/ColumnDataContent.tsx
 */
export function DataPanel() {
  const activeType = useMemberStore((s) => s.activeType);
  const isBeam = activeType === 'KL' || activeType === 'L' || activeType === 'WKL' || activeType === 'XL';
  const collapsed = isBeam
    ? useBeamStore((s) => s.ui.dataPanelCollapsed)
    : useColumnStore((s) => s.ui.dataPanelCollapsed);
  const setUi = isBeam
    ? useBeamStore((s) => s.setUi)
    : useColumnStore((s) => s.setUi);

  return (
    <div
      className={`flex shrink-0 z-20 relative ${
        collapsed ? 'h-10 transition-[height] duration-200' : 'h-full'
      }`}
      style={{ gap: 16 }}
    >
      {collapsed ? (
        <div className="w-full flex items-center px-4 bg-surface-container/80 border-t border-white/5">
          <button
            onClick={() => setUi({ dataPanelCollapsed: false })}
            className="flex items-center gap-2 text-on-surface-variant text-body-sm hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">expand_less</span>
            展开数据面板
          </button>
        </div>
      ) : (
        <>
          {(() => {
            const entry = getMemberEntry(activeType);
            if (!entry) return null;
            const DataContentComp = entry.dataContentComponent;
            return <DataContentComp />;
          })()}
          <button
            onClick={() => setUi({ dataPanelCollapsed: true })}
            title="收起"
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-primary-fixed-dim hover:bg-white/5 rounded transition-colors z-10"
          >
            <span className="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
        </>
      )}
    </div>
  );
}
