# Changelog — v7.0 → v8.0

v8.0 turns the product into the **client build**: plain React (no Next.js), one organisation owned end to end by
its Super Admin (no separate Seereon console), the team's UI findings fixed, business-flow wiring hardened, and a
reports hub with custom and AI-generated reports. Verification evidence is at the end.

---

## 1. React JS conversion (Next.js removed)

Asked for explicitly: the client deliverable is React JS; Next.js returns only if the SaaS edition needs it.

| Area        | Before (v7)                                                               | Now (v8)                                                                       |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Build       | Next.js 16 App Router, server rendered                                    | Vite 7 single-page app, static `dist/`, code-split per screen                  |
| Routing     | `src/app/**/page.jsx` (98 wrapper files)                                  | `src/routes/manifest.js` — one line per screen — rendered by `AppRouter.jsx`   |
| Navigation  | `next/link`, `next/navigation`                                            | `src/lib/router.jsx` adapter over react-router-dom 7 (same Link/useRouter API) |
| Entry       | `app/layout.jsx` + server metadata                                        | `index.html` + `src/main.jsx`; titles set per route by the router              |
| Env         | `NEXT_PUBLIC_*` via `process.env`                                         | `VITE_*` via `import.meta.env` (`src/config/env.js`, `.env.example`)           |
| Legacy URLs | `next.config.mjs` redirects                                               | the same redirects in `AppRouter.jsx`                                          |
| Headers     | `next.config.mjs` security headers                                        | nginx config inside the new `Dockerfile` (static SPA + SPA fallback)           |
| Deleted     | `src/app/`, `src/proxy.js`, `next.config.mjs`, `@next/eslint-plugin-next` | —                                                                              |

`tools/gen-feature-catalog.mjs` and the e2e route helper now read the manifest instead of `src/app`.
**Conversion proof:** the route matrix (every org/emp/helpdesk screen × 8 roles = 616 combinations) was recorded on
the v7 Next build and re-run on the React build — **0 differences, 0 runtime errors**.

## 2. Architecture: everything under the Super Admin (no SaaS console)

- **Removed:** the Seereon platform console (`/app/*`, `/seereon` sign-in, platform accounts), per-organisation
  login URLs (`/o/<slug>`, subdomains, the workspace finder), tenant billing/validity, support sessions, and the
  Utkal / Kalinga demo tenants. One demo organisation remains — Seereon Group (4 companies, branches, all data
  identical to the approved v6 keys).
