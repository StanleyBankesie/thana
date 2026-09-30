/**
 * @fileoverview ErrorBoundary component.
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 */

import React from "react";

/**
 * ErrorBoundary component class
 * Wraps other components to catch rendering errors.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Updates state to show fallback UI on next render.
   * @param {Error} error - The error caught.
   * @returns {Object} Updated state.
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Logs error information.
   * @param {Error} error - The error caught.
   * @param {Object} info - Additional component stack info.
   */
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  /**
   * Renders fallback UI if an error exists, otherwise renders children.
   * @returns {JSX.Element}
   */
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: "40px",
          fontFamily: "sans-serif", textAlign: "center", background: "#f8f9fa"
        }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "12px", color: "#dc3545" }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: "24px", maxWidth: "480px" }}>
            The application encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "12px 32px", fontSize: "16px", fontWeight: 600,
              color: "#fff", background: "#0d6efd", border: "none",
              borderRadius: "8px", cursor: "pointer"
            }}
          >
            Try Again
          </button>
          {this.state.error && (
            <details open style={{ marginTop: "24px", color: "#999", fontSize: "12px" }}>
              <summary>Error details</summary>
              <pre style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
