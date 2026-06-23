// 钢筋下料形状（用于 2D 展开下料图）。
// 纯逻辑、不依赖 three / DOM，便于单元测试。
//
// 设计：
//  - 'straight'      直筋（柱纵筋等）
//  - 'polyline'      带弯折的纵筋/拉筋 → 把 3D 中心线展平为 2D 折线，
//                    保留每段真实长度与相邻段弯折角度
//  - 'closedStirrup' 闭合矩形箍筋（外箍/内箍）→ 以矩形 + 135° 弯钩呈现

export type CutShapeKind = 'straight' | 'polyline' | 'closedStirrup';

export interface Pt3 {
  x: number;
  y: number;
  z: number;
}

export interface Pt2 {
  x: number;
  y: number;
}

export interface CutSegment {
  /** 直段长度 (mm) */
  length: number;
  /** 该段相对上一段的弯折角度 (°)；首段为 undefined */
  bendAngleDeg?: number;
}

export interface CutShape {
  kind: CutShapeKind;
  /** 钢筋名称/编号 */
  mark: string;
  grade?: string;
  diameter?: number;
  /** 总下料长度 (mm) */
  totalLength: number;
  /** 各直段 */
  segments: CutSegment[];
  /** 展平后的 2D 折线顶点 (mm)，用于绘制 */
  points2D?: Pt2[];
  /** 闭合箍筋尺寸 (mm) */
  stirrup?: { width: number; height: number; hookLength: number };
  note?: string;
}

const EPS = 1e-6;

function sub(a: Pt3, b: Pt3): Pt3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross(a: Pt3, b: Pt3): Pt3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function dot(a: Pt3, b: Pt3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function len(a: Pt3): number {
  return Math.hypot(a.x, a.y, a.z);
}
function norm(a: Pt3): Pt3 {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l };
}

/**
 * 把 3D 中心线折线展平为 2D 折线，保留每段真实长度与相邻段弯折角度。
 * 假设钢筋大致共面（绝大多数平法钢筋如此）；取首个非共线对确定参考平面法向。
 */
export function unfoldPolyline(points: Pt3[]): {
  segments: CutSegment[];
  points2D: Pt2[];
  totalLength: number;
} {
  // 去重相邻重合点
  const pts: Pt3[] = [];
  for (const p of points) {
    if (pts.length === 0 || len(sub(p, pts[pts.length - 1])) > EPS) pts.push(p);
  }
  if (pts.length < 2) {
    return { segments: [{ length: 0 }], points2D: [{ x: 0, y: 0 }], totalLength: 0 };
  }

  const dirs: Pt3[] = [];
  const lengths: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const v = sub(pts[i], pts[i - 1]);
    lengths.push(len(v));
    dirs.push(norm(v));
  }

  // 参考平面法向：首个非共线相邻方向对的叉积
  let normal: Pt3 = { x: 0, y: 0, z: 1 };
  for (let i = 1; i < dirs.length; i++) {
    const c = cross(dirs[i - 1], dirs[i]);
    if (len(c) > 1e-4) {
      normal = norm(c);
      break;
    }
  }

  const segments: CutSegment[] = [{ length: lengths[0] }];
  const points2D: Pt2[] = [
    { x: 0, y: 0 },
    { x: lengths[0], y: 0 },
  ];
  let heading = 0; // 首段沿 +x

  for (let i = 1; i < dirs.length; i++) {
    const prev = dirs[i - 1];
    const cur = dirs[i];
    const cosA = Math.max(-1, Math.min(1, dot(prev, cur)));
    // 平面内带符号转角
    const signed = Math.atan2(dot(cross(prev, cur), normal), cosA);
    const bendDeg = Math.abs((signed * 180) / Math.PI);
    heading += signed;
    const last = points2D[points2D.length - 1];
    points2D.push({
      x: last.x + lengths[i] * Math.cos(heading),
      y: last.y + lengths[i] * Math.sin(heading),
    });
    segments.push({ length: lengths[i], bendAngleDeg: bendDeg });
  }

  const totalLength = lengths.reduce((s, l) => s + l, 0);
  return { segments, points2D, totalLength };
}

