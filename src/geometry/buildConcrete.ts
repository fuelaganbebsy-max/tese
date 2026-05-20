import * as THREE from 'three';
import type { BeamParams, HaunchSpec } from '../domain/kl/types';
import type { Derived } from '../domain/kl/derive';

/* ------------------------------------------------------------------ */
/*  辅助：构建一个三角楔形体（三棱柱）                                    */
/*  用 BufferGeometry 手动构建顶点，避免 ExtrudeGeometry 旋转方向问题      */
/* ------------------------------------------------------------------ */

/**
 * 构建三角楔形：
 * 8 参数定义两个三角形面（近端 + 远端），之间连成三棱柱。
 *
 *   p0 ---- p1          p0 在支座侧（大截面）
 *   |  \                p1 在跨中侧（小截面/尖端）
 *   p2---               p2 在支座侧（大截面底部/侧面）
 *
 * 近端三角形: (ax0,ay0,az0), (ax1,ay1,az1), (ax2,ay2,az2)
 * 远端三角形: (bx0,by0,bz0), (bx1,by1,bz1), (bx2,by2,bz2)
 */
function makeWedge(
  a: [number, number, number][],
  b: [number, number, number][],
): THREE.BufferGeometry {
  // 6 个顶点: a[0],a[1],a[2],b[0],b[1],b[2]
  // a=近端三角, b=远端三角
  const verts = new Float32Array([
    ...a[0], ...a[1], ...a[2],
    ...b[0], ...b[1], ...b[2],
  ]);
  // 8 个三角面 (三棱柱 = 2 三角面 + 3 四边形面 = 2+6=8 三角)
  const idx = [
    // 近端三角面
    0, 1, 2,
    // 远端三角面
    3, 5, 4,
    // 侧面 1: a0-a1-b1-b0
    0, 3, 4, 0, 4, 1,
    // 侧面 2: a1-a2-b2-b1
    1, 4, 5, 1, 5, 2,
    // 侧面 3: a2-a0-b0-b2
    2, 5, 3, 2, 3, 0,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/*  竖向加腋 — 梁底在支座处向下加深                                       */
/* ------------------------------------------------------------------ */
function buildVerticalHaunches(p: BeamParams, d: Derived): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const halfB = p.b / 2;

  const addVH = (h: HaunchSpec | undefined, xEdge: number, dir: 'right' | 'left') => {
    if (!h || !h.enabled) return;
    // xEdge = 支座内边缘 x 坐标
    // dir='right': 加腋向右延伸 (左端支座)
    // dir='left':  加腋向左延伸 (右端支座)
    const xFar = dir === 'right' ? xEdge + h.length : xEdge - h.length;
    //  近端(支座边): 矩形截面 b × depth, 在梁底 y=0 向下延伸
    //  远端(跨中侧): 收窄为线 (depth=0)
    const x0 = xEdge, x1 = xFar;
    // 近端三角截面 (在支座侧): 上边 y=0, 下边 y=-depth, 宽 b
    // 远端尖端 (在跨中侧): y=0, 宽 b (depth=0)
    const nearFront: [number, number, number] = [x0, 0, halfB];
    const nearBack: [number, number, number] = [x0, 0, -halfB];
    const nearBottom: [number, number, number] = [x0, -h.depth, 0];
    const farFront: [number, number, number] = [x1, 0, halfB];
    const farBack: [number, number, number] = [x1, 0, -halfB];
    const farBottom: [number, number, number] = [x1, 0, 0];

    geos.push(makeWedge(
      [nearFront, nearBack, nearBottom],
      [farFront, farBack, farBottom],
    ));
  };

  // 左端支座
  const leftX = p.spans[0].hcLeft;
  addVH(p.verticalHaunchLeft, leftX, 'right');

  // 右端支座
  const lastSpan = p.spans[p.spans.length - 1];
  if (lastSpan.hcRight > 0) {
    const rightX = d.totalLength - lastSpan.hcRight;
    addVH(p.verticalHaunchRight, rightX, 'left');
  }

  return geos;
}

/* ------------------------------------------------------------------ */
/*  水平加腋（两端）— 梁在左/右支座处沿 Z 方向加宽，前后对称              */
/* ------------------------------------------------------------------ */
function buildEndHorizontalHaunches(p: BeamParams, d: Derived): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const halfB = p.b / 2;

  const addHH = (h: HaunchSpec | undefined, xEdge: number, dir: 'right' | 'left') => {
    if (!h || !h.enabled) return;
    const xFar = dir === 'right' ? xEdge + h.length : xEdge - h.length;
    // 在支座侧宽度增加 h.depth (前后各增加), 远端回到原宽度
    // 前侧 (+Z)
    geos.push(makeWedge(
      [[xEdge, p.h, halfB + h.depth], [xEdge, 0, halfB + h.depth], [xEdge, p.h / 2, halfB]],
      [[xFar, p.h, halfB], [xFar, 0, halfB], [xFar, p.h / 2, halfB]],
    ));
    // 后侧 (-Z)
    geos.push(makeWedge(
      [[xEdge, p.h, -(halfB + h.depth)], [xEdge, 0, -(halfB + h.depth)], [xEdge, p.h / 2, -halfB]],
      [[xFar, p.h, -halfB], [xFar, 0, -halfB], [xFar, p.h / 2, -halfB]],
    ));
  };

  // 左端
  const leftX = p.spans[0].hcLeft;
  addHH(p.horizontalHaunchLeft, leftX, 'right');

  // 右端
  const lastSpan = p.spans[p.spans.length - 1];
  if (lastSpan.hcRight > 0) {
    const rightX = d.totalLength - lastSpan.hcRight;
    addHH(p.horizontalHaunchRight, rightX, 'left');
  }

  return geos;
}

