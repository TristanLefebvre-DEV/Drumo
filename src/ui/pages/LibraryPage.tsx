/**
 * Page Bibliothèque — v4
 *
 * Trois onglets :
 *   1. "Mes kits"       — kits personnalisés sauvegardés + kits intégrés
 *   2. "Constructeur"   — choisir pièce par pièce (synth variant ou fichier audio)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ScoresLibraryPage } from "./ScoresLibraryPage";
import * as Tone from "tone";
import { useProjectStore }       from "../../store/projectStore";
import { DRUM_KIT_PRESETS }       from "../../audio/drumKitManager";
import type { DrumKitId }         from "../../audio/drumKitManager";
import {
  PIECE_SOUND_LIBRARY,
  CATEGORY_COLORS,
  type PieceSoundVariant,
  type PieceCategory,
} from "../../audio/drumPieceLibrary";
import { previewVariant }         from "../../audio/drumKitSampler";
import {
  isAudioFile,
  previewSampleFile,
} from "../../audio/sampleKitEngine";
import {
  sampleKitStore,
  KIT_COLORS,
  KIT_EMOJIS,
  type SavedSampleKit,
  type PieceAssignment,
} from "../../store/sampleKitStore";

// ─── Pièces exposées dans le constructeur ─────────────────────────────────────

const BUILDER_PIECES = [
  "kick", "snare", "hihatClosed", "hihatOpen",
  "crash", "ride", "splash", "tomHigh", "tomMid", "tomLow",
] as const;

// ─── Primitives UI ────────────────────────────────────────────────────────────

const Tab = ({
  label, active, badge, onClick,
}: {
  label: string; active: boolean; badge?: string | number; onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 18px", borderRadius: 8,
      fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
      background: active ? "var(--accent-dim)" : "transparent",
      color:      active ? "var(--accent)"     : "var(--tx-3)",
      border:     active ? "1px solid var(--accent-line)" : "1px solid transparent",
      transition: "all 0.14s",
    }}
  >
    {label}
    {badge != null && (
      <span style={{
        padding: "1px 6px", borderRadius: 9, fontSize: 9, fontWeight: 700,
        background: active ? "var(--accent)" : "var(--bg-3)",
        color:      active ? "#fff"          : "var(--tx-3)",
      }}>
        {badge}
      </span>
    )}
  </button>
);

// ─── Carte kit intégré ────────────────────────────────────────────────────────

const KitCard = ({
  kitId, active, onSelect,
}: {
  kitId: DrumKitId; active: boolean; onSelect: () => void;
}) => {
  const kit = DRUM_KIT_PRESETS[kitId];
  if (!kit) return null;
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%", borderRadius: 10, padding: "10px 12px",
        textAlign: "left", cursor: "pointer", transition: "all 0.12s",
        background: active ? "var(--accent-dim)" : "var(--bg-2)",
        border: active ? "1px solid var(--accent-line)" : "1px solid var(--sep-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          backgroundColor: kit.color,
          boxShadow: active ? `0 0 0 3px ${kit.color}33` : "none",
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: active ? "var(--accent)" : "var(--tx-1)" }}>
              {kit.name}
            </p>
            <span>{kit.emoji}</span>
          </div>
          <p style={{ fontSize: 10, color: "var(--tx-3)", margin: "2px 0 0" }}>{kit.description}</p>
        </div>
        {active && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" as const }}>
            Actif
          </span>
        )}
      </div>
    </button>
  );
};

// ─── Carte kit personnalisé ───────────────────────────────────────────────────

// ─── Animation spinner CSS ────────────────────────────────────────────────────

const SPIN_STYLE = `
@keyframes _kit-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes _kit-success {
  0%   { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
}
@keyframes _kit-pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-dim); }
  50%       { box-shadow: 0 0 0 6px transparent; }
}
`;

// Injecte les keyframes une seule fois
if (typeof document !== "undefined" && !document.getElementById("_kit-anim-style")) {
  const s = document.createElement("style");
  s.id = "_kit-anim-style";
  s.textContent = SPIN_STYLE;
  document.head.appendChild(s);
}

const Spinner = () => (
  <span style={{
    display: "inline-block",
    width: 14, height: 14,
    borderRadius: "50%",
    border: "2px solid var(--accent-dim)",
    borderTopColor: "var(--accent)",
    animation: "_kit-spin 0.7s linear infinite",
    flexShrink: 0,
  }} />
);

const SavedKitCard = ({
  kit, active, loadingKitId, onActivate, onEdit, onDelete,
}: {
  kit: SavedSampleKit;
  active: boolean;
  loadingKitId: string | null;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const isLoading   = loadingKitId === kit.id;
  const anyLoading  = loadingKitId !== null;
  const [justActivated, setJustActivated] = useState(false);

  // Flash "succès" pendant 1,5 s après activation
  useEffect(() => {
    if (active && !isLoading) {
      setJustActivated(true);
      const t = setTimeout(() => setJustActivated(false), 1500);
      return () => clearTimeout(t);
    }
  }, [active, isLoading]);

  const sampleCount  = Object.values(kit.pieces).filter((p) => p?.type === "sample").length;
  const variantCount = Object.values(kit.pieces).filter((p) => p?.type === "variant").length;
  const totalCustom  = sampleCount + variantCount;

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: `1px solid ${active ? "var(--accent-line)" : "var(--sep-2)"}`,
      background: active ? "var(--accent-dim)" : "var(--bg-2)",
      transition: "all 0.25s ease",
      animation: justActivated ? "_kit-pulse-border 0.6s ease" : "none",
      opacity: anyLoading && !isLoading ? 0.5 : 1,
    }}>
      {/* Zone cliquable principale */}
      <button
        type="button"
        onClick={onActivate}
        disabled={isLoading || anyLoading}
        style={{
          width: "100%", padding: "12px 14px",
          textAlign: "left",
          cursor: isLoading || anyLoading ? "not-allowed" : "pointer",
          background: "transparent", border: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Emoji / spinner */}
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isLoading ? "var(--accent-dim)" : kit.color + "22",
            border: `1.5px solid ${isLoading ? "var(--accent-line)" : kit.color + "44"}`,
            fontSize: 16,
            transition: "all 0.2s",
          }}>
            {isLoading ? <Spinner /> : kit.emoji}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: active ? "var(--accent)" : "var(--tx-1)",
                transition: "color 0.2s",
              }}>
                {kit.name}
              </span>

              {/* Badge état */}
              {isLoading && (
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "1px 7px", borderRadius: 4,
                  background: "var(--accent-dim)", color: "var(--accent)",
                  border: "1px solid var(--accent-line)",
                }}>
                  Chargement…
                </span>
              )}
              {active && !isLoading && justActivated && (
                <span style={{
                  fontSize: 11, color: "var(--c-green)",
                  animation: "_kit-success 0.35s ease both",
                  display: "inline-block",
                }}>
                  ✓
                </span>
              )}
              {active && !isLoading && !justActivated && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                  background: "var(--accent)", color: "#fff",
                  textTransform: "uppercase" as const,
                }}>
                  Actif
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, fontSize: 9, color: "var(--tx-4)" }}>
              <span>Base : {DRUM_KIT_PRESETS[kit.baseKitId as DrumKitId]?.name ?? kit.baseKitId}</span>
              {totalCustom > 0 && (
                <span style={{ color: "var(--tx-3)" }}>
                  {sampleCount > 0 && `${sampleCount} sample${sampleCount > 1 ? "s" : ""}`}
                  {sampleCount > 0 && variantCount > 0 && " · "}
                  {variantCount > 0 && `${variantCount} variante${variantCount > 1 ? "s" : ""}`}
                </span>
              )}
              {totalCustom === 0 && <span>Sons par défaut</span>}
            </div>
          </div>
        </div>
      </button>

      {/* Actions */}
      <div style={{
        display: "flex", gap: 5, padding: "6px 14px 10px",
        borderTop: "1px solid var(--sep)",
      }}>
        <button
          type="button"
          onClick={onActivate}
          disabled={isLoading || anyLoading}
          style={{
            flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            cursor: (isLoading || anyLoading) ? "not-allowed" : "pointer",
            background: active && !isLoading
              ? justActivated ? "var(--c-green)" : "var(--accent)"
              : isLoading ? "var(--accent-dim)" : "var(--bg-3)",
            color:  active && !isLoading ? "#fff" : isLoading ? "var(--accent)" : "var(--tx-2)",
            border: active ? "1px solid var(--accent-line)" : "1px solid var(--sep)",
            transition: "all 0.25s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {isLoading ? <><Spinner /> Chargement…</> : active ? "✓ Actif" : "Activer"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={anyLoading}
          title="Modifier"
          style={{
            padding: "6px 10px", borderRadius: 7, fontSize: 11,
            cursor: anyLoading ? "not-allowed" : "pointer",
            background: "var(--bg-3)", color: "var(--tx-3)",
            border: "1px solid var(--sep)", transition: "all 0.12s",
            opacity: anyLoading ? 0.4 : 1,
          }}
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={anyLoading}
          title="Supprimer"
          style={{
            padding: "6px 10px", borderRadius: 7, fontSize: 11,
            cursor: anyLoading ? "not-allowed" : "pointer",
            background: "transparent", color: "var(--c-red)",
            border: "1px solid transparent", transition: "all 0.12s",
            opacity: anyLoading ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!anyLoading) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,69,58,0.30)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
};

// ─── Boîte de dialogue Sauvegarder le kit ────────────────────────────────────

const SaveKitDialog = ({
  defaultName,
  baseKitId,
  onSave,
  onCancel,
}: {
  defaultName: string;
  baseKitId: string;
  onSave: (name: string, color: string, emoji: string) => void;
  onCancel: () => void;
}) => {
  const [name,  setName]  = useState(defaultName);
  const [color, setColor] = useState(KIT_COLORS[0]);
  const [emoji, setEmoji] = useState(KIT_EMOJIS[0]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center",
    }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 380, borderRadius: 16, padding: 24,
          background: "var(--bg-2)", border: "1px solid var(--sep-2)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--tx-1)", margin: "0 0 18px" }}>
          Sauvegarder le kit
        </h2>

        {/* Nom */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "var(--tx-3)", display: "block", marginBottom: 5 }}>Nom</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim(), color, emoji); }}
            placeholder="Mon kit personnalisé"
            autoFocus
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8,
              background: "var(--bg-3)", color: "var(--tx-1)",
              border: "1px solid var(--sep)", fontSize: 13,
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Emoji */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "var(--tx-3)", display: "block", marginBottom: 5 }}>Icône</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {KIT_EMOJIS.map((em) => (
              <button
                key={em} type="button"
                onClick={() => setEmoji(em)}
                style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: 16, cursor: "pointer",
                  background: emoji === em ? "var(--accent-dim)" : "var(--bg-3)",
                  border: emoji === em ? "1.5px solid var(--accent-line)" : "1.5px solid var(--sep)",
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Couleur */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "var(--tx-3)", display: "block", marginBottom: 5 }}>Couleur</label>
          <div style={{ display: "flex", gap: 8 }}>
            {KIT_COLORS.map((c) => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 7, cursor: "pointer",
                  background: c, border: "none",
                  outline: color === c ? `3px solid ${c}` : "3px solid transparent",
                  outlineOffset: 2,
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                  transition: "all 0.12s",
                }}
              />
            ))}
          </div>
        </div>

        <p style={{ fontSize: 10, color: "var(--tx-4)", margin: "0 0 16px" }}>
          Kit de base : {DRUM_KIT_PRESETS[baseKitId as DrumKitId]?.name ?? baseKitId}
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => { if (name.trim()) onSave(name.trim(), color, emoji); }}
            disabled={!name.trim()}
            style={{
              flex: 1, padding: "9px 16px", borderRadius: 9,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: "var(--accent)", color: "#fff", border: "none",
              opacity: name.trim() ? 1 : 0.4,
            }}
          >
            Sauvegarder
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "9px 16px", borderRadius: 9, fontSize: 12,
              cursor: "pointer", background: "var(--bg-3)",
              color: "var(--tx-2)", border: "1px solid var(--sep)",
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Rangée de pièce dans le constructeur ────────────────────────────────────

