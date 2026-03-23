import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import ThemeProvider from "./utils/ThemeContext";
import App from "./App";
import "./i18n";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Uncaught error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem", color: "#1f2937" }}>Something went wrong</h1>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>An unexpected error occurred. Please reload the page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "0.5rem 1.5rem", borderRadius: "0.5rem", backgroundColor: "#456564", color: "white", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

if (localStorage.getItem("sidebar-expanded") === "true") {
  document.body.classList.add("sidebar-expanded");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
