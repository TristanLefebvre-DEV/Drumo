/**
 * App Shell — v2
 *
 * Root layout: 72 px left sidebar (icon + label) + full-height content.
 * Settings is a full section (no modal). Transport bar is lifted to app level.
 * Global file ops, drag-and-drop, and keyboard shortcuts live here.
 */

import { useEffect, useState } from "react";
import { ComposePage }  from "./ComposePage";
import { AnalyzePage }  from "./AnalyzePage";
import { PracticePage } from "./PracticePage";
import { LearnPage }    from "./LearnPage";
import { LibraryPage }  from "./LibraryPage";
import { SettingsPage } from "./SettingsPage";
import { TransportBar } from "../components/TransportBar";
import { useProjectStore } from "../../store/projectStore";
// Importing settingsStore triggers initial DOM theme application
import "../../store/settingsStore";
// Wires audio/performance settings to Tone.js + metronome engine
import "../../store/audioSettingsWatcher";
import type { ParsedDrumProject, QuantizeOptions } from "../../core/types";

// ─── Section types ────────────────────────────────────────────────────────────

export type AppSection = "compose" | "analyze" | "practice" | "learn" | "library" | "settings";

// ─── Icons (SF Symbols-inspired, 20 × 20 viewport) ───────────────────────────

const IconCompose = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <path d="M6 18V8L14 5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="5.5" cy="18" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="13.5" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IconAnalyze = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <rect x="2.5" y="12" width="3" height="6" rx="0.75" fill="currentColor" opacity="0.7"/>
    <rect x="8.5" y="8"  width="3" height="10" rx="0.75" fill="currentColor" opacity="0.85"/>
    <rect x="14.5" y="4" width="3" height="14" rx="0.75" fill="currentColor"/>
  </svg>
);

const IconPractice = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 10V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 10L14 10"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.2" fill="currentColor"/>
  </svg>
);

const IconLearn = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="2.5" width="14" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="7" y1="2.5" x2="7" y2="17.5" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <line x1="9" y1="7"   x2="14" y2="7"    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="9" y1="10"  x2="14" y2="10"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="9" y1="13"  x2="12" y2="13"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const IconLibrary = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <rect x="2.5"  y="2.5"  width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="11"   y="2.5"  width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2.5"  y="11"   width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="11"   y="11"   width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <line x1="3" y1="6"  x2="17" y2="6"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7"  cy="6"  r="2.2" fill="var(--bg-1)" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="3" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="13" cy="11" r="2.2" fill="var(--bg-1)" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="3" y1="16" x2="17" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="9"  cy="16" r="2.2" fill="var(--bg-1)" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// ─── Logo ─────────────────────────────────────────────────────────────────────

const AppLogo = () => (
  <svg width="22" height="19" viewBox="0 0 36 30" fill="none" opacity="0.75">
    <circle cx="18" cy="19" r="9"   stroke="var(--tx-2)" strokeWidth="2"   fill="none"/>
    <circle cx="18" cy="19" r="5"   stroke="var(--tx-2)" strokeWidth="1.2" fill="none"/>
    <ellipse cx="9" cy="13" rx="4.5" ry="2.2" stroke="var(--tx-2)" strokeWidth="1.8" fill="none"/>
    <ellipse cx="27" cy="3.5" rx="4" ry="1.3" stroke="var(--tx-2)" strokeWidth="1.5" fill="none"/>
    <line x1="18" y1="10" x2="27" y2="4"  stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="18" y1="10" x2="9"  y2="4"  stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

// ─── Section config ───────────────────────────────────────────────────────────

const MAIN_SECTIONS: { id: AppSection; label: string; Icon: React.FC }[] = [
  { id: "compose",  label: "Compose",     Icon: IconCompose  },
  { id: "practice", label: "Pratique",   Icon: IconPractice },
  { id: "learn",    label: "Apprendre",  Icon: IconLearn    },
  { id: "analyze",  label: "Analyser",   Icon: IconAnalyze  },
  { id: "library",  label: "Bibliothèque", Icon: IconLibrary  },
];

// ─── Nav item ─────────────────────────────────────────────────────────────────

const NavItem = ({
  label, active, onClick, Icon,
}: {
  label: string; active: boolean; onClick: () => void; Icon: React.FC;
}) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    style={{
      width: "100%",
      height: 60,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      position: "relative",
      background: active ? "var(--bg-sel)" : "transparent",
      border: "none",
      cursor: "pointer",
      transition: "background 0.15s ease, color 0.15s ease",
      color: active ? "var(--tx-1)" : "var(--tx-4)",
    }}
    onMouseEnter={(e) => {
      if (!active) {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "var(--bg-hover)";
        el.style.color = "var(--tx-3)";
      }
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.background = active ? "var(--bg-sel)" : "transparent";
      el.style.color = active ? "var(--tx-1)" : "var(--tx-4)";
    }}
  >
    {/* Active indicator — left edge */}
    {active && (
      <div style={{
        position: "absolute",
        left: 0,
        top: "25%",
        bottom: "25%",
        width: 2,
        borderRadius: "0 2px 2px 0",
        background: "var(--accent)",
      }} />
    )}
    <Icon />
    <span style={{
      fontSize: 9,
      fontWeight: active ? 600 : 400,
      letterSpacing: "0.02em",
      userSelect: "none",
    }}>
      {label}
    </span>
  </button>
);

