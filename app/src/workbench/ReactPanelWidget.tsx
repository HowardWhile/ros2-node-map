import { createRoot, type Root } from "react-dom/client";
import { Widget } from "@lumino/widgets";
import { PanelErrorBoundary } from "./PanelErrorBoundary";

export interface ReactPanelWidgetOptions {
  id: string;
  title: string;
  closable?: boolean;
  render: () => React.ReactNode;
}

export class ReactPanelWidget extends Widget {
  private root: Root | null = null;
  private readonly renderPanel: () => React.ReactNode;

  constructor(options: ReactPanelWidgetOptions) {
    super({ node: document.createElement("div") });
    this.id = options.id;
    this.title.label = options.title;
    this.title.caption = options.title;
    this.title.closable = options.closable ?? true;
    this.renderPanel = options.render;
    this.addClass("ros2-react-panel");
  }

  protected onAfterAttach(): void { this.mount(); }

  dispose(): void {
    this.root?.unmount();
    this.root = null;
    super.dispose();
  }

  private mount(): void {
    if (this.root) return;
    this.root = createRoot(this.node);
    const render = () => this.renderPanel();
    this.root.render(<PanelErrorBoundary panelName={this.title.label} onRetry={render}>{render()}</PanelErrorBoundary>);
  }
}
