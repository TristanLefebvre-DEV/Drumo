import { useRef, useEffect, useState, useCallback } from "react";

// ─── Color conversion ─────────────────────────────────────────────────────────

export function hexToHsb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d !== 0) {
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
  }
  return [
    hue * 360,
    max === 0 ? 0 : (d / max) * 100,
    max * 100,
  ];
}

export function hsbToHex(h: number, s: number, b: number): string {
  const H = (((h % 360) + 360) % 360) / 360;
  const S = Math.max(0, Math.min(100, s)) / 100;
  const V = Math.max(0, Math.min(100, b)) / 100;
  let r = 0, g = 0, bv = 0;
  const i = Math.floor(H * 6);
  const f = H * 6 - i;
  const p = V * (1 - S);
  const q = V * (1 - f * S);
  const t = V * (1 - (1 - f) * S);
  switch (i % 6) {
    case 0: r = V; g = t; bv = p; break;
    case 1: r = q; g = V; bv = p; break;
    case 2: r = p; g = V; bv = t; break;
    case 3: r = p; g = q; bv = V; break;
    case 4: r = t; g = p; bv = V; break;
    case 5: r = V; g = p; bv = q; break;
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(bv)}`;
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────

const SIZE = 196;
const CX   = SIZE / 2;
const CY   = SIZE / 2;
const RING_OUTER = CX - 3;
const RING_INNER = CX * 0.63;
// Keep every corner inside the hue ring. The previous square overlapped the
// ring, so clicks on its corners changed hue instead of saturation/value.
const SQ_HALF    = (RING_INNER - 5) / Math.SQRT2;

function redraw(canvas: HTMLCanvasElement, h: number, s: number, b: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, SIZE, SIZE);

  // 1 — Hue ring
  for (let deg = 0; deg < 360; deg++) {
    const start = (deg - 90 - 0.6) * (Math.PI / 180);
    const end   = (deg - 90 + 1.1) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(CX + RING_INNER * Math.cos(start), CY + RING_INNER * Math.sin(start));
    ctx.arc(CX, CY, RING_OUTER, start, end);
    ctx.arc(CX, CY, RING_INNER, end, start, true);
    ctx.closePath();
    ctx.fillStyle = `hsl(${deg},100%,50%)`;
    ctx.fill();
  }

  // 2 — Saturation/Brightness square
  const left = CX - SQ_HALF, top = CY - SQ_HALF, size = SQ_HALF * 2;

  const gH = ctx.createLinearGradient(left, 0, left + size, 0);
  gH.addColorStop(0, "#fff");
  gH.addColorStop(1, `hsl(${h},100%,50%)`);
  ctx.fillStyle = gH;
  ctx.fillRect(left, top, size, size);

  const gV = ctx.createLinearGradient(0, top, 0, top + size);
  gV.addColorStop(0, "rgba(0,0,0,0)");
  gV.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = gV;
  ctx.fillRect(left, top, size, size);

  // 3 — Hue ring indicator
  const hueRad  = (h - 90) * (Math.PI / 180);
  const iR      = (RING_INNER + RING_OUTER) / 2;
  const ix = CX + iR * Math.cos(hueRad);
  const iy = CY + iR * Math.sin(hueRad);

  ctx.beginPath();
  ctx.arc(ix, iy, 7, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${h},100%,50%)`;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ix, iy, 8.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 4 — SB crosshair
  const sbX = left + (s / 100) * size;
  const sbY = top  + ((100 - b) / 100) * size;

  ctx.beginPath();
  ctx.arc(sbX, sbY, 6.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sbX, sbY, 5.5, 0, Math.PI * 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChromaticColorPicker({
  value,
  onChange,
}: {
  value:    string;
  onChange: (hex: string) => void;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const dragTarget   = useRef<"wheel" | "square" | null>(null);
  const hsbRef       = useRef<[number, number, number]>(hexToHsb(value || "#0071e3"));
  const [hsb, _setHsb] = useState<[number, number, number]>(hsbRef.current);
  const [hexInput, setHexInput] = useState(value || "#0071e3");

  const setHsb = useCallback((v: [number, number, number]) => {
    hsbRef.current = v;
    _setHsb(v);
  }, []);

  // Sync external value → internal state
  useEffect(() => {
    if (!value || !/^#[0-9a-fA-F]{6}$/i.test(value)) return;
    const current = hsbToHex(...hsbRef.current);
    if (value.toLowerCase() !== current.toLowerCase()) {
      const next = hexToHsb(value);
      setHsb(next);
      setHexInput(value);
    }
  }, [value, setHsb]);

  // Redraw whenever HSB changes
  useEffect(() => {
    if (canvasRef.current) redraw(canvasRef.current, hsb[0], hsb[1], hsb[2]);
  }, [hsb]);

  const getCanvasXY = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const px = "touches" in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const py = "touches" in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (px - rect.left) * (SIZE / rect.width),
      y: (py - rect.top)  * (SIZE / rect.height),
    };
  }, []);

  const applyWheelPos = useCallback((x: number, y: number) => {
    const dx = x - CX, dy = y - CY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0)   angle += 360;
    if (angle > 360) angle -= 360;
    const next: [number, number, number] = [angle, hsbRef.current[1], hsbRef.current[2]];
    setHsb(next);
    const hex = hsbToHex(...next);
    setHexInput(hex);
    onChange(hex);
  }, [onChange, setHsb]);

  const applySquarePos = useCallback((x: number, y: number) => {
    const left = CX - SQ_HALF, top = CY - SQ_HALF, size = SQ_HALF * 2;
    const s = Math.max(0, Math.min(1, (x - left) / size)) * 100;
    const b = Math.max(0, Math.min(1, 1 - (y - top) / size)) * 100;
    const next: [number, number, number] = [hsbRef.current[0], s, b];
    setHsb(next);
    const hex = hsbToHex(...next);
    setHexInput(hex);
    onChange(hex);
  }, [onChange, setHsb]);

  const handleDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = getCanvasXY(e);
    const dx = x - CX, dy = y - CY;
    const r  = Math.sqrt(dx * dx + dy * dy);
    if (x >= CX - SQ_HALF && x <= CX + SQ_HALF && y >= CY - SQ_HALF && y <= CY + SQ_HALF) {
      dragTarget.current = "square";
      applySquarePos(x, y);
    } else if (r >= RING_INNER && r <= RING_OUTER + 3) {
      dragTarget.current = "wheel";
      applyWheelPos(x, y);
    }
  }, [getCanvasXY, applyWheelPos, applySquarePos]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!dragTarget.current) return;
    const { x, y } = getCanvasXY(e);
    if (dragTarget.current === "wheel")  applyWheelPos(x, y);
    if (dragTarget.current === "square") applySquarePos(x, y);
  }, [getCanvasXY, applyWheelPos, applySquarePos]);

  const handleUp = () => { dragTarget.current = null; };

  const currentHex = hsbToHex(...hsb);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, userSelect: "none" }}>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ cursor: "crosshair", maxWidth: "100%", display: "block" }}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
      />

      {/* Preview swatch + hex input */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: SIZE }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: currentHex,
            border: "2px solid var(--sep-2)",
            flexShrink: 0,
            boxShadow: `0 2px 8px ${currentHex}66`,
          }}
        />
        <input
          type="text"
          value={hexInput}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value;
            setHexInput(v);
            if (/^#[0-9a-fA-F]{6}$/i.test(v)) {
              const next = hexToHsb(v);
              setHsb(next);
              onChange(v.toLowerCase());
            }
          }}
          style={{
            flex: 1,
            background: "var(--bg-3)",
            border: "1.5px solid var(--sep-2)",
            borderRadius: 6,
            color: "var(--tx-1)",
            fontSize: 13,
            fontFamily: "monospace",
            padding: "5px 10px",
            outline: "none",
            letterSpacing: "0.04em",
          }}
        />
      </div>
    </div>
  );
}
