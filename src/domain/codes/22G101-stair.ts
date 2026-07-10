// AT 型楼梯 (22G101-2) 专用锚固长度 — 示意级近似
// 楼梯不参与结构整体抗震计算，采用非抗震 la / lab。
// 这里复用 22G101.ts 中 laE 的抗震三级数值作为近似。

import type { ConcreteGrade, RebarGrade } from '../kl/types';
import { laE } from './22G101';

/** 受拉钢筋非抗震锚固长度 la (mm) */
export function la(grade: RebarGrade, d: number, concrete: ConcreteGrade): number {
  return Math.max(200, Math.round(laE(grade, d, concrete, 3)));
}

/** 受拉钢筋非抗震基本锚固长度 lab (mm)，示意级取 = la */
export function lab(grade: RebarGrade, d: number, concrete: ConcreteGrade): number {
  return la(grade, d, concrete);
}
