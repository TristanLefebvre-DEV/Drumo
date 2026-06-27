import { useScoresStore, type ScoreFile, type ScoreFolder } from "../store/scoresStore";
import { authService, type CloudAuthSession } from "./authService";
import { createSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

interface CloudLibraryItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  local_id: string | null;
  file_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LibrarySyncResult {
  ok: boolean;
  mode: "cloud" | "offline" | "not-configured";
  uploaded: number;
  downloaded: number;
  message: string;
}

const log = (message: string, extra?: unknown): void => console.info(`[librarySync] ${message}`, extra ?? "");
const isoFromMs = (value: number | undefined): string => new Date(value ?? Date.now()).toISOString();
const msFromIso = (value: string | null | undefined): number => value ? new Date(value).getTime() : 0;

const localUpdatedAt = (file: ScoreFile): number => file.importedAt;

const toCloudItem = (file: ScoreFile, folders: ScoreFolder[], userId: string): Omit<CloudLibraryItem, "id" | "created_at"> => ({
  user_id: userId,
  title: file.name,
  description: file.originalName,
  local_id: file.id,
  file_url: null,
  metadata: {
    kind: "score_file",
    format: file.format,
    folderId: file.folderId,
    folderName: folders.find((folder) => folder.id === file.folderId)?.name ?? null,
    filePath: file.filePath,
    fileSize: file.fileSize,
    importedAt: file.importedAt,
  },
  updated_at: isoFromMs(localUpdatedAt(file)),
  deleted_at: null,
});

const addCloudFileToLocal = (item: CloudLibraryItem): void => {
  const metadata = item.metadata ?? {};
  const format = metadata.format === "pdf" || metadata.format === "musicxml" ? metadata.format : "midi";
  useScoresStore.getState().addFile({
    name: item.title,
    originalName: typeof item.description === "string" && item.description ? item.description : item.title,
    folderId: null,
    format,
    filePath: typeof metadata.filePath === "string" ? metadata.filePath : item.file_url ?? "",
    fileSize: typeof metadata.fileSize === "number" ? metadata.fileSize : 0,
  });
};

const ensureSession = async (): Promise<CloudAuthSession | null> =>
  authService.getSession() ?? await authService.refreshSession();

export const librarySyncService = {
  async syncLibrary(): Promise<LibrarySyncResult> {
    if (!isSupabaseConfigured()) {
      return { ok: true, mode: "not-configured", uploaded: 0, downloaded: 0, message: "Supabase non configure." };
    }
    const client = createSupabaseClient();
    const session = await ensureSession();
    if (!client || !session) {
      return { ok: true, mode: "offline", uploaded: 0, downloaded: 0, message: "Aucune session cloud active." };
    }

    try {
      const store = useScoresStore.getState();
      const localFiles = store.files;
      const remoteItems = await client.restRequest<CloudLibraryItem[]>(
        "library_items?deleted_at=is.null&select=*&order=updated_at.desc",
        { accessToken: session.accessToken },
      );
      const remoteByLocalId = new Map(remoteItems.filter((item) => item.local_id).map((item) => [item.local_id as string, item]));
      const localIds = new Set(localFiles.map((file) => file.id));
      let uploaded = 0;
      let downloaded = 0;

      for (const file of localFiles) {
        const remote = remoteByLocalId.get(file.id);
        if (!remote || localUpdatedAt(file) > msFromIso(remote.updated_at)) {
          await client.restRequest<CloudLibraryItem[]>("library_items?on_conflict=user_id,local_id", {
            method: "POST",
            accessToken: session.accessToken,
            prefer: "resolution=merge-duplicates,return=representation",
            body: toCloudItem(file, store.folders, session.userId),
          });
          uploaded += 1;
        }
      }

      for (const item of remoteItems) {
        if (item.local_id && localIds.has(item.local_id)) continue;
        addCloudFileToLocal(item);
        downloaded += 1;
      }

      log(`sync terminee: ${uploaded} upload, ${downloaded} download`);
      return { ok: true, mode: "cloud", uploaded, downloaded, message: "Synchronisation terminee." };
    } catch (error) {
      console.warn("[librarySync] mode hors-ligne", error);
      return { ok: false, mode: "offline", uploaded: 0, downloaded: 0, message: "Cloud indisponible, bibliotheque locale conservee." };
    }
  },
};
