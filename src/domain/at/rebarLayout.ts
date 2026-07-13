import type { StairParams } from './types';
import { deriveStair, type StairLayout } from './derive';

export interface StairPoint2 {
  x: number;
  y: number;
}

export interface StairPolyline2 {
  points: StairPoint2[];
}

export interface StairBottomPath extends StairPolyline2 {
  lowSupportBottom: StairPoint2;
  lowSupportTop: StairPoint2;
  highSupportTop: StairPoint2;
  highSupportBottom: StairPoint2;
}

export interface StairTopPath extends StairPolyline2 {
  spanEnd: StairPoint2;
  spanHook: StairPoint2;
  supportTop: StairPoint2;
  supportBottom: StairPoint2;
}

export interface StairDistributionStation extends StairPoint2 {
  s: number;
}

export interface StairRebarLayout {
  layout: StairLayout;
  offsets: ReturnType<typeof deriveStair>['rebarOffsets'];
  bottom: StairBottomPath;
  lowTop: StairTopPath;
  highTop: StairTopPath;
  bottomZs: number[];
  topZs: number[];
  topDistributionStations: StairDistributionStation[];
  bottomDistributionStations: StairDistributionStation[];
  distributionZRange: [number, number];
}

function pointAtX(layout: StairLayout, x: number, inwardOffset: number): StairPoint2 {
  const pitch = layout.concretePitch;
  return {
    x,
    y: Math.tan(pitch.angle) * x - inwardOffset / Math.cos(pitch.angle),
  };
}

function positionsBetween(count: number, start: number, end: number): number[] {
  if (count <= 1) return [(start + end) / 2];
  const spacing = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + index * spacing);
}

function stationAtS(layout: StairLayout, s: number, inwardOffset: number): StairDistributionStation {
  const pitch = layout.concretePitch;
  return {
    s,
    x: s * pitch.dir.x + inwardOffset * pitch.normal.x,
    y: s * pitch.dir.y + inwardOffset * pitch.normal.y,
  };
}

function dedupeStations(stations: StairDistributionStation[], eps = 1): StairDistributionStation[] {
  return stations
    .sort((a, b) => a.s - b.s)
    .filter((station, index, arr) => index === 0 || Math.abs(station.s - arr[index - 1].s) > eps);
}

function adjustTopDistributionForHook(
  stations: StairDistributionStation[],
  layout: StairLayout,
  spanEndX: number,
  supportX: number,
  topDistributionOffset: number,
  delta: number,
  tolerance: number,
): StairDistributionStation[] {
  const direction = supportX > spanEndX ? 1 : -1;
  const desiredX = spanEndX + direction * delta;
  const point = pointAtX(layout, desiredX, topDistributionOffset);
  const pitch = layout.concretePitch;
  const s = (point.x - topDistributionOffset * pitch.normal.x) / pitch.dir.x;
  const newStation: StairDistributionStation = { s, x: point.x, y: point.y };

  const overlapIndex = stations.findIndex((st) => Math.abs(st.x - spanEndX) <= tolerance);
  if (overlapIndex >= 0) {
    const result = [...stations];
    result[overlapIndex] = newStation;
    return result;
  }
  return [...stations, newStation];
}

