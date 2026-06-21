import { lazy, type ComponentType } from 'react';

// 动态 import 失败（多为重新部署后旧 chunk 失效）时自动刷新一次拿到最新资源
export function lazyWithReload<T extends { default: ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  const KEY = 'chunk-reload-once';
  return lazy(() =>
    factory()
      .then((m) => {
        sessionStorage.removeItem(KEY); // 成功加载后复位，允许下次部署再触发
        return m;
      })
      .catch((err) => {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        return new Promise<T>(() => {}); // 阻塞渲染直到页面刷新
      }
      throw err; // 刷新后仍失败则抛出，交给 ErrorBoundary
    }),
  );
}
