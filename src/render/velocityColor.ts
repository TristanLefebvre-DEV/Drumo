// Heatmap: dark-blue → blue → cyan → yellow → orange → red
const STOPS: Array<[number, [number, number, number]]> = [
  [0.00, [15,  23,  100]],
  [0.20, [59,  130, 246]],
  [0.42, [6,   182, 212]],
  [0.55, [234, 179, 8  ]],
  [0.72, [249, 115, 22 ]],
  [1.00, [239, 68,  68 ]],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// velocity: 0–1 | sensitivity: 0.3–2.0 (1 = linear, >1 = more vivid, <1 = compressed)
export const mapVelocityToColor = (velocity: number, sensitivity = 1.0): string => {
  const v = Math.min(1, Math.max(0, Math.pow(velocity, 1 / sensitivity)));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, c0] = STOPS[i];
    const [p1, c1] = STOPS[i + 1];
    if (v >= p0 && v <= p1) {
      const t = (v - p0) / (p1 - p0);
      return `rgb(${Math.round(lerp(c0[0], c1[0], t))},${Math.round(lerp(c0[1], c1[1], t))},${Math.round(lerp(c0[2], c1[2], t))})`;
    }
  }
  return "rgb(239,68,68)";
};

export const mapVelocityToColorAlpha = (velocity: number, sensitivity = 1.0, alpha = 1.0): string => {
  const v = Math.min(1, Math.max(0, Math.pow(velocity, 1 / sensitivity)));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, c0] = STOPS[i];
    const [p1, c1] = STOPS[i + 1];
    if (v >= p0 && v <= p1) {
      const t = (v - p0) / (p1 - p0);
      return `rgba(${Math.round(lerp(c0[0], c1[0], t))},${Math.round(lerp(c0[1], c1[1], t))},${Math.round(lerp(c0[2], c1[2], t))},${alpha})`;
    }
  }
  return `rgba(239,68,68,${alpha})`;
};

// Generate a CSS gradient string for the legend bar
export const heatmapGradientCss = (sensitivity = 1.0, steps = 20): string => {
  const colors = Array.from({ length: steps }, (_, i) => mapVelocityToColor(i / (steps - 1), sensitivity));
  return `linear-gradient(to right, ${colors.join(",")})`;
};