export function deriveStairRebarLayout(params: StairParams): StairRebarLayout {
  const derived = deriveStair(params);
  const { layout, rebarOffsets } = derived;
  const topHook = 15 * params.topBar.diameter;

  const lowSupportTop = pointAtX(
    layout,
    layout.lowBeamCenterX,
    rebarOffsets.bottomLongitudinal,
  );
  const highSupportTop = pointAtX(
    layout,
    layout.highBeamCenterX,
    rebarOffsets.bottomLongitudinal,
  );
  const bottom: StairBottomPath = {
    lowSupportBottom: lowSupportTop,
    lowSupportTop,
    highSupportTop,
    highSupportBottom: highSupportTop,
    points: [lowSupportTop, highSupportTop],
  };

  const topBarCover = params.cover + params.topBar.diameter / 2;
  const lowTopSupportTop = pointAtX(layout, -params.lowBeam.width + topBarCover, rebarOffsets.topLongitudinal);
  const lowTopSupportBottom = { x: lowTopSupportTop.x, y: lowTopSupportTop.y - topHook };
  const lowTopSpanEnd = pointAtX(layout, derived.topExtend, rebarOffsets.topLongitudinal);
  const spanHookLength = Math.max(
    0,
    rebarOffsets.bottomLongitudinal - rebarOffsets.topLongitudinal - (params.topBar.diameter + params.bottomBar.diameter) / 2,
  );
  const lowTopSpanHook = {
    x: lowTopSpanEnd.x + spanHookLength * layout.concretePitch.normal.x,
    y: lowTopSpanEnd.y + spanHookLength * layout.concretePitch.normal.y,
  };
  const lowTop: StairTopPath = {
    spanEnd: lowTopSpanEnd,
    spanHook: lowTopSpanHook,
    supportTop: lowTopSupportTop,
    supportBottom: lowTopSupportBottom,
    points: [lowTopSupportBottom, lowTopSupportTop, lowTopSpanEnd, lowTopSpanHook],
  };

  const highTopSupportTop = pointAtX(layout, params.ln + params.highBeam.width - topBarCover, rebarOffsets.topLongitudinal);
  const highTopSupportBottom = { x: highTopSupportTop.x, y: highTopSupportTop.y - topHook };
  const highTopSpanEnd = pointAtX(layout, params.ln - derived.topExtend, rebarOffsets.topLongitudinal);
  const highTopSpanHook = {
    x: highTopSpanEnd.x + spanHookLength * layout.concretePitch.normal.x,
    y: highTopSpanEnd.y + spanHookLength * layout.concretePitch.normal.y,
  };
  const highTop: StairTopPath = {
    spanEnd: highTopSpanEnd,
    spanHook: highTopSpanHook,
    supportTop: highTopSupportTop,
    supportBottom: highTopSupportBottom,
    points: [highTopSpanHook, highTopSpanEnd, highTopSupportTop, highTopSupportBottom],
  };

  const bottomWidthEdge = params.cover + params.bottomBar.diameter / 2;
  const topWidthEdge = params.cover + params.topBar.diameter / 2;
  const distributionEdge = params.cover + params.distributionBar.diameter / 2;
  const bottomZs = positionsBetween(
    derived.bottomBarCount,
    -params.b / 2 + bottomWidthEdge,
    params.b / 2 - bottomWidthEdge,
  );
  const topZs = positionsBetween(
    derived.topBarCount,
    -params.b / 2 + topWidthEdge,
    params.b / 2 - topWidthEdge,
  );
  const stationSs = positionsBetween(
    derived.distributionBarCount,
    distributionEdge,
    layout.concretePitch.slantLength - distributionEdge,
  );
  const lowTopXRange = [Math.min(lowTop.supportTop.x, lowTop.spanEnd.x), Math.max(lowTop.supportTop.x, lowTop.spanEnd.x)] as const;
  const highTopXRange = [Math.min(highTop.spanEnd.x, highTop.supportTop.x), Math.max(highTop.spanEnd.x, highTop.supportTop.x)] as const;
  const topDistributionSpacing = derived.distributionBarCount > 1
    ? (layout.concretePitch.slantLength - 2 * distributionEdge) / (derived.distributionBarCount - 1)
    : 0;
  const hookDelta = Math.max(params.distributionBar.diameter * 3, 30);
  const hookTolerance = topDistributionSpacing / 2;

  let topDistributionStations = stationSs
    .map((s) => stationAtS(layout, s, rebarOffsets.topDistribution))
    .filter((station) => {
      const x = station.x;
      return (x >= lowTopXRange[0] && x <= lowTopXRange[1]) || (x >= highTopXRange[0] && x <= highTopXRange[1]);
    });
  topDistributionStations = adjustTopDistributionForHook(
    topDistributionStations,
    layout,
    lowTop.spanEnd.x,
    lowTop.supportTop.x,
    rebarOffsets.topDistribution,
    hookDelta,
    hookTolerance,
  );
  topDistributionStations = adjustTopDistributionForHook(
    topDistributionStations,
    layout,
    highTop.spanEnd.x,
    highTop.supportTop.x,
    rebarOffsets.topDistribution,
    hookDelta,
    hookTolerance,
  );
  topDistributionStations = dedupeStations(topDistributionStations);
  const bottomDistributionStations = stationSs.map((s) => stationAtS(layout, s, rebarOffsets.bottomDistribution));
  const distributionZRange: [number, number] = [
    -params.b / 2 + distributionEdge,
    params.b / 2 - distributionEdge,
  ];

  return {
    layout,
    offsets: rebarOffsets,
    bottom,
    lowTop,
    highTop,
    bottomZs,
    topZs,
    topDistributionStations,
    bottomDistributionStations,
    distributionZRange,
  };
}
