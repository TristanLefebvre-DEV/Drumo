/**
 * Moteur de dégradés dynamiques — v3
 *
 * Génère un arrière-plan immersif couvrant 100 % de la fenêtre,
 * visible derrière tous les composants (sidebar, panneaux, cartes…).
 *
 * Architecture :
 *   • body         → gradient plein écran (--full-grad)
 *   • --bg-1…4     → RGBA très semi-transparents → gradient visible + backdrop-filter
 *   • --accent-*   → dérivés de la teinte de base
 *
 * Styles disponibles :
 *   flat, subtle, radial, mesh, aurora
 */

import type { AccentColor, Appearance, GradientStyle } from "../../store/settingsStore";

// ─── Teintes de base par couleur d'accent ─────────────────────────────────────

const ACCENT_HSL: Record<AccentColor, readonly [number, number, number]> = {
  blue:   [211, 100, 55],
  red:    [  4,  95, 62],
  green:  [142,  68, 52],
  purple: [280,  84, 62],
  orange: [ 36,  99, 56],
  black:  [240,   4, 46],
};

// ─── Utilitaires couleur ──────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function hsl(h: number, s: number, l: number, a?: number): string {
  const H = ((h % 360) + 360) % 360;
  if (a !== undefined) return `hsla(${H},${clamp(s,0,100).toFixed(1)}%,${clamp(l,0,100).toFixed(1)}%,${a})`;
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

// ─── Génération du gradient plein écran ───────────────────────────────────────

function buildBodyGradient(
  h: number, s: number,
  style: GradientStyle,
  angle: number,
  invert: boolean,
  theme: Appearance
): string {
  const isDark = theme === "dark";
  const a = invert ? (angle + 180) % 360 : angle;

  // Saturation forte pour un effet premium visible
  const si = clamp(s * 0.9, 30, 100);

  // Base très sombre / très claire selon le thème
  const baseL = isDark ? 8 : 90;

  // 5 variantes de couleurs pour les transitions douces
  const c1 = hsl(h,         si,        baseL);
  const c2 = hsl(h + 18,    si * 1.05, isDark ? 12 : 86);
  const c3 = hsl(h + 38,    si * 0.95, isDark ? 16 : 82);
  const c4 = hsl(h - 22,    si * 0.85, isDark ? 10 : 84);
  const c5 = hsl(h + 55,    si * 0.80, isDark ? 14 : 78);
  const cm = hsl(h + 10,    si * 0.40, isDark ? 7  : 94);

  // Glows lumineux — beaucoup plus clairs pour être visibles à travers les panneaux
  const g1 = hsl(h,         si * 1.1,  isDark ? 44 : 58);
  const g2 = hsl(h + 40,    si * 1.0,  isDark ? 38 : 52);
  const g3 = hsl(h - 30,    si * 0.9,  isDark ? 32 : 46);
  const g4 = hsl(h - 50,    si * 0.85, isDark ? 36 : 50);
  const g5 = hsl(h + 70,    si * 0.75, isDark ? 28 : 44);

  switch (style) {
    case "flat":
      return isDark ? hsl(h, si * 0.08, 7) : hsl(h, si * 0.06, 94);

    case "subtle":
      return `linear-gradient(${a}deg, ${c1} 0%, ${cm} 40%, ${c3} 100%)`;

    case "radial":
      // Halo central + coins — inspiré de Discord Nitro / Linear
      return [
        `radial-gradient(ellipse 110% 100% at 15%  5%, ${g1} 0%, transparent 48%)`,
        `radial-gradient(ellipse  85%  75% at 90% 90%, ${g2} 0%, transparent 45%)`,
        `radial-gradient(ellipse  75%  65% at 55% 45%, ${g3} 0%, transparent 55%)`,
        isDark ? hsl(h, si * 0.15, 6) : hsl(h, si * 0.08, 93),
      ].join(", ");

    case "mesh":
      // Mesh premium : 6 glows positionnés aux coins + centre — style Arc Browser / Raycast
      return [
        `radial-gradient(ellipse 85% 75% at   0%   0%, ${g1} 0%, transparent 50%)`,
        `radial-gradient(ellipse 70% 60% at 100%   0%, ${g2} 0%, transparent 48%)`,
        `radial-gradient(ellipse 75% 65% at  50% 100%, ${g3} 0%, transparent 52%)`,
        `radial-gradient(ellipse 60% 55% at 100% 100%, ${g4} 0%, transparent 46%)`,
        `radial-gradient(ellipse 55% 50% at   0%  75%, ${g5} 0%, transparent 44%)`,
        `radial-gradient(ellipse 50% 45% at  50%  40%, ${hsl(h+20, si*0.65, isDark?20:65)} 0%, transparent 58%)`,
        isDark ? hsl(h, si * 0.12, 7) : hsl(h, si * 0.07, 92),
      ].join(", ");

    case "aurora": {
      // Aurora : bandes diagonales lumineuses sur fond très sombre
      const stops = isDark
        ? `${c1} 0%, ${g1} 15%, ${c2} 30%, ${cm} 45%, ${g2} 60%, ${c5} 78%, ${c1} 100%`
        : `${hsl(h,si*0.3,96)} 0%, ${hsl(h+20,si*0.6,86)} 30%, ${hsl(h+45,si*0.5,90)} 60%, ${hsl(h,si*0.3,96)} 100%`;
      return `linear-gradient(${a}deg, ${stops})`;
    }

    default:
      return isDark ? hsl(h, si * 0.1, 7) : hsl(h, si * 0.06, 94);
  }
}

// ─── Palette des composants (RGBA très semi-transparents = dégradé visible) ──

function buildComponentPalette(
  h: number, s: number,
  style: GradientStyle,
  theme: Appearance
): Record<string, string> {
  const isDark = theme === "dark";
  const isGlass = style !== "flat";

  if (isDark && isGlass) {
    // Mode sombre + dégradé : opacité très basse → le dégradé body perce à travers
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
    // Mode clair + dégradé : verre léger
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

  // Flat — fonds solides, pas de verre
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
  accent:   AccentColor,
  theme:    Appearance,
  gradient: GradientStyle,
  angle    = 135,
  invert   = false
): void {
  const key = `${accent}-${theme}-${gradient}-${angle}-${invert}`;
  if (key === _lastKey) return;
  _lastKey = key;

  const [h, s, l] = ACCENT_HSL[accent] ?? ACCENT_HSL.blue;
  const root = document.documentElement;

  // 1. Palette composants (transparences basses → gradient visible)
  const palette = buildComponentPalette(h, s, gradient, theme);
  for (const [k, v] of Object.entries(palette)) root.style.setProperty(k, v);

  // 2. Couleur d'accent
  const hex = hslToHex(h, s, l);
  root.style.setProperty("--accent",      hex);
  root.style.setProperty("--accent-dim",  hsl(h, s, l, 0.15));
  root.style.setProperty("--accent-line", hsl(h, s, l, 0.55));
  root.style.setProperty("--accent-ring", hsl(h, s, l, 0.22));
  root.style.setProperty("--sel-bg",      hsl(h, s * 0.3, theme === "dark" ? 20 : 80, 0.12));
  root.style.setProperty("--sel-border",  hsl(h, s * 0.5, theme === "dark" ? 60 : 40, 0.18));
  root.style.setProperty("--grad-accent-rgb", accentRgb(h, s, l));

  // 3. Gradient plein écran → appliqué sur body (couvre toute la fenêtre)
  const grad = buildBodyGradient(h, s, gradient, angle, invert, theme);
  root.style.setProperty("--full-grad", grad);
  document.body.style.background = grad;
  document.body.style.backgroundAttachment = "fixed";

  // 4. Aurora → animation CSS (background-size 300%×300% + @keyframes)
  if (gradient === "aurora") {
    document.body.style.backgroundSize = "300% 300%";
    document.body.classList.add("_aurora-anim");
  } else {
    document.body.style.backgroundSize = "cover";
    document.body.classList.remove("_aurora-anim");
  }

  // 5. Glass mode → data attribute pour CSS (active backdrop-filter .glass)
  root.setAttribute("data-glass", gradient !== "flat" ? "1" : "0");

  // 6. Angle sur data attribute (utilisé par l'animation aurora CSS)
  root.setAttribute("data-gradient", gradient);
}

// ─── Générateur de prévisualisation (pour les cartes de style) ────────────────

export function buildPreviewGradient(
  accent:   AccentColor,
  style:    GradientStyle,
  theme:    Appearance = "dark",
  angle    = 135,
  invert   = false
): string {
  const [h, s] = ACCENT_HSL[accent] ?? ACCENT_HSL.blue;
  return buildBodyGradient(h, s, style, angle, invert, theme);
}
