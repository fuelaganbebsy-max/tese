// 框架柱 KZ — 派生计算 (22G101-1)
import type { ColumnParams } from './types';

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
  barPositions: { x: number; y: number }[];
  /** 箍筋 X 坐标列表 (沿柱高, mm) */
  stirrupYs: number[];
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
function calcBarPositions(params: ColumnParams): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];

  if (params.sectionType === 'circle') {
    const r = params.D / 2 - params.cover - params.longitudinal.diameter / 2;
    const n = params.longitudinal.count;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
    }
    return positions;
  }

  // 矩形柱
  const halfW = params.b / 2 - params.cover - params.longitudinal.diameter / 2;
  const halfH = params.h / 2 - params.cover - params.longitudinal.diameter / 2;
  const n = params.longitudinal.count; // 每边根数(含角筋)
  const perSide = Math.max(2, n); // 每边至少 2 根(角筋)

  // 4 角
  positions.push({ x: -halfW, y: halfH });
  positions.push({ x: halfW, y: halfH });
  positions.push({ x: halfW, y: -halfH });
  positions.push({ x: -halfW, y: -halfH });

  // 各边中间筋
  if (perSide > 2) {
    const midCount = perSide - 2;
    // top edge
    for (let i = 1; i <= midCount; i++) {
      positions.push({ x: -halfW + (2 * halfW * i) / (midCount + 1), y: halfH });
    }
    // bottom edge
    for (let i = 1; i <= midCount; i++) {
      positions.push({ x: -halfW + (2 * halfW * i) / (midCount + 1), y: -halfH });
    }
    // left edge
    for (let i = 1; i <= midCount; i++) {
      positions.push({ x: -halfW, y: -halfH + (2 * halfH * i) / (midCount + 1) });
    }
    // right edge
    for (let i = 1; i <= midCount; i++) {
      positions.push({ x: halfW, y: -halfH + (2 * halfH * i) / (midCount + 1) });
    }
  }

  return positions;
}

/**
 * 箍筋 Y 坐标列表 (沿柱高方向)
 */
function calcStirrupYs(params: ColumnParams, denseBottom: number, denseTop: number): number[] {
  const ys: number[] = [];
  const H = params.Hn;
  const { spacingDense, spacingSparse } = params.stirrup;

  // 底部加密区
  let y = spacingDense / 2;
  while (y < denseBottom) {
    ys.push(y);
    y += spacingDense;
  }

  // 中部非加密区
  y = denseBottom + spacingSparse / 2;
  const topStart = H - denseTop;
  while (y < topStart) {
    ys.push(y);
    y += spacingSparse;
  }

  // 顶部加密区
  y = topStart;
  while (y < H) {
    ys.push(y);
    y += spacingDense;
  }

  return ys;
}

export function deriveColumn(params: ColumnParams): ColumnDerived {
  const totalHeight = params.floors * params.floorHeight;
  const denseZoneBottom = calcDenseZone(params);
  const denseZoneTop = calcDenseZone(params);
  const sparseZone = Math.max(0, params.Hn - denseZoneBottom - denseZoneTop);
  const barPositions = calcBarPositions(params);
  const stirrupYs = calcStirrupYs(params, denseZoneBottom, denseZoneTop);

  return {
    totalHeight,
    denseZoneBottom,
    denseZoneTop,
    sparseZone,
    totalBars: barPositions.length,
    barPositions,
    stirrupYs,
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
    stirrup: {
      grade: 'HRB400',
      diameter: 10,
      spacingDense: 100,
      spacingSparse: 200,
      type: 'rect',
      legs: 4,
    },
  };
}
