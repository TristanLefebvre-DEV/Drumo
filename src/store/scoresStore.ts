import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ScoreFormat = "midi" | "pdf" | "musicxml";

export interface ScoreFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface ScoreFile {
  id: string;
  name: string;
  originalName: string;
  folderId: string | null;
  format: ScoreFormat;
  filePath: string;
  fileSize: number;
  importedAt: number;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface ScoresState {
  folders: ScoreFolder[];
  files: ScoreFile[];

  createFolder: (name: string, parentId?: string | null) => ScoreFolder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  moveFolder: (id: string, newParentId: string | null) => void;

  addFile: (data: Omit<ScoreFile, "id" | "importedAt">) => ScoreFile;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
  moveFile: (id: string, folderId: string | null) => void;
  duplicateFile: (id: string) => ScoreFile | null;

  /** Returns all folder IDs that are descendants of `id` (inclusive). */
  getDescendantIds: (id: string) => string[];
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useScoresStore = create<ScoresState>()(
  persist(
    (set, get) => ({
      folders: [],
      files: [],

      // ── Folders ──────────────────────────────────────────────────────────────

      createFolder: (name, parentId = null) => {
        const folder: ScoreFolder = { id: uid(), name, parentId: parentId ?? null, createdAt: Date.now() };
        set(s => ({ folders: [...s.folders, folder] }));
        return folder;
      },

      renameFolder: (id, name) =>
        set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, name } : f) })),

      deleteFolder: (id) => {
        const { folders, files, getDescendantIds } = get();
        const dead = new Set(getDescendantIds(id));
        set({
          folders: folders.filter(f => !dead.has(f.id)),
          files:   files.filter(f => f.folderId === null || !dead.has(f.folderId)),
        });
      },

      moveFolder: (id, newParentId) =>
        set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, parentId: newParentId } : f) })),

      // ── Files ────────────────────────────────────────────────────────────────

      addFile: (data) => {
        const file: ScoreFile = { ...data, id: uid(), importedAt: Date.now() };
        set(s => ({ files: [...s.files, file] }));
        return file;
      },

      renameFile: (id, name) =>
        set(s => ({ files: s.files.map(f => f.id === id ? { ...f, name } : f) })),

      deleteFile: (id) =>
        set(s => ({ files: s.files.filter(f => f.id !== id) })),

      moveFile: (id, folderId) =>
        set(s => ({ files: s.files.map(f => f.id === id ? { ...f, folderId } : f) })),

      duplicateFile: (id) => {
        const src = get().files.find(f => f.id === id);
        if (!src) return null;
        const file: ScoreFile = { ...src, id: uid(), name: `${src.name} (copie)`, importedAt: Date.now() };
        set(s => ({ files: [...s.files, file] }));
        return file;
      },

      // ── Utility ──────────────────────────────────────────────────────────────

      getDescendantIds: (id) => {
        const { folders } = get();
        const result = new Set<string>([id]);
        const queue = [id];
        while (queue.length) {
          const cur = queue.shift()!;
          for (const f of folders) {
            if (f.parentId === cur && !result.has(f.id)) {
              result.add(f.id);
              queue.push(f.id);
            }
          }
        }
        return [...result];
      },
    }),
    { name: "drumo:scores_v1" }
  )
);
