/**
 * Moteur de dégradés dynamiques — v4
 *
 * Génère un arrière-plan immersif à partir de DEUX couleurs personnalisées.
 * Styles : flat, subtle, radial, mesh, aurora, neon, prism, wave
 */

import type { Appearance, GradientStyle } from "../../store/settingsStore";

// ─── Utilitaires couleur ──────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function hsl(h: number, s: number, l: number, a?: number): string {
  const H = ((h % 360) + 360) % 360;
  if (a !== undefined)
    return `hsla(${H},${clamp(s,0,100).toFixed(1)}%,${clamp(l,0,100).toFixed(1)}%,${a})`;
  return `hsl(${H},${clamp(s,0,100).toFixed(1)}%,${clamp(l,0,100).toFixed(1)}%)`;
}

function hslToHex(h: number, s: number, l: number): string {
  const H = ((h % 360) + 360) % 360;
  const S = clamp(s, 0, 100) / 100;
  const L = clamp(l, 0, 100) / 100;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const k = (n + H / 30) % 12;
    return Math.round(255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function accentRgb(h: number, s: number, l: number): string {
  const H = ((h % 360) + 360) % 360;
  const S = clamp(s, 0, 100) / 100;
  const L = clamp(l, 0, 100) / 100;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const k = (n + H / 30) % 12;
    return Math.round(255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${f(0)}, ${f(8)}, ${f(4)}`;
}

/** Parse un hex #rrggbb → [h°, s%, l%] */
function hexToHsl(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
    return [hue * 360, s * 100, l * 100];
  }
  return [0, 0, l * 100];
}

// ─── Génération du gradient plein écran ───────────────────────────────────────

function buildBodyGradient(
  h1: number, s1: number,
  h2: number, s2: number,
  style:  GradientStyle,
  angle:  number,
  invert: boolean,
  theme:  Appearance,
): string {
  const isDark = theme === "dark";
  const a  = invert ? (angle + 180) % 360 : angle;

  const si1 = clamp(s1 * 0.9, 30, 100);
  const si2 = clamp(s2 * 0.9, 30, 100);

  const baseL = isDark ? 8 : 90;

  // ── Background base stops ──────────────────────────────────────
  const c1 = hsl(h1, si1,        baseL);
  const c2 = hsl(h2, si2,        isDark ? 11 : 87);
  const c5 = hsl(h2, si2 * 0.8,  isDark ? 14 : 78);
  const cm = hsl((h1 + h2) / 2, (si1 + si2) * 0.25, isDark ? 7 : 94);

  // ── Glow spots — alternate color 1 and color 2 ────────────────
  const g1 = hsl(h1, si1 * 1.1,  isDark ? 44 : 58);  // C1 — top-left
  const g2 = hsl(h2, si2 * 1.05, isDark ? 40 : 55);  // C2 — top-right
  const g3 = hsl(h1, si1 * 0.9,  isDark ? 34 : 48);  // C1 — bottom-center
  const g4 = hsl(h2, si2 * 0.9,  isDark ? 38 : 52);  // C2 — bottom-right
  const g5 = hsl(h1, si1 * 0.75, isDark ? 30 : 46);  // C1 — left-mid
  const g6 = hsl(h2, si2 * 0.65, isDark ? 24 : 42);  // C2 — center

  switch (style) {

    case "flat":
      return isDark ? hsl(h1, si1 * 0.08, 7) : hsl(h1, si1 * 0.06, 94);

    case "subtle":
      return `linear-gradient(${a}deg, ${c1} 0%, ${cm} 45%, ${c2} 100%)`;

    case "radial":
      return [
        `radial-gradient(ellipse 110% 100% at 15%  5%, ${g1} 0%, transparent 48%)`,
        `radial-gradient(ellipse  85%  75% at 90% 90%, ${g2} 0%, transparent 45%)`,
        `radial-gradient(ellipse  75%  65% at 55% 45%, ${g3} 0%, transparent 55%)`,
        isDark ? hsl(h1, si1 * 0.12, 6) : hsl(h1, si1 * 0.07, 93),
      ].join(", ");

    case "mesh":
      return [
        `radial-gradient(ellipse 85% 75% at   0%   0%, ${g1} 0%, transparent 50%)`,
        `radial-gradient(ellipse 70% 60% at 100%   0%, ${g2} 0%, transparent 48%)`,
        `radial-gradient(ellipse 75% 65% at  50% 100%, ${g3} 0%, transparent 52%)`,
        `radial-gradient(ellipse 60% 55% at 100% 100%, ${g4} 0%, transparent 46%)`,
        `radial-gradient(ellipse 55% 50% at   0%  75%, ${g5} 0%, transparent 44%)`,
        `radial-gradient(ellipse 50% 45% at  50%  40%, ${g6} 0%, transparent 58%)`,
        isDark ? hsl(h1, si1 * 0.10, 7) : hsl(h1, si1 * 0.06, 92),
      ].join(", ");

    case "aurora": {
      const stops = isDark
        ? `${c1} 0%, ${g1} 15%, ${c2} 30%, ${cm} 45%, ${g2} 60%, ${c5} 78%, ${c1} 100%`
        : `${hsl(h1,si1*0.3,96)} 0%, ${hsl(h1,si1*0.6,86)} 30%, ${hsl(h2,si2*0.5,90)} 60%, ${hsl(h1,si1*0.3,96)} 100%`;
      return `linear-gradient(${a}deg, ${stops})`;
    }

    case "neon": {
      // Fort glow néon des deux couleurs sur fond quasi-noir
      const n1 = hsl(h1, clamp(si1 * 1.1, 80, 100), isDark ? 52 : 58);
      const n2 = hsl(h2, clamp(si2 * 1.1, 80, 100), isDark ? 48 : 55);
      return [
        `radial-gradient(ellipse 65% 55% at 22% 32%, ${n1} 0%, transparent 60%)`,
        `radial-gradient(ellipse 60% 50% at 80% 72%, ${n2} 0%, transparent 55%)`,
        `radial-gradient(ellipse 40% 35% at 50% 50%, ${hsl((h1+h2)/2, (si1+si2)/2*0.6, isDark ? 30 : 50)} 0%, transparent 65%)`,
        isDark ? hsl(h1, si1 * 0.04, 4) : hsl(h1, si1 * 0.04, 96),
      ].join(", ");
    }

    case "prism": {
      const stops = isDark ? [
        `${hsl(h1, si1 * 0.8, 18)} 0%`,
        `${hsl(h1, si1 * 0.6, 14)} 22%`,
        `${hsl((h1+h2)/2, (si1+si2)*0.35, 11)} 45%`,
        `${hsl(h2, si2 * 0.6, 14)} 68%`,
        `${hsl(h2, si2 * 0.8, 18)} 85%`,
        `${hsl(h1, si1 * 0.5, 12)} 100%`,
      ] : [
        `${hsl(h1, si1 * 0.4, 88)} 0%`,
        `${hsl(h1, si1 * 0.3, 92)} 22%`,
        `${hsl((h1+h2)/2, (si1+si2)*0.18, 94)} 45%`,
        `${hsl(h2, si2 * 0.3, 92)} 68%`,
        `${hsl(h2, si2 * 0.4, 88)} 85%`,
        `${hsl(h1, si1 * 0.25, 90)} 100%`,
      ];
      return `linear-gradient(${a}deg, ${stops.join(", ")})`;
    }

    case "wave":
      return [
        `linear-gradient(${a}deg,           ${hsl(h1, si1, isDark ? 18 : 80)} 0%, transparent 55%)`,
        `linear-gradient(${(a + 65) % 360}deg, ${hsl(h2, si2, isDark ? 15 : 82)} 0%, transparent 52%)`,
        `linear-gradient(${(a - 65 + 360) % 360}deg, ${hsl((h1+h2)/2, (si1+si2)/2*0.65, isDark ? 12 : 86)} 0%, transparent 48%)`,
        isDark ? hsl(h1, si1 * 0.07, 8) : hsl(h1, si1 * 0.05, 93),
      ].join(", ");

    default:
      return isDark ? hsl(h1, si1 * 0.1, 7) : hsl(h1, si1 * 0.06, 94);
  }
}

// ─── Palette composants ───────────────────────────────────────────────────────

function buildComponentPalette(
  h: number, s: number,
  style: GradientStyle,
  theme: Appearance,
): Record<string, string> {
  const isDark  = theme === "dark";
  const isGlass = style !== "flat";

  if (isDark && isGlass) {
    return {
      "--bg-app":   "transparent",
      "--bg-1":     `hsla(${h}, ${s*0.14}%, 8%,  0.42)`,
      "--bg-2":     `hsla(${h}, ${s*0.11}%, 11%, 0.28)`,
      "--bg-3":     `hsla(${h}, ${s*0.09}%, 14%, 0.20)`,
      "--bg-4":     `hsla(${h}, ${s*0.14}%, 17%, 0.48)`,
      "--bg-hover": `hsla(${h}, ${s*0.25}%, 80%, 0.10)`,
      "--bg-sel":   `hsla(${h}, ${s*0.35}%, 80%, 0.16)`,
      "--sep":      `hsla(${h}, ${s*0.25}%, 80%, 0.13)`,
      "--sep-2":    `hsla(${h}, ${s*0.25}%, 80%, 0.20)`,
      "--sep-3":    `hsla(${h}, ${s*0.25}%, 80%, 0.30)`,
      "--tx-1":     `hsl(${h}, 10%, 97%)`,
      "--tx-2":     `hsl(${h},  7%, 74%)`,
      "--tx-3":     `hsl(${h},  4%, 50%)`,
      "--tx-4":     `hsl(${h},  3%, 30%)`,
    };
  }

  if (!isDark && isGlass) {
    return {
      "--bg-app":   "transparent",
      "--bg-1":     `hsla(${h}, ${s*0.08}%, 96%, 0.60)`,
      "--bg-2":     `hsla(${h}, 0%,          100%, 0.50)`,
      "--bg-3":     `hsla(${h}, ${s*0.06}%, 94%, 0.42)`,
      "--bg-4":     `hsla(${h}, ${s*0.10}%, 88%, 0.62)`,
      "--bg-hover": `hsla(${h}, ${s*0.15}%, 20%, 0.06)`,
      "--bg-sel":   `hsla(${h}, ${s*0.20}%, 20%, 0.10)`,
      "--sep":      `hsla(${h}, ${s*0.10}%, 20%, 0.10)`,
      "--sep-2":    `hsla(${h}, ${s*0.10}%, 20%, 0.17)`,
      "--sep-3":    `hsla(${h}, ${s*0.10}%, 20%, 0.25)`,
      "--tx-1":     `hsl(${h}, 12%, 10%)`,
      "--tx-2":     `hsl(${h},  8%, 26%)`,
      "--tx-3":     `hsl(${h},  5%, 52%)`,
      "--tx-4":     `hsl(${h},  3%, 70%)`,
    };
  }

  if (isDark) {
    return {
      "--bg-app":   hsl(h, s*0.10, 6.5),
      "--bg-1":     hsl(h, s*0.11, 9),
      "--bg-2":     hsl(h, s*0.09, 11.5),
      "--bg-3":     hsl(h, s*0.10, 14.5),
      "--bg-4":     hsl(h, s*0.11, 18),
      "--bg-hover": hsl(h, s*0.15, 80, 0.06),
      "--bg-sel":   hsl(h, s*0.20, 80, 0.10),
      "--sep":      hsl(h, s*0.15, 80, 0.07),
      "--sep-2":    hsl(h, s*0.15, 80, 0.12),
      "--sep-3":    hsl(h, s*0.15, 80, 0.18),
      "--tx-1":     hsl(h, 9,  96),
      "--tx-2":     hsl(h, 6,  68),
      "--tx-3":     hsl(h, 4,  43),
      "--tx-4":     hsl(h, 3,  25),
    };
  }
  return {
    "--bg-app":   hsl(h, s*0.07, 95),
    "--bg-1":     hsl(h, s*0.08, 92),
    "--bg-2":     hsl(h, 0,      100),
    "--bg-3":     hsl(h, s*0.07, 95),
    "--bg-4":     hsl(h, s*0.10, 88),
    "--bg-hover": hsl(h, s*0.12, 20, 0.05),
    "--bg-sel":   hsl(h, s*0.18, 20, 0.08),
    "--sep":      hsl(h, s*0.08, 20, 0.08),
    "--sep-2":    hsl(h, s*0.08, 20, 0.14),
    "--sep-3":    hsl(h, s*0.08, 20, 0.22),
    "--tx-1":     hsl(h, 12, 10),
    "--tx-2":     hsl(h,  8, 24),
    "--tx-3":     hsl(h,  5, 52),
    "--tx-4":     hsl(h,  3, 70),
  };
}

// ─── Application sur le DOM ───────────────────────────────────────────────────

let _lastKey = "";

export function applyGradientToDom(
  color1:   string,
  color2:   string,
  theme:    Appearance,
  gradient: GradientStyle,
  angle    = 135,
  invert   = false,
): void {
  const key = `${color1}-${color2}-${theme}-${gradient}-${angle}-${invert}`;
  if (key === _lastKey) return;
  _lastKey = key;

  const [h1, s1, l1] = hexToHsl(color1);
  const [h2, s2]     = hexToHsl(color2);

  const root = document.documentElement;

  // 1. Component palette (primary color drives tint)
  const palette = buildComponentPalette(h1, s1, gradient, theme);
  for (const [k, v] of Object.entries(palette)) root.style.setProperty(k, v);

  // 2. Accent variables from color1
  root.style.setProperty("--accent",          hslToHex(h1, s1, l1));
  root.style.setProperty("--accent-dim",      hsl(h1, s1, l1, 0.15));
  root.style.setProperty("--accent-line",     hsl(h1, s1, l1, 0.55));
  root.style.setProperty("--accent-ring",     hsl(h1, s1, l1, 0.22));
  root.style.setProperty("--sel-bg",          hsl(h1, s1 * 0.3, theme === "dark" ? 20 : 80, 0.12));
  root.style.setProperty("--sel-border",      hsl(h1, s1 * 0.5, theme === "dark" ? 60 : 40, 0.18));
  root.style.setProperty("--grad-accent-rgb", accentRgb(h1, s1, l1));

  // 3. Body gradient
  const grad = buildBodyGradient(h1, s1, h2, s2, gradient, angle, invert, theme);
  root.style.setProperty("--full-grad", grad);
  document.body.style.background           = grad;
  document.body.style.backgroundAttachment = "fixed";

  // 4. Aurora animation
  if (gradient === "aurora") {
    document.body.style.backgroundSize = "300% 300%";
    document.body.classList.add("_aurora-anim");
  } else {
    document.body.style.backgroundSize = "cover";
    document.body.classList.remove("_aurora-anim");
  }

  // 5. Glass mode
  root.setAttribute("data-glass",    gradient !== "flat" ? "1" : "0");
  root.setAttribute("data-gradient", gradient);
}

// ─── Prévisualisation ─────────────────────────────────────────────────────────

export function buildPreviewGradient(
  color1:   string,
  color2:   string,
  style:    GradientStyle,
  theme:    Appearance = "dark",
  angle    = 135,
  invert   = false,
): string {
  const [h1, s1] = hexToHsl(color1);
  const [h2, s2] = hexToHsl(color2);
  return buildBodyGradient(h1, s1, h2, s2, style, angle, invert, theme);
}
