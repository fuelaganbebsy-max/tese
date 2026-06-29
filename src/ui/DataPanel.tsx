import { useMemberStore } from '../store/memberStore';
import { getMemberEntry } from '../memberRegistry';

/**
 * 数据面板外壳：按当前构件类型从注册表取对应内容组件渲染。
 * 各构件的具体内容已拆分为独立文件，互不影响：
 *   - 框架梁(KL/梁类) → src/ui/data/BeamDataContent.tsx（私有，冻结）
 *   - 柱(KZ)          → src/ui/data/ColumnDataContent.tsx
 */
export function DataPanel() {
  const activeType = useMemberStore((s) => s.activeType);
  return (
    <div className="flex shrink-0 z-20 relative h-full" style={{ gap: 16 }}>
      {(() => {
        const entry = getMemberEntry(activeType);
        if (!entry) return null;
        const DataContentComp = entry.dataContentComponent;
        return <DataContentComp />;
      })()}
    </div>
  );
}
