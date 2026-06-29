import * as THREE from 'three';
import type { BeamParams } from '../domain/kl/types';
import { stirrupHookStraight } from '../domain/kl/codes/22G101';
import { buildFreecadStirrupGeometry } from './beam/freecadStirrup';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 构造单个矩形闭合箍筋几何 (FreeCAD-Reinforcement getpointsOfStirrup 做法)。
 * freecadStirrup 在 x=宽 / y=高 / z=法向 平面生成 (中心在原点);
 * 此处旋转到梁剖面 yz 平面 (法向沿 x), 并平移到梁高中心。
 */
function buildRectStirrup(
  width: number, height: number, centerY: number,
  ds: number, bentFactor: number,
): THREE.BufferGeometry {
  const geo = buildFreecadStirrupGeometry({
    width,
    height,
    diameter: ds,
    bentAngle: 135,
    bentFactor,
    rounding: 2,
  });
  // 宽方向(x)→梁宽(z)、法向(z)→梁长(x)、高(y)不变
  geo.rotateY(Math.PI / 2);
  geo.translate(0, centerY, 0);
  return geo;
}

/**
 * 构造箍筋几何（含内肢）：legs=2 仅外箍筋；legs=4 外箍筋 + 1 内小箍筋(中部)
 * 后续通过 InstancedMesh 沿 x 方向复制。
 */
export function buildStirrupUnitGeometry(p: BeamParams): THREE.BufferGeometry {
  const sp = p.spans[0];
  const ds = sp.stirrup.diameter;
  const cover = p.cover;
  const innerW = p.b - 2 * cover - ds;   // 箍筋中心线宽
  const innerH = p.h - 2 * cover - ds;   // 箍筋中心线高
  const centerY = p.h / 2;               // 梁高中心
  // 弯钩直段 ≥ max(10d,75) → 折算 bentFactor (钩长 ≈ tangent_length + bentFactor·d)
  const bentFactor = stirrupHookStraight(ds) / ds;

  const outer = buildRectStirrup(innerW, innerH, centerY, ds, bentFactor);

  if (sp.stirrup.legs === 4) {
    // 内部小箍筋: 拉结中部两根主筋, 宽度约 innerW 的一半, 高同外箍筋
    const inner = buildRectStirrup(innerW / 2, innerH, centerY, ds, bentFactor);
    return mergeGeometries([outer, inner]) ?? outer;
  }

  return outer;
}
