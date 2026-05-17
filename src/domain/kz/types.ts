// 框架柱 KZ — 类型定义 (22G101-1)
// 单位统一为毫米 (mm)

import type { ConcreteGrade, SeismicLevel, RebarGrade, RebarBundle } from '../kl/types';

export type ColumnSectionType = 'rect' | 'circle';

export interface ColumnStirrupSpec {
  grade: RebarGrade;
  diameter: number;
  /** 加密区间距 (mm) */
  spacingDense: number;
  /** 非加密区间距 (mm) */
  spacingSparse: number;
  /** 箍筋类型 */
  type: 'rect' | 'well' | 'composite';
  /** 肢数 */
  legs: 2 | 4;
}

export interface ColumnParams {
  /** 截面类型 */
  sectionType: ColumnSectionType;
  /** 矩形柱宽 b (mm) */
  b: number;
  /** 矩形柱高 h (mm) */
  h: number;
  /** 圆柱直径 D (mm) — 仅 sectionType='circle' 时使用 */
  D: number;
  /** 柱净高 Hn (mm) */
  Hn: number;
  /** 楼层数 */
  floors: number;
  /** 层高 (mm) */
  floorHeight: number;
  /** 保护层厚度 c (mm) */
  cover: number;
  concrete: ConcreteGrade;
  seismic: SeismicLevel;
  /** 纵筋 — 各边 */
  longitudinal: RebarBundle;
  /** 角筋（通常与纵筋同规格，可选覆盖） */
  cornerBar?: RebarBundle;
  /** 箍筋 */
  stirrup: ColumnStirrupSpec;
}
