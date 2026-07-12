import { describe, it, expect } from 'vitest';
import * as stairDomain from '../at/derive';
import { defaultStair, deriveStair, normalizeStairParams } from '../at/derive';
import { buildStairConcrete } from '../../geometry/buildStair';
import { buildStairRebar } from '../../geometry/buildStairRebar';
import { lab } from '../codes/22G101-stair';
import { deriveStairRebarLayout } from '../at/rebarLayout';
import type { StairParams } from '../at/types';

type Point2 = { x: number; y: number };

type StairThicknessSegmentAtX = (
  layout: ReturnType<typeof deriveStair>['layout'],
  h: number,
  x: number,
) => { root: Point2; bottom: Point2 };

const stairThicknessSegmentAtX = (
  stairDomain as typeof stairDomain & { stairThicknessSegmentAtX?: StairThicknessSegmentAtX }
).stairThicknessSegmentAtX;

function duplicateConsecutiveVertices(points: Point2[]): Array<[number, number]> {
  const duplicates: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    if (Math.abs(points[i].x - points[next].x) < 1e-8
      && Math.abs(points[i].y - points[next].y) < 1e-8) {
      duplicates.push([i, next]);
    }
  }
  return duplicates;
}

function orientation(a: Point2, b: Point2, c: Point2): -1 | 0 | 1 {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(value) < 1e-8) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a: Point2, b: Point2, point: Point2): boolean {
  return point.x >= Math.min(a.x, b.x) - 1e-8
    && point.x <= Math.max(a.x, b.x) + 1e-8
    && point.y >= Math.min(a.y, b.y) - 1e-8
    && point.y <= Math.max(a.y, b.y) + 1e-8;
}

function segmentsIntersect(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  if (abC !== abD && cdA !== cdB) return true;
  return (abC === 0 && onSegment(a, b, c))
    || (abD === 0 && onSegment(a, b, d))
    || (cdA === 0 && onSegment(c, d, a))
    || (cdB === 0 && onSegment(c, d, b));
}

function nonAdjacentIntersections(points: Point2[]): Array<[number, number]> {
  const intersections: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    const nextI = (i + 1) % points.length;
    for (let j = i + 1; j < points.length; j++) {
      const nextJ = (j + 1) % points.length;
      const adjacent = nextI === j || nextJ === i;
      if (!adjacent && segmentsIntersect(points[i], points[nextI], points[j], points[nextJ])) {
        intersections.push([i, j]);
      }
    }
  }
  return intersections;
}

function adjacentCollinearBacktracks(points: Point2[]): number[] {
  const backtracks: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    if (orientation(a, b, c) === 0 && ab.x * bc.x + ab.y * bc.y < -1e-8) {
      backtracks.push((i + 1) % points.length);
    }
  }
  return backtracks;
}

