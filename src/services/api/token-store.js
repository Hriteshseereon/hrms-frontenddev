/**
 * Access / refresh token storage, shared by BOTH HTTP clients (the axios client in src/api/SuperAdmin_axios.js and
 * the fetch client in ./client.js).
 *
 * The backend rotates the refresh token on every POST /auth/refresh and treats the reuse of an old one as theft: it
 * signs every session out. So there must be exactly one copy of the tokens and one refresh at a time. Each client
 * used to keep its own copy (this store: memory + sessionStorage + `access_token`; axios: `super_admin_*`), so after
 * one client refreshed, the other sent the rotated-out refresh token and the user landed on the login page.
 */
import { env } from "@/config/env";

// Login writes the same token under both names; every write below keeps them identical.
const ACCESS_KEYS = ["super_admin_access_token", "access_token"];
const REFRESH_KEYS = ["super_admin_refresh_token", "refresh_token"];
/** Copy this store used to keep in sessionStorage; it outlived sign-out and went stale. Removed on every write. */
const LEGACY_REFRESH_KEY = "seereon.api.refresh";

const listeners = new Set();
const bare = (token) => String(token ?? "").replace(/^Bearer\s+/i, "");

function stored(keys) {
  if (typeof window === "undefined") return null;
  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value) return bare(value);
  }
  return null;
}

export const tokenStore = {
  getAccess: () => stored(ACCESS_KEYS),
  getRefresh: () => stored(REFRESH_KEYS),
  /** @param {{ accessToken?: string, refreshToken?: string, access_token?: string, refresh_token?: string }} t */
  set(t) {
    const accessToken = t.accessToken ?? t.access_token;
    const refreshToken = t.refreshToken ?? t.refresh_token;
    if (typeof window !== "undefined") {
      if (accessToken) ACCESS_KEYS.forEach((key) => window.localStorage.setItem(key, bare(accessToken)));
      if (refreshToken) REFRESH_KEYS.forEach((key) => window.localStorage.setItem(key, refreshToken));
      window.sessionStorage.removeItem(LEGACY_REFRESH_KEY);
    }
    listeners.forEach((l) => l());
  },
  clear() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(LEGACY_REFRESH_KEY);
      [...ACCESS_KEYS, ...REFRESH_KEYS].forEach((key) => window.localStorage.removeItem(key));
    }
    listeners.forEach((l) => l());
  },
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

if (typeof window !== "undefined") window.sessionStorage.removeItem(LEGACY_REFRESH_KEY);

let refreshing = null;

/**
 * The one place that calls POST /auth/refresh. Requests that fail with 401 at the same moment share a single call.
 *
 * @param {string} [usedToken] access token the failed request was sent with. When the stored token is already a
 *   different one, another request refreshed meanwhile: no call is made, the caller just retries with the new token.
 * @returns {Promise<null | { access_token: string, refresh_token?: string, fresh: boolean }>} null = could not
 *   refresh (stored tokens are left as they are). `fresh` is true when this call reached the server; the rest of the
 *   response body (access fields) is included then.
 */
export function refreshSession(usedToken) {
  const current = tokenStore.getAccess();
  if (usedToken && current && bare(usedToken) !== current)
    return Promise.resolve({ access_token: current, fresh: false });
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = tokenStore.getRefresh();
      if (!refreshToken) return null;
      try {
        const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return null;
        const body = await res.json();
        const access_token = body?.access_token ?? body?.accessToken;
        if (!access_token) return null;
        const refresh_token = body.refresh_token ?? body.refreshToken;
        tokenStore.set({ access_token, refresh_token });
        return { ...body, access_token, refresh_token, fresh: true };
      } catch {
        return null;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
