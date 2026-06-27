import { compareVersions } from "../electron/updateProtocol";
import { createSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

export interface RemoteVersionInfo {
  latest_version: string;
  download_url: string;
  required: boolean;
  changelog: string;
}

interface SupabaseAppVersion {
  version: string;
  platform: string;
  download_url: string;
  changelog: string | null;
  required_update: boolean | null;
  created_at: string;
}

export const checkForUpdates = async (platform = "windows"): Promise<RemoteVersionInfo | null> => {
  const currentVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

  if (isSupabaseConfigured()) {
    const client = createSupabaseClient();
    if (client) {
      const rows = await client.restRequest<SupabaseAppVersion[]>(
        `app_versions?platform=eq.${encodeURIComponent(platform)}&select=*&order=created_at.desc&limit=1`,
      );
      const latest = rows[0];
      if (!latest || compareVersions(latest.version, currentVersion) <= 0) return null;
      return {
        latest_version: latest.version,
        download_url: latest.download_url,
        required: latest.required_update === true,
        changelog: latest.changelog ?? "",
      };
    }
  }

  const response = await fetch("/version.json", { headers: { Accept: "application/json" } }).catch(() => null);
  if (!response?.ok) return null;
  const raw = await response.json() as Partial<RemoteVersionInfo>;
  if (!raw.latest_version || compareVersions(raw.latest_version, currentVersion) <= 0) return null;
  return {
    latest_version: raw.latest_version,
    download_url: raw.download_url ?? "",
    required: raw.required === true,
    changelog: raw.changelog ?? "",
  };
};
