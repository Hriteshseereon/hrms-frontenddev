// Company isolation: the company is no longer picked per screen. A Super Admin works inside one company chosen in the
// header (CompanySwitcher, sent as X-Company-Id); every other role is scoped by the server from the login.
// The hook and select keep their old shape so existing screens compile, but they pick nothing and render nothing.
import { useSessionStore } from "@/features/auth/data/session-store";

/** `{ isSuper, companyId, setCompanyId, companies }` — `isSuper` is false so no per-screen picker is drawn. */
export function useCompanyScope() {
  const companyId = useSessionStore((s) => s.scopeCompanyId) ?? "";
  return { isSuper: false, companyId, companies: [], setCompanyId: () => {} };
}

export function CompanyScopeSelect() {
  return null;
}
