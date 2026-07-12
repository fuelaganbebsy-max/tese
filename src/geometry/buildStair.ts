// AT 型板式楼梯 — 混凝土几何 + 梯梁支座 (22G101-2)

import * as THREE from 'three';
import type { StairParams, StairBeamSpec } from '../domain/at/types';
import { deriveStair, type StairLayout, type StairProfilePoint } from '../domain/at/derive';

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

/** 将领域层的第 1-8 页纵剖面转换为 Three.js 形状。 */
function shapeFromProfile(profile: StairProfilePoint[]): THREE.Shape {
  const shape = new THREE.Shape();
  const [first, ...rest] = profile;
  if (!first) return shape;
  shape.moveTo(first.x, first.y);
  rest.forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  return shape;
}

/** 梯梁几何：横向长度沿 z 居中于 0。 */
function beamGeometry(
  beam: StairBeamSpec,
  centerX: number,
  bottomY: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(beam.width, beam.height, beam.length);
  g.translate(centerX, bottomY + beam.height / 2, 0);
  return g;
}

/** 构建 AT 楼梯混凝土几何（含低/高端梯梁） */
export function buildStairConcrete(params: StairParams): StairConcreteResult {
  const derived = deriveStair(params);
  const layout = derived.layout;

  // 1) 梯板：纵向剖面沿 z 拉伸
  const profile = shapeFromProfile(layout.concreteProfile);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: params.b,
    bevelEnabled: false,
    curveSegments: 1,
  };
  const slabGeo = new THREE.ExtrudeGeometry(profile, extrudeSettings);
  // 默认拉伸沿 +z，将宽度中心置于 z=0
  slabGeo.translate(0, 0, -params.b / 2);

  // 2) 梯梁
  const lowBeamGeo = beamGeometry(params.lowBeam, layout.lowBeamCenterX, layout.lowBeamBottomY);
  const highBeamGeo = beamGeometry(params.highBeam, layout.highBeamCenterX, layout.highBeamBottomY);

  return {
    slabGeometry: slabGeo,
    lowBeamGeometry: lowBeamGeo,
    highBeamGeometry: highBeamGeo,
    layout,
  };
}
