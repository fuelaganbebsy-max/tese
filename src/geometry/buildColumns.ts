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
 *
 * subtype 影响：
 * - 'L' (次梁): 不显示柱（由主梁支承），返回空数组
 * - 'XL' (悬挑梁): 仅左侧柱（右端为自由端）
 * - 'KL' / 'WKL': 左右两端均有柱
 */
export function buildColumns(p: BeamParams, d: Derived, subtype?: string): ColumnGeom[] {
  // 次梁无柱支承
  if (subtype === 'L') return [];

  const colH = p.h + 2 * COLUMN_EXTRA;
  const firstSpan = p.spans[0];
  const lastSpan = p.spans[p.spans.length - 1];

  // 柱中心 Z 偏移: 梁以 z=0 为中线, 柱根据 beamColumnGapFront 偏移
  // 梁前边 z = +b/2, 柱前边 z = 梁前边 + gapFront = b/2 + gapFront
  // 柱中心 z = 柱前边 - COLUMN_SIZE/2 = b/2 + gapFront - COLUMN_SIZE/2
  const gapFront = p.beamColumnGapFront ?? (COLUMN_SIZE - p.b) / 2;
  const colCenterZ = p.b / 2 + gapFront - COLUMN_SIZE / 2;

  const make = (cx: number): ColumnGeom => {
    const g = new THREE.BoxGeometry(COLUMN_SIZE, colH, COLUMN_SIZE);
    g.translate(cx, p.h / 2, colCenterZ);
    return { geometry: g, center: [cx, p.h / 2, colCenterZ] };
  };

  const result: ColumnGeom[] = [];

  // 左柱
  if (firstSpan.hcLeft > 0) {
    result.push(make(firstSpan.hcLeft / 2));
  }

  // 右柱（悬挑梁无右柱）
  if (subtype !== 'XL' && lastSpan.hcRight > 0) {
    result.push(make(d.totalLength - lastSpan.hcRight / 2));
  }

  return result;
}
