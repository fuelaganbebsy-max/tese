// 22G101-1 抗震锚固长度 laE 简化查表 (单位: 倍 d)
// 数据依据《22G101-1 混凝土结构施工图平面整体表示方法制图规则和构造详图（现浇混凝土框架、剪力墙、梁、板）》
// 第 59 页 "受拉钢筋抗震锚固长度 laE" 简化汇总（一/二级抗震取相同, 三级、四级单列；常用部分）。
// 注：22G101-1 在 laE 数值表上与 16G101-1 一致；本平台仅作示意级渲染。
// 简化：HPB300 按 HRB400 数值减 5d 近似（仅用于可视化示意，工程实际请查表）。

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

/** 受拉钢筋抗震锚固长度 laE (mm)；四级抗震按非抗震 la 近似返回三级数值 */
export function laE(grade: RebarGrade, d: number, concrete: ConcreteGrade, seismic: SeismicLevel): number {
  const lvl: Exclude<SeismicLevel, 4> = seismic === 4 ? 3 : (seismic as Exclude<SeismicLevel, 4>);
  let factor: number;
  if (grade === 'HRB500') factor = TABLE_HRB500[lvl][concrete];
  else if (grade === 'HPB300') factor = TABLE_HRB400[lvl][concrete] - 5;
  else factor = TABLE_HRB400[lvl][concrete];
  return factor * d;
}

/** 弯锚水平段最小值 ≥ 0.4 laE (22G101-1 P.69 框架梁端支座) */
export function bendAnchorStraightMin(grade: RebarGrade, d: number, concrete: ConcreteGrade, seismic: SeismicLevel): number {
  return 0.4 * laE(grade, d, concrete, seismic);
}

/** 弯锚竖直弯折段 15d (22G101-1 P.69) */
export function bendAnchorVertical(d: number): number {
  return 15 * d;
}

/**
 * 框架梁箍筋加密区长度 (mm)
 * 22G101-1 P.88 "抗震框架梁 KL 箍筋加密区范围"：
 *   - 一级抗震：≥ max(2.0 hb, 500)
 *   - 二~四级抗震：≥ max(1.5 hb, 500)
 */
export function densifiedZoneLength(h: number, seismic: SeismicLevel): number {
  return seismic === 1 ? Math.max(2 * h, 500) : Math.max(1.5 * h, 500);
}

/** 抗震箍筋 135° 弯钩平直段长度 ≥ max(10d, 75mm) (22G101-1 P.88) */
export function stirrupHookStraight(d: number): number {
  return Math.max(10 * d, 75);
}

// ─── 柱 (KZ) 专用构造参数 (22G101-1 P.62~P.67) ──────────────────────

/** 同一连接区段内搭接接头面积百分率 */
export type LapRatio = 25 | 50 | 100;

/**
 * 纵向受拉钢筋搭接长度修正系数 ζl (22G101-1 P.62 注7)：
 *   ≤25% → 1.2；50% → 1.4；100% → 1.6
 */
export function lapFactor(ratio: LapRatio): number {
  return ratio <= 25 ? 1.2 : ratio <= 50 ? 1.4 : 1.6;
}

/**
 * 纵向受拉钢筋抗震搭接长度 llE = ζl · laE (22G101-1 P.62)。
 * 任何情况下不应小于 300mm。
 */
export function llE(
  grade: RebarGrade,
  d: number,
  concrete: ConcreteGrade,
  seismic: SeismicLevel,
  ratio: LapRatio = 50,
): number {
  return Math.max(300, Math.round(lapFactor(ratio) * laE(grade, d, concrete, seismic)));
}

/**
 * 柱根(嵌固部位)箍筋加密区长度 = Hn/3 (22G101-1 P.65 KZ 箍筋加密区范围)。
 */
export function columnDenseZoneRoot(Hn: number): number {
  return Math.ceil(Hn / 3);
}

/**
 * 柱端(非嵌固)箍筋加密区长度 = max(Hn/6, hc, 500) (22G101-1 P.65)。
 * hc 为柱截面长边尺寸。
 */
export function columnDenseZoneEnd(Hn: number, hc: number): number {
  return Math.ceil(Math.max(Hn / 6, hc, 500));
}

/**
 * 柱顶纵筋节点内弯锚水平段长度 = 12d (22G101-1 P.67 KZ 中柱柱顶纵向钢筋构造 ①)。
 */
export function columnTopBend(d: number): number {
  return 12 * d;
}

/**
 * 柱纵筋连接点距楼面(柱根)的最小高度 = Hn/3，以避开柱端箍筋加密区
 * (22G101-1 P.63 KZ 纵向钢筋连接构造)。
 */
export function columnConnectionOffset(Hn: number): number {
  return Math.ceil(Hn / 3);
}

/**
 * 受拉钢筋基本锚固长度 labE (mm)。示意级近似取 = laE
 * （laE = ζaE·labE，常规情况 ζaE=1，故数值上取等；仅用于可视化）。
 */
export function labE(grade: RebarGrade, d: number, concrete: ConcreteGrade, seismic: SeismicLevel): number {
  return laE(grade, d, concrete, seismic);
}

/**
 * 中柱柱顶纵筋是否可直锚 (7.3.1)：自梁底算起的可用竖向锚固高度 ≥ laE 时采用直锚，
 * 否则需 90° 弯锚 (7.3.2)。availableVertical 为梁底至柱顶的竖向净空 (mm)。
 */
export function columnTopCanStraightAnchor(
  availableVertical: number,
  grade: RebarGrade,
  d: number,
  concrete: ConcreteGrade,
  seismic: SeismicLevel,
): boolean {
  return availableVertical >= laE(grade, d, concrete, seismic);
}

/**
 * 边/角柱顶节点外侧纵筋与梁上部钢筋搭接长度 = 1.5·labE
 * (22G101-1 P.66 / 文档 7.4.1 柱纵筋在梁内搭接)。
 */
export function columnTopOuterLap(grade: RebarGrade, d: number, concrete: ConcreteGrade, seismic: SeismicLevel): number {
  return Math.round(1.5 * labE(grade, d, concrete, seismic));
}
