import SuperAdmin_axios from "./SuperAdmin_axios";
import { useSessionStore } from "@/features/auth/data/session-store";

/** Employee-portal self-service endpoints. Everything is scoped by the token — no ids are ever sent. */

export const getMe = async () => (await SuperAdmin_axios.get("/me")).data;

/** `sections` e.g. ["profile","job"]; omit for every section. Identity fields are always included. */
export const getMyRecord = async (sections) =>
  (
    await SuperAdmin_axios.get("/me/record", {
      params: sections?.length ? { sections: sections.join(",") } : undefined,
    })
  ).data;

export const getMyHierarchy = async () => (await SuperAdmin_axios.get("/me/hierarchy")).data;

export const getMyDocuments = async () => (await SuperAdmin_axios.get("/me/documents")).data;

export const uploadMyPhoto = async (file) => {
  const fd = new FormData();
  fd.append("photo", file);
  return (await SuperAdmin_axios.put("/me/photo", fd)).data;
};

export const deleteMyPhoto = async () => (await SuperAdmin_axios.delete("/me/photo")).data;

export const getPasswordPolicy = async () => (await SuperAdmin_axios.get("/auth/password-policy")).data;

export const changeMyPassword = async (body) =>
  (await SuperAdmin_axios.post("/auth/change-password", body)).data;

export const getMySecurity = async () => (await SuperAdmin_axios.get("/me/security")).data;

export const revokeMySession = async (id) =>
  (await SuperAdmin_axios.delete(`/me/sessions/${encodeURIComponent(id)}`)).data;

export const revokeOtherSessions = async () =>
  (await SuperAdmin_axios.post("/me/sessions/revoke-others")).data;

export const getLoginHistory = async (limit = 10) =>
  (await SuperAdmin_axios.get("/me/login-history", { params: { limit } })).data;

/** Replaces the stored tokens after a password change (every other device was signed out server-side). */
export function replaceTokens({ access_token, refresh_token }) {
  if (access_token) {
    localStorage.setItem("super_admin_access_token", access_token);
    localStorage.setItem("access_token", access_token);
  }
  if (refresh_token) {
    localStorage.setItem("super_admin_refresh_token", refresh_token);
    localStorage.setItem("refresh_token", refresh_token);
  }
  useSessionStore.setState({
    ...(access_token ? { accessToken: access_token } : {}),
    ...(refresh_token ? { refreshToken: refresh_token } : {}),
  });
}

/** Clears the session and returns to the login page (this device was signed out, here or remotely). */
export function signOutAndRedirect() {
  useSessionStore.getState().clearSession();
  window.location.assign("/login");
}

/** Flattens a FastAPI-style error into `{ field: message }` (field = last loc segment) plus a general message. */
export function parseApiError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  const fields = {};
  let general = "";
  if (Array.isArray(detail)) {
    detail.forEach((d) => {
      const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
      if (key && key !== "body") fields[key] = d.msg;
      else general = general || d.msg;
    });
  } else if (typeof detail === "string") {
    general = detail;
  }
  if (!general && !Object.keys(fields).length) general = err?.message || "Something went wrong.";
  return { status, fields, general };
}
