import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment } from '@react-three/drei';
import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { deriveColumn } from '../domain/kz/derive';
import type { ColumnParams } from '../domain/kz/types';
import { useColumnStore } from '../store/columnStore';
import { buildFreecadStirrupGeometry } from '../geometry/freecadStirrup';
import { tubeFromPolyline } from '../geometry/rebarPath';
import { stirrupHookStraight } from '../domain/codes/22G101';

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
/** 柱顶 Y 坐标 = Hn + 梁高 + 上侧伸出 */
const colTop = (Hn: number) => Hn + BEAM_HEIGHT + COLUMN_EXTEND;
/** 柱总高 */
const colTotalH = (Hn: number) => colTop(Hn) - COL_BOTTOM;
/** 柱几何中心 Y */
const colCenterY = (Hn: number) => (colTop(Hn) + COL_BOTTOM) / 2;

const BAR_COLORS = {
  corner: '#ef5350',
  bMid: '#ffa726',
  hMid: '#42a5f5',
} as const;

// ─── 柱体混凝土 ───────────────────────────────────────────
function ColumnConcrete({ params, show }: { params: ColumnParams; show: boolean }) {
  const geo = useMemo(() => {
    const totalH = colTotalH(params.Hn);
    const cy = colCenterY(params.Hn);
    if (params.sectionType === 'circle') {
      const g = new THREE.CylinderGeometry(params.D / 2, params.D / 2, totalH, 32);
      g.translate(0, cy, 0);
      return g;
    }
    const g = new THREE.BoxGeometry(params.b, totalH, params.h);
    g.translate(0, cy, 0);
    return g;
  }, [params.sectionType, params.b, params.h, params.D, params.Hn]);

  if (!show) return null;

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#8a9a9e" transparent opacity={0.18} depthWrite={false} roughness={0.95} metalness={0.05} envMapIntensity={0.3} />
    </mesh>
  );
}

// ─── 纵筋（全长） ─────────────────────────────────────────
function ColumnLongBars({ params, derived, show }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn>; show: boolean }) {
  const bars = useMemo(() => {
    const totalL = colTotalH(params.Hn);
    const cy = colCenterY(params.Hn);
    return derived.barPositions.map((pos, i) => {
      const r = pos.bundle.diameter / 2;
      const geo = new THREE.CylinderGeometry(r, r, totalL, 8);
      geo.translate(pos.x, cy, pos.y);
      return <mesh key={i} geometry={geo}>
        <meshStandardMaterial color={BAR_COLORS[pos.kind]} metalness={0.7} roughness={0.35} envMapIntensity={1.2} />
      </mesh>;
    });
  }, [derived.barPositions, params.Hn]);

  if (!show) return null;
  return <>{bars}</>;
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

function ColumnStirrupInstances({ geometry, ys, color }: { geometry: THREE.BufferGeometry | null; ys: number[]; color: string }) {
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
    <instancedMesh ref={ref} args={[geometry, undefined, ys.length]}>
      <meshStandardMaterial color={color} metalness={0.65} roughness={0.4} envMapIntensity={1.0} />
    </instancedMesh>
  );
}

/** 计算沿柱全长（含伸出段）的箍筋 Y 坐标 */
function computeFullStirrupYs(params: ColumnParams, derived: ReturnType<typeof deriveColumn>) {
  const { spacingDense } = params.stirrup;
  const bottom = COL_BOTTOM;
  const top = colTop(params.Hn);

  // 柱底伸出段（底部 → y=0）
  const extraBelow: number[] = [];
  let y = bottom + spacingDense / 2;
  while (y < 0) {
    extraBelow.push(y);
    y += spacingDense;
  }

  // 柱顶伸出段（y=Hn → 顶部）
  const extraAbove: number[] = [];
  y = params.Hn + spacingDense;
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
  const unitGeo = useMemo(() => {
    const c = params.cover + params.stirrup.diameter / 2;
    const r = params.stirrup.diameter / 2;

    if (params.sectionType === 'circle') {
      const outerR = params.D / 2 - c;
      return new THREE.TorusGeometry(outerR, r, 8, 32);
    }

    return buildRectLineGeometry(params);
  }, [params.sectionType, params.b, params.h, params.D, params.cover, params.stirrup.diameter, params.stirrup.legs, params.stirrup.legsX, params.stirrup.legsY]);

  const { dense, sparse } = useMemo(
    () => computeFullStirrupYs(params, derived),
    [params.Hn, params.stirrup.spacingDense, derived.denseStirrupYs, derived.sparseStirrupYs],
  );

  if (!show || !unitGeo) return null;

  return (
    <>
      <ColumnStirrupInstances geometry={unitGeo} ys={sparse} color="#78909c" />
      <ColumnStirrupInstances geometry={unitGeo} ys={dense} color="#26c6da" />
    </>
  );
}

// ─── 框架梁 — 柱上下两端，X 和 Z 两个方向 ───────────────
function ColumnBeams({ params }: { params: ColumnParams }) {
  const beams = useMemo(() => {
    const colHalfB = params.b / 2;
    const colHalfH = params.h / 2;
    const beamLen = BEAM_PROJECTION;
    const result: { geo: THREE.BoxGeometry; color: string }[] = [];

    function addBeam(cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string) {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(cx, cy, cz);
      result.push({ geo: g, color });
    }

    // 底部 (y=0): 梁底面在 y=0，向上 BEAM_HEIGHT
    const bottomCenterY = BEAM_HEIGHT / 2;

    addBeam(-colHalfB - beamLen / 2, bottomCenterY, 0, beamLen, BEAM_HEIGHT, BEAM_WIDTH, '#8a9a6e');
    addBeam(colHalfB + beamLen / 2, bottomCenterY, 0, beamLen, BEAM_HEIGHT, BEAM_WIDTH, '#8a9a6e');
    addBeam(0, bottomCenterY, -colHalfH - beamLen / 2, BEAM_WIDTH, BEAM_HEIGHT, beamLen, '#6e9a8a');
    addBeam(0, bottomCenterY, colHalfH + beamLen / 2, BEAM_WIDTH, BEAM_HEIGHT, beamLen, '#6e9a8a');

    // 顶部 (y=Hn): 梁底面在 y=Hn，向上 BEAM_HEIGHT
    const topCenterY = params.Hn + BEAM_HEIGHT / 2;

    addBeam(-colHalfB - beamLen / 2, topCenterY, 0, beamLen, BEAM_HEIGHT, BEAM_WIDTH, '#8a9a6e');
    addBeam(colHalfB + beamLen / 2, topCenterY, 0, beamLen, BEAM_HEIGHT, BEAM_WIDTH, '#8a9a6e');
    addBeam(0, topCenterY, -colHalfH - beamLen / 2, BEAM_WIDTH, BEAM_HEIGHT, beamLen, '#6e9a8a');
    addBeam(0, topCenterY, colHalfH + beamLen / 2, BEAM_WIDTH, BEAM_HEIGHT, beamLen, '#6e9a8a');

    return result;
  }, [params.b, params.h, params.Hn]);

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
  const derived = useMemo(() => deriveColumn(params), [params]);

  const totalH = colTotalH(params.Hn);
  const cy = colCenterY(params.Hn);
  const camDist = Math.max(totalH * 1.5, 4000);
  const center: [number, number, number] = [0, cy, 0];

  return (
    <Canvas
      camera={{ position: [camDist * 0.5, cy * 1.1, camDist * 0.5], fov: 35, near: 1, far: camDist * 5 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      className="w-full h-full"
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
