// 框架柱 KZ — 派生计算 (22G101-1)
import type { ColumnBarGroupKind, ColumnParams, ColumnStirrupSpec } from './types';
import type { RebarBundle } from '../kl/types';

export interface ColumnBarPosition {
  x: number;
  y: number;
  kind: ColumnBarGroupKind;
  bundle: RebarBundle;
}

export interface ColumnHoopLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'outer' | 'crossTie';
}

export interface ColumnDerived {
  /** 柱总高 (mm) */
  totalHeight: number;
  /** 加密区长度 (mm) — 柱底 */
  denseZoneBottom: number;
  /** 加密区长度 (mm) — 柱顶(梁下) */
  denseZoneTop: number;
  /** 非加密区长度 (mm) */
  sparseZone: number;
  /** 纵筋根数 (总) */
  totalBars: number;
  /** 纵筋坐标 (截面内 2D, mm) */
  barPositions: ColumnBarPosition[];
  /** 箍筋 X 坐标列表 (沿柱高, mm) */
  stirrupYs: number[];
  /** 加密区箍筋 Y 坐标 */
  denseStirrupYs: number[];
  /** 非加密区箍筋 Y 坐标 */
  sparseStirrupYs: number[];
  /** b/h 方向箍筋肢数 */
  stirrupLegs: { x: number; y: number };
  /** 截面箍筋线条，用于剖面图表达 m×n */
  hoopLines: ColumnHoopLine[];
}

function cloneBundle(bundle: RebarBundle, count = bundle.count): RebarBundle {
  return { grade: bundle.grade, diameter: bundle.diameter, count };
}

function normalLegs(stirrup: ColumnStirrupSpec): { x: number; y: number } {
  const fallback = stirrup.legs === 4 ? 3 : 2;
  return {
    x: Math.max(2, Math.min(8, Math.round(stirrup.legsX ?? fallback))),
    y: Math.max(2, Math.min(8, Math.round(stirrup.legsY ?? fallback))),
  };
}

/**
 * 加密区计算 — 22G101-1 P.52
 * 柱底: max(Hn/6, Hc, 500)  (一级抗震)
 *        max(Hn/6, Hc, 500)  (二级)
 *        max(Hn/6, Hc, 500)  (三四级可取 Hn/6 但不小于 Hc 和 500)
 * 柱顶(梁下): 同上
 */
function calcDenseZone(params: ColumnParams): number {
  const Hc = Math.max(params.b, params.h);
  const candidates = [params.Hn / 6, Hc, 500];
  return Math.ceil(Math.max(...candidates));
}

/**
 * 纵筋排布坐标
 * 矩形柱: 4 角 + 各边均匀分布
 * 圆柱: 沿圆周均布
 */
function calcBarPositions(params: ColumnParams): ColumnBarPosition[] {
  const positions: ColumnBarPosition[] = [];

  if (params.sectionType === 'circle') {
    const r = params.D / 2 - params.cover - params.longitudinal.diameter / 2;
    const n = params.longitudinal.count;
    const bundle = cloneBundle(params.longitudinal, 1);
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), kind: 'corner', bundle });
    }
    return positions;
  }

  // 矩形柱
  const mode = params.longitudinalMode ?? 'uniform';
  const corner = cloneBundle(params.cornerBar ?? params.longitudinal, 1);
  const uniformMid = Math.max(0, params.longitudinal.count - 2);
  const bMid = cloneBundle(
    params.bSideMidBar ?? params.longitudinal,
    mode === 'grouped' ? Math.max(0, params.bSideMidBar?.count ?? uniformMid) : uniformMid,
  );
  const hMid = cloneBundle(
    params.hSideMidBar ?? params.longitudinal,
    mode === 'grouped' ? Math.max(0, params.hSideMidBar?.count ?? uniformMid) : uniformMid,
  );
  const maxDia = Math.max(corner.diameter, bMid.diameter, hMid.diameter);
  const halfW = params.b / 2 - params.cover - maxDia / 2;
  const halfH = params.h / 2 - params.cover - maxDia / 2;

  // 4 角
  positions.push({ x: -halfW, y: halfH, kind: 'corner', bundle: corner });
  positions.push({ x: halfW, y: halfH, kind: 'corner', bundle: corner });
  positions.push({ x: halfW, y: -halfH, kind: 'corner', bundle: corner });
  positions.push({ x: -halfW, y: -halfH, kind: 'corner', bundle: corner });

  for (let i = 1; i <= bMid.count; i++) {
    const x = -halfW + (2 * halfW * i) / (bMid.count + 1);
    positions.push({ x, y: halfH, kind: 'bMid', bundle: cloneBundle(bMid, 1) });
    positions.push({ x, y: -halfH, kind: 'bMid', bundle: cloneBundle(bMid, 1) });
  }
  for (let i = 1; i <= hMid.count; i++) {
    const y = -halfH + (2 * halfH * i) / (hMid.count + 1);
    positions.push({ x: -halfW, y, kind: 'hMid', bundle: cloneBundle(hMid, 1) });
    positions.push({ x: halfW, y, kind: 'hMid', bundle: cloneBundle(hMid, 1) });
  }

  return positions;
}

