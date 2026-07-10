// AT 型板式楼梯 — 混凝土几何 + 梯梁支座 (22G101-2)

import * as THREE from 'three';
import type { StairParams, StairBeamSpec } from '../domain/at/types';
import { deriveStair, type StairLayout } from '../domain/at/derive';

/** 混凝土楼梯几何输出 */
export interface StairConcreteResult {
  /** 踏步段梯板整体几何 */
  slabGeometry: THREE.BufferGeometry;
  /** 低端梯梁几何 */
  lowBeamGeometry: THREE.BufferGeometry;
  /** 高端梯梁几何 */
  highBeamGeometry: THREE.BufferGeometry;
  layout: StairLayout;
}

/** 构造 AT 型梯板纵向剖面（右侧为高端，左侧为低端）：
 *  - 上轮廓：踏步折线（rise/run 锯齿），即斜板结构顶面；
 *  - 下轮廓：与踏步根连线平行的斜线，沿法向 +n 向下偏移板厚 h。
 *  该剖面沿 z 轴（板宽）拉伸后得到 3D 实体。
 */
function buildSlabProfile(params: StairParams, layout: StairLayout): THREE.Shape {
  const { rise, run } = layout;
  const steps = params.stepCount;
  const h = params.h;

  const shape = new THREE.Shape();

  // 低端起点：踏步根连线起点（低平台结构标高）
  shape.moveTo(0, 0);

  // 上轮廓：踏步折线（先水平踏面，再竖直踢面）
  for (let i = 0; i < steps; i++) {
    const x = i * run;
    const y = i * rise;
    if (i > 0) shape.lineTo(x, y);          // 竖直踢面
    if (i < steps - 1) shape.lineTo(x + run, y); // 水平踏面
  }

  const topX = params.ln;
  const topY = params.Hs;

  // 下轮廓：从高端沿 +h·normal 偏移，再直线回到低端下点
  const dx = h * layout.normal.x;
  const dy = h * layout.normal.y;
  shape.lineTo(topX + dx, topY + dy);
  shape.lineTo(dx, dy);
  shape.closePath();

  return shape;
}

/** 梯梁几何：宽度沿 z 居中于 0 */
function beamGeometry(
  beam: StairBeamSpec,
  centerX: number,
  bottomY: number,
  widthZ: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(beam.width, beam.height, widthZ);
  g.translate(centerX, bottomY + beam.height / 2, 0);
  return g;
}

/** 构建 AT 楼梯混凝土几何（含低/高端梯梁） */
export function buildStairConcrete(params: StairParams): StairConcreteResult {
  const derived = deriveStair(params);
  const layout = derived.layout;

  // 1) 梯板：纵向剖面沿 z 拉伸
  const profile = buildSlabProfile(params, layout);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: params.b,
    bevelEnabled: false,
    curveSegments: 1,
  };
  const slabGeo = new THREE.ExtrudeGeometry(profile, extrudeSettings);
  // 默认拉伸沿 +z，将宽度中心置于 z=0
  slabGeo.translate(0, 0, -params.b / 2);

  // 2) 梯梁
  const lowBeamGeo = beamGeometry(params.lowBeam, layout.lowBeamCenterX, layout.lowBeamBottomY, params.b);
  const highBeamGeo = beamGeometry(params.highBeam, layout.highBeamCenterX, layout.highBeamBottomY, params.b);

  return {
    slabGeometry: slabGeo,
    lowBeamGeometry: lowBeamGeo,
    highBeamGeometry: highBeamGeo,
    layout,
  };
}
