// Mappe une vélocité MIDI (0–1) vers une couleur CSS pour le heatmap.
// Palette : bleu (ghost) → vert → orange → rouge (accent).

export function mapVelocityToColor(velocity: number, sensitivity = 1.0): string {
  const v = Math.max(0, Math.min(1, velocity * sensitivity));
  const hue = Math.round(220 - v * 190); // 220=bleu → 30=orange-rouge
  const sat = Math.round(55 + v * 30);
  const lit = Math.round(37 + (1 - v) * 12);
  return `hsl(${hue},${sat}%,${lit}%)`;
}

export function mapVelocityToColorAlpha(velocity: number, sensitivity = 1.0, alpha = 0.82): string {
  const v = Math.max(0, Math.min(1, velocity * sensitivity));
  const hue = Math.round(220 - v * 190);
  const sat = Math.round(55 + v * 30);
  const lit = Math.round(37 + (1 - v) * 12);
  return `hsla(${hue},${sat}%,${lit}%,${alpha})`;
}

export function heatmapGradientCss(sensitivity = 1.0): string {
  return `linear-gradient(to right, ${
    [0, 0.25, 0.5, 0.75, 1.0]
      .map((v) => `${mapVelocityToColor(v, sensitivity)} ${v * 100}%`)
      .join(", ")
  })`;
}
