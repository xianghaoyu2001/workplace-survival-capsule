import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <main className="error-boundary" style={{ padding: "clamp(2rem, 5vw, 4rem)", textAlign: "center" }}>
          <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontFamily: "var(--font-display)" }}>页面出错了</h2>
            <p style={{ color: "var(--muted)", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
              页面加载时遇到了意外错误，请刷新重试。
            </p>
            <details style={{ marginBottom: "1.5rem", textAlign: "left", fontSize: "0.85rem" }}>
              <summary style={{ cursor: "pointer", color: "var(--accent)" }}>查看错误详情</summary>
              <pre
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-md)",
                  overflow: "auto",
                  fontSize: "0.8rem",
                  fontFamily: "var(--font-mono)"
                }}
              >
                {this.state.error?.message}
              </pre>
            </details>
            <button className="btn-primary" onClick={this.handleReset} style={{ width: "100%" }}>
              重试
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

