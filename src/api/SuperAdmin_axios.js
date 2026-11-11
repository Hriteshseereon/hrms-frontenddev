import axios from "axios";
import { applyScopeRules } from "@/services/api/scope";

// NOTE: Do NOT set a default "Content-Type" here.
// axios sets application/json automatically for plain objects, and the
// browser sets multipart/form-data (with boundary) automatically for FormData.
const SuperAdmin_axios = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

SuperAdmin_axios.interceptors.request.use(
  (config) => {
    // For FormData, remove any Content-Type so the browser can add the
    // correct multipart boundary.
    if (config.data instanceof FormData && config.headers) {
      if (typeof config.headers.setContentType === "function") {
        config.headers.setContentType(undefined);
      } else {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }

    const isLoginRequest =
      config.url?.includes("/auth/super-admins/login") ||
      config.url?.includes("/auth/login");

    // Super Admin login stores a namespaced token. The generic auth flow also
    // uses access_token, so accept it when that flow authenticated this user.
    const token =
      localStorage.getItem("super_admin_access_token") ||
      localStorage.getItem("access_token");

    if (!isLoginRequest && token) {
      config.headers.Authorization = `Bearer ${token.replace(/^Bearer\s+/i, "")}`;
    }

    // Company isolation: Super Admin sends X-Company-Id once a company is picked; everyone else sends no scope.
    return applyScopeRules(config);
  },
  (error) => Promise.reject(error),
);

// Dev only: one console line per API call, so a screen that makes no call (local sample data) stands out.
if (import.meta.env.DEV) {
  SuperAdmin_axios.interceptors.request.use((config) => {
    config._startedAt = Date.now();
    return config;
  });
  const logCall = (config, status, extra = "") =>
    console.debug(
      `[api] ${String(config?.method ?? "get").toUpperCase()} ${config?.url ?? ""} → ${status} (${Date.now() - (config?._startedAt ?? Date.now())} ms)${extra}`,
    );
  SuperAdmin_axios.interceptors.response.use(
    (response) => {
      logCall(response.config, response.status);
      return response;
    },
    (error) => {
      const d = error.response?.data?.detail;
      logCall(error.config, error.response?.status ?? "no response", d ? ` — ${typeof d === "string" ? d : JSON.stringify(d)}` : "");
      return Promise.reject(error);
    },
  );
}

/** Makes the open screen show the "module not available" / "no access" notice (see OrgShell, EmployeeShell). */
function flagAccessError(reason, request, detailText) {
  const info = `${String(request?.method ?? "get").toUpperCase()} ${request?.url ?? ""} — ${detailText}`;
  import("@/features/auth/data/session-store").then((m) =>
    m.useSessionStore.setState({ accessError: { reason, path: window.location.pathname, info } }),
  );
}

/** Re-reads GET /me into the session store (roles, permissions, modules, branch scope). */
function refreshAccess() {
  Promise.all([import("@/api/meApi"), import("@/features/auth/data/session-store")])
    .then(([api, store]) => api.getMe().then((me) => store.useSessionStore.getState().applyMe(me)))
    .catch(() => {});
}

SuperAdmin_axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    // Another device signed this session out: drop the tokens and go to login (no refresh attempt).
    const detail = error.response?.data?.detail;
    const detailText = typeof detail === "string" ? detail : JSON.stringify(detail ?? "");
    if (error.response?.status === 401 && /signed out/i.test(detailText)) {
      import("@/features/auth/data/session-store").then((m) => {
        m.useSessionStore.getState().clearSession();
        window.location.assign("/login");
      });
      return Promise.reject(error);
    }
    // Temporary / reset password: every call but the password ones answers 403 until it is changed.
    if (error.response?.status === 403 && /password change required/i.test(detailText)) {
      // The portal swaps itself for the blocking "Set new password" screen.
      import("@/features/auth/data/session-store").then((m) =>
        m.useSessionStore.setState({ mustChangePassword: true }),
      );
      return Promise.reject(error);
    }
    // Super Admin acted on a company screen without a company: open the picker (see CompanyPickerDialog).
    if (error.response?.status === 400 && /select a company/i.test(detailText)) {
      error.userMessage = "Select a company first";
      import("@/features/auth/data/session-store").then((m) => {
        const s = m.useSessionStore.getState();
        if (String(s.role ?? "").toUpperCase() === "SUPER_ADMIN") m.useSessionStore.setState({ needCompany: true });
      });
      return Promise.reject(error);
    }
    if (error.response?.status === 404) error.userMessage = "Not found";
    if (error.response?.status === 403 && /module not enabled/i.test(detailText)) {
      error.userMessage = "This module is not enabled for this company";
      flagAccessError("module", request, detailText);
      return Promise.reject(error);
    }
    if (error.response?.status === 403 && /permission denied/i.test(detailText)) {
      error.userMessage = "You do not have access to this";
      flagAccessError("permission", request, detailText);
      // Role changes reach the user through /me: pick up whatever was taken away (or given) meanwhile.
      if (!/\/me(?:\?|$)/.test(request?.url ?? "")) refreshAccess();
      return Promise.reject(error);
    }
    const isAuthRequest = /\/auth\/(?:super-admins\/login|login|refresh)/.test(
      request?.url ?? "",
    );
    const refreshToken =
      localStorage.getItem("super_admin_refresh_token") ||
      localStorage.getItem("refresh_token");

    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      isAuthRequest ||
      !refreshToken
    ) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { "Content-Type": "application/json" } },
      );
      const { access_token, refresh_token } = response.data;
      if (!access_token) throw new Error("Refresh response has no access token.");

      const superAdminSession = Boolean(
        localStorage.getItem("super_admin_access_token") ||
          localStorage.getItem("super_admin_refresh_token"),
      );
      const accessKey = superAdminSession
        ? "super_admin_access_token"
        : "access_token";
      const refreshKey = superAdminSession
        ? "super_admin_refresh_token"
        : "refresh_token";
      localStorage.setItem(accessKey, access_token);
      if (refresh_token) localStorage.setItem(refreshKey, refresh_token);

      // The refresh response carries the current access fields; GET /me confirms them.
      import("@/features/auth/data/session-store").then((m) => m.useSessionStore.getState().applyMe(response.data));
      refreshAccess();

      request.headers = request.headers || {};
      request.headers.Authorization = `Bearer ${access_token}`;
      return SuperAdmin_axios(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default SuperAdmin_axios;