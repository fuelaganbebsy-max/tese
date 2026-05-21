import { useMemo } from 'react';
import * as THREE from 'three';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';

export function SectionCutPlane() {
  const params = useBeamStore((s) => s.params);
  const view = useBeamStore((s) => s.view);
  const d = useMemo(() => derive(params), [params]);

  if (!view.showSectionCut) return null;

  const xPos = view.sectionCutX * d.totalLength;
  const planeH = params.h * 1.4;
  const planeW = params.b * 1.4;

  return (
    <group position={[xPos, params.h / 2, 0]}>
      {/* Semi-transparent cutting plane */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
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
      <lineSegments rotation={[0, Math.PI / 2, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(planeW, planeH)]} />
        <lineBasicMaterial color="#00daf3" opacity={0.6} transparent />
      </lineSegments>
      {/* Dashed vertical line indicator */}
      <mesh>
        <cylinderGeometry args={[1, 1, planeH, 8]} />
        <meshBasicMaterial color="#00daf3" opacity={0.8} transparent />
      </mesh>
    </group>
  );
}
