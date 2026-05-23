import { useMemo } from 'react';
import { Text, Line } from '@react-three/drei';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';

/**
 * Dimension line with 45° oblique tick marks at both ends,
 * following Chinese architectural drawing standards (建筑制图标准 / 22G101).
 *
 *   ──────│──────────│──────
 *         ^          ^
 *      45° tick    45° tick
 *         label (above or below the line)
 */
function DimensionLine({
  start,
  end,
  y,
  z,
  color = '#ffffff',
  tickSize = 28,
  label,
  labelAbove = true,
  labelOffset = 36,
  fontSize = 36,
  anchorX = 'center',
}: {
  start: number;
  end: number;
  y: number;
  z: number;
  color?: string;
  tickSize?: number;
  label: string;
  labelAbove?: boolean;
  labelOffset?: number;
  fontSize?: number;
  anchorX?: 'center' | 'left' | 'right';
}) {
  const midX = (start + end) / 2;
  const halfTick = tickSize / 2;
  const quadTick = tickSize / 4; // 45° oblique tick length (projected)
  const labelY = y + (labelAbove ? labelOffset : -labelOffset);

  return (
    <group>
      {/* Main dimension line — thin solid line */}
      <Line
        points={[[start, y, z], [end, y, z]]}
        color={color}
        lineWidth={1.5}
      />
      {/* Left end — vertical stroke (竖向起止符号) */}
      <Line
        points={[[start, y - halfTick, z], [start, y + halfTick, z]]}
        color={color}
        lineWidth={2}
      />
      {/* Left end — 45° oblique tick (45° 起止斜线), ↘ direction */}
      <Line
        points={[[start - quadTick, y + quadTick, z], [start + quadTick, y - quadTick, z]]}
        color={color}
        lineWidth={2.5}
      />
      {/* Right end — vertical stroke (竖向起止符号) */}
      <Line
        points={[[end, y - halfTick, z], [end, y + halfTick, z]]}
        color={color}
        lineWidth={2}
      />
      {/* Right end — 45° oblique tick (45° 起止斜线), ↘ direction */}
      <Line
        points={[[end - quadTick, y + quadTick, z], [end + quadTick, y - quadTick, z]]}
        color={color}
        lineWidth={2.5}
      />
      {/* Label */}
      <Text
        position={[midX, labelY, z]}
        fontSize={fontSize}
        color={color}
        anchorX={anchorX}
        anchorY="middle"
        outlineWidth={0}
        fillOpacity={1}
      >
        {label}
      </Text>
    </group>
  );
}

export function BeamAnnotations() {
  const params = useBeamStore((s) => s.params);
  const view = useBeamStore((s) => s.view);
  const d = useMemo(() => derive(params), [params]);

  const showTopLeft = view.showAnnotationTopLeft;
  const showTopRight = view.showAnnotationTopRight;
  const showStirrup = view.showAnnotationStirrup;
  const showNetSpan = view.showAnnotationNetSpan;

  if (!showTopLeft && !showTopRight && !showStirrup && !showNetSpan) return null;

  // Y positions for dimension lines (beam bottom ~ Y=0, top ~ Y=h)
  // Negative reinforcement sits above the beam top
  const negLineY = params.h + 120;     // dimension line Y for 负筋
  // Stirrup densification zone below beam bottom
  const denseLineY = -160;               // dimension line Y for 加密区
  // Net span further below
  const netSpanLineY = -360;            // dimension line Y for 净跨
  const zOffset = 0;                    // center of beam width

  return (
    <group>
      {d.spans.map((sp, i) => {
        const s = params.spans[i];
        const ext = d.topSupportExtend[i];
        const denseLen = d.densifiedZoneLen;

        const elements: React.ReactNode[] = [];

        // ── Left support negative reinforcement dimension ──
        if (showTopLeft && s.topLeftSupport && ext.left > 0) {
          elements.push(
            <DimensionLine
              key={`topL-${i}`}
              start={sp.x0}
              end={sp.x0 + ext.left}
              y={negLineY}
              z={zOffset}
              color="#ab47bc"
              tickSize={56}
              label={`左支座 负筋伸入 ln/3 = ${ext.left.toFixed(0)}`}
              labelAbove={true}
              labelOffset={80}
              fontSize={114}
            />,
          );
        }

        // ── Right support negative reinforcement dimension ──
        if (showTopRight && s.topRightSupport && ext.right > 0) {
          elements.push(
            <DimensionLine
              key={`topR-${i}`}
              start={sp.x1 - ext.right}
              end={sp.x1}
              y={negLineY}
              z={zOffset}
              color="#ab47bc"
              tickSize={56}
              label={`右支座 负筋伸入 ln/3 = ${ext.right.toFixed(0)}`}
              labelAbove={true}
              labelOffset={80}
              fontSize={114}
            />,
          );
        }

        // ── Stirrup densification zone dimension ──
        if (showStirrup && denseLen > 0) {
          // Left dense zone
          elements.push(
            <DimensionLine
              key={`denseL-${i}`}
              start={sp.x0}
              end={sp.x0 + denseLen}
              y={denseLineY}
              z={zOffset}
              color="#78909c"
              tickSize={48}
              label={`加密区 ${denseLen.toFixed(0)}`}
              labelAbove={false}
              labelOffset={68}
              fontSize={102}
            />,
          );

          // Right dense zone (skip if span too short — labels would overlap)
          if (denseLen * 2 < sp.x1 - sp.x0) {
            elements.push(
              <DimensionLine
                key={`denseR-${i}`}
                start={sp.x1 - denseLen}
                end={sp.x1}
                y={denseLineY}
                z={zOffset}
                color="#78909c"
                tickSize={48}
                label={`加密区 ${denseLen.toFixed(0)}`}
                labelAbove={false}
                labelOffset={68}
                fontSize={102}
              />,
            );
          }
        }

        // ── Net span dimension (净跨) ──
        if (showNetSpan) {
          const netLength = sp.x1 - sp.x0;
          elements.push(
            <DimensionLine
              key={`netSpan-${i}`}
              start={sp.x0}
              end={sp.x1}
              y={netSpanLineY}
              z={zOffset}
              color="#00bfff"
              tickSize={56}
              label={`净跨 ${netLength.toFixed(0)}`}
              labelAbove={false}
              labelOffset={76}
              fontSize={156}
            />,
          );
        }

        return elements;
      })}
    </group>
  );
}
