import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface AuthValue {
  token: string; user: DrumoUser; settings: DrumoSettings;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateSettings: (settings: DrumoSettings) => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const sessionKey = "drumo_session";
const field: React.CSSProperties = { width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: "1px solid var(--sep-2)", background: "var(--bg-2)", color: "var(--tx-1)", outline: "none" };
const button: React.CSSProperties = { width: "100%", height: 36, marginTop: 16, border: 0, borderRadius: 8, background: "var(--accent)", color: "#fff", fontWeight: 700, cursor: "pointer" };

export const unwrapBackend = <T,>(result: BackendResult<T>): T => {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
};
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Contexte d'authentification absent");
  return value;
};

const Login = ({ login, register }: { login: (username: string, password: string) => Promise<void>; register: (username: string, password: string) => Promise<void> }) => {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(""); const [creating, setCreating] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    if (creating && password !== confirm) { setBusy(false); setError("Les mots de passe ne correspondent pas."); return; }
    try { creating ? await register(username, password) : await login(username, password); } catch (reason) { setError(reason instanceof Error ? reason.message : creating ? "Inscription impossible" : "Connexion impossible"); }
    finally { setBusy(false); }
  };
  return <div className="app-bg" style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--tx-1)" }}>
    <form onSubmit={(event) => void submit(event)} style={{ width: 340, padding: 28, borderRadius: 16, background: "var(--bg-1)", border: "1px solid var(--sep-2)", boxShadow: "var(--shadow-lg)" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 24 }}><b style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12, color: "var(--accent)", background: "var(--accent-dim)" }}>D</b><div><strong style={{ letterSpacing: ".08em" }}>DRUMO</strong><small style={{ display: "block", color: "var(--tx-4)" }}>Groove Studio</small></div></div>
      <h1 style={{ fontSize: 16, margin: "0 0 5px" }}>{creating ? "Créer un compte" : "Connexion"}</h1><p style={{ fontSize: 11, color: "var(--tx-3)", margin: "0 0 18px" }}>{creating ? "Crée ton espace personnel Drumo." : "Retrouve tes cours et tes projets."}</p>
      <label style={{ fontSize: 10, color: "var(--tx-3)" }}>Identifiant<input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ ...field, marginTop: 5 }} /></label>
      <label style={{ display: "block", fontSize: 10, color: "var(--tx-3)", marginTop: 12 }}>Mot de passe{creating ? " (8 caractères minimum)" : ""}<input type="password" autoComplete={creating ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...field, marginTop: 5 }} /></label>
      {creating && <label style={{ display: "block", fontSize: 10, color: "var(--tx-3)", marginTop: 12 }}>Confirmer le mot de passe<input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ ...field, marginTop: 5 }} /></label>}
      {error && <p style={{ color: "var(--c-red)", fontSize: 11 }}>{error}</p>}
      <button disabled={busy || username.length < 3 || !password || (creating && (password.length < 8 || !confirm))} style={{ ...button, opacity: username.length < 3 || !password || (creating && (password.length < 8 || !confirm)) ? .45 : 1 }}>{busy ? "Patiente…" : creating ? "Créer mon compte" : "Se connecter"}</button>
      <button type="button" disabled={busy} onClick={() => { setCreating((value) => !value); setError(""); setPassword(""); setConfirm(""); }} style={{ width: "100%", marginTop: 12, border: 0, background: "transparent", color: "var(--accent)", fontSize: 10, cursor: "pointer" }}>{creating ? "J’ai déjà un compte" : "Créer un compte utilisateur"}</button>
    </form>
  </div>;
};

