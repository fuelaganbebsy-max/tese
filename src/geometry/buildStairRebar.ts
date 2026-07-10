// AT 型板式楼梯 — 配筋三维几何 (22G101-2 第2-8页)
// 坐标：x = 水平投影方向，y = 竖直，z = 板宽方向 (沿板宽中心 z=0)
//
// 构造原则：
//  - 踏步根连线为斜板顶面（结构面），法向 n=(sinθ,-cosθ) 指向下/右；
//  - 斜板底面 = 顶面 + h·n；
//  - 下部纵筋中心线 = 底面 - cover·n = 顶面 + (h-cover)·n；
//  - 上部纵筋中心线 = 顶面 - cover·n；
//  - 钢筋伸入梯梁/平台板时，先在梁顶面下 cover 处水平走锚固段，再转折进入斜板。

import * as THREE from 'three';
import type { StairParams } from '../domain/at/types';
import { deriveStair, type StairLayout } from '../domain/at/derive';
import { tubeFromPolyline } from './rebarPath';

export interface StairBarResult {
  geometry: THREE.BufferGeometry;
  points: THREE.Vector3[];
  meta: {
    label: string;
    length: number;
    diameter: number;
    grade: string;
    kind: 'bottom' | 'top' | 'distribution';
    note?: string;
  };
  barKey: string;
  color: string;
}

export interface StairRebarResult {
  bars: StairBarResult[];
}

const BAR_COLORS = {
  bottom: '#facc15', // 黄色纵筋
  top: '#facc15',    // 黄色纵筋
  distribution: '#3b82f6', // 蓝色分布筋
} as const;

/** 顶面/底面/纵筋中心线上某点的 x,y；s 为沿顶面斜线从低端起的距离，offset 为沿法向 n 的偏移量 */
function surfacePoint(layout: StairLayout, s: number, offset: number): { x: number; y: number } {
  return {
    x: s * layout.dir.x + offset * layout.normal.x,
    y: s * layout.dir.y + offset * layout.normal.y,
  };
}

/** 沿板宽方向 index → z 坐标（从 -b/2+cover 到 +b/2-cover） */
function barZ(index: number, count: number, b: number, cover: number): number {
  const available = b - 2 * cover;
  const spacing = count > 1 ? available / (count - 1) : 0;
  return -available / 2 + index * spacing;
}

/** 分布筋沿斜板方向 index → s（从低端起的弧长） */
function distS(index: number, count: number, slantLength: number, cover: number): number {
  const available = slantLength - 2 * cover;
  const spacing = count > 1 ? available / (count - 1) : 0;
  return cover + index * spacing;
}

/** 折线长度 */
function polylineLength(pts: THREE.Vector3[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += pts[i].distanceTo(pts[i - 1]);
  }
  return len;
}

/** 底部纵筋：
 *  低端梁内水平段 la → 转折进入斜板底 → 沿斜板底直通高端 → 转折进入高端梁 → 水平段 la。
 */
