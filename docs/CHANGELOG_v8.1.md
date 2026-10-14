# Changelog: v8.0 → v8.1 (frontend finalised, backend API delivered)

v8.1 is the finalised frontend. It came out of a full audit of every module, sub-module, field, validation and
cross-portal wiring, and it is wired to **seereon-hrms-api v1.0**, the backend built screen by screen from this app.
Screens and routes are the same as v8.0. What changed is correctness, permissions and wiring.

---

## 1. People, organisation, administration and sign-in

- **Sessions:**
  - The session guard (`auth/data/session-guard.js`) ends the session of a suspended, revoked or exited user on their next action.
  - Exited employees can no longer sign in.
- **Managers and roles:**
  - `setManager` keeps the account's reporting manager in sync.
  - `hireableRoles(actor)` limits which roles each role may hire. A Branch Admin hires only Employee, Manager or HOD.
- **Access:**
  - Temporary grants and approved delegations now widen navigation and the approval inbox.
  - RBAC roles are branch-aware. The invite form uses real branches.
- **Branches:** they can be renamed in place. A branch still in use cannot be removed.
- **Approval engine (`actOnApproval`):**
  - Re-checks permission on every decision.
  - One person can sign only one level.
  - Optional levels are skipped.
  - "Rework" goes back to the requester, who resubmits.
  - Goal approvals now pass the acting user, so the check runs on the Goals screen too.
- **Terminations and transfers:**
  - Termination steps are enforced by role.
  - Transfers block self-approval and effective dates in the past.
  - The unused "Entity" transfer type is removed.
- **Add Employee:**
  - Every field on the form is now saved.
  - Pay frequency is Monthly only; the Bi-weekly option is removed.
- **Fixed guards:**
  - re-hire filter
  - reset-password policy length
  - referral "Bonus paid"
  - duplicate promotion
  - delegation self-approval and expiry
- **Announcements:** a real `announcement.manage` action replaces a hard-coded role list. It is held by SuperAdmin, Admin, CEO, CHRO, HR, and the Branch Admin for their own branch. Announcements can never be published from the read-only collective view. The action is also in the module catalogue, so it can be switched per company or branch.
- **Document templates:** the template body, sections, watermark and footer are HTML-escaped when a letter is rendered, not only the token values.

## 2. Time: attendance, leave, timesheets, tours

- **Attendance:**
  - LOP counts only unpaid absences.
  - The attendance month picker defaults to the current month.
  - Missed punch-out handling is added, with a Punch Corrections card.
- **Approval chains:** the requester and anyone who has already acted are refused (`approval-chain.js`).
- **Locked periods:** lock checks run on every attendance and leave write.
- **Leave:**
  - A leave can be withdrawn or cancelled, giving the new status **Cancelled**. Dashboards and reports treat it like Rejected.
  - Every leave type has a balance.
  - Half-day rules, comp-off accrual and master policies are applied.
  - Comp Off is no longer a leave type on the apply form; it has its own redeem flow.
- **Tours:** scope rules, self-approval blocks and attendance marking are fixed. Tours and leave can't overlap.
- **Timesheets:** a rejected entry can be edited and resubmitted. Timesheet formats are saved.

## 3. Payroll and finance

- **Payroll runs:**
  - Send-back clears earlier approvals.
  - Approval levels map to SuperAdmin, Admin, CHRO and HR (payroll), and to CFO and SuperAdmin (finance).
  - The checks NET-NEG, NCP-DIM and LOP-GT-WD cannot be overridden.
  - A company's run locks for that period.
- **Tax:** TDS catches up based on year-to-date tax deducted.
- **Loans:**
  - The EMI schedule is re-based on the disbursement date.
  - Two-stage approval, with an "HR approved" state.
  - A cash/bank picker for recoveries.
  - F&F recovers only Disbursed loans; the rest are cancelled.
- **Statutory:**
  - Filings need three different people.
  - Supplementary filings carry only the deltas.
  - Form 24Q is fixed.
  - The ESI period can be locked.
- **Claims:** the claim workflow records the actor id, so nobody acts twice.
- **Insurance:** amounts are validated, policy validity is respected, and the insurance store is persisted.
- **Bills and expenditure:**
  - Reimbursement bills need receipts and valid dates.
  - Expenditure bookings carry a pre-approval reference.
  - Rejected bookings are left out of totals.
