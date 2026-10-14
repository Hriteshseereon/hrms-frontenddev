# Seereon HRMS — User Flows & Processes

**Version 8.0 · October 2026 · Seereon Consulting & IT Services Pvt. Ltd., Bhubaneswar**

This document explains how Seereon HRMS works end to end: who the users are, how an organisation is set up, what each
person sees, and every business flow in the product, step by step. It is written for two readers:

- **End users and client administrators** — what to do, in what order, and what happens next.
- **Developers and testers** — the exact actors, steps, rules and notifications each flow must honour. Developer
  notes point to where the logic lives.

---

## 1. The product at a glance

Seereon HRMS v8 is installed for **one organisation**, owned end to end by its **Super Admin** — from the
organisation setup (group or company, structure, modules) to companies, branches, employees and configuration.

```
The organisation  (set up and owned by its Super Admin)
├── Group (if the organisation is a group of companies)
│   └── Companies (legal entities — payroll, PF, ESI, TDS run here)
│       └── Branches (locations · can be deactivated)
│           └── Employees
└── or a single Company → Branches → Employees
```

### 1.1 Portals

| Portal                | Address              | Who uses it                                                                          |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| Sign in               | `/login`             | Everyone — Super Admin, Admin and Employee tabs                                      |
| Organisation portal   | `/org/*`             | Super Admin, Company Admin, Branch Admin, CEO, COO, CFO, CTO, CHRO, HR, HOD, Manager |
| Employee self-service | `/emp/*`             | Every employee (and every administrator for their own records); the mobile app view  |
| Helpdesk              | `/helpdesk/*`        | Every signed-in user                                                                 |
| Candidate link        | `/candidate/<token>` | External candidates accepting an offer                                               |

### 1.2 Roles

