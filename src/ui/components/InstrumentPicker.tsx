/**
 * InstrumentPicker — modal de sélection d'instrument pour le mode Avancé.
 * Rendu via createPortal. Ferme au clic sur l'overlay ou Escape.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { INSTRUMENT_META } from "../../store/advancedMetronomeStore";
import type { InstrumentId } from "../../store/advancedMetronomeStore";

const INSTRUMENTS: InstrumentId[] = [
  "kick", "snare", "hihat", "hihat-open", "ride", "crash",
  "tom-high", "tom-mid", "tom-low", "rimshot", "clap", "cowbell",
  "percussion", "custom",
];

interface InstrumentPickerProps {
  onSelect: (id: InstrumentId) => void;
  onClose:  () => void;
  disabled?: Set<InstrumentId>; // already-used instruments (soft hint, not a hard block)
}

export const InstrumentPicker = ({ onSelect, onClose, disabled }: InstrumentPickerProps) => {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position:   "fixed",
          inset:      0,
          background: "rgba(0,0,0,0.62)",
          zIndex:     1100,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position:  "fixed",
        top:       "50%",
        left:      "50%",
        transform: "translate(-50%, -50%)",
        zIndex:    1101,
        width:     Math.min(480, window.innerWidth - 32),
        maxHeight: "80vh",
        display:   "flex",
        flexDirection: "column",
        borderRadius:  14,
        background:    "rgba(16,16,22,0.98)",
        border:        "1px solid rgba(255,255,255,0.10)",
        boxShadow:     "0 32px 80px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)",
        overflow:      "hidden",
        animation:     "fp-appear 0.18s cubic-bezier(0.16,1,0.3,1) both",
      }}>
        {/* Header */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "14px 16px 12px",
          borderBottom:   "1px solid rgba(255,255,255,0.07)",
          flexShrink:     0,
        }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-1)", margin: 0 }}>
              Choisir un instrument
            </p>
            <p style={{ fontSize: 11, color: "var(--tx-4)", margin: "2px 0 0" }}>
              Crée un nouveau métronome pour cet instrument
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: "rgba(255,255,255,0.06)", border: "none",
              color: "var(--tx-3)", cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Grid */}
        <div style={{
          overflowY: "auto",
          padding:   "12px 14px 16px",
          display:   "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap:       8,
        }}>
          {INSTRUMENTS.map((id) => {
            const meta     = INSTRUMENT_META[id];
            const isUsed   = disabled?.has(id);

            return (
              <button
                key={id}
                type="button"
                onClick={() => { onSelect(id); onClose(); }}
                style={{
                  display:       "flex",
                  flexDirection: "column",
                  alignItems:    "center",
                  gap:           6,
                  padding:       "12px 6px 10px",
                  borderRadius:  10,
                  background:    isUsed ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.055)",
                  border:        `1.5px solid ${isUsed ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)"}`,
                  cursor:        "pointer",
                  transition:    "all 0.13s",
                  opacity:       isUsed ? 0.55 : 1,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = `${meta.color}22`;
                  el.style.border     = `1.5px solid ${meta.color}66`;
                  el.style.transform  = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = isUsed ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.055)";
                  el.style.border     = `1.5px solid ${isUsed ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)"}`;
                  el.style.transform  = "translateY(0)";
                }}
              >
                <div style={{
                  width:        36,
                  height:       36,
                  borderRadius: "50%",
                  background:   `${meta.color}22`,
                  border:       `1.5px solid ${meta.color}44`,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  fontSize:     18,
                }}>
                  {meta.emoji}
                </div>
                <span style={{
                  fontSize:   10,
                  fontWeight: 600,
                  color:      isUsed ? "var(--tx-4)" : "var(--tx-2)",
                  textAlign:  "center",
                  lineHeight: 1.2,
                  letterSpacing: "0.01em",
                }}>
                  {meta.name}
                </span>
                {isUsed && (
                  <span style={{ fontSize: 8, color: "var(--tx-4)", letterSpacing: "0.05em" }}>
                    EXISTANT
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
};
