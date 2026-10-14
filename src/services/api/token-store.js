/**
 * Access / refresh token storage for API mode.
 * Access token lives in memory; the refresh token in sessionStorage (cleared when the tab closes).
 * If the backend issues the refresh token as an HttpOnly cookie instead, leave `refresh` unset —
 * the client sends cookies with `credentials: "include"`.
 */
const REFRESH_KEY = "seereon.api.refresh";
let access = null;
const listeners = new Set();

export const tokenStore = {
  getAccess: () => access,
  getRefresh: () =>
    typeof window === "undefined" ? null : window.sessionStorage.getItem(REFRESH_KEY),
  /** @param {{ accessToken?: string, refreshToken?: string }} t */
  set(t) {
    access = t.accessToken ?? access;
    if (typeof window !== "undefined" && t.refreshToken)
      window.sessionStorage.setItem(REFRESH_KEY, t.refreshToken);
    listeners.forEach((l) => l());
  },
  clear() {
    access = null;
    if (typeof window !== "undefined") window.sessionStorage.removeItem(REFRESH_KEY);
    listeners.forEach((l) => l());
  },
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
