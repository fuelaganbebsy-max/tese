// 框架柱 KZ — 类型定义 (22G101-1)
// 单位统一为毫米 (mm)

import type { ConcreteGrade, SeismicLevel, RebarGrade, RebarBundle } from '../kl/types';

export type ColumnSectionType = 'rect';
export type ColumnLongitudinalMode = 'uniform' | 'grouped';
export type ColumnBarGroupKind = 'corner' | 'bMid' | 'hMid';

/** 纵筋连接方式 (22G101-1 P.63 KZ 纵向钢筋连接构造) */
export type ColumnConnectionType = 'tie' | 'mechanical' | 'welded';
/** 柱在平面中的位置：中柱 / 边柱 / 角柱 (决定柱顶纵筋锚固做法) */
export type ColumnPosition = 'middle' | 'edge' | 'corner';
/** 柱根类型：基础顶 / 楼层 (决定柱根加密区与插筋构造) */
export type ColumnBaseType = 'foundation' | 'floor';

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
  /** 柱净高 Hn (mm) */
  Hn: number;
  /** 梁高 (mm) */
  beamHeight: number;
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
  /** 纵筋连接方式 (默认 tie 绑扎搭接) */
  connectionType?: ColumnConnectionType;
  /** 同一连接区段搭接接头面积百分率 (默认 50) */
  lapRatio?: 25 | 50 | 100;
  /** 柱位置：中柱/边柱/角柱 (默认 middle) */
  position?: ColumnPosition;
  /** 柱根类型：基础顶/楼层 (默认 foundation) */
  baseType?: ColumnBaseType;
  /** 层数 (默认 1) */
  floors?: number;
}
