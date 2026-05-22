import * as THREE from 'three';
import type { BeamParams, RebarBundle } from '../domain/kl/types';
import type { Derived } from '../domain/kl/derive';
import { tubeFromPolyline } from './rebarPath';
import { laE } from '../domain/codes/22G101';
import { maxTopBarsPerRow } from '../domain/codes/maxBarsPerRow';

/** 坐标系：x 沿梁长方向(0 在左支座外边)，y 竖向(0 在梁底)，z 横向(0 在梁宽中心)
 *  上部钢筋 y = h - cover - dStirrup - d/2
 *  下部钢筋 y = cover + dStirrup + d/2
 *  z 在 [-(b/2 - cover - dStirrup - d/2), +...]
 */

export type RebarKind = 'top' | 'bottom' | 'support' | 'support-row2' | 'bottom2-corner' | 'bottom2-mid' | 'mid-construction' | 'mid-torsion';

export interface RebarBuilt {
  geometry: THREE.BufferGeometry;
  /** 元数据，用于标注 */
  meta: { label: string; length: number };
  /** 钢筋类别，用于渲染时区分颜色 */
  kind?: RebarKind;
}

const DEFAULT_STIRRUP_DIA = 10; // 用于计算钢筋净位置；从 stirrup 实际值校正

function distributeZ(b: number, cover: number, dStirrup: number, d: number, count: number): number[] {
  const inner = b / 2 - cover - dStirrup - d / 2;
  if (count === 1) return [0];
  const step = (2 * inner) / (count - 1);
  const arr: number[] = [];
  for (let i = 0; i < count; i++) arr.push(-inner + i * step);
  return arr;
}

/** 计算某支座负筋分两排的根数 (按图集表查最大单排根数) */
export function splitSupportRows(
  beamWidth: number,
  cover: number,
  thruDia: number,
  thruCount: number,
  supDia: number,
  supCount: number,
): { row1: number; row2: number } {
  if (supCount <= 0) return { row1: 0, row2: 0 };
  const maxRow1 = maxTopBarsPerRow(beamWidth, Math.max(thruDia, supDia), cover);
  const cap = Math.max(0, maxRow1 - thruCount);
  const row1 = Math.min(supCount, cap);
  const row2 = supCount - row1;
  return { row1, row2 };
}

/** 上排（贯通筋 + 支座负筋一排部分）共享 z 槽位：贯通筋外侧 + 一排支座筋居中 */
function topRowLayout(p: BeamParams) {
  const dStir = p.spans[0]?.stirrup.diameter ?? DEFAULT_STIRRUP_DIA;
  const dThru = p.topThrough.diameter;
  // 各支座一排可容纳的负筋根数
  const supRow1Counts = p.spans.flatMap((sp) => {
    const out: number[] = [];
    if (sp.topLeftSupport) {
      out.push(splitSupportRows(p.b, p.cover, dThru, p.topThrough.count, sp.topLeftSupport.diameter, sp.topLeftSupport.count).row1);
    }
    if (sp.topRightSupport) {
      out.push(splitSupportRows(p.b, p.cover, dThru, p.topThrough.count, sp.topRightSupport.diameter, sp.topRightSupport.count).row1);
    }
    return out;
  });
  const maxSupRow1 = Math.max(0, ...supRow1Counts);
  const nt = p.topThrough.count;
  const total = nt + maxSupRow1;
  const dMax = Math.max(
    dThru,
    ...p.spans.flatMap((sp) => [sp.topLeftSupport?.diameter ?? 0, sp.topRightSupport?.diameter ?? 0]),
  );
  const slots = distributeZ(p.b, p.cover, dStir, dMax, Math.max(total, 1));
  const ntLeft = Math.ceil(nt / 2);
  const ntRight = nt - ntLeft;
  const throughZ = [
    ...slots.slice(0, ntLeft),
    ...slots.slice(slots.length - ntRight),
  ];
  const supportSlots = slots.slice(ntLeft, slots.length - ntRight); // 中间槽位供一排支座负筋使用
  const y = p.h - p.cover - dStir - dMax / 2;
  return { dStir, throughZ, supportSlots, y, dMax };
}

