import * as THREE from 'three';
import type { ColumnParams } from '../domain/kz/types';
import { getParamsForFloor } from '../domain/kz/types';
import type { ColumnDerived, SectionDims } from '../domain/kz/derive';
import { calcBarPositionsForSection } from '../domain/kz/derive';
import {
  columnTopBend,
  columnTopCanStraightAnchor,
  columnTopOuterLap,
  columnConnectionOffset,
  laE,
} from '../domain/codes/22G101';
import type { ConcreteGrade, SeismicLevel, RebarGrade } from '../domain/kl/types';
import { tubeFromPolyline } from './rebarPath';

/**
 * 框架柱 KZ 纵向钢筋三维几何构造 (22G101-1)。
 *
 * 坐标约定（与 ColumnScene 一致）：
 *   x = 截面 b 方向，z = 截面 h 方向，y = 竖向。
 *   barPositions 中 pos.x→世界 X、pos.y→世界 Z。
 *
 * 实现的构造做法：
 *   - 纵筋连接构造 (P.63 2-9)：连接点位于柱根加密区以上(≥Hn/3)的非加密区，
 *     相邻纵筋错开 ≥0.3·llE；支持 绑扎搭接 / 机械连接 / 焊接 三种。
 *   - 柱顶纵筋锚固 (P.67 2-15)：中柱顶 12d 弯锚；边柱/角柱外侧纵筋伸入梁内
 *     弯折(示意为加长弯折段)。
 *   - 柱根 (P.66 2-12)：基础顶设 6d 且 ≥150 的弯折(插筋)；楼层柱根直通下层。
 */

export type ColumnBarConnKind = 'lower' | 'upper' | 'continuous';

export interface ColumnLongBuilt {
  geometry: THREE.BufferGeometry;
  /** 中心线折线 (世界坐标 mm)，供下料简图使用 */
  points: THREE.Vector3[];
  meta: {
    label: string;
    /** 下料长度 (mm) */
    length: number;
    diameter: number;
    grade: string;
    kind: ColumnBarConnKind;
    note?: string;
  };
  barKey: string;
  color: string;
}

/** 连接接头标记几何（机械连接套筒 / 焊接凸起），用于在接头处额外渲染 */
export interface ColumnConnMarker {
  geometry: THREE.BufferGeometry;
  type: 'mechanical' | 'welded';
}

export interface ColumnLongResult {
  bars: ColumnLongBuilt[];
  markers: ColumnConnMarker[];
}

/** 竖向布局（世界 Y 坐标，mm） */
export interface ColumnLayout {
  /** 柱底（下层/基础延伸端） */
  botY: number;
  /** 柱根楼面标高 */
  floorY: number;
  /** 顶部框架梁底面 */
  topBeamBottomY: number;
  /** 顶部框架梁顶面 */
  topBeamTopY: number;
  /** 柱顶（梁顶以上伸出端） */
  topY: number;
  /** 层数 */
  floorCount: number;
  /** 每层净高（层高 = Hn + beamHeight） */
  floorHeight: number;
  /** 框架梁高 */
  beamHeight: number;
}

/** 柱顶梁高默认值 (mm)，与 ColumnScene 场景中绘制的梁一致 */
export const COLUMN_TOP_BEAM_HEIGHT = 600;
/** 柱上下伸出段默认值 (mm) */
export const COLUMN_EXTEND = 500;

/** 由柱净高生成默认竖向布局（供场景与下料表共用，保持一致） */
export function makeColumnLayout(Hn: number, beamHeight = COLUMN_TOP_BEAM_HEIGHT, extend = COLUMN_EXTEND, floors = 1): ColumnLayout {
  const storyH = Hn + beamHeight;
  return {
    botY: -extend,
    floorY: 0,
    topBeamBottomY: floors * storyH,
    topBeamTopY: floors * storyH + beamHeight,
    topY: floors * storyH + beamHeight,
    floorCount: floors,
    floorHeight: storyH,
    beamHeight,
  };
}

