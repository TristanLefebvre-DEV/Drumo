import { useCallback, useEffect, useState } from "react";
import { exportProjectToMidiBytes } from "../../core/midiExporter";
import type { ParsedDrumProject, QuantizeOptions } from "../../core/types";
import { useProjectStore } from "../../store/projectStore";
import { unwrapBackend, useAuth } from "../AuthContext";

interface StoredProjectData { project?: ParsedDrumProject; quantizeOptions?: Partial<QuantizeOptions> }

export const SavedProjectsPage = ({ onOpenInComposer }: { onOpenInComposer?: () => void }) => {
  const { token, user } = useAuth();
  const { project, quantizeOptions, loadMidi, loadProjectData } = useProjectStore();
  const [scores, setScores] = useState<DrumoScore[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setScores(unwrapBackend(await window.drumApp.backend.listScores(token))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible."); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (project?.sourceName && !title) setTitle(project.sourceName.replace(/\.midi?$/i, "")); }, [project?.sourceName, title]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project) return;
    setBusy(true); setError(""); setNotice("");
    try {
      unwrapBackend(await window.drumApp.backend.saveScore(token, {
        title, description, midiBytes: exportProjectToMidiBytes(project), projectData: { project, quantizeOptions },
      }));
      setDescription(""); setNotice("Partition enregistrée dans votre bibliothèque.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sauvegarde impossible."); }
    finally { setBusy(false); }
  };

  const open = async (score: DrumoScore) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const stored = unwrapBackend(await window.drumApp.backend.getScore(token, score.id));
      const data = stored.projectData as StoredProjectData | undefined;
      if (data?.project && Array.isArray(data.project.hits)) loadProjectData({ project: data.project, quantizeOptions: data.quantizeOptions });
      else loadMidi({ bytes: stored.midiBytes, filePath: `${stored.title}.mid` });
      setNotice(`« ${stored.title} » est ouvert dans Composer.`);
      onOpenInComposer?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ouverture impossible."); }
    finally { setBusy(false); }
  };

  const remove = async (score: DrumoScore) => {
    if (!confirm(`Supprimer « ${score.title} » de la bibliothèque ?`)) return;
    setBusy(true); setError("");
    try { unwrapBackend(await window.drumApp.backend.deleteScore(token, score.id)); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Suppression impossible."); }
    finally { setBusy(false); }
  };

  return <div style={{ height: "100%", overflow: "auto", padding: 16, boxSizing: "border-box", background: "var(--bg-app)" }}>
    <div style={{ maxWidth: 950, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}><h2 style={{ margin: 0, fontSize: 16 }}>Mes projets Drumo</h2><p style={{ margin: "5px 0 0", fontSize: 10, color: "var(--tx-4)" }}>MIDI et données d’édition sauvegardés de façon persistante dans votre compte.</p></div>
      {(error || notice) && <div style={{ marginBottom: 11, padding: "8px 11px", borderRadius: 8, fontSize: 10, color: error ? "var(--c-red)" : "var(--c-green)", background: "var(--bg-2)", border: "1px solid var(--sep)" }}>{error || notice}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "290px minmax(0,1fr)", gap: 12 }}>
        <form onSubmit={(event) => void save(event)} style={{ padding: 15, borderRadius: 11, alignSelf: "start", background: "var(--bg-1)", border: "1px solid var(--sep)" }}>
          <h3 style={{ margin: "0 0 5px", fontSize: 12 }}>Sauvegarder le projet courant</h3>
          {!project && <p style={{ color: "var(--c-orange)", fontSize: 10 }}>Ouvrez ou créez une partition dans Composer avant de la sauvegarder.</p>}
          <label style={{ display: "block", marginTop: 10, color: "var(--tx-3)", fontSize: 9 }}>Titre<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} style={{ width: "100%", height: 33, boxSizing: "border-box", marginTop: 5, padding: "0 9px", borderRadius: 7, border: "1px solid var(--sep-2)", background: "var(--bg-2)", color: "var(--tx-1)" }} /></label>
          <label style={{ display: "block", marginTop: 9, color: "var(--tx-3)", fontSize: 9 }}>Description (facultative)<textarea maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} style={{ width: "100%", minHeight: 70, boxSizing: "border-box", marginTop: 5, padding: 9, resize: "vertical", borderRadius: 7, border: "1px solid var(--sep-2)", background: "var(--bg-2)", color: "var(--tx-1)" }} /></label>
          <button disabled={!project || !title.trim() || busy} style={{ width: "100%", height: 33, marginTop: 11, border: 0, borderRadius: 7, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 10, cursor: "pointer", opacity: !project || !title.trim() || busy ? .45 : 1 }}>Enregistrer dans la bibliothèque</button>
        </form>
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {scores.map((score) => <article key={score.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--bg-1)", border: "1px solid var(--sep)" }}>
            <div><strong style={{ fontSize: 12 }}>{score.title}</strong>{user.role === "admin" && <span style={{ marginLeft: 7, fontSize: 9, color: "var(--accent)" }}>par {score.authorName}</span>}<p style={{ margin: "5px 0", color: "var(--tx-3)", fontSize: 10, lineHeight: 1.45 }}>{score.description || "Aucune description"}</p><span style={{ color: "var(--tx-4)", fontSize: 9 }}>{new Date(score.createdAt).toLocaleString("fr-FR")} · {(score.midiSize / 1024).toFixed(1)} Ko</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><button disabled={busy} onClick={() => void open(score)} style={{ height: 29, padding: "0 10px", borderRadius: 6, border: "1px solid var(--accent-line)", background: "var(--accent-dim)", color: "var(--accent)", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Ouvrir</button><button disabled={busy} onClick={() => void remove(score)} title="Supprimer" style={{ width: 29, height: 29, borderRadius: 6, border: "1px solid var(--sep-2)", background: "var(--bg-2)", color: "var(--c-red)", cursor: "pointer" }}>×</button></div>
          </article>)}
          {!scores.length && <div style={{ padding: 28, textAlign: "center", borderRadius: 10, border: "1px dashed var(--sep-2)", color: "var(--tx-4)", fontSize: 11 }}>Aucun projet sauvegardé pour le moment.</div>}
        </section>
      </div>
    </div>
  </div>;
};