/** 上部贯通钢筋：从左支座外边 - 弯锚平直 + 弯钩，到右端类似 */
export function buildTopThrough(p: BeamParams, d: Derived): RebarBuilt[] {
  const { throughZ: zs, y } = topRowLayout(p);
  const dia = p.topThrough.diameter;

  const xLeftEnd = p.cover; // 进入左支座弯锚水平段终点 ~ 距外侧保护层
  const xRightEnd = d.totalLength - p.cover;
  const yBendLeftBottom = y - d.topAnchor.vertical;
  const yBendRightBottom = y - d.topAnchor.vertical;

  return zs.map((z, i) => {
    const pts = [
      new THREE.Vector3(xLeftEnd, yBendLeftBottom, z),
      new THREE.Vector3(xLeftEnd, y, z),
      new THREE.Vector3(xRightEnd, y, z),
      new THREE.Vector3(xRightEnd, yBendRightBottom, z),
    ];
    return {
      geometry: tubeFromPolyline(pts, dia / 2),
      meta: { label: `上部贯通筋 ${i + 1}/${p.topThrough.count}`, length: pts.reduce((s, _, k) => k > 0 ? s + pts[k].distanceTo(pts[k-1]) : s, 0) },
    };
  });
}

/** 下部第一排钢筋：每跨独立，左右弯锚入支座 */
export function buildBottom(p: BeamParams, d: Derived): RebarBuilt[] {
  const out: RebarBuilt[] = [];
  for (let i = 0; i < p.spans.length; i++) {
    const sp = p.spans[i];
    const dStir = sp.stirrup.diameter;
    const dia = sp.bottom.diameter;
    const y = p.cover + dStir + dia / 2;
    const zs = distributeZ(p.b, p.cover, dStir, dia, sp.bottom.count);
    const anchor = d.bottomAnchorPerSpan[i];

    // 左支座外边 x：累加直到该跨左支座外边
    // 下部钢筋稍短：弯钩落在上部贯通筋弯钩内侧 (inset = 上部直径 + 本筋直径 + 5mm 间隙)
    const dsp = d.spans[i];
    const inset = p.topThrough.diameter + dia + 5;
    const isFirst = i === 0;
    const isLast = i === p.spans.length - 1;
    const xLeftOuter = dsp.x0 - sp.hcLeft + p.cover + (isFirst ? inset : 0);
    const xRightOuter = dsp.x1 + sp.hcRight - p.cover - (isLast ? inset : 0);
    const yUp = y + anchor.vertical;

    zs.forEach((z, k) => {
      const pts = [
        new THREE.Vector3(xLeftOuter, yUp, z),
        new THREE.Vector3(xLeftOuter, y, z),
        new THREE.Vector3(xRightOuter, y, z),
        new THREE.Vector3(xRightOuter, yUp, z),
      ];
      out.push({
        geometry: tubeFromPolyline(pts, dia / 2),
        meta: { label: `第${i + 1}跨下部一排 ${k + 1}/${sp.bottom.count}`, length: 0 },
      });
    });

    // 第二排下部钢筋 (22G101-1)
    // 角部钢筋 (第一根和最后一根) 伸入支座弯锚；中间钢筋不伸入柱
    if (sp.bottomRow2 && sp.bottomRow2.count > 0) {
      const dia2 = sp.bottomRow2.diameter;
      const clearGap = Math.max(25, dia); // 排间净距 ≥ 25mm 且 ≥ 一排直径
      const y2 = y + dia / 2 + clearGap + dia2 / 2;
      const zs2 = distributeZ(p.b, p.cover, dStir, dia2, sp.bottomRow2.count);
      const anchor2 = d.bottomAnchorPerSpan[i]; // 角筋锚固参数同一排
      // 二排角筋比一排稍短，避免弯钩重叠：额外内缩一排直径+间隙
      const inset2 = inset + dia + 5;
      const xLeft2Anchor = dsp.x0 - sp.hcLeft + p.cover + (isFirst ? inset2 : 0);
      const xRight2Anchor = dsp.x1 + sp.hcRight - p.cover - (isLast ? inset2 : 0);
      const yUp2 = y2 + anchor2.vertical;

      zs2.forEach((z, k) => {
        const isCorner = k === 0 || k === zs2.length - 1;
        if (isCorner) {
          // 角筋：伸入支座弯锚（比一排短一个直径+间距，避免弯钩重叠）
          const pts = [
            new THREE.Vector3(xLeft2Anchor, yUp2, z),
            new THREE.Vector3(xLeft2Anchor, y2, z),
            new THREE.Vector3(xRight2Anchor, y2, z),
            new THREE.Vector3(xRight2Anchor, yUp2, z),
          ];
          out.push({
            geometry: tubeFromPolyline(pts, dia2 / 2),
            meta: { label: `第${i + 1}跨下部二排角筋 ${k + 1}/${sp.bottomRow2!.count}`, length: 0 },
            kind: 'bottom2-corner',
          });
        } else {
          if (sp.bottomRow2MidAnchor) {
            // 中间筋伸入支座：弯锚（同角筋）
            const pts = [
              new THREE.Vector3(xLeft2Anchor, yUp2, z),
              new THREE.Vector3(xLeft2Anchor, y2, z),
              new THREE.Vector3(xRight2Anchor, y2, z),
              new THREE.Vector3(xRight2Anchor, yUp2, z),
            ];
            out.push({
              geometry: tubeFromPolyline(pts, dia2 / 2),
              meta: { label: `第${i + 1}跨下部二排中间筋 ${k + 1}/${sp.bottomRow2!.count}`, length: 0 },
              kind: 'bottom2-corner', // 伸入支座时颜色同角筋
            });
          } else {
            // 中间筋不伸入支座：长度 = 0.8ln，两端各缩 0.1ln
            const shrink = 0.1 * sp.ln;
            const xLeft2Mid = dsp.x0 + shrink;
            const xRight2Mid = dsp.x1 - shrink;
            const pts = [
              new THREE.Vector3(xLeft2Mid, y2, z),
              new THREE.Vector3(xRight2Mid, y2, z),
            ];
            out.push({
              geometry: tubeFromPolyline(pts, dia2 / 2),
              meta: { label: `第${i + 1}跨下部二排中间筋 ${k + 1}/${sp.bottomRow2!.count}`, length: 0 },
              kind: 'bottom2-mid',
            });
          }
        }
      });
    }
  }
  return out;
}