// ─── Save status dot ──────────────────────────────────────────────────────────

const SaveDot = ({ hasProject }: { hasProject: boolean }) => (
  <div style={{
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
    background: hasProject ? "var(--c-green)" : "var(--tx-4)",
    boxShadow: hasProject ? "0 0 0 2px rgba(48,209,88,0.18)" : "none",
    transition: "all 0.3s ease",
  }} />
);

// ─── Top bar file button ──────────────────────────────────────────────────────

const FileBtn = ({
  label, onClick, primary = false,
}: {
  label: string; onClick: () => void; primary?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: "4px 11px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: primary ? 600 : 400,
      background: primary ? "rgba(255,255,255,0.09)" : "transparent",
      color: primary ? "var(--tx-1)" : "var(--tx-3)",
      border: `1px solid ${primary ? "rgba(255,255,255,0.13)" : "transparent"}`,
      cursor: "pointer",
      transition: "background 0.12s, color 0.12s",
      whiteSpace: "nowrap" as const,
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.background = primary ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)";
      el.style.color = "var(--tx-2)";
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.background = primary ? "rgba(255,255,255,0.09)" : "transparent";
      el.style.color = primary ? "var(--tx-1)" : "var(--tx-3)";
    }}
  >
    {label}
  </button>
);

// ─── App Shell ────────────────────────────────────────────────────────────────

export const AppShell = () => {
  const [section, setSection] = useState<AppSection>("compose");
  const { project, loadMidi, loadProjectData, isPlaying } = useProjectStore();

  // ── File ops ───────────────────────────────────────────────────────────────

  const importMidi = async () => {
    const payload = await window.drumApp.openMidiFile();
    if (!payload) return;
    try { loadMidi(payload); } catch { /* store sets message */ }
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
  };

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
    try { loadMidi({ bytes: Array.from(bytes), filePath: file.name }); } catch { /* */ }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const projectName = project?.sourceName ?? "Aucun projet";
  const bpm = project?.tempoBpm?.toFixed(0) ?? null;
  // Show transport on all sections where playback is relevant
  const showTransport = section !== "settings" && section !== "library";

  return (
    <div
      className="app-bg"
      style={{ display: "flex", height: "100vh", color: "var(--tx-1)", overflow: "hidden" }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* ── Left sidebar (72 px) ── */}
      <nav
        className="glass"
        style={{
          width: 72,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-1)",
          borderRight: "1px solid var(--sep)",
        }}
      >
        {/* Logo */}
        <div style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid var(--sep)",
          flexShrink: 0,
        }}>
          <AppLogo />
        </div>

        {/* Main sections */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 4 }}>
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

        {/* Settings at bottom */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--sep)", paddingBottom: 8 }}>
          <NavItem
            label="Réglages"
            active={section === "settings"}
            onClick={() => setSection("settings")}
            Icon={IconSettings}
          />
        </div>
      </nav>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Top bar (44 px) ── */}
        <div
          className="glass-sm"
          style={{
            height: 44,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 0,
            borderBottom: "1px solid var(--sep)",
            background: "var(--bg-1)",
          }}
        >
          {/* Project info */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}>
            <SaveDot hasProject={!!project} />
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: project ? "var(--tx-2)" : "var(--tx-4)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {projectName}
            </span>
          </div>

          {/* BPM pill — only when project loaded and not on settings */}
          {bpm && section !== "settings" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              borderRadius: 7,
              background: "var(--bg-2)",
              border: "1px solid var(--sep)",
              flexShrink: 0,
              marginRight: 10,
            }}>
              <span style={{ fontSize: 10, color: "var(--tx-4)", fontWeight: 500 }}>BPM</span>
              <span style={{
                fontFamily: "monospace",
                fontSize: 13,
                fontWeight: 700,
                color: isPlaying ? "var(--c-green)" : "var(--tx-1)",
                transition: "color 0.3s ease",
              }}>
                {bpm}
              </span>
              {isPlaying && (
                <span
                  className="play-dot"
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-green)" }}
                />
              )}
            </div>
          )}

          {/* File ops */}
          <div style={{ display: "flex", gap: 2, padding: "0 10px", flexShrink: 0 }}>
            <FileBtn label="Importer"    onClick={() => void importMidi()} primary />
            <FileBtn label="Sauvegarder" onClick={() => void saveProject()} />
            <FileBtn label="Charger"     onClick={() => void loadProject()} />
          </div>
        </div>

        {/* ── Transport bar — app-level, Compose/Practice/Analyze/Learn ── */}
        {showTransport && <TransportBar />}

        {/* ── Section content ── */}
        <div style={{ flex: 1, overflow: "hidden" }} className="slide-up">
          {section === "compose"  && <ComposePage  onImportMidi={() => void importMidi()} />}
          {section === "analyze"  && <AnalyzePage  />}
          {section === "practice" && <PracticePage />}
          {section === "learn"    && <LearnPage    />}
          {section === "library"  && <LibraryPage  />}
          {section === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
};
