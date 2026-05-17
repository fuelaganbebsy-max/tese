import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';
import { buildColumns } from '../geometry/buildColumns';

export function Columns() {
  const params = useBeamStore((s) => s.params);
  const show = useBeamStore((s) => s.view.showColumns);
  const cols = useMemo(() => buildColumns(params, derive(params)), [params]);
  if (!show) return null;
  return (
    <group>
      {cols.map((c, i) => (
        <mesh key={i} geometry={c.geometry} renderOrder={2}>
          <meshStandardMaterial
            color="#6b7d80"
            transparent
            opacity={0.25}
            depthWrite={false}
            roughness={0.92}
            metalness={0.05}
            envMapIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}
