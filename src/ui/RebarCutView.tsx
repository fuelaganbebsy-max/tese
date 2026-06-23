import { useMemo, useRef, useState, useEffect } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { useSelectionStore } from '../store/selectionStore';
import type { CutShape, Pt2 } from '../domain/rebarShape';

/** 滚轮缩放 + 拖拽平移容器（鼠标进入后滚轮放大缩小图形） */
function ZoomPan({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setT((prev) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const ns = Math.min(8, Math.max(0.4, prev.s * factor));
        const k = ns / prev.s;
        return { s: ns, x: cx - (cx - prev.x) * k, y: cy - (cy - prev.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onDown = (e: ReactMouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: t.x, oy: t.y };
    setGrabbing(true);
  };
  const onMove = (e: ReactMouseEvent) => {
    const d = drag.current;
    if (!d) return;
    setT((p) => ({ ...p, x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }));
  };
  const onUp = () => { drag.current = null; setGrabbing(false); };

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
    >
      <div style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transformOrigin: '0 0', width: '100%' }}>
        {children}
      </div>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setT({ s: 1, x: 0, y: 0 })}
        className="absolute bottom-2 right-2 px-2 py-1 rounded bg-surface-container-highest/80 border border-white/10 text-[11px] text-on-surface-variant hover:text-on-surface"
        title="重置缩放"
      >
        重置
      </button>
    </div>
  );
}

const STROKE = '#00daf3';
const DIM = '#9aa7ab';

/** 计算折线的包围盒 */
function bbox(pts: Pt2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** 折线/直筋展开图 */
function PolylineDiagram({ shape }: { shape: CutShape }) {
  const pts = shape.points2D ?? [];
  const layout = useMemo(() => {
    const W = 520, H = 300, pad = 56;
    const bb = bbox(pts);
    const sw = bb.w > 1e-6 ? (W - 2 * pad) / bb.w : 1;
    const sh = bb.h > 1e-6 ? (H - 2 * pad) / bb.h : 1;
    const s = Math.min(sw, sh, 1.5);
    // SVG y 向下，几何 y 向上 → 翻转
    const ox = pad - bb.minX * s + (W - 2 * pad - bb.w * s) / 2;
    const oy = H - pad + bb.minY * s - (H - 2 * pad - bb.h * s) / 2;
    const tx = (p: Pt2) => ({ x: ox + p.x * s, y: oy - p.y * s });
    return { W, H, screen: pts.map(tx) };
  }, [pts]);

  if (pts.length < 2) return null;
  const { W, H, screen } = layout;
  const path = screen.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 340 }}>
      <path d={path} fill="none" stroke={STROKE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      {/* 端点 */}
      {[screen[0], screen[screen.length - 1]].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#fff" />
      ))}
      {/* 各段长度标注 */}
      {shape.segments.map((seg, i) => {
        if (i + 1 >= screen.length) return null;
        const a = screen[i], b = screen[i + 1];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len; // 法向
        const off = 14;
        return (
          <text
            key={i}
            x={mx + nx * off}
            y={my + ny * off}
            fill={DIM}
            fontSize={13}
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {Math.round(seg.length)}
          </text>
        );
      })}
    </svg>
  );
}

/** 闭合矩形箍筋图 */
function StirrupDiagram({ shape }: { shape: CutShape }) {
  const st = shape.stirrup;
  if (!st) return null;
  const W = 520, H = 320, pad = 70;
  const bw = W - 2 * pad, bh = H - 2 * pad;
  const sx = bw / st.width, sy = bh / st.height;
  const s = Math.min(sx, sy, 0.6);
  const rw = st.width * s, rh = st.height * s;
  const x0 = (W - rw) / 2, y0 = (H - rh) / 2;
  const hk = Math.max(20, st.hookLength * s);
  const hd = hk * Math.SQRT1_2;            // 135° 弯钩对角投影
  const gap = Math.min(rw, rh) * 0.16;     // 两钩沿边错开量
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 360 }}>
      {/* 闭合矩形箍筋（与剖切面一致） */}
      <rect x={x0} y={y0} width={rw} height={rh} fill="none" stroke={STROKE} strokeWidth={4} strokeLinejoin="round" />
      {/* 两个 135° 弯钩集中于左上角，均沿对角线向截面内侧斜伸（与剖切面式样一致） */}
      <line x1={x0 + gap} y1={y0} x2={x0 + gap + hd} y2={y0 + hd} stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
      <line x1={x0} y1={y0 + gap} x2={x0 + hd} y2={y0 + gap + hd} stroke={STROKE} strokeWidth={4} strokeLinecap="round" />
      {/* 宽度标注 */}
      <text x={x0 + rw / 2} y={y0 - 14} fill={DIM} fontSize={13} fontFamily="monospace" textAnchor="middle">{st.width}</text>
      {/* 高度标注 */}
      <text x={x0 - 16} y={y0 + rh / 2} fill={DIM} fontSize={13} fontFamily="monospace" textAnchor="middle" transform={`rotate(-90 ${x0 - 16} ${y0 + rh / 2})`}>{st.height}</text>
      {/* 弯钩标注（向截面中心偏移，避免与钢筋重叠） */}
      <text x={x0 + rw * 0.32} y={y0 + rh * 0.3} fill={DIM} fontSize={12} fontFamily="monospace">弯钩 {st.hookLength}</text>
    </svg>
  );
}

export function RebarCutView() {
  const selected = useSelectionStore((s) => s.selected);

  if (!selected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/60">touch_app</span>
        <p className="text-on-surface-variant text-body-sm">单击 3D 模型中的任意一根钢筋<br />查看其下料简图与尺寸标注</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-white/5 bg-surface-container-highest/30 flex justify-between items-center shrink-0">
        <h3 className="font-body-md text-body-md font-medium text-on-surface flex items-center gap-2 font-bold">
          <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">straighten</span>
          {selected.mark}
        </h3>
        {selected.grade && selected.diameter != null && (
          <span className="px-1.5 py-0.5 rounded bg-surface-container-highest border border-white/5 text-on-surface font-mono text-[12px]">
            {selected.grade} ∅{selected.diameter}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden p-3">
        <ZoomPan key={selected.mark}>
          <div className="w-full flex items-center justify-center">
            {selected.kind === 'closedStirrup'
              ? <StirrupDiagram shape={selected} />
              : <PolylineDiagram shape={selected} />}
          </div>
        </ZoomPan>
      </div>

      <div className="border-t border-white/5 px-4 py-2 flex items-center justify-between bg-surface-container-highest/30 gap-3">
        <span className="text-[11px] text-on-surface-variant truncate">{selected.note ?? '尺寸单位：mm'}</span>
        <span className="font-label-numeric text-label-numeric text-primary-fixed-dim font-mono font-bold whitespace-nowrap">
          下料长 {selected.totalLength} mm
        </span>
      </div>
    </div>
  );
}
