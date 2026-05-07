# 框架梁 KL 平法 3D 可视化

纯前端的钢筋平法可视化工具：表单输入参数 → 实时生成 3D 钢筋骨架与混凝土。当前覆盖**框架梁 KL（示意级）**，按 16G101-1 自动计算锚固、弯钩、箍筋加密区。

## 在线预览

GitHub Pages: https://fuelaganbebsy-max.github.io/tese1/

## 技术栈

- React 18 + TypeScript + Vite
- Three.js + @react-three/fiber + @react-three/drei
- TailwindCSS
- Zustand

## 本地开发

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # 产物输出到 dist/
```

## 目录结构

```
src/
├─ domain/      纯函数：16G101 规则、类型、派生计算
├─ geometry/    几何构造：纵筋(TubeGeometry) / 箍筋(InstancedMesh) / 混凝土
├─ scene/       R3F 场景与渲染组件
├─ ui/          表单与派生信息面板
└─ store/       Zustand 状态
```

## 部署

推送到 `main` 后，GitHub Actions 会自动构建并发布到 Pages。
仓库 → Settings → Pages → Source 选择 **GitHub Actions** 即可。
