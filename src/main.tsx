import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { lazyWithReload } from './lazyWithReload';

const App = lazyWithReload(() => import('./App'));

// 仅在数据损坏（无法解析）时清除；版本迁移交由 zustand persist 的 migrate 处理
['rebar-3d-beam', 'rebar-3d-column', 'rebar-3d-stair'].forEach((key) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    console.warn(`[store] Cleared corrupted ${key}`);
  }
});

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, color: '#ef4444', fontFamily: 'monospace', background: '#121212', minHeight: '100vh' }}>
        <h1>渲染错误</h1>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{this.state.error.message}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12, color: '#999' }}>{this.state.error.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

function Root() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
      <App />
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
