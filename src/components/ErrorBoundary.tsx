import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors anywhere in the tree and shows the message
 * instead of a blank white screen, so failures are visible and reportable.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash">
          <div className="crash-card">
            <h1>🍎 Something went wrong</h1>
            <p>The app hit an unexpected error. Reloading usually fixes it.</p>
            <button className="primary-button" onClick={() => window.location.reload()}>
              Reload
            </button>
            <pre className="crash-detail">{this.state.error.message}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
