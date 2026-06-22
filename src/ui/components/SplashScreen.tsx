/**
 * SplashScreen — Drumo  (Minimal / Professional)
 *
 * Design reference: Linear, Ableton, Figma, Apple Pro Apps.
 * Principle: restraint is the design. Motion should feel inevitable, not decorative.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   <SplashScreen onComplete={() => setReady(true)} />
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   onComplete   Called after the exit animation finishes.
 *   duration     Total visible time in ms before exit begins. Default 3200.
 *   messages     Loading status rotation. Pass your own or use the defaults.
 *
 * ─── Customization guide ──────────────────────────────────────────────────────
 *
 *   Background color      → BG constant (line ~40)
 *   Accent / progress hue → ACCENT constant
 *   Typography size       → FONT_* constants
 *   Timing                → duration prop or STEP_MS constant
 *   Logo mark             → <DrumMark /> SVG component at the bottom of this file
 */

import { useEffect, useRef, useState } from "react";
import "./SplashScreen.css";

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG          = "#0d0d0f";          // near-black graphite, barely warm
const TEXT_1      = "rgba(240,240,238,0.92)";  // primary — slightly warm white
const TEXT_2      = "rgba(240,240,238,0.38)";  // secondary
const TEXT_3      = "rgba(240,240,238,0.24)";  // tertiary / meta
const ACCENT      = "rgba(210,185,150,0.70)";  // warm neutral — not gold, not neon
const TRACK_BG    = "rgba(255,255,255,0.07)";
const FONT        = "-apple-system, 'Helvetica Neue', system-ui, sans-serif";

// ─── Loading messages ─────────────────────────────────────────────────────────

