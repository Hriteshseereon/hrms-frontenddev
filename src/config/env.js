/**
 * Runtime configuration read from VITE_* variables (see .env.example).
 * Only VITE_* values are statically replaced by the bundler and available in the browser.
 */
const meta = import.meta.env ?? {};

export const env = {
  /** Base URL of the backend API (Django REST / FastAPI), without trailing slash. */
  apiBaseUrl: (meta.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/+$/, ""),
  /** "mock" = built-in demo data kept in the browser; "api" = call the backend. */
  dataMode: meta.VITE_DATA_MODE === "api" ? "api" : "mock",
  /** Request timeout in milliseconds. */
  apiTimeoutMs: Number(meta.VITE_API_TIMEOUT_MS || 20000),
  /** Public URL of this web app. */
  appUrl: meta.VITE_APP_URL || "http://localhost:3000",
};

export const isApiMode = () => env.dataMode === "api";
