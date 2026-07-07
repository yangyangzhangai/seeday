import React from 'react';
import { formatUserFacingDiagnostic, getAppRuntimeContext, logDiagnostic } from '../../lib/diagnostics';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    logDiagnostic('error', 'react.error_boundary.caught', {
      error,
      errorInfo,
      context: getAppRuntimeContext(),
      userFacing: formatUserFacingDiagnostic('页面渲染', error, {
        path: 'React ErrorBoundary',
      }),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>页面渲染出错</h2>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            这不是普通网络慢，而是 React 页面渲染阶段抛错。请保留 Xcode 控制台里的 react.error_boundary.caught 日志。
          </p>
          <pre style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'pre-wrap' }}>
            {formatUserFacingDiagnostic('页面渲染', this.state.error, { path: 'React ErrorBoundary' })}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
