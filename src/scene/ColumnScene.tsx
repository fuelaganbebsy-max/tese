import { Canvas, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment, Line, Html } from '@react-three/drei';
import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { deriveColumn } from '../domain/kz/derive';
import type { ColumnParams } from '../domain/kz/types';
import { useColumnStore } from '../store/columnStore';
import { useSelectionStore } from '../store/selectionStore';
import { buildFreecadStirrupGeometry } from '../geometry/freecadStirrup';
import { tubeFromPolyline } from '../geometry/rebarPath';
import { stirrupHookStraight } from '../domain/codes/22G101';
import { stirrupCutShape, cutShapeFromPolyline } from '../domain/rebarShape';
import { buildColumnLongitudinal, type ColumnLayout } from '../geometry/buildColumnLongitudinal';

const BAR_LABELS = { corner: '角筋', bMid: 'b边中部筋', hMid: 'h边中部筋' } as const;
const HIGHLIGHT_COLOR = '#ffffff';

/** 柱子超出梁外侧的长度 (mm) — 下侧超出梁底面，上侧超出梁顶面 */
const COLUMN_EXTEND = 500;
/** 梁宽 (mm) */
const BEAM_WIDTH = 300;
/** 梁高 (mm) */
const BEAM_HEIGHT = 600;
/** 梁从柱边伸出长度 (mm) */
const BEAM_PROJECTION = 800;

/** 柱底 Y 坐标 */
const COL_BOTTOM = -COLUMN_EXTEND;
/** 柱顶 Y 坐标 = floors*层高 + 梁高（柱顶到屋面即止） */
const colTop = (Hn: number, floors: number) => floors * (Hn + BEAM_HEIGHT) + BEAM_HEIGHT;
/** 柱总高 */
const colTotalH = (Hn: number, floors: number) => colTop(Hn, floors) - COL_BOTTOM;
/** 柱几何中心 Y */
const colCenterY = (Hn: number, floors: number) => (colTop(Hn, floors) + COL_BOTTOM) / 2;

const BAR_COLORS = {
  corner: '#ef5350',
  bMid: '#ffa726',
  hMid: '#42a5f5',
} as const;

// ─── 柱体混凝土 ───────────────────────────────────────────
function ColumnConcrete({ params, show }: { params: ColumnParams; show: boolean }) {
  const geo = useMemo(() => {
    const floors = params.floors ?? 1;
    const totalH = colTotalH(params.Hn, floors);
    const cy = colCenterY(params.Hn, floors);
    const g = new THREE.BoxGeometry(params.b, totalH, params.h);
    g.translate(0, cy, 0);
    return g;
  }, [params.b, params.h, params.Hn, params.floors]);

  if (!show) return null;

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#8a9a9e" transparent opacity={0.18} depthWrite={false} roughness={0.95} metalness={0.05} envMapIntensity={0.3} />
    </mesh>
  );
}

/** 柱竖向布局（与场景中绘制的梁/柱伸出段一致） */
function columnLayout(Hn: number, floors: number): ColumnLayout {
  const storyH = Hn + BEAM_HEIGHT;
  return {
    botY: COL_BOTTOM,
    floorY: 0,
    topBeamBottomY: floors * storyH,
    topBeamTopY: floors * storyH + BEAM_HEIGHT,
    topY: floors * storyH + BEAM_HEIGHT,
    floorCount: floors,
    floorHeight: storyH,
  };
}

// ─── 可点选纵筋（折线管状几何，含搭接/连接/弯锚） ────────────
function ColPickableBar({
  geo, color, barKey, points, grade, diameter, label, note,
}: {
  geo: THREE.BufferGeometry; color: string; barKey: string;
  points: THREE.Vector3[]; grade: string; diameter: number; label: string; note?: string;
}) {
  const selectedKey = useSelectionStore((s) => s.selectedKey);
  const active = selectedKey === barKey;
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // 用真实中心线折线生成下料简图（保留搭接/弯锚形状）
    const shape = cutShapeFromPolyline(
      points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      { mark: label, grade, diameter, note },
    );
    useSelectionStore.getState().select(shape, barKey);
  };
  return (
    <mesh
      geometry={geo}
      renderOrder={active ? 2 : 1}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <meshStandardMaterial
        color={active ? HIGHLIGHT_COLOR : color}
        emissive={active ? HIGHLIGHT_COLOR : '#000000'}
        emissiveIntensity={active ? 0.5 : 0}
        metalness={0.7}
        roughness={0.35}
        envMapIntensity={1.2}
      />
    </mesh>
  );
}

