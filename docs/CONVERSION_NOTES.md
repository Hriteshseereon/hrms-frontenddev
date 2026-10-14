> **Historical** (v5.1 → v6.0). v8.0 later replaced Next.js with a Vite + react-router SPA — see CHANGELOG_v8.md.

# Conversion notes — v5.1 prototype → v6.0 web frontend

The v5.1 prototype (TanStack Start, TypeScript, file routes in `src/routes`) was converted to this repository
(Next.js App Router, JavaScript/JSX, feature folders). Behaviour is unchanged: the same 96 screens, the same
business rules and the same demo data. The twelve end-to-end flow scripts used during the v5.1 audit were run
against both builds and produced the same results.

## What changed

| Area            | v5.1 prototype                                                       | This repository                                                                                                     |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript (`.ts` / `.tsx`)                                          | JavaScript (`.js` / `.jsx`); types kept as JSDoc `@typedef`                                                         |
| Framework       | TanStack Start + TanStack Router, Vite                               | Next.js 16 App Router                                                                                               |
| Routes          | `src/routes/org.leave.tsx` (component in the route file)             | `src/app/(organisation)/org/leave/page.jsx` → `src/features/leave/views/LeaveView.jsx`                              |
| Layout routes   | `org.tsx` with `<Outlet />`                                          | `org/layout.jsx` → `src/components/layout/OrgShell.jsx` with `{children}`                                           |
| Redirect routes | `beforeLoad: throw redirect(...)`                                    | `redirects()` in `next.config.mjs`                                                                                  |
| Links           | `<Link to=… params=… search=…>`                                      | `<Link href=…>` (`buildHref()` for dynamic URLs)                                                                    |
| Navigation      | `useNavigate()` / `useRouterState()`                                 | `useRouter()` / `usePathname()` from `next/navigation`                                                              |
| Query string    | `validateSearch` + `Route.useSearch()`                               | `useSearch(validateSearch)` from `src/lib/navigation.js`                                                            |
| Folders         | `src/lib` (102 flat modules), `src/components/<module>`, `src/pages` | `src/features/<domain>/{views,components,data}`, `src/components/{ui,layout,common,brand}`, `src/lib` for utilities |
| Fonts           | Google Fonts at runtime                                              | Self-hosted (`@fontsource-variable/*`)                                                                              |
| Branding        | "SeerHR"                                                             | "Seereon HRMS"                                                                                                      |
| API layer       | none                                                                 | `src/services/api` — client + 702 generated endpoint functions                                                      |
| Tests           | ad-hoc scripts                                                       | `tests/e2e` (Playwright), route smoke test, responsive audit                                                        |

## Fixes made during the conversion

- **Helpdesk and platform console had no sign-in guard** — a signed-out visitor could open `/helpdesk/*` as the
  default user, and the platform console flashed its layout before redirecting. Both shells now behave like the
  organisation and employee portals.
- **Platform console sidebar covered the screen on phones** — it is now an off-canvas drawer below 1024 px.
- **Helpdesk hydration mismatch** — SLA countdowns were rendered on the server with the server's clock.
- **Dialogs taller than the screen could not be scrolled on phones** — `DialogContent` / `AlertDialogContent` now
  fit the viewport and scroll inside.
- **Tab bars with many tabs spilled out of the page** — `TabsList` scrolls sideways within its own width.
- **Popovers, menus and select lists** are capped to the screen width.
- **Sticky headers** kept working only by accident (`overflow-x: hidden` on `<body>`); now `overflow-x: clip`.
- Mobile/WebView support: `viewport-fit=cover`, safe-area padding on top bars, drawers and the floating assistant,
  `100dvh` heights, no tap delay, no iOS input zoom, larger dialog close button.
- A non-hook function named like a hook (`useProjectsSnapshot`) was renamed; missing React `key` props added.
- Responsive fixes on individual screens found by the audit — see `docs/MOBILE_AND_RESPONSIVE.md`.

## API contract v1.1

Generating the client exposed 141 read endpoints missing from the v1.0 contract (collections with create/update but
no list or get — e.g. `GET /leave/applications`, `GET /payroll/runs`). They were added to
`docs/reference/openapi.json` (`x-added: v1.1`) and listed at the end of `docs/reference/API_REFERENCE.md`.
