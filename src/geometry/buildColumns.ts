import * as THREE from 'three';
import type { BeamParams } from '../domain/kl/types';
import type { Derived } from '../domain/kl/derive';

/** 柱截面边长 (mm)：600×600 */
export const COLUMN_SIZE = 600;
/** 柱超出梁上下边缘的伸出长度 (mm) */
export const COLUMN_EXTRA = 1000;

export interface ColumnGeom {
  geometry: THREE.BufferGeometry;
  /** 柱中心位置 (mm) */
  center: [number, number, number];
}

/**
 * 构造梁两端柱的几何：
 * - 截面：COLUMN_SIZE × COLUMN_SIZE（沿梁轴 x 与垂直方向 z）
 * - 总高：p.h + 2 * COLUMN_EXTRA（上下各超出梁 COLUMN_EXTRA）
 * - 沿梁轴方向位置：占据端支座 (左: [0, hcLeft]; 右: [totalLength - hcRight, totalLength])
 *   当 hcLeft / hcRight = COLUMN_SIZE 时，柱与支座完全对齐
 * - 沿梁宽方向 z：以梁中线 z=0 居中
 * - 沿高度方向 y：以梁中心 h/2 居中，使上下对称伸出
 */
export function buildColumns(p: BeamParams, d: Derived): ColumnGeom[] {
  const colH = p.h + 2 * COLUMN_EXTRA;
  const firstSpan = p.spans[0];
  const lastSpan = p.spans[p.spans.length - 1];

  const make = (cx: number): ColumnGeom => {
    const g = new THREE.BoxGeometry(COLUMN_SIZE, colH, COLUMN_SIZE);
    g.translate(cx, p.h / 2, 0);
    return { geometry: g, center: [cx, p.h / 2, 0] };
  };

  // 左柱中心 x = hcLeft/2；右柱中心 x = totalLength - hcRight/2
  const left = make(firstSpan.hcLeft / 2);
  const right = make(d.totalLength - lastSpan.hcRight / 2);
  return [left, right];
}
