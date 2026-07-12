// AT 型板式楼梯 — 默认参数与派生计算 (22G101-2)
// 单位统一为毫米 (mm)

import type { StairParams } from './types';
import { la, lab } from '../codes/22G101-stair';

/** 默认 AT 型楼梯参数（22G101-2 常用示例） */
export function defaultStair(): StairParams {
  return {
    ln: 3000,
    Hs: 1500,
    stepCount: 10,
    h: 120,
    b: 1500,
    cover: 15,
    concrete: 'C30',
    seismic: 4,
    lowBeam: { width: 250, height: 350, length: 2100 },
    highBeam: { width: 250, height: 350, length: 2100 },
    bottomBar: { grade: 'HRB400', diameter: 10, spacing: 150 },
    topBar: { grade: 'HRB400', diameter: 10, spacing: 150 },
    distributionBar: { grade: 'HPB300', diameter: 8, spacing: 250 },
    topAnchorMode: 'hinge',
  };
}

/** 规范化外部输入，兜底缺失字段 */
export function normalizeStairParams(input: unknown): StairParams {
  const defaults = defaultStair();
  const partial = input && typeof input === 'object' ? input as Partial<StairParams> : {};
  const b = typeof partial.b === 'number' && Number.isFinite(partial.b) ? partial.b : defaults.b;
  const mergeDefined = <T extends object>(base: T, value: unknown): T => {
    if (!value || typeof value !== 'object') return { ...base };
    const defined = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
    return { ...base, ...defined };
  };
  const topLevel = mergeDefined(defaults, partial);
  const beamDefaults = { ...defaults.lowBeam, length: b + 600 };

  return {
    ...topLevel,
    b,
    lowBeam: mergeDefined(beamDefaults, partial.lowBeam),
    highBeam: mergeDefined(beamDefaults, partial.highBeam),
    bottomBar: mergeDefined(defaults.bottomBar, partial.bottomBar),
    topBar: mergeDefined(defaults.topBar, partial.topBar),
    distributionBar: mergeDefined(defaults.distributionBar, partial.distributionBar),
  };
}

export type StairProfilePointKind = 'start' | 'tread' | 'riser' | 'soffit';

export interface StairProfilePoint {
  x: number;
  y: number;
  kind: StairProfilePointKind;
}

/** Concrete-only waist-slab pitch from hs/bs. */
export interface StairConcretePitch {
  flightRise: number;
  angle: number;
  slantLength: number;
  dir: { x: number; y: number };
  normal: { x: number; y: number };
  verticalDepth: number;
}

/** 几何派生量 */
export interface StairLayout {
  /** 踏步高 (mm) */
  rise: number;
  /** 踏面宽 (mm) */
  run: number;
  /** 踏面数量 m；踏步级数为 m+1 */
  treadCount: number;
  /** 斜板倾角 θ (rad) */
  angle: number;
  /** 斜板中心线实际长度 (mm) */
  slantLength: number;
  /** 斜板方向单位向量 (x,y) */
  dir: { x: number; y: number };
  /** 斜板法向（指向外侧/下侧）单位向量 (x,y)，垂直于 dir */
  normal: { x: number; y: number };
  /** 低端梯梁底 y 坐标 */
  lowBeamBottomY: number;
  /** 低端梯梁顶 y 坐标 = 楼层/平台结构标高 */
  lowBeamTopY: number;
  /** 高端梯梁底 y 坐标 */
  highBeamBottomY: number;
  /** 高端梯梁顶 y 坐标 */
  highBeamTopY: number;
  /** 低端支座中心 x */
  lowBeamCenterX: number;
  /** 高端支座中心 x */
  highBeamCenterX: number;
  /** 梯板宽度中心 z */
  widthCenterZ: number;
  /** AT concrete pitch; reinforcement keeps the compatibility fields above for now. */
  concretePitch: StairConcretePitch;
  /** 斜腹板底线在低端梯梁内侧面的交点 */
  soffitLow: { x: number; y: number };
  /** 斜腹板底线在高端梯梁内侧面的交点 */
  soffitHigh: { x: number; y: number };
  /** 第1-8页纵剖面闭合轮廓，供3D和SVG共同消费 */
  concreteProfile: StairProfilePoint[];
}

