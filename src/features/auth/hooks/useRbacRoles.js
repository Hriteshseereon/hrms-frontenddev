import { useCallback, useEffect, useState } from "react";
import { rbacApi } from "@/api/rbacApi";

/** Role catalog from the database; no browser-seeded role fallback. */
export function useRbacRoles(companyId) {
  const [roles, setRoles] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    rbacApi
      .getRoles(companyId ? { company_id: companyId } : undefined)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.roles ?? [];
        if (mounted) setRoles(Array.isArray(list) ? list : []);
      })
      .catch((error) => {
        console.error("Could not load roles from the server:", error);
        if (mounted) setRoles([]);
      });
    return () => {
      mounted = false;
    };
  }, [companyId, reloadToken]);

  const refresh = useCallback(() => setReloadToken((current) => current + 1), []);
  return { roles, refresh };
}