const PIECE_LABELS: Record<string, string> = {
  kick: "Grosse caisse", snare: "Caisse claire",
  hihatClosed: "Hi-Hat fermé", hihatOpen: "Hi-Hat ouvert",
  crash: "Crash", ride: "Ride", splash: "Splash",
  tomHigh: "Tom aigu", tomMid: "Tom médium", tomLow: "Tom grave",
};

const PieceRow = ({
  pieceName,
  sampleFile,
  variantId,
  onSample,
  onVariant,
  onClear,
}: {
  pieceName:  string;
  sampleFile: { path: string; name: string } | null;
  variantId:  string | null;
  onSample:   (filePath: string, fileName: string) => void;
  onVariant:  (variantId: string | null) => void;
  onClear:    () => void;
}) => {
  const [expanded,   setExpanded]   = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const [previewErr, setPreviewErr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const category    = PIECE_SOUND_LIBRARY[pieceName];
  const hasCustom   = !!(sampleFile || variantId);
  const displayName = sampleFile
    ? sampleFile.name
    : variantId
    ? category?.variants.find((v) => v.id === variantId)?.name
    : null;

  // ── Drag & Drop ──
  const onDragOver  = useCallback((e: React.DragEvent) => {
    const items = Array.from(e.dataTransfer.items);
    const hasAudio = items.some((i) => i.type.startsWith("audio/") || i.type === "");
    if (hasAudio || items.length > 0) { e.preventDefault(); setDragOver(true); }
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !isAudioFile(file.name)) return;
    await Tone.start();
    // Electron expose file.path (chemin absolu)
    const path = (file as File & { path?: string }).path ?? URL.createObjectURL(file);
    onSample(path, file.name);
  }, [onSample]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await Tone.start();
    const path = (file as File & { path?: string }).path ?? URL.createObjectURL(file);
    onSample(path, file.name);
    e.target.value = "";
  }, [onSample]);

  const handlePreviewVariant = useCallback(async (v: PieceSoundVariant) => {
    await Tone.start();
    previewVariant(v);
  }, []);

  const handlePreviewSample = useCallback(async () => {
    if (!sampleFile) return;
    setPreviewErr(false);
    try {
      await Tone.start();
      await previewSampleFile(sampleFile.path);
    } catch {
      setPreviewErr(true);
      setTimeout(() => setPreviewErr(false), 3000);
    }
  }, [sampleFile]);

  return (
    <div style={{
      borderRadius: 10, overflow: "hidden",
      border: `1px solid ${dragOver ? "var(--accent)" : hasCustom ? "var(--accent-line)" : "var(--sep)"}`,
      background: dragOver ? "var(--accent-dim)" : hasCustom ? "rgba(0,113,227,0.04)" : "var(--bg-2)",
      transition: "all 0.15s",
    }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* En-tête de la pièce */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
      }}>
        {/* Nom + état */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: hasCustom ? "var(--accent)" : "var(--tx-1)",
          }}>
            {PIECE_LABELS[pieceName] ?? pieceName}
          </span>

          {/* Badge type */}
          {sampleFile && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
              background: "rgba(48,209,88,0.15)", color: "var(--c-green)",
              border: "1px solid rgba(48,209,88,0.25)",
            }}>
              🎵 {sampleFile.name.length > 18 ? sampleFile.name.slice(0, 16) + "…" : sampleFile.name}
            </span>
          )}
          {!sampleFile && variantId && displayName && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
              background: "var(--accent-dim)", color: "var(--accent)",
              border: "1px solid var(--accent-line)",
            }}>
              {displayName}
            </span>
          )}
          {!hasCustom && (
            <span style={{ fontSize: 10, color: "var(--tx-4)" }}>Son du kit</span>
          )}

          <span style={{
            fontSize: 9, color: "var(--tx-4)", marginLeft: "auto",
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.15s", display: "inline-block",
          }}>▼</span>
        </button>

        {/* Boutons d'action */}
        <div style={{ display: "flex", gap: 4 }}>
          {/* Preview */}
          {(sampleFile || variantId) && (
            <button
              type="button"
              title="Écouter"
              onClick={sampleFile ? handlePreviewSample : undefined}
              style={{
                width: 26, height: 26, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: previewErr ? "rgba(255,69,58,0.15)" : "var(--bg-3)",
                border: `1px solid ${previewErr ? "var(--c-red)" : "var(--sep)"}`,
                cursor: "pointer", fontSize: 10,
                color: previewErr ? "var(--c-red)" : "var(--c-green)",
              }}
            >
              {previewErr ? "!" : "▶"}
            </button>
          )}

          {/* Ouvrir fichier */}
          <button
            type="button"
            title="Charger un fichier audio (MP3, WAV…)"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 26, height: 26, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-3)", border: "1px solid var(--sep)",
              cursor: "pointer", fontSize: 11, color: "var(--tx-2)",
              fontWeight: 700,
            }}
          >
            +
          </button>

          {/* Réinitialiser */}
          {hasCustom && (
            <button
              type="button"
              title="Revenir au son du kit"
              onClick={onClear}
              style={{
                width: 26, height: 26, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "1px solid var(--sep)",
                cursor: "pointer", fontSize: 13, color: "var(--tx-4)",
              }}
            >
              ↺
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a,.aiff"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>

      {/* Zone de drop visuelle */}
      {dragOver && (
        <div style={{
          padding: "10px 12px",
          textAlign: "center", fontSize: 11, color: "var(--accent)",
          borderTop: "1px dashed var(--accent-line)",
          background: "var(--accent-dim)",
        }}>
          🎵 Déposer le fichier audio ici
        </div>
      )}

      {/* Variantes synth */}
      {expanded && !sampleFile && category && (
        <div style={{
          padding: "4px 10px 10px",
          borderTop: "1px solid var(--sep)",
          background: "var(--bg-1)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <p style={{ fontSize: 9, color: "var(--tx-4)", textTransform: "uppercase" as const, letterSpacing: "0.07em", margin: "4px 0 6px" }}>
            Variantes de synthèse
          </p>
          {/* Option par défaut */}
          <button
            type="button"
            onClick={() => onVariant(null)}
            style={{
              padding: "6px 10px", borderRadius: 7, textAlign: "left", cursor: "pointer",
              background: !variantId ? "var(--accent-dim)" : "var(--bg-3)",
              border: `1px solid ${!variantId ? "var(--accent-line)" : "var(--sep)"}`,
              fontSize: 11, color: !variantId ? "var(--accent)" : "var(--tx-2)",
              fontWeight: !variantId ? 600 : 400,
            }}
          >
            Son du kit (par défaut)
          </button>
          {category.variants.map((v) => {
            const isSelected = variantId === v.id;
            const catColor = CATEGORY_COLORS[v.category as PieceCategory] ?? "var(--tx-3)";
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 10px", borderRadius: 7, cursor: "pointer",
                background: isSelected ? "var(--accent-dim)" : "var(--bg-3)",
                border: `1px solid ${isSelected ? "var(--accent-line)" : "var(--sep)"}`,
              }}
                onClick={() => onVariant(v.id)}
              >
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontSize: 11, fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? "var(--accent)" : "var(--tx-1)",
                  }}>
                    {v.name}
                  </span>
                  <span style={{
                    marginLeft: 7, fontSize: 8, fontWeight: 700, padding: "1px 4px",
                    borderRadius: 3, background: `${catColor}22`, color: catColor,
                    textTransform: "uppercase" as const, letterSpacing: "0.04em",
                  }}>
                    {v.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handlePreviewVariant(v); }}
                  style={{
                    width: 22, height: 22, borderRadius: 5, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--bg-4)", border: "none",
                    fontSize: 8, color: "var(--tx-3)",
                  }}
                >
                  ▶
                </button>
              </div>
            );
          })}

          <p style={{ fontSize: 9, color: "var(--tx-4)", margin: "4px 0 0", fontStyle: "italic" }}>
            Ou glisse un fichier MP3/WAV sur cette rangée ↑
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────

