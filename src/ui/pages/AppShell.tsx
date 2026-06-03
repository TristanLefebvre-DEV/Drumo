/**
 * App Shell — v4
 *
 * Layout: sidebar large (200px) + contenu principal.
 * Sidebar : nav horizontale + sous-sections Bibliothèque + Récents.
 * Style : macOS application professionnelle (Final Cut Pro / GarageBand).
 */

import { useEffect, useState } from "react";
import { ComposePage }  from "./ComposePage";
import { AnalyzePage }  from "./AnalyzePage";
import { PracticePage } from "./PracticePage";
import { LearnPage }    from "./LearnPage";
import { LibraryPage }  from "./LibraryPage";
import { SettingsPage } from "./SettingsPage";
import { TransportBar } from "../components/TransportBar";
import { AppMenuBar }   from "../components/AppMenuBar";
import { useProjectStore } from "../../store/projectStore";
import "../../store/settingsStore";
import "../../store/audioSettingsWatcher";
import type { ParsedDrumProject, QuantizeOptions } from "../../core/types";

export type AppSection = "compose" | "analyze" | "practice" | "learn" | "library" | "settings";

// ─── Icônes navigation ────────────────────────────────────────────────────────

const IconCompose = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <path d="M6 18V8L14 5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="5.5" cy="18" r="1.9" stroke="currentColor" strokeWidth="1.4"/>
    <circle cx="13.5" cy="15" r="1.9" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const IconAnalyze = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <rect x="2.5" y="12" width="3" height="6" rx="0.75" fill="currentColor" opacity="0.6"/>
    <rect x="8.5" y="8"  width="3" height="10" rx="0.75" fill="currentColor" opacity="0.8"/>
    <rect x="14.5" y="4" width="3" height="14" rx="0.75" fill="currentColor"/>
  </svg>
);
const IconPractice = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M10 10V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M10 10L14 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.2" fill="currentColor"/>
  </svg>
);
const IconLearn = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="2.5" width="14" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <line x1="7" y1="2.5" x2="7" y2="17.5" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
    <line x1="9" y1="7"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="9" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="9" y1="13" x2="12" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconLibrary = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <rect x="2.5" y="2.5"  width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="11"  y="2.5"  width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="2.5" y="11"   width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="11"  y="11"   width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <line x1="3" y1="6"  x2="17" y2="6"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="7"  cy="6"  r="2.1" fill="var(--bg-1)" stroke="currentColor" strokeWidth="1.4"/>
    <line x1="3" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="13" cy="11" r="2.1" fill="var(--bg-1)" stroke="currentColor" strokeWidth="1.4"/>
    <line x1="3" y1="16" x2="17" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="9"  cy="16" r="2.1" fill="var(--bg-1)" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);

// ─── Icônes bibliothèque ─────────────────────────────────────────────────────

const IconGrooves = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="8" cy="8" r="1" fill="currentColor"/>
  </svg>
);
const IconFills = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M2 12L5 6l3 4 3-6 3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);
const IconExercices = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.1"/>
  </svg>
);
const IconMorceaux = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconKits = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <ellipse cx="8" cy="12" rx="5" ry="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3 12V8M13 12V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <ellipse cx="8" cy="8" rx="5" ry="2" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);


// ─── Logo ─────────────────────────────────────────────────────────────────────

