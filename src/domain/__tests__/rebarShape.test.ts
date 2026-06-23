import { describe, it, expect } from 'vitest';
import {
  unfoldPolyline,
  cutShapeFromPolyline,
  straightBarCutShape,
  stirrupCutShape,
} from '../rebarShape';

describe('unfoldPolyline', () => {
  it('一条直线 → 单段，无弯折', () => {
    const r = unfoldPolyline([
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
    ]);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].length).toBeCloseTo(1000);
    expect(r.totalLength).toBeCloseTo(1000);
  });

  it('U 形（两端 90° 弯钩）→ 段长与转角正确', () => {
    // 竖200 → 横1000 → 竖200，两处 90° 弯折
    const r = unfoldPolyline([
      { x: 0, y: 200, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 200, z: 0 },
    ]);
    expect(r.segments.map((s) => Math.round(s.length))).toEqual([200, 1000, 200]);
    expect(Math.round(r.segments[1].bendAngleDeg!)).toBe(90);
    expect(Math.round(r.segments[2].bendAngleDeg!)).toBe(90);
    expect(r.totalLength).toBeCloseTo(1400);
    // 展平后顶点数 = 折线顶点数
    expect(r.points2D).toHaveLength(4);
  });

  it('忽略相邻重合点', () => {
    const r = unfoldPolyline([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 500, y: 0, z: 0 },
    ]);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].length).toBeCloseTo(500);
  });

  it('非轴向平面折线（z 方向）也能计算转角', () => {
    // 拉筋样式：在 yz 平面，端部 135° 斜尾
    const r = unfoldPolyline([
      { x: 0, y: -50, z: 50 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 300 },
      { x: 0, y: -50, z: 350 },
    ]);
    expect(r.segments).toHaveLength(3);
    expect(r.segments[1].bendAngleDeg).toBeGreaterThan(0);
    expect(r.totalLength).toBeGreaterThan(300);
  });
});

describe('cutShapeFromPolyline', () => {
  it('两点判为直筋', () => {
    const s = cutShapeFromPolyline(
      [{ x: 0, y: 0, z: 0 }, { x: 800, y: 0, z: 0 }],
      { mark: '下部一排', grade: 'HRB400', diameter: 20 },
    );
    expect(s.kind).toBe('straight');
    expect(s.totalLength).toBeCloseTo(800);
  });

  it('多段判为折线筋', () => {
    const s = cutShapeFromPolyline(
      [
        { x: 0, y: 200, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
      ],
      { mark: '支座负筋', grade: 'HRB400', diameter: 25 },
    );
    expect(s.kind).toBe('polyline');
    expect(s.segments).toHaveLength(2);
  });
});

describe('straightBarCutShape', () => {
  it('生成单段直筋', () => {
    const s = straightBarCutShape(3600, { mark: '柱角筋', grade: 'HRB400', diameter: 25 });
    expect(s.kind).toBe('straight');
    expect(s.totalLength).toBe(3600);
    expect(s.points2D).toEqual([{ x: 0, y: 0 }, { x: 3600, y: 0 }]);
  });
});

describe('stirrupCutShape', () => {
  it('闭合矩形箍筋：总长 = 周长 + 2 弯钩', () => {
    const s = stirrupCutShape(550, 550, 100, { mark: '柱外箍筋', grade: 'HRB400', diameter: 10 });
    expect(s.kind).toBe('closedStirrup');
    expect(s.stirrup).toEqual({ width: 550, height: 550, hookLength: 100 });
    expect(s.totalLength).toBe(2 * (550 + 550) + 2 * 100);
  });
});
