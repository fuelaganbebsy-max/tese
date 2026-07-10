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

/** 上层柱纵筋/箍筋配置（未指定字段则与下层共用全局配置） */
export interface ColumnTopRebar {
  longitudinal?: RebarBundle;
  longitudinalMode?: ColumnLongitudinalMode;
  cornerBar?: RebarBundle;
  bSideMidBar?: RebarBundle;
  hSideMidBar?: RebarBundle;
  stirrup?: ColumnStirrupSpec;
}

export interface ColumnParams {
  /** 柱编号 */
  id?: string;
  /** 截面类型 */
  sectionType: ColumnSectionType;
  /** 矩形柱宽 b (mm) — 下层柱截面宽度 */
  b: number;
  /** 矩形柱高 h (mm) — 下层柱截面高度 */
  h: number;
  /** 顶层柱截面宽度 (mm) */
  topB?: number;
  /** 顶层柱截面高度 (mm) */
  topH?: number;
  /** 顶层柱截面中心相对下层中心在 b 向 (x 轴) 的偏移 (mm)，正方向为 +x */
  topOffsetX?: number;
  /** 顶层柱截面中心相对下层中心在 h 向 (z 轴) 的偏移 (mm)，正方向为 +z */
  topOffsetZ?: number;
  /** 柱净高 Hn (mm) — 下层净高 */
  Hn: number;
  /** 上层净高 (mm) */
  upperHn?: number;
  /** 梁高 (mm) — 中间梁高（下层） */
  beamHeight: number;
  /** 柱顶梁高 (mm) — 上层 */
  topBeamHeight?: number;
  /** 层高 (mm) — 下层层高 */
  floorHeight: number;
  /** 顶层层高 (mm) */
  topFloorHeight?: number;
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
  /** 上层柱纵筋/箍筋配置（未指定则与下层共用全局配置） */
  topRebar?: ColumnTopRebar;
}

/** 获取指定楼层生效的 ColumnParams（上层字段未指定时回退到全局/下层配置） */
export function getParamsForFloor(params: ColumnParams, isUpper: boolean): ColumnParams {
  if (!isUpper) {
    // 全部同配时统一以 longitudinal 为准，忽略角筋/中部筋的显式覆盖
    if (params.longitudinalMode === 'uniform') {
      return { ...params, cornerBar: undefined, bSideMidBar: undefined, hSideMidBar: undefined };
    }
    return params;
  }
  if (!params.topRebar) return params;
  const t = params.topRebar;
  const mode = t.longitudinalMode ?? params.longitudinalMode ?? 'uniform';
  if (mode === 'uniform') {
    return {
      ...params,
      longitudinal: t.longitudinal ?? params.longitudinal,
      stirrup: t.stirrup ?? params.stirrup,
      longitudinalMode: mode,
      cornerBar: undefined,
      bSideMidBar: undefined,
      hSideMidBar: undefined,
    };
  }
  return {
    ...params,
    longitudinal: t.longitudinal ?? params.longitudinal,
    stirrup: t.stirrup ?? params.stirrup,
    longitudinalMode: mode,
    cornerBar: t.cornerBar ?? params.cornerBar,
    bSideMidBar: t.bSideMidBar ?? params.bSideMidBar,
    hSideMidBar: t.hSideMidBar ?? params.hSideMidBar,
  };
}
