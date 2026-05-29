/**
 * SampleLoader — infrastructure for loading .wav samples offline.
 *
 * Current mode: SYNTH_ONLY (no .wav files bundled).
 * When .wav files are placed under /public/drumkits/<kitId>/<piece>.wav
 * the loader switches to "sample" mode automatically.
 *
 * Cache strategy: LRU-style map keyed by URL, AudioBuffer values.
 * All loading is async and non-blocking to the UI thread.
 */

import type { DrumPiece } from "../core/types";
import type { DrumKitId } from "./drumKitManager";

export type LoadStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

export interface SampleEntry {
  url: string;
  buffer: AudioBuffer | null;
  status: LoadStatus;
  errorMsg?: string;
}

const PIECE_FILENAMES: Record<DrumPiece, string> = {
  kick:        "kick.wav",
  snare:       "snare.wav",
  snareRim:    "snare_rim.wav",
  hihatClosed: "hihat_closed.wav",
  hihatOpen:   "hihat_open.wav",
  hihatPedal:  "hihat_pedal.wav",
  crash:       "crash.wav",
  ride:        "ride.wav",
  splash:      "splash.wav",
  otherCymbal: "cymbal.wav",
  tomHigh:     "tom_high.wav",
  tomMid:      "tom_mid.wav",
  tomLow:      "tom_low.wav",
};

const MAX_CACHE_ENTRIES = 120;

class SampleCache {
  private cache = new Map<string, SampleEntry>();

  get(url: string): SampleEntry | undefined {
    return this.cache.get(url);
  }

  set(url: string, entry: SampleEntry): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(url, entry);
  }

  has(url: string): boolean {
    return this.cache.has(url);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class SampleLoader {
  private cache = new SampleCache();
  private ctx: AudioContext | null = null;
  private inflight = new Map<string, Promise<SampleEntry>>();

  /** Call after AudioContext is available (post user gesture). */
  setAudioContext(ctx: AudioContext): void {
    this.ctx = ctx;
  }

  /** Build the URL for a given kit + piece combination. */
  buildUrl(kitId: DrumKitId, piece: DrumPiece): string {
    return `/drumkits/${kitId}/${PIECE_FILENAMES[piece]}`;
  }

  /** Check if a sample is available without loading. */
  async probeAvailable(kitId: DrumKitId, piece: DrumPiece): Promise<boolean> {
    const url = this.buildUrl(kitId, piece);
    try {
      const r = await fetch(url, { method: "HEAD" });
      return r.ok;
    } catch {
      return false;
    }
  }

  /** Check if an entire kit has sample files available. */
  async probeKit(kitId: DrumKitId): Promise<boolean> {
    const result = await this.probeAvailable(kitId, "kick");
    return result;
  }

  /** Load a single sample, returning cached version if available. */
  async loadSample(kitId: DrumKitId, piece: DrumPiece): Promise<SampleEntry> {
    const url = this.buildUrl(kitId, piece);

    const cached = this.cache.get(url);
    if (cached && cached.status === "ready") return cached;

    const inflight = this.inflight.get(url);
    if (inflight) return inflight;

    const promise = this._fetchAndDecode(url);
    this.inflight.set(url, promise);
    promise.finally(() => this.inflight.delete(url));
    return promise;
  }

  private async _fetchAndDecode(url: string): Promise<SampleEntry> {
    const pending: SampleEntry = { url, buffer: null, status: "loading" };
    this.cache.set(url, pending);

    if (!this.ctx) {
      const entry: SampleEntry = { url, buffer: null, status: "unavailable", errorMsg: "No AudioContext" };
      this.cache.set(url, entry);
      return entry;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const entry: SampleEntry = { url, buffer: null, status: "unavailable", errorMsg: `HTTP ${response.status}` };
        this.cache.set(url, entry);
        return entry;
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      const entry: SampleEntry = { url, buffer: audioBuffer, status: "ready" };
      this.cache.set(url, entry);
      return entry;
    } catch (err) {
      const entry: SampleEntry = {
        url, buffer: null, status: "error",
        errorMsg: err instanceof Error ? err.message : String(err),
      };
      this.cache.set(url, entry);
      return entry;
    }
  }

  /**
   * Preload all samples for a kit in background (fire-and-forget).
   * Does not block playback. Used to warm cache before the user selects a kit.
   */
  preloadKit(kitId: DrumKitId): void {
    const pieces: DrumPiece[] = [
      "kick", "snare", "hihatClosed", "hihatOpen",
      "ride", "crash", "tomHigh", "tomMid", "tomLow",
    ];
    for (const piece of pieces) {
      void this.loadSample(kitId, piece);
    }
  }

  /**
   * Load all pieces for a kit and return a map of results.
   * Pieces that are unavailable (no .wav file) return status "unavailable".
   */
  async loadKit(kitId: DrumKitId): Promise<Map<DrumPiece, SampleEntry>> {
    const pieces = Object.keys(PIECE_FILENAMES) as DrumPiece[];
    const results = await Promise.all(
      pieces.map(async (piece) => [piece, await this.loadSample(kitId, piece)] as [DrumPiece, SampleEntry])
    );
    return new Map(results);
  }

  /** Get a loaded buffer directly (null if not cached or unavailable). */
  getBuffer(kitId: DrumKitId, piece: DrumPiece): AudioBuffer | null {
    const url = this.buildUrl(kitId, piece);
    return this.cache.get(url)?.buffer ?? null;
  }

  /** Play a buffer through the AudioContext directly (for sample-mode preview). */
  playSample(buffer: AudioBuffer, velocity = 0.75): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = velocity;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  clearCache(): void {
    this.cache.clear();
  }

  get cacheSize(): number {
    return this.cache.size;
  }
}

export const sampleLoader = new SampleLoader();
