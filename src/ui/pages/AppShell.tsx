/**
 * App Shell
 *
 * Root layout:  narrow left sidebar (52 px) + full-height content.
 * Navigation is icon-based with a subtle Apple-blue active indicator line.
 * Global file ops, drag-and-drop, and keyboard shortcuts live here.
 */

import { useEffect, useState } from "react";
import { ComposePage }  from "./ComposePage";
import { AnalyzePage }  from "./AnalyzePage";
import { PracticePage } from "./PracticePage";
import { LearnPage }    from "./LearnPage";
import { LibraryPage }  from "./LibraryPage";
import { useProjectStore } from "../../store/projectStore";
import type { ParsedDrumProject, QuantizeOptions } from "../../core/types";

// ─── Section types ────────────────────────────────────────────────────────────

export type AppSection = "compose" | "analyze" | "practice" | "learn" | "library";

// ─── Minimal SVG icons (SF Symbols-inspired, 20 × 20 viewport) ───────────────

const IconCompose = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
    <svg width="20" height="17" viewBox="0 0 36 30" fill="none" opacity="0.85">
      <circle cx="18" cy="19" r="9"   stroke="var(--tx-2)" strokeWidth="2"   fill="none"/>
      <circle cx="18" cy="19" r="5"   stroke="var(--tx-2)" strokeWidth="1.2" fill="none"/>
      <ellipse cx="9" cy="13" rx="4.5" ry="2.2" stroke="var(--tx-2)" strokeWidth="1.8" fill="none"/>
      <ellipse cx="27" cy="3.5" rx="4" ry="1.3" stroke="var(--tx-2)" strokeWidth="1.5" fill="none"/>
      <line x1="18" y1="10" x2="27" y2="4"  stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="18" y1="10" x2="9"  y2="4"  stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", color: "var(--tx-4)" }}>
      DRUMO
    </span>
  </div>
);

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

const SECTION_CONFIG: { id: AppSection; label: string; Icon: React.FC }[] = [
  { id: "compose",  label: "Compose",  Icon: IconCompose  },
  { id: "analyze",  label: "Analyze",  Icon: IconAnalyze  },
  { id: "practice", label: "Practice", Icon: IconPractice },
  { id: "learn",    label: "Learn",    Icon: IconLearn    },
  { id: "library",  label: "Library",  Icon: IconLibrary  },
];

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
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      background: active ? "rgba(255,255,255,0.06)" : "transparent",
      border: "none",
      cursor: "pointer",
      transition: "background 0.15s ease, color 0.15s ease",
      color: active ? "var(--tx-1)" : "var(--tx-4)",
    }}
    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.color = active ? "var(--tx-1)" : "var(--tx-3)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? "rgba(255,255,255,0.06)" : "transparent"; (e.currentTarget as HTMLElement).style.color = active ? "var(--tx-1)" : "var(--tx-4)"; }}
  >
    {/* Active left-edge indicator */}
    {active && (
      <div style={{
        position: "absolute",
        left: 0, top: "28%", bottom: "28%",
        width: 2,
        borderRadius: "0 2px 2px 0",
        background: "var(--accent)",
      }} />
    )}
    <Icon />
  </button>
);

// ─── App Shell ────────────────────────────────────────────────────────────────

export const AppShell = () => {
  const [section, setSection] = useState<AppSection>("compose");
  const { project, loadMidi, loadProjectData } = useProjectStore();

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

  return (
    <div
      style={{ display: "flex", height: "100vh", background: "var(--bg-app)", color: "var(--tx-1)", overflow: "hidden" }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* ── Left sidebar (52 px) ── */}
      <nav
        style={{
          width: 52,
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

        {/* Section nav */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 4 }}>
          {SECTION_CONFIG.map(({ id, label, Icon }) => (
            <NavItem
              key={id}
              label={label}
              active={section === id}
              onClick={() => setSection(id)}
              Icon={Icon}
            />
          ))}
        </div>

        {/* Bottom: Settings */}
        <div style={{ paddingBottom: 8, borderTop: "1px solid var(--sep)" }}>
          <NavItem label="Settings" active={false} onClick={() => {}} Icon={IconSettings} />
        </div>
      </nav>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Thin top strip: project name + file ops */}
        <div
          style={{
            height: 36,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            borderBottom: "1px solid var(--sep)",
            background: "var(--bg-1)",
          }}
        >
          {/* Project name */}
          <span style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project ? project.sourceName : "Aucun projet"}
          </span>

          {/* File ops */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {[
              { label: "Import MIDI", onClick: () => void importMidi(), primary: true },
              { label: "Save",        onClick: () => void saveProject(), primary: false },
              { label: "Load",        onClick: () => void loadProject(), primary: false },
            ].map(({ label, onClick, primary }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: primary ? 600 : 400,
                  background: primary ? "rgba(255,255,255,0.09)" : "transparent",
                  color: primary ? "var(--tx-1)" : "var(--tx-3)",
                  border: `1px solid ${primary ? "rgba(255,255,255,0.12)" : "transparent"}`,
                  cursor: "pointer",
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Section content */}
        <div style={{ flex: 1, overflow: "hidden" }} className="slide-up">
          {section === "compose"  && <ComposePage  onImportMidi={() => void importMidi()} />}
          {section === "analyze"  && <AnalyzePage  />}
          {section === "practice" && <PracticePage />}
          {section === "learn"    && <LearnPage    />}
          {section === "library"  && <LibraryPage  />}
        </div>
      </main>
    </div>
  );
};
