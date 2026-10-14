import { forwardRef, useMemo } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from "react-router-dom";

/**
 * Thin routing adapter so the whole app depends on one module, not on a framework.
 *
 * Exposes the small navigation surface the screens use — <Link href>, useRouter(),
 * usePathname(), useSearchParams(), useParams() — implemented over react-router-dom.
 */

/** Anchor-style link. `href` may be a path, ?query, #hash or a full URL (external → plain <a>). */
const Link = forwardRef(function Link({ href = "", prefetch: _prefetch, ...props }, ref) {
  const external = /^[a-z][a-z0-9+.-]*:/i.test(href); // mailto:, https:, tel:, …
  if (external) return <a ref={ref} href={href} {...props} />;
  return <RouterLink ref={ref} to={href} {...props} />;
});

export default Link;
export { Link };

/** Imperative navigation: push / replace / back / forward / refresh. */
export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (to) => navigate(to),
      replace: (to) => navigate(to, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => navigate(0),
      prefetch: () => {},
    }),
    [navigate],
  );
}

/** Current path, e.g. "/org/dashboard". */
export function usePathname() {
  return useLocation().pathname;
}

/** Read-only URLSearchParams of the current URL. */
export function useSearchParams() {
  const [params] = useRouterSearchParams();
  return params;
}

/** Dynamic segment values of the current route, e.g. { id: "TKT-1" }. */
export function useParams() {
  return useRouterParams();
}
