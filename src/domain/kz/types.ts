// 框架柱 KZ — 类型定义 (22G101-1)
// 单位统一为毫米 (mm)

import type { ConcreteGrade, SeismicLevel, RebarGrade, RebarBundle } from '../kl/types';

export type ColumnSectionType = 'rect' | 'circle';
export type ColumnLongitudinalMode = 'uniform' | 'grouped';
export type ColumnBarGroupKind = 'corner' | 'bMid' | 'hMid';

export interface ColumnStirrupSpec {
  grade: RebarGrade;
  diameter: number;
  /** 加密区间距 (mm) */
  spacingDense: number;
  /** 非加密区间距 (mm) */
  spacingSparse: number;
  /** 箍筋类型 */
  type: 'rect' | 'well' | 'composite';
  /** 旧版肢数：保留兼容，优先使用 legsX/legsY */
  legs: 2 | 4;
  /** b 方向肢数 m */
  legsX?: number;
  /** h 方向肢数 n */
  legsY?: number;
  /** 箍筋类型编号（22G101-1 表2.2.2-2） */
  typeNo?: 1 | 2 | 3 | 4;
  /** 核心区箍筋，可选覆盖 */
  core?: {
    grade: RebarGrade;
    diameter: number;
    spacing: number;
  };
}

export interface ColumnParams {
  /** 柱编号 */
  id?: string;
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
  /** 纵筋配置模式 */
  longitudinalMode?: ColumnLongitudinalMode;
  /** 角筋（通常与纵筋同规格，可选覆盖） */
  cornerBar?: RebarBundle;
  /** b 边中部筋（每条 b 边根数，不含角筋） */
  bSideMidBar?: RebarBundle;
  /** h 边中部筋（每条 h 边根数，不含角筋） */
  hSideMidBar?: RebarBundle;
  /** 箍筋 */
  stirrup: ColumnStirrupSpec;
}
