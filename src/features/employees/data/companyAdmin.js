// Rules for the "Make / Remove Company Admin" actions on the employee list. Kept free of React so they can be tested.

const upper = (v) => String(v ?? "").toUpperCase();

/** Only a Super Admin and a Company Admin see the actions (a Branch Admin or employee gets a 403 from the server). */
export function canManageCompanyAdmins(role) {
  const r = upper(role);
  return r === "SUPER_ADMIN" || r === "SUPERADMIN" || r === "COMPANY_ADMIN";
}

/**
 * The company the call goes to.
 * - Company Admin: always their own company (the server answers 404 for any other).
 * - Super Admin: the employee's own company, else the company selected in the header.
 */
export function companyIdFor({ role, sessionCompanyId, scopeCompanyId, employee }) {
  if (upper(role) === "COMPANY_ADMIN") return sessionCompanyId || "";
  return employee?.company_id || scopeCompanyId || "";
}

/** The signed-in person's own row: nobody can take Company Admin access away from themselves. */
export function isOwnRow(employee, sessionUserId) {
  return Boolean(sessionUserId) && Boolean(employee?.user_id) && String(employee.user_id) === String(sessionUserId);
}

/** Server error text for a toast. `detail` is a plain string here; a validation list is joined. */
export function companyAdminErrorMessage(error, fallback = "Could not update Company Admin access.") {
  const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const text = detail.map((d) => d?.msg).filter(Boolean).join("; ");
    if (text) return text;
  }
  return error?.userMessage || error?.message || fallback;
}
