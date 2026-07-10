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
    lowBeam: { width: 250, height: 350 },
    highBeam: { width: 250, height: 350 },
    bottomBar: { grade: 'HRB400', diameter: 10, spacing: 150 },
    topBar: { grade: 'HRB400', diameter: 10, spacing: 150 },
    distributionBar: { grade: 'HPB300', diameter: 8, spacing: 250 },
    topExtend: 750,
    topAnchorMode: 'hinge',
  };
}

/** 规范化外部输入，兜底缺失字段 */
export function normalizeStairParams(input: unknown): StairParams {
  return { ...defaultStair(), ...(input as Partial<StairParams>) } as StairParams;
}

/** 几何派生量 */
export interface StairLayout {
  /** 踏步高 (mm) */
  rise: number;
  /** 踏面宽 (mm) */
  run: number;
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
}

/** 钢筋派生量 */
export interface StairDerived {
  layout: StairLayout;
  /** 下部纵筋根数 */
  bottomBarCount: number;
  /** 上部纵筋根数（每端） */
  topBarCount: number;
  /** 分布筋根数（沿斜板长度方向） */
  distributionBarCount: number;
  /** 下部纵筋锚入梯梁长度 la (mm) */
  bottomAnchor: number;
  /** 上部纵筋支座锚固水平段 (0.35lab / 0.6lab) (mm) */
  topAnchor: number;
  /** 上部纵筋端部弯折段 15d (mm) */
  topHook: number;
  /** 上部纵筋伸入跨内水平投影 (mm) */
  topExtend: number;
}

export function deriveStair(params: StairParams): StairDerived {
  const rise = params.Hs / params.stepCount;
  const run = params.ln / (params.stepCount - 1);
  const angle = Math.atan2(params.Hs, params.ln);
  const slantLength = Math.sqrt(params.ln * params.ln + params.Hs * params.Hs);
  const dir = { x: params.ln / slantLength, y: params.Hs / slantLength };
  const normal = { x: dir.y, y: -dir.x }; // 指向右下方（外侧/下侧）

  // 坐标原点取低端梯梁右侧面（踏步段起点）、低平台结构标高处；
  // ln 为踏步段水平投影净跨（高/低端梯梁内侧面间距），梯梁中心位于端部之外。
  const lowBeamTopY = 0;
  const lowBeamBottomY = -params.lowBeam.height;
  const lowBeamCenterX = -params.lowBeam.width / 2;
  const highBeamCenterX = params.ln + params.highBeam.width / 2;
  const highBeamBottomY = params.Hs - params.highBeam.height;
  const highBeamTopY = params.Hs;
  const widthCenterZ = 0; // 宽度方向已在几何中对称处理

  const layout: StairLayout = {
    rise,
    run,
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
  };

  const bottomAnchor = la(params.bottomBar.grade, params.bottomBar.diameter, params.concrete);
  const topAnchorRaw = lab(params.topBar.grade, params.topBar.diameter, params.concrete);
  const topAnchor = Math.round((params.topAnchorMode ?? 'hinge') === 'hinge' ? 0.35 * topAnchorRaw : 0.6 * topAnchorRaw);
  const topHook = 15 * params.topBar.diameter;
  const topExtend = params.topExtend ?? Math.round(params.ln / 4);

  // 钢筋根数：沿板宽方向按间距，保护层外缘起算，+1 根
  const bottomBarCount = Math.max(2, Math.ceil((params.b - 2 * params.cover) / params.bottomBar.spacing) + 1);
  const topBarCount = Math.max(2, Math.ceil((params.b - 2 * params.cover) / params.topBar.spacing) + 1);
  // 分布筋根数：沿斜板长度方向按间距
  const distributionBarCount = Math.max(2, Math.ceil((slantLength - 2 * params.cover) / params.distributionBar.spacing) + 1);

  return {
    layout,
    bottomBarCount,
    topBarCount,
    distributionBarCount,
    bottomAnchor,
    topAnchor,
    topHook,
    topExtend,
  };
}
