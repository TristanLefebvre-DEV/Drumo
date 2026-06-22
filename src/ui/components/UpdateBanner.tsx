import { useEffect, useState } from "react";

const formatBytes = (bytes?: number) => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : "";

export const UpdateBanner = () => {
  const [state, setState] = useState<DrumoUpdateState | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    void window.drumApp.updates.getState().then(setState);
    return window.drumApp.updates.onState((next) => { setState(next); setHidden(false); });
  }, []);

  if (!state || hidden || !["available", "downloading", "downloaded", "error"].includes(state.status)) return null;
  const progress = state.status === "downloading" && state.totalBytes ? Math.min(100, (state.downloadedBytes ?? 0) / state.totalBytes * 100) : 0;

  return <aside style={{ position: "fixed", zIndex: 6000, right: 18, bottom: 68, width: 350, padding: 13, borderRadius: 12, background: "var(--bg-1)", border: "1px solid var(--sep-2)", boxShadow: "0 15px 45px rgba(0,0,0,.4)", color: "var(--tx-1)" }}>
    <div style={{ display: "flex", gap: 10 }}><span style={{ display: "grid", placeItems: "center", width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 800 }}>↓</span><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", fontSize: 11 }}>{state.status === "downloaded" ? "Mise à jour prête" : state.status === "error" ? "Mise à jour impossible" : `Drumo ${state.version ?? ""}`}</strong><p style={{ margin: "4px 0 0", color: "var(--tx-3)", fontSize: 9, lineHeight: 1.45 }}>{state.message}</p></div><button type="button" onClick={() => setHidden(true)} aria-label="Masquer" style={{ alignSelf: "start", border: 0, background: "transparent", color: "var(--tx-4)", cursor: "pointer" }}>×</button></div>
    {state.notes && state.status === "available" && <p style={{ margin: "9px 0 0", paddingTop: 8, borderTop: "1px solid var(--sep)", color: "var(--tx-3)", fontSize: 9, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "auto" }}>{state.notes}</p>}
    {state.status === "downloading" && <div style={{ marginTop: 10 }}><div style={{ height: 4, overflow: "hidden", borderRadius: 99, background: "var(--bg-3)" }}><div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width .2s" }} /></div><small style={{ display: "block", marginTop: 4, color: "var(--tx-4)", fontSize: 8 }}>{formatBytes(state.downloadedBytes)} / {formatBytes(state.totalBytes)}</small></div>}
    {state.status === "available" && <button type="button" onClick={() => void window.drumApp.updates.download()} style={{ width: "100%", height: 30, marginTop: 10, border: 0, borderRadius: 7, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 9, cursor: "pointer" }}>Télécharger en arrière-plan</button>}
    {state.status === "downloaded" && <button type="button" onClick={() => void window.drumApp.updates.install()} style={{ width: "100%", height: 30, marginTop: 10, border: 0, borderRadius: 7, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 9, cursor: "pointer" }}>Redémarrer et installer</button>}
  </aside>;
};
