# Seereon HRMS — Web Frontend

HR, payroll, attendance, performance and compliance platform by **Seereon Consulting & IT Services Pvt. Ltd.**
**v8.1** — the finalised single-organisation client build, owned end to end by the organisation's **Super Admin**: organisation
setup (group or company, flexible structure), companies › branches › employees, per-company / per-branch
configuration, and a reports hub with custom and AI-generated reports. See
[docs/USER_FLOWS.md](docs/USER_FLOWS.md), [docs/ORG_ARCHITECTURE.md](docs/ORG_ARCHITECTURE.md) and
[docs/CHANGELOG_v8.1.md](docs/CHANGELOG_v8.1.md). The backend is **seereon-hrms-api** (FastAPI + Django ORM), built
screen by screen from this app — wiring guide: [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md).

This repository is the production frontend: **React 19 (plain JavaScript / JSX) as a Vite single-page app**, styled
with Tailwind CSS 4 and shadcn/ui, responsive from 360 px phones to wide desktops, and ready to be wrapped in a
mobile WebView — the employee portal doubles as the mobile app.

The backend (Python — Django + FastAPI) is built against the contract in [`docs/reference`](docs/reference). Until an
endpoint exists, every screen runs on built-in demo data kept in the browser, so the whole product can be clicked
through end to end today.

---

## Contents

