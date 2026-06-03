import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("drumApp", {
  // ── Fichiers MIDI / projet ────────────────────────────────────────────────
  openMidiFile: () =>
    ipcRenderer.invoke("dialog:openMidi"),
  saveProject: (payload: unknown) =>
    ipcRenderer.invoke("project:save", payload),
  loadProject: () =>
    ipcRenderer.invoke("project:load"),

  // ── Exports divers ────────────────────────────────────────────────────────
  exportPdf:  () =>
    ipcRenderer.invoke("score:exportPdf"),
  exportMidi: (bytes: number[]) =>
    ipcRenderer.invoke("score:exportMidi", bytes),
  exportSvg:  (svgText: string) =>
    ipcRenderer.invoke("score:exportSvg", svgText),

  // ── Partition MuseScore 4 ─────────────────────────────────────────────────
  /** Vérifie si MuseScore 4 est installé. */
  checkMuseScore: () =>
    ipcRenderer.invoke("musescore:checkInstall"),

  /**
   * Rend la partition en pages PNG pour affichage dans Drumo.
   * Retourne des data URIs PNG (base64), une par page.
   * Rien n'est écrit dans les dossiers de l'utilisateur.
   */
  renderDrumScore: (args: { midiBytes: number[]; warnings?: string[] }) =>
    ipcRenderer.invoke("musescore:renderScore", args),

  /**
   * Exporte la partition vers un fichier PDF ou MusicXML.
   * Ouvre une dialog de sauvegarde et le fichier généré.
   */
  exportDrumScore: (args: {
    midiBytes: number[];
    format: "pdf" | "musicxml" | "both";
  }) => ipcRenderer.invoke("musescore:exportScore", args),

  // ── Lecture de fichiers ───────────────────────────────────────────────────
  openScoreFiles: () =>
    ipcRenderer.invoke("dialog:openScore"),
  readMidiBytes:  (filePath: string) =>
    ipcRenderer.invoke("score:readMidi", filePath),
  readPdfDataUrl: (filePath: string) =>
    ipcRenderer.invoke("score:readPdf", filePath),

  // ── Fenêtre ───────────────────────────────────────────────────────────────
  setFullscreen: (enabled: boolean) =>
    ipcRenderer.invoke("window:setFullscreen", enabled),
});