/**
 * 按构件实际方向投影折线（保持钢筋在模型中的摆放方向，更直观）。
 * 沿“延展最小”的世界轴正交投影（平面钢筋即沿其法向投影，长度精确保留）；
 * 屏幕竖向优先映射世界 Y 轴（上为正），水平映射另一保留轴。
 */
export function projectPolyline(points: Pt3[]): {
  segments: CutSegment[];
  points2D: Pt2[];
  totalLength: number;
} {
  const pts: Pt3[] = [];
  for (const p of points) {
    if (pts.length === 0 || len(sub(p, pts[pts.length - 1])) > EPS) pts.push(p);
  }
  if (pts.length < 2) {
    return { segments: [{ length: 0 }], points2D: [{ x: 0, y: 0 }], totalLength: 0 };
  }

  const coord = (p: Pt3, a: number) => (a === 0 ? p.x : a === 1 ? p.y : p.z);
  const ranges = [0, 1, 2].map((a) => {
    let mn = Infinity, mx = -Infinity;
    for (const p of pts) { const v = coord(p, a); mn = Math.min(mn, v); mx = Math.max(mx, v); }
    return mx - mn;
  });
  const drop = ranges.indexOf(Math.min(...ranges));
  const remaining = [0, 1, 2].filter((a) => a !== drop);
  let vAxis: number, hAxis: number;
  if (remaining.includes(1)) {
    vAxis = 1; // 世界 Y → 屏幕竖向
    hAxis = remaining.find((a) => a !== 1)!;
  } else {
    vAxis = remaining[1];
    hAxis = remaining[0];
  }

  const points2D: Pt2[] = pts.map((p) => ({ x: coord(p, hAxis), y: coord(p, vAxis) }));
  const segments: CutSegment[] = [];
  let totalLength = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = len(sub(pts[i], pts[i - 1]));
    totalLength += l;
    segments.push({ length: l });
  }
  return { segments, points2D, totalLength };
}

/** 由 3D 中心线折线生成 CutShape（直筋或折线筋自动判定，保持实际方向）。 */
export function cutShapeFromPolyline(
  points: Pt3[],
  opts: { mark: string; grade?: string; diameter?: number; note?: string },
): CutShape {
  const { segments, points2D, totalLength } = projectPolyline(points);
  const kind: CutShapeKind = segments.length <= 1 ? 'straight' : 'polyline';
  return {
    kind,
    mark: opts.mark,
    grade: opts.grade,
    diameter: opts.diameter,
    totalLength,
    segments,
    points2D,
    note: opts.note,
  };
}

/** 直筋下料形状（柱纵筋等）。 */
export function straightBarCutShape(
  length: number,
  opts: { mark: string; grade?: string; diameter?: number; note?: string },
): CutShape {
  return {
    kind: 'straight',
    mark: opts.mark,
    grade: opts.grade,
    diameter: opts.diameter,
    totalLength: length,
    segments: [{ length }],
    points2D: [
      { x: 0, y: 0 },
      { x: length, y: 0 },
    ],
    note: opts.note,
  };
}

/**
 * 闭合矩形箍筋下料形状。
 * width/height 为箍筋中心线尺寸 (mm)，hookLength 为单个 135° 弯钩直段长度 (mm)。
 * 总下料长度 ≈ 周长 + 2 个弯钩。
 */
export function stirrupCutShape(
  width: number,
  height: number,
  hookLength: number,
  opts: { mark: string; grade?: string; diameter?: number; note?: string },
): CutShape {
  const perimeter = 2 * (width + height);
  const totalLength = Math.round(perimeter + 2 * hookLength);
  return {
    kind: 'closedStirrup',
    mark: opts.mark,
    grade: opts.grade,
    diameter: opts.diameter,
    totalLength,
    segments: [
      { length: Math.round(width) },
      { length: Math.round(height), bendAngleDeg: 90 },
      { length: Math.round(width), bendAngleDeg: 90 },
      { length: Math.round(height), bendAngleDeg: 90 },
      { length: Math.round(hookLength), bendAngleDeg: 135 },
    ],
    stirrup: { width: Math.round(width), height: Math.round(height), hookLength: Math.round(hookLength) },
    note: opts.note,
  };
}
