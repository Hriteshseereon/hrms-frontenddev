/**
 * Access / refresh token storage for API mode.
 * Access token lives in memory; the refresh token in sessionStorage (cleared when the tab closes).
 * If the backend issues the refresh token as an HttpOnly cookie instead, leave `refresh` unset —
 * the client sends cookies with `credentials: "include"`.
 */
const REFRESH_KEY = "seereon.api.refresh";
let access = null;
const listeners = new Set();

function browserToken(...keys) {
  if (typeof window === "undefined") return null;
  for (const key of keys) {
    const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export const tokenStore = {
  // The established login flows store snake_case tokens in localStorage. Keep the
  // in-memory slot for API refreshes, but bridge it to the same session.
  getAccess: () => access || browserToken("access_token", "super_admin_access_token"),
  getRefresh: () => browserToken(REFRESH_KEY, "refresh_token", "super_admin_refresh_token"),
  /** @param {{ accessToken?: string, refreshToken?: string, access_token?: string, refresh_token?: string }} t */
  set(t) {
    const accessToken = t.accessToken ?? t.access_token;
    const refreshToken = t.refreshToken ?? t.refresh_token;
    if (accessToken) access = accessToken;
    if (typeof window !== "undefined") {
      if (accessToken) window.localStorage.setItem("access_token", accessToken);
      if (refreshToken) {
        window.sessionStorage.setItem(REFRESH_KEY, refreshToken);
        window.localStorage.setItem("refresh_token", refreshToken);
      }
    }
    listeners.forEach((l) => l());
  },
  clear() {
    access = null;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(REFRESH_KEY);
      for (const key of ["access_token", "super_admin_access_token", "refresh_token", "super_admin_refresh_token"])
        window.localStorage.removeItem(key);
    }
    listeners.forEach((l) => l());
  },
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
