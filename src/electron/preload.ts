import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("drumApp", {
  // Backend local sécurisé (processus principal uniquement)
  backend: {
    bootstrap: () => ipcRenderer.invoke("backend:bootstrap"),
    login: (input: unknown) => ipcRenderer.invoke("auth:login", input),
    register: (input: unknown) => ipcRenderer.invoke("auth:register", input),
    me: (token: string) => ipcRenderer.invoke("auth:me", token),
    logout: (token: string) => ipcRenderer.invoke("auth:logout", token),
    changePassword: (token: string, input: unknown) => ipcRenderer.invoke("auth:change-password", token, input),
    listUsers: (token: string) => ipcRenderer.invoke("admin:list-users", token),
    createUser: (token: string, input: unknown) => ipcRenderer.invoke("admin:create-user", token, input),
    updateUser: (token: string, input: unknown) => ipcRenderer.invoke("admin:update-user", token, input),
    listCourses: (token: string) => ipcRenderer.invoke("course:list", token),
    saveCourse: (token: string, input: unknown) => ipcRenderer.invoke("admin:save-course", token, input),
    deleteCourse: (token: string, courseId: string) => ipcRenderer.invoke("admin:delete-course", token, courseId),
    listScores: (token: string) => ipcRenderer.invoke("score:list", token),
    saveScore: (token: string, input: unknown) => ipcRenderer.invoke("score:save", token, input),
    getScore: (token: string, scoreId: string) => ipcRenderer.invoke("score:get", token, scoreId),
    deleteScore: (token: string, scoreId: string) => ipcRenderer.invoke("score:delete", token, scoreId),
    getConfig: (token: string) => ipcRenderer.invoke("config:get", token),
    updateConfig: (token: string, input: unknown) => ipcRenderer.invoke("admin:update-config", token, input),
    coach: (token: string, input: unknown) => ipcRenderer.invoke("coach:chat", token, input),
  },
  updates: {
    getState: () => ipcRenderer.invoke("updates:get-state"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    onState: (listener: (state: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state);
      ipcRenderer.on("updates:state", handler);
      return () => ipcRenderer.removeListener("updates:state", handler);
    },
  },
  connection: {
    get: () => ipcRenderer.invoke("connection:get"),
    set: (input: unknown) => ipcRenderer.invoke("connection:set", input),
    test: (input?: unknown) => ipcRenderer.invoke("connection:test", input),
  },
  // ── Fichiers MIDI / projet ────────────────────────────────────────────────
  openMidiFile: () =>
    ipcRenderer.invoke("dialog:openMidi"),
  metronome: {
    importSound: () => ipcRenderer.invoke("metronome:importSound"),
    listSounds: () => ipcRenderer.invoke("metronome:listSounds"),
    deleteSound: (id: string) => ipcRenderer.invoke("metronome:deleteSound", id),
  },
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
