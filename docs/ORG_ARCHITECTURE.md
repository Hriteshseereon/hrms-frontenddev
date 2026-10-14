# Organisation architecture (v8.1)

Seereon HRMS v8 is a **single-organisation client build**: the product is installed for one client organisation and
everything — organisation setup, structure, modules, configuration — is owned by that organisation's **Super Admin**.
There is no separate vendor console; the former Seereon master portal's capabilities now live inside the Super Admin
portal. This document describes how the frontend implements that and what the backend must mirror.

- Business view of the same model: [USER_FLOWS.md](USER_FLOWS.md).
- What changed from v7.0 and why: [CHANGELOG_v8.md](CHANGELOG_v8.md).

---

## 1. The model

```
The organisation  (record in tenancy.js · set up and owned by its Super Admin)
├── Group (optional)  ── holding company (optional, "group level" employees / branches)
│   └── Company (legal entity: payroll, PF, ESI, TDS run here)
│       └── Branch (location; hidden "Head Office" when the company has no branches; Active / Inactive)
│           └── Employees
└── Company (individual organisation)
    └── Branch …
```

| Concept      | Where it lives                                          | Key fields                                                                                                                                    |
| ------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Organisation | `features/organization/data/tenancy.js` → `tenantStore` | `name`, `legalName`, `kind` (group/company), `structure`, `orgType`, `gstin`, `pan`, `entitlements`, `config`, `scopeConfig`, `sharedMasters` |
| Group        | `group-data.js` → `groupsStore`                         | unchanged from v6                                                                                                                             |
| Company      | `group-data.js` → `orgsStore`                           | v6 fields + `branchMode` (`branches`/`none`), `isHolding`, `city`, `state`, `gstin`                                                           |
| Branch       | `org.branches[]`                                        | v6 fields + `hidden` (implicit head office) + `status` (Active / Inactive)                                                                    |
| Account      | `auth-session.js` (+ registered sources)                | v6 fields + `branchId` (Branch Admin)                                                                                                         |

### The four structures

| Key                        | Structure                                | Setup asks for                             |
| -------------------------- | ---------------------------------------- | ------------------------------------------ |
| `group-companies-branches` | Group › Companies › Branches › Employees | companies and their branches               |
| `group-companies`          | Group › Companies › Employees            | companies (each gets a hidden head office) |
| `company-branches`         | Company › Branches › Employees           | branches                                   |
| `company`                  | Company › Employees                      | nothing (hidden head office)               |

The structure is **not mandatory or fixed**: a company without branches can add them later (its head office becomes
a visible branch), and an individual company that adds a second company becomes a group automatically (`addCompany`).
"Employees directly under the group" live in the group's **holding company** (`isHolding: true`,
`ensureHoldingCompany`) — payroll, PF, ESI, PT and TDS are always run by a legal entity.

### Organisation Setup (Super Admin → Organisation Setup)