// ─── 纵筋（连接构造 + 柱顶锚固 + 柱根插筋） ─────────────────
function ColumnLongBars({ params, derived, show }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn>; show: boolean }) {
  const floors = params.floors ?? 1;
  const result = useMemo(
    () => buildColumnLongitudinal(params, derived, columnLayout(params.Hn, floors)),
    [params, derived, floors],
  );

  if (!show) return null;
  return (
    <>
      {result.bars.map((b) => (
        <ColPickableBar
          key={b.barKey}
          geo={b.geometry}
          color={b.color}
          barKey={b.barKey}
          points={b.points}
          grade={b.meta.grade}
          diameter={b.meta.diameter}
          label={b.meta.label}
          note={b.meta.note}
        />
      ))}
      {result.markers.map((m, i) => (
        <mesh key={`conn-${i}`} geometry={m.geometry}>
          <meshStandardMaterial
            color={m.type === 'mechanical' ? '#cfd8dc' : '#ffcc80'}
            metalness={0.85}
            roughness={0.3}
            envMapIntensity={1.3}
          />
        </mesh>
      ))}
    </>
  );
}

// ─── 箍筋 (FreeCAD-Reinforcement getpointsOfStirrup 做法) ─────────
/**
 * 外箍筋 + 内部拉筋 (单肢箍)，几何位于 xy 平面 (z=法向螺旋偏移)，中心在原点。
 * 外箍筋采用 FreeCAD 算法 (135° 弯钩 + 圆角 + 法向偏移)；内肢以独立的矩形箍筋在 ColumnStirrups 中生成。
 */
function buildRectLineGeometry(params: ColumnParams) {
  const d = params.stirrup.diameter;
  // 与剖切面 SVG 一致：箍筋中心线 = 纵筋外缘 + gap + 箍筋半径
  const barR = 25 / 2;
  const svgGapPx = 2;
  const svgScale = (200 - 28) / Math.max(params.b, params.h);
  const gap = svgGapPx / svgScale;
  const barCenter = params.b / 2 - params.cover - d - gap - barR;
  const cl = barCenter + barR + gap + d / 2;
  const bentFactor = stirrupHookStraight(d) / d;

  return buildFreecadStirrupGeometry({
    width: cl * 2,
    height: cl * 2,
    diameter: d,
    bentAngle: 135,
    bentFactor,
    rounding: 2,
  });
}

/** 单根拉筋 (两端 135° 弯钩) 几何，位于 xy 平面 (z=0) */
function buildTieLeg(
  tie: { x1: number; y1: number; x2: number; y2: number },
  d: number,
  bentFactor: number,
): THREE.BufferGeometry {
  const bendR = d * 2;
  const hookLen = bentFactor * d + bendR;
  const e = hookLen / Math.SQRT2; // 135° 弯钩对角投影
  const isVertical = Math.abs(tie.x1 - tie.x2) < 1e-6;
  let pts: THREE.Vector3[];
  if (isVertical) {
    // 竖向拉筋: 端点弯钩朝截面内侧 (沿 +x) 斜伸
    const x = tie.x1;
    const yTop = Math.max(tie.y1, tie.y2);
    const yBot = Math.min(tie.y1, tie.y2);
    pts = [
      new THREE.Vector3(x + e, yTop - e, 0),
      new THREE.Vector3(x, yTop, 0),
      new THREE.Vector3(x, yBot, 0),
      new THREE.Vector3(x + e, yBot + e, 0),
    ];
  } else {
    const y = tie.y1;
    const xR = Math.max(tie.x1, tie.x2);
    const xL = Math.min(tie.x1, tie.x2);
    pts = [
      new THREE.Vector3(xR - e, y + e, 0),
      new THREE.Vector3(xR, y, 0),
      new THREE.Vector3(xL, y, 0),
      new THREE.Vector3(xL + e, y + e, 0),
    ];
  }
  return tubeFromPolyline(pts, d / 2, 14, bendR, 3);
}