const DEFAULT_MESSAGES = [
  "Preparing your session…",
  "Loading drum kits…",
  "Building groove engine…",
  "Almost ready…",
  "Ready.",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  onComplete?: () => void;
  duration?:   number;
  messages?:   string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SplashScreen = ({
  onComplete,
  duration = 3200,
  messages  = DEFAULT_MESSAGES,
}: SplashScreenProps) => {
  const [progress,  setProgress]  = useState(0);
  const [msgIndex,  setMsgIndex]  = useState(0);
  const [msgKey,    setMsgKey]    = useState(0);
  const [exiting,   setExiting]   = useState(false);

  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    // ── Progress ramp ──────────────────────────────────────────────────────
    // Fills in three phases: fast start (0→60%), plateau, then sprint to 100%
    // so it never feels stuck.
    const TICK = 80; // ms
    let elapsed = 0;

    const tick = setInterval(() => {
      elapsed += TICK;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out curve that hangs near 90% until we're truly done
      const eased = t < 0.75
        ? t * 1.15                      // fast first 75% of time
        : 0.86 + (t - 0.75) * 0.56;    // slow finish
      setProgress(Math.min(eased * 100, 99));
    }, TICK);

    // ── Status cycle ───────────────────────────────────────────────────────
    const stepMs  = duration / messages.length;
    let   stepIdx = 0;
    const msgTimer = setInterval(() => {
      stepIdx += 1;
      if (stepIdx < messages.length) {
        setMsgIndex(stepIdx);
        setMsgKey((k) => k + 1);
      }
    }, stepMs);

    // ── Exit sequence ──────────────────────────────────────────────────────
    const exitTimer = setTimeout(() => {
      clearInterval(tick);
      clearInterval(msgTimer);
      setProgress(100);
      setMsgIndex(messages.length - 1);
      setMsgKey((k) => k + 1);

      // Brief pause at 100%, then fade out
      setTimeout(() => {
        setExiting(true);
        setTimeout(() => completeRef.current?.(), 480);
      }, 300);
    }, duration);

    return () => {
      clearInterval(tick);
      clearInterval(msgTimer);
      clearTimeout(exitTimer);
    };
  }, []); // eslint-disable-line

  return (
    <div
      className={`splash-root${exiting ? " exiting" : ""}`}
      aria-label="Loading Drumo"
      role="status"
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          9999,
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        background:      BG,
        overflow:        "hidden",
        userSelect:      "none",
        fontFamily:      FONT,
        backgroundImage: "none",
      }}
    >
      {/* ── Animated background gradient ──────────────────────────────────── */}
      <div
        className="splash-bg-gradient"
        aria-hidden="true"
        style={{
          position:    "absolute",
          inset:       "-20%",          // oversized so drift never shows edges
          pointerEvents: "none",
          background:  [
            "radial-gradient(ellipse 55% 45% at 38% 42%, rgba(255,248,230,0.028) 0%, transparent 65%)",
            "radial-gradient(ellipse 40% 35% at 68% 62%, rgba(200,185,160,0.022) 0%, transparent 60%)",
            "radial-gradient(ellipse 30% 25% at 22% 72%, rgba(180,200,220,0.018) 0%, transparent 55%)",
          ].join(", "),
        }}
      />

      {/* ── Centered content ──────────────────────────────────────────────── */}
      <div
        className="splash-content"
        style={{
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           0,
        }}
      >
        {/* Logo mark */}
        <div className="splash-mark" style={{ marginBottom: 18 }}>
          <DrumMark />
        </div>

        {/* Wordmark */}
        <div style={{
          fontSize:      22,
          fontWeight:    500,
          letterSpacing: "0.01em",
          color:         TEXT_1,
          marginBottom:  10,
          lineHeight:    1,
        }}>
          Drumo
        </div>

        {/* Descriptor */}
        <div style={{
          fontSize:      11,
          fontWeight:    400,
          letterSpacing: "0.04em",
          color:         TEXT_2,
          lineHeight:    1.5,
          maxWidth:      280,
          textAlign:     "center",
          marginBottom:  6,
        }}>
          The first software built 100% for drums —<br />
          designed by a drummer, for drummers.
        </div>

        {/* Subtext */}
        <div style={{
          fontSize:      10,
          fontWeight:    400,
          letterSpacing: "0.06em",
          color:         TEXT_3,
          textTransform: "uppercase",
        }}>
          Built for rhythm.&nbsp; Designed for focus.
        </div>
      </div>

      {/* ── Fixed bottom footer: status + progress ────────────────────────── */}
      <div
        className="splash-footer"
        style={{
          position: "absolute",
          bottom:   0,
          left:     0,
          right:    0,
        }}
      >
        {/* Status text */}
        <div style={{
          textAlign:     "center",
          paddingBottom: 14,
        }}>
          <span
            key={msgKey}
            className="splash-status-text"
            style={{
              fontSize:      10,
              fontWeight:    400,
              letterSpacing: "0.06em",
              color:         TEXT_3,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {messages[msgIndex]}
          </span>
        </div>

        {/* Progress track — 1 px, full width */}
        <div style={{
          width:      "100%",
          height:     1,
          background: TRACK_BG,
          position:   "relative",
        }}>
          <div
            className="splash-progress-fill"
            style={{
              position:   "absolute",
              inset:      0,
              right:      "auto",
              width:      `${progress}%`,
              background: ACCENT,
              height:     "100%",
            }}
          />
        </div>
      </div>

      {/* Version — bottom right, very quiet */}
      <div style={{
        position:      "absolute",
        bottom:        10,
        right:         16,
        fontSize:      9,
        color:         TEXT_3,
        fontWeight:    400,
        letterSpacing: "0.04em",
        opacity:       0.6,
      }}>
        {__APP_VERSION__}
      </div>
    </div>
  );
};

// ─── Logo mark ────────────────────────────────────────────────────────────────
// Top-view drum head: two concentric circles + a single centre dot.
// Stroke-only, monochrome, 28 × 28 px.
// Swap this SVG for your real product mark when you have one.

const DrumMark = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Outer rim */}
    <circle
      cx="14" cy="14" r="12"
      stroke="rgba(240,240,238,0.45)"
      strokeWidth="1"
    />
    {/* Inner resonance ring */}
    <circle
      cx="14" cy="14" r="6.5"
      stroke="rgba(240,240,238,0.25)"
      strokeWidth="0.75"
    />
    {/* Strike point */}
    <circle
      cx="14" cy="14" r="1.5"
      fill="rgba(210,185,150,0.80)"
    />
  </svg>
);

export default SplashScreen;
