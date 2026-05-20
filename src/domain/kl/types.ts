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
  /** 跨中下部第一排钢筋 (角筋，伸入柱内弯锚) */
  bottom: RebarBundle;
  /** 跨中下部第二排钢筋 */
  bottomRow2?: RebarBundle;
  /** 第二排中间钢筋是否伸入支座（角部钢筋始终伸入支座弯锚） */
  bottomRow2MidAnchor?: boolean;
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

/** 加腋参数 */
export interface HaunchSpec {
  /** 是否启用 */
  enabled: boolean;
  /** 加腋高度/宽度增加量 (mm) */
  depth: number;
  /** 加腋长度 (mm)，沿梁轴方向 */
  length: number;
}

export interface BeamParams {
  /** 梁宽 b (mm) */
  b: number;
  /** 梁高 h (mm) */
  h: number;
  /** 梁前边距柱前边 (mm)。0=梁前边与柱前边齐平；(柱宽-梁宽)/2=居中 */
  beamColumnGapFront: number;
  /** 保护层厚度 c (mm) */
  cover: number;
  concrete: ConcreteGrade;
  seismic: SeismicLevel;
  /** 上部贯通筋 */
  topThrough: RebarBundle;
  /** 各跨 */
  spans: Span[];
  /** 竖向加腋（左端）— 梁底左支座处向下加深 */
  verticalHaunchLeft: HaunchSpec;
  /** 竖向加腋（右端）— 梁底右支座处向下加深 */
  verticalHaunchRight: HaunchSpec;
  /** 水平加腋（左端）— 梁左支座处沿轴向加宽 */
  horizontalHaunchLeft: HaunchSpec;
  /** 水平加腋（右端）— 梁右支座处沿轴向加宽 */
  horizontalHaunchRight: HaunchSpec;
  /** 水平加腋（前侧）— 梁前侧面在支座处沿宽度方向加宽 */
  horizontalHaunchFront: HaunchSpec;
  /** 水平加腋（后侧）— 梁后侧面在支座处沿宽度方向加宽 */
  horizontalHaunchBack: HaunchSpec;
}
