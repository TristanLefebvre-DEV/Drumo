/**
 * ShortcutsSection — Settings panel for drum MIDI editor keyboard shortcuts.
 *
 * Features:
 *  - List all actions grouped by category
 *  - Click a shortcut badge to start recording a new key combination
 *  - Conflict detection with inline warning
 *  - Per-action reset and global reset
 */

import { useState } from "react";
import {
  ACTION_META,
  GROUP_LABELS,
  DEFAULT_SHORTCUTS,
  shortcutLabel,
  findConflict,
  eventToShortcut,
  type DrumAction,
  type ShortcutDef,
  type ActionMeta,
} from "../../core/drumShortcuts";
import { useShortcutsStore } from "../../store/shortcutsStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordingState =
  | { phase: "idle" }
  | { phase: "recording"; action: DrumAction }
  | { phase: "conflict"; action: DrumAction; candidate: ShortcutDef; conflictWith: DrumAction };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const groupedActions = (): [ActionMeta["group"], DrumAction[]][] => {
  const map = new Map<ActionMeta["group"], DrumAction[]>();
  for (const [action, meta] of Object.entries(ACTION_META) as [DrumAction, ActionMeta][]) {
    if (!map.has(meta.group)) map.set(meta.group, []);
    map.get(meta.group)!.push(action);
  }
  const order: ActionMeta["group"][] = [
    "selection", "clipboard", "move", "velocity", "quantize", "zoom", "navigation", "transport",
  ];
  return order.filter((g) => map.has(g)).map((g) => [g, map.get(g)!]);
};

// ─── ShortcutBadge ────────────────────────────────────────────────────────────

const ShortcutBadge = ({
  def,
  recording,
  hasConflict,
  onClick,
}: {
  def: ShortcutDef;
  recording: boolean;
  hasConflict: boolean;
  onClick: () => void;
}) => {
  const label = recording ? "Press a key…" : shortcutLabel(def);

  return (
    <button
      type="button"
      onClick={onClick}
      title={recording ? "Press any key combination" : "Click to remap"}
      style={{
        padding: "3px 8px",
        borderRadius: 5,
        fontSize: 11,
        fontFamily: "monospace",
        fontWeight: 600,
        cursor: "pointer",
        border: recording
          ? "1.5px solid var(--accent)"
          : hasConflict
          ? "1.5px solid var(--c-red)"
          : "1.5px solid var(--sep-2)",
        background: recording
          ? "var(--accent-dim)"
          : hasConflict
          ? "rgba(255,69,58,0.12)"
          : "var(--bg-3)",
        color: recording
          ? "var(--accent)"
          : hasConflict
          ? "var(--c-red)"
          : "var(--tx-1)",
        minWidth: 80,
        textAlign: "center",
        transition: "all 0.12s",
        animation: recording ? "pulse-badge 1s ease infinite" : "none",
      }}
    >
      {label}
    </button>
  );
};

// ─── Main section ─────────────────────────────────────────────────────────────