export interface StairThicknessSegment {
  root: { x: number; y: number };
  bottom: { x: number; y: number };
}

/** Returns the normal waist-slab thickness segment at a concrete-root x coordinate. */
export function stairThicknessSegmentAtX(
  layout: StairLayout,
  h: number,
  x: number,
): StairThicknessSegment {
  const { dir, normal } = layout.concretePitch;
  const root = { x, y: x * dir.y / dir.x };
  return {
    root,
    bottom: {
      x: root.x + normal.x * h,
      y: root.y + normal.y * h,
    },
  };
}

export interface StairCheck {
  code: 'beam-length' | 'support-depth' | 'top-anchor' | 'bottom-overrun' | 'layer-fit' | 'geometry';
  severity: 'error' | 'warning';
  message: string;
  end?: 'low' | 'high';
  required?: number;
  provided?: number;
  ok: boolean;
}

/** 钢筋派生量 */
export interface StairDerived {
  layout: StairLayout;
  /** 下部纵筋根数 */
  bottomBarCount: number;
  /** 上部纵筋根数（每端） */
  topBarCount: number;
  /** 上层分布筋根数（仅在粉红色上排纵筋范围内） */
  topDistributionBarCount: number;
  /** 下层分布筋根数（沿斜板长度方向） */
  distributionBarCount: number;
  /** 下部纵筋锚入梯梁长度 la (mm) */
  bottomAnchor: number;
  /** 上部纵筋支座锚固水平段 (0.35lab / 0.6lab) (mm) */
  topAnchor: number;
  /** 上部纵筋端部弯折段 15d (mm) */
  topHook: number;
  /** 上部纵筋伸入跨内水平投影 (mm) */
  topExtend: number;
  /** 纵筋和分布筋中心线距踏步根连线的法向偏移 */
  rebarOffsets: {
    topLongitudinal: number;
    topDistribution: number;
    bottomDistribution: number;
    bottomLongitudinal: number;
  };
  /** 场景内全部梯板钢筋根数 */
  totalBarCount: number;
  /** 参数和构造校核 */
  checks: StairCheck[];
}