describe('AT stair derive', () => {
  it('defaultStair returns valid defaults', () => {
    const p = defaultStair();
    expect(p.ln).toBe(3000);
    expect(p.Hs).toBe(1500);
    expect(p.stepCount).toBe(10);
    expect(p.h).toBe(120);
    expect(p.b).toBe(1500);
  });

  it('deriveStair computes step rise/run and slant length', () => {
    const p = defaultStair();
    const d = deriveStair(p);
    expect(d.layout.rise).toBeCloseTo(p.Hs / p.stepCount, 6);
    expect(d.layout.run).toBeCloseTo(p.ln / (p.stepCount - 1), 6);
    expect(d.layout.slantLength).toBeCloseTo(Math.sqrt(p.ln * p.ln + p.Hs * p.Hs), 6);
  });

  it('uses the 22G101-2 non-seismic basic anchor table', () => {
    expect(lab('HPB300', 10, 'C30')).toBe(300);
    expect(lab('HRB400', 10, 'C30')).toBe(350);
    expect(lab('HRB500', 10, 'C30')).toBe(430);
  });

  it('models m treads between the two boundary risers from page 1-8', () => {
    const p: StairParams = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800 };
    const d = deriveStair(p);
    expect(d.layout.treadCount).toBe(11);
    expect(d.layout.run).toBe(280);
    expect(d.layout.rise).toBe(150);
    expect(d.layout.concreteProfile.filter((point) => point.kind === 'tread')).toHaveLength(11);
  });

  it('uses the hs over bs waist pitch from atlas page 2-8', () => {
    const p: StairParams = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800, h: 120 };
    const d = deriveStair(p);
    const hs = 150;
    const bs = 280;
    const theta = Math.atan2(hs, bs);
    const verticalDepth = p.h / Math.cos(theta);

    expect(d.layout.concretePitch.flightRise).toBe(1650);
    expect(d.layout.concretePitch.angle).toBeCloseTo(theta, 8);
    expect(d.layout.concretePitch.slantLength).toBeCloseTo(Math.hypot(p.ln, 1650), 8);
    expect(d.layout.concretePitch.verticalDepth).toBeCloseTo(verticalDepth, 8);
    expect(d.layout.soffitLow.x).toBe(0);
    expect(d.layout.soffitLow.y).toBeCloseTo(-verticalDepth, 8);
    expect(d.layout.soffitHigh.x).toBe(p.ln);
    expect(d.layout.soffitHigh.y).toBeCloseTo(1650 - verticalDepth, 8);
  });

  it('ends the slab at the last tread and uses one simple straight soffit', () => {
    const p: StairParams = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800 };
    const d = deriveStair(p);
    const profile = d.layout.concreteProfile;
    const soffit = profile.filter((point) => point.kind === 'soffit');

    expect(profile.filter((point) => point.kind === 'tread')).toHaveLength(11);
    expect(profile.filter((point) => point.kind === 'riser')).toHaveLength(11);
    expect(profile.some((point) => point.x === p.ln && point.y === p.Hs)).toBe(false);
    expect(soffit).toEqual([
      { ...d.layout.soffitHigh, kind: 'soffit' },
      { ...d.layout.soffitLow, kind: 'soffit' },
    ]);
    expect(profile[profile.length - 3]).toMatchObject({ x: p.ln, y: 1650, kind: 'tread' });
    expect(duplicateConsecutiveVertices(profile)).toEqual([]);
    expect(adjacentCollinearBacktracks(profile)).toEqual([]);
    expect(nonAdjacentIntersections(profile)).toEqual([]);
  });

  it('profile guards detect duplicate vertices and adjacent collinear overlap', () => {
    expect(duplicateConsecutiveVertices([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ])).toEqual([[1, 2]]);
    expect(adjacentCollinearBacktracks([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 2 },
    ])).toEqual([1]);
  });

  it('places the thickness segment root on the concrete root line', () => {
    const p: StairParams = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800, h: 120 };
    const layout = deriveStair(p).layout;
    const x = p.ln * 0.4;

    expect(stairThicknessSegmentAtX).toBeTypeOf('function');
    const segment = stairThicknessSegmentAtX!(layout, p.h, x);
    const rootCross = segment.root.x * layout.concretePitch.dir.y
      - segment.root.y * layout.concretePitch.dir.x;

    expect(segment.root.x).toBe(x);
    expect(rootCross).toBeCloseTo(0, 8);
  });

  it('returns a thickness segment normal to the concrete root with length h', () => {
    const p: StairParams = { ...defaultStair(), stepCount: 12, ln: 3080, Hs: 1800, h: 120 };
    const layout = deriveStair(p).layout;

    expect(stairThicknessSegmentAtX).toBeTypeOf('function');
    const segment = stairThicknessSegmentAtX!(layout, p.h, p.ln / 2);
    const thickness = {
      x: segment.bottom.x - segment.root.x,
      y: segment.bottom.y - segment.root.y,
    };

    expect(thickness.x).toBeCloseTo(layout.concretePitch.normal.x * p.h, 8);
    expect(thickness.y).toBeCloseTo(layout.concretePitch.normal.y * p.h, 8);
    expect(thickness.x * layout.concretePitch.dir.x
      + thickness.y * layout.concretePitch.dir.y).toBeCloseTo(0, 8);
    expect(Math.hypot(thickness.x, thickness.y)).toBeCloseTo(p.h, 8);
  });

  it('defaults stair beams to a transverse overhang and reports valid geometry', () => {
    const p = defaultStair();
    const d = deriveStair(p);
    expect(p.lowBeam.length).toBe(p.b + 600);
    expect(p.highBeam.length).toBe(p.b + 600);
    expect(d.checks.filter((check) => check.code === 'beam-length').every((check) => check.ok)).toBe(true);
  });

  it('requires exact support depths and rejects heights just below each boundary', () => {
    const base = defaultStair();
    const baseDerived = deriveStair(base);
    const verticalDepth = baseDerived.layout.concretePitch.verticalDepth;
    const highRequired = baseDerived.layout.rise + verticalDepth;
    const baseChecks = baseDerived.checks.filter((check) => check.code === 'support-depth');
    const atBoundary: StairParams = {
      ...base,
      lowBeam: { ...base.lowBeam, height: verticalDepth },
      highBeam: { ...base.highBeam, height: highRequired },
    };
    const belowBoundary: StairParams = {
      ...base,
      lowBeam: { ...base.lowBeam, height: verticalDepth - 1e-6 },
      highBeam: { ...base.highBeam, height: highRequired - 1e-6 },
    };

    expect(baseChecks).toHaveLength(2);
    expect(baseChecks[0]).toMatchObject({ end: 'low', required: verticalDepth });
    expect(baseChecks[1]).toMatchObject({ end: 'high', required: highRequired });
    expect(deriveStair(atBoundary).checks
      .filter((check) => check.code === 'support-depth')
      .map((check) => check.ok)).toEqual([true, true]);
    expect(deriveStair(belowBoundary).checks
      .filter((check) => check.code === 'support-depth')
      .map((check) => check.ok)).toEqual([false, false]);
  });

  it('exposes a derived total bar count', () => {
    const d = deriveStair(defaultStair());
    expect(d.totalBarCount).toBe(d.bottomBarCount + d.topBarCount * 2 + d.topDistributionBarCount + d.distributionBarCount);
  });

  it('normalizeStairParams fills missing fields', () => {
    const partial: Partial<StairParams> = { ln: 3000, Hs: 1800 };
    const p = normalizeStairParams(partial);
    expect(p.ln).toBe(3000);
    expect(p.Hs).toBe(1800);
    expect(p.stepCount).toBe(defaultStair().stepCount);
    expect(p.h).toBe(defaultStair().h);
  });

  it('normalizeStairParams deep-fills legacy nested beam fields', () => {
    const p = normalizeStairParams({
      ln: 3200,
      b: 1600,
      lowBeam: { width: 280, height: 360 },
      highBeam: { width: 300, height: 380 },
    });
    expect(p.lowBeam.width).toBe(280);
    expect(p.lowBeam.length).toBe(2200);
    expect(p.highBeam.length).toBe(2200);
    expect(p.bottomBar.spacing).toBe(defaultStair().bottomBar.spacing);
  });

  it('counts bottom/top bars by width spacing', () => {
    const p: StairParams = { ...defaultStair(), b: 1600, cover: 15, bottomBar: { grade: 'HRB400', diameter: 10, spacing: 150 }, topBar: { grade: 'HRB400', diameter: 10, spacing: 150 } };
    const d = deriveStair(p);
    const available = p.b - 2 * (p.cover + p.bottomBar.diameter / 2);
    const expected = Math.ceil(available / 150) + 1;
    expect(d.bottomBarCount).toBe(expected);
    expect(d.topBarCount).toBe(expected);
  });

  it('counts distribution bars by slant spacing', () => {
    const p: StairParams = { ...defaultStair(), distributionBar: { grade: 'HPB300', diameter: 8, spacing: 250 } };
    const d = deriveStair(p);
    const edge = p.cover + p.distributionBar.diameter / 2;
    const expected = Math.ceil((d.layout.concretePitch.slantLength - 2 * edge) / 250) + 1;
    expect(d.distributionBarCount).toBe(expected);
    expect(d.distributionBarCount).toBeGreaterThanOrEqual(2);
    expect(d.topDistributionBarCount).toBeGreaterThanOrEqual(2);
    expect(d.topDistributionBarCount).toBeLessThan(d.distributionBarCount);
  });

  it('places top distribution bars only inside the pink top rebar zones', () => {
    const p = defaultStair();
    const r = deriveStairRebarLayout(p);
    const lowTopRange = [Math.min(r.lowTop.supportTop.x, r.lowTop.spanEnd.x), Math.max(r.lowTop.supportTop.x, r.lowTop.spanEnd.x)];
    const highTopRange = [Math.min(r.highTop.spanEnd.x, r.highTop.supportTop.x), Math.max(r.highTop.spanEnd.x, r.highTop.supportTop.x)];
    expect(r.topDistributionStations.length).toBeGreaterThanOrEqual(2);
    r.topDistributionStations.forEach((station) => {
      const inRange =
        (station.x >= lowTopRange[0] && station.x <= lowTopRange[1]) ||
        (station.x >= highTopRange[0] && station.x <= highTopRange[1]);
      expect(inRange).toBe(true);
    });
    expect(r.bottomDistributionStations.length).toBeGreaterThan(r.topDistributionStations.length);
  });

  it('topExtend defaults to ln/4', () => {
    const p: StairParams = { ...defaultStair(), topExtend: undefined };
    const d = deriveStair(p);
    expect(d.topExtend).toBe(Math.round(p.ln / 4));
  });

  it('top anchor lengths differ between hinge and full', () => {
    const hinge = deriveStair({ ...defaultStair(), topAnchorMode: 'hinge' });
    const full = deriveStair({ ...defaultStair(), topAnchorMode: 'full' });
    expect(hinge.topAnchor).toBeLessThan(full.topAnchor);
    expect(hinge.topHook).toBe(15 * defaultStair().topBar.diameter);
  });

  it('bottom anchor length >= 200mm', () => {
    const d = deriveStair(defaultStair());
    expect(d.bottomAnchor).toBeGreaterThanOrEqual(200);
  });

  it('handles minimum 2 steps without NaN/Infinity', () => {
    const p: StairParams = { ...defaultStair(), stepCount: 2 };
    const d = deriveStair(p);
    expect(Number.isFinite(d.layout.slantLength)).toBe(true);
    expect(d.distributionBarCount).toBeGreaterThanOrEqual(2);
  });

  it('layout places beams outside the ln clear span', () => {
    const p = defaultStair();
    const d = deriveStair(p);
    expect(d.layout.lowBeamCenterX).toBe(-p.lowBeam.width / 2);
    expect(d.layout.highBeamCenterX).toBe(p.ln + p.highBeam.width / 2);
    expect(d.layout.lowBeamTopY).toBe(0);
    expect(d.layout.highBeamTopY).toBe(p.Hs);
  });
});

