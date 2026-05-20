import * as THREE from 'three';
import type { BeamParams, RebarBundle } from '../domain/kl/types';
import type { Derived } from '../domain/kl/derive';
import { tubeFromPolyline } from './rebarPath';

/** 坐标系：x 沿梁长方向(0 在左支座外边)，y 竖向(0 在梁底)，z 横向(0 在梁宽中心)
 *  上部钢筋 y = h - cover - dStirrup - d/2
 *  下部钢筋 y = cover + dStirrup + d/2
 *  z 在 [-(b/2 - cover - dStirrup - d/2), +...]
 */

export type RebarKind = 'top' | 'bottom' | 'support' | 'bottom2-corner' | 'bottom2-mid';

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

/** 上排（贯通筋 + 支座负筋）共享一排 z 槽位：总槽数 = 贯通根数 + 各支座最大负筋根数 。
 *  贯通筋取最外侧槽位，支座负筋取中间槽位，避免重叠。
 */
function topRowLayout(p: BeamParams) {
  const dStir = p.spans[0]?.stirrup.diameter ?? DEFAULT_STIRRUP_DIA;
  const maxSup = Math.max(
    0,
    ...p.spans.flatMap((sp) => [sp.topLeftSupport?.count ?? 0, sp.topRightSupport?.count ?? 0]),
  );
  const nt = p.topThrough.count;
  const total = nt + maxSup;
  const dMax = Math.max(
    p.topThrough.diameter,
    ...p.spans.flatMap((sp) => [sp.topLeftSupport?.diameter ?? 0, sp.topRightSupport?.diameter ?? 0]),
  );
  const slots = distributeZ(p.b, p.cover, dStir, dMax, Math.max(total, 1));
  const ntLeft = Math.ceil(nt / 2);
  const ntRight = nt - ntLeft;
  const throughZ = [
    ...slots.slice(0, ntLeft),
    ...slots.slice(slots.length - ntRight),
  ];
  const supportSlots = slots.slice(ntLeft, slots.length - ntRight); // 中间槽位供支座负筋使用
  const y = p.h - p.cover - dStir - dMax / 2; // 上排统一 y，按最大直径居中
  return { dStir, throughZ, supportSlots, y };
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

/** 端支座 / 中间支座负筋 (上部，与贯通筋并排) */
export function buildTopSupport(p: BeamParams, d: Derived): RebarBuilt[] {
  const out: RebarBuilt[] = [];
  const { supportSlots, y } = topRowLayout(p);
  const pickZ = (count: number) => {
    // 居中选取 count 个槽位
    if (count >= supportSlots.length) return supportSlots.slice();
    const start = Math.floor((supportSlots.length - count) / 2);
    return supportSlots.slice(start, start + count);
  };
  for (let i = 0; i < p.spans.length; i++) {
    const sp = p.spans[i];
    const dsp = d.spans[i];
    const ext = d.topSupportExtend[i];

    // 左支座负筋：从左支座外边弯锚 → 进入跨内 ext.left
    if (sp.topLeftSupport) {
      const bundle: RebarBundle = sp.topLeftSupport;
      const dia = bundle.diameter;
      const zs = pickZ(bundle.count);
      const xOuter = dsp.x0 - sp.hcLeft + p.cover;
      const xEnd = dsp.x0 + ext.left;
      const yDown = y - 15 * dia;
      // 端支座 (i==0) 才需要弯锚；中间支座直锚穿过
      if (i === 0) {
        zs.forEach((z) => {
          const pts = [
            new THREE.Vector3(xOuter, yDown, z),
            new THREE.Vector3(xOuter, y, z),
            new THREE.Vector3(xEnd, y, z),
          ];
          out.push({ geometry: tubeFromPolyline(pts, dia / 2), meta: { label: `第${i + 1}跨左支座负筋`, length: 0 } });
        });
      } else {
        // 中间支座：跨过支座到对侧 ext，简化为 [上一跨右ext, 本跨左ext]
        const prev = d.spans[i - 1];
        const xStart = prev.x1 - d.topSupportExtend[i - 1].right;
        zs.forEach((z) => {
          const pts = [
            new THREE.Vector3(xStart, y, z),
            new THREE.Vector3(xEnd, y, z),
          ];
          out.push({ geometry: tubeFromPolyline(pts, dia / 2), meta: { label: `第${i + 1}跨左支座负筋`, length: 0 } });
        });
      }
    }

    // 右端支座（仅最后一跨需要单独右端弯锚）
    if (i === p.spans.length - 1 && sp.topRightSupport) {
      const bundle = sp.topRightSupport;
      const dia = bundle.diameter;
      const zs = pickZ(bundle.count);
      const xOuter = dsp.x1 + sp.hcRight - p.cover;
      const xStart = dsp.x1 - ext.right;
      const yDown = y - 15 * dia;
      zs.forEach((z) => {
        const pts = [
          new THREE.Vector3(xStart, y, z),
          new THREE.Vector3(xOuter, y, z),
          new THREE.Vector3(xOuter, yDown, z),
        ];
        out.push({ geometry: tubeFromPolyline(pts, dia / 2), meta: { label: `第${i + 1}跨右支座负筋`, length: 0 } });
      });
    }
  }
  return out;
}
