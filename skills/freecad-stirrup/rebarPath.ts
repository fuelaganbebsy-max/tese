import * as THREE from 'three';

/**
 * 由折线点构造 TubeGeometry。
 * 在每个内部转折点用恒定半径圆弧做倒角过渡（默认弯折半径 = 4·tube 半径，
 * 对应钢筋中心线弯曲半径 ≈ 2d，接近 22G101 弯曲心轴直径示意值）。
 */
export function tubeFromPolyline(
  points: THREE.Vector3[],
  radius: number,
  radialSegments = 8,
  bendRadius?: number,
  maxSegmentLen = 6,
): THREE.BufferGeometry {
  if (points.length < 2) return new THREE.BufferGeometry();
  const r = bendRadius ?? radius * 4;
  const path = new THREE.CurvePath<THREE.Vector3>();

  // 预计算每个内部顶点的真实圆弧倒角（恒定半径 r，进入点 / 离开点 / 弧上采样点）
  const entry: THREE.Vector3[] = new Array(points.length);
  const exit: THREE.Vector3[] = new Array(points.length);
  const arcPts: (THREE.Vector3[] | null)[] = new Array(points.length).fill(null);
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const d1 = new THREE.Vector3().subVectors(points[i - 1], cur);
    const d2 = new THREE.Vector3().subVectors(points[i + 1], cur);
    const l1 = d1.length();
    const l2 = d2.length();
    if (l1 < 1e-6 || l2 < 1e-6) {
      entry[i] = cur.clone();
      exit[i] = cur.clone();
      continue;
    }
    d1.divideScalar(l1);
    d2.divideScalar(l2);
    // 共线（无弯折）时跳过圆角
    if (d1.clone().add(d2).length() < 1e-3) {
      entry[i] = cur.clone();
      exit[i] = cur.clone();
      continue;
    }
    // 夹角 θ；恒定弯曲半径 r 所需切线长 t = r / tan(θ/2)，受相邻段长一半限制
    const theta = d1.angleTo(d2);
    const half = theta / 2;
    const t = Math.min(r / Math.tan(half), l1 / 2, l2 / 2);
    const arcR = t * Math.tan(half); // 实际弯曲半径（未被截断时即为 r）
    const e = cur.clone().addScaledVector(d1, t);
    const x = cur.clone().addScaledVector(d2, t);
    entry[i] = e;
    exit[i] = x;
    // 圆心：沿角平分线方向，距角点 arcR / sin(θ/2)
    const bis = d1.clone().add(d2).normalize();
    const center = cur.clone().addScaledVector(bis, arcR / Math.sin(half));
    const ve = e.clone().sub(center);
    const vx = x.clone().sub(center);
    const axis = new THREE.Vector3().crossVectors(ve, vx).normalize();
    const sweep = ve.angleTo(vx);
    if (sweep > 1e-4 && Number.isFinite(axis.x)) {
      const steps = Math.max(4, Math.ceil(sweep / 0.1)); // ≈每段 5.7°
      const pts: THREE.Vector3[] = [e.clone()];
      for (let k = 1; k < steps; k++) {
        const q = new THREE.Quaternion().setFromAxisAngle(axis, (sweep * k) / steps);
        pts.push(ve.clone().applyQuaternion(q).add(center));
      }
      pts.push(x.clone());
      arcPts[i] = pts;
    }
  }

  let cursor = points[0].clone();
  for (let i = 1; i < points.length; i++) {
    if (i === points.length - 1) {
      if (cursor.distanceTo(points[i]) > 1e-6) {
        path.add(new THREE.LineCurve3(cursor.clone(), points[i].clone()));
      }
    } else {
      const e = entry[i];
      const x = exit[i];
      if (cursor.distanceTo(e) > 1e-6) {
        path.add(new THREE.LineCurve3(cursor.clone(), e.clone()));
      }
      const pts = arcPts[i];
      if (pts) {
        for (let k = 0; k < pts.length - 1; k++) {
          if (pts[k].distanceTo(pts[k + 1]) > 1e-6) {
            path.add(new THREE.LineCurve3(pts[k].clone(), pts[k + 1].clone()));
          }
        }
      } else if (e.distanceTo(x) > 1e-6) {
        path.add(new THREE.LineCurve3(e.clone(), x.clone()));
      }
      cursor = x.clone();
    }
  }

  // 段数：取曲线真实长度（含圆角弧），按 maxSegmentLen 控制每段长度，保证弯钩等小半径圆角处足够光滑
  const totalLen = path.getLength();
  const tubularSegments = Math.max(24, Math.min(2000, Math.round(totalLen / maxSegmentLen)));
  return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, tubularSegments, radius, radialSegments, false);
}

/** 闭合折线（用于箍筋）转 TubeGeometry */
export function tubeFromClosedPolyline(points: THREE.Vector3[], radius: number, radialSegments = 6): THREE.BufferGeometry {
  if (points.length < 3) return new THREE.BufferGeometry();
  const closed = [...points, points[0].clone()];
  return tubeFromPolyline(closed, radius, radialSegments);
}
