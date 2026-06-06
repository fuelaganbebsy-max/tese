import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment } from '@react-three/drei';
import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { deriveColumn } from '../domain/kz/derive';
import type { ColumnParams } from '../domain/kz/types';
import { useColumnStore } from '../store/columnStore';

const BAR_COLORS = {
  corner: '#ef5350',
  bMid: '#ffa726',
  hMid: '#42a5f5',
} as const;

// 柱体混凝土
function ColumnConcrete({ params, derived, show }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn>; show: boolean }) {
  const geo = useMemo(() => {
    if (params.sectionType === 'circle') {
      const g = new THREE.CylinderGeometry(params.D / 2, params.D / 2, params.Hn, 32);
      g.translate(0, params.Hn / 2, 0);
      return g;
    }
    const g = new THREE.BoxGeometry(params.b, params.Hn, params.h);
    g.translate(0, params.Hn / 2, 0);
    return g;
  }, [params.sectionType, params.b, params.h, params.D, params.Hn]);

  if (!show) return null;

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#8a9a9e" transparent opacity={0.18} depthWrite={false} roughness={0.95} metalness={0.05} envMapIntensity={0.3} />
    </mesh>
  );
}

// 纵筋
function ColumnLongBars({ params, derived, show }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn>; show: boolean }) {
  const bars = useMemo(() => {
    return derived.barPositions.map((pos, i) => {
      const r = pos.bundle.diameter / 2;
      const geo = new THREE.CylinderGeometry(r, r, params.Hn, 8);
      geo.translate(pos.x, params.Hn / 2, pos.y);
      return <mesh key={i} geometry={geo}>
        <meshStandardMaterial color={BAR_COLORS[pos.kind]} metalness={0.7} roughness={0.35} envMapIntensity={1.2} />
      </mesh>;
    });
  }, [derived.barPositions, params.Hn]);

  if (!show) return null;
  return <>{bars}</>;
}

// 箍筋
function buildRectLineGeometry(params: ColumnParams) {
  const c = params.cover + params.stirrup.diameter / 2;
  const halfW = (params.b - 2 * c) / 2;
  const halfH = (params.h - 2 * c) / 2;
  const d = params.stirrup.diameter;
  const boxes: THREE.BufferGeometry[] = [];
  for (const line of derivedLineFallback(params)) {
    const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    const isVertical = Math.abs(line.x1 - line.x2) < 1e-6;
    const g = isVertical
      ? new THREE.BoxGeometry(d, len + d, d)
      : new THREE.BoxGeometry(len + d, d, d);
    g.translate((line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2, 0);
    boxes.push(g);
  }
  if (boxes.length === 0) {
    const g = new THREE.BoxGeometry(halfW * 2 + d, d, d);
    g.translate(0, halfH, 0);
    boxes.push(g);
  }
  return mergeGeometries(boxes);
}

function derivedLineFallback(params: ColumnParams) {
  const c = params.cover + params.stirrup.diameter / 2;
  const halfW = (params.b - 2 * c) / 2;
  const halfH = (params.h - 2 * c) / 2;
  const legsX = Math.max(2, Math.round(params.stirrup.legsX ?? (params.stirrup.legs === 4 ? 3 : 2)));
  const legsY = Math.max(2, Math.round(params.stirrup.legsY ?? (params.stirrup.legs === 4 ? 3 : 2)));
  const lines = [
    { x1: -halfW, y1: halfH, x2: halfW, y2: halfH },
    { x1: halfW, y1: halfH, x2: halfW, y2: -halfH },
    { x1: halfW, y1: -halfH, x2: -halfW, y2: -halfH },
    { x1: -halfW, y1: -halfH, x2: -halfW, y2: halfH },
  ];
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

  if (!show || !unitGeo || derived.stirrupYs.length === 0) return null;

  return (
    <>
      <ColumnStirrupInstances geometry={unitGeo} ys={derived.sparseStirrupYs} color="#78909c" />
      <ColumnStirrupInstances geometry={unitGeo} ys={derived.denseStirrupYs} color="#26c6da" />
    </>
  );
}

// Simple merge helper
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

export function ColumnScene() {
  const params = useColumnStore((s) => s.params);
  const view = useColumnStore((s) => s.view);
  const derived = useMemo(() => deriveColumn(params), [params]);

  const camDist = Math.max(params.Hn * 1.5, 3000);
  const center: [number, number, number] = [0, params.Hn / 2, 0];

  return (
    <Canvas
      camera={{ position: [camDist * 0.5, params.Hn * 0.6, camDist * 0.5], fov: 35, near: 1, far: camDist * 5 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      className="w-full h-full"
    >
      <color attach="background" args={["#121212"]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={["#7dd3fc", "#1e293b", 0.6]} />
      <directionalLight position={[camDist, params.Hn * 2, camDist * 0.5]} intensity={1.2} color="#e0f2fe" />
      <directionalLight position={[-camDist * 0.3, params.Hn, -camDist * 0.3]} intensity={0.4} color="#94a3b8" />
      <Environment preset="city" background={false} />

      <ColumnConcrete params={params} derived={derived} show={view.showConcrete} />
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
