// AT 型板式楼梯配筋 Three.js 适配器（22G101-2 第 2-8 页）

import * as THREE from 'three';
import type { StairParams, StairRebarSpec } from '../domain/at/types';
import {
  deriveStairRebarLayout,
  type StairPoint2,
  type StairDistributionStation,
} from '../domain/at/rebarLayout';
import { tubeFromPolyline } from './rebarPath';

export type StairBarGroup =
  | 'bottom'
  | 'top-low'
  | 'top-high'
  | 'distribution-top'
  | 'distribution-bottom';

export interface StairBarResult {
  geometry: THREE.BufferGeometry;
  points: THREE.Vector3[];
  group: StairBarGroup;
  meta: {
    label: string;
    length: number;
    diameter: number;
    grade: string;
    kind: 'bottom' | 'top' | 'distribution';
    note?: string;
  };
  barKey: string;
  color: string;
}

export interface StairRebarResult {
  bars: StairBarResult[];
}

const BAR_COLORS = {
  bottom: '#facc15',
  top: '#fb7185',
  distribution: '#3b82f6',
} as const;

interface BarInput {
  points: THREE.Vector3[];
  group: StairBarGroup;
  spec: StairRebarSpec;
  kind: StairBarResult['meta']['kind'];
  label: string;
  note: string;
  barKey: string;
  color: string;
  radialSegments: number;
}

function pathAtZ(path: StairPoint2[], z: number): THREE.Vector3[] {
  return path.map((point) => new THREE.Vector3(point.x, point.y, z));
}

function distributionPath(
  station: StairDistributionStation,
  zRange: [number, number],
): THREE.Vector3[] {
  return [
    new THREE.Vector3(station.x, station.y, zRange[0]),
    new THREE.Vector3(station.x, station.y, zRange[1]),
  ];
}

function polylineLength(points: THREE.Vector3[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += points[index].distanceTo(points[index - 1]);
  }
  return length;
}

function buildBar(input: BarInput): StairBarResult {
  return {
    geometry: tubeFromPolyline(input.points, input.spec.diameter / 2, input.radialSegments),
    points: input.points,
    group: input.group,
    meta: {
      label: input.label,
      length: Math.round(polylineLength(input.points)),
      diameter: input.spec.diameter,
      grade: input.spec.grade,
      kind: input.kind,
      note: input.note,
    },
    barKey: input.barKey,
    color: input.color,
  };
}

/** 构建 AT 楼梯全部配筋；领域层负责路径和站位，本层只生成 Vector3 与管状几何。 */
export function buildStairRebar(params: StairParams): StairRebarResult {
  const layout = deriveStairRebarLayout(params);
  const bars: StairBarResult[] = [];

  layout.bottomZs.forEach((z, index) => {
    bars.push(buildBar({
      points: pathAtZ(layout.bottom.points, z),
      group: 'bottom',
      spec: params.bottomBar,
      kind: 'bottom',
      label: `AT梯板下部纵筋 #${index + 1}`,
      note: '按第2-8页下部纵筋路径布置',
      barKey: `stair-bottom-${index}`,
      color: BAR_COLORS.bottom,
      radialSegments: 8,
    }));
  });

  layout.topZs.forEach((z, index) => {
    bars.push(buildBar({
      points: pathAtZ(layout.lowTop.points, z),
      group: 'top-low',
      spec: params.topBar,
      kind: 'top',
      label: `AT梯板上部纵筋(低端) #${index + 1}`,
      note: '按第2-8页低端上部纵筋路径布置',
      barKey: `stair-top-low-${index}`,
      color: BAR_COLORS.top,
      radialSegments: 8,
    }));
    bars.push(buildBar({
      points: pathAtZ(layout.highTop.points, z),
      group: 'top-high',
      spec: params.topBar,
      kind: 'top',
      label: `AT梯板上部纵筋(高端) #${index + 1}`,
      note: '按第2-8页高端上部纵筋路径布置',
      barKey: `stair-top-high-${index}`,
      color: BAR_COLORS.top,
      radialSegments: 8,
    }));
  });

  layout.bottomDistributionStations.forEach((station, index) => {
    bars.push(buildBar({
      points: distributionPath(station, layout.distributionZRange),
      group: 'distribution-bottom',
      spec: params.distributionBar,
      kind: 'distribution',
      label: `AT梯板下层分布筋 #${index + 1}`,
      note: '按领域层下部分布筋站点布置',
      barKey: `stair-dist-bottom-${index}`,
      color: BAR_COLORS.distribution,
      radialSegments: 6,
    }));
  });

  layout.topDistributionStations.forEach((station, index) => {
    bars.push(buildBar({
      points: distributionPath(station, layout.distributionZRange),
      group: 'distribution-top',
      spec: params.distributionBar,
      kind: 'distribution',
      label: `AT梯板上层分布筋 #${index + 1}`,
      note: '按领域层上部分布筋站点布置',
      barKey: `stair-dist-top-${index}`,
      color: BAR_COLORS.distribution,
      radialSegments: 6,
    }));
  });

  return { bars };
}
