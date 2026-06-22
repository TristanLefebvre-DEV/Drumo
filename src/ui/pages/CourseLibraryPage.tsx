import { useEffect, useMemo, useState } from "react";
import { unwrapBackend, useAuth } from "../AuthContext";

export const CourseLibraryPage = () => {
  const { token } = useAuth();
  const [courses, setCourses] = useState<DrumoCourse[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { window.drumApp.backend.listCourses(token).then((result) => { try { const data = unwrapBackend(result); setCourses(data); setSelected((current) => current ?? data[0]?.id ?? null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible"); } }); }, [token]);
  const filtered = useMemo(() => { const needle = query.toLocaleLowerCase("fr-FR"); return courses.filter((course) => `${course.title} ${course.description} ${course.tags.join(" ")}`.toLocaleLowerCase("fr-FR").includes(needle)); }, [courses, query]);
  const active = courses.find((course) => course.id === selected);
  return <div style={{ height: "100%", display: "flex", gap: 14, padding: 14, boxSizing: "border-box", background: "var(--bg-app)" }}>
    <aside style={{ width: 320, display: "flex", flexDirection: "column", gap: 9, minHeight: 0 }}>
      <div><h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Cours</h2><p style={{ color: "var(--tx-3)", fontSize: 11, margin: 0 }}>{courses.length} ressource{courses.length > 1 ? "s" : ""} pédagogique{courses.length > 1 ? "s" : ""}</p></div>
      <input placeholder="Rechercher un cours…" value={query} onChange={(event) => setQuery(event.target.value)} style={{ height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid var(--sep-2)", background: "var(--bg-2)", color: "var(--tx-1)", outline: "none" }} />
      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
        {filtered.map((course) => <button key={course.id} onClick={() => setSelected(course.id)} style={{ textAlign: "left", padding: "11px 12px", borderRadius: 10, cursor: "pointer", background: selected === course.id ? "var(--accent-dim)" : "var(--bg-2)", border: `1px solid ${selected === course.id ? "var(--accent-line)" : "var(--sep-2)"}`, color: "var(--tx-1)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 12 }}>{course.title}</strong><span style={{ fontSize: 9, color: "var(--accent)" }}>{course.level}</span></div><p style={{ margin: "5px 0 0", fontSize: 10, lineHeight: 1.4, color: "var(--tx-3)" }}>{course.description}</p></button>)}
        {!filtered.length && <p style={{ padding: 14, color: "var(--tx-4)", fontSize: 11 }}>{error || "Aucun cours trouvé."}</p>}
      </div>
    </aside>
    <article style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "22px 26px", borderRadius: 12, background: "var(--bg-1)", border: "1px solid var(--sep)" }}>
      {active ? <><div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{active.tags.map((tag) => <span key={tag} style={{ padding: "3px 7px", borderRadius: 999, fontSize: 9, background: "var(--bg-3)", color: "var(--tx-3)" }}>#{tag}</span>)}</div><h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{active.title}</h1><p style={{ color: "var(--tx-3)", fontSize: 12, lineHeight: 1.6, margin: "0 0 22px" }}>{active.description}</p><div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: "var(--tx-2)", paddingTop: 18, borderTop: "1px solid var(--sep)" }}>{active.content}</div><p style={{ marginTop: 28, fontSize: 9, color: "var(--tx-4)" }}>Par {active.authorName} · Mis à jour le {new Date(active.updatedAt).toLocaleDateString("fr-FR")}</p></> : <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--tx-4)" }}>Sélectionne un cours.</div>}
    </article>
  </div>;
};