describe('AT page 2-8 rebar layout', () => {
  it('places all layer centerlines inside the slab without collisions', () => {
    const p = defaultStair();
    const r = deriveStairRebarLayout(p);
    expect(r.offsets.topLongitudinal).toBe(p.cover + p.topBar.diameter / 2);
    expect(r.offsets.topDistribution).toBeGreaterThan(r.offsets.topLongitudinal);
    expect(r.offsets.bottomDistribution).toBeLessThan(r.offsets.bottomLongitudinal);
    expect(r.offsets.bottomLongitudinal).toBe(p.h - p.cover - p.bottomBar.diameter / 2);
    expect(r.offsets.topDistribution).toBeLessThan(r.offsets.bottomDistribution);
  });

  it('uses ln over four as a horizontal top-bar projection', () => {
    const p = defaultStair();
    const r = deriveStairRebarLayout(p);
    expect(r.lowTop.spanEnd.x).toBeCloseTo(p.ln / 4, 6);
    expect(r.highTop.spanEnd.x).toBeCloseTo(p.ln * 3 / 4, 6);
  });

  it('anchors bottom bars straight to the beam centerline without hooks', () => {
    const p = defaultStair();
    const r = deriveStairRebarLayout(p);
    expect(r.bottom.lowSupportTop.x).toBeCloseTo(-p.lowBeam.width / 2, 6);
    expect(r.bottom.highSupportTop.x).toBeCloseTo(p.ln + p.highBeam.width / 2, 6);
    expect(r.bottom.lowSupportBottom).toEqual(r.bottom.lowSupportTop);
    expect(r.bottom.highSupportBottom).toEqual(r.bottom.highSupportTop);
    expect(r.bottom.points).toHaveLength(2);
  });

  it('hooks top bars at beam edges with cover offset and adds a 90° span hook to the bottom bar', () => {
    const p = defaultStair();
    const r = deriveStairRebarLayout(p);
    const topBarCover = p.cover + p.topBar.diameter / 2;
    const pitch = r.layout.concretePitch;
    const normalOffset = (point: { x: number; y: number }) =>
      Math.sin(pitch.angle) * point.x - Math.cos(pitch.angle) * point.y;
    const sumRadii = (p.topBar.diameter + p.bottomBar.diameter) / 2;
    expect(r.lowTop.supportTop.x).toBeCloseTo(-p.lowBeam.width + topBarCover, 6);
    expect(r.highTop.supportTop.x).toBeCloseTo(p.ln + p.highBeam.width - topBarCover, 6);
    expect(r.lowTop.supportTop.y - r.lowTop.supportBottom.y).toBeCloseTo(15 * p.topBar.diameter, 6);
    expect(r.highTop.supportTop.y - r.highTop.supportBottom.y).toBeCloseTo(15 * p.topBar.diameter, 6);
    expect(r.lowTop.points).toHaveLength(4);
    expect(r.highTop.points).toHaveLength(4);
    expect(normalOffset(r.lowTop.spanEnd)).toBeCloseTo(r.offsets.topLongitudinal, 6);
    expect(normalOffset(r.highTop.spanEnd)).toBeCloseTo(r.offsets.topLongitudinal, 6);
    expect(normalOffset(r.lowTop.spanHook)).toBeCloseTo(r.offsets.bottomLongitudinal - sumRadii, 6);
    expect(normalOffset(r.highTop.spanHook)).toBeCloseTo(r.offsets.bottomLongitudinal - sumRadii, 6);
    const lowSeg = { x: r.lowTop.spanHook.x - r.lowTop.spanEnd.x, y: r.lowTop.spanHook.y - r.lowTop.spanEnd.y };
    const highSeg = { x: r.highTop.spanHook.x - r.highTop.spanEnd.x, y: r.highTop.spanHook.y - r.highTop.spanEnd.y };
    expect(lowSeg.x * pitch.dir.x + lowSeg.y * pitch.dir.y).toBeCloseTo(0, 6);
    expect(highSeg.x * pitch.dir.x + highSeg.y * pitch.dir.y).toBeCloseTo(0, 6);
  });

  it('keeps longitudinal bar centers behind the width cover', () => {
    const p = defaultStair();
    const r = deriveStairRebarLayout(p);
    expect(r.bottomZs[0]).toBe(-p.b / 2 + p.cover + p.bottomBar.diameter / 2);
    expect(r.bottomZs[r.bottomZs.length - 1]).toBe(p.b / 2 - p.cover - p.bottomBar.diameter / 2);
    expect(r.topZs[0]).toBe(-p.b / 2 + p.cover + p.topBar.diameter / 2);
  });

  it('reports page 2-8 anchorage checks for both supports', () => {
    const p = defaultStair();
    const d = deriveStair(p);
    const topChecks = d.checks.filter((check) => check.code === 'top-anchor');
    expect(topChecks).toHaveLength(2);
    expect(topChecks.every((check) => check.ok)).toBe(true);
  });
});