const AppLogo = () => (
  <svg width="22" height="18" viewBox="0 0 36 30" fill="none">
    <circle cx="18" cy="19" r="9"    stroke="var(--accent)" strokeWidth="2"   fill="none" opacity="0.85"/>
    <circle cx="18" cy="19" r="5"    stroke="var(--accent)" strokeWidth="1.2" fill="none" opacity="0.65"/>
    <ellipse cx="9"  cy="13" rx="4.5" ry="2.2" stroke="var(--tx-3)" strokeWidth="1.8" fill="none"/>
    <ellipse cx="27" cy="3.5" rx="4"  ry="1.3" stroke="var(--tx-3)" strokeWidth="1.5" fill="none"/>
    <line x1="18" y1="10" x2="27" y2="4" stroke="var(--tx-3)" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="18" y1="10" x2="9"  y2="4" stroke="var(--tx-3)" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

// ─── Sections config ──────────────────────────────────────────────────────────

const MAIN_SECTIONS: { id: AppSection; label: string; Icon: React.FC }[] = [
  { id: "compose",  label: "Composer",     Icon: IconCompose  },
  { id: "practice", label: "Pratiquer",    Icon: IconPractice },
  { id: "learn",    label: "Apprendre",    Icon: IconLearn    },
  { id: "analyze",  label: "Analyser",     Icon: IconAnalyze  },
  { id: "library",  label: "Bibliothèque", Icon: IconLibrary  },
];

const LIBRARY_ITEMS: { label: string; Icon: React.FC }[] = [
  { label: "Grooves",   Icon: IconGrooves   },
  { label: "Fills",     Icon: IconFills     },
  { label: "Exercices", Icon: IconExercices },
  { label: "Morceaux",  Icon: IconMorceaux  },
  { label: "Kits",      Icon: IconKits      },
];

// ─── Nav item (horizontal) ────────────────────────────────────────────────────

const NavItem = ({
  label, active, onClick, Icon,
}: {
  label: string; active: boolean; onClick: () => void; Icon: React.FC;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    style={{
      width: "calc(100% - 8px)",
      height: 34,
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "0 10px 0 14px",
      position: "relative",
      background: active ? "var(--accent-dim)" : "transparent",
      border: "none",
      cursor: "pointer",
      transition: "background 0.13s ease",
      color: active ? "var(--accent)" : "var(--tx-3)",
      borderRadius: "0 8px 8px 0",
    }}
    onMouseEnter={(e) => {
      if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.background = active ? "var(--accent-dim)" : "transparent";
    }}
  >
    {active && (
      <div style={{
        position: "absolute", left: 0, top: "20%", bottom: "20%",
        width: 2.5, borderRadius: "0 2px 2px 0", background: "var(--accent)",
      }} />
    )}
    <Icon />
    <span style={{
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      letterSpacing: "0.01em",
      userSelect: "none",
    }}>
      {label}
    </span>
  </button>
);

// ─── Library sub-item ─────────────────────────────────────────────────────────

const LibItem = ({
  label, Icon, onClick,
}: { label: string; Icon: React.FC; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: "calc(100% - 8px)",
      height: 28,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 10px 0 28px",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "var(--tx-3)",
      borderRadius: "0 6px 6px 0",
      transition: "background 0.1s, color 0.1s",
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.background = "var(--bg-hover)";
      el.style.color = "var(--tx-2)";
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.background = "transparent";
      el.style.color = "var(--tx-3)";
    }}
  >
    <Icon />
    <span style={{ fontSize: 11, userSelect: "none" }}>{label}</span>
  </button>
);

// ─── Section header ───────────────────────────────────────────────────────────

const SidebarSectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    padding: "10px 14px 4px",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.10em",
    color: "var(--tx-4)",
    userSelect: "none",
  }}>
    {children}
  </div>
);


// ─── App Shell ────────────────────────────────────────────────────────────────

