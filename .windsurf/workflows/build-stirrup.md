---
description: 用 FreeCAD 移植做法在 three.js 中生成箍筋(stirrup/tie)三维几何
---

# /build-stirrup — 生成工程级箍筋几何

参考 Skill：`skills/freecad-stirrup/SKILL.md`（含算法说明、API、接入示例与验收清单）。
目标：产出带 135°/90° 弯钩、恒定半径圆弧倒角、法向螺旋偏移(防自相交)的箍筋 `BufferGeometry`。

## 步骤

1. **确认构件与参数**。向用户确认：
   - 构件类型（梁 / 柱 / 其他）与截面 `b × h`、保护层 `cover`、箍筋直径 `d`。
   - 是否多肢/复合箍（内部拉筋数量）。
   - 弯钩角度（抗震默认 135°）。

2. **引入 skill 代码**。若目标项目 `geometry/` 下没有，则从 `skills/freecad-stirrup/` 拷贝
   `freecadStirrup.ts` 与 `rebarPath.ts`（唯一依赖 `three`）。**不要重写算法**，保留四个核心特征
   （7 点环 / 弯钩 / 圆弧倒角 / 法向螺旋偏移）。

3. **调用生成几何**：
   ```ts
   buildFreecadStirrupGeometry({
     width:  sectionW - 2 * cover - d,   // 中心线尺寸
     height: sectionH - 2 * cover - d,
     diameter: d,
     bentAngle: 135,
     bentFactor: Math.max(10 * d, 75) / d, // 22G101 平直段 ≥ max(10d,75)
     rounding: 2,                          // 弯曲半径 = 2d
   })
   ```

4. **按构件接入（只旋转+平移，几何中心在原点，x=宽/y=高/z=法向）**：
   - 梁：`geo.rotateY(Math.PI/2)` → `geo.translate(0, h/2, 0)`，沿梁长 x 用 `InstancedMesh` 复制。
   - 柱：几何不旋转，实例 `rotation.set(Math.PI/2,0,0)` + `position.y`，沿柱高 y 堆叠。
   - 复制时相邻实例绕主轴交替 180°，使弯钩开口左右交替。

5. **多肢/复合箍**：在外箍筋基础上叠加更窄的内箍筋，或用 `tubeFromPolyline` 画带 135° 弯钩的单肢拉筋，
   再 `mergeGeometries` 合并。

6. **验证**：
// turbo
   ```bash
   npx tsc -b --noEmit
   ```
   并按 `SKILL.md` 验收清单自检：弯钩为平滑圆弧、钩尾 ≥ max(10d,75)、首尾不穿模、截面够圆(`radialSegments ≥ 12`)。

7. **预览**：启动 `npm run dev`，在梁/柱视图旋转检查弯钩与搭接处。
