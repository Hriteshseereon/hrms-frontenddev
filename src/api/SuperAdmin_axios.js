import axios from "axios";

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

    return config;
  },
  (error) => Promise.reject(error),
);

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

      request.headers = request.headers || {};
      request.headers.Authorization = `Bearer ${access_token}`;
      return SuperAdmin_axios(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default SuperAdmin_axios;