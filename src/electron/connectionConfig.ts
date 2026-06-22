import { app, net } from "electron";
import type { IpcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { isTrustedUpdateUrl } from "./updateProtocol";

interface ServerConfig { apiUrl: string }

export class ConnectionConfig {
  private apiUrl = "";
  private readonly overrideFile: string;

  constructor(private readonly userDataPath: string) { this.overrideFile = path.join(userDataPath, "server-connection.json"); }

  async initialize(): Promise<void> {
    const bundledFile = path.join(app.getAppPath(), "assets", "server-config.json");
    for (const file of [this.overrideFile, bundledFile]) {
      try {
        const config = JSON.parse(await fs.readFile(file, "utf8")) as ServerConfig;
        if (typeof config.apiUrl === "string" && config.apiUrl.trim()) { this.apiUrl = this.normalize(config.apiUrl); return; }
      } catch { /* Try the next source. */ }
    }
  }

  private normalize(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (trimmed.length > 500 || !isTrustedUpdateUrl(trimmed)) throw new Error("Le serveur doit utiliser HTTPS (HTTP local autorisé pour les tests).");
    const parsed = new URL(trimmed);
    if (parsed.search || parsed.hash) throw new Error("L'adresse du serveur ne doit pas contenir de paramètres ni d'ancre.");
    return trimmed;
  }

  get() { return { mode: this.apiUrl ? "central" as const : "local" as const, apiUrl: this.apiUrl }; }

  async set(value: unknown) {
    const body = (value ?? {}) as Record<string, unknown>;
    const apiUrl = typeof body.apiUrl === "string" && body.apiUrl.trim() ? this.normalize(body.apiUrl) : "";
    await fs.mkdir(this.userDataPath, { recursive: true });
    await fs.writeFile(this.overrideFile, JSON.stringify({ apiUrl }, null, 2), { encoding: "utf8", mode: 0o600 });
    this.apiUrl = apiUrl;
    setTimeout(() => { app.relaunch(); app.exit(0); }, 400);
    return this.get();
  }

  async test(value?: unknown) {
    const body = (value ?? {}) as Record<string, unknown>;
    const apiUrl = typeof body.apiUrl === "string" && body.apiUrl.trim() ? this.normalize(body.apiUrl) : this.apiUrl;
    if (!apiUrl) return { ok: false, message: "Aucun serveur central configuré." };
    try {
      const response = await net.fetch(`${apiUrl}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { ok: true, message: "Serveur central disponible." };
    } catch { return { ok: false, message: "Serveur central inaccessible." }; }
  }

  register(ipcMain: IpcMain): void {
    ipcMain.handle("connection:get", () => this.get());
    ipcMain.handle("connection:set", (_event, value) => this.set(value));
    ipcMain.handle("connection:test", (_event, value) => this.test(value));
  }
}
