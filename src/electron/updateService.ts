import { app, BrowserWindow, net } from "electron";
import type { IpcMain } from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { compareVersions, isTrustedUpdateUrl, parseUpdateManifest, type UpdateManifest } from "./updateProtocol";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "downloaded" | "disabled" | "not-configured" | "error";
export interface UpdateState {
  status: UpdateStatus; currentVersion: string; version?: string; notes?: string; publishedAt?: string;
  downloadedBytes?: number; totalBytes?: number; message?: string;
}
interface UpdateSettings { updatesEnabled: boolean; updateFeedUrl: string }

const MAX_INSTALLER_SIZE = 600 * 1024 * 1024;

export class DrumoUpdateService {
  private state: UpdateState = { status: "idle", currentVersion: app.getVersion() };
  private manifest: UpdateManifest | null = null;
  private downloadedPath: string | null = null;
  private checking: Promise<UpdateState> | null = null;
  private downloading: Promise<UpdateState> | null = null;

  constructor(private readonly userDataPath: string, private readonly settings: () => UpdateSettings) {}

  private publish(patch: Partial<UpdateState>): UpdateState {
    this.state = { ...this.state, ...patch, currentVersion: app.getVersion() };
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("updates:state", this.state);
    return { ...this.state };
  }

  getState(): UpdateState { return { ...this.state }; }

  register(ipcMain: IpcMain): void {
    ipcMain.handle("updates:get-state", () => this.getState());
    ipcMain.handle("updates:check", () => this.check());
    ipcMain.handle("updates:download", () => this.download());
    ipcMain.handle("updates:install", () => this.install());
  }

  start(): void {
    const run = () => { if (this.settings().updatesEnabled) void this.check(); };
    setTimeout(run, 12_000).unref();
    setInterval(run, 6 * 60 * 60 * 1000).unref();
  }

  async check(): Promise<UpdateState> {
    if (this.checking) return this.checking;
    this.checking = this.performCheck().finally(() => { this.checking = null; });
    return this.checking;
  }

  private async performCheck(): Promise<UpdateState> {
    const settings = this.settings();
    if (!settings.updatesEnabled) return this.publish({ status: "disabled", message: "Les mises à jour automatiques sont désactivées." });
    if (!settings.updateFeedUrl) return this.publish({ status: "not-configured", message: "Serveur de mises à jour non configuré." });
    if (!isTrustedUpdateUrl(settings.updateFeedUrl)) return this.publish({ status: "error", message: "Adresse du serveur de mises à jour non autorisée." });
    this.publish({ status: "checking", message: "Recherche d'une nouvelle version…" });
    try {
      const response = await net.fetch(settings.updateFeedUrl, { headers: { Accept: "application/json", "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error(`Le serveur a répondu ${response.status}.`);
      const manifest = parseUpdateManifest(await response.json(), settings.updateFeedUrl);
      if (compareVersions(manifest.version, app.getVersion()) <= 0) {
        this.manifest = null;
        return this.publish({ status: "up-to-date", version: undefined, notes: undefined, publishedAt: undefined, message: "Drumo est à jour." });
      }
      this.manifest = manifest;
      this.downloadedPath = null;
      return this.publish({ status: "available", version: manifest.version, notes: manifest.notes, publishedAt: manifest.publishedAt, message: `Drumo ${manifest.version} est disponible.` });
    } catch (error) {
      return this.publish({ status: "error", message: error instanceof Error ? error.message : "Vérification impossible." });
    }
  }

  async download(): Promise<UpdateState> {
    if (this.downloading) return this.downloading;
    this.downloading = this.performDownload().finally(() => { this.downloading = null; });
    return this.downloading;
  }

  private async performDownload(): Promise<UpdateState> {
    if (!this.manifest) return this.publish({ status: "error", message: "Vérifiez d'abord les mises à jour." });
    const manifest = this.manifest;
    const updateDirectory = path.join(this.userDataPath, "updates");
    const finalPath = path.join(updateDirectory, `Drumo-Setup-${manifest.version}.exe`);
    const partialPath = `${finalPath}.partial`;
    this.publish({ status: "downloading", version: manifest.version, downloadedBytes: 0, totalBytes: manifest.windows.size, message: "Téléchargement de la mise à jour…" });
    try {
      const response = await net.fetch(manifest.windows.url, { headers: { Accept: "application/octet-stream" } });
      if (!response.ok || !response.body) throw new Error(`Téléchargement refusé (${response.status}).`);
      const announcedSize = Number(response.headers.get("content-length") ?? manifest.windows.size ?? 0);
      if (announcedSize > MAX_INSTALLER_SIZE) throw new Error("Le paquet de mise à jour est trop volumineux.");
      await fs.mkdir(updateDirectory, { recursive: true });
      await fs.rm(partialPath, { force: true });
      const file = await fs.open(partialPath, "w", 0o600);
      const hash = crypto.createHash("sha256");
      const reader = response.body.getReader();
      let received = 0; let lastPublished = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > MAX_INSTALLER_SIZE) throw new Error("Le paquet de mise à jour est trop volumineux.");
          const chunk = Buffer.from(value);
          hash.update(chunk);
          await file.write(chunk);
          if (received - lastPublished >= 1024 * 1024) {
            lastPublished = received;
            this.publish({ status: "downloading", downloadedBytes: received, totalBytes: announcedSize || manifest.windows.size });
          }
        }
      } finally { await file.close(); }
      if (hash.digest("hex") !== manifest.windows.sha256) throw new Error("La signature SHA-256 de la mise à jour ne correspond pas.");
      await fs.rm(finalPath, { force: true });
      await fs.rename(partialPath, finalPath);
      this.downloadedPath = finalPath;
      return this.publish({ status: "downloaded", downloadedBytes: received, totalBytes: received, message: "Mise à jour prête. Redémarrez Drumo pour l'installer." });
    } catch (error) {
      await fs.rm(partialPath, { force: true }).catch(() => undefined);
      return this.publish({ status: "error", message: error instanceof Error ? error.message : "Téléchargement impossible." });
    }
  }

  install(): boolean {
    if (!this.downloadedPath || process.platform !== "win32") return false;
    const child = spawn(this.downloadedPath, ["/S"], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    setTimeout(() => app.quit(), 300);
    return true;
  }
}
