// 框架柱 KZ — 派生计算 (22G101-1)
import type { ColumnBarGroupKind, ColumnParams, ColumnStirrupSpec } from './types';
import type { RebarBundle } from '../kl/types';
import {
  columnDenseZoneRoot,
  columnDenseZoneEnd,
  columnConnectionOffset,
  llE,
  type LapRatio,
} from '../codes/22G101';

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
  /** 纵筋抗震搭接长度 llE (mm) */
  lapLength: number;
  /** 连接点距柱根楼面高度 (mm) = Hn/3 */
  connectionOffset: number;
  /** 相邻纵筋连接错开净距 (mm) ≥ 0.3 llE */
  connectionStagger: number;
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

/** 柱截面长边尺寸 hc */
function columnHc(params: ColumnParams): number {
  return Math.max(params.b, params.h);
}

/**
 * 柱端箍筋加密区计算 — 22G101-1 P.65 KZ 箍筋加密区范围
 *   - 柱根(嵌固部位 = 基础顶)：Hn/3
 *   - 其余柱端(上/下)：max(Hn/6, hc, 500)
 */
function calcDenseZoneBottom(params: ColumnParams): number {
  const isRoot = (params.baseType ?? 'foundation') === 'foundation';
  return isRoot ? columnDenseZoneRoot(params.Hn) : columnDenseZoneEnd(params.Hn, columnHc(params));
}

function calcDenseZoneTop(params: ColumnParams): number {
  return columnDenseZoneEnd(params.Hn, columnHc(params));
}

/**
 * 纵筋排布坐标 (矩形柱: 4 角 + 各边均匀分布)
 */
function calcBarPositions(params: ColumnParams): ColumnBarPosition[] {
  const positions: ColumnBarPosition[] = [];

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
interface LapZone {
  /** 搭接区起点 (距柱根, mm) */
  start: number;
  /** 搭接区终点 (mm) */
  end: number;
  /** 搭接区箍筋间距 ≤ min(5d, 100) (mm) */
  spacing: number;
}

function calcStirrupYs(
  params: ColumnParams,
  denseBottom: number,
  denseTop: number,
  lapZone: LapZone | null,
): { all: number[]; dense: number[]; sparse: number[] } {
  const dense: number[] = [];
  const sparse: number[] = [];
  const H = params.Hn;
  const { spacingDense, spacingSparse } = params.stirrup;
  const inLap = (v: number) => lapZone != null && v >= lapZone.start && v < lapZone.end;

  // 底部加密区
  let y = spacingDense / 2;
  while (y < denseBottom) {
    dense.push(y);
    y += spacingDense;
  }

  // 中部非加密区（搭接区范围内跳过，改由下方按加密间距填充）
  y = denseBottom + spacingSparse / 2;
  const topStart = H - denseTop;
  while (y < topStart) {
    if (!inLap(y)) sparse.push(y);
    y += spacingSparse;
  }

  // 搭接区箍筋加密 (22G101-1 / 文档 7.2.2-(2)：间距 ≤ min(5d,100))
  if (lapZone) {
    let ly = Math.max(lapZone.start, denseBottom);
    const lyEnd = Math.min(lapZone.end, topStart);
    while (ly < lyEnd) {
      dense.push(ly);
      ly += lapZone.spacing;
    }
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
  const floors = params.floors ?? 1;
  const totalHeight = params.floorHeight * floors;
  const denseZoneBottom = calcDenseZoneBottom(params);
  const denseZoneTop = calcDenseZoneTop(params);
  const sparseZone = Math.max(0, params.Hn - denseZoneBottom - denseZoneTop);
  const barPositions = calcBarPositions(params);

  const lapRatio = (params.lapRatio ?? 50) as LapRatio;
  const lapLength = llE(
    params.longitudinal.grade,
    params.longitudinal.diameter,
    params.concrete,
    params.seismic,
    lapRatio,
  );
  const connectionOffset = columnConnectionOffset(params.Hn);
  const connectionStagger = Math.ceil(0.3 * lapLength);

  // 绑扎搭接时，搭接区(含两批错开)箍筋按 ≤min(5d,100) 加密
  const isTie = (params.connectionType ?? 'tie') === 'tie';
  const lapZone = isTie
    ? {
        start: connectionOffset,
        end: connectionOffset + lapLength + connectionStagger,
        spacing: Math.min(Math.round(5 * params.longitudinal.diameter), 100, params.stirrup.spacingDense),
      }
    : null;
  const stirrupYGroups = calcStirrupYs(params, denseZoneBottom, denseZoneTop, lapZone);

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
    lapLength,
    connectionOffset,
    connectionStagger,
  };
}

export function normalizeColumnParams(input: unknown): ColumnParams {
  const raw = {
    ...defaultColumn(),
    ...(input as Partial<Omit<ColumnParams, 'sectionType'>> & { D?: number; sectionType?: string }),
  };
  if (raw.sectionType === 'circle') {
    const diameter = typeof raw.D === 'number' && Number.isFinite(raw.D) && raw.D > 0
      ? raw.D
      : Math.max(raw.b, raw.h);
    raw.b = diameter;
    raw.h = diameter;
  }

  const { D: _legacyDiameter, ...params } = raw;
  return {
    ...params,
    sectionType: 'rect',
  };
}

export function defaultColumn(): ColumnParams {
  return {
    sectionType: 'rect',
    b: 600,
    h: 600,
    Hn: 3600,
    beamHeight: 600,
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
    connectionType: 'tie',
    lapRatio: 50,
    position: 'middle',
    baseType: 'foundation',
    floors: 2,
  };
}
