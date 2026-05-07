import * as THREE from 'three';
import type { BeamParams } from '../domain/kl/types';
import type { Derived } from '../domain/kl/derive';

export function buildConcreteGeometry(p: BeamParams, d: Derived): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(d.totalLength, p.h, p.b);
  // BoxGeometry 中心在原点，平移到 (totalLength/2, h/2, 0)
  g.translate(d.totalLength / 2, p.h / 2, 0);
  return g;
}
