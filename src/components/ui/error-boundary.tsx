"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
}

// ─── Error Boundary Class Component ─────────────────────────────

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const eventId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.setState({ errorInfo, eventId });

    // Call optional error handler (for logging services like Sentry)
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.group("ErrorBoundary caught an error");
      console.error("Error:", error);
      console.error("Component stack:", errorInfo.componentStack);
      console.groupEnd();
    }

    // Report to error tracking service
    this.reportError(error, errorInfo, eventId);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError || !this.props.resetKeys) return;

    const hasResetKeyChanged = this.props.resetKeys.some(
      (key, index) => key !== prevProps.resetKeys?.[index]
    );

    if (hasResetKeyChanged) {
      this.reset();
    }
  }

  private async reportError(
    error: Error,
    errorInfo: ErrorInfo,
    eventId: string
  ): Promise<void> {
    try {
      await fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Silently fail — we don't want error reporting to cause more errors
    }
  }

  private reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          eventId={this.state.eventId}
          showDetails={this.props.showDetails}
          onReset={this.reset}
        />
      );
    }

    return this.props.children;
  }
}

// ─── Default Fallback UI ────────────────────────────────────────

interface DefaultErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  showDetails?: boolean;
  onReset: () => void;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  eventId,
  showDetails = false,
  onReset,
}: DefaultErrorFallbackProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyErrorDetails = async () => {
    const details = [
      `Error: ${error?.message}`,
      `Event ID: ${eventId}`,
      `Stack: ${error?.stack}`,
      `Component: ${errorInfo?.componentStack}`,
    ].join("\n\n");

    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        {/* Error Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
          <svg
            className="h-8 w-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Message */}
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          An unexpected error occurred. Our team has been notified and is
          working on a fix.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onReset}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900"
          >
            Reload page
          </button>
        </div>

        {/* Event ID */}
        {eventId && (
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Error ID:{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-800">
              {eventId}
            </code>
          </p>
        )}

        {/* Error Details (collapsible) */}
        {(showDetails || process.env.NODE_ENV === "development") && error && (
          <div className="mt-6">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="flex w-full items-center justify-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <svg
                className={`h-3 w-3 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {detailsOpen ? "Hide" : "Show"} error details
            </button>

            {detailsOpen && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left dark:border-gray-700 dark:bg-gray-800/50">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Stack Trace
                  </span>
                  <button
                    onClick={copyErrorDetails}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    {copied ? (
                      <>
                        <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-red-600 dark:text-red-400">
                  {error.message}
                  {"\n\n"}
                  {error.stack}
                </pre>
                {errorInfo?.componentStack && (
                  <>
                    <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Component Stack
                      </span>
                    </div>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-gray-600 dark:text-gray-400">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Convenience Wrapper ────────────────────────────────────────

/**
 * HOC to wrap a component with an error boundary.
 * Usage: const SafeComponent = withErrorBoundary(MyComponent);
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Hook-friendly error boundary wrapper for use in functional components.
 * Usage: <ErrorBoundaryWrapper><MyComponent /></ErrorBoundaryWrapper>
 */
export function ErrorBoundaryWrapper({
  children,
  ...props
}: ErrorBoundaryProps) {
  return <ErrorBoundary {...props}>{children}</ErrorBoundary>;
}