/** 中部钢筋：侧面纵向构造筋 / 受扭纵筋 (22G101-1 p2-41)
 *  沿梁侧面高度均匀分布, 搭接锚固: 构造筋 15d, 受扭纵筋 l_lE
 *  位置: 梁两侧, y 在上下主筋之间均分
 */
export function buildMidBars(p: BeamParams, d: Derived): RebarBuilt[] {
  const out: RebarBuilt[] = [];
  for (let i = 0; i < p.spans.length; i++) {
    const sp = p.spans[i];
    if (!sp.midBarEnabled) continue;

    const dStir = sp.stirrup.diameter;
    const dsp = d.spans[i];

    // 确定使用的钢筋参数
    const midType = sp.midBarType ?? 'construction';
    const bundle = midType === 'torsion'
      ? (sp.midTorsionBar ?? { grade: 'HRB400', diameter: 14, count: 2 })
      : (sp.midConstructionBar ?? { grade: 'HRB400', diameter: 12, count: 2 });
    const dia = bundle.diameter;
    const kind: RebarKind = midType === 'torsion' ? 'mid-torsion' : 'mid-construction';

    // 两腰各布 count/2 根, 总根数=输入纵筋数
    const leftCount = Math.ceil(bundle.count / 2);
    const rightCount = Math.floor(bundle.count / 2);

    // y 范围: 上部主筋下缘 到 下部主筋上缘 (含下部二排时取二排上缘)
    const topYMain = p.h - p.cover - dStir - p.topThrough.diameter / 2;
    const botYMain = p.cover + dStir + sp.bottom.diameter / 2;
    let upperBound = topYMain - p.topThrough.diameter / 2;
    let lowerBound = botYMain + sp.bottom.diameter / 2;
    if (sp.bottomRow2 && sp.bottomRow2.count > 0) {
      const dia1 = sp.bottom.diameter;
      const dia2 = sp.bottomRow2.diameter;
      const clearGap = Math.max(25, dia1);
      const y2 = botYMain + dia1 / 2 + clearGap + dia2 / 2;
      lowerBound = y2 + dia2 / 2;
    }

    // 两侧 z 坐标
    const zLeft = -(p.b / 2 - p.cover - dStir - dia / 2);
    const zRight = p.b / 2 - p.cover - dStir - dia / 2;

    // 端部锚固:
    //   构造筋: 15d 直锚 (无弯折)
    //   扭筋:   优先直锚 laE; 支座宽度不足时弯锚, 弯钩 15d
    let anchorVLeft = 0, anchorVRight = 0;
    let xLeftEnd: number, xRightEnd: number;
    if (midType === 'torsion') {
      const torLaE = laE(bundle.grade, dia, p.concrete, p.seismic);
      const availLeft = sp.hcLeft - p.cover;
      const availRight = sp.hcRight - p.cover;
      if (availLeft >= torLaE) {
        xLeftEnd = dsp.x0 - torLaE;            // 直锚
      } else {
        xLeftEnd = dsp.x0 - availLeft;          // 弯锚: 水平段至支座外侧保护层
        anchorVLeft = 15 * dia;                 // 15d 弯钩
      }
      if (availRight >= torLaE) {
        xRightEnd = dsp.x1 + torLaE;
      } else {
        xRightEnd = dsp.x1 + availRight;
        anchorVRight = 15 * dia;
      }
    } else {
      xLeftEnd = dsp.x0 - Math.min(15 * dia, sp.hcLeft - p.cover);
      xRightEnd = dsp.x1 + Math.min(15 * dia, sp.hcRight - p.cover);
    }

    const sides: Array<{ z: number; n: number; name: string }> = [
      { z: zLeft, n: leftCount, name: '左' },
      { z: zRight, n: rightCount, name: '右' },
    ];
    for (const { z, n, name } of sides) {
      for (let j = 0; j < n; j++) {
        // 均分: n+1 段, 钢筋位于 (j+1)/(n+1) 位置
        const y = lowerBound + ((j + 1) / (n + 1)) * (upperBound - lowerBound);

        let pts: THREE.Vector3[];
        if (midType === 'torsion') {
          // 扭筋: 能直锚则直锚, 否则水平+15d 向上弯钩
          pts = [];
          if (anchorVLeft > 0) pts.push(new THREE.Vector3(xLeftEnd, y + anchorVLeft, z));
          pts.push(new THREE.Vector3(xLeftEnd, y, z));
          pts.push(new THREE.Vector3(xRightEnd, y, z));
          if (anchorVRight > 0) pts.push(new THREE.Vector3(xRightEnd, y + anchorVRight, z));
        } else {
          // 构造筋: 直锚 15d, 无弯折
          pts = [
            new THREE.Vector3(xLeftEnd, y, z),
            new THREE.Vector3(xRightEnd, y, z),
          ];
        }
        out.push({
          geometry: tubeFromPolyline(pts, dia / 2),
          meta: { label: `第${i + 1}跨${midType === 'torsion' ? '扭筋' : '构造筋'} ${name}侧 ${j + 1}/${n}`, length: 0 },
          kind,
        });
      }
    }
  }
  return out;
}

