> **Historical.** v7.0's multi-tenant SaaS architecture (Seereon console, login URLs, billing, support sessions)
> was superseded by the single-organisation client build in v8.0 — see [CHANGELOG_v8.md](CHANGELOG_v8.md) and
> [ORG_ARCHITECTURE.md](ORG_ARCHITECTURE.md). References below to docs/MULTI_ORG_ARCHITECTURE.md describe the v7 tree.

# Seereon HRMS Web — v7.0 change log (from the approved v6.0)

**Scope of the release:** the multi-organisation architecture (Seereon master console → client organisations →
companies → branches → employees), configurable entitlements at two layers, per-organisation login URLs, three demo
organisations, and the business-flow and security gaps found while verifying it.

**Module screens were not redesigned.** Where a module file was touched, the change is one of the categories below and
is listed file by file.

---

## 1. Verification

| Check                                                                                                                                              | Result                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Production build (`next build`)                                                                                                                    | passes                                     |
| Lint                                                                                                                                               | 0 errors, 14 warnings (v6.0 had 15)        |
| **Route matrix vs untouched v6.0** — 9 Seereon roles × every screen (631 combinations)                                                             | **0 access differences, 0 runtime errors** |
| Route matrix — 10 users of the new organisations + Seereon Branch Admin (770 combinations)                                                         | 0 runtime errors                           |
| `tests/tenancy-flows.mjs` — login URLs, cross-organisation refusal, isolation, collective view, Branch Admin lock, entitlements                    | 26 / 26                                    |
| `tests/console-flows.mjs` — Seereon creates a group with the wizard, its Super Admin signs in at the new URL, support session + audit              | 17 / 17                                    |
| `tests/business-flows.mjs` — Kalinga: leave apply → manager approve → employee; branch scoping; isolation; payroll maker → Payroll Admin → Finance | 17 / 17                                    |
| `tests/e2e/sign-in.spec.js` (Playwright, desktop + mobile)                                                                                         | 20 / 20                                    |
| New screens at 360 px and 768 px                                                                                                                   | no horizontal overflow                     |

Re-run: `npm run build && npm start`, then `node tests/tenancy-flows.mjs http://127.0.0.1:3000` (same for the other
scripts) and `BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/sign-in.spec.js`.

---

## 2. New

| Area                                                                             | Files                                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Client organisations, scope, entitlements, data namespaces, support sessions     | `src/features/organization/data/tenancy.js`                                                                   |
| Demo organisations (Utkal EduTech, Kalinga Minerals) and Seereon Branch Admin    | `src/features/organization/data/demo-tenants.js`                                                              |
| Feature catalog (module → screen → tab → action), org-type templates, structures | `src/features/platform/data/feature-catalog.js`, `feature-tabs.generated.js`, `tools/gen-feature-catalog.mjs` |
| Entitlement tree (ceiling + configuration)                                       | `src/features/platform/components/EntitlementTree.jsx`                                                        |
| Login URL, master sharing, billing, support panels                               | `src/features/platform/components/TenantPanels.jsx`                                                           |
| Companies, branches and admins (console + client)                                | `src/features/organization/components/TenantStructure.jsx`                                                    |
| Super Admin Configuration screen                                                 | `src/app/(organisation)/org/configuration/page.jsx`, `ConfigurationView.jsx`                                  |
| Workspace sign-in `/o/<slug>`, subdomain rewrite, `/login` finder                | `src/app/(auth)/o/[slug]/page.jsx`, `src/proxy.js`, `FindWorkspaceView.jsx`, `demo-logins.js`                 |
| Collective-view bar and Seereon support bar                                      | `src/components/layout/ScopeGate.jsx`                                                                         |
| Tab gate                                                                         | `src/lib/feature-gate.js`                                                                                     |
| Tests                                                                            | `tests/tenancy-flows.mjs`, `console-flows.mjs`, `business-flows.mjs`, `route-matrix.mjs`                      |

---

## 3. Changed — platform and shell

