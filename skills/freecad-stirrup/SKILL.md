---
name: freecad-stirrup
description: >
  在 three.js 中生成工程级矩形箍筋(stirrup/tie)三维几何。移植自 FreeCAD-Reinforcement
  的 getpointsOfStirrup 做法：带 135°/90° 弯钩、恒定半径圆弧倒角、法向螺旋偏移(防自相交)。
  当用户需要"画箍筋 / 生成钢筋弯钩 / 梁柱箍筋三维 / rebar stirrup geometry"时使用。
version: 1.0.0
tags: [three.js, rebar, stirrup, 22G101, geometry, 箍筋]
---

# FreeCAD 箍筋几何 Skill

把 FreeCAD-Reinforcement (`Stirrup.py: getpointsOfStirrup`) 的箍筋做法移植到 three.js，
一次性产出"圆润、可弯钩、不自相交"的箍筋 `BufferGeometry`，可直接配合 `InstancedMesh` 沿构件长度复制。

## 何时使用

- 需要在 three.js 场景里渲染**矩形箍筋 / 拉筋 / 复合箍**。
- 需要符合**抗震 135° 弯钩 + ≥10d 直段**的钢筋外观。
- 需要箍筋首尾搭接处**不互相穿模**（法向螺旋偏移）。

## 核心算法（务必保留这些特征）

1. **7 点开口闭合环** `P0…P6`：
   `P0(钩A末端) → P1(顶左) → P2(底左) → P3(底右) → P4(顶右) → P5(顶左错位) → P6(钩B末端)`
2. **弯钩**：`bentAngle`(135°/90°)，钩长 `= tangent_length + bentFactor·d`。`bentFactor` 取 `max(10d,75)/d` 可满足 22G101 平直段要求。
3. **恒定半径圆弧倒角**：弯曲半径 `= rounding·d`（默认 `2d`，对应弯曲心轴直径 `~4d`）。倒角在 `tubeFromPolyline` 中按 `t = r/tan(θ/2)` 求切线长，再绕角平分线圆心采样真实圆弧（不是贝塞尔近似），弯钩才够圆润。
4. **法向螺旋偏移** `normal_dis`：沿截面法向逐点下沉 `normal_dis/4`，使搭接两端空间错开、避免自相交。

## 文件清单

- `freecadStirrup.ts` — 箍筋点位 + 几何生成（依赖 `rebarPath.ts`）。
- `rebarPath.ts` — 通用折线→管状几何（含真实圆弧倒角、按 `maxSegmentLen` 控制网格密度）。
- `examples.md` — 梁 / 柱 / 复合箍 / 圆箍 接入写法。
- `demo/` — 最小可运行示例（纯 three.js + Vite，不依赖主项目）：`cd demo && npm install && npm run dev`。

> 唯一外部依赖：`three`。把这两个 `.ts` 文件拷进目标项目的 `geometry/` 目录即可。

## API

```ts
interface FreecadStirrupParams {
  width: number;        // 箍筋中心线矩形宽 = 外包宽 - 2·保护层 - d
  height: number;       // 箍筋中心线矩形高 = 外包高 - 2·保护层 - d
  diameter: number;     // 箍筋直径 (mm)
  bentAngle?: 90 | 135; // 默认 135 (抗震)
  bentFactor?: number;  // 默认 10 (≈10d 直段)
  rounding?: number;    // 默认 2 (弯曲半径 = 2d)
}

// 中心在原点：x=宽方向, y=高方向, z=截面法向(螺旋偏移)
buildFreecadStirrupGeometry(p: FreecadStirrupParams, radialSegments = 14): THREE.BufferGeometry
getStirrupPoints(p: FreecadStirrupParams): THREE.Vector3[]   // 仅取 7 个控制点
```

## 坐标约定（接入要点）

`buildFreecadStirrupGeometry` 产出的几何位于：**x=宽 / y=高 / z=法向**，几何中心在原点。
接入不同构件时只需旋转 + 平移，**不要改算法**：

- **梁**（箍筋平面=剖面 yz，沿梁长 x 复制）：`geo.rotateY(Math.PI/2)` 再 `geo.translate(0, h/2, 0)`。
- **柱**（箍筋平面=水平 xz，沿柱高 y 堆叠）：保持几何不旋转，实例上 `rotation.set(Math.PI/2,0,0)` + `position.y`。

复制时让相邻箍筋绕主轴交替 180°，可使弯钩开口左右交替（更真实）。

## 使用示例

见 `examples.md`（梁箍筋、柱箍筋 + 内部拉筋两种接入写法）。

## 验收清单

- [ ] 135° 弯钩为平滑圆弧（非折线/非尖角）。
- [ ] 钩尾直段 ≥ max(10d,75mm)。
- [ ] 箍筋首尾在搭接角不穿模。
- [ ] 截面看起来是圆的（`radialSegments ≥ 12`）。
- [ ] `tsc` 通过，无运行时报错。
