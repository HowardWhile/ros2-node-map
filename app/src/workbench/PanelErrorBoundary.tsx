import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { panelName: string; onRetry: () => void; children: ReactNode; }
interface State { error: Error | null; }

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`React render failed in ${this.props.panelName}`, error, info.componentStack);
  }

  retry = (): void => { this.setState({ error: null }); this.props.onRetry(); };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <section className="panel-error" role="alert"><strong>{this.props.panelName} failed to render</strong>
      <span>{this.state.error.message || "Unexpected panel error"}</span>
      <button type="button" onClick={this.retry}>Retry panel</button></section>;
  }
}