/** 内部拉筋的位置 (不含外周边) */
function derivedTieLegs(params: ColumnParams) {
  const c = params.cover + params.stirrup.diameter / 2;
  const halfW = (params.b - 2 * c) / 2;
  const halfH = (params.h - 2 * c) / 2;
  const legsX = Math.max(2, Math.round(params.stirrup.legsX ?? (params.stirrup.legs === 4 ? 3 : 2)));
  const legsY = Math.max(2, Math.round(params.stirrup.legsY ?? (params.stirrup.legs === 4 ? 3 : 2)));
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < legsX - 1; i++) {
    const x = -halfW + (2 * halfW * i) / (legsX - 1);
    lines.push({ x1: x, y1: halfH, x2: x, y2: -halfH });
  }
  for (let i = 1; i < legsY - 1; i++) {
    const y = -halfH + (2 * halfH * i) / (legsY - 1);
    lines.push({ x1: -halfW, y1: y, x2: halfW, y2: y });
  }
  return lines;
}

function ColumnStirrupInstances({ geometry, ys, color, onPick, active, rotateCorners, yOffset = 0 }: { geometry: THREE.BufferGeometry | null; ys: number[]; color: string; onPick?: () => void; active?: boolean; rotateCorners?: boolean; yOffset?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    ys.forEach((y, i) => {
      dummy.position.set(0, y + yOffset, 0);
      if (rotateCorners) {
        // 基于 Y 坐标取整，使同 Y 的所有箍筋（外+内）旋转角度一致
        const cornerIdx = Math.round((y - COL_BOTTOM) / 100) % 4;
        const rotZ = (cornerIdx * Math.PI) / 2;
        dummy.rotation.set(Math.PI / 2, 0, rotZ);
      } else {
        dummy.rotation.set(Math.PI / 2, 0, 0);
      }
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [ys, rotateCorners, yOffset]);

  if (!geometry || ys.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, ys.length]}
      onClick={(e) => { e.stopPropagation(); onPick?.(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <meshStandardMaterial
        color={active ? HIGHLIGHT_COLOR : color}
        emissive={active ? HIGHLIGHT_COLOR : '#000000'}
        emissiveIntensity={active ? 0.35 : 0}
        metalness={0.65}
        roughness={0.4}
        envMapIntensity={1.0}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/** 计算沿柱全长（含伸出段/各楼层）的箍筋 Y 坐标 */
function computeFullStirrupYs(params: ColumnParams, derived: ReturnType<typeof deriveColumn>) {
  const floors = params.floors ?? 1;
  const netHn = params.Hn;          // 柱净高（= floorHeight - beamHeight）
  const hc = Math.max(params.b, params.h);
  const bh = BEAM_HEIGHT;           // 梁高（核心区高度）
  const storyH = netHn + bh;        // 层高 = 柱净高 + 梁高
  const { spacingDense, spacingSparse } = params.stirrup;
  const bottom = COL_BOTTOM;

  const dense: number[] = [];   // 柱加密区
  const sparse: number[] = [];  // 柱非加密区
  const core: number[] = [];    // 梁柱核心区（梁高范围）

  // 柱底伸出段（底部 → y=0）
  let y = bottom + spacingDense / 2;
  while (y < 0) {
    dense.push(y);
    y += spacingDense;
  }

  // 各楼层
  for (let f = 0; f < floors; f++) {
    const floorBot = f * storyH;        // 楼面标高（梁底）
    const coreTop = floorBot + bh;      // 梁顶 = 核心区顶
    const segTop = (f + 1) * storyH;    // 本层柱段顶（上层梁底）

    // 核心区（梁高范围）：梁柱节点
    y = floorBot + spacingDense / 2;
    while (y < coreTop) {
      core.push(y);
      y += spacingDense;
    }

    // 柱加密区：max(净高/6, hc, 500)
    const denseLen = Math.max(Math.ceil(netHn / 6), hc, 500);

    // 底部加密区（梁顶以上）
    y = coreTop + spacingDense / 2;
    while (y < coreTop + denseLen) {
      dense.push(y);
      y += spacingDense;
    }

    // 中部非加密区
    const topStart = segTop - denseLen;
    y = coreTop + denseLen + spacingSparse / 2;
    while (y < topStart) {
      sparse.push(y);
      y += spacingSparse;
    }

    // 顶部加密区（上层梁底以下）
    y = topStart;
    while (y < segTop) {
      dense.push(y);
      y += spacingDense;
    }
  }

  // 顶层核心区（屋面梁范围）
  y = floors * storyH + spacingDense / 2;
  const top = floors * storyH + bh;     // = colTop
  while (y < top) {
    core.push(y);
    y += spacingDense;
  }

  return {
    dense: dense.sort((a, b) => a - b),
    sparse: sparse.sort((a, b) => a - b),
    core: core.sort((a, b) => a - b),
  };
}

function ColumnStirrups({ params, derived, show }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn>; show: boolean }) {
  const floors = params.floors ?? 1;
  const unitGeo = useMemo(() => {
    return buildRectLineGeometry(params);
  }, [params.b, params.h, params.cover, params.stirrup.diameter, params.stirrup.legs, params.stirrup.legsX, params.stirrup.legsY]);

  // 内箍筋（矩形箍）几何
  const innerData = useMemo(() => {
    const result: { geo: THREE.BufferGeometry; w: number; h: number; kind: string }[] = [];
    const d = params.stirrup.diameter;
    const bentFactor = stirrupHookStraight(d) / d;
    const addInnerRect = (bars: typeof derived.barPositions, kind: string) => {
      if (bars.length < 4) return;
      const minX = Math.min(...bars.map((p) => p.x));
      const maxX = Math.max(...bars.map((p) => p.x));
      const minY = Math.min(...bars.map((p) => p.y));
      const maxY = Math.max(...bars.map((p) => p.y));
      const barR = Math.max(...bars.map((p) => p.bundle.diameter)) / 2;
      // 与剖切面 SVG 一致：2px 间隙折算为 mm
      const svgGapPx = 2;
      const svgScale = (200 - 28) / Math.max(params.b, params.h);
      const gap = svgGapPx / svgScale;
      // 箍筋中心线位置 = 纵筋外缘 + gap + 箍筋半径
      const w = 2 * (maxX + barR + gap + d / 2);
      const h = 2 * (maxY + barR + gap + d / 2);
      if (w < 10 || h < 10) return;
      result.push({
        geo: buildFreecadStirrupGeometry({ width: w, height: h, diameter: d, bentAngle: 135, bentFactor, rounding: 2 }),
        w,
        h,
        kind,
      });
    };
    addInnerRect(derived.barPositions.filter((p) => p.kind === 'bMid'), 'bMid');
    addInnerRect(derived.barPositions.filter((p) => p.kind === 'hMid'), 'hMid');
    return result;
  }, [params, derived]);

  const { dense, sparse, core } = useMemo(
    () => computeFullStirrupYs(params, derived),
    [params.Hn, params.floors, params.b, params.h, params.stirrup.spacingDense, params.stirrup.spacingSparse],
  );

  const selectedKey = useSelectionStore((s) => s.selectedKey);
  const pickStirrup = () => {
    const ds = params.stirrup.diameter;
    const width = params.b - 2 * params.cover - ds;
    const height = params.h - 2 * params.cover - ds;
    const legsX = Math.max(2, Math.round(params.stirrup.legsX ?? 2));
    const legsY = Math.max(2, Math.round(params.stirrup.legsY ?? 2));
    const shape = stirrupCutShape(width, height, stirrupHookStraight(ds), {
      mark: '柱外箍筋', grade: params.stirrup.grade, diameter: ds,
      note: `肢数 ${legsX}×${legsY}（内部拉筋另计）`,
    });
    useSelectionStore.getState().select(shape, 'col-stirrup');
  };
  const stirrupActive = selectedKey === 'col-stirrup';

  // 内箍筋点击：使用各自几何尺寸生成下料图
  const pickInner = (kind: string, w: number, h: number) => {
    const ds = params.stirrup.diameter;
    const shape = stirrupCutShape(w, h, stirrupHookStraight(ds), {
      mark: kind === 'bMid' ? '柱内箍筋(b向)' : '柱内箍筋(h向)',
      grade: params.stirrup.grade,
      diameter: ds,
      note: kind === 'bMid' ? '包b边中部筋' : '包h边中部筋',
    });
    useSelectionStore.getState().select(shape, `col-stirrup-${kind}`);
  };

  if (!show || !unitGeo) return null;

  return (
    <>
      <ColumnStirrupInstances geometry={unitGeo} ys={core} color="#26c6da" onPick={pickStirrup} active={stirrupActive} />
      <ColumnStirrupInstances geometry={unitGeo} ys={sparse} color="#78909c" onPick={pickStirrup} active={stirrupActive} />
      <ColumnStirrupInstances geometry={unitGeo} ys={dense} color="#4dd0e1" onPick={pickStirrup} active={stirrupActive} rotateCorners />
      {innerData.map((item, i) => (
        <ColumnStirrupInstances
          key={i}
          geometry={item.geo}
          ys={[...dense, ...sparse, ...core]}
          color="#546e7a"
          rotateCorners
          yOffset={0.5}
          onPick={() => pickInner(item.kind, item.w, item.h)}
          active={selectedKey === `col-stirrup-${item.kind}`}
        />
      ))}
    </>
  );
}

// ─── 框架梁 — 柱每层楼面，X 和 Z 两个方向 ───────────────
function ColumnBeams({ params }: { params: ColumnParams }) {
  const beams = useMemo(() => {
    const floors = params.floors ?? 1;
    const colHalfB = params.b / 2;
    const colHalfH = params.h / 2;
    const beamLen = BEAM_PROJECTION;
    const result: { geo: THREE.BoxGeometry; color: string }[] = [];

    function addBeam(cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string) {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(cx, cy, cz);
      result.push({ geo: g, color });
    }

    for (let f = 0; f <= floors; f++) {
      const floorY = f * (params.Hn + BEAM_HEIGHT);
      const centerY = floorY + BEAM_HEIGHT / 2;

      addBeam(-colHalfB - beamLen / 2, centerY, 0, beamLen, BEAM_HEIGHT, BEAM_WIDTH, '#8a9a6e');
      addBeam(colHalfB + beamLen / 2, centerY, 0, beamLen, BEAM_HEIGHT, BEAM_WIDTH, '#8a9a6e');
      addBeam(0, centerY, -colHalfH - beamLen / 2, BEAM_WIDTH, BEAM_HEIGHT, beamLen, '#6e9a8a');
      addBeam(0, centerY, colHalfH + beamLen / 2, BEAM_WIDTH, BEAM_HEIGHT, beamLen, '#6e9a8a');
    }

    return result;
  }, [params.b, params.h, params.Hn, params.floors]);

  return (
    <group>
      {beams.map((b, i) => (
        <mesh key={i} geometry={b.geo}>
          <meshStandardMaterial
            color={b.color}
            transparent
            opacity={0.45}
            depthWrite={false}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── 柱底轴线（1轴沿X垂直于b边，A轴沿Z垂直于h边） ──────
/** 在柱最底侧 XZ 水平面添加十字相交的轴线，1轴沿X（垂直于b边），A轴沿Z（垂直于h边） */
function ColumnAxes({ params }: { params: ColumnParams }) {
  const extent = Math.max(params.b, params.h) * 1.2;
  const y = COL_BOTTOM;
  const axisColor = '#4dd0e1';
  const labelStyle: React.CSSProperties = {
    color: '#4dd0e1',
    fontSize: '14px',
    fontWeight: 'bold',
    fontFamily: 'sans-serif',
    textShadow: '0 0 4px #000, 0 0 8px #000',
    pointerEvents: 'none',
    userSelect: 'none',
    lineHeight: '24px',
    textAlign: 'center' as const,
    width: '24px',
    height: '24px',
    border: `1.5px solid ${axisColor}`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
  };

  return (
    <group>
      {/* 1轴（沿X方向，垂直于b边）*/}
      <Line
        points={[[-extent, y, 0], [extent, y, 0]]}
        color={axisColor}
        lineWidth={1}
        dashed
        dashSize={80}
        gapSize={60}
      />
      {/* A轴（沿Z方向，垂直于h边）*/}
      <Line
        points={[[0, y, -extent], [0, y, extent]]}
        color={axisColor}
        lineWidth={1}
        dashed
        dashSize={80}
        gapSize={60}
      />
      {/* 1轴号（正X端）*/}
      <Html position={[extent + 30, y, 0]} center>
        <span style={labelStyle}>1</span>
      </Html>
      {/* A轴号（正Z端）*/}
      <Html position={[0, y, extent + 30]} center>
        <span style={labelStyle}>A</span>
      </Html>
    </group>
  );
}

// ─── 截面方向标注 b / h ────────────────────────────────────
/** 在柱底外侧标注 b / h，方便转动时区分两个边 */
function ColumnDimLabels({ params }: { params: ColumnParams }) {
  const halfB = params.b / 2;
  const halfH = params.h / 2;
  const labelY = COL_BOTTOM;
  const gap = 60;
  const style: React.CSSProperties = {
    color: '#b0bec5',
    fontSize: '32px',
    fontWeight: 'bold',
    fontFamily: 'sans-serif',
    textShadow: '0 0 8px #000, 0 0 16px #000',
    pointerEvents: 'none',
    userSelect: 'none',
  };
  return (
    <group>
      <Html position={[halfB + gap, labelY + gap * 0.5, 0]} center>
        <span style={style}>b</span>
      </Html>
      <Html position={[0, labelY + gap * 0.5, halfH + gap]} center>
        <span style={style}>h</span>
      </Html>
    </group>
  );
}

// ─── 柱剖切面 ──────────────────────────────────────────────
/** 水平剖切面，跟随 slider 位置移动 */
function ColumnSectionCutPlane({ params }: { params: ColumnParams }) {
  const view = useColumnStore((s) => s.view);
  if (!view.showSectionCut) return null;

  const floors = params.floors ?? 1;
  const totalH = colTotalH(params.Hn, floors);
  const yPos = view.sectionCutY * totalH + COL_BOTTOM;
  const planeW = params.b * 1.4;
  const planeH = params.h * 1.4;

  return (
    <group position={[0, yPos, 0]}>
      {/* Semi-transparent cutting plane */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial
          color="#00daf3"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Plane border outline */}
      <lineSegments rotation={[Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(planeW, planeH)]} />
        <lineBasicMaterial color="#00daf3" opacity={0.6} transparent />
      </lineSegments>
    </group>
  );
}

// ─── 工具 ─────────────────────────────────────────────────
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  for (const g of geos) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    const idx = g.getIndex();
    if (idx) {
      const arr = idx.array;
      for (let i = 0; i < arr.length; i++) {
        indices.push(arr[i] + offset);
      }
    }
    offset += pos.count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices.length > 0) merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

function CameraController({ center, camDist }: { center: [number, number, number]; camDist: number }) {
  const { camera } = useThree();
  const cmd = useColumnStore((s) => s.cameraCommand);
  const clearCmd = useColumnStore((s) => s.setCameraCommand);

  useEffect(() => {
    if (!cmd) return;
    const target = new THREE.Vector3(...center);
    const pos = cmd === 'top'
      ? new THREE.Vector3(center[0], camDist * 1.15, center[2])
      : new THREE.Vector3(camDist * 0.5, center[1] * 1.2, camDist * 0.5);
    const startPos = camera.position.clone();
    const duration = 600;
    const startTime = performance.now();
    const animate = (time: number) => {
      const t = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startPos, pos, ease);
      camera.lookAt(target);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    clearCmd(null);
  }, [cmd, camera, center, camDist, clearCmd]);

  return null;
}

// ─── 入口 ─────────────────────────────────────────────────
export function ColumnScene() {
  const params = useColumnStore((s) => s.params);
  const view = useColumnStore((s) => s.view);
  const floors = params.floors ?? 1;
  const derived = useMemo(() => deriveColumn(params), [params]);

  // 参数/构件变化时清除选中，避免陈旧下料标注
  useEffect(() => {
    useSelectionStore.getState().clear();
  }, [params]);

  const totalH = colTotalH(params.Hn, floors);
  const cy = colCenterY(params.Hn, floors);
  const camDist = Math.max(totalH * 1.5, 4000);
  const center: [number, number, number] = [0, cy, 0];

  return (
    <Canvas
      camera={{ position: [camDist * 0.5, cy * 1.1, camDist * 0.5], fov: 35, near: 1, far: camDist * 5 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      className="w-full h-full"
      onPointerMissed={() => useSelectionStore.getState().clear()}
    >
      <color attach="background" args={["#121212"]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={["#7dd3fc", "#1e293b", 0.6]} />
      <directionalLight position={[camDist, totalH * 1.5, camDist * 0.5]} intensity={1.2} color="#e0f2fe" />
      <directionalLight position={[-camDist * 0.3, cy, -camDist * 0.3]} intensity={0.4} color="#94a3b8" />
      <Environment preset="city" background={false} />

      <ColumnBeams params={params} />
      <ColumnConcrete params={params} show={view.showConcrete} />
      <ColumnLongBars params={params} derived={derived} show={view.showLongitudinal} />
      <ColumnStirrups params={params} derived={derived} show={view.showStirrups} />
      <ColumnAxes params={params} />
      <ColumnDimLabels params={params} />
      <ColumnSectionCutPlane params={params} />

      <Grid
        position={[0, 0, 0]}
        cellSize={500}
        cellColor="#1e2a2c"
        sectionSize={2000}
        sectionColor="#3b494c"
        infiniteGrid
        fadeDistance={camDist}
        fadeStrength={1.5}
      />

      <CameraController center={center} camDist={camDist} />
      <OrbitControls target={center} makeDefault enableDamping dampingFactor={0.1} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