describe('AT stair rebar geometry', () => {
  const expectMappedPoint = (
    actual: { x: number; y: number; z: number },
    expected: { x: number; y: number },
    expectedZ: number,
  ) => {
    expect(actual.x).toBeCloseTo(expected.x, 6);
    expect(actual.y).toBeCloseTo(expected.y, 6);
    expect(actual.z).toBeCloseTo(expectedZ, 6);
  };

  it('extrudes the domain concrete profile and honors each transverse beam length', () => {
    const base = defaultStair();
    const p: StairParams = {
      ...base,
      lowBeam: { ...base.lowBeam, length: base.b + 400 },
      highBeam: { ...base.highBeam, length: base.b + 800 },
    };
    const domain = deriveStair(p);
    const concrete = buildStairConcrete(p);
    const geometries = [
      concrete.slabGeometry,
      concrete.lowBeamGeometry,
      concrete.highBeamGeometry,
    ];

    try {
      geometries.forEach((geometry) => geometry.computeBoundingBox());
      const slabBox = concrete.slabGeometry.boundingBox!;
      const lowBeamBox = concrete.lowBeamGeometry.boundingBox!;
      const highBeamBox = concrete.highBeamGeometry.boundingBox!;
      const profileXs = domain.layout.concreteProfile.map((point) => point.x);
      const profileYs = domain.layout.concreteProfile.map((point) => point.y);

      expect(slabBox.min.x).toBeCloseTo(Math.min(...profileXs), 4);
      expect(slabBox.max.x).toBeCloseTo(Math.max(...profileXs), 4);
      expect(slabBox.min.y).toBeCloseTo(Math.min(...profileYs), 4);
      expect(slabBox.max.y).toBeCloseTo(Math.max(...profileYs), 4);
      expect(lowBeamBox.min.x).toBeCloseTo(-p.lowBeam.width, 4);
      expect(lowBeamBox.max.x).toBeCloseTo(0, 4);
      expect(lowBeamBox.min.y).toBeCloseTo(-p.lowBeam.height, 4);
      expect(lowBeamBox.max.y).toBeCloseTo(0, 4);
      expect(lowBeamBox.min.z).toBeCloseTo(-p.lowBeam.length / 2, 4);
      expect(lowBeamBox.max.z).toBeCloseTo(p.lowBeam.length / 2, 4);
      expect(highBeamBox.min.x).toBeCloseTo(p.ln, 4);
      expect(highBeamBox.max.x).toBeCloseTo(p.ln + p.highBeam.width, 4);
      expect(highBeamBox.min.y).toBeCloseTo(p.Hs - p.highBeam.height, 4);
      expect(highBeamBox.max.y).toBeCloseTo(p.Hs, 4);
      expect(highBeamBox.min.z).toBeCloseTo(-p.highBeam.length / 2, 4);
      expect(highBeamBox.max.z).toBeCloseTo(p.highBeam.length / 2, 4);
      expect(p.lowBeam.length).toBeGreaterThan(p.b);
      expect(p.highBeam.length).toBeGreaterThan(p.b);
    } finally {
      geometries.forEach((geometry) => geometry.dispose());
    }
  });

  it('builds bottom, top and distribution bars', () => {
    const p = defaultStair();
    const r = buildStairRebar(p);
    expect(r.bars.some((b) => b.meta.kind === 'bottom')).toBe(true);
    expect(r.bars.some((b) => b.meta.kind === 'top')).toBe(true);
    expect(r.bars.some((b) => b.meta.kind === 'distribution')).toBe(true);
  });

  it('preserves the five named domain bar groups', () => {
    const groups = new Set(buildStairRebar(defaultStair()).bars.map((bar) => bar.group));
    expect(groups).toEqual(new Set([
      'bottom',
      'top-low',
      'top-high',
      'distribution-top',
      'distribution-bottom',
    ]));
  });

  it('uses distinct colors for top, bottom and distribution groups', () => {
    const bars = buildStairRebar(defaultStair()).bars;
    const colorFor = (group: typeof bars[number]['group']) => (
      bars.find((bar) => bar.group === group)!.color
    );

    expect(colorFor('top-low')).toBe(colorFor('top-high'));
    expect(colorFor('top-low')).not.toBe(colorFor('bottom'));
    expect(colorFor('distribution-top')).not.toBe(colorFor('bottom'));
  });

  it('maps the named domain longitudinal paths without adding beam segments', () => {
    const p = defaultStair();
    const domain = deriveStairRebarLayout(p);
    const result = buildStairRebar(p);
    const cases = [
      ['stair-bottom-0', domain.bottom.points, domain.bottomZs[0]],
      ['stair-top-low-0', domain.lowTop.points, domain.topZs[0]],
      ['stair-top-high-0', domain.highTop.points, domain.topZs[0]],
    ] as const;

    for (const [barKey, path, z] of cases) {
      const bar = result.bars.find((candidate) => candidate.barKey === barKey)!;
      expect(bar.points).toHaveLength(path.length);
      expectMappedPoint(bar.points[0], path[0], z);
      expectMappedPoint(bar.points[bar.points.length - 1], path[path.length - 1], z);
    }
  });

  it('maps distribution stations and width limits from the domain layout', () => {
    const p = defaultStair();
    const domain = deriveStairRebarLayout(p);
    const result = buildStairRebar(p);
    const cases = [
      ['stair-dist-top-0', domain.topDistributionStations[0]],
      ['stair-dist-bottom-0', domain.bottomDistributionStations[0]],
    ] as const;

    for (const [barKey, station] of cases) {
      const bar = result.bars.find((candidate) => candidate.barKey === barKey)!;
      expectMappedPoint(bar.points[0], station, domain.distributionZRange[0]);
      expectMappedPoint(bar.points[bar.points.length - 1], station, domain.distributionZRange[1]);
    }
  });
});