- **Employee tax and pay:**
  - Form 16 issue gates and `annualEarnings()`.
  - Proof-of-investment self-review is blocked, and a locked declaration can't be changed.
  - VPF/NPS changes keep an approved snapshot.
  - The wage structure balances within CTC.

## 4. Performance, exit and recruitment

- **Exit:**
  - Nobody can handle their own exit.
  - `settleFnf` needs Finance approval.
  - F&F is paid only at Final Settlement, with HR and Finance approvals by different people.
  - Retention is blocked after F&F.
  - Finance clearance dues are deducted.
  - Rejoin actually reactivates or rehires the employee.
  - Completing an exit marks the login Exited.
  - The manager decision is bound to the reporting manager; the HR approval refuses whoever made the manager decision.
- **Grievances:** a 7-day close window, a self-handling block, and appeal to the company CHRO.
- **PIP and appraisals:**
  - A PIP can't be closed by its owner and needs a final evaluation.
  - In a staged appraisal the HOD and HR must be different people, and the HR creator can't also approve.
- **Offers:**
  - Custom components are validated and carried into the letter.
  - The offer note is saved.
  - HR previews the candidate portal with `?preview=1`.
  - The welcome mail uses the hiring company.
- **Interviews:** feedback is guarded by stage.

## 5. Work, assets, helpdesk, communications, reports

- **Tasks:**
  - A task update is decided by its assigner or manager, never its poster.
  - Projects are edited only by their manager.
  - The assignee picker is scoped.
- **Asset requests:** the requester can't approve their own request, and asset issues are reviewed under guards.
- **Helpdesk:**
  - The SLA timer pauses while waiting on the requester and restarts from a reopen.
  - Escalation has a null guard.
  - Resolved tickets auto-close.
  - Desk admins, agents, HR and CHRO now see **only their own company's tickets**; only the Super Admin spans the group.
- **Search and reports:**
  - Global search is filtered by permission and scope.
  - Base reports are scoped.
  - Filtered KPIs are labelled.
  - Saved-report delete is restricted to the owner or an admin.
- **Dashboard:**
  - The leave donut includes Cancelled.
  - The trend is scoped.
  - The hiring funnel now uses the real pipeline stages (Applied, Shortlisted, Interviewing, Finalised, Offered, Onboarding). The old names never matched a record, so the chart was always empty.
- **Sidebar:** on mobile it ignores the collapsed state. The expand toggle is always visible, and there is a compact scope switcher.

## 6. Code quality

- **ESLint: 0 errors, 0 warnings.** Down from 13 warnings; the hook dependency issues were fixed, not silenced, except three documented store-trigger cases.
- Prettier-clean. Stale comments were removed, and the dead `Topbar.jsx`, `Sidebar.jsx` and ModuleExplorer fallback were deleted.
- The route matrix no longer lists the removed SaaS console account.

## 7. Backend contract

- **API client:** `src/services/api/endpoints/*.js` is regenerated from seereon-hrms-api: 850 functions in 12 chapters, each listing the screens that use it. It adds a `reportsApi` chapter.
- **HTTP client (`client.js`):**
  - Refreshes tokens through `POST /auth/refresh`.
  - Sends the working scope as `X-Company-Id` / `X-Branch-Id`.
  - Uploads files with multipart `POST /files`.
- **Docs:**
  - `docs/reference/openapi.json` and `docs/reference/API_REFERENCE.md` (screen by screen) replace the old v5.1 `openapi.yaml`.
  - `docs/API_INTEGRATION.md` is rewritten for the real backend.
  - The obsolete `tools/gen-api.py` and `tools/augment-contract.py` are removed. The contract is now generated from the backend (`seereon-hrms-api/tools/gen_api_docs.py`).

## Verification

| Check                                                     | Result                     |
| --------------------------------------------------------- | -------------------------- |
| `npm run lint`                                            | 0 errors, 0 warnings       |
| `npm run build`                                           | ok                         |
| Flow suites: tenancy, setup, business, wiring             | 24/24, 13/13, 22/22, 13/13 |
| Smoke routes                                              | 82 routes, 0 problems      |
| Route matrix (every screen × 8 roles)                     | 0 errors                   |
| Playwright (sign-in, smoke, responsive; desktop + mobile) | 676 passed                 |
| Backend (seereon-hrms-api): pytest                        | 518 passed                 |