function buildBottomBars(params: StairParams, derived: ReturnType<typeof deriveStair>): StairBarResult[] {
  const layout = derived.layout;
  const count = derived.bottomBarCount;
  const spec = params.bottomBar;
  const radius = spec.diameter / 2;
  const la = derived.bottomAnchor;
  const bottomOffset = params.h - params.cover; // 底筋中心线距顶面的法向偏移（沿 +n 方向）

  const results: StairBarResult[] = [];
  for (let i = 0; i < count; i++) {
    const z = barZ(i, count, params.b, params.cover);
    const lowBeamY = layout.lowBeamTopY - params.cover;  // 低端梁顶面下 cover
    const highBeamY = layout.highBeamTopY - params.cover; // 高端梁顶面下 cover
    const lowBeamFace = layout.lowBeamCenterX + params.lowBeam.width / 2;   // 踏步段起点
    const highBeamFace = layout.highBeamCenterX - params.highBeam.width / 2; // 踏步段终点
    const lowSlab = surfacePoint(layout, 0, bottomOffset);
    const highSlab = surfacePoint(layout, layout.slantLength, bottomOffset);

    const pts = [
      new THREE.Vector3(lowBeamFace - la, lowBeamY, z), // 低端梁内水平锚固
      new THREE.Vector3(lowBeamFace, lowBeamY, z),      // 到低端支座面
      new THREE.Vector3(lowSlab.x, lowSlab.y, z),      // 转入斜板底
      new THREE.Vector3(highSlab.x, highSlab.y, z),      // 到高端斜板底
      new THREE.Vector3(highBeamFace, highBeamY, z),    // 转入高端梁
      new THREE.Vector3(highBeamFace + la, highBeamY, z), // 高端梁内水平锚固
    ];

    results.push({
      geometry: tubeFromPolyline(pts, radius, 8),
      points: pts,
      meta: {
        label: `AT梯板下部纵筋 #${i + 1}`,
        length: Math.round(polylineLength(pts)),
        diameter: spec.diameter,
        grade: spec.grade,
        kind: 'bottom',
        note: `两端水平伸入梯梁 la=${la}mm（梁顶面下 cover=${params.cover}mm）`,
      },
      barKey: `stair-bottom-${i}`,
      color: BAR_COLORS.bottom,
    });
  }
  return results;
}

/** 上部纵筋：
 *  支座内水平段（0.35lab/0.6lab）→ 转折进入斜板顶 → 沿斜板顶伸出 ln/4 → 15d 下弯钩。
 */
function buildTopBars(params: StairParams, derived: ReturnType<typeof deriveStair>): StairBarResult[] {
  const layout = derived.layout;
  const count = derived.topBarCount;
  const spec = params.topBar;
  const radius = spec.diameter / 2;
  const anchor = derived.topAnchor;
  const hook = derived.topHook;
  const extend = derived.topExtend;
  const topOffset = -params.cover; // 面筋中心线距顶面的法向偏移（沿 -n 方向）

  const results: StairBarResult[] = [];

  // 低端上部筋
  for (let i = 0; i < count; i++) {
    const z = barZ(i, count, params.b, params.cover);
    const lowBeamY = layout.lowBeamTopY - params.cover;
    const lowBeamFace = layout.lowBeamCenterX + params.lowBeam.width / 2;
    const startS = Math.min(extend, layout.slantLength * 0.48); // 保证不与高端筋打架
    const slabEnd = surfacePoint(layout, startS, topOffset);

    const pts = [
      new THREE.Vector3(lowBeamFace - anchor, lowBeamY, z), // 低端梁内水平锚固
      new THREE.Vector3(lowBeamFace, lowBeamY, z),          // 到低端支座面
      new THREE.Vector3(slabEnd.x, slabEnd.y, z),           // 沿斜板顶伸出
      new THREE.Vector3(slabEnd.x, slabEnd.y - hook, z),    // 15d 下弯钩（竖直段）
    ];

    results.push({
      geometry: tubeFromPolyline(pts, radius, 8),
      points: pts,
      meta: {
        label: `AT梯板上部纵筋(低端) #${i + 1}`,
        length: Math.round(polylineLength(pts)),
        diameter: spec.diameter,
        grade: spec.grade,
        kind: 'top',
        note: `沿斜板顶伸出 ${Math.round(startS)}mm，端部 15d=${hook}mm，支座锚固 ${params.topAnchorMode === 'hinge' ? '0.35lab' : '0.6lab'}=${anchor}mm`,
      },
      barKey: `stair-top-low-${i}`,
      color: BAR_COLORS.top,
    });
  }

  // 高端上部筋
  for (let i = 0; i < count; i++) {
    const z = barZ(i, count, params.b, params.cover);
    const highBeamY = layout.highBeamTopY - params.cover;
    const highBeamFace = layout.highBeamCenterX - params.highBeam.width / 2;
    const startS = Math.max(layout.slantLength - extend, layout.slantLength * 0.52);
    const slabEnd = surfacePoint(layout, startS, topOffset);

    const pts = [
      new THREE.Vector3(highBeamFace + anchor, highBeamY, z), // 高端梁内水平锚固
      new THREE.Vector3(highBeamFace, highBeamY, z),          // 到高端支座面
      new THREE.Vector3(slabEnd.x, slabEnd.y, z),             // 沿斜板顶伸出
      new THREE.Vector3(slabEnd.x, slabEnd.y - hook, z),      // 15d 下弯钩
    ];

    results.push({
      geometry: tubeFromPolyline(pts, radius, 8),
      points: pts,
      meta: {
        label: `AT梯板上部纵筋(高端) #${i + 1}`,
        length: Math.round(polylineLength(pts)),
        diameter: spec.diameter,
        grade: spec.grade,
        kind: 'top',
        note: `沿斜板顶伸出 ${Math.round(layout.slantLength - startS)}mm，端部 15d=${hook}mm，支座锚固 ${params.topAnchorMode === 'hinge' ? '0.35lab' : '0.6lab'}=${anchor}mm`,
      },
      barKey: `stair-top-high-${i}`,
      color: BAR_COLORS.top,
    });
  }

  return results;
}

