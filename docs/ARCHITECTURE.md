# Architecture and conventions

This is the working agreement for the Seereon HRMS frontend. When in doubt, follow what the existing code does and
keep new code in the same shape.

## 1. Big picture

```
Browser ──► React SPA (Vite + react-router)
              │  src/routes/manifest.js     one line per screen: path → title → view module
              │  src/routes/AppRouter.jsx   shells (sidebar, top bar, sign-in + role guard), redirects, titles
              ▼
            src/features/<domain>/views     screens (lazy-loaded per route)
              ├─ components                 dialogs, tabs, tables, widgets
              └─ data                       state + business rules  ──►  src/services/api  ──►  Django / FastAPI
```

- **One bundle per screen.** Every route lazy-loads its view, so navigating loads only what that screen needs;
  the build emits a code-split chunk per screen.
- **The manifest is the route table.** Adding a screen is one line in `src/routes/manifest.js`; the router wires
  the shell, the browser-tab title and the lazy import. `tools/gen-feature-catalog.mjs` and the e2e specs read the
  same manifest, so the catalogue and the tests can never drift from the real routes.
- **Business logic is framework-free.** Validations, workflows, calculations (payroll engine, TDS, leave balances,
  approval chains) live in `features/<domain>/data/*.js` as plain functions, so they are unit-testable and reusable
  when the backend takes over.

## 2. Folder rules

| Put it in                           | When it is                                                             | Examples                                                |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `src/routes/manifest.js`            | A URL. One line: path, title, view import                              | `{ path: "/emp/leave", … }`                             |
| `src/routes/AppRouter.jsx`          | Chrome shared by a URL subtree (shells, nested layouts)                | portal shells, recruitment step bar                     |
| `src/features/<domain>/views/`      | A complete screen                                                      | `MyLeaveView.jsx`, `PayrollReportsView.jsx`             |
| `src/features/<domain>/components/` | Parts of that domain's screens                                         | `LeaveApplicationsTab.jsx`, `ComplianceCheckDialog.jsx` |
| `src/features/<domain>/data/`       | State, seed data, rules for the domain                                 | `leave-data.js`, `payroll-engine.js`                    |
| `src/components/ui/`                | Design-system primitives (shadcn/ui). Change here → changes everywhere | `button.jsx`, `dialog.jsx`                              |
| `src/components/layout/`            | Portal chrome                                                          | `OrgShell.jsx`, `EmpTopbar.jsx`                         |
| `src/components/common/`            | Cross-domain building blocks                                           | `CrudSection.jsx`, `ScrollTabs.jsx`                     |
| `src/services/api/`                 | HTTP client and endpoint functions                                     | `client.js`, `endpoints/time.js`                        |
| `src/hooks/`                        | Reusable React hooks not tied to one domain                            | `use-api.js`, `use-mobile.js`                           |
| `src/lib/`                          | Utilities with no domain knowledge                                     | `persist.js`, `export-utils.js`, `utils.js`             |
| `src/config/`                       | Configuration read from the environment                                | `env.js`                                                |

Routes are grouped by portal prefix (`/org`, `/emp`, `/helpdesk`) — the router attaches the matching shell.

A feature may import from `components/*`, `lib/*`, `hooks/*`, `services/*` and from another feature's `data/`.
Avoid importing another feature's `views/`; lift shared parts into `components/common` instead.

## 3. Naming

| Thing                | Convention                                                                    | Example                            |
| -------------------- | ----------------------------------------------------------------------------- | ---------------------------------- |
| React component file | PascalCase `.jsx`                                                             | `LeaveBalanceTab.jsx`              |
| Screen               | `<Name>View.jsx`, employee screens start with `My`                            | `LeaveView.jsx`, `MyLeaveView.jsx` |
| Non-React module     | kebab-case `.js`                                                              | `leave-engine.js`                  |
| Hook                 | `use<Thing>` in camelCase                                                     | `useLeaveApplications`             |
| Store                | `<thing>Store` from `createPersistentStore("seereon.<area>.<name>.v1", seed)` | `leaveApplicationStore`            |
| API function         | verb + noun, generated from the contract                                      | `timeApi.applyLeave`               |
| CSS                  | Tailwind utility classes; shared tokens in `globals.css`                      | `bg-card text-muted-foreground`    |

