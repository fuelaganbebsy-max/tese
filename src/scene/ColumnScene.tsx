import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { deriveColumn, defaultColumn } from '../domain/kz/derive';
import type { ColumnParams } from '../domain/kz/types';

// 柱体混凝土
function ColumnConcrete({ params, derived }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn> }) {
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

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#8a9a9e" transparent opacity={0.18} depthWrite={false} roughness={0.95} metalness={0.05} envMapIntensity={0.3} />
    </mesh>
  );
}

// 纵筋
function ColumnLongBars({ params, derived }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn> }) {
  const bars = useMemo(() => {
    return derived.barPositions.map((pos, i) => {
      const r = params.longitudinal.diameter / 2;
      const geo = new THREE.CylinderGeometry(r, r, params.Hn, 8);
      geo.translate(pos.x, params.Hn / 2, pos.y);
      return <mesh key={i} geometry={geo}>
        <meshStandardMaterial color="#ef5350" metalness={0.7} roughness={0.35} envMapIntensity={1.2} />
      </mesh>;
    });
  }, [derived.barPositions, params.longitudinal.diameter, params.Hn]);

  return <>{bars}</>;
}

// 箍筋
function ColumnStirrups({ params, derived }: { params: ColumnParams; derived: ReturnType<typeof deriveColumn> }) {
  const unitGeo = useMemo(() => {
    const c = params.cover + params.stirrup.diameter / 2;
    const w = params.b - 2 * c;
    const h = params.h - 2 * c;
    const r = params.stirrup.diameter / 2;

    if (params.sectionType === 'circle') {
      const outerR = params.D / 2 - c;
      return new THREE.TorusGeometry(outerR, r, 8, 32);
    }

    // 矩形箍筋 — 用 4 个 cylinder 拼接
    const shape = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();

    const innerShape = new THREE.Shape();
    const iw = hw - r * 2, ih = hh - r * 2;
    innerShape.moveTo(-iw, -ih);
    innerShape.lineTo(iw, -ih);
    innerShape.lineTo(iw, ih);
    innerShape.lineTo(-iw, ih);
    innerShape.closePath();

    const extrudeSettings = { depth: params.stirrup.diameter, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Punch out inner
    const innerGeo = new THREE.ExtrudeGeometry(innerShape, extrudeSettings);

    // Use simple box-ring approach: create ring from 4 thin boxes
    const group = new THREE.BufferGeometry();
    const boxes: THREE.BufferGeometry[] = [];
    const d = params.stirrup.diameter;
    // top
    const top = new THREE.BoxGeometry(w + d, d, d);
    top.translate(0, hh, 0);
    boxes.push(top);
    // bottom
    const bot = new THREE.BoxGeometry(w + d, d, d);
    bot.translate(0, -hh, 0);
    boxes.push(bot);
    // left
    const left = new THREE.BoxGeometry(d, h + d, d);
    left.translate(-hw, 0, 0);
    boxes.push(left);
    // right
    const right = new THREE.BoxGeometry(d, h + d, d);
    right.translate(hw, 0, 0);
    boxes.push(right);

    return mergeGeometries(boxes);
  }, [params.sectionType, params.b, params.h, params.D, params.cover, params.stirrup.diameter]);

  // Instanced mesh for all stirrups
  const count = derived.stirrupYs.length;
  const meshRef = useMemo(() => {
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    derived.stirrupYs.forEach((y) => {
      dummy.position.set(0, y, 0);
      if (params.sectionType === 'circle') {
        dummy.rotation.set(Math.PI / 2, 0, 0);
      } else {
        dummy.rotation.set(Math.PI / 2, 0, 0);
      }
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
    });
    return matrices;
  }, [derived.stirrupYs, params.sectionType]);

  if (!unitGeo || count === 0) return null;

  return (
    <instancedMesh args={[unitGeo, undefined, count]}>
      <meshStandardMaterial color="#78909c" metalness={0.65} roughness={0.4} envMapIntensity={1.0} />
      {meshRef.map((m, i) => (
        <primitive key={i} object={(() => {
          const o = new THREE.Object3D();
          o.applyMatrix4(m);
          return o;
        })()} />
      ))}
    </instancedMesh>
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

export function ColumnScene() {
  const params = defaultColumn();
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

      <ColumnConcrete params={params} derived={derived} />
      <ColumnLongBars params={params} derived={derived} />
      <ColumnStirrups params={params} derived={derived} />

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

      <OrbitControls target={center} makeDefault enableDamping dampingFactor={0.1} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
