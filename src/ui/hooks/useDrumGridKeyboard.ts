import { useEffect, useRef, type MutableRefObject } from "react";
import { DRUM_ROWS } from "../../core/drumGrid";
import { eventToShortcut, shortcutKey } from "../../core/drumShortcuts";
import type { DrumHit, DrumPiece, NoteType, ParsedDrumProject } from "../../core/types";
import type { PasteHitDescriptor } from "../components/DrumGrid";
import { useProjectStore } from "../../store/projectStore";
import { useShortcutsStore } from "../../store/shortcutsStore";

const ZOOM_STEP = 0.1;
const ZOOM_MIN  = 0.7;
const ZOOM_MAX  = 2.0;
const SCROLL_PX = 200;

// ─── Options ──────────────────────────────────────────────────────────────────

export interface DrumGridKeyboardOptions {
  selectedHitIdsRef: MutableRefObject<Set<string>>;
  clipboardRef:      MutableRefObject<DrumHit[]>;
  projectRef:        MutableRefObject<ParsedDrumProject>;
  activeTickRef:     MutableRefObject<number>;
  stepTicksRef:      MutableRefObject<number>;
  scrollRef:         MutableRefObject<HTMLDivElement | null>;
  setSelectedHitIds: (s: Set<string>) => void;
  onRemoveHit:       (hitId: string) => void;
  onMoveHit:         (hitId: string, deltaTicks: number) => void;
  onSetVelocity:     (hitId: string, velocity: number) => void;
  onPasteHits:       (hits: PasteHitDescriptor[]) => void;
  onToggleMute:      (hitId: string) => void;
  onSetNoteType:     (hitId: string, type: NoteType) => void;
  onUndo:            () => void;
  onRedo:            () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useDrumGridKeyboard = (opts: DrumGridKeyboardOptions): void => {
  // Stable ref for the options object — avoids reinstalling the listener on re-renders
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Store values accessed inside the keyboard handler
  const lookup         = useShortcutsStore((s) => s.lookup);
  const zoomX          = useProjectStore((s) => s.zoomX);
  const setZoomX       = useProjectStore((s) => s.setZoomX);
  const togglePlayback = useProjectStore((s) => s.togglePlayback);
  const rewindToStart  = useProjectStore((s) => s.rewindToStart);

  // Stable refs for values that change between renders but must be read inside the effect
  const lookupRef         = useRef(lookup);
  const zoomXRef          = useRef(zoomX);
  const setZoomXRef       = useRef(setZoomX);
  const togglePlaybackRef = useRef(togglePlayback);
  const rewindToStartRef  = useRef(rewindToStart);

  // Keep refs in sync on every render (cheap, no re-mount)
  lookupRef.current         = lookup;
  zoomXRef.current          = zoomX;
  setZoomXRef.current       = setZoomX;
  togglePlaybackRef.current = togglePlayback;
  rewindToStartRef.current  = rewindToStart;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      ) return;

      const action = lookupRef.current.get(shortcutKey(eventToShortcut(e)));
      if (!action) return;

      const {
        selectedHitIdsRef, clipboardRef, projectRef,
        activeTickRef, stepTicksRef, scrollRef,
        setSelectedHitIds, onRemoveHit, onMoveHit, onSetVelocity, onPasteHits,
        onToggleMute, onSetNoteType, onUndo, onRedo,
      } = optsRef.current;

      const proj   = projectRef.current;
      const ids    = selectedHitIdsRef.current;
      const stTick = stepTicksRef.current;
      const scroll = scrollRef.current;

