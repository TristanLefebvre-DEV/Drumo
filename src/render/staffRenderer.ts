import { Formatter, Renderer, Stave, Voice } from "vexflow";
import { chordToStaveNote, createRestNote } from "./vexflowAdapter";
import { cleanMeasure } from "./notationCleanupEngine";
import { generateBeams } from "./beamOptimizer";
import type { HeatmapOpts } from "./vexflowAdapter";
import type { CleanupOptions } from "./notationCleanupEngine";
import type { RhythmResult, TimeSignature } from "../core/types";

export interface StaffRenderInput {
  target: HTMLElement;
  rhythm: RhythmResult;
  ppq: number;
  signature: TimeSignature;
  zoomX: number;
  zoomY: number;
  activeTick: number;
  heatmap: HeatmapOpts;
  cleanup: CleanupOptions;
}

export const renderStaff = ({
  target,
  rhythm,
  ppq,
  signature,
  zoomX,
  zoomY,
  activeTick,
  heatmap,
  cleanup,
}: StaffRenderInput): void => {
  try {
    target.innerHTML = "";
    const width = 1220 * zoomX;
    const rowHeight = 150 * zoomY;
    const height = Math.max(280, Math.ceil(rhythm.measures.length / 4) * rowHeight);
    const measureWidth = 290 * zoomX;

    const renderer = new Renderer(target, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    ctx.setFillStyle("#f4f4f5");
    ctx.setStrokeStyle("#f4f4f5");

    rhythm.measures.forEach((measure, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x = 20 + col * measureWidth;
      const y = 20 + row * rowHeight;
      const stave = new Stave(x, y, measureWidth - 18);
      if (index === 0) {
        stave.addClef("percussion");
        stave.addTimeSignature(`${signature.numerator}/${signature.denominator}`);
      }
      stave.setContext(ctx).draw();

      let notes;

      if (cleanup.enabled) {
        // ── Cleaned path: correct durations + rests ───────────────────────
        const slots = cleanMeasure(measure, ppq, signature, rhythm.ticksPerMeasure);
        notes = slots.flatMap((slot) => {
          if (slot.type === "rest") {
            try { return [createRestNote(slot.dur, slot.dotted)]; } catch { return []; }
          }
          const isActive = Math.abs(slot.absoluteTick - activeTick) <= ppq / 12;
          const note = chordToStaveNote(slot.hits, ppq, isActive, heatmap, { dur: slot.dur, dotted: slot.dotted });
          return note ? [note] : [];
        });
      } else {
        // ── Original path ─────────────────────────────────────────────────
        notes = measure.chords
          .map((chord) =>
            chordToStaveNote(
              chord.hits,
              ppq,
              Math.abs(chord.absoluteTick - activeTick) <= ppq / 12,
              heatmap
            )
          )
          .filter((n): n is NonNullable<typeof n> => n !== null);
      }

      if (notes.length === 0) return;

      const voice = new Voice({ num_beats: signature.numerator, beat_value: signature.denominator });
      voice.setStrict(false);
      voice.addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], measureWidth - 35);
      voice.draw(ctx, stave);

      // ── Beams (only when cleanup enabled, after voice is drawn) ─────────
      if (cleanup.enabled) {
        const beams = generateBeams(notes);
        beams.forEach((b) => b.setContext(ctx).draw());
      }
    });
  } catch (error) {
    target.innerHTML = `<div style="padding:12px;color:#fca5a5;font-family:Segoe UI, sans-serif;">Rendu de partition impossible: ${String(error)}</div>`;
  }
};
