import type { StairRebarSpec, StairParams } from './types';
import {
  deriveStairRebarLayout,
  type StairDistributionStation,
  type StairPoint2,
} from './rebarLayout';

export type StairQuantityMark = 'B' | 'T-L' | 'T-H' | 'D-T' | 'D-B';

export interface StairQuantityRow {
  mark: StairQuantityMark;
  name: string;
  spec: string;
  quantity: number;
  /** Single-bar centerline length (mm). */
  length: number;
  /** Centerline length for all bars in this row (mm). */
  totalLength: number;
  /** Theoretical steel weight (kg), using the project's 0.00617*d^2 convention. */
  weight: number;
}

interface QuantityPoint extends StairPoint2 {
  z?: number;
}

const STEEL_WEIGHT_FACTOR = 0.00617;

function polylineLength(points: QuantityPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    total += Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
      (current.z ?? 0) - (previous.z ?? 0),
    );
  }
  return total;
}

function distributionPath(
  station: StairDistributionStation | undefined,
  zRange: [number, number],
): QuantityPoint[] {
  if (!station) return [];
  return [
    { x: station.x, y: station.y, z: zRange[0] },
    { x: station.x, y: station.y, z: zRange[1] },
  ];
}

function formatSpec(spec: StairRebarSpec): string {
  return `${spec.grade} ⌀${spec.diameter} @${spec.spacing}`;
}

function createRow(input: {
  mark: StairQuantityMark;
  name: string;
  spec: StairRebarSpec;
  path: QuantityPoint[];
  quantity: number;
}): StairQuantityRow {
  const length = polylineLength(input.path);
  const totalLength = length * input.quantity;
  return {
    mark: input.mark,
    name: input.name,
    spec: formatSpec(input.spec),
    quantity: input.quantity,
    length,
    totalLength,
    weight: totalLength / 1000 * STEEL_WEIGHT_FACTOR * input.spec.diameter ** 2,
  };
}

/** Builds deterministic AT quantity rows from the shared domain paths and stations. */
export function deriveStairQuantityRows(params: StairParams): StairQuantityRow[] {
  const rebar = deriveStairRebarLayout(params);

  return [
    createRow({
      mark: 'B',
      name: '下部纵筋',
      spec: params.bottomBar,
      path: rebar.bottom.points,
      quantity: rebar.bottomZs.length,
    }),
    createRow({
      mark: 'T-L',
      name: '低端上部纵筋',
      spec: params.topBar,
      path: rebar.lowTop.points,
      quantity: rebar.topZs.length,
    }),
    createRow({
      mark: 'T-H',
      name: '高端上部纵筋',
      spec: params.topBar,
      path: rebar.highTop.points,
      quantity: rebar.topZs.length,
    }),
    createRow({
      mark: 'D-T',
      name: '上层分布筋',
      spec: params.distributionBar,
      path: distributionPath(rebar.topDistributionStations[0], rebar.distributionZRange),
      quantity: rebar.topDistributionStations.length,
    }),
    createRow({
      mark: 'D-B',
      name: '下层分布筋',
      spec: params.distributionBar,
      path: distributionPath(rebar.bottomDistributionStations[0], rebar.distributionZRange),
      quantity: rebar.bottomDistributionStations.length,
    }),
  ];
}