      switch (action) {
        // ── Selection ─────────────────────────────────────────────────────

        case "deselectAll":
          setSelectedHitIds(new Set());
          break;

        case "selectAll":
          e.preventDefault();
          setSelectedHitIds(new Set(proj.hits.map((h) => h.id)));
          break;

        case "selectAllSamePiece": {
          e.preventDefault();
          if (ids.size === 0) break;
          const first = proj.hits.find((h) => ids.has(h.id));
          if (!first) break;
          setSelectedHitIds(new Set(proj.hits.filter((h) => h.piece === first.piece).map((h) => h.id)));
          break;
        }

        case "deleteSelected": {
          e.preventDefault();
          if (ids.size === 0) break;
          for (const id of ids) onRemoveHit(id);
          setSelectedHitIds(new Set());
          break;
        }

        // ── Clipboard ─────────────────────────────────────────────────────

        case "copy":
          e.preventDefault();
          if (ids.size === 0) break;
          clipboardRef.current = proj.hits.filter((h) => ids.has(h.id));
          break;

        case "paste": {
          e.preventDefault();
          const cb = clipboardRef.current;
          if (cb.length === 0) break;
          const minTick   = Math.min(...cb.map((h) => h.tick));
          const pasteTick = activeTickRef.current;
          onPasteHits(cb.map((h) => ({
            piece: h.piece, midi: h.midi,
            tick: Math.max(0, h.tick - minTick + pasteTick),
            velocity: h.velocity,
            durationTicks: h.durationTicks,
          })));
          break;
        }

        case "undo":
          e.preventDefault();
          onUndo();
          break;

        case "redo":
          e.preventDefault();
          onRedo();
          break;

        case "duplicate": {
          e.preventDefault();
          if (ids.size === 0) break;
          const sel = proj.hits.filter((h) => ids.has(h.id));
          if (sel.length === 0) break;
          const minTick    = Math.min(...sel.map((h) => h.tick));
          const maxEnd     = Math.max(...sel.map((h) => h.tick + h.durationTicks));
          const snappedEnd = Math.ceil(maxEnd / stTick) * stTick;
          onPasteHits(sel.map((h) => ({
            piece: h.piece, midi: h.midi,
            tick: h.tick + (snappedEnd - minTick),
            velocity: h.velocity,
            durationTicks: h.durationTicks,
          })));
          break;
        }

        // ── Move on timeline ──────────────────────────────────────────────

        case "moveLeft":
          e.preventDefault();
          if (ids.size === 0) break;
          for (const hit of proj.hits.filter((h) => ids.has(h.id))) {
            if (hit.tick - stTick >= 0) onMoveHit(hit.id, -stTick);
          }
          break;

        case "moveRight":
          e.preventDefault();
          if (ids.size === 0) break;
          for (const hit of proj.hits.filter((h) => ids.has(h.id))) {
            onMoveHit(hit.id, stTick);
          }
          break;

        // ── Change drum row ───────────────────────────────────────────────

        case "movePieceUp":
        case "movePieceDown": {
          e.preventDefault();
          if (ids.size === 0) break;
          const sel = proj.hits.filter((h) => ids.has(h.id));
          if (sel.length === 0) break;
          const newHits: PasteHitDescriptor[] = [];
          const toRemove: string[] = [];
          for (const hit of sel) {
            const rowIdx  = DRUM_ROWS.findIndex((r) => r.piece === hit.piece);
            if (rowIdx < 0) continue;
            const nextIdx = action === "movePieceUp" ? rowIdx - 1 : rowIdx + 1;
            if (nextIdx < 0 || nextIdx >= DRUM_ROWS.length) continue;
            const nextRow = DRUM_ROWS[nextIdx];
            newHits.push({
              piece: nextRow.piece as DrumPiece,
              midi:  nextRow.midi,
              tick:  hit.tick,
              velocity:      hit.velocity,
              durationTicks: hit.durationTicks,
            });
            toRemove.push(hit.id);
          }
          if (newHits.length === 0) break;
          onPasteHits(newHits);
          for (const id of toRemove) onRemoveHit(id);
          setSelectedHitIds(new Set());
          break;
        }

        // ── Velocity ──────────────────────────────────────────────────────

        case "velocityUp":
          e.preventDefault();
          if (ids.size === 0) break;
          for (const hit of proj.hits.filter((h) => ids.has(h.id))) {
            onSetVelocity(hit.id, Math.min(1, hit.velocity + 10 / 127));
          }
          break;

        case "velocityDown":
          e.preventDefault();
          if (ids.size === 0) break;
          for (const hit of proj.hits.filter((h) => ids.has(h.id))) {
            onSetVelocity(hit.id, Math.max(1 / 127, hit.velocity - 10 / 127));
          }
          break;

        // ── Note properties ───────────────────────────────────────────────────

        case "toggleMute":
          e.preventDefault();
          if (ids.size === 0) break;
          for (const id of ids) onToggleMute(id);
          break;

        case "toggleFlam": {
          e.preventDefault();
          if (ids.size === 0) break;
          const allFlam = proj.hits.filter((h) => ids.has(h.id)).every((h) => h.noteType === "flam");
          for (const hit of proj.hits.filter((h) => ids.has(h.id))) {
            onSetNoteType(hit.id, allFlam ? "normal" : "flam");
          }
          break;
        }

        case "toggleRoll": {
          e.preventDefault();
          if (ids.size === 0) break;
          const allRoll = proj.hits.filter((h) => ids.has(h.id)).every((h) => h.noteType === "roll");
          for (const hit of proj.hits.filter((h) => ids.has(h.id))) {
            onSetNoteType(hit.id, allRoll ? "normal" : "roll");
          }
          break;
        }

        // ── Quantize ──────────────────────────────────────────────────────

        case "quantizeSelected":
          e.preventDefault();
          if (ids.size === 0) break;
          for (const hit of proj.hits.filter((h) => ids.has(h.id))) {
            const delta = Math.round(hit.tick / stTick) * stTick - hit.tick;
            if (delta !== 0) onMoveHit(hit.id, delta);
          }
          break;

        // ── Zoom ──────────────────────────────────────────────────────────

        case "zoomIn":
          e.preventDefault();
          setZoomXRef.current(Math.min(zoomXRef.current + ZOOM_STEP, ZOOM_MAX));
          break;

        case "zoomOut":
          e.preventDefault();
          setZoomXRef.current(Math.max(zoomXRef.current - ZOOM_STEP, ZOOM_MIN));
          break;

        case "zoomReset":
          e.preventDefault();
          setZoomXRef.current(1);
          break;

        // ── Grid navigation ───────────────────────────────────────────────

        case "scrollLeft":
          e.preventDefault();
          scroll?.scrollBy({ left: -SCROLL_PX, behavior: "smooth" });
          break;

        case "scrollRight":
          e.preventDefault();
          scroll?.scrollBy({ left: SCROLL_PX, behavior: "smooth" });
          break;

        case "scrollToStart":
          e.preventDefault();
          scroll?.scrollTo({ left: 0, behavior: "smooth" });
          break;

        case "scrollToEnd":
          e.preventDefault();
          if (scroll) scroll.scrollLeft = scroll.scrollWidth;
          break;

        // ── Transport ─────────────────────────────────────────────────────

        case "playPause":
          e.preventDefault();
          togglePlaybackRef.current();
          break;

        case "returnToStart":
          e.preventDefault();
          rewindToStartRef.current();
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // Empty deps: the effect is installed once; all values are accessed via stable refs.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
