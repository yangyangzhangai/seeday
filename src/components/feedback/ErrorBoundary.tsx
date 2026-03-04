import React from 'react';

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
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>页面渲染出错</h2>
          <pre style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'pre-wrap' }}>
            {String(this.state.error || 'Unknown error')}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

