// 单位统一为毫米 (mm)

export type ConcreteGrade = 'C25' | 'C30' | 'C35' | 'C40' | 'C45' | 'C50';
export type SeismicLevel = 1 | 2 | 3 | 4; // 抗震等级 一~四级
export type RebarGrade = 'HPB300' | 'HRB400' | 'HRB500';

/** 一组同规格钢筋，例: {grade:'HRB400', diameter:25, count:2} */
export interface RebarBundle {
  grade: RebarGrade;
  diameter: number;
  count: number;
}

/** 跨信息 */
export interface Span {
  /** 净跨 ln (mm) */
  ln: number;
  /** 左支座宽 hc (mm) */
  hcLeft: number;
  /** 右支座宽 hc (mm) */
  hcRight: number;
  /** 跨中下部钢筋 */
  bottom: RebarBundle;
  /** 该跨左端支座负筋 (上部，含贯通筋以外) */
  topLeftSupport?: RebarBundle;
  /** 该跨右端支座负筋 */
  topRightSupport?: RebarBundle;
  /** 箍筋 (跨内统一) */
  stirrup: StirrupSpec;
}

export interface StirrupSpec {
  grade: RebarGrade;
  diameter: number;
  /** 加密区间距 (mm) */
  spacingDense: number;
  /** 非加密区间距 (mm) */
  spacingSparse: number;
  /** 肢数 */
  legs: 2 | 4;
}

export interface BeamParams {
  /** 梁宽 b (mm) */
  b: number;
  /** 梁高 h (mm) */
  h: number;
  /** 保护层厚度 c (mm) */
  cover: number;
  concrete: ConcreteGrade;
  seismic: SeismicLevel;
  /** 上部贯通筋 */
  topThrough: RebarBundle;
  /** 各跨 */
  spans: Span[];
}
