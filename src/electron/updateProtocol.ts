export interface UpdateManifest {
  version: string;
  notes?: string;
  publishedAt?: string;
  windows: { url: string; sha256: string; size?: number };
}

const versionParts = (version: string): number[] => version.replace(/^v/i, "").split("-", 1)[0].split(".").map((part) => Number.parseInt(part, 10) || 0);

export const compareVersions = (left: string, right: string): number => {
  const a = versionParts(left); const b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length, 3); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
};

export const isTrustedUpdateUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
  } catch { return false; }
};

export const parseUpdateManifest = (raw: unknown, feedUrl: string): UpdateManifest => {
  if (!raw || typeof raw !== "object") throw new Error("Manifeste de mise à jour invalide.");
  const source = raw as Record<string, unknown>;
  const windows = source.windows as Record<string, unknown> | undefined;
  if (typeof source.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(source.version)) throw new Error("Version de mise à jour invalide.");
  if (!windows || typeof windows.url !== "string" || typeof windows.sha256 !== "string") throw new Error("Paquet Windows absent du manifeste.");
  const resolvedUrl = new URL(windows.url, feedUrl).toString();
  if (!isTrustedUpdateUrl(resolvedUrl) || !resolvedUrl.toLowerCase().endsWith(".exe")) throw new Error("Adresse du paquet Windows non autorisée.");
  if (!/^[a-fA-F0-9]{64}$/.test(windows.sha256)) throw new Error("Empreinte SHA-256 invalide.");
  const size = typeof windows.size === "number" && Number.isSafeInteger(windows.size) && windows.size > 0 ? windows.size : undefined;
  return {
    version: source.version,
    notes: typeof source.notes === "string" ? source.notes.slice(0, 5000) : undefined,
    publishedAt: typeof source.publishedAt === "string" ? source.publishedAt : undefined,
    windows: { url: resolvedUrl, sha256: windows.sha256.toLowerCase(), size },
  };
};
