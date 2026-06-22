import { net } from "electron";
import { BackendError } from "./backendError";

interface RemoteSettings { maintenance: boolean; coachEnabled: boolean; updatesEnabled: boolean; updateFeedUrl: string }
interface RemoteResult<T> { ok: boolean; data?: T; error?: { code: string; message: string } }

const DEFAULT_SETTINGS: RemoteSettings = {
  maintenance: false, coachEnabled: true, updatesEnabled: true,
  updateFeedUrl: "https://github.com/TristanLefebvre-DEV/Drumo/releases/latest/download/latest.json",
};

export class RemoteDrumoBackend {
  private settings: RemoteSettings = { ...DEFAULT_SETTINGS };

  constructor(private readonly apiUrl: string) {}
  async initialize(): Promise<void> {}
  getSystemSettings(): RemoteSettings { return { ...this.settings }; }

  private async request<T>(method: string, endpoint: string, token?: unknown, body?: unknown): Promise<T> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (typeof token === "string") headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const response = await net.fetch(`${this.apiUrl}${endpoint}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
      });
      const result = await response.json() as RemoteResult<T>;
      if (!response.ok || !result.ok || result.data === undefined) {
        throw new BackendError(result.error?.code ?? "REMOTE_ERROR", result.error?.message ?? `Le serveur central a répondu ${response.status}.`);
      }
      return result.data;
    } catch (error) {
      if (error instanceof BackendError) throw error;
      throw new BackendError("OFFLINE", "Le serveur central Drumo est inaccessible. Vérifiez Internet ou l'adresse du serveur.");
    } finally { clearTimeout(timeout); }
  }

  async bootstrap() { return this.request<{ maintenance: boolean }>("GET", "/v1/bootstrap"); }
  async login(input: unknown) { const result = await this.request<{ token: string; user: unknown; settings: RemoteSettings }>("POST", "/v1/auth/login", undefined, input); this.settings = result.settings; return result; }
  async register(input: unknown) { const result = await this.request<{ token: string; user: unknown; settings: RemoteSettings }>("POST", "/v1/auth/register", undefined, input); this.settings = result.settings; return result; }
  async me(token: unknown) { const result = await this.request<{ user: unknown; settings: RemoteSettings }>("GET", "/v1/auth/me", token); this.settings = result.settings; return result; }
  logout(token: unknown) { return this.request<boolean>("POST", "/v1/auth/logout", token); }
  changePassword(token: unknown, input: unknown) { return this.request<unknown>("POST", "/v1/auth/change-password", token, input); }
  listUsers(token: unknown) { return this.request<unknown[]>("GET", "/v1/admin/users", token); }
  createUser(token: unknown, input: unknown) { return this.request<unknown>("POST", "/v1/admin/users", token, input); }
  updateUser(token: unknown, input: unknown) { const body = (input ?? {}) as Record<string, unknown>; return this.request<unknown>("PATCH", `/v1/admin/users/${encodeURIComponent(String(body.id ?? ""))}`, token, body); }
  listCourses(token: unknown) { return this.request<unknown[]>("GET", "/v1/courses", token); }
  saveCourse(token: unknown, input: unknown) { return this.request<unknown>("POST", "/v1/admin/courses", token, input); }
  deleteCourse(token: unknown, courseId: unknown) { return this.request<boolean>("DELETE", `/v1/admin/courses/${encodeURIComponent(String(courseId ?? ""))}`, token); }
  listScores(token: unknown) { return this.request<unknown[]>("GET", "/v1/scores", token); }
  saveScore(token: unknown, input: unknown) { return this.request<unknown>("POST", "/v1/scores", token, input); }
  getScore(token: unknown, scoreId: unknown) { return this.request<unknown>("GET", `/v1/scores/${encodeURIComponent(String(scoreId ?? ""))}`, token); }
  deleteScore(token: unknown, scoreId: unknown) { return this.request<boolean>("DELETE", `/v1/scores/${encodeURIComponent(String(scoreId ?? ""))}`, token); }
  async getConfig(token: unknown) { const settings = await this.request<RemoteSettings>("GET", "/v1/config", token); this.settings = settings; return settings; }
  async updateConfig(token: unknown, input: unknown) { const settings = await this.request<RemoteSettings>("PATCH", "/v1/admin/config", token, input); this.settings = settings; return settings; }
  coach(token: unknown, input: unknown) { return this.request<unknown>("POST", "/v1/coach", token, input); }
}
