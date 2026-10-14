/**
 * HTTP client for the Seereon HRMS backend (FastAPI routes + Django ORM — seereon-hrms-api).
 *
 * Conventions (see docs/reference/API_REFERENCE.md "Conventions"):
 *  - JSON over HTTPS, base URL from VITE_API_BASE_URL (…/api/v1)
 *  - `Authorization: Bearer <access token>`; one silent refresh on 401 (POST /auth/refresh, rotating refresh token)
 *  - `X-Company-Id` / `X-Branch-Id` — the working scope of a Super Admin / Admin (none = collective, read-only)
 *  - `Idempotency-Key` on money / create commands, `If-Match` for approvals
 *  - errors normalised to ApiError (RFC 7807, DRF and FastAPI bodies)
 */
import { env } from "@/config/env";
import { tokenStore } from "./token-store";
import { ApiError, toApiError } from "./errors";

/**
 * @typedef {Object} RequestOptions
 * @property {Record<string, unknown>} [query] - query-string parameters (undefined / "" are skipped)
 * @property {AbortSignal} [signal]
 * @property {string} [orgId] - Super Admin / Admin: company to act in (X-Company-Id)
 * @property {string} [branchId] - narrow to one branch (X-Branch-Id)
 * @property {string|boolean} [idempotencyKey] - true = generate one
 * @property {string} [ifMatch] - ETag of the record being changed
 * @property {Record<string, string>} [headers]
 * @property {number} [timeoutMs]
 * @property {"json"|"blob"|"text"} [responseType]
 */

let refreshing = null;

function buildUrl(path, query) {
  const url = new URL(env.apiBaseUrl + (path.startsWith("/") ? path : `/${path}`));
  if (query)
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
      else url.searchParams.set(k, String(v));
    }
  return url.toString();
}

async function refreshAccessToken() {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = tokenStore.getRefresh();
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      tokenStore.set(await res.json());
      return true;
    })().finally(() => setTimeout(() => (refreshing = null), 0));
  }
  return refreshing;
}

/**
 * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} method
 * @param {string} path
 * @param {unknown} [body]
 * @param {RequestOptions} [options]
 */
export async function request(method, path, body, options = {}, retried = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? env.apiTimeoutMs);
  if (options.signal)
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });

  const headers = { Accept: "application/json", ...options.headers };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const token = tokenStore.getAccess();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.orgId) headers["X-Company-Id"] = options.orgId;
  if (options.branchId) headers["X-Branch-Id"] = options.branchId;
  if (options.ifMatch) headers["If-Match"] = options.ifMatch;
  if (options.idempotencyKey)
    headers["Idempotency-Key"] =
      options.idempotencyKey === true ? crypto.randomUUID() : options.idempotencyKey;

  let res;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: "include",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new ApiError({
      status: 0,
      code: e?.name === "AbortError" ? "timeout" : "network",
      detail: "Could not reach the server. Check your connection and try again.",
    });
  }
  clearTimeout(timer);

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    if (await refreshAccessToken()) return request(method, path, body, options, true);
  }
  if (res.status === 204) return null;

  const type = res.headers.get("content-type") || "";
  const parsed =
    options.responseType === "blob"
      ? await res.blob()
      : options.responseType === "text"
        ? await res.text()
        : type.includes("json")
          ? await res.json().catch(() => null)
          : await res.text();

  if (!res.ok) throw toApiError(res.status, parsed);
  return parsed;
}

export const api = {
  get: (path, options) => request("GET", path, undefined, options),
  post: (path, body, options) => request("POST", path, body, options),
  put: (path, body, options) => request("PUT", path, body, options),
  patch: (path, body, options) => request("PATCH", path, body, options),
  del: (path, options) => request("DELETE", path, undefined, options),
};

/**
 * Upload a file (multipart POST /files) and return its id, which business requests reference
 * (CVs, leave proofs, bills, insurance documents …). The backend keeps files in object storage.
 * @param {File} file
 * @param {string} [purpose] e.g. "leave-proof", "claim-bill", "cv"
 * @returns {Promise<string>} fileId
 */
export async function uploadFile(file, purpose = "") {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  const res = await api.post("/files", form);
  return res.id;
}
