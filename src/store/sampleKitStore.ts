/**
 * Sample Kit Store
 *
 * Persiste les kits personnalisés créés par l'utilisateur.
 * Chaque kit contient des assignations par pièce :
 *   - sample   → fichier audio sur le disque (MP3, WAV…)
 *   - variant  → variante de synthèse (timbre Tone.js)
 *
 * Stocké en localStorage sous la clé "drumo:sample_kits_v1".
 */

import type { DrumKitId } from "../audio/drumKitManager";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Assignation d'un fichier audio à une pièce */
export interface SampleAssignment {
  type:     "sample";
  filePath: string;  // chemin absolu sur le disque
  fileName: string;  // nom d'affichage (ex. "kick_punchy.wav")
}

/** Assignation d'une variante de synthèse à une pièce */
export interface VariantAssignment {
  type:      "variant";
  variantId: string;
}

export type PieceAssignment = SampleAssignment | VariantAssignment;

/** Kit complet enregistré par l'utilisateur */
export interface SavedSampleKit {
  id:        string;
  name:      string;
  color:     string;
  emoji:     string;
  createdAt: number;
  /** Kit de synthèse de base — utilisé pour les pièces non assignées */
  baseKitId: DrumKitId | string;
  /** Assignations pièce → son personnalisé */
  pieces:    Partial<Record<string, PieceAssignment>>;
}

// ─── Persistance ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "drumo:sample_kits_v1";

class SampleKitStoreClass {
  private kits: SavedSampleKit[] = [];

  constructor() { this._load(); }

  private _load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.kits = JSON.parse(raw) as SavedSampleKit[];
    } catch {
      this.kits = [];
    }
  }

  private _persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.kits));
    } catch { /* storage plein */ }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  getAll(): SavedSampleKit[] {
    return [...this.kits].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): SavedSampleKit | null {
    return this.kits.find((k) => k.id === id) ?? null;
  }

  create(data: Omit<SavedSampleKit, "id" | "createdAt">): SavedSampleKit {
    const kit: SavedSampleKit = {
      ...data,
      id:        `sk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    this.kits.unshift(kit);
    this._persist();
    return kit;
  }

  update(id: string, patch: Partial<SavedSampleKit>): boolean {
    const idx = this.kits.findIndex((k) => k.id === id);
    if (idx < 0) return false;
    this.kits[idx] = { ...this.kits[idx], ...patch };
    this._persist();
    return true;
  }

  delete(id: string): boolean {
    const before = this.kits.length;
    this.kits = this.kits.filter((k) => k.id !== id);
    if (this.kits.length < before) { this._persist(); return true; }
    return false;
  }

  count(): number { return this.kits.length; }
}

export const sampleKitStore = new SampleKitStoreClass();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Palette de couleurs et d'emojis proposés lors de la création d'un kit */
export const KIT_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#8b5cf6",
  "#f59e0b", "#ec4899", "#06b6d4", "#64748b",
];

export const KIT_EMOJIS = ["🥁", "🎸", "🎹", "🎷", "🎵", "⚡", "🔥", "🌊", "🎯", "🚀"];