export const ShortcutsSection = () => {
  const { shortcuts, setShortcut, resetShortcut, resetAll } = useShortcutsStore();
  const [recording, setRecording] = useState<RecordingState>({ phase: "idle" });

  const groups = groupedActions();

  const handleBadgeClick = (action: DrumAction) => {
    if (recording.phase === "recording" && recording.action === action) {
      // Second click on the same badge = cancel recording
      setRecording({ phase: "idle" });
      return;
    }
    setRecording({ phase: "recording", action });

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore bare modifiers
      if (["Control", "Meta", "Shift", "Alt"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      window.removeEventListener("keydown", onKeyDown, { capture: true });

      const candidate = eventToShortcut(e);
      const conflict  = findConflict(shortcuts, action, candidate);

      if (conflict) {
        setRecording({ phase: "conflict", action, candidate, conflictWith: conflict });
      } else {
        setShortcut(action, candidate);
        setRecording({ phase: "idle" });
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
  };

  const handleConfirmOverwrite = () => {
    if (recording.phase !== "conflict") return;
    setShortcut(recording.action, recording.candidate);
    setRecording({ phase: "idle" });
  };

  const handleCancelConflict = () => setRecording({ phase: "idle" });

  const handleReset = (action: DrumAction) => {
    resetShortcut(action);
    if (recording.phase !== "idle" && (recording as { action: DrumAction }).action === action) {
      setRecording({ phase: "idle" });
    }
  };

  const isModified = (action: DrumAction): boolean => {
    const cur = shortcuts[action];
    const def = DEFAULT_SHORTCUTS[action];
    return (
      cur.key      !== def.key  ||
      !!cur.ctrl   !== !!def.ctrl ||
      !!cur.shift  !== !!def.shift ||
      !!cur.alt    !== !!def.alt
    );
  };

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--tx-1)", letterSpacing: "-0.01em" }}>
          Keyboard Shortcuts
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--tx-3)", lineHeight: 1.5, maxWidth: 540 }}>
          Shortcuts are active only when the drum MIDI editor is open. Click a badge to remap it,
          press&nbsp;<kbd style={{ fontFamily: "monospace", fontSize: 11 }}>Esc</kbd>&nbsp;to cancel.
        </p>
      </div>

      {/* ── Conflict banner ── */}
      {recording.phase === "conflict" && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(255,69,58,0.10)",
            border: "1px solid rgba(255,69,58,0.30)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--tx-1)" }}>
            <strong style={{ color: "var(--c-red)" }}>
              {shortcutLabel(recording.candidate)}
            </strong>{" "}
            is already used by{" "}
            <strong>{ACTION_META[recording.conflictWith].label}</strong>.
            Overwrite?
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleConfirmOverwrite}
              style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                background: "var(--c-red)", color: "#fff", border: "none",
              }}
            >
              Overwrite
            </button>
            <button
              type="button"
              onClick={handleCancelConflict}
              style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                background: "var(--bg-4)", color: "var(--tx-1)", border: "1px solid var(--sep-2)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Groups ── */}
      {groups.map(([group, actions]) => (
        <div key={group} style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--tx-3)",
              marginBottom: 2, paddingBottom: 8,
              borderBottom: "1px solid var(--sep)",
            }}
          >
            {GROUP_LABELS[group]}
          </div>

          {actions.map((action) => {
            const meta      = ACTION_META[action];
            const def       = shortcuts[action];
            const isRec     = recording.phase === "recording" && recording.action === action;
            const isConfl   = recording.phase === "conflict"  && recording.action === action;
            const modified  = isModified(action);

            return (
              <div
                key={action}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: "1px solid var(--sep)", gap: 16,
                }}
              >
                {/* Label + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--tx-1)" }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>
                    {meta.description}
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <ShortcutBadge
                    def={def}
                    recording={isRec}
                    hasConflict={isConfl}
                    onClick={() => handleBadgeClick(action)}
                  />

                  {/* Reset button — visible only when modified */}
                  {modified && !isRec && !isConfl && (
                    <button
                      type="button"
                      title="Reset to default"
                      onClick={() => handleReset(action)}
                      style={{
                        width: 22, height: 22, padding: 0, borderRadius: 4,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "transparent", border: "1px solid var(--sep-2)",
                        cursor: "pointer", color: "var(--tx-3)",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                        (e.currentTarget as HTMLElement).style.color = "var(--tx-1)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "var(--tx-3)";
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                        <path d="M4 10a6 6 0 1 0 2-4.47" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4 5v5h5" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Global reset ── */}
      <div style={{ paddingTop: 8, borderTop: "1px solid var(--sep)" }}>
        <button
          type="button"
          onClick={() => {
            if (confirm("Reset all keyboard shortcuts to their defaults?")) {
              resetAll();
              setRecording({ phase: "idle" });
            }
          }}
          style={{
            padding: "7px 16px", borderRadius: 7, fontSize: 12, cursor: "pointer",
            background: "transparent", color: "var(--c-red)",
            border: "1px solid rgba(255,69,58,0.22)", transition: "all 0.12s",
          }}
        >
          Reset all shortcuts to defaults
        </button>
      </div>

      {/* ── CSS animation for recording badge ── */}
      <style>{`
        @keyframes pulse-badge {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
};
