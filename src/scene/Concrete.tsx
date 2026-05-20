import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';
import { buildConcreteGeometry, buildHaunchGeometries } from '../geometry/buildConcrete';

const concreteMat = { color: '#8a9a9e', transparent: true, opacity: 0.18, depthWrite: false, roughness: 0.95, metalness: 0.05, envMapIntensity: 0.3 } as const;

export function Concrete() {
  const params = useBeamStore((s) => s.params);
  const show = useBeamStore((s) => s.view.showConcrete);
  const geometry = useMemo(() => buildConcreteGeometry(params, derive(params)), [params]);
  const haunches = useMemo(() => buildHaunchGeometries(params, derive(params)), [params]);
  if (!show) return null;
  return (
    <group>
      <mesh geometry={geometry} renderOrder={2}>
        <meshStandardMaterial {...concreteMat} />
      </mesh>
      {haunches.map((geo, i) => (
        <mesh key={i} geometry={geo} renderOrder={2}>
          <meshStandardMaterial {...concreteMat} />
        </mesh>
      ))}
    </group>
  );
}
