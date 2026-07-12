// AT 型楼梯 (22G101-2) 专用非抗震锚固长度。

import type { ConcreteGrade, RebarGrade } from '../kl/types';

const LAB_FACTORS: Record<RebarGrade, Record<ConcreteGrade, number>> = {
  HPB300: { C25: 34, C30: 30, C35: 28, C40: 25, C45: 24, C50: 23 },
  HRB400: { C25: 40, C30: 35, C35: 32, C40: 29, C45: 28, C50: 27 },
  HRB500: { C25: 48, C30: 43, C35: 39, C40: 36, C45: 34, C50: 32 },
};

/** 受拉钢筋非抗震锚固长度 la (mm) */
export function la(grade: RebarGrade, d: number, concrete: ConcreteGrade): number {
  return Math.max(200, lab(grade, d, concrete));
}

/** 受拉钢筋非抗震基本锚固长度 lab (mm)，22G101-2 第2-2页 */
export function lab(grade: RebarGrade, d: number, concrete: ConcreteGrade): number {
  return LAB_FACTORS[grade][concrete] * d;
}