export interface LibraryPageProps {
  onOpenScoreInComposer?: (filePath: string) => void;
}

export const LibraryPage = ({ onOpenScoreInComposer }: LibraryPageProps = {}) => {
  const {
    activeDrumKitId, activeDrumKit, setDrumKit,
    customPieceSounds, samplePieceFiles,
    setCustomPieceSound, setCustomPieceSample, clearCustomPiece, resetCustomPieceSounds,
    activeSampleKitId, loadingKitId, loadSampleKit, unloadSampleKit,
  } = useProjectStore();

  const [tab,           setTab]           = useState<"library" | "builder" | "scores">("library");
  const [savedKits,     setSavedKits]     = useState<SavedSampleKit[]>(() => sampleKitStore.getAll());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editKitId,     setEditKitId]     = useState<string | null>(null);

  const kitIds = Object.keys(DRUM_KIT_PRESETS) as DrumKitId[];

  const totalCustom = BUILDER_PIECES.filter((p) => samplePieceFiles[p] || customPieceSounds[p]).length;

  const refreshSaved = () => setSavedKits(sampleKitStore.getAll());

  // ── Sauvegarder le kit actuel ──────────────────────────────────────────────

  const handleSave = (name: string, color: string, emoji: string) => {
    const pieces: Partial<Record<string, PieceAssignment>> = {};
    for (const pieceName of BUILDER_PIECES) {
      const sf = samplePieceFiles[pieceName];
      const vi = customPieceSounds[pieceName];
      if (sf) {
        pieces[pieceName] = { type: "sample", filePath: sf.path, fileName: sf.name };
      } else if (vi) {
        pieces[pieceName] = { type: "variant", variantId: vi };
      }
    }

    if (editKitId) {
      sampleKitStore.update(editKitId, { name, color, emoji, pieces });
    } else {
      sampleKitStore.create({ name, color, emoji, baseKitId: activeDrumKitId, pieces });
    }

    refreshSaved();
    setShowSaveDialog(false);
    setEditKitId(null);
  };

  // ── Activer un kit sauvegardé ──────────────────────────────────────────────

  const handleActivateKit = async (kitId: string) => {
    if (kitId === activeSampleKitId) {
      unloadSampleKit();
    } else {
      await loadSampleKit(kitId);
    }
  };

  // ── Modifier un kit (charger ses assignations dans le constructeur) ─────────

  const handleEditKit = async (kitId: string) => {
    await loadSampleKit(kitId);
    setEditKitId(kitId);
    setTab("builder");
  };

  // ── Supprimer un kit ───────────────────────────────────────────────────────

  const handleDeleteKit = (kitId: string) => {
    if (!confirm("Supprimer ce kit personnalisé ?")) return;
    sampleKitStore.delete(kitId);
    if (activeSampleKitId === kitId) unloadSampleKit();
    refreshSaved();
  };

  return (
    <div className="fade-in" style={{
      display: "flex", height: "100%", flexDirection: "column",
      overflow: "hidden", background: "var(--bg-app)",
    }}>

      {/* ── En-tête avec onglets ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 14px 8px",
        borderBottom: "1px solid var(--sep)",
        background: "var(--bg-1)", flexShrink: 0,
      }}>
        <Tab label="Bibliothèque" active={tab === "library"} badge={savedKits.length > 0 ? savedKits.length : undefined} onClick={() => setTab("library")} />
        <Tab label="Constructeur de kit" active={tab === "builder"} badge={totalCustom > 0 ? totalCustom : undefined} onClick={() => setTab("builder")} />
        <Tab label="Mes partitions" active={tab === "scores"} onClick={() => setTab("scores")} />
      </div>

      {/* ── ONGLET : Bibliothèque ── */}
      {tab === "library" && (
        <div style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", gap: 14 }}>

          {/* Colonne gauche : mes kits + kits intégrés */}
          <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>

            {/* Mes kits personnalisés */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--tx-1)", margin: 0 }}>
                  Mes kits
                </h2>
                <button
                  type="button"
                  onClick={() => { setEditKitId(null); setShowSaveDialog(true); }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", background: "var(--accent-dim)",
                    color: "var(--accent)", border: "1px solid var(--accent-line)",
                  }}
                >
                  + Nouveau
                </button>
              </div>

              {savedKits.length === 0 ? (
                <div style={{
                  padding: "16px 14px", borderRadius: 10, textAlign: "center",
                  background: "var(--bg-2)", border: "1px dashed var(--sep-2)",
                }}>
                  <p style={{ fontSize: 12, color: "var(--tx-3)", margin: "0 0 6px" }}>
                    Aucun kit sauvegardé
                  </p>
                  <p style={{ fontSize: 11, color: "var(--tx-4)", margin: 0 }}>
                    Crée ton kit dans le <strong style={{ color: "var(--tx-2)" }}>Constructeur</strong> puis sauvegarde-le
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {savedKits.map((kit) => (
                    <SavedKitCard
                      key={kit.id}
                      kit={kit}
                      active={activeSampleKitId === kit.id}
                      loadingKitId={loadingKitId}
                      onActivate={() => void handleActivateKit(kit.id)}
                      onEdit={() => void handleEditKit(kit.id)}
                      onDelete={() => handleDeleteKit(kit.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Séparateur */}
            <div style={{ borderTop: "1px solid var(--sep)" }} />

            {/* Kits intégrés */}
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--tx-1)", margin: "0 0 8px" }}>
                Kits intégrés
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {kitIds.map((id) => (
                  <KitCard
                    key={id}
                    kitId={id}
                    active={activeDrumKitId === id && !activeSampleKitId}
                    onSelect={() => { setDrumKit(id); unloadSampleKit(); }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Détail du kit actif */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            {activeSampleKitId ? (
              (() => {
                const sk = savedKits.find((k) => k.id === activeSampleKitId);
                if (!sk) return null;
                const sampleCount  = Object.values(sk.pieces).filter((p) => p?.type === "sample").length;
                const variantCount = Object.values(sk.pieces).filter((p) => p?.type === "variant").length;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: sk.color + "22", border: `1.5px solid ${sk.color}44`,
                        fontSize: 22,
                      }}>
                        {sk.emoji}
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-1)", margin: "0 0 4px" }}>{sk.name}</h2>
                        <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>
                          Base : {DRUM_KIT_PRESETS[sk.baseKitId as DrumKitId]?.name} ·{" "}
                          {sampleCount > 0 && `${sampleCount} sample${sampleCount > 1 ? "s" : ""}`}
                          {sampleCount > 0 && variantCount > 0 && " · "}
                          {variantCount > 0 && `${variantCount} variante${variantCount > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                    {/* Liste des pièces personnalisées */}
                    {Object.entries(sk.pieces).map(([pieceName, a]) => {
                      if (!a) return null;
                      return (
                        <div key={pieceName} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "7px 10px", borderRadius: 8, fontSize: 11,
                          background: "var(--bg-2)", border: "1px solid var(--sep)",
                        }}>
                          <span style={{ color: "var(--tx-2)" }}>{PIECE_LABELS[pieceName] ?? pieceName}</span>
                          <span style={{
                            padding: "1px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                            background: a.type === "sample" ? "rgba(48,209,88,0.12)" : "var(--accent-dim)",
                            color: a.type === "sample" ? "var(--c-green)" : "var(--accent)",
                          }}>
                            {a.type === "sample" ? `🎵 ${a.fileName}` : a.variantId}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              (() => {
                const kit = DRUM_KIT_PRESETS[activeDrumKitId];
                if (!kit) return null;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-1)", margin: "0 0 6px" }}>
                        {kit.emoji} {kit.name}
                      </h2>
                      <p style={{ fontSize: 12, color: "var(--tx-3)", margin: 0 }}>{kit.description}</p>
                    </div>
                    <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--sep)" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--tx-4)", margin: "0 0 10px" }}>
                        Caractéristiques
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          ["Vélocité",     kit.playbackStyle.velocityCurve],
                          ["Humanisation", `${Math.round(kit.playbackStyle.humanizeAmount * 100)}%`],
                          ["Compression",  `${Math.round(kit.playbackStyle.compression * 100)}%`],
                          ["Réverbe",      `${Math.round(kit.mixer.roomAmount * 100)}%`],
                        ].map(([l, v]) => (
                          <div key={l} style={{ padding: "7px 9px", borderRadius: 7, background: "var(--bg-3)" }}>
                            <p style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "var(--tx-4)", margin: "0 0 2px" }}>{l}</p>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)", margin: 0, fontFamily: "monospace" }}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--tx-4)" }}>
                      💡 Va dans le <strong style={{ color: "var(--tx-2)" }}>Constructeur</strong> pour personnaliser les sons pièce par pièce et créer ton kit unique.
                    </p>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── ONGLET : Constructeur ── */}
      {tab === "builder" && (
        <div style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", gap: 14 }}>

          {/* Constructeur principal */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* En-tête */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: "var(--tx-1)", margin: "0 0 4px" }}>
                  Constructeur de kit
                </h1>
                <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>
                  Glisse un MP3/WAV · clique <strong>+</strong> pour parcourir · clique ▶ pour écouter
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {totalCustom > 0 && (
                  <button
                    type="button"
                    onClick={resetCustomPieceSounds}
                    style={{
                      padding: "5px 10px", borderRadius: 7, fontSize: 11,
                      background: "transparent", color: "var(--tx-3)",
                      border: "1px solid var(--sep)", cursor: "pointer",
                    }}
                  >
                    Tout réinitialiser
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(true)}
                  style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                    cursor: "pointer", background: "var(--accent)",
                    color: "#fff", border: "none",
                  }}
                >
                  💾 Sauvegarder ce kit
                </button>
              </div>
            </div>

            {/* Zones de drop par pièce */}
            {BUILDER_PIECES.map((pieceName) => (
              <PieceRow
                key={pieceName}
                pieceName={pieceName}
                sampleFile={samplePieceFiles[pieceName] ?? null}
                variantId={customPieceSounds[pieceName] ?? null}
                onSample={(path, name) => void setCustomPieceSample(pieceName, path, name)}
                onVariant={(vid) => setCustomPieceSound(pieceName, vid)}
                onClear={() => clearCustomPiece(pieceName)}
              />
            ))}
          </div>

          {/* Panneau résumé */}
          <div style={{
            width: 220, flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 10, overflowY: "auto",
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "var(--tx-4)", margin: 0 }}>
              Kit actuel
            </p>

            {/* Base */}
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--sep)" }}>
              <p style={{ fontSize: 9, color: "var(--tx-4)", margin: "0 0 5px", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Base synth</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: activeDrumKit.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)" }}>{activeDrumKit.name}</span>
              </div>
            </div>

            {/* Sons personnalisés */}
            {totalCustom > 0 ? (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--sep-2)" }}>
                <p style={{ fontSize: 9, color: "var(--tx-4)", margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                  {totalCustom} pièce{totalCustom > 1 ? "s" : ""} modifiée{totalCustom > 1 ? "s" : ""}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {BUILDER_PIECES.map((p) => {
                    const sf = samplePieceFiles[p];
                    const vi = customPieceSounds[p];
                    if (!sf && !vi) return null;
                    return (
                      <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                        <span style={{ color: "var(--tx-3)" }}>{PIECE_LABELS[p] ?? p}</span>
                        <span style={{
                          padding: "1px 5px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                          background: sf ? "rgba(48,209,88,0.12)" : "var(--accent-dim)",
                          color: sf ? "var(--c-green)" : "var(--accent)",
                        }}>
                          {sf ? "🎵" : "◆"} {sf ? sf.name.slice(0, 10) : vi}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "var(--tx-4)", lineHeight: 1.5 }}>
                Aucune pièce modifiée. Développe une pièce pour choisir un son.
              </p>
            )}

            {/* Hint drag & drop */}
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              background: "var(--bg-1)", border: "1px dashed var(--sep-2)",
              fontSize: 10, color: "var(--tx-4)", lineHeight: 1.5,
            }}>
              <strong style={{ color: "var(--tx-2)" }}>Formats acceptés</strong><br/>
              MP3 · WAV · OGG · FLAC · AAC · M4A · AIFF
              <br /><br />
              Glisse un fichier directement sur la rangée de la pièce.
            </div>
          </div>
        </div>
      )}

      {/* ── ONGLET : Mes partitions ── */}
      {tab === "scores" && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <ScoresLibraryPage onOpenInComposer={onOpenScoreInComposer} />
        </div>
      )}

      {/* ── Boîte de dialogue sauvegarde ── */}
      {showSaveDialog && (
        <SaveKitDialog
          defaultName={editKitId ? (savedKits.find((k) => k.id === editKitId)?.name ?? "Mon kit") : `Kit ${new Date().toLocaleDateString("fr-FR")}`}
          baseKitId={activeDrumKitId}
          onSave={handleSave}
          onCancel={() => { setShowSaveDialog(false); setEditKitId(null); }}
        />
      )}
    </div>
  );
};
