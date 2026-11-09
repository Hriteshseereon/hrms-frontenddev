// Company picker for the per-company masters (departments, designations, roles). Only the Super Admin sees it:
// Company / Branch Admins and employees are already scoped to their own company by the backend.
import { useEffect, useState } from "react";
import Company_api from "@/api/company";
import { useSessionStore } from "@/features/auth/data/session-store";

const isSuperRole = (role) => ["SUPER_ADMIN", "SUPERADMIN"].includes(String(role ?? "").toUpperCase());

/** `{ isSuper, companyId, setCompanyId, companies }` — companyId "" means the whole organisation (list only). */
export function useCompanyScope() {
  const isSuper = useSessionStore((s) => isSuperRole(s.role));
  const companyId = useSessionStore((s) => s.scopeCompanyId) ?? "";
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (!isSuper) return undefined;
    let alive = true;
    Company_api.getCompanies()
      .then((res) => {
        const d = res?.data?.data ?? res?.data ?? [];
        if (alive) setCompanies(Array.isArray(d) ? d : (d.items ?? d.companies ?? []));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isSuper]);

  return {
    isSuper,
    companyId,
    companies,
    setCompanyId: (id) => useSessionStore.setState({ scopeCompanyId: id || "" }),
  };
}

export function CompanyScopeSelect({ scope, allowAll = true, className = "" }) {
  if (!scope.isSuper) return null;
  return (
    <label className={`flex items-center gap-2 text-xs ${className}`}>
      <span className="text-muted-foreground font-medium">Company</span>
      <select
        value={scope.companyId}
        onChange={(e) => scope.setCompanyId(e.target.value)}
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
      >
        {allowAll && <option value="">All companies</option>}
        {!allowAll && !scope.companyId && <option value="">Select a company</option>}
        {scope.companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
