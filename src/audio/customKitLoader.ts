/**
 * CustomKitLoader — extensibility layer for user-defined drum kits.
 *
 * Prepares the architecture for:
 *   - SoundFont (.sf2) import
 *   - SFZ format import
 *   - User-provided .wav sample packs
 *   - Future kit marketplace
 *   - Custom presets (saved to localStorage)
 *
 * Currently provides: custom preset save/load via localStorage,
 * and stub interfaces for future format importers.
 */

import type { DrumKit, DrumKitId, DrumKitMixer, DrumKitPlaybackStyle, SynthKitParams } from "./drumKitManager";
import { DRUM_KIT_PRESETS } from "./drumKitManager";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomKitMeta {
  id: string;
  name: string;
  description: string;
  color: string;
  accentColor: string;
  emoji: string;
  createdAt: number;
  modifiedAt: number;
  sourceKitId: DrumKitId;
}

export interface CustomKitRecord extends CustomKitMeta {
  mixer: DrumKitMixer;
  playbackStyle: DrumKitPlaybackStyle;
  synthParams: SynthKitParams;
}

/** Future: interface for SFZ instrument mapping */
export interface SfzInstrumentMap {
  format: "sfz";
  path: string;
  rootDir: string;
  keyMapping: Record<number, string>; // MIDI note → sample file path
}

/** Future: interface for SoundFont preset */
export interface SoundFontPreset {
  format: "sf2";
  path: string;
  bankIndex: number;
  presetIndex: number;
  name: string;
}

/** Future: interface for a raw WAV sample pack */
export interface WavSamplePack {
  format: "wav";
  kitName: string;
  samples: Partial<Record<string, string>>; // piece key → file path or data URL
}

export type ExternalKitSource = SfzInstrumentMap | SoundFontPreset | WavSamplePack;

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "musecore:custom_kits";
const FAVORITES_KEY = "musecore:kit_favorites";

// ─── CustomKitLoader ──────────────────────────────────────────────────────────

export class CustomKitLoader {
  private customKits = new Map<string, CustomKitRecord>();
  private favorites = new Set<string>();

  constructor() {
    this._loadFromStorage();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private _loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const records = JSON.parse(raw) as CustomKitRecord[];
        for (const r of records) this.customKits.set(r.id, r);
      }
      const favRaw = localStorage.getItem(FAVORITES_KEY);
      if (favRaw) {
        const favs = JSON.parse(favRaw) as string[];
        for (const f of favs) this.favorites.add(f);
      }
    } catch {
      // Corrupted storage — ignore and start fresh
    }
  }

  private _saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.customKits.values()]));
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...this.favorites]));
    } catch {
      // Storage full or unavailable — silent fail
    }
  }

  // ── Custom kit CRUD ──────────────────────────────────────────────────────────

  /** Save a custom kit derived from a built-in preset. */
  saveCustomKit(name: string, sourceKitId: DrumKitId, overrides: Partial<Omit<CustomKitRecord, "id" | "createdAt" | "modifiedAt">>): CustomKitRecord {
    const source = DRUM_KIT_PRESETS[sourceKitId];
    const now = Date.now();
    const id = `custom_${now}_${Math.random().toString(36).slice(2, 7)}`;

    const record: CustomKitRecord = {
      id,
      name,
      description: overrides.description ?? `Basé sur ${source.name}`,
      color: overrides.color ?? source.color,
      accentColor: overrides.accentColor ?? source.accentColor,
      emoji: overrides.emoji ?? source.emoji,
      createdAt: now,
      modifiedAt: now,
      sourceKitId,
      mixer: { ...source.mixer, ...overrides.mixer },
      playbackStyle: { ...source.playbackStyle, ...overrides.playbackStyle },
      synthParams: { ...source.synthParams, ...overrides.synthParams },
    };

    this.customKits.set(id, record);
    this._saveToStorage();
    return record;
  }

  updateCustomKit(id: string, patch: Partial<CustomKitRecord>): boolean {
    const existing = this.customKits.get(id);
    if (!existing) return false;
    this.customKits.set(id, { ...existing, ...patch, modifiedAt: Date.now() });
    this._saveToStorage();
    return true;
  }

  deleteCustomKit(id: string): boolean {
    const removed = this.customKits.delete(id);
    this.favorites.delete(id);
    if (removed) this._saveToStorage();
    return removed;
  }

  getCustomKit(id: string): CustomKitRecord | undefined {
    return this.customKits.get(id);
  }

  getAllCustomKits(): CustomKitRecord[] {
    return [...this.customKits.values()].sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  // ── Favorites ────────────────────────────────────────────────────────────────

  toggleFavorite(kitId: string): boolean {
    if (this.favorites.has(kitId)) {
      this.favorites.delete(kitId);
    } else {
      this.favorites.add(kitId);
    }
    this._saveToStorage();
    return this.favorites.has(kitId);
  }

  isFavorite(kitId: string): boolean {
    return this.favorites.has(kitId);
  }

  getFavoriteIds(): string[] {
    return [...this.favorites];
  }

  // ── Export / Import ──────────────────────────────────────────────────────────

  /** Export a custom kit to JSON string (for user download). */
  exportToJson(id: string): string | null {
    const kit = this.customKits.get(id);
    if (!kit) return null;
    return JSON.stringify(kit, null, 2);
  }

  /** Import a custom kit from JSON string (from user upload). */
  importFromJson(json: string): CustomKitRecord | null {
    try {
      const parsed = JSON.parse(json) as Partial<CustomKitRecord>;
      if (!parsed.name || !parsed.sourceKitId) return null;
      return this.saveCustomKit(
        parsed.name,
        parsed.sourceKitId as DrumKitId,
        parsed
      );
    } catch {
      return null;
    }
  }

  // ── Future stubs ─────────────────────────────────────────────────────────────

  /** Future: load a SFZ instrument map and convert to kit definition. */
  async loadSfz(_source: SfzInstrumentMap): Promise<DrumKit | null> {
    console.warn("[CustomKitLoader] SFZ import not yet implemented.");
    return null;
  }

  /** Future: load a SoundFont preset and map to drum voices. */
  async loadSoundFont(_source: SoundFontPreset): Promise<DrumKit | null> {
    console.warn("[CustomKitLoader] SoundFont (.sf2) import not yet implemented.");
    return null;
  }

  /** Future: load a WAV sample pack from user's filesystem. */
  async loadWavPack(_source: WavSamplePack): Promise<DrumKit | null> {
    console.warn("[CustomKitLoader] WAV sample pack import not yet implemented.");
    return null;
  }
}

export const customKitLoader = new CustomKitLoader();
