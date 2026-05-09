import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useBeamStore } from '../store/beamStore';
import { derive } from '../domain/kl/derive';
import { buildBottom, buildTopSupport, buildTopThrough } from '../geometry/buildLongitudinal';
import { buildStirrupUnitGeometry } from '../geometry/buildStirrup';

const REBAR_TOP_COLOR = '#c0392b';
const REBAR_BOT_COLOR = '#e67e22';
const REBAR_SUP_COLOR = '#8e44ad';
const STIRRUP_COLOR = '#2c3e50';

export function Rebars() {
  const params = useBeamStore((s) => s.params);
  const view = useBeamStore((s) => s.view);
  const d = useMemo(() => derive(params), [params]);

  const top = useMemo(() => (view.showLongitudinal ? buildTopThrough(params, d) : []), [params, d, view.showLongitudinal]);
  const bot = useMemo(() => (view.showLongitudinal ? buildBottom(params, d) : []), [params, d, view.showLongitudinal]);
  const sup = useMemo(() => (view.showLongitudinal ? buildTopSupport(params, d) : []), [params, d, view.showLongitudinal]);

  const stirrupGeom = useMemo(() => (view.showStirrups ? buildStirrupUnitGeometry(params) : null), [params, view.showStirrups]);

  // 所有跨的箍筋 x 列表合并
  const stirrupXs = useMemo(() => {
    const all: number[] = [];
    for (const s of d.spans) all.push(...s.stirrupXs);
    return all;
  }, [d]);

  const instRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const m = instRef.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < stirrupXs.length; i++) {
      dummy.position.set(stirrupXs[i], 0, 0);
      // 相邻箍筋绕 y 轴旋转 180°，使弯钩开口左右交替
      dummy.rotation.set(0, i % 2 === 0 ? 0 : Math.PI, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.count = stirrupXs.length;
    m.instanceMatrix.needsUpdate = true;
  }, [stirrupXs, stirrupGeom]);

  return (
    <group>
      {top.map((r, i) => (
        <mesh key={`t-${i}`} geometry={r.geometry} renderOrder={1}>
          <meshStandardMaterial color={REBAR_TOP_COLOR} metalness={0.5} roughness={0.55} />
        </mesh>
      ))}
      {bot.map((r, i) => (
        <mesh key={`b-${i}`} geometry={r.geometry} renderOrder={1}>
          <meshStandardMaterial color={REBAR_BOT_COLOR} metalness={0.5} roughness={0.55} />
        </mesh>
      ))}
      {sup.map((r, i) => (
        <mesh key={`s-${i}`} geometry={r.geometry} renderOrder={1}>
          <meshStandardMaterial color={REBAR_SUP_COLOR} metalness={0.5} roughness={0.55} />
        </mesh>
      ))}
      {stirrupGeom && stirrupXs.length > 0 && (
        <instancedMesh ref={instRef} args={[stirrupGeom, undefined, stirrupXs.length]} renderOrder={1}>
          <meshStandardMaterial color={STIRRUP_COLOR} metalness={0.4} roughness={0.6} />
        </instancedMesh>
      )}
    </group>
  );
}