| File                                                                                                 | Change                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/persist.js`, `lib/shared-list.js`                                                               | Namespace resolver (global / tenant / master per company or group); the Seereon demo keeps v6 keys                                                                |
| `components/ui/tabs.jsx`                                                                             | Tabs switched off in configuration are not rendered                                                                                                               |
| `features/auth/data/auth-session.js`                                                                 | Branch Admin role (nav, actions, summary); access gates in `canOpen` / `canOpenPath` / `can`; `onSessionChange`                                                   |
| `features/auth/data/tenant-users.js`                                                                 | `provisionBranchAdmin`; credentials e-mail carries the organisation's login URL                                                                                   |
| `features/organization/data/group-data.js`                                                           | Demo structure (Seereon Group 4 companies with branches, Utkal, Kalinga); `visibleBranches`; collective view only for multi-company Super Admins; v2 storage keys |
| `components/layout/ScopeSwitcher.jsx`                                                                | Group › Company › Branch chip                                                                                                                                     |
| `components/layout/OrgSidebar.jsx`                                                                   | Collective view leads with Overview / Reports / Group; module groups collapsed and marked view-only; Configuration entry; mobile scope chip; scope-aware badges   |
| `components/layout/OrgShell.jsx`, `EmployeeShell.jsx`, `HelpdeskShell.jsx`, `PlatformShell.jsx`      | Branch scope on load; scope bar; support bar; signed-out visitors go to their workspace login; console accounts kept out of client workspaces                     |
| `OrgTopbar.jsx`, `EmpTopbar.jsx`, `EmpSidebar.jsx`                                                   | Sign-out returns to the organisation's login URL                                                                                                                  |
| `app/providers.jsx`                                                                                  | Registers tenancy and every account source at boot                                                                                                                |
| `features/auth/views/SignInView.jsx`                                                                 | Bound to one workspace; refuses other organisations' accounts; status / subscription checks; Admin tab accepts Branch Admins                                      |
| `ForgotPasswordView.jsx`, `ResetPasswordView.jsx`                                                    | Reset limited to the workspace's accounts; back to the workspace login                                                                                            |
| `app/(auth)/login/page.jsx`                                                                          | Workspace finder                                                                                                                                                  |
| Console: `PlatformOrganizationNewView.jsx`                                                           | New 7-step wizard (type → modules & features → details & login URL → structure → billing → Super Admin → review)                                                  |
| Console: `PlatformOrganizationDetailView.jsx`                                                        | Tabs: Structure, Modules (entitlement tree), Master sharing, Login URL, Billing, Support                                                                          |
| Console: `PlatformOrganizationsView.jsx`                                                             | Client organisation cards; "Open workspace" goes through a recorded support session                                                                               |
| Console sample data: `PlatformAuditLogsView.jsx`, `PlatformNotificationsView.jsx`, `support-data.js` | Point at the current demo organisations                                                                                                                           |
| `organization/components/GroupsWorkspace.jsx`                                                        | "Companies & Branches" uses the shared structure component                                                                                                        |
| `next.config.mjs`                                                                                    | CSP adds `object-src 'none'; base-uri 'self'; form-action 'self'`; HSTS; COOP; DNS-prefetch off                                                                   |
| `.env.example`                                                                                       | `NEXT_PUBLIC_ROOT_DOMAIN`                                                                                                                                         |

---

## 4. Changed — module files (filter lines and gap fixes only)

**A. Scope filter lines** (`x.orgId === orgId` / `scope === "group"` → `inScope(...)` so lists follow
collective / company / branch scope). No UI or business-rule change.

`EmployeesView.jsx` · `CasePieces.jsx` · `RetirementTab.jsx` · `WorkOrdersTab.jsx` · `CompOffApprovalsTab.jsx` ·
`DailyWagesTab.jsx` · `attendance-live.js` · `AnnouncementsView.jsx` · `ArchiveView.jsx` · `project-data.js` ·
`task-data.js` · `AssetsWorkspace.jsx` · `LeaveApplicationsTab.jsx` · `LeaveBalanceTab.jsx` · `TourWorkspace.jsx` ·
`TourOutcomes.jsx` · `PolicyTabs.jsx` · `PayrollTab.jsx` · `PatternsTab.jsx` · `PayslipsTab.jsx` · `FilingsTab.jsx` ·
`ExitsView.jsx` · `GrievanceWorkspace.jsx` · `recruitment-engine.js` · `DashboardView.jsx` · `ExpenditureWorkspace.jsx` ·
`reports-extra.js`

**B. Business-flow gaps fixed**

| File                                                                                                      | Gap                                                                                                                                      | Fix                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `HireEmployeeDialog.jsx`                                                                                  | Branch was inferred from the department; a Super Admin could not choose it                                                               | Explicit Branch field (required when the company has branches; locked for a Branch Admin); manager list from all accounts |
| `EmployeesView.jsx`                                                                                       | Detailed record form filed into the last company used while in collective view; manager list from the seed roster                        | Hidden in collective view (Hire asks company + branch); manager list from all accounts                                    |
| `manager-data.js`                                                                                         | People of Seereon SAP / Cloud / Products had no reporting line → empty "My Team"                                                         | Reporting lines also taken from accounts                                                                                  |
| `hr-partner.js`                                                                                           | HR partner options and lookups only knew the seed roster                                                                                 | Options and fallback from all accounts                                                                                    |
| `notifications-data.js`, `probation-data.js`, `group-transfer-data.js`, `scope.js`, `OffersWorkspace.jsx` | People lookups only knew the Seereon seed roster — empty for new organisations and runtime hires                                         | All accounts                                                                                                              |
| `asset-data.js`                                                                                           | Asset alerts went to Company Admins only (none in single-company clients); finance recovery alerts always went to Seereon's CFO          | Company Admins, else the Super Admin; the asset's company CFO                                                             |
| `exit-data.js`                                                                                            | Resignation without a manager routed to Seereon's Group Super Admin for every organisation                                               | The company's own administrator                                                                                           |
| `hiring-data.js`                                                                                          | New hires of a client got an invented `<name>.com` e-mail; uniqueness ignored issued accounts                                            | Client's own mail domain; uniqueness across all accounts                                                                  |
| `app/providers.jsx`                                                                                       | An account issued at runtime resolved only on screens that imported its module — after a reload it silently became the default demo user | All account sources registered at boot                                                                                    |

**C. Security fixes**

| File                                                                            | Issue                                                                                                           | Fix                                                                        |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `UsersView.jsx`, `RolesNewView.jsx`                                             | A Super Admin listed and could assign roles to every account of every organisation                              | Own organisation, narrowed to scope                                        |
| `GlobalSearch.jsx`, `AIAssistant.jsx`                                           | Collective view searched the whole platform directory (other clients' people, phone numbers)                    | Scope matcher                                                              |
| `EmployeesView.jsx`                                                             | `/org/employees?id=…` opened any employee of any company or organisation                                        | Deep link honoured only inside scope                                       |
| `TaskPieces.jsx`, `ProjectPieces.jsx`, `TrainingTabs.jsx`, `MyTrainingView.jsx` | User-entered links rendered as `href` / `window.open` — a `javascript:` link would run in a colleague's session | `safeUrl()` allows http(s), mailto, tel, in-app paths only                 |
| `brand-config.js`, `export-utils.js`                                            | Brand accent written raw into exported document CSS; inline script JSON could be broken out of                  | Accent must be a hex colour; script JSON escapes `<`                       |
| `OrgShell.jsx`, `EmployeeShell.jsx`                                             | A Seereon console account could open `/org/*` with full Admin rights of the default organisation                | Redirected to the console; client access only via audited support sessions |
| `PlatformOrganizationsView.jsx`, `PlatformOrganizationDetailView.jsx`           | "Impersonate Admin" signed in silently, without reason or trail                                                 | Support session with reason, red bar and audit                             |

---

## 5. Known limits (UI build)

- Data lives in the browser (localStorage). Isolation and permissions here are defence in depth; the backend is the
  authority in API mode (see MULTI_ORG_ARCHITECTURE.md §7 for the contract additions).
- Subdomain workspaces need a wildcard DNS record and `NEXT_PUBLIC_ROOT_DOMAIN`; path URLs work everywhere.
- Support sessions record screens opened, not every field changed; full action-level audit belongs to the API.
- The Seereon demo keeps v6's single designation list per company and one copy of every other master for the group.