/** 分布筋：沿板宽方向短筋，垂直于纵筋，沿斜板长度按间距布置；
 *  分别位于下层（斜板底）和上层（斜板顶）两层。
 */
function buildDistributionBars(params: StairParams, derived: ReturnType<typeof deriveStair>): StairBarResult[] {
  const layout = derived.layout;
  const count = derived.distributionBarCount;
  const spec = params.distributionBar;
  const radius = spec.diameter / 2;
  const barLen = params.b - 2 * params.cover;
  const halfLen = barLen / 2;

  const results: StairBarResult[] = [];

  // 下层分布筋
  for (let i = 0; i < count; i++) {
    const s = distS(i, count, layout.slantLength, params.cover);
    const p = surfacePoint(layout, s, params.h - params.cover);
    const pts = [new THREE.Vector3(p.x, p.y, -halfLen), new THREE.Vector3(p.x, p.y, halfLen)];
    results.push({
      geometry: tubeFromPolyline(pts, radius, 6),
      points: pts,
      meta: {
        label: `AT梯板下层分布筋 #${i + 1}`,
        length: Math.round(barLen),
        diameter: spec.diameter,
        grade: spec.grade,
        kind: 'distribution',
        note: `沿斜板底按间距 ${spec.spacing}mm 布置`,
      },
      barKey: `stair-dist-bottom-${i}`,
      color: BAR_COLORS.distribution,
    });
  }

  // 上层分布筋
  for (let i = 0; i < count; i++) {
    const s = distS(i, count, layout.slantLength, params.cover);
    const p = surfacePoint(layout, s, -params.cover);
    const pts = [new THREE.Vector3(p.x, p.y, -halfLen), new THREE.Vector3(p.x, p.y, halfLen)];
    results.push({
      geometry: tubeFromPolyline(pts, radius, 6),
      points: pts,
      meta: {
        label: `AT梯板上层分布筋 #${i + 1}`,
        length: Math.round(barLen),
        diameter: spec.diameter,
        grade: spec.grade,
        kind: 'distribution',
        note: `沿斜板顶按间距 ${spec.spacing}mm 布置`,
      },
      barKey: `stair-dist-top-${i}`,
      color: BAR_COLORS.distribution,
    });
  }

  return results;
}

/** 构建 AT 楼梯全部配筋 */
export function buildStairRebar(params: StairParams): StairRebarResult {
  const derived = deriveStair(params);
  const bars: StairBarResult[] = [
    ...buildBottomBars(params, derived),
    ...buildTopBars(params, derived),
    ...buildDistributionBars(params, derived),
  ];
  return { bars };
}
