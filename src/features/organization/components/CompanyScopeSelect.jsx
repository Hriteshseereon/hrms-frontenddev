// Company isolation: the company is no longer picked per screen. A Super Admin works inside one company chosen in the
// header (CompanySwitcher, sent as X-Company-Id); every other role is scoped by the server from the login.
// The hook and select keep their old shape so existing screens compile, but they pick nothing and render nothing.
import { useSessionStore } from "@/features/auth/data/session-store";

/**
 * `{ isSuper, companyId, setCompanyId, companies }`. No per-screen picker is drawn (CompanyScopeSelect renders nothing),
 * but `isSuper` is real: screens use it to send `company_id` explicitly, because the server reads the company of a
 * Super Admin request from `company_id`, not from the X-Company-Id header (that header is only honoured by bulk import).
 */
export function useCompanyScope() {
  const companyId = useSessionStore((s) => s.scopeCompanyId) ?? "";
  const role = String(useSessionStore((s) => s.role) ?? "").toUpperCase();
  const isSuper = role === "SUPER_ADMIN" || role === "SUPERADMIN";
  return { isSuper, companyId, companies: [], setCompanyId: () => {} };
}

export function CompanyScopeSelect() {
  return null;
}
