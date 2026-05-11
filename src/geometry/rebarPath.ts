import * as THREE from 'three';

/**
 * 由折线点构造 TubeGeometry。
 * 在每个内部转折点用二次贝塞尔曲线做圆角过渡（默认弯折半径 = 4·tube 半径，
 * 对应钢筋中心线弯曲半径 ≈ 2d，接近 22G101 弯曲心轴直径示意值）。
 */
export function tubeFromPolyline(
  points: THREE.Vector3[],
  radius: number,
  radialSegments = 8,
  bendRadius?: number,
): THREE.BufferGeometry {
  if (points.length < 2) return new THREE.BufferGeometry();
  const r = bendRadius ?? radius * 4;
  const path = new THREE.CurvePath<THREE.Vector3>();

  // 预计算每个内部顶点的圆角进入点 / 离开点
  const entry: THREE.Vector3[] = new Array(points.length);
  const exit: THREE.Vector3[] = new Array(points.length);
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
    const t = Math.min(r, l1 / 2, l2 / 2);
    entry[i] = cur.clone().addScaledVector(d1, t);
    exit[i] = cur.clone().addScaledVector(d2, t);
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
      if (e.distanceTo(x) > 1e-6) {
        path.add(new THREE.QuadraticBezierCurve3(e.clone(), points[i].clone(), x.clone()));
      }
      cursor = x.clone();
    }
  }

  // 段数：每段 ~15mm，保证圆角处足够光滑
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) totalLen += points[i].distanceTo(points[i + 1]);
  const tubularSegments = Math.max(16, Math.min(800, Math.round(totalLen / 15)));
  return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, tubularSegments, radius, radialSegments, false);
}

/** 闭合折线（用于箍筋）转 TubeGeometry */
export function tubeFromClosedPolyline(points: THREE.Vector3[], radius: number, radialSegments = 6): THREE.BufferGeometry {
  if (points.length < 3) return new THREE.BufferGeometry();
  const closed = [...points, points[0].clone()];
  return tubeFromPolyline(closed, radius, radialSegments);
}
