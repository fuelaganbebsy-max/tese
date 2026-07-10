import { Canvas, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment, Html } from '@react-three/drei';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { deriveStair } from '../domain/at/derive';
import type { StairParams } from '../domain/at/types';
import { useStairStore } from '../store/stairStore';
import { useSelectionStore } from '../store/selectionStore';
import { buildStairConcrete } from '../geometry/buildStair';
import { buildStairRebar } from '../geometry/buildStairRebar';
import { cutShapeFromPolyline } from '../domain/rebarShape';

const HIGHLIGHT_COLOR = '#ffffff';

/** 楼梯场景边界与相机参数 */
function stairBounds(params: StairParams) {
  const derived = deriveStair(params);
  const layout = derived.layout;
  const minX = layout.lowBeamCenterX - params.lowBeam.width / 2 - 200;
  const maxX = layout.highBeamCenterX + params.highBeam.width / 2 + 200;
  const minY = Math.min(layout.lowBeamBottomY, layout.highBeamBottomY) - 200;
  const maxY = params.Hs + Math.max(params.lowBeam.height, params.highBeam.height) + 200;
  const size = Math.max(maxX - minX, maxY - minY, params.b + 400);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, cz: 0, size };
}

// ─── 混凝土 ──────────────────────────────────────────────
function StairConcrete({ params, show }: { params: StairParams; show: boolean }) {
  const { slabGeometry, lowBeamGeometry, highBeamGeometry } = useMemo(
    () => buildStairConcrete(params),
    [params],
  );
  if (!show) return null;
  const mat = (
    <meshStandardMaterial color="#9ca3af" transparent opacity={0.35} depthWrite={false} roughness={0.9} metalness={0.05} envMapIntensity={0.3} />
  );
  return (
    <>
      <mesh geometry={slabGeometry}>{mat}</mesh>
      <mesh geometry={lowBeamGeometry}>{mat}</mesh>
      <mesh geometry={highBeamGeometry}>{mat}</mesh>
    </>
  );
}

// ─── 可点选钢筋 ──────────────────────────────────────────
function StairPickableBar({
  geo, color, barKey, points, grade, diameter, label, note,
}: {
  geo: THREE.BufferGeometry; color: string; barKey: string;
  points: THREE.Vector3[]; grade: string; diameter: number; label: string; note?: string;
}) {
  const selectedKey = useSelectionStore((s) => s.selectedKey);
  const active = selectedKey === barKey;
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
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

// ─── 全部配筋 ────────────────────────────────────────────
function StairRebars({ params, show }: { params: StairParams; show: boolean }) {
  const result = useMemo(() => buildStairRebar(params), [params]);
  if (!show) return null;
  return (
    <>
      {result.bars.map((b) => (
        <StairPickableBar
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
    </>
  );
}

// ─── 尺寸标注 ────────────────────────────────────────────
function StairDimLabels({ params }: { params: StairParams }) {
  const derived = useMemo(() => deriveStair(params), [params]);
  const layout = derived.layout;
  const label = (text: string, pos: [number, number, number]) => (
    <Html position={pos} center>
      <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest/80 border border-white/10 text-primary-fixed-dim text-[10px] font-mono whitespace-nowrap">{text}</span>
    </Html>
  );
  return (
    <group>
      {label(`ln=${params.ln}`, [params.ln / 2, layout.lowBeamBottomY - 150, 0])}
      {label(`Hs=${params.Hs}`, [params.ln + 180, params.Hs / 2, 0])}
      {label(`h=${params.h}`, [params.ln + 120, params.Hs + layout.normal.y * params.h / 2, 0])}
      {label(`b=${params.b}`, [params.ln / 2, params.Hs + 120, params.b / 2 + 100])}
    </group>
  );
}

// ─── 相机复位 ────────────────────────────────────────────
function CameraController({ center, size }: { center: [number, number, number]; size: number }) {
  const { camera } = useThree();
  const cmd = useStairStore((s) => s.cameraCommand);
  const clearCmd = useStairStore((s) => s.setCameraCommand);

  useEffect(() => {
    if (!cmd) return;
    const target = new THREE.Vector3(...center);
    const dist = size * 1.3;
    const pos = new THREE.Vector3(dist * 0.7, center[1] + dist * 0.35, dist * 0.9);
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
  }, [cmd, camera, center, size, clearCmd]);

  return null;
}

// ─── 入口 ────────────────────────────────────────────────
export function StairScene() {
  const params = useStairStore((s) => s.params);
  const view = useStairStore((s) => s.view);

  useEffect(() => {
    useSelectionStore.getState().clear();
  }, [params]);

  const { cx, cy, cz, size } = useMemo(() => stairBounds(params), [params]);
  const center: [number, number, number] = [cx, cy, cz];

  return (
    <Canvas
      camera={{ position: [-size * 0.8, cy + size * 0.45, size * 1.05], fov: 30, near: 1, far: size * 5 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      className="w-full h-full"
      onPointerMissed={() => useSelectionStore.getState().clear()}
    >
      <color attach="background" args={["#121212"]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={["#7dd3fc", "#1e293b", 0.6]} />
      <directionalLight position={[size, size * 1.5, size * 0.5]} intensity={1.2} color="#e0f2fe" />
      <directionalLight position={[-size * 0.3, cy, -size * 0.3]} intensity={0.4} color="#94a3b8" />
      <Environment preset="city" background={false} />

      <StairConcrete params={params} show={view.showConcrete} />
      <StairRebars params={params} show={view.showRebar} />
      {view.showAnnotations && <StairDimLabels params={params} />}

      <Grid
        position={[0, 0, 0]}
        cellSize={500}
        cellColor="#1e2a2c"
        sectionSize={2000}
        sectionColor="#3b494c"
        infiniteGrid
        fadeDistance={size * 2}
        fadeStrength={1.5}
      />

      <CameraController center={center} size={size} />
      <OrbitControls target={center} makeDefault enableDamping dampingFactor={0.1} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
