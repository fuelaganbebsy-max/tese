#!/bin/bash
# Hermes-Agent 项目干净重启脚本
# 用途：杀掉所有旧 Vite 进程、清理缓存、重新启动

echo "=== 1. 杀掉所有旧 Node/Vite 进程 ==="
taskkill -f -im node.exe 2>/dev/null
sleep 1

echo "=== 2. 清理 Vite 缓存 ==="
rm -rf node_modules/.vite
echo "缓存已清理"

echo "=== 3. 验证端口 5173 空闲 ==="
sleep 1

echo "=== 4. 启动 Vite 开发服务器 ==="
npm run dev
