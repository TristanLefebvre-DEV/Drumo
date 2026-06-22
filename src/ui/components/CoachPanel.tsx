import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { unwrapBackend, useAuth } from "../AuthContext";

interface Message { id: string; role: "user" | "coach"; text: string }

export const CoachPanel = () => {
  const { token, settings } = useAuth();
  const project = useProjectStore((state) => state.project);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "coach", text: "Salut ! Je peux t’aider à travailler le groove, la coordination, les fills ou le tempo de ton projet." }]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  if (!settings.coachEnabled) return null;

  const send = async (text = input) => {
    const question = text.trim(); if (!question || busy) return;
    setInput(""); setBusy(true);
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: question }]);
    try {
      const response = unwrapBackend(await window.drumApp.backend.coach(token, { message: question, context: { projectName: project?.sourceName, bpm: project?.tempoBpm, hits: project?.hits.length } }));
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "coach", text: response.answer }]);
    } catch (reason) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "coach", text: reason instanceof Error ? reason.message : "Je ne peux pas répondre pour le moment." }]);
    } finally { setBusy(false); }
  };

  return <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 5000, fontFamily: "inherit" }}>
    {open && <section aria-label="Coach IA" style={{ width: 350, height: 470, marginBottom: 9, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 14, background: "var(--bg-1)", border: "1px solid var(--sep-2)", boxShadow: "0 18px 60px rgba(0,0,0,.45)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderBottom: "1px solid var(--sep)", background: "var(--bg-2)" }}><span style={{ display: "grid", placeItems: "center", width: 29, height: 29, borderRadius: 9, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 800 }}>✦</span><div style={{ flex: 1 }}><strong style={{ display: "block", fontSize: 11 }}>Coach IA</strong><small style={{ color: "var(--c-green)", fontSize: 8 }}>● Mode local · contexte du projet</small></div><button onClick={() => setOpen(false)} aria-label="Fermer" style={{ border: 0, background: "transparent", color: "var(--tx-3)", cursor: "pointer", fontSize: 17 }}>×</button></header>
      <div style={{ display: "flex", gap: 5, padding: "8px 9px", overflowX: "auto", borderBottom: "1px solid var(--sep)" }}>{["Comment progresser ?", "Travailler mon tempo", "Créer un fill musical"].map((prompt) => <button key={prompt} disabled={busy} onClick={() => void send(prompt)} style={{ flexShrink: 0, padding: "5px 7px", borderRadius: 999, border: "1px solid var(--sep-2)", background: "var(--bg-2)", color: "var(--tx-3)", fontSize: 8, cursor: "pointer" }}>{prompt}</button>)}</div>
      <div style={{ flex: 1, overflowY: "auto", padding: 11, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((message) => <div key={message.id} style={{ maxWidth: "86%", alignSelf: message.role === "user" ? "flex-end" : "flex-start", padding: "8px 10px", borderRadius: message.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px", background: message.role === "user" ? "var(--accent)" : "var(--bg-3)", color: message.role === "user" ? "#fff" : "var(--tx-2)", fontSize: 10, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{message.text}</div>)}
        {busy && <div style={{ alignSelf: "flex-start", padding: "7px 10px", borderRadius: 9, background: "var(--bg-3)", color: "var(--tx-4)", fontSize: 10 }}>Le coach réfléchit…</div>}<div ref={endRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} style={{ display: "flex", gap: 7, padding: 9, borderTop: "1px solid var(--sep)", background: "var(--bg-2)" }}><input maxLength={1000} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pose une question sur ton jeu…" style={{ flex: 1, minWidth: 0, height: 33, borderRadius: 7, border: "1px solid var(--sep-2)", background: "var(--bg-1)", color: "var(--tx-1)", padding: "0 9px", outline: "none", fontSize: 10 }} /><button disabled={busy || !input.trim()} style={{ width: 34, height: 33, borderRadius: 7, border: 0, background: "var(--accent)", color: "#fff", cursor: "pointer", opacity: busy || !input.trim() ? .45 : 1 }}>↑</button></form>
    </section>}
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open} style={{ float: "right", height: 40, padding: "0 15px", borderRadius: 999, border: "1px solid var(--accent-line)", background: "var(--accent)", color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.3)", fontWeight: 750, fontSize: 11, cursor: "pointer" }}>✦ Coach IA</button>
  </div>;
};
