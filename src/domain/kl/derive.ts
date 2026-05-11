import { bendAnchorStraightMin, bendAnchorVertical, densifiedZoneLength, laE } from '../codes/16G101';
import type { BeamParams } from './types';

export interface DerivedSpan {
  /** 该跨在梁全长方向上的起点 x (内净跨起点) */
  x0: number;
  /** 该跨净跨终点 x */
  x1: number;
  /** 加密区起止 (从左支座中心算 / 沿全梁 x) */
  denseZones: Array<{ start: number; end: number }>;
  /** 该跨箍筋 x 坐标列表 */
  stirrupXs: number[];
}

export interface Derived {
  /** 梁全长 (含支座) */
  totalLength: number;
  /** 各跨派生 */
  spans: DerivedSpan[];
  /** 上部贯通左/右弯锚 */
  topAnchor: { laE: number; horizontal: number; vertical: number };
  /** 下部钢筋按跨锚固 */
  bottomAnchorPerSpan: { laE: number; horizontal: number; vertical: number }[];
  /** 各跨支座负筋延伸长度 ln/3 (端支座) 或 ln/3 取相邻较大跨 (中间支座，简化) */
  topSupportExtend: { left: number; right: number }[];
  densifiedZoneLen: number;
}

export function derive(p: BeamParams): Derived {
  // 沿 x 轴：从左端支座外边开始累加
  let x = 0;
  const spans: DerivedSpan[] = [];
  const denseLen = densifiedZoneLength(p.h, p.seismic);

  // 端支座外边到第一个净跨起点：左支座宽 hcLeft (针对首跨)
  const firstSpan = p.spans[0];
  const lastSpan = p.spans[p.spans.length - 1];
  const totalLength =
    firstSpan.hcLeft +
    p.spans.reduce((s, sp, i) => s + sp.ln + (i < p.spans.length - 1 ? sp.hcRight : 0), 0) +
    lastSpan.hcRight;

  // x 起始：左端支座外边
  x = 0;
  for (let i = 0; i < p.spans.length; i++) {
    const sp = p.spans[i];
    const x0 = x + sp.hcLeft; // 左支座右边 = 净跨起点
    const x1 = x0 + sp.ln;     // 右支座左边 = 净跨终点

    // 加密区：左、右各一段，长 denseLen
    const dense = [
      { start: x0, end: Math.min(x0 + denseLen, x1) },
      { start: Math.max(x1 - denseLen, x0), end: x1 },
    ];

    // 箍筋布置：从距支座 50mm 起步
    const start = x0 + 50;
    const end = x1 - 50;
    const stirrupXs: number[] = [];
    let cx = start;
    while (cx <= end + 1e-6) {
      stirrupXs.push(cx);
      const inDense = (cx <= dense[0].end) || (cx >= dense[1].start);
      cx += inDense ? sp.stirrup.spacingDense : sp.stirrup.spacingSparse;
    }

    spans.push({ x0, x1, denseZones: dense, stirrupXs });

    // 推进到下一跨的左支座外边: 当前净跨末 + 当前右支座宽
    x = x1 + (i < p.spans.length - 1 ? sp.hcRight : 0);
  }

  // 上部贯通弯锚（按上部贯通钢筋直径计算，端支座宽度按首/尾跨）
  const tt = p.topThrough;
  const taLaE = laE(tt.grade, tt.diameter, p.concrete, p.seismic);
  const taH = Math.max(bendAnchorStraightMin(tt.grade, tt.diameter, p.concrete, p.seismic),
                       Math.max(firstSpan.hcLeft, lastSpan.hcRight) - p.cover);
  // 实际水平段取 支座宽 - 保护层 (示意)
  const horizontal = Math.max(firstSpan.hcLeft, lastSpan.hcRight) - p.cover;
  const topAnchor = {
    laE: taLaE,
    horizontal: Math.max(horizontal, bendAnchorStraightMin(tt.grade, tt.diameter, p.concrete, p.seismic)),
    vertical: bendAnchorVertical(tt.diameter),
  };

  // 下部钢筋逐跨锚入两端支座
  const bottomAnchorPerSpan = p.spans.map((sp) => {
    const d = sp.bottom.diameter;
    const grade = sp.bottom.grade;
    const v = bendAnchorVertical(d);
    const hMin = bendAnchorStraightMin(grade, d, p.concrete, p.seismic);
    const h = Math.max(Math.max(sp.hcLeft, sp.hcRight) - p.cover, hMin);
    return { laE: laE(grade, d, p.concrete, p.seismic), horizontal: h, vertical: v };
  });

  // 支座负筋延伸: 端支座 ln/3, 中间支座 max(左ln, 右ln)/3 (简化)
  const topSupportExtend = p.spans.map((sp, i) => {
    const leftLn = i === 0 ? sp.ln / 3 : Math.max(p.spans[i - 1].ln, sp.ln) / 3;
    const rightLn = i === p.spans.length - 1 ? sp.ln / 3 : Math.max(sp.ln, p.spans[i + 1].ln) / 3;
    return { left: leftLn, right: rightLn };
  });

  return {
    totalLength,
    spans,
    topAnchor,
    bottomAnchorPerSpan,
    topSupportExtend,
    densifiedZoneLen: denseLen,
  };
}

/** 默认参数：单跨 6m 框架梁，方便首屏直接出图 */
export function defaultBeam(): BeamParams {
  return {
    b: 300,
    h: 600,
    cover: 25,
    concrete: 'C30',
    seismic: 1,
    topThrough: { grade: 'HRB400', diameter: 25, count: 2 },
    spans: [
      {
        ln: 6000,
        hcLeft: 600,
        hcRight: 600,
        bottom: { grade: 'HRB400', diameter: 25, count: 4 },
        topLeftSupport: { grade: 'HRB400', diameter: 25, count: 2 },
        topRightSupport: { grade: 'HRB400', diameter: 25, count: 2 },
        stirrup: { grade: 'HRB400', diameter: 10, spacingDense: 100, spacingSparse: 200, legs: 2 },
      },
    ],
  };
}
