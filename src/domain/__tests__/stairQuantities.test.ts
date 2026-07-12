import { describe, expect, it } from 'vitest';
import { defaultStair } from '../at/derive';
import { deriveStairQuantityRows } from '../at/quantities';
import { deriveStairRebarLayout, type StairPoint2 } from '../at/rebarLayout';

function polylineLength(points: StairPoint2[]): number {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

describe('deriveStairQuantityRows', () => {
  it('keeps unequal low and high top-bar paths as separate rows', () => {
    const defaults = defaultStair();
    const params = {
      ...defaults,
      lowBeam: { ...defaults.lowBeam, width: 250 },
      highBeam: { ...defaults.highBeam, width: 400 },
    };

    const rows = deriveStairQuantityRows(params);
    const lowTop = rows.find((row) => row.mark === 'T-L');
    const highTop = rows.find((row) => row.mark === 'T-H');

    expect(lowTop).toBeDefined();
    expect(highTop).toBeDefined();
    expect(lowTop?.length).not.toBe(highTop?.length);
  });

  it('derives longitudinal lengths and quantities from named domain paths and width stations', () => {
    const params = defaultStair();
    const layout = deriveStairRebarLayout(params);
    const rows = deriveStairQuantityRows(params);

    const expected = [
      ['B', layout.bottom.points, layout.bottomZs.length],
      ['T-L', layout.lowTop.points, layout.topZs.length],
      ['T-H', layout.highTop.points, layout.topZs.length],
    ] as const;

    for (const [mark, path, quantity] of expected) {
      const row = rows.find((candidate) => candidate.mark === mark);
      const length = polylineLength(path);
      expect(row?.quantity).toBe(quantity);
      expect(row?.length).toBeCloseTo(length, 8);
      expect(row?.totalLength).toBeCloseTo(length * quantity, 8);
    }
  });

  it('derives both distribution layers from their stations and width range', () => {
    const params = defaultStair();
    const layout = deriveStairRebarLayout(params);
    const rows = deriveStairQuantityRows(params);
    const distributionLength = Math.abs(layout.distributionZRange[1] - layout.distributionZRange[0]);

    const top = rows.find((row) => row.mark === 'D-T');
    const bottom = rows.find((row) => row.mark === 'D-B');

    expect(top?.quantity).toBe(layout.topDistributionStations.length);
    expect(bottom?.quantity).toBe(layout.bottomDistributionStations.length);
    expect(top?.length).toBeCloseTo(distributionLength, 8);
    expect(bottom?.length).toBeCloseTo(distributionLength, 8);
    expect(top?.totalLength).toBeCloseTo(distributionLength * layout.topDistributionStations.length, 8);
    expect(bottom?.totalLength).toBeCloseTo(distributionLength * layout.bottomDistributionStations.length, 8);
  });

  it('includes project-style specs, totals and steel weight on every row', () => {
    const params = defaultStair();
    const rows = deriveStairQuantityRows(params);

    expect(rows.map((row) => row.mark)).toEqual(['B', 'T-L', 'T-H', 'D-T', 'D-B']);
    for (const row of rows) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.spec).toContain('@');
      expect(row.quantity).toBeGreaterThan(0);
      expect(row.totalLength).toBeCloseTo(row.length * row.quantity, 8);
      expect(row.weight).toBeGreaterThan(0);
    }

    const bottom = rows.find((row) => row.mark === 'B')!;
    const expectedWeight = bottom.totalLength / 1000 * 0.00617 * params.bottomBar.diameter ** 2;
    expect(bottom.weight).toBeCloseTo(expectedWeight, 8);
  });
});
