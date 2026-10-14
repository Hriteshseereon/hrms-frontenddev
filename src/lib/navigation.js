import { useMemo } from "react";
import { useSearchParams } from "@/lib/router";

/**
 * Build a URL from a route pattern and its parts.
 *
 * @example buildHref({ to: "/helpdesk/tickets/[id]", params: { id: "TKT-1" }, search: { tab: "sla" }, hash: "notes" })
 *          // → "/helpdesk/tickets/TKT-1?tab=sla#notes"
 * @param {{ to: string, params?: Record<string, string|number>, search?: Record<string, unknown>, hash?: string }} opts
 * @returns {string}
 */
export function buildHref({ to, params, search, hash }) {
  let path = to;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      path = path
        .replace(`[${k}]`, encodeURIComponent(String(v)))
        .replace(`$${k}`, encodeURIComponent(String(v)));
    }
  }
  const qs = new URLSearchParams();
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      if (v === undefined || v === null || v === "") continue;
      qs.set(k, String(v));
    }
  }
  const q = qs.toString();
  return `${path}${q ? `?${q}` : ""}${hash ? `#${String(hash).replace(/^#/, "")}` : ""}`;
}

/**
 * Read the query string of the current screen as a plain object, optionally normalised by the
 * screen's own `validateSearch(search)` function (defaults, allowed values).
 *
 * Screens that use this hook must be rendered inside <Suspense> (see the page.jsx files).
 * @template T
 * @param {(search: Record<string, string>) => T} [validate]
 * @returns {T}
 */
export function useSearch(validate) {
  const sp = useSearchParams();
  const key = sp.toString();
  return useMemo(() => {
    const raw = Object.fromEntries(new URLSearchParams(key).entries());
    return validate ? validate(raw) : raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
