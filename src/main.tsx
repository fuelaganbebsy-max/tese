import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
