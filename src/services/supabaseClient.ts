export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getSupabaseConfig = (): SupabaseConfig | null => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() || import.meta.env.SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || import.meta.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url: trimTrailingSlash(url), anonKey };
};

export const isSupabaseConfigured = (): boolean => getSupabaseConfig() !== null;

export class SupabaseHttpClient {
  constructor(private readonly config: SupabaseConfig) {}

  private headers(accessToken?: string): Record<string, string> {
    return {
      apikey: this.config.anonKey,
      Authorization: `Bearer ${accessToken ?? this.config.anonKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async authRequest<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.config.url}/auth/v1/${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Supabase Auth HTTP ${response.status}`);
    return await response.json() as T;
  }

  async authAuthorizedRequest<T>(path: string, accessToken: string, body: unknown = {}): Promise<T> {
    const headers = this.headers(accessToken);
    const response = await fetch(`${this.config.url}/auth/v1/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Supabase Auth HTTP ${response.status}`);
    return response.status === 204 ? undefined as T : await response.json() as T;
  }

  async restRequest<T>(path: string, options: { method?: string; accessToken?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
    const headers = this.headers(options.accessToken);
    if (options.prefer) headers.Prefer = options.prefer;
    const response = await fetch(`${this.config.url}/rest/v1/${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) throw new Error(`Supabase REST HTTP ${response.status}`);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }
}

export const createSupabaseClient = (): SupabaseHttpClient | null => {
  const config = getSupabaseConfig();
  return config ? new SupabaseHttpClient(config) : null;
};