1. [Quick start](#quick-start)
2. [Scripts](#scripts)
3. [Environment variables](#environment-variables)
4. [Tech stack](#tech-stack)
5. [Folder structure](#folder-structure)
6. [How a screen is put together](#how-a-screen-is-put-together)
7. [Data: demo mode and API mode](#data-demo-mode-and-api-mode)
8. [Portals, roles and demo accounts](#portals-roles-and-demo-accounts)
9. [Responsive and mobile](#responsive-and-mobile)
10. [Quality checks](#quality-checks)
11. [Deployment](#deployment)
12. [Documentation index](#documentation-index)

---

## Quick start

Requirements: **Node.js 20.9+** (22 recommended — see `.nvmrc`) and npm.

```bash
npm install
cp .env.example .env.local      # defaults work as-is (demo data, no backend needed)
npm run dev                     # http://localhost:3000  →  /login
```

Sign in at `/login` with a demo account below — Super Admin, Admin (company / branch) or Employee tab.

## Scripts

| Command                           | What it does                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite development server with hot reload on port 3000                                            |
| `npm run build`                   | Production build → static bundle in `dist/` (code-split per screen)                             |
| `npm run preview` / `npm start`   | Serve the production build on port 3000                                                         |
| `npm run lint` / `lint:fix`       | ESLint (React, hooks rules)                                                                     |
| `npm run format` / `format:check` | Prettier (with Tailwind class ordering)                                                         |
| `npm run test:e2e`                | Playwright tests in `tests/e2e` (needs a running build — see [Quality checks](#quality-checks)) |
| `npm run test:responsive`         | Responsive layout test across phone, tablet and desktop widths                                  |

## Environment variables

Copy `.env.example` to `.env.local`. Only `VITE_*` values reach the browser (baked in at build time).

| Variable              | Default                        | Purpose                                               |
| --------------------- | ------------------------------ | ----------------------------------------------------- |
| `VITE_API_BASE_URL`   | `http://localhost:8000/api/v1` | Backend base URL (Django REST / FastAPI gateway)      |
| `VITE_DATA_MODE`      | `mock`                         | `mock` = built-in demo data; `api` = call the backend |
| `VITE_API_TIMEOUT_MS` | `20000`                        | Request timeout                                       |
| `VITE_APP_URL`        | `http://localhost:3000`        | Public URL of this app (links in e-mails)             |

## Tech stack

| Concern       | Choice                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------- |
| Build         | Vite 7 — single-page app, code-split per screen (React.lazy per route)                        |
| Routing       | react-router-dom 7, route table in `src/routes/manifest.js` (one line per screen)             |
| UI            | React 19, JavaScript (JSX), Tailwind CSS 4, shadcn/ui on Radix primitives, lucide-react icons |
| Forms         | react-hook-form + zod (`src/components/ui/form.jsx`)                                          |
| Server data   | TanStack Query (`src/hooks/use-api.js`) over a fetch client (`src/services/api`)              |
| Charts        | Recharts                                                                                      |
| Notifications | sonner (toasts)                                                                               |
| Fonts         | Inter (self-hosted via `@fontsource-variable`) — no third-party requests                      |
| Quality       | ESLint 9 (flat config), Prettier 3, Playwright                                                |

JavaScript only: the data shapes that TypeScript used to describe are kept as **JSDoc `@typedef` blocks** next to
the data they describe, so editors still show field names and types on hover.

## Folder structure

```
seereon-hrms-web/
├── docs/                          Developer documentation (start with docs/ARCHITECTURE.md)
│   └── reference/                 Product docs, API reference, OpenAPI, DB design + SQL, dev flow
├── public/                        Static files (favicon, web manifest, robots.txt)
├── index.html                     SPA entry page (metas, favicon, mounts src/main.jsx)
├── src/
│   ├── main.jsx                   Boot: fonts, global styles, providers, router
│   ├── Providers.jsx              Query cache, theme, toasts; registers data modules at boot
│   ├── globals.css                Tailwind + design tokens + responsive/mobile base styles
│   ├── routes/
│   │   ├── manifest.js            EVERY screen: path → title → view module (single source of truth)
│   │   ├── AppRouter.jsx          Route tree: shells, redirects, titles, 404
│   │   └── AppErrorBoundary.jsx · NotFoundScreen.jsx
│   ├── components/
│   │   ├── ui/                    shadcn/ui primitives (button, dialog, table, tabs …)
│   │   ├── layout/                Portal shells, sidebars, top bars, global search, AI assistant
│   │   ├── common/                Shared building blocks (CrudSection, RecordDetail, AttachmentViewer …)
│   │   └── brand/                 Logo
│   ├── features/                  One folder per business domain
│   │   └── <domain>/
│   │       ├── views/             Full screens referenced by src/routes/manifest.js
│   │       ├── components/        Widgets, tabs, dialogs used by the views
│   │       └── data/              Domain state, seed data, business rules and validations
│   ├── services/api/              HTTP client + endpoint functions generated from the OpenAPI contract
│   ├── hooks/                     Shared React hooks (useApiQuery, useIsMobile …)
│   ├── config/                    Runtime configuration (env.js)
│   └── lib/                       Framework-free utilities (persistence, router adapter, attachments, exports, theme)
├── tests/                         Playwright + flow suites (see Quality checks)
├── tools/                         Code generators (gen-feature-catalog.mjs, gen-route-manifest.mjs)
├── .env.example · eslint.config.mjs · jsconfig.json · vite.config.mjs · postcss.config.mjs · .prettierrc
└── Dockerfile                     Static build served by nginx (SPA fallback + security headers)
```

Domains in `src/features`: `administration`, `assets`, `attendance`, `auth`, `communications`, `dashboard`, `employees`,
`exit`, `finance`, `helpdesk`, `leave`, `organization`, `payroll`, `performance`, `platform` (feature catalog & shared
data), `profile`, `projects`, `recruitment`, `reports`, `timesheets`, `travel`.

The full rules — naming, where new code goes — are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Every URL and the file that renders it: [docs/ROUTES.md](docs/ROUTES.md).

## How a screen is put together

```
src/routes/manifest.js                               ← one line: { path: "/emp/leave", title, load }
  └─ src/features/leave/views/MyLeaveView.jsx        ← the screen
       ├─ src/features/leave/components/*.jsx        ← tabs, dialogs, tables
       └─ src/features/leave/data/leave-data.js      ← state, seed data, rules (→ API later)
```

The portal shell (sidebar, top bar, sign-in and role guard) is attached by the router
(`src/routes/AppRouter.jsx` → `src/components/layout/EmployeeShell.jsx` etc.). Adding a screen = add the view,
add one manifest line, add it to the feature catalog, run `node tools/gen-feature-catalog.mjs`.

## Data: demo mode and API mode

- **Demo mode (default).** Each domain keeps its records in a small store (`createPersistentStore` in
  `src/lib/persist.js`) seeded with Seereon demo data and saved to `localStorage`, so changes survive reloads.
  Clear site data to reset. Uploaded files are captured in the browser too (`src/lib/attachments.js`), so
  attachment viewers and downloads work offline.
- **API mode.** `src/services/api` holds the client (auth header, tenant header, idempotency keys, ETags, error
  normalisation for DRF/FastAPI) and one function per endpoint of the contract, e.g.
  `timeApi.applyLeave(body)` → `POST /leave/applications`. Screens are switched to the API one module at a time.

The step-by-step guide for wiring a module to the backend, with a worked example, is
[docs/API_INTEGRATION.md](docs/API_INTEGRATION.md).

## Portals, roles and demo accounts

| Portal                                     | Address                             |
| ------------------------------------------ | ----------------------------------- |
| Sign in                                    | `/login`                            |
| Organisation / Employee / Helpdesk portals | `/org/*` · `/emp/*` · `/helpdesk/*` |

The demo organisation is **Seereon Group** — four companies (Consulting & IT Services with 4 branches, SAP Practice,
Cloud Services, Products) under one group, so every structure level is exercised.

| Tab                        | Account                                                                                                          | Password                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Super Admin                | `superadmin@seereon.co.in`                                                                                       | `Super@123`                                           |
| Admin (company)            | `admin@seereon.co.in` · `admin@sap.seereon.co.in` · `admin@cloud.seereon.co.in` · `admin@products.seereon.co.in` | `Admin@123`                                           |
| Admin (branch — Pune)      | `pune.admin@seereon.co.in`                                                                                       | `Branch@123`                                          |
| Employee (main company)    | `varen@` HR · `saras@` CFO · `subh@` Manager · `subham@` Employee (`@seereon.co.in`)                             | `Hr@123` · `Cfo@123` · `Manager@123` · `Employee@123` |
| Employee (other companies) | `falguni.rathore@sap.…` HR · `pallavi.chatterjee@cloud.…` Manager · `soumen.ghosh@cloud.…` Employee              | `Falguni@123` · `Pallavi@123` · `Soumen@123`          |

Roles: **Super Admin** (whole organisation; collective view of all companies is read-only for company data; runs
Organisation Setup and Configuration), **Company Admin** (one company), **Branch Admin** (one branch's people
operations), CEO / COO / CFO / CTO / CHRO / HR / HOD / Manager / Employee by role — plus custom roles created in
Roles & Permissions, which genuinely widen what their holders can open. Full role → screen / action matrices:
`docs/reference/PRODUCT_DOCUMENTATION.md`; scope rules: [docs/USER_FLOWS.md](docs/USER_FLOWS.md) §3.

## Responsive and mobile

- Layouts are designed mobile-first and verified at **360, 390, 768, 1024, 1280 and 1440 px** on every screen and
  every tab (`tests/e2e/responsive.spec.js`, `tests/responsive-audit.mjs`): no sideways page scroll, no clipped
  button labels, tables scroll inside their own card, dialogs fit and scroll on small screens.
- Built to run inside a mobile app shell (Capacitor, React Native WebView or an iframe): `viewport-fit=cover`,
  safe-area insets on bars, 16 px form inputs (no iOS zoom), `100dvh` heights, touch-friendly targets, self-hosted
  fonts; `frame-ancestors` is set in the nginx config in the Dockerfile.

Details and a checklist for new screens: [docs/MOBILE_AND_RESPONSIVE.md](docs/MOBILE_AND_RESPONSIVE.md).

## Quality checks

```bash
npm run lint
npm run build && npm run preview &    # production build on :3000
node tests/tenancy-flows.mjs  http://127.0.0.1:3000   # sign-in tabs, scope & isolation, config gates (org / company / branch)
node tests/setup-flows.mjs    http://127.0.0.1:3000   # Organisation Setup wizard, admins issued, branch lifecycle
node tests/business-flows.mjs http://127.0.0.1:3000   # leave, payroll maker–checker, inter-company transfer
node tests/wiring-flows.mjs   http://127.0.0.1:3000   # custom roles grant access, tasks → updates → approval, announcements
node tests/route-matrix.mjs   http://127.0.0.1:3000   # every screen × every role: access + runtime errors
npm run test:e2e                      # Playwright specs (sign-in, smoke, responsive)
```

Run `npx playwright install chromium` once, or point `CHROMIUM_PATH` at an existing Chromium; set `BASE_URL` to test
an already running server.

## Deployment

The build is a static bundle — any web server or static host works. The only requirement is the **SPA fallback**
(unknown paths serve `index.html`).

- **Docker:** `docker build -t seereon-hrms-web . && docker run -p 80:80 seereon-hrms-web`
  (nginx with the SPA fallback and security headers preconfigured).
- **Netlify / Vercel / S3 + CloudFront:** build command `npm run build`, output `dist/`, rewrite all routes to
  `/index.html`.
- Put the app and the API on the same parent domain (e.g. `hrms.example.com` and `api.hrms.example.com`) and allow
  the web origin in the backend's CORS settings (see docs/API_INTEGRATION.md).

## Documentation index

| Document                                                       | For                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md)                       | **User flows & processes** — structures, roles, scope, every business flow step by step      |
| [docs/ORG_ARCHITECTURE.md](docs/ORG_ARCHITECTURE.md)           | v8 organisation model: setup, configuration layers, scope, data namespaces, backend contract |
| [docs/CHANGELOG_v8.md](docs/CHANGELOG_v8.md)                   | Everything changed from v7.0, with the verification results                                  |
| [docs/CHANGELOG_v7.md](docs/CHANGELOG_v7.md)                   | The v6.0 → v7.0 changes (multi-organisation architecture)                                    |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                   | Folder conventions, routing, state, styling                                                  |
| [docs/ROUTES.md](docs/ROUTES.md)                               | Every URL → view file → roles                                                                |
| [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md)             | Connecting screens to the Django / FastAPI backend                                           |
| [docs/MOBILE_AND_RESPONSIVE.md](docs/MOBILE_AND_RESPONSIVE.md) | Breakpoints, patterns, WebView packaging, QA results                                         |
| [docs/CONVERSION_NOTES.md](docs/CONVERSION_NOTES.md)           | What changed from the v5.1 TypeScript prototype                                              |
| [CONTRIBUTING.md](CONTRIBUTING.md)                             | Branching, commits, code review checklist                                                    |
| `docs/reference/PRODUCT_DOCUMENTATION.md`                      | Business flows, roles, validations, data model                                               |
| `docs/reference/API_REFERENCE.md`, `openapi.json`              | REST contract of seereon-hrms-api (850 operations, screen by screen)                         |
| `docs/reference/DATABASE_DESIGN.md`, `schema.sql`              | PostgreSQL 16 schema (339 tables)                                                            |
| `docs/reference/DEVELOPMENT_FLOW.md`                           | Build path for the Django + FastAPI backend: phases, the per-module loop, Definition of Done |

---

© Seereon Consulting & IT Services Pvt. Ltd., Bhubaneswar. Proprietary — not for redistribution.