/** 端支座 / 中间支座负筋 (上部，与贯通筋并排, 超出单排最大根数时分两排) */
export function buildTopSupport(p: BeamParams, d: Derived): RebarBuilt[] {
  const out: RebarBuilt[] = [];
  const { supportSlots, y, dStir, dMax } = topRowLayout(p);
  const dThru = p.topThrough.diameter;
  const nThru = p.topThrough.count;
  const pickZ = (count: number) => {
    if (count >= supportSlots.length) return supportSlots.slice();
    const start = Math.floor((supportSlots.length - count) / 2);
    return supportSlots.slice(start, start + count);
  };
  // 第二排中心 z 槽位 (按本身直径在内侧重新分布)
  const row2Zs = (count: number, dia: number) => distributeZ(p.b, p.cover, dStir, dia, count);

  /** 渲染单根支座负筋 (含弯锚或直锚选择) */
  const drawSupBar = (
    bundle: RebarBundle, dia: number, z: number,
    yRow: number, xOuter: number, xEnd: number, side: 'L' | 'R',
    isEnd: boolean, label: string,
    xStartIfMiddle?: number,
    kind: RebarKind = 'support',
  ) => {
    if (isEnd) {
      const yDown = yRow - 15 * dia;
      const pts = side === 'L'
        ? [new THREE.Vector3(xOuter, yDown, z), new THREE.Vector3(xOuter, yRow, z), new THREE.Vector3(xEnd, yRow, z)]
        : [new THREE.Vector3(xEnd, yRow, z), new THREE.Vector3(xOuter, yRow, z), new THREE.Vector3(xOuter, yDown, z)];
      out.push({ geometry: tubeFromPolyline(pts, dia / 2), meta: { label, length: 0 }, kind });
    } else {
      const pts = [new THREE.Vector3(xStartIfMiddle!, yRow, z), new THREE.Vector3(xEnd, yRow, z)];
      out.push({ geometry: tubeFromPolyline(pts, dia / 2), meta: { label, length: 0 }, kind });
    }
  };

  for (let i = 0; i < p.spans.length; i++) {
    const sp = p.spans[i];
    const dsp = d.spans[i];
    const ext = d.topSupportExtend[i];

    // 左支座负筋: 第一排 ln/3, 第二排 ln/4 (22G101-1)
    if (sp.topLeftSupport) {
      const bundle: RebarBundle = sp.topLeftSupport;
      const dia = bundle.diameter;
      const split = splitSupportRows(p.b, p.cover, dThru, nThru, dia, bundle.count);
      const xOuter = dsp.x0 - sp.hcLeft + p.cover;
      const xEndRow1 = dsp.x0 + ext.left;                      // ln/3 端点 (一排)
      const xEndRow2 = dsp.x0 + ext.left * 0.75;               // ln/4 端点 (二排)
      const isEnd = i === 0;
      const xStartRow1 = !isEnd ? d.spans[i - 1].x1 - d.topSupportExtend[i - 1].right : undefined;
      const xStartRow2 = !isEnd ? d.spans[i - 1].x1 - d.topSupportExtend[i - 1].right * 0.75 : undefined;
      // 第一排
      if (split.row1 > 0) {
        const zs = pickZ(split.row1);
        zs.forEach((z) => drawSupBar(bundle, dia, z, y, xOuter, xEndRow1, 'L', isEnd, `第${i + 1}跨左支座负筋一排`, xStartRow1));
      }
      // 第二排 (在第一排下方, 排间净距 max(25, dia), 端点改为 ln/4)
      if (split.row2 > 0) {
        const clearGap = Math.max(25, dia);
        const yRow2 = y - dMax / 2 - clearGap - dia / 2;
        const zs2 = row2Zs(split.row2, dia);
        zs2.forEach((z) => drawSupBar(bundle, dia, z, yRow2, xOuter, xEndRow2, 'L', isEnd, `第${i + 1}跨左支座负筋二排`, xStartRow2, 'support-row2'));
      }
    }

    // 右端支座（仅最后一跨）
    if (i === p.spans.length - 1 && sp.topRightSupport) {
      const bundle = sp.topRightSupport;
      const dia = bundle.diameter;
      const split = splitSupportRows(p.b, p.cover, dThru, nThru, dia, bundle.count);
      const xOuter = dsp.x1 + sp.hcRight - p.cover;
      const xStartRow1 = dsp.x1 - ext.right;                   // ln/3 (一排)
      const xStartRow2 = dsp.x1 - ext.right * 0.75;            // ln/4 (二排)
      if (split.row1 > 0) {
        const zs = pickZ(split.row1);
        zs.forEach((z) => drawSupBar(bundle, dia, z, y, xOuter, xStartRow1, 'R', true, `第${i + 1}跨右支座负筋一排`));
      }
      if (split.row2 > 0) {
        const clearGap = Math.max(25, dia);
        const yRow2 = y - dMax / 2 - clearGap - dia / 2;
        const zs2 = row2Zs(split.row2, dia);
        zs2.forEach((z) => drawSupBar(bundle, dia, z, yRow2, xOuter, xStartRow2, 'R', true, `第${i + 1}跨右支座负筋二排`, undefined, 'support-row2'));
      }
    }
  }
  return out;
}
