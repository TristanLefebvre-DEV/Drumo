/**
 * FloatingPanel — fenêtre flottante draggable et redimensionnable.
 *
 * Rendue via createPortal dans document.body pour flotter au-dessus de tout.
 * Drag   : pointer capture sur le header.
 * Resize : pointer capture sur la poignée bas-droite.
 * Z-index : géré par uiStore.bringToFront.
 * Persistance : position/taille sauvegardées dans uiStore via setPanelGeometry.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUiStore } from "../../store/uiStore";
import type { PanelId } from "../../store/uiStore";

// ─── Config par panneau ────────────────────────────────────────────────────────

interface PanelConfig { minW: number; minH: number; }

const PANEL_CONFIG: Record<PanelId, PanelConfig> = {
  metronome: { minW: 260, minH: 280 },
  humanize:  { minW: 260, minH: 260 },
  mixer:     { minW: 340, minH: 260 },
  balance:   { minW: 280, minH: 280 },
  ai:        { minW: 260, minH: 260 },
};

const HEADER_H = 40;

// ─── Composant ────────────────────────────────────────────────────────────────

interface FloatingPanelProps {
  id:       PanelId;
  title:    string;
  children: ReactNode;
}

export const FloatingPanel = ({ id, title, children }: FloatingPanelProps) => {
  const panel          = useUiStore((s) => s.panels[id]);
  const bringToFront   = useUiStore((s) => s.bringToFront);
  const closePanel     = useUiStore((s) => s.closePanel);
  const setPanelGeo    = useUiStore((s) => s.setPanelGeometry);
  const toggleMinimize = useUiStore((s) => s.toggleMinimize);

  const { minW, minH } = PANEL_CONFIG[id];

  // État local pour le rendu live (évite d'écrire le store à chaque pointermove)
  const [pos,  setPos]  = useState({ x: panel.x, y: panel.y });
  const [size, setSize] = useState({ w: panel.width, h: panel.height });

  // Refs "live" pour éviter les closures obsolètes dans onPointerUp
  const livePos  = useRef(pos);
  const liveSize = useRef(size);
  livePos.current  = pos;
  liveSize.current = size;

  // Sync depuis le store si position/taille changent de l'extérieur (resetLayout…)
  useEffect(() => { setPos({ x: panel.x, y: panel.y }); }, [panel.x, panel.y]);
  useEffect(() => { setSize({ w: panel.width, h: panel.height }); }, [panel.width, panel.height]);

  // Refs état drag / resize
  const dragRef   = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ cx: number; cy: number; sw: number; sh: number } | null>(null);

  // ── Drag (header) ──────────────────────────────────────────────────────────

  const onHeaderDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    bringToFront(id);
    dragRef.current = { cx: e.clientX, cy: e.clientY, px: livePos.current.x, py: livePos.current.y };
  }, [id, bringToFront]);

  const onHeaderMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { cx, cy, px, py } = dragRef.current;
    const maxX = window.innerWidth  - liveSize.current.w;
    const maxY = window.innerHeight - HEADER_H;
    setPos({
      x: Math.max(0, Math.min(maxX, px + e.clientX - cx)),
      y: Math.max(0, Math.min(maxY, py + e.clientY - cy)),
    });
  }, []);

  const onHeaderUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPanelGeo(id, livePos.current.x, livePos.current.y, liveSize.current.w, liveSize.current.h);
  }, [id, setPanelGeo]);

  // ── Resize (poignée bas-droite) ────────────────────────────────────────────

  const onResizeDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    bringToFront(id);
    resizeRef.current = { cx: e.clientX, cy: e.clientY, sw: liveSize.current.w, sh: liveSize.current.h };
  }, [id, bringToFront]);

  const onResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const { cx, cy, sw, sh } = resizeRef.current;
    setSize({
      w: Math.max(minW, sw + e.clientX - cx),
      h: Math.max(minH, sh + e.clientY - cy),
    });
  }, [minW, minH]);

  const onResizeUp = useCallback(() => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    setPanelGeo(id, livePos.current.x, livePos.current.y, liveSize.current.w, liveSize.current.h);
  }, [id, setPanelGeo]);

  // ─────────────────────────────────────────────────────────────────────────

  const isMinimized  = panel.minimized;
  const panelHeight  = isMinimized ? HEADER_H : size.h;

  return createPortal(
    <div
      onPointerDown={() => bringToFront(id)}
      className="fp-appear"
      style={{
        position:        "fixed",
        left:            pos.x,
        top:             pos.y,
        width:           size.w,
        height:          panelHeight,
        zIndex:          panel.zIndex,
        display:         "flex",
        flexDirection:   "column",
        borderRadius:    12,
        overflow:        "hidden",
        background:      "var(--bg-2)",
        backdropFilter:  "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        border:          "1px solid var(--sep-2)",
        boxShadow:       "var(--shadow-md), 0 4px 16px rgba(0,0,0,0.14)",
        userSelect:      "none",
        transition:      "height 0.18s cubic-bezier(0.16,1,0.3,1)",
        contain:         "layout",
      }}
    >
      {/* ── Header (zone de drag) ── */}
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        style={{
          height:        HEADER_H,
          flexShrink:    0,
          display:       "flex",
          alignItems:    "center",
          padding:       "0 8px 0 12px",
          gap:           8,
          background:    "var(--bg-hover)",
          borderBottom:  isMinimized ? "none" : "1px solid var(--sep)",
          cursor:        "grab",
        }}
      >
        {/* Grip dots */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(2, 3px)",
          gridTemplateRows:    "repeat(3, 3px)",
          gap:                 "2.5px",
          flexShrink:          0,
          opacity:             0.22,
          pointerEvents:       "none",
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--tx-1)" }} />
          ))}
        </div>

        {/* Titre */}
        <span style={{
          flex:         1,
          fontSize:     11.5,
          fontWeight:   600,
          color:        "var(--tx-3)",
          letterSpacing:"0.04em",
          textTransform:"uppercase" as const,
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          pointerEvents:"none",
        }}>
          {title}
        </span>

        {/* Contrôles — stopPropagation pour ne pas déclencher le drag */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Réduire / agrandir */}
          <FpBtn
            title={isMinimized ? "Agrandir" : "Réduire"}
            onClick={() => toggleMinimize(id)}
          >
            {isMinimized ? "▭" : "−"}
          </FpBtn>

          {/* Fermer */}
          <FpBtn
            title="Fermer"
            onClick={() => closePanel(id)}
            danger
          >
            ×
          </FpBtn>
        </div>
      </div>

      {/* ── Contenu ── */}
      {!isMinimized && (
        <div style={{
          flex:       1,
          overflow:   "auto",
          minHeight:  0,
          userSelect: "auto",
        }}>
          {children}
        </div>
      )}

      {/* ── Poignée resize bas-droite ── */}
      {!isMinimized && (
        <div
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          title="Redimensionner"
          style={{
            position:      "absolute",
            right:         0,
            bottom:        0,
            width:         20,
            height:        20,
            cursor:        "se-resize",
            display:       "flex",
            alignItems:    "flex-end",
            justifyContent:"flex-end",
            padding:       "4px",
            opacity:       0.30,
            zIndex:        1,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M9 1L1 9" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M9 5L5 9" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>,
    document.body
  );
};

// ─── Bouton header ─────────────────────────────────────────────────────────────

const FpBtn = ({
  children, onClick, title, danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      width:        22,
      height:       22,
      borderRadius: 5,
      border:       "none",
      background:   "transparent",
      cursor:       "pointer",
      fontSize:     danger ? 17 : 14,
      lineHeight:   1,
      color:        "var(--tx-4)",
      display:      "flex",
      alignItems:   "center",
      justifyContent:"center",
      transition:   "color 0.12s, background 0.12s",
      flexShrink:   0,
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.color      = danger ? "var(--c-red)" : "var(--tx-2)";
      el.style.background = danger ? "rgba(217,48,37,0.10)" : "var(--bg-hover)";
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLElement;
      el.style.color      = "var(--tx-4)";
      el.style.background = "transparent";
    }}
  >
    {children}
  </button>
);
