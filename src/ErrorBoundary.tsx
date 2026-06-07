import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

type ErrorBoundaryProps = {
  children: ReactNode;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AgentWork UI error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground grid-bg flex items-center justify-center p-6 font-sans">
        <section className="max-w-lg rounded-xl border border-border/50 bg-card/80 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-primary/30 bg-primary/10" />
          <h1 className="mb-2 text-2xl font-heading text-white">AgentWork recovered from a UI error</h1>
          <p className="mb-5 text-sm text-muted-foreground">
            The protocol state is still safe on Arc. Refresh the interface and try the action again.
          </p>
          {this.state.message && (
            <pre className="mb-5 overflow-auto rounded-lg border border-border/40 bg-background/70 p-3 text-left text-xs text-amber-200">
              {this.state.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload AgentWork
          </button>
        </section>
      </main>
    );
  }
}
