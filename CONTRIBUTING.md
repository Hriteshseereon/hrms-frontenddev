# Contributing

## Branches and commits

- `main` is always deployable. Work on short-lived branches: `feat/leave-api`, `fix/payslip-rounding`, `chore/deps`.
- Conventional commits: `feat(leave): list applications from the API`, `fix(ui): dialog footer wraps on phones`.
- Rebase on `main` before opening a pull request; squash-merge; delete the branch.

## Before you open a pull request

```bash
npm run lint
npm run format:check
npm run build
```

and open every screen you touched at **360 px and 1440 px** (browser dev tools, or
`node tests/responsive-audit.mjs --only=/your/route` against a running build).

## Review checklist

- **Structure** — route in `src/app`, screen in `features/<domain>/views`, parts in `components`, rules in `data`.
- **Client boundary** — interactive files start with `"use client"`; `page.jsx` / `layout.jsx` stay server components.
- **Tokens, not colours** — Tailwind classes from the design tokens (`bg-card`, `text-muted-foreground`); no hex.
- **Responsive** — mobile-first classes; tables inside `overflow-x-auto`; long IDs `whitespace-nowrap`; button rows
  `flex-wrap`; dialogs use `DialogContent` (it already fits and scrolls on phones).
- **Access** — new screens added to `ROLE_NAV` / `ROLE_EMP_NAV`; actions checked with `can(role, "…")`.
- **Tenancy** — reads filtered by `useActiveOrgId()`; new records stamped with the active organisation.
- **API** — calls go through `src/services/api`; no `fetch` in components; errors shown from `ApiError.detail` /
  `fieldErrors`.
- **Money and dates** — money as strings/decimals from the API, formatted with the shared helpers; business dates
  in Asia/Kolkata (`todayLocal()` style helpers, never `toISOString().slice(0, 10)`).
- **No secrets or personal data in logs** — PAN, Aadhaar, bank account, salary.
- **Docs** — new route added to `docs/ROUTES.md`; contract changes regenerated with `tools/gen-api.py`.