export function deriveStair(params: StairParams): StairDerived {
  const treadCount = params.stepCount - 1;
  const rise = params.Hs / params.stepCount;
  const run = params.ln / treadCount;
  const angle = Math.atan2(params.Hs, params.ln);
  const slantLength = Math.sqrt(params.ln * params.ln + params.Hs * params.Hs);
  const dir = { x: params.ln / slantLength, y: params.Hs / slantLength };
  const normal = { x: dir.y, y: -dir.x }; // 指向右下方（外侧/下侧）
  const flightRise = treadCount * rise;
  const concreteSlantLength = Math.hypot(params.ln, flightRise);
  const concreteDir = {
    x: params.ln / concreteSlantLength,
    y: flightRise / concreteSlantLength,
  };
  const concreteNormal = { x: concreteDir.y, y: -concreteDir.x };
  const concreteAngle = Math.atan2(flightRise, params.ln);
  const verticalDepth = params.h / Math.cos(concreteAngle);
  const concretePitch: StairConcretePitch = {
    flightRise,
    angle: concreteAngle,
    slantLength: concreteSlantLength,
    dir: concreteDir,
    normal: concreteNormal,
    verticalDepth,
  };

  // 坐标原点取低端梯梁右侧面（踏步段起点）、低平台结构标高处；
  // ln 为踏步段水平投影净跨（高/低端梯梁内侧面间距），梯梁中心位于端部之外。
  const lowBeamTopY = 0;
  const lowBeamBottomY = -params.lowBeam.height;
  const lowBeamCenterX = -params.lowBeam.width / 2;
  const highBeamCenterX = params.ln + params.highBeam.width / 2;
  const highBeamBottomY = params.Hs - params.highBeam.height;
  const highBeamTopY = params.Hs;
  const widthCenterZ = 0; // 宽度方向已在几何中对称处理
  const soffitLow = { x: 0, y: -verticalDepth };
  const soffitHigh = { x: params.ln, y: flightRise - verticalDepth };
  const concreteProfile: StairProfilePoint[] = [
    { x: 0, y: 0, kind: 'start' },
    { x: 0, y: rise, kind: 'riser' },
  ];
  for (let i = 0; i < treadCount; i++) {
    const x = (i + 1) * run;
    const y = (i + 1) * rise;
    concreteProfile.push({ x, y, kind: 'tread' });
    if (i < treadCount - 1) {
      concreteProfile.push({ x, y: y + rise, kind: 'riser' });
    }
  }
  concreteProfile.push(
    { ...soffitHigh, kind: 'soffit' },
    { ...soffitLow, kind: 'soffit' },
  );

  const layout: StairLayout = {
    rise,
    run,
    treadCount,
    angle,
    slantLength,
    dir,
    normal,
    lowBeamBottomY,
    lowBeamTopY,
    highBeamBottomY,
    highBeamTopY,
    lowBeamCenterX,
    highBeamCenterX,
    widthCenterZ,
    concretePitch,
    soffitLow,
    soffitHigh,
    concreteProfile,
  };

  const bottomAnchor = la(params.bottomBar.grade, params.bottomBar.diameter, params.concrete);
  const topAnchorRaw = lab(params.topBar.grade, params.topBar.diameter, params.concrete);
  const topAnchor = Math.round((params.topAnchorMode ?? 'hinge') === 'hinge' ? 0.35 * topAnchorRaw : 0.6 * topAnchorRaw);
  const topHook = 15 * params.topBar.diameter;
  const topExtend = params.topExtend ?? Math.round(params.ln / 4);

  const topLongitudinal = params.cover + params.topBar.diameter / 2;
  const topDistribution = topLongitudinal + params.topBar.diameter / 2 + params.distributionBar.diameter / 2;
  const bottomLongitudinal = params.h - params.cover - params.bottomBar.diameter / 2;
  const bottomDistribution = bottomLongitudinal - params.bottomBar.diameter / 2 - params.distributionBar.diameter / 2;
  const rebarOffsets = { topLongitudinal, topDistribution, bottomDistribution, bottomLongitudinal };

  // 钢筋根数按中心线可用范围计算，保护层需计入钢筋半径。
  const bottomWidthEdge = params.cover + params.bottomBar.diameter / 2;
  const topWidthEdge = params.cover + params.topBar.diameter / 2;
  const distributionEdge = params.cover + params.distributionBar.diameter / 2;
  const bottomBarCount = Math.max(2, Math.ceil((params.b - 2 * bottomWidthEdge) / params.bottomBar.spacing) + 1);
  const topBarCount = Math.max(2, Math.ceil((params.b - 2 * topWidthEdge) / params.topBar.spacing) + 1);
  const distributionBarCount = Math.max(2, Math.ceil((concreteSlantLength - 2 * distributionEdge) / params.distributionBar.spacing) + 1);

  // 上层分布筋仅在粉红色上排纵筋范围内布置：低端/高端负筋区。
  const topBarCover = params.cover + params.topBar.diameter / 2;
  const lowTopSupportX = -params.lowBeam.width + topBarCover;
  const lowTopSpanEndX = topExtend;
  const highTopSpanEndX = params.ln - topExtend;
  const highTopSupportX = params.ln + params.highBeam.width - topBarCover;
  const lowTopXRange = [Math.min(lowTopSupportX, lowTopSpanEndX), Math.max(lowTopSupportX, lowTopSpanEndX)] as const;
  const highTopXRange = [Math.min(highTopSpanEndX, highTopSupportX), Math.max(highTopSpanEndX, highTopSupportX)] as const;
  const topDistributionSpacing = (concreteSlantLength - 2 * distributionEdge) / (distributionBarCount - 1);
  let topDistributionBarCount = 0;
  for (let i = 0; i < distributionBarCount; i += 1) {
    const s = distributionEdge + i * topDistributionSpacing;
    const x = s * concreteDir.x + topDistribution * concreteNormal.x;
    if (
      (x >= lowTopXRange[0] && x <= lowTopXRange[1]) ||
      (x >= highTopXRange[0] && x <= highTopXRange[1])
    ) {
      topDistributionBarCount += 1;
    }
  }

  const totalBarCount = bottomBarCount + topBarCount * 2 + topDistributionBarCount + distributionBarCount;
  const topRequired = topAnchor;
  const lowTopProvided = (params.lowBeam.width - topBarCover) / dir.x;
  const highTopProvided = (params.highBeam.width - topBarCover) / dir.x;
  const checks: StairCheck[] = [
    {
      code: 'beam-length',
      severity: 'error',
      end: 'low',
      message: '低端梯梁横向长度不得小于梯板宽度',
      required: params.b,
      provided: params.lowBeam.length,
      ok: Number.isFinite(params.lowBeam.length) && params.lowBeam.length >= params.b,
    },
    {
      code: 'beam-length',
      severity: 'error',
      end: 'high',
      message: '高端梯梁横向长度不得小于梯板宽度',
      required: params.b,
      provided: params.highBeam.length,
      ok: Number.isFinite(params.highBeam.length) && params.highBeam.length >= params.b,
    },
    {
      code: 'support-depth',
      severity: 'error',
      end: 'low',
      message: '低端梯梁高度不足以填满梯板端部接缝',
      required: verticalDepth,
      provided: params.lowBeam.height,
      ok: Number.isFinite(params.lowBeam.height) && params.lowBeam.height >= verticalDepth,
    },
    {
      code: 'support-depth',
      severity: 'error',
      end: 'high',
      message: '高端梯梁高度不足以填满梯板端部接缝',
      required: rise + verticalDepth,
      provided: params.highBeam.height,
      ok: Number.isFinite(params.highBeam.height) && params.highBeam.height >= rise + verticalDepth,
    },
    {
      code: 'geometry',
      severity: 'error',
      message: 'AT楼梯几何参数必须为有限正值',
      ok: [
        params.ln,
        params.Hs,
        params.h,
        params.b,
        rise,
        run,
        slantLength,
        concreteSlantLength,
        verticalDepth,
        soffitLow.y,
        soffitHigh.y,
      ]
        .every((value) => Number.isFinite(value)) && params.stepCount >= 2 && params.ln > 0 && params.Hs > 0 && params.h > 0 && params.b > 0,
    },
    ...([
      ['low', lowTopProvided],
      ['high', highTopProvided],
    ] as const).map(([end, provided]): StairCheck => ({
      code: 'top-anchor',
      severity: 'error',
      end,
      message: `${end === 'low' ? '低端' : '高端'}上部纵筋斜向锚固长度不足`,
      required: topRequired,
      provided,
      ok: Number.isFinite(provided) && provided >= topRequired,
    })),
    {
      code: 'layer-fit',
      severity: 'error',
      message: '梯板厚度不足以容纳上下纵筋和分布筋层位',
      required: topDistribution,
      provided: bottomDistribution,
      ok: Number.isFinite(topDistribution) && Number.isFinite(bottomDistribution) && topDistribution < bottomDistribution,
    },
  ];

  return {
    layout,
    bottomBarCount,
    topBarCount,
    topDistributionBarCount,
    distributionBarCount,
    bottomAnchor,
    topAnchor,
    topHook,
    topExtend,
    rebarOffsets,
    totalBarCount,
    checks,
  };
}