A five-step wizard (`OrganisationSetupView`): organisation type & structure → modules & features → organisation
details (GST, PAN, address, contact — only the name is required) → companies & branches (a branch inherits its
company's location unless its own is given) → review & apply. `setupOrganisation()` applies everything in one step
and never removes existing companies, branches or data.

---

## 2. Module selection and configuration

`features/platform/data/feature-catalog.js` defines one tree:

```
Module  m:<key>            employee, attendance, leave, payroll, compliance … (core is always on)
└── Screen  s:<route>      /org/employees, /emp/leave …
    └── Feature  t:<route>#<tab>   a tab rendered on that screen
└── Action  a:<key>        payroll.approve, attendance.lock …
```

Screens and tabs are **read from the code** by `tools/gen-feature-catalog.mjs` (which reads
`src/routes/manifest.js`) → `feature-tabs.generated.js`. Run it after adding a screen or a tab.

Three layers decide whether a key is available — all owned by the Super Admin, and a switched-off parent switches
off its children:

1. **Organisation Setup** — `tenant.entitlements = { modules: [...], off: [...] }`: the modules the organisation
   uses at all (edited in the setup wizard).
2. **Organisation-wide configuration** — `tenant.config = { off: [...] }` (Configuration → "Entire organisation").
3. **Per-company / per-branch configuration** — `tenant.scopeConfig = { [companyOrBranchId]: [keys...] }`
   (Configuration → pick the company or branch). A key off for a company is off for every user of that company;
   same per branch.

Locked keys (dashboard, configuration, organisation setup, users & roles, settings, companies & branches,
self-service home) are always on so nobody can lock themselves out.

### Enforcement points (no module code needed)

| Check  | Implemented in                                                               | Effect                                                                             |
| ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Screen | `registerAccessGate({ screen })` → `canOpen` / `canOpenPath` in auth-session | Sidebar, global search, dashboard links hide it; the shell shows Access restricted |
| Tab    | `registerTabGate` → `components/ui/tabs.jsx`                                 | `TabsTrigger` / `TabsContent` render nothing                                       |
| Action | `registerAccessGate({ action })` → `can(role, action)`                       | Buttons gated by `can()` disappear                                                 |

The effective scope for a user is computed by `configScopeIdsFor()`: their own company and branch — or, for the
Super Admin, the company / branch currently being worked in.

### Custom roles widen access

Roles created in **Roles & Permissions** now genuinely grant screens: `rbac-store` maps every RBAC screen key to its
route (`SCREEN_ROUTES`), computes `rbacRoutesFor(userId)` from the user's **active** roles, and registers a
navigation extension (`registerNavExtension` in auth-session) that `canOpen` / `canOpenPath` consult beside the
built-in role matrix. Deactivating a role (status Draft) withdraws the access; a role can only be deleted once no
user holds it.

---

## 3. Working scope

`useScope()` (tenancy.js) returns `{ level: "group" | "company" | "branch", companies, company, branch, readOnly }`.

| Who                             | Default scope                                               | Can switch to               |
| ------------------------------- | ----------------------------------------------------------- | --------------------------- |
| Super Admin of a group          | Collective (all companies) — **read-only** for company data | any company, any branch     |
| Super Admin of a single company | Company (all branches)                                      | any branch                  |
| Company Admin                   | Their company (all branches)                                | any branch of their company |
| Branch Admin                    | Their branch — locked                                       | —                           |
| Everyone else                   | Their company                                               | —                           |

The scope chip lives in the **sidebar** (the header has no scope dropdown). List screens filter records with
`useScopeMatch()`: `inScope(orgId, empId?, branchName?)`.

**Collective view is read-only.** While a group Super Admin looks at all companies, write actions (`can()`) are
refused except organisation-level ones (`role.manage`, `group.manage`, `department.manage` — master data shared by
the group is organisation-level). `ScopeGate` shows a "choose company and branch" bar on module screens. Hire
Employee asks for company and branch explicitly. Deactivated branches stay on the structure screens but leave every
picker (`visibleBranches`).

---

## 4. Data namespaces (frontend demo mode)

`lib/persist.js` and `lib/shared-list.js` resolve every store through a namespace resolver registered by tenancy.js:

| Class                          | Examples                                                                                       | Storage key                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Global                         | sign-in accounts, structure, branding, integrations, attachments                               | unchanged                                                                   |
| Master (per company or shared) | leave types & policy, pay components, salary structures, statutory config, shifts, documents … | shared: `key`; per company: `key#<orgId>` (starts as a copy of the group's) |
| Everything else                | leave, payroll runs, tickets, assets, roles …                                                  | `key` — the organisation's own data                                         |

For each master type the group's Super Admin decides **same across all companies** or **per company**
(`sharedMasters`, Configuration → Master data sharing). Statutory state rules (PT, LWF) always follow each branch's
state. Uploaded files are captured by `lib/attachments.js` (name → bytes) so attachment viewers and downloads work
in the demo; in API mode they move to object storage.

> Frontend enforcement is defence in depth for the demo. In API mode the backend is the authority: every query is
> filtered by company and branch, and the guard triggers in the schema stay in force.

---

## 5. Sign-in

One sign-in page at `/login` with three tabs — **Super Admin**, **Admin** (Company or Branch Admin), **Employee**
(every other role). Checks, in order: account exists → tab matches the role → the account's company is not
suspended (a Super Admin is blocked only when every company is) → account not suspended or locked → password
(failed-attempt counter, lock at the sign-in policy limit). A temporary password forces a password change before
anything else. Privacy Policy and Terms of Use open from the sign-in page.

---

## 6. Backend contract additions

Implemented in **seereon-hrms-api v1.0** — the exact paths are in `docs/reference/API_REFERENCE.md` (screen by
screen) and `docs/reference/openapi.json`; the table below is the original design brief they were built from. The
working scope header is `X-Company-Id` (+ optional `X-Branch-Id`).

| Resource            | Endpoints (proposed)                                                     | Notes                                                                  |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Organisation        | `GET /organisation`, `PUT /organisation` (Super Admin)                   | profile, kind, structure, orgType, gstin, pan, contact                 |
| Organisation setup  | `POST /organisation/setup`                                               | applies the wizard in one transaction; additive for structure          |
| Module selection    | `PUT /organisation/entitlements`                                         | `{ modules: [], off: [] }`                                             |
| Configuration       | `GET/PUT /organisation/configuration`                                    | org-wide `off` + per-scope `{ targetId: [keys] }`; Super Admin only    |
| Master sharing      | `PUT /organisation/master-sharing/{type}`                                | `{ shared: bool }`; per-company copies created on first write          |
| Companies           | `POST /companies`                                                        | `branchMode`, `isHolding`, `gstin`, location; converts company → group |
| Branches            | `POST/PATCH /organizations/{orgId}/branches/{branchId}`                  | edit in place; `status` Active/Inactive; inactive leaves pickers       |
| Branch Admin        | `POST /organizations/{orgId}/branches/{branchId}/admins`                 | role `BranchAdmin`, `branch_id` on the user                            |
| Group transfers     | `POST /group-transfers`, `POST /group-transfers/{id}/confirm` / `reject` | raised by company HR/Admin; confirmed by the group Super Admin         |
| Custom roles        | existing RBAC endpoints                                                  | role screens must widen the holder's navigation (see §2)               |
| Insurance claims    | `GET/POST /insurance-claims`, `POST /insurance-claims/{id}/{review       | approve                                                                | reject | settle}` | approved amount, rejection reason, settlement UTR, trail |
| Payroll send-back   | `POST /payroll-runs/{id}/send-back`                                      | approver returns the run to Draft with remarks (beside approve/reject) |
| Payslip bundle      | `GET /payroll-runs/{id}/payslips.pdf` / `.csv`                           | bulk export of a run's payslips                                        |
| Custom / AI reports | `GET/POST /reports/custom`, `POST /reports/ai` (prompt → report config)  | config shape: source, columns, filter, groupBy, agg, aggCol            |
| Attachments         | `POST /files`, `GET /files/{id}`                                         | every upload (CV, leave proof, bills, insurance docs) and its viewer   |
| Catalog             | `GET /catalog`                                                           | generated from the same module → screen → tab → action tree            |

Schema notes: single-organisation deployment (one `organisations` root row); `organisation_config_off`,
`organisation_scope_config(target_id, key)`, `master_sharing`, `organizations.branch_mode`, `organizations.is_holding`,
`organizations.gstin`, `organization_branches.hidden`, `organization_branches.status`, `users.branch_id`,
role `BranchAdmin`, `insurance_claims`, `custom_reports`. The v7 multi-tenant tables (tenants, billing, support
sessions, login slugs) are **not needed** in this client build; they return when the SaaS edition is revived
(see CHANGELOG_v7.md for that contract).
