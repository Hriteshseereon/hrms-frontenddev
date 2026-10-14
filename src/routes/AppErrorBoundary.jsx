import { Component } from "react";

/** App-level error boundary: shown when a screen throws while rendering. */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            This page didn&apos;t load
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Something went wrong. You can try again or go back to the sign-in page.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
            >
              Try again
            </button>
            <a
              href="/login"
              className="border-input bg-background text-foreground hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
            >
              Go to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }
}
