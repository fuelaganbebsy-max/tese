# 接入示例

> 几何由 `buildFreecadStirrupGeometry` 产出，位于 **x=宽 / y=高 / z=法向**，中心在原点。
> 接入构件只做旋转 + 平移，**不要改算法**。

## 1. 梁箍筋（剖面在 yz 平面，沿梁长 x 复制）

```ts
import * as THREE from 'three';
import { buildFreecadStirrupGeometry } from './freecadStirrup';

/** width/height = 箍筋中心线尺寸 = 外包 - 2·cover - d；centerY = 梁高中心 */
function buildBeamStirrup(width: number, height: number, centerY: number, ds: number) {
  const hookStraight = Math.max(10 * ds, 75);     // 22G101 平直段
  const geo = buildFreecadStirrupGeometry({
    width, height, diameter: ds,
    bentAngle: 135,
    bentFactor: hookStraight / ds,
    rounding: 2,
  });
  geo.rotateY(Math.PI / 2);      // 宽(x)→梁宽(z), 法向(z)→梁长(x)
  geo.translate(0, centerY, 0);  // 抬到梁高中心
  return geo;
}

// 沿梁长用 InstancedMesh 复制；相邻交替 180° 让弯钩开口左右交替
const dummy = new THREE.Object3D();
xs.forEach((x, i) => {
  dummy.position.set(x, 0, 0);
  dummy.rotation.set(0, i % 2 ? Math.PI : 0, 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
});
```

## 2. 柱箍筋（水平 xz 平面，沿柱高 y 堆叠）

```ts
const geo = buildFreecadStirrupGeometry({
  width: b - 2 * c, height: h - 2 * c, diameter: ds,   // c = cover + ds/2
  bentFactor: Math.max(10 * ds, 75) / ds,
});
// 几何不旋转，实例上让法向(z)转到竖直、沿 y 堆叠：
const dummy = new THREE.Object3D();
ys.forEach((y, i) => {
  dummy.position.set(0, y, 0);
  dummy.rotation.set(Math.PI / 2, 0, 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
});
```

## 3. 内部小箍筋 / 复合箍

外箍筋之外再叠加一个更窄的箍筋（或用 `tubeFromPolyline` 画带 135° 弯钩的单肢拉筋）：

```ts
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const outer = buildFreecadStirrupGeometry({ width, height, diameter: ds, bentFactor });
const inner = buildFreecadStirrupGeometry({ width: width / 2, height, diameter: ds, bentFactor });
const geo = mergeGeometries([outer, inner]) ?? outer;
```

## 4. 圆形截面

圆箍直接用 `new THREE.TorusGeometry(R, ds/2, 8, 32)`，本 skill 仅处理矩形箍。
