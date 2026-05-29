import { Formatter, Renderer, Stave, Voice } from "vexflow";
import { chordToStaveNote, createRestNote } from "./vexflowAdapter";
import { generateBeams } from "./beamOptimizer";
import { splitMeasureVoices } from "./voiceSplitter";
import { applyArticulations } from "./articulationEngine";
import { computeGlobalSubdivision } from "../notation/measureNormalizer";
import type { HeatmapOpts } from "./vexflowAdapter";
import type { CleanupOptions } from "./notationCleanupEngine";
import type { DisplaySlot } from "./restOptimizer";
import type { RhythmResult, TimeSignature, QuantizedHit } from "../core/types";
import type { StaveNote } from "vexflow";

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
  /**
   * Optional subdivision hint from the Drum Intelligence Core.
   * When provided, skips the per-session majority-vote and uses this
   * globally-consistent grid directly — ensures DIC ↔ renderer coherence.
   */
  dicSubdivision?: import("../notation/subdivisionDetector").SubdivisionType;
}

/** Convert a DisplaySlot array into StaveNotes with a forced stem direction. */
const slotsToNotes = (
  slots: DisplaySlot[],
  ppq: number,
  activeTick: number,
  heatmap: HeatmapOpts,
  stemDir: 1 | -1
): StaveNote[] =>
  slots.flatMap(slot => {
    if (slot.type === "rest") {
      try { return [createRestNote(slot.dur, slot.dotted)]; } catch { return []; }
    }
    const isActive = Math.abs(slot.absoluteTick - activeTick) <= ppq / 12;
    const note = chordToStaveNote(
      slot.hits, ppq, isActive, heatmap,
      { dur: slot.dur, dotted: slot.dotted },
      stemDir
    );
    if (!note) return [];
    applyArticulations(note, slot.hits as QuantizedHit[]);
    return [note];
  });

const makeVoice = (notes: StaveNote[], sig: TimeSignature): Voice => {
  const v = new Voice({ numBeats: sig.numerator, beatValue: sig.denominator });
  v.setStrict(false);
  v.addTickables(notes);
  return v;
};

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
  dicSubdivision,
}: StaffRenderInput): void => {
  try {
    target.innerHTML = "";
    const width        = 1220 * zoomX;
    const rowHeight    = 150 * zoomY;
    const height       = Math.max(280, Math.ceil(rhythm.measures.length / 4) * rowHeight);
    const measureWidth = 290 * zoomX;

    // VexFlow 5 expects HTMLDivElement | HTMLCanvasElement
    const renderer = new Renderer(target as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    ctx.setFillStyle("#f4f4f5");
    ctx.setStrokeStyle("#f4f4f5");

    // Pre-compute once: dominant subdivision for cross-measure consistency.
    // DIC subdivision takes priority (already computed from full project context).
    // Falls back to per-session majority-vote when DIC is not available.
    const globalSubdivision = cleanup.enabled
      ? (dicSubdivision ?? computeGlobalSubdivision(rhythm.measures, ppq))
      : undefined;

    rhythm.measures.forEach((measure, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x   = 20 + col * measureWidth;
      const y   = 20 + row * rowHeight;
      const stave = new Stave(x, y, measureWidth - 18);
      if (index === 0) {
        stave.addClef("percussion");
        stave.addTimeSignature(`${signature.numerator}/${signature.denominator}`);
      }
      stave.setContext(ctx).draw();

      if (cleanup.enabled) {
        // ── Two-voice path: cymbals (stem up) + drums (stem down) ───────────
        const { cymbals, drums } = splitMeasureVoices(
          measure, rhythm.ticksPerMeasure, ppq, signature, globalSubdivision
        );

        const cymbalNotes = slotsToNotes(cymbals, ppq, activeTick, heatmap, 1);
        const drumNotes   = slotsToNotes(drums,   ppq, activeTick, heatmap, -1);

        if (cymbalNotes.length === 0 && drumNotes.length === 0) return;

        const voices: Voice[] = [];
        if (cymbalNotes.length > 0) voices.push(makeVoice(cymbalNotes, signature));
        if (drumNotes.length   > 0) voices.push(makeVoice(drumNotes,   signature));

        new Formatter().joinVoices(voices).format(voices, measureWidth - 35);
        voices.forEach(v => v.draw(ctx, stave));

        // Beams per voice (never cross beat boundaries — beamOptimizer handles this)
        [cymbalNotes, drumNotes].forEach(notes => {
          if (notes.length === 0) return;
          generateBeams(notes).forEach(b => b.setContext(ctx).draw());
        });

      } else {
        // ── Raw single-voice path (no normalization, direct MIDI representation) ──
        const notes = measure.chords
          .map(chord =>
            chordToStaveNote(
              chord.hits, ppq,
              Math.abs(chord.absoluteTick - activeTick) <= ppq / 12,
              heatmap
            )
          )
          .filter((n): n is StaveNote => n !== null);

        if (notes.length === 0) return;

        const voice = makeVoice(notes, signature);
        new Formatter().joinVoices([voice]).format([voice], measureWidth - 35);
        voice.draw(ctx, stave);
      }
    });
  } catch (error) {
    target.innerHTML = `<div style="padding:12px;color:#fca5a5;font-family:Segoe UI, sans-serif;">Rendu de partition impossible: ${String(error)}</div>`;
  }
};
