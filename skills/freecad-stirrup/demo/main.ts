import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildFreecadStirrupGeometry } from '../freecadStirrup';
import { tubeFromPolyline } from '../rebarPath';

const STIRRUP_COLOR = '#90a4ae';
const SECTION_COLOR = '#37474f';

// ─── 场景基础 ──────────────────────────────────────────────
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#121212');

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 20000);
camera.position.set(900, 700, 1400);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 300, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.6);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xe0f2fe, 1.2);
key.position.set(1500, 2000, 1000);
scene.add(key);

const stirrupMat = new THREE.MeshStandardMaterial({
  color: STIRRUP_COLOR, metalness: 0.65, roughness: 0.4, envMapIntensity: 1.0,
});
const sectionMat = new THREE.MeshStandardMaterial({
  color: SECTION_COLOR, transparent: true, opacity: 0.12, depthWrite: false,
});

// ─── 工程参数 ──────────────────────────────────────────────
const COVER = 25;

/** 梁箍筋 (300×600, 4 肢): 外箍 + 内小箍, 旋转到 yz 剖面、抬到梁高中心 */
function buildBeamStirrup(b: number, h: number, ds: number): THREE.BufferGeometry {
  const c = COVER + ds / 2;
  const innerW = b - 2 * c;
  const innerH = h - 2 * c;
  const bentFactor = Math.max(10 * ds, 75) / ds;
  const outer = buildFreecadStirrupGeometry({ width: innerW, height: innerH, diameter: ds, bentFactor });
  const inner = buildFreecadStirrupGeometry({ width: innerW / 2, height: innerH, diameter: ds, bentFactor });
  const geo = mergeGeometries([outer, inner]) ?? outer;
  geo.rotateY(Math.PI / 2);
  geo.translate(0, h / 2, 0);
  return geo;
}

/** 柱箍筋 (b×h, legsX×legsY 肢): 外箍 + 内部带 135° 弯钩拉筋, 水平放置 */
function buildColumnStirrup(b: number, h: number, ds: number, legsX: number, legsY: number): THREE.BufferGeometry {
  const c = COVER + ds / 2;
  const halfW = (b - 2 * c) / 2;
  const halfH = (h - 2 * c) / 2;
  const bentFactor = Math.max(10 * ds, 75) / ds;
  const bendR = ds * 2;
  const e = (bentFactor * ds + bendR) / Math.SQRT2;

  const geos: THREE.BufferGeometry[] = [
    buildFreecadStirrupGeometry({ width: halfW * 2, height: halfH * 2, diameter: ds, bentFactor }),
  ];
  for (let i = 1; i < legsX - 1; i++) {
    const x = -halfW + (2 * halfW * i) / (legsX - 1);
    geos.push(tubeFromPolyline([
      new THREE.Vector3(x + e, halfH - e, 0), new THREE.Vector3(x, halfH, 0),
      new THREE.Vector3(x, -halfH, 0), new THREE.Vector3(x + e, -halfH + e, 0),
    ], ds / 2, 14, bendR, 3));
  }
  for (let i = 1; i < legsY - 1; i++) {
    const y = -halfH + (2 * halfH * i) / (legsY - 1);
    geos.push(tubeFromPolyline([
      new THREE.Vector3(halfW - e, y + e, 0), new THREE.Vector3(halfW, y, 0),
      new THREE.Vector3(-halfW, y, 0), new THREE.Vector3(-halfW + e, y + e, 0),
    ], ds / 2, 14, bendR, 3));
  }
  const geo = mergeGeometries(geos)!;
  geo.rotateX(Math.PI / 2); // 法向(z)→竖直, 放平为水平箍筋
  return geo;
}

// ─── 梁箍筋: 沿梁长方向复制一排 (展示弯钩开口左右交替) ──────────
const beamGeo = buildBeamStirrup(300, 600, 8);
const beamGroup = new THREE.Group();
beamGroup.position.set(-450, 0, 0);
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(beamGeo, stirrupMat);
  m.position.x = i * 120 - 300;
  m.rotation.y = i % 2 ? Math.PI : 0;
  beamGroup.add(m);
}
const beamSection = new THREE.Mesh(new THREE.BoxGeometry(720, 600, 300), sectionMat);
beamSection.position.set(-180, 300, 0);
beamGroup.add(beamSection);
scene.add(beamGroup);

// ─── 柱箍筋: 沿柱高堆叠一排 ────────────────────────────────
const colGeo = buildColumnStirrup(500, 500, 10, 3, 3);
const colGroup = new THREE.Group();
colGroup.position.set(550, 0, 0);
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(colGeo, stirrupMat);
  m.position.y = 80 + i * 100;
  m.rotation.y = i % 2 ? Math.PI / 2 : 0;
  colGroup.add(m);
}
const colSection = new THREE.Mesh(new THREE.BoxGeometry(500, 700, 500), sectionMat);
colSection.position.set(0, 380, 0);
colGroup.add(colSection);
scene.add(colGroup);

// 地面网格
const grid = new THREE.GridHelper(4000, 20, 0x3b494c, 0x1e2a2c);
scene.add(grid);

// ─── 渲染循环 ──────────────────────────────────────────────
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
