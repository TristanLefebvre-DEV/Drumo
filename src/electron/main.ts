import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

const createWindow = async (): Promise<void> => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await win.loadFile(path.join(__dirname, "../dist/index.html"));
};

app.whenReady().then(() => {
  ipcMain.handle("dialog:openMidi", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open MIDI file",
      filters: [{ name: "MIDI", extensions: ["mid", "midi"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    const buffer = await fs.readFile(filePath);
    return { filePath, bytes: Array.from(buffer) };
  });

  ipcMain.handle("project:save", async (_evt, payload: unknown) => {
    const result = await dialog.showSaveDialog({
      title: "Save project",
      filters: [{ name: "Drum Score Project", extensions: ["drumscore.json"] }]
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
    return result.filePath;
  });

  ipcMain.handle("project:load", async () => {
    const result = await dialog.showOpenDialog({
      title: "Load project",
      filters: [{ name: "Drum Score Project", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, "utf-8");
    return { filePath, content };
  });

  ipcMain.handle("score:exportPdf", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      return null;
    }
    const result = await dialog.showSaveDialog({
      title: "Export PDF",
      defaultPath: "drum-score.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    const data = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false
    });
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

  ipcMain.handle("window:setFullscreen", (_evt, enabled: boolean) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;
    win.setFullScreen(Boolean(enabled));
    return win.isFullScreen();
  });

  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
