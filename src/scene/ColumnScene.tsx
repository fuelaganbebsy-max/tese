import { Canvas, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment, Line } from '@react-three/drei';
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
/** 柱顶 Y 坐标 = floors*Hn + 梁高（柱顶到屋面即止，无伸出） */
const colTop = (Hn: number, floors: number) => floors * Hn + BEAM_HEIGHT;
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
  return {
    botY: COL_BOTTOM,
    floorY: 0,
    topBeamBottomY: floors * Hn,
    topBeamTopY: floors * Hn + BEAM_HEIGHT,
    topY: floors * Hn + BEAM_HEIGHT,
    floorCount: floors,
    floorHeight: Hn,
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
 * 外箍筋采用 FreeCAD 算法 (135° 弯钩 + 圆角 + 法向偏移)；内肢以带 135° 弯钩的拉筋表示。
 */
function buildRectLineGeometry(params: ColumnParams) {
  const c = params.cover + params.stirrup.diameter / 2;
  const halfW = (params.b - 2 * c) / 2;
  const halfH = (params.h - 2 * c) / 2;
  const d = params.stirrup.diameter;
  const bentFactor = stirrupHookStraight(d) / d;

  const geos: THREE.BufferGeometry[] = [];

  // 外箍筋 (中心线尺寸 = 2·half)
  geos.push(
    buildFreecadStirrupGeometry({
      width: halfW * 2,
      height: halfH * 2,
      diameter: d,
      bentAngle: 135,
      bentFactor,
      rounding: 2,
    }),
  );

  // 内部拉筋
  for (const tie of derivedTieLegs(params)) {
    geos.push(buildTieLeg(tie, d, bentFactor));
  }

  return mergeGeometries(geos);
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

function ColumnStirrupInstances({ geometry, ys, color, onPick, active }: { geometry: THREE.BufferGeometry | null; ys: number[]; color: string; onPick?: () => void; active?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    ys.forEach((y, i) => {
      // ys are already world Y coordinates
      dummy.position.set(0, y, 0);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [ys]);

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
      />
    </instancedMesh>
  );
}

/** 计算沿柱全长（含伸出段）的箍筋 Y 坐标 */
function computeFullStirrupYs(params: ColumnParams, derived: ReturnType<typeof deriveColumn>) {
  const floors = params.floors ?? 1;
  const { spacingDense } = params.stirrup;
  const bottom = COL_BOTTOM;
  const top = colTop(params.Hn, floors);

  // 柱底伸出段（底部 → y=0）
  const extraBelow: number[] = [];
  let y = bottom + spacingDense / 2;
  while (y < 0) {
    extraBelow.push(y);
    y += spacingDense;
  }

  // 柱顶伸出段（y=楼层顶 → 柱顶）
  const extraAbove: number[] = [];
  y = floors * params.Hn + spacingDense;
  while (y < top) {
    extraAbove.push(y);
    y += spacingDense;
  }

  return {
    dense: [...extraBelow, ...derived.denseStirrupYs, ...extraAbove],
    sparse: derived.sparseStirrupYs,
  };
}

function ColumnStirrups({ params, derived, show }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn>; show: boolean }) {
  const floors = params.floors ?? 1;
  const unitGeo = useMemo(() => {
    return buildRectLineGeometry(params);
  }, [params.b, params.h, params.cover, params.stirrup.diameter, params.stirrup.legs, params.stirrup.legsX, params.stirrup.legsY]);

  const { dense, sparse } = useMemo(
    () => computeFullStirrupYs(params, derived),
    [params.Hn, params.floors, params.stirrup.spacingDense, derived.denseStirrupYs, derived.sparseStirrupYs],
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

  if (!show || !unitGeo) return null;

  return (
    <>
      <ColumnStirrupInstances geometry={unitGeo} ys={sparse} color="#78909c" onPick={pickStirrup} active={stirrupActive} />
      <ColumnStirrupInstances geometry={unitGeo} ys={dense} color="#26c6da" onPick={pickStirrup} active={stirrupActive} />
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
      const floorY = f * params.Hn;
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

// ─── 轴线 ─────────────────────────────────────────────────
/** 底层柱两个方向中心的参考轴线，上层截面变化时提供位置参照 */
function ColumnAxes({ params }: { params: ColumnParams }) {
  const Hn = params.Hn;
  const halfB = params.b / 2;
  const halfH = params.h / 2;
  const ext = 250;
  const axColor = '#4dd0e1';

  type Seg = { key: string; pts: [[number, number, number], [number, number, number]] };
  const segments: Seg[] = [
    // 底层底部 (y=0) 的十字
    { key: 'b0', pts: [[-halfB - ext, 0, 0], [halfB + ext, 0, 0]] },
    { key: 'h0', pts: [[0, 0, -halfH - ext], [0, 0, halfH + ext]] },
    // 底层顶部 (y=Hn) 的十字
    { key: 'b1', pts: [[-halfB - ext, Hn, 0], [halfB + ext, Hn, 0]] },
    { key: 'h1', pts: [[0, Hn, -halfH - ext], [0, Hn, halfH + ext]] },
    // 四根竖向连接线
    { key: 'v1', pts: [[-halfB - ext, 0, 0], [-halfB - ext, Hn, 0]] },
    { key: 'v2', pts: [[halfB + ext, 0, 0], [halfB + ext, Hn, 0]] },
    { key: 'v3', pts: [[0, 0, -halfH - ext], [0, Hn, -halfH - ext]] },
    { key: 'v4', pts: [[0, 0, halfH + ext], [0, Hn, halfH + ext]] },
  ];

  return (
    <group>
      {segments.map((seg) => (
        <Line
          key={seg.key}
          points={seg.pts}
          color={axColor}
          lineWidth={1}
          dashed
          dashSize={5}
          gapSize={4}
        />
      ))}
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
