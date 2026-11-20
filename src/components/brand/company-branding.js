import { env } from "@/config/env";
import { useSessionStore } from "@/features/auth/data/session-store";

// Platform roles keep the product look everywhere; only people inside a company (admins, employees) get its branding.
const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SUPERADMIN", "MASTER_ADMIN", "MASTERADMIN"]);

/** The backend returns the logo as a path on its own host (/api/v1/companies/{id}/logo); make it absolute. */
const resolveLogoUrl = (url) => {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  try {
    return new URL(url, env.apiBaseUrl).toString();
  } catch {
    return url;
  }
};

/** { logo, color, name } of the signed-in user's company; all null for Super Admin and when signed out. */
export function useCompanyBranding() {
  const role = useSessionStore((s) => s.role);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const logo = useSessionStore((s) => s.companyLogoUrl);
  const color = useSessionStore((s) => s.companyColorCode);
  const name = useSessionStore((s) => s.companyName);
  if (!isAuthenticated || PLATFORM_ROLES.has(String(role ?? "").toUpperCase())) {
    return { logo: null, color: null, name: null };
  }
  return { logo: resolveLogoUrl(logo), color: color || null, name: name || null };
}
