import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useBeamStore } from '../store/beamStore';
import { useSelectionStore } from '../store/selectionStore';
import { derive } from '../domain/kl/derive';
import { buildBottom, buildMidBars, buildTieBars, buildTopSupport, buildTopThrough, type RebarBuilt } from '../geometry/buildLongitudinal';
import { buildStirrupUnitGeometry } from '../geometry/buildStirrup';
import { stirrupHookStraight } from '../domain/codes/22G101';
import { cutShapeFromPolyline, stirrupCutShape } from '../domain/rebarShape';

const HIGHLIGHT_COLOR = '#ffffff';

/** 把 RebarBuilt 转为下料形状并写入选中 store */
function selectRebar(r: RebarBuilt, key: string) {
  const pts = r.meta.points;
  if (!pts || pts.length < 2) return;
  const shape = cutShapeFromPolyline(
    pts.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    { mark: r.meta.label, grade: r.meta.grade, diameter: r.meta.diameter },
  );
  useSelectionStore.getState().select(shape, key);
}

/** 可点选的单根钢筋 mesh（含选中高亮） */
function PickableBar({ r, barKey, color }: { r: RebarBuilt; barKey: string; color: string }) {
  const selectedKey = useSelectionStore((s) => s.selectedKey);
  const active = selectedKey === barKey;
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectRebar(r, barKey);
  };
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const handleOut = () => {
    document.body.style.cursor = 'auto';
  };
  return (
    <mesh geometry={r.geometry} renderOrder={active ? 2 : 1} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
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

const REBAR_TOP_COLOR = '#ef5350';
const REBAR_ERECTION_COLOR = '#ec407a'; // 架立筋 — 粉色（区别于支座负筋紫色）
const REBAR_BOT_COLOR = '#ffa726';
const REBAR_BOT2_CORNER_COLOR = '#42a5f5'; // 二排角筋（伸入柱弯锚）— 蓝色
const REBAR_BOT2_MID_COLOR = '#66bb6a';    // 二排中间筋（直锚12d不弯折）— 绿色
const REBAR_SUP_COLOR = '#ab47bc';        // 一排支座负筋 — 紫色
const REBAR_SUP2_COLOR = '#26c6da';       // 二排支座负筋 — 青色
const REBAR_MID_CONSTRUCTION_COLOR = '#66bb6a'; // 构造筋 — 绿色
const REBAR_MID_TORSION_COLOR = '#26c6da';       // 扭筋 — 青色
const STIRRUP_COLOR = '#78909c';

export function Rebars() {
  const params = useBeamStore((s) => s.params);
  const view = useBeamStore((s) => s.view);
  const d = useMemo(() => derive(params), [params]);

  const top = useMemo(() => (view.showLongitudinal ? buildTopThrough(params, d) : []), [params, d, view.showLongitudinal]);
  const bot = useMemo(() => (view.showLongitudinal ? buildBottom(params, d) : []), [params, d, view.showLongitudinal]);
  const sup = useMemo(() => (view.showLongitudinal ? buildTopSupport(params, d) : []), [params, d, view.showLongitudinal]);
  const mid = useMemo(() => (view.showLongitudinal ? buildMidBars(params, d) : []), [params, d, view.showLongitudinal]);
  const tie = useMemo(() => (view.showStirrups ? buildTieBars(params, d) : []), [params, d, view.showStirrups]);

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

  const selectedKey = useSelectionStore((s) => s.selectedKey);

  const handleStirrupClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const sp = params.spans[0];
    const ds = sp.stirrup.diameter;
    const innerW = params.b - 2 * params.cover - ds;
    const innerH = params.h - 2 * params.cover - ds;
    const hook = stirrupHookStraight(ds);
    const idx = e.instanceId ?? 0;
    const shape = stirrupCutShape(innerW, innerH, hook, {
      mark: `箍筋 #${idx + 1}`,
      grade: sp.stirrup.grade,
      diameter: ds,
      note: sp.stirrup.legs === 4 ? '含内肢小箍筋' : undefined,
    });
    useSelectionStore.getState().select(shape, 'stirrup');
  };
  const stirrupActive = selectedKey === 'stirrup';

  return (
    <group>
      {top.map((r, i) => (
        <PickableBar key={`t-${i}`} r={r} barKey={`t-${i}`} color={r.kind === 'erection' ? REBAR_ERECTION_COLOR : REBAR_TOP_COLOR} />
      ))}
      {bot.map((r, i) => {
        const color = r.kind === 'bottom2-corner' ? REBAR_BOT2_CORNER_COLOR
          : r.kind === 'bottom2-mid' ? REBAR_BOT2_MID_COLOR
          : REBAR_BOT_COLOR;
        return <PickableBar key={`b-${i}`} r={r} barKey={`b-${i}`} color={color} />;
      })}
      {sup.map((r, i) => (
        <PickableBar key={`s-${i}`} r={r} barKey={`s-${i}`} color={r.kind === 'support-row2' ? REBAR_SUP2_COLOR : REBAR_SUP_COLOR} />
      ))}
      {mid.map((r, i) => (
        <PickableBar key={`m-${i}`} r={r} barKey={`m-${i}`} color={r.kind === 'mid-torsion' ? REBAR_MID_TORSION_COLOR : REBAR_MID_CONSTRUCTION_COLOR} />
      ))}
      {tie.map((r, i) => (
        <PickableBar key={`tie-${i}`} r={r} barKey={`tie-${i}`} color={STIRRUP_COLOR} />
      ))}
      {stirrupGeom && stirrupXs.length > 0 && (
        <instancedMesh
          ref={instRef}
          args={[stirrupGeom, undefined, stirrupXs.length]}
          renderOrder={1}
          onClick={handleStirrupClick}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <meshStandardMaterial
            color={stirrupActive ? HIGHLIGHT_COLOR : STIRRUP_COLOR}
            emissive={stirrupActive ? HIGHLIGHT_COLOR : '#000000'}
            emissiveIntensity={stirrupActive ? 0.35 : 0}
            metalness={0.65}
            roughness={0.4}
            envMapIntensity={1.0}
          />
        </instancedMesh>
      )}
    </group>
  );
}