const ChangePassword = ({ save }: { save: (current: string, next: string) => Promise<void> }) => {
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (next !== confirm) return setError("Les mots de passe ne correspondent pas.");
    try { await save(current, next); } catch (reason) { setError(reason instanceof Error ? reason.message : "Modification impossible"); }
  };
  return <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)" }}>
    <form onSubmit={(e) => void submit(e)} style={{ width: 380, padding: 24, borderRadius: 14, background: "var(--bg-1)", border: "1px solid var(--sep-2)" }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Sécurise ton compte</h2><p style={{ color: "var(--tx-3)", fontSize: 11 }}>Remplace le mot de passe initial avant de continuer.</p>
      {[{ l: "Mot de passe actuel", v: current, s: setCurrent }, { l: "Nouveau mot de passe (8 caractères minimum)", v: next, s: setNext }, { l: "Confirmation", v: confirm, s: setConfirm }].map((x) => <label key={x.l} style={{ display: "block", marginTop: 11, fontSize: 10, color: "var(--tx-3)" }}>{x.l}<input type="password" value={x.v} onChange={(e) => x.s(e.target.value)} style={{ ...field, marginTop: 5 }} /></label>)}
      {error && <p style={{ color: "var(--c-red)", fontSize: 11 }}>{error}</p>}<button disabled={!current || next.length < 8 || !confirm} style={{ ...button, opacity: !current || next.length < 8 || !confirm ? .45 : 1 }}>Changer le mot de passe</button>
    </form>
  </div>;
};

const Maintenance = ({ user, logout }: { user: DrumoUser; logout: () => Promise<void> }) => <div className="app-bg" style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--tx-1)" }}><div style={{ width: 430, textAlign: "center", padding: 32, borderRadius: 16, background: "var(--bg-1)", border: "1px solid var(--sep-2)" }}><div style={{ fontSize: 32, color: "var(--c-orange)" }}>⌁</div><h1 style={{ fontSize: 19 }}>Drumo est en maintenance</h1><p style={{ color: "var(--tx-3)", fontSize: 12, lineHeight: 1.6 }}>Une mise à jour est en cours. Tes projets sont conservés et seront disponibles à la réouverture.</p><button onClick={() => void logout()} style={{ ...button, width: "auto", padding: "0 16px", background: "var(--bg-3)", color: "var(--tx-2)" }}>Déconnecter {user.username}</button></div></div>;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<{ token: string; user: DrumoUser; settings: DrumoSettings } | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { const token = sessionStorage.getItem(sessionKey); if (!token) return setLoading(false); window.drumApp.backend.me(token).then((r) => { if (r.ok) setState({ token, ...r.data }); else sessionStorage.removeItem(sessionKey); }).finally(() => setLoading(false)); }, []);
  const login = useCallback(async (username: string, password: string) => { const data = unwrapBackend(await window.drumApp.backend.login({ username, password })); sessionStorage.setItem(sessionKey, data.token); setState(data); }, []);
  const register = useCallback(async (username: string, password: string) => { const data = unwrapBackend(await window.drumApp.backend.register({ username, password })); sessionStorage.setItem(sessionKey, data.token); setState(data); }, []);
  const logout = useCallback(async () => { if (state) await window.drumApp.backend.logout(state.token); sessionStorage.removeItem(sessionKey); setState(null); }, [state]);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => { if (!state) return; const user = unwrapBackend(await window.drumApp.backend.changePassword(state.token, { currentPassword, newPassword })); setState({ ...state, user }); }, [state]);
  const updateSettings = useCallback((settings: DrumoSettings) => setState((s) => s ? { ...s, settings } : s), []);
  useEffect(() => {
    if (!state) return;
    const refresh = async () => {
      const result = await window.drumApp.backend.me(state.token);
      if (result.ok) setState((current) => current?.token === state.token ? { token: state.token, ...result.data } : current);
      else if (result.error.code === "UNAUTHORIZED") {
        sessionStorage.removeItem(sessionKey);
        setState(null);
      }
    };
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [state?.token]);
  const value = useMemo(() => state ? { ...state, logout, changePassword, updateSettings } : null, [state, logout, changePassword, updateSettings]);
  if (loading) return <div className="app-bg" style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--tx-3)" }}>Ouverture de Drumo…</div>;
  if (!state || !value) return <Login login={login} register={register} />;
  if (state.settings.maintenance && state.user.role !== "admin") return <Maintenance user={state.user} logout={logout} />;
  return <AuthContext.Provider value={value}>{children}{state.user.mustChangePassword && <ChangePassword save={changePassword} />}</AuthContext.Provider>;
};
