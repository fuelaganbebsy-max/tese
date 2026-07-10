import { describe, it, expect } from 'vitest';
import { defaultStair, deriveStair, normalizeStairParams } from '../at/derive';
import { buildStairRebar } from '../../geometry/buildStairRebar';
import type { StairParams } from '../at/types';

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

  it('normalizeStairParams fills missing fields', () => {
    const partial: Partial<StairParams> = { ln: 3000, Hs: 1800 };
    const p = normalizeStairParams(partial);
    expect(p.ln).toBe(3000);
    expect(p.Hs).toBe(1800);
    expect(p.stepCount).toBe(defaultStair().stepCount);
    expect(p.h).toBe(defaultStair().h);
  });

  it('counts bottom/top bars by width spacing', () => {
    const p: StairParams = { ...defaultStair(), b: 1600, cover: 15, bottomBar: { grade: 'HRB400', diameter: 10, spacing: 150 }, topBar: { grade: 'HRB400', diameter: 10, spacing: 150 } };
    const d = deriveStair(p);
    const available = p.b - 2 * p.cover;
    const expected = Math.ceil(available / 150) + 1;
    expect(d.bottomBarCount).toBe(expected);
    expect(d.topBarCount).toBe(expected);
  });

  it('counts distribution bars by slant spacing', () => {
    const p: StairParams = { ...defaultStair(), distributionBar: { grade: 'HPB300', diameter: 8, spacing: 250 } };
    const d = deriveStair(p);
    const expected = Math.ceil((d.layout.slantLength - 2 * p.cover) / 250) + 1;
    expect(d.distributionBarCount).toBe(expected);
    expect(d.distributionBarCount).toBeGreaterThanOrEqual(2);
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

describe('AT stair rebar geometry', () => {
  it('builds bottom, top and distribution bars', () => {
    const p = defaultStair();
    const r = buildStairRebar(p);
    expect(r.bars.some((b) => b.meta.kind === 'bottom')).toBe(true);
    expect(r.bars.some((b) => b.meta.kind === 'top')).toBe(true);
    expect(r.bars.some((b) => b.meta.kind === 'distribution')).toBe(true);
  });

  it('bottom bar has horizontal segments inside both beams', () => {
    const p = defaultStair();
    const d = deriveStair(p);
    const r = buildStairRebar(p);
    const bottom = r.bars.find((b) => b.meta.kind === 'bottom')!;
    const [lowSeg, , , , highSeg] = bottom.points;
    const lowBeamFace = d.layout.lowBeamCenterX + p.lowBeam.width / 2;
    const highBeamFace = d.layout.highBeamCenterX - p.highBeam.width / 2;
    // lowSeg from (lowBeamFace-la, lowBeamTopY-cover) to (lowBeamFace, lowBeamTopY-cover)
    expect(lowSeg.y).toBeCloseTo(d.layout.lowBeamTopY - p.cover, 4);
    expect(bottom.points[1].x).toBe(lowBeamFace);
    // highSeg from (highBeamFace, highBeamTopY-cover) to (highBeamFace+la, highBeamTopY-cover)
    expect(highSeg.y).toBeCloseTo(d.layout.highBeamTopY - p.cover, 4);
    expect(bottom.points[4].x).toBe(highBeamFace);
  });

  it('top bar hooks downward by 15d', () => {
    const p = defaultStair();
    const r = buildStairRebar(p);
    const top = r.bars.find((b) => b.meta.kind === 'top' && b.barKey.includes('low'))!;
    const last = top.points[top.points.length - 1];
    const prev = top.points[top.points.length - 2];
    expect(prev.y - last.y).toBeCloseTo(15 * p.topBar.diameter, 4);
  });
});
