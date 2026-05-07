import * as THREE from 'three';
import type { BeamParams } from '../domain/kl/types';
import { stirrupHookStraight } from '../domain/codes/16G101';
import { tubeFromPolyline } from './rebarPath';

/**
 * 构造单个箍筋几何（在 yz 平面，x=0），后续通过 InstancedMesh 沿 x 方向复制。
 * 简化的 135° 弯钩处理：在矩形左上角处增加一段沿 -45° 斜向内的平直段（长度 = max(10d, 75)）。
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
  const hook = stirrupHookStraight(ds);
  const k = hook / Math.SQRT2; // 45° 投影

  // 闭合矩形 + 在右上角向内 135° 弯钩
  const pts: THREE.Vector3[] = [
    new THREE.Vector3(0, yTop, zR - k),         // 弯钩起点 (从矩形左上角偏出)
    new THREE.Vector3(0, yTop - k, zR + k - 2 * k), // 占位
  ];
  // 重写：构造一个"开口"折线，从弯钩A端 → 顺时针走完矩形 → 弯钩B端
  // A 弯钩：起于 (yTop, zR-k) 经 (yTop, zR) 折向内下 (yTop-k, zR-k)
  // 主体：(yTop-k, zR-k)? 简化做法：
  //   从右上内 (yTop-k, zR-k) → (yTop, zR) → 顺时针: (yTop, zL) → (yBot, zL) → (yBot, zR) → (yTop, zR) → 内 (yTop-k, zR-k)
  pts.length = 0;
  pts.push(new THREE.Vector3(0, yTop - k, zR - k));      // 弯钩A末端 (内)
  pts.push(new THREE.Vector3(0, yTop, zR));              // 角A
  pts.push(new THREE.Vector3(0, yTop, zL));              // 角B
  pts.push(new THREE.Vector3(0, yBot, zL));              // 角C
  pts.push(new THREE.Vector3(0, yBot, zR));              // 角D
  pts.push(new THREE.Vector3(0, yTop, zR));              // 回到 角A (闭合)
  pts.push(new THREE.Vector3(0, yTop - k, zR - k));      // 弯钩B末端 (内, 与A重合实现135°收尾)

  return tubeFromPolyline(pts, ds / 2, 6);
}
