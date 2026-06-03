import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../ui/pages/AppShell";
import { SplashScreen } from "../ui/components/SplashScreen";
import "./styles/index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: 32, fontFamily: "monospace", color: "#f87171", background: "#09090b", minHeight: "100vh" }}>
          <h2 style={{ color: "#fca5a5", marginBottom: 12 }}>⚠ Erreur de rendu</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#fbbf24", marginBottom: 16 }}>{err.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#52525b" }}>{err.stack}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: "8px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Root = () => {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {/* App shell is always mounted so it loads in background during splash */}
      <div style={{ visibility: splashDone ? "visible" : "hidden", height: "100%" }}>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </div>

      {/* Splash sits on top until onComplete fires */}
      {!splashDone && (
        <SplashScreen onComplete={() => setSplashDone(true)} duration={3800} />
      )}
    </>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
