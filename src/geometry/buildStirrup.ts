import * as THREE from 'three';
import type { BeamParams } from '../domain/kl/types';
import { stirrupHookStraight } from '../domain/codes/22G101';
import { tubeFromPolyline } from './rebarPath';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 构造单个矩形闭合箍筋几何 (在 yz 平面, x=0)
 *  弯钩闭合点位于 顶-左 角 (与剖切面图一致), 两根钩尾从顶-左角向梁内 45° 斜伸 */
function buildRectStirrup(
  yBot: number, yTop: number, zL: number, zR: number,
  ds: number, hook: number, bendR: number,
): THREE.BufferGeometry {
  const tail = hook + bendR;
  const kt = tail / Math.SQRT2;
  const lap = 5 * ds + 2 * bendR;
  const pts: THREE.Vector3[] = [
    new THREE.Vector3(0, yTop - kt, zL + kt),         // P0 钩A末端 (向梁内右下 45°)
    new THREE.Vector3(0, yTop, zL),                   // A  顶-左角
    new THREE.Vector3(0, yTop, zR),                   // B  顶-右角
    new THREE.Vector3(0, yBot, zR),                   // C  底-右角
    new THREE.Vector3(0, yBot, zL),                   // D  底-左角
    new THREE.Vector3(0, yTop, zL),                   // A2 回到顶-左角
    new THREE.Vector3(0, yTop, zL + lap),             // S  沿顶边搭接段
    new THREE.Vector3(0, yTop - kt, zL + lap + kt),   // P1 钩B末端 (与P0平行, 错开 lap)
  ];
  return tubeFromPolyline(pts, ds / 2, 6, bendR);
}

/**
 * 构造箍筋几何（含内肢）：legs=2 仅外箍筋；legs=4 外箍筋 + 1 内小箍筋(中部)
 * 后续通过 InstancedMesh 沿 x 方向复制。
 */
export function buildStirrupUnitGeometry(p: BeamParams): THREE.BufferGeometry {
  const sp = p.spans[0];
  const ds = sp.stirrup.diameter;
  const cover = p.cover;
  const innerW = p.b - 2 * cover - ds;
  const innerH = p.h - 2 * cover - ds;
  const yBot = cover + ds / 2;
  const yTop = yBot + innerH;
  const zL = -innerW / 2;
  const zR = +innerW / 2;
  const hook = stirrupHookStraight(ds);
  const bendR = ds * 2;

  const outer = buildRectStirrup(yBot, yTop, zL, zR, ds, hook, bendR);

  if (sp.stirrup.legs === 4) {
    // 内部小箍筋: 拉结中部两根主筋, 宽度约 innerW 的一半, y 同外箍筋
    const innerHalfW = innerW / 4;       // 内箍筋半宽
    const innerZL = -innerHalfW;
    const innerZR = +innerHalfW;
    const inner = buildRectStirrup(yBot, yTop, innerZL, innerZR, ds, hook, bendR);
    return mergeGeometries([outer, inner]) ?? outer;
  }

  return outer;
}
