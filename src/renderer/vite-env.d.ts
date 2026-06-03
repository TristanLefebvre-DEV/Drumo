/// <reference types="vite/client" />

declare global {
  interface Window {
    drumApp: {
      // ── Fichiers MIDI / projet ───────────────────────────────────────────
      openMidiFile: () => Promise<{ filePath: string; bytes: number[] } | null>;
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