const BAR_COLORS: Record<string, string> = {
  corner: '#ef5350',
  bMid: '#ffa726',
  hMid: '#42a5f5',
};

const BAR_LABELS: Record<string, string> = {
  corner: '角筋',
  bMid: 'b边中部筋',
  hMid: 'h边中部筋',
};

function polylineLength(pts: THREE.Vector3[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += pts[i].distanceTo(pts[i - 1]);
  return l;
}

/**
 * 判断某根纵筋在边/角柱时是否位于"外侧面"（需伸入梁内弯折锚固）。
 * 约定：边柱外侧面 = +x 面；角柱外侧面 = +x 与 +z 两面。
 */
function isOuterBar(x: number, z: number, halfW: number, halfH: number, position: string): boolean {
  const onPlusX = x > halfW * 0.5;
  const onPlusZ = z > halfH * 0.5;
  if (position === 'edge') return onPlusX;
  if (position === 'corner') return onPlusX || onPlusZ;
  return false;
}

interface TopAnchorOpts {
  cover: number;
  grade: RebarGrade;
  concrete: ConcreteGrade;
  seismic: SeismicLevel;
}

/**
 * 生成柱顶锚固折线（从竖直段顶点开始），按 22G101-1 / 文档 7.3、7.4：
 *   - 中柱及内侧筋：梁底起算可用竖向锚固 ≥ laE 时【直锚】(伸至柱顶，不弯折)；
 *     否则【弯锚】(伸至柱顶 + 12d 水平内弯，7.3.2)。
 *   - 边柱/角柱外侧筋：节点外侧搭接，伸至柱顶后沿梁顶水平伸 1.5·labE (7.4.1)。
 * 返回追加到主筋折线末尾的点（不含竖直段起点；末点的竖向值即柱顶）。
 */
function topAnchorPoints(
  x: number,
  z: number,
  d: number,
  layout: ColumnLayout,
  outer: boolean,
  opts: TopAnchorOpts,
): { pts: THREE.Vector3[]; mode: 'straight' | 'bend' | 'outerLap' } {
  const topY = layout.topBeamTopY - opts.cover; // 伸至柱顶(扣保护层)
  const radial = new THREE.Vector2(x, z);
  if (radial.length() < 1e-6) radial.set(1, 0);
  radial.normalize();

  if (outer) {
    // 边/角柱外侧筋：柱顶外侧搭接 1.5 labE，沿梁顶水平伸向截面外侧
    const lap = columnTopOuterLap(opts.grade, d, opts.concrete, opts.seismic);
    return {
      pts: [
        new THREE.Vector3(x, topY, z),
        new THREE.Vector3(x + radial.x * lap, topY, z + radial.y * lap),
      ],
      mode: 'outerLap',
    };
  }

  // 中柱/内侧筋：梁底(=topBeamBottomY)起算的可用竖向锚固高度
  const available = topY - layout.topBeamBottomY;
  const canStraight = columnTopCanStraightAnchor(available, opts.grade, d, opts.concrete, opts.seismic);
  if (canStraight) {
    // 直锚：仅伸至柱顶
    return { pts: [new THREE.Vector3(x, topY, z)], mode: 'straight' };
  }
  // 弯锚：伸至柱顶 + 12d 水平内弯
  const bend = columnTopBend(d);
  const dir = radial.clone().negate();
  return {
    pts: [
      new THREE.Vector3(x, topY, z),
      new THREE.Vector3(x + dir.x * bend, topY, z + dir.y * bend),
    ],
    mode: 'bend',
  };
}

/**
 * 生成柱根折线（从竖直段底点向下）。
 * 返回插入到主筋折线起点前的点（不含主连接点）。
 */
function baseAnchorPoints(
  x: number,
  z: number,
  layout: ColumnLayout,
): THREE.Vector3[] {
  // 柱底直通，不弯折
  return [new THREE.Vector3(x, layout.botY, z)];
}

/** 上下层变截面的过渡梁区 Y 范围（仅 floors>=2 时存在） */
function sectionTransitionY(layout: ColumnLayout): { start: number; end: number } | null {
  if (layout.floorCount < 2) return null;
  return { start: layout.floorHeight, end: layout.floorHeight + layout.beamHeight };
}

/**
 * 生成从柱底到柱顶的竖直中心线，在上下层变截面时于梁高范围内斜弯过渡。
 * (x0,z0) 为下层截面位置，(x1,z1) 为上层截面位置（已含偏移）。
 */
function verticalCenterline(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  layout: ColumnLayout,
  cover: number,
): THREE.Vector3[] {
  const topY = layout.topBeamTopY - cover;
  const trans = sectionTransitionY(layout);
  if (!trans) {
    return [new THREE.Vector3(x0, layout.botY, z0), new THREE.Vector3(x0, topY, z0)];
  }
  return [
    new THREE.Vector3(x0, layout.botY, z0),
    new THREE.Vector3(x0, trans.start, z0),
    new THREE.Vector3(x1, trans.end, z1),
    new THREE.Vector3(x1, topY, z1),
  ];
}

/** 向截面内侧微移 1.5d，用于绑扎搭接上下段错开显示 */
function inwardNudge(x: number, z: number, d: number): { x: number; z: number } {
  const nudge = new THREE.Vector2(x, z);
  if (nudge.length() < 1e-6) nudge.set(1, 0);
  nudge.normalize().multiplyScalar(-1.5 * d);
  return { x: x + nudge.x, z: z + nudge.y };
}

/**
 * 生成从柱底到 targetY 的纵筋路径。
 * 当 targetY 位于上层柱段（高于变截面过渡区）时，终点取上层截面位置 (x1,z1)。
 */
function buildPathToY(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  layout: ColumnLayout,
  targetY: number,
): THREE.Vector3[] {
  const trans = sectionTransitionY(layout);
  if (!trans || targetY <= trans.start) {
    return [
      new THREE.Vector3(x0, layout.botY, z0),
      new THREE.Vector3(x0, targetY, z0),
    ];
  }
  if (targetY >= trans.end) {
    return [
      new THREE.Vector3(x0, layout.botY, z0),
      new THREE.Vector3(x0, trans.start, z0),
      new THREE.Vector3(x1, trans.end, z1),
      new THREE.Vector3(x1, targetY, z1),
    ];
  }
  // targetY 位于过渡梁区，线性内插截面位置
  const t = (targetY - trans.start) / (trans.end - trans.start);
  const x = x0 + (x1 - x0) * t;
  const z = z0 + (z1 - z0) * t;
  return [
    new THREE.Vector3(x0, layout.botY, z0),
    new THREE.Vector3(x0, trans.start, z0),
    new THREE.Vector3(x, targetY, z),
  ];
}

/**
 * 生成从 startY 到柱顶的纵筋路径。
 * 要求 startY 已经位于上层柱段（高于过渡区），因此全程沿上层截面位置 (x1,z1)。
 */
function buildPathFromYToTop(
  x1: number,
  z1: number,
  startY: number,
  d: number,
  layout: ColumnLayout,
  cover: number,
  outer: boolean,
  topOpts: TopAnchorOpts,
): THREE.Vector3[] {
  const topY = layout.topBeamTopY - cover;
  const topAnchor = topAnchorPoints(x1, z1, d, layout, outer, topOpts);
  return dedupe([
    new THREE.Vector3(x1, startY, z1),
    new THREE.Vector3(x1, topY, z1),
    ...topAnchor.pts,
  ]);
}

export function buildColumnLongitudinal(
  params: ColumnParams,
  derived: ColumnDerived,
  layout: ColumnLayout,
): ColumnLongResult {
  const bars: ColumnLongBuilt[] = [];
  const markers: ColumnConnMarker[] = [];

  const connType = params.connectionType ?? 'tie';
  const position = params.position ?? 'middle';
  const lap = derived.lapLength;
  const stagger = derived.connectionStagger;

  // 上下层纵筋连接区位置：多层柱时位于上层柱底部非加密区以上（楼面梁顶 + Hn/3），
  // 单层柱时位于下层柱非加密区（≥ Hn/3）。
  const floors = layout.floorCount;
  const upperHn = params.upperHn ?? params.Hn;
  const upperConnOffset = columnConnectionOffset(upperHn);
  const baseSplice = floors >= 2
    ? layout.floorHeight + layout.beamHeight + upperConnOffset
    : layout.floorY + derived.connectionOffset;

  const c = params.cover + params.stirrup.diameter / 2;
  const halfW = params.b / 2 - c;
  const halfH = params.h / 2 - c;

  // 上层截面尺寸与偏移
  const topB = params.topB ?? params.b;
  const topH = params.topH ?? params.h;
  const offsetX = params.topOffsetX ?? 0;
  const offsetZ = params.topOffsetZ ?? 0;
  const upperDims: SectionDims = { b: topB, h: topH };
  const upperParams = getParamsForFloor(params, true);
  const upperBarPositions = calcBarPositionsForSection(upperParams, upperDims).map((p) => ({
    ...p,
    x: p.x + offsetX,
    y: p.y + offsetZ,
  }));

  // 柱顶锚固外侧判断按上层截面尺寸
  const upperHalfW = topB / 2 - c;
  const upperHalfH = topH / 2 - c;

  derived.barPositions.forEach((lowerPos, i) => {
    const upperPos = upperBarPositions[i];
    if (!upperPos) return;
    const x0 = lowerPos.x;
    const z0 = lowerPos.y;
    const x1 = upperPos.x;
    const z1 = upperPos.y;
    const dLower = lowerPos.bundle.diameter;
    const dUpper = upperPos.bundle.diameter;
    const gradeLower = lowerPos.bundle.grade as string;
    const gradeUpper = upperPos.bundle.grade as string;
    const color = BAR_COLORS[lowerPos.kind] ?? '#ef5350';
    const baseLabel = `柱${BAR_LABELS[lowerPos.kind] ?? '纵筋'} #${i + 1}`;
    const outer = isOuterBar(x1, z1, upperHalfW, upperHalfH, position);
    const topOpts: TopAnchorOpts = { cover: params.cover, grade: upperPos.bundle.grade, concrete: params.concrete, seismic: params.seismic };
    const topNote = (mode: 'straight' | 'bend' | 'outerLap') =>
      mode === 'straight' ? '柱顶直锚' : mode === 'outerLap' ? '柱顶外侧搭接 1.5labE' : '柱顶 12d 弯锚';

    // 上下层纵筋直径不同时，按 22G101-1 2-9 采用机械连接（套筒连接）
    const dDiffers = dLower !== dUpper;
    const effectiveConnType = dDiffers ? 'mechanical' : connType;

    // 相邻纵筋错开：奇偶两批，第二批连接点上移
    // - 绑扎搭接：错开 0.3 llE
    // - 机械连接：相邻接头错开 ≥ 35d（d 为纵筋直径）
    const batch = i % 2;
    const staggerDist = effectiveConnType === 'tie' ? lap + stagger : 35 * dLower;
    const spliceY = baseSplice + batch * staggerDist;

    // 变截面斜弯条件：22G101-1 7.2.7，水平偏移 Δ 与梁高 hb 之比 ≤ 1/6 时允许弯折通上
    const trans = sectionTransitionY(layout);
    const dx = x1 - x0;
    const dz = z1 - z0;
    const horizontalDelta = Math.sqrt(dx * dx + dz * dz);
    const canBend = !trans || layout.beamHeight <= 0 || horizontalDelta / layout.beamHeight <= 1 / 6;

    if (!canBend) {
      // 无法弯折通上：按 22G101-1 7.2.7 图③处理
      // 下柱筋：柱底 → 梁顶 → 水平向截面内侧弯折 12d（倒 L 形）
      const lowerHook = 12 * dLower;
      const inward = new THREE.Vector2(x0, z0);
      if (inward.length() < 1e-6) inward.set(1, 0);
      inward.normalize().multiplyScalar(-1);
      const ix = inward.x;
      const iz = inward.y;
      // 伸到梁上截面下端，考虑保护层厚度：纵筋中心线位于上截面底 - cover
      const lowerEnd = trans.end - params.cover;
      const lowerPts = [
        new THREE.Vector3(x0, layout.botY, z0),
        new THREE.Vector3(x0, lowerEnd, z0),
        new THREE.Vector3(x0 + ix * lowerHook, lowerEnd, z0 + iz * lowerHook),
      ];
      bars.push({
        geometry: tubeFromPolyline(lowerPts, dLower / 2, 10),
        points: lowerPts,
        meta: { label: `${baseLabel}(下柱锚固段)`, length: Math.round(polylineLength(lowerPts)), diameter: dLower, grade: gradeLower, kind: 'lower', note: `变截面无法弯折通上，下柱筋伸至梁顶后水平弯折 12d` },
        barKey: `col-bar-${i}-lo`,
        color,
      });

      // 上柱筋：从梁顶（考虑 cover）向下 1.2laE 处起筋 → 柱顶锚固
      const upperLa = laE(gradeUpper as RebarGrade, dUpper, params.concrete, params.seismic);
      const upperStart = lowerEnd - 1.2 * upperLa;
      const topAnchor = topAnchorPoints(x1, z1, dUpper, layout, outer, topOpts);
      const upperPts = buildPathFromYToTop(x1, z1, upperStart, dUpper, layout, params.cover, outer, topOpts);
      bars.push({
        geometry: tubeFromPolyline(upperPts, dUpper / 2, 10),
        points: upperPts,
        meta: { label: `${baseLabel}(上柱起筋段)`, length: Math.round(polylineLength(upperPts)), diameter: dUpper, grade: gradeUpper, kind: 'upper', note: `${topNote(topAnchor.mode)} · 变截面无法弯折通上，上柱筋向下延伸 1.2laE 起筋` },
        barKey: `col-bar-${i}-up`,
        color,
      });
      return;
    }

    if (effectiveConnType === 'tie') {
      const d = dLower;
      const r = d / 2;
      const lapBottom = spliceY;
      const lapTop = spliceY + lap;
      // 连接区位于上层柱，上下段错开显示均按上层截面位置内移
      const loNudge = inwardNudge(x1, z1, d);
      const upNudge = inwardNudge(x1, z1, d);

      // 下筋：柱底 → 搭接顶（位于上层截面）
      const lowerPts = buildPathToY(loNudge.x, loNudge.z, upNudge.x, upNudge.z, layout, lapTop);
      bars.push({
        geometry: tubeFromPolyline(lowerPts, r, 10),
        points: lowerPts,
        meta: { label: `${baseLabel}(下段)`, length: Math.round(polylineLength(lowerPts)), diameter: d, grade: gradeLower, kind: 'lower', note: `绑扎搭接 llE=${lap}` },
        barKey: `col-bar-${i}-lo`,
        color,
      });

      // 上筋：搭接底 → 柱顶锚固
      const topAnchor = topAnchorPoints(upNudge.x, upNudge.z, d, layout, outer, topOpts);
      const upperPts = buildPathFromYToTop(upNudge.x, upNudge.z, lapBottom, d, layout, params.cover, outer, topOpts);
      bars.push({
        geometry: tubeFromPolyline(upperPts, r, 10),
        points: upperPts,
        meta: { label: `${baseLabel}(上段)`, length: Math.round(polylineLength(upperPts)), diameter: d, grade: gradeUpper, kind: 'upper', note: topNote(topAnchor.mode) },
        barKey: `col-bar-${i}-up`,
        color,
      });
    } else if (dDiffers) {
      // 机械连接（变径）：下段与上段分别按各自直径，接头处用锥形套筒标记
      const rLower = dLower / 2;
      const rUpper = dUpper / 2;

      // 下筋：柱底 → 接头（接头位于上层截面）
      const lowerPts = buildPathToY(x0, z0, x1, z1, layout, spliceY);
      bars.push({
        geometry: tubeFromPolyline(lowerPts, rLower, 10),
        points: lowerPts,
        meta: { label: `${baseLabel}(下段)`, length: Math.round(polylineLength(lowerPts)), diameter: dLower, grade: gradeLower, kind: 'lower', note: `机械连接（下柱 ⌀${dLower}）` },
        barKey: `col-bar-${i}-lo`,
        color,
      });

      // 上筋：接头 → 柱顶锚固
      const topAnchor = topAnchorPoints(x1, z1, dUpper, layout, outer, topOpts);
      const upperPts = buildPathFromYToTop(x1, z1, spliceY, dUpper, layout, params.cover, outer, topOpts);
      bars.push({
        geometry: tubeFromPolyline(upperPts, rUpper, 10),
        points: upperPts,
        meta: { label: `${baseLabel}(上段)`, length: Math.round(polylineLength(upperPts)), diameter: dUpper, grade: gradeUpper, kind: 'upper', note: `${topNote(topAnchor.mode)} · 机械连接（上柱 ⌀${dUpper}）` },
        barKey: `col-bar-${i}-up`,
        color,
      });

      // 变径套筒标记：连接区长度按较小直径取值，位置取接头中心点
      const minD = Math.min(dLower, dUpper);
      const connPt = lowerPts[lowerPts.length - 1];
      const markerGeo = new THREE.CylinderGeometry(dUpper * 0.8, dLower * 0.8, 8 * minD, 12);
      markerGeo.translate(connPt.x, connPt.y, connPt.z);
      markers.push({ geometry: markerGeo, type: 'mechanical' });
    } else {
      // 机械连接 / 焊接：连续筋在接头处对接，附套筒/焊点标记
      const d = dLower;
      const r = d / 2;
      const line = verticalCenterline(x0, z0, x1, z1, layout, params.cover);
      const topAnchor = topAnchorPoints(x1, z1, d, layout, outer, topOpts);
      const fullPts = dedupe([...line, ...topAnchor.pts]);
      const connNote = effectiveConnType === 'mechanical' ? '机械连接' : '焊接';
      bars.push({
        geometry: tubeFromPolyline(fullPts, r, 10),
        points: fullPts,
        meta: { label: baseLabel, length: Math.round(polylineLength(fullPts)), diameter: d, grade: gradeLower, kind: 'continuous', note: `${connNote} · ${topNote(topAnchor.mode)}` },
        barKey: `col-bar-${i}`,
        color,
      });

      // 接头标记位于上层截面（连接区在上层柱底部非加密区内）
      const connPt = buildPathToY(x0, z0, x1, z1, layout, spliceY).slice(-1)[0];
      const markerGeo = effectiveConnType === 'mechanical'
        ? new THREE.CylinderGeometry(d * 0.8, d * 0.8, 8 * d, 12)
        : new THREE.SphereGeometry(d * 0.7, 12, 8);
      markerGeo.translate(connPt.x, connPt.y, connPt.z);
      markers.push({ geometry: markerGeo, type: effectiveConnType });
    }
  });

  return { bars, markers };
}

function dedupe(pts: THREE.Vector3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const p of pts) {
    if (out.length === 0 || out[out.length - 1].distanceTo(p) > 1e-6) out.push(p);
  }
  return out;
}
