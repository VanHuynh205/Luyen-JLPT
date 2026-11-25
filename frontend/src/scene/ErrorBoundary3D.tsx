import { Component, type ReactNode } from "react";

export interface ErrorBoundary3DProps {
  fallback: ReactNode;
  onError?: () => void;
  children: ReactNode;
}

interface ErrorBoundary3DState {
  hasError: boolean;
}

/** Silently catches WebGL/Canvas runtime errors without emitting console.error. */
export class ErrorBoundary3D extends Component<
  ErrorBoundary3DProps,
  ErrorBoundary3DState
> {
  state: ErrorBoundary3DState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundary3DState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
