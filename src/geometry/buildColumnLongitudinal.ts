import * as THREE from 'three';
import type { ColumnParams } from '../domain/kz/types';
import type { ColumnDerived } from '../domain/kz/derive';
import {
  columnTopBend,
  columnTopCanStraightAnchor,
  columnTopOuterLap,
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
  /** 每层净高 */
  floorHeight: number;
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

export function buildColumnLongitudinal(
  params: ColumnParams,
  derived: ColumnDerived,
  layout: ColumnLayout,
): ColumnLongResult {
  const bars: ColumnLongBuilt[] = [];
  const markers: ColumnConnMarker[] = [];

  const connType = params.connectionType ?? 'tie';
  const position = params.position ?? 'middle';
  const baseType = params.baseType ?? 'foundation';
  const lap = derived.lapLength;
  const stagger = derived.connectionStagger;
  const baseSplice = layout.floorY + derived.connectionOffset; // ≥ Hn/3

  const c = params.cover + params.stirrup.diameter / 2;
  const halfW = params.b / 2 - c;
  const halfH = params.h / 2 - c;

  derived.barPositions.forEach((pos, i) => {
    const x = pos.x;
    const z = pos.y;
    const d = pos.bundle.diameter;
    const r = d / 2;
    const grade = pos.bundle.grade as string;
    const color = BAR_COLORS[pos.kind] ?? '#ef5350';
    const baseLabel = `柱${BAR_LABELS[pos.kind] ?? '纵筋'} #${i + 1}`;
    const outer = isOuterBar(x, z, halfW, halfH, position);
    const topOpts: TopAnchorOpts = { cover: params.cover, grade: pos.bundle.grade, concrete: params.concrete, seismic: params.seismic };
    const topNote = (mode: 'straight' | 'bend' | 'outerLap') =>
      mode === 'straight' ? '柱顶直锚' : mode === 'outerLap' ? '柱顶外侧搭接 1.5labE' : '柱顶 12d 弯锚';

    // 相邻纵筋错开：奇偶两批，第二批连接点上移 (lap + stagger)
    const batch = i % 2;
    const spliceY = baseSplice + batch * (lap + stagger);

    if (connType === 'tie') {
      // 绑扎搭接：下筋 + 上筋 搭接 llE，上筋向截面内侧微移 1.5d 以示双筋并扎
      const lapBottom = spliceY;
      const lapTop = spliceY + lap;
      const nudge = new THREE.Vector2(x, z);
      if (nudge.length() < 1e-6) nudge.set(1, 0);
      nudge.normalize().multiplyScalar(-1.5 * d);
      const ux = x + nudge.x;
      const uz = z + nudge.y;

      // 下筋：柱底 → 搭接顶
      const lowerPts = [
        ...baseAnchorPoints(x, z, layout),
        new THREE.Vector3(x, lapTop, z),
      ];
      bars.push({
        geometry: tubeFromPolyline(lowerPts, r, 10),
        points: lowerPts,
        meta: { label: `${baseLabel}(下段)`, length: Math.round(polylineLength(lowerPts)), diameter: d, grade, kind: 'lower', note: `绑扎搭接 llE=${lap}` },
        barKey: `col-bar-${i}-lo`,
        color,
      });

      // 上筋：搭接底 → 柱顶锚固（上段在 nudge 位置）
      const top = topAnchorPoints(ux, uz, d, layout, outer, topOpts);
      const upperClean = dedupe([new THREE.Vector3(ux, lapBottom, uz), ...top.pts]);
      bars.push({
        geometry: tubeFromPolyline(upperClean, r, 10),
        points: upperClean,
        meta: { label: `${baseLabel}(上段)`, length: Math.round(polylineLength(upperClean)), diameter: d, grade, kind: 'upper', note: topNote(top.mode) },
        barKey: `col-bar-${i}-up`,
        color,
      });
    } else {
      // 机械连接 / 焊接：连续筋在接头处对接，附套筒/焊点标记
      const top = topAnchorPoints(x, z, d, layout, outer, topOpts);
      const fullPts = dedupe([
        ...baseAnchorPoints(x, z, layout),
        ...top.pts,
      ]);
      const connNote = connType === 'mechanical' ? '机械连接' : '焊接';
      bars.push({
        geometry: tubeFromPolyline(fullPts, r, 10),
        points: fullPts,
        meta: { label: baseLabel, length: Math.round(polylineLength(fullPts)), diameter: d, grade, kind: 'continuous', note: `${connNote} · ${topNote(top.mode)}` },
        barKey: `col-bar-${i}`,
        color,
      });

      // 接头标记
      const markerGeo = connType === 'mechanical'
        ? new THREE.CylinderGeometry(d * 0.8, d * 0.8, 8 * d, 12)
        : new THREE.SphereGeometry(d * 0.7, 12, 8);
      markerGeo.translate(x, spliceY, z);
      markers.push({ geometry: markerGeo, type: connType });
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
