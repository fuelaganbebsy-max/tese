// AT 型板式楼梯 — 类型定义 (22G101-2)
// 单位统一为毫米 (mm)

import type { ConcreteGrade, SeismicLevel, RebarGrade } from '../kl/types';

/** 上部纵筋支座锚固方式：铰接 0.35lab / 充分利用抗拉 0.6lab (22G101-2 第2-8页) */
export type StairTopAnchorMode = 'hinge' | 'full';

/** 楼梯钢筋 — 按间距布置 (@spacing) */
export interface StairRebarSpec {
  grade: RebarGrade;
  diameter: number;
  /** 间距 (mm) */
  spacing: number;
}

/** 梯梁 (支座) 尺寸 */
export interface StairBeamSpec {
  /** 沿踏步段水平投影方向 (run) 的梁宽 (mm) */
  width: number;
  /** 梁高 (mm) */
  height: number;
  /** 垂直于梯板走向、横跨梯板的梁长 (mm) */
  length: number;
}

export interface StairParams {
  /** 梯板编号 */
  id?: string;
  /** 踏步段水平投影长度 ln (mm) */
  ln: number;
  /** 踏步段总高度 Hs (mm) */
  Hs: number;
  /** 踏步级数 (m+1) */
  stepCount: number;
  /** 梯板厚度 h (mm)，垂直于斜板方向 */
  h: number;
  /** 梯板宽度 b (mm) */
  b: number;
  /** 保护层厚度 c (mm) */
  cover: number;
  concrete: ConcreteGrade;
  seismic: SeismicLevel;
  /** 低端梯梁 (支座) */
  lowBeam: StairBeamSpec;
  /** 高端梯梁 (支座) */
  highBeam: StairBeamSpec;
  /** 下部纵筋 */
  bottomBar: StairRebarSpec;
  /** 上部纵筋 */
  topBar: StairRebarSpec;
  /** 分布筋 */
  distributionBar: StairRebarSpec;
  /** 上部纵筋伸入跨内水平投影长度 (mm)，默认 ln/4 */
  topExtend?: number;
  /** 上部纵筋支座锚固方式，默认 hinge(0.35lab) */
  topAnchorMode?: StairTopAnchorMode;
}
