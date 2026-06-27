import { createSupabaseClient, type SupabaseAuthSession } from "./supabaseClient";

const cloudSessionKey = "drumo_supabase_session";

export interface CloudAuthSession {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email?: string;
}

const persistSession = (session: CloudAuthSession | null): void => {
  try {
    if (session) localStorage.setItem(cloudSessionKey, JSON.stringify(session));
    else localStorage.removeItem(cloudSessionKey);
  } catch {
    // Local auth remains the source of truth if browser storage is unavailable.
  }
};

export const authService = {
  getSession(): CloudAuthSession | null {
    try {
      const raw = localStorage.getItem(cloudSessionKey);
      return raw ? JSON.parse(raw) as CloudAuthSession : null;
    } catch {
      return null;
    }
  },

  async login(email: string, password: string): Promise<CloudAuthSession | null> {
    const client = createSupabaseClient();
    if (!client) return null;
    const result = await client.authRequest<SupabaseAuthSession>("token?grant_type=password", { email, password });
    const session = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      userId: result.user.id,
      email: result.user.email,
    };
    persistSession(session);
    return session;
  },

  async register(email: string, password: string): Promise<CloudAuthSession | null> {
    const client = createSupabaseClient();
    if (!client) return null;
    const result = await client.authRequest<Partial<SupabaseAuthSession> & { user?: SupabaseAuthSession["user"] }>("signup", { email, password });
    if (!result.access_token || !result.user) return null;
    const session = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      userId: result.user.id,
      email: result.user.email,
    };
    persistSession(session);
    return session;
  },

  async logout(): Promise<void> {
    const client = createSupabaseClient();
    const session = this.getSession();
    persistSession(null);
    if (!client || !session) return;
    await client.authAuthorizedRequest("logout", session.accessToken).catch(() => undefined);
  },

  async refreshSession(): Promise<CloudAuthSession | null> {
    const client = createSupabaseClient();
    const session = this.getSession();
    if (!client || !session?.refreshToken) return session;
    const result = await client.authRequest<SupabaseAuthSession>("token?grant_type=refresh_token", {
      refresh_token: session.refreshToken,
    });
    const next = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      userId: result.user.id,
      email: result.user.email,
    };
    persistSession(next);
    return next;
  },
};
