import { useMemo } from 'react';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';
import { buildConcreteGeometry } from '../geometry/buildConcrete';

export function Concrete() {
  const params = useBeamStore((s) => s.params);
  const show = useBeamStore((s) => s.view.showConcrete);
  const geometry = useMemo(() => buildConcreteGeometry(params, derive(params)), [params]);
  if (!show) return null;
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial color="#cfcfcf" transparent opacity={0.22} depthWrite={false} roughness={0.9} metalness={0.0} />
    </mesh>
  );
}