| Role                                              | Scope                                                                                                                   | Signs in on     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| **Super Admin**                                   | The whole organisation — all companies, all branches. Organisation setup, structure, configuration, dashboards, reports | Super Admin tab |
| **Company Admin**                                 | One company and all its branches                                                                                        | Admin tab       |
| **Branch Admin**                                  | One branch — its people operations                                                                                      | Admin tab       |
| CEO · COO · CFO · CTO · CHRO · HR · HOD · Manager | Their company; screens and actions by role                                                                              | Employee tab    |
| Employee                                          | Self-service                                                                                                            | Employee tab    |
| Custom roles                                      | Created in Roles & Permissions — grant chosen screens on chosen branches to their holders                               | (holder's tab)  |

---

## 2. Organisation structures

The organisation has one of four structures. The Super Admin picks it in Organisation Setup; it is never a
straitjacket — a company can add branches later, and an individual company that adds a second company becomes a
group automatically.

| #   | Structure                                | Example                                                                                                                                                                 |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Group › Companies › Branches › Employees | **Seereon Group** (the demo) — Seereon Consulting & IT Services (Bhubaneswar HQ, Pune, Mumbai, Chennai), Seereon SAP Practice, Seereon Cloud Services, Seereon Products |
| 2   | Group › Companies › Employees            | A group whose companies each work from one office (a company without branches keeps a hidden head office)                                                               |
| 3   | Company › Branches › Employees           | One company operating from several sites                                                                                                                                |
| 4   | Company › Employees                      | One company, everyone at the head office                                                                                                                                |

**Employees or branches directly under a group.** A group never employs anyone itself — salary, PF, ESI, PT and TDS
are always paid by a legal entity. When a group wants people "at group level", the Super Admin adds the group's
**holding company** (Companies & Branches → _Group-level employees / branches_). It appears as "Group level" in the
scope chip and works like any other company.

**Companies without branches.** Everyone is placed at a hidden _Head Office_. No branch level is shown anywhere. Adding
the first branch later turns the head office into a visible branch, so nobody is left unplaced.

**Deactivated branches.** A branch can be deactivated from Companies & Branches: it keeps its data and stays on the
structure screens (marked Inactive) but leaves every picker — scope chip, hiring, Branch Admin issue — until it is
activated again. A branch with no staff and no admin can be removed outright.

---

## 3. Who sees what — the working scope

The scope chip at the top of the sidebar shows where you are working (the header carries no scope dropdown).

| You are                         | You start in                        | You can switch to           | Writes                                                                                                                                                                           |
| ------------------------------- | ----------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin of a group          | **All companies — collective view** | any company, any branch     | Collective view is **view-only** for company data. Pick a company (and branch) to add or change records. Roles and companies & branches can be managed from the collective view. |
| Super Admin of a single company | The company, all branches           | any branch                  | Allowed                                                                                                                                                                          |
| Company Admin                   | Their company, all branches         | any branch of their company | Allowed                                                                                                                                                                          |
| Branch Admin                    | Their branch (locked)               | —                           | Allowed for their branch                                                                                                                                                         |
| Everyone else                   | Their company                       | —                           | By role                                                                                                                                                                          |

Every list (employees, attendance, leave, tours, assets, payroll runs, exits, grievances, projects, tasks, reports,
dashboards) shows exactly the records of the scope: all companies, one company, or one branch.

**In the collective view** the menu leads with Dashboard, Reports & Analytics, Payroll Reports, Companies & Branches,
Configuration and Administration. Module groups (People, Time & Leave, Payroll & Finance, Performance, Work & Assets)
are collapsed and marked view-only. On a module screen a bar asks _"choose the company and branch it belongs to"_;
**Work here** switches the scope.

### 3.1 Master data across a group

For each master type the group's Super Admin decides: **same across all companies** (one master at group level) or
**per company** (each company keeps its own copy, starting as a copy of the group's).

| Master type                                | Includes                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Designations                               | Job titles                                                                     |
| Leave types & leave policy                 | Leave types, entitlements, holiday calendars                                   |
| Shifts, workday, geofence & IP rules       | Shifts, working days, attendance patterns, half-day / overtime / penalty rules |
| Pay components & payroll policy            | Components, salary structures, statutory configuration, payslip format         |
| Loan & advance policy                      |                                                                                |
| Review cycles & appraisal workflow         | Indicators, cycles, evaluation parameters                                      |
| Exit, F&F, HR policy & case types          | Notice, F&F rules, termination / warning / complaint types                     |
| Documents, handbook & templates            | Document master, letter templates, handbook, awards                            |
| Recruitment masters                        | Career site, interview types, assessment parameters                            |
| Reimbursement categories & insurance plans |                                                                                |
| Approval workflows                         |                                                                                |
| Other masters                              | Asset master, training catalogue, helpdesk set-up, other lists                 |

Statutory state rules (PT, LWF) always follow each branch's state, whatever the sharing setting.

### 3.2 Isolation between companies

A Company Admin, Branch Admin or employee of one company never sees another company's people, records, per-company
masters or accounts — in lists, search, the AI assistant, pickers, approvals or notifications. Only the group
Super Admin (and group-shared masters) crosses company lines.

---

## 4. Organisation setup flows (Super Admin)

### 4.1 Organisation Setup wizard

**Actors:** Super Admin · **Where:** Organisation → Organisation Setup

1. **Organisation type.** _Group of companies_ or _Individual company_, the **structure** (two options each) and
   the **organisation type** (IT & Consulting, Mining & Heavy Industry, Education & Institutes, Manufacturing,
   General — pre-selects modules).
2. **Modules & features.** Switch modules on or off; expand a module to switch individual screens, tabs and
   actions.
3. **Organisation details.** Name (the only required field), legal name, GST No., PAN, registered address, primary
   contact.
4. **Structure.** Companies (name, code, city, GST No.) and their branches; a branch without its own city uses the
   company's location. Existing companies and branches show as _exists_ and are never touched.
5. **Review & apply.** One step applies the profile and module selection and creates whatever does not exist yet.
   Nothing is ever removed from here.

The wizard is pre-filled from the current setup, so it also serves to reshape the organisation later.

### 4.2 Manage the structure day to day

**Where:** Organisation → Companies & Branches (also Master Data → Group, entities & branches)

| Action                           | Detail                                                                                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add company                      | Name + unique code required; legal name, structure (with / without branches), first branch, city/state, GST No., address optional. In an individual company this turns the organisation into a group |
| Group-level employees / branches | Creates the holding company (groups only)                                                                                                                                                            |
| Add branch                       | Location defaults to the company's; a branchless company gets its head office made visible first                                                                                                     |
| View & edit branch               | Pencil on the branch row — name, city, state, address, branch head                                                                                                                                   |
| Activate / deactivate branch     | Power button — an inactive branch leaves every picker but keeps its data                                                                                                                             |
| Remove branch                    | Only when it has no staff and no Branch Admin                                                                                                                                                        |
| View dashboard                   | On every company card — switches the working scope to that company and opens its dashboard                                                                                                           |
| Company Admin / Branch Admin     | Name + login e-mail → temporary password shown once with a ready credentials e-mail (must be changed on first sign-in)                                                                               |

### 4.3 Configuration (modules per organisation, company or branch)

**Actors:** Super Admin · **Where:** Organisation → Configuration

| Tab                          | What it does                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modules & features           | "Applies to" picks the layer: **entire organisation**, one **company** or one **branch**. Switch screens, tabs and actions off for that layer; items off in Organisation Setup, or off at a wider layer, are locked here. Locked essentials (dashboard, configuration, organisation setup, users & roles, settings, companies & branches) cannot be switched off |
| Master data sharing (groups) | §3.1 — one master for all companies, or one per company                                                                                                                                                                                                                                                                                                          |

A switched-off screen disappears from the menu, search and dashboard links and shows _Access restricted_ if opened
directly; a switched-off tab is not shown; a switched-off action's buttons disappear — for every user the layer
covers.

### 4.4 Inter-company transfer

**Actors:** HR / Admin of the source company, the group Super Admin

1. Employees → Transfers → Transfer to Group Company → New Group Transfer (employee, destination company in the
   same group, effective date, new designation, reason, what happens to each issued asset).
2. The request waits for the **group Super Admin's confirmation** (a cross-company move touches two companies'
   records).
3. The Super Admin sees every pending request on the same tab (any scope) with the carry-forward snapshot (group
   joining date, UAN, PAN) and asset plan — **Confirm** or **Reject** with a note.
4. Confirm → assets returned / released; the employee record and login move to the destination company.

**Notifications:** the raiser is alerted on confirm / reject.

## 5. Administrator flows

### 5.1 First sign-in of an issued administrator

1. Open `/login` → **Super Admin** or **Admin** tab → e-mail and temporary password.
2. Forced to _My Profile → Sign-in & security_ to set an own password.
3. Lands on the dashboard — a group Super Admin in the collective view; a Branch Admin locked to their branch.

### 5.2 Company Admin and Branch Admin

- **Company Admin** runs one company: masters (per-company or shared), people, time, payroll, performance, exits,
  assets, reports; can add branches and Branch Admins for the company; sees the company dashboard for all branches
  or one branch. No Configuration or Organisation Setup (Super Admin only).
- **Branch Admin** runs one branch's people operations: employees, team, attendance, leave, timesheets, tours,
  exits, grievances, assets, tasks, projects, training, announcements, reports — all limited to the branch. No
  payroll, statutory compliance, masters, roles, users or settings. New hires are placed in the branch
  automatically.

### 5.3 Work in a company or branch

1. Open the scope chip in the sidebar → choose a company (and optionally a branch), or _All companies — collective
   view_.
2. Or on any module screen in the collective view, use the bar: choose company and branch → **Work here**.

## 6. Sign-in and access flows

### 6.1 Sign in

1. Open `/login`.
2. Choose the tab: **Super Admin**, **Admin** (Company or Branch Admin) or **Employee** (everyone else).
3. Enter e-mail or user ID and password. Checks, in order:
   - the account exists (otherwise _No <organisation> account with that ID / e-mail_);
   - the tab matches the role;
   - the account's company is not suspended (a Super Admin is blocked only when every company is);
   - the account is not suspended or locked;
   - wrong password → failed-attempt counter; locked at the sign-in policy limit.
4. Temporary password → forced to set an own password. Otherwise → organisation or employee dashboard.
5. Sign-out returns to `/login`. Signed-out visitors of any portal page are sent there too.
6. **Privacy Policy** and **Terms of Use** open from the sign-in page (desktop footer and under the form on
   phones).

### 6.2 Forgot / reset password

1. From the sign-in page → _Forgot password?_ → e-mail or employee code (+ optional company code).
2. A 6-digit code is issued, valid 5 minutes (shown on screen in the demo build).
3. Enter the code and a new password meeting the policy → back to sign-in.

## 7. Module business flows

The flows below are unchanged from the approved v6 behaviour, with one rule applied everywhere: **records are created
in the company (and branch) in scope, and lists show the scope**. In the collective view a Super Admin chooses the
company first.

### 7.1 Core — identity, access, approvals, announcements

#### 7.1.1 Design a role

**Actors:** SuperAdmin, Admin, CEO, COO, CHRO

1. Roles & Permissions → Create Role
2. Details (unique name) → branch scope → screens → View/Edit/Delete per screen → assign users per branch → review
3. Save → role Active; the granted screens **actually open** for every assigned user, beside their base role
4. Deactivate / Activate from the role card (a deactivated role stops applying); Delete only when no user holds
   the role (soft — archived, restorable)

**Notifications:** 'Role granted' alert to each newly assigned user

#### 7.1.2 Invite a user / manage an account

**Actors:** SuperAdmin, Admin, CHRO

1. Users & Logins → Invite (unique e-mail, allowed role, entity, branch, optional RBAC roles on branches) — the list shows only this organisation's accounts, narrowed to the working scope
2. Login created with status Invited and must-reset; employee directory record registered
3. Account actions: reset password (temporary), unlock, suspend with reason, reactivate, revoke sessions, MFA, grant / revoke RBAC roles

**Notifications:** Password reset alert; Role granted alert

#### 7.1.3 Temporary access / substitutes / branch access

**Actors:** role.manage holders

1. Grant time-boxed screen permissions to a user on a branch; auto-expires; revoke any time
2. Assign a substitute manager for a period (no overlapping covers)
3. Edit per-branch roles of a user (synced to RBAC role assignments)

#### 7.1.4 Role delegation

**Actors:** Any user with /org/delegation (Admin, HR, CHRO, COO, CEO …)

1. Pick delegator and delegate, modules, level, start/end (no overlap), approval flag
2. Preview exactly which screens/actions the delegate receives
3. Active immediately or Pending Approval → approved/rejected by a third person
4. Revoke; auto-expires after end date

**Notifications:** Delegate alerted on creation/approval; Delegator alerted on rejection

#### 7.1.5 Approval engine

**Actors:** Requesters (modules), Reporting manager, HOD, HR, CFO, CEO, Admin

1. Admin configures one active workflow per request type (levels with approver role, SLA, optional)
2. A module raises a request (raiseApproval) — steps copied from the active workflow
3. Current-level approver approves (advances) / rejects / requests rework with remarks; override roles SuperAdmin/Admin/CEO/CHRO
4. Last approval → Approved

#### 7.1.6 Soft delete & archive

**Actors:** Admin, HR, CFO, COO, CHRO

1. Deleting masters, roles, announcements, geofences → archived_records with payload
2. Archive screen (entity-scoped) → restore to origin or purge
3. Retention: purge records older than autoDeleteDays each time the screen opens or on demand

#### 7.1.7 Announcements

**Actors:** holders of `announcement.manage` — Super Admin, Admin, CEO, CHRO, HR; Branch Admin for their own branch
(publish / retract); Employees (read/ack)

1. Publish (type, subject, validity, attachment) into the active company — never from the read-only collective view
   (which lists every company's announcements)
2. Every employee of the entity gets an alert; notices page shows own entity only
3. Employees download / acknowledge; HR tracks acknowledged / pending / overdue
4. Retract → archive (restorable)

**Notifications:** Alert to every employee of the entity

#### 7.1.8 Branding & personalisation

**Actors:** SuperAdmin, Admin (branding), Every user (personalisation)

1. Settings → Branding: palette (presets, hex, radius), logo, tagline, footer — applied system-wide and on PDFs
2. Organisation profile (legal/display name, address, contacts) → brand + entity record
3. My Profile → Personalisation: photo/avatar, font, light/dark, wallpaper with blur/dim/glass

### 7.2 People — employees, recruitment, masters, documents

#### 7.2.1 Recruit to hire (end-to-end)

**Actors:** HR, Interview panel, Candidate, New hire

1. HR publishes a job post (Step 1) — entity-scoped
2. Applicants arrive (portal/referral/manual) — duplicates per job rejected; a manually added applicant needs a
   CV, at least one skill and a valid phone number, and the uploaded CV opens from the candidate's CV dialog
3. ATS 'Run shortlisting' scores and auto-shortlists ≥ cut-off, or manual shortlist
4. Schedule interview (online link / venue, panel, date ≥ today)
5. Panel records feedback + weighted scorecard → Proceed / Hold / Reject / Fit for the job
6. 'Fit for the job' finalises; HR composes offer (template + editable salary structure) and sends it
7. Candidate opens /candidate/{token}, e-signs (typed name), uploads mandatory documents, submits
8. HR verifies each document, marks all verified
9. HR picks reporting manager and sends the welcome e-mail → NewHire + Employee row + login (Welcome@<id-last4>), applicant → Onboarding, referral → Hired
10. New hire signs in on the Employee tab; HR marks Joined

**Notifications:** Offer e-mail / reminder with candidate link; Docs query e-mail on rejected document; Welcome e-mail with credentials; Referrer alert on Hired

#### 7.2.2 Offer declined / expired

**Actors:** Candidate, System

1. Candidate declines with a reason (or uses the link after expiry)
2. Offer → Declined / Expired
3. Applicant Offered → Rejected with reason (event or reconciliation on load)

**Notifications:** History entry on offer and applicant

#### 7.2.3 Direct hire / record form

**Actors:** HR, Admin

1. Hire/Re-hire dialog (re-hire search) or detailed record form — choose the **company and branch** (required when the company has branches; fixed for a Branch Admin; the detailed form is used inside a company scope)
2. Validation (KYC, bank, dates, e-mail uniqueness across the platform; work e-mail on the client's own domain)
3. hireEmployee → directory row, login, work config, manager + HR partner, statutory ids and bank persisted
4. Toast shows login + temporary password

**Notifications:** (toast) credentials

#### 7.2.4 Promotion / increment

**Actors:** HR (maker), HR approver, Unit head (CEO/COO/CFO/CTO/CHRO/Admin)

1. HR raises case (not for self; one open case per employee) — draft or submit
2. HR step approval
3. Unit Head approval by a different person
4. HR makes it effective → CTC, grade, designation, manager/branch updated; letter generated; employee alerted

**Notifications:** Employee alert 'Promoted to …' with letter in /emp/movements

#### 7.2.5 Transfer

**Actors:** HR/Manager, HR approver

1. Raise transfer (field matching type must change; entity moves go to group transfer)
2. HR approve → letter + alert
3. Make effective on date → record updated

**Notifications:** Employee alert with letter ref

#### 7.2.6 Termination

**Actors:** HR, HR Head, Unit Head, Legal

1. Open case with grounds, due process and LWD
2. Three approvals by three different people
3. Issue letter → employee to Notice, exit file opened, access revocation scheduled

**Notifications:** Employee alert with letter

#### 7.2.7 Warning

**Actors:** HR/Manager, Employee

1. Issue warning → letter generated
2. Employee acknowledges on the portal (once)
3. Escalate (Level 2/3 + PIP) or close

**Notifications:** Employee alert to acknowledge within 3 working days

#### 7.2.8 Handbook publication

**Actors:** HR, Employees

1. Publish version (template or upload; unique version)
2. Employees notified; open the handbook; sign with their exact name
3. Register tracks acknowledgements

**Notifications:** Alert per active employee of the entity

#### 7.2.9 Probation tracking

**Actors:** HOD, HR

1. End date = DOJ + probation months
2. Dashboard/HOD widget lists completions within 30 days (and up to 30 days overdue)

**Notifications:** HOD action item

### 7.3 Time — attendance, leave, timesheets, tours, comp-off

#### 7.3.1 Leave application & approval

**Actors:** Employee, HR (on behalf), Reporting Manager / HOD, HR / CHRO, Admin (override)

1. Employee (or HR on behalf) fills type, dates, day part, reason, documents, handover
2. Engine validates dates, holidays, balance, overlap, limits, clubbing, lock
3. Request saved Pending with chain from Leave Master (e.g. Manager → HR)
4. Current step approver approves → next step, or rejects with reason
5. Last step approves → Approved; balance used increases; attendance register marks L (LOP → A); payroll LOP reads it
6. The requester and anyone who already acted can never decide a step; the employee may withdraw a pending request or
   cancel an approved future one → **Cancelled** (balance restored; counted like Rejected in dashboards and reports)

**Notifications:** Alert to first approver on submit; Alert to employee when HR files on behalf; Alert to next approver + employee on step approval; Alert to employee on final approval / rejection

#### 7.3.2 Clock-in / clock-out

**Actors:** Employee

1. Choose Manual / Biometric device / Geofence
2. Geofence: browser location checked against active fence (block or reason-override)
3. Punch in creates open punch (local date/time)
4. Punch out closes it; hours, verdict (Full/Short/Half/OT) and shift timing (late-in / early-out) computed
5. Register marks P when ≥ half-day hours; Work Hours tab shows OT/short; off-day punches ≥4 h auto-credit comp-off

**Notifications:** Comp-off credited alert

#### 7.3.3 Attendance lock for payroll

**Actors:** HR, Payroll

1. HR reviews register / report for the month
2. HR locks `${org}:${period}`
3. Leave applications/approvals, wage musters and punch deletions in that month are blocked
4. Payroll run reads locked attendance → LOP via attendance pattern
5. HR may unlock to regularise

#### 7.3.4 Comp-off earn & redeem

**Actors:** Employee, HOD (fallback Manager → HR)

1. Auto-credit 0.5 day per off-day worked (>4 h) or approved tour off-day, monthly cap 2, expiry per Leave Master
2. Employee requests redemption (working days, half-day allowed) within free balance
3. HOD approves → ledger debit; register shows L
4. Reject with reason; pending can be withdrawn

**Notifications:** Credit alert; Approver alert on request; Employee alert on decision

#### 7.3.5 Timesheet fill, submit & approve

**Actors:** Employee, Manager / HOD, HR

1. Employee picks format (daily / weekly days), adds tasks (project, times or hours)
2. Validation: no future date, end>start, ≤24 h/day
3. Entries saved Submitted
4. Manager/HR (not own) approves or rejects with reason
5. Employee resubmits rejected / submits drafts; day/week/month views and FY YTD report

**Notifications:** Rejection alert to employee

#### 7.3.6 Tour request & approvals

**Actors:** Employee, HOD, HR, CFO / Finance, HR/Admin (assign)

1. Employee requests tour (purpose, destination, dates, mode, cost, cost centre)
2. Chain HOD → HR → CFO built; current approver alerted
3. Each step approves (or rejects with reason); final approval → Approved
4. Employee submits outcome / proof → Completed; logs expenses & bills; HR approves expenses, sets advance
5. Encash approved − advance as petty-cash claim; HR closes tour
6. Alternatively HR creates & assigns an approved tour to employee + co-travellers

**Notifications:** Approver alert per step; Employee alert on final decision; Assignment alert to each traveller

#### 7.3.7 Daily-wage muster

**Actors:** HR / Site admin

1. Maintain wage-worker roster (entity work orders only)
2. Daily muster: P/H/A/WO/PH with in/out and OT for active workers
3. Payable days = P + ½H + PH → wage register in payroll

### 7.4 Payroll, statutory, tax & finance

#### 7.4.1 Monthly payroll run (maker–checker)

**Actors:** HR (maker), Admin / CHRO / Super Admin of a single company (Payroll Admin level), CFO (Finance level), Employee · runs are per company; a Super Admin in the collective view sees every company's runs and approves inside a company

1. HR creates the run for the period (register computed from attendance, patterns, statutory config)
2. HR locks the month's attendance
3. HR runs compliance checks → per-employee check states (Check failed / Warning / OK), filterable by
   Error / Warning / Info
4. HR fixes records (UAN / PF ID / ESI IP / PAN) in the resolve dialog, overrides with justification, or escalates
   to the concerned person
5. Re-run checks → Checks Passed; acknowledge warnings
6. Submit for approval → approvers at each configured level (distinct people, never the maker). An approver can
   **Approve**, **Reject**, or **Send back to HR for correction** (run returns to Draft with the note on the trail)
7. Process → payslips visible on /emp/payslips, YTD, IT statement; ECR/ESI/TDS unlocked. Finance can export the
   whole run — every payslip in one PDF, or a CSV register
8. Confirm bank transfer (payment ref) → Paid; loan EMIs posted to the loan ledger

**Notifications:** Escalated check → alert to concerned person (kind payroll)

#### 7.4.2 Statutory filing (ECR / ESI / TDS)

**Actors:** HR, CFO

1. Generate from a processed run (validation: UAN, IP, PAN, TAN)
2. HR verifies member data
3. Finance approves challan (≠ generator)
4. Upload on portal → record TRRN / challan / CIN
5. Record payment → Paid
6. Quarterly Form 24Q assembled from paid TDS challans

#### 7.4.3 Proof of investment & Form 16

**Actors:** Employee, HR, CFO

1. Employee declares Form 12BB (new-regime fields) and uploads proofs
2. HR verifies / rejects each proof (alert to employee)
3. HR verifies & locks the declaration (alert)
4. HR generates Form 16 from payroll (Part A from processed TDS, Part B new-regime computation; editable perquisites / exemptions recompute tax)
5. Mark verified → Sign & issue (alert) → employee downloads on /emp/tax

**Notifications:** Proof verified/rejected; Declaration locked; Form 16 issued

#### 7.4.4 Reimbursement claim

**Actors:** Employee, Reporting manager, HR, CHRO, CEO, CFO (approval + Accounts)

1. Employee raises claim with itemised bills (/emp/reimbursements); every bill's attachment opens in the viewer
2. Reporting manager approves in 'Team claims awaiting my approval'
3. HR → CHRO → CEO → CFO approve on /org/claims — only the stage's designated approver gets the buttons; everyone
   else sees "Awaiting <stage>"
4. CFO processes payment at Accounts → Settled / Paid

**Notifications:** Stage moved / rejected with reason / paid → alert to claimant

#### 7.4.5 Insurance claim (hospitalisation / reimbursement)

**Actors:** Employee (or HR on behalf), CFO / Admin / CHRO (review & settle)

1. A claim is raised against the employee's policy (nature, amount, hospital / details, documents)
2. Reviewer takes it up → Under Review
3. Approve with the **admissible amount** (room-rent caps etc.) or Reject with a reason
4. Settle with the payment reference (UTR) → Settled; the whole trail stays on the claim

**Notifications:** the employee is alerted at every step

#### 7.4.6 Loan / salary advance

**Actors:** Employee, HR / Finance

1. Employee applies (policy limits validated)
2. HR/Finance approves or rejects (alert) — the decider and date show on the loan row
3. Disburse
4. EMI recovered through payroll (on markPaid) or manually; balance recovered from F&F on exit

**Notifications:** Loan approved / rejected

#### 7.4.7 Expenditure booking

**Actors:** Any booking role, Admin/CEO/COO/CFO/CHRO

1. Book spend with purpose, people, vendor, GST, bills, asset/festival details
2. Every record has a **View** action — full details, each bill and its attachment, approval history, payment
   status and outcome
3. Approver (not booker/requester) approves or rejects
4. Mark paid with reference
5. Record outcome

#### 7.4.8 VPF / NPS election

**Actors:** Employee, HR

1. Employee declares VPF / NPS for the FY
2. HR approves (not own) → flows into PF (A/C 1, ECR) and payslips from next run

### 7.5 Performance, learning, exit & grievance

#### 7.5.1 Self-appraisal to pay grade and letter

**Actors:** Employee, Reporting manager, HR, Unit Head (dept HOD, else COO/CEO; Admin/SuperAdmin/CEO may act), HR (payroll.manage)

1. Employee fills purpose, supported goals, quarter/timeline, parameter self-ratings, value proposition, attachments → submit (/emp/appraisals)
2. Manager reviews in Team Reviews (/emp/reviews): approve / send back / reject with comments, rating, recommended grade & hike
3. HR approves in Performance → Self-appraisal Approvals
4. Unit Head gives final approval (different person from earlier approvers)
5. HR applies new grade / CTC / designation / effective date → salary structure & payroll updated, increment/promotion letter generated
6. Employee sees the outcome on My Appraisals + dashboard card and downloads the letter

**Notifications:** manager: self-appraisal to review; entity HR: awaiting HR; unit head(s): awaiting Unit Head approval; entity HR: approved — apply pay grade; employee: each decision and 'Appraisal applied' (payroll alert)

#### 7.5.2 HR appraisal (HR-initiated)

**Actors:** HR, Approver (Admin/CEO/COO/CFO/CHRO/HR, not the employee)

1. HR drafts appraisal (trigger, purpose, goals, parameters, linked reviews, pay outcome)
2. Approver approves & applies (compensation updated, letter rendered) or rejects with reason
3. Employee sees 'Appraisals applied by HR' and downloads the letter

**Notifications:** employee: Appraisal applied

#### 7.5.3 Staged appraisal cycle (Self → HOD → HR)

**Actors:** HR, Employee, HOD, HR

1. HR starts a cycle for an employee and review cycle
2. Employee submits self rating + comments
3. HOD rates or sends back
4. HR finalises → Completed

**Notifications:** employee: self appraisal open / sent back / completed; HOD: awaiting HOD review; entity HR: awaiting HR

#### 7.5.4 Quarterly / annual review form

**Actors:** HR or Manager (launch), Employee, Manager, HR

1. Launch form with the employee's goals and active parameters
2. Employee self-rates goals & parameters with justification/evidence
3. Manager rates, recommends, hike/promotion for annual
4. HR calibrates final rating / hike and closes

**Notifications:** employee: review launched; manager: to rate; entity HR: ready for calibration; employee: closed

#### 7.5.5 Manager team review and HR review

**Actors:** Manager, HR, Employee

1. Manager writes detailed review (goals vs achieved, parameters, feedback, recommendation) and optionally shares
2. HR runs an HR review with skills/parameters/goals/context and shares
3. Employee reads and acknowledges on My Appraisals

**Notifications:** employee: review shared; manager: review acknowledged

#### 7.5.6 PIP

**Actors:** Manager/HR, Employee, Concerned persons

1. Create plan with reason, evidence, dates & cadence checkpoints, concerned persons, goals/tasks, objectives, support, consequences
2. Employee acknowledges
3. Checkpoint notes, objectives ticked, remarks
4. Close as Successful / Failed, or archive

**Notifications:** employee: plan created / closed; concerned persons: on PIP

#### 7.5.7 Goals

**Actors:** Employee, Manager / HR / Admin

1. Employee self-creates → Pending Approval (approval-engine record raised) or manager/HR assigns → Approved
2. Reviewer approves / rejects (not own goal)
3. Owner starts, updates progress, metrics, milestones, self-rating
4. Manager rates and marks complete

**Notifications:** reviewer: goal to approve; owner: assigned / approved / rejected

#### 7.5.8 Training assignment to certificate

**Actors:** HR / Manager, Employee, Reviewer

1. Assign catalogue or new programme to employees (optional linked goal)
2. Employee completes modules / uploads assignment → submit
3. Reviewer rates five parameters, outcome, recommendation
4. Certify → certificate, assignment Completed, goal Completed; or extend / reassign

**Notifications:** employee: training assigned / reviewed / certified; assigner: submitted for review

#### 7.5.9 Exit: resignation to exit complete

**Actors:** Employee, Reporting manager, HR, Clearance officers (Finance, Payroll, HR Ops, Manager, IT/Assets, Admin), Finance

1. Employee submits resignation (reason, note, requested LWD, letter)
2. Manager accepts → HR Review, or rejects; employee may withdraw before the manager decides
3. HR accepts and fixes notice days → Notice Period (directory status Notice), or rejects
4. During notice: Retain (audit form → Retained, employment continues) or Move for clearance checklist (officers assigned)
5. Each officer ticks checklist and gives / blocks clearance
6. All 7 cleared → Final Settlement
7. F&F computed, saved, settled with payment ref (loans recovered); exit interview recorded (portal survey / HR interview / uploaded form)
8. Complete exit → relieving letter; early release requires a reason; continuity rejoin within window

**Notifications:** manager: resignation to review; employee: manager/HR decision, notice started, clearance started, all cleared, F&F paid, exit completed; entity HR: awaiting HR acceptance, clearance blocked; officers: clearance assigned; manager: serving notice / withdrawn

#### 7.5.10 Grievance redressal

**Actors:** Employee (optionally anonymous), Routing owner / committee, HR, CHRO (appeal)

1. Employee raises (category → committee, owner, ack & resolve SLAs) or HR logs on behalf
2. Handler acknowledges within ack SLA
3. Investigation notes (internal or visible)
4. Resolution with action taken
5. Employee accepts & rates (closed) or appeals → CHRO, 15-day SLA; HR may close after 7 days without response; employee may withdraw before investigation

**Notifications:** owner + entity HR: new grievance; complainant: acknowledged / resolved; CHRO: appealed

### 7.6 Work — projects, tasks, assets, helpdesk, reports

#### 7.6.1 Project with inline tasks

**Actors:** Manager/HOD/HR/CXO/Admin, Employee

1. Manager opens Projects & Assignments → New Project, fills project, people (manager auto-added, members), timeline, commercials, milestones
2. Adds tasks inline under the project (assignees limited to manager + members)
3. Create → project + every complete task written to the shared task store (projectId set)
4. Tasks appear in Projects → Tasks, Tasks module and each assignee's /emp/tasks and /emp/projects

**Notifications:** Assignees: 'New task assigned — …' → /emp/tasks; Concerned manager / person: 'You are concerned on task …'; Manager & members: 'Added to project …' → /emp/projects

#### 7.6.2 Task progress update and approval

**Actors:** Employee (assignee), Concerned manager / task creator

1. Assignee opens the task, sets status / progress % / total hours and a note → Post update (approval = Pending)
2. Approver sees it in Projects → Updates or the task detail
3. Approve → hours / progress / status applied (Completed ⇒ 100 %) · or Reject with a reason

**Notifications:** Approver: 'Task update to approve — …' → /org/projects or /org/tasks; Assignees: 'Task update approved' / 'Task update sent back' → /emp/tasks

#### 7.6.3 Asset issue and acknowledgement

**Actors:** Asset manager (Admin/HR), Employee

1. Asset added to the register from the asset master (type, checklist, accessories)
2. Issue: pick employee (fixed when fulfilling a request), purpose, expected return / until separation, verify serial, tick checklist & accessories
3. Asset → Issued; issuance Active, employeeAck false
4. Employee acknowledges receipt on My Assets

**Notifications:** Employee: 'Asset issued — …' → /emp/assets

#### 7.6.4 Asset return and condition issue (mishandling path)

**Actors:** Employee, Asset manager, Reporting manager, Finance (CFO)

1. Employee requests return (asset → Return Pending)
2. Asset manager runs the return check (serial, same checklist, accessories, condition)
3. OK → Returned, asset In Stock · Problem → condition issue opened (asset Under Maintenance / Lost), issuance 'Issue raised'
4. Asset manager assesses: mishandling → Manager review; asset fault → Repair / replacement
5. Reporting manager (My Assets → awaiting your action) records remarks: disagree → asset fault path; agree/partial → Finance review
6. Finance decides recovery (full / partial / waive, mode) → Repair / replacement
7. Asset manager records resolution (repaired / replaced / written off …) → issue Resolved, issuance Returned with deduction, asset In Stock or Retired
8. Issue may be Closed

**Notifications:** Admins: 'Return to check'; Employee: condition issue opened / under manager review / with Finance / Finance decision / resolved; Manager: 'Asset issue … needs your remarks' → /emp/assets; CFO: 'recovery decision needed' → /emp/assets

#### 7.6.5 Asset request approval

**Actors:** Employee, HOD, HR business partner, Admin

1. Employee raises a request (type, purpose, urgency, needed-by, specs, project, duration)
2. Chain HOD → HR partner → Admin; each approver approves / rejects (override by SuperAdmin/Admin/CEO/CHRO)
3. Approved → asset manager fulfils from stock via the issue form → request Issued

**Notifications:** Current approver: 'Asset request … awaiting your approval'; Employee: request approved / rejected; Admins: 'approved — issue from stock'

#### 7.6.6 Asset transfer

**Actors:** Asset manager, Both employees

1. Transfer an Issued asset to another employee of the same org
2. Old issuance → Transferred; new Active issuance (issuedBy 'Transfer')
3. Both sides acknowledge (receiver's My Assets ack also completes the transfer ack)

**Notifications:** Receiver: 'Asset transferred to you'

#### 7.6.7 Helpdesk ticket lifecycle

**Actors:** Requester (any user), Agent / department head, Desk admin

1. Requester picks department → category → optional agent (confidential categories fixed to owner), subject, description, priority/impact, attachments, watchers, on-behalf
2. Ticket Assigned with SLA due times
3. Agent replies (first response, status In Progress), may add internal notes, reassign, transfer, change priority, set Waiting on Requester
4. Agent resolves with a resolution note
5. Requester (or raiser/agent) confirms & closes, rates 1–5, or reopens with a reason (fresh resolution clock)
6. Anyone on the ticket can escalate (priority +1, head added as watcher)

**Notifications:** Assignee: new ticket assigned; Requester / watchers: desk replies, resolved, waiting on you, reopened; All links → /helpdesk/tickets/{id}

#### 7.6.8 Reports hub — catalogue, filters, export

**Actors:** Role-scoped org users

1. Reports opens as a **card catalogue**: every report available to the role, grouped by category, searchable
2. Open a card → the report with its packs and filters (FY, date range, month, year, search)
3. Export CSV (formula-safe), Excel (.xls HTML) or PDF (branded print page)

#### 7.6.9 Custom report builder

**Actors:** Role-scoped org users

1. Reports → **Custom report**: pick the data source (any report of the catalogue)
2. Choose the columns, a contains-filter, and optionally **group by** any column with Count / Total / Average
3. Run → the result exports like any report; **Save for reuse** puts it on the Reports landing screen for later

#### 7.6.10 AI report

**Actors:** Role-scoped org users

1. Reports → **AI report**: describe it in plain words — "payroll cost by department", "leave applications for
   Pune in September"
2. The assistant picks the data source, grouping, aggregation and filter, and explains each step ("How this
   report was built")
3. The result exports like any report and can be saved for reuse

---

## 8. How the flows connect (hire to retire)

| Stage               | Flow                                                                                              | Hands over to                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Organisation set-up | 4.1 Organisation Setup wizard → 4.2 Companies, branches, admins → 4.3 Configuration → Master Data | Every module                                                                |
| Hire                | 7.2.1 Recruit to hire or 7.2.3 Direct hire (company + branch)                                     | Directory, login, manager, HR partner, salary structure, attendance pattern |
| Daily work          | 7.3.2 Clock-in · 7.3.5 Timesheets · 7.6.1–7.6.2 Projects & tasks · 7.6.7 Helpdesk                 | Attendance register, reports                                                |
| Time off & travel   | 7.3.1 Leave · 7.3.4 Comp-off · 7.3.6 Tours                                                        | Attendance register (L / A), payroll LOP, claims                            |
| Month end           | 7.3.3 Attendance lock → 7.4.1 Payroll run → 7.4.2 Statutory filings                               | Payslips, YTD, IT statement, loan ledger                                    |
| Year                | 7.4.3 Proof of investment & Form 16 · 7.5.1–7.5.5 Appraisals                                      | Salary structure, letters                                                   |
| Movements           | 7.2.4 Promotion · 7.2.5 Transfer · 4.4 Inter-company transfer                                     | Record, login, assets                                                       |
| Assets              | 7.6.3–7.6.6 Issue, return, request, transfer                                                      | Exit clearance, F&F recovery                                                |
| Separation          | 7.5.9 Exit (resignation / termination) → clearance → F&F → relieving                              | Directory status, rejoin window, gratuity on group tenure                   |
| Relations           | 7.2.7 Warning · 7.5.6 PIP · 7.5.10 Grievance                                                      | Case history                                                                |

---

## 9. The demo organisation and accounts

The build ships with one organisation — **Seereon Group** (all modules on) — whose four companies exercise every
structure level:

| Company                                 | Branches                                 |
| --------------------------------------- | ---------------------------------------- |
| Seereon Consulting & IT Services (main) | Bhubaneswar HQ · Pune · Mumbai · Chennai |
| Seereon SAP Practice                    | Hyderabad Office · Bhubaneswar HQ        |
| Seereon Cloud Services                  | Pune Office · Bhubaneswar HQ             |
| Seereon Products                        | Kolkata Office · Bhubaneswar HQ          |

| Tab         | Account                                                                                                       | Password                                      | Role                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| Super Admin | superadmin@seereon.co.in                                                                                      | Super@123                                     | Super Admin (all 4 companies)                    |
| Admin       | admin@seereon.co.in                                                                                           | Admin@123                                     | Company Admin — Seereon Consulting & IT Services |
| Admin       | admin@sap.seereon.co.in · admin@cloud.seereon.co.in · admin@products.seereon.co.in                            | Admin@123                                     | Company Admins of the other companies            |
| Admin       | pune.admin@seereon.co.in                                                                                      | Branch@123                                    | Branch Admin — Pune                              |
| Employee    | varen@seereon.co.in · saras@seereon.co.in · subh@seereon.co.in · subham@seereon.co.in                         | Hr@123 · Cfo@123 · Manager@123 · Employee@123 | HR · CFO · Manager · Employee (main company)     |
| Employee    | falguni.rathore@sap.seereon.co.in · pallavi.chatterjee@cloud.seereon.co.in · soumen.ghosh@cloud.seereon.co.in | Falguni@123 · Pallavi@123 · Soumen@123        | HR (SAP) · Manager (Cloud) · Employee (Cloud)    |

---

## 10. Developer notes

| Topic                                                          | Where                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The organisation, scope, configuration layers, data namespaces | `src/features/organization/data/tenancy.js`                                                                      |
| Structure (groups, companies, branches)                        | `src/features/organization/data/group-data.js`                                                                   |
| Feature catalog, org types, structures                         | `src/features/platform/data/feature-catalog.js` (+ `tools/gen-feature-catalog.mjs`)                              |
| Role → screen / action matrices, gates                         | `src/features/auth/data/auth-session.js`                                                                         |
| Scope filter for any list                                      | `useScopeMatch()` → `inScope(orgId, empId?, branch?)`                                                            |
| Gating a new action                                            | add it to `ACTIONS` / `ROLE_ACTIONS` and to the module's `actions` in the catalog; guard the button with `can()` |
| Adding a screen or tab                                         | add the route to the catalog module's `screens`, then run `node tools/gen-feature-catalog.mjs`                   |
| A new master store                                             | add its key to the right entry of `MASTER_TYPES` in tenancy.js so it follows group sharing                       |
| Uploaded files (capture, viewer, downloads)                    | `src/lib/attachments.js` · `src/components/common/AttachmentViewer.jsx`                                          |
| Custom roles widening navigation                               | `SCREEN_ROUTES` / `rbacRoutesFor` in `src/features/auth/data/rbac-store.js`                                      |
| Architecture and API contract additions                        | `docs/ORG_ARCHITECTURE.md`                                                                                       |
| Change log and verification evidence                           | `docs/CHANGELOG_v8.md`                                                                                           |

### Test scripts

| Script                     | Proves                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/tenancy-flows.mjs`  | Sign-in tabs, Privacy/Terms, company & branch isolation, collective view, Branch Admin lock, configuration at all three layers             |
| `tests/setup-flows.mjs`    | Organisation Setup wizard end to end, Company Admin issued and forced password change, branch edit / deactivate / activate                 |
| `tests/business-flows.mjs` | Leave across portals and scopes; payroll maker–checker incl. fixing compliance errors; inter-company transfer confirmed by the Super Admin |
| `tests/wiring-flows.mjs`   | A created role genuinely grants its screens; tasks per assignee, progress update → approval; announcements reach notices                   |
| `tests/route-matrix.mjs`   | Every screen × role: access and runtime errors (compare against a baseline build)                                                          |
| `tests/e2e/*.spec.js`      | Playwright sign-in, smoke and responsive specs                                                                                             |