export const AppShell = () => {
  const [section, setSection] = useState<AppSection>("compose");
  const { project, loadMidi, loadProjectData, isPlaying, newProject } = useProjectStore();

  const handleOpenScoreInComposer = async (filePath: string) => {
    const bytes = await window.drumApp.readMidiBytes(filePath);
    if (!bytes) return;
    loadMidi({ bytes, filePath });
    setSection("compose");
  };

  // ── Recent projects (localStorage) ────────────────────────────────────────
  type RecentEntry = { name: string; ts: number };

  const cleanFileName = (raw: string) =>
    raw.split(/[\\/]/).pop()?.replace(/\.midi?$/i, "") ?? raw;

  const formatTs = (ts: number): string => {
    const now  = new Date();
    const date = new Date(ts);
    const h    = date.getHours().toString().padStart(2, "0");
    const m    = date.getMinutes().toString().padStart(2, "0");
    if (date.toDateString() === now.toDateString()) return `Aujourd'hui, ${h}:${m}`;
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    if (date.toDateString() === yest.toDateString()) return `Hier, ${h}:${m}`;
    return date.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };

  const [recents, setRecents] = useState<RecentEntry[]>(() => {
    try {
      const raw = localStorage.getItem("drumo_recents");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown[];
      return parsed.slice(0, 5).map((item): RecentEntry => {
        if (typeof item === "string") return { name: cleanFileName(item), ts: Date.now() };
        if (typeof item === "object" && item !== null && "name" in item) return item as RecentEntry;
        return { name: cleanFileName(String(item)), ts: Date.now() };
      });
    } catch { return []; }
  });

  const addRecent = (name: string) => {
    const clean = cleanFileName(name);
    setRecents((prev) => {
      const next = [{ name: clean, ts: Date.now() }, ...prev.filter((n) => n.name !== clean)].slice(0, 5);
      try { localStorage.setItem("drumo_recents", JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  };

  // ── File ops ───────────────────────────────────────────────────────────────

  const importMidi = async () => {
    const payload = await window.drumApp.openMidiFile();
    if (!payload) return;
    try {
      loadMidi(payload);
      addRecent(payload.filePath.split(/[\\/]/).pop()?.replace(/\.midi?$/i, "") ?? payload.filePath);
    } catch { /* store sets message */ }
  };

  const saveProject = async () => {
    const state = useProjectStore.getState();
    if (!state.project) return;
    await window.drumApp.saveProject({ project: state.project, quantizeOptions: state.quantizeOptions });
  };

  const loadProject = async () => {
    const loaded = await window.drumApp.loadProject();
    if (!loaded) return;
    const parsed = JSON.parse(loaded.content) as { project?: ParsedDrumProject; quantizeOptions?: Partial<QuantizeOptions> };
    if (!parsed.project || !Array.isArray(parsed.project.hits)) return;
    loadProjectData({ project: parsed.project, quantizeOptions: parsed.quantizeOptions });
    if (parsed.project.sourceName) addRecent(parsed.project.sourceName);
  };

  // Track current project name in recents
  useEffect(() => {
    if (project?.sourceName) addRecent(project.sourceName);
  }, [project?.sourceName]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); void importMidi(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void saveProject(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".mid") && !name.endsWith(".midi")) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      loadMidi({ bytes: Array.from(bytes), filePath: file.name });
      addRecent(file.name.replace(/\.midi?$/i, ""));
    } catch { /* */ }
  };

  const projectName   = project?.sourceName ?? null;
  const bpm           = project?.tempoBpm?.toFixed(0) ?? null;
  const sig           = project ? `${project.timeSignature.numerator}/${project.timeSignature.denominator}` : null;
  const showTransport = section !== "settings" && section !== "library";

  return (
    <div
      className="app-bg"
      style={{ display: "flex", flexDirection: "column", height: "100vh", color: "var(--tx-1)", overflow: "hidden" }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* ── Menu bar — pleine largeur ── */}
      <AppMenuBar
        onNavigate={(s) => setSection(s)}
        onImportMidi={() => void importMidi()}
        onSaveProject={() => void saveProject()}
        onLoadProject={() => void loadProject()}
      />

      {/* ── Corps de l'app (sidebar + main) ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

      {/* ── Sidebar (200px) ── */}
      <nav
        className="glass"
        style={{
          width: 200,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-1)",
          borderRight: "1px solid var(--sep)",
          overflow: "hidden",
        }}
      >
        {/* Brand */}
        <div style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
          borderBottom: "1px solid var(--sep)",
          flexShrink: 0,
        }}>
          <AppLogo />
          <div>
            <div style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "var(--tx-1)",
              lineHeight: 1,
            }}>DRUMO</div>
            <div style={{
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "var(--tx-4)",
              marginTop: 2,
              textTransform: "uppercase" as const,
            }}>Groove Studio</div>
          </div>
        </div>

        {/* Main navigation */}
        <div style={{ paddingTop: 6, paddingBottom: 4 }}>
          {MAIN_SECTIONS.map(({ id, label, Icon }) => (
            <NavItem
              key={id}
              label={label}
              active={section === id}
              onClick={() => setSection(id)}
              Icon={Icon}
            />
          ))}
        </div>

        {/* Bibliothèque quick-access */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ borderTop: "1px solid var(--sep)" }}>
            <SidebarSectionLabel>Bibliothèque</SidebarSectionLabel>
            {LIBRARY_ITEMS.map(({ label, Icon }) => (
              <LibItem
                key={label}
                label={label}
                Icon={Icon}
                onClick={() => setSection("library")}
              />
            ))}
          </div>

          {/* Récents */}
          {recents.length > 0 && (
            <div style={{ borderTop: "1px solid var(--sep)", marginTop: 4 }}>
              <SidebarSectionLabel>Récents</SidebarSectionLabel>
              {recents.map(({ name, ts }) => (
                <button
                  key={name}
                  type="button"
                  style={{
                    width: "calc(100% - 8px)",
                    minHeight: 38,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    padding: "4px 10px 4px 28px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "0 6px 6px 0",
                    transition: "background 0.1s",
                    overflow: "hidden",
                    gap: 1,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{
                    fontSize: 11,
                    fontWeight: name === projectName ? 600 : 400,
                    color: name === projectName ? "var(--accent)" : "var(--tx-2)",
                    userSelect: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                    textAlign: "left",
                  }}>
                    {name}
                  </span>
                  <span style={{
                    fontSize: 9, color: "var(--tx-4)",
                    userSelect: "none", whiteSpace: "nowrap",
                  }}>
                    {formatTs(ts)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: New project + Settings */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--sep)" }}>
          <button
            type="button"
            onClick={() => { newProject(); setSection("compose"); }}
            style={{
              width: "calc(100% - 16px)",
              margin: "8px 8px 4px",
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 500,
              background: "var(--bg-2)",
              color: "var(--tx-2)",
              border: "1px solid var(--sep-2)",
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "var(--bg-3)";
              el.style.color = "var(--tx-1)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "var(--bg-2)";
              el.style.color = "var(--tx-2)";
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Nouveau projet
          </button>
          <NavItem
            label="Réglages"
            active={section === "settings"}
            onClick={() => setSection("settings")}
            Icon={IconSettings}
          />
          <div style={{ height: 6 }} />
        </div>
      </nav>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── App title bar ── */}
        <div
          className="glass-sm"
          style={{
            height: 44,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid var(--sep)",
            background: "var(--bg-1)",
            padding: "0 14px",
            position: "relative",
          }}
        >
          {/* Left: app name */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <AppLogo />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-3)", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
              DRUMO – Drum MIDI Scorer
            </span>
          </div>

          {/* Center: file name pill */}
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center" }}>
            {projectName ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 28, padding: "0 10px 0 9px", borderRadius: 7,
                background: "var(--bg-3)", border: "1px solid var(--sep-2)",
                cursor: "default", maxWidth: 360,
              }}>
                <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                  <path d="M1.5 1h5.5l2.5 2.5V12a.5.5 0 01-.5.5h-7A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="var(--tx-3)" strokeWidth="1.1" fill="none"/>
                  <path d="M7 1v2.5h2.5" stroke="var(--tx-3)" strokeWidth="1.1" fill="none"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--tx-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {projectName}.mid
                </span>
                <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
                  <path d="M1 1l3 3 3-3" stroke="var(--tx-4)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "var(--tx-4)", userSelect: "none" }}>Aucun projet ouvert</span>
            )}
          </div>

          {/* Right: share + help */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <button
              type="button"
              title="Exporter / Partager"
              onClick={() => void window.drumApp.exportPdf()}
              style={{
                width: 28, height: 28, borderRadius: 6, background: "transparent",
                border: "1px solid transparent", color: "var(--tx-3)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--bg-hover)"; el.style.color = "var(--tx-2)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--tx-3)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M11 6l-3-3-3 3M8 3v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 10v3h8v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              title="Aide"
              style={{
                width: 28, height: 28, borderRadius: 6, background: "transparent",
                border: "1px solid transparent", color: "var(--tx-3)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 600, transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "var(--bg-hover)"; el.style.color = "var(--tx-2)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--tx-3)"; }}
            >
              ?
            </button>
          </div>
        </div>

        {/* ── Transport ── */}
        {showTransport && <TransportBar />}

        {/* ── Section content ── */}
        <div style={{ flex: 1, overflow: "hidden" }} className="slide-up">
          {section === "compose"  && <ComposePage  onImportMidi={() => void importMidi()} />}
          {section === "analyze"  && <AnalyzePage  />}
          {section === "practice" && <PracticePage />}
          {section === "learn"    && <LearnPage    />}
          {section === "library"  && <LibraryPage onOpenScoreInComposer={handleOpenScoreInComposer} />}
          {section === "settings" && <SettingsPage />}
        </div>
      </main>

      </div>{/* fin corps sidebar+main */}
    </div>
  );
};
