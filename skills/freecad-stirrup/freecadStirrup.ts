import * as THREE from 'three';
import { tubeFromPolyline } from './rebarPath';

/**
 * FreeCAD-Reinforcement 箍筋做法移植 (Stirrup.py: getpointsOfStirrup)
 * 源: https://github.com/amrit3701/FreeCAD-Reinforcement (Stirrup.py / Rebarfunc.py)
 *
 * 核心特征:
 *  - 7 点开口闭合环: P0(钩A末端) → P1(顶左) → P2(底左) → P3(底右) → P4(顶右) → P5(顶左错位) → P6(钩B末端)
 *  - 可配置弯钩: bentAngle (135°/90°) + bentFactor, 钩长 = tangent_length + bentFactor·d
 *  - 圆角: 弯曲半径 = rounding·d
 *  - 法向螺旋偏移 (normal_dis): 沿截面法向逐点下沉 normal_dis/4, 使首尾搭接两端在空间错开避免自相交
 */
export interface FreecadStirrupParams {
  /** 箍筋中心线矩形宽 (沿 x 轴, 即外包尺寸 - 2·保护层 - d) */
  width: number;
  /** 箍筋中心线矩形高 (沿 y 轴) */
  height: number;
  /** 箍筋直径 (mm) */
  diameter: number;
  /** 弯钩角度, 默认 135° (抗震) */
  bentAngle?: 90 | 135;
  /** 弯钩直段系数, 钩长 = tangent_length + bentFactor·d, 默认 10 (≈10d) */
  bentFactor?: number;
  /** 弯曲半径系数, 弯曲半径 = rounding·d, 默认 2 */
  rounding?: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Rebarfunc.extendedTangentPartLength */
function extendedTangentPartLength(radius: number, angle: number): number {
  return radius / Math.tan(rad(angle)) + radius / Math.cos(rad(90 - angle)) - radius;
}

/** Rebarfunc.extendedTangentLength */
function extendedTangentLength(radius: number, angle: number): number {
  return radius / Math.sin(rad(angle)) + radius * Math.tan(rad(90 - angle));
}

/**
 * 返回箍筋中心线 7 个控制点 (P0..P6)。
 * 坐标系: x = 截面宽方向, y = 截面高方向, z = 截面法向 (微螺旋偏移)。矩形几何中心位于原点。
 * 对应 FreeCAD getpointsOfStirrup 中 facenormal 沿 z 轴的情形。
 */
export function getStirrupPoints(p: FreecadStirrupParams): THREE.Vector3[] {
  const d = p.diameter;
  const bentAngle = p.bentAngle ?? 135;
  const bentFactor = p.bentFactor ?? 10;
  const rounding = p.rounding ?? 2;

  const angle = 180 - bentAngle; // 135° → 45, 90° → 90
  const radius = rounding * d;
  const tangentPart = extendedTangentPartLength(radius, angle);
  const tangentLen = extendedTangentLength(radius, angle);

  const xLeft = -p.width / 2;
  const xRight = p.width / 2;
  const yTop = p.height / 2;
  const yBot = -p.height / 2;

  // 矩形主回路 (P1..P5), 其中 P1 较顶部高出 tangentPart, P5 较左侧外移 tangentPart
  const x1 = xLeft;
  const y1 = yTop + tangentPart;
  const x2 = xLeft;
  const y2 = yBot;
  const x3 = xRight;
  const y3 = yBot;
  const x4 = xRight;
  const y4 = yTop;
  const x5 = xLeft - tangentPart;
  const y5 = yTop;

  // 法向螺旋偏移量
  const sideLength = Math.abs(x5 - x4) - tangentPart;
  const normalDis = (d * (sideLength + tangentPart)) / sideLength;

  const z1 = 0;
  const z2 = z1 - normalDis / 4;
  const z3 = z2 - normalDis / 4;
  const z4 = z3 - normalDis / 4;
  const z5 = z4 - normalDis / 4;
  const z0 = z1 + normalDis / 4;
  const z6 = z5 - normalDis / 4;

  // 两端弯钩 (向截面内侧斜伸)
  const hookLen = tangentLen + bentFactor * d;
  const x0 = x1 + hookLen * Math.sin(rad(angle));
  const y0 = y1 - hookLen * Math.cos(rad(angle));
  const x6 = x5 + hookLen * Math.sin(rad(90 - angle));
  const y6 = y5 - hookLen * Math.cos(rad(90 - angle));

  return [
    new THREE.Vector3(x0, y0, z0),
    new THREE.Vector3(x1, y1, z1),
    new THREE.Vector3(x2, y2, z2),
    new THREE.Vector3(x3, y3, z3),
    new THREE.Vector3(x4, y4, z4),
    new THREE.Vector3(x5, y5, z5),
    new THREE.Vector3(x6, y6, z6),
  ];
}

/**
 * 由 FreeCAD 箍筋点生成 TubeGeometry。
 * 几何位于 x=宽 / y=高 / z=法向 平面, 中心在原点; 圆角半径 = rounding·d。
 */
export function buildFreecadStirrupGeometry(
  p: FreecadStirrupParams,
  radialSegments = 14,
): THREE.BufferGeometry {
  const pts = getStirrupPoints(p);
  const rounding = p.rounding ?? 2;
  // maxSegmentLen=3mm: 保证 2d 小半径弯钩处弧线足够圆润
  return tubeFromPolyline(pts, p.diameter / 2, radialSegments, rounding * p.diameter, 3);
}
