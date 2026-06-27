/// <reference types="vite/client" />

declare global {
  const __APP_VERSION__: string;
  type DrumoRole = "user" | "admin";
  interface DrumoUser {
    id: string;
    username: string;
    role: DrumoRole;
    active: boolean;
    mustChangePassword: boolean;
    createdAt: string;
    updatedAt: string;
  }
  interface DrumoSettings { maintenance: boolean; coachEnabled: boolean; updatesEnabled: boolean; updateFeedUrl: string }
  type DrumoUpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "downloaded" | "disabled" | "not-configured" | "error";
  interface DrumoUpdateState {
    status: DrumoUpdateStatus;
    currentVersion: string;
    version?: string;
    notes?: string;
    publishedAt?: string;
    downloadedBytes?: number;
    totalBytes?: number;
    message?: string;
  }
  interface DrumoCourse {
    id: string;
    title: string;
    description: string;
    content: string;
    level: string;
    tags: string[];
    published: boolean;
    authorId: string;
    authorName: string;
    createdAt: string;
    updatedAt: string;
  }
  interface DrumoScore {
    id: string;
    title: string;
    description: string;
    authorId: string;
    authorName: string;
    createdAt: string;
    updatedAt: string;
    midiSize: number;
  }
  interface DrumoMetronomeSound {
    id: string;
    name: string;
    fileName: string;
    filePath: string;
    url: string;
    createdAt: string;
  }
  type BackendResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

  interface Window {
    drumApp: {
      backend: {
        bootstrap: () => Promise<BackendResult<{ maintenance: boolean }>>;
        login: (input: { username: string; password: string }) => Promise<BackendResult<{ token: string; user: DrumoUser; settings: DrumoSettings }>>;
        register: (input: { username: string; password: string }) => Promise<BackendResult<{ token: string; user: DrumoUser; settings: DrumoSettings }>>;
        me: (token: string) => Promise<BackendResult<{ user: DrumoUser; settings: DrumoSettings }>>;
        logout: (token: string) => Promise<BackendResult<boolean>>;
        changePassword: (token: string, input: { currentPassword: string; newPassword: string }) => Promise<BackendResult<DrumoUser>>;
        listUsers: (token: string) => Promise<BackendResult<DrumoUser[]>>;
        createUser: (token: string, input: { username: string; password: string; role: DrumoRole }) => Promise<BackendResult<DrumoUser>>;
        updateUser: (token: string, input: { id: string; role: DrumoRole; active: boolean }) => Promise<BackendResult<DrumoUser>>;
        listCourses: (token: string) => Promise<BackendResult<DrumoCourse[]>>;
        saveCourse: (token: string, input: Partial<DrumoCourse> & { title: string; content: string }) => Promise<BackendResult<DrumoCourse>>;
        deleteCourse: (token: string, courseId: string) => Promise<BackendResult<boolean>>;
        listScores: (token: string) => Promise<BackendResult<DrumoScore[]>>;
        saveScore: (token: string, input: { title: string; description: string; midiBytes: number[]; projectData?: unknown }) => Promise<BackendResult<DrumoScore>>;
        getScore: (token: string, scoreId: string) => Promise<BackendResult<DrumoScore & { midiBytes: number[]; projectData?: unknown }>>;
        deleteScore: (token: string, scoreId: string) => Promise<BackendResult<boolean>>;
        getConfig: (token: string) => Promise<BackendResult<DrumoSettings>>;
        updateConfig: (token: string, input: Partial<DrumoSettings>) => Promise<BackendResult<DrumoSettings>>;
        coach: (token: string, input: { message: string; context?: Record<string, unknown> }) => Promise<BackendResult<{ answer: string; createdAt: string; mode: "offline" }>>;
      };
      updates: {
        getState: () => Promise<DrumoUpdateState>;
        check: () => Promise<DrumoUpdateState>;
        download: () => Promise<DrumoUpdateState>;
        install: () => Promise<boolean>;
        onState: (listener: (state: DrumoUpdateState) => void) => () => void;
      };
      connection: {
        get: () => Promise<{ mode: "local" | "central"; apiUrl: string }>;
        set: (input: { apiUrl: string }) => Promise<{ mode: "local" | "central"; apiUrl: string }>;
        test: (input?: { apiUrl?: string }) => Promise<{ ok: boolean; message: string }>;
      };
      // ── Fichiers MIDI / projet ───────────────────────────────────────────
      openMidiFile: () => Promise<{ filePath: string; bytes: number[] } | null>;
      metronome: {
        importSound: () => Promise<DrumoMetronomeSound | null>;
        listSounds: () => Promise<DrumoMetronomeSound[]>;
        deleteSound: (id: string) => Promise<boolean>;
      };
      saveProject: (payload: unknown) => Promise<string | null>;
      loadProject: () => Promise<{ filePath: string; content: string } | null>;

      // ── Exports divers ───────────────────────────────────────────────────
      exportPdf:  () => Promise<string | null>;
      exportMidi: (bytes: number[]) => Promise<string | null>;
      exportSvg:  (svgText: string) => Promise<string | null>;

      // ── Partition MuseScore 4 ────────────────────────────────────────────
      checkMuseScore: () => Promise<{ found: boolean; bin: string | null }>;
      /**
       * Convertit le MIDI normalisé en MusicXML via MuseScore (headless).
       * Retourne le MusicXML en string — Verovio s'en charge ensuite dans le renderer.
       * Rien n'est écrit chez l'utilisateur.
       */
      renderDrumScore: (args: {
        midiBytes: number[];
        warnings?: string[];
      }) => Promise<{
        success: boolean;
        musicXml?: string;
        pages: string[];
        error?: string;
        warnings?: string[];
      }>;
      /** Exporte en PDF ou MusicXML via dialog de sauvegarde */
      exportDrumScore: (args: {
        midiBytes: number[];
        format: "pdf" | "musicxml" | "both";
      }) => Promise<{
        success: boolean;
        pdfPath?: string;
        musicxmlPath?: string;
        error?: string;
      }>;

      // ── Lecture de fichiers ──────────────────────────────────────────────
      openScoreFiles: () => Promise<Array<{
        filePath: string;
        originalName: string;
        fileSize: number;
        format: string;
      }> | null>;
      readMidiBytes:  (filePath: string) => Promise<number[] | null>;
      readPdfDataUrl: (filePath: string) => Promise<string | null>;

      // ── Fenêtre ──────────────────────────────────────────────────────────
      setFullscreen: (enabled: boolean) => Promise<boolean>;
    };
  }
}

export {};
