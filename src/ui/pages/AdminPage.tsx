import { useCallback, useEffect, useState } from "react";
import { unwrapBackend, useAuth } from "../AuthContext";

const panel: React.CSSProperties = {
  background: "var(--bg-1)", border: "1px solid var(--sep)", borderRadius: 12, padding: 16,
};
const field: React.CSSProperties = {
  height: 34, borderRadius: 7, border: "1px solid var(--sep-2)", background: "var(--bg-2)",
  color: "var(--tx-1)", padding: "0 10px", outline: "none", boxSizing: "border-box",
};
const action: React.CSSProperties = {
  height: 32, borderRadius: 7, border: "1px solid var(--accent-line)", background: "var(--accent-dim)",
  color: "var(--accent)", padding: "0 12px", fontWeight: 650, fontSize: 11, cursor: "pointer",
};

type AdminTab = "users" | "courses" | "system";

const Toggle = ({ checked, onChange, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    style={{
      width: 38, height: 22, padding: 2, borderRadius: 999, border: "1px solid var(--sep-2)",
      background: checked ? "var(--accent)" : "var(--bg-3)", opacity: disabled ? .45 : 1,
      cursor: disabled ? "not-allowed" : "pointer", transition: "background .15s",
    }}
  >
    <span style={{ display: "block", width: 16, height: 16, borderRadius: "50%", background: "#fff", transform: `translateX(${checked ? 16 : 0}px)`, transition: "transform .15s" }} />
  </button>
);

export const AdminPage = () => {
  const { token, user: actor, settings, updateSettings } = useAuth();
  const [tab, setTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<DrumoUser[]>([]);
  const [courses, setCourses] = useState<DrumoCourse[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedUrl, setFeedUrl] = useState(settings.updateFeedUrl ?? "");
  const [updateState, setUpdateState] = useState<DrumoUpdateState | null>(null);
  const [serverConnection, setServerConnection] = useState<{ mode: "local" | "central"; apiUrl: string } | null>(null);
  const [serverApiUrl, setServerApiUrl] = useState(""); const [serverMessage, setServerMessage] = useState("");
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" as DrumoRole });
  const [course, setCourse] = useState({ id: "", title: "", description: "", content: "", level: "Tous niveaux", tags: "", published: true });

  const report = (reason: unknown) => {
    setNotice("");
    setError(reason instanceof Error ? reason.message : "Une erreur est survenue.");
  };

  const refresh = useCallback(async () => {
    if (actor.role !== "admin") return;
    try {
      const [nextUsers, nextCourses] = await Promise.all([
        window.drumApp.backend.listUsers(token),
        window.drumApp.backend.listCourses(token),
      ]);
      setUsers(unwrapBackend(nextUsers));
      setCourses(unwrapBackend(nextCourses));
    } catch (reason) { report(reason); }
  }, [actor.role, token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => setFeedUrl(settings.updateFeedUrl ?? ""), [settings.updateFeedUrl]);
  useEffect(() => {
    void window.drumApp.updates.getState().then(setUpdateState);
    return window.drumApp.updates.onState(setUpdateState);
  }, []);
  useEffect(() => { void window.drumApp.connection.get().then((value) => { setServerConnection(value); setServerApiUrl(value.apiUrl); }); }, []);

  if (actor.role !== "admin") {
    return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--c-red)" }}>Accès administrateur requis.</div>;
  }

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      unwrapBackend(await window.drumApp.backend.createUser(token, newUser));
      setNewUser({ username: "", password: "", role: "user" });
      setNotice("Compte créé. Le changement de mot de passe sera demandé à la première connexion.");
      await refresh();
    } catch (reason) { report(reason); } finally { setBusy(false); }
  };

  const updateUser = async (target: DrumoUser, patch: Partial<Pick<DrumoUser, "role" | "active">>) => {
    setBusy(true); setError("");
    try {
      const updated = unwrapBackend(await window.drumApp.backend.updateUser(token, { id: target.id, role: patch.role ?? target.role, active: patch.active ?? target.active }));
      setUsers((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Compte ${updated.username} mis à jour.`);
    } catch (reason) { report(reason); } finally { setBusy(false); }
  };

  const editCourse = (item?: DrumoCourse) => setCourse(item ? {
    id: item.id, title: item.title, description: item.description, content: item.content,
    level: item.level, tags: item.tags.join(", "), published: item.published,
  } : { id: "", title: "", description: "", content: "", level: "Tous niveaux", tags: "", published: true });

  const saveCourse = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      unwrapBackend(await window.drumApp.backend.saveCourse(token, { ...course, tags: course.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }));
      editCourse();
      setNotice("Cours enregistré dans la bibliothèque.");
      await refresh();
    } catch (reason) { report(reason); } finally { setBusy(false); }
  };

  const deleteCourse = async (item: DrumoCourse) => {
    if (!confirm(`Supprimer le cours « ${item.title} » ?`)) return;
    setBusy(true); setError("");
    try {
      unwrapBackend(await window.drumApp.backend.deleteCourse(token, item.id));
      if (course.id === item.id) editCourse();
      setNotice("Cours supprimé.");
      await refresh();
    } catch (reason) { report(reason); } finally { setBusy(false); }
  };

  const patchSettings = async (patch: Partial<DrumoSettings>) => {
    setBusy(true); setError("");
    try {
      const next = unwrapBackend(await window.drumApp.backend.updateConfig(token, patch));
      updateSettings(next);
      setNotice("Configuration enregistrée.");
    } catch (reason) { report(reason); } finally { setBusy(false); }
  };

  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: "users", label: `Utilisateurs (${users.length})` },
    { id: "courses", label: `Cours (${courses.length})` },
    { id: "system", label: "Système" },
  ];

  return <div style={{ height: "100%", overflow: "auto", padding: 16, boxSizing: "border-box", background: "var(--bg-app)" }}>
    <div style={{ maxWidth: 1050, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 14 }}>
        <div><h1 style={{ margin: 0, fontSize: 20 }}>Administration</h1><p style={{ margin: "5px 0 0", color: "var(--tx-3)", fontSize: 11 }}>Comptes, contenu pédagogique et disponibilité de Drumo.</p></div>
        <span style={{ color: "var(--c-green)", fontSize: 10 }}>● Backend local actif</span>
      </div>
      <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} style={{ ...action, background: tab === item.id ? "var(--accent)" : "var(--bg-2)", color: tab === item.id ? "#fff" : "var(--tx-3)", borderColor: tab === item.id ? "var(--accent)" : "var(--sep-2)" }}>{item.label}</button>)}
      </div>
      {(error || notice) && <div role="status" style={{ marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11, color: error ? "var(--c-red)" : "var(--c-green)", background: error ? "rgba(255,69,58,.09)" : "rgba(48,209,88,.09)", border: `1px solid ${error ? "rgba(255,69,58,.2)" : "rgba(48,209,88,.2)"}` }}>{error || notice}</div>}

      {tab === "users" && <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 290px", gap: 12 }}>
        <section style={panel}>
          <h2 style={{ margin: "0 0 12px", fontSize: 13 }}>Comptes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {users.map((item) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 120px 90px", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 9, background: "var(--bg-2)", border: "1px solid var(--sep)" }}>
              <div><strong style={{ fontSize: 12 }}>{item.username}</strong>{item.id === actor.id && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--accent)" }}>vous</span>}<div style={{ color: "var(--tx-4)", fontSize: 9, marginTop: 3 }}>Créé le {new Date(item.createdAt).toLocaleDateString("fr-FR")}</div></div>
              <select aria-label={`Rôle de ${item.username}`} disabled={busy} value={item.role} onChange={(event) => void updateUser(item, { role: event.target.value as DrumoRole })} style={{ ...field, width: "100%" }}><option value="user">Utilisateur</option><option value="admin">Admin</option></select>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Toggle checked={item.active} disabled={busy} onChange={(active) => void updateUser(item, { active })} /><span style={{ fontSize: 10, color: item.active ? "var(--c-green)" : "var(--tx-4)" }}>{item.active ? "Actif" : "Inactif"}</span></div>
            </div>)}
          </div>
        </section>
        <form onSubmit={(event) => void createUser(event)} style={{ ...panel, alignSelf: "start" }}>
          <h2 style={{ margin: "0 0 5px", fontSize: 13 }}>Nouveau compte</h2><p style={{ margin: "0 0 13px", color: "var(--tx-4)", fontSize: 10 }}>Le mot de passe temporaire doit contenir 8 caractères minimum.</p>
          <label style={{ display: "block", fontSize: 10, color: "var(--tx-3)" }}>Identifiant<input required minLength={3} value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} style={{ ...field, width: "100%", marginTop: 5 }} /></label>
          <label style={{ display: "block", marginTop: 10, fontSize: 10, color: "var(--tx-3)" }}>Mot de passe temporaire<input required type="password" minLength={8} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} style={{ ...field, width: "100%", marginTop: 5 }} /></label>
          <label style={{ display: "block", marginTop: 10, fontSize: 10, color: "var(--tx-3)" }}>Rôle<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value as DrumoRole })} style={{ ...field, width: "100%", marginTop: 5 }}><option value="user">Utilisateur</option><option value="admin">Admin</option></select></label>
          <button disabled={busy} style={{ ...action, width: "100%", marginTop: 14, opacity: busy ? .5 : 1 }}>Créer le compte</button>
        </form>
      </div>}

      {tab === "courses" && <div style={{ display: "grid", gridTemplateColumns: "330px minmax(0,1fr)", gap: 12 }}>
        <section style={panel}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 13 }}>Bibliothèque de cours</h2><button type="button" onClick={() => editCourse()} style={action}>+ Nouveau</button></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{courses.map((item) => <div key={item.id} style={{ padding: 10, borderRadius: 9, background: course.id === item.id ? "var(--accent-dim)" : "var(--bg-2)", border: `1px solid ${course.id === item.id ? "var(--accent-line)" : "var(--sep)"}` }}><button type="button" onClick={() => editCourse(item)} style={{ display: "block", width: "100%", padding: 0, textAlign: "left", border: 0, background: "transparent", color: "var(--tx-1)", cursor: "pointer" }}><strong style={{ fontSize: 11 }}>{item.title}</strong><div style={{ marginTop: 4, fontSize: 9, color: "var(--tx-4)" }}>{item.level} · {item.published ? "Publié" : "Brouillon"}</div></button><button type="button" disabled={busy} onClick={() => void deleteCourse(item)} style={{ marginTop: 7, padding: 0, border: 0, background: "transparent", color: "var(--c-red)", fontSize: 9, cursor: "pointer" }}>Supprimer</button></div>)}</div>
        </section>
        <form onSubmit={(event) => void saveCourse(event)} style={panel}>
          <h2 style={{ margin: "0 0 12px", fontSize: 13 }}>{course.id ? "Modifier le cours" : "Nouveau cours"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 9 }}><label style={{ fontSize: 10, color: "var(--tx-3)" }}>Titre<input required value={course.title} onChange={(event) => setCourse({ ...course, title: event.target.value })} style={{ ...field, width: "100%", marginTop: 5 }} /></label><label style={{ fontSize: 10, color: "var(--tx-3)" }}>Niveau<input required value={course.level} onChange={(event) => setCourse({ ...course, level: event.target.value })} style={{ ...field, width: "100%", marginTop: 5 }} /></label></div>
          <label style={{ display: "block", marginTop: 9, fontSize: 10, color: "var(--tx-3)" }}>Description<textarea value={course.description} onChange={(event) => setCourse({ ...course, description: event.target.value })} style={{ ...field, width: "100%", minHeight: 64, padding: 9, resize: "vertical", marginTop: 5 }} /></label>
          <label style={{ display: "block", marginTop: 9, fontSize: 10, color: "var(--tx-3)" }}>Contenu<textarea required value={course.content} onChange={(event) => setCourse({ ...course, content: event.target.value })} style={{ ...field, width: "100%", minHeight: 230, padding: 10, lineHeight: 1.55, resize: "vertical", marginTop: 5 }} /></label>
          <label style={{ display: "block", marginTop: 9, fontSize: 10, color: "var(--tx-3)" }}>Tags séparés par des virgules<input value={course.tags} onChange={(event) => setCourse({ ...course, tags: event.target.value })} style={{ ...field, width: "100%", marginTop: 5 }} /></label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13 }}><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--tx-3)" }}><Toggle checked={course.published} onChange={(published) => setCourse({ ...course, published })} />Visible par les utilisateurs</label><button disabled={busy} style={action}>Enregistrer</button></div>
        </form>
      </div>}

      {tab === "system" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <section style={panel}><h2 style={{ margin: "0 0 8px", fontSize: 13 }}>Mode maintenance</h2><p style={{ color: "var(--tx-3)", fontSize: 11, lineHeight: 1.55 }}>Bloque l’application et les fonctions backend pour les utilisateurs normaux. Les administrateurs conservent l’accès à ce panneau.</p><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--sep)" }}><strong style={{ fontSize: 11 }}>{settings.maintenance ? "Maintenance active" : "Application disponible"}</strong><Toggle disabled={busy} checked={settings.maintenance} onChange={(maintenance) => void patchSettings({ maintenance })} /></div></section>
        <section style={panel}><h2 style={{ margin: "0 0 8px", fontSize: 13 }}>Coach IA local</h2><p style={{ color: "var(--tx-3)", fontSize: 11, lineHeight: 1.55 }}>Active l’assistant pédagogique contextuel. Son moteur fonctionne hors ligne : aucune clé ni donnée de projet n’est envoyée sur Internet.</p><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--sep)" }}><strong style={{ fontSize: 11 }}>{settings.coachEnabled ? "Coach disponible" : "Coach désactivé"}</strong><Toggle disabled={busy} checked={settings.coachEnabled} onChange={(coachEnabled) => void patchSettings({ coachEnabled })} /></div></section>
        <section style={{ ...panel, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 20 }}><div><h2 style={{ margin: "0 0 8px", fontSize: 13 }}>Mises à jour connectées</h2><p style={{ margin: 0, color: "var(--tx-3)", fontSize: 11, lineHeight: 1.55 }}>Drumo vérifie ce manifeste HTTPS, télécharge le nouvel installateur, contrôle son empreinte SHA-256 puis propose un redémarrage automatique.</p></div><label style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", color: "var(--tx-3)", fontSize: 10 }}><Toggle disabled={busy} checked={settings.updatesEnabled} onChange={(updatesEnabled) => void patchSettings({ updatesEnabled })} />Automatiques</label></div>
          <div style={{ display: "flex", gap: 7, marginTop: 13 }}><input aria-label="Adresse du manifeste de mises à jour" value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} placeholder="https://votre-serveur.fr/drumo/latest.json" style={{ ...field, minWidth: 0, flex: 1 }} /><button type="button" disabled={busy} onClick={() => void patchSettings({ updateFeedUrl: feedUrl })} style={action}>Enregistrer</button><button type="button" disabled={busy || !settings.updateFeedUrl} onClick={() => void window.drumApp.updates.check()} style={{ ...action, background: "var(--bg-2)", color: "var(--tx-2)", borderColor: "var(--sep-2)" }}>Vérifier maintenant</button></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, color: "var(--tx-4)", fontSize: 9 }}><span>Version installée : {updateState?.currentVersion ?? "—"}</span><span>{updateState?.message ?? (settings.updateFeedUrl ? "Prêt à vérifier" : "Ajoutez l’adresse du manifeste central.")}</span></div>
        </section>
        <section style={{ ...panel, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><div><h2 style={{ margin: "0 0 8px", fontSize: 13 }}>Comptes centralisés</h2><p style={{ margin: 0, color: "var(--tx-3)", fontSize: 11, lineHeight: 1.55 }}>Toutes les installations utilisant cette API partagent les mêmes utilisateurs, rôles, cours et projets.</p></div><strong style={{ color: serverConnection?.mode === "central" ? "var(--c-green)" : "var(--c-orange)", fontSize: 10, whiteSpace: "nowrap" }}>● {serverConnection?.mode === "central" ? "Serveur central" : "Stockage local"}</strong></div>
          <div style={{ display: "flex", gap: 7, marginTop: 13 }}><input aria-label="Adresse de l'API centrale" value={serverApiUrl} onChange={(event) => setServerApiUrl(event.target.value)} placeholder="https://api.votre-domaine.fr" style={{ ...field, minWidth: 0, flex: 1 }} /><button type="button" onClick={() => void window.drumApp.connection.test({ apiUrl: serverApiUrl }).then((result) => setServerMessage(result.message))} style={{ ...action, background: "var(--bg-2)", color: "var(--tx-2)", borderColor: "var(--sep-2)" }}>Tester</button><button type="button" onClick={() => void window.drumApp.connection.set({ apiUrl: serverApiUrl })} style={action}>Appliquer et relancer</button></div>
          {serverMessage && <p style={{ margin: "8px 0 0", color: "var(--tx-4)", fontSize: 9 }}>{serverMessage}</p>}
        </section>
      </div>}
    </div>
  </div>;
};
