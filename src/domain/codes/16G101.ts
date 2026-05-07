// 16G101-1 抗震锚固长度 laE 简化查表 (单位: 倍 d)
// 数据按图集第 58 页"受拉钢筋抗震锚固长度 laE"汇总（一/二级抗震取相同, 三级、四级单列；常用部分）。
// 简化：HPB300 用 HRB400 数值减 5d 近似（仅作为示意级渲染用）。

import type { ConcreteGrade, RebarGrade, SeismicLevel } from '../kl/types';

const TABLE_HRB400: Record<Exclude<SeismicLevel, 4>, Record<ConcreteGrade, number>> = {
  // 一/二级抗震
  1: { C25: 46, C30: 40, C35: 37, C40: 33, C45: 32, C50: 31 },
  2: { C25: 46, C30: 40, C35: 37, C40: 33, C45: 32, C50: 31 },
  3: { C25: 42, C30: 37, C35: 34, C40: 30, C45: 29, C50: 28 },
};

const TABLE_HRB500: Record<Exclude<SeismicLevel, 4>, Record<ConcreteGrade, number>> = {
  1: { C25: 55, C30: 49, C35: 45, C40: 41, C45: 39, C50: 37 },
  2: { C25: 55, C30: 49, C35: 45, C40: 41, C45: 39, C50: 37 },
  3: { C25: 50, C30: 45, C35: 41, C40: 37, C45: 36, C50: 34 },
};

/** 抗震锚固长度 laE (mm)；四级抗震按非抗震 la 近似返回三级数值 */
export function laE(grade: RebarGrade, d: number, concrete: ConcreteGrade, seismic: SeismicLevel): number {
  const lvl: Exclude<SeismicLevel, 4> = seismic === 4 ? 3 : (seismic as Exclude<SeismicLevel, 4>);
  let factor: number;
  if (grade === 'HRB500') factor = TABLE_HRB500[lvl][concrete];
  else if (grade === 'HPB300') factor = TABLE_HRB400[lvl][concrete] - 5;
  else factor = TABLE_HRB400[lvl][concrete];
  return factor * d;
}

/** 弯锚水平段最小值 0.4 laE */
export function bendAnchorStraightMin(grade: RebarGrade, d: number, concrete: ConcreteGrade, seismic: SeismicLevel): number {
  return 0.4 * laE(grade, d, concrete, seismic);
}

/** 弯锚竖直弯折段 15d */
export function bendAnchorVertical(d: number): number {
  return 15 * d;
}

/** 框架梁箍筋加密区长度 (mm)：抗震等级 1 级 max(2hb, 500)，2~4 级 max(1.5hb, 500) */
export function densifiedZoneLength(h: number, seismic: SeismicLevel): number {
  return seismic === 1 ? Math.max(2 * h, 500) : Math.max(1.5 * h, 500);
}

/** 抗震箍筋 135° 弯钩平直段长度 max(10d, 75) */
export function stirrupHookStraight(d: number): number {
  return Math.max(10 * d, 75);
}
