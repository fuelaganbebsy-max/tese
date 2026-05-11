import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid } from '@react-three/drei';
import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';
import { Concrete } from './Concrete';
import { Rebars } from './Rebars';
import { Columns } from './Columns';

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
      <color attach="background" args={["#ffffff"]} />
      <hemisphereLight args={["#ffffff", "#cbd5e1", 0.95]} />
      <directionalLight position={[d.totalLength, params.h * 5, params.b * 5]} intensity={0.85} />
      <directionalLight position={[-d.totalLength * 0.3, params.h * 3, -params.b * 3]} intensity={0.35} />

      <group>
        <Concrete />
        <Columns />
        <Rebars />
      </group>

      <Grid
        position={[d.totalLength / 2, 0, 0]}
        args={[d.totalLength * 1.5, d.totalLength * 1.5]}
        cellSize={500}
        cellColor="#d1d5db"
        sectionSize={2000}
        sectionColor="#94a3b8"
        infiniteGrid={false}
        fadeDistance={d.totalLength * 2}
      />

      <OrbitControls target={center} makeDefault enableDamping dampingFactor={0.1} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
