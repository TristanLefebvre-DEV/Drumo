/**
 * AppMenuBar — v1
 *
 * Barre de menus style macOS application native.
 * Menus : Fichier | Édition | Affichage | Lecture | Projet | Outils | IA | Aide
 * Droite : toggle thème + paramètres + audio
 *
 * Dropdowns positionnés absolument, fermeture sur clic extérieur.
 * Compatible mode clair / sombre / dégradé.
 */

import { useEffect, useRef, useState } from "react";
import { useProjectStore }  from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore }       from "../../store/uiStore";
import type { AppSection }  from "../pages/AppShell";

// ─── Types menu ───────────────────────────────────────────────────────────────

type MenuEntry =
  | { kind: "item";      id: string; label: string; shortcut?: string; action?: () => void; disabled?: boolean }
  | { kind: "separator"; id: string }
  | { kind: "check";     id: string; label: string; checked: boolean;  action: () => void;  shortcut?: string; disabled?: boolean };

interface MenuDef {
  id:    string;
  label: string;
  items: MenuEntry[];
}

// ─── Dropdown ────────────────────────────────────────────────────────────────

const Dropdown = ({ items, onClose }: { items: MenuEntry[]; onClose: () => void }) => (
  <div
    style={{
      position: "absolute",
      top: "100%",
      left: 0,
      zIndex: 9999,
      minWidth: 220,
      background: "var(--bg-2)",
      border: "1px solid var(--sep-2)",
      borderRadius: 8,
      boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.28)",
      padding: "4px 0",
      marginTop: 2,
    }}
  >
    {items.map((entry) => {
      if (entry.kind === "separator") {
        return (
          <div
            key={entry.id}
            style={{
              height: 1,
              background: "var(--sep)",
              margin: "3px 8px",
            }}
          />
        );
      }

      const isCheck = entry.kind === "check";
      const disabled = entry.kind === "item" && entry.disabled;
      const checked = isCheck && entry.checked;

      return (
        <button
          key={entry.id}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              entry.action?.();
              onClose();
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: "4px 12px 4px 28px",
            height: 26,
            background: "transparent",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            color: disabled ? "var(--tx-4)" : "var(--tx-1)",
            fontSize: 12,
            fontWeight: 400,
            textAlign: "left",
            position: "relative",
            transition: "background 0.08s",
          }}
          onMouseEnter={(e) => {
            if (!disabled)
              (e.currentTarget as HTMLElement).style.background = "var(--accent)";
            if (!disabled)
              (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = disabled ? "var(--tx-4)" : "var(--tx-1)";
          }}
        >
          {/* Check mark */}
          {isCheck && (
            <span style={{
              position: "absolute", left: 10, fontSize: 11,
              color: checked ? "var(--accent)" : "transparent",
            }}>
              ✓
            </span>
          )}
          <span style={{ flex: 1 }}>{entry.label}</span>
          {entry.shortcut && (
            <span style={{
              marginLeft: 20,
              fontSize: 11,
              color: "var(--tx-3)",
              fontFamily: "monospace",
              letterSpacing: "0.03em",
            }}>
              {entry.shortcut}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ─── Right-side icon button ───────────────────────────────────────────────────

const RightBtn = ({
  title, onClick, children, active = false,
}: {
  title: string; onClick: () => void; children: React.ReactNode; active?: boolean;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      width: 28,
      height: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: active ? "var(--accent-dim)" : "transparent",
      border: active ? "1px solid var(--accent-line)" : "1px solid transparent",
      borderRadius: 6,
      color: active ? "var(--accent)" : "var(--tx-3)",
      cursor: "pointer",
      transition: "background 0.12s, color 0.12s",
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLElement;
      if (!active) { el.style.background = "var(--bg-hover)"; el.style.color = "var(--tx-2)"; }
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.background = active ? "var(--accent-dim)" : "transparent";
      el.style.color = active ? "var(--accent)" : "var(--tx-3)";
    }}
  >
    {children}
  </button>
);

// ─── Icons right side ─────────────────────────────────────────────────────────

const IcoSettings = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IcoMoon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 10.5A6.5 6.5 0 015.5 2.5a6.5 6.5 0 000 11A6.5 6.5 0 0013.5 10.5z"
      stroke="currentColor" strokeWidth="1.3" fill="none"/>
  </svg>
);

const IcoSun = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IcoAudio = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 6h2l3-4v12l-3-4H3V6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
    <path d="M11 5c1 1 1.5 2 1.5 3s-.5 2-1.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M13 3c1.5 1.5 2 3 2 5s-.5 3.5-2 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface AppMenuBarProps {
  onNavigate: (section: AppSection) => void;
  onImportMidi: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
}

export const AppMenuBar = ({
  onNavigate, onImportMidi, onSaveProject, onLoadProject,
}: AppMenuBarProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const {
    project, isPlaying,
    stop, rewindToStart,
    transport, updateTransport,
    newProject, togglePlayback,
    setZoomX, setZoomY, zoomX,
    setShowLimbAnalysis, setShowEnergyTimeline, setShowSectionTimeline,
    showLimbAnalysis, showEnergyTimeline, showSectionTimeline,
  } = useProjectStore();

  const { theme, setTheme } = useSettingsStore();
  const isDark = theme.appearance === "dark";
  const { openPanel, showHumanize, showMixer, showMetronome } = useUiStore();

  // Close on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleMenu = (id: string) =>
    setOpenMenu((prev) => (prev === id ? null : id));

  const hasProject = !!project;

  // ── Menu definitions ────────────────────────────────────────────────────────

  const MENUS: MenuDef[] = [
    {
      id: "file",
      label: "Fichier",
      items: [
        { kind: "item", id: "new",    label: "Nouveau projet",     shortcut: "Ctrl+N", action: () => { newProject(); onNavigate("compose"); } },
        { kind: "item", id: "open",   label: "Charger projet",     shortcut: "Ctrl+O", action: onLoadProject },
        { kind: "separator", id: "s1" },
        { kind: "item", id: "import", label: "Importer MIDI…",     shortcut: "Ctrl+I", action: onImportMidi },
        { kind: "item", id: "expMidi",label: "Exporter MIDI…",                         action: async () => {
          if (!project) return;
          const { exportProjectToMidiBytes } = await import("../../core/midiExporter");
          window.drumApp.exportMidi(exportProjectToMidiBytes(project));
        }, disabled: !hasProject },
        { kind: "item", id: "expPdf", label: "Exporter PDF…",                          action: () => void window.drumApp.exportPdf(), disabled: !hasProject },
        { kind: "separator", id: "s2" },
        { kind: "item", id: "save",   label: "Sauvegarder",        shortcut: "Ctrl+S", action: onSaveProject, disabled: !hasProject },
        { kind: "item", id: "saveAs", label: "Sauvegarder sous…",  shortcut: "Ctrl+Maj+S", action: onSaveProject, disabled: !hasProject },
        { kind: "separator", id: "s3" },
        { kind: "item", id: "close",  label: "Fermer projet",                          action: () => newProject(), disabled: !hasProject },
      ],
    },
    {
      id: "edit",
      label: "Édition",
      items: [
        { kind: "item", id: "undo",   label: "Annuler",          shortcut: "Ctrl+Z",         disabled: true },
        { kind: "item", id: "redo",   label: "Rétablir",         shortcut: "Ctrl+Maj+Z",     disabled: true },
        { kind: "separator", id: "s1" },
        { kind: "item", id: "copy",   label: "Copier",           shortcut: "Ctrl+C",          disabled: true },
        { kind: "item", id: "paste",  label: "Coller",           shortcut: "Ctrl+V",          disabled: true },
        { kind: "item", id: "delete", label: "Supprimer",        shortcut: "Suppr",           disabled: true },
        { kind: "separator", id: "s2" },
        { kind: "item", id: "selAll", label: "Sélectionner tout",shortcut: "Ctrl+A",          disabled: true },
      ],
    },
    {
      id: "view",
      label: "Affichage",
      items: [
        { kind: "item",  id: "zIn",   label: "Zoom +",            shortcut: "Ctrl+=", action: () => setZoomX(Math.min(zoomX + 0.1, 2)) },
        { kind: "item",  id: "zOut",  label: "Zoom −",            shortcut: "Ctrl+−", action: () => setZoomX(Math.max(zoomX - 0.1, 0.7)) },
        { kind: "item",  id: "zReset",label: "Réinitialiser zoom",shortcut: "Ctrl+0", action: () => { setZoomX(1); setZoomY(1); } },
        { kind: "separator", id: "s1" },
        { kind: "item",  id: "vScore",    label: "Partition",     action: () => onNavigate("compose") },
        { kind: "item",  id: "vAnalyze",  label: "Analyse",       action: () => onNavigate("analyze") },
        { kind: "separator", id: "s2" },
        { kind: "check", id: "vLimbs",    label: "Analyse membres", checked: showLimbAnalysis,    action: () => setShowLimbAnalysis(!showLimbAnalysis)   },
        { kind: "check", id: "vEnergy",   label: "Courbe énergie",  checked: showEnergyTimeline,  action: () => setShowEnergyTimeline(!showEnergyTimeline) },
        { kind: "check", id: "vSections", label: "Sections",         checked: showSectionTimeline, action: () => setShowSectionTimeline(!showSectionTimeline) },
        { kind: "separator", id: "s3" },
        { kind: "item",  id: "fullscreen",label: "Plein écran",   shortcut: "F11",
          action: async () => {
            const isFs = await window.drumApp.setFullscreen?.(true);
            void isFs;
          }, disabled: !window.drumApp.setFullscreen },
      ],
    },
    {
      id: "playback",
      label: "Lecture",
      items: [
        { kind: "item",  id: "play",  label: isPlaying ? "Pause" : "Lecture",  shortcut: "Espace",  action: () => void togglePlayback(), disabled: !hasProject },
        { kind: "item",  id: "stop",  label: "Arrêt",                           shortcut: "Échap",   action: stop,                         disabled: !hasProject },
        { kind: "item",  id: "rew",   label: "Retour au début",                 shortcut: "Début",   action: rewindToStart,                disabled: !hasProject },
        { kind: "separator", id: "s1" },
        { kind: "check", id: "loop",  label: "Boucle",                          checked: transport.loopEnabled,      action: () => updateTransport({ loopEnabled: !transport.loopEnabled }) },
        { kind: "check", id: "metro", label: "Métronome",                        checked: transport.metronomeEnabled, action: () => updateTransport({ metronomeEnabled: !transport.metronomeEnabled }) },
        { kind: "separator", id: "s2" },
        { kind: "item",  id: "ci0",   label: "Décompte : désactivé",  action: () => updateTransport({ countInBars: 0 }) },
        { kind: "item",  id: "ci1",   label: "Décompte : 1 mesure",   action: () => updateTransport({ countInBars: 1 }) },
        { kind: "item",  id: "ci2",   label: "Décompte : 2 mesures",  action: () => updateTransport({ countInBars: 2 }) },
        { kind: "item",  id: "ci4",   label: "Décompte : 4 mesures",  action: () => updateTransport({ countInBars: 4 }) },
      ],
    },
    {
      id: "project",
      label: "Projet",
      items: [
        { kind: "item", id: "info",    label: "Informations projet", disabled: !hasProject,
          action: () => {
            if (!project) return;
            alert(`Projet : ${project.sourceName}\nBPM : ${project.tempoBpm.toFixed(0)}\nSignature : ${project.timeSignature.numerator}/${project.timeSignature.denominator}\nNotes : ${project.hits.length}`);
          }
        },
        { kind: "separator", id: "s1" },
        { kind: "item", id: "bpm",     label: project ? `BPM : ${project.tempoBpm.toFixed(0)}` : "BPM : —", disabled: true },
        { kind: "item", id: "sig",     label: project ? `Signature : ${project.timeSignature.numerator}/${project.timeSignature.denominator}` : "Signature : —", disabled: true },
        { kind: "separator", id: "s2" },
        { kind: "item", id: "kitPref", label: "Kit de batterie",    action: () => onNavigate("settings") },
        { kind: "item", id: "audioSet",label: "Paramètres audio",   action: () => onNavigate("settings") },
      ],
    },
    {
      id: "tools",
      label: "Outils",
      items: [
        {
          kind: "check", id: "humanize", label: "Humaniser…",
          checked: showHumanize,
          action: () => { onNavigate("compose"); openPanel("humanize"); },
          disabled: !hasProject,
        },
        {
          kind: "item", id: "quantize", label: "Quantifier (grille MIDI)",
          action: () => onNavigate("compose"),
          disabled: !hasProject,
        },
        { kind: "separator", id: "s1" },
        {
          kind: "check", id: "mixer", label: "Mixeur…",
          checked: showMixer,
          action: () => { onNavigate("compose"); openPanel("mixer"); },
          disabled: !hasProject,
        },
        {
          kind: "check", id: "metro", label: "Métronome…",
          checked: showMetronome,
          action: () => { onNavigate("compose"); openPanel("metronome"); },
        },
        {
          kind: "item", id: "balance", label: "Balance kit…",
          action: () => { onNavigate("compose"); openPanel("balance"); },
          disabled: !hasProject,
        },
        { kind: "separator", id: "s2" },
        { kind: "item", id: "kits",     label: "Bibliothèque de kits", action: () => onNavigate("library") },
        { kind: "item", id: "settings", label: "Préférences…", shortcut: "Ctrl+,", action: () => onNavigate("settings") },
      ],
    },
    {
      id: "ai",
      label: "IA",
      items: [
        { kind: "item", id: "analyze", label: "Analyser le groove",   action: () => { onNavigate("compose"); openPanel("ai"); }, disabled: !hasProject },
        { kind: "item", id: "simplify",label: "Simplifier la partition", disabled: !hasProject },
        { kind: "separator", id: "s1" },
        { kind: "item", id: "dna",     label: "Groove DNA",           action: () => onNavigate("analyze"), disabled: !hasProject },
        { kind: "item", id: "energy",  label: "Energy Flow",          action: () => { setShowEnergyTimeline(true); onNavigate("compose"); }, disabled: !hasProject },
        { kind: "item", id: "stamina", label: "Stamina Analyzer",     action: () => onNavigate("analyze"), disabled: !hasProject },
        { kind: "item", id: "limb",    label: "Limb Analyzer",        action: () => { setShowLimbAnalysis(true); onNavigate("compose"); }, disabled: !hasProject },
        { kind: "separator", id: "s2" },
        { kind: "item", id: "coach",   label: "Coach IA",             action: () => onNavigate("learn") },
      ],
    },
    {
      id: "help",
      label: "Aide",
      items: [
        { kind: "item", id: "doc",     label: "Documentation",       disabled: true },
        { kind: "item", id: "tutos",   label: "Tutoriels",           action: () => onNavigate("learn") },
        { kind: "separator", id: "s1" },
        { kind: "item", id: "shortcuts",label: "Raccourcis clavier", disabled: true },
        { kind: "separator", id: "s2" },
        { kind: "item", id: "about",   label: "À propos de Drumo",  action: () => { void window.drumApp.updates.getState().then((state) => alert(`Drumo — Groove Studio\nVersion ${state.currentVersion}`)); } },
      ],
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={barRef}
      style={{
        height: 28,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--sep)",
        background: "var(--bg-app)",
        position: "relative",
        zIndex: 200,
        userSelect: "none",
      }}
    >
      {/* App name */}
      <div style={{
        padding: "0 10px 0 14px",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--tx-3)",
        letterSpacing: "0.06em",
        flexShrink: 0,
      }}>
        DRUMO
      </div>

      {/* Menu items */}
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, height: "100%" }}>
        {MENUS.map((menu) => (
          <div
            key={menu.id}
            style={{ position: "relative", display: "flex", alignItems: "stretch" }}
          >
            <button
              type="button"
              onClick={() => toggleMenu(menu.id)}
              style={{
                height: "100%",
                padding: "0 10px",
                background: openMenu === menu.id ? "var(--bg-2)" : "transparent",
                border: "none",
                color: openMenu === menu.id ? "var(--tx-1)" : "var(--tx-2)",
                fontSize: 12,
                fontWeight: 400,
                cursor: "pointer",
                transition: "background 0.1s, color 0.1s",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = "var(--tx-1)";
                if (openMenu && openMenu !== menu.id) {
                  setOpenMenu(menu.id);
                } else if (!openMenu) {
                  el.style.background = "var(--bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                if (openMenu !== menu.id) {
                  el.style.background = "transparent";
                  el.style.color = "var(--tx-2)";
                }
              }}
            >
              {menu.label}
            </button>

            {openMenu === menu.id && (
              <Dropdown items={menu.items} onClose={() => setOpenMenu(null)} />
            )}
          </div>
        ))}
      </div>

      {/* Right side */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 10px",
        flexShrink: 0,
      }}>
        {/* Theme toggle */}
        <RightBtn
          title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
          onClick={() => setTheme({ appearance: isDark ? "light" : "dark" })}
        >
          {isDark ? <IcoSun /> : <IcoMoon />}
        </RightBtn>

        {/* Audio */}
        <RightBtn title="Paramètres audio" onClick={() => onNavigate("settings")}>
          <IcoAudio />
        </RightBtn>

        {/* Settings */}
        <RightBtn title="Préférences (Ctrl+,)" onClick={() => onNavigate("settings")}>
          <IcoSettings />
        </RightBtn>
      </div>
    </div>
  );
};
