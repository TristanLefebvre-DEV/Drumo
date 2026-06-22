import http from "node:http";
import path from "node:path";
import { DrumoBackend, BackendError } from "../../src/electron/backend";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const dataFile = process.env.DRUMO_DATA_FILE || path.resolve("data", "drumo-data.json");
const corsOrigin = process.env.DRUMO_CORS_ORIGIN || "";
const trustProxy = process.env.TRUST_PROXY === "true";
const maxBodyBytes = 50 * 1024 * 1024;
const backend = new DrumoBackend(dataFile, {
  adminUsername: process.env.DRUMO_ADMIN_USERNAME,
  adminPassword: process.env.DRUMO_ADMIN_PASSWORD,
});

interface RateEntry { count: number; resetsAt: number }
const rates = new Map<string, RateEntry>();
const allowRequest = (key: string, limit: number): boolean => {
  const timestamp = Date.now(); const current = rates.get(key);
  if (!current || current.resetsAt <= timestamp) { rates.set(key, { count: 1, resetsAt: timestamp + 60_000 }); return true; }
  current.count += 1;
  return current.count <= limit;
};

const statusFor = (code: string): number => ({
  VALIDATION: 400, WEAK_PASSWORD: 400, INVALID_CREDENTIALS: 401, UNAUTHORIZED: 401,
  ACCOUNT_DISABLED: 403, FORBIDDEN: 403, MAINTENANCE: 503, COACH_DISABLED: 503,
  NOT_FOUND: 404, CONFLICT: 409, TOO_MANY_ATTEMPTS: 429,
}[code] ?? 500);

const setHeaders = (response: http.ServerResponse): void => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (corsOrigin) response.setHeader("Access-Control-Allow-Origin", corsOrigin);
};

const send = (response: http.ServerResponse, status: number, payload: unknown): void => {
  setHeaders(response); response.statusCode = status; response.end(JSON.stringify(payload));
};

const readBody = async (request: http.IncomingMessage): Promise<Record<string, unknown>> => {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new BackendError("VALIDATION", "Le corps doit être au format JSON.");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new BackendError("VALIDATION", "La requête est trop volumineuse.");
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>; }
  catch { throw new BackendError("VALIDATION", "JSON invalide."); }
};

const tokenFrom = (request: http.IncomingMessage): string => {
  const authorization = request.headers.authorization ?? "";
  if (!authorization.startsWith("Bearer ")) throw new BackendError("UNAUTHORIZED", "Connexion requise.");
  return authorization.slice(7);
};

const route = async (request: http.IncomingMessage): Promise<unknown> => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (method === "GET" && pathname === "/health") return { service: "drumo-api", status: "ok", version: process.env.DRUMO_SERVER_VERSION || "1" };
  if (method === "GET" && pathname === "/v1/bootstrap") return backend.bootstrap();

  if (method === "POST" && pathname === "/v1/auth/login") return backend.login(await readBody(request));
  if (method === "POST" && pathname === "/v1/auth/register") return backend.register(await readBody(request));
  if (method === "GET" && pathname === "/v1/auth/me") return backend.me(tokenFrom(request));
  if (method === "POST" && pathname === "/v1/auth/logout") return backend.logout(tokenFrom(request));
  if (method === "POST" && pathname === "/v1/auth/change-password") return backend.changePassword(tokenFrom(request), await readBody(request));

  if (method === "GET" && pathname === "/v1/admin/users") return backend.listUsers(tokenFrom(request));
  if (method === "POST" && pathname === "/v1/admin/users") return backend.createUser(tokenFrom(request), await readBody(request));
  const userMatch = pathname.match(/^\/v1\/admin\/users\/([^/]+)$/);
  if (method === "PATCH" && userMatch) return backend.updateUser(tokenFrom(request), { ...await readBody(request), id: decodeURIComponent(userMatch[1]) });

  if (method === "GET" && pathname === "/v1/courses") return backend.listCourses(tokenFrom(request));
  if (method === "POST" && pathname === "/v1/admin/courses") return backend.saveCourse(tokenFrom(request), await readBody(request));
  const adminCourseMatch = pathname.match(/^\/v1\/admin\/courses\/([^/]+)$/);
  if (method === "DELETE" && adminCourseMatch) return backend.deleteCourse(tokenFrom(request), decodeURIComponent(adminCourseMatch[1]));

  if (method === "GET" && pathname === "/v1/scores") return backend.listScores(tokenFrom(request));
  if (method === "POST" && pathname === "/v1/scores") return backend.saveScore(tokenFrom(request), await readBody(request));
  const scoreMatch = pathname.match(/^\/v1\/scores\/([^/]+)$/);
  if (method === "GET" && scoreMatch) return backend.getScore(tokenFrom(request), decodeURIComponent(scoreMatch[1]));
  if (method === "DELETE" && scoreMatch) return backend.deleteScore(tokenFrom(request), decodeURIComponent(scoreMatch[1]));

  if (method === "GET" && pathname === "/v1/config") return backend.getConfig(tokenFrom(request));
  if (method === "PATCH" && pathname === "/v1/admin/config") return backend.updateConfig(tokenFrom(request), await readBody(request));
  if (method === "POST" && pathname === "/v1/coach") return backend.coach(tokenFrom(request), await readBody(request));
  throw new BackendError("NOT_FOUND", "Route introuvable.");
};

const main = async (): Promise<void> => {
  await backend.initialize();
  if (!process.env.DRUMO_ADMIN_PASSWORD) console.warn("[drumo-api] DRUMO_ADMIN_PASSWORD absent : changez immédiatement le mot de passe admin initial.");

  const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    setHeaders(response); response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS"); response.statusCode = 204; response.end(); return;
  }
  const forwarded = trustProxy ? String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim() : "";
  const ip = forwarded || request.socket.remoteAddress || "unknown";
  const authRoute = request.url?.startsWith("/v1/auth/") ?? false;
  if (!allowRequest(`${authRoute ? "auth" : "api"}:${ip}`, authRoute ? 30 : 300)) {
    send(response, 429, { ok: false, error: { code: "TOO_MANY_ATTEMPTS", message: "Trop de requêtes. Réessayez dans une minute." } }); return;
  }
  try { send(response, 200, { ok: true, data: await route(request) }); }
  catch (error) {
    const known = error instanceof BackendError;
    const code = known ? error.code : "INTERNAL";
    if (!known) console.error("[drumo-api]", error);
    send(response, statusFor(code), { ok: false, error: { code, message: known ? error.message : "Une erreur interne est survenue." } });
  }
  });

  server.listen(port, host, () => console.log(`[drumo-api] écoute sur ${host}:${port}; données: ${dataFile}`));
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
};

void main().catch((error) => { console.error("[drumo-api] démarrage impossible", error); process.exit(1); });
