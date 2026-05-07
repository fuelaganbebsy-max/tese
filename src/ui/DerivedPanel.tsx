import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';

export function DerivedPanel() {
  const params = useBeamStore((s) => s.params);
  const d = useMemo(() => derive(params), [params]);

  const stirrupCount = d.spans.reduce((s, sp) => s + sp.stirrupXs.length, 0);

  return (
    <div className="text-xs text-slate-300 px-3 py-2 bg-slate-900/70 backdrop-blur rounded border border-slate-700 space-y-1 max-w-md">
      <div className="text-slate-100 font-medium mb-1">系统计算 (16G101-1 简化)</div>
      <div>梁全长 (含支座): <span className="text-blue-300">{d.totalLength} mm</span></div>
      <div>上部贯通锚固 laE: <span className="text-blue-300">{d.topAnchor.laE.toFixed(0)} mm</span> · 弯锚水平 <span className="text-blue-300">{d.topAnchor.horizontal.toFixed(0)}</span> + 竖直 <span className="text-blue-300">{d.topAnchor.vertical.toFixed(0)}</span></div>
      <div>箍筋加密区长度: <span className="text-blue-300">{d.densifiedZoneLen.toFixed(0)} mm</span> · 全梁箍筋数: <span className="text-blue-300">{stirrupCount}</span></div>
      <div className="text-slate-400">支座负筋伸出: {d.topSupportExtend.map((e, i) => `跨${i + 1}[L=${e.left.toFixed(0)}, R=${e.right.toFixed(0)}]`).join(' · ')}</div>
    </div>
  );
}
