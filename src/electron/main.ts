import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { renderDrumScore, exportDrumScore, findMuseScore } from "./musescoreService";
import type { ExportFormat } from "./musescoreService";
import { registerBackendHandlers } from "./backend";
import { DrumoUpdateService } from "./updateService";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

const createWindow = async (): Promise<void> => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await win.loadFile(path.join(__dirname, "../dist/index.html"));
};

app.whenReady().then(async () => {

  const backend = await registerBackendHandlers(ipcMain, app.getPath("userData"));
  const updateService = new DrumoUpdateService(app.getPath("userData"), () => backend.getSystemSettings());
  updateService.register(ipcMain);

  // ── Importer un fichier MIDI ────────────────────────────────────────────────
  ipcMain.handle("dialog:openMidi", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open MIDI file",
      filters: [{ name: "MIDI", extensions: ["mid", "midi"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const buffer = await fs.readFile(filePath);
    return { filePath, bytes: Array.from(buffer) };
  });

  // ── Sauvegarder / charger le projet JSON ────────────────────────────────────
  ipcMain.handle("project:save", async (_evt, payload: unknown) => {
    const result = await dialog.showSaveDialog({
      title: "Save project",
      filters: [{ name: "Drum Score Project", extensions: ["drumscore.json"] }]
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
    return result.filePath;
  });

  ipcMain.handle("project:load", async () => {
    const result = await dialog.showOpenDialog({
      title: "Load project",
      filters: [{ name: "Drum Score Project", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, "utf-8");
    return { filePath, content };
  });

  // ── Exports divers ──────────────────────────────────────────────────────────
  ipcMain.handle("score:exportPdf", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog({
      title: "Export PDF",
      defaultPath: "drum-score.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (result.canceled || !result.filePath) return null;
    const data = await win.webContents.printToPDF({ printBackground: true, landscape: false });
    await fs.writeFile(result.filePath, data);
    return result.filePath;
  });

  ipcMain.handle("score:exportMidi", async (_evt, bytes: number[]) => {
    const result = await dialog.showSaveDialog({
      title: "Export MIDI",
      defaultPath: "drum-score.mid",
      filters: [{ name: "MIDI", extensions: ["mid"] }]
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, Buffer.from(bytes));
    return result.filePath;
  });

  ipcMain.handle("score:exportSvg", async (_evt, svgText: string) => {
    const result = await dialog.showSaveDialog({
      title: "Export SVG",
      defaultPath: "drum-score.svg",
      filters: [{ name: "SVG", extensions: ["svg"] }]
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, svgText, "utf-8");
    return result.filePath;
  });

  // ── Partition via MuseScore 4 ───────────────────────────────────────────────

  /** Vérifie si MuseScore 4 est installé. */
  ipcMain.handle("musescore:checkInstall", async () => {
    const bin = await findMuseScore();
    return bin ? { found: true, bin } : { found: false, bin: null };
  });

  /**
   * Rend la partition en pages PNG pour affichage DANS Drumo.
   * Tout reste dans des fichiers temporaires — rien n'est écrit chez l'utilisateur.
   * Retourne un tableau de data URIs PNG (une entrée par page).
   */
  ipcMain.handle(
    "musescore:renderScore",
    async (_evt, payload: { midiBytes: number[]; warnings?: string[] }) => {
      const result = await renderDrumScore(payload.midiBytes);
      if (!result.success) {
        await dialog.showErrorBox(
          "Rendu de partition échoué",
          result.error ?? "Erreur inconnue"
        );
      }
      if (payload.warnings?.length) {
        result.warnings = [...(payload.warnings ?? []), ...(result.warnings ?? [])];
      }
      return result;
    }
  );

  /**
   * Exporte la partition vers un fichier PDF ou MusicXML.
   * Ouvre une dialog de sauvegarde et ouvre le fichier résultant.
   */
  ipcMain.handle(
    "musescore:exportScore",
    async (
      _evt,
      payload: { midiBytes: number[]; format: ExportFormat }
    ) => {
      const { midiBytes, format } = payload;
      const isPdf = format === "pdf" || format === "both";
      const saveResult = await dialog.showSaveDialog({
        title: "Exporter la partition batterie",
        defaultPath: path.join(os.homedir(), isPdf ? "partition-batterie.pdf" : "partition-batterie.musicxml"),
        filters: isPdf
          ? [{ name: "PDF", extensions: ["pdf"] }]
          : [{ name: "MusicXML", extensions: ["musicxml"] }],
      });
      if (saveResult.canceled || !saveResult.filePath) return { success: false, error: "Annulé" };

      const result = await exportDrumScore(midiBytes, format, saveResult.filePath);
      if (result.success) {
        const toOpen = result.pdfPath ?? result.musicxmlPath;
        if (toOpen) await shell.openPath(toOpen);
      } else {
        await dialog.showErrorBox("Export échoué", result.error ?? "Erreur inconnue");
      }
      return result;
    }
  );

  // ── Lecture de fichiers ─────────────────────────────────────────────────────
  ipcMain.handle("dialog:openScore", async () => {
    const result = await dialog.showOpenDialog({
      title: "Importer une partition",
      filters: [
        { name: "Partitions", extensions: ["mid", "midi", "pdf", "xml", "musicxml"] },
        { name: "MIDI", extensions: ["mid", "midi"] },
        { name: "PDF", extensions: ["pdf"] },
        { name: "MusicXML", extensions: ["xml", "musicxml"] },
      ],
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const items = await Promise.all(
      result.filePaths.map(async (fp) => {
        const stat = await fs.stat(fp);
        const ext = path.extname(fp).toLowerCase().slice(1);
        const format =
          ext === "mid" || ext === "midi" ? "midi" :
          ext === "pdf" ? "pdf" : "musicxml";
        return { filePath: fp, originalName: path.basename(fp), fileSize: stat.size, format };
      })
    );
    return items;
  });

  ipcMain.handle("score:readMidi", async (_evt, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      return Array.from(buffer);
    } catch { return null; }
  });

  ipcMain.handle("score:readPdf", async (_evt, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      return `data:application/pdf;base64,${buffer.toString("base64")}`;
    } catch { return null; }
  });

  // ── Fenêtre ─────────────────────────────────────────────────────────────────
  ipcMain.handle("window:setFullscreen", (_evt, enabled: boolean) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;
    win.setFullScreen(Boolean(enabled));
    return win.isFullScreen();
  });

  void createWindow();
  updateService.start();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