## 4. Routing and navigation

- Links: `import Link from "@/lib/router"` → `<Link href="/org/leave">` (a thin adapter over react-router-dom, so
  screens never import the routing library directly).
- Programmatic: `const router = useRouter()` (`@/lib/router`) → `router.push("/emp/dashboard")`.
- Dynamic URLs and query strings: `buildHref({ to: "/helpdesk/tickets/[id]", params: { id }, search: { tab } })`
  from `src/lib/navigation.js`.
- Reading the query string in a screen: `useSearch(validateSearch)` from `src/lib/navigation.js`.
- Route parameters: `useParams()` from `@/lib/router`.
- Legacy URLs are redirected in `src/routes/AppRouter.jsx` (`REDIRECTS`).

## 5. Sign-in, roles and tenancy (frontend side)

- The session lives in `src/features/auth/data/auth-session.js` (`signIn`, `signOut`, `useCurrentUser`,
  `useIsSignedIn`, `useHydrated`).
- Each portal shell redirects signed-out visitors to `/login` and shows **Loading your workspace…** until the
  browser session is known, so the server never renders one user's screen for another.
- Screen access by role: `canOpenPath(role, pathname)`; actions by role: `can(role, "payroll.approve")`.
  These mirror the backend authorisation rules and must stay in sync with them.
- Company scope: `useActiveOrgId()` / `useViewScope()` in `features/organization/data/group-data.js`. A Super Admin
  can look at the whole group or one company; everyone else is locked to their own company.

## 6. State

- Domain state uses the store pattern in `src/lib/persist.js`:
  `store.use()` in components (reactive), `store.get()` / `store.set(fn)` in commands.
  The server render always uses the seed; the browser copy takes over after hydration (`useHydrated()`).
- UI-only state stays in the component (`useState`).
- Server data, once a module is on the API, goes through TanStack Query (`useApiQuery`, `useApiMutation` in
  `src/hooks/use-api.js`) — never cache API data in a persistent store.

## 7. Styling

- Tailwind CSS 4 with design tokens in `src/globals.css` (`--primary`, `--gold`, `--card` …). Use tokens, never
  raw hex colours, so dark mode and client branding keep working.
- Use the primitives in `components/ui` (Button, Dialog, Table, Tabs, Select …) rather than styling raw elements.
- Mobile-first: write the phone layout first, then add `sm:` / `md:` / `lg:` variants. Rules and patterns:
  [MOBILE_AND_RESPONSIVE.md](MOBILE_AND_RESPONSIVE.md).
- Dark mode: the `.dark` class on `<html>`; every token has a dark value.

## 8. Types without TypeScript

Data shapes are documented with JSDoc next to the data:

```js
/**
 * @typedef {Object} LeaveApplication
 * @property {string} id
 * @property {string} employeeId
 * @property {"Pending" | "Approved" | "Rejected" | "Cancelled"} status
 */
```

VS Code picks these up for autocomplete. For stricter checking in a file, add `// @ts-check` at the top.

## 9. Adding a new screen — checklist

1. Data: add or extend `src/features/<domain>/data/<thing>-data.js` (seed + store + rules), or call `services/api`.
2. View: `src/features/<domain>/views/<Name>View.jsx` starting with `"use client"` and `export default`.
3. Route: one line in `src/routes/manifest.js` (path, title, view import); then `node tools/gen-feature-catalog.mjs`.
4. Navigation: add the entry to the portal sidebar (`OrgSidebar.jsx` → `ORG_NAV_GROUPS`, or `EmpSidebar.jsx`) and
   to the role matrix in `auth-session.js` (`ROLE_NAV` / `ROLE_EMP_NAV`).
5. Check it at 360 px and 1440 px (`node tests/responsive-audit.mjs --only=/your/route`).
6. Add the row to `docs/ROUTES.md`.
