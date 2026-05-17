import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment } from '@react-three/drei';
import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';
import { Concrete } from './Concrete';
import { Rebars } from './Rebars';
import { Columns } from './Columns';

function CameraController({ center, camDist, h }: { center: [number, number, number]; camDist: number; h: number }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const cmd = useBeamStore((s) => s.cameraCommand);
  const clearCmd = useBeamStore((s) => s.setCameraCommand);

  useEffect(() => {
    if (!cmd) return;
    const target = new THREE.Vector3(...center);
    let pos: THREE.Vector3;
    if (cmd === 'top') {
      pos = new THREE.Vector3(center[0], camDist * 0.8, 0);
    } else {
      pos = new THREE.Vector3(center[0] * 1.2, h * 4, camDist * 0.6);
    }
    // Animate camera position
    const startPos = camera.position.clone();
    const duration = 600;
    const startTime = performance.now();
    const animate = (time: number) => {
      const t = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      camera.position.lerpVectors(startPos, pos, ease);
      camera.lookAt(target);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    clearCmd(null);
  }, [cmd, camera, center, camDist, h, clearCmd]);

  return null;
}

export function BeamScene() {
  const params = useBeamStore((s) => s.params);
  const d = useMemo(() => derive(params), [params]);

  // 相机距离根据梁全长
  const camDist = Math.max(d.totalLength * 1.1, 4000);
  const center: [number, number, number] = [d.totalLength / 2, params.h / 2, 0];

  return (
    <Canvas
      shadows={false}
      camera={{ position: [d.totalLength * 0.6, params.h * 4, camDist * 0.6], fov: 35, near: 10, far: camDist * 10 }}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
    >
      <color attach="background" args={["#121212"]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={["#7dd3fc", "#1e293b", 0.6]} />
      <directionalLight position={[d.totalLength, params.h * 5, params.b * 5]} intensity={1.2} color="#e0f2fe" />
      <directionalLight position={[-d.totalLength * 0.3, params.h * 3, -params.b * 3]} intensity={0.4} color="#94a3b8" />
      <Environment preset="city" background={false} />

      <group>
        <Concrete />
        <Columns />
        <Rebars />
      </group>

      <Grid
        position={[d.totalLength / 2, 0, 0]}
        args={[d.totalLength * 1.5, d.totalLength * 1.5]}
        cellSize={500}
        cellColor="#1e2a2c"
        sectionSize={2000}
        sectionColor="#3b494c"
        infiniteGrid={false}
        fadeDistance={d.totalLength * 2}
        fadeStrength={1.5}
      />

      <CameraController center={center} camDist={camDist} h={params.h} />
      <OrbitControls target={center} makeDefault enableDamping dampingFactor={0.1} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
