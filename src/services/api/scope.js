/**
 * Company context of the logged-in session, readable without importing the session store (the HTTP clients are
 * imported by the store's own dependencies, so a static import would be circular).
 *
 * Only a Super Admin has a selectable company: it goes out as `X-Company-Id`. Company / Branch Admins and employees
 * are scoped by the server from their token and never send any scope.
 */
const SCOPE_KEY = "seereon.scope.company.v1";
const SESSION_KEY = "seereon.auth.session.v1";

const read = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};

/** Role from the persisted login session ("SUPER_ADMIN" | "COMPANY_ADMIN" | "BRANCH_ADMIN" | "EMPLOYEE"). */
export const sessionRole = () => String(read(SESSION_KEY)?.state?.role ?? "").toUpperCase();

export const isSuperAdminRole = (role = sessionRole()) =>
  role === "SUPER_ADMIN" || role === "SUPERADMIN";

/** `{ id, name }` of the company the Super Admin is working in ("" when none). */
export const getScopeCompany = () => {
  const v = read(SCOPE_KEY);
  return { id: v?.id ? String(v.id) : "", name: v?.name ? String(v.name) : "" };
};

export const setScopeCompany = (id, name = "") => {
  try {
    if (id) window.localStorage.setItem(SCOPE_KEY, JSON.stringify({ id, name }));
    else window.localStorage.removeItem(SCOPE_KEY);
  } catch {
    // storage blocked: the in-memory store still holds the choice for this page load
  }
};

/** Calls that belong to the organisation, not to a company — they never carry X-Company-Id. */
const ORG_LEVEL_URL =
  /^\/?(?:super-admin\/companies|companies|org\/(?:dashboard|reports)|auth\/|modules\/catalog)(?:[/?]|$)/;

export const isOrgLevelUrl = (url) => {
  const path = String(url ?? "").replace(/^https?:\/\/[^/]+(?:\/api\/v\d+)?/, "");
  return ORG_LEVEL_URL.test(path);
};

/**
 * Master-data endpoints (warning types, shifts, leave types …). Scope keys are stripped from their query and body;
 * employee / department / branch fields on other endpoints are real data and stay.
 */
const MASTER_DATA_URL =
  /^\/?(?:warning-types|complaint-types|leave-types|termination-types|performance-indicators|performance\/|attendance\/(?:shifts|patterns|holiday-calendars|workday-configurations)|attendance-and-time\/timesheet-formats|recruitment\/|assets\/asset-types|onboarding\/documents|documents\/policies-circulars)/;

export const isMasterDataUrl = (url) =>
  MASTER_DATA_URL.test(String(url ?? "").replace(/^https?:\/\/[^/]+(?:\/api\/v\d+)?/, ""));

const COMPANY_KEYS = ["company_id", "companyId", "organization_id", "organizationId"];
const BRANCH_KEYS = ["branch_id", "branchId"];

const without = (obj, keys) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || obj instanceof FormData) return obj;
  const out = { ...obj };
  keys.forEach((k) => delete out[k]);
  return out;
};

/** Applies the scope rules to an axios request config (mutates and returns it). */
export function applyScopeRules(config) {
  const url = config.url ?? "";
  if (isOrgLevelUrl(url)) return config;

  const superAdmin = isSuperAdminRole();
  const { id } = getScopeCompany();
  config.headers = config.headers ?? {};
  if (superAdmin && id) config.headers["X-Company-Id"] = id;
  else if (typeof config.headers.delete === "function") config.headers.delete("X-Company-Id");
  else delete config.headers["X-Company-Id"];

  const master = isMasterDataUrl(url);
  // Company / organisation scope never travels as a query parameter; branch filters are kept except on masters.
  config.params = without(config.params, master ? [...COMPANY_KEYS, ...BRANCH_KEYS] : COMPANY_KEYS);
  if (master && /^(post|put|patch)$/i.test(config.method ?? ""))
    config.data = without(config.data, [...COMPANY_KEYS, ...BRANCH_KEYS]);
  return config;
}
