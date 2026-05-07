import * as THREE from 'three';

/** 由折线点构造 TubeGeometry。点之间用直线段连接（CurvePath + LineCurve3）。 */
export function tubeFromPolyline(points: THREE.Vector3[], radius: number, radialSegments = 8): THREE.BufferGeometry {
  if (points.length < 2) return new THREE.BufferGeometry();
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(points[i].clone(), points[i + 1].clone()));
  }
  // 段数取每段约 1cm 一段（毫米单位）
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) totalLen += points[i].distanceTo(points[i + 1]);
  const tubularSegments = Math.max(8, Math.min(400, Math.round(totalLen / 30)));
  return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, tubularSegments, radius, radialSegments, false);
}

/** 闭合折线（用于箍筋）转 TubeGeometry */
export function tubeFromClosedPolyline(points: THREE.Vector3[], radius: number, radialSegments = 6): THREE.BufferGeometry {
  if (points.length < 3) return new THREE.BufferGeometry();
  const closed = [...points, points[0].clone()];
  return tubeFromPolyline(closed, radius, radialSegments);
}