/**
 * 箍筋 Y 坐标列表 (沿柱高方向)
 */
function calcStirrupYs(params: ColumnParams, denseBottom: number, denseTop: number): { all: number[]; dense: number[]; sparse: number[] } {
  const dense: number[] = [];
  const sparse: number[] = [];
  const H = params.Hn;
  const { spacingDense, spacingSparse } = params.stirrup;

  // 底部加密区
  let y = spacingDense / 2;
  while (y < denseBottom) {
    dense.push(y);
    y += spacingDense;
  }

  // 中部非加密区
  y = denseBottom + spacingSparse / 2;
  const topStart = H - denseTop;
  while (y < topStart) {
    sparse.push(y);
    y += spacingSparse;
  }

  // 顶部加密区
  y = topStart;
  while (y < H) {
    dense.push(y);
    y += spacingDense;
  }

  return { all: [...dense, ...sparse].sort((a, b) => a - b), dense, sparse };
}

function calcHoopLines(params: ColumnParams): ColumnHoopLine[] {
  const legs = normalLegs(params.stirrup);
  const c = params.cover + params.stirrup.diameter / 2;
  const halfW = (params.b - 2 * c) / 2;
  const halfH = (params.h - 2 * c) / 2;
  const lines: ColumnHoopLine[] = [
    { x1: -halfW, y1: halfH, x2: halfW, y2: halfH, kind: 'outer' },
    { x1: halfW, y1: halfH, x2: halfW, y2: -halfH, kind: 'outer' },
    { x1: halfW, y1: -halfH, x2: -halfW, y2: -halfH, kind: 'outer' },
    { x1: -halfW, y1: -halfH, x2: -halfW, y2: halfH, kind: 'outer' },
  ];

  for (let i = 1; i < legs.x - 1; i++) {
    const x = -halfW + (2 * halfW * i) / (legs.x - 1);
    lines.push({ x1: x, y1: halfH, x2: x, y2: -halfH, kind: 'crossTie' });
  }
  for (let i = 1; i < legs.y - 1; i++) {
    const y = -halfH + (2 * halfH * i) / (legs.y - 1);
    lines.push({ x1: -halfW, y1: y, x2: halfW, y2: y, kind: 'crossTie' });
  }
  return lines;
}

export function deriveColumn(params: ColumnParams): ColumnDerived {
  const totalHeight = params.floors * params.floorHeight;
  const denseZoneBottom = calcDenseZone(params);
  const denseZoneTop = calcDenseZone(params);
  const sparseZone = Math.max(0, params.Hn - denseZoneBottom - denseZoneTop);
  const barPositions = calcBarPositions(params);
  const stirrupYGroups = calcStirrupYs(params, denseZoneBottom, denseZoneTop);

  return {
    totalHeight,
    denseZoneBottom,
    denseZoneTop,
    sparseZone,
    totalBars: barPositions.length,
    barPositions,
    stirrupYs: stirrupYGroups.all,
    denseStirrupYs: stirrupYGroups.dense,
    sparseStirrupYs: stirrupYGroups.sparse,
    stirrupLegs: normalLegs(params.stirrup),
    hoopLines: calcHoopLines(params),
  };
}

export function defaultColumn(): ColumnParams {
  return {
    sectionType: 'rect',
    b: 600,
    h: 600,
    D: 600,
    Hn: 3600,
    floors: 1,
    floorHeight: 3600,
    cover: 25,
    concrete: 'C30',
    seismic: 2,
    longitudinal: { grade: 'HRB400', diameter: 25, count: 4 },
    longitudinalMode: 'uniform',
    cornerBar: { grade: 'HRB400', diameter: 25, count: 4 },
    bSideMidBar: { grade: 'HRB400', diameter: 25, count: 2 },
    hSideMidBar: { grade: 'HRB400', diameter: 25, count: 2 },
    stirrup: {
      grade: 'HRB400',
      diameter: 10,
      spacingDense: 100,
      spacingSparse: 200,
      type: 'rect',
      legs: 4,
      legsX: 3,
      legsY: 3,
      typeNo: 1,
    },
  };
}