- **Organisation Setup** (new screen, Super Admin only): the five-step wizard — organisation type & structure,
  modules & features, organisation details (GST No., PAN, address, contact; only the name required), companies &
  branches (a branch inherits the company's location), review & apply (`setupOrganisation`, additive).
- **Flexible structure:** Group › Companies › Branches › Employees is never mandatory — Group › Companies ›
  Employees, Company › Branches, Company-only all work; companies can grow branches later and an individual
  company becomes a group when a second company is added.
- **Configuration** now has three Super-Admin-owned layers: module selection (setup) → organisation-wide switches →
  **per-company / per-branch switches** (new `tenant.scopeConfig`, scope selector on the Configuration screen,
  enforced for every user of that company/branch via `configScopeIdsFor`).
- **Inter-company transfers** are confirmed by the **group Super Admin** (previously the Seereon console):
  pending requests show Confirm / Reject on Employees → Transfers for the Super Admin, scope-aware.
- Sign-in: one `/login` page (3 tabs), suspended-company and locked-account checks kept, forced password change
  kept; working **Privacy Policy / Terms of Use** dialogs (team finding).
- The scope chip moved from the **header to the sidebar** (team finding: "remove collective-view dropdown in
  header"); Branch Admins see a locked chip.

## 3. Team findings (HRMS1_3.xlsx) — all 27 rows

| # (sheet row)                 | Fix                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure fields              | Setup wizard and Add Company carry GST No., address, city/state; branch location defaults to the company's; only name/code required                                                |
| Sidebar collapse              | Present on all three portals (toggle in each shell)                                                                                                                                |
| Infra master deletes          | `department.manage` is organisation-level — delete buttons for branches, buildings, blocks, floors, departments, designations work from the Super Admin's collective view          |
| Branch activate / deactivate  | New `status` on branches + Activate/Deactivate button; inactive branches leave every picker (`visibleBranches`) but keep their data                                                |
| View & edit branch            | Pencil icon on every branch row → edit dialog (name, city, state, address, head)                                                                                                   |
| Doc master delete             | Delete button per template → System Archive (restorable), restorer registered                                                                                                      |
| PDF template per company      | Template "Entity" is now a company picker; letters pick the employee's company template first (`templatesOf(type, entity)`), and letter values use the employee's own legal entity |
| AI generation / PDF parser    | "Generate with AI" drafts a token-rich letter per document type; "Import PDF / letter" parses an upload into a template draft (dates/amounts tokenised)                            |
| Roles deactivate/delete       | Deactivate/Activate button on each role card; Delete disabled while anyone holds the role                                                                                          |
| Header collective dropdown    | Removed — scope lives in the sidebar                                                                                                                                               |
| Module toggles per company    | Configuration → scope selector (entire organisation / company / branch)                                                                                                            |
| Company card dashboard button | "View dashboard" on every company card (switches scope and opens the dashboard)                                                                                                    |
| Privacy & terms               | Working dialogs on the sign-in page (desktop + mobile)                                                                                                                             |
| Claims attachment view        | `AttachmentViewer` everywhere: claim files and each bill open in a viewer (image/PDF inline)                                                                                       |
| Payroll Finance approve       | Approve / Reject at the approver's level (verified end to end) + **"Send back to HR for correction"** (`sendBackRun`)                                                              |
| Compliance check detail       | Per-employee dialog already names the field and how to fix it; **Error / Warning / Info filters** added to the checks list                                                         |
| Bulk payslips                 | "All payslips (PDF)" — every payslip of the run in one printable document — and a CSV register                                                                                     |
| Salary register filters       | Search + state filter + export (filters already present, state filter added)                                                                                                       |
| Loan actions                  | Approve / Reject / Disburse with the decider and date shown on the row (`approvedBy` / `rejectedBy` / `approvedOn`)                                                                |
| Claims role-based approval    | Already stage-based (`canActionClaim`); the row now names the awaiting stage                                                                                                       |
| Insurance claims              | New: insurance-claims workflow (Pending → Under Review → Approved (admissible amount) / Rejected (reason) → Settled (UTR)), trail + alerts, documents viewable                     |
| Expenditure view              | Explicit "View" button per record → full details, bills, approval history, payment status, outcome; attachments viewable                                                           |
| CV not displayed              | The CV dialog renders the uploaded file inline (PDF/image) above the structured profile; chips open the viewer                                                                     |
| CV & skills mandatory, phone  | Add Applicant requires CV, at least one skill, and a valid Indian phone number                                                                                                     |
| Leave document view           | Supporting documents open from the application timeline and detail dialogs                                                                                                         |
| Expenditure document view     | Same viewer on the booking's attachments                                                                                                                                           |
| Investment download           | Download always delivers the file (captured bytes, else a generated document)                                                                                                      |

**Attachments engine (new, `src/lib/attachments.js` + `AttachmentViewer`):** every file input in the app (29
screens) now captures the file's bytes into a capped browser store; viewers render images/PDFs inline, anything
else downloads; seeded demo files get a clean generated preview. `RecordDetailDialog` renders any file-like field
as viewable chips, which fixed document viewing across leave, claims, expenditure, transfers, cases and more at once.

## 4. Business-flow wiring

- **Custom roles now actually grant access** (gap found while verifying the team's role/task scenario): RBAC screen
  keys map to routes (`SCREEN_ROUTES`), active roles' View grants widen `canOpen`/`canOpenPath` through a new
  navigation-extension hook. Proven by test: an Employee cannot open Claims, the Super Admin creates a role
  granting Reimbursements and assigns it, the Employee can.
- Tasks: create → each assignee sees exactly their own (`/emp/tasks`) → progress update → pending with the
  assigner → approve → applied; announcements reach employee notices — all verified end to end.
- Payroll maker–checker verified in the main company, **including fixing seeded compliance errors through the
  resolve dialog** (UAN / PF member ID), acknowledging warnings, two distinct approval levels, and process.
- Group transfer verified end to end: SAP HR raises → Super Admin confirms → employee moves.

## 5. Reports hub

- The Reports screen opens as a **card catalogue** (team ask): every report available to the role, grouped by
  category, searchable; the existing explorer (packs, FY/date/month filters, CSV/Excel/PDF) opens per card.
- **Custom report builder:** data source → columns → contains-filter → group by any column with Count / Total /
  Average → run, export, **save for reuse** (saved reports appear as cards).
- **AI report:** plain-language prompt → deterministic parser picks the source, grouping, aggregation and filter,
  explains each step ("How this report was built"), renders and exports like any report, and can be saved. The API
  build sends the same prompt to the AI service and receives the same config shape.

## 6. Quality & security

- `process.env` → `import.meta.env` (the old form only worked by accident under Vite); `.env.example` and
  `Dockerfile` (static nginx image with SPA fallback, CSP/`frame-ancestors`, nosniff, referrer and permissions
  policies) updated.
- Dead multi-tenant code removed (platform views, support sessions, billing, slug/login-URL machinery, platform
  accounts, `portal: "app"` branches across 13 files); store keys bumped (`…orgs.v3`, `…organisation.v3`) so stale
  v7 browser data cannot leak in.
- ESLint: **0 errors, 14 warnings** — the same pre-existing hook-dependency warnings as the v6/v7 baseline, none in
  new code.

## 7. Verification (all against the production build)

| Check                                                                  | Result                                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run build`                                                        | ✓                                                                                      |
| Route matrix — every screen × 8 roles (`tests/route-matrix.mjs`)       | 624 combinations · **0 runtime errors**; v7→v8 behaviour diff on shared screens: **0** |
| `tests/tenancy-flows.mjs` (sign-in, scope, isolation, config 3 layers) | **24/24**                                                                              |
| `tests/setup-flows.mjs` (setup wizard, admin issue, branch lifecycle)  | **13/13**                                                                              |
| `tests/business-flows.mjs` (leave, payroll maker–checker, transfer)    | **22/22**                                                                              |
| `tests/wiring-flows.mjs` (roles grant access, tasks, announcements)    | **13/13**                                                                              |
| Playwright `sign-in` + `smoke` (desktop & mobile projects)             | **92/92**                                                                              |
| Playwright `responsive` — every screen at 360 / 390 / 768 px           | **246/246**, no horizontal overflow                                                    |

Open items for the backend team are listed in [ORG_ARCHITECTURE.md](ORG_ARCHITECTURE.md) §6.
