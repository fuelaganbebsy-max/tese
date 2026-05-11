import * as THREE from 'three';
import type { BeamParams } from '../domain/kl/types';
import { stirrupHookStraight } from '../domain/codes/22G101';
import { tubeFromPolyline } from './rebarPath';

/**
 * 构造单个箍筋几何（在 yz 平面，x=0），后续通过 InstancedMesh 沿 x 方向复制。
 * 简化的 135° 弯钩处理：在矩形右上角处布置两个向内 45° 的弯钩平直段
 * （长度 = max(10d, 75)），并沿顶边以 5d 搭接错开，对应 22G101-1 P.88 实物形态。
 */
export function buildStirrupUnitGeometry(p: BeamParams): THREE.BufferGeometry {
  const sp = p.spans[0]; // 假设全梁箍筋同规格
  const ds = sp.stirrup.diameter;
  const cover = p.cover;
  const innerW = p.b - 2 * cover - ds;   // 中心线宽
  const innerH = p.h - 2 * cover - ds;   // 中心线高
  const yBot = cover + ds / 2;
  const yTop = yBot + innerH;
  const zL = -innerW / 2;
  const zR = +innerW / 2;
  const hook = stirrupHookStraight(ds);    // 弯钩平直段 ≥ max(10d, 75)
  const bendR = ds * 2;                    // 圆角半径（与 tubeFromPolyline 默认 4·radius 一致）
  // 折线长度需包含被圆角"吃掉"的 bendR，使圆角后剩余的平直段 ≈ hook
  const tail = hook + bendR;               // 弯钩斜段总长 (折线端点到角顶点)
  const kt = tail / Math.SQRT2;            // 斜段在 y/z 各方向投影
  const lap = 5 * ds + 2 * bendR;          // 顶边搭接段：两端各被圆角吃 bendR，保证可见 ≥ 5d

  // 单条连续折线：弯钩A末端 → 角A → 顺时针绕回角A → 沿顶边搭接 → 弯钩B末端
  const pts: THREE.Vector3[] = [
    new THREE.Vector3(0, yTop - kt, zR - kt),         // P0 弯钩A末端 (内, 45°)
    new THREE.Vector3(0, yTop, zR),                   // A  角A
    new THREE.Vector3(0, yTop, zL),                   // B  角B
    new THREE.Vector3(0, yBot, zL),                   // C  角C
    new THREE.Vector3(0, yBot, zR),                   // D  角D
    new THREE.Vector3(0, yTop, zR),                   // A2 回到角A
    new THREE.Vector3(0, yTop, zR - lap),             // S  沿顶边走搭接段
    new THREE.Vector3(0, yTop - kt, zR - lap - kt),   // P1 弯钩B末端 (与P0平行, 错开 5d)
  ];

  return tubeFromPolyline(pts, ds / 2, 6, bendR);
}
