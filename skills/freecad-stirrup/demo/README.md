# Demo — FreeCAD 箍筋 Skill

最小可运行示例（纯 three.js + Vite，不依赖主项目）。展示：

- **梁箍筋** 300×600、4 肢（外箍 + 内小箍），沿梁长复制、弯钩开口左右交替。
- **柱箍筋** 500×500、3×3 肢（外箍 + 带 135° 弯钩的内部拉筋），沿柱高堆叠。

## 运行

```bash
cd skills/freecad-stirrup/demo
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 http://localhost:5173）。拖拽旋转、滚轮缩放，
重点观察 135° 弯钩的圆弧过渡与首尾搭接处是否穿模。

## 说明

`main.ts` 直接 `import` 上级目录的 `freecadStirrup.ts` / `rebarPath.ts`，
即 skill 的真实源码——改算法后刷新即可验证效果。