/* ------------------------------------------------------------------ */
/*  水平加腋（两侧）— 梁前/后侧面在支座处加宽，各端独立                  */
/* ------------------------------------------------------------------ */
function buildSideHaunches(p: BeamParams, d: Derived): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const halfB = p.b / 2;

  const addSH = (h: HaunchSpec | undefined, zSign: number) => {
    if (!h || !h.enabled) return;
    const zBase = zSign * halfB;
    const zOuter = zSign * (halfB + h.depth);

    const addAtEnd = (xEdge: number, dir: 'right' | 'left') => {
      const xFar = dir === 'right' ? xEdge + h!.length : xEdge - h!.length;
      // 在支座侧: 从 zBase 到 zOuter 的矩形 (高 h)
      // 在远端: 收窄到 zBase (零宽度)
      geos.push(makeWedge(
        [[xEdge, p.h, zOuter], [xEdge, 0, zOuter], [xEdge, p.h / 2, zBase]],
        [[xFar, p.h, zBase], [xFar, 0, zBase], [xFar, p.h / 2, zBase]],
      ));
    };

    // 左端支座
    const leftX = p.spans[0].hcLeft;
    addAtEnd(leftX, 'right');

    // 右端支座
    const lastSpan = p.spans[p.spans.length - 1];
    if (lastSpan.hcRight > 0) {
      const rightX = d.totalLength - lastSpan.hcRight;
      addAtEnd(rightX, 'left');
    }
  };

  addSH(p.horizontalHaunchFront, 1);
  addSH(p.horizontalHaunchBack, -1);

  return geos;
}

/* ------------------------------------------------------------------ */
/*  导出                                                               */
/* ------------------------------------------------------------------ */

export function buildConcreteGeometry(p: BeamParams, d: Derived): THREE.BufferGeometry {
  const firstSpan = p.spans[0];
  const lastSpan = p.spans[p.spans.length - 1];
  // 梁体只渲染柱内边缘之间的部分，端部由柱体覆盖，避免重叠轮廓
  const xStart = firstSpan.hcLeft;
  const xEnd = d.totalLength - lastSpan.hcRight;
  const clearLen = Math.max(0, xEnd - xStart);
  const g = new THREE.BoxGeometry(clearLen, p.h, p.b);
  g.translate(xStart + clearLen / 2, p.h / 2, 0);
  return g;
}

export function buildHaunchGeometries(p: BeamParams, d: Derived): THREE.BufferGeometry[] {
  return [
    ...buildVerticalHaunches(p, d),
    ...buildEndHorizontalHaunches(p, d),
    ...buildSideHaunches(p, d),
  ];
}
