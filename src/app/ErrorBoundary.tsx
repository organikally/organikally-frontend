import { Component, type ErrorInfo, type ReactNode } from 'react';

// App-wide error boundary. A runtime crash on a rep's phone must not leave a
// blank white screen mid-route — it shows a recover/retry surface instead. The
// offline queue lives in IndexedDB and is untouched by a render crash, so
// "Try again" / "Reload" are safe and lose no captured work.

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for diagnostics; the shell/WebView forwards console to logs.
    console.error('App crashed:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private reload = () => {
    if (typeof window !== 'undefined') window.location.assign('/today');
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-10 text-center text-paper">
        <div className="mx-auto w-full max-w-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-card bg-yellow shadow-oil">
            <span className="wordmark text-3xl text-ink">!</span>
          </div>
          <h1 className="font-display text-2xl text-paper">Something broke</h1>
          <p className="mt-2 text-sm text-paper/70">
            The app hit an unexpected error. Your queued visits and orders are
            saved on this device and will still sync.
          </p>
          {this.state.error.message && (
            <p className="mt-3 break-words rounded-card bg-paper/10 px-3 py-2 text-xs text-paper/60">
              {this.state.error.message}
            </p>
          )}
          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={this.reset}
              className="flex min-h-[52px] w-full items-center justify-center rounded-card bg-yellow font-sans font-semibold text-ink active:opacity-90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="flex min-h-[52px] w-full items-center justify-center rounded-card border border-paper/25 font-sans font-semibold text-paper active:bg-paper/10"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
