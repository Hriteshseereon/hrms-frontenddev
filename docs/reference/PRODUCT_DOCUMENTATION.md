# Seereon HRMS — Product Documentation

_v5.1 · 22 September 2026 · Seereon_

## 1. About this document

This is the developer reference for **Seereon HRMS v5.1**, Seereon's multi-tenant HRMS. It describes the product as it is built today — a complete UI prototype whose data lives in the browser — and everything a backend team needs to replace that browser storage with a real PostgreSQL database and API without changing product behaviour.

| Item                | Detail                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Product             | Seereon HRMS — Human Resource Management Suite by Seereon                                                                     |
| Version documented  | v5.1 (post code-audit build, 22 September 2026)                                                                               |
| Codebase            | TanStack Start + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui; deployed on Vercel                                       |
| Audience            | Backend developers, database designers, QA / test engineers, integration partners                                             |
| Companion documents | Seereon HRMS API Documentation (same version) · openapi.json · db/schema_draft.sql · Seereon HRMS Code Audit Report v5.1.xlsx |
| Status              | Baseline for the database-design and backend-development phases                                                               |

### 1.1 How to use this document

- **Testers** — start with chapter 10 (demo accounts and smoke tests), then chapter 5 (business flows) and chapter 7 (validations) to derive test cases.
- **Database designers** — chapters 8 and 9 give the ER diagrams and the full data dictionary; db/schema_draft.sql is the same model as loadable PostgreSQL DDL.
- **Backend developers** — chapter 4 (architecture, tenancy, security), chapter 6 (record lifecycles) and the companion API document.
- **Integrators** — section 4.8 and Appendix B map every browser store to its future table and endpoint, which is the unit of work for swapping the prototype onto the API.

### 1.2 Numbers at a glance

| Measure                                   | Count                                                             |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Portals                                   | 5 (Seereon Platform, Organisation, Employee, Helpdesk, Candidate) |
| Screens (routes)                          | 116                                                               |
| Application roles                         | 11                                                                |
| Action permissions                        | 39                                                                |
| Functional chapters                       | 11                                                                |
| Business flows documented                 | 57                                                                |
| Validation rules documented               | 247                                                               |
| Database tables (incl. child tables)      | 333 (188 primary + 145 child)                                     |
| Columns                                   | 3072                                                              |
| Records with a lifecycle (status machine) | 71                                                                |
| API endpoints                             | 561                                                               |
| Browser stores to migrate                 | 93 persistent stores + shared lists + master CRUD sections        |

## 2. Product overview

### 2.1 What Seereon HRMS is

Seereon HRMS is a hire-to-retire HRMS for Indian companies and company groups. One deployment serves many client groups; each group has one or more legal entities (companies), each entity has branches, departments and employees. The product covers organisation set-up, recruitment and onboarding, employee records and movements, attendance, leave, timesheets, tours and comp-off, payroll with Indian statutory compliance (PF, ESI, PT, LWF, TDS, Form 16), claims, loans and expenditure, performance, goals and training, projects, tasks and assets, exit and full-and-final settlement, grievances, announcements and a helpdesk.

![Figure 2.1 — Hire-to-retire lifecycle covered by Seereon HRMS](diagrams/04_hire_to_retire.png)
_Figure 2.1 — Hire-to-retire lifecycle covered by Seereon HRMS_

### 2.2 Portals and entry points

| Portal                   | Entry                                                                              | Who uses it                                                                     | Purpose                                                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seereon Platform console | /seereon (sign-in) → /app/*                                                        | Seereon's own product, support and engineering team (portal = app)              | Onboard client groups and organisations, provision modules, plans and integrations, reset tenant admin credentials, approve inter-company transfers, platform support, audit and settings. Not linked from the public sign-in page. |
| Organisation portal      | /login (Super Admin or Admin tab, or Employee tab for CXO/HR/HOD/Manager) → /org/* | Super Admin (group), Admin (entity), CEO, COO, CFO, CTO, CHRO, HR, HOD, Manager | Run the company: masters, people, time, payroll, performance, exits, assets, projects, reports, administration. Screens open by role.                                                                                               |
| Employee portal          | /login (Employee tab) → /emp/*                                                     | Every employee (and every org role for their own self-service)                  | Self-service: profile, attendance, leave, timesheets, payslips, tax, claims, loans, goals, appraisals, training, tasks, assets, tours, resignation, grievances.                                                                     |
| Helpdesk                 | /helpdesk/*                                                                        | All signed-in users; service-desk agents                                        | Raise and track tickets, agent queues, service catalogue, SLA settings.                                                                                                                                                             |
| Candidate portal         | /candidate/{token}                                                                 | External candidates (token link, no account)                                    | Accept offer, upload joining documents, complete pre-boarding.                                                                                                                                                                      |

### 2.3 Functional chapters

| #   | Chapter                           | Scope                                                                                                                                                                                                                             | Tables | Endpoints |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| 1   | Platform & Tenancy                | Seereon platform console: client groups, organisations (entities), branches, modules, plans, integrations, tenant administrators, inter-company transfers and platform support.                                                   | 27     | 52        |
| 2   | Identity, Access & Administration | Users and logins, sessions, password policy, app-role permissions and designer RBAC roles, temporary access, delegation, the approval engine, soft delete / archive, alerts, announcements, branding and personalisation.         | 37     | 72        |
| 3   | Employees & Organisation          | Employee master (job, compensation, statutory ids, bank), org structure (departments, designations, buildings, reporting lines, HR partners, substitutes) and people cases (promotion, transfer, termination, warning, referral). | 30     | 53        |
| 4   | Recruitment & Onboarding          | Job posts, applicants and ATS shortlisting, interviews and scorecards, offers and the candidate link, onboarding documents and new-hire provisioning.                                                                             | 20     | 31        |
| 5   | Masters, Policies & Documents     | Generic masters, leave types & policies, holiday calendars, pay components, insurance plans, IP / geofence rules, document templates & styles, employee handbook and acknowledgements.                                            | 18     | 57        |
| 6   | Time, Attendance, Leave & Travel  | Punches, shifts, attendance rules and register, payroll lock, leave applications and balances, comp-off, timesheets, tours & travel expenses, daily-wage workers and work orders.                                                 | 30     | 59        |
| 7   | Payroll, Statutory, Tax & Finance | Payroll runs (maker–checker), salary structures and grades, statutory configuration and filings (PF / ESI / PT / LWF / TDS — New Tax Regime), IT declarations and Form 16, loans, claims, insurance, expenditure.                 | 55     | 74        |
| 8   | Performance, Goals & Learning     | Evaluation parameters, review forms, manager / HR reviews, self-appraisal and HR appraisal to pay grade, appraisal cycles, PIPs, goals, training programmes and assignments.                                                      | 59     | 51        |
| 9   | Exit, Grievance & HR Policy       | Resignation to exit completion (clearance, retention, F&F, exit interview), rejoin, grievance redressal and routing, HR policy, retirement and the notification outbox.                                                           | 26     | 46        |
| 10  | Projects, Tasks & Assets          | Projects, milestones and members, tasks with updates / checklist / links, asset master and register, issuance with checklist, returns, condition issues, requests and transfers.                                                  | 20     | 34        |
| 11  | Helpdesk & Reporting              | Service-desk settings, SLA policies, service departments, ticket categories, tickets with events / attachments / watchers, and the report catalogue.                                                                              | 11     | 32        |

### 2.4 Tenancy model in one paragraph

**Platform → Company group → Entity (organisation) → Branch → Department → Employee.** A Super Admin belongs to a group and can see every entity collectively (group view) or switch into one entity. Everyone else — Admin, CXOs, HR, HOD, Manager, Employee — is locked to their own entity. Every business record carries the owning entity (`org_id`); group-level records carry `group_id`. See section 4.6.

## 3. Users, roles and permissions

Access is decided by the **application role** of the signed-in user. Each role has (a) a set of organisation-portal screens it may open, (b) a set of employee-portal menu items and (c) a set of **action keys** that gate buttons such as _Approve payroll_ or _Lock attendance_. `SuperAdmin`, `Admin` and `CEO` hold every screen and action (`*`). The source of truth today is `src/lib/auth-session.ts` (ROLE_NAV, ROLE_EMP_NAV, ROLE_ACTIONS); the backend must enforce the same matrix server-side.

### 3.1 Roles

| Role       | Scope                                       | Description                                                                                                                                                                             | Signs in on     |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| SuperAdmin | Whole group · All entities · All modules    | Group super administrator — the client's head of the company group. Collective dashboard across every entity, can switch into any single company, creates entities, branches and roles. | Super Admin tab |
| Admin      | All modules · Administration                | Organization administrator — full platform control, user provisioning and configuration.                                                                                                | Admin tab       |
| CEO        | All modules · All permissions               | Unrestricted access to every module, screen and action across Seereon.                                                                                                                  | Employee tab    |
| COO        | Operations · HR · Exits · Approvals         | Operations command — master data, people operations, resignations and approvals.                                                                                                        | Employee tab    |
| CFO        | Finance · Payroll · Tax · Claims            | Full control of finance, payroll, tax, claims and exit finance clearance.                                                                                                               | Employee tab    |
| CTO        | Projects · Engineering · Performance        | Technology office — delivery, projects, engineering people operations and technical reviews.                                                                                            | Employee tab    |
| CHRO       | All HR modules · Recruitment · Exits        | People office — owns the full HR charter, policy, hiring and the exit process.                                                                                                          | Employee tab    |
| HR         | All HR modules · Exit process · Recruitment | End-to-end HR ownership from org setup to exit, payroll, appraisals and hiring.                                                                                                         | Employee tab    |
| HOD        | My department · Approvals · Assets          | Head of Department — owns the department's people, approvals (tours, comp-off, appraisals, asset requests) and departmental reporting.                                                  | Employee tab    |
| Manager    | My team · Reviews · Tasks · Resignations    | Team oversight — reviews, goals, tasks, approvals and team resignations.                                                                                                                | Employee tab    |
| Employee   | Self-service only                           | Self-service — profile, tasks, goals, appraisal requests and resignation.                                                                                                               | Employee tab    |

> Designer RBAC roles (Roles & Permissions → Create role) are stored and assignable, but screen/action enforcement still uses the application role above. Enforcing custom RBAC roles is a listed deferred item and should be designed into the backend authorisation layer from day one.

### 3.2 Organisation-portal screen access

| Group             | Screen                       | Route                | SA  | Admin | CEO | COO | CFO | CTO | CHRO | HR  | HOD | Manager | Employee |
| ----------------- | ---------------------------- | -------------------- | --- | ----- | --- | --- | --- | --- | ---- | --- | --- | ------- | -------- |
| Overview          | Dashboard                    | /org/dashboard       | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Overview          | Master Data                  | /org/masters         | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   |     |         |          |
| Overview          | Announcements                | /org/announcements   | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Overview          | Notification Centre          | /org/notifications   | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   | ✓   |         |          |
| Administration    | Roles & Permissions          | /org/roles           | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| Administration    | Users & Logins               | /org/users           | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| Administration    | Role Delegation              | /org/delegation      | ✓   | ✓     | ✓   | ✓   |     |     | ✓    | ✓   |     |         |          |
| Administration    | System Archive & Soft Delete | /org/archive         | ✓   | ✓     | ✓   | ✓   | ✓   |     | ✓    | ✓   |     |         |          |
| Administration    | Settings                     | /org/settings        | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| Group             | Entities & Branches          | /org/groups          | ✓   |       |     |     |     |     |      |     |     |         |          |
| Group             | Group Asset Rollup           | /org/asset-rollup    | ✓   |       |     |     |     |     |      |     |     |         |          |
| People            | Employees                    | /org/employees       | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   |         |          |
| People            | Recruitment                  | /org/recruitment     | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| People            | Exit, Retention & F&F        | /org/exits           | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| People            | Grievance Redressal          | /org/grievances      | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   |         |          |
| People            | Training                     | /org/training        | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Time & Leave      | Attendance & Shifts          | /org/attendance      | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Time & Leave      | Leave & Comp-off             | /org/leave           | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Time & Leave      | Timesheets                   | /org/timesheets      | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Time & Leave      | Tours & Travel               | /org/tours           | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Payroll & Finance | Payroll, Payslips & Loans    | /org/finance         | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| Payroll & Finance | Claims & Insurance           | /org/claims          | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| Payroll & Finance | Expenditure Booking          | /org/expenditure     | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| Payroll & Finance | Proof of Investment          | /org/tax             | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| Payroll & Finance | Statutory Compliance         | /org/compliance      | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| Performance       | Reviews & Appraisals         | /org/performance     | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Performance       | Goals                        | /org/goals           | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Work & Assets     | Projects & Assignments       | /org/projects        | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Work & Assets     | Tasks                        | /org/tasks           | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Work & Assets     | Asset Lifecycle              | /org/assets          | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   | ✓   |         |          |
| Work & Assets     | Helpdesk                     | /helpdesk            | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| Reports           | Reports & Analytics          | /org/reports         | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| Reports           | Payroll Reports              | /org/payroll-reports | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| My Workspace      | My Self-Service              | /emp/dashboard       | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| My Workspace      | My Team                      | /org/team            | ✓   | ✓     | ✓   |     |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| My Workspace      | My Attendance                | /emp/attendance      | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| My Workspace      | My Leave                     | /emp/leave           | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| My Workspace      | My Payslips                  | /emp/payslips        | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| My Workspace      | My Claims                    | /emp/reimbursements  | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| My Workspace      | My Goals & Appraisals        | /emp/goals           | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| My Workspace      | Employee Handbook            | /emp/handbook        | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| My Workspace      | My Helpdesk Tickets          | /helpdesk/tickets    | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |

### 3.3 Action permissions

Action keys gate individual commands. The API must check the same key before executing the matching endpoint (each endpoint in the API document lists its `x-permission`).

| Action key            | SA  | Admin | CEO | COO | CFO | CTO | CHRO | HR  | HOD | Manager | Employee |
| --------------------- | --- | ----- | --- | --- | --- | --- | ---- | --- | --- | ------- | -------- |
| exit.submit           | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| exit.manager.decide   | ✓   | ✓     | ✓   | ✓   |     | ✓   |      |     | ✓   | ✓       |          |
| exit.hr.clearance     | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| exit.hr.approve       | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| exit.notice.configure | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| exit.complete         | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| exit.viewAll          | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   |         |          |
| finance.manage        | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| payroll.manage        | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| employee.manage       | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   |         |          |
| role.manage           | ✓   | ✓     | ✓   | ✓   |     |     | ✓    |     |     |         |          |
| recruitment.manage    | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| performance.manage    | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| task.assign           | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| goal.create           | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| asset.manage          | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| asset.issue           | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| asset.request         | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| asset.approve         | ✓   | ✓     | ✓   | ✓   |     | ✓   | ✓    | ✓   | ✓   |         |          |
| department.manage     | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| group.manage          | ✓   | ✓     | ✓   |     |     |     |      |     |     |         |          |
| tour.submit           | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| tour.hod.decide       | ✓   | ✓     | ✓   | ✓   |     | ✓   |      |     | ✓   |         |          |
| tour.hr.decide        | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| tour.finance.decide   | ✓   | ✓     | ✓   |     | ✓   |     |      |     |     |         |          |
| tour.viewAll          | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   |         |          |
| compoff.redeem        | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| compoff.hod.decide    | ✓   | ✓     | ✓   | ✓   |     | ✓   |      |     | ✓   |         |          |
| compoff.viewAll       | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   |         |          |
| payroll.run           | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| payroll.approve       | ✓   | ✓     | ✓   |     | ✓   |     | ✓    |     |     |         |          |
| payroll.process       | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| attendance.lock       | ✓   | ✓     | ✓   | ✓   |     |     | ✓    | ✓   |     |         |          |
| statutory.configure   | ✓   | ✓     | ✓   |     | ✓   |     | ✓    |     |     |         |          |
| filing.generate       | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| filing.verify         | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |
| filing.approve        | ✓   | ✓     | ✓   |     | ✓   |     | ✓    |     |     |         |          |
| filing.file           | ✓   | ✓     | ✓   |     | ✓   |     | ✓    | ✓   |     |         |          |
| contribution.approve  | ✓   | ✓     | ✓   |     |     |     | ✓    | ✓   |     |         |          |

### 3.4 Employee-portal menu by role

| Menu item              | Route               | SA  | Admin | CEO | COO | CFO | CTO | CHRO | HR  | HOD | Manager | Employee |
| ---------------------- | ------------------- | --- | ----- | --- | --- | --- | --- | ---- | --- | --- | ------- | -------- |
| My Appraisals          | /emp/appraisals     | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Assets              | /emp/assets         | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Attendance          | /emp/attendance     | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Raise a Grievance      | /emp/complaints     | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Self-Service        | /emp/dashboard      | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Goals & Appraisals  | /emp/goals          | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Employee Handbook      | /emp/handbook       | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Holiday Calendar       | /emp/holidays       | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| IT Declaration         | /emp/it-declaration | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| IT Statement           | /emp/it-statement   | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Leave               | /emp/leave          | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Loans & Advances       | /emp/loans          | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Movements & Letters | /emp/movements      | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Notices & Circulars    | /emp/notices        | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| /emp/payroll           | /emp/payroll        | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Payslips            | /emp/payslips       | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Profile             | /emp/profile        | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Projects & Assignments | /emp/projects       | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Refer a Candidate      | /emp/referrals      | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Claims              | /emp/reimbursements | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Reports             | /emp/reports        | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Resignation & Exit     | /emp/resignation    | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Team Reviews           | /emp/reviews        | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       |          |
| /emp/support           | /emp/support        | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Tasks               | /emp/tasks          | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| Proof of Investment    | /emp/tax            | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Timesheets          | /emp/timesheets     | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Tours               | /emp/tours          | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| My Trainings           | /emp/training       | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |
| YTD Reports            | /emp/ytd            | ✓   | ✓     | ✓   | ✓   | ✓   | ✓   | ✓    | ✓   | ✓   | ✓       | ✓        |

### 3.5 Approval routing rules

- **Approval chains** (tours, comp-off, asset requests, appraisals, leave, claims) resolve an approver per step: Manager → HOD → HR → Finance as configured. A step can be actioned by the resolved person or by a _peer_ holding the step's role (HR/CHRO for HR steps, HOD for HOD steps, Manager or HOD for manager steps, CFO for finance steps). Anyone else acting is recorded as an **override** and needs the step's permission.
- **Maker–checker**: the payroll maker (who created and submitted the run) can never approve it; each configured approval level needs a distinct person. Statutory filings follow generate → verify → approve → file with separate action keys.
- **Delegation**: a user can delegate their role's approvals for a date range; delegated actions record both the delegate and the original approver.
- **Self-approval is blocked** everywhere — an employee cannot approve their own leave, claim, tour, timesheet or asset request, even when they hold the approving role.
- **Temporary access / substitutes**: a manager substitute temporarily receives the manager's queue; branch access grants extend a user to additional branches of the same entity.

## 4. Product architecture

### 4.1 Current architecture — UI prototype

![Figure 4.1 — Current architecture: all state in the browser](diagrams/01_architecture_current.png)
_Figure 4.1 — Current architecture: all state in the browser_

The prototype is a single React application rendered by TanStack Start (SSR on Vercel/Nitro). File-based routes are grouped under portal shells that check the signed-in session and role. Screens call domain modules in `src/lib`, which contain the business rules, validations and workflow transitions, and read/write **stores**. Stores persist to `localStorage` under `seereon.*` keys, so every browser is its own database. The server render uses the seed snapshot; the client hydrates from localStorage after mount (`useHydrated`).

### 4.2 Code layout

| Path                               | Contents                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| src/routes/                        | 116 file routes. Prefix = portal: app.* (platform console), org.* (organisation), emp.* (employee), helpdesk.*, candidate.$token, login / forgot / reset password. |
| src/components/shell/              | Portal shells, sidebars (OrgSidebar holds the org screen catalogue), top bar, scope chip, global search, CrudSection (generic master CRUD).                        |
| src/components/<module>/           | Screen components per module (employees, payroll, attendance, recruitment, performance, assets …).                                                                 |
| src/lib/*-data.ts                  | Domain modules: types, seed data, store, commands (add/update/decide/…) and selectors. These are the functions each API endpoint replaces.                         |
| src/lib/auth-session.ts            | Accounts, sign-in, roles, ROLE_NAV / ROLE_EMP_NAV / ROLE_ACTIONS, can(), canOpenPath().                                                                            |
| src/lib/group-data.ts              | Groups, entities, active entity store, group/entity view scope.                                                                                                    |
| src/lib/persist.ts, shared-list.ts | Store primitives: createPersistentStore(key, seed), createStore, useSharedList.                                                                                    |
| src/lib/payroll-engine.ts          | Payroll computation, compliance checks, statutory calculations, TDS.                                                                                               |
| src/lib/approval-chain.ts          | Generic multi-step approval chain (buildChain, decideChain, canActOn).                                                                                             |

### 4.3 State and persistence pattern

```
// every store follows this shape — the API replaces get/set with fetch + mutation
export const leaveApplicationStore = createPersistentStore<LeaveApplication[]>("seereon.leave.applications.v1", SEED);
export const useLeaveApplications = () => leaveApplicationStore.use();      // → GET  /api/v1/leave/applications
export function applyLeave(input) { validate(input); leaveApplicationStore.set(l => [row, ...l]); } // → POST /api/v1/leave/applications
```

- Commands validate, then write the whole list back. On the backend each command becomes one transactional endpoint that performs the same validation server-side (chapter 7).
- Selectors filter by the active entity (`useActiveOrgId`) and role scope (own / team / department / all). The API must apply the same scoping from the token, never from client input.
- IDs are generated client-side as readable business keys (SRN-0006, PR-202607, LV-…); the draft schema keeps them as keys so seed data and screens map one-to-one.

### 4.4 Target architecture

![Figure 4.2 — Target architecture for the backend phase](diagrams/02_architecture_target.png)
_Figure 4.2 — Target architecture for the backend phase_

| Component           | Responsibility                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web app (existing)  | Unchanged screens; domain stores swapped for API hooks (TanStack Query) module by module.                                                                                                                                                                          |
| API gateway / BFF   | TLS termination, rate limiting, CORS, request size limits, correlation IDs.                                                                                                                                                                                        |
| Seereon HRMS API    | REST /api/v1 per the API document. Modules mirror the 11 chapters. Guards: authentication (JWT), tenant guard (org_id from token; X-Company-Id only honoured for Super Admin within their group), permission guard (action keys), row scope (own/team/department). |
| PostgreSQL 16       | System of record. Tenant tables carry org_id with Row-Level Security as a second line of defence. Money numeric(14,2); dates date; audit columns on every table.                                                                                                   |
| Redis               | Refresh-token/session store, sign-in lock-out counters, idempotency keys, short-lived caches (masters, permissions).                                                                                                                                               |
| Object storage      | Employee documents, proofs of investment, payslip and Form 16 PDFs, offer letters, ticket attachments — uploaded through pre-signed URLs.                                                                                                                          |
| Job queue + workers | Payroll computation for large runs, Form 16 / ECR / ESI / TDS file generation, report exports, e-mail and in-app alerts, SLA and escalation timers, comp-off accrual, retirement notices.                                                                          |
| Audit log           | Append-only record of every command (who, when, entity, before/after). Replaces today's static audit screen.                                                                                                                                                       |

### 4.5 Recommended stack

| Layer       | Recommendation                                                                                  | Why                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database    | PostgreSQL 16                                                                                   | Row-level security for tenancy, strong numeric types for payroll, JSONB for configurable forms, mature tooling. The draft schema is already verified on 16. |
| API         | Node.js + NestJS (TypeScript)                                                                   | Same language as the front end, so domain types and validation rules in src/lib can be shared or ported directly.                                           |
| Data access | Kysely or Prisma + SQL migrations                                                               | Typed queries; migrations in version control.                                                                                                               |
| Validation  | Zod schemas shared by web and API                                                               | One definition of every rule in chapter 7.                                                                                                                  |
| Auth        | JWT access token (15 min) + rotating refresh token; optional SSO (Azure AD / Google) per entity | Matches today's sign-in policy and per-org SSO configuration screens.                                                                                       |
| Files       | S3-compatible storage                                                                           | Pre-signed uploads/downloads; virus scan hook.                                                                                                              |
| Jobs        | BullMQ on Redis                                                                                 | Retries, schedules and progress for payroll and filings.                                                                                                    |

> The stack is a recommendation for the backend phase; the API contract and schema in these documents are stack-neutral.

### 4.6 Multi-tenancy

![Figure 4.3 — Tenancy hierarchy and view scopes](diagrams/03_tenancy.png)
_Figure 4.3 — Tenancy hierarchy and view scopes_

- Every tenant-owned table has `org_id` (NOT NULL, indexed). Group-level tables (company_groups, group transfers) use `group_id`.
- The token carries `userId`, `role`, `orgId`, `groupId`. For every role except Super Admin, `org_id` is taken from the token and any client-supplied org is ignored.
- Super Admin may send `X-Company-Id` to act inside one entity of their group, or omit it for group view (read-only roll-ups across entities).
- Sign-in is refused when the user's entity is Suspended or Inactive (a Super Admin is refused only when every entity in the group is blocked).
- Inter-company transfer moves an employee between entities of the same group: the employee record, login account, org, branch and designation all move; history is kept in group_employment_records.
- Recommended enforcement: PostgreSQL RLS policy `org_id = current_setting('app.org_id')` on tenant tables, set per transaction by the API.

### 4.7 Security and compliance

- **Authentication**: passwords hashed with Argon2id; sign-in policy per entity (minimum length, complexity, expiry, history, lock-out after N failed attempts, session timeout) — configured on /org/settings and enforced at sign-in.
- **Temporary passwords** issued by admins force a change at first sign-in; they must never be stored or displayed in plain text (today's prototype does — deferred item).
- **Authorisation**: role screen matrix + action keys (chapter 3), row scope, maker–checker for payroll and filings, self-approval blocked.
- **Personal data (DPDP Act 2023)**: PAN, Aadhaar, bank account, UAN, ESI IP, salary and health/insurance data are personal data. Encrypt at rest (pgcrypto or application-level envelope encryption), mask in lists (last 4 digits), log every read of full values, support data export and erasure on exit subject to statutory retention.
- **Audit**: every command writes an audit event; archive (soft delete) is used instead of hard delete for business records, with restore from /org/archive.
- **Files**: private buckets, pre-signed URLs with short expiry, content-type and size checks.
- **CSV/Excel exports** neutralise formula injection (cells starting with = + - @ are prefixed) — already done in the prototype and must be kept server-side.

### 4.8 Migration approach — from browser stores to the API

1. Stand up PostgreSQL from db/schema_draft.sql (after the DB design review) and load the seed data the prototype ships with, so screens show the same data on day one.
2. Build authentication and tenancy first (Identity chapter): sign-in, tokens, permissions endpoint (`GET /api/v1/me/permissions`) — the web app then reads ROLE_NAV/ROLE_ACTIONS from the API.
3. Migrate one store at a time: replace `store.use()` with a query hook and each command with a mutation to the documented endpoint. Appendix B lists every store key with its target table.
4. Keep the validation functions; call them on the client for instant feedback and on the server as the authority.
5. Move computation-heavy logic (payroll engine, TDS, Form 16, statutory files, reports) to workers once the data is server-side.
6. Delete the localStorage store once its module passes the chapter-10 smoke tests against the API.

## 5. Business flows

The 57 flows below are the end-to-end journeys implemented in the prototype. Each lists the actors, the steps in order and the notifications raised. Fourteen key flows are also drawn as diagrams. Test cases should be derived one per step plus one per rejection / alternative path.

### 5.1 Seereon Platform

#### 5.1.1 Onboard a client organisation / group

**Actors:** Seereon platform staff

![Flow — Onboard a client organisation / group](diagrams/flow_10_onboard_a_client_organisation_group.png)
_Flow — Onboard a client organisation / group_

1. Sign in at /seereon (portal 'app' accounts only)
2. /app/organizations/new: choose Group of companies or Single company
3. Step 1 organisation (name, legal name, code, industry) → 2 address → 3 contact & Super Admin login (subdomain, admin e-mail, temporary password, force change) → 4 modules (offered only) → 5 integrations → 6 plan & licences → 7 review
4. Create: addGroup (group structure) + addOrg (+ modules, integrations, plan, licences, subdomain) + provisionSuperAdmin
5. Credentials screen: copy credentials e-mail; open organisation → Credentials tab: share, reset, issue additional Super Admin

**Notifications:** Credentials e-mail text generated (copied — no mail gateway)

#### 5.1.2 Super Admin structures the group

**Actors:** Client Super Admin

1. Sign in on /login Super Admin tab with temporary password → forced to /emp/profile to set own password
2. /org/groups (or /org/masters → Group, entities & branches)
3. Add entity: company + first branch + entity Admin login (provisionEntityAdmin); single company → group auto-created
4. Add / remove branches per entity; edit entity branding
5. ScopeSwitcher: collective group view or work inside one entity

**Notifications:** Toast shows entity Admin temporary password (to be shared)

#### 5.1.3 Inter-company transfer

**Actors:** HR / Admin (source entity), Seereon platform staff

![Flow — Inter-company transfer](diagrams/flow_11_inter_company_transfer.png)
_Flow — Inter-company transfer_

1. /org/employees → Transfers → Transfer to Group Company → New Group Transfer (employee, destination in same group, effective date, new designation, reason, asset dispositions)
2. raiseGroupTransfer → Pending Seereon Confirmation
3. /app/group-transfers: Seereon reviews carry-forward snapshot (group joining date, UAN, PAN) and asset plan
4. Confirm → assets returned/released, employee record moved to destination org/designation/first branch; or Reject with note

**Notifications:** Alert to the raiser on confirm / reject (bell)

#### 5.1.4 Platform support ticket

**Actors:** Seereon support

1. /app/support → New Ticket (organisation, subject, requester, priority, assignee, description)
2. Open ticket → change status / reassign (history recorded)

#### 5.1.5 Provision modules / integrations / plan

**Actors:** Seereon platform staff

1. /app/organizations/$id → Modules: toggle module (toggleOrgModule)
2. Integrations tab or /app/integrations → Manage orgs: enable per organisation
3. Subscription tab: change plan
4. Suspend / Reactivate; list → Deactivate

#### 5.1.6 Platform announcement

**Actors:** Seereon platform staff

1. /app/notifications → Compose title + message

**Notifications:** pushAlert to every client Super Admin / Admin

### 5.2 Core — identity, access, approvals, announcements

#### 5.2.1 Sign-in (Super Admin / Admin / Employee tabs)

**Actors:** All users

![Flow — Sign-in (Super Admin / Admin / Employee tabs)](diagrams/flow_01_sign_in_super_admin_admin_employee_tabs.png)
_Flow — Sign-in (Super Admin / Admin / Employee tabs)_

1. Pick tab, optionally type Group/Company ID, enter e-mail or user code + password
2. Tab ↔ role check and tenant check
3. Suspended / Locked accounts refused
4. Wrong password → failed-attempt counter; lock at policy limit
5. Success → session stored, tenant scope applied (Admin/Employee locked to own entity, Super Admin group view), last login stamped
6. Temporary password → forced to My Profile → Sign-in & security; else land on /org/dashboard or /emp/dashboard
7. Portal shells redirect signed-out visitors to /login

#### 5.2.2 Forgot / reset password

**Actors:** Any user

1. Enter e-mail or employee code (+ optional company code)
2. 6-digit OTP issued, valid 5 minutes (shown in toast in the UI build)
3. Enter OTP + new password meeting the policy + confirmation
4. Password saved, reset-pending flag cleared, back to sign-in

**Notifications:** OTP e-mail (production)

#### 5.2.3 Design a role

**Actors:** SuperAdmin, Admin, CEO, COO, CHRO

1. Roles & Permissions → Create Role
2. Details (unique name) → branch scope → screens → View/Edit/Delete per screen → assign users per branch → review
3. Save → role Active, users granted
4. Edit / set Draft / delete (soft, archived, restorable)

**Notifications:** 'Role granted' alert to each newly assigned user

#### 5.2.4 Invite a user / manage an account

**Actors:** SuperAdmin, Admin, CHRO

1. Users & Logins → Invite (unique e-mail, allowed role, entity, branch, optional RBAC roles on branches)
2. Login created with status Invited and must-reset; employee directory record registered
3. Account actions: reset password (temporary), unlock, suspend with reason, reactivate, revoke sessions, MFA, grant / revoke RBAC roles

**Notifications:** Password reset alert; Role granted alert

#### 5.2.5 Temporary access / substitutes / branch access

**Actors:** role.manage holders

1. Grant time-boxed screen permissions to a user on a branch; auto-expires; revoke any time
2. Assign a substitute manager for a period (no overlapping covers)
3. Edit per-branch roles of a user (synced to RBAC role assignments)

#### 5.2.6 Role delegation

**Actors:** Any user with /org/delegation (Admin, HR, CHRO, COO, CEO …)

1. Pick delegator and delegate, modules, level, start/end (no overlap), approval flag
2. Preview exactly which screens/actions the delegate receives
3. Active immediately or Pending Approval → approved/rejected by a third person
4. Revoke; auto-expires after end date

**Notifications:** Delegate alerted on creation/approval; Delegator alerted on rejection

#### 5.2.7 Approval engine

**Actors:** Requesters (modules), Reporting manager, HOD, HR, CFO, CEO, Admin

![Flow — Approval engine](diagrams/flow_02_approval_engine.png)
_Flow — Approval engine_

1. Admin configures one active workflow per request type (levels with approver role, SLA, optional)
2. A module raises a request (raiseApproval) — steps copied from the active workflow
3. Current-level approver approves (advances) / rejects / requests rework with remarks; override roles SuperAdmin/Admin/CEO/CHRO
4. Last approval → Approved

#### 5.2.8 Soft delete & archive

**Actors:** Admin, HR, CFO, COO, CHRO

1. Deleting masters, roles, announcements, geofences → archived_records with payload
2. Archive screen (entity-scoped) → restore to origin or purge
3. Retention: purge records older than autoDeleteDays each time the screen opens or on demand

#### 5.2.9 Announcements

**Actors:** Admin, HR, Managers (publish), Employees (read/ack)

1. Publish (type, subject, validity, attachment) into the active entity
2. Every employee of the entity gets an alert; notices page shows own entity only
3. Employees download / acknowledge; HR tracks acknowledged / pending / overdue
4. Retract → archive (restorable)

**Notifications:** Alert to every employee of the entity

#### 5.2.10 Branding & personalisation

**Actors:** SuperAdmin, Admin (branding), Every user (personalisation)

1. Settings → Branding: palette (presets, hex, radius), logo, tagline, footer — applied system-wide and on PDFs
2. Organisation profile (legal/display name, address, contacts) → brand + entity record
3. My Profile → Personalisation: photo/avatar, font, light/dark, wallpaper with blur/dim/glass

### 5.3 People — employees, recruitment, masters, documents

#### 5.3.1 Recruit to hire (end-to-end)

**Actors:** HR, Interview panel, Candidate, New hire

![Flow — Recruit to hire (end-to-end)](diagrams/flow_04_recruit_to_hire_end_to_end.png)
_Flow — Recruit to hire (end-to-end)_

1. HR publishes a job post (Step 1) — entity-scoped
2. Applicants arrive (portal/referral/manual) — duplicates per job rejected
3. ATS 'Run shortlisting' scores and auto-shortlists ≥ cut-off, or manual shortlist
4. Schedule interview (online link / venue, panel, date ≥ today)
5. Panel records feedback + weighted scorecard → Proceed / Hold / Reject / Fit for the job
6. 'Fit for the job' finalises; HR composes offer (template + editable salary structure) and sends it
7. Candidate opens /candidate/{token}, e-signs (typed name), uploads mandatory documents, submits
8. HR verifies each document, marks all verified
9. HR picks reporting manager and sends the welcome e-mail → NewHire + Employee row + login (Welcome@<id-last4>), applicant → Onboarding, referral → Hired
10. New hire signs in on the Employee tab; HR marks Joined

**Notifications:** Offer e-mail / reminder with candidate link; Docs query e-mail on rejected document; Welcome e-mail with credentials; Referrer alert on Hired

#### 5.3.2 Offer declined / expired

**Actors:** Candidate, System

1. Candidate declines with a reason (or uses the link after expiry)
2. Offer → Declined / Expired
3. Applicant Offered → Rejected with reason (event or reconciliation on load)

**Notifications:** History entry on offer and applicant

#### 5.3.3 Direct hire / record form

**Actors:** HR, Admin

1. Hire/Re-hire dialog (re-hire search) or detailed record form
2. Validation (KYC, bank, dates, e-mail uniqueness)
3. hireEmployee → directory row, login, work config, manager + HR partner, statutory ids and bank persisted
4. Toast shows login + temporary password

**Notifications:** (toast) credentials

#### 5.3.4 Promotion / increment

**Actors:** HR (maker), HR approver, Unit head (CEO/COO/CFO/CTO/CHRO/Admin)

1. HR raises case (not for self; one open case per employee) — draft or submit
2. HR step approval
3. Unit Head approval by a different person
4. HR makes it effective → CTC, grade, designation, manager/branch updated; letter generated; employee alerted

**Notifications:** Employee alert 'Promoted to …' with letter in /emp/movements

#### 5.3.5 Transfer

**Actors:** HR/Manager, HR approver

1. Raise transfer (field matching type must change; entity moves go to group transfer)
2. HR approve → letter + alert
3. Make effective on date → record updated

**Notifications:** Employee alert with letter ref

#### 5.3.6 Termination

**Actors:** HR, HR Head, Unit Head, Legal

1. Open case with grounds, due process and LWD
2. Three approvals by three different people
3. Issue letter → employee to Notice, exit file opened, access revocation scheduled

**Notifications:** Employee alert with letter

#### 5.3.7 Warning

**Actors:** HR/Manager, Employee

1. Issue warning → letter generated
2. Employee acknowledges on the portal (once)
3. Escalate (Level 2/3 + PIP) or close

**Notifications:** Employee alert to acknowledge within 3 working days

#### 5.3.8 Handbook publication

**Actors:** HR, Employees

1. Publish version (template or upload; unique version)
2. Employees notified; open the handbook; sign with their exact name
3. Register tracks acknowledgements

**Notifications:** Alert per active employee of the entity

#### 5.3.9 Probation tracking

**Actors:** HOD, HR

1. End date = DOJ + probation months
2. Dashboard/HOD widget lists completions within 30 days (and up to 30 days overdue)

**Notifications:** HOD action item

### 5.4 Time — attendance, leave, timesheets, tours, comp-off

#### 5.4.1 Leave application & approval

**Actors:** Employee, HR (on behalf), Reporting Manager / HOD, HR / CHRO, Admin (override)

![Flow — Leave application & approval](diagrams/flow_05_leave_application_approval.png)
_Flow — Leave application & approval_

1. Employee (or HR on behalf) fills type, dates, day part, reason, documents, handover
2. Engine validates dates, holidays, balance, overlap, limits, clubbing, lock
3. Request saved Pending with chain from Leave Master (e.g. Manager → HR)
4. Current step approver approves → next step, or rejects with reason
5. Last step approves → Approved; balance used increases; attendance register marks L (LOP → A); payroll LOP reads it

**Notifications:** Alert to first approver on submit; Alert to employee when HR files on behalf; Alert to next approver + employee on step approval; Alert to employee on final approval / rejection

#### 5.4.2 Clock-in / clock-out

**Actors:** Employee

1. Choose Manual / Biometric device / Geofence
2. Geofence: browser location checked against active fence (block or reason-override)
3. Punch in creates open punch (local date/time)
4. Punch out closes it; hours, verdict (Full/Short/Half/OT) and shift timing (late-in / early-out) computed
5. Register marks P when ≥ half-day hours; Work Hours tab shows OT/short; off-day punches ≥4 h auto-credit comp-off

**Notifications:** Comp-off credited alert

#### 5.4.3 Attendance lock for payroll

**Actors:** HR, Payroll

![Flow — Attendance lock for payroll](diagrams/flow_06_attendance_lock_for_payroll.png)
_Flow — Attendance lock for payroll_

1. HR reviews register / report for the month
2. HR locks `${org}:${period}`
3. Leave applications/approvals, wage musters and punch deletions in that month are blocked
4. Payroll run reads locked attendance → LOP via attendance pattern
5. HR may unlock to regularise

#### 5.4.4 Comp-off earn & redeem

**Actors:** Employee, HOD (fallback Manager → HR)

1. Auto-credit 0.5 day per off-day worked (>4 h) or approved tour off-day, monthly cap 2, expiry per Leave Master
2. Employee requests redemption (working days, half-day allowed) within free balance
3. HOD approves → ledger debit; register shows L
4. Reject with reason; pending can be withdrawn

**Notifications:** Credit alert; Approver alert on request; Employee alert on decision

#### 5.4.5 Timesheet fill, submit & approve

**Actors:** Employee, Manager / HOD, HR

1. Employee picks format (daily / weekly days), adds tasks (project, times or hours)
2. Validation: no future date, end>start, ≤24 h/day
3. Entries saved Submitted
4. Manager/HR (not own) approves or rejects with reason
5. Employee resubmits rejected / submits drafts; day/week/month views and FY YTD report

**Notifications:** Rejection alert to employee

#### 5.4.6 Tour request & approvals

**Actors:** Employee, HOD, HR, CFO / Finance, HR/Admin (assign)

![Flow — Tour request & approvals](diagrams/flow_14_tour_request_approvals.png)
_Flow — Tour request & approvals_

1. Employee requests tour (purpose, destination, dates, mode, cost, cost centre)
2. Chain HOD → HR → CFO built; current approver alerted
3. Each step approves (or rejects with reason); final approval → Approved
4. Employee submits outcome / proof → Completed; logs expenses & bills; HR approves expenses, sets advance
5. Encash approved − advance as petty-cash claim; HR closes tour
6. Alternatively HR creates & assigns an approved tour to employee + co-travellers

**Notifications:** Approver alert per step; Employee alert on final decision; Assignment alert to each traveller

#### 5.4.7 Daily-wage muster

**Actors:** HR / Site admin

1. Maintain wage-worker roster (entity work orders only)
2. Daily muster: P/H/A/WO/PH with in/out and OT for active workers
3. Payable days = P + ½H + PH → wage register in payroll

### 5.5 Payroll, statutory, tax & finance

#### 5.5.1 Monthly payroll run (maker–checker)

**Actors:** HR (maker), Admin / CHRO (Payroll Admin level), CFO (Finance level), Employee

![Flow — Monthly payroll run (maker–checker)](diagrams/flow_03_monthly_payroll_run_maker_checker.png)
_Flow — Monthly payroll run (maker–checker)_

1. HR creates the run for the period (register computed from attendance, patterns, statutory config)
2. HR locks the month's attendance
3. HR runs compliance checks → per-employee check states (Check failed / Warning / OK)
4. HR fixes records (UAN / PF ID / ESI IP / PAN), overrides with justification, or escalates to the concerned person
5. Re-run checks → Checks Passed; acknowledge warnings
6. Submit for approval → approvers at each configured level (distinct people, never the maker)
7. Process → payslips visible on /emp/payslips, YTD, IT statement; ECR/ESI/TDS unlocked
8. Confirm bank transfer (payment ref) → Paid; loan EMIs posted to the loan ledger

**Notifications:** Escalated check → alert to concerned person (kind payroll)

#### 5.5.2 Statutory filing (ECR / ESI / TDS)

**Actors:** HR, CFO

1. Generate from a processed run (validation: UAN, IP, PAN, TAN)
2. HR verifies member data
3. Finance approves challan (≠ generator)
4. Upload on portal → record TRRN / challan / CIN
5. Record payment → Paid
6. Quarterly Form 24Q assembled from paid TDS challans

#### 5.5.3 Proof of investment & Form 16

**Actors:** Employee, HR, CFO

1. Employee declares Form 12BB (new-regime fields) and uploads proofs
2. HR verifies / rejects each proof (alert to employee)
3. HR verifies & locks the declaration (alert)
4. HR generates Form 16 from payroll (Part A from processed TDS, Part B new-regime computation; editable perquisites / exemptions recompute tax)
5. Mark verified → Sign & issue (alert) → employee downloads on /emp/tax

**Notifications:** Proof verified/rejected; Declaration locked; Form 16 issued

#### 5.5.4 Reimbursement claim

**Actors:** Employee, Reporting manager, HR, CHRO, CEO, CFO (approval + Accounts)

![Flow — Reimbursement claim](diagrams/flow_07_reimbursement_claim.png)
_Flow — Reimbursement claim_

1. Employee raises claim with itemised bills (/emp/reimbursements)
2. Reporting manager approves in 'Team claims awaiting my approval'
3. HR → CHRO → CEO → CFO approve on /org/claims
4. CFO processes payment at Accounts → Settled / Paid

**Notifications:** Stage moved / rejected with reason / paid → alert to claimant

#### 5.5.5 Loan / salary advance

**Actors:** Employee, HR / Finance

1. Employee applies (policy limits validated)
2. HR/Finance approves or rejects (alert)
3. Disburse
4. EMI recovered through payroll (on markPaid) or manually; balance recovered from F&F on exit

**Notifications:** Loan approved / rejected

#### 5.5.6 Expenditure booking

**Actors:** Any booking role, Admin/CEO/COO/CFO/CHRO

1. Book spend with purpose, people, vendor, GST, bills, asset/festival details
2. Approver (not booker/requester) approves or rejects
3. Mark paid with reference
4. Record outcome

#### 5.5.7 VPF / NPS election

**Actors:** Employee, HR

1. Employee declares VPF / NPS for the FY
2. HR approves (not own) → flows into PF (A/C 1, ECR) and payslips from next run

### 5.6 Performance, learning, exit & grievance

#### 5.6.1 Self-appraisal to pay grade and letter

**Actors:** Employee, Reporting manager, HR, Unit Head (dept HOD, else COO/CEO; Admin/SuperAdmin/CEO may act), HR (payroll.manage)

1. Employee fills purpose, supported goals, quarter/timeline, parameter self-ratings, value proposition, attachments → submit (/emp/appraisals)
2. Manager reviews in Team Reviews (/emp/reviews): approve / send back / reject with comments, rating, recommended grade & hike
3. HR approves in Performance → Self-appraisal Approvals
4. Unit Head gives final approval (different person from earlier approvers)
5. HR applies new grade / CTC / designation / effective date → salary structure & payroll updated, increment/promotion letter generated
6. Employee sees the outcome on My Appraisals + dashboard card and downloads the letter

**Notifications:** manager: self-appraisal to review; entity HR: awaiting HR; unit head(s): awaiting Unit Head approval; entity HR: approved — apply pay grade; employee: each decision and 'Appraisal applied' (payroll alert)

#### 5.6.2 HR appraisal (HR-initiated)

**Actors:** HR, Approver (Admin/CEO/COO/CFO/CHRO/HR, not the employee)

1. HR drafts appraisal (trigger, purpose, goals, parameters, linked reviews, pay outcome)
2. Approver approves & applies (compensation updated, letter rendered) or rejects with reason
3. Employee sees 'Appraisals applied by HR' and downloads the letter

**Notifications:** employee: Appraisal applied

#### 5.6.3 Staged appraisal cycle (Self → HOD → HR)

**Actors:** HR, Employee, HOD, HR

![Flow — Staged appraisal cycle (Self → HOD → HR)](diagrams/flow_09_staged_appraisal_cycle_self_hod_hr.png)
_Flow — Staged appraisal cycle (Self → HOD → HR)_

1. HR starts a cycle for an employee and review cycle
2. Employee submits self rating + comments
3. HOD rates or sends back
4. HR finalises → Completed

**Notifications:** employee: self appraisal open / sent back / completed; HOD: awaiting HOD review; entity HR: awaiting HR

#### 5.6.4 Quarterly / annual review form

**Actors:** HR or Manager (launch), Employee, Manager, HR

1. Launch form with the employee's goals and active parameters
2. Employee self-rates goals & parameters with justification/evidence
3. Manager rates, recommends, hike/promotion for annual
4. HR calibrates final rating / hike and closes

**Notifications:** employee: review launched; manager: to rate; entity HR: ready for calibration; employee: closed

#### 5.6.5 Manager team review and HR review

**Actors:** Manager, HR, Employee

1. Manager writes detailed review (goals vs achieved, parameters, feedback, recommendation) and optionally shares
2. HR runs an HR review with skills/parameters/goals/context and shares
3. Employee reads and acknowledges on My Appraisals

**Notifications:** employee: review shared; manager: review acknowledged

#### 5.6.6 PIP

**Actors:** Manager/HR, Employee, Concerned persons

1. Create plan with reason, evidence, dates & cadence checkpoints, concerned persons, goals/tasks, objectives, support, consequences
2. Employee acknowledges
3. Checkpoint notes, objectives ticked, remarks
4. Close as Successful / Failed, or archive

**Notifications:** employee: plan created / closed; concerned persons: on PIP

#### 5.6.7 Goals

**Actors:** Employee, Manager / HR / Admin

1. Employee self-creates → Pending Approval (approval-engine record raised) or manager/HR assigns → Approved
2. Reviewer approves / rejects (not own goal)
3. Owner starts, updates progress, metrics, milestones, self-rating
4. Manager rates and marks complete

**Notifications:** reviewer: goal to approve; owner: assigned / approved / rejected

#### 5.6.8 Training assignment to certificate

**Actors:** HR / Manager, Employee, Reviewer

1. Assign catalogue or new programme to employees (optional linked goal)
2. Employee completes modules / uploads assignment → submit
3. Reviewer rates five parameters, outcome, recommendation
4. Certify → certificate, assignment Completed, goal Completed; or extend / reassign

**Notifications:** employee: training assigned / reviewed / certified; assigner: submitted for review

#### 5.6.9 Exit: resignation to exit complete

**Actors:** Employee, Reporting manager, HR, Clearance officers (Finance, Payroll, HR Ops, Manager, IT/Assets, Admin), Finance

![Flow — Exit: resignation to exit complete](diagrams/flow_08_exit_resignation_to_exit_complete.png)
_Flow — Exit: resignation to exit complete_

1. Employee submits resignation (reason, note, requested LWD, letter)
2. Manager accepts → HR Review, or rejects; employee may withdraw before the manager decides
3. HR accepts and fixes notice days → Notice Period (directory status Notice), or rejects
4. During notice: Retain (audit form → Retained, employment continues) or Move for clearance checklist (officers assigned)
5. Each officer ticks checklist and gives / blocks clearance
6. All 7 cleared → Final Settlement
7. F&F computed, saved, settled with payment ref (loans recovered); exit interview recorded (portal survey / HR interview / uploaded form)
8. Complete exit → relieving letter; early release requires a reason; continuity rejoin within window

**Notifications:** manager: resignation to review; employee: manager/HR decision, notice started, clearance started, all cleared, F&F paid, exit completed; entity HR: awaiting HR acceptance, clearance blocked; officers: clearance assigned; manager: serving notice / withdrawn

#### 5.6.10 Grievance redressal

**Actors:** Employee (optionally anonymous), Routing owner / committee, HR, CHRO (appeal)

1. Employee raises (category → committee, owner, ack & resolve SLAs) or HR logs on behalf
2. Handler acknowledges within ack SLA
3. Investigation notes (internal or visible)
4. Resolution with action taken
5. Employee accepts & rates (closed) or appeals → CHRO, 15-day SLA; HR may close after 7 days without response; employee may withdraw before investigation

**Notifications:** owner + entity HR: new grievance; complainant: acknowledged / resolved; CHRO: appealed

### 5.7 Work — projects, tasks, assets, helpdesk, reports

#### 5.7.1 Project with inline tasks

**Actors:** Manager/HOD/HR/CXO/Admin, Employee

1. Manager opens Projects & Assignments → New Project, fills project, people (manager auto-added, members), timeline, commercials, milestones
2. Adds tasks inline under the project (assignees limited to manager + members)
3. Create → project + every complete task written to the shared task store (projectId set)
4. Tasks appear in Projects → Tasks, Tasks module and each assignee's /emp/tasks and /emp/projects

**Notifications:** Assignees: 'New task assigned — …' → /emp/tasks; Concerned manager / person: 'You are concerned on task …'; Manager & members: 'Added to project …' → /emp/projects

#### 5.7.2 Task progress update and approval

**Actors:** Employee (assignee), Concerned manager / task creator

1. Assignee opens the task, sets status / progress % / total hours and a note → Post update (approval = Pending)
2. Approver sees it in Projects → Updates or the task detail
3. Approve → hours / progress / status applied (Completed ⇒ 100 %) · or Reject with a reason

**Notifications:** Approver: 'Task update to approve — …' → /org/projects or /org/tasks; Assignees: 'Task update approved' / 'Task update sent back' → /emp/tasks

#### 5.7.3 Asset issue and acknowledgement

**Actors:** Asset manager (Admin/HR), Employee

![Flow — Asset issue and acknowledgement](diagrams/flow_12_asset_issue_and_acknowledgement.png)
_Flow — Asset issue and acknowledgement_

1. Asset added to the register from the asset master (type, checklist, accessories)
2. Issue: pick employee (fixed when fulfilling a request), purpose, expected return / until separation, verify serial, tick checklist & accessories
3. Asset → Issued; issuance Active, employeeAck false
4. Employee acknowledges receipt on My Assets

**Notifications:** Employee: 'Asset issued — …' → /emp/assets

#### 5.7.4 Asset return and condition issue (mishandling path)

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

#### 5.7.5 Asset request approval

**Actors:** Employee, HOD, HR business partner, Admin

1. Employee raises a request (type, purpose, urgency, needed-by, specs, project, duration)
2. Chain HOD → HR partner → Admin; each approver approves / rejects (override by SuperAdmin/Admin/CEO/CHRO)
3. Approved → asset manager fulfils from stock via the issue form → request Issued

**Notifications:** Current approver: 'Asset request … awaiting your approval'; Employee: request approved / rejected; Admins: 'approved — issue from stock'

#### 5.7.6 Asset transfer

**Actors:** Asset manager, Both employees

1. Transfer an Issued asset to another employee of the same org
2. Old issuance → Transferred; new Active issuance (issuedBy 'Transfer')
3. Both sides acknowledge (receiver's My Assets ack also completes the transfer ack)

**Notifications:** Receiver: 'Asset transferred to you'

#### 5.7.7 Helpdesk ticket lifecycle

**Actors:** Requester (any user), Agent / department head, Desk admin

![Flow — Helpdesk ticket lifecycle](diagrams/flow_13_helpdesk_ticket_lifecycle.png)
_Flow — Helpdesk ticket lifecycle_

1. Requester picks department → category → optional agent (confidential categories fixed to owner), subject, description, priority/impact, attachments, watchers, on-behalf
2. Ticket Assigned with SLA due times
3. Agent replies (first response, status In Progress), may add internal notes, reassign, transfer, change priority, set Waiting on Requester
4. Agent resolves with a resolution note
5. Requester (or raiser/agent) confirms & closes, rates 1–5, or reopens with a reason (fresh resolution clock)
6. Anyone on the ticket can escalate (priority +1, head added as watcher)

**Notifications:** Assignee: new ticket assigned; Requester / watchers: desk replies, resolved, waiting on you, reopened; All links → /helpdesk/tickets/{id}

#### 5.7.8 Report export

**Actors:** Role-scoped org users

1. Open Reports, choose pack / category / report (role filtered)
2. Filter FY, date range, month, year, search
3. Export CSV (formula-safe), Excel (.xls HTML) or PDF (branded print page, window.print)

## 6. Record lifecycles (state machines)

Every record below has a `status` column restricted to the listed values. Transitions are the only legal moves; the API must reject any other change with `409 invalid-transition`. The trigger on the left of each arrow is the command (and therefore the endpoint) that performs it.

### 6.1 Platform & Tenancy

| Table                    | Statuses                                                     | Transitions                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| biometric_devices        | Pending OEM Setup · Registered · Offline                     | (register) → Pending OEM Setup<br>(OEM setup — backend) → Registered<br>(heartbeat lost) → Offline                                                                                                                                                                                                                                                    |
| group_transfer_requests  | Pending Seereon Confirmation · Confirmed · Rejected          | (raise) → Pending Seereon Confirmation (one open request per employee; destination must be in same group)<br>Pending → Confirmed (confirmGroupTransfer: assets returned/released, employee record moved to destination org + designation + first branch, alert to raiser)<br>Pending → Rejected (rejectGroupTransfer, note required, alert to raiser) |
| org_support_tickets      | Unattended · Attended · Resolved                             |                                                                                                                                                                                                                                                                                                                                                       |
| organizations            | Trial · Active · Suspended · Inactive                        | (create) → Trial when plan = Growth, else Active<br>Active/Trial → Suspended (org detail Suspend)<br>Suspended → Active (Reactivate)<br>Any → Inactive (list Deactivate)<br>Inactive → Active (Reactivate)                                                                                                                                            |
| platform_support_tickets | Open · In Progress · Waiting · Resolved                      | (raise) → Open<br>any → any via updatePlatformTicket(status) (history row written)                                                                                                                                                                                                                                                                    |
| tenant_users             | Issued (forceChange) · Shared · Activated (password changed) | provisionSuperAdmin/provisionEntityAdmin → Issued<br>markShared → Shared<br>client changePassword → forceChange=false<br>resetTenantPassword → Issued again (new temp password, override cleared)                                                                                                                                                     |

### 6.2 Identity, Access & Administration

| Table                   | Statuses                                                 | Transitions                                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| announcements           | Published · Retracted (archived)                         | publish → Published (alerts every employee of the entity)<br>Published → archived_records (retract; restorable)                                                                                                                                                                                      |
| approval_chain_steps    | Pending · Approved · Rejected · Skipped                  | Pending → Approved\|Rejected (decideChain by approver or SuperAdmin/Admin/CEO/CHRO override)<br>(build) Skipped when no person resolves; self and duplicate approvers dropped                                                                                                                        |
| approval_requests       | Pending · Approved · Rejected · Rework                   | Pending (level n) → Pending (level n+1) on Approve<br>Pending (last level) → Approved<br>Pending → Rejected (remarks required)<br>Pending → Rework (remarks required)                                                                                                                                |
| archived_records        | Archived · Restored (row deleted) · Purged (row deleted) | archived → restored (restoreToOrigin succeeds, row removed)<br>archived → purged (manual delete, empty archive, or retention auto purge when days archived >= autoDeleteDays)                                                                                                                        |
| delegations             | Pending Approval · Active · Expired · Revoked · Rejected | (create) → Pending Approval (requiresApproval) \| Active<br>Pending Approval → Active (approve; not by delegator/delegate)<br>Pending Approval → Rejected<br>Active → Revoked<br>Active → Expired (derived when end_date < today)                                                                    |
| org_user_access         | Invited · Active · Suspended                             | Invited on addOrgUser                                                                                                                                                                                                                                                                                |
| password_reset_requests | Pending · Consumed · Expired                             | Pending → Consumed (completePasswordReset with matching OTP + policy-compliant password)<br>Pending → Expired (after expires_at)<br>Pending → superseded by a newer request (resend)                                                                                                                 |
| rbac_roles              | Draft · Active                                           | Draft ⇄ Active (setRoleStatus)<br>(custom) → deleted → archived_records (deleteRole + archiveRecord, restorable via restoreRole)                                                                                                                                                                     |
| temporary_access_grants | Active · Expired (derived) · Revoked                     | Active → Revoked (Revoke)<br>Active → Expired (valid_to passes)                                                                                                                                                                                                                                      |
| user_alerts             | unread · read                                            | unread → read (markAlertsRead on closing the bell menu)                                                                                                                                                                                                                                              |
| user_logins             | Invited · Active · Suspended · Locked                    | Invited → Active (first successful sign-in / reactivate)<br>Active → Locked (recordFailedSignIn reaches policy lockAfter, default 5)<br>Locked → Active (unlockUser, resetPassword)<br>Active\|Locked → Suspended (suspendUser with reason; sessions revoked)<br>Suspended → Active (reactivateUser) |

### 6.3 Employees & Organisation

| Table               | Statuses                                                   | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| employees           | Active · On Leave · Notice                                 | Active → Notice (termination executed / resignation approved)<br>Notice → Active (exit withdrawn / retained)                                                                                                                                                                                                                                                                                                                                    |
| manager_substitutes | Active · Expired                                           | Active → Expired (endSubstitute)                                                                                                                                                                                                                                                                                                                                                                                                                |
| promotion_cases     | Draft · Pending approval · Approved · Effective · Rejected | Draft → Pending approval (submitPromotionDraft; basis required)<br>Pending approval → Pending approval (HR step approved by HR/CHRO/Admin/SuperAdmin)<br>Pending approval → Approved (Unit Head step by CEO/COO/CFO/CTO/CHRO/Admin/SuperAdmin; different person)<br>Pending approval → Rejected (either step, note required)<br>Approved → Effective (effectPromotion: compensation, grade, designation, manager/branch updated; letter; alert) |
| termination_cases   | Pending approval · Approved · Effective · Rejected         | Pending approval → Pending approval (HR Head, then Unit Head approved; each step a different approver)<br>Pending approval → Approved (Legal approved)<br>Pending approval → Rejected<br>Approved → Effective (executeTermination: letter, employee status Notice, exit file opened, alert)                                                                                                                                                     |
| transfer_cases      | Pending approval · Approved · Effective · Rejected         | Pending approval → Approved (decideTransfer by HR; letter issued + alert)<br>Pending approval → Rejected (note required)<br>Approved → Effective (effectTransfer: dept/branch/manager/designation updated)                                                                                                                                                                                                                                      |
| warning_cases       | Effective · Closed                                         | (issue) → Effective (letter + alert)<br>Effective → Effective (acknowledgeWarning by the employee; escalateWarning Level 1→2→3 + PIP)<br>Effective → Closed (closeWarning)                                                                                                                                                                                                                                                                      |

### 6.4 Recruitment & Onboarding

| Table          | Statuses                                                                                                  | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| applicants     | Applied · Shortlisted · Interviewing · Finalised · Offered · Onboarding · Rejected                        | Applied → Shortlisted (runAutoShortlist ATS ≥ cutoff, or shortlistManually)<br>Shortlisted → Applied (pipeline board)<br>Shortlisted/Interviewing → Interviewing (scheduleInterview)<br>Interviewing → Finalised (feedback 'Fit for the job')<br>Interviewing → Rejected (feedback 'Reject')<br>Finalised/Interviewing → Offered (createOfferForApplicant)<br>Offered → Onboarding (sendWelcome)<br>Offered → Rejected (offer declined / expired)<br>Applied → Rejected (rejectApplicant) |
| interviews     | Scheduled · Completed · No-show · Cancelled                                                               | Scheduled → Completed (submitInterviewFeedback, once)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| job_posts      | Open · On hold · Closed                                                                                   | Open ⇄ On hold ⇄ Closed (updateJobPost)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| offers         | Draft · Sent · Viewed · Accepted · Declined · Docs Submitted · Verified · Welcome Sent · Joined · Expired | Draft → Sent (sendOffer)<br>Sent → Viewed (candidateView)<br>Sent/Viewed → Accepted (candidateDecide, typed name = candidate name, before expiry)<br>Sent/Viewed → Declined (reason required)<br>Sent/Viewed → Expired (link used after expiry)<br>Accepted → Docs Submitted (all mandatory docs uploaded)<br>Docs Submitted → Verified (all mandatory docs Verified)<br>Verified → Welcome Sent (sendWelcome: new hire + login)<br>Welcome Sent → Joined (markJoined)                    |
| referral_cases | Submitted · Screening · Interviewing · Hired · Bonus paid · Not selected                                  | Submitted → Screening/Interviewing/Not selected (HR, updateReferralStatus; referrer alerted)<br>* → Hired (syncReferralOnHire on welcome e-mail)<br>Hired → Bonus paid (HR, with payroll)                                                                                                                                                                                                                                                                                                 |

### 6.5 Time, Attendance, Leave & Travel

| Table               | Statuses                                                       | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| approval_steps      | Pending · Approved · Rejected · Skipped                        | Pending → Approved/Rejected (decideChain on the first pending step)                                                                                                                                                                                                                                                                                                                                                                |
| attendance_locks    | Unlocked · Locked                                              | Unlocked → Locked (lockAttendance)<br>Locked → Unlocked (unlockAttendance)                                                                                                                                                                                                                                                                                                                                                         |
| attendance_patterns | Draft · Active                                                 | Draft ↔ Active (savePattern)                                                                                                                                                                                                                                                                                                                                                                                                       |
| attendance_punches  | Open · Closed                                                  | Open → Closed (markOut)<br>Open/Closed → deleted (deletePunch, same day only, month not locked)                                                                                                                                                                                                                                                                                                                                    |
| compoff_redemptions | Pending Approval · Approved · Rejected · (withdrawn = deleted) | Pending Approval → Approved (decideCompOffRedemption; debit posted)<br>Pending Approval → Rejected<br>Pending Approval → withdrawn (withdrawCompOffRedemption)                                                                                                                                                                                                                                                                     |
| leave_applications  | Pending · Approved · Rejected                                  | Pending(step n) → Pending(step n+1) (decideLeaveApplication Approved, not last step)<br>Pending → Approved (last step approved)<br>Pending → Rejected (any step, reason required)                                                                                                                                                                                                                                                  |
| timesheet_entries   | Draft · Submitted · Approved · Rejected                        | Draft → Submitted (employee)<br>Submitted → Approved (manager/HR, not own)<br>Submitted → Rejected (reason)<br>Rejected → Submitted (resubmit)                                                                                                                                                                                                                                                                                     |
| tour_bills          | Attached · Claimed                                             | Attached → Claimed (addBillAsExpense)<br>Attached → deleted (removeTourBill)                                                                                                                                                                                                                                                                                                                                                       |
| tour_expenses       | Pending · Approved                                             | Pending ↔ Approved (approveTourExpense)                                                                                                                                                                                                                                                                                                                                                                                            |
| tours               | Pending Approval · Approved · Rejected · Completed · Closed    | (submit) → Pending Approval, or Approved when no approver resolvable<br>Pending Approval → Pending Approval (step approved)<br>Pending Approval → Approved (Finance step approved)<br>Pending Approval → Rejected (reason)<br>(createAndAssignTour) → Approved<br>Approved → Completed (submitTourOutcome)<br>Completed → Closed (closeTour, HR/Admin/Finance)<br>Pending Approval → withdrawn (withdrawTour, before any decision) |
| wage_workers        | Active · Inactive                                              | Active ↔ Inactive (updateWageWorker)                                                                                                                                                                                                                                                                                                                                                                                               |
| work_orders         | On Hold · Active · Completed                                   | (create) → Active if approved else On Hold<br>Active → On Hold<br>On Hold → Active<br>Active/On Hold → Completed (end_date defaults to today)                                                                                                                                                                                                                                                                                      |

### 6.6 Payroll, Statutory, Tax & Finance

| Table                     | Statuses                                                                                          | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contribution_declarations | Draft · Submitted · Approved · Locked                                                             | Draft → Submitted (employee saveContribution)<br>Submitted → Approved (HR ContributionsQueue, not own)<br>Submitted → Draft (returned by HR)<br>Approved → Draft (employee revises)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| employee_insurance        | Active · Lapsed                                                                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| expenditures              | Booked · Approved · Paid · Rejected                                                               | (create) → Booked (bookExpenditure)<br>Booked → Approved (approveExpenditure; approver role, not booker/requester)<br>Booked → Rejected (rejectExpenditure with reason)<br>Approved → Paid (markExpenditurePaid with reference)<br>Booked → (deleted) (removeExpenditure by booker/approver)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| it_declarations           | Draft · Submitted · Locked                                                                        | Draft → Draft/Submitted (saveDeclaration; submit requires prev TDS ≤ prev salary)<br>Submitted → Locked (lockDeclaration by HR, alert to employee)<br>Proof: Uploaded → Verified\|Rejected (reviewDeclarationProof, alert to employee)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| loans                     | Applied · Approved · Disbursed · Closed · Rejected                                                | (create) → Applied (applyLoan; no other pending/active loan)<br>Applied → Approved\|Rejected (decideLoan, not by applicant)<br>Approved → Disbursed (disburseLoan)<br>Disbursed → Closed (last EMI via postPayrollRecovery / recordEmi, or recoverFromFnf)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| payroll_run_checks        | Open · Resolved · Overridden · Escalated                                                          | Open → Resolved (resolveCheck 'Record fixed' when the fresh check no longer fires / disappears on re-run)<br>Open/Escalated → Overridden (resolveCheck verify/override with note)<br>Open → Escalated (escalateCheck → alert to concerned person)<br>Resolved → Open (still detected on re-run)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| payroll_runs              | Draft · Checks Failed · Checks Passed · Pending Approval · Approved · Rejected · Processed · Paid | (create) → Draft (createRun; one live run per org+period)<br>Draft/Checks Failed/Checks Passed/Rejected → Checks Failed (runChecks, open errors & blockOnErrors)<br>… → Checks Passed (runChecks / resolveCheck when no open errors)<br>Checks Passed → Pending Approval (submitForApproval: warnings acknowledged, attendance locked, ≥1 level)<br>Pending Approval → Pending Approval (decideRun Approved, more levels remain; approver ≠ maker, ≠ earlier approver)<br>Pending Approval → Approved (decideRun Approved at last level)<br>Pending Approval → Rejected (decideRun Rejected)<br>Rejected/Checks Failed/Checks Passed → Draft (reopenRun, clears checks & approvals; refused if another live run exists)<br>Approved → Processed (processRun — payslips visible to employees, filings unlocked)<br>Processed → Paid (markPaid — posts loan EMI recoveries) |
| reimbursement_claims      | Manager · HR · CHRO · CEO · CFO · Accounts · Settled · Rejected                                   | (create) → Manager/Submitted (addReimbursement)<br>Manager → HR (approveClaim by reporting manager or Admin)<br>HR → CHRO → CEO → CFO (approveClaim by stage role; CFO sets status Approved)<br>Accounts → Settled/Paid (approveClaim 'Process payment' by CFO/Admin)<br>any open stage → Rejected (rejectClaim with reason)<br>claimant can never act on own claim                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| statutory_filings         | Draft · Verified · Approved · Filed · Paid                                                        | (create) → Draft (generateFiling from Processed/Paid run; one open draft per kind+org+period)<br>Draft → Verified (verifyFiling, no validation errors)<br>Draft → (deleted) (deleteDraftFiling)<br>Verified → Approved (approveFiling, approver ≠ generator)<br>Approved → Filed (fileFiling with portal reference)<br>Filed → Paid (payFiling with payment reference)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| tax_documents             | Generated · Uploaded · Verified · Issued                                                          | (create) → Generated (addTaxDocument from GenerateTaxDocDialog; one per employee+form+FY)<br>(create) → Uploaded (employee / HR upload)<br>Generated\|Uploaded → Verified (logTaxAction)<br>Verified → Issued (logTaxAction, alert; visible on /emp/tax)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 6.7 Performance, Goals & Learning

| Table                | Statuses                                                                                          | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appraisal_cycles     | Self Appraisal · HOD Appraisal · HR Appraisal · Completed                                         | Self Appraisal → HOD Appraisal (appraisee)<br>HOD Appraisal → HR Appraisal (HOD; not self)<br>HOD Appraisal → Self Appraisal (sendBackToSelf with note)<br>HR Appraisal → Completed (HR; not self)                                                                                                                                                                                                                            |
| goals                | Draft · Pending Approval · Approved · Rejected · In Progress · Completed                          | (self-created) → Pending Approval → Approved \| Rejected (reviewer ≠ owner; approval-engine record settled)<br>(assigned) → Approved<br>Approved → In Progress (owner starts)<br>Approved/In Progress → Completed (manager, progress 100)<br>training certification → Completed                                                                                                                                               |
| hr_appraisals        | Draft · Applied · Rejected                                                                        | Draft → Draft (saveHrAppraisal edit)<br>Draft → Applied (approveHrAppraisal: not self; updates employee CTC/grade/designation; letter rendered; alert)<br>Draft → Rejected (rejectHrAppraisal: reason required)                                                                                                                                                                                                               |
| hr_reviews           | Scheduled · In Progress · Completed                                                               | Scheduled/new → In Progress (save)<br>In Progress → Completed (complete: remarks + ≥1 parameter rating; not self)<br>Completed → shared (shareHrReview) → acknowledged (ackHrReview, once)                                                                                                                                                                                                                                    |
| pips                 | Draft · Active · Under Review · Successful · Failed · Archived                                    | (create) → Active (createDetailedPIP; one open PIP per employee; not self)<br>Active/Under Review → Successful \| Failed (employee alerted)<br>any → Archived                                                                                                                                                                                                                                                                 |
| review_forms         | Open · Self submitted · Manager reviewed · HR calibrated · Closed                                 | Open → Self submitted (employee; every goal+parameter rated, justification)<br>Self submitted → Manager reviewed (reporting manager; all parameters rated + recommendation)<br>Manager reviewed → Closed (HR; calibrated rating 1–5)                                                                                                                                                                                          |
| self_appraisals      | Draft · Manager Review · HR Review · Unit Head Review · Approved · Applied · Sent back · Rejected | Draft/Sent back → Manager Review (submit; HR Review when no manager)<br>Manager Review → HR Review (manager approves)<br>HR Review → Unit Head Review (HR approves; unit heads alerted)<br>Unit Head Review → Approved (unit head approves; HR alerted)<br>any review step → Sent back \| Rejected<br>Approved → Applied (HR applies grade/CTC; letter)<br>Guards: approver ≠ appraisee; one person approves at most one step |
| team_reviews         | Scheduled · In Progress · Completed                                                               |                                                                                                                                                                                                                                                                                                                                                                                                                               |
| training_assignments | Not Started · In Progress · Submitted · Under Review · Completed · Reassigned                     | Not Started ↔ In Progress (module ticks)<br>In Progress → Submitted (submitAssignment: assignee; all modules done or file attached; assigner alerted)<br>Submitted → Completed (review Certify, outcome ≠ Not met; certificate; goal Completed)<br>→ Reassigned (review Reassign; modules reset)<br>→ In Progress (Extend deadline) \| Under Review (Advanced training)                                                       |
| training_programmes  | Planned · Ongoing · Completed · Cancelled                                                         | status set manually by HR / people office (catalogue)                                                                                                                                                                                                                                                                                                                                                                         |

### 6.8 Exit, Grievance & HR Policy

| Table           | Statuses                                                                                                                                              | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| exit_requests   | Manager Review · Manager Rejected · HR Review · HR Rejected · Notice Period · HR Clearance · Final Settlement · Exit Completed · Retained · Withdrawn | Manager Review → HR Review \| Manager Rejected (reporting manager; not self)<br>Manager Review → Withdrawn (employee)<br>HR Review → Notice Period (HR; notice days > 0; directory status Notice) \| HR Rejected<br>Notice Period → HR Clearance (HR: moveToClearance; officers alerted)<br>ACTIVE → Retained (retainWithForm; directory status Active)<br>HR Clearance → Final Settlement (all 7 clearances Cleared)<br>Final Settlement → Exit Completed (F&F settled + exit interview; before LWD needs early-release note)<br>(termination) → HR Clearance directly (openTerminationExit) |
| fnf_statements  | Draft · HR reviewed · Finance approved · Paid                                                                                                         | Draft → HR reviewed → Finance approved → Paid (payment ref; loans closed; exit fnfSettled)<br>Draft/any → Paid via settleFnf from the exit file                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| grievances      | Submitted · Acknowledged · Under investigation · Resolved · Appealed · Closed · Withdrawn                                                             | Submitted → Acknowledged (handler; SLA ack)<br>Acknowledged → Under investigation (first note)<br>Acknowledged/Under investigation/Appealed → Resolved (resolution required)<br>Resolved → Closed (complainant rating 1–5, or HR after 7 days)<br>Resolved → Appealed (complainant; owner → CHRO; 15-day SLA)<br>Submitted/Acknowledged → Withdrawn (complainant)                                                                                                                                                                                                                             |
| retention_cases | Open · In discussion · Offer made · Retained · Not retained · Withdrawn                                                                               | (start) → In discussion<br>In discussion → Offer made<br>→ Retained (retainWithForm; exit → Retained; optional compensation change + letter)<br>→ Not retained (exit continues)                                                                                                                                                                                                                                                                                                                                                                                                               |

### 6.9 Projects, Tasks & Assets

| Table           | Statuses                                                                                             | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| asset_issuances | Active · Returned · Transferred                                                                      | Active(Not started) → Active(Requested) (requestReturn)<br>Active → Returned/Approved (return check OK)<br>Active → Active(Issue raised) (return check problem) → Returned (issue resolved)<br>Active → Transferred (transferAsset)<br>Active → Returned (retireAsset / inter-company returnAsset)                                                                                                                                                                                                                         |
| asset_issues    | Open · Under assessment · Manager review · Finance review · Repair / replacement · Resolved · Closed | Open → Under assessment (assess, cause Undetermined)<br>Open/Under assessment → Manager review (cause Employee mishandling)<br>Open/Under assessment → Repair / replacement (cause Asset fault)<br>Manager review → Repair / replacement (manager disagrees → cause becomes Asset fault)<br>Manager review → Finance review (Agree / Partial)<br>Finance review → Repair / replacement (Finance decision, recovery recorded)<br>Repair / replacement → Resolved (resolveAssetIssue)<br>Resolved → Closed (closeAssetIssue) |
| asset_requests  | Pending · Approved · Rejected · Issued                                                               | Pending → Pending (step approved, next step alerted)<br>Pending → Approved (last step approved; Admins alerted)<br>Pending → Rejected (any step rejects)<br>Approved → Issued (issue form fulfils it: markRequestFulfilled)                                                                                                                                                                                                                                                                                                |
| assets          | In Stock · Issued · Return Pending · Under Maintenance · Retired · Lost                              | In Stock → Issued (issueAsset)<br>Issued → Return Pending (requestReturn)<br>Issued/Return Pending → In Stock (recordReturnCheck OK)<br>Issued/Return Pending → Under Maintenance \| Lost (return check with a problem)<br>Issued → Under Maintenance (employee reports an issue)<br>Under Maintenance → In Stock \| Issued \| Retired (resolveAssetIssue)<br>Issued → Issued (transferAsset, new holder)<br>any → Retired (retireAsset)                                                                                   |
| projects        | Planning · Active · On Hold · Completed                                                              | Planning ↔ Active ↔ On Hold → Completed (free edit by manager roles)                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| tasks           | Not Started · In Progress · On Hold · Completed · approval: Not Submitted/Pending/Approved/Rejected  | approval Not Submitted/Approved/Rejected → Pending (postTaskUpdate by assignee)<br>Pending → Approved (approveTaskUpdate: applies hours/progress/status of the pending update; Completed ⇒ 100 %)<br>Pending → Rejected (rejectTaskUpdate, reason required)<br>status any → any (manager Save / approval)                                                                                                                                                                                                                  |

### 6.10 Helpdesk & Reporting

| Table   | Statuses                                                                           | Transitions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tickets | New · Assigned · In Progress · Waiting on Requester · Resolved · Closed · Reopened | (create) → Assigned (auto / chosen agent; confidential → category owner)<br>Assigned/New/Reopened → In Progress (first public agent reply)<br>any open → Waiting on Requester (agent) → In Progress (requester reply)<br>open → Resolved (agent, resolution note)<br>Resolved → Closed (requester / raiser / agent)<br>Resolved/Closed → Reopened (participant, reason; fresh resolution clock)<br>dept A → dept B (transferTicket: re-assigned to category owner, status Assigned)<br>priority ↑ (escalateTicket: dept head added as watcher, SLA recalculated) |

## 7. Validations and business rules

247 rules enforced by the prototype, with the source location. Each must be re-implemented server-side (error `422 validation-failed` with the field name) and each is a negative test case.

### 7.1 Seereon Platform

| #   | Entity               | Field                                                                          | Rule                                                                                                              | Source                                                                                   |
| --- | -------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Organization         | name, legalName, code, industry                                                | required                                                                                                          | src/routes/app.organizations.new.tsx:102                                                 |
| 2   | Organization         | code                                                                           | unique across organizations.id, organizations.code and company_groups.code (case-insensitive)                     | src/routes/app.organizations.new.tsx:166                                                 |
| 3   | Organization         | address (addr1, city, state, country, postal)                                  | required; postal = 6 digits when country is India                                                                 | src/routes/app.organizations.new.tsx:105                                                 |
| 4   | Organization         | contact, designation, email, mobile, subdomain, adminEmail                     | required                                                                                                          | src/routes/app.organizations.new.tsx:116                                                 |
| 5   | Organization         | email / adminEmail                                                             | regex ^\S+@\S+\.\S+$                                                                                              | src/routes/app.organizations.new.tsx:120                                                 |
| 6   | Organization         | mobile                                                                         | regex ^\+?[\d\s-]{10,15}$                                                                                         | src/routes/app.organizations.new.tsx:124                                                 |
| 7   | Organization         | subdomain                                                                      | regex ^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$ and unique                                                           | src/routes/app.organizations.new.tsx:128                                                 |
| 8   | TenantCredential     | email                                                                          | must not already resolve to any login (userByLogin) — checked at step 3 and at create                             | src/routes/app.organizations.new.tsx:140,172                                             |
| 9   | TenantCredential     | temporaryPassword                                                              | passwordPolicyError: ≥8 chars, upper-case, digit, symbol; confirmation must match                                 | src/routes/app.organizations.new.tsx:144                                                 |
| 10  | OrganizationModule   | modules                                                                        | at least one; only modules offered in PlatformSettings                                                            | src/routes/app.organizations.new.tsx:152                                                 |
| 11  | Organization         | licenses / storage                                                             | integer ≥ 1 / ≥ 1 GB                                                                                              | src/routes/app.organizations.new.tsx:156                                                 |
| 12  | Organization         | name, legalName, country, email, licenses (edit)                               | required; e-mail regex; licenses integer ≥ 1                                                                      | src/routes/app.organizations.$id.tsx:608                                                 |
| 13  | TenantCredential     | email (Issue Super Admin)                                                      | regex; must not belong to another login unless it is this org's existing Super Admin                              | src/components/platform/TenantCredentials.tsx:38-42                                      |
| 14  | Organization         | code (new entity)                                                              | required; unique across orgs and groups                                                                           | src/pages/GroupsPage.tsx:394                                                             |
| 15  | TenantCredential     | adminEmail (new entity)                                                        | required, regex, must not already have a login                                                                    | src/pages/GroupsPage.tsx:396                                                             |
| 16  | CompanyGroup         | name, code                                                                     | required; code unique                                                                                             | src/pages/GroupsPage.tsx:358                                                             |
| 17  | OrganizationBranch   | name                                                                           | required; unique within entity (case-insensitive)                                                                 | src/pages/GroupsPage.tsx:429                                                             |
| 18  | GroupTransferRequest | employeeId, toOrgId, effectiveDate, newDesignation, reason, asset dispositions | all required (form); one pending per employee; toOrgId ∈ transferDestinations(fromOrgId); admins not transferable | src/components/employees/TransfersTab.tsx:299 / src/lib/group-transfer-data.ts:89-93,191 |
| 19  | GroupTransferRequest | decisionNote                                                                   | required on reject                                                                                                | src/routes/app.group-transfers.tsx:147 / src/lib/group-transfer-data.ts:170              |
| 20  | GroupTransferRequest | status                                                                         | confirm/reject only when Pending Seereon Confirmation                                                             | src/lib/group-transfer-data.ts:114,170                                                   |
| 21  | PlatformTicket       | org, subj (≥5 chars), requester                                                | required                                                                                                          | src/routes/app.support.tsx:170                                                           |
| 22  | PlatformDocument     | title, file                                                                    | required; version regex ^\d+(\.\d+){0,2}$; (title, version) unique                                                | src/routes/app.documentation.tsx:34                                                      |
| 23  | PlatformSettings     | branding.supportEmail / platformName                                           | e-mail regex / required                                                                                           | src/routes/app.settings.tsx:86                                                           |
| 24  | PlatformSettings     | localization.currency                                                          | 3-letter upper-case ISO code; all localisation fields required                                                    | src/routes/app.settings.tsx:93                                                           |
| 25  | SlaRule              | targetHours                                                                    | > 0                                                                                                               | src/components/support/SlaConfigDialog.tsx:51                                            |

### 7.2 Core — identity, access, approvals, announcements

| #   | Entity               | Field                                                               | Rule                                                                                                                                             | Source                                                                          |
| --- | -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | UserSession          | identifier+password                                                 | required; account exists and portal != app; tab must match role (Super Admin tab ⇒ SuperAdmin; Admin tab ⇒ Admin; Employee tab ⇒ any other role) | src/routes/login.tsx:44-51                                                      |
| 2   | UserSession          | tenant                                                              | optional; if typed must equal the user's org id/code or group id/code (Super Admin tab also any entity code of the group)                        | src/routes/login.tsx:53-57                                                      |
| 3   | LoginRecord          | status                                                              | Suspended or Locked accounts cannot sign in                                                                                                      | src/routes/login.tsx:59-61                                                      |
| 4   | LoginRecord          | failedAttempts                                                      | lock when >= sign-in policy lockAfter (min 3, default 5)                                                                                         | src/lib/rbac-store.ts recordFailedSignIn                                        |
| 5   | PasswordCredential   | password                                                            | length >= policy minLen (>=6, default 8) and uppercase / number / symbol per policy; new != current; current must match                          | src/lib/auth-session.ts passwordPolicyError/changePassword                      |
| 6   | PasswordCredential   | confirm                                                             | new password == confirmation                                                                                                                     | src/routes/emp.profile.tsx SecurityCard; src/routes/reset-password.tsx:231      |
| 7   | PasswordResetRequest | otp                                                                 | 6 digits, equals issued code, not expired (5 min)                                                                                                | src/lib/auth-session.ts completePasswordReset                                   |
| 8   | PasswordResetRequest | identifier                                                          | e-mail or employee code required; code must belong to the e-mail; company code (optional) must match; platform accounts rejected                 | src/routes/forgot-password.tsx:submit                                           |
| 9   | RoleDef              | name                                                                | required, >1 char, unique case-insensitive                                                                                                       | src/routes/org.roles.new.tsx nameTaken/canNext                                  |
| 10  | RoleDef              | branches                                                            | >= 1 branch                                                                                                                                      | src/routes/org.roles.new.tsx canNext step 1                                     |
| 11  | RoleDef              | permissions                                                         | >= 1 screen; Edit/Delete imply View; removing View clears Edit/Delete                                                                            | src/routes/org.roles.new.tsx setPerm                                            |
| 12  | RoleDef              | (action)                                                            | create/edit/delete/activate require action role.manage                                                                                           | src/pages/RolesHubPage.tsx; src/routes/org.roles.new.tsx                        |
| 13  | RoleDef              | builtIn                                                             | built-in roles cannot be deleted                                                                                                                 | src/lib/rbac-store.ts deleteRole                                                |
| 14  | AppUser              | email                                                               | required, /\S+@\S+\.\S+/, unique across all accounts                                                                                             | src/routes/org.users.tsx InviteForm; src/lib/rbac-store.ts inviteUser           |
| 15  | AppUser              | name,designation                                                    | required                                                                                                                                         | src/routes/org.users.tsx InviteForm                                             |
| 16  | AppUser              | role                                                                | inviter may only assign roles they can manage (Admin: not SuperAdmin; CHRO: not SuperAdmin/Admin/CEO)                                            | src/routes/org.users.tsx canManageAccount                                       |
| 17  | LoginRecord          | (actions)                                                           | account actions only by SuperAdmin/Admin/CHRO and never on a protected higher role; suspend requires reason and not self                         | src/routes/org.users.tsx UserDetail                                             |
| 18  | SignInPolicy         | minLen/lockAfter/lockMinutes/sessionMinutes/expiryDays/rememberDays | >=6 / >=3 / >=5 / >=5 / >=0 / >=0; edit by SuperAdmin/Admin                                                                                      | src/routes/org.users.tsx SignInPolicy                                           |
| 19  | OrgUserRecord        | email                                                               | valid e-mail; employee and >=1 branch required; custom role name unique; typed temporary password must meet policy                               | src/components/users/UserAssignmentTab.tsx canNext                              |
| 20  | TempGrant            | from/to                                                             | both required, to >= from; user required; >= 1 screen permission                                                                                 | src/components/users/TemporaryAccessTab.tsx canNext                             |
| 21  | Substitute           | from/to                                                             | to >= from; manager ≠ substitute; no overlapping active cover for the manager                                                                    | src/components/users/SubstitutesTab.tsx                                         |
| 22  | Delegation           | fromId/toId                                                         | both required, different people                                                                                                                  | src/routes/org.delegation.tsx DelegationDialog                                  |
| 23  | Delegation           | start/end                                                           | required, end >= start; no overlapping live delegation for the same pair                                                                         | src/routes/org.delegation.tsx; src/lib/delegation-data.ts overlappingDelegation |
| 24  | Delegation           | modules                                                             | >= 1 module                                                                                                                                      | src/routes/org.delegation.tsx                                                   |
| 25  | Delegation           | status                                                              | approve/reject only by someone other than delegator and delegate                                                                                 | src/routes/org.delegation.tsx                                                   |
| 26  | ApprovalWorkflow     | name                                                                | required; levels >= 1; SLA >= 1 day                                                                                                              | src/pages/ApprovalsPage.tsx WorkflowDialog                                      |
| 27  | ApprovalRequest      | remarks                                                             | required for Rejected / Rework                                                                                                                   | src/pages/ApprovalsPage.tsx Inbox                                               |
| 28  | ApprovalRequest      | (decision)                                                          | only Pending; not the requester; actor matches current level role (manager/HOD/HR/CFO/CEO/Admin) or override role                                | src/lib/approval-data.ts canActOnApproval/actOnApproval                         |
| 29  | ArchiveConfig        | autoDeleteDays/notifyBeforeDays                                     | 1–3650 / 0–90                                                                                                                                    | src/routes/org.archive.tsx                                                      |
| 30  | Announcement         | type,subject,from,to                                                | required; to >= from                                                                                                                             | src/routes/org.announcements.tsx valid                                          |
| 31  | OrgTheme             | primary/primaryDark/gold                                            | 6-digit hex #RRGGBB; edit by SuperAdmin/Admin                                                                                                    | src/pages/OrgSettingsPage.tsx BrandingTab                                       |
| 32  | BrandConfig          | name/legal                                                          | display and legal name required; HR e-mail valid if given; edit by SuperAdmin/Admin                                                              | src/pages/OrgSettingsPage.tsx                                                   |
| 33  | HrPolicy             | retirementAge / lead times                                          | retirement age 50–75; lead times whole numbers >= 0; >= 1 channel; edit needs exit.notice.configure                                              | src/pages/NotificationCentrePage.tsx                                            |
| 34  | MasterEntry          | required fields / numbers                                           | required fields non-empty; number fields >= 0                                                                                                    | src/components/shell/CrudSection.tsx valid                                      |
| 35  | UserPrefs            | avatar/wallpaper                                                    | image files only, downscaled to 512 px / 1920 px JPEG                                                                                            | src/components/profile/Personalisation.tsx; src/routes/emp.profile.tsx          |

### 7.3 People — employees, recruitment, masters, documents

| #   | Entity                  | Field                                                                                            | Rule                                                                                                                       | Source                                                                                 |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Employee record form    | aadhaar                                                                                          | required, 12 digits                                                                                                        | src/routes/org.employees.tsx:592                                                       |
| 2   | Employee record form    | pan                                                                                              | required, ^[A-Z]{5}\d{4}[A-Z]$                                                                                             | src/routes/org.employees.tsx:593                                                       |
| 3   | Employee record form    | uan                                                                                              | optional, 12 digits                                                                                                        | src/routes/org.employees.tsx:594                                                       |
| 4   | EmployeeBankAccount     | accountNo                                                                                        | required 9–18 digits; must equal re-entered number                                                                         | src/routes/org.employees.tsx:597                                                       |
| 5   | EmployeeBankAccount     | ifsc                                                                                             | ^[A-Z]{4}0[A-Z0-9]{6}$                                                                                                     | src/routes/org.employees.tsx:599                                                       |
| 6   | Employee record form    | firstName,lastName,dob,personalEmail,phone,doj,branch,dept,designation,managerId,hrPartnerId,ctc | required                                                                                                                   | src/routes/org.employees.tsx:570                                                       |
| 7   | NewHire                 | personalEmail/workEmail                                                                          | e-mail format; work e-mail unique across rosters and hires                                                                 | src/lib/hiring-data.ts:78                                                              |
| 8   | NewHire                 | dob                                                                                              | before DOJ and age ≥ 18 on DOJ                                                                                             | src/lib/hiring-data.ts:86                                                              |
| 9   | NewHire                 | phone                                                                                            | ≥ 10 digits                                                                                                                | src/lib/hiring-data.ts:84                                                              |
| 10  | NewHire                 | ctc                                                                                              | > 0                                                                                                                        | src/lib/hiring-data.ts:92                                                              |
| 11  | PromotionCase           | toDesignation,toGrade,toCtc,effectiveFrom                                                        | required; toCtc > 0                                                                                                        | src/lib/people-cases.ts:55                                                             |
| 12  | PromotionCase           | basis                                                                                            | required on submit                                                                                                         | src/lib/people-cases.ts:56                                                             |
| 13  | PromotionCase           | empId                                                                                            | ≠ creator; one open case per employee                                                                                      | src/lib/people-cases.ts:52                                                             |
| 14  | PromotionCase           | approvals                                                                                        | HR then Unit Head; role per step; approver ≠ employee and ≠ previous approver; reject needs note                           | src/lib/people-cases.ts:73                                                             |
| 15  | TransferCase            | effectiveFrom,reason                                                                             | required                                                                                                                   | src/lib/people-cases.ts:135                                                            |
| 16  | TransferCase            | toEntity                                                                                         | must equal fromEntity                                                                                                      | src/lib/people-cases.ts:137                                                            |
| 17  | TransferCase            | type-specific field                                                                              | Branch/Department/Manager/Role transfer must change that field; something must change except Project/client                | src/lib/people-cases.ts:139                                                            |
| 18  | TransferCase            | relocationAllowance,noticeDays                                                                   | >= 0                                                                                                                       | src/lib/people-cases.ts:136                                                            |
| 19  | TerminationCase         | type,reason,lastWorkingDay                                                                       | required                                                                                                                   | src/lib/people-cases.ts:184                                                            |
| 20  | TerminationCase         | incidentDate/lastWorkingDay/hearingDate                                                          | incident ≤ today; LWD ≥ incident and ≥ hearing                                                                             | src/lib/people-cases.ts:186                                                            |
| 21  | TerminationCase         | approvals                                                                                        | HR Head → Unit Head → Legal, different approver each step                                                                  | src/lib/people-cases.ts:196                                                            |
| 22  | WarningCase             | type,description                                                                                 | required                                                                                                                   | src/lib/people-cases.ts:241                                                            |
| 23  | WarningCase             | incidentDate,reviewDate,validityMonths                                                           | incident ≤ today; review ≥ incident; validity ≥ 1                                                                          | src/lib/people-cases.ts:243                                                            |
| 24  | ReferralCase            | candidate,email,jobId                                                                            | required; e-mail format; not the referrer; no duplicate applicant for the job                                              | src/lib/people-cases.ts:269                                                            |
| 25  | JobPost                 | title,jobType,location                                                                           | required; min ≤ max exp/salary; positions ≥ 1; no negatives; deadline ≥ today; no duplicate open title                     | src/pages/PostingsPage.tsx:62                                                          |
| 26  | Applicant               | name,email,jobId                                                                                 | required, e-mail format, open post, no duplicate (job,email), numbers ≥ 0                                                  | src/pages/CandidatesPage.tsx:156                                                       |
| 27  | Interview               | date,time,link/venue,panel,durationMin                                                           | date ≥ today IST; link if Online; venue if In-person; duration > 0; only Shortlisted/Interviewing; one scheduled at a time | src/lib/recruitment-engine.ts:161 / src/components/recruitment/InterviewDialogs.tsx:36 |
| 28  | Interview               | feedback                                                                                         | required; mandatory params scored; once per interview; next round for Proceed                                              | src/lib/recruitment-engine.ts:172                                                      |
| 29  | Offer                   | candidate,email,ctc,expiryDate,joiningDate                                                       | name + e-mail format; ctc > 0; expiry ≥ today; joining ≥ expiry; one active offer per candidate                            | src/lib/onboarding-data.ts:163                                                         |
| 30  | Offer                   | signature                                                                                        | must equal candidate full name (case-insensitive); before expiry                                                           | src/lib/onboarding-data.ts:199                                                         |
| 31  | Offer                   | declineReason                                                                                    | required when declining                                                                                                    | src/lib/onboarding-data.ts:201                                                         |
| 32  | OfferDocument           | file                                                                                             | ≤ 5 MB; all mandatory docs before submit; all mandatory Verified before verifyOffer; reject needs reason                   | src/lib/onboarding-data.ts:207                                                         |
| 33  | Department              | name,code                                                                                        | required; unique per entity                                                                                                | src/pages/InfrastructurePage.tsx:462 / src/lib/dept-data.ts:173                        |
| 34  | Branch                  | name,address,city,pin                                                                            | required; unique name; PIN 6 digits                                                                                        | src/pages/InfrastructurePage.tsx:233                                                   |
| 35  | Floor                   | seats,occupied                                                                                   | seats > 0; occupied ≤ seats                                                                                                | src/pages/InfrastructurePage.tsx:392                                                   |
| 36  | ManagerAssignment       | managerId                                                                                        | no reporting loop                                                                                                          | src/lib/manager-data.ts:38                                                             |
| 37  | HandbookAcknowledgement | signature                                                                                        | equals employee name; version must be published                                                                            | src/lib/handbook-data.ts:18                                                            |
| 38  | HandbookVersion         | version                                                                                          | unique                                                                                                                     | src/components/masters/HandbookTab.tsx:41 / src/lib/handbook-data.ts:13                |
| 39  | SalaryStructure         | grade                                                                                            | unique; components non-negative with labels                                                                                | src/components/masters/ConfigHubTabs.tsx:104                                           |
| 40  | LeaveType               | code                                                                                             | required, unique; day counts ≥ 0                                                                                           | src/components/masters/ConfigHubTabs.tsx:280                                           |
| 41  | HolidayCalendar         | holidays                                                                                         | name + date each; within year; no duplicate date                                                                           | src/components/masters/ConfigHubTabs.tsx:243                                           |
| 42  | AssessmentParam         | weight                                                                                           | 1–100                                                                                                                      | src/components/masters/ConfigHubTabs.tsx:211                                           |
| 43  | IpRule                  | address                                                                                          | IPv4 / CIDR; unique                                                                                                        | src/routes/org.masters.tsx:468                                                         |
| 44  | PayComponent            | code,value                                                                                       | code unique; % value 0–100                                                                                                 | src/routes/org.masters.tsx:310                                                         |
| 45  | GeofenceRule            | latitude,longitude,radius                                                                        | both or neither; lat ±90, lng ±180; radius > 0                                                                             | src/components/masters/GeofencingTab.tsx:41                                            |
| 46  | InsuranceAssignment     | validFrom/validTo, amount, premium, deduction, policyNumber                                      | to > from; cover > 0; no negatives; policy not already assigned                                                            | src/components/employees/InsuranceTab.tsx:67                                           |
| 47  | AssetType               | code,name                                                                                        | unique; no rename while assets exist; life ≥ 1; depreciation 0–100                                                         | src/components/masters/AssetMasterTab.tsx:100                                          |
| 48  | Resignation (exit)      | lastWorkingDay                                                                                   | ≥ today; one active resignation per employee                                                                               | src/components/employees/ResignationFormDialog.tsx:36                                  |

### 7.4 Time — attendance, leave, timesheets, tours, comp-off

| #   | Entity             | Field                                                      | Rule                                                                                                                                                          | Source                                             |
| --- | ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | LeaveApplication   | leaveType                                                  | required; must be an Active Leave Master type                                                                                                                 | src/lib/leave-engine.ts:153                        |
| 2   | LeaveApplication   | from/to                                                    | both required; to ≥ from; span ≤ 366 days; at least one working day (excl. weekends + branch paid holidays)                                                   | src/lib/leave-engine.ts:157                        |
| 3   | LeaveApplication   | from/to                                                    | no date in an attendance-locked month of the employee's entity                                                                                                | src/lib/leave-engine.ts:164                        |
| 4   | LeaveApplication   | days                                                       | ≤ type maxDays and Leave Master maxConsecutive; Casual Leave ≤ 3 consecutive days                                                                             | src/lib/leave-engine.ts:170                        |
| 5   | LeaveApplication   | attachment                                                 | Sick Leave > 2 days needs a certificate; types with needsAttachment & attachmentAfterDays=0 need a document                                                   | src/lib/leave-engine.ts:176                        |
| 6   | LeaveApplication   | from                                                       | back-dating limited to 7 days (warning 1–7 days)                                                                                                              | src/lib/leave-engine.ts:181                        |
| 7   | LeaveApplication   | from/to                                                    | no overlap with the employee's non-rejected requests                                                                                                          | src/lib/leave-engine.ts:190                        |
| 8   | LeaveApplication   | days                                                       | ≤ available balance (except LOP / Outdoor Duty / Travel Leave)                                                                                                | src/lib/leave-engine.ts:199                        |
| 9   | LeaveApplication   | from/to                                                    | SL/CL clubbing with holidays / week-offs / EL per Leave policy                                                                                                | src/lib/leave-engine.ts:210                        |
| 10  | LeaveApplication   | description                                                | required (form)                                                                                                                                               | src/components/leave/LeavePieces.tsx:59            |
| 11  | LeaveApplication   | status                                                     | approver authority per step (Manager/HOD/HR/override), not own request, one person one step; rejection reason required; balance & lock re-checked on approval | src/lib/leave-engine.ts:306                        |
| 12  | CompOffRedemption  | fromDate/toDate                                            | to ≥ from; ≥ 1 working day (or 0.5 half day)                                                                                                                  | src/lib/compoff-data.ts:262                        |
| 13  | CompOffRedemption  | days                                                       | ≤ available − pending holds; ≤ Leave Master CO maxConsecutive; no overlap; reason required; re-checked on approval                                            | src/lib/compoff-data.ts:266                        |
| 14  | CompOffLedgerEntry | days                                                       | 0.5 per qualifying off-day (>4 h punch or approved tour); monthly cap 2; idempotent per punch / tour-day                                                      | src/lib/compoff-data.ts:119                        |
| 15  | Punch              | —                                                          | only one open punch per employee                                                                                                                              | src/lib/attendance-self.ts:51                      |
| 16  | Punch              | location                                                   | geofence mode: within fence radius, else blocked or reason required when override allowed                                                                     | src/routes/emp.attendance.tsx:112                  |
| 17  | Punch              | —                                                          | employee may delete only today's punch in an unlocked month                                                                                                   | src/routes/emp.attendance.tsx:270                  |
| 18  | Shift              | start/end/break                                            | non-zero span (midnight crossing allowed); break inside shift; unique name; office required                                                                   | src/components/attendance/ShiftsTab.tsx:83         |
| 19  | PenaltyRule        | name/trigger/threshold/deductionType/deductionValue        | required; graceCount ≥ 0                                                                                                                                      | src/components/attendance/PenaltyConfigTab.tsx:222 |
| 20  | OvertimeRule       | name/rewardType/appliesAfter/rewardValue                   | required                                                                                                                                                      | src/components/attendance/PenaltyConfigTab.tsx:318 |
| 21  | HalfDayPolicy      | minHoursFullDay/minHoursHalfDay                            | 0 < half < full ≤ 24; maxPerMonth ≥ 0                                                                                                                         | src/components/attendance/PenaltyConfigTab.tsx:141 |
| 22  | TimesheetEntry     | date                                                       | not in the future                                                                                                                                             | src/routes/emp.timesheets.tsx:175                  |
| 23  | TimesheetEntry     | start/end/hours                                            | end > start; manual hours 0–24; task name required; Σ hours per day (incl. already logged, non-rejected) ≤ 24                                                 | src/routes/emp.timesheets.tsx:176                  |
| 24  | TimesheetEntry     | status                                                     | transitions Draft→Submitted, Submitted→Approved/Rejected, Rejected→Submitted; reject reason required; no self-approval                                        | src/lib/timesheet-data.ts:124                      |
| 25  | TourRequest        | purpose/destination/dates/estimatedCost                    | required; end ≥ start; estimated cost > 0                                                                                                                     | src/lib/tour-data.ts:204                           |
| 26  | TourRequest        | (assign)                                                   | employee, destination, dates, purpose required; end ≥ start; cost/advance ≥ 0                                                                                 | src/lib/tour-data.ts:250                           |
| 27  | TourRequest        | chain                                                      | only current approver / override role / same-entity tour.hr.decide or tour.finance.decide holders; never own tour; reject reason required                     | src/lib/tour-data.ts:283                           |
| 28  | TourExpense        | amount                                                     | > 0; not after Closed or encashment                                                                                                                           | src/lib/tour-data.ts:337                           |
| 29  | TourBill           | file/vendor/amount/gst                                     | file & vendor required; amount > 0; 0 ≤ gst ≤ amount                                                                                                          | src/components/tours/TourAdminPieces.tsx:142       |
| 30  | WageWorker         | name/phone/joinedOn                                        | name required; phone 10–15 digits if given; joining date required                                                                                             | src/components/attendance/DailyWagesTab.tsx:132    |
| 31  | WageAttendance     | date/in/out/otHours                                        | date ≤ today; month not locked; in/out for P/H; OT 0–12                                                                                                       | src/lib/wage-workers.ts:55                         |
| 32  | WorkOrder          | name/clientSite/office/startDate/demandedBy/endDate/budget | required fields; end ≥ start; budget & headcounts ≥ 0                                                                                                         | src/components/attendance/WorkOrdersTab.tsx:108    |

### 7.5 Payroll, statutory, tax & finance

| #   | Entity                  | Field                         | Rule                                                                                                                                                                                            | Source                                                  |
| --- | ----------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | PayrollRun              | period                        | required, YYYY-MM with month 01–12                                                                                                                                                              | src/lib/payroll-engine.ts:1249                          |
| 2   | PayrollRun              | payDate                       | required date ≥ first day of period                                                                                                                                                             | src/lib/payroll-engine.ts:1250                          |
| 3   | PayrollRun              | (org_id, period)              | only one non-rejected run per org+period; rejected run cannot be revived while another live run exists                                                                                          | src/lib/payroll-engine.ts:1253,1274                     |
| 4   | PayrollRun              | status                        | submit only from Checks Passed, all warnings acknowledged, attendance locked (if required), ≥ 1 approval level                                                                                  | src/lib/payroll-engine.ts:1425-1440                     |
| 5   | PayrollApproval         | approver                      | ≠ preparer (maker–checker, all roles); ≠ approver of an earlier level; role needs payroll.approve                                                                                               | src/lib/payroll-engine.ts:1465-1476                     |
| 6   | PayrollApproval         | remarks                       | required for rejection                                                                                                                                                                          | src/components/finance/PayrollTab.tsx:548               |
| 7   | ComplianceCheck         | patch (UAN/PF no./ESI IP/PAN) | UAN ^\d{12}$; PF ID ≥ 6 chars; ESI IP ^\d{10,17}$; PAN ^[A-Z]{5}\d{4}[A-Z]$                                                                                                                     | src/lib/payroll-engine.ts CHECK_GUIDE                   |
| 8   | ComplianceCheck         | note                          | justification required to verify/override; escalation needs a concerned person and note                                                                                                         | src/lib/payroll-engine.ts resolveCheck/escalateCheck    |
| 9   | StatutoryConfig         | rates / days / ids            | rates 0–100 %, EPS ≤ employer rate, ceilings > 0, PWD threshold ≥ ESI threshold, due days 1–28, TAN ^[A-Z]{4}\d{5}[A-Z]$, PAN format, approval chain non-empty                                  | src/components/compliance/PolicyTabs.tsx:573            |
| 10  | StatutoryFiling         | status                        | generate only from Processed/Paid run; one open draft per kind+org+period; verify blocked by validation errors; approve ≠ generator; file needs reference; pay needs payment ref                | src/lib/statutory-filings.ts                            |
| 11  | StatutoryFiling         | ecr lines                     | UAN 12 digits, name ≤ 85 chars, NCP ≤ days in month, EPS wages ≤ ceiling                                                                                                                        | src/lib/statutory-filings.ts validate()                 |
| 12  | ContributionDeclaration | vpf/nps                       | VPF > 0 and ≤ 100 % of Basic; percentages 0–100; PRAN 12 digits when NPS enabled                                                                                                                | src/components/payroll/ContributionsCard.tsx:49         |
| 13  | ItDeclaration           | amounts                       | ≥ 0; prev-employer TDS ≤ prev-employer salary on submit; custom component needs name and amount > 0                                                                                             | src/components/payroll/ItReports.tsx                    |
| 14  | TaxDocument             | Form 16                       | one generated per employee+form+FY; valid PAN; signatory required; quarter amounts ≥ 0                                                                                                          | src/routes/org.tax.tsx:359-364                          |
| 15  | TaxDocument             | status                        | Verified only from Generated/Uploaded; Issued only from Verified                                                                                                                                | src/lib/tax-data.ts:275                                 |
| 16  | Loan                    | amount/tenure                 | amount > 0; advance ≤ 1 × monthly gross, tenure 1…advanceEmiMaxMonths; loan ≤ maxGrossMultiple × gross, tenure 1…maxTenureMonths; no other pending or active loan; purpose required             | src/lib/loans-data.ts:51-63                             |
| 17  | Loan                    | decision                      | only Applied can be decided, not by the applicant; disburse only Approved                                                                                                                       | src/lib/loans-data.ts:65-81                             |
| 18  | ReimbursementClaim      | form                          | title, category, purpose, from-date, ≥1 bill with date+vendor+amount>0, declaration ticked; to ≥ from; 0 ≤ advance ≤ total                                                                      | src/routes/emp.reimbursements.tsx:86                    |
| 19  | ReimbursementClaim      | approver                      | claimant cannot act; Manager stage = reporting manager/Admin; later stages by role; rejection needs reason                                                                                      | src/lib/claims-data.ts:676                              |
| 20  | Expenditure             | form                          | title, purpose, reason, department, requested-by, concerned person, date, time, cost centre, vendor, amount > 0, GSTIN format if given, asset name + qty ≥ 1 for assets, occasion for festivals | src/components/expenditure/ExpenditureWorkspace.tsx:291 |
| 21  | Expenditure             | approver                      | approver role, not booker/requester; rejection needs reason; pay needs reference                                                                                                                | src/lib/expenditure-data.ts:216                         |
| 22  | AttendancePattern       | days                          | name required; 1 ≤ workingDays ≤ 31; paidLeaveDays 0…workingDays; weeklyOffs ≥ 0; workingDays + weeklyOffs ≤ 31                                                                                 | src/components/compliance/PatternsTab.tsx:406           |

### 7.6 Performance, learning, exit & grievance

| #   | Entity                     | Field                             | Rule                                                                                                                                                                                                                                           | Source                                                                         |
| --- | -------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | SelfAppraisal              | ratings[].self                    | every active evaluation parameter rated before submit                                                                                                                                                                                          | src/lib/self-appraisal.ts createSelfAppraisal/updateDraft                      |
| 2   | SelfAppraisal              | value.justification               | required to submit                                                                                                                                                                                                                             | src/lib/self-appraisal.ts                                                      |
| 3   | SelfAppraisal              | timeline                          | to ≥ from                                                                                                                                                                                                                                      | src/lib/self-appraisal.ts                                                      |
| 4   | SelfAppraisal              | value.expectedHikePct             | ≥ 0                                                                                                                                                                                                                                            | src/lib/self-appraisal.ts                                                      |
| 5   | SelfAppraisal              | (employee)                        | one live appraisal (stage not Applied/Rejected) per employee                                                                                                                                                                                   | src/lib/self-appraisal.ts createSelfAppraisal                                  |
| 6   | SelfAppraisal              | approvals                         | comments required; approver ≠ appraisee; one person approves at most one step; rating 1–5; recommended hike ≥ 0                                                                                                                                | src/lib/self-appraisal.ts decideAppraisal                                      |
| 7   | SelfAppraisal              | outcome                           | stage must be Approved; newGrade required; newCtc > 0; effectiveFrom required; not self                                                                                                                                                        | src/lib/self-appraisal.ts applyAppraisalOutcome                                |
| 8   | HrAppraisal                | empId, whyHappened, effectiveFrom | required                                                                                                                                                                                                                                       | src/lib/appraisal-data.ts saveHrAppraisal                                      |
| 9   | HrAppraisal                | timeline                          | to ≥ from                                                                                                                                                                                                                                      | src/lib/appraisal-data.ts saveHrAppraisal                                      |
| 10  | HrAppraisal                | newCtc                            | > 0                                                                                                                                                                                                                                            | src/lib/appraisal-data.ts saveHrAppraisal / approveHrAppraisal                 |
| 11  | HrAppraisal                | status                            | only Draft editable / approvable / rejectable; reject reason required; approver ≠ employee                                                                                                                                                     | src/lib/appraisal-data.ts                                                      |
| 12  | HrReview                   | period                            | to ≥ from                                                                                                                                                                                                                                      | src/lib/hr-review-data.ts saveHrReview                                         |
| 13  | HrReview                   | remarks + params                  | complete requires remarks and ≥ 1 parameter rating; reviewer ≠ employee                                                                                                                                                                        | src/lib/hr-review-data.ts saveHrReview                                         |
| 14  | HrReview                   | employeeAck                       | only on Completed + shared + not yet acknowledged                                                                                                                                                                                              | src/lib/hr-review-data.ts ackHrReview                                          |
| 15  | ReviewForm                 | self                              | all goals & parameters self-rated + justification before 'Self submitted'                                                                                                                                                                      | src/components/performance/ReviewForms.tsx                                     |
| 16  | ReviewForm                 | manager                           | all parameters manager-rated + recommendation before 'Manager reviewed'                                                                                                                                                                        | src/components/performance/ReviewForms.tsx                                     |
| 17  | ReviewForm                 | hr.calibratedRating               | 1–5 before Close; hike ≥ 0                                                                                                                                                                                                                     | src/components/performance/ReviewForms.tsx                                     |
| 18  | ReviewForm                 | (employee,kind,period)            | no duplicate form                                                                                                                                                                                                                              | src/components/performance/ReviewForms.tsx LaunchReviewDialog                  |
| 19  | AppraisalCycle             | (employee,cycle)                  | unique; stage/actor checked on each submit                                                                                                                                                                                                     | src/lib/appraisal-workflow-data.ts                                             |
| 20  | AppraisalCycle             | rating, comments                  | both required per stage                                                                                                                                                                                                                        | src/components/performance/AppraisalCard.tsx StagePanel                        |
| 21  | PerformanceImprovementPlan | empId, reason, detailedReason     | required                                                                                                                                                                                                                                       | src/lib/pip-data.ts createDetailedPIP                                          |
| 22  | PerformanceImprovementPlan | start/end                         | both required, end ≥ start; work end time > start time                                                                                                                                                                                         | src/lib/pip-data.ts / PIPTab.tsx                                               |
| 23  | PerformanceImprovementPlan | objectives                        | ≥ 1 objective with a measure                                                                                                                                                                                                                   | src/lib/pip-data.ts                                                            |
| 24  | PerformanceImprovementPlan | (employee)                        | one open PIP; not for yourself                                                                                                                                                                                                                 | src/lib/pip-data.ts                                                            |
| 25  | Goal                       | title, owner, start, due          | required; due ≥ start                                                                                                                                                                                                                          | src/components/goals/GoalPieces.tsx GoalForm                                   |
| 26  | Goal                       | target / metrics                  | simple target or ≥ 1 metric with name and target                                                                                                                                                                                               | src/components/goals/GoalPieces.tsx                                            |
| 27  | Goal                       | weight                            | 0–100                                                                                                                                                                                                                                          | src/components/goals/GoalPieces.tsx                                            |
| 28  | Goal                       | links[].url                       | must match ^https?://                                                                                                                                                                                                                          | src/components/goals/GoalPieces.tsx                                            |
| 29  | Goal                       | progress                          | 0–100; not editable while Pending/Rejected/Completed                                                                                                                                                                                           | src/components/goals/GoalPieces.tsx GoalDetail                                 |
| 30  | Goal                       | approval                          | reviewer ≠ owner                                                                                                                                                                                                                               | src/components/goals/GoalPieces.tsx GoalDetail                                 |
| 31  | TrainingAssignment         | empIds, dueDate                   | ≥ 1 employee; deadline required; deadline ≥ start; programme not Cancelled; no duplicate open assignment                                                                                                                                       | src/lib/training-assign.ts assignTraining                                      |
| 32  | TrainingProgramme          | title, dates, hours, links        | title required; end ≥ start; hours > 0; https links                                                                                                                                                                                            | src/components/training/TrainingTabs.tsx AssignDialog                          |
| 33  | TrainingAssignment         | submission                        | assignee only; not Completed; all modules done or file attached                                                                                                                                                                                | src/lib/training-assign.ts submitAssignment                                    |
| 34  | TrainingReview             | ratings, progressPct, learnings   | ratings 1–5; progress 0–100; learnings required                                                                                                                                                                                                | src/lib/training-assign.ts submitTrainingReview / TrainingTabs.tsx ReviewPanel |
| 35  | ExitRequest                | reason, description, requestedLwd | reason required; description > 10 chars; LWD ≥ today                                                                                                                                                                                           | src/routes/emp.resignation.tsx                                                 |
| 36  | ExitRequest                | (employee)                        | one live resignation                                                                                                                                                                                                                           | src/lib/exit-data.ts submitResignation                                         |
| 37  | ExitRequest                | decisions                         | note required; stage must match; actor ≠ employee                                                                                                                                                                                              | src/routes/org.exits.tsx / src/lib/exit-data.ts                                |
| 38  | ExitRequest                | noticeDays                        | > 0                                                                                                                                                                                                                                            | src/lib/exit-data.ts hrApprove / updateNoticePeriod                            |
| 39  | ExitClearance              | status Cleared                    | every checklist item ticked; Blocked needs a note; amount ≥ 0; only in HR Clearance                                                                                                                                                            | src/components/exit/ExitWorkflowPieces.tsx ClearanceForm / setClearance        |
| 40  | ExitRequest                | completeClearance                 | all 7 areas Cleared                                                                                                                                                                                                                            | src/lib/exit-data.ts                                                           |
| 41  | ExitRequest                | completeExit                      | stage Final Settlement; fnfSettled and exitInterviewDone; closing note required before LWD                                                                                                                                                     | src/lib/exit-data.ts                                                           |
| 42  | FnfStatement               | settle                            | statement saved; payment reference required                                                                                                                                                                                                    | src/lib/separation-data.ts settleFnf / advanceFnf                              |
| 43  | FnfConfig                  | numeric fields                    | ≥ 0; round-up months 0–11                                                                                                                                                                                                                      | src/lib/separation-data.ts saveFnfConfig                                       |
| 44  | RetentionCase              | form                              | grounds, justification, qualification, discussion, approver required; amounts ≥ 0; exit must be live                                                                                                                                           | src/lib/separation-data.ts retainWithForm                                      |
| 45  | RejoinCase                 | rejoinOn                          | required; ≥ exit date; exit Completed; one per exit                                                                                                                                                                                            | src/lib/separation-data.ts proposeRejoin                                       |
| 46  | ExitSurvey                 | ratings                           | all five 1–5 ratings; one survey per exit; employee submits own                                                                                                                                                                                | src/components/exit/SeparationPieces.tsx / addExitSurvey                       |
| 47  | Grievance                  | subject, description              | required; subject ≤ 150 chars; complainant required                                                                                                                                                                                            | src/lib/grievance-data.ts raiseGrievance                                       |
| 48  | Grievance                  | status transitions                | ack only Submitted; resolve only Acknowledged/Under investigation/Appealed (resolution required); close only Resolved (rating 1–5); appeal only Resolved by complainant (reason required); withdraw only Submitted/Acknowledged by complainant | src/lib/grievance-data.ts                                                      |
| 49  | RetirementRecord           | retiredOn, contract               | retiredOn required; not already retired; re-engage needs months > 0 and CTC > 0                                                                                                                                                                | src/lib/hr-policy.ts retireEmployee                                            |

### 7.7 Work — projects, tasks, assets, helpdesk, reports

| #   | Entity            | Field                                                            | Rule                                                                                                                                                                | Source                                                            |
| --- | ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Task              | name, assignees, startDate, dueDate                              | required; ≥ 1 assignee; dueDate ≥ startDate                                                                                                                         | src/components/tasks/TaskPieces.tsx:43 taskDraftValid             |
| 2   | Task              | links[].url                                                      | http(s) URL only; unique per task                                                                                                                                   | src/components/tasks/TaskPieces.tsx:32 isWebUrl                   |
| 3   | Task              | progress / hours (update)                                        | progress clamped 0–100 (Completed ⇒ 100); hours ≥ 0; note required to post                                                                                          | src/components/tasks/TaskPieces.tsx:~200-240                      |
| 4   | Task              | approval                                                         | approve/reject only when approval = Pending; reject needs a reason                                                                                                  | src/lib/task-data.ts:156                                          |
| 5   | Task              | assignees (Manager)                                              | line Manager may assign only to self + direct reports                                                                                                               | src/routes/org.tasks.tsx:25                                       |
| 6   | Project           | name, code, client, managerId, startDate, endDate                | required; endDate ≥ startDate                                                                                                                                       | src/components/projects/ProjectPieces.tsx:65                      |
| 7   | Project           | code                                                             | unique (case-insensitive), upper-cased                                                                                                                              | src/lib/project-data.ts:148 isProjectCodeTaken                    |
| 8   | Project           | clientEmail                                                      | e-mail regex when present                                                                                                                                           | src/components/projects/ProjectPieces.tsx:36 EMAIL_RE             |
| 9   | Project           | budget                                                           | ≥ 0                                                                                                                                                                 | src/components/projects/ProjectPieces.tsx:67                      |
| 10  | Project           | progress (override)                                              | clamped 0–100                                                                                                                                                       | src/components/projects/ProjectPieces.tsx EditProjectForm         |
| 11  | Project           | inline tasks                                                     | only complete task drafts are created; assignees limited to manager + members                                                                                       | src/components/projects/ProjectPieces.tsx:~84                     |
| 12  | Asset             | tag, name, vendor, cost, serial                                  | required; cost > 0; tag unique; serial unique; serial mandatory when type.requiresSerial                                                                            | src/components/assets/AssetPieces.tsx:62                          |
| 13  | Asset             | purchaseDate / warrantyTill / renewalDate                        | purchase ≤ today; warranty & renewal ≥ purchase                                                                                                                     | src/components/assets/AssetPieces.tsx:65                          |
| 14  | AssetIssuance     | employeeId, serial, expectedReturn                               | employee required; typed serial must match register (serialised types); expected return ≥ today unless 'until separation'                                           | src/components/assets/AssetPieces.tsx IssueAssetForm              |
| 15  | AssetIssuance     | asset status                                                     | issue only an In Stock asset with no active issuance                                                                                                                | src/lib/asset-data.ts:367                                         |
| 16  | AssetIssuance     | return                                                           | one return at a time; return check requires matching serial and a description when outcome ≠ OK                                                                     | src/lib/asset-data.ts:394; AssetPieces ReturnCheckForm            |
| 17  | AssetIssue        | stage                                                            | assess only Open/Under assessment; manager review only at Manager review; finance only at Finance review; resolve only at Repair / replacement; close only Resolved | src/lib/asset-data.ts:481-557                                     |
| 18  | AssetIssue        | estimatedCost / repairCost                                       | ≥ 0                                                                                                                                                                 | src/lib/asset-data.ts:482; AssetPieces                            |
| 19  | AssetIssue        | recoveryAmount                                                   | > 0 unless Waive; ≤ max(estimated cost, asset cost) (UI)                                                                                                            | src/lib/asset-data.ts:521; AssetPieces.tsx:340                    |
| 20  | AssetIssue        | managerRemarks / financeRemarks / causeDetails / resolutionNotes | required                                                                                                                                                            | src/components/assets/AssetPieces.tsx AssetIssueDetail            |
| 21  | AssetIssue        | actor                                                            | manager review: employee's reporting manager or own-dept HOD or asset manager; finance: CFO / finance.manage / Admin                                                | src/components/assets/AssetPieces.tsx:322                         |
| 22  | AssetRequest      | reason, neededBy                                                 | reason required; neededBy ≥ today                                                                                                                                   | src/components/assets/MyAssets.tsx RequestForm                    |
| 23  | AssetTransfer     | toId / asset status                                              | asset must be Issued; toId ≠ current holder                                                                                                                         | src/lib/asset-data.ts:580                                         |
| 24  | Ticket            | departmentId, categoryId                                         | must exist in config                                                                                                                                                | src/lib/helpdesk-data.ts createTicket                             |
| 25  | Ticket            | subject                                                          | ≥ 8 chars, ≤ 140                                                                                                                                                    | src/lib/helpdesk-data.ts createTicket; helpdesk.new.tsx maxLength |
| 26  | Ticket            | description                                                      | ≥ 20 chars                                                                                                                                                          | src/lib/helpdesk-data.ts createTicket                             |
| 27  | Ticket            | assigneeId                                                       | must be an agent (or head) of the ticket's department; confidential categories always go to the category owner                                                      | src/lib/helpdesk-data.ts:873, assignTicket                        |
| 28  | Ticket            | attachments                                                      | ≤ 10 MB each                                                                                                                                                        | src/lib/helpdesk-data.ts:872, addAttachments                      |
| 29  | Ticket            | status                                                           | valid enum; Resolved needs a resolution note; no change on Closed; only Resolved can be Closed; only Resolved/Closed can be Reopened (reason required)              | src/lib/helpdesk-data.ts setStatus/closeTicket/reopenTicket       |
| 30  | Ticket            | transfer / escalate                                              | reason required                                                                                                                                                     | src/lib/helpdesk-data.ts transferTicket/escalateTicket            |
| 31  | Ticket            | satisfaction                                                     | requester only; after Resolved/Closed                                                                                                                               | src/lib/helpdesk-data.ts rateTicket                               |
| 32  | TicketWatcher     | id                                                               | not the requester; not already watching; only agents remove others                                                                                                  | src/lib/helpdesk-data.ts addWatcher/removeWatcher                 |
| 33  | SlaPolicy         | firstResponseHours / resolveHours                                | > 0 and resolve ≥ first response                                                                                                                                    | src/pages/DeskSettingsPage.tsx:59                                 |
| 34  | HelpdeskConfig    | ticketPrefix / autoCloseDays                                     | /^[A-Z0-9][A-Z0-9-]{1,14}$/; ≥ 1 day                                                                                                                                | src/pages/DeskSettingsPage.tsx:62                                 |
| 35  | ServiceDepartment | name, headId, agentIds, categories                               | name & head required; ≥ 1 agent; ≥ 1 named category                                                                                                                 | src/pages/DeskSettingsPage.tsx:63                                 |
| 36  | ReportDefinition  | from / to                                                        | to ≥ from (warning, min attr)                                                                                                                                       | src/routes/org.reports.tsx:65                                     |

## 8. Data model and ER diagrams

### 8.1 Conventions

- **Naming**: snake_case, plural table names, `id` primary key; child tables named `<parent>_<items>` with `<parent>_id` foreign key and ON DELETE CASCADE semantics.
- **Keys**: business keys are kept as primary keys in the draft (e.g. employees.id = SRN-0006, payroll_runs.id = PR-ORG-SEEREON-2026-07) so the prototype's seed data loads unchanged. Decide in the DB design phase whether to add uuid surrogate keys.
- **Tenancy**: `org_id` on every tenant table, indexed; `group_id` on group tables.
- **Types**: money `numeric(14,2)`; percentages `numeric(5,2)`; dates `date`; instants `timestamptz`; flags `boolean`; free-form configuration `jsonb`; enumerations `varchar` + CHECK constraint (listed as allowed values in chapter 9).
- **Audit columns**: `created_at`, `updated_at` on every table (add `created_by`, `updated_by` in the design phase).
- **Soft delete**: business records are archived to `archived_records` and restorable; hard delete only for drafts and configuration rows.
- **Foreign keys**: 464 physical FKs in the draft (NOT VALID so data can be loaded first); 32 logical references are listed at the end of schema_draft.sql for decision.
- **Child vs primary**: 'child' tables hold arrays that the prototype nests inside a parent record (lines, steps, history, attachments).

### 8.2 Core ER diagram

The core model: tenancy, people, time, payroll, recruitment, performance, exit, work and service anchored on `organizations` and `employees`. Tenant links to `organizations.org_id` are omitted from the chapter diagrams for readability — every table with `org_id` references `organizations`. Full-resolution SVGs are in docs/diagrams/.

![Figure 8.1 — Core ER diagram](diagrams/10_er_core.png)
_Figure 8.1 — Core ER diagram_

### 8.3 ER — Platform & Tenancy

![Figure 8.2 — Platform & Tenancy](diagrams/11_er_platform.png)
_Figure 8.2 — Platform & Tenancy_

### 8.4 ER — Identity, Access & Administration

![Figure 8.3 — Identity, Access & Administration](diagrams/12_er_identity.png)
_Figure 8.3 — Identity, Access & Administration_

### 8.5 ER — Employees & Organisation

![Figure 8.4 — Employees & Organisation](diagrams/13_er_people.png)
_Figure 8.4 — Employees & Organisation_

### 8.6 ER — Recruitment & Onboarding

![Figure 8.5 — Recruitment & Onboarding](diagrams/14_er_recruitment.png)
_Figure 8.5 — Recruitment & Onboarding_

### 8.7 ER — Masters, Policies & Documents

![Figure 8.6 — Masters, Policies & Documents](diagrams/15_er_masters.png)
_Figure 8.6 — Masters, Policies & Documents_

### 8.8 ER — Time, Attendance, Leave & Travel

![Figure 8.7 — Time, Attendance, Leave & Travel](diagrams/16_er_time.png)
_Figure 8.7 — Time, Attendance, Leave & Travel_

### 8.9 ER — Payroll, Statutory, Tax & Finance

This chapter is drawn in 3 parts, each a group of parent tables with their child tables. References between parts are listed in the data dictionary (FK column).

![Figure 8.8a — Payroll, Statutory, Tax & Finance (part 1 of 3)](diagrams/17_er_payroll.png)
_Figure 8.8a — Payroll, Statutory, Tax & Finance (part 1 of 3)_

![Figure 8.8b — Payroll, Statutory, Tax & Finance (part 2 of 3)](diagrams/17_er_payroll_b.png)
_Figure 8.8b — Payroll, Statutory, Tax & Finance (part 2 of 3)_

![Figure 8.8c — Payroll, Statutory, Tax & Finance (part 3 of 3)](diagrams/17_er_payroll_c.png)
_Figure 8.8c — Payroll, Statutory, Tax & Finance (part 3 of 3)_

### 8.10 ER — Performance, Goals & Learning

This chapter is drawn in 3 parts, each a group of parent tables with their child tables. References between parts are listed in the data dictionary (FK column).

![Figure 8.9a — Performance, Goals & Learning (part 1 of 3)](diagrams/18_er_performance.png)
_Figure 8.9a — Performance, Goals & Learning (part 1 of 3)_

![Figure 8.9b — Performance, Goals & Learning (part 2 of 3)](diagrams/18_er_performance_b.png)
_Figure 8.9b — Performance, Goals & Learning (part 2 of 3)_

![Figure 8.9c — Performance, Goals & Learning (part 3 of 3)](diagrams/18_er_performance_c.png)
_Figure 8.9c — Performance, Goals & Learning (part 3 of 3)_

### 8.11 ER — Exit, Grievance & HR Policy

![Figure 8.10 — Exit, Grievance & HR Policy](diagrams/19_er_exit.png)
_Figure 8.10 — Exit, Grievance & HR Policy_

### 8.12 ER — Projects, Tasks & Assets

![Figure 8.11 — Projects, Tasks & Assets](diagrams/20_er_work.png)
_Figure 8.11 — Projects, Tasks & Assets_

### 8.13 ER — Helpdesk & Reporting

![Figure 8.12 — Helpdesk & Reporting](diagrams/21_er_service.png)
_Figure 8.12 — Helpdesk & Reporting_

## 9. Data dictionary

All 333 tables with every column. **Req** = NOT NULL. **FK** = referenced table.column. Allowed values are the CHECK constraint for enumerated columns. **Source** is the TypeScript type / store the table was derived from — the place to look when behaviour is unclear.

### 9.1 Platform & Tenancy

#### biometric_devices

Registered attendance devices per organisation.  
**Entity:** BiometricDevice · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/integrations-config-data.ts → BiometricDevice, store seereon.integrations.biometric`

| Column        | Type         | Req | FK               | Description / allowed values                        |
| ------------- | ------------ | --- | ---------------- | --------------------------------------------------- |
| id            | varchar(30)  | Y   |                  | DEV-<timestamp>                                     |
| org_id        | varchar(20)  | Y   | organizations.id | Map key                                             |
| name          | varchar(120) | Y   |                  |                                                     |
| branch        | varchar(120) | Y   |                  | Should reference organization_branches.id           |
| device_model  | varchar(80)  | Y   |                  |                                                     |
| serial_number | varchar(80)  | Y   |                  |                                                     |
| status        | varchar(20)  | Y   |                  | Allowed: Registered \| Pending OEM Setup \| Offline |

Indexes: (org_id); (serial_number) unique

#### company_groups

A client's group of companies (holding level). Created by Seereon at onboarding ('Group of companies') or automatically when a single-company client adds its first extra entity.  
**Entity:** CompanyGroup · **Primary key:** id

Source: `src/lib/group-data.ts → type CompanyGroup, store seereon.group.groups.v1`

| Column         | Type         | Req | FK  | Description / allowed values                  |
| -------------- | ------------ | --- | --- | --------------------------------------------- |
| id             | varchar(20)  | Y   |     | GRP-001 (next free number)                    |
| name           | varchar(200) | Y   |     | Seereon Group                                 |
| code           | varchar(30)  | Y   |     | Group code, accepted as 'Group ID' at sign-in |
| holding_entity | varchar(200) |     |     | Legal name of the holding company             |
| country        | varchar(80)  | Y   |     | India                                         |
| created_on     | date         | Y   |     | Creation date                                 |
| notes          | text         |     |     | Free text                                     |

Indexes: (code) unique

#### group_employment_records

Derived view: a person's employment records across the group's entities; group joining date drives gratuity.  
**Entity:** GroupEmployment · **Primary key:** employee_id, org_id, joining_date · **Tenant-scoped** (org_id)

Source: `src/lib/group-data.ts → type GroupEmployment, groupDirectory(), GROUP_TRANSFERS seed, in-memory overrides`

| Column             | Type         | Req | FK               | Description / allowed values                            |
| ------------------ | ------------ | --- | ---------------- | ------------------------------------------------------- |
| employee_id        | varchar(20)  | Y   | employees.id     |                                                         |
| org_id             | varchar(20)  | Y   | organizations.id |                                                         |
| joining_date       | date         | Y   |                  |                                                         |
| end_date           | date         |     |                  |                                                         |
| designation        | varchar(120) | Y   |                  |                                                         |
| is_current         | boolean      | Y   |                  |                                                         |
| group_joining_date | date         | Y   |                  | On employees table: first joining anywhere in the group |

Indexes: (employee_id, org_id, joining_date) unique

#### group_transfer_asset_dispositions (child)

Child of group_transfer_requests — group_transfer_asset_dispositions (from assetDispositions[]: asset_id → assets.id, asset_name, disposition enum return|transfer-request|retain-pending-decision)  
**Entity:** GroupTransferAssetDispositions · **Primary key:** —

Source: `src/lib/group-transfer-data.ts → type GroupTransferRequest, store seereon.group.transfers.v1`

| Column                    | Type         | Req | FK                         | Description / allowed values                           |
| ------------------------- | ------------ | --- | -------------------------- | ------------------------------------------------------ |
| id                        | bigserial    | Y   |                            | Surrogate key                                          |
| group_transfer_request_id | varchar(40)  | Y   | group_transfer_requests.id | Parent GroupTransferRequest                            |
| asset_id                  | varchar(120) |     | assets.id                  | → assets.id                                            |
| asset_name                | varchar(120) |     |                            |                                                        |
| disposition               | varchar(120) |     |                            | enum return\|transfer-request\|retain-pending-decision |

Indexes: (group_transfer_request_id)

#### group_transfer_requests

Inter-company employee transfer within a client group, confirmed by Seereon.  
**Entity:** GroupTransferRequest · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/group-transfer-data.ts → type GroupTransferRequest, store seereon.group.transfers.v1`

| Column          | Type         | Req | FK               | Description / allowed values                                   |
| --------------- | ------------ | --- | ---------------- | -------------------------------------------------------------- |
| id              | varchar(20)  | Y   |                  | GTR-001                                                        |
| employee_id     | varchar(20)  | Y   | employees.id     |                                                                |
| employee_name   | varchar(120) | Y   |                  | Snapshot                                                       |
| from_org_id     | varchar(20)  | Y   | organizations.id | Source entity                                                  |
| to_org_id       | varchar(20)  | Y   | organizations.id | Destination entity (same group)                                |
| effective_date  | date         | Y   |                  | New organisation joining date                                  |
| new_designation | varchar(120) | Y   |                  |                                                                |
| reason          | text         | Y   |                  |                                                                |
| status          | varchar(32)  | Y   |                  | Allowed: Pending Seereon Confirmation \| Confirmed \| Rejected |
| raised_on       | date         | Y   |                  |                                                                |
| raised_by       | varchar(30)  | Y   | users.id         | User id of HR/Admin                                            |
| decided_on      | date         |     |                  |                                                                |
| decided_by      | varchar(120) |     |                  | Seereon staff name                                             |
| decision_note   | text         |     |                  | Required on reject                                             |

Indexes: (employee_id) unique where status='Pending Seereon Confirmation'; (from_org_id); (to_org_id); (status)

#### integrations

Integration catalogue (reference data).  
**Entity:** Integration · **Primary key:** key

Source: `src/lib/catalog.ts → INTEGRATIONS / IntegrationDef`

| Column      | Type        | Req | FK  | Description / allowed values                                                                       |
| ----------- | ----------- | --- | --- | -------------------------------------------------------------------------------------------------- |
| key         | varchar(30) | Y   |     |                                                                                                    |
| name        | varchar(80) | Y   |     |                                                                                                    |
| category    | varchar(20) | Y   |     | Allowed: Communication \| Payments \| Identity \| Productivity \| AI \| Payroll \| Storage \| HRIS |
| description | text        | Y   |     |                                                                                                    |
| is_popular  | boolean     |     |     |                                                                                                    |

#### modules

Product catalogue module (reference data).  
**Entity:** Module · **Primary key:** key

Source: `src/lib/catalog.ts → MODULES / ModuleDef`

| Column              | Type        | Req | FK  | Description / allowed values                                                                                                                                   |
| ------------------- | ----------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| key                 | varchar(30) | Y   |     | employee, attendance, leave, payroll, performance, recruitment, learning, engagement, expense, tours, assets, helpdesk, documents, compliance, analytics, exit |
| name                | varchar(80) | Y   |     |                                                                                                                                                                |
| description         | text        | Y   |     |                                                                                                                                                                |
| submodules          | text[]      | Y   |     |                                                                                                                                                                |
| default_permissions | text[]      | Y   |     |                                                                                                                                                                |

#### org_ad_configs

Per-organisation Active Directory sync settings.  
**Entity:** AdConfig · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/integrations-config-data.ts → AdConfig, store seereon.integrations.ad`

| Column            | Type         | Req | FK               | Description / allowed values          |
| ----------------- | ------------ | --- | ---------------- | ------------------------------------- |
| org_id            | varchar(20)  | Y   | organizations.id |                                       |
| enabled           | boolean      | Y   |                  |                                       |
| domain_controller | varchar(255) |     |                  |                                       |
| sync_scope        | varchar(14)  |     |                  | Allowed: All users \| Selected OUs \| |
| last_synced_at    | timestamptz  |     |                  |                                       |

#### org_ad_field_mappings (child)

Child of org_ad_configs — org_ad_field_mappings (from fieldMapping[]: ad_attribute, seerhr_field)  
**Entity:** OrgAdFieldMappings · **Primary key:** —

Source: `src/lib/integrations-config-data.ts → AdConfig, store seereon.integrations.ad`

| Column           | Type         | Req | FK                    | Description / allowed values |
| ---------------- | ------------ | --- | --------------------- | ---------------------------- |
| id               | bigserial    | Y   |                       | Surrogate key                |
| org_ad_config_id | varchar(40)  | Y   | org_ad_configs.org_id | Parent AdConfig              |
| ad_attribute     | varchar(120) |     |                       |                              |
| seerhr_field     | varchar(120) |     |                       |                              |

Indexes: (org_ad_config_id)

#### org_email_ticket_configs

Email-to-ticket inbox settings per organisation.  
**Entity:** EmailTicketConfig · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/integrations-config-data.ts → EmailTicketConfig, store seereon.integrations.email-ticket`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| org_id          | varchar(20)  | Y   | organizations.id |                              |
| enabled         | boolean      | Y   |                  |                              |
| inbox_address   | varchar(254) |     |                  |                              |
| routing_keyword | varchar(60)  |     |                  |                              |

#### org_sso_configs

Per-organisation SSO settings.  
**Entity:** SsoConfig · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/integrations-config-data.ts → SsoConfig, store seereon.integrations.sso (Record<orgId, …>)`

| Column                | Type         | Req | FK               | Description / allowed values                |
| --------------------- | ------------ | --- | ---------------- | ------------------------------------------- |
| org_id                | varchar(20)  | Y   | organizations.id |                                             |
| enabled               | boolean      | Y   |                  |                                             |
| provider              | varchar(4)   |     |                  | Allowed: SAML \| OIDC \|                    |
| idp_metadata_url      | text         |     |                  | URL                                         |
| email_domain          | varchar(120) |     |                  |                                             |
| auto_login_for_domain | boolean      | Y   |                  |                                             |
| last_tested_at        | timestamptz  |     |                  |                                             |
| last_test_result      | varchar(14)  |     |                  | Allowed: Not connected \| Success \| Failed |

#### org_support_tickets

Legacy employee → org support tickets (seed only; superseded by the Helpdesk portal, not referenced).  
**Entity:** OrgTicket · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/support-data.ts → OrgTicket / ORG_TICKETS`

| Column        | Type         | Req | FK               | Description / allowed values                                                                                  |
| ------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| id            | varchar(20)  | Y   |                  | TKT-1041                                                                                                      |
| org_id        | varchar(20)  | Y   | organizations.id |                                                                                                               |
| employee_name | varchar(120) | Y   |                  |                                                                                                               |
| issue_type    | varchar(30)  | Y   |                  | Allowed: IT / Hardware \| Software Access \| SAP Logon \| Email \| HR Query \| Payroll \| Facilities \| Other |
| severity      | varchar(10)  | Y   |                  | Allowed: Low \| Medium \| High \| Critical                                                                    |
| status        | varchar(12)  | Y   |                  | Allowed: Unattended \| Attended \| Resolved                                                                   |
| raised_on     | date         | Y   |                  |                                                                                                               |
| expected_on   | date         | Y   |                  |                                                                                                               |
| source        | varchar(10)  |     |                  | Allowed: Portal \| Email                                                                                      |
| email_thread  | jsonb        |     |                  | from/subject/receivedAt/snippet                                                                               |

Indexes: (org_id, status)

#### organization_addresses (child)

Child of organizations — organization_addresses (wizard step 2 — currently not persisted)  
**Entity:** OrganizationAddresses · **Primary key:** —

Source: `src/lib/group-data.ts → type GroupOrg, store seereon.group.orgs.v1`

| Column          | Type        | Req | FK               | Description / allowed values |
| --------------- | ----------- | --- | ---------------- | ---------------------------- |
| id              | bigserial   | Y   |                  | Surrogate key                |
| organization_id | varchar(40) | Y   | organizations.id | Parent Organization          |
| value           | text        | Y   |                  | Item value (array element)   |

Indexes: (organization_id)

#### organization_branches

Branch / location of an entity; employees and branch masters hang off it.  
**Entity:** OrganizationBranch · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `GroupOrg.branches[] (addBranch/removeBranch)`

| Column    | Type         | Req | FK               | Description / allowed values                           |
| --------- | ------------ | --- | ---------------- | ------------------------------------------------------ |
| id        | varchar(40)  | Y   |                  | {orgId}-BR-01 (next free number)                       |
| org_id    | varchar(20)  | Y   | organizations.id | Entity                                                 |
| name      | varchar(120) | Y   |                  | Unique within entity                                   |
| city      | varchar(80)  |     |                  |                                                        |
| state     | varchar(80)  |     |                  |                                                        |
| address   | text         |     |                  |                                                        |
| head_name | varchar(120) |     |                  | Branch head (free text; should reference employees.id) |

Indexes: (org_id, lower(name)) unique

#### organization_integrations

Integration an organisation is allowed to activate.  
**Entity:** OrganizationIntegration · **Primary key:** org_id, integration_key · **Tenant-scoped** (org_id)

Source: `GroupOrg.integrations: string[]`

| Column          | Type        | Req | FK               | Description / allowed values |
| --------------- | ----------- | --- | ---------------- | ---------------------------- |
| org_id          | varchar(20) | Y   | organizations.id | Organisation                 |
| integration_key | varchar(30) | Y   | integrations.key | whatsapp / google-oauth / …  |

Indexes: (org_id, integration_key) PK

#### organization_modules

Module enabled for an organisation by Seereon.  
**Entity:** OrganizationModule · **Primary key:** org_id, module_key · **Tenant-scoped** (org_id)

Source: `GroupOrg.modules: string[]`

| Column     | Type        | Req | FK               | Description / allowed values              |
| ---------- | ----------- | --- | ---------------- | ----------------------------------------- |
| org_id     | varchar(20) | Y   | organizations.id | Organisation                              |
| module_key | varchar(30) | Y   | modules.key      | employee / attendance / leave / payroll … |

Indexes: (org_id, module_key) PK

#### organizations

A legal entity / tenant company (GroupOrg). Holds the modules and integrations Seereon provisioned, subscription plan and onboarding metadata.  
**Entity:** Organization · **Primary key:** id

Source: `src/lib/group-data.ts → type GroupOrg, store seereon.group.orgs.v1`

| Column               | Type         | Req | FK                | Description / allowed values                                    |
| -------------------- | ------------ | --- | ----------------- | --------------------------------------------------------------- |
| id                   | varchar(20)  | Y   |                   | ORG-SEEREON / ORG-1042 (addOrg: ORG-{1050+n})                   |
| code                 | varchar(30)  | Y   |                   | Company code / 'Company ID' at sign-in                          |
| name                 | varchar(200) | Y   |                   | Display name                                                    |
| legal_name           | varchar(200) | Y   |                   | Registered legal name                                           |
| group_id             | varchar(20)  |     | company_groups.id | Owning company group; null = standalone company                 |
| industry             | varchar(80)  | Y   |                   | Industry                                                        |
| country              | varchar(80)  | Y   |                   | Country                                                         |
| employee_count       | integer      | Y   |                   | Head-count (denormalised)                                       |
| status               | varchar(12)  | Y   |                   | Tenant status Allowed: Active \| Trial \| Suspended \| Inactive |
| primary_contact_name | varchar(120) |     |                   | Primary contact                                                 |
| official_email       | varchar(254) |     |                   | Official e-mail                                                 |
| plan_key             | varchar(20)  |     | plans.key         | Plan name (Growth/Business/Enterprise); default Business        |
| licenses             | integer      |     |                   | Licensed seats (>=1)                                            |
| created_on           | date         |     |                   | Onboarding date                                                 |
| subdomain            | varchar(32)  |     |                   | <sub>.seerhr.com workspace                                      |
| admin_email          | varchar(254) |     |                   | Initial Super Admin / Admin login e-mail                        |

Indexes: (code) unique; (group_id); (subdomain) unique where not null; (status)

#### plan_features (child)

Child of plans — plan_features (from features[]: id, label, enabled)  
**Entity:** PlanFeatures · **Primary key:** —

Source: `src/lib/catalog.ts → PLANS / PlanDef`

| Column  | Type         | Req | FK        | Description / allowed values |
| ------- | ------------ | --- | --------- | ---------------------------- |
| id      | bigserial    | Y   |           | Surrogate key                |
| plan_id | varchar(40)  | Y   | plans.key | Parent Plan                  |
| label   | varchar(120) |     |           |                              |
| enabled | varchar(120) |     |           |                              |

Indexes: (plan_id)

#### plans

Subscription plan (reference data).  
**Entity:** Plan · **Primary key:** key

Source: `src/lib/catalog.ts → PLANS / PlanDef`

| Column         | Type          | Req | FK  | Description / allowed values                        |
| -------------- | ------------- | --- | --- | --------------------------------------------------- |
| key            | varchar(20)   | Y   |     | growth / business / enterprise                      |
| name           | varchar(40)   | Y   |     |                                                     |
| tagline        | varchar(200)  | Y   |     |                                                     |
| price          | numeric(14,2) | Y   |     | UI string '$99' / 'Custom'                          |
| billing_period | varchar(10)   |     |     |                                                     |
| is_featured    | boolean       |     |     |                                                     |
| limits         | jsonb         | Y   |     | employees / storage / modules / support descriptors |

#### platform_documents

Guides, API references and release notes uploaded by the Seereon team.  
**Entity:** PlatformDocument · **Primary key:** id

Source: `src/lib/platform-data.ts → type DocEntry, store seereon.platform.docs`

| Column      | Type         | Req | FK  | Description / allowed values                                                               |
| ----------- | ------------ | --- | --- | ------------------------------------------------------------------------------------------ |
| id          | varchar(20)  | Y   |     | DOC-001                                                                                    |
| title       | varchar(200) | Y   |     |                                                                                            |
| kind        | varchar(20)  | Y   |     | Allowed: User guide \| Admin guide \| API \| Release notes \| Compliance \| Training video |
| version     | varchar(12)  | Y   |     | n[.n[.n]]                                                                                  |
| file_name   | varchar(255) | Y   |     | Stored object key in production                                                            |
| audience    | varchar(10)  | Y   |     | Allowed: Clients \| Internal \| Both                                                       |
| uploaded_on | date         | Y   |     |                                                                                            |
| uploaded_by | varchar(120) | Y   |     |                                                                                            |
| size_bytes  | bigint       | Y   |     | UI stores '780 KB'                                                                         |

Indexes: (lower(title), version) unique

#### platform_settings

Singleton platform configuration: modules offered to new organisations, branding, security policy, localisation defaults.  
**Entity:** PlatformSettings · **Primary key:** id

Source: `src/lib/platform-data.ts → type PlatformSettings, store seereon.platform.settings.v1`

| Column                | Type         | Req | FK  | Description / allowed values                                  |
| --------------------- | ------------ | --- | --- | ------------------------------------------------------------- |
| id                    | bigserial    | Y   |     | Surrogate key (added — the prototype record has no single id) |
| offered_modules       | text         | Y   |     | Absent/true = offered                                         |
| platform_name         | varchar(60)  | Y   |     |                                                               |
| support_email         | varchar(254) | Y   |     | e-mail                                                        |
| primary_color         | char(7)      | Y   |     | #RRGGBB                                                       |
| accent_color          | char(7)      | Y   |     | #RRGGBB                                                       |
| enforce_mfa           | boolean      | Y   |     |                                                               |
| password_rotation_90d | boolean      | Y   |     |                                                               |
| ip_allowlist_enabled  | boolean      | Y   |     |                                                               |
| session_timeout_30m   | boolean      | Y   |     |                                                               |
| default_timezone      | varchar(40)  | Y   |     |                                                               |
| default_currency      | char(3)      | Y   |     | ISO-4217                                                      |
| default_language      | varchar(30)  | Y   |     |                                                               |

Indexes: singleton row

#### platform_support_tickets

Client organisation → Seereon support queue.  
**Entity:** PlatformTicket · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/support-data.ts → type PlatformTicket, store seereon.platform.tickets.v1`

| Column         | Type         | Req | FK               | Description / allowed values                        |
| -------------- | ------------ | --- | ---------------- | --------------------------------------------------- |
| id             | varchar(20)  | Y   |                  | TCK-8843                                            |
| org_id         | varchar(20)  | Y   | organizations.id |                                                     |
| subject        | varchar(200) | Y   |                  | min 5 chars                                         |
| requester_name | varchar(120) | Y   |                  |                                                     |
| priority       | varchar(10)  | Y   |                  | Allowed: Critical \| High \| Medium \| Low          |
| status         | varchar(12)  | Y   |                  | Allowed: Open \| In Progress \| Waiting \| Resolved |
| assignee       | varchar(120) | Y   |                  | 'Unassigned' default                                |
| updated_on     | date         | Y   |                  |                                                     |
| description    | text         |     |                  |                                                     |

Indexes: (org_id); (status, priority)

#### platform_ticket_history (child)

Child of platform_support_tickets — platform_ticket_history (from history[]: at date, by varchar, action text)  
**Entity:** PlatformTicketHistory · **Primary key:** —

Source: `src/lib/support-data.ts → type PlatformTicket, store seereon.platform.tickets.v1`

| Column                     | Type         | Req | FK                          | Description / allowed values |
| -------------------------- | ------------ | --- | --------------------------- | ---------------------------- |
| id                         | bigserial    | Y   |                             | Surrogate key                |
| platform_support_ticket_id | varchar(40)  | Y   | platform_support_tickets.id | Parent PlatformTicket        |
| at                         | date         |     |                             | date                         |
| by                         | varchar(120) |     |                             | varchar                      |
| action                     | text         |     |                             | text                         |

Indexes: (platform_support_ticket_id)

#### support_routing_rules

Default owner by issue type (unused by any screen).  
**Entity:** RoutingRule · **Primary key:** org_id, issue_type · **Tenant-scoped** (org_id)

Source: `src/lib/support-sla-data.ts → RoutingRule, store seereon.support.routing-rules`

| Column        | Type         | Req | FK               | Description / allowed values |
| ------------- | ------------ | --- | ---------------- | ---------------------------- |
| org_id        | varchar(20)  | Y   | organizations.id | Proposed                     |
| issue_type    | varchar(30)  | Y   |                  |                              |
| default_owner | varchar(120) |     |                  |                              |

Indexes: (org_id, issue_type) PK

#### support_sla_rules

Target resolution hours by ticket severity (currently global and unused by any screen).  
**Entity:** SlaRule · **Primary key:** org_id, severity · **Tenant-scoped** (org_id)

Source: `src/lib/support-sla-data.ts → SlaRule, store seereon.support.sla-rules`

| Column       | Type        | Req | FK               | Description / allowed values               |
| ------------ | ----------- | --- | ---------------- | ------------------------------------------ |
| org_id       | varchar(20) | Y   | organizations.id | Proposed: rules per organisation           |
| severity     | varchar(10) | Y   |                  | Allowed: Critical \| High \| Medium \| Low |
| target_hours | integer     | Y   |                  | > 0                                        |

Indexes: (org_id, severity) PK

#### support_ticket_delegations

Ticket reassignment history (unused by any screen).  
**Entity:** DelegationEntry · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/support-sla-data.ts → DelegationEntry, store seereon.support.delegations`

| Column        | Type         | Req | FK         | Description / allowed values |
| ------------- | ------------ | --- | ---------- | ---------------------------- |
| id            | varchar(20)  | Y   |            | DLG-0001                     |
| ticket_id     | varchar(20)  | Y   | tickets.id |                              |
| from_owner    | varchar(120) | Y   |            |                              |
| to_owner      | varchar(120) | Y   |            |                              |
| reason        | text         | Y   |            |                              |
| reassigned_at | timestamptz  | Y   |            |                              |

Indexes: (ticket_id)

#### tenant_users

Client Super Admin / entity Admin accounts provisioned by Seereon or by a Super Admin, with the temporary password lifecycle.  
**Entity:** TenantCredential · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/tenant-users.ts → type TenantCredential, store seereon.platform.tenant-users`

| Column                | Type         | Req | FK                | Description / allowed values                |
| --------------------- | ------------ | --- | ----------------- | ------------------------------------------- |
| id                    | varchar(30)  | Y   |                   | SA-<orgdigits>[-n] / AD-<orgdigits>[-n]     |
| email                 | varchar(254) | Y   |                   | Login e-mail (lower-case)                   |
| name                  | varchar(120) | Y   |                   |                                             |
| role                  | varchar(12)  | Y   |                   | Allowed: SuperAdmin \| Admin                |
| org_id                | varchar(20)  | Y   | organizations.id  | Home entity                                 |
| group_id              | varchar(20)  |     | company_groups.id | Group (Super Admin scope)                   |
| temp_password_hash    | varchar(255) | Y   |                   | Store only a hash in production; shown once |
| force_password_change | boolean      | Y   |                   | Must change at first sign-in                |
| created_on            | date         | Y   |                   |                                             |
| created_by            | varchar(120) | Y   |                   | Name of issuer (should be user id)          |
| shared_on             | date         |     |                   | When the credentials e-mail was shared      |
| shared_to             | varchar(254) |     |                   |                                             |

Indexes: (email) unique; (org_id)

### 9.2 Identity, Access & Administration

#### announcements

Announcement / notice / event / circular published into an entity; employees view, download and acknowledge.  
**Entity:** Announcement · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/announcement-data.ts → type Announcement, store seereon.announcements.v1`

| Column          | Type         | Req | FK               | Description / allowed values                                  |
| --------------- | ------------ | --- | ---------------- | ------------------------------------------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| code            | varchar(12)  | Y   |                  | ANN-7001 … (max+1)                                            |
| type            | varchar(12)  | Y   |                  | Allowed: Announcement \| Notice \| Event \| Circular          |
| subject         | varchar(200) | Y   |                  |                                                               |
| description     | text         |     |                  |                                                               |
| valid_from      | date         | Y   |                  |                                                               |
| valid_to        | date         | Y   |                  | >= valid_from; also acknowledgement due date                  |
| attachment_name | varchar(200) |     |                  | File name (upload storage pending)                            |
| org_id          | varchar(20)  | Y   | organizations.id | Entity                                                        |
| published_by    | varchar(120) |     |                  |                                                               |
| published_on    | date         |     |                  |                                                               |

Indexes: (org_id, valid_from desc)

#### app_role_permissions

Static permission model of the 11 app roles: screen routes (ROLE_NAV / ROLE_EMP_NAV, '*' = all) and action keys (ROLE_ACTIONS). Reference data, seeded.  
**Entity:** AppRolePermission · **Primary key:** app_role, kind, permission_key

Source: `src/lib/auth-session.ts → ROLE_NAV, ROLE_EMP_NAV, ROLE_ACTIONS, ACTIONS, ROLE_SUMMARY`

| Column         | Type        | Req | FK  | Description / allowed values                                                                         |
| -------------- | ----------- | --- | --- | ---------------------------------------------------------------------------------------------------- |
| app_role       | varchar(12) | Y   |     | Allowed: SuperAdmin \| Admin \| CEO \| COO \| CFO \| CTO \| CHRO \| HR \| HOD \| Manager \| Employee |
| kind           | varchar(6)  | Y   |     | screen \| action Allowed: screen \| action                                                           |
| permission_key | varchar(80) | Y   |     | Route path (e.g. /org/finance) or action key (e.g. payroll.approve); '*' = everything                |
| description    | text        |     |     | ROLE_SUMMARY description/scope                                                                       |

Indexes: (app_role, kind, permission_key) unique

#### approval_chain_steps

Person-resolved approval chain embedded in Assets, Tours, Comp-off and Appraisals (HOD, reporting manager, HR partner or first holder of a role in the employee's entity).  
**Entity:** ApprovalChainStep · **Primary key:** parent_type, parent_id, seq · **Tenant-scoped** (org_id)

Source: `src/lib/approval-chain.ts → type ApprovalStep, buildChain/decideChain`

| Column        | Type         | Req | FK       | Description / allowed values                                                                                      |
| ------------- | ------------ | --- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| parent_type   | varchar(30)  | Y   |          | asset_request \| tour \| compoff \| appraisal                                                                     |
| parent_id     | uuid         | Y   |          | Owning record                                                                                                     |
| seq           | smallint     | Y   |          | Order                                                                                                             |
| role          | varchar(12)  | Y   |          | Allowed: SuperAdmin \| Admin \| CEO \| COO \| CFO \| CTO \| CHRO \| HR \| HOD \| Manager \| Employee \| HRPartner |
| label         | varchar(60)  | Y   |          |                                                                                                                   |
| approver_id   | uuid         |     | users.id |                                                                                                                   |
| approver_name | varchar(120) | Y   |          | 'Unassigned' when no holder; '(override)' suffix                                                                  |
| status        | varchar(8)   | Y   |          | Allowed: Pending \| Approved \| Rejected \| Skipped                                                               |
| acted_on      | date         |     |          |                                                                                                                   |
| note          | text         |     |          |                                                                                                                   |

Indexes: (parent_type, parent_id, seq) unique; (approver_id, status)

#### approval_request_steps (child)

Child of approval_requests — approval_request_steps (request_id, level, approver_role, status, acted_by, acted_at date, remarks text)  
**Entity:** ApprovalRequestSteps · **Primary key:** —

Source: `src/lib/approval-data.ts → type ApprovalRequest/ApprovalStep, store seereon.approvals.requests.v1`

| Column              | Type         | Req | FK                   | Description / allowed values |
| ------------------- | ------------ | --- | -------------------- | ---------------------------- |
| id                  | bigserial    | Y   |                      | Surrogate key                |
| approval_request_id | varchar(40)  | Y   | approval_requests.id | Parent ApprovalRequest       |
| request_id          | varchar(120) |     |                      |                              |
| level               | varchar(120) |     |                      |                              |
| approver_role       | varchar(120) |     |                      |                              |
| status              | varchar(120) |     |                      |                              |
| acted_by            | varchar(120) |     |                      |                              |
| acted_at            | date         |     |                      | date                         |
| remarks             | text         |     |                      | text                         |

Indexes: (approval_request_id)

#### approval_requests

A request travelling through a workflow level by level (inbox on /org/approvals).  
**Entity:** ApprovalRequest · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/approval-data.ts → type ApprovalRequest/ApprovalStep, store seereon.approvals.requests.v1`

| Column            | Type          | Req | FK       | Description / allowed values                                  |
| ----------------- | ------------- | --- | -------- | ------------------------------------------------------------- |
| id                | bigserial     | Y   |          | Surrogate key (added — the prototype record has no single id) |
| code              | varchar(10)   | Y   |          | APR-001 … (max+1)                                             |
| module            | varchar(30)   | Y   |          |                                                               |
| reference         | varchar(40)   | Y   |          | Source record id, e.g. LV-2041, goal id                       |
| title             | varchar(200)  | Y   |          |                                                               |
| requested_by      | uuid          | Y   | users.id |                                                               |
| requested_by_name | varchar(120)  | Y   |          |                                                               |
| raised_on         | date          | Y   |          |                                                               |
| amount            | numeric(14,2) |     |          | Store numeric; UI formats                                     |
| status            | varchar(10)   | Y   |          | Allowed: Pending \| Approved \| Rejected \| Rework            |
| current_level     | smallint      | Y   |          |                                                               |
| —                 | text          | Y   |          | → approval_request_steps                                      |

Indexes: (module, reference); (status, current_level); (requested_by)

#### approval_workflow_levels (child)

Child of approval_workflows — approval_workflow_levels (workflow_id, level smallint, approver_role varchar(20) enum APPROVER_ROLES, sla_days smallint >=1, optional boolean)  
**Entity:** ApprovalWorkflowLevels · **Primary key:** —

Source: `src/lib/approval-data.ts → type ApprovalWorkflow/ApprovalLevel, store seereon.approvals.workflows.v1`

| Column               | Type         | Req | FK                        | Description / allowed values    |
| -------------------- | ------------ | --- | ------------------------- | ------------------------------- |
| id                   | bigserial    | Y   |                           | Surrogate key                   |
| approval_workflow_id | varchar(40)  | Y   | approval_workflows.org_id | Parent ApprovalWorkflow         |
| workflow_id          | varchar(120) |     |                           |                                 |
| level                | smallint     |     |                           | smallint                        |
| approver_role        | varchar(20)  |     |                           | varchar(20) enum APPROVER_ROLES |
| sla_days             | smallint     |     |                           | smallint >=1                    |
| optional             | boolean      |     |                           | boolean                         |

Indexes: (approval_workflow_id)

#### approval_workflows

Configurable ordered approval chain per request type (one active per module).  
**Entity:** ApprovalWorkflow · **Primary key:** org_id, module · **Tenant-scoped** (org_id)

Source: `src/lib/approval-data.ts → type ApprovalWorkflow/ApprovalLevel, store seereon.approvals.workflows.v1`

| Column      | Type         | Req | FK  | Description / allowed values                                                                                                                                                        |
| ----------- | ------------ | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| code        | varchar(10)  | Y   |     | WF-001 … (max+1)                                                                                                                                                                    |
| module      | varchar(30)  | Y   |     | Allowed: Leave \| Timesheets \| Tasks \| Goals \| Performance Reviews \| Training Completion \| Expenses \| Loan Requests \| Salary Approvals \| Finance Requests \| Asset Requests |
| name        | varchar(120) | Y   |     |                                                                                                                                                                                     |
| description | text         |     |     |                                                                                                                                                                                     |
| active      | boolean      | Y   |     | Only one active per (org, module)                                                                                                                                                   |
| —           | text         | Y   |     | → approval_workflow_levels                                                                                                                                                          |

Indexes: (org_id, module) unique where active

#### archive_settings

Archive retention policy.  
**Entity:** ArchiveConfig · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/archive-data.ts → type ArchiveConfig, store seereon.archive.config`

| Column              | Type        | Req | FK               | Description / allowed values |
| ------------------- | ----------- | --- | ---------------- | ---------------------------- |
| org_id              | varchar(20) | Y   | organizations.id |                              |
| auto_delete_enabled | boolean     | Y   |                  |                              |
| auto_delete_days    | smallint    | Y   |                  | 1–3650                       |
| notify_before_days  | smallint    | Y   |                  | 0–90                         |

#### archived_records

System Archive / soft delete: deleted rows from any module with payload for restore and retention-based auto purge.  
**Entity:** ArchivedRecord · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/archive-data.ts → type ArchivedRecord, store seereon.archive.records`

| Column      | Type         | Req | FK               | Description / allowed values                                                     |
| ----------- | ------------ | --- | ---------------- | -------------------------------------------------------------------------------- |
| id          | varchar(40)  | Y   |                  | ARC-<base36 time>-<rand>                                                         |
| module      | varchar(40)  | Y   |                  | ARCHIVE_MODULES or free text (Roles & Permissions, Master Data, Announcements …) |
| record_id   | varchar(40)  | Y   |                  | Original business key                                                            |
| title       | varchar(200) | Y   |                  |                                                                                  |
| summary     | text         |     |                  |                                                                                  |
| archived_at | timestamptz  | Y   |                  |                                                                                  |
| archived_by | varchar(120) | Y   |                  | Current user name                                                                |
| reason      | text         | Y   |                  | Default 'Deleted by user'                                                        |
| payload     | jsonb        |     |                  | Original row for restore (truly schemaless)                                      |
| org_id      | varchar(20)  |     | organizations.id | Entity scope (active entity at archive time)                                     |

Indexes: (org_id, module); (archived_at)

#### brand_profiles

Document branding (name, logo, tagline, address, contact, footer, accent) — group default row (org_id null) plus per-entity overrides.  
**Entity:** BrandConfig · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/brand-config.ts → type BrandConfig, stores seereon.brand.default.v1 / seereon.brand.orgs.v1`

| Column     | Type         | Req | FK               | Description / allowed values                                  |
| ---------- | ------------ | --- | ---------------- | ------------------------------------------------------------- |
| id         | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| org_id     | varchar(20)  |     | organizations.id | null = group default                                          |
| name       | varchar(160) | Y   |                  |                                                               |
| tagline    | varchar(200) |     |                  |                                                               |
| logo_url   | text         |     |                  | Object-storage URL in production                              |
| address    | text         |     |                  |                                                               |
| email      | citext       |     |                  |                                                               |
| phone      | varchar(20)  |     |                  |                                                               |
| website    | varchar(120) |     |                  |                                                               |
| footer     | text         |     |                  |                                                               |
| accent_hex | char(7)      |     |                  | #RRGGBB                                                       |

#### delegation_events (child)

Child of delegations — delegation_events (delegation_id, at, by, action)  
**Entity:** DelegationEvents · **Primary key:** —

Source: `src/lib/delegation-data.ts → type Delegation, store seereon.delegations.v1`

| Column        | Type         | Req | FK             | Description / allowed values |
| ------------- | ------------ | --- | -------------- | ---------------------------- |
| id            | bigserial    | Y   |                | Surrogate key                |
| delegation_id | varchar(40)  | Y   | delegations.id | Parent Delegation            |
| at            | date         |     |                |                              |
| by            | varchar(120) |     |                |                              |
| action        | text         |     |                |                              |

Indexes: (delegation_id)

#### delegation_modules (child)

Child of delegations — delegation_modules (delegation_id, module varchar(40))  
**Entity:** DelegationModules · **Primary key:** —

Source: `src/lib/delegation-data.ts → type Delegation, store seereon.delegations.v1`

| Column        | Type        | Req | FK             | Description / allowed values |
| ------------- | ----------- | --- | -------------- | ---------------------------- |
| id            | bigserial   | Y   |                | Surrogate key                |
| delegation_id | varchar(40) | Y   | delegations.id | Parent Delegation            |
| module        | varchar(40) |     |                | varchar(40)                  |

Indexes: (delegation_id)

#### delegations

Time-bound hand-over of module responsibilities from one employee to another at a permission level, optionally approval-gated; auto-expires.  
**Entity:** Delegation · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/delegation-data.ts → type Delegation, store seereon.delegations.v1`

| Column            | Type         | Req | FK       | Description / allowed values                                          |
| ----------------- | ------------ | --- | -------- | --------------------------------------------------------------------- |
| id                | bigserial    | Y   |          | Surrogate key (added — the prototype record has no single id)         |
| code              | varchar(10)  | Y   |          | DEL-001 … (max+1)                                                     |
| from_user_id      | uuid         | Y   | users.id | Delegator                                                             |
| from_name         | varchar(120) | Y   |          | Denormalised                                                          |
| to_user_id        | uuid         | Y   | users.id | Delegate (≠ from)                                                     |
| to_name           | varchar(120) | Y   |          |                                                                       |
| —                 | text         | Y   |          | → delegation_modules                                                  |
| level             | varchar(12)  | Y   |          | Allowed: View Only \| Create \| Edit \| Approve \| Full Control       |
| start_date        | date         | Y   |          |                                                                       |
| end_date          | date         | Y   |          | >= start_date                                                         |
| reason            | text         |     |          |                                                                       |
| status            | varchar(16)  | Y   |          | Allowed: Pending Approval \| Active \| Expired \| Revoked \| Rejected |
| requires_approval | boolean      | Y   |          |                                                                       |
| —                 | text         | Y   |          | → delegation_events                                                   |

Indexes: (from_user_id, to_user_id, start_date, end_date); (status)

#### org_security_settings

Per-entity security & notification-channel toggles (Settings → Security / Notifications).  
**Entity:** OrgSecuritySettings · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/pages/OrgSettingsPage.tsx → type OrgToggles, store seereon.org.settings.toggles.v1`

| Column                | Type        | Req | FK               | Description / allowed values                        |
| --------------------- | ----------- | --- | ---------------- | --------------------------------------------------- |
| org_id                | varchar(20) | Y   | organizations.id |                                                     |
| mfa_admins            | boolean     | Y   |                  |                                                     |
| session_timeout       | varchar(20) | Y   |                  | e.g. '30 minutes' (store minutes int in production) |
| ip_allow_list_enabled | boolean     | Y   |                  |                                                     |
| channel_email         | boolean     | Y   |                  |                                                     |
| channel_whatsapp      | boolean     | Y   |                  |                                                     |
| channel_sms           | boolean     | Y   |                  |                                                     |
| channel_in_app        | boolean     | Y   |                  |                                                     |

#### org_themes

Entity colour palette applied system-wide (Super Admin / Admin).  
**Entity:** OrgTheme · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/appearance.ts → type OrgTheme, store seereon.appearance.org.v1`

| Column           | Type        | Req | FK               | Description / allowed values           |
| ---------------- | ----------- | --- | ---------------- | -------------------------------------- |
| org_id           | varchar(20) | Y   | organizations.id |                                        |
| primary_hex      | char(7)     | Y   |                  | #RRGGBB (isValidHex)                   |
| primary_dark_hex | char(7)     | Y   |                  |                                        |
| accent_hex       | char(7)     | Y   |                  |                                        |
| radius           | varchar(8)  | Y   |                  | Allowed: compact \| regular \| rounded |

#### org_user_access

User Assignment / Branch Access list: a user (by e-mail) with role names per branch. Kept in sync with rbac_role_assignments when the e-mail is a real login.  
**Entity:** OrgUserRecord · **Primary key:** org_id, email · **Tenant-scoped** (org_id)

Source: `src/lib/rbac.ts → type OrgUserRecord, BranchRoleAssignment; src/lib/user-store.ts → store seereon.rbac.org-users.v1`

| Column | Type         | Req | FK  | Description / allowed values            |
| ------ | ------------ | --- | --- | --------------------------------------- |
| code   | varchar(10)  | Y   |     | USR-01 … (max+1)                        |
| name   | varchar(120) | Y   |     |                                         |
| email  | citext       | Y   |     | Links to users.email                    |
| status | varchar(10)  | Y   |     | Allowed: Active \| Invited \| Suspended |
| —      | text         | Y   |     | → org_user_branch_roles                 |

Indexes: (org_id, email) unique

#### org_user_branch_roles (child)

Child of org_user_access — org_user_branch_roles (org_user_id, branch_id, role_id → rbac_roles.id)  
**Entity:** OrgUserBranchRoles · **Primary key:** —

Source: `src/lib/rbac.ts → type OrgUserRecord, BranchRoleAssignment; src/lib/user-store.ts → store seereon.rbac.org-users.v1`

| Column           | Type         | Req | FK                     | Description / allowed values |
| ---------------- | ------------ | --- | ---------------------- | ---------------------------- |
| id               | bigserial    | Y   |                        | Surrogate key                |
| org_user_acce_id | varchar(40)  | Y   | org_user_access.org_id | Parent OrgUserRecord         |
| org_user_id      | varchar(120) |     |                        |                              |
| branch_id        | varchar(120) |     |                        |                              |
| role_id          | varchar(120) |     | rbac_roles.id          | → rbac_roles.id              |

Indexes: (org_user_acce_id)

#### password_reset_requests

Forgot-password OTP request (6-digit code, 5-minute expiry).  
**Entity:** PasswordResetRequest · **Primary key:** id

Source: `src/lib/auth-session.ts → type PasswordResetRequest, key seereon.session.reset`

| Column      | Type         | Req | FK       | Description / allowed values      |
| ----------- | ------------ | --- | -------- | --------------------------------- |
| id          | uuid         | Y   |          |                                   |
| user_id     | uuid         | Y   | users.id |                                   |
| email       | citext       | Y   |          | Delivery address                  |
| otp_hash    | varchar(128) | Y   |          | 6-digit code (hash in production) |
| expires_at  | timestamptz  | Y   |          | now + 5 min                       |
| consumed_at | timestamptz  |     |          | Set when the reset completes      |

Indexes: (user_id, expires_at desc)

#### rbac_role_assignments (child)

Child of rbac_roles — rbac_role_assignments (role_id, user_id → users.id, branch_id) — from assignedUsers  
**Entity:** RbacRoleAssignments · **Primary key:** —

Source: `src/lib/rbac-store.ts → type RoleDef (extends rbac.ts RoleRecord), store seereon.rbac.roles.v1`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| rbac_role_id | varchar(40)  | Y   | rbac_roles.id | Parent RoleDef               |
| role_id      | varchar(40)  |     | rbac_roles.id |                              |
| user_id      | varchar(120) |     | users.id      | → users.id                   |
| branch_id    | varchar(120) |     |               |                              |

Indexes: (rbac_role_id)

#### rbac_role_branches (child)

Child of rbac_roles — rbac_role_branches (role_id, branch_id)  
**Entity:** RbacRoleBranches · **Primary key:** —

Source: `src/lib/rbac-store.ts → type RoleDef (extends rbac.ts RoleRecord), store seereon.rbac.roles.v1`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| rbac_role_id | varchar(40)  | Y   | rbac_roles.id | Parent RoleDef               |
| role_id      | varchar(40)  |     | rbac_roles.id |                              |
| branch_id    | varchar(120) |     |               |                              |

Indexes: (rbac_role_id)

#### rbac_role_events (child)

Child of rbac_roles — rbac_role_events (role_id, at, by, action) — from history  
**Entity:** RbacRoleEvents · **Primary key:** —

Source: `src/lib/rbac-store.ts → type RoleDef (extends rbac.ts RoleRecord), store seereon.rbac.roles.v1`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| rbac_role_id | varchar(40)  | Y   | rbac_roles.id | Parent RoleDef               |
| role_id      | varchar(40)  |     | rbac_roles.id |                              |
| at           | date         |     |               |                              |
| by           | varchar(120) |     |               |                              |
| action       | text         |     |               |                              |

Indexes: (rbac_role_id)

#### rbac_role_screen_permissions (child)

Child of rbac_roles — rbac_role_screen_permissions (role_id, screen_id → rbac_screens.id, can_view, can_edit, can_delete) — from permissions  
**Entity:** RbacRoleScreenPermissions · **Primary key:** —

Source: `src/lib/rbac-store.ts → type RoleDef (extends rbac.ts RoleRecord), store seereon.rbac.roles.v1`

| Column       | Type         | Req | FK              | Description / allowed values |
| ------------ | ------------ | --- | --------------- | ---------------------------- |
| id           | bigserial    | Y   |                 | Surrogate key                |
| rbac_role_id | varchar(40)  | Y   | rbac_roles.id   | Parent RoleDef               |
| role_id      | varchar(40)  |     | rbac_roles.id   |                              |
| screen_id    | varchar(120) |     | rbac_screens.id | → rbac_screens.id            |
| can_view     | boolean      |     |                 |                              |
| can_edit     | boolean      |     |                 |                              |
| can_delete   | boolean      |     |                 |                              |

Indexes: (rbac_role_id)

#### rbac_roles

Custom / built-in RBAC role designed in Roles & Permissions: screen-level View/Edit/Delete, branch scope and per-branch user assignments.  
**Entity:** RoleDef · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/rbac-store.ts → type RoleDef (extends rbac.ts RoleRecord), store seereon.rbac.roles.v1`

| Column       | Type         | Req | FK               | Description / allowed values                                 |
| ------------ | ------------ | --- | ---------------- | ------------------------------------------------------------ |
| code         | varchar(10)  | Y   |                  | ROL-01 … (max+1)                                             |
| id           | uuid         | Y   |                  |                                                              |
| org_id       | varchar(20)  | Y   | organizations.id | Owning entity (UI keeps one global list — add in production) |
| name         | varchar(80)  | Y   |                  | Unique (case-insensitive) per tenant                         |
| description  | text         |     |                  |                                                              |
| user_count   | integer      | Y   |                  | Derived: users with ≥1 branch                                |
| screen_count | integer      | Y   |                  | Derived: screens with View                                   |
| status       | varchar(6)   | Y   |                  | Only Active roles can be granted Allowed: Active \| Draft    |
| updated_on   | date         | Y   |                  |                                                              |
| built_in     | boolean      |     |                  | Seeded roles cannot be deleted                               |
| created_by   | varchar(120) |     |                  |                                                              |
| created_on   | date         |     |                  |                                                              |
| —            | text         | Y   |                  | → rbac_role_screen_permissions                               |
| —            | text         | Y   |                  | → rbac_role_branches                                         |
| —            | text         | Y   |                  | → rbac_role_assignments                                      |
| —            | text         | Y   |                  | → rbac_role_events                                           |

Indexes: (org_id, lower(name)) unique; rbac_role_assignments (user_id)

#### rbac_screens

Catalogue of module → submodule → screen used by role design, temporary access and the permission matrix (screenId = module.submodule.screen).  
**Entity:** RbacScreen · **Primary key:** id

Source: `src/lib/rbac.ts → RBAC_MODULES, ScreenDef/SubmoduleDef/RbacModuleDef, screenId()`

| Column         | Type        | Req | FK  | Description / allowed values |
| -------------- | ----------- | --- | --- | ---------------------------- |
| id             | varchar(80) | Y   |     | e.g. payroll.run.payslips    |
| module_key     | varchar(40) | Y   |     |                              |
| module_name    | varchar(80) | Y   |     |                              |
| submodule_key  | varchar(40) | Y   |     |                              |
| submodule_name | varchar(80) | Y   |     |                              |
| screen_name    | varchar(80) | Y   |     |                              |

Indexes: (module_key)

#### reporting_lines

Reporting / functional manager per employee used to scope manager views (subtree).  
**Entity:** ReportingLink · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/reporting.ts → type ReportingLink, reportingStore (in-memory)`

| Column                | Type | Req | FK       | Description / allowed values |
| --------------------- | ---- | --- | -------- | ---------------------------- |
| employee_id           | uuid | Y   | users.id |                              |
| reporting_manager_id  | uuid |     | users.id | '' = top of tree             |
| functional_manager_id | uuid |     | users.id |                              |

Indexes: (reporting_manager_id); (functional_manager_id)

#### signin_policies

Company sign-in policy: password rules (enforced by passwordPolicyError), lock-out threshold (enforced by recordFailedSignIn), MFA, session and SSO preferences.  
**Entity:** SignInPolicy · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/rbac-store.ts → type SignInPolicyConfig, signInPolicyStore (seereon.rbac.signin-policy.v1)`

| Column               | Type         | Req | FK               | Description / allowed values |
| -------------------- | ------------ | --- | ---------------- | ---------------------------- |
| org_id               | varchar(20)  | Y   | organizations.id |                              |
| min_length           | smallint     | Y   |                  | >= 6                         |
| require_upper        | boolean      | Y   |                  |                              |
| require_number       | boolean      | Y   |                  |                              |
| require_symbol       | boolean      | Y   |                  |                              |
| expiry_days          | smallint     | Y   |                  | >= 0                         |
| lock_after_attempts  | smallint     | Y   |                  | >= 3                         |
| lock_minutes         | smallint     | Y   |                  | >= 5                         |
| mfa_admins           | boolean      | Y   |                  |                              |
| mfa_all              | boolean      | Y   |                  |                              |
| session_idle_minutes | smallint     | Y   |                  | >= 5                         |
| remember_device_days | smallint     | Y   |                  | >= 0                         |
| prefer_sso           | boolean      | Y   |                  |                              |
| updated_on           | date         |     |                  |                              |
| updated_by           | varchar(120) |     |                  |                              |

#### temporary_access_grant_screens (child)

Child of temporary_access_grants — temporary_access_grant_screens (grant_id, screen_id → rbac_screens.id, can_view, can_edit, can_delete)  
**Entity:** TemporaryAccessGrantScreens · **Primary key:** —

Source: `src/components/users/TemporaryAccessTab.tsx → type TempGrant, store seereon.rbac.temp-grants.v1`

| Column                    | Type         | Req | FK                         | Description / allowed values |
| ------------------------- | ------------ | --- | -------------------------- | ---------------------------- |
| id                        | bigserial    | Y   |                            | Surrogate key                |
| temporary_access_grant_id | varchar(40)  | Y   | temporary_access_grants.id | Parent TempGrant             |
| grant_id                  | varchar(40)  |     | temporary_access_grants.id |                              |
| screen_id                 | varchar(120) |     | rbac_screens.id            | → rbac_screens.id            |
| can_view                  | boolean      |     |                            |                              |
| can_edit                  | boolean      |     |                            |                              |
| can_delete                | boolean      |     |                            |                              |

Indexes: (temporary_access_grant_id)

#### temporary_access_grants

Time-boxed screen permissions for a user on a branch; auto-expire after 'to'.  
**Entity:** TempGrant · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/components/users/TemporaryAccessTab.tsx → type TempGrant, store seereon.rbac.temp-grants.v1`

| Column     | Type        | Req | FK       | Description / allowed values                                   |
| ---------- | ----------- | --- | -------- | -------------------------------------------------------------- |
| id         | bigserial   | Y   |          | Surrogate key (added — the prototype record has no single id)  |
| code       | varchar(10) | Y   |          | TMP-001 … (max+1)                                              |
| user_id    | uuid        | Y   | users.id | Grantee (UI stores the display name)                           |
| branch_id  | varchar(80) |     |          | Branch name or 'All branches'                                  |
| valid_from | date        | Y   |          |                                                                |
| valid_to   | date        | Y   |          | >= valid_from                                                  |
| reason     | text        |     |          |                                                                |
| status     | varchar(8)  | Y   |          | Expired is derived (to < today IST) Allowed: Active \| Revoked |
| —          | text        | Y   |          | → temporary_access_grant_screens                               |

Indexes: (user_id, status)

#### user_alerts

In-app bell notifications per person (role granted, password reset, delegation, announcement, comp-off, leave, loan …).  
**Entity:** EmployeeAlert · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/employee-alerts.ts → type EmployeeAlert, store seereon.employee.alerts`

| Column     | Type         | Req | FK       | Description / allowed values                                                   |
| ---------- | ------------ | --- | -------- | ------------------------------------------------------------------------------ |
| id         | bigserial    | Y   |          | Surrogate key (added — the prototype record has no single id)                  |
| code       | varchar(12)  | Y   |          | AL-0001 …                                                                      |
| user_id    | uuid         | Y   | users.id | Recipient                                                                      |
| created_at | timestamptz  | Y   |          |                                                                                |
| title      | varchar(200) | Y   |          |                                                                                |
| body       | text         | Y   |          |                                                                                |
| kind       | varchar(10)  | Y   |          | Allowed: leave \| compoff \| payroll \| loan \| grievance \| review \| general |
| link       | varchar(200) |     |          | In-app route                                                                   |
| read       | boolean      | Y   |          |                                                                                |

Indexes: (user_id, read, created_at desc)

#### user_credentials

Self-service / admin-set password override per user (UI keeps a plain map in localStorage; production: hash + metadata).  
**Entity:** PasswordCredential · **Primary key:** user_id

Source: `src/lib/auth-session.ts → readPw/writePw, key seereon.session.passwords`

| Column        | Type         | Req | FK       | Description / allowed values          |
| ------------- | ------------ | --- | -------- | ------------------------------------- |
| user_id       | uuid         | Y   | users.id |                                       |
| password_hash | varchar(255) | Y   |          | Current password (hash in production) |
| set_by        | uuid         |     | users.id | Admin who issued a temporary password |
| updated_at    | timestamptz  | Y   |          |                                       |

#### user_login_events (child)

Child of user_logins — user_login_events (user_id, at date/timestamptz, by varchar, action text) — flattened from history[]  
**Entity:** UserLoginEvents · **Primary key:** —

Source: `src/lib/rbac-store.ts → type LoginRecord, store seereon.rbac.logins.v1`

| Column        | Type         | Req | FK                  | Description / allowed values |
| ------------- | ------------ | --- | ------------------- | ---------------------------- |
| id            | bigserial    | Y   |                     | Surrogate key                |
| user_login_id | varchar(40)  | Y   | user_logins.user_id | Parent LoginRecord           |
| user_id       | varchar(40)  |     | users.id            |                              |
| at            | timestamptz  |     |                     | date/timestamptz             |
| by            | varchar(120) |     |                     | varchar                      |
| action        | text         |     |                     | text                         |

Indexes: (user_login_id)

#### user_logins

Account state per user for Users & Logins: status, MFA, lock-out counter, last sign-in, sessions, reset-pending flag and an audit history.  
**Entity:** LoginRecord · **Primary key:** user_id · **Tenant-scoped** (org_id)

Source: `src/lib/rbac-store.ts → type LoginRecord, store seereon.rbac.logins.v1`

| Column              | Type         | Req | FK       | Description / allowed values                                     |
| ------------------- | ------------ | --- | -------- | ---------------------------------------------------------------- |
| user_id             | uuid         | Y   | users.id | One row per user                                                 |
| status              | varchar(10)  | Y   |          | Account status Allowed: Active \| Invited \| Suspended \| Locked |
| mfa_enforced        | boolean      | Y   |          | MFA enforced                                                     |
| last_login_at       | timestamptz  |     |          | Last successful sign-in                                          |
| last_ip             | inet         |     |          | Last sign-in IP                                                  |
| last_device         | varchar(80)  |     |          | Browser · OS                                                     |
| failed_attempts     | smallint     | Y   |          | Consecutive failed sign-ins (reset on success / unlock)          |
| password_changed_on | date         |     |          | Last password change                                             |
| must_reset_password | boolean      | Y   |          | Temporary / admin-issued password must be replaced               |
| active_sessions     | smallint     | Y   |          | Active session count                                             |
| invited_on          | date         |     |          | Invitation date                                                  |
| invited_by          | varchar(120) |     |          | Inviter name                                                     |
| notes               | text         |     |          | Suspension reason                                                |
| —                   | text         | Y   |          | Audit trail → user_login_events                                  |

Indexes: (status)

#### user_preferences

Per-user personalisation: font, wallpaper (+blur/dim/glass), avatar photo or generated style.  
**Entity:** UserPrefs · **Primary key:** user_id

Source: `src/lib/appearance.ts → type UserPrefs/CustomWallpaper, store seereon.appearance.user.v1`; `src/lib/platform-data.ts → type ConsolePrefs, store seereon.platform.prefs.v1`

| Column             | Type        | Req | FK       | Description / allowed values                                                        |
| ------------------ | ----------- | --- | -------- | ----------------------------------------------------------------------------------- |
| user_id            | uuid        | Y   | users.id |                                                                                     |
| font               | varchar(10) | Y   |          | Allowed: inter \| manrope \| plex \| source \| roboto \| nunito \| dmsans \| system |
| wallpaper          | varchar(40) |     |          | Preset id or custom wallpaper id                                                    |
| blur_px            | smallint    | Y   |          | 0–40                                                                                |
| dim_pct            | smallint    | Y   |          | 0–80                                                                                |
| glass              | boolean     | Y   |          |                                                                                     |
| avatar_url         | text        |     |          | Downscaled JPEG (≤512px) — object storage in production                             |
| avatar_style       | varchar(10) | Y   |          | Allowed: photo \| initials \| gradient \| pattern                                   |
| avatar_seed        | integer     | Y   |          |                                                                                     |
| —                  | text        |     |          | → user_wallpapers                                                                   |
| language           | varchar(5)  | Y   |          | en/hi                                                                               |
| timezone           | varchar(60) | Y   |          |                                                                                     |
| date_format        | varchar(12) | Y   |          | Allowed: DD/MM/YYYY \| MM/DD/YYYY \| YYYY-MM-DD                                     |
| notification_prefs | jsonb       |     |          | channel → on/off                                                                    |

#### user_scope_preferences

Working scope per signed-in user: active entity, Super Admin group/entity view, active branch (restored on reload).  
**Entity:** ActiveScope · **Primary key:** user_id · **Tenant-scoped** (org_id)

Source: `src/lib/group-data.ts (activeOrgStore, viewScopeStore, key seereon.scope) + src/lib/branch-session.ts (seerhr.org.branch, seerhr.org.branch.label)`

| Column           | Type        | Req | FK               | Description / allowed values              |
| ---------------- | ----------- | --- | ---------------- | ----------------------------------------- |
| user_id          | uuid        | Y   | users.id         |                                           |
| active_org_id    | varchar(20) | Y   | organizations.id | Entity being worked in                    |
| view_scope       | varchar(6)  | Y   |                  | Super Admin only Allowed: group \| entity |
| active_branch_id | varchar(80) |     |                  | Office::Branch id or entity branch id     |

#### user_sessions

Signed-in identity for the browser (UI: seereon.session.user holds the user id; signOut clears it). Production: server session / refresh token.  
**Entity:** UserSession · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/auth-session.ts → KEY seereon.session.user, signIn/signInAs/signOut, useIsSignedIn`; `src/lib/group-data.ts → activeOrgStore, viewScopeStore, localStorage seereon.scope`

| Column        | Type         | Req | FK               | Description / allowed values    |
| ------------- | ------------ | --- | ---------------- | ------------------------------- |
| id            | uuid         | Y   |                  |                                 |
| user_id       | uuid         | Y   | users.id         |                                 |
| device        | varchar(120) |     |                  |                                 |
| ip            | inet         |     |                  |                                 |
| created_at    | timestamptz  | Y   |                  |                                 |
| revoked_at    | timestamptz  |     |                  | revokeSessions / suspend        |
| active_org_id | varchar(20)  | Y   | organizations.id | Must be in accessibleOrgs(user) |
| view_scope    | varchar(6)   | Y   |                  | Allowed: group \| entity        |

Indexes: (user_id) where revoked_at is null

#### user_wallpapers (child)

Child of user_preferences — user_wallpapers (id varchar(20) PK 'wp-…', user_id, name, image_url, added_on date)  
**Entity:** UserWallpapers · **Primary key:** —

Source: `src/lib/appearance.ts → type UserPrefs/CustomWallpaper, store seereon.appearance.user.v1`; `src/lib/platform-data.ts → type ConsolePrefs, store seereon.platform.prefs.v1`

| Column             | Type         | Req | FK                       | Description / allowed values |
| ------------------ | ------------ | --- | ------------------------ | ---------------------------- |
| id                 | bigserial    | Y   |                          | Surrogate key                |
| user_preference_id | varchar(40)  | Y   | user_preferences.user_id | Parent UserPrefs             |
| user_id            | varchar(40)  |     | users.id                 |                              |
| name               | varchar(120) |     |                          |                              |
| image_url          | varchar(120) |     |                          |                              |
| added_on           | date         |     |                          | date                         |

Indexes: (user_preference_id)

#### users

Every sign-in account: client group Super Admin, entity Admins, CXOs, HR, HODs, managers, employees (seeded roster), invited users and Seereon platform staff. The app role drives screen (ROLE_NAV) and action (ROLE_ACTIONS) permissions.  
**Entity:** AppUser · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/auth-session.ts → type AppUser, SEEREON_USERS, PLATFORM_USERS; invited users: src/lib/rbac-store.ts → invitedStore (seereon.rbac.invited.v1)`

| Column                | Type         | Req | FK                | Description / allowed values                                                                                          |
| --------------------- | ------------ | --- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| code                  | varchar(20)  | Y   |                   | Business key, e.g. SRN-0006, SRN-ADMIN-1042, SRN-INV-001, SRN-PLAT-01                                                 |
| id                    | uuid         | Y   |                   | Surrogate primary key                                                                                                 |
| name                  | varchar(120) | Y   |                   | Full name                                                                                                             |
| email                 | citext       | Y   |                   | Sign-in identifier (login by e-mail or user code)                                                                     |
| app_role              | varchar(12)  | Y   |                   | Application role Allowed: SuperAdmin \| Admin \| CEO \| COO \| CFO \| CTO \| CHRO \| HR \| HOD \| Manager \| Employee |
| designation           | varchar(120) | Y   |                   | Job title                                                                                                             |
| department            | varchar(80)  | Y   | departments.name  | Department name (FK to departments in HR domain)                                                                      |
| branch                | varchar(80)  | Y   |                   | Branch / office name                                                                                                  |
| phone                 | varchar(20)  |     |                   | Phone                                                                                                                 |
| manager_id            | uuid         |     | users.id          | Reporting manager                                                                                                     |
| hr_partner_id         | uuid         |     | users.id          | HR business partner who owns this person's HR approvals                                                               |
| date_of_joining       | date         | Y   |                   | Joining date in this entity                                                                                           |
| group_date_of_joining | date         |     |                   | First joining date anywhere in the group (gratuity)                                                                   |
| org_id                | varchar(20)  | Y   | organizations.id  | Legal entity of the employment record                                                                                 |
| group_id              | varchar(20)  |     | company_groups.id | Company group (Super Admin scope)                                                                                     |
| landing_portal        | varchar(3)   | Y   |                   | Landing portal after sign-in (app = Seereon platform console) Allowed: org \| emp \| app                              |
| password_hash         | varchar(255) | Y   |                   | UI-only demo password; production stores a salted hash only                                                           |
| invited_on            | date         |     |                   | Set for invited users                                                                                                 |

Indexes: (email) unique; (org_id, app_role); (manager_id); (hr_partner_id); (code) unique

### 9.3 Employees & Organisation

#### announcement_acknowledgements

Read acknowledgement of a circular / announcement.  
**Entity:** AnnouncementAcknowledgement · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/ack-data.ts → Acknowledgement, seereon.acks.v1`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| id              | varchar(10)  | Y   |                  |                              |
| announcement_id | varchar(12)  | Y   | announcements.id |                              |
| emp_id          | varchar(20)  | Y   | employees.id     |                              |
| employee        | varchar(120) | Y   |                  |                              |
| acknowledged_at | timestamptz  | Y   |                  |                              |
| notified_hr     | boolean      | Y   |                  |                              |

Indexes: (announcement_id, emp_id) unique

#### building_blocks (child)

Child of buildings — building_blocks (id, name, building_id, floors)  
**Entity:** BuildingBlocks · **Primary key:** —

Source: `src/pages/InfrastructurePage.tsx → BuildingRow/BlockRow/FloorRow, shared lists infra-*:{orgId}`

| Column      | Type         | Req | FK           | Description / allowed values |
| ----------- | ------------ | --- | ------------ | ---------------------------- |
| id          | bigserial    | Y   |              | Surrogate key                |
| building_id | varchar(40)  | Y   | buildings.id | Parent Building              |
| name        | varchar(120) |     |              |                              |
| floors      | varchar(120) |     |              |                              |

Indexes: (building_id)

#### building_floors (child)

Child of buildings — building_floors (id, name, building_id, block_id, seats, occupied; occupied ≤ seats)  
**Entity:** BuildingFloors · **Primary key:** —

Source: `src/pages/InfrastructurePage.tsx → BuildingRow/BlockRow/FloorRow, shared lists infra-*:{orgId}`

| Column      | Type         | Req | FK           | Description / allowed values |
| ----------- | ------------ | --- | ------------ | ---------------------------- |
| id          | bigserial    | Y   |              | Surrogate key                |
| building_id | varchar(40)  | Y   | buildings.id | Parent Building              |
| name        | varchar(120) |     |              |                              |
| block_id    | varchar(120) |     |              |                              |
| seats       | varchar(120) |     |              |                              |
| occupied    | varchar(120) |     |              | ; occupied ≤ seats           |

Indexes: (building_id)

#### buildings

Buildings / blocks / floors under a branch (seat planning).  
**Entity:** Building · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/pages/InfrastructurePage.tsx → BuildingRow/BlockRow/FloorRow, shared lists infra-*:{orgId}`

| Column   | Type        | Req | FK                         | Description / allowed values |
| -------- | ----------- | --- | -------------------------- | ---------------------------- |
| id       | varchar(10) | Y   |                            |                              |
| name     | varchar(80) | Y   |                            |                              |
| branch   | varchar(80) | Y   | organization_branches.name |                              |
| floors   | smallint    | Y   |                            |                              |
| blocks   | smallint    | Y   |                            |                              |
| capacity | integer     | Y   |                            |                              |
| notes    | text        |     |                            |                              |
| org_id   | varchar(20) | Y   | organizations.id           | Owning entity (tenant)       |

Indexes: (org_id, name) unique

#### departments

Department master with Head of Department; every HOD routing reads it.  
**Entity:** Department · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/dept-data.ts → Department, store seereon.masters.departments.v1`

| Column      | Type        | Req | FK                         | Description / allowed values |
| ----------- | ----------- | --- | -------------------------- | ---------------------------- |
| id          | varchar(10) | Y   |                            | DEP-01                       |
| name        | varchar(80) | Y   |                            |                              |
| code        | varchar(10) | Y   |                            |                              |
| hod_id      | varchar(20) |     | employees.id               |                              |
| cost_centre | varchar(20) | Y   |                            |                              |
| location    | varchar(80) | Y   | organization_branches.name | Branch                       |
| org_id      | varchar(20) | Y   | organizations.id           | Owning entity (tenant)       |

Indexes: (org_id, code) unique; (org_id, name) unique

#### designations

Designation master (level, grade, band) per entity; drives record form, promotions and transfers.  
**Entity:** Designation · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-data.ts → DesignationRow, shared list infra-designations:{orgId}`

| Column      | Type        | Req | FK               | Description / allowed values                 |
| ----------- | ----------- | --- | ---------------- | -------------------------------------------- |
| id          | varchar(10) | Y   |                  |                                              |
| level       | smallint    | Y   |                  |                                              |
| name        | varchar(80) | Y   |                  |                                              |
| grade       | varchar(10) | Y   |                  |                                              |
| band        | varchar(12) | Y   |                  | Allowed: Entry \| Mid \| Senior \| Executive |
| department  | varchar(80) |     |                  |                                              |
| description | text        |     |                  |                                              |
| org_id      | varchar(20) | Y   | organizations.id | Owning entity (tenant)                       |

Indexes: (org_id, name) unique

#### employee_bank_accounts

Salary account captured on the employee record form.  
**Entity:** EmployeeBankAccount · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/employee-directory.ts → BankPatch, updateBankDetails(), seereon.directory.bank`

| Column      | Type         | Req | FK           | Description / allowed values                    |
| ----------- | ------------ | --- | ------------ | ----------------------------------------------- |
| employee_id | varchar(20)  | Y   | employees.id |                                                 |
| holder_name | varchar(120) | Y   |              |                                                 |
| bank_name   | varchar(80)  | Y   |              |                                                 |
| account_no  | varchar(18)  | Y   |              | 9–18 digits; stored encrypted, displayed masked |
| ifsc        | char(11)     | Y   |              | ^[A-Z]{4}0[A-Z0-9]{6}$                          |
| mode        | varchar(40)  | Y   |              | Allowed: NEFT \| IMPS \| RTGS                   |

#### employee_compensation

Current CTC and grade (set at hire, changed by promotion/appraisal).  
**Entity:** EmployeeCompensation · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/employee-directory.ts → extraCtc/extraStructure, localStorage seereon.directory.compensation`

| Column         | Type          | Req | FK                      | Description / allowed values |
| -------------- | ------------- | --- | ----------------------- | ---------------------------- |
| employee_id    | varchar(20)   | Y   | employees.id            |                              |
| ctc            | numeric(14,2) | Y   |                         | Annual CTC ₹                 |
| grade          | varchar(10)   | Y   | salary_structures.grade |                              |
| wage_type      | varchar(20)   | Y   |                         |                              |
| effective_from | date          |     |                         |                              |

#### employee_compensation_history (child)

Child of employee_compensation — employee_compensation_history (one row per promotion / increment)  
**Entity:** EmployeeCompensationHistory · **Primary key:** —

Source: `src/lib/employee-directory.ts → extraCtc/extraStructure, localStorage seereon.directory.compensation`

| Column                   | Type        | Req | FK                                | Description / allowed values |
| ------------------------ | ----------- | --- | --------------------------------- | ---------------------------- |
| id                       | bigserial   | Y   |                                   | Surrogate key                |
| employee_compensation_id | varchar(40) | Y   | employee_compensation.employee_id | Parent EmployeeCompensation  |
| value                    | text        | Y   |                                   | Item value (array element)   |

Indexes: (employee_compensation_id)

#### employee_job

Job & personal details of an employee (profile tabs): DOJ, probation, employment type, grade/wage type, reporting manager, DOB, gender.  
**Entity:** EmployeeJob · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/employee-directory.ts → EmployeeProfile.job/personal, extraJob map, extraStructure map, recordOverride`

| Column               | Type         | Req | FK                      | Description / allowed values                          |
| -------------------- | ------------ | --- | ----------------------- | ----------------------------------------------------- |
| employee_id          | varchar(20)  | Y   | employees.id            |                                                       |
| date_of_joining      | date         | Y   |                         |                                                       |
| confirmation_date    | date         |     |                         |                                                       |
| employment_type      | varchar(20)  | Y   |                         | Allowed: Full-time \| Part-time \| Contract \| Intern |
| probation_months     | smallint     | Y   |                         | 0 = none                                              |
| notice_period_days   | smallint     | Y   |                         |                                                       |
| grade                | varchar(10)  | Y   | salary_structures.grade |                                                       |
| wage_type            | varchar(20)  | Y   |                         | Allowed: Salaried \| Monthly wage \| Daily wage       |
| reporting_manager_id | varchar(20)  |     | employees.id            |                                                       |
| hr_partner_id        | varchar(20)  |     | employees.id            |                                                       |
| work_mode            | varchar(20)  |     |                         |                                                       |
| shift                | varchar(40)  |     |                         |                                                       |
| dob                  | date         |     |                         |                                                       |
| gender               | varchar(20)  |     |                         |                                                       |
| blood_group          | varchar(4)   |     |                         |                                                       |
| marital_status       | varchar(12)  |     |                         |                                                       |
| personal_email       | varchar(160) |     |                         |                                                       |

#### employee_statutory_ids

PAN / UAN / PF member id / ESI IP number captured on the record form or fixed from payroll checks.  
**Entity:** EmployeeStatutoryIds · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/employee-directory.ts → StatutoryPatch, seereon.directory.statutory`

| Column        | Type        | Req | FK           | Description / allowed values                 |
| ------------- | ----------- | --- | ------------ | -------------------------------------------- |
| employee_id   | varchar(20) | Y   | employees.id |                                              |
| pan           | char(10)    |     |              | ^[A-Z]{5}\d{4}[A-Z]$                         |
| uan           | char(12)    |     |              |                                              |
| pf_no         | varchar(30) |     |              |                                              |
| esi_no        | varchar(20) |     |              |                                              |
| aadhaar_last4 | char(4)     |     |              | Masked Aadhaar (full number must be vaulted) |

#### employees

Directory row of every employee (seeded roster + new hires); the single source for lists, pickers and sign-in mapping.  
**Entity:** Employee · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/employee-directory.ts → type Employee, EMPLOYEES + runtime extra[] (new hires re-registered from seereon.hiring.newhires)`

| Column | Type         | Req | FK                         | Description / allowed values                           |
| ------ | ------------ | --- | -------------------------- | ------------------------------------------------------ |
| id     | varchar(20)  | Y   |                            | SRN-0006 / NHR-0001 business key                       |
| name   | varchar(120) | Y   |                            |                                                        |
| email  | varchar(160) | Y   |                            | Work e-mail = login                                    |
| phone  | varchar(20)  | Y   |                            |                                                        |
| dept   | varchar(80)  | Y   | departments.name           | Department name (FK by name to departments within org) |
| role   | varchar(120) | Y   |                            | Designation / job title                                |
| branch | varchar(80)  | Y   | organization_branches.name | Branch name                                            |
| status | varchar(10)  | Y   |                            | Allowed: Active \| On Leave \| Notice                  |
| org_id | varchar(20)  | Y   | organizations.id           | Owning entity (tenant)                                 |

Indexes: (org_id, status); (org_id, dept); email unique

#### hr_partner_assignments

HR business partner owning an employee's HR approvals.  
**Entity:** HrPartnerAssignment · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-partner.ts → hrPartnerStore seereon.org.hr-partners.v1`

| Column      | Type        | Req | FK           | Description / allowed values |
| ----------- | ----------- | --- | ------------ | ---------------------------- |
| employee_id | varchar(20) | Y   | employees.id |                              |
| partner_id  | varchar(20) | Y   | employees.id |                              |

#### manager_assignments

Reporting line map (employee → manager).  
**Entity:** ManagerAssignment · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/manager-data.ts → managerStore seereon.org.managers.v1`

| Column      | Type        | Req | FK           | Description / allowed values |
| ----------- | ----------- | --- | ------------ | ---------------------------- |
| employee_id | varchar(20) | Y   | employees.id |                              |
| manager_id  | varchar(20) | Y   | employees.id | no cycles                    |

#### manager_substitutes

Delegated manager duties for a period.  
**Entity:** SubstituteManager · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/manager-data.ts → Substitute, seereon.org.substitutes.v1`

| Column        | Type        | Req | FK           | Description / allowed values |
| ------------- | ----------- | --- | ------------ | ---------------------------- |
| id            | varchar(10) | Y   |              |                              |
| manager_id    | varchar(20) | Y   | employees.id |                              |
| substitute_id | varchar(20) | Y   | employees.id |                              |
| scope         | varchar(40) | Y   |              |                              |
| from_date     | date        | Y   |              |                              |
| to_date       | date        | Y   |              |                              |
| reason        | text        | Y   |              |                              |
| status        | varchar(8)  | Y   |              | Allowed: Active \| Expired   |

#### promotion_case_approvals (child)

Child of promotion_cases — promotion_case_approvals (step, by, on, decision Approved|Rejected, note)  
**Entity:** PromotionCaseApprovals · **Primary key:** —

Source: `src/lib/people-cases.ts → PromotionCase, store seereon.cases.promotions.v2`

| Column            | Type         | Req | FK                 | Description / allowed values                   |
| ----------------- | ------------ | --- | ------------------ | ---------------------------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                                  |
| promotion_case_id | varchar(40)  | Y   | promotion_cases.id | Parent PromotionCase                           |
| step              | varchar(120) |     |                    |                                                |
| by                | varchar(120) |     |                    |                                                |
| on                | date         |     |                    |                                                |
| decision          | varchar(120) |     |                    | Approved\|Rejected Allowed: Approved\|Rejected |
| note              | text         |     |                    |                                                |

Indexes: (promotion_case_id)

#### promotion_case_attachments (child)

Child of promotion_cases — promotion_case_attachments (file_name)  
**Entity:** PromotionCaseAttachments · **Primary key:** —

Source: `src/lib/people-cases.ts → PromotionCase, store seereon.cases.promotions.v2`

| Column            | Type         | Req | FK                 | Description / allowed values |
| ----------------- | ------------ | --- | ------------------ | ---------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                |
| promotion_case_id | varchar(40)  | Y   | promotion_cases.id | Parent PromotionCase         |
| file_name         | varchar(120) |     |                    |                              |

Indexes: (promotion_case_id)

#### promotion_case_history (child)

Child of promotion_cases — promotion_case_history (at, by, action)  
**Entity:** PromotionCaseHistory · **Primary key:** —

Source: `src/lib/people-cases.ts → PromotionCase, store seereon.cases.promotions.v2`

| Column            | Type         | Req | FK                 | Description / allowed values |
| ----------------- | ------------ | --- | ------------------ | ---------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                |
| promotion_case_id | varchar(40)  | Y   | promotion_cases.id | Parent PromotionCase         |
| at                | date         |     |                    |                              |
| by                | varchar(120) |     |                    |                              |
| action            | text         |     |                    |                              |

Indexes: (promotion_case_id)

#### promotion_cases

Promotion / increment / appraisal outcome with 2-step approval and generated letter.  
**Entity:** PromotionCase · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/people-cases.ts → PromotionCase, store seereon.cases.promotions.v2`

| Column           | Type          | Req | FK                      | Description / allowed values                                            |
| ---------------- | ------------- | --- | ----------------------- | ----------------------------------------------------------------------- |
| id               | varchar(20)   | Y   |                         | PRM-2026-003                                                            |
| emp_id           | varchar(20)   | Y   | employees.id            |                                                                         |
| employee         | varchar(120)  | Y   |                         |                                                                         |
| dept             | varchar(80)   | Y   |                         |                                                                         |
| purpose          | varchar(60)   | Y   |                         |                                                                         |
| appraisal_ref    | varchar(30)   |     | self_appraisals.id      |                                                                         |
| basis            | text          | Y   |                         | required on submit                                                      |
| from_designation | varchar(120)  | Y   |                         |                                                                         |
| to_designation   | varchar(120)  | Y   |                         |                                                                         |
| from_grade       | varchar(10)   | Y   |                         |                                                                         |
| to_grade         | varchar(10)   | Y   | salary_structures.grade |                                                                         |
| from_ctc         | numeric(14,2) | Y   |                         |                                                                         |
| to_ctc           | numeric(14,2) | Y   |                         |                                                                         |
| hike_pct         | numeric(6,2)  | Y   |                         |                                                                         |
| effective_from   | date          | Y   |                         |                                                                         |
| new_manager      | varchar(120)  |     |                         |                                                                         |
| new_branch       | varchar(80)   |     |                         |                                                                         |
| probation_months | smallint      | Y   |                         |                                                                         |
| recommended_by   | varchar(120)  |     |                         |                                                                         |
| letter_type      | varchar(20)   | Y   |                         | Allowed: Promotion Letter \| Increment Letter \| Appointment Letter     |
| letter_mode      | varchar(24)   | Y   |                         | Allowed: Generate from template \| Attach signed letter                 |
| letter_body      | text          |     |                         |                                                                         |
| letter_ref       | varchar(30)   |     |                         |                                                                         |
| letter_file      | varchar(200)  |     |                         |                                                                         |
| status           | varchar(20)   | Y   |                         | Allowed: Draft \| Pending approval \| Approved \| Effective \| Rejected |
| created_on       | date          | Y   |                         |                                                                         |
| created_by       | varchar(120)  | Y   |                         |                                                                         |
| remarks          | text          |     |                         |                                                                         |
| org_id           | varchar(20)   | Y   | organizations.id        | Owning entity (tenant)                                                  |

Indexes: (emp_id, status); one open (Pending approval|Approved) case per employee

#### termination_case_approvals (child)

Child of termination_cases — termination_case_approvals (step, by, on, decision Approved|Rejected, note)  
**Entity:** TerminationCaseApprovals · **Primary key:** —

Source: `src/lib/people-cases.ts → TerminationCase, seereon.cases.terminations.v2`

| Column              | Type         | Req | FK                   | Description / allowed values                   |
| ------------------- | ------------ | --- | -------------------- | ---------------------------------------------- |
| id                  | bigserial    | Y   |                      | Surrogate key                                  |
| termination_case_id | varchar(40)  | Y   | termination_cases.id | Parent TerminationCase                         |
| step                | varchar(120) |     |                      |                                                |
| by                  | varchar(120) |     |                      |                                                |
| on                  | date         |     |                      |                                                |
| decision            | varchar(120) |     |                      | Approved\|Rejected Allowed: Approved\|Rejected |
| note                | text         |     |                      |                                                |

Indexes: (termination_case_id)

#### termination_case_evidence (child)

Child of termination_cases — termination_case_evidence (file_name)  
**Entity:** TerminationCaseEvidence · **Primary key:** —

Source: `src/lib/people-cases.ts → TerminationCase, seereon.cases.terminations.v2`

| Column              | Type         | Req | FK                   | Description / allowed values |
| ------------------- | ------------ | --- | -------------------- | ---------------------------- |
| id                  | bigserial    | Y   |                      | Surrogate key                |
| termination_case_id | varchar(40)  | Y   | termination_cases.id | Parent TerminationCase       |
| file_name           | varchar(120) |     |                      |                              |

Indexes: (termination_case_id)

#### termination_case_history (child)

Child of termination_cases — termination_case_history (at, by, action)  
**Entity:** TerminationCaseHistory · **Primary key:** —

Source: `src/lib/people-cases.ts → TerminationCase, seereon.cases.terminations.v2`

| Column              | Type         | Req | FK                   | Description / allowed values |
| ------------------- | ------------ | --- | -------------------- | ---------------------------- |
| id                  | bigserial    | Y   |                      | Surrogate key                |
| termination_case_id | varchar(40)  | Y   | termination_cases.id | Parent TerminationCase       |
| at                  | date         |     |                      |                              |
| by                  | varchar(120) |     |                      |                              |
| action              | text         |     |                      |                              |

Indexes: (termination_case_id)

#### termination_cases

For-cause / redundancy termination with due process and 3-step approval.  
**Entity:** TerminationCase · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/people-cases.ts → TerminationCase, seereon.cases.terminations.v2`

| Column             | Type         | Req | FK               | Description / allowed values                                   |
| ------------------ | ------------ | --- | ---------------- | -------------------------------------------------------------- |
| id                 | varchar(20)  | Y   |                  |                                                                |
| emp_id             | varchar(20)  | Y   | employees.id     |                                                                |
| employee           | varchar(120) | Y   |                  |                                                                |
| dept               | varchar(80)  | Y   |                  |                                                                |
| type               | varchar(60)  | Y   |                  | from termination type master                                   |
| reason             | text         | Y   |                  |                                                                |
| incident_date      | date         |     |                  | <= today                                                       |
| description        | text         |     |                  |                                                                |
| notice_mode        | varchar(24)  | Y   |                  | Allowed: Serve notice \| Pay in lieu \| Immediate (misconduct) |
| notice_days        | smallint     | Y   |                  |                                                                |
| last_working_day   | date         | Y   |                  | >= incident and hearing date                                   |
| fnf_required       | boolean      | Y   |                  |                                                                |
| gratuity_forfeited | boolean      | Y   |                  |                                                                |
| assets_recovered   | boolean      | Y   |                  |                                                                |
| access_revoked     | boolean      | Y   |                  |                                                                |
| hearing_date       | date         |     |                  |                                                                |
| show_cause_issued  | boolean      | Y   |                  |                                                                |
| employee_response  | text         |     |                  |                                                                |
| legal_review       | boolean      | Y   |                  |                                                                |
| initiated_by       | varchar(120) | Y   |                  |                                                                |
| letter_ref         | varchar(30)  |     |                  |                                                                |
| status             | varchar(20)  | Y   |                  | Allowed: Pending approval \| Approved \| Effective \| Rejected |
| created_on         | date         | Y   |                  |                                                                |
| created_by         | varchar(120) | Y   |                  |                                                                |
| org_id             | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                                         |

#### transfer_case_approvals (child)

Child of transfer_cases — transfer_case_approvals (step, by, on, decision Approved|Rejected, note)  
**Entity:** TransferCaseApprovals · **Primary key:** —

Source: `src/lib/people-cases.ts → TransferCase, seereon.cases.transfers.v2`

| Column           | Type         | Req | FK                | Description / allowed values                   |
| ---------------- | ------------ | --- | ----------------- | ---------------------------------------------- |
| id               | bigserial    | Y   |                   | Surrogate key                                  |
| transfer_case_id | varchar(40)  | Y   | transfer_cases.id | Parent TransferCase                            |
| step             | varchar(120) |     |                   |                                                |
| by               | varchar(120) |     |                   |                                                |
| on               | date         |     |                   |                                                |
| decision         | varchar(120) |     |                   | Approved\|Rejected Allowed: Approved\|Rejected |
| note             | text         |     |                   |                                                |

Indexes: (transfer_case_id)

#### transfer_case_attachments (child)

Child of transfer_cases — transfer_case_attachments  
**Entity:** TransferCaseAttachments · **Primary key:** —

Source: `src/lib/people-cases.ts → TransferCase, seereon.cases.transfers.v2`

| Column           | Type        | Req | FK                | Description / allowed values |
| ---------------- | ----------- | --- | ----------------- | ---------------------------- |
| id               | bigserial   | Y   |                   | Surrogate key                |
| transfer_case_id | varchar(40) | Y   | transfer_cases.id | Parent TransferCase          |
| value            | text        | Y   |                   | Item value (array element)   |

Indexes: (transfer_case_id)

#### transfer_case_history (child)

Child of transfer_cases — transfer_case_history (at, by, action)  
**Entity:** TransferCaseHistory · **Primary key:** —

Source: `src/lib/people-cases.ts → TransferCase, seereon.cases.transfers.v2`

| Column           | Type         | Req | FK                | Description / allowed values |
| ---------------- | ------------ | --- | ----------------- | ---------------------------- |
| id               | bigserial    | Y   |                   | Surrogate key                |
| transfer_case_id | varchar(40)  | Y   | transfer_cases.id | Parent TransferCase          |
| at               | date         |     |                   |                              |
| by               | varchar(120) |     |                   |                              |
| action           | text         |     |                   |                              |

Indexes: (transfer_case_id)

#### transfer_cases

Branch / department / manager / project / role transfer with HR approval and letter.  
**Entity:** TransferCase · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/people-cases.ts → TransferCase, seereon.cases.transfers.v2`

| Column               | Type          | Req | FK               | Description / allowed values                                                             |
| -------------------- | ------------- | --- | ---------------- | ---------------------------------------------------------------------------------------- |
| id                   | varchar(20)   | Y   |                  |                                                                                          |
| emp_id               | varchar(20)   | Y   | employees.id     |                                                                                          |
| employee             | varchar(120)  | Y   |                  |                                                                                          |
| type                 | varchar(20)   | Y   |                  | Allowed: Branch \| Department \| Entity \| Reporting manager \| Project / client \| Role |
| from_branch          | varchar(80)   | Y   |                  |                                                                                          |
| to_branch            | varchar(80)   | Y   |                  |                                                                                          |
| from_dept            | varchar(80)   | Y   |                  |                                                                                          |
| to_dept              | varchar(80)   | Y   |                  |                                                                                          |
| from_entity          | varchar(120)  | Y   |                  |                                                                                          |
| to_entity            | varchar(120)  | Y   |                  | must equal fromEntity (entity moves use group_transfers)                                 |
| from_manager         | varchar(120)  | Y   |                  |                                                                                          |
| to_manager           | varchar(120)  |     |                  |                                                                                          |
| new_designation      | varchar(120)  |     |                  |                                                                                          |
| effective_from       | date          | Y   |                  |                                                                                          |
| reason               | text          | Y   |                  |                                                                                          |
| requested_by         | varchar(12)   | Y   |                  | Allowed: Employee \| Manager \| HR \| Management                                         |
| relocation_allowance | numeric(14,2) | Y   |                  | >= 0                                                                                     |
| joining_travel       | boolean       | Y   |                  |                                                                                          |
| notice_days          | smallint      | Y   |                  |                                                                                          |
| handover_to          | varchar(120)  |     |                  |                                                                                          |
| assets_to_return     | text          |     |                  |                                                                                          |
| payroll_impact       | text          |     |                  |                                                                                          |
| letter_ref           | varchar(30)   |     |                  |                                                                                          |
| status               | varchar(20)   | Y   |                  | Allowed: Pending approval \| Approved \| Effective \| Rejected                           |
| created_on           | date          | Y   |                  |                                                                                          |
| created_by           | varchar(120)  | Y   |                  |                                                                                          |
| remarks              | text          |     |                  |                                                                                          |
| org_id               | varchar(20)   | Y   | organizations.id | Owning entity (tenant)                                                                   |

#### warning_case_evidence (child)

Child of warning_cases — warning_case_evidence  
**Entity:** WarningCaseEvidence · **Primary key:** —

Source: `src/lib/people-cases.ts → WarningCase, seereon.cases.warnings.v2`

| Column          | Type        | Req | FK               | Description / allowed values |
| --------------- | ----------- | --- | ---------------- | ---------------------------- |
| id              | bigserial   | Y   |                  | Surrogate key                |
| warning_case_id | varchar(40) | Y   | warning_cases.id | Parent WarningCase           |
| value           | text        | Y   |                  | Item value (array element)   |

Indexes: (warning_case_id)

#### warning_case_history (child)

Child of warning_cases — warning_case_history  
**Entity:** WarningCaseHistory · **Primary key:** —

Source: `src/lib/people-cases.ts → WarningCase, seereon.cases.warnings.v2`

| Column          | Type        | Req | FK               | Description / allowed values |
| --------------- | ----------- | --- | ---------------- | ---------------------------- |
| id              | bigserial   | Y   |                  | Surrogate key                |
| warning_case_id | varchar(40) | Y   | warning_cases.id | Parent WarningCase           |
| value           | text        | Y   |                  | Item value (array element)   |

Indexes: (warning_case_id)

#### warning_cases

Disciplinary warning with letter, employee acknowledgement and escalation.  
**Entity:** WarningCase · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/people-cases.ts → WarningCase, seereon.cases.warnings.v2`

| Column           | Type         | Req | FK               | Description / allowed values                   |
| ---------------- | ------------ | --- | ---------------- | ---------------------------------------------- |
| id               | varchar(20)  | Y   |                  |                                                |
| emp_id           | varchar(20)  | Y   | employees.id     |                                                |
| employee         | varchar(120) | Y   |                  |                                                |
| dept             | varchar(80)  | Y   |                  |                                                |
| type             | varchar(60)  | Y   |                  |                                                |
| severity         | varchar(16)  | Y   |                  | Allowed: Level 1 \| Level 2 \| Level 3 (final) |
| category         | varchar(60)  | Y   |                  |                                                |
| incident_date    | date         | Y   |                  | <= today                                       |
| description      | text         | Y   |                  |                                                |
| witnesses        | text         |     |                  |                                                |
| issued_by        | varchar(120) | Y   |                  |                                                |
| issued_on        | date         | Y   |                  |                                                |
| validity_months  | smallint     | Y   |                  | >= 1                                           |
| improvement_plan | text         |     |                  |                                                |
| review_date      | date         | Y   |                  | >= incidentDate                                |
| escalation       | text         |     |                  |                                                |
| pip_linked       | boolean      | Y   |                  |                                                |
| acknowledged     | boolean      | Y   |                  |                                                |
| acknowledged_on  | date         |     |                  |                                                |
| employee_comment | text         |     |                  |                                                |
| letter_ref       | varchar(30)  | Y   |                  |                                                |
| status           | varchar(20)  | Y   |                  | Allowed: Effective \| Closed                   |
| org_id           | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                         |

### 9.4 Recruitment & Onboarding

#### applicant_ats_reasons (child)

Child of applicants — applicant_ats_reasons (reason)  
**Entity:** ApplicantAtsReasons · **Primary key:** —

Source: `src/lib/recruitment-engine.ts → Applicant, store seereon.recruit.applicants`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| applicant_id | varchar(40)  | Y   | applicants.id | Parent Applicant             |
| reason       | varchar(120) |     |               |                              |

Indexes: (applicant_id)

#### applicant_history (child)

Child of applicants — applicant_history (at, by, action)  
**Entity:** ApplicantHistory · **Primary key:** —

Source: `src/lib/recruitment-engine.ts → Applicant, store seereon.recruit.applicants`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| applicant_id | varchar(40)  | Y   | applicants.id | Parent Applicant             |
| at           | date         |     |               |                              |
| by           | varchar(120) |     |               |                              |
| action       | text         |     |               |                              |

Indexes: (applicant_id)

#### applicant_skills (child)

Child of applicants — applicant_skills (skill)  
**Entity:** ApplicantSkills · **Primary key:** —

Source: `src/lib/recruitment-engine.ts → Applicant, store seereon.recruit.applicants`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| applicant_id | varchar(40)  | Y   | applicants.id | Parent Applicant             |
| skill        | varchar(120) |     |               |                              |

Indexes: (applicant_id)

#### applicants

Candidate for a job post; moves Applied → Shortlisted → Interviewing → Finalised → Offered → Onboarding (or Rejected).  
**Entity:** Applicant · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/recruitment-engine.ts → Applicant, store seereon.recruit.applicants`

| Column           | Type          | Req | FK           | Description / allowed values                                                                      |
| ---------------- | ------------- | --- | ------------ | ------------------------------------------------------------------------------------------------- |
| id               | varchar(10)   | Y   |              | CND-009                                                                                           |
| job_id           | varchar(10)   | Y   | job_posts.id |                                                                                                   |
| job_title        | varchar(120)  | Y   |              |                                                                                                   |
| name             | varchar(120)  | Y   |              |                                                                                                   |
| email            | varchar(160)  | Y   |              |                                                                                                   |
| phone            | varchar(20)   |     |              |                                                                                                   |
| source           | varchar(30)   | Y   |              |                                                                                                   |
| current_company  | varchar(120)  |     |              |                                                                                                   |
| experience_years | numeric(4,1)  | Y   |              | >= 0                                                                                              |
| current_ctc      | numeric(14,2) | Y   |              |                                                                                                   |
| expected_ctc     | numeric(14,2) | Y   |              |                                                                                                   |
| education        | varchar(160)  |     |              |                                                                                                   |
| notice_days      | smallint      | Y   |              |                                                                                                   |
| location         | varchar(80)   |     |              |                                                                                                   |
| cv_file          | varchar(200)  |     |              |                                                                                                   |
| cover_note       | text          |     |              |                                                                                                   |
| applied_on       | date          | Y   |              |                                                                                                   |
| stage            | varchar(12)   | Y   |              | Allowed: Applied \| Shortlisted \| Interviewing \| Finalised \| Offered \| Onboarding \| Rejected |
| ats_score        | smallint      |     |              | 0–100                                                                                             |
| ats_remarks      | text          |     |              |                                                                                                   |
| ats_ran_at       | date          |     |              |                                                                                                   |
| shortlist_by     | varchar(120)  |     |              |                                                                                                   |
| shortlist_how    | varchar(6)    |     |              | Allowed: Auto \| Manual                                                                           |
| shortlist_on     | date          |     |              |                                                                                                   |
| current_round    | varchar(40)   |     |              |                                                                                                   |
| finalised_on     | date          |     |              |                                                                                                   |
| finalised_by     | varchar(120)  |     |              |                                                                                                   |
| offer_id         | varchar(20)   |     | offers.id    |                                                                                                   |
| rejected_reason  | text          |     |              |                                                                                                   |

Indexes: (job_id, stage); (job_id, lower(email))

#### assessment_param_applies_to (child)

Child of assessment_params — assessment_param_applies_to (job_family)  
**Entity:** AssessmentParamAppliesTo · **Primary key:** —

Source: `src/lib/onboarding-data.ts → AssessmentParam, seereon.masters.assessment-params`

| Column              | Type         | Req | FK                   | Description / allowed values |
| ------------------- | ------------ | --- | -------------------- | ---------------------------- |
| id                  | bigserial    | Y   |                      | Surrogate key                |
| assessment_param_id | varchar(40)  | Y   | assessment_params.id | Parent AssessmentParam       |
| job_family          | varchar(120) |     |                      |                              |

Indexes: (assessment_param_id)

#### assessment_params

Weighted parameter used in candidate scorecards.  
**Entity:** AssessmentParam · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/onboarding-data.ts → AssessmentParam, seereon.masters.assessment-params`

| Column      | Type         | Req | FK               | Description / allowed values                                                                                      |
| ----------- | ------------ | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| id          | varchar(8)   | Y   |                  |                                                                                                                   |
| name        | varchar(80)  | Y   |                  |                                                                                                                   |
| param_group | varchar(20)  | Y   |                  | Allowed: Technical \| Behavioural \| Aptitude \| Attitude \| Communication \| Leadership \| Domain \| Culture fit |
| weight      | numeric(5,2) | Y   |                  | 1–100                                                                                                             |
| scale       | smallint     | Y   |                  | Allowed: 5 \| 10                                                                                                  |
| description | text         |     |                  |                                                                                                                   |
| mandatory   | boolean      | Y   |                  |                                                                                                                   |
| active      | boolean      | Y   |                  |                                                                                                                   |
| org_id      | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                                                                                            |

#### career_settings

Careers-portal branding, about-company and plain offer template per entity.  
**Entity:** CareerSettings · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/pages/RecruitmentMastersPage.tsx → CareerSettings, seereon.recruitment.career-settings.v1`

| Column         | Type         | Req | FK               | Description / allowed values                                  |
| -------------- | ------------ | --- | ---------------- | ------------------------------------------------------------- |
| id             | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| org_id         | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                                        |
| title          | varchar(120) | Y   |                  |                                                               |
| footer         | varchar(200) | Y   |                  |                                                               |
| mission        | text         | Y   |                  |                                                               |
| size           | varchar(20)  | Y   |                  |                                                               |
| industry       | varchar(80)  | Y   |                  |                                                               |
| offer_template | text         | Y   |                  |                                                               |

#### interviews

Scheduled interview round with mode, panel, feedback and result.  
**Entity:** Interview · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/recruitment-engine.ts → Interview (Applicant.interviews[])`

| Column       | Type         | Req | FK            | Description / allowed values                                        |
| ------------ | ------------ | --- | ------------- | ------------------------------------------------------------------- |
| id           | varchar(12)  | Y   |               | INT-009-1                                                           |
| applicant_id | varchar(10)  | Y   | applicants.id |                                                                     |
| round        | varchar(40)  | Y   |               |                                                                     |
| type         | varchar(40)  | Y   |               |                                                                     |
| mode         | varchar(10)  | Y   |               | Allowed: Online \| In-person                                        |
| date         | date         | Y   |               | >= today (IST)                                                      |
| time         | time         | Y   |               |                                                                     |
| duration_min | smallint     | Y   |               | > 0                                                                 |
| panel        | varchar(200) | Y   |               |                                                                     |
| link         | varchar(300) |     |               | required when Online                                                |
| venue        | varchar(200) |     |               | required when In-person                                             |
| status       | varchar(10)  | Y   |               | Allowed: Scheduled \| Completed \| No-show \| Cancelled             |
| scheduled_by | varchar(120) | Y   |               |                                                                     |
| scheduled_on | date         | Y   |               |                                                                     |
| feedback     | text         |     |               |                                                                     |
| result       | varchar(24)  |     |               | Allowed: Proceed to next round \| Fit for the job \| Reject \| Hold |
| scorecard_id | varchar(10)  |     | scorecards.id |                                                                     |
| completed_on | date         |     |               |                                                                     |
| completed_by | varchar(120) |     |               |                                                                     |

Indexes: one Scheduled interview per applicant

#### job_posts

Opening with JD, band, skills (ATS input) and status.  
**Entity:** JobPost · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/recruitment-engine.ts → JobPost, store seereon.recruit.jobs`

| Column      | Type          | Req | FK                  | Description / allowed values             |
| ----------- | ------------- | --- | ------------------- | ---------------------------------------- |
| id          | varchar(10)   | Y   |                     | JP-1005                                  |
| title       | varchar(120)  | Y   |                     |                                          |
| job_type    | varchar(20)   | Y   |                     |                                          |
| location    | varchar(80)   | Y   | master_entries.name |                                          |
| branch      | varchar(80)   |     |                     |                                          |
| positions   | smallint      |     |                     | >= 1                                     |
| priority    | varchar(8)    |     |                     | Allowed: Low \| Medium \| High \| Urgent |
| min_exp     | numeric(4,1)  |     |                     | <= maxExp                                |
| max_exp     | numeric(4,1)  |     |                     |                                          |
| min_salary  | numeric(14,2) |     |                     | <= maxSalary                             |
| max_salary  | numeric(14,2) |     |                     |                                          |
| deadline    | date          |     |                     | >= today                                 |
| skills      | text          |     |                     | comma-separated                          |
| description | text          |     |                     |                                          |
| portal_url  | varchar(200)  | Y   |                     |                                          |
| jd_file     | varchar(200)  |     |                     |                                          |
| department  | varchar(80)   |     |                     |                                          |
| grade       | varchar(10)   |     |                     |                                          |
| status      | varchar(8)    | Y   |                     | Allowed: Open \| On hold \| Closed       |
| created_on  | date          | Y   |                     |                                          |
| created_by  | varchar(120)  | Y   |                     |                                          |
| org_id      | varchar(20)   | Y   | organizations.id    | Owning entity (tenant)                   |

Indexes: (org_id, status)

#### new_hires

Hire record created by the record form, Hire/Re-hire dialog or the welcome e-mail; provisions directory row + login.  
**Entity:** NewHire · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hiring-data.ts → NewHireRecord, store seereon.hiring.newhires`

| Column           | Type          | Req | FK                      | Description / allowed values                                                       |
| ---------------- | ------------- | --- | ----------------------- | ---------------------------------------------------------------------------------- |
| id               | varchar(20)   | Y   |                         | NHR-0001 (max+1)                                                                   |
| first_name       | varchar(60)   | Y   |                         |                                                                                    |
| last_name        | varchar(60)   |     |                         |                                                                                    |
| personal_email   | varchar(160)  |     |                         |                                                                                    |
| work_email       | varchar(160)  | Y   |                         | generated firstname-lastname@domain, number suffix on collision                    |
| phone            | varchar(20)   |     |                         |                                                                                    |
| dob              | date          |     |                         |                                                                                    |
| gender           | varchar(20)   |     |                         |                                                                                    |
| org_id           | varchar(20)   | Y   | organizations.id        | Owning entity (tenant)                                                             |
| branch           | varchar(80)   | Y   |                         |                                                                                    |
| dept             | varchar(80)   | Y   |                         |                                                                                    |
| designation      | varchar(120)  | Y   |                         |                                                                                    |
| role             | varchar(12)   | Y   |                         | Access role Allowed: Employee \| Manager \| HOD \| HR \| CTO \| CFO \| COO \| CHRO |
| employment_type  | varchar(12)   | Y   |                         | Allowed: Full-time \| Part-time \| Contract \| Intern                              |
| manager_id       | varchar(20)   |     | employees.id            |                                                                                    |
| doj              | date          | Y   |                         |                                                                                    |
| probation_months | smallint      | Y   |                         |                                                                                    |
| ctc              | numeric(14,2) | Y   |                         |                                                                                    |
| pattern_id       | varchar(10)   |     | attendance_patterns.id  |                                                                                    |
| grade            | varchar(10)   |     | salary_structures.grade |                                                                                    |
| wage_type        | varchar(20)   |     |                         | Allowed: Salaried \| Monthly wage \| Daily wage                                    |
| status           | varchar(10)   | Y   |                         | Allowed: Active \| Re-hired                                                        |
| rehire_of_id     | varchar(20)   |     | employees.id            |                                                                                    |
| created_on       | date          | Y   |                         |                                                                                    |

Indexes: work_email unique; (org_id, doj)

#### offer_components (child)

Child of offers — offer_components (label, monthly) — HR-edited salary structure  
**Entity:** OfferComponents · **Primary key:** —

Source: `src/lib/onboarding-data.ts → OfferRecord, seereon.recruitment.offers.v2`

| Column   | Type          | Req | FK        | Description / allowed values |
| -------- | ------------- | --- | --------- | ---------------------------- |
| id       | bigserial     | Y   |           | Surrogate key                |
| offer_id | varchar(40)   | Y   | offers.id | Parent Offer                 |
| label    | varchar(120)  |     |           |                              |
| monthly  | numeric(14,2) |     |           |                              |

Indexes: (offer_id)

#### offer_documents (child)

Child of offers — offer_documents (key → required_docs.key, file_name, size, uploaded_at, status Uploaded|Verified|Rejected, note)  
**Entity:** OfferDocuments · **Primary key:** —

Source: `src/lib/onboarding-data.ts → OfferRecord, seereon.recruitment.offers.v2`

| Column      | Type         | Req | FK        | Description / allowed values                                       |
| ----------- | ------------ | --- | --------- | ------------------------------------------------------------------ |
| id          | bigserial    | Y   |           | Surrogate key                                                      |
| offer_id    | varchar(40)  | Y   | offers.id | Parent Offer                                                       |
| key         | varchar(120) |     |           | → required_docs.key (logical reference: required_docs.key)         |
| file_name   | varchar(120) |     |           |                                                                    |
| size        | varchar(120) |     |           |                                                                    |
| uploaded_at | date         |     |           |                                                                    |
| status      | varchar(120) |     |           | Uploaded\|Verified\|Rejected Allowed: Uploaded\|Verified\|Rejected |
| note        | text         |     |           |                                                                    |

Indexes: (offer_id)

#### offer_emails (child)

Child of offers — offer_emails (at, to, subject, body, kind Offer|Reminder|Welcome|Docs query)  
**Entity:** OfferEmails · **Primary key:** —

Source: `src/lib/onboarding-data.ts → OfferRecord, seereon.recruitment.offers.v2`

| Column   | Type         | Req | FK        | Description / allowed values                                                       |
| -------- | ------------ | --- | --------- | ---------------------------------------------------------------------------------- |
| id       | bigserial    | Y   |           | Surrogate key                                                                      |
| offer_id | varchar(40)  | Y   | offers.id | Parent Offer                                                                       |
| at       | date         |     |           |                                                                                    |
| to       | varchar(120) |     |           |                                                                                    |
| subject  | varchar(120) |     |           |                                                                                    |
| body     | text         |     |           |                                                                                    |
| kind     | varchar(120) |     |           | Offer\|Reminder\|Welcome\|Docs query Allowed: Offer\|Reminder\|Welcome\|Docs query |

Indexes: (offer_id)

#### offer_history (child)

Child of offers — offer_history (at, by, action)  
**Entity:** OfferHistory · **Primary key:** —

Source: `src/lib/onboarding-data.ts → OfferRecord, seereon.recruitment.offers.v2`

| Column   | Type         | Req | FK        | Description / allowed values |
| -------- | ------------ | --- | --------- | ---------------------------- |
| id       | bigserial    | Y   |           | Surrogate key                |
| offer_id | varchar(40)  | Y   | offers.id | Parent Offer                 |
| at       | date         |     |           |                              |
| by       | varchar(120) |     |           |                              |
| action   | text         |     |           |                              |

Indexes: (offer_id)

#### offers

Offer lifecycle: letter, secure candidate link, e-sign, document upload & verification, welcome e-mail that provisions the employee.  
**Entity:** Offer · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/onboarding-data.ts → OfferRecord, seereon.recruitment.offers.v2`

| Column          | Type          | Req | FK                      | Description / allowed values                                                                                                |
| --------------- | ------------- | --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| id              | varchar(20)   | Y   |                         | OFR-2026-016                                                                                                                |
| candidate_id    | varchar(10)   | Y   | applicants.id           |                                                                                                                             |
| candidate       | varchar(120)  | Y   |                         |                                                                                                                             |
| email           | varchar(160)  | Y   |                         |                                                                                                                             |
| phone           | varchar(20)   |     |                         |                                                                                                                             |
| position        | varchar(120)  | Y   |                         |                                                                                                                             |
| department      | varchar(80)   | Y   |                         |                                                                                                                             |
| grade           | varchar(10)   | Y   | salary_structures.grade |                                                                                                                             |
| branch          | varchar(80)   | Y   |                         |                                                                                                                             |
| ctc             | numeric(14,2) | Y   |                         | > 0                                                                                                                         |
| joining_date    | date          | Y   |                         | >= expiryDate                                                                                                               |
| expiry_date     | date          | Y   |                         | >= today at creation                                                                                                        |
| template_id     | varchar(40)   | Y   | doc_templates.id        |                                                                                                                             |
| letter_body     | text          |     |                         |                                                                                                                             |
| status          | varchar(16)   | Y   |                         | Allowed: Draft \| Sent \| Viewed \| Accepted \| Declined \| Docs Submitted \| Verified \| Welcome Sent \| Joined \| Expired |
| token           | char(16)      | Y   |                         | secure link token                                                                                                           |
| sent_at         | timestamptz   |     |                         |                                                                                                                             |
| viewed_at       | timestamptz   |     |                         |                                                                                                                             |
| accepted_at     | timestamptz   |     |                         |                                                                                                                             |
| signature       | varchar(120)  |     |                         |                                                                                                                             |
| decline_reason  | text          |     |                         |                                                                                                                             |
| verified_by     | varchar(120)  |     |                         |                                                                                                                             |
| verified_at     | timestamptz   |     |                         |                                                                                                                             |
| welcome_sent_at | timestamptz   |     |                         |                                                                                                                             |
| employee_id     | varchar(20)   |     | employees.id            |                                                                                                                             |
| work_email      | varchar(160)  |     |                         |                                                                                                                             |
| temp_password   | text          |     |                         | never store; send once                                                                                                      |
| org_id          | varchar(20)   | Y   | organizations.id        | Owning entity (tenant)                                                                                                      |

Indexes: token unique; one active (not Declined/Expired) offer per candidate

#### referral_case_history (child)

Child of referral_cases — referral_case_history  
**Entity:** ReferralCaseHistory · **Primary key:** —

Source: `src/lib/people-cases.ts → ReferralCase, seereon.cases.referrals.v2`

| Column           | Type        | Req | FK                | Description / allowed values |
| ---------------- | ----------- | --- | ----------------- | ---------------------------- |
| id               | bigserial   | Y   |                   | Surrogate key                |
| referral_case_id | varchar(40) | Y   | referral_cases.id | Parent ReferralCase          |
| value            | text        | Y   |                   | Item value (array element)   |

Indexes: (referral_case_id)

#### referral_cases

Employee referral; creates an applicant (source Referral) and tracks bonus.  
**Entity:** ReferralCase · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/people-cases.ts → ReferralCase, seereon.cases.referrals.v2`

| Column           | Type          | Req | FK               | Description / allowed values                                                           |
| ---------------- | ------------- | --- | ---------------- | -------------------------------------------------------------------------------------- |
| id               | varchar(20)   | Y   |                  |                                                                                        |
| referrer_id      | varchar(20)   | Y   | employees.id     |                                                                                        |
| referrer         | varchar(120)  | Y   |                  |                                                                                        |
| referrer_dept    | varchar(80)   | Y   |                  |                                                                                        |
| candidate        | varchar(120)  | Y   |                  |                                                                                        |
| email            | varchar(160)  | Y   |                  |                                                                                        |
| phone            | varchar(20)   |     |                  |                                                                                        |
| relationship     | varchar(40)   | Y   |                  |                                                                                        |
| job_id           | varchar(10)   | Y   | job_posts.id     |                                                                                        |
| job_title        | varchar(120)  | Y   |                  |                                                                                        |
| cv_file          | varchar(200)  |     |                  |                                                                                        |
| skills           | text          |     |                  |                                                                                        |
| experience_years | numeric(4,1)  | Y   |                  |                                                                                        |
| note             | text          |     |                  |                                                                                        |
| applicant_id     | varchar(10)   |     | applicants.id    |                                                                                        |
| bonus_eligible   | boolean       | Y   |                  |                                                                                        |
| bonus_amount     | numeric(14,2) | Y   |                  |                                                                                        |
| bonus_paid_on    | date          |     |                  |                                                                                        |
| status           | varchar(14)   | Y   |                  | Allowed: Submitted \| Screening \| Interviewing \| Hired \| Bonus paid \| Not selected |
| created_on       | date          | Y   |                  |                                                                                        |
| org_id           | varchar(20)   | Y   | organizations.id | Owning entity (tenant)                                                                 |

Indexes: (job_id, email) unique among non-rejected applicants

#### required_documents

Documents a candidate uploads on the offer link.  
**Entity:** RequiredDocument · **Primary key:** key

Source: `src/lib/onboarding-data.ts → REQUIRED_DOCS`

| Column    | Type        | Req | FK  | Description / allowed values |
| --------- | ----------- | --- | --- | ---------------------------- |
| key       | varchar(20) | Y   |     |                              |
| label     | varchar(80) | Y   |     |                              |
| mandatory | boolean     | Y   |     |                              |

#### scorecard_scores (child)

Child of scorecards — scorecard_scores (param_id → assessment_params.id, score, note)  
**Entity:** ScorecardScores · **Primary key:** —

Source: `src/lib/onboarding-data.ts → Scorecard, seereon.recruitment.scorecards`

| Column       | Type         | Req | FK                   | Description / allowed values |
| ------------ | ------------ | --- | -------------------- | ---------------------------- |
| id           | bigserial    | Y   |                      | Surrogate key                |
| scorecard_id | varchar(40)  | Y   | scorecards.id        | Parent Scorecard             |
| param_id     | varchar(120) |     | assessment_params.id | → assessment_params.id       |
| score        | varchar(120) |     |                      |                              |
| note         | text         |     |                      |                              |

Indexes: (scorecard_id)

#### scorecards

Assessment of a candidate for one round; weighted % computed from params.  
**Entity:** Scorecard · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/onboarding-data.ts → Scorecard, seereon.recruitment.scorecards`

| Column         | Type         | Req | FK            | Description / allowed values                      |
| -------------- | ------------ | --- | ------------- | ------------------------------------------------- |
| id             | varchar(10)  | Y   |               |                                                   |
| candidate_id   | varchar(10)  | Y   | applicants.id |                                                   |
| candidate      | varchar(120) | Y   |               |                                                   |
| round          | varchar(40)  | Y   |               |                                                   |
| assessor       | varchar(120) | Y   |               |                                                   |
| assessed_on    | date         | Y   |               |                                                   |
| weighted_pct   | numeric(5,2) | Y   |               |                                                   |
| recommendation | varchar(12)  | Y   |               | Allowed: Strong hire \| Proceed \| Hold \| Reject |
| remarks        | text         |     |               |                                                   |

### 9.5 Masters, Policies & Documents

#### doc_styles

Design style (header, footer, watermark, font, accent).  
**Entity:** DocStyle · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/doc-master.ts → DesignStyle, seereon.docmaster.styles`

| Column               | Type         | Req | FK  | Description / allowed values |
| -------------------- | ------------ | --- | --- | ---------------------------- |
| id                   | varchar(20)  | Y   |     |                              |
| name                 | varchar(80)  | Y   |     |                              |
| header_style         | varchar(20)  | Y   |     |                              |
| footer_style         | varchar(24)  | Y   |     |                              |
| watermark            | varchar(16)  |     |     |                              |
| font                 | varchar(24)  | Y   |     |                              |
| accent               | char(7)      | Y   |     |                              |
| font_size            | numeric(4,1) | Y   |     |                              |
| margin_mm            | smallint     | Y   |     |                              |
| show_signature_block | boolean      | Y   |     |                              |

#### doc_template_fields (child)

Child of doc_templates — doc_template_fields (key, label, type, options jsonb, required)  
**Entity:** DocTemplateFields · **Primary key:** —

Source: `src/lib/doc-master.ts → DocTemplateV2, seereon.docmaster.templates.v3`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key                |
| doc_template_id | varchar(40)  | Y   | doc_templates.id | Parent DocTemplate           |
| key             | varchar(120) |     |                  |                              |
| label           | varchar(120) |     |                  |                              |
| type            | varchar(120) |     |                  |                              |
| options         | jsonb        |     |                  | jsonb                        |
| required        | boolean      |     |                  |                              |

Indexes: (doc_template_id)

#### doc_template_sections (child)

Child of doc_templates — doc_template_sections (heading, body, position)  
**Entity:** DocTemplateSections · **Primary key:** —

Source: `src/lib/doc-master.ts → DocTemplateV2, seereon.docmaster.templates.v3`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key                |
| doc_template_id | varchar(40)  | Y   | doc_templates.id | Parent DocTemplate           |
| heading         | varchar(120) |     |                  |                              |
| body            | text         |     |                  |                              |
| position        | varchar(120) |     |                  |                              |

Indexes: (doc_template_id)

#### doc_templates

Doc Master template per document type on a design style; renders every letter/form.  
**Entity:** DocTemplate · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/doc-master.ts → DocTemplateV2, seereon.docmaster.templates.v3`

| Column                | Type         | Req | FK            | Description / allowed values |
| --------------------- | ------------ | --- | ------------- | ---------------------------- |
| id                    | varchar(40)  | Y   |               |                              |
| doc_type              | varchar(40)  | Y   |               | 23 document types            |
| name                  | varchar(120) | Y   |               |                              |
| style_id              | varchar(20)  | Y   | doc_styles.id |                              |
| entity                | varchar(120) | Y   |               | 'All entities' or entity     |
| subject               | varchar(200) | Y   |               |                              |
| body                  | text         | Y   |               | {{token}} placeholders       |
| signatory             | varchar(120) |     |               |                              |
| signatory_designation | varchar(120) |     |               |                              |
| version               | integer      | Y   |               | incremented on every save    |
| active                | boolean      | Y   |               |                              |
| updated_on            | date         | Y   |               |                              |
| updated_by            | varchar(120) | Y   |               |                              |

Indexes: (doc_type, active)

#### geofence_rules

Attendance geofence.  
**Entity:** GeofenceRule · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/master-data.ts → GeofenceRule (shared list geofence-rules)`

| Column                     | Type         | Req | FK               | Description / allowed values |
| -------------------------- | ------------ | --- | ---------------- | ---------------------------- |
| id                         | varchar(8)   | Y   |                  |                              |
| name                       | varchar(80)  | Y   |                  |                              |
| address                    | text         | Y   |                  |                              |
| latitude                   | numeric(9,6) |     |                  | -90..90                      |
| longitude                  | numeric(9,6) |     |                  | -180..180                    |
| radius                     | integer      | Y   |                  | > 0 m                        |
| applies_to                 | text         | Y   |                  |                              |
| enforced                   | boolean      | Y   |                  |                              |
| allow_override_with_reason | boolean      | Y   |                  |                              |
| active                     | boolean      | Y   |                  |                              |
| org_id                     | varchar(20)  | Y   | organizations.id | Owning entity (tenant)       |

#### handbook_acknowledgements

Employee e-signature of a handbook version.  
**Entity:** HandbookAcknowledgement · **Primary key:** emp_id, version · **Tenant-scoped** (org_id)

Source: `src/lib/handbook-data.ts → HandbookAck`

| Column          | Type         | Req | FK                        | Description / allowed values |
| --------------- | ------------ | --- | ------------------------- | ---------------------------- |
| emp_id          | varchar(20)  | Y   | employees.id              |                              |
| employee        | varchar(120) | Y   |                           |                              |
| version         | varchar(10)  | Y   | handbook_versions.version |                              |
| acknowledged_on | date         | Y   |                           |                              |
| signature       | varchar(120) | Y   |                           | must equal employee name     |

Indexes: (emp_id, version) unique

#### handbook_versions

Published Employee Handbook versions.  
**Entity:** HandbookVersion · **Primary key:** version · **Tenant-scoped** (org_id)

Source: `src/lib/handbook-data.ts → HandbookVersion, seereon.handbook`

| Column       | Type         | Req | FK               | Description / allowed values                  |
| ------------ | ------------ | --- | ---------------- | --------------------------------------------- |
| version      | varchar(10)  | Y   |                  | unique                                        |
| published_on | date         | Y   |                  |                                               |
| published_by | varchar(120) | Y   |                  |                                               |
| source       | varchar(24)  | Y   |                  | Allowed: Doc Master template \| Uploaded file |
| file_name    | varchar(200) | Y   |                  |                                               |
| template_id  | varchar(40)  |     | doc_templates.id |                                               |
| summary      | text         | Y   |                  |                                               |
| require_ack  | boolean      | Y   |                  |                                               |
| ack_due_days | smallint     | Y   |                  |                                               |
| change_notes | text         |     |                  |                                               |
| org_id       | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                        |

#### holiday_calendar_days

Read view of National / State / Optional holidays for a branch (maintained in Master Data).  
**Entity:** Holiday · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-masters.ts holidayCalendarStore → holidaysAsLegacy(); display type src/lib/leave-data.ts Holiday`

| Column        | Type         | Req | FK  | Description / allowed values            |
| ------------- | ------------ | --- | --- | --------------------------------------- |
| id            | varchar(24)  | Y   |     | `${calendarId}-${i}`                    |
| name          | varchar(120) | Y   |     |                                         |
| holiday_date  | date         | Y   |     |                                         |
| type          | varchar(12)  | Y   |     | Allowed: Public \| Festival \| Optional |
| paid          | boolean      | Y   |     | Optional/restricted = unpaid            |
| calendar_name | varchar(120) | Y   |     |                                         |

Indexes: (calendar_id, holiday_date) unique

#### holiday_calendars

National / regional / optional holiday calendar assigned to branches.  
**Entity:** HolidayCalendar · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-masters.ts → HolidayCalendar, seereon.masters.holiday-calendars`

| Column        | Type         | Req | FK               | Description / allowed values                                   |
| ------------- | ------------ | --- | ---------------- | -------------------------------------------------------------- |
| id            | varchar(20)  | Y   |                  |                                                                |
| name          | varchar(80)  | Y   |                  |                                                                |
| type          | varchar(24)  | Y   |                  | Allowed: National \| Regional / State \| Optional / Restricted |
| year          | smallint     | Y   |                  |                                                                |
| applies_to    | text         |     |                  | comma-separated branches; empty = all                          |
| uploaded_file | varchar(200) |     |                  |                                                                |
| active        | boolean      | Y   |                  |                                                                |
| org_id        | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                                         |

#### holidays (child)

Child of holiday_calendars — holidays (calendar_id, date, name) — unique (calendar_id, date); date within year  
**Entity:** Holidays · **Primary key:** —

Source: `src/lib/hr-masters.ts → HolidayCalendar, seereon.masters.holiday-calendars`

| Column              | Type        | Req | FK                   | Description / allowed values        |
| ------------------- | ----------- | --- | -------------------- | ----------------------------------- |
| id                  | bigserial   | Y   |                      | Surrogate key                       |
| holiday_calendar_id | varchar(40) | Y   | holiday_calendars.id | Parent HolidayCalendar              |
| calendar_id         | varchar(40) |     | holiday_calendars.id | , date, name) — unique (calendar_id |
| date                | date        |     |                      |                                     |

Indexes: (holiday_calendar_id)

#### insurance_plans

ESI / group mediclaim / term life plan master.  
**Entity:** InsurancePlan · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-masters.ts → InsurancePlan, seereon.masters.insurance-plans`

| Column                   | Type          | Req | FK               | Description / allowed values                                            |
| ------------------------ | ------------- | --- | ---------------- | ----------------------------------------------------------------------- |
| id                       | varchar(8)    | Y   |                  |                                                                         |
| name                     | varchar(80)   | Y   |                  |                                                                         |
| kind                     | varchar(20)   | Y   |                  | Allowed: ESI \| Group mediclaim \| Group term life \| Personal accident |
| provider                 | varchar(80)   | Y   |                  |                                                                         |
| sum_insured              | numeric(14,2) | Y   |                  |                                                                         |
| employee_premium_monthly | numeric(10,2) | Y   |                  |                                                                         |
| employer_premium_monthly | numeric(10,2) | Y   |                  |                                                                         |
| coverage                 | varchar(20)   | Y   |                  |                                                                         |
| eligibility              | text          | Y   |                  |                                                                         |
| active                   | boolean       | Y   |                  |                                                                         |
| org_id                   | varchar(20)   | Y   | organizations.id | Owning entity (tenant)                                                  |

#### ip_rules

Network restriction for sign-in / punching.  
**Entity:** IpRule · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/master-data.ts → IpRule (shared list ip-rules)`

| Column     | Type        | Req | FK               | Description / allowed values |
| ---------- | ----------- | --- | ---------------- | ---------------------------- |
| id         | varchar(8)  | Y   |                  |                              |
| name       | varchar(80) | Y   |                  |                              |
| address    | cidr        | Y   |                  | IPv4 or CIDR                 |
| restricted | boolean     | Y   |                  |                              |
| org_id     | varchar(20) | Y   | organizations.id | Owning entity (tenant)       |

#### leave_policies

Entity leave policy (clubbing, sandwich rule, EL encashment, comp-off validity).  
**Entity:** LeavePolicy · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-masters.ts → LeavePolicy, seereon.masters.leave-policy`

| Column                          | Type         | Req | FK               | Description / allowed values                                  |
| ------------------------------- | ------------ | --- | ---------------- | ------------------------------------------------------------- |
| id                              | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| org_id                          | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                                        |
| allow_club_s_l_c_l_with_holiday | boolean      | Y   |                  |                                                               |
| allow_club_s_l_c_l_with_e_l     | boolean      | Y   |                  |                                                               |
| sandwich_rule                   | boolean      | Y   |                  |                                                               |
| el_encashment_month             | smallint     | Y   |                  | 1–12                                                          |
| el_encash_max_days              | smallint     | Y   |                  |                                                               |
| el_encash_basis                 | varchar(6)   | Y   |                  | Allowed: Gross \| Basic                                       |
| el_encash_component             | varchar(60)  | Y   |                  |                                                               |
| comp_off_validity_days          | smallint     | Y   |                  |                                                               |
| updated_by                      | varchar(120) | Y   |                  |                                                               |
| updated_on                      | date         | Y   |                  |                                                               |

#### leave_types

Leave master with credit, carry-forward, encashment and approval rules.  
**Entity:** LeaveType · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-masters.ts → LeaveMasterRow, seereon.masters.leave`

| Column                | Type         | Req | FK               | Description / allowed values                                                  |
| --------------------- | ------------ | --- | ---------------- | ----------------------------------------------------------------------------- |
| id                    | varchar(8)   | Y   |                  |                                                                               |
| name                  | varchar(60)  | Y   |                  |                                                                               |
| code                  | varchar(6)   | Y   |                  |                                                                               |
| annual                | numeric(5,1) | Y   |                  | >= 0                                                                          |
| credit_frequency      | varchar(20)  | Y   |                  | Allowed: Quarterly pro-rata \| Monthly pro-rata \| Annual upfront \| On event |
| carry_forward         | boolean      | Y   |                  |                                                                               |
| max_carry             | numeric(5,1) | Y   |                  |                                                                               |
| encashable            | boolean      | Y   |                  |                                                                               |
| encash_on             | varchar(6)   | Y   |                  | Allowed: Gross \| Basic                                                       |
| clubbable             | boolean      | Y   |                  |                                                                               |
| min_days              | numeric(3,1) | Y   |                  |                                                                               |
| max_consecutive       | smallint     | Y   |                  |                                                                               |
| needs_attachment      | boolean      | Y   |                  |                                                                               |
| attachment_after_days | smallint     | Y   |                  |                                                                               |
| approval_chain        | varchar(24)  | Y   |                  | Allowed: Manager \| Manager → HR \| HOD \| HOD → HR \| Manager → HOD → HR     |
| validity_days         | smallint     | Y   |                  |                                                                               |
| paid                  | boolean      | Y   |                  |                                                                               |
| applicable_to         | varchar(60)  | Y   |                  |                                                                               |
| active                | boolean      | Y   |                  |                                                                               |
| org_id                | varchar(20)  | Y   | organizations.id | Owning entity (tenant)                                                        |

#### master_entries

Generic master-data rows for CrudSection-based masters (job types, trainers, pay grades …) keyed by section.  
**Entity:** MasterEntry · **Primary key:** org_id, section_key, code · **Tenant-scoped** (org_id)

Source: `src/components/shell/CrudSection.tsx → type CrudRow, stores seereon.crud.<prefix>.<slug>.v1`

| Column      | Type        | Req | FK               | Description / allowed values                      |
| ----------- | ----------- | --- | ---------------- | ------------------------------------------------- |
| code        | varchar(20) | Y   |                  | <PREFIX>-001 (max+1 per section)                  |
| section_key | varchar(80) | Y   |                  | <idPrefix>.<title-slug>                           |
| data        | jsonb       | Y   |                  | Section-defined fields (schema varies per master) |
| org_id      | varchar(20) | Y   | organizations.id |                                                   |

Indexes: (org_id, section_key, code) unique

#### master_items

Generic name/description masters: onboarding documents (DOC), awards (AWD), termination types (TTY), warning types (WTY), complaint types (CTY).  
**Entity:** MasterItem · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/master-data.ts → MasterItem + org.masters.tsx MasterTable (shared list master-{PREFIX})`

| Column      | Type        | Req | FK               | Description / allowed values             |
| ----------- | ----------- | --- | ---------------- | ---------------------------------------- |
| id          | varchar(10) | Y   |                  |                                          |
| kind        | varchar(4)  | Y   |                  | Allowed: DOC \| AWD \| TTY \| WTY \| CTY |
| name        | varchar(80) | Y   |                  | unique per kind                          |
| description | text        |     |                  |                                          |
| required    | boolean     |     |                  | documents only                           |
| org_id      | varchar(20) | Y   | organizations.id | Owning entity (tenant)                   |

Indexes: (org_id, kind, lower(name)) unique

#### pay_components

Pay component rendered in the employee compensation form.  
**Entity:** PayComponent · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/master-data.ts → PayComponent (shared list pay-components)`

| Column                | Type        | Req | FK               | Description / allowed values                                   |
| --------------------- | ----------- | --- | ---------------- | -------------------------------------------------------------- |
| id                    | varchar(8)  | Y   |                  |                                                                |
| name                  | varchar(80) | Y   |                  |                                                                |
| code                  | varchar(12) | Y   |                  |                                                                |
| kind                  | varchar(10) | Y   |                  | Allowed: Allowance \| Deduction \| Earning \| Statutory        |
| calculation           | varchar(12) | Y   |                  | Allowed: Flat \| % of Basic \| % of CTC \| Balancing \| Annual |
| value                 | varchar(20) | Y   |                  |                                                                |
| description           | text        |     |                  |                                                                |
| show_in_employee_form | boolean     | Y   |                  |                                                                |
| org_id                | varchar(20) | Y   | organizations.id | Owning entity (tenant)                                         |

#### policy_documents

Seed policy/circular list used by /org/masters (Policies & Circulars).  
**Entity:** PolicyDocument · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/support-data.ts → POLICY_DOCS / POLICY_CATEGORIES`

| Column      | Type         | Req | FK               | Description / allowed values                                                    |
| ----------- | ------------ | --- | ---------------- | ------------------------------------------------------------------------------- |
| id          | varchar(20)  | Y   |                  | PLC-001                                                                         |
| org_id      | varchar(20)  | Y   | organizations.id | Proposed                                                                        |
| name        | varchar(200) | Y   |                  |                                                                                 |
| category    | varchar(30)  | Y   |                  | Allowed: HR Policy \| Compliance \| Finance \| IT & Security \| Health & Safety |
| description | text         |     |                  |                                                                                 |
| file_name   | varchar(255) | Y   |                  |                                                                                 |
| updated_on  | date         | Y   |                  |                                                                                 |

### 9.6 Time, Attendance, Leave & Travel

#### approval_steps

Generic approval-chain step shared by tours and comp-off (and assets / appraisals elsewhere).  
**Entity:** ApprovalStep · **Primary key:** subject_type, subject_id, seq · **Tenant-scoped** (org_id)

Source: `src/lib/approval-chain.ts → type ApprovalStep (embedded in TourRequest.chain, CompOffRedemption.chain)`

| Column        | Type         | Req | FK       | Description / allowed values                                   |
| ------------- | ------------ | --- | -------- | -------------------------------------------------------------- |
| subject_type  | varchar(30)  | Y   |          | Proposed polymorphic owner Allowed: tour \| compoff_redemption |
| subject_id    | varchar(12)  | Y   |          |                                                                |
| seq           | smallint     | Y   |          | Order in chain                                                 |
| role          | varchar(12)  | Y   |          | Allowed: HOD \| Manager \| HRPartner \| HR \| CFO \| …AppRole  |
| label         | varchar(60)  | Y   |          |                                                                |
| approver_id   | varchar(20)  |     | users.id |                                                                |
| approver_name | varchar(120) | Y   |          |                                                                |
| status        | varchar(10)  | Y   |          | Allowed: Pending \| Approved \| Rejected \| Skipped            |
| acted_on      | date         |     |          |                                                                |
| note          | text         |     |          |                                                                |

Indexes: (subject_type, subject_id, seq) unique

#### attendance_locks

HR lock of a month's attendance for payroll, per entity.  
**Entity:** AttendanceLock · **Primary key:** org_id, period · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-pattern.ts → attendanceLockStore seereon.attendance.locks (key `${orgId}:${period}`)`

| Column    | Type         | Req | FK               | Description / allowed values |
| --------- | ------------ | --- | ---------------- | ---------------------------- |
| org_id    | varchar(20)  | Y   | organizations.id | Owning entity                |
| period    | char(7)      | Y   |                  | YYYY-MM                      |
| locked_by | varchar(120) | Y   |                  | Name (proposed FK users.id)  |
| locked_on | date         | Y   |                  |                              |

Indexes: (org_id, period) unique

#### attendance_overtime_rules

Overtime / comp-off reward rule (OTR-04 drives comp-off accrual).  
**Entity:** OvertimeRule · **Primary key:** org_id, code · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-data.ts → type OvertimeRule, store seereon.attendance.overtime-rules.v1`

| Column            | Type         | Req | FK               | Description / allowed values                                        |
| ----------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------- |
| code              | varchar(10)  | Y   |                  | OTR-01                                                              |
| org_id            | varchar(20)  | Y   | organizations.id | Owning entity                                                       |
| name              | varchar(120) | Y   |                  |                                                                     |
| applies_after     | varchar(80)  | Y   |                  |                                                                     |
| reward_type       | varchar(32)  | Y   |                  | Allowed: Multiplier of Hourly Rate \| Fixed Amount / hr \| Comp Off |
| reward_value      | varchar(40)  | Y   |                  |                                                                     |
| requires_approval | boolean      | Y   |                  |                                                                     |
| monthly_cap       | varchar(40)  | Y   |                  |                                                                     |
| active            | boolean      | Y   |                  |                                                                     |

Indexes: (org_id, code) unique

#### attendance_patterns

Pay-as-you-go pattern: payable days and paid absences before LOP.  
**Entity:** AttendancePattern · **Primary key:** org_id, code · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-pattern.ts → type AttendancePattern, store seereon.payroll.patterns`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| code            | varchar(10)  | Y   |                  | PAT-01                       |
| org_id          | varchar(20)  | Y   | organizations.id | Owning entity                |
| name            | varchar(120) | Y   |                  |                              |
| working_days    | integer      | Y   |                  |                              |
| paid_leave_days | integer      | Y   |                  |                              |
| lop_enabled     | boolean      | Y   |                  |                              |
| weekly_offs     | integer      | Y   |                  |                              |
| description     | text         |     |                  |                              |
| status          | varchar(8)   | Y   |                  | Allowed: Active \| Draft     |

Indexes: (org_id, code) unique

#### attendance_penalty_rules

Deduction rule for short hours / late / half day / absence / early exit.  
**Entity:** PenaltyRule · **Primary key:** org_id, code · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-data.ts → type PenaltyRule, store seereon.attendance.penalty-rules.v1`

| Column          | Type         | Req | FK               | Description / allowed values                                                |
| --------------- | ------------ | --- | ---------------- | --------------------------------------------------------------------------- |
| code            | varchar(10)  | Y   |                  | PEN-01                                                                      |
| org_id          | varchar(20)  | Y   | organizations.id | Owning entity                                                               |
| name            | varchar(120) | Y   |                  |                                                                             |
| trigger         | varchar(20)  | Y   |                  | Allowed: Short Hours \| Late Arrival \| Half Day \| Absent \| Early Exit    |
| threshold       | varchar(80)  | Y   |                  | Free text e.g. '< 7.5 hrs / day' (proposed: threshold_value numeric + unit) |
| deduction_type  | varchar(24)  | Y   |                  | Allowed: Fixed Amount \| % of Daily Wage \| Leave Deduction                 |
| deduction_value | varchar(40)  | Y   |                  | '25%', '₹ 250', '0.5 day' (proposed numeric(14,2))                          |
| grace_count     | integer      | Y   |                  | Occurrences / month before applying (≥0)                                    |
| applies_to      | varchar(80)  | Y   |                  | 'All offices' or office                                                     |
| active          | boolean      | Y   |                  |                                                                             |

Indexes: (org_id, code) unique

#### attendance_punches

A self-service clock-in / clock-out (manual, biometric device or geofenced).  
**Entity:** Punch · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-self.ts → type Punch, store seereon.attendance.punches`

| Column        | Type         | Req | FK                | Description / allowed values                                     |
| ------------- | ------------ | --- | ----------------- | ---------------------------------------------------------------- |
| code          | varchar(24)  | Y   |                   | PCH-<base36 timestamp>                                           |
| org_id        | varchar(20)  | Y   | organizations.id  | Derived from employee (not stored in prototype)                  |
| employee_id   | varchar(20)  | Y   | employees.id      | Employee                                                         |
| employee_name | varchar(120) | Y   |                   | Denormalised name                                                |
| work_date     | date         | Y   |                   | Local calendar date of punch-in                                  |
| in_time       | time         | Y   |                   | HH:mm local                                                      |
| out_time      | time         |     |                   | Empty while open; may be next day for night shifts               |
| source        | varchar(12)  | Y   |                   | Marking mode Allowed: Manual \| Biometric \| Geofence            |
| location      | varchar(160) | Y   |                   | Device / fence / web portal                                      |
| note          | text         |     |                   | Reason; '[Outside geofence: …]' prefix when an override was used |
| geofence_id   | varchar(20)  |     | geofence_rules.id | Proposed: fence used for a geofence punch                        |

Indexes: (employee_id, work_date); partial unique (employee_id) where out_time is null — one open punch per employee

#### attendance_register

Daily P/A/L register (seed baseline + punches + approved leave / comp-off), read by the report, reviews and payroll.  
**Entity:** AttendanceDay · **Primary key:** employee_id, att_date · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-data.ts → AttendanceRow.days, src/lib/attendance-live.ts useLiveAttendance`

| Column      | Type        | Req | FK               | Description / allowed values                               |
| ----------- | ----------- | --- | ---------------- | ---------------------------------------------------------- |
| employee_id | varchar(20) | Y   | employees.id     | Employee                                                   |
| org_id      | varchar(20) | Y   | organizations.id | Owning entity                                              |
| att_date    | date        | Y   |                  |                                                            |
| status      | char(1)     | Y   |                  | Weekends are week-offs, not counted Allowed: P \| A \| L   |
| source      | varchar(16) |     |                  | Proposed: seed / punch / leave / comp-off / regularisation |

Indexes: (employee_id, att_date) unique

#### attendance_work_days

Per-day computed work hours (seed register + derived from punches) used for OT / short hours / late marks.  
**Entity:** WorkDayRecord · **Primary key:** employee_id, work_date · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-data.ts → type WorkDayRecord (WORK_RECORDS) + WorkHoursTab punch mapping`

| Column            | Type         | Req | FK               | Description / allowed values                                 |
| ----------------- | ------------ | --- | ---------------- | ------------------------------------------------------------ |
| employee_id       | varchar(20)  | Y   | employees.id     | Employee                                                     |
| org_id            | varchar(20)  | Y   | organizations.id | Owning entity                                                |
| work_date         | date         | Y   |                  |                                                              |
| shift_name        | varchar(80)  | Y   |                  | Proposed FK shifts.id                                        |
| check_in          | time         |     |                  |                                                              |
| check_out         | time         |     |                  |                                                              |
| worked_hours      | numeric(5,2) | Y   |                  |                                                              |
| required_hours    | numeric(5,2) | Y   |                  |                                                              |
| break_minutes     | integer      | Y   |                  |                                                              |
| late_minutes      | integer      | Y   |                  |                                                              |
| early_out_minutes | integer      | Y   |                  |                                                              |
| day_type          | varchar(12)  | Y   |                  | Allowed: Full Day \| Half Day \| Absent \| Leave \| Week Off |
| ot_approved       | boolean      | Y   |                  |                                                              |

Indexes: (employee_id, work_date) unique

#### attendance_work_hour_policy

Full/half-day hour thresholds and windows (one row per entity).  
**Entity:** HalfDayPolicy · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-data.ts → HalfDayPolicy, store seereon.attendance.halfday-policy.v1`

| Column                  | Type         | Req | FK               | Description / allowed values |
| ----------------------- | ------------ | --- | ---------------- | ---------------------------- |
| org_id                  | varchar(20)  | Y   | organizations.id | Owning entity                |
| min_hours_full_day      | numeric(4,2) | Y   |                  | > half-day, ≤ 24             |
| min_hours_half_day      | numeric(4,2) | Y   |                  | > 0                          |
| first_half_window       | varchar(20)  | Y   |                  |                              |
| second_half_window      | varchar(20)  | Y   |                  |                              |
| max_half_days_per_month | integer      | Y   |                  | ≥ 0                          |
| counts_against_leave    | boolean      | Y   |                  |                              |

Indexes: (org_id) unique

#### compoff_ledger

Comp-off credit (auto: worked / toured on an off day) or debit (approved redemption).  
**Entity:** CompOffLedgerEntry · **Primary key:** source_kind, source_punch_id · **Tenant-scoped** (org_id)

Source: `src/lib/compoff-data.ts → CompOffLedgerEntry, store seereon.compoff.ledger`

| Column          | Type         | Req | FK                      | Description / allowed values               |
| --------------- | ------------ | --- | ----------------------- | ------------------------------------------ |
| code            | varchar(10)  | Y   |                         | CO-0001                                    |
| employee_id     | varchar(20)  | Y   | employees.id            |                                            |
| entry_type      | varchar(6)   | Y   |                         | Allowed: Credit \| Debit                   |
| days            | numeric(4,1) | Y   |                         | 0.5 per qualifying instance; monthly cap 2 |
| reason          | text         | Y   |                         |                                            |
| source_kind     | varchar(16)  |     |                         | Allowed: worked-off-day \| tour-off-day    |
| source_date     | date         |     |                         |                                            |
| source_punch_id | varchar(24)  |     | attendance_punches.code |                                            |
| source_tour_id  | varchar(10)  |     | tours.code              |                                            |
| created_on      | date         | Y   |                         |                                            |
| expires_on      | date         |     |                         | createdOn + Leave Master CO validityDays   |

Indexes: unique (source_kind, source_punch_id); unique (source_kind, source_tour_id, source_date); (employee_id, created_on)

#### compoff_redemptions

Request to avail comp-off days, HOD approval (fallback Manager → HR).  
**Entity:** CompOffRedemption · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/compoff-data.ts → CompOffRedemption, store seereon.compoff.redemptions`

| Column        | Type         | Req | FK           | Description / allowed values                                  |
| ------------- | ------------ | --- | ------------ | ------------------------------------------------------------- |
| id            | bigserial    | Y   |              | Surrogate key (added — the prototype record has no single id) |
| code          | varchar(10)  | Y   |              | COR-001                                                       |
| employee_id   | varchar(20)  | Y   | employees.id |                                                               |
| employee_name | varchar(120) | Y   |              |                                                               |
| from_date     | date         | Y   |              |                                                               |
| to_date       | date         | Y   |              |                                                               |
| days          | numeric(4,1) | Y   |              | Working days (0.5 for a half day)                             |
| reason        | text         | Y   |              |                                                               |
| —             | text         | Y   |              |                                                               |
| status        | varchar(20)  | Y   |              | Allowed: Pending Approval \| Approved \| Rejected             |
| raised_on     | date         | Y   |              |                                                               |

Indexes: (employee_id, status)

#### employee_work_configs

Per-employee pattern + optional workday override (days/week, hours/day, week-offs, timesheet requirement).  
**Entity:** EmployeeWorkConfig · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-pattern.ts → EmployeeWorkConfig/WorkdayOverride, store seereon.payroll.workconfig`

| Column             | Type         | Req | FK                       | Description / allowed values |
| ------------------ | ------------ | --- | ------------------------ | ---------------------------- |
| employee_id        | varchar(20)  | Y   | employees.id             | Employee                     |
| pattern_id         | varchar(10)  | Y   | attendance_patterns.code |                              |
| days_per_week      | smallint     |     |                          | null = branch default        |
| hours_per_day      | numeric(4,2) |     |                          |                              |
| timesheet_required | boolean      |     |                          |                              |
| week_offs          | varchar(3)[] |     |                          | ['Sat','Sun']                |
| note               | text         |     |                          |                              |
| updated_on         | date         | Y   |                          |                              |
| updated_by         | varchar(120) | Y   |                          |                              |

Indexes: (employee_id) unique

#### leave_application_approvals (child)

Child of leave_applications — leave_application_approvals (flattened from chainLog[]: step, by, on, note)  
**Entity:** LeaveApplicationApprovals · **Primary key:** —

Source: `src/lib/leave-data.ts → type LeaveApplication, store seereon.leave.applications.v1`

| Column               | Type         | Req | FK                    | Description / allowed values |
| -------------------- | ------------ | --- | --------------------- | ---------------------------- |
| id                   | bigserial    | Y   |                       | Surrogate key                |
| leave_application_id | varchar(40)  | Y   | leave_applications.id | Parent LeaveApplication      |
| step                 | varchar(120) |     |                       |                              |
| by                   | varchar(120) |     |                       |                              |
| on                   | date         |     |                       |                              |
| note                 | text         |     |                       |                              |

Indexes: (leave_application_id)

#### leave_application_documents (child)

Child of leave_applications — leave_application_documents (from documents[])  
**Entity:** LeaveApplicationDocuments · **Primary key:** —

Source: `src/lib/leave-data.ts → type LeaveApplication, store seereon.leave.applications.v1`

| Column               | Type        | Req | FK                    | Description / allowed values |
| -------------------- | ----------- | --- | --------------------- | ---------------------------- |
| id                   | bigserial   | Y   |                       | Surrogate key                |
| leave_application_id | varchar(40) | Y   | leave_applications.id | Parent LeaveApplication      |
| value                | text        | Y   |                       | Item value (array element)   |

Indexes: (leave_application_id)

#### leave_applications

Leave request with multi-step approval chain from the Leave Master.  
**Entity:** LeaveApplication · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/leave-data.ts → type LeaveApplication, store seereon.leave.applications.v1`

| Column                | Type         | Req | FK               | Description / allowed values                                        |
| --------------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------- |
| id                    | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id)       |
| code                  | varchar(12)  | Y   |                  | LVA-5101                                                            |
| org_id                | varchar(20)  | Y   | organizations.id | Derived from employee (proposed stored)                             |
| employee_id           | varchar(20)  | Y   | employees.id     | Employee                                                            |
| employee_name         | varchar(120) | Y   |                  |                                                                     |
| leave_type            | varchar(60)  | Y   | leave_types.name | Leave Master name (proposed FK leave_master.id)                     |
| from_date             | date         | Y   |                  |                                                                     |
| to_date               | date         | Y   |                  | ≥ from_date                                                         |
| days                  | numeric(5,1) | Y   |                  | Working days excl. weekends + paid branch holidays; half day = −0.5 |
| day_part              | varchar(12)  |     |                  | Allowed: Full day \| First half \| Second half                      |
| description           | text         | Y   |                  |                                                                     |
| reason_category       | varchar(40)  |     |                  | LEAVE_REASON_CATEGORIES                                             |
| attachment            | varchar(255) |     |                  | First document                                                      |
| documents             | text         |     |                  | Supporting documents                                                |
| contact_during_leave  | varchar(120) |     |                  |                                                                     |
| location_during_leave | varchar(120) |     |                  |                                                                     |
| handover_to           | varchar(120) |     |                  | Name (proposed FK employees.id)                                     |
| handover_notes        | text         |     |                  |                                                                     |
| status                | varchar(10)  | Y   |                  | Allowed: Pending \| Approved \| Rejected                            |
| approval_chain        | varchar(60)  |     |                  | e.g. 'Manager → HR'                                                 |
| chain_step            | smallint     |     |                  | 0-based pending step                                                |
| decision_reason       | text         |     |                  |                                                                     |
| decided_by            | varchar(120) |     |                  |                                                                     |
| decided_on            | date         |     |                  |                                                                     |
| applied_on            | date         |     |                  |                                                                     |
| applied_by            | varchar(120) |     |                  | Set when HR files on behalf                                         |

Indexes: (employee_id, from_date, to_date); (org_id, status); exclusion constraint: no overlapping non-rejected requests per employee (daterange)

#### shifts

Shift master (timings, break window, office).  
**Entity:** Shift · **Primary key:** org_id, lower(name · **Tenant-scoped** (org_id)

Source: `src/lib/attendance-data.ts → type Shift, store seereon.attendance.shifts.v1`

| Column        | Type        | Req | FK               | Description / allowed values          |
| ------------- | ----------- | --- | ---------------- | ------------------------------------- |
| code          | varchar(10) | Y   |                  | SHF-01                                |
| org_id        | varchar(20) | Y   | organizations.id | Owning entity                         |
| name          | varchar(80) | Y   |                  | Unique per entity                     |
| start_time    | time        | Y   |                  | HH:mm                                 |
| end_time      | time        | Y   |                  | HH:mm; end < start = crosses midnight |
| break_enabled | boolean     | Y   |                  |                                       |
| break_start   | time        |     |                  |                                       |
| break_end     | time        |     |                  |                                       |
| office        | varchar(80) | Y   |                  | Branch / office                       |
| headcount     | integer     | Y   |                  | Display count                         |

Indexes: (org_id, lower(name)) unique

#### timesheet_entries

One task line on a day, submitted for manager approval.  
**Entity:** TimesheetEntry · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/timesheet-data.ts → TimesheetEntry, store seereon.timesheets.v3`

| Column           | Type         | Req | FK           | Description / allowed values                                  |
| ---------------- | ------------ | --- | ------------ | ------------------------------------------------------------- |
| id               | bigserial    | Y   |              | Surrogate key (added — the prototype record has no single id) |
| code             | varchar(12)  | Y   |              | TSE-0001                                                      |
| employee_id      | varchar(20)  | Y   | employees.id | Employee                                                      |
| employee_name    | varchar(120) | Y   |              |                                                               |
| format_name      | varchar(120) | Y   |              | Proposed FK timesheet_formats.id                              |
| work_date        | date         | Y   |              | ≤ today                                                       |
| task             | varchar(200) | Y   |              |                                                               |
| description      | text         |     |              |                                                               |
| start_time       | time         |     |              |                                                               |
| end_time         | time         |     |              | > start_time                                                  |
| hours            | numeric(5,2) | Y   |              | 0 < h; Σ per day ≤ 24                                         |
| task_status      | varchar(16)  | Y   |              | Allowed: Not Started \| In Progress \| Completed \| Blocked   |
| status           | varchar(10)  | Y   |              | Allowed: Draft \| Submitted \| Approved \| Rejected           |
| approver_remarks | text         |     |              | Required on rejection                                         |
| project          | varchar(120) |     |              |                                                               |
| billable         | boolean      |     |              |                                                               |

Indexes: (employee_id, work_date); (status)

#### timesheet_formats

Timesheet template configured by HR (frequency + visible fields).  
**Entity:** TimesheetFormat · **Primary key:** org_id, name · **Tenant-scoped** (org_id)

Source: `src/lib/timesheet-data.ts → TimesheetFormat, timesheetFormatStore (in-memory)`

| Column      | Type          | Req | FK               | Description / allowed values        |
| ----------- | ------------- | --- | ---------------- | ----------------------------------- |
| code        | varchar(10)   | Y   |                  | TSF-001                             |
| org_id      | varchar(20)   | Y   | organizations.id | Owning entity                       |
| name        | varchar(120)  | Y   |                  |                                     |
| frequency   | varchar(8)    | Y   |                  | Allowed: Daily \| Weekly \| Monthly |
| department  | varchar(80)   | Y   |                  |                                     |
| fields      | varchar(20)[] | Y   |                  | Subset of TIMESHEET_FIELDS          |
| description | text          |     |                  |                                     |
| active      | boolean       | Y   |                  |                                     |

Indexes: (org_id, name) unique

#### tour_bills

Bill attached to a tour for audit; can be claimed as an expense line.  
**Entity:** TourBill · **Primary key:** tour_id, code · **Tenant-scoped** (org_id)

Source: `src/lib/tour-data.ts → TourBill (TourRequest.bills[])`

| Column              | Type          | Req | FK                 | Description / allowed values                                   |
| ------------------- | ------------- | --- | ------------------ | -------------------------------------------------------------- |
| tour_id             | varchar(10)   | Y   | tours.code         |                                                                |
| code                | varchar(6)    | Y   |                    | BL-01 (unique per tour)                                        |
| name                | varchar(160)  | Y   |                    |                                                                |
| vendor              | varchar(120)  | Y   |                    |                                                                |
| invoice_no          | varchar(60)   |     |                    |                                                                |
| category            | varchar(24)   | Y   |                    | Expense head                                                   |
| amount              | numeric(14,2) | Y   |                    | > 0                                                            |
| gst                 | numeric(14,2) | Y   |                    | 0 ≤ gst ≤ amount                                               |
| bill_date           | date          | Y   |                    |                                                                |
| paid_by             | varchar(16)   | Y   |                    | Allowed: Employee \| Company card \| Advance \| Vendor invoice |
| file                | varchar(255)  | Y   |                    |                                                                |
| uploaded_by         | varchar(120)  | Y   |                    |                                                                |
| uploaded_on         | date          | Y   |                    |                                                                |
| linked_expense_code | varchar(6)    |     | tour_expenses.code |                                                                |
| note                | text          |     |                    |                                                                |

Indexes: (tour_id, code) unique

#### tour_expenses

Expense line booked against a tour; approved lines less advance = encashable.  
**Entity:** TourExpense · **Primary key:** tour_id, code · **Tenant-scoped** (org_id)

Source: `src/lib/tour-data.ts → TourExpense (TourRequest.expenses[])`

| Column       | Type          | Req | FK         | Description / allowed values                                                            |
| ------------ | ------------- | --- | ---------- | --------------------------------------------------------------------------------------- |
| tour_id      | varchar(10)   | Y   | tours.code |                                                                                         |
| code         | varchar(6)    | Y   |            | TX-01 (unique per tour)                                                                 |
| head         | varchar(24)   | Y   |            | Allowed: Travel \| Lodging \| Food \| Local conveyance \| Client entertainment \| Other |
| amount       | numeric(14,2) | Y   |            | > 0                                                                                     |
| expense_date | date          | Y   |            |                                                                                         |
| receipt_file | varchar(255)  |     |            |                                                                                         |
| approved     | boolean       | Y   |            |                                                                                         |
| vendor       | varchar(120)  |     |            |                                                                                         |
| invoice_no   | varchar(60)   |     |            |                                                                                         |
| paid_by      | varchar(16)   |     |            | Allowed: Employee \| Company card \| Advance                                            |
| note         | text          |     |            |                                                                                         |
| added_by     | varchar(120)  |     |            |                                                                                         |

Indexes: (tour_id, code) unique

#### tour_proof_documents (child)

Child of tours — tour_proof_documents (proofDocuments[]: name, url)  
**Entity:** TourProofDocuments · **Primary key:** —

Source: `src/lib/tour-data.ts → TourRequest, store seereon.tours.v2`

| Column  | Type         | Req | FK       | Description / allowed values |
| ------- | ------------ | --- | -------- | ---------------------------- |
| id      | bigserial    | Y   |          | Surrogate key                |
| tour_id | varchar(40)  | Y   | tours.id | Parent TourRequest           |
| name    | varchar(120) |     |          |                              |
| url     | varchar(120) |     |          |                              |

Indexes: (tour_id)

#### tour_travellers (child)

Child of tours — tour_travellers (travellers[]: employee_id)  
**Entity:** TourTravellers · **Primary key:** —

Source: `src/lib/tour-data.ts → TourRequest, store seereon.tours.v2`

| Column      | Type        | Req | FK           | Description / allowed values |
| ----------- | ----------- | --- | ------------ | ---------------------------- |
| id          | bigserial   | Y   |              | Surrogate key                |
| tour_id     | varchar(40) | Y   | tours.id     | Parent TourRequest           |
| employee_id | varchar(40) |     | employees.id |                              |

Indexes: (tour_id)

#### tours

Business tour: request → HOD → HR → Finance approval (or HR-assigned, pre-approved), outcome, expenses, bills, petty-cash encashment.  
**Entity:** TourRequest · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/tour-data.ts → TourRequest, store seereon.tours.v2`

| Column                                                                                                                            | Type          | Req | FK                        | Description / allowed values                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------- | --- | ------------------------- | --------------------------------------------------------------------------------- |
| id                                                                                                                                | bigserial     | Y   |                           | Surrogate key (added — the prototype record has no single id)                     |
| code                                                                                                                              | varchar(10)   | Y   |                           | TUR-001                                                                           |
| org_id                                                                                                                            | varchar(20)   | Y   | organizations.id          | Owning entity                                                                     |
| employee_id                                                                                                                       | varchar(20)   | Y   | employees.id              | Requester / primary traveller                                                     |
| employee_name                                                                                                                     | varchar(120)  | Y   |                           |                                                                                   |
| purpose                                                                                                                           | text          | Y   |                           |                                                                                   |
| destination                                                                                                                       | varchar(160)  | Y   |                           |                                                                                   |
| start_date                                                                                                                        | date          | Y   |                           |                                                                                   |
| end_date                                                                                                                          | date          | Y   |                           | ≥ start_date                                                                      |
| travel_mode                                                                                                                       | varchar(16)   | Y   |                           | Allowed: Road \| Rail \| Air \| Own Vehicle \| Site Transport                     |
| estimated_cost                                                                                                                    | numeric(14,2) | Y   |                           | > 0 (request)                                                                     |
| cost_centre                                                                                                                       | varchar(20)   | Y   |                           |                                                                                   |
| status                                                                                                                            | varchar(20)   | Y   |                           | Allowed: Draft \| Pending Approval \| Approved \| Rejected \| Completed \| Closed |
| raised_on                                                                                                                         | date          | Y   |                           |                                                                                   |
| outcome                                                                                                                           | text          |     |                           |                                                                                   |
| outcome_submitted_on                                                                                                              | date          |     |                           |                                                                                   |
| advance_paid                                                                                                                      | numeric(14,2) |     |                           | ≥ 0                                                                               |
| encashed_amount                                                                                                                   | numeric(14,2) |     |                           |                                                                                   |
| encashment_claim_id                                                                                                               | varchar(12)   |     | reimbursement_claims.code |                                                                                   |
| encashed_on                                                                                                                       | date          |     |                           |                                                                                   |
| assigned_by                                                                                                                       | varchar(120)  |     |                           | HR-created tours                                                                  |
| assigned_on                                                                                                                       | date          |     |                           |                                                                                   |
| assignment_note                                                                                                                   | text          |     |                           |                                                                                   |
| client                                                                                                                            | varchar(120)  |     |                           |                                                                                   |
| project                                                                                                                           | varchar(120)  |     |                           |                                                                                   |
| itinerary                                                                                                                         | text          |     |                           |                                                                                   |
| accommodation                                                                                                                     | varchar(160)  |     |                           |                                                                                   |
| booking_refs                                                                                                                      | varchar(200)  |     |                           |                                                                                   |
| revenue_generated, revenue_saved, target_revenue, target_savings (numeric(14,2)), deals_closed, leads (int), outcome_notes (text) | text          |     |                           | Tour ROI inputs (≥0)                                                              |

Indexes: (org_id, status); (employee_id)

#### wage_attendance

Daily muster mark for a wage worker.  
**Entity:** WageAttendance · **Primary key:** worker_id, att_date · **Tenant-scoped** (org_id)

Source: `src/lib/wage-workers.ts → WageAttendance, store seereon.wage.attendance.v1`

| Column    | Type         | Req | FK                | Description / allowed values     |
| --------- | ------------ | --- | ----------------- | -------------------------------- |
| worker_id | varchar(10)  | Y   | wage_workers.code |                                  |
| att_date  | date         | Y   |                   | ≤ today; month not locked        |
| mark      | varchar(2)   | Y   |                   | Allowed: P \| A \| H \| WO \| PH |
| in_time   | time         |     |                   | Required for P/H                 |
| out_time  | time         |     |                   | Required for P/H                 |
| ot_hours  | numeric(4,1) | Y   |                   | 0–12                             |
| marked_by | varchar(120) | Y   |                   |                                  |
| note      | text         |     |                   |                                  |

Indexes: (worker_id, att_date) unique

#### wage_workers

Daily / monthly wage worker (contract labour) — attendance only.  
**Entity:** WageWorker · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/wage-workers.ts → WageWorker, store seereon.wage.workers.v1`

| Column          | Type         | Req | FK               | Description / allowed values                                  |
| --------------- | ------------ | --- | ---------------- | ------------------------------------------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| code            | varchar(10)  | Y   |                  | WW-001                                                        |
| org_id          | varchar(20)  | Y   | organizations.id | Owning entity                                                 |
| name            | varchar(120) | Y   |                  |                                                               |
| wage_type       | varchar(14)  | Y   |                  | Allowed: Daily wage \| Monthly wage                           |
| trade           | varchar(40)  | Y   |                  | WAGE_TRADES                                                   |
| contractor      | varchar(120) | Y   |                  |                                                               |
| work_order_id   | varchar(10)  |     | work_orders.code | Same-entity, non-completed                                    |
| site            | varchar(160) | Y   |                  |                                                               |
| shift_id        | varchar(10)  | Y   | shifts.code      |                                                               |
| phone           | varchar(20)  |     |                  | 10–15 digits                                                  |
| id_proof_masked | varchar(40)  |     |                  | Masked only                                                   |
| joined_on       | date         | Y   |                  |                                                               |
| status          | varchar(8)   | Y   |                  | Allowed: Active \| Inactive                                   |

Indexes: (org_id, status)

#### work_order_assignments

Employee deployed on a work order (one active per employee).  
**Entity:** WorkOrderAssignment · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/work-order-data.ts → WorkOrderAssignment, store seereon.workorder.assignments`

| Column        | Type        | Req | FK               | Description / allowed values |
| ------------- | ----------- | --- | ---------------- | ---------------------------- |
| employee_id   | varchar(20) | Y   | employees.id     |                              |
| work_order_id | varchar(10) | Y   | work_orders.code |                              |
| assigned_on   | date        | Y   |                  |                              |

Indexes: (employee_id) unique

#### work_order_attachments (child)

Child of work_orders — work_order_attachments (attachments[])  
**Entity:** WorkOrderAttachments · **Primary key:** —

Source: `src/lib/work-order-data.ts → WorkOrder, store seereon.workorders`

| Column        | Type         | Req | FK             | Description / allowed values |
| ------------- | ------------ | --- | -------------- | ---------------------------- |
| id            | bigserial    | Y   |                | Surrogate key                |
| work_order_id | varchar(40)  | Y   | work_orders.id | Parent WorkOrder             |
| attachments   | varchar(120) |     |                | []                           |

Indexes: (work_order_id)

#### work_order_locations (child)

Child of work_orders — work_order_locations (locations[])  
**Entity:** WorkOrderLocations · **Primary key:** —

Source: `src/lib/work-order-data.ts → WorkOrder, store seereon.workorders`

| Column        | Type         | Req | FK             | Description / allowed values |
| ------------- | ------------ | --- | -------------- | ---------------------------- |
| id            | bigserial    | Y   |                | Surrogate key                |
| work_order_id | varchar(40)  | Y   | work_orders.id | Parent WorkOrder             |
| locations     | varchar(120) |     |                | []                           |

Indexes: (work_order_id)

#### work_order_shifts (child)

Child of work_orders — work_order_shifts (shifts[]: shift_id, headcount, days)  
**Entity:** WorkOrderShifts · **Primary key:** —

Source: `src/lib/work-order-data.ts → WorkOrder, store seereon.workorders`

| Column        | Type         | Req | FK             | Description / allowed values |
| ------------- | ------------ | --- | -------------- | ---------------------------- |
| id            | bigserial    | Y   |                | Surrogate key                |
| work_order_id | varchar(40)  | Y   | work_orders.id | Parent WorkOrder             |
| shift_id      | varchar(40)  |     | shifts.org_id  |                              |
| headcount     | varchar(120) |     |                |                              |
| days          | varchar(120) |     |                |                              |

Indexes: (work_order_id)

#### work_orders

Client engagement / site with shift plan, billing and approvals; drives assigned employees' shift.  
**Entity:** WorkOrder · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/work-order-data.ts → WorkOrder, store seereon.workorders`

| Column                                                                                                                   | Type                            | Req | FK               | Description / allowed values                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | --- | ---------------- | ------------------------------------------------------------- |
| id                                                                                                                       | bigserial                       | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| code                                                                                                                     | varchar(10)                     | Y   |                  | WO-001                                                        |
| org_id                                                                                                                   | varchar(20)                     | Y   | organizations.id | Owning entity                                                 |
| name                                                                                                                     | varchar(160)                    | Y   |                  |                                                               |
| client_site                                                                                                              | varchar(160)                    | Y   |                  |                                                               |
| home_office                                                                                                              | varchar(80)                     | Y   |                  |                                                               |
| primary_shift_id                                                                                                         | varchar(10)                     | Y   | shifts.code      |                                                               |
| start_date                                                                                                               | date                            | Y   |                  |                                                               |
| end_date                                                                                                                 | date                            |     |                  | ≥ start_date                                                  |
| status                                                                                                                   | varchar(10)                     | Y   |                  | Allowed: Active \| On Hold \| Completed                       |
| purpose                                                                                                                  | varchar(60)                     |     |                  | WO_PURPOSES                                                   |
| demanded_by_name, demanded_by_role                                                                                       | varchar(120), varchar(40)       |     |                  |                                                               |
| approved_by_name, approved_by_role, approved_on                                                                          | varchar(120), varchar(40), date |     |                  | Blank → On Hold                                               |
| details                                                                                                                  | text                            |     |                  |                                                               |
| headcount                                                                                                                | integer                         |     |                  | ≥ 0                                                           |
| priority                                                                                                                 | varchar(10)                     |     |                  | Allowed: Low \| Normal \| High \| Critical                    |
| client_contact                                                                                                           | varchar(160)                    |     |                  |                                                               |
| billing_type, po_number, rate_basis, budget numeric(14,2), currency char(3), payment_terms, invoicing_cycle, cost_centre | text                            |     |                  | Billing terms (budget ≥ 0)                                    |
| notes                                                                                                                    | text                            |     |                  |                                                               |
| created_by                                                                                                               | varchar(120)                    |     |                  |                                                               |
| created_on                                                                                                               | date                            |     |                  |                                                               |

Indexes: (org_id, status)

### 9.7 Payroll, Statutory, Tax & Finance

#### annual_compliance_calendar (child)

Child of compliance_library — annual_compliance_calendar  
**Entity:** AnnualComplianceCalendar · **Primary key:** —

Source: `src/lib/compliance-guide.ts → COMPLIANCE_LIBRARY, ANNUAL_COMPLIANCE_CALENDAR`

| Column                | Type        | Req | FK                      | Description / allowed values |
| --------------------- | ----------- | --- | ----------------------- | ---------------------------- |
| id                    | bigserial   | Y   |                         | Surrogate key                |
| compliance_library_id | varchar(40) | Y   | compliance_library.code | Parent ComplianceEntry       |
| value                 | text        | Y   |                         | Item value (array element)   |

Indexes: (compliance_library_id)

#### branch_states (child)

Child of state_statutory_policies — branch_states (branch → state)  
**Entity:** BranchStates · **Primary key:** —

Source: `src/lib/statutory-data.ts → STATE_POLICIES / BRANCH_STATE`

| Column                    | Type         | Req | FK                             | Description / allowed values          |
| ------------------------- | ------------ | --- | ------------------------------ | ------------------------------------- |
| id                        | bigserial    | Y   |                                | Surrogate key                         |
| state_statutory_policy_id | varchar(40)  | Y   | state_statutory_policies.state | Parent StatePolicy                    |
| branch                    | varchar(120) |     |                                | → state (logical reference: state.id) |

Indexes: (state_statutory_policy_id)

#### claim_attachments (child)

Child of reimbursement_claims — claim_attachments  
**Entity:** ClaimAttachments · **Primary key:** —

Source: `src/lib/claims-data.ts → type Reimbursement, store seereon.claims.reimbursements.v1`

| Column                 | Type        | Req | FK                      | Description / allowed values |
| ---------------------- | ----------- | --- | ----------------------- | ---------------------------- |
| id                     | bigserial   | Y   |                         | Surrogate key                |
| reimbursement_claim_id | varchar(40) | Y   | reimbursement_claims.id | Parent ReimbursementClaim    |
| value                  | text        | Y   |                         | Item value (array element)   |

Indexes: (reimbursement_claim_id)

#### claim_line_items (child)

Child of reimbursement_claims — claim_line_items (date, vendor, bill_no, description, amount, attachment, paid_via)  
**Entity:** ClaimLineItems · **Primary key:** —

Source: `src/lib/claims-data.ts → type Reimbursement, store seereon.claims.reimbursements.v1`

| Column                 | Type          | Req | FK                      | Description / allowed values |
| ---------------------- | ------------- | --- | ----------------------- | ---------------------------- |
| id                     | bigserial     | Y   |                         | Surrogate key                |
| reimbursement_claim_id | varchar(40)   | Y   | reimbursement_claims.id | Parent ReimbursementClaim    |
| date                   | date          |     |                         |                              |
| vendor                 | varchar(120)  |     |                         |                              |
| bill_no                | varchar(120)  |     |                         |                              |
| description            | text          |     |                         |                              |
| amount                 | numeric(14,2) |     |                         |                              |
| attachment             | varchar(120)  |     |                         |                              |
| paid_via               | varchar(120)  |     |                         |                              |

Indexes: (reimbursement_claim_id)

#### claim_trail (child)

Child of reimbursement_claims — claim_trail (stage, actor, action Submitted|Approved|Rejected|Processed, at, remarks)  
**Entity:** ClaimTrail · **Primary key:** —

Source: `src/lib/claims-data.ts → type Reimbursement, store seereon.claims.reimbursements.v1`

| Column                 | Type         | Req | FK                      | Description / allowed values                                                               |
| ---------------------- | ------------ | --- | ----------------------- | ------------------------------------------------------------------------------------------ |
| id                     | bigserial    | Y   |                         | Surrogate key                                                                              |
| reimbursement_claim_id | varchar(40)  | Y   | reimbursement_claims.id | Parent ReimbursementClaim                                                                  |
| stage                  | varchar(120) |     |                         |                                                                                            |
| actor                  | varchar(120) |     |                         |                                                                                            |
| action                 | text         |     |                         | Submitted\|Approved\|Rejected\|Processed Allowed: Submitted\|Approved\|Rejected\|Processed |
| at                     | date         |     |                         |                                                                                            |
| remarks                | text         |     |                         |                                                                                            |

Indexes: (reimbursement_claim_id)

#### compliance_library

Static library of acts/codes with rates, due dates, forms, registers, penalties and config alignment check.  
**Entity:** ComplianceEntry · **Primary key:** code

Source: `src/lib/compliance-guide.ts → COMPLIANCE_LIBRARY, ANNUAL_COMPLIANCE_CALENDAR`

| Column        | Type         | Req | FK  | Description / allowed values |
| ------------- | ------------ | --- | --- | ---------------------------- |
| code          | varchar(20)  | Y   |     |                              |
| act           | text         | Y   |     |                              |
| short_name    | varchar(120) | Y   |     |                              |
| category      | varchar(40)  | Y   |     |                              |
| authority     | varchar(120) | Y   |     |                              |
| rates         | jsonb        | Y   |     |                              |
| due_dates     | jsonb        | Y   |     |                              |
| forms         | text[]       | Y   |     |                              |
| registers     | text[]       | Y   |     |                              |
| penalties     | text         | Y   |     |                              |
| latest_update | jsonb        | Y   |     |                              |

#### contribution_declarations

Employee VPF / corporate NPS election for a FY; only Approved/Locked flow into payroll.  
**Entity:** ContributionDeclaration · **Primary key:** employee_id, fy · **Tenant-scoped** (org_id)

Source: `src/lib/contributions-data.ts → type ContributionDeclaration, store seereon.payroll.contributions`

| Column      | Type        | Req | FK           | Description / allowed values                |
| ----------- | ----------- | --- | ------------ | ------------------------------------------- |
| employee_id | varchar(20) | Y   | employees.id | Employee                                    |
| fy          | varchar(12) | Y   |              |                                             |
| vpf         | jsonb       | Y   |              | mode Percent of Basic\|Fixed amount         |
| nps         | jsonb       | Y   |              |                                             |
| status      | varchar(10) | Y   |              | Allowed: Draft\|Submitted\|Approved\|Locked |
| updated_on  | date        | Y   |              |                                             |

Indexes: (employee_id, fy) unique

#### contribution_history (child)

Child of contribution_declarations — contribution_history  
**Entity:** ContributionHistory · **Primary key:** —

Source: `src/lib/contributions-data.ts → type ContributionDeclaration, store seereon.payroll.contributions`

| Column                      | Type        | Req | FK                                    | Description / allowed values   |
| --------------------------- | ----------- | --- | ------------------------------------- | ------------------------------ |
| id                          | bigserial   | Y   |                                       | Surrogate key                  |
| contribution_declaration_id | varchar(40) | Y   | contribution_declarations.employee_id | Parent ContributionDeclaration |
| value                       | text        | Y   |                                       | Item value (array element)     |

Indexes: (contribution_declaration_id)

#### employee_insurance

Insurance policy assigned to an employee; employee share deducted monthly in payroll.  
**Entity:** InsuranceAssignment · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/claims-data.ts → type InsuranceAssignment, insuranceStore (in-memory)`

| Column            | Type          | Req | FK                  | Description / allowed values |
| ----------------- | ------------- | --- | ------------------- | ---------------------------- |
| id                | varchar(20)   | Y   |                     |                              |
| employee_id       | varchar(20)   | Y   | employees.id        | Employee                     |
| insurer           | varchar(60)   | Y   |                     |                              |
| policy_number     | varchar(40)   | Y   |                     |                              |
| tpa               | varchar(60)   | Y   |                     |                              |
| type              | varchar(60)   | Y   | master_entries.name |                              |
| category          | varchar(60)   | Y   | master_entries.name |                              |
| sum_insured       | numeric(14,2) | Y   |                     |                              |
| annual_premium    | numeric(14,2) | Y   |                     |                              |
| monthly_deduction | numeric(14,2) | Y   |                     |                              |
| valid_from        | date          | Y   |                     |                              |
| valid_to          | date          | Y   |                     |                              |
| nominee           | varchar(120)  | Y   |                     |                              |
| dependents        | text          | Y   |                     |                              |
| documents         | text[]        | Y   |                     |                              |
| status            | varchar(8)    | Y   |                     | Allowed: Active\|Lapsed      |

#### employee_statutory_profiles

Per-employee PF/ESI applicability flags.  
**Entity:** EmployeeStatutoryProfile · **Primary key:** employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/contributions-data.ts → type EmployeeStatutoryProfile, store seereon.payroll.statutory-profiles.v2`

| Column                  | Type        | Req | FK           | Description / allowed values        |
| ----------------------- | ----------- | --- | ------------ | ----------------------------------- |
| employee_id             | varchar(20) | Y   | employees.id | Employee                            |
| tax_regime              | varchar(12) | Y   |              |                                     |
| pf_applicable           | boolean     | Y   |              |                                     |
| pf_international_worker | boolean     | Y   |              |                                     |
| pf_mode                 | varchar(12) |     |              | Allowed: Org default\|Capped\|Full  |
| insurance_plan_ids      | text[]      |     |              |                                     |
| esi_override            | varchar(12) | Y   |              | Allowed: Auto\|Covered\|Not covered |
| is_pwd                  | boolean     | Y   |              |                                     |
| pan_verified            | boolean     | Y   |              |                                     |

Indexes: (employee_id) unique

#### expenditure_asset_details (child)

Child of expenditures — expenditure_asset_details (asset_name, quantity, unit_cost, tag, capitalise, useful_life_years, location, custodian)  
**Entity:** ExpenditureAssetDetails · **Primary key:** —

Source: `src/lib/expenditure-data.ts → type ExpenditureRecord, store seereon.expenditure.v2`

| Column            | Type          | Req | FK              | Description / allowed values |
| ----------------- | ------------- | --- | --------------- | ---------------------------- |
| id                | bigserial     | Y   |                 | Surrogate key                |
| expenditure_id    | varchar(40)   | Y   | expenditures.id | Parent Expenditure           |
| asset_name        | varchar(120)  |     |                 |                              |
| quantity          | varchar(120)  |     |                 |                              |
| unit_cost         | numeric(14,2) |     |                 |                              |
| tag               | varchar(120)  |     |                 |                              |
| capitalise        | boolean       |     |                 |                              |
| useful_life_years | varchar(120)  |     |                 |                              |
| location          | varchar(120)  |     |                 |                              |
| custodian         | varchar(120)  |     |                 |                              |

Indexes: (expenditure_id)

#### expenditure_attachments (child)

Child of expenditures — expenditure_attachments  
**Entity:** ExpenditureAttachments · **Primary key:** —

Source: `src/lib/expenditure-data.ts → type ExpenditureRecord, store seereon.expenditure.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| expenditure_id | varchar(40) | Y   | expenditures.id | Parent Expenditure           |
| value          | text        | Y   |                 | Item value (array element)   |

Indexes: (expenditure_id)

#### expenditure_bills (child)

Child of expenditures — expenditure_bills  
**Entity:** ExpenditureBills · **Primary key:** —

Source: `src/lib/expenditure-data.ts → type ExpenditureRecord, store seereon.expenditure.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| expenditure_id | varchar(40) | Y   | expenditures.id | Parent Expenditure           |
| value          | text        | Y   |                 | Item value (array element)   |

Indexes: (expenditure_id)

#### expenditure_festival_details (child)

Child of expenditures — expenditure_festival_details (occasion, beneficiaries, headcount, per_head_cost, gift_type)  
**Entity:** ExpenditureFestivalDetails · **Primary key:** —

Source: `src/lib/expenditure-data.ts → type ExpenditureRecord, store seereon.expenditure.v2`

| Column         | Type          | Req | FK              | Description / allowed values |
| -------------- | ------------- | --- | --------------- | ---------------------------- |
| id             | bigserial     | Y   |                 | Surrogate key                |
| expenditure_id | varchar(40)   | Y   | expenditures.id | Parent Expenditure           |
| occasion       | varchar(120)  |     |                 |                              |
| beneficiaries  | varchar(120)  |     |                 |                              |
| headcount      | varchar(120)  |     |                 |                              |
| per_head_cost  | numeric(14,2) |     |                 |                              |
| gift_type      | varchar(120)  |     |                 |                              |

Indexes: (expenditure_id)

#### expenditure_history (child)

Child of expenditures — expenditure_history  
**Entity:** ExpenditureHistory · **Primary key:** —

Source: `src/lib/expenditure-data.ts → type ExpenditureRecord, store seereon.expenditure.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| expenditure_id | varchar(40) | Y   | expenditures.id | Parent Expenditure           |
| value          | text        | Y   |                 | Item value (array element)   |

Indexes: (expenditure_id)

#### expenditure_outcome_documents (child)

Child of expenditures — expenditure_outcome_documents  
**Entity:** ExpenditureOutcomeDocuments · **Primary key:** —

Source: `src/lib/expenditure-data.ts → type ExpenditureRecord, store seereon.expenditure.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| expenditure_id | varchar(40) | Y   | expenditures.id | Parent Expenditure           |
| value          | text        | Y   |                 | Item value (array element)   |

Indexes: (expenditure_id)

#### expenditures

General company spend booking (distinct from claims) with approval, payment and outcome.  
**Entity:** Expenditure · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/expenditure-data.ts → type ExpenditureRecord, store seereon.expenditure.v2`

| Column               | Type          | Req | FK               | Description / allowed values              |
| -------------------- | ------------- | --- | ---------------- | ----------------------------------------- |
| id                   | varchar(12)   | Y   |                  | EXP-0006                                  |
| org_id               | varchar(20)   | Y   | organizations.id | Owning entity                             |
| title                | varchar(160)  | Y   |                  |                                           |
| category             | varchar(40)   | Y   |                  |                                           |
| subcategory          | varchar(60)   | Y   |                  |                                           |
| purpose              | text          | Y   |                  |                                           |
| reason               | text          | Y   |                  |                                           |
| department           | varchar(80)   | Y   |                  |                                           |
| branch               | varchar(80)   | Y   |                  |                                           |
| requested_by_id      | varchar(20)   | Y   | employees.id     |                                           |
| concerned_person_id  | varchar(20)   | Y   | employees.id     |                                           |
| approved_by_id       | varchar(20)   |     | employees.id     |                                           |
| booked_by            | varchar(20)   | Y   | users.id         |                                           |
| spend_date           | date          | Y   |                  |                                           |
| spend_time           | time          | Y   |                  |                                           |
| cost_centre          | varchar(30)   | Y   |                  |                                           |
| budget_line          | varchar(80)   |     |                  |                                           |
| priority             | varchar(20)   | Y   |                  |                                           |
| is_recurring         | boolean       | Y   |                  |                                           |
| vendor               | varchar(120)  | Y   |                  |                                           |
| vendor_gstin         | char(15)      |     |                  |                                           |
| invoice_no           | varchar(40)   |     |                  |                                           |
| payment_mode         | varchar(30)   | Y   |                  |                                           |
| payment_ref          | varchar(60)   |     |                  |                                           |
| taxable_amount       | numeric(14,2) | Y   |                  |                                           |
| gst_pct              | numeric(5,2)  | Y   |                  |                                           |
| gst_amount           | numeric(14,2) | Y   |                  |                                           |
| total                | numeric(14,2) | Y   |                  |                                           |
| status               | varchar(10)   | Y   |                  | Allowed: Booked\|Approved\|Paid\|Rejected |
| description          | text          |     |                  |                                           |
| outcome              | text          |     |                  |                                           |
| outcome_submitted_on | date          |     |                  |                                           |
| created_on           | date          | Y   |                  |                                           |

Indexes: (org_id, spend_date); (org_id, status)

#### filing_ecr_lines (child)

Child of statutory_filings — filing_ecr_lines (uan, member_name, gross, epf/eps/edli wages, epf/eps/diff contributions, ncp_days, refund)  
**Entity:** FilingEcrLines · **Primary key:** —

Source: `src/lib/statutory-filings.ts → type Filing, store seereon.statutory.filings`

| Column              | Type          | Req | FK                   | Description / allowed values |
| ------------------- | ------------- | --- | -------------------- | ---------------------------- |
| id                  | bigserial     | Y   |                      | Surrogate key                |
| statutory_filing_id | varchar(40)   | Y   | statutory_filings.id | Parent StatutoryFiling       |
| uan                 | varchar(120)  |     |                      |                              |
| member_name         | varchar(120)  |     |                      |                              |
| gross               | numeric(14,2) |     |                      |                              |
| epf                 | varchar(120)  |     |                      | /eps/edli wages              |
| ncp_days            | varchar(120)  |     |                      |                              |
| refund              | varchar(120)  |     |                      |                              |

Indexes: (statutory_filing_id)

#### filing_esi_lines (child)

Child of statutory_filings — filing_esi_lines (ip_number, days_paid, wages, employee, employer, reason_code)  
**Entity:** FilingEsiLines · **Primary key:** —

Source: `src/lib/statutory-filings.ts → type Filing, store seereon.statutory.filings`

| Column              | Type          | Req | FK                   | Description / allowed values |
| ------------------- | ------------- | --- | -------------------- | ---------------------------- |
| id                  | bigserial     | Y   |                      | Surrogate key                |
| statutory_filing_id | varchar(40)   | Y   | statutory_filings.id | Parent StatutoryFiling       |
| ip_number           | varchar(120)  |     |                      |                              |
| days_paid           | varchar(120)  |     |                      |                              |
| wages               | numeric(14,2) |     |                      |                              |
| employee            | varchar(120)  |     |                      |                              |
| employer            | varchar(120)  |     |                      |                              |
| reason_code         | varchar(120)  |     |                      |                              |

Indexes: (statutory_filing_id)

#### filing_history (child)

Child of statutory_filings — filing_history  
**Entity:** FilingHistory · **Primary key:** —

Source: `src/lib/statutory-filings.ts → type Filing, store seereon.statutory.filings`

| Column              | Type        | Req | FK                   | Description / allowed values |
| ------------------- | ----------- | --- | -------------------- | ---------------------------- |
| id                  | bigserial   | Y   |                      | Surrogate key                |
| statutory_filing_id | varchar(40) | Y   | statutory_filings.id | Parent StatutoryFiling       |
| value               | text        | Y   |                      | Item value (array element)   |

Indexes: (statutory_filing_id)

#### filing_tds_lines (child)

Child of statutory_filings — filing_tds_lines (pan, taxable, tds, regime)  
**Entity:** FilingTdsLines · **Primary key:** —

Source: `src/lib/statutory-filings.ts → type Filing, store seereon.statutory.filings`

| Column              | Type          | Req | FK                   | Description / allowed values |
| ------------------- | ------------- | --- | -------------------- | ---------------------------- |
| id                  | bigserial     | Y   |                      | Surrogate key                |
| statutory_filing_id | varchar(40)   | Y   | statutory_filings.id | Parent StatutoryFiling       |
| pan                 | varchar(120)  |     |                      |                              |
| taxable             | numeric(14,2) |     |                      |                              |
| tds                 | numeric(14,2) |     |                      |                              |
| regime              | varchar(120)  |     |                      |                              |

Indexes: (statutory_filing_id)

#### income_tax_slabs

New-regime (s.115BAC) slabs and surcharge tiers per FY.  
**Entity:** IncomeTaxSlab · **Primary key:** fy, up_to

Source: `src/lib/statutory-data.ts → NEW_REGIME_SLABS, NEW_REGIME_SURCHARGE`

| Column | Type          | Req | FK  | Description / allowed values |
| ------ | ------------- | --- | --- | ---------------------------- |
| fy     | varchar(12)   | Y   |     |                              |
| up_to  | numeric(14,2) |     |     | null = above                 |
| rate   | numeric(5,2)  | Y   |     |                              |

Indexes: (fy, up_to) unique

#### insurance_categories (child)

Child of reimbursement_categories — insurance_categories  
**Entity:** InsuranceCategories · **Primary key:** —

Source: `src/lib/claims-data.ts → NamedMaster stores`

| Column                    | Type        | Req | FK                          | Description / allowed values |
| ------------------------- | ----------- | --- | --------------------------- | ---------------------------- |
| id                        | bigserial   | Y   |                             | Surrogate key                |
| reimbursement_category_id | varchar(40) | Y   | reimbursement_categories.id | Parent ReimbursementCategory |
| value                     | text        | Y   |                             | Item value (array element)   |

Indexes: (reimbursement_category_id)

#### insurance_types (child)

Child of reimbursement_categories — insurance_types  
**Entity:** InsuranceTypes · **Primary key:** —

Source: `src/lib/claims-data.ts → NamedMaster stores`

| Column                    | Type        | Req | FK                          | Description / allowed values |
| ------------------------- | ----------- | --- | --------------------------- | ---------------------------- |
| id                        | bigserial   | Y   |                             | Surrogate key                |
| reimbursement_category_id | varchar(40) | Y   | reimbursement_categories.id | Parent ReimbursementCategory |
| value                     | text        | Y   |                             | Item value (array element)   |

Indexes: (reimbursement_category_id)

#### it_declaration_fields (child)

Child of it_declarations — it_declaration_fields (section, key, label, amount ≥ 0; custom.* keys for employee-added components)  
**Entity:** ItDeclarationFields · **Primary key:** —

Source: `src/lib/declaration-data.ts → type Declaration, store seereon.declarations.v2`

| Column            | Type          | Req | FK                          | Description / allowed values                     |
| ----------------- | ------------- | --- | --------------------------- | ------------------------------------------------ |
| id                | bigserial     | Y   |                             | Surrogate key                                    |
| it_declaration_id | varchar(40)   | Y   | it_declarations.employee_id | Parent ItDeclaration                             |
| section           | varchar(120)  |     |                             |                                                  |
| key               | varchar(120)  |     |                             |                                                  |
| label             | varchar(120)  |     |                             |                                                  |
| amount            | numeric(14,2) |     |                             | ≥ 0; custom.* keys for employee-added components |

Indexes: (it_declaration_id)

#### it_declaration_history (child)

Child of it_declarations — it_declaration_history  
**Entity:** ItDeclarationHistory · **Primary key:** —

Source: `src/lib/declaration-data.ts → type Declaration, store seereon.declarations.v2`

| Column            | Type        | Req | FK                          | Description / allowed values |
| ----------------- | ----------- | --- | --------------------------- | ---------------------------- |
| id                | bigserial   | Y   |                             | Surrogate key                |
| it_declaration_id | varchar(40) | Y   | it_declarations.employee_id | Parent ItDeclaration         |
| value             | text        | Y   |                             | Item value (array element)   |

Indexes: (it_declaration_id)

#### it_declaration_proofs (child)

Child of it_declarations — it_declaration_proofs (section, file_name, uploaded_on, status Uploaded|Verified|Rejected, remark)  
**Entity:** ItDeclarationProofs · **Primary key:** —

Source: `src/lib/declaration-data.ts → type Declaration, store seereon.declarations.v2`

| Column            | Type         | Req | FK                          | Description / allowed values                                       |
| ----------------- | ------------ | --- | --------------------------- | ------------------------------------------------------------------ |
| id                | bigserial    | Y   |                             | Surrogate key                                                      |
| it_declaration_id | varchar(40)  | Y   | it_declarations.employee_id | Parent ItDeclaration                                               |
| section           | varchar(120) |     |                             |                                                                    |
| file_name         | varchar(120) |     |                             |                                                                    |
| uploaded_on       | varchar(120) |     |                             |                                                                    |
| status            | varchar(120) |     |                             | Uploaded\|Verified\|Rejected Allowed: Uploaded\|Verified\|Rejected |
| remark            | varchar(120) |     |                             |                                                                    |

Indexes: (it_declaration_id)

#### it_declarations

Form 12BB declaration per employee & FY — new-regime fields only (previous employer, other income, let-out property, 80CCD(2), exempt allowances) with proofs.  
**Entity:** ItDeclaration · **Primary key:** employee_id, fy · **Tenant-scoped** (org_id)

Source: `src/lib/declaration-data.ts → type Declaration, store seereon.declarations.v2`

| Column      | Type        | Req | FK           | Description / allowed values      |
| ----------- | ----------- | --- | ------------ | --------------------------------- |
| employee_id | varchar(20) | Y   | employees.id | Employee                          |
| fy          | varchar(12) | Y   |              |                                   |
| tax_regime  | varchar(12) | Y   |              |                                   |
| status      | varchar(10) | Y   |              | Allowed: Draft\|Submitted\|Locked |
| updated_on  | date        | Y   |              |                                   |
| note        | text        |     |              |                                   |

Indexes: (employee_id, fy) unique

#### loan_history (child)

Child of loans — loan_history  
**Entity:** LoanHistory · **Primary key:** —

Source: `src/lib/loans-data.ts → type LoanRecord, store seereon.finance.loans.v2`

| Column  | Type        | Req | FK       | Description / allowed values |
| ------- | ----------- | --- | -------- | ---------------------------- |
| id      | bigserial   | Y   |          | Surrogate key                |
| loan_id | varchar(40) | Y   | loans.id | Parent Loan                  |
| value   | text        | Y   |          | Item value (array element)   |

Indexes: (loan_id)

#### loan_policies

Loan & advance policy.  
**Entity:** LoanPolicy · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/loans-data.ts → type LoanPolicy, store seereon.finance.loan-policy`

| Column                 | Type         | Req | FK               | Description / allowed values                                  |
| ---------------------- | ------------ | --- | ---------------- | ------------------------------------------------------------- |
| id                     | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| org_id                 | varchar(20)  | Y   | organizations.id | Owning entity                                                 |
| max_gross_multiple     | numeric(4,1) | Y   |                  |                                                               |
| max_tenure_months      | smallint     | Y   |                  |                                                               |
| advance_tenure         | smallint     | Y   |                  |                                                               |
| advance_emi_max_months | smallint     | Y   |                  |                                                               |
| interest_pct           | numeric(5,2) | Y   |                  |                                                               |
| approver               | varchar(16)  | Y   |                  | Allowed: HR\|Finance\|HR → Finance                            |
| updated_by             | varchar(120) | Y   |                  |                                                               |
| updated_on             | date         | Y   |                  |                                                               |

#### loan_schedule (child)

Child of loans — loan_schedule (period, emi, principal, interest, balance, paid, via Payroll|F&F|Cash)  
**Entity:** LoanSchedule · **Primary key:** —

Source: `src/lib/loans-data.ts → type LoanRecord, store seereon.finance.loans.v2`

| Column    | Type          | Req | FK       | Description / allowed values                   |
| --------- | ------------- | --- | -------- | ---------------------------------------------- |
| id        | bigserial     | Y   |          | Surrogate key                                  |
| loan_id   | varchar(40)   | Y   | loans.id | Parent Loan                                    |
| period    | varchar(120)  |     |          |                                                |
| emi       | numeric(14,2) |     |          |                                                |
| principal | numeric(14,2) |     |          |                                                |
| interest  | numeric(14,2) |     |          |                                                |
| balance   | numeric(14,2) |     |          |                                                |
| paid      | boolean       |     |          |                                                |
| via       | varchar(120)  |     |          | Payroll\|F&F\|Cash Allowed: Payroll\|F&F\|Cash |

Indexes: (loan_id)

#### loans

Employee loan or salary advance with EMI schedule recovered through payroll or F&F.  
**Entity:** Loan · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/loans-data.ts → type LoanRecord, store seereon.finance.loans.v2`

| Column           | Type          | Req | FK           | Description / allowed values                                     |
| ---------------- | ------------- | --- | ------------ | ---------------------------------------------------------------- |
| id               | varchar(20)   | Y   |              | LN-2026-012 / ADV-2026-005                                       |
| employee_id      | varchar(20)   | Y   | employees.id | Employee                                                         |
| employee_name    | varchar(120)  | Y   |              |                                                                  |
| kind             | varchar(16)   | Y   |              | Allowed: Salary advance\|Loan                                    |
| amount           | numeric(14,2) | Y   |              |                                                                  |
| tenure_months    | smallint      | Y   |              | Loan ≤ maxTenureMonths; advance ≤ advanceEmiMaxMonths            |
| emi              | numeric(14,2) | Y   |              |                                                                  |
| interest_pct     | numeric(5,2)  | Y   |              |                                                                  |
| purpose          | text          | Y   |              |                                                                  |
| applied_on       | date          | Y   |              |                                                                  |
| status           | varchar(10)   | Y   |              | Allowed: Applied\|Approved\|Disbursed\|Closing\|Closed\|Rejected |
| approved_by      | varchar(120)  |     |              |                                                                  |
| disbursed_on     | date          |     |              |                                                                  |
| first_emi_period | char(7)       | Y   |              |                                                                  |
| fnf_recovered    | numeric(14,2) |     |              |                                                                  |

Indexes: (employee_id, status)

#### pay_grades

Pay grade bands (Masters).  
**Entity:** PayGrade · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/comp-config.ts → PAY_GRADE_ROWS`

| Column   | Type          | Req | FK  | Description / allowed values |
| -------- | ------------- | --- | --- | ---------------------------- |
| id       | varchar(10)   | Y   |     |                              |
| grade    | varchar(10)   | Y   |     |                              |
| band     | varchar(40)   | Y   |     |                              |
| min_ctc  | numeric(14,2) | Y   |     |                              |
| max_ctc  | numeric(14,2) | Y   |     |                              |
| currency | char(3)       | Y   |     |                              |
| status   | varchar(10)   | Y   |     |                              |

#### payroll_line_deductions (child)

Child of payroll_run_lines — payroll_line_deductions  
**Entity:** PayrollLineDeductions · **Primary key:** —

Source: `src/lib/payroll-engine.ts → type ComputedPayslip (PayrollRunV2.lines[])`

| Column              | Type        | Req | FK                       | Description / allowed values |
| ------------------- | ----------- | --- | ------------------------ | ---------------------------- |
| id                  | bigserial   | Y   |                          | Surrogate key                |
| payroll_run_line_id | varchar(40) | Y   | payroll_run_lines.run_id | Parent PayrollRunLine        |
| value               | text        | Y   |                          | Item value (array element)   |

Indexes: (payroll_run_line_id)

#### payroll_line_earnings (child)

Child of payroll_run_lines — payroll_line_earnings  
**Entity:** PayrollLineEarnings · **Primary key:** —

Source: `src/lib/payroll-engine.ts → type ComputedPayslip (PayrollRunV2.lines[])`

| Column              | Type        | Req | FK                       | Description / allowed values |
| ------------------- | ----------- | --- | ------------------------ | ---------------------------- |
| id                  | bigserial   | Y   |                          | Surrogate key                |
| payroll_run_line_id | varchar(40) | Y   | payroll_run_lines.run_id | Parent PayrollRunLine        |
| value               | text        | Y   |                          | Item value (array element)   |

Indexes: (payroll_run_line_id)

#### payroll_policies

Processing day / evaluation checkpoint / attendance cut-off.  
**Entity:** PayrollPolicy · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/salary-engine.ts → type PayrollPolicy, store seereon.payroll.policy`

| Column               | Type        | Req | FK               | Description / allowed values                                  |
| -------------------- | ----------- | --- | ---------------- | ------------------------------------------------------------- |
| id                   | bigserial   | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| org_id               | varchar(20) | Y   | organizations.id | Owning entity                                                 |
| processing_day       | varchar(20) | Y   |                  | Allowed: Last day of month\|Last working day\|Fixed day       |
| fixed_day            | smallint    | Y   |                  |                                                               |
| evaluation_lead_days | smallint    | Y   |                  |                                                               |
| evaluator_role       | varchar(6)  | Y   |                  | Allowed: HR\|CHRO\|CFO                                        |
| cutoff_day           | smallint    | Y   |                  |                                                               |

#### payroll_run_approvals

Decision at one approval level of a run.  
**Entity:** PayrollApproval · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/payroll-engine.ts → type Approval`

| Column        | Type         | Req | FK              | Description / allowed values                                  |
| ------------- | ------------ | --- | --------------- | ------------------------------------------------------------- |
| id            | bigserial    | Y   |                 | Surrogate key (added — the prototype record has no single id) |
| run_id        | varchar(30)  | Y   | payroll_runs.id |                                                               |
| level         | varchar(30)  | Y   |                 | Allowed: Payroll Admin\|HR Manager\|Finance\|CFO              |
| approver_id   | varchar(20)  | Y   | users.id        |                                                               |
| approver_name | varchar(120) | Y   |                 |                                                               |
| decided_on    | date         | Y   |                 |                                                               |
| decision      | varchar(10)  | Y   |                 | Allowed: Approved\|Rejected                                   |
| remarks       | text         | Y   |                 | Required for rejection                                        |

Indexes: (run_id, level, decided_on)

#### payroll_run_checks

Pre-approval compliance check raised on a run; resolvable by record fix, override (with justification) or escalation.  
**Entity:** ComplianceCheck · **Primary key:** run_id, check_key · **Tenant-scoped** (org_id)

Source: `src/lib/payroll-engine.ts → type ComplianceCheck`

| Column        | Type         | Req | FK              | Description / allowed values                                                                                                             |
| ------------- | ------------ | --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| check_key     | varchar(60)  | Y   |                 | Stable `${code}:${empId\|RUN}` (#n suffix)                                                                                               |
| run_id        | varchar(30)  | Y   | payroll_runs.id |                                                                                                                                          |
| code          | varchar(20)  | Y   |                 | Allowed: ATT-LOCK\|NET-NEG\|LOP-GT-WD\|PF-UAN\|PF-NO\|ESI-IP\|ESI-EXCL\|ESI-LOCK\|TDS-PAN\|MIN-WAGE\|NCP-DIM\|ATT-SRC\|VPF-CAP\|PT-STATE |
| level         | varchar(10)  | Y   |                 | Allowed: error\|warning\|info                                                                                                            |
| employee_id   | varchar(20)  |     | employees.id    | Employee                                                                                                                                 |
| employee_name | varchar(120) |     |                 |                                                                                                                                          |
| message       | text         | Y   |                 |                                                                                                                                          |
| acknowledged  | boolean      |     |                 |                                                                                                                                          |
| status        | varchar(12)  | Y   |                 | Allowed: Open\|Resolved\|Overridden\|Escalated                                                                                           |
| resolution    | jsonb        |     |                 | by, on, action (Record fixed\|Verified manually\|Overridden with justification), note, changes                                           |
| escalation    | jsonb        |     |                 | toId, toName, toRole, by, on, note, due                                                                                                  |

Indexes: (run_id, check_key) unique

#### payroll_run_history (child)

Child of payroll_runs — payroll_run_history (history[])  
**Entity:** PayrollRunHistory · **Primary key:** —

Source: `src/lib/payroll-engine.ts → type PayrollRunV2, store seereon.payroll.runs.v3`

| Column         | Type         | Req | FK              | Description / allowed values |
| -------------- | ------------ | --- | --------------- | ---------------------------- |
| id             | bigserial    | Y   |                 | Surrogate key                |
| payroll_run_id | varchar(40)  | Y   | payroll_runs.id | Parent PayrollRun            |
| history        | varchar(120) |     |                 | []                           |

Indexes: (payroll_run_id)

#### payroll_run_lines

One employee's computed payslip inside a run (attendance → LOP → earnings → PF/ESI/PT/LWF/NPS/TDS/loan → net).  
**Entity:** PayrollRunLine · **Primary key:** run_id, employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/payroll-engine.ts → type ComputedPayslip (PayrollRunV2.lines[])`

| Column           | Type          | Req | FK              | Description / allowed values                                                                                                                                 |
| ---------------- | ------------- | --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| run_id           | varchar(30)   | Y   | payroll_runs.id |                                                                                                                                                              |
| employee_id      | varchar(20)   | Y   | employees.id    | Employee                                                                                                                                                     |
| employee_name    | varchar(120)  | Y   |                 | Snapshot                                                                                                                                                     |
| department       | varchar(80)   | Y   |                 |                                                                                                                                                              |
| designation      | varchar(80)   | Y   |                 |                                                                                                                                                              |
| branch           | varchar(80)   | Y   |                 |                                                                                                                                                              |
| state            | varchar(30)   | Y   |                 | Resolved from branch                                                                                                                                         |
| is_wage_roll     | boolean       | Y   |                 | Muster-only staff                                                                                                                                            |
| structure_gross  | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| earned_gross     | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| lop              | jsonb         | Y   |                 | Pattern, attendance summary, LOP days/amount, payable days                                                                                                   |
| earnings         | jsonb         | Y   |                 | label, amount, note (or child table payroll_line_earnings)                                                                                                   |
| deductions       | jsonb         | Y   |                 | PF, VPF, ESI, PT, LWF, NPS, TDS, insurance, loan EMI                                                                                                         |
| pf_wages         | numeric(14,2) | Y   |                 | EPF wages after ₹15,000 ceiling                                                                                                                              |
| eps_wages        | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| pf_employee      | numeric(14,2) | Y   |                 | 12 %                                                                                                                                                         |
| vpf              | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| pf_employer_epf  | numeric(14,2) | Y   |                 | 12 % − EPS                                                                                                                                                   |
| pf_employer_eps  | numeric(14,2) | Y   |                 | 8.33 % of EPS wages                                                                                                                                          |
| edli             | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| pf_admin         | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| ncp_days         | smallint      | Y   |                 |                                                                                                                                                              |
| esi_applicable   | boolean       | Y   |                 | gross ≤ ₹21,000 (₹25,000 PWD) or override                                                                                                                    |
| esi_wages        | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| esi_employee     | numeric(14,2) | Y   |                 | 0.75 % rounded up                                                                                                                                            |
| esi_employer     | numeric(14,2) | Y   |                 | 3.25 % rounded up                                                                                                                                            |
| professional_tax | numeric(14,2) | Y   |                 | State slab                                                                                                                                                   |
| lwf_employee     | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| lwf_employer     | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| nps_employee     | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| nps_employer     | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| pran             | varchar(12)   |     |                 |                                                                                                                                                              |
| tds_working      | jsonb         | Y   |                 | regime='New Regime', annualGross, exemptions, standardDeduction, chapterVia, taxable, slab, rebate, surcharge, cess, annualTax, months, monthly, breakdown[] |
| tds_monthly      | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| loan_emi         | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| total_deductions | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| net_pay          | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| employer_cost    | numeric(14,2) | Y   |                 |                                                                                                                                                              |
| statutory_ids    | jsonb         | Y   |                 | Snapshot                                                                                                                                                     |
| bank             | jsonb         | Y   |                 | Snapshot (masked)                                                                                                                                            |

Indexes: (run_id, employee_id) unique; (employee_id)

#### payroll_runs

Monthly (or other frequency) payroll run with maker–checker workflow; holds the computed register at the time of the last check.  
**Entity:** PayrollRun · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/payroll-engine.ts → type PayrollRunV2, store seereon.payroll.runs.v3`

| Column           | Type         | Req | FK               | Description / allowed values                                                                              |
| ---------------- | ------------ | --- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| id               | varchar(30)  | Y   |                  | PR-202607 / PR-202608-417                                                                                 |
| org_id           | varchar(20)  | Y   | organizations.id | Owning entity                                                                                             |
| title            | varchar(120) | Y   |                  | e.g. July 2026 Salary                                                                                     |
| period           | char(7)      | Y   |                  | Wage month YYYY-MM                                                                                        |
| frequency        | varchar(20)  | Y   |                  | Allowed: Monthly\|Bi-weekly\|Weekly\|Quarterly                                                            |
| pay_date         | date         | Y   |                  | Salary credit date (≥ period start)                                                                       |
| bank_account     | varchar(80)  | Y   |                  | Company debit account label                                                                               |
| status           | varchar(20)  | Y   |                  | Allowed: Draft\|Checks Failed\|Checks Passed\|Pending Approval\|Approved\|Rejected\|Processed\|Paid       |
| prepared_by_id   | varchar(20)  | Y   | users.id         | Maker                                                                                                     |
| prepared_by_name | varchar(120) | Y   |                  |                                                                                                           |
| prepared_on      | date         | Y   |                  |                                                                                                           |
| checked_on       | timestamptz  |     |                  | Last compliance-check run                                                                                 |
| approval_levels  | text[]       | Y   |                  | Snapshot of Statutory Config approval chain Allowed: Payroll Admin\|HR Manager\|Finance\|CFO              |
| processed_on     | date         |     |                  |                                                                                                           |
| processed_by     | varchar(120) |     |                  |                                                                                                           |
| paid_on          | date         |     |                  |                                                                                                           |
| payment_ref      | varchar(60)  |     |                  | Bank bulk transfer ref                                                                                    |
| totals           | jsonb        | Y   |                  | Denormalised register totals (employees, gross, LOP, PF/ESI/PT/LWF/NPS/TDS, loan EMI, net, employer cost) |

Indexes: (org_id, period) unique where status <> 'Rejected'; (org_id, status)

#### payslip_configs

Payslip branding and printed fields.  
**Entity:** PayslipConfig · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/components/finance/PayslipsTab.tsx → payslipConfigStore (seereon.payroll.payslip-config), type in finance-data.ts`

| Column     | Type         | Req | FK               | Description / allowed values                                  |
| ---------- | ------------ | --- | ---------------- | ------------------------------------------------------------- |
| id         | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id) |
| org_id     | varchar(20)  | Y   | organizations.id | Owning entity                                                 |
| title      | varchar(60)  | Y   |                  |                                                               |
| brand_name | varchar(120) | Y   |                  |                                                               |
| brand_logo | varchar(160) | Y   |                  |                                                               |
| fields     | jsonb        | Y   |                  |                                                               |

#### pt_slabs (child)

Child of state_statutory_policies — pt_slabs (state, up_to numeric null = and above, amount, note)  
**Entity:** PtSlabs · **Primary key:** —

Source: `src/lib/statutory-data.ts → STATE_POLICIES / BRANCH_STATE`

| Column                    | Type          | Req | FK                             | Description / allowed values |
| ------------------------- | ------------- | --- | ------------------------------ | ---------------------------- |
| id                        | bigserial     | Y   |                                | Surrogate key                |
| state_statutory_policy_id | varchar(40)   | Y   | state_statutory_policies.state | Parent StatePolicy           |
| state                     | varchar(120)  |     |                                |                              |
| up_to                     | numeric(14,2) |     |                                | numeric null = and above     |
| amount                    | numeric(14,2) |     |                                |                              |
| note                      | text          |     |                                |                              |

Indexes: (state_statutory_policy_id)

#### reimbursement_categories

Named masters: reimbursement categories, insurance types, insurance categories.  
**Entity:** ReimbursementCategory · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/claims-data.ts → NamedMaster stores`

| Column      | Type        | Req | FK  | Description / allowed values |
| ----------- | ----------- | --- | --- | ---------------------------- |
| id          | varchar(20) | Y   |     |                              |
| name        | varchar(60) | Y   |     |                              |
| description | text        | Y   |     |                              |
| status      | varchar(10) | Y   |     |                              |

#### reimbursement_claims

Employee expense claim through Manager → HR → CHRO → CEO → CFO → Accounts.  
**Entity:** ReimbursementClaim · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/claims-data.ts → type Reimbursement, store seereon.claims.reimbursements.v1`

| Column               | Type          | Req | FK                            | Description / allowed values                                            |
| -------------------- | ------------- | --- | ----------------------------- | ----------------------------------------------------------------------- |
| id                   | varchar(20)   | Y   |                               | RMB-005                                                                 |
| employee_id          | varchar(20)   | Y   | employees.id                  | Employee                                                                |
| employee_name        | varchar(120)  | Y   |                               |                                                                         |
| title                | varchar(160)  | Y   |                               |                                                                         |
| type                 | varchar(30)   | Y   |                               | Allowed: Expense Claim\|Advance Settlement\|Insurance Claim\|Petty Cash |
| category             | varchar(60)   | Y   | reimbursement_categories.name |                                                                         |
| amount               | numeric(14,2) | Y   |                               |                                                                         |
| expense_date         | date          | Y   |                               |                                                                         |
| document             | varchar(160)  |     |                               |                                                                         |
| description          | text          |     |                               |                                                                         |
| status               | varchar(10)   | Y   |                               | Allowed: Submitted\|Approved\|Rejected\|Paid                            |
| remarks              | text          |     |                               |                                                                         |
| current_stage        | varchar(10)   | Y   |                               | Allowed: Manager\|HR\|CHRO\|CEO\|CFO\|Accounts\|Settled                 |
| stage_status         | varchar(10)   | Y   |                               | Allowed: Pending\|Approved\|Rejected\|Processed                         |
| purpose              | text          | Y   |                               |                                                                         |
| project              | varchar(120)  |     |                               |                                                                         |
| client               | varchar(120)  |     |                               |                                                                         |
| cost_centre          | varchar(30)   |     |                               |                                                                         |
| period_from          | date          | Y   |                               |                                                                         |
| period_to            | date          | Y   |                               | ≥ period_from                                                           |
| payment_mode         | varchar(30)   | Y   |                               | Allowed: With salary (payroll)\|Bank transfer\|Petty cash               |
| advance_adjusted     | numeric(14,2) |     |                               | 0…amount                                                                |
| advance_ref          | varchar(30)   |     |                               |                                                                         |
| policy_limit         | numeric(14,2) |     |                               |                                                                         |
| submitted_on         | timestamptz   | Y   |                               |                                                                         |
| department           | varchar(80)   |     |                               |                                                                         |
| designation          | varchar(80)   |     |                               |                                                                         |
| branch               | varchar(80)   |     |                               |                                                                         |
| bank_account         | varchar(60)   |     |                               |                                                                         |
| declaration_accepted | boolean       | Y   |                               |                                                                         |

Indexes: (employee_id); (current_stage, status)

#### salary_components (child)

Child of salary_structures — salary_components (code, label, section Inclusion|Exclusion, basis % of CTC|% of Basic|Fixed monthly|Balancing, value, cap, taxable, statutory tag, show_on_payslip)  
**Entity:** SalaryComponents · **Primary key:** —

Source: `src/lib/salary-engine.ts → type SalaryStructure, store seereon.masters.salary-structures`

| Column              | Type          | Req | FK                      | Description / allowed values                                                            |
| ------------------- | ------------- | --- | ----------------------- | --------------------------------------------------------------------------------------- |
| id                  | bigserial     | Y   |                         | Surrogate key                                                                           |
| salary_structure_id | varchar(40)   | Y   | salary_structures.grade | Parent SalaryStructure                                                                  |
| code                | varchar(120)  |     |                         |                                                                                         |
| label               | varchar(120)  |     |                         |                                                                                         |
| section             | varchar(120)  |     |                         | Inclusion\|Exclusion Allowed: Inclusion\|Exclusion                                      |
| basis               | varchar(120)  |     |                         | % of CTC\|% of Basic\|Fixed monthly\|Balancing Allowed: Basic\|Fixed monthly\|Balancing |
| value               | varchar(120)  |     |                         |                                                                                         |
| cap                 | varchar(120)  |     |                         |                                                                                         |
| taxable             | numeric(14,2) |     |                         |                                                                                         |
| statutory           | varchar(120)  |     |                         | tag                                                                                     |
| show_on_payslip     | varchar(120)  |     |                         |                                                                                         |

Indexes: (salary_structure_id)

#### salary_structures

Grade-wise salary structure (inclusions/exclusions) used to break a CTC into components.  
**Entity:** SalaryStructure · **Primary key:** grade · **Tenant-scoped** (org_id)

Source: `src/lib/salary-engine.ts → type SalaryStructure, store seereon.masters.salary-structures`

| Column       | Type         | Req | FK  | Description / allowed values                |
| ------------ | ------------ | --- | --- | ------------------------------------------- |
| grade        | varchar(10)  | Y   |     |                                             |
| name         | varchar(120) | Y   |     |                                             |
| wage_type    | varchar(14)  | Y   |     | Allowed: Salaried\|Monthly wage\|Daily wage |
| working_days | smallint     | Y   |     |                                             |
| notes        | text         | Y   |     |                                             |
| active       | boolean      | Y   |     |                                             |

#### state_statutory_policies

Per-state Professional Tax slabs, LWF cycle, minimum wage and ESI zone (reference data).  
**Entity:** StatePolicy · **Primary key:** state

Source: `src/lib/statutory-data.ts → STATE_POLICIES / BRANCH_STATE`

| Column          | Type          | Req | FK  | Description / allowed values |
| --------------- | ------------- | --- | --- | ---------------------------- |
| state           | varchar(30)   | Y   |     |                              |
| pt_applicable   | boolean       | Y   |     |                              |
| pt_half_yearly  | boolean       |     |     |                              |
| pt_adjust_month | jsonb         |     |     | e.g. Odisha March ₹300       |
| lwf             | jsonb         | Y   |     |                              |
| minimum_wage    | numeric(14,2) | Y   |     |                              |
| esi_zone        | varchar(30)   | Y   |     |                              |

#### statutory_configs

Organisation statutory policy: establishment registrations, PF, ESI, TDS (new regime only) and payroll approval policy.  
**Entity:** StatutoryConfig · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/statutory-data.ts → type StatutoryConfig, store seereon.statutory.config`

| Column                  | Type          | Req | FK               | Description / allowed values                         |
| ----------------------- | ------------- | --- | ---------------- | ---------------------------------------------------- |
| org_id                  | varchar(20)   | Y   | organizations.id | Owning entity                                        |
| pf_establishment_code   | varchar(20)   | Y   |                  |                                                      |
| esi_employer_code       | varchar(17)   | Y   |                  |                                                      |
| tan                     | char(10)      | Y   |                  | AAAA99999A                                           |
| pan                     | char(10)      | Y   |                  | AAAAA9999A                                           |
| registered_state        | varchar(30)   | Y   |                  |                                                      |
| ptrc_number             | varchar(40)   | Y   |                  |                                                      |
| pf_enabled              | boolean       | Y   |                  |                                                      |
| pf_employee_rate        | numeric(5,2)  | Y   |                  | 12                                                   |
| pf_employer_rate        | numeric(5,2)  | Y   |                  | 12                                                   |
| eps_rate                | numeric(5,2)  | Y   |                  | 8.33                                                 |
| edli_rate               | numeric(5,2)  | Y   |                  | 0.5                                                  |
| pf_admin_rate           | numeric(5,2)  | Y   |                  | 0.5                                                  |
| pf_wage_ceiling         | numeric(14,2) | Y   |                  | 15000                                                |
| pf_restrict_to_ceiling  | boolean       | Y   |                  |                                                      |
| pf_employer_on_actual   | boolean       | Y   |                  |                                                      |
| pf_due_day              | smallint      | Y   |                  | 15                                                   |
| esi_enabled             | boolean       | Y   |                  |                                                      |
| esi_employee_rate       | numeric(5,2)  | Y   |                  | 0.75                                                 |
| esi_employer_rate       | numeric(5,2)  | Y   |                  | 3.25                                                 |
| esi_wage_threshold      | numeric(14,2) | Y   |                  | 21000                                                |
| esi_pwd_threshold       | numeric(14,2) | Y   |                  | 25000                                                |
| esi_due_day             | smallint      | Y   |                  |                                                      |
| esi_lock_membership     | boolean       | Y   |                  |                                                      |
| tax_regime              | varchar(12)   | Y   |                  | Always New Regime Allowed: New Regime                |
| standard_deduction      | numeric(14,2) | Y   |                  | 75000                                                |
| cess_rate               | numeric(5,2)  | Y   |                  | 4                                                    |
| rebate_87a_limit        | numeric(14,2) | Y   |                  | 1200000                                              |
| rebate_87a_max          | numeric(14,2) | Y   |                  | 60000                                                |
| tds_due_day             | smallint      | Y   |                  | 7 (March → 30 Apr)                                   |
| nps_80ccd2_cap_pct      | numeric(5,2)  | Y   |                  | 14                                                   |
| approval_levels         | text[]        | Y   |                  | ≥ 1 Allowed: Payroll Admin\|HR Manager\|Finance\|CFO |
| enforce_maker_checker   | boolean       | Y   |                  |                                                      |
| block_on_errors         | boolean       | Y   |                  |                                                      |
| require_attendance_lock | boolean       | Y   |                  |                                                      |
| pay_day                 | smallint      | Y   |                  |                                                      |
| updated_on              | date          | Y   |                  |                                                      |
| updated_by              | varchar(120)  | Y   |                  |                                                      |

Indexes: (org_id) unique

#### statutory_filings

ECR / ESI / TDS filing generated from a processed run, with verify → approve → file → pay workflow.  
**Entity:** StatutoryFiling · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/statutory-filings.ts → type Filing, store seereon.statutory.filings`

| Column           | Type          | Req | FK               | Description / allowed values                    |
| ---------------- | ------------- | --- | ---------------- | ----------------------------------------------- |
| id               | varchar(30)   | Y   |                  | ECR-202607 / -S1 supplementary                  |
| kind             | varchar(4)    | Y   |                  | Allowed: ECR\|ESI\|TDS                          |
| org_id           | varchar(20)   | Y   | organizations.id | Owning entity                                   |
| run_id           | varchar(30)   | Y   | payroll_runs.id  |                                                 |
| period           | char(7)       | Y   |                  |                                                 |
| status           | varchar(10)   | Y   |                  | Allowed: Draft\|Verified\|Approved\|Filed\|Paid |
| due_on           | date          | Y   |                  |                                                 |
| member_count     | integer       | Y   |                  |                                                 |
| total_amount     | numeric(14,2) | Y   |                  |                                                 |
| ecr_accounts     | jsonb         |     |                  | A/C 1, 2 (min ₹500), 10, 21, 22                 |
| validation       | jsonb         | Y   |                  |                                                 |
| file_name        | varchar(120)  | Y   |                  |                                                 |
| generated_by_id  | varchar(20)   | Y   | users.id         |                                                 |
| generated_on     | date          | Y   |                  |                                                 |
| verified_by      | varchar(120)  |     |                  |                                                 |
| approved_by      | varchar(120)  |     |                  |                                                 |
| reference_no     | varchar(60)   |     |                  | TRRN / ESIC challan / CIN                       |
| filed_on         | date          |     |                  |                                                 |
| paid_on          | date          |     |                  |                                                 |
| payment_ref      | varchar(60)   |     |                  |                                                 |
| is_supplementary | boolean       | Y   |                  |                                                 |

Indexes: (org_id, kind, period); id unique

#### surcharge_tiers (child)

Child of income_tax_slabs — surcharge_tiers (fy, above, rate)  
**Entity:** SurchargeTiers · **Primary key:** —

Source: `src/lib/statutory-data.ts → NEW_REGIME_SLABS, NEW_REGIME_SURCHARGE`

| Column             | Type         | Req | FK                  | Description / allowed values |
| ------------------ | ------------ | --- | ------------------- | ---------------------------- |
| id                 | bigserial    | Y   |                     | Surrogate key                |
| income_tax_slab_id | varchar(40)  | Y   | income_tax_slabs.fy | Parent IncomeTaxSlab         |
| fy                 | varchar(120) |     |                     |                              |
| above              | varchar(120) |     |                     |                              |
| rate               | varchar(120) |     |                     |                              |

Indexes: (income_tax_slab_id)

#### tax_document_history (child)

Child of tax_documents — tax_document_history  
**Entity:** TaxDocumentHistory · **Primary key:** —

Source: `src/lib/tax-data.ts → type TaxDocument, store seereon.tax.docs.v2`

| Column          | Type        | Req | FK               | Description / allowed values |
| --------------- | ----------- | --- | ---------------- | ---------------------------- |
| id              | bigserial   | Y   |                  | Surrogate key                |
| tax_document_id | varchar(40) | Y   | tax_documents.id | Parent TaxDocument           |
| value           | text        | Y   |                  | Item value (array element)   |

Indexes: (tax_document_id)

#### tax_document_quarters (child)

Child of tax_documents — tax_document_quarters (from working.quarters)  
**Entity:** TaxDocumentQuarters · **Primary key:** —

Source: `src/lib/tax-data.ts → type TaxDocument, store seereon.tax.docs.v2`

| Column          | Type        | Req | FK               | Description / allowed values |
| --------------- | ----------- | --- | ---------------- | ---------------------------- |
| id              | bigserial   | Y   |                  | Surrogate key                |
| tax_document_id | varchar(40) | Y   | tax_documents.id | Parent TaxDocument           |
| value           | text        | Y   |                  | Item value (array element)   |

Indexes: (tax_document_id)

#### tax_documents

Form 16 / 12BA / 12BB records — generated from payroll (with full Part A/B working) or uploaded.  
**Entity:** TaxDocument · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/tax-data.ts → type TaxDocument, store seereon.tax.docs.v2`

| Column            | Type         | Req | FK           | Description / allowed values                                                                                                                                                                                                          |
| ----------------- | ------------ | --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                | varchar(20)  | Y   |              | TAX-005                                                                                                                                                                                                                               |
| employee_id       | varchar(20)  | Y   | employees.id | Employee                                                                                                                                                                                                                              |
| employee_name     | varchar(120) | Y   |              |                                                                                                                                                                                                                                       |
| form              | varchar(24)  | Y   |              | Allowed: Form 16\|Form 12BB\|Form 12BA\|Form 16 Part A only                                                                                                                                                                           |
| fy                | varchar(12)  | Y   |              |                                                                                                                                                                                                                                       |
| quarter           | varchar(10)  | Y   |              |                                                                                                                                                                                                                                       |
| file_name         | varchar(160) | Y   |              |                                                                                                                                                                                                                                       |
| gross_salary_text | varchar(40)  | Y   |              | Display; prefer numeric from working                                                                                                                                                                                                  |
| tax_deducted_text | varchar(40)  | Y   |              |                                                                                                                                                                                                                                       |
| status            | varchar(10)  | Y   |              | Allowed: Generated\|Uploaded\|Pending\|Verified\|Issued                                                                                                                                                                               |
| issued_on         | date         | Y   |              |                                                                                                                                                                                                                                       |
| source            | varchar(10)  | Y   |              | Allowed: Generated\|Uploaded                                                                                                                                                                                                          |
| form16_working    | jsonb        |     |              | Part B: gross, components, perquisites, exempt, std deduction, 80CCD(2), other income, taxable, slab rows, slab tax, 87A, surcharge, cess, total; Part A: quarters[], TDS, previous employer TDS, balance; certificate no., signatory |
| uploaded_note     | text         |     |              |                                                                                                                                                                                                                                       |

Indexes: (employee_id, fy, form, source)

#### wage_roll_employees

Muster-only staff paid by payroll but not in the HR directory (drivers, helpers, security).  
**Entity:** WageRollEmployee · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/payroll-engine.ts → WAGE_ROLL (RosterEmployee)`

| Column        | Type          | Req | FK               | Description / allowed values |
| ------------- | ------------- | --- | ---------------- | ---------------------------- |
| id            | varchar(30)   | Y   |                  | SRN-W001                     |
| org_id        | varchar(20)   | Y   | organizations.id | Owning entity                |
| name          | varchar(120)  | Y   |                  |                              |
| department    | varchar(80)   | Y   |                  |                              |
| designation   | varchar(80)   | Y   |                  |                              |
| branch        | varchar(80)   | Y   |                  |                              |
| gender        | varchar(10)   | Y   |                  |                              |
| dob           | date          | Y   |                  |                              |
| doj           | date          | Y   |                  |                              |
| ctc           | numeric(14,2) | Y   |                  |                              |
| earnings      | jsonb         | Y   |                  |                              |
| statutory_ids | jsonb         | Y   |                  |                              |
| bank          | jsonb         | Y   |                  |                              |
| status        | varchar(12)   | Y   |                  |                              |

### 9.8 Performance, Goals & Learning

#### appraisal_cycle_stages (child)

Child of appraisal_cycles — appraisal_cycle_stages (self/hod/hr StageRecord: stage enum, rating varchar(20) '1 — Below'…'5 — Outstanding', comments, submitted_by → users.id, submitted_on)  
**Entity:** AppraisalCycleStages · **Primary key:** —

Source: `src/lib/appraisal-workflow-data.ts → type AppraisalCycleRecord, store seereon.appraisal.workflow`

| Column             | Type         | Req | FK                  | Description / allowed values              |
| ------------------ | ------------ | --- | ------------------- | ----------------------------------------- |
| id                 | bigserial    | Y   |                     | Surrogate key                             |
| appraisal_cycle_id | varchar(40)  | Y   | appraisal_cycles.id | Parent AppraisalCycle                     |
| self               | varchar(120) |     |                     | /hod/hr StageRecord: stage enum           |
| rating             | varchar(20)  |     |                     | varchar(20) '1 — Below'…'5 — Outstanding' |
| comments           | varchar(120) |     |                     |                                           |
| submitted_by       | varchar(120) |     | users.id            | → users.id                                |
| submitted_on       | varchar(120) |     |                     |                                           |

Indexes: (appraisal_cycle_id)

#### appraisal_cycles

Staged Self → HOD → HR appraisal started by HR for one employee and review cycle.  
**Entity:** AppraisalCycle · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/appraisal-workflow-data.ts → type AppraisalCycleRecord, store seereon.appraisal.workflow`

| Column         | Type         | Req | FK               | Description / allowed values                                          |
| -------------- | ------------ | --- | ---------------- | --------------------------------------------------------------------- |
| id             | uuid         | Y   |                  | Surrogate primary key; business id kept in code                       |
| code           | varchar(20)  | Y   |                  | APW-001                                                               |
| org_id         | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)    |
| employee_id    | varchar(20)  | Y   | employees.id     | Employee                                                              |
| employee_name  | varchar(120) | Y   |                  |                                                                       |
| hod_id         | varchar(20)  |     | users.id         | HOD (or reporting manager fallback)                                   |
| hod_name       | varchar(120) | Y   |                  |                                                                       |
| cycle          | varchar(60)  | Y   |                  |                                                                       |
| stage          | varchar(20)  | Y   |                  | Allowed: Self Appraisal \| HOD Appraisal \| HR Appraisal \| Completed |
| created_on     | date         | Y   |                  |                                                                       |
| sent_back_note | text         |     |                  |                                                                       |

Indexes: (employee_id, cycle) unique

#### evaluation_parameters

Weighted evaluation parameters (Communication, Technical skills…) used by every review / appraisal form.  
**Entity:** EvalParam · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/performance-config.ts → type EvalParam, store seereon.masters.eval-params`

| Column           | Type         | Req | FK               | Description / allowed values                                       |
| ---------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------ |
| id               | uuid         | Y   |                  | Surrogate primary key; business id kept in code                    |
| code             | varchar(20)  | Y   |                  | EP-01                                                              |
| org_id           | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today) |
| name             | varchar(120) | Y   |                  |                                                                    |
| weight_pct       | numeric(5,2) | Y   |                  | Weight %                                                           |
| description      | text         |     |                  |                                                                    |
| applies_to_roles | varchar(120) | Y   |                  | 'All' / 'Lead / Manager'                                           |
| is_active        | boolean      | Y   |                  |                                                                    |

Indexes: (org_id, code) unique

#### goal_documents (child)

Child of goals — goal_documents  
**Entity:** GoalDocuments · **Primary key:** —

Source: `src/lib/goals-data.ts → type Goal, store seereon.goals.v2`

| Column  | Type        | Req | FK       | Description / allowed values |
| ------- | ----------- | --- | -------- | ---------------------------- |
| id      | bigserial   | Y   |          | Surrogate key                |
| goal_id | varchar(40) | Y   | goals.id | Parent Goal                  |
| value   | text        | Y   |          | Item value (array element)   |

Indexes: (goal_id)

#### goal_evaluation_params (child)

Child of goals — goal_evaluation_params (evaluationParams[] → evaluation_parameters.name)  
**Entity:** GoalEvaluationParams · **Primary key:** —

Source: `src/lib/goals-data.ts → type Goal, store seereon.goals.v2`

| Column     | Type         | Req | FK                         | Description / allowed values          |
| ---------- | ------------ | --- | -------------------------- | ------------------------------------- |
| id         | bigserial    | Y   |                            | Surrogate key                         |
| goal_id    | varchar(40)  | Y   | goals.id                   | Parent Goal                           |
| evaluation | varchar(120) |     | evaluation_parameters.name | Params[] → evaluation_parameters.name |

Indexes: (goal_id)

#### goal_history (child)

Child of goals — goal_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** GoalHistory · **Primary key:** —

Source: `src/lib/goals-data.ts → type Goal, store seereon.goals.v2`

| Column  | Type         | Req | FK       | Description / allowed values |
| ------- | ------------ | --- | -------- | ---------------------------- |
| id      | bigserial    | Y   |          | Surrogate key                |
| goal_id | varchar(40)  | Y   | goals.id | Parent Goal                  |
| at      | date         |     |          | date                         |
| by      | varchar(120) |     |          | varchar(120)                 |
| action  | text         |     |          | text                         |

Indexes: (goal_id)

#### goal_links (child)

Child of goals — goal_links (links[]: label, url https only)  
**Entity:** GoalLinks · **Primary key:** —

Source: `src/lib/goals-data.ts → type Goal, store seereon.goals.v2`

| Column  | Type         | Req | FK       | Description / allowed values |
| ------- | ------------ | --- | -------- | ---------------------------- |
| id      | bigserial    | Y   |          | Surrogate key                |
| goal_id | varchar(40)  | Y   | goals.id | Parent Goal                  |
| label   | varchar(120) |     |          |                              |
| url     | varchar(120) |     |          | https only                   |

Indexes: (goal_id)

#### goal_metrics (child)

Child of goals — goal_metrics (metrics[]: code, name, unit enum, baseline, target, current, weight)  
**Entity:** GoalMetrics · **Primary key:** —

Source: `src/lib/goals-data.ts → type Goal, store seereon.goals.v2`

| Column   | Type         | Req | FK       | Description / allowed values |
| -------- | ------------ | --- | -------- | ---------------------------- |
| id       | bigserial    | Y   |          | Surrogate key                |
| goal_id  | varchar(40)  | Y   | goals.id | Parent Goal                  |
| code     | varchar(120) |     |          |                              |
| name     | varchar(120) |     |          |                              |
| unit     | varchar(120) |     |          | enum                         |
| baseline | varchar(120) |     |          |                              |
| target   | varchar(120) |     |          |                              |
| current  | varchar(120) |     |          |                              |
| weight   | varchar(120) |     |          |                              |

Indexes: (goal_id)

#### goal_milestones (child)

Child of goals — goal_milestones (milestones[]: code, title, due, done)  
**Entity:** GoalMilestones · **Primary key:** —

Source: `src/lib/goals-data.ts → type Goal, store seereon.goals.v2`

| Column  | Type         | Req | FK       | Description / allowed values |
| ------- | ------------ | --- | -------- | ---------------------------- |
| id      | bigserial    | Y   |          | Surrogate key                |
| goal_id | varchar(40)  | Y   | goals.id | Parent Goal                  |
| code    | varchar(120) |     |          |                              |
| title   | varchar(120) |     |          |                              |
| due     | date         |     |          |                              |
| done    | boolean      |     |          |                              |

Indexes: (goal_id)

#### goals

Individual / team / department / organisational goal with metrics, milestones, links, ratings and approval.  
**Entity:** Goal · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/goals-data.ts → type Goal, store seereon.goals.v2`

| Column             | Type         | Req | FK               | Description / allowed values                                                           |
| ------------------ | ------------ | --- | ---------------- | -------------------------------------------------------------------------------------- |
| id                 | uuid         | Y   |                  | Surrogate primary key; business id kept in code                                        |
| code               | varchar(20)  | Y   |                  | GOL-001                                                                                |
| org_id             | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)                     |
| title              | varchar(200) | Y   |                  |                                                                                        |
| description        | text         |     |                  |                                                                                        |
| level              | varchar(15)  | Y   |                  | Allowed: Individual \| Team \| Department \| Organizational                            |
| owner_id           | varchar(20)  | Y   | employees.id     |                                                                                        |
| owner_name         | varchar(120) | Y   |                  |                                                                                        |
| created_by_name    | varchar(120) | Y   |                  |                                                                                        |
| created_by_role    | varchar(10)  | Y   |                  | Allowed: Employee \| Manager \| HR \| Admin                                            |
| start_date         | date         | Y   |                  |                                                                                        |
| due_date           | date         | Y   |                  | ≥ start                                                                                |
| weight_pct         | numeric(5,2) | Y   |                  | 0–100                                                                                  |
| target             | varchar(300) | Y   |                  |                                                                                        |
| progress_pct       | numeric(5,2) | Y   |                  | 0–100                                                                                  |
| status             | varchar(20)  | Y   |                  | Allowed: Draft \| Pending Approval \| Approved \| Rejected \| In Progress \| Completed |
| rating_label       | varchar(20)  | Y   |                  | Allowed: Not Rated \| Below \| Meets \| Exceeds \| Outstanding                         |
| manager_remarks    | text         |     |                  |                                                                                        |
| self_rating        | smallint     |     |                  | 1–5                                                                                    |
| self_justification | text         |     |                  |                                                                                        |
| manager_rating     | smallint     |     |                  | 1–5                                                                                    |
| category           | varchar(40)  |     |                  |                                                                                        |
| priority           | varchar(10)  |     |                  | Allowed: Critical \| High \| Medium \| Low                                             |
| quarter            | varchar(40)  |     |                  |                                                                                        |
| success_criteria   | text         |     |                  |                                                                                        |
| parent_goal_id     | varchar(20)  |     | goals.code       | Cascade parent                                                                         |
| assigned_by        | varchar(20)  |     | users.id         |                                                                                        |
| assigned_on        | date         |     |                  |                                                                                        |
| reviewer_id        | varchar(20)  |     | employees.id     |                                                                                        |
| reviewer_name      | varchar(120) |     |                  |                                                                                        |
| hr_remarks         | text         |     |                  |                                                                                        |
| owner_notes        | text         |     |                  |                                                                                        |

Indexes: (org_id, owner_id, status); (parent_goal_id)

#### hr_appraisal_attachments (child)

Child of hr_appraisals — hr_appraisal_attachments  
**Entity:** HrAppraisalAttachments · **Primary key:** —

Source: `src/lib/appraisal-data.ts → type HrAppraisal, store seereon.appraisals.v2`

| Column          | Type        | Req | FK               | Description / allowed values |
| --------------- | ----------- | --- | ---------------- | ---------------------------- |
| id              | bigserial   | Y   |                  | Surrogate key                |
| hr_appraisal_id | varchar(40) | Y   | hr_appraisals.id | Parent HrAppraisal           |
| value           | text        | Y   |                  | Item value (array element)   |

Indexes: (hr_appraisal_id)

#### hr_appraisal_goals (child)

Child of hr_appraisals — hr_appraisal_goals (goals[]: goal_id, title, status, progress, target, achievement, rating, weight)  
**Entity:** HrAppraisalGoals · **Primary key:** —

Source: `src/lib/appraisal-data.ts → type HrAppraisal, store seereon.appraisals.v2`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key                |
| hr_appraisal_id | varchar(40)  | Y   | hr_appraisals.id | Parent HrAppraisal           |
| goal_id         | varchar(40)  |     | goals.id         |                              |
| title           | varchar(120) |     |                  |                              |
| status          | varchar(120) |     |                  |                              |
| progress        | varchar(120) |     |                  |                              |
| target          | varchar(120) |     |                  |                              |
| achievement     | varchar(120) |     |                  |                              |
| rating          | varchar(120) |     |                  |                              |
| weight          | varchar(120) |     |                  |                              |

Indexes: (hr_appraisal_id)

#### hr_appraisal_history (child)

Child of hr_appraisals — hr_appraisal_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** HrAppraisalHistory · **Primary key:** —

Source: `src/lib/appraisal-data.ts → type HrAppraisal, store seereon.appraisals.v2`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key                |
| hr_appraisal_id | varchar(40)  | Y   | hr_appraisals.id | Parent HrAppraisal           |
| at              | date         |     |                  | date                         |
| by              | varchar(120) |     |                  | varchar(120)                 |
| action          | text         |     |                  | text                         |

Indexes: (hr_appraisal_id)

#### hr_appraisal_linked_reviews (child)

Child of hr_appraisals — hr_appraisal_linked_reviews (linkedReviews[]: review_id, kind Manager review|HR review, by, rating, score)  
**Entity:** HrAppraisalLinkedReviews · **Primary key:** —

Source: `src/lib/appraisal-data.ts → type HrAppraisal, store seereon.appraisals.v2`

| Column          | Type         | Req | FK               | Description / allowed values                                 |
| --------------- | ------------ | --- | ---------------- | ------------------------------------------------------------ |
| id              | bigserial    | Y   |                  | Surrogate key                                                |
| hr_appraisal_id | varchar(40)  | Y   | hr_appraisals.id | Parent HrAppraisal                                           |
| review_id       | varchar(120) |     |                  |                                                              |
| kind            | varchar(120) |     |                  | Manager review\|HR review Allowed: Manager review\|HR review |
| by              | varchar(120) |     |                  |                                                              |
| rating          | varchar(120) |     |                  |                                                              |
| score           | varchar(120) |     |                  |                                                              |

Indexes: (hr_appraisal_id)

#### hr_appraisal_params (child)

Child of hr_appraisals — hr_appraisal_params (params[]: param_id → evaluation_parameters, weight, rating, note)  
**Entity:** HrAppraisalParams · **Primary key:** —

Source: `src/lib/appraisal-data.ts → type HrAppraisal, store seereon.appraisals.v2`

| Column          | Type         | Req | FK                       | Description / allowed values |
| --------------- | ------------ | --- | ------------------------ | ---------------------------- |
| id              | bigserial    | Y   |                          | Surrogate key                |
| hr_appraisal_id | varchar(40)  | Y   | hr_appraisals.id         | Parent HrAppraisal           |
| param_id        | varchar(120) |     | evaluation_parameters.id | → evaluation_parameters      |
| weight          | varchar(120) |     |                          |                              |
| rating          | varchar(120) |     |                          |                              |
| note            | text         |     |                          |                              |

Indexes: (hr_appraisal_id)

#### hr_appraisals

HR-initiated appraisal (trigger, purpose, goals & parameter ratings, linked reviews, pay outcome); approval applies CTC/grade and generates the letter.  
**Entity:** HrAppraisal · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/appraisal-data.ts → type HrAppraisal, store seereon.appraisals.v2`

| Column          | Type          | Req | FK                      | Description / allowed values                                                                                                                                                                                                                                       |
| --------------- | ------------- | --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id              | uuid          | Y   |                         | Surrogate primary key; business id kept in code                                                                                                                                                                                                                    |
| code            | varchar(20)   | Y   |                         | APR-001                                                                                                                                                                                                                                                            |
| org_id          | varchar(20)   | Y   | organizations.id        | Owning entity (derived from the employee's directory record today)                                                                                                                                                                                                 |
| employee_id     | varchar(20)   | Y   | employees.id            | Employee                                                                                                                                                                                                                                                           |
| employee_name   | varchar(120)  | Y   |                         |                                                                                                                                                                                                                                                                    |
| designation     | varchar(120)  | Y   |                         |                                                                                                                                                                                                                                                                    |
| department      | varchar(80)   | Y   |                         |                                                                                                                                                                                                                                                                    |
| current_grade   | varchar(10)   | Y   | salary_structures.grade |                                                                                                                                                                                                                                                                    |
| cycle           | varchar(60)   | Y   |                         |                                                                                                                                                                                                                                                                    |
| trigger         | varchar(40)   | Y   |                         | Allowed: Annual appraisal cycle \| Manager review outcome \| HR review outcome \| Promotion decision \| Market correction \| Retention (counter-offer) \| Confirmation after probation \| Role change \| Special recognition / award \| Client escalation resolved |
| purpose         | varchar(40)   | Y   |                         | Allowed: Annual increment \| Promotion / grade change \| Mid-year increment \| Role change with revised pay \| Confirmation after probation \| Retention correction \| Performance bonus                                                                           |
| why_happened    | text          | Y   |                         |                                                                                                                                                                                                                                                                    |
| timeline_from   | date          |     |                         |                                                                                                                                                                                                                                                                    |
| timeline_to     | date          |     |                         |                                                                                                                                                                                                                                                                    |
| achievements    | text          |     |                         |                                                                                                                                                                                                                                                                    |
| value_created   | text          |     |                         |                                                                                                                                                                                                                                                                    |
| justification   | text          |     |                         |                                                                                                                                                                                                                                                                    |
| overall_score   | numeric(3,2)  |     |                         |                                                                                                                                                                                                                                                                    |
| rating_band     | varchar(30)   |     |                         |                                                                                                                                                                                                                                                                    |
| method          | varchar(40)   | Y   |                         | Allowed: Merit Increment \| Promotion Linked \| Market Correction \| Retention Bonus Linked \| Performance Bonus                                                                                                                                                   |
| current_ctc     | numeric(14,2) | Y   |                         |                                                                                                                                                                                                                                                                    |
| new_ctc         | numeric(14,2) | Y   |                         | > 0                                                                                                                                                                                                                                                                |
| hike_pct        | numeric(6,2)  | Y   |                         |                                                                                                                                                                                                                                                                    |
| new_grade       | varchar(10)   | Y   | salary_structures.grade |                                                                                                                                                                                                                                                                    |
| new_designation | varchar(120)  | Y   |                         |                                                                                                                                                                                                                                                                    |
| effective_from  | date          | Y   |                         |                                                                                                                                                                                                                                                                    |
| letter_type     | varchar(30)   | Y   |                         | Allowed: Increment Letter \| Promotion Letter \| Appointment Letter                                                                                                                                                                                                |
| bonus_amount    | numeric(14,2) | Y   |                         |                                                                                                                                                                                                                                                                    |
| remarks         | text          |     |                         |                                                                                                                                                                                                                                                                    |
| status          | varchar(10)   | Y   |                         | Allowed: Draft \| Approved \| Applied \| Rejected                                                                                                                                                                                                                  |
| created_by      | varchar(120)  | Y   |                         |                                                                                                                                                                                                                                                                    |
| created_on      | date          | Y   |                         |                                                                                                                                                                                                                                                                    |
| approved_by     | varchar(120)  |     |                         |                                                                                                                                                                                                                                                                    |
| approved_on     | date          |     |                         |                                                                                                                                                                                                                                                                    |
| letter_ref      | varchar(30)   |     |                         | INC-20260822-0142 / PRM-…                                                                                                                                                                                                                                          |

Indexes: (org_id, code) unique; (employee_id, status)

#### hr_review_attachments (child)

Child of hr_reviews — hr_review_attachments  
**Entity:** HrReviewAttachments · **Primary key:** —

Source: `src/lib/hr-review-data.ts → type HrReview, store seereon.hr.reviews.v1`

| Column       | Type        | Req | FK            | Description / allowed values |
| ------------ | ----------- | --- | ------------- | ---------------------------- |
| id           | bigserial   | Y   |               | Surrogate key                |
| hr_review_id | varchar(40) | Y   | hr_reviews.id | Parent HrReview              |
| value        | text        | Y   |               | Item value (array element)   |

Indexes: (hr_review_id)

#### hr_review_goals (child)

Child of hr_reviews — hr_review_goals (goals[]: goal_id → goals.code, title, status, progress, target, achieved, weight, rating, considered)  
**Entity:** HrReviewGoals · **Primary key:** —

Source: `src/lib/hr-review-data.ts → type HrReview, store seereon.hr.reviews.v1`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| hr_review_id | varchar(40)  | Y   | hr_reviews.id | Parent HrReview              |
| goal_id      | varchar(120) |     | goals.code    | → goals.code                 |
| title        | varchar(120) |     |               |                              |
| status       | varchar(120) |     |               |                              |
| progress     | varchar(120) |     |               |                              |
| target       | varchar(120) |     |               |                              |
| achieved     | varchar(120) |     |               |                              |
| weight       | varchar(120) |     |               |                              |
| rating       | varchar(120) |     |               |                              |
| considered   | varchar(120) |     |               |                              |

Indexes: (hr_review_id)

#### hr_review_history (child)

Child of hr_reviews — hr_review_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** HrReviewHistory · **Primary key:** —

Source: `src/lib/hr-review-data.ts → type HrReview, store seereon.hr.reviews.v1`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| hr_review_id | varchar(40)  | Y   | hr_reviews.id | Parent HrReview              |
| at           | date         |     |               | date                         |
| by           | varchar(120) |     |               | varchar(120)                 |
| action       | text         |     |               | text                         |

Indexes: (hr_review_id)

#### hr_review_params (child)

Child of hr_reviews — hr_review_params (params[]: param_id → evaluation_parameters, weight, rating, note)  
**Entity:** HrReviewParams · **Primary key:** —

Source: `src/lib/hr-review-data.ts → type HrReview, store seereon.hr.reviews.v1`

| Column       | Type         | Req | FK                       | Description / allowed values |
| ------------ | ------------ | --- | ------------------------ | ---------------------------- |
| id           | bigserial    | Y   |                          | Surrogate key                |
| hr_review_id | varchar(40)  | Y   | hr_reviews.id            | Parent HrReview              |
| param_id     | varchar(120) |     | evaluation_parameters.id | → evaluation_parameters      |
| weight       | varchar(120) |     |                          |                              |
| rating       | varchar(120) |     |                          |                              |
| note         | text         |     |                          |                              |

Indexes: (hr_review_id)

#### hr_review_skills (child)

Child of hr_reviews — hr_review_skills (skills[]: category enum Technical/Functional/Behavioural/Leadership, skill, level 1–5, evidence)  
**Entity:** HrReviewSkills · **Primary key:** —

Source: `src/lib/hr-review-data.ts → type HrReview, store seereon.hr.reviews.v1`

| Column       | Type         | Req | FK            | Description / allowed values                     |
| ------------ | ------------ | --- | ------------- | ------------------------------------------------ |
| id           | bigserial    | Y   |               | Surrogate key                                    |
| hr_review_id | varchar(40)  | Y   | hr_reviews.id | Parent HrReview                                  |
| category     | varchar(120) |     |               | enum Technical/Functional/Behavioural/Leadership |
| skill        | varchar(120) |     |               |                                                  |
| level        | varchar(120) |     |               | 1–5                                              |
| evidence     | varchar(120) |     |               |                                                  |

Indexes: (hr_review_id)

#### hr_reviews

HR-run employee review: goals considered, skills, evaluation parameters, attendance/discipline/training context, assessment and recommendation; optionally shared for acknowledgement.  
**Entity:** HrReview · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-review-data.ts → type HrReview, store seereon.hr.reviews.v1`

| Column                  | Type         | Req | FK                                      | Description / allowed values                                                                                                                                                                              |
| ----------------------- | ------------ | --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | uuid         | Y   |                                         | Surrogate primary key; business id kept in code                                                                                                                                                           |
| code                    | varchar(20)  | Y   |                                         | ER-001                                                                                                                                                                                                    |
| org_id                  | varchar(20)  | Y   | organizations.id                        | Owning entity (derived from the employee's directory record today)                                                                                                                                        |
| employee_id             | varchar(20)  | Y   | employees.id                            | Employee                                                                                                                                                                                                  |
| employee_name           | varchar(120) | Y   |                                         |                                                                                                                                                                                                           |
| designation             | varchar(120) | Y   |                                         |                                                                                                                                                                                                           |
| department              | varchar(80)  | Y   |                                         |                                                                                                                                                                                                           |
| reviewer_id             | varchar(20)  | Y   | users.id                                | HR reviewer                                                                                                                                                                                               |
| review_type             | varchar(40)  | Y   |                                         | Allowed: Quarterly review \| Mid-year review \| Annual review \| Probation confirmation \| Promotion readiness \| PIP checkpoint \| Exit / transition review \| Special (client escalation / recognition) |
| cycle                   | varchar(60)  | Y   | performance_masters.code (review_cycle) |                                                                                                                                                                                                           |
| period_from             | date         | Y   |                                         |                                                                                                                                                                                                           |
| period_to               | date         | Y   |                                         |                                                                                                                                                                                                           |
| review_date             | date         | Y   |                                         |                                                                                                                                                                                                           |
| status                  | varchar(12)  | Y   |                                         | Allowed: Scheduled \| In Progress \| Completed                                                                                                                                                            |
| ctx_attendance_pct      | numeric(5,2) |     |                                         |                                                                                                                                                                                                           |
| ctx_late_marks          | integer      |     |                                         |                                                                                                                                                                                                           |
| ctx_warnings            | integer      | Y   |                                         |                                                                                                                                                                                                           |
| ctx_trainings_completed | integer      | Y   |                                         |                                                                                                                                                                                                           |
| ctx_manager_review_id   | varchar(20)  |     | team_reviews.code                       |                                                                                                                                                                                                           |
| ctx_manager_rating      | varchar(30)  |     |                                         |                                                                                                                                                                                                           |
| ctx_client_feedback     | text         |     |                                         |                                                                                                                                                                                                           |
| strengths               | text         |     |                                         |                                                                                                                                                                                                           |
| improvements            | text         |     |                                         |                                                                                                                                                                                                           |
| achievements            | text         |     |                                         |                                                                                                                                                                                                           |
| remarks                 | text         | Y   |                                         | Shared with employee; required to complete                                                                                                                                                                |
| hr_notes_confidential   | text         |     |                                         | Never shared                                                                                                                                                                                              |
| recommendation          | varchar(40)  | Y   |                                         | Allowed: Continue in role \| Confirm employment \| Extend probation \| Increment recommended \| Ready for promotion \| Role change / transfer \| Needs improvement plan (PIP) \| Retention action         |
| development_plan        | text         |     |                                         |                                                                                                                                                                                                           |
| next_review_on          | date         |     |                                         |                                                                                                                                                                                                           |
| overall_score           | numeric(3,2) |     |                                         | 40 % goals · 40 % params · 20 % skills                                                                                                                                                                    |
| rating_band             | varchar(30)  |     |                                         |                                                                                                                                                                                                           |
| shared_with_employee    | boolean      | Y   |                                         |                                                                                                                                                                                                           |
| employee_ack_on         | date         |     |                                         |                                                                                                                                                                                                           |
| employee_ack_comment    | text         |     |                                         |                                                                                                                                                                                                           |

Indexes: (org_id, employee_id, review_date)

#### performance_masters

Performance indicators, indicator categories, goal types and review cycles (CrudSection masters).  
**Entity:** PerformanceMaster · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/performance-data.ts → PERF_INDICATORS, INDICATOR_CATEGORY_ROWS, GOAL_TYPE_ROWS, REVIEW_CYCLE_ROWS`

| Column       | Type         | Req | FK               | Description / allowed values                                          |
| ------------ | ------------ | --- | ---------------- | --------------------------------------------------------------------- |
| id           | uuid         | Y   |                  | Surrogate primary key; business id kept in code                       |
| code         | varchar(20)  | Y   |                  | PI-001 / IC-001 / GT-001 / RC-001                                     |
| org_id       | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)    |
| kind         | varchar(20)  | Y   |                  | Allowed: indicator \| indicator_category \| goal_type \| review_cycle |
| name         | varchar(120) | Y   |                  |                                                                       |
| category     | varchar(60)  |     |                  | Indicator category                                                    |
| unit         | varchar(30)  |     |                  | Allowed: Number \| Percentage \| Hours \| Score (1-5) \| Currency     |
| target_value | varchar(40)  |     |                  |                                                                       |
| frequency    | varchar(20)  |     |                  | Allowed: Monthly \| Quarterly \| Half-Yearly \| Annual                |
| status       | varchar(10)  | Y   |                  | Allowed: Active \| Inactive                                           |
| description  | text         |     |                  |                                                                       |

Indexes: (org_id, kind, name) unique

#### pip_attachments (child)

Child of pips — pip_attachments  
**Entity:** PipAttachments · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column | Type        | Req | FK      | Description / allowed values      |
| ------ | ----------- | --- | ------- | --------------------------------- |
| id     | bigserial   | Y   |         | Surrogate key                     |
| pip_id | varchar(40) | Y   | pips.id | Parent PerformanceImprovementPlan |
| value  | text        | Y   |         | Item value (array element)        |

Indexes: (pip_id)

#### pip_checkpoints (child)

Child of pips — pip_checkpoints (checkpoints[] date)  
**Entity:** PipCheckpoints · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column      | Type        | Req | FK      | Description / allowed values      |
| ----------- | ----------- | --- | ------- | --------------------------------- |
| id          | bigserial   | Y   |         | Surrogate key                     |
| pip_id      | varchar(40) | Y   | pips.id | Parent PerformanceImprovementPlan |
| checkpoints | date        |     |         | [] date                           |

Indexes: (pip_id)

#### pip_concerned_persons (child)

Child of pips — pip_concerned_persons (concerned.manager/hrPartner/mentor/others[]: person_id → employees.id, name, role, kind)  
**Entity:** PipConcernedPersons · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column    | Type         | Req | FK           | Description / allowed values      |
| --------- | ------------ | --- | ------------ | --------------------------------- |
| id        | bigserial    | Y   |              | Surrogate key                     |
| pip_id    | varchar(40)  | Y   | pips.id      | Parent PerformanceImprovementPlan |
| person_id | varchar(120) |     | employees.id | → employees.id                    |
| name      | varchar(120) |     |              |                                   |
| role      | varchar(120) |     |              |                                   |
| kind      | varchar(120) |     |              |                                   |

Indexes: (pip_id)

#### pip_goals (child)

Child of pips — pip_goals (goals[]: goal_id → goals.code, title, status, progress)  
**Entity:** PipGoals · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column   | Type         | Req | FK         | Description / allowed values      |
| -------- | ------------ | --- | ---------- | --------------------------------- |
| id       | bigserial    | Y   |            | Surrogate key                     |
| pip_id   | varchar(40)  | Y   | pips.id    | Parent PerformanceImprovementPlan |
| goal_id  | varchar(120) |     | goals.code | → goals.code                      |
| title    | varchar(120) |     |            |                                   |
| status   | varchar(120) |     |            |                                   |
| progress | varchar(120) |     |            |                                   |

Indexes: (pip_id)

#### pip_history (child)

Child of pips — pip_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** PipHistory · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column | Type         | Req | FK      | Description / allowed values      |
| ------ | ------------ | --- | ------- | --------------------------------- |
| id     | bigserial    | Y   |         | Surrogate key                     |
| pip_id | varchar(40)  | Y   | pips.id | Parent PerformanceImprovementPlan |
| at     | date         |     |         | date                              |
| by     | varchar(120) |     |         | varchar(120)                      |
| action | text         |     |         | text                              |

Indexes: (pip_id)

#### pip_objectives (child)

Child of pips — pip_objectives (objectives[]: code OBJ-n, objective, measure, done, target_date, owner)  
**Entity:** PipObjectives · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column      | Type         | Req | FK      | Description / allowed values      |
| ----------- | ------------ | --- | ------- | --------------------------------- |
| id          | bigserial    | Y   |         | Surrogate key                     |
| pip_id      | varchar(40)  | Y   | pips.id | Parent PerformanceImprovementPlan |
| code        | varchar(120) |     |         | OBJ-n                             |
| objective   | varchar(120) |     |         |                                   |
| measure     | varchar(120) |     |         |                                   |
| done        | boolean      |     |         |                                   |
| target_date | varchar(120) |     |         |                                   |
| owner       | varchar(120) |     |         |                                   |

Indexes: (pip_id)

#### pip_reviews (child)

Child of pips — pip_reviews (reviews[]: code PR-n, date, by, notes)  
**Entity:** PipReviews · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column | Type         | Req | FK      | Description / allowed values      |
| ------ | ------------ | --- | ------- | --------------------------------- |
| id     | bigserial    | Y   |         | Surrogate key                     |
| pip_id | varchar(40)  | Y   | pips.id | Parent PerformanceImprovementPlan |
| code   | varchar(120) |     |         | PR-n                              |
| date   | date         |     |         |                                   |
| by     | varchar(120) |     |         |                                   |
| notes  | text         |     |         |                                   |

Indexes: (pip_id)

#### pip_support (child)

Child of pips — pip_support (support[] enum)  
**Entity:** PipSupport · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column  | Type         | Req | FK      | Description / allowed values      |
| ------- | ------------ | --- | ------- | --------------------------------- |
| id      | bigserial    | Y   |         | Surrogate key                     |
| pip_id  | varchar(40)  | Y   | pips.id | Parent PerformanceImprovementPlan |
| support | varchar(120) |     |         | [] enum                           |

Indexes: (pip_id)

#### pip_tasks (child)

Child of pips — pip_tasks  
**Entity:** PipTasks · **Primary key:** —

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column | Type        | Req | FK      | Description / allowed values      |
| ------ | ----------- | --- | ------- | --------------------------------- |
| id     | bigserial   | Y   |         | Surrogate key                     |
| pip_id | varchar(40) | Y   | pips.id | Parent PerformanceImprovementPlan |
| value  | text        | Y   |         | Item value (array element)        |

Indexes: (pip_id)

#### pips

Performance improvement plan with reason, evidence, timeline & checkpoints, concerned persons, goals/tasks, objectives, support, consequences and acknowledgement.  
**Entity:** PerformanceImprovementPlan · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/pip-data.ts → type PIP, store seereon.pips.v2`

| Column               | Type         | Req | FK               | Description / allowed values                                                                                                                                                                                               |
| -------------------- | ------------ | --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                   | uuid         | Y   |                  | Surrogate primary key; business id kept in code                                                                                                                                                                            |
| code                 | varchar(20)  | Y   |                  | PIP-001                                                                                                                                                                                                                    |
| org_id               | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)                                                                                                                                                         |
| employee_id          | varchar(20)  | Y   | employees.id     | Employee                                                                                                                                                                                                                   |
| employee_name        | varchar(120) | Y   |                  |                                                                                                                                                                                                                            |
| designation          | varchar(120) |     |                  |                                                                                                                                                                                                                            |
| department           | varchar(80)  |     |                  |                                                                                                                                                                                                                            |
| raised_by_name       | varchar(120) | Y   |                  |                                                                                                                                                                                                                            |
| raised_by            | varchar(20)  |     | users.id         |                                                                                                                                                                                                                            |
| reason_category      | varchar(40)  |     |                  | Allowed: Delivery / productivity slippage \| Quality of work \| Attendance & punctuality \| Behaviour / conduct \| Skill or knowledge gap \| Client escalation \| Missed goals / targets \| Probation performance \| Other |
| reason_summary       | varchar(300) | Y   |                  |                                                                                                                                                                                                                            |
| detailed_reason      | text         | Y   |                  |                                                                                                                                                                                                                            |
| evidence             | text         |     |                  |                                                                                                                                                                                                                            |
| prior_actions        | text         |     |                  |                                                                                                                                                                                                                            |
| start_date           | date         | Y   |                  |                                                                                                                                                                                                                            |
| end_date             | date         | Y   |                  | ≥ start                                                                                                                                                                                                                    |
| work_start_time      | time         |     |                  |                                                                                                                                                                                                                            |
| work_end_time        | time         |     |                  |                                                                                                                                                                                                                            |
| checkpoint_cadence   | varchar(12)  |     |                  | Allowed: Weekly \| Fortnightly \| Monthly                                                                                                                                                                                  |
| status               | varchar(15)  | Y   |                  | Allowed: Draft \| Active \| Under Review \| Successful \| Failed \| Archived                                                                                                                                               |
| manager_remarks      | text         |     |                  |                                                                                                                                                                                                                            |
| hr_remarks           | text         |     |                  |                                                                                                                                                                                                                            |
| final_evaluation     | text         |     |                  |                                                                                                                                                                                                                            |
| expected_outcome     | text         |     |                  |                                                                                                                                                                                                                            |
| consequences         | text         |     |                  |                                                                                                                                                                                                                            |
| employee_ack_on      | date         |     |                  |                                                                                                                                                                                                                            |
| employee_ack_comment | text         |     |                  |                                                                                                                                                                                                                            |
| created_on           | date         |     |                  |                                                                                                                                                                                                                            |

Indexes: (employee_id) where status in (Draft, Active, Under Review) unique

#### review_form_evidence (child)

Child of review_forms — review_form_evidence (self.evidence[] file names)  
**Entity:** ReviewFormEvidence · **Primary key:** —

Source: `src/lib/performance-config.ts → type ReviewForm, store seereon.performance.reviews`

| Column         | Type         | Req | FK              | Description / allowed values |
| -------------- | ------------ | --- | --------------- | ---------------------------- |
| id             | bigserial    | Y   |                 | Surrogate key                |
| review_form_id | varchar(40)  | Y   | review_forms.id | Parent ReviewForm            |
| self           | varchar(120) |     |                 | .evidence[] file names       |

Indexes: (review_form_id)

#### review_form_goals (child)

Child of review_forms — review_form_goals (goals[]: title, target, achieved, self_rating, manager_rating, weight)  
**Entity:** ReviewFormGoals · **Primary key:** —

Source: `src/lib/performance-config.ts → type ReviewForm, store seereon.performance.reviews`

| Column         | Type         | Req | FK              | Description / allowed values |
| -------------- | ------------ | --- | --------------- | ---------------------------- |
| id             | bigserial    | Y   |                 | Surrogate key                |
| review_form_id | varchar(40)  | Y   | review_forms.id | Parent ReviewForm            |
| title          | varchar(120) |     |                 |                              |
| target         | varchar(120) |     |                 |                              |
| achieved       | varchar(120) |     |                 |                              |
| self_rating    | varchar(120) |     |                 |                              |
| manager_rating | varchar(120) |     |                 |                              |
| weight         | varchar(120) |     |                 |                              |

Indexes: (review_form_id)

#### review_form_ratings (child)

Child of review_forms — review_form_ratings (ratings[]: param_id → evaluation_parameters, self, manager, hr numeric(3,2), self_note, manager_note)  
**Entity:** ReviewFormRatings · **Primary key:** —

Source: `src/lib/performance-config.ts → type ReviewForm, store seereon.performance.reviews`

| Column         | Type          | Req | FK                       | Description / allowed values |
| -------------- | ------------- | --- | ------------------------ | ---------------------------- |
| id             | bigserial     | Y   |                          | Surrogate key                |
| review_form_id | varchar(40)   | Y   | review_forms.id          | Parent ReviewForm            |
| param_id       | varchar(120)  |     | evaluation_parameters.id | → evaluation_parameters      |
| self           | varchar(120)  |     |                          |                              |
| manager        | varchar(120)  |     |                          |                              |
| hr             | numeric(14,2) |     |                          | numeric(3,2)                 |
| self_note      | varchar(120)  |     |                          |                              |
| manager_note   | varchar(120)  |     |                          |                              |

Indexes: (review_form_id)

#### review_forms

Detailed quarterly (goal) review / annual appraisal form: self-appraisal with evidence → manager rating → HR calibration.  
**Entity:** ReviewForm · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/performance-config.ts → type ReviewForm, store seereon.performance.reviews`

| Column                 | Type         | Req | FK               | Description / allowed values                                                   |
| ---------------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------------------ |
| id                     | uuid         | Y   |                  | Surrogate primary key; business id kept in code                                |
| code                   | varchar(40)  | Y   |                  | RV-2026-Q1-0006                                                                |
| org_id                 | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)             |
| employee_id            | varchar(20)  | Y   | employees.id     | Employee                                                                       |
| employee_name          | varchar(120) | Y   |                  |                                                                                |
| kind                   | varchar(20)  | Y   |                  | Allowed: Quarterly review \| Annual appraisal                                  |
| cycle_label            | varchar(60)  | Y   |                  |                                                                                |
| period_code            | varchar(12)  | Y   |                  | 2026-Q2 / FY27                                                                 |
| status                 | varchar(20)  | Y   |                  | Allowed: Open \| Self submitted \| Manager reviewed \| HR calibrated \| Closed |
| self_achievements      | text         |     |                  |                                                                                |
| self_value_created     | text         |     |                  |                                                                                |
| self_justification     | text         |     |                  |                                                                                |
| self_development       | text         |     |                  |                                                                                |
| self_submitted_on      | date         |     |                  |                                                                                |
| manager_comments       | text         |     |                  |                                                                                |
| manager_recommendation | varchar(10)  |     |                  | Allowed: Exceeds \| Meets \| Below                                             |
| manager_hike_pct       | numeric(5,2) |     |                  |                                                                                |
| manager_promotion      | boolean      | Y   |                  |                                                                                |
| manager_reviewed_on    | date         |     |                  |                                                                                |
| manager_reviewed_by    | varchar(120) |     |                  |                                                                                |
| hr_calibrated_rating   | numeric(3,2) |     |                  | 1–5                                                                            |
| hr_final_hike_pct      | numeric(5,2) |     |                  |                                                                                |
| hr_comments            | text         |     |                  |                                                                                |
| hr_closed_on           | date         |     |                  |                                                                                |
| hr_closed_by           | varchar(120) |     |                  |                                                                                |

Indexes: (org_id, employee_id, kind, period_code) unique

#### self_appraisal_approvals (child)

Child of self_appraisals — self_appraisal_approvals (approvals[]: step Manager|HR|Unit Head, by, on, decision Approved|Sent back|Rejected, rating, comments, recommended_hike_pct, recommended_grade)  
**Entity:** SelfAppraisalApprovals · **Primary key:** —

Source: `src/lib/self-appraisal.ts → type SelfAppraisal, store seereon.appraisal.self`

| Column               | Type         | Req | FK                 | Description / allowed values                                         |
| -------------------- | ------------ | --- | ------------------ | -------------------------------------------------------------------- |
| id                   | bigserial    | Y   |                    | Surrogate key                                                        |
| self_appraisal_id    | varchar(40)  | Y   | self_appraisals.id | Parent SelfAppraisal                                                 |
| step                 | varchar(120) |     |                    | Manager\|HR\|Unit Head Allowed: Manager\|HR\|Unit Head               |
| by                   | varchar(120) |     |                    |                                                                      |
| on                   | date         |     |                    |                                                                      |
| decision             | varchar(120) |     |                    | Approved\|Sent back\|Rejected Allowed: Approved\|Sent back\|Rejected |
| rating               | varchar(120) |     |                    |                                                                      |
| comments             | varchar(120) |     |                    |                                                                      |
| recommended_hike_pct | varchar(120) |     |                    |                                                                      |
| recommended_grade    | varchar(120) |     |                    |                                                                      |

Indexes: (self_appraisal_id)

#### self_appraisal_attachments (child)

Child of self_appraisals — self_appraisal_attachments  
**Entity:** SelfAppraisalAttachments · **Primary key:** —

Source: `src/lib/self-appraisal.ts → type SelfAppraisal, store seereon.appraisal.self`

| Column            | Type        | Req | FK                 | Description / allowed values |
| ----------------- | ----------- | --- | ------------------ | ---------------------------- |
| id                | bigserial   | Y   |                    | Surrogate key                |
| self_appraisal_id | varchar(40) | Y   | self_appraisals.id | Parent SelfAppraisal         |
| value             | text        | Y   |                    | Item value (array element)   |

Indexes: (self_appraisal_id)

#### self_appraisal_goals (child)

Child of self_appraisals — self_appraisal_goals (goals[]: goal_id → goals.code, title, status, progress, achievement, self_rating)  
**Entity:** SelfAppraisalGoals · **Primary key:** —

Source: `src/lib/self-appraisal.ts → type SelfAppraisal, store seereon.appraisal.self`

| Column            | Type         | Req | FK                 | Description / allowed values |
| ----------------- | ------------ | --- | ------------------ | ---------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                |
| self_appraisal_id | varchar(40)  | Y   | self_appraisals.id | Parent SelfAppraisal         |
| goal_id           | varchar(120) |     | goals.code         | → goals.code                 |
| title             | varchar(120) |     |                    |                              |
| status            | varchar(120) |     |                    |                              |
| progress          | varchar(120) |     |                    |                              |
| achievement       | varchar(120) |     |                    |                              |
| self_rating       | varchar(120) |     |                    |                              |

Indexes: (self_appraisal_id)

#### self_appraisal_history (child)

Child of self_appraisals — self_appraisal_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** SelfAppraisalHistory · **Primary key:** —

Source: `src/lib/self-appraisal.ts → type SelfAppraisal, store seereon.appraisal.self`

| Column            | Type         | Req | FK                 | Description / allowed values |
| ----------------- | ------------ | --- | ------------------ | ---------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                |
| self_appraisal_id | varchar(40)  | Y   | self_appraisals.id | Parent SelfAppraisal         |
| at                | date         |     |                    | date                         |
| by                | varchar(120) |     |                    | varchar(120)                 |
| action            | text         |     |                    | text                         |

Indexes: (self_appraisal_id)

#### self_appraisal_ratings (child)

Child of self_appraisals — self_appraisal_ratings (ratings[]: param_id → evaluation_parameters, name, self 1–5, note)  
**Entity:** SelfAppraisalRatings · **Primary key:** —

Source: `src/lib/self-appraisal.ts → type SelfAppraisal, store seereon.appraisal.self`

| Column            | Type         | Req | FK                       | Description / allowed values |
| ----------------- | ------------ | --- | ------------------------ | ---------------------------- |
| id                | bigserial    | Y   |                          | Surrogate key                |
| self_appraisal_id | varchar(40)  | Y   | self_appraisals.id       | Parent SelfAppraisal         |
| param_id          | varchar(120) |     | evaluation_parameters.id | → evaluation_parameters      |
| name              | varchar(120) |     |                          |                              |
| self              | varchar(120) |     |                          | 1–5                          |
| note              | text         |     |                          |                              |

Indexes: (self_appraisal_id)

#### self_appraisals

Employee-raised appraisal: purpose, supported goals, quarter/timeline, self-ratings, value proposition → Manager → HR → Unit Head → HR applies pay grade and issues the letter.  
**Entity:** SelfAppraisal · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/self-appraisal.ts → type SelfAppraisal, store seereon.appraisal.self`

| Column                  | Type          | Req | FK               | Description / allowed values                                                                                                                                                    |
| ----------------------- | ------------- | --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | uuid          | Y   |                  | Surrogate primary key; business id kept in code                                                                                                                                 |
| code                    | varchar(20)   | Y   |                  | SA-2026-001                                                                                                                                                                     |
| org_id                  | varchar(20)   | Y   | organizations.id | Owning entity (derived from the employee's directory record today)                                                                                                              |
| employee_id             | varchar(20)   | Y   | employees.id     | Employee                                                                                                                                                                        |
| employee_name           | varchar(120)  | Y   |                  |                                                                                                                                                                                 |
| designation             | varchar(120)  | Y   |                  |                                                                                                                                                                                 |
| department              | varchar(80)   | Y   |                  |                                                                                                                                                                                 |
| manager_id              | varchar(20)   |     | users.id         | Reporting manager                                                                                                                                                               |
| manager_name            | varchar(120)  | Y   |                  |                                                                                                                                                                                 |
| purpose                 | varchar(40)   | Y   |                  | Allowed: Annual appraisal (increment) \| Promotion / grade change \| Mid-year increment \| Role change with revised pay \| Confirmation after probation \| Retention correction |
| quarter                 | varchar(40)   | Y   |                  |                                                                                                                                                                                 |
| timeline_from           | date          | Y   |                  |                                                                                                                                                                                 |
| timeline_to             | date          | Y   |                  |                                                                                                                                                                                 |
| achievements            | text          |     |                  |                                                                                                                                                                                 |
| value_created           | text          |     |                  |                                                                                                                                                                                 |
| justification           | text          | Y   |                  | Required to submit                                                                                                                                                              |
| asked_for               | varchar(120)  |     |                  |                                                                                                                                                                                 |
| expected_grade          | varchar(10)   |     |                  |                                                                                                                                                                                 |
| expected_hike_pct       | numeric(5,2)  |     |                  | ≥ 0                                                                                                                                                                             |
| stage                   | varchar(20)   | Y   |                  | Allowed: Draft \| Manager Review \| HR Review \| Unit Head Review \| Approved \| Applied \| Sent back \| Rejected                                                               |
| submitted_on            | date          |     |                  |                                                                                                                                                                                 |
| outcome_previous_grade  | varchar(10)   |     |                  |                                                                                                                                                                                 |
| outcome_new_grade       | varchar(10)   |     |                  |                                                                                                                                                                                 |
| outcome_previous_ctc    | numeric(14,2) |     |                  |                                                                                                                                                                                 |
| outcome_new_ctc         | numeric(14,2) |     |                  |                                                                                                                                                                                 |
| outcome_hike_pct        | numeric(6,2)  |     |                  |                                                                                                                                                                                 |
| outcome_effective_from  | date          |     |                  |                                                                                                                                                                                 |
| outcome_letter_type     | varchar(30)   |     |                  |                                                                                                                                                                                 |
| outcome_letter_ref      | varchar(30)   |     |                  |                                                                                                                                                                                 |
| outcome_applied_on      | date          |     |                  |                                                                                                                                                                                 |
| outcome_applied_by      | varchar(120)  |     |                  |                                                                                                                                                                                 |
| outcome_remarks         | text          |     |                  |                                                                                                                                                                                 |
| outcome_new_designation | varchar(120)  |     |                  |                                                                                                                                                                                 |

Indexes: (employee_id) where stage not in (Applied, Rejected) — one live appraisal

#### team_review_ack (child)

Child of team_reviews — team_review_ack (on, comment)  
**Entity:** TeamReviewAck · **Primary key:** —

Source: `src/lib/manager-data.ts → TeamReview, seereon.team.reviews.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| team_review_id | varchar(40) | Y   | team_reviews.id | Parent TeamReview            |
| on             | date        |     |                 |                              |
| comment        | text        |     |                 |                              |

Indexes: (team_review_id)

#### team_review_attachments (child)

Child of team_reviews — team_review_attachments  
**Entity:** TeamReviewAttachments · **Primary key:** —

Source: `src/lib/manager-data.ts → TeamReview, seereon.team.reviews.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| team_review_id | varchar(40) | Y   | team_reviews.id | Parent TeamReview            |
| value          | text        | Y   |                 | Item value (array element)   |

Indexes: (team_review_id)

#### team_review_goals (child)

Child of team_reviews — team_review_goals  
**Entity:** TeamReviewGoals · **Primary key:** —

Source: `src/lib/manager-data.ts → TeamReview, seereon.team.reviews.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| team_review_id | varchar(40) | Y   | team_reviews.id | Parent TeamReview            |
| value          | text        | Y   |                 | Item value (array element)   |

Indexes: (team_review_id)

#### team_review_params (child)

Child of team_reviews — team_review_params  
**Entity:** TeamReviewParams · **Primary key:** —

Source: `src/lib/manager-data.ts → TeamReview, seereon.team.reviews.v2`

| Column         | Type        | Req | FK              | Description / allowed values |
| -------------- | ----------- | --- | --------------- | ---------------------------- |
| id             | bigserial   | Y   |                 | Surrogate key                |
| team_review_id | varchar(40) | Y   | team_reviews.id | Parent TeamReview            |
| value          | text        | Y   |                 | Item value (array element)   |

Indexes: (team_review_id)

#### team_reviews

Manager-run review (goals, parameters, recommendation, employee acknowledgement).  
**Entity:** TeamReview · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/manager-data.ts → TeamReview, seereon.team.reviews.v2`

| Column               | Type         | Req | FK           | Description / allowed values                   |
| -------------------- | ------------ | --- | ------------ | ---------------------------------------------- |
| id                   | varchar(10)  | Y   |              |                                                |
| emp_id               | varchar(20)  | Y   | employees.id |                                                |
| manager_id           | varchar(20)  | Y   | employees.id |                                                |
| cycle                | varchar(40)  | Y   |              |                                                |
| date                 | date         | Y   |              |                                                |
| rating               | varchar(20)  | Y   |              |                                                |
| status               | varchar(12)  | Y   |              | Allowed: Scheduled \| In Progress \| Completed |
| overall_score        | numeric(3,2) |     |              |                                                |
| recommendation       | varchar(30)  |     |              |                                                |
| feedback             | text         |     |              |                                                |
| shared_with_employee | boolean      |     |              |                                                |

#### trainers

Trainer directory and training type masters (CrudSection).  
**Entity:** Trainer · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/training-data.ts → TRAINERS, TRAINING_TYPES`

| Column        | Type         | Req | FK               | Description / allowed values                                       |
| ------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------ |
| id            | uuid         | Y   |                  | Surrogate primary key; business id kept in code                    |
| code          | varchar(20)  | Y   |                  | TRN-001 / TTP-001                                                  |
| org_id        | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today) |
| name          | varchar(120) | Y   |                  |                                                                    |
| contact_phone | varchar(20)  |     |                  | trainers only                                                      |
| email         | varchar(160) |     |                  | trainers only; email format                                        |
| branch        | varchar(80)  | Y   |                  |                                                                    |
| department    | varchar(80)  | Y   |                  |                                                                    |
| experience    | varchar(30)  |     |                  |                                                                    |
| description   | text         |     |                  |                                                                    |

#### training_assignment_modules (child)

Child of training_assignments — training_assignment_modules (modules[]: code M1…, title, kind Video|Document|Quiz|Assignment, duration, url, done)  
**Entity:** TrainingAssignmentModules · **Primary key:** —

Source: `src/lib/training-assign.ts → type TrainingAssignment, store seereon.training.assignments.v2`

| Column                 | Type         | Req | FK                      | Description / allowed values                                                 |
| ---------------------- | ------------ | --- | ----------------------- | ---------------------------------------------------------------------------- |
| id                     | bigserial    | Y   |                         | Surrogate key                                                                |
| training_assignment_id | varchar(40)  | Y   | training_assignments.id | Parent TrainingAssignment                                                    |
| code                   | varchar(120) |     |                         | M1…                                                                          |
| title                  | varchar(120) |     |                         |                                                                              |
| kind                   | varchar(120) |     |                         | Video\|Document\|Quiz\|Assignment Allowed: Video\|Document\|Quiz\|Assignment |
| duration               | varchar(120) |     |                         |                                                                              |
| url                    | varchar(120) |     |                         |                                                                              |
| done                   | boolean      |     |                         |                                                                              |

Indexes: (training_assignment_id)

#### training_assignments

A programme assigned to one employee: modules, progress, submission, parameter review, certificate and linked goal.  
**Entity:** TrainingAssignment · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/training-assign.ts → type TrainingAssignment, store seereon.training.assignments.v2`

| Column           | Type         | Req | FK                       | Description / allowed values                                                                |
| ---------------- | ------------ | --- | ------------------------ | ------------------------------------------------------------------------------------------- |
| id               | uuid         | Y   |                          | Surrogate primary key; business id kept in code                                             |
| code             | varchar(20)  | Y   |                          | TA-001                                                                                      |
| org_id           | varchar(20)  | Y   | organizations.id         | Owning entity (derived from the employee's directory record today)                          |
| programme_id     | varchar(20)  | Y   | training_programmes.code |                                                                                             |
| programme_title  | varchar(200) | Y   |                          |                                                                                             |
| employee_id      | varchar(20)  | Y   | employees.id             | Employee                                                                                    |
| employee_name    | varchar(120) | Y   |                          |                                                                                             |
| assigned_by_name | varchar(120) | Y   |                          |                                                                                             |
| assigned_on      | date         | Y   |                          |                                                                                             |
| due_date         | date         | Y   |                          | ≥ start_date                                                                                |
| is_mandatory     | boolean      | Y   |                          |                                                                                             |
| status           | varchar(15)  | Y   |                          | Allowed: Not Started \| In Progress \| Submitted \| Under Review \| Completed \| Reassigned |
| progress_pct     | numeric(5,2) | Y   |                          |                                                                                             |
| score_pct        | varchar(6)   |     |                          |                                                                                             |
| evaluation       | text         |     |                          |                                                                                             |
| submission_file  | varchar(200) |     |                          |                                                                                             |
| purpose          | varchar(60)  |     |                          |                                                                                             |
| start_date       | date         |     |                          |                                                                                             |
| end_date         | date         |     |                          |                                                                                             |
| include_in_goals | boolean      |     |                          |                                                                                             |
| goal_id          | varchar(20)  |     | goals.code               |                                                                                             |
| certificate_ref  | varchar(20)  |     |                          | CERT-2026-0002                                                                              |
| certified_on     | date         |     |                          |                                                                                             |

Indexes: (employee_id, programme_id) where status <> 'Completed' unique

#### training_programme_links (child)

Child of training_programmes — training_programme_links (links[]: label, url https)  
**Entity:** TrainingProgrammeLinks · **Primary key:** —

Source: `src/lib/training-assign.ts → type TrainingProgramme, store seereon.training.catalog.v1`

| Column                | Type         | Req | FK                     | Description / allowed values |
| --------------------- | ------------ | --- | ---------------------- | ---------------------------- |
| id                    | bigserial    | Y   |                        | Surrogate key                |
| training_programme_id | varchar(40)  | Y   | training_programmes.id | Parent TrainingProgramme     |
| label                 | varchar(120) |     |                        |                              |
| url                   | varchar(120) |     |                        | https                        |

Indexes: (training_programme_id)

#### training_programme_materials (child)

Child of training_programmes — training_programme_materials (materials[] file names)  
**Entity:** TrainingProgrammeMaterials · **Primary key:** —

Source: `src/lib/training-assign.ts → type TrainingProgramme, store seereon.training.catalog.v1`

| Column                | Type         | Req | FK                     | Description / allowed values |
| --------------------- | ------------ | --- | ---------------------- | ---------------------------- |
| id                    | bigserial    | Y   |                        | Surrogate key                |
| training_programme_id | varchar(40)  | Y   | training_programmes.id | Parent TrainingProgramme     |
| materials             | varchar(120) |     |                        | [] file names                |

Indexes: (training_programme_id)

#### training_programme_skills (child)

Child of training_programmes — training_programme_skills (skills[])  
**Entity:** TrainingProgrammeSkills · **Primary key:** —

Source: `src/lib/training-assign.ts → type TrainingProgramme, store seereon.training.catalog.v1`

| Column                | Type         | Req | FK                     | Description / allowed values |
| --------------------- | ------------ | --- | ---------------------- | ---------------------------- |
| id                    | bigserial    | Y   |                        | Surrogate key                |
| training_programme_id | varchar(40)  | Y   | training_programmes.id | Parent TrainingProgramme     |
| skills                | varchar(120) |     |                        | []                           |

Indexes: (training_programme_id)

#### training_programmes

Training catalogue programme (Master: Trainings, or added while assigning).  
**Entity:** TrainingProgramme · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/training-assign.ts → type TrainingProgramme, store seereon.training.catalog.v1`

| Column           | Type         | Req | FK                  | Description / allowed values                                                        |
| ---------------- | ------------ | --- | ------------------- | ----------------------------------------------------------------------------------- |
| id               | uuid         | Y   |                     | Surrogate primary key; business id kept in code                                     |
| code             | varchar(20)  | Y   |                     | TRG-001                                                                             |
| org_id           | varchar(20)  | Y   | organizations.id    | Owning entity (derived from the employee's directory record today)                  |
| title            | varchar(200) | Y   |                     |                                                                                     |
| training_type    | varchar(60)  | Y   | training_types.name |                                                                                     |
| description      | text         |     |                     |                                                                                     |
| purpose          | varchar(60)  | Y   |                     |                                                                                     |
| trainer_name     | varchar(120) | Y   | trainers.name       |                                                                                     |
| mode             | varchar(25)  | Y   |                     | Allowed: Online (self-paced) \| Online (live) \| Classroom \| Blended \| On-the-job |
| start_date       | date         | Y   |                     |                                                                                     |
| end_date         | date         | Y   |                     | ≥ start                                                                             |
| deadline         | date         | Y   |                     |                                                                                     |
| duration_hours   | numeric(6,2) | Y   |                     | > 0                                                                                 |
| is_mandatory     | boolean      | Y   |                     |                                                                                     |
| include_in_goals | boolean      | Y   |                     |                                                                                     |
| branch           | varchar(80)  | Y   |                     |                                                                                     |
| location         | varchar(120) | Y   |                     |                                                                                     |
| status           | varchar(10)  | Y   |                     | Allowed: Planned \| Ongoing \| Completed \| Cancelled                               |
| created_by       | varchar(120) | Y   |                     |                                                                                     |
| created_on       | date         | Y   |                     |                                                                                     |

Indexes: (org_id, code) unique

#### training_resources

Getting-started resource library (videos, docs, SOPs, FAQs, guides).  
**Entity:** TrainingResource · **Primary key:** id

Source: `src/lib/training-assign.ts → type Resource, in-memory resourceStore`

| Column      | Type         | Req | FK  | Description / allowed values                                            |
| ----------- | ------------ | --- | --- | ----------------------------------------------------------------------- |
| id          | uuid         | Y   |     | Surrogate primary key; business id kept in code                         |
| code        | varchar(20)  | Y   |     | RES-001                                                                 |
| title       | varchar(200) | Y   |     |                                                                         |
| category    | varchar(20)  | Y   |     | Allowed: Product Videos \| Documentation \| SOPs \| FAQs \| User Guides |
| description | text         |     |     |                                                                         |
| format      | varchar(10)  | Y   |     |                                                                         |
| duration    | varchar(20)  |     |     |                                                                         |
| audience    | varchar(60)  |     |     |                                                                         |
| url         | varchar(500) | Y   |     | '#' = not configured                                                    |

#### training_review_attachments (child)

Child of training_assignments — training_review_attachments  
**Entity:** TrainingReviewAttachments · **Primary key:** —

Source: `src/lib/training-assign.ts → type TrainingAssignment, store seereon.training.assignments.v2`

| Column                 | Type        | Req | FK                      | Description / allowed values |
| ---------------------- | ----------- | --- | ----------------------- | ---------------------------- |
| id                     | bigserial   | Y   |                         | Surrogate key                |
| training_assignment_id | varchar(40) | Y   | training_assignments.id | Parent TrainingAssignment    |
| value                  | text        | Y   |                         | Item value (array element)   |

Indexes: (training_assignment_id)

#### training_reviews (child)

Child of training_assignments — training_reviews (review: reviewed_by, reviewed_on, progress_pct, outcome Objectives met|Partially met|Not met, bottlenecks, learnings, application_plan, rating_skills/efficiency/knowledge/participation/application small  
**Entity:** TrainingReviews · **Primary key:** —

Source: `src/lib/training-assign.ts → type TrainingAssignment, store seereon.training.assignments.v2`

| Column                 | Type          | Req | FK                      | Description / allowed values                                                                                         |
| ---------------------- | ------------- | --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| id                     | bigserial     | Y   |                         | Surrogate key                                                                                                        |
| training_assignment_id | varchar(40)   | Y   | training_assignments.id | Parent TrainingAssignment                                                                                            |
| review                 | varchar(120)  |     |                         | reviewed_by                                                                                                          |
| reviewed_on            | varchar(120)  |     |                         |                                                                                                                      |
| progress_pct           | varchar(120)  |     |                         |                                                                                                                      |
| outcome                | varchar(120)  |     |                         | Objectives met\|Partially met\|Not met Allowed: Objectives met\|Partially met\|Not met                               |
| bottlenecks            | varchar(120)  |     |                         |                                                                                                                      |
| learnings              | varchar(120)  |     |                         |                                                                                                                      |
| application_plan       | varchar(120)  |     |                         |                                                                                                                      |
| rating_skills          | smallint      |     |                         | /efficiency/knowledge/participation/application smallint 1–5                                                         |
| overall                | numeric(14,2) |     |                         | numeric(3,1)                                                                                                         |
| recommendation         | varchar(120)  |     |                         | Certify\|Extend deadline\|Reassign\|Advanced training Allowed: Certify\|Extend deadline\|Reassign\|Advanced training |
| comments               | varchar(120)  |     |                         |                                                                                                                      |

Indexes: (training_assignment_id)

#### training_types

Trainer directory and training type masters (CrudSection).  
**Entity:** TrainingType · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/training-data.ts → TRAINERS, TRAINING_TYPES`

| Column      | Type         | Req | FK               | Description / allowed values                                       |
| ----------- | ------------ | --- | ---------------- | ------------------------------------------------------------------ |
| id          | uuid         | Y   |                  | Surrogate primary key; business id kept in code                    |
| code        | varchar(20)  | Y   |                  | TRN-001 / TTP-001                                                  |
| org_id      | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today) |
| name        | varchar(120) | Y   |                  |                                                                    |
| branch      | varchar(80)  | Y   |                  |                                                                    |
| department  | varchar(80)  | Y   |                  |                                                                    |
| experience  | varchar(30)  |     |                  |                                                                    |
| description | text         |     |                  |                                                                    |

### 9.9 Exit, Grievance & HR Policy

#### exit_clearance_areas

Clearance master: 7 areas with owner, default officer, hint and checklist.  
**Entity:** ClearanceArea · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/exit-data.ts → CLEARANCE_AREAS`

| Column               | Type         | Req | FK  | Description / allowed values                                                  |
| -------------------- | ------------ | --- | --- | ----------------------------------------------------------------------------- |
| id                   | bigserial    | Y   |     | Surrogate key (added — the prototype record has no single id)                 |
| code                 | varchar(12)  | Y   |     | Allowed: finance \| payroll \| documents \| projects \| assets \| it \| admin |
| label                | varchar(60)  | Y   |     |                                                                               |
| owner_function       | varchar(60)  | Y   |     |                                                                               |
| default_officer_name | varchar(120) |     |     | projects → reporting manager                                                  |
| hint                 | text         |     |     |                                                                               |

#### exit_clearance_checklist_items (child)

Child of exit_clearance_areas — exit_clearance_checklist_items (checklist[])  
**Entity:** ExitClearanceChecklistItems · **Primary key:** —

Source: `src/lib/exit-data.ts → CLEARANCE_AREAS`

| Column                 | Type         | Req | FK                      | Description / allowed values |
| ---------------------- | ------------ | --- | ----------------------- | ---------------------------- |
| id                     | bigserial    | Y   |                         | Surrogate key                |
| exit_clearance_area_id | varchar(40)  | Y   | exit_clearance_areas.id | Parent ClearanceArea         |
| checklist              | varchar(120) |     |                         | []                           |

Indexes: (exit_clearance_area_id)

#### exit_clearance_ticks (child)

Child of exit_requests — exit_clearance_ticks (ticked[] checklist items per area)  
**Entity:** ExitClearanceTicks · **Primary key:** —

Source: `src/lib/exit-data.ts → type ExitRequest, localStorage seereon.exit.requests.v3`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key                |
| exit_request_id | varchar(40)  | Y   | exit_requests.id | Parent ExitRequest           |
| ticked          | varchar(120) |     |                  | [] checklist items per area  |

Indexes: (exit_request_id)

#### exit_clearances (child)

Child of exit_requests — exit_clearances (clearances{finance,payroll,documents,projects,assets,it,admin}: area enum, status Pending|Cleared|Blocked, officer_name, note, by, on, amount numeric(14,2) finance only ≥ 0)  
**Entity:** ExitClearances · **Primary key:** —

Source: `src/lib/exit-data.ts → type ExitRequest, localStorage seereon.exit.requests.v3`

| Column          | Type          | Req | FK               | Description / allowed values                                                     |
| --------------- | ------------- | --- | ---------------- | -------------------------------------------------------------------------------- |
| id              | bigserial     | Y   |                  | Surrogate key                                                                    |
| exit_request_id | varchar(40)   | Y   | exit_requests.id | Parent ExitRequest                                                               |
| area            | varchar(20)   | Y   |                  | Clearance area Allowed: finance\|payroll\|documents\|projects\|assets\|it\|admin |
| status          | varchar(20)   | Y   |                  | Clearance status Allowed: Pending\|Cleared\|Blocked                              |
| officer_name    | varchar(120)  |     |                  | Officer who cleared the area                                                     |
| cleared_on      | date          |     |                  |                                                                                  |
| amount          | numeric(14,2) |     |                  | Recoverable amount flagged by the area (e.g. unreturned asset)                   |
| note            | text          |     |                  |                                                                                  |

Indexes: (exit_request_id, area) unique

#### exit_requests

Resignation / termination exit file: manager & HR decisions, notice period, officer-wise clearance checklist, F&F, exit interview, completion.  
**Entity:** ExitRequest · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/exit-data.ts → type ExitRequest, localStorage seereon.exit.requests.v3`

| Column                 | Type         | Req | FK               | Description / allowed values                                                                                                                                                      |
| ---------------------- | ------------ | --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                     | uuid         | Y   |                  | Surrogate primary key; business id kept in code                                                                                                                                   |
| code                   | varchar(20)  | Y   |                  | EXT-1001                                                                                                                                                                          |
| org_id                 | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)                                                                                                                |
| employee_id            | varchar(20)  | Y   | employees.id     | Employee                                                                                                                                                                          |
| employee_name          | varchar(120) | Y   |                  |                                                                                                                                                                                   |
| email                  | varchar(160) | Y   |                  |                                                                                                                                                                                   |
| designation            | varchar(120) | Y   |                  |                                                                                                                                                                                   |
| department             | varchar(80)  | Y   |                  |                                                                                                                                                                                   |
| branch                 | varchar(80)  | Y   |                  |                                                                                                                                                                                   |
| manager_id             | varchar(20)  | Y   | users.id         | Reporting manager                                                                                                                                                                 |
| manager_name           | varchar(120) | Y   |                  |                                                                                                                                                                                   |
| applied_on             | date         | Y   |                  |                                                                                                                                                                                   |
| reason                 | varchar(60)  | Y   |                  | Allowed: Better career opportunity \| Higher studies \| Relocation \| Compensation \| Work-life balance \| Health reasons \| Personal reasons \| Career change \| Termination — … |
| description            | text         | Y   |                  | > 10 chars                                                                                                                                                                        |
| requested_lwd          | date         | Y   |                  | ≥ applied_on                                                                                                                                                                      |
| resignation_letter     | varchar(200) |     |                  |                                                                                                                                                                                   |
| stage                  | varchar(20)  | Y   |                  | Allowed: Manager Review \| Manager Rejected \| HR Review \| HR Rejected \| Notice Period \| HR Clearance \| Final Settlement \| Exit Completed \| Retained \| Withdrawn           |
| manager_decision       | varchar(10)  |     |                  | Allowed: Approved \| Rejected                                                                                                                                                     |
| manager_decided_by     | varchar(120) |     |                  |                                                                                                                                                                                   |
| manager_decided_on     | date         |     |                  |                                                                                                                                                                                   |
| manager_note           | text         |     |                  |                                                                                                                                                                                   |
| hr_decision            | varchar(10)  |     |                  | Allowed: Approved \| Rejected                                                                                                                                                     |
| hr_decided_by          | varchar(120) |     |                  |                                                                                                                                                                                   |
| hr_decided_on          | date         |     |                  |                                                                                                                                                                                   |
| hr_note                | text         |     |                  |                                                                                                                                                                                   |
| clearance_started_on   | date         |     |                  |                                                                                                                                                                                   |
| clearance_completed_on | date         |     |                  |                                                                                                                                                                                   |
| notice_days            | smallint     |     |                  | > 0                                                                                                                                                                               |
| notice_start           | date         |     |                  |                                                                                                                                                                                   |
| last_working_day       | date         |     |                  |                                                                                                                                                                                   |
| exit_interview_done    | boolean      | Y   |                  |                                                                                                                                                                                   |
| exit_interview_mode    | varchar(20)  |     |                  | Allowed: Employee portal \| HR interview \| Uploaded form                                                                                                                         |
| exit_interview_on      | date         |     |                  |                                                                                                                                                                                   |
| exit_interview_by      | varchar(120) |     |                  |                                                                                                                                                                                   |
| exit_interview_file    | varchar(200) |     |                  |                                                                                                                                                                                   |
| exit_interview_note    | text         |     |                  |                                                                                                                                                                                   |
| fnf_settled            | boolean      | Y   |                  |                                                                                                                                                                                   |
| fnf_payment_ref        | varchar(60)  |     |                  |                                                                                                                                                                                   |
| retained_on            | date         |     |                  |                                                                                                                                                                                   |
| completed_on           | date         |     |                  |                                                                                                                                                                                   |

Indexes: (employee_id) where stage in ACTIVE_STAGES unique; (org_id, stage); (manager_id)

#### exit_surveys

Exit survey / interview responses (one per exit).  
**Entity:** ExitSurvey · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/separation-data.ts → type ExitSurvey, store seereon.exit.surveys`

| Column              | Type         | Req | FK                 | Description / allowed values                                       |
| ------------------- | ------------ | --- | ------------------ | ------------------------------------------------------------------ |
| id                  | uuid         | Y   |                    | Surrogate primary key; business id kept in code                    |
| code                | varchar(20)  | Y   |                    | XS-001                                                             |
| org_id              | varchar(20)  | Y   | organizations.id   | Owning entity (derived from the employee's directory record today) |
| exit_request_id     | varchar(20)  | Y   | exit_requests.code |                                                                    |
| employee_id         | varchar(20)  | Y   | employees.id       | Employee                                                           |
| employee_name       | varchar(120) | Y   |                    |                                                                    |
| department          | varchar(80)  | Y   |                    |                                                                    |
| submitted_on        | date         | Y   |                    |                                                                    |
| primary_reason      | varchar(120) | Y   |                    |                                                                    |
| rating_manager      | smallint     | Y   |                    | 1–5                                                                |
| rating_culture      | smallint     | Y   |                    | 1–5                                                                |
| rating_growth       | smallint     | Y   |                    | 1–5                                                                |
| rating_compensation | smallint     | Y   |                    | 1–5                                                                |
| rating_work_life    | smallint     | Y   |                    | 1–5                                                                |
| would_rejoin        | varchar(5)   | Y   |                    | Allowed: Yes \| Maybe \| No                                        |
| would_recommend     | varchar(5)   | Y   |                    | Allowed: Yes \| Maybe \| No                                        |
| feedback            | text         |     |                    |                                                                    |
| interviewer         | varchar(120) | Y   |                    | 'Self-service' or HR name                                          |
| interview_notes     | text         |     |                    |                                                                    |

Indexes: (exit_request_id) unique

#### exit_timeline (child)

Child of exit_requests — exit_timeline (timeline[]: stage, by, role, on, note)  
**Entity:** ExitTimeline · **Primary key:** —

Source: `src/lib/exit-data.ts → type ExitRequest, localStorage seereon.exit.requests.v3`

| Column          | Type         | Req | FK               | Description / allowed values |
| --------------- | ------------ | --- | ---------------- | ---------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key                |
| exit_request_id | varchar(40)  | Y   | exit_requests.id | Parent ExitRequest           |
| stage           | varchar(120) |     |                  |                              |
| by              | varchar(120) |     |                  |                              |
| role            | varchar(120) |     |                  |                              |
| on              | date         |     |                  |                              |
| note            | text         |     |                  |                              |

Indexes: (exit_request_id)

#### fnf_config

Exit / gratuity / F&F policy per entity.  
**Entity:** FnfConfig · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/separation-data.ts → type FnfConfig, store seereon.exit.fnf-config`

| Column                    | Type          | Req | FK               | Description / allowed values                                       |
| ------------------------- | ------------- | --- | ---------------- | ------------------------------------------------------------------ |
| id                        | uuid          | Y   |                  | Surrogate primary key; business id kept in code                    |
| org_id                    | varchar(20)   | Y   | organizations.id | Owning entity (derived from the employee's directory record today) |
| gratuity_days_per_year    | numeric(5,2)  | Y   |                  | ≥ 0                                                                |
| gratuity_min_years        | numeric(4,1)  | Y   |                  |                                                                    |
| gratuity_round_up_months  | smallint      | Y   |                  | 0–11                                                               |
| gratuity_cap              | numeric(14,2) | Y   |                  |                                                                    |
| notice_recovery           | varchar(10)   | Y   |                  | Allowed: Optional \| Always \| Never                               |
| notice_recovery_basis     | varchar(5)    | Y   |                  | Allowed: Gross \| Basic                                            |
| leave_encashment_basis    | varchar(5)    | Y   |                  | Allowed: Gross \| Basic                                            |
| leave_overdraw_recovery   | boolean       | Y   |                  |                                                                    |
| loan_recovery_from_fnf    | boolean       | Y   |                  |                                                                    |
| settlement_days_after_lwd | smallint      | Y   |                  |                                                                    |
| rejoin_continuity_days    | smallint      | Y   |                  |                                                                    |
| exit_survey_mandatory     | boolean       | Y   |                  |                                                                    |
| retention_owner_roles     | varchar(20)[] | Y   |                  | Roles allowed to Retain                                            |
| updated_by                | varchar(120)  | Y   |                  |                                                                    |
| updated_on                | date          | Y   |                  |                                                                    |

Indexes: (org_id) unique

#### fnf_history (child)

Child of fnf_statements — fnf_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** FnfHistory · **Primary key:** —

Source: `src/lib/separation-data.ts → type FnfStatement, store seereon.exit.fnf`

| Column           | Type         | Req | FK                | Description / allowed values |
| ---------------- | ------------ | --- | ----------------- | ---------------------------- |
| id               | bigserial    | Y   |                   | Surrogate key                |
| fnf_statement_id | varchar(40)  | Y   | fnf_statements.id | Parent FnfStatement          |
| at               | date         |     |                   | date                         |
| by               | varchar(120) |     |                   | varchar(120)                 |
| action           | text         |     |                   | text                         |

Indexes: (fnf_statement_id)

#### fnf_lines (child)

Child of fnf_statements — fnf_lines (lines[]: label, amount numeric(14,2), kind earning|deduction, note, optional, enabled)  
**Entity:** FnfLines · **Primary key:** —

Source: `src/lib/separation-data.ts → type FnfStatement, store seereon.exit.fnf`

| Column           | Type          | Req | FK                | Description / allowed values |
| ---------------- | ------------- | --- | ----------------- | ---------------------------- |
| id               | bigserial     | Y   |                   | Surrogate key                |
| fnf_statement_id | varchar(40)   | Y   | fnf_statements.id | Parent FnfStatement          |
| label            | varchar(120)  |     |                   |                              |
| amount           | numeric(14,2) |     |                   | numeric(14,2)                |
| kind             | varchar(120)  |     |                   | earning\|deduction           |
| note             | text          |     |                   |                              |
| optional         | varchar(120)  |     |                   |                              |
| enabled          | varchar(120)  |     |                   |                              |

Indexes: (fnf_statement_id)

#### fnf_statements

Full & final settlement statement computed from the exit date.  
**Entity:** FnfStatement · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/separation-data.ts → type FnfStatement, store seereon.exit.fnf`

| Column             | Type          | Req | FK                 | Description / allowed values                                                             |
| ------------------ | ------------- | --- | ------------------ | ---------------------------------------------------------------------------------------- |
| id                 | uuid          | Y   |                    | Surrogate primary key; business id kept in code                                          |
| code               | varchar(20)   | Y   |                    | FNF-1003                                                                                 |
| org_id             | varchar(20)   | Y   | organizations.id   | Owning entity (derived from the employee's directory record today)                       |
| exit_request_id    | varchar(20)   | Y   | exit_requests.code |                                                                                          |
| employee_id        | varchar(20)   | Y   | employees.id       | Employee                                                                                 |
| employee_name      | varchar(120)  | Y   |                    |                                                                                          |
| last_working_day   | date          | Y   |                    |                                                                                          |
| exit_date          | date          | Y   |                    |                                                                                          |
| notice_days        | smallint      | Y   |                    |                                                                                          |
| notice_served_days | smallint      | Y   |                    |                                                                                          |
| final_period       | char(7)       | Y   |                    | YYYY-MM                                                                                  |
| gross              | numeric(14,2) | Y   |                    |                                                                                          |
| deductions         | numeric(14,2) | Y   |                    |                                                                                          |
| net_payable        | numeric(14,2) | Y   |                    |                                                                                          |
| gratuity           | jsonb         | Y   |                    | Computed snapshot {start, basic, tenureYears, completedYears, eligible, amount, formula} |
| status             | varchar(20)   | Y   |                    | Allowed: Draft \| HR reviewed \| Finance approved \| Paid                                |
| prepared_by        | varchar(120)  | Y   |                    |                                                                                          |
| prepared_on        | date          | Y   |                    |                                                                                          |
| approved_by        | varchar(120)  |     |                    |                                                                                          |
| paid_on            | date          |     |                    |                                                                                          |
| payment_ref        | varchar(60)   |     |                    |                                                                                          |

Indexes: (exit_request_id) unique

#### grievance_attachments (child)

Child of grievances — grievance_attachments  
**Entity:** GrievanceAttachments · **Primary key:** —

Source: `src/lib/grievance-data.ts → type Grievance, store seereon.grievances`

| Column       | Type        | Req | FK            | Description / allowed values |
| ------------ | ----------- | --- | ------------- | ---------------------------- |
| id           | bigserial   | Y   |               | Surrogate key                |
| grievance_id | varchar(40) | Y   | grievances.id | Parent Grievance             |
| value        | text        | Y   |               | Item value (array element)   |

Indexes: (grievance_id)

#### grievance_history (child)

Child of grievances — grievance_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** GrievanceHistory · **Primary key:** —

Source: `src/lib/grievance-data.ts → type Grievance, store seereon.grievances`

| Column       | Type         | Req | FK            | Description / allowed values |
| ------------ | ------------ | --- | ------------- | ---------------------------- |
| id           | bigserial    | Y   |               | Surrogate key                |
| grievance_id | varchar(40)  | Y   | grievances.id | Parent Grievance             |
| at           | date         |     |               | date                         |
| by           | varchar(120) |     |               | varchar(120)                 |
| action       | text         |     |               | text                         |

Indexes: (grievance_id)

#### grievance_investigation_notes (child)

Child of grievances — grievance_investigation_notes (investigation[]: at, by, note, visible_to_employee)  
**Entity:** GrievanceInvestigationNotes · **Primary key:** —

Source: `src/lib/grievance-data.ts → type Grievance, store seereon.grievances`

| Column              | Type         | Req | FK            | Description / allowed values |
| ------------------- | ------------ | --- | ------------- | ---------------------------- |
| id                  | bigserial    | Y   |               | Surrogate key                |
| grievance_id        | varchar(40)  | Y   | grievances.id | Parent Grievance             |
| at                  | date         |     |               |                              |
| by                  | varchar(120) |     |               |                              |
| note                | text         |     |               |                              |
| visible_to_employee | boolean      |     |               |                              |

Indexes: (grievance_id)

#### grievance_routing

Category → owner, committee and SLA (days) matrix.  
**Entity:** GrievanceRouting · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/grievance-data.ts → ROUTING`

| Column       | Type         | Req | FK               | Description / allowed values                                       |
| ------------ | ------------ | --- | ---------------- | ------------------------------------------------------------------ |
| id           | uuid         | Y   |                  | Surrogate primary key; business id kept in code                    |
| org_id       | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today) |
| category     | varchar(30)  | Y   |                  |                                                                    |
| owner_name   | varchar(120) | Y   |                  |                                                                    |
| committee    | varchar(60)  | Y   |                  |                                                                    |
| ack_days     | smallint     | Y   |                  |                                                                    |
| resolve_days | smallint     | Y   |                  |                                                                    |

Indexes: (org_id, category) unique

#### grievances

Grievance redressal case: routed by category to committee/owner with ack & resolution SLAs, investigation log, resolution, employee confirmation or appeal.  
**Entity:** Grievance · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/grievance-data.ts → type Grievance, store seereon.grievances`

| Column            | Type         | Req | FK               | Description / allowed values                                                                                                                                                       |
| ----------------- | ------------ | --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                | uuid         | Y   |                  | Surrogate primary key; business id kept in code                                                                                                                                    |
| code              | varchar(20)  | Y   |                  | GRV-2026-0007                                                                                                                                                                      |
| org_id            | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)                                                                                                                 |
| employee_id       | varchar(20)  | Y   | employees.id     | Complainant (kept even when anonymous; never shown to handlers)                                                                                                                    |
| display_name      | varchar(120) | Y   |                  | 'Anonymous' when anonymous                                                                                                                                                         |
| department        | varchar(80)  | Y   |                  |                                                                                                                                                                                    |
| branch            | varchar(80)  | Y   |                  |                                                                                                                                                                                    |
| is_anonymous      | boolean      | Y   |                  |                                                                                                                                                                                    |
| category          | varchar(30)  | Y   |                  | Allowed: Harassment (POSH) \| Discrimination \| Workplace safety \| Payroll / salary dispute \| Leave / attendance \| Manager behaviour \| Facilities \| Policy violation \| Other |
| severity          | varchar(10)  | Y   |                  | Allowed: Low \| Medium \| High \| Critical                                                                                                                                         |
| subject           | varchar(150) | Y   |                  |                                                                                                                                                                                    |
| description       | text         | Y   |                  |                                                                                                                                                                                    |
| against           | varchar(120) |     |                  |                                                                                                                                                                                    |
| raised_on         | date         | Y   |                  |                                                                                                                                                                                    |
| status            | varchar(20)  | Y   |                  | Allowed: Submitted \| Acknowledged \| Under investigation \| Resolved \| Appealed \| Closed \| Withdrawn                                                                           |
| owner_name        | varchar(120) | Y   |                  |                                                                                                                                                                                    |
| committee         | varchar(60)  | Y   |                  |                                                                                                                                                                                    |
| ack_due           | date         | Y   |                  |                                                                                                                                                                                    |
| resolve_due       | date         | Y   |                  |                                                                                                                                                                                    |
| acknowledged_on   | date         |     |                  |                                                                                                                                                                                    |
| resolved_on       | date         |     |                  |                                                                                                                                                                                    |
| closed_on         | date         |     |                  |                                                                                                                                                                                    |
| resolution        | text         |     |                  |                                                                                                                                                                                    |
| action_taken      | text         |     |                  |                                                                                                                                                                                    |
| employee_rating   | smallint     |     |                  | 1–5                                                                                                                                                                                |
| employee_feedback | text         |     |                  |                                                                                                                                                                                    |
| appeal_reason     | text         |     |                  |                                                                                                                                                                                    |

Indexes: (org_id, status); (employee_id); (owner_name, status)

#### hr_policies

Retirement age, notification lead times and channels per entity.  
**Entity:** HrPolicy · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-policy.ts → type HrPolicy, store seereon.hr.policy`

| Column                    | Type          | Req | FK               | Description / allowed values                                       |
| ------------------------- | ------------- | --- | ---------------- | ------------------------------------------------------------------ |
| id                        | uuid          | Y   |                  | Surrogate primary key; business id kept in code                    |
| org_id                    | varchar(20)   | Y   | organizations.id | Owning entity (derived from the employee's directory record today) |
| retirement_age            | smallint      | Y   |                  |                                                                    |
| retirement_notice_days    | smallint      | Y   |                  |                                                                    |
| probation_reminder_days   | smallint      | Y   |                  |                                                                    |
| birthday_notice_days      | smallint      | Y   |                  |                                                                    |
| anniversary_notice_days   | smallint      | Y   |                  |                                                                    |
| contract_extension_months | smallint      | Y   |                  |                                                                    |
| notify_channels           | varchar(10)[] | Y   |                  | Allowed: Email \| In-app \| WhatsApp                               |
| updated_on                | date          | Y   |                  |                                                                    |
| updated_by                | varchar(120)  | Y   |                  |                                                                    |

Indexes: (org_id) unique

#### notification_outbox

Computed automation outbox (birthdays, anniversaries, retirement, probation-ending to HOD, retirement processed). Derived, not stored today.  
**Entity:** NotificationOutboxEntry · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-policy.ts → type OutboxEntry (computeOutbox / useOutbox)`

| Column          | Type         | Req | FK               | Description / allowed values                                                                                      |
| --------------- | ------------ | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| id              | bigserial    | Y   |                  | Surrogate key (added — the prototype record has no single id)                                                     |
| code            | varchar(40)  | Y   |                  | NTF-BD-SRN-0006                                                                                                   |
| kind            | varchar(30)  | Y   |                  | Allowed: Birthday \| Work anniversary \| Retirement approaching \| Probation ending (HOD) \| Retirement processed |
| recipient       | varchar(200) | Y   |                  |                                                                                                                   |
| recipient_email | varchar(300) | Y   |                  |                                                                                                                   |
| subject         | varchar(200) | Y   |                  |                                                                                                                   |
| body            | text         | Y   |                  |                                                                                                                   |
| trigger_date    | date         | Y   |                  |                                                                                                                   |
| due_on          | date         | Y   |                  |                                                                                                                   |
| channel         | varchar(40)  | Y   |                  |                                                                                                                   |
| status          | varchar(10)  | Y   |                  | Allowed: Scheduled \| Sent                                                                                        |
| sent_on         | date         |     |                  |                                                                                                                   |
| employee_id     | varchar(20)  | Y   | employees.id     | Employee                                                                                                          |
| org_id          | varchar(20)  | Y   | organizations.id | Owning entity (derived from the employee's directory record today)                                                |

#### rejoin_cases

Rejoin after a completed exit — continuity (original DOJ) within the window or fresh hire.  
**Entity:** RejoinCase · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/separation-data.ts → type RejoinCase, store seereon.exit.rejoin`

| Column          | Type         | Req | FK                 | Description / allowed values                                        |
| --------------- | ------------ | --- | ------------------ | ------------------------------------------------------------------- |
| id              | uuid         | Y   |                    | Surrogate primary key; business id kept in code                     |
| code            | varchar(20)  | Y   |                    | RJ-2026-001                                                         |
| org_id          | varchar(20)  | Y   | organizations.id   | Owning entity (derived from the employee's directory record today)  |
| employee_id     | varchar(20)  | Y   | employees.id       | Employee                                                            |
| employee_name   | varchar(120) | Y   |                    |                                                                     |
| exit_request_id | varchar(20)  | Y   | exit_requests.code |                                                                     |
| exited_on       | date         | Y   |                    |                                                                     |
| requested_on    | date         | Y   |                    |                                                                     |
| rejoin_on       | date         | Y   |                    | ≥ exited_on                                                         |
| days_gap        | smallint     | Y   |                    |                                                                     |
| mode            | varchar(40)  | Y   |                    | Allowed: Continuity (original DOJ retained) \| Fresh hire (new DOJ) |
| decided_by      | varchar(120) | Y   |                    |                                                                     |
| note            | text         |     |                    |                                                                     |
| fnf_reversed    | boolean      | Y   |                    |                                                                     |
| original_doj    | date         | Y   |                    |                                                                     |
| status          | varchar(10)  | Y   |                    | Allowed: Proposed \| Approved \| Rejoined                           |

Indexes: (exit_request_id) unique

#### retention_attachments (child)

Child of retention_cases — retention_attachments  
**Entity:** RetentionAttachments · **Primary key:** —

Source: `src/lib/separation-data.ts → type RetentionCase, store seereon.exit.retention.v2`

| Column            | Type        | Req | FK                 | Description / allowed values |
| ----------------- | ----------- | --- | ------------------ | ---------------------------- |
| id                | bigserial   | Y   |                    | Surrogate key                |
| retention_case_id | varchar(40) | Y   | retention_cases.id | Parent RetentionCase         |
| value             | text        | Y   |                    | Item value (array element)   |

Indexes: (retention_case_id)

#### retention_cases

Retention discussion for a live resignation with the audit form filled when retained.  
**Entity:** RetentionCase · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/separation-data.ts → type RetentionCase, store seereon.exit.retention.v2`

| Column              | Type          | Req | FK                 | Description / allowed values                                                          |
| ------------------- | ------------- | --- | ------------------ | ------------------------------------------------------------------------------------- |
| id                  | uuid          | Y   |                    | Surrogate primary key; business id kept in code                                       |
| code                | varchar(20)   | Y   |                    | RET-2026-001                                                                          |
| org_id              | varchar(20)   | Y   | organizations.id   | Owning entity (derived from the employee's directory record today)                    |
| exit_request_id     | varchar(20)   | Y   | exit_requests.code |                                                                                       |
| employee_id         | varchar(20)   | Y   | employees.id       | Employee                                                                              |
| employee_name       | varchar(120)  | Y   |                    |                                                                                       |
| department          | varchar(80)   | Y   |                    |                                                                                       |
| manager_name        | varchar(120)  | Y   |                    |                                                                                       |
| started_by          | varchar(120)  | Y   |                    |                                                                                       |
| started_on          | date          | Y   |                    |                                                                                       |
| status              | varchar(15)   | Y   |                    | Allowed: Open \| In discussion \| Offer made \| Retained \| Not retained \| Withdrawn |
| owner_name          | varchar(120)  | Y   |                    |                                                                                       |
| reason_stated       | text          | Y   |                    |                                                                                       |
| offer               | text          |     |                    |                                                                                       |
| outcome_note        | text          |     |                    |                                                                                       |
| hike_pct            | numeric(6,2)  |     |                    |                                                                                       |
| closed_on           | date          |     |                    |                                                                                       |
| audit_justification | text          |     |                    |                                                                                       |
| audit_qualification | text          |     |                    |                                                                                       |
| audit_discussion    | text          |     |                    |                                                                                       |
| audit_discussed_on  | date          |     |                    |                                                                                       |
| audit_discussed_by  | varchar(200)  |     |                    |                                                                                       |
| new_designation     | varchar(120)  |     |                    |                                                                                       |
| new_grade           | varchar(10)   |     |                    |                                                                                       |
| previous_ctc        | numeric(14,2) |     |                    |                                                                                       |
| new_ctc             | numeric(14,2) |     |                    |                                                                                       |
| effective_from      | date          |     |                    |                                                                                       |
| retention_bonus     | numeric(14,2) |     |                    |                                                                                       |
| clawback_months     | smallint      |     |                    |                                                                                       |
| appraisal_ref       | varchar(30)   |     |                    |                                                                                       |
| conditions          | text          |     |                    |                                                                                       |
| approved_by         | varchar(120)  |     |                    |                                                                                       |
| approved_on         | date          |     |                    |                                                                                       |
| review_after_months | smallint      |     |                    |                                                                                       |
| letter_ref          | varchar(30)   |     |                    |                                                                                       |

Indexes: (exit_request_id) unique

#### retention_grounds (child)

Child of retention_cases — retention_grounds (form.grounds[])  
**Entity:** RetentionGrounds · **Primary key:** —

Source: `src/lib/separation-data.ts → type RetentionCase, store seereon.exit.retention.v2`

| Column            | Type         | Req | FK                 | Description / allowed values |
| ----------------- | ------------ | --- | ------------------ | ---------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                |
| retention_case_id | varchar(40)  | Y   | retention_cases.id | Parent RetentionCase         |
| form              | varchar(120) |     |                    | .grounds[]                   |

Indexes: (retention_case_id)

#### retention_history (child)

Child of retention_cases — retention_history (flattened from history[]: at date, by varchar(120), action text)  
**Entity:** RetentionHistory · **Primary key:** —

Source: `src/lib/separation-data.ts → type RetentionCase, store seereon.exit.retention.v2`

| Column            | Type         | Req | FK                 | Description / allowed values |
| ----------------- | ------------ | --- | ------------------ | ---------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                |
| retention_case_id | varchar(40)  | Y   | retention_cases.id | Parent RetentionCase         |
| at                | date         |     |                    | date                         |
| by                | varchar(120) |     |                    | varchar(120)                 |
| action            | text         |     |                    | text                         |

Indexes: (retention_case_id)

#### retention_offer_kinds (child)

Child of retention_cases — retention_offer_kinds (offerKind[] enum Compensation|Role change|Project change|Location|Flexibility|Counselling)  
**Entity:** RetentionOfferKinds · **Primary key:** —

Source: `src/lib/separation-data.ts → type RetentionCase, store seereon.exit.retention.v2`

| Column            | Type         | Req | FK                 | Description / allowed values                                                                                                                                                     |
| ----------------- | ------------ | --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                                                                                                                                                                    |
| retention_case_id | varchar(40)  | Y   | retention_cases.id | Parent RetentionCase                                                                                                                                                             |
| offer             | varchar(120) |     |                    | Kind[] enum Compensation\|Role change\|Project change\|Location\|Flexibility\|Counselling Allowed: Compensation\|Role change\|Project change\|Location\|Flexibility\|Counselling |

Indexes: (retention_case_id)

#### retention_types (child)

Child of retention_cases — retention_types (form.retentionType[])  
**Entity:** RetentionTypes · **Primary key:** —

Source: `src/lib/separation-data.ts → type RetentionCase, store seereon.exit.retention.v2`

| Column            | Type         | Req | FK                 | Description / allowed values |
| ----------------- | ------------ | --- | ------------------ | ---------------------------- |
| id                | bigserial    | Y   |                    | Surrogate key                |
| retention_case_id | varchar(40)  | Y   | retention_cases.id | Parent RetentionCase         |
| form              | varchar(120) |     |                    | .retentionType[]             |

Indexes: (retention_case_id)

#### retirements

Processed retirement, optionally with a re-engagement contract hire.  
**Entity:** RetirementRecord · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/hr-policy.ts → type RetirementRecord, store seereon.hr.retirements`

| Column           | Type          | Req | FK               | Description / allowed values                                       |
| ---------------- | ------------- | --- | ---------------- | ------------------------------------------------------------------ |
| id               | uuid          | Y   |                  | Surrogate primary key; business id kept in code                    |
| employee_id      | varchar(20)   | Y   | employees.id     | Employee                                                           |
| employee_name    | varchar(120)  | Y   |                  |                                                                    |
| org_id           | varchar(20)   | Y   | organizations.id | Owning entity (derived from the employee's directory record today) |
| retired_on       | date          | Y   |                  |                                                                    |
| processed_on     | date          | Y   |                  |                                                                    |
| processed_by     | varchar(120)  | Y   |                  |                                                                    |
| reason           | varchar(25)   | Y   |                  | Allowed: Superannuation \| Voluntary retirement \| Medical         |
| re_engaged       | boolean       | Y   |                  |                                                                    |
| contract_hire_id | varchar(20)   |     | new_hires.id     |                                                                    |
| contract_from    | date          |     |                  |                                                                    |
| contract_months  | smallint      |     |                  | > 0                                                                |
| contract_ctc     | numeric(14,2) |     |                  | > 0 when re-engaged                                                |
| note             | text          |     |                  |                                                                    |

Indexes: (employee_id) unique

### 9.10 Projects, Tasks & Assets

#### asset_history

Asset audit trail  
**Entity:** AssetHistory · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → Asset.history[]`

| Column   | Type         | Req | FK        | Description / allowed values                                  |
| -------- | ------------ | --- | --------- | ------------------------------------------------------------- |
| id       | bigserial    | Y   |           | Surrogate key (added — the prototype record has no single id) |
| asset_id | varchar(20)  | Y   | assets.id |                                                               |
| at       | date         | Y   |           |                                                               |
| by_name  | varchar(120) | Y   |           |                                                               |
| action   | varchar(300) | Y   |           |                                                               |

#### asset_issuance_checklist

Per-item result of the master checklist at issue / at return  
**Entity:** ChecklistResult · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → ChecklistResult`

| Column      | Type         | Req | FK                 | Description / allowed values                                  |
| ----------- | ------------ | --- | ------------------ | ------------------------------------------------------------- |
| id          | bigserial    | Y   |                    | Surrogate key (added — the prototype record has no single id) |
| issuance_id | varchar(20)  | Y   | asset_issuances.id |                                                               |
| phase       | varchar(6)   | Y   |                    | Allowed: issue \| return                                      |
| item        | varchar(160) | Y   |                    |                                                               |
| is_ok       | boolean      | Y   |                    |                                                               |
| remark      | text         |     |                    |                                                               |

#### asset_issuances

Custody record — one per issue to an employee, with checklist at issue, acknowledgement and the return check.  
**Entity:** AssetIssuance · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → AssetIssuance, store seereon.assets.issuances.v2`

| Column                  | Type          | Req | FK               | Description / allowed values                                             |
| ----------------------- | ------------- | --- | ---------------- | ------------------------------------------------------------------------ |
| id                      | varchar(20)   | Y   |                  | ISS-001                                                                  |
| org_id                  | varchar(20)   | Y   | organizations.id | Tenant (company) — implied by auth token                                 |
| asset_id                | varchar(20)   | Y   | assets.id        |                                                                          |
| employee_id             | varchar(20)   | Y   | employees.id     |                                                                          |
| issued_on               | date          | Y   |                  |                                                                          |
| issued_by_name          | varchar(120)  |     |                  | 'Transfer' for transfer-created issuances                                |
| purpose                 | varchar(60)   |     |                  |                                                                          |
| expected_return         | date          |     |                  | null = until separation; ≥ issue date                                    |
| location                | varchar(160)  |     |                  |                                                                          |
| serial_verified         | boolean       |     |                  |                                                                          |
| condition_on_issue      | varchar(20)   | Y   |                  |                                                                          |
| accessories_issued      | text[]        |     |                  |                                                                          |
| employee_ack            | boolean       |     |                  |                                                                          |
| ack_on                  | date          |     |                  |                                                                          |
| notes                   | text          |     |                  |                                                                          |
| status                  | varchar(12)   | Y   |                  | Allowed: Active \| Returned \| Transferred                               |
| return_status           | varchar(20)   |     |                  | Allowed: Not started \| Requested \| Checked \| Approved \| Issue raised |
| return_requested_on     | date          |     |                  |                                                                          |
| return_requested_by     | varchar(120)  |     |                  |                                                                          |
| employee_return_remarks | text          |     |                  |                                                                          |
| accessories_returned    | text[]        |     |                  |                                                                          |
| condition_on_return     | varchar(40)   |     |                  |                                                                          |
| return_outcome          | varchar(24)   |     |                  | Allowed: OK \| Damaged \| Not working \| Missing accessories \| Lost     |
| return_remarks          | text          |     |                  |                                                                          |
| return_checked_by       | varchar(120)  |     |                  |                                                                          |
| return_checked_on       | date          |     |                  |                                                                          |
| return_approved_by      | varchar(120)  |     |                  |                                                                          |
| return_approved_on      | date          |     |                  |                                                                          |
| returned_on             | date          |     |                  |                                                                          |
| recovery_amount         | numeric(14,2) |     |                  | recovery from employee                                                   |
| asset_issue_id          | varchar(20)   |     | asset_issues.id  |                                                                          |

Indexes: (asset_id) unique where status = 'Active'; (employee_id, status)

#### asset_issue_history (child)

Child of asset_issues — asset_issue_history (history[]: at, by, action, note)  
**Entity:** AssetIssueHistory · **Primary key:** —

Source: `src/lib/asset-data.ts → AssetIssue, store seereon.assets.issues.v1`

| Column         | Type         | Req | FK              | Description / allowed values |
| -------------- | ------------ | --- | --------------- | ---------------------------- |
| id             | bigserial    | Y   |                 | Surrogate key                |
| asset_issue_id | varchar(40)  | Y   | asset_issues.id | Parent AssetIssue            |
| at             | date         |     |                 |                              |
| by             | varchar(120) |     |                 |                              |
| action         | text         |     |                 |                              |
| note           | text         |     |                 |                              |

Indexes: (asset_issue_id)

#### asset_issues

Condition issue (damage / breakdown / loss) raised from a return check, by the employee or by the asset manager; assessment → (mishandling: manager remarks → Finance recovery) → repair → resolved.  
**Entity:** AssetIssue · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → AssetIssue, store seereon.assets.issues.v1`

| Column             | Type          | Req | FK                 | Description / allowed values                                                                                                                               |
| ------------------ | ------------- | --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                 | varchar(20)   | Y   |                    | AIS-001                                                                                                                                                    |
| org_id             | varchar(20)   | Y   | organizations.id   | Tenant (company) — implied by auth token                                                                                                                   |
| asset_id           | varchar(20)   | Y   | assets.id          |                                                                                                                                                            |
| issuance_id        | varchar(20)   |     | asset_issuances.id |                                                                                                                                                            |
| employee_id        | varchar(20)   | Y   | employees.id       | holder                                                                                                                                                     |
| raised_by_name     | varchar(120)  | Y   |                    |                                                                                                                                                            |
| raised_by          | varchar(20)   | Y   | employees.id       |                                                                                                                                                            |
| raised_on          | date          | Y   |                    |                                                                                                                                                            |
| source             | varchar(20)   | Y   |                    | Allowed: Return check \| Employee report \| Asset manager                                                                                                  |
| category           | varchar(40)   | Y   |                    | Allowed: Physical damage \| Not working / breakdown \| Performance degraded \| Missing accessories \| Lost / stolen \| Software / licence problem \| Other |
| severity           | varchar(10)   | Y   |                    | Allowed: Low \| Medium \| High \| Critical                                                                                                                 |
| description        | text          | Y   |                    |                                                                                                                                                            |
| noticed_on         | date          |     |                    | ≤ today                                                                                                                                                    |
| evidence           | text[]        | Y   |                    | file names                                                                                                                                                 |
| status             | varchar(24)   | Y   |                    | Allowed: Open \| Under assessment \| Manager review \| Finance review \| Repair / replacement \| Resolved \| Closed                                        |
| cause              | varchar(30)   | Y   |                    | Allowed: Undetermined \| Employee mishandling \| Asset fault / breakdown                                                                                   |
| cause_details      | text          |     |                    |                                                                                                                                                            |
| assessed_by        | varchar(120)  |     |                    |                                                                                                                                                            |
| assessed_on        | date          |     |                    |                                                                                                                                                            |
| estimated_cost     | numeric(14,2) |     |                    | ≥ 0                                                                                                                                                        |
| manager_id         | varchar(20)   |     | employees.id       | reporting manager (live reporting line)                                                                                                                    |
| manager_decision   | varchar(40)   |     |                    | Allowed: Agree — employee at fault \| Disagree — treat as asset fault \| Partial responsibility                                                            |
| manager_remarks    | text          |     |                    |                                                                                                                                                            |
| manager_decided_on | date          |     |                    |                                                                                                                                                            |
| finance_decision   | varchar(24)   |     |                    | Allowed: Recover full cost \| Recover partially \| Waive                                                                                                   |
| recovery_amount    | numeric(14,2) |     |                    | > 0 unless Waive; ≤ max(estimated cost, asset cost)                                                                                                        |
| recovery_mode      | varchar(20)   |     |                    | Allowed: Salary deduction \| Direct payment \| Insurance claim \| Waived                                                                                   |
| finance_remarks    | text          |     |                    |                                                                                                                                                            |
| finance_decided_by | varchar(120)  |     |                    |                                                                                                                                                            |
| finance_decided_on | date          |     |                    |                                                                                                                                                            |
| resolution         | varchar(30)   |     |                    | Allowed: Repaired \| Replaced \| Written off \| Returned to stock \| Retired \| Recovered from employee                                                    |
| repair_vendor      | varchar(160)  |     |                    |                                                                                                                                                            |
| repair_cost        | numeric(14,2) |     |                    | ≥ 0                                                                                                                                                        |
| resolved_by        | varchar(120)  |     |                    |                                                                                                                                                            |
| resolved_on        | date          |     |                    |                                                                                                                                                            |
| resolution_notes   | text          |     |                    |                                                                                                                                                            |

Indexes: (org_id, status); (employee_id); (manager_id) where status = 'Manager review'

#### asset_requests

Employee request for an asset, approved HOD → HR business partner → Admin, then fulfilled from stock.  
**Entity:** AssetRequest · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → AssetRequest, store seereon.assets.requests.v2`

| Column          | Type         | Req | FK               | Description / allowed values                                                         |
| --------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------------------------ |
| id              | varchar(20)  | Y   |                  | REQ-001                                                                              |
| org_id          | varchar(20)  | Y   | organizations.id | Tenant (company) — implied by auth token                                             |
| employee_id     | varchar(20)  | Y   | employees.id     |                                                                                      |
| employee_name   | varchar(120) | Y   |                  | denormalised                                                                         |
| asset_type      | varchar(80)  | Y   | asset_types.name |                                                                                      |
| kind            | varchar(20)  | Y   |                  | Allowed: Hardware \| Software License \| Access \| Vehicle \| Equipment \| Furniture |
| reason          | text         | Y   |                  |                                                                                      |
| urgency         | varchar(10)  | Y   |                  | Allowed: Low \| Normal \| High \| Critical                                           |
| raised_on       | date         | Y   |                  |                                                                                      |
| needed_by       | date         |     |                  | ≥ today                                                                              |
| purpose         | varchar(60)  |     |                  |                                                                                      |
| specifications  | text         |     |                  |                                                                                      |
| project_code    | varchar(20)  |     | projects.code    |                                                                                      |
| duration        | varchar(30)  |     |                  |                                                                                      |
| status          | varchar(10)  | Y   |                  | Allowed: Pending \| Approved \| Rejected \| Issued                                   |
| issued_asset_id | varchar(20)  |     | assets.id        |                                                                                      |

Indexes: (org_id, status); (employee_id)

#### asset_transfers

Handover of an issued asset between two employees of the same organisation.  
**Entity:** AssetTransfer · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → AssetTransfer, store seereon.assets.transfers.v2`

| Column           | Type        | Req | FK               | Description / allowed values                             |
| ---------------- | ----------- | --- | ---------------- | -------------------------------------------------------- |
| id               | varchar(20) | Y   |                  | TRF-001                                                  |
| org_id           | varchar(20) | Y   | organizations.id | Tenant (company) — implied by auth token                 |
| asset_id         | varchar(20) | Y   | assets.id        |                                                          |
| from_employee_id | varchar(20) | Y   | employees.id     |                                                          |
| to_employee_id   | varchar(20) | Y   | employees.id     | ≠ from                                                   |
| handover_date    | date        | Y   |                  |                                                          |
| condition        | varchar(20) | Y   |                  |                                                          |
| from_ack         | boolean     | Y   |                  |                                                          |
| to_ack           | boolean     | Y   |                  | also set when the receiver acknowledges the new issuance |
| notes            | text        |     |                  |                                                          |

#### asset_types

Asset master (Master Data → Assets): type, category, serial rule, depreciation, default checklist & accessories, default return period.  
**Entity:** AssetTypeMaster · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → AssetTypeMaster, store seereon.assets.master.v1`

| Column              | Type         | Req | FK               | Description / allowed values                                                         |
| ------------------- | ------------ | --- | ---------------- | ------------------------------------------------------------------------------------ |
| id                  | varchar(20)  | Y   |                  | ATM-01 (next free number)                                                            |
| org_id              | varchar(20)  | Y   | organizations.id | Tenant (company) — implied by auth token                                             |
| code                | varchar(12)  | Y   |                  | tag code, e.g. LT                                                                    |
| name                | varchar(80)  | Y   |                  | unique                                                                               |
| kind                | varchar(20)  | Y   |                  | Allowed: Hardware \| Software License \| Access \| Vehicle \| Equipment \| Furniture |
| description         | text         |     |                  |                                                                                      |
| requires_serial     | boolean      | Y   |                  |                                                                                      |
| useful_life_years   | numeric(4,1) | Y   |                  |                                                                                      |
| depreciation_pct    | numeric(5,2) | Y   |                  |                                                                                      |
| custodian_dept      | varchar(80)  | Y   |                  |                                                                                      |
| checklist_items     | text[]       | Y   |                  | verified at issue and return                                                         |
| default_accessories | text[]       | Y   |                  |                                                                                      |
| default_return_days | smallint     | Y   |                  | 0 = until separation                                                                 |
| is_active           | boolean      | Y   |                  |                                                                                      |

Indexes: (org_id, name) unique; (org_id, code) unique

#### assets

Organisation-owned asset (hardware, licence, vehicle …) — never group-owned.  
**Entity:** Asset · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/asset-data.ts → Asset, store seereon.assets.v2`

| Column            | Type          | Req | FK               | Description / allowed values                                                          |
| ----------------- | ------------- | --- | ---------------- | ------------------------------------------------------------------------------------- |
| id                | varchar(20)   | Y   |                  | AST-001 (next free number)                                                            |
| org_id            | varchar(20)   | Y   | organizations.id | Tenant (company) — implied by auth token                                              |
| tag               | varchar(30)   | Y   |                  | unique label, e.g. SRN-LT-001                                                         |
| name              | varchar(160)  | Y   |                  |                                                                                       |
| asset_type        | varchar(80)   | Y   | asset_types.name |                                                                                       |
| kind              | varchar(20)   | Y   |                  | Allowed: Hardware \| Software License \| Access \| Vehicle \| Equipment \| Furniture  |
| serial_no         | varchar(80)   | Y   |                  | '—' when none; unique when present; mandatory when type.requiresSerial                |
| model             | varchar(160)  |     |                  |                                                                                       |
| specifications    | text          |     |                  |                                                                                       |
| purchase_date     | date          | Y   |                  | ≤ today                                                                               |
| vendor            | varchar(160)  | Y   |                  |                                                                                       |
| invoice_no        | varchar(60)   |     |                  |                                                                                       |
| cost              | numeric(14,2) | Y   |                  | > 0                                                                                   |
| warranty_till     | date          |     |                  | ≥ purchase date                                                                       |
| condition         | varchar(20)   | Y   |                  | Allowed: Excellent \| Good \| Fair \| Poor \| Damaged \| Not working \| Active        |
| status            | varchar(20)   | Y   |                  | Allowed: In Stock \| Issued \| Return Pending \| Under Maintenance \| Retired \| Lost |
| license_key       | varchar(120)  |     |                  | software only                                                                         |
| seats             | integer       |     |                  |                                                                                       |
| renewal_date      | date          |     |                  |                                                                                       |
| holder_id         | varchar(20)   |     | employees.id     | current holder                                                                        |
| issued_on         | date          |     |                  |                                                                                       |
| location          | varchar(160)  |     |                  |                                                                                       |
| custodian_dept    | varchar(80)   |     |                  |                                                                                       |
| accessories       | text[]        |     |                  |                                                                                       |
| useful_life_years | numeric(4,1)  |     |                  | for straight-line book value                                                          |
| attachments       | text[]        |     |                  |                                                                                       |
| notes             | text          |     |                  |                                                                                       |

Indexes: (org_id, tag) unique; (org_id, serial_no) unique where serial_no <> '—'; (holder_id); (org_id, status)

#### project_history

Audit trail of project edits  
**Entity:** ProjectHistory · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/project-data.ts → Project.history[]`

| Column     | Type         | Req | FK          | Description / allowed values                                  |
| ---------- | ------------ | --- | ----------- | ------------------------------------------------------------- |
| id         | bigserial    | Y   |             | Surrogate key (added — the prototype record has no single id) |
| project_id | varchar(20)  | Y   | projects.id |                                                               |
| at         | date         | Y   |             |                                                               |
| by_name    | varchar(120) | Y   |             |                                                               |
| action     | varchar(200) | Y   |             |                                                               |

#### project_links (child)

Child of projects — project_links (links[])  
**Entity:** ProjectLinks · **Primary key:** —

Source: `src/lib/project-data.ts → type Project, store seereon.projects.v2`

| Column     | Type         | Req | FK          | Description / allowed values |
| ---------- | ------------ | --- | ----------- | ---------------------------- |
| id         | bigserial    | Y   |             | Surrogate key                |
| project_id | varchar(40)  | Y   | projects.id | Parent Project               |
| links      | varchar(120) |     |             | []                           |

Indexes: (project_id)

#### project_members

Project team (manager auto-added as 'Manager')  
**Entity:** ProjectMember · **Primary key:** project_id, employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/project-data.ts → ProjectMember`

| Column       | Type         | Req | FK           | Description / allowed values |
| ------------ | ------------ | --- | ------------ | ---------------------------- |
| project_id   | varchar(20)  | Y   | projects.id  |                              |
| employee_id  | varchar(20)  | Y   | employees.id |                              |
| name         | varchar(120) | Y   |              | denormalised                 |
| project_role | varchar(80)  | Y   |              |                              |

Indexes: (project_id, employee_id) unique

#### project_milestones

Milestones  
**Entity:** ProjectMilestone · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/project-data.ts → ProjectMilestone`

| Column     | Type         | Req | FK          | Description / allowed values |
| ---------- | ------------ | --- | ----------- | ---------------------------- |
| id         | varchar(40)  | Y   |             | MS-…                         |
| project_id | varchar(20)  | Y   | projects.id |                              |
| title      | varchar(200) | Y   |             |                              |
| due_date   | date         | Y   |             |                              |
| is_done    | boolean      | Y   |             |                              |

#### projects

Client / internal project with purpose, people, commercials and milestones. Tasks link via tasks.project_id.  
**Entity:** Project · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/project-data.ts → type Project, store seereon.projects.v2`

| Column                | Type          | Req | FK               | Description / allowed values                                                                                                                                      |
| --------------------- | ------------- | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                    | varchar(20)   | Y   |                  | PRJ-001 (next free number)                                                                                                                                        |
| org_id                | varchar(20)   | Y   | organizations.id | Tenant (company) — implied by auth token                                                                                                                          |
| code                  | varchar(20)   | Y   |                  | Business key, upper-case, unique (case-insensitive)                                                                                                               |
| name                  | varchar(200)  | Y   |                  |                                                                                                                                                                   |
| client                | varchar(160)  | Y   |                  |                                                                                                                                                                   |
| client_contact        | varchar(160)  |     |                  |                                                                                                                                                                   |
| client_email          | varchar(160)  |     |                  | valid e-mail                                                                                                                                                      |
| description           | text          |     |                  |                                                                                                                                                                   |
| project_type          | varchar(40)   |     |                  | Allowed: Client engagement \| Internal product \| Support & maintenance (AMC) \| Implementation / rollout \| Consulting / advisory \| R&D / POC \| Infrastructure |
| purpose               | text          |     |                  |                                                                                                                                                                   |
| objectives            | text          |     |                  |                                                                                                                                                                   |
| scope                 | text          |     |                  |                                                                                                                                                                   |
| deliverables          | text          |     |                  |                                                                                                                                                                   |
| risks                 | text          |     |                  |                                                                                                                                                                   |
| department            | varchar(80)   |     | departments.name |                                                                                                                                                                   |
| branch                | varchar(120)  |     |                  |                                                                                                                                                                   |
| manager_id            | varchar(20)   | Y   | employees.id     | Project manager                                                                                                                                                   |
| manager_name          | varchar(120)  | Y   |                  | denormalised                                                                                                                                                      |
| sponsor_id            | varchar(20)   |     | employees.id     |                                                                                                                                                                   |
| sponsor_name          | varchar(120)  |     |                  |                                                                                                                                                                   |
| start_date            | date          | Y   |                  |                                                                                                                                                                   |
| end_date              | date          | Y   |                  | ≥ start                                                                                                                                                           |
| priority              | varchar(10)   | Y   |                  | Allowed: Low \| Medium \| High \| Critical                                                                                                                        |
| status                | varchar(20)   | Y   |                  | Allowed: Planning \| Active \| On Hold \| Completed                                                                                                               |
| phase                 | varchar(20)   |     |                  | Allowed: Initiation \| Planning \| Execution \| UAT \| Go-live \| Hypercare \| Closure                                                                            |
| progress_override_pct | smallint      | Y   |                  | used only when the project has no tasks; live progress = avg task progress                                                                                        |
| billing_type          | varchar(40)   |     |                  | Allowed: Fixed price \| Time & material \| Retainer \| Milestone based \| Non-billable (internal)                                                                 |
| budget                | numeric(14,2) |     |                  | ≥ 0                                                                                                                                                               |
| currency              | char(3)       |     |                  | Allowed: INR \| USD \| EUR \| GBP \| AED \| SAR                                                                                                                   |
| cost_centre           | varchar(40)   |     |                  |                                                                                                                                                                   |
| po_number             | varchar(60)   |     |                  |                                                                                                                                                                   |
| tags                  | text[]        |     |                  |                                                                                                                                                                   |
| attachments           | text[]        |     |                  | file names                                                                                                                                                        |
| created_by_name       | varchar(120)  |     |                  |                                                                                                                                                                   |
| created_on            | date          |     |                  |                                                                                                                                                                   |

Indexes: (org_id, code) unique; (org_id, status); (manager_id)

#### task_assignees (child)

Child of tasks — task_assignees (assignees[] → task_id, employee_id)  
**Entity:** TaskAssignees · **Primary key:** —

Source: `src/lib/task-data.ts → type Task, store seereon.tasks.v2`

| Column      | Type         | Req | FK           | Description / allowed values                 |
| ----------- | ------------ | --- | ------------ | -------------------------------------------- |
| id          | bigserial    | Y   |              | Surrogate key                                |
| task_id     | varchar(40)  | Y   | tasks.id     | Parent Task                                  |
| assignees   | varchar(120) |     |              | [] → task_id (logical reference: task_id.id) |
| employee_id | varchar(40)  |     | employees.id |                                              |

Indexes: (task_id)

#### task_attachments (child)

Child of tasks — task_attachments (attachments[])  
**Entity:** TaskAttachments · **Primary key:** —

Source: `src/lib/task-data.ts → type Task, store seereon.tasks.v2`

| Column      | Type         | Req | FK       | Description / allowed values |
| ----------- | ------------ | --- | -------- | ---------------------------- |
| id          | bigserial    | Y   |          | Surrogate key                |
| task_id     | varchar(40)  | Y   | tasks.id | Parent Task                  |
| attachments | varchar(120) |     |          | []                           |

Indexes: (task_id)

#### task_checklist_items

Sub-task checklist  
**Entity:** TaskChecklistItem · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/task-data.ts → TaskChecklistItem`

| Column  | Type         | Req | FK       | Description / allowed values |
| ------- | ------------ | --- | -------- | ---------------------------- |
| id      | varchar(40)  | Y   |          | CL-…                         |
| task_id | varchar(20)  | Y   | tasks.id |                              |
| title   | varchar(200) | Y   |          |                              |
| is_done | boolean      | Y   |          |                              |

#### task_links

External links on a task (http/https only)  
**Entity:** TaskLink · **Primary key:** task_id, url · **Tenant-scoped** (org_id)

Source: `src/lib/task-data.ts → TaskLink`

| Column  | Type          | Req | FK       | Description / allowed values |
| ------- | ------------- | --- | -------- | ---------------------------- |
| task_id | varchar(20)   | Y   | tasks.id |                              |
| label   | varchar(120)  | Y   |          |                              |
| url     | varchar(1000) | Y   |          | http(s) URL, unique per task |

Indexes: (task_id, url) unique

#### task_updates

Activity / progress entries on a task. Entries carrying hours/progress/status are employee progress posts awaiting approval; others are notes.  
**Entity:** TaskUpdate · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/task-data.ts → type TaskUpdate (Task.updates[])`

| Column       | Type         | Req | FK       | Description / allowed values                                |
| ------------ | ------------ | --- | -------- | ----------------------------------------------------------- |
| id           | uuid         | Y   |          | (not in UI model — array position)                          |
| task_id      | varchar(20)  | Y   | tasks.id |                                                             |
| at           | date         | Y   |          |                                                             |
| by_name      | varchar(120) | Y   |          | author name                                                 |
| note         | text         | Y   |          |                                                             |
| hours_total  | numeric(7,2) |     |          | proposed total logged hours                                 |
| progress_pct | smallint     |     |          | 0–100                                                       |
| status       | varchar(20)  |     |          | Allowed: Not Started \| In Progress \| On Hold \| Completed |

Indexes: (task_id, at desc)

#### tasks

One task in the single shared task store — stand-alone (Miscellaneous) or under a project. Read by Tasks, Projects & Assignments, My Team and the employee portal.  
**Entity:** Task · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/task-data.ts → type Task, store seereon.tasks.v2`

| Column                 | Type          | Req | FK               | Description / allowed values                                                                                                                                                        |
| ---------------------- | ------------- | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                     | varchar(20)   | Y   |                  | TSK-1001 (stand-alone) / PTK-001 (project task) — next free number per prefix                                                                                                       |
| org_id                 | varchar(20)   | Y   | organizations.id | Tenant (company) — implied by auth token                                                                                                                                            |
| name                   | varchar(200)  | Y   |                  | Task name                                                                                                                                                                           |
| description            | text          |     |                  | Short description                                                                                                                                                                   |
| details                | text          |     |                  | Scope / approach                                                                                                                                                                    |
| project_id             | varchar(20)   |     | projects.id      | null = Miscellaneous                                                                                                                                                                |
| priority               | varchar(10)   | Y   |                  | Allowed: Low \| Medium \| High \| Critical                                                                                                                                          |
| status                 | varchar(20)   | Y   |                  | Allowed: Not Started \| In Progress \| On Hold \| Completed                                                                                                                         |
| approval_state         | varchar(20)   | Y   |                  | State of the latest employee progress update Allowed: Not Submitted \| Pending \| Approved \| Rejected                                                                              |
| purpose                | varchar(60)   |     |                  | Allowed: Client deliverable \| Internal improvement \| Bug fix / incident \| Compliance / statutory \| Onboarding / enablement \| Sales / pre-sales \| Research / POC \| Operations |
| category               | varchar(60)   |     |                  | Allowed: Development \| Testing / QA \| Design \| Documentation \| Client deliverable \| Support / maintenance \| Data / reporting \| Compliance \| Internal / admin \| Research    |
| estimated_hours        | numeric(7,2)  | Y   |                  | ≥ 0                                                                                                                                                                                 |
| logged_hours           | numeric(7,2)  | Y   |                  | Total hours (set on approval of an update)                                                                                                                                          |
| progress_pct           | smallint      | Y   |                  | 0–100                                                                                                                                                                               |
| start_date             | date          | Y   |                  |                                                                                                                                                                                     |
| end_date               | date          | Y   |                  | defaults to due date                                                                                                                                                                |
| due_date               | date          | Y   |                  | ≥ start date                                                                                                                                                                        |
| est_delivery_at        | timestamp     | Y   |                  | Estimated delivery (local date-time); default due 18:00                                                                                                                             |
| is_team_task           | boolean       |     |                  |                                                                                                                                                                                     |
| team_name              | varchar(80)   |     |                  |                                                                                                                                                                                     |
| concerned_manager_id   | varchar(20)   |     | employees.id     | Approver of updates                                                                                                                                                                 |
| concerned_manager_name | varchar(120)  |     |                  | denormalised                                                                                                                                                                        |
| concerned_person_id    | varchar(20)   |     | employees.id     | Reviewer / SME                                                                                                                                                                      |
| client                 | varchar(160)  |     |                  |                                                                                                                                                                                     |
| tags                   | text[]        |     |                  |                                                                                                                                                                                     |
| primary_attachment     | varchar(255)  |     |                  | legacy single file name                                                                                                                                                             |
| depends_on             | varchar(20)[] |     | tasks.id         | task ids                                                                                                                                                                            |
| is_billable            | boolean       |     |                  | default true                                                                                                                                                                        |
| created_by_name        | varchar(120)  | Y   |                  |                                                                                                                                                                                     |
| created_by             | varchar(20)   |     | employees.id     |                                                                                                                                                                                     |
| created_on             | date          |     |                  |                                                                                                                                                                                     |

Indexes: (org_id, project_id); (org_id, due_date); task_assignees (employee_id)

### 9.11 Helpdesk & Reporting

#### fin_expense_monthly

Executive seed: budget vs actual per cost head per FY month  
**Entity:** ExpenseRow · **Primary key:** org_id, financial_year, month_index, cost_head · **Tenant-scoped** (org_id)

Source: `src/lib/exec-reports.ts → ExpenseRow`

| Column         | Type          | Req | FK               | Description / allowed values                                                                                                                                                   |
| -------------- | ------------- | --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| org_id         | varchar(20)   | Y   | organizations.id | Tenant (company) — implied by auth token                                                                                                                                       |
| financial_year | varchar(10)   | Y   |                  |                                                                                                                                                                                |
| month_index    | smallint      | Y   |                  |                                                                                                                                                                                |
| cost_head      | varchar(60)   | Y   |                  | Allowed: Salaries & Wages \| Statutory Contributions \| Facility & Rent \| Cloud & Licences \| Travel & Conveyance \| Recruitment & Training \| Marketing \| Professional Fees |
| cost_centre    | varchar(40)   | Y   |                  |                                                                                                                                                                                |
| actual         | numeric(14,2) | Y   |                  |                                                                                                                                                                                |
| budget         | numeric(14,2) | Y   |                  |                                                                                                                                                                                |

Indexes: (org_id, financial_year, month_index, cost_head) unique

#### fin_revenue_monthly

Executive seed: invoiced vs collected per client per FY month  
**Entity:** RevenueRow · **Primary key:** org_id, financial_year, month_index, client · **Tenant-scoped** (org_id)

Source: `src/lib/exec-reports.ts → RevenueRow (REVENUE_ROWS, deterministic seed)`

| Column         | Type          | Req | FK               | Description / allowed values                    |
| -------------- | ------------- | --- | ---------------- | ----------------------------------------------- |
| org_id         | varchar(20)   | Y   | organizations.id | Tenant (company) — implied by auth token        |
| financial_year | varchar(10)   | Y   |                  | Allowed: FY 2024-25 \| FY 2025-26 \| FY 2026-27 |
| month_index    | smallint      | Y   |                  | 0 = Apr … 11 = Mar                              |
| client         | varchar(120)  | Y   |                  |                                                 |
| service_line   | varchar(80)   | Y   |                  |                                                 |
| region         | varchar(40)   | Y   |                  |                                                 |
| invoiced       | numeric(14,2) | Y   |                  |                                                 |
| collected      | numeric(14,2) | Y   |                  |                                                 |

Indexes: (org_id, financial_year, month_index, client) unique

#### helpdesk_settings

Desk-wide settings (singleton per tenant/group).  
**Entity:** HelpdeskConfig · **Primary key:** org_id · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → HelpdeskConfig, store seereon.helpdesk.config`

| Column                     | Type        | Req | FK               | Description / allowed values             |
| -------------------------- | ----------- | --- | ---------------- | ---------------------------------------- |
| org_id                     | varchar(20) | Y   | organizations.id | Tenant (company) — implied by auth token |
| ticket_prefix              | varchar(15) | Y   |                  | 2–15 of A-Z 0-9 -                        |
| auto_close_days            | smallint    | Y   |                  | ≥ 1                                      |
| allow_requester_pick_agent | boolean     | Y   |                  |                                          |

Indexes: (org_id) unique

#### helpdesk_sla_policies

First-response and resolution targets per priority  
**Entity:** SlaPolicy · **Primary key:** org_id, priority · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → SlaPolicy`

| Column               | Type         | Req | FK               | Description / allowed values               |
| -------------------- | ------------ | --- | ---------------- | ------------------------------------------ |
| org_id               | varchar(20)  | Y   | organizations.id | Tenant (company) — implied by auth token   |
| priority             | varchar(10)  | Y   |                  | Allowed: Low \| Medium \| High \| Critical |
| first_response_hours | numeric(6,2) | Y   |                  | > 0                                        |
| resolve_hours        | numeric(6,2) | Y   |                  | ≥ first response                           |

Indexes: (org_id, priority) unique

#### service_department_agents (child)

Child of service_departments — service_department_agents (agentIds[] → department_id, employee_id; ≥ 1)  
**Entity:** ServiceDepartmentAgents · **Primary key:** —

Source: `src/lib/helpdesk-data.ts → ServiceDepartment`

| Column                | Type         | Req | FK                     | Description / allowed values                                |
| --------------------- | ------------ | --- | ---------------------- | ----------------------------------------------------------- |
| id                    | bigserial    | Y   |                        | Surrogate key                                               |
| service_department_id | varchar(40)  | Y   | service_departments.id | Parent ServiceDepartment                                    |
| agent                 | varchar(120) |     |                        | Ids[] → department_id (logical reference: department_id.id) |
| employee_id           | varchar(40)  |     | employees.id           | ; ≥ 1                                                       |

Indexes: (service_department_id)

#### service_departments

Service desk (IT, Finance & Payroll, HR, Admin, SAP) with head, agents, mailbox (e-mail-to-ticket) and business hours.  
**Entity:** ServiceDepartment · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → ServiceDepartment`

| Column         | Type         | Req | FK               | Description / allowed values             |
| -------------- | ------------ | --- | ---------------- | ---------------------------------------- |
| id             | varchar(10)  | Y   |                  | IT / FIN / HR / D6 …                     |
| org_id         | varchar(20)  | Y   | organizations.id | Tenant (company) — implied by auth token |
| name           | varchar(80)  | Y   |                  |                                          |
| description    | text         |     |                  |                                          |
| head_id        | varchar(20)  | Y   | employees.id     | escalation owner                         |
| mailbox        | varchar(160) |     |                  | e-mail-to-ticket address                 |
| business_hours | varchar(80)  |     |                  |                                          |

#### ticket_attachments

File metadata on a ticket (≤ 10 MB each)  
**Entity:** TicketAttachment · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → Attachment`

| Column        | Type         | Req | FK         | Description / allowed values |
| ------------- | ------------ | --- | ---------- | ---------------------------- |
| id            | varchar(40)  | Y   |            | ATT-…                        |
| ticket_id     | varchar(30)  | Y   | tickets.id |                              |
| file_name     | varchar(255) | Y   |            |                              |
| size_bytes    | integer      | Y   |            | ≤ 10485760                   |
| mime_type     | varchar(120) |     |            |                              |
| added_by_name | varchar(120) | Y   |            |                              |
| at            | timestamptz  | Y   |            |                              |

#### ticket_categories

Category inside a service department with default owner and priority; HR-GRIEV is confidential.  
**Entity:** TicketCategory · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → Category`

| Column           | Type        | Req | FK                     | Description / allowed values                                        |
| ---------------- | ----------- | --- | ---------------------- | ------------------------------------------------------------------- |
| id               | varchar(30) | Y   |                        | IT-ACCESS …                                                         |
| department_id    | varchar(10) | Y   | service_departments.id |                                                                     |
| name             | varchar(80) | Y   |                        |                                                                     |
| description      | text        |     |                        |                                                                     |
| default_agent_id | varchar(20) |     | employees.id           | null = department head; must be an agent                            |
| default_priority | varchar(10) | Y   |                        | Allowed: Low \| Medium \| High \| Critical                          |
| is_confidential  | boolean     |     |                        | (proposed; today hard-coded CONFIDENTIAL_CATEGORIES = ['HR-GRIEV']) |

#### ticket_events

Conversation & activity timeline (public reply, internal note, status, assignment, attachment, system, escalation).  
**Entity:** TicketEvent · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → TimelineEvent`

| Column     | Type         | Req | FK           | Description / allowed values                                                                                             |
| ---------- | ------------ | --- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| id         | varchar(60)  | Y   |              | EV-…                                                                                                                     |
| ticket_id  | varchar(30)  | Y   | tickets.id   |                                                                                                                          |
| at         | timestamptz  | Y   |              |                                                                                                                          |
| by_id      | varchar(20)  | Y   | employees.id |                                                                                                                          |
| by_name    | varchar(120) | Y   |              |                                                                                                                          |
| event_type | varchar(12)  | Y   |              | internal visible to agents only Allowed: reply \| internal \| status \| assignment \| attachment \| system \| escalation |
| body       | text         | Y   |              |                                                                                                                          |

Indexes: (ticket_id, at)

#### ticket_watchers

People copied on a ticket  
**Entity:** TicketWatcher · **Primary key:** ticket_id, employee_id · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → Ticket.watchers[]`

| Column      | Type         | Req | FK           | Description / allowed values |
| ----------- | ------------ | --- | ------------ | ---------------------------- |
| ticket_id   | varchar(30)  | Y   | tickets.id   |                              |
| employee_id | varchar(20)  | Y   | employees.id | ≠ requester                  |
| name        | varchar(120) | Y   |              |                              |

Indexes: (ticket_id, employee_id) unique

#### tickets

Service-desk ticket routed to a department / category / agent with SLA clock, conversation timeline, watchers and attachments.  
**Entity:** Ticket · **Primary key:** id · **Tenant-scoped** (org_id)

Source: `src/lib/helpdesk-data.ts → Ticket, store seereon.helpdesk.tickets`

| Column             | Type         | Req | FK                     | Description / allowed values                                                                      |
| ------------------ | ------------ | --- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| id                 | varchar(30)  | Y   |                        | {prefix}-{yyyy}-{nnnn}, e.g. SRN-TKT-2026-0031                                                    |
| org_id             | varchar(20)  | Y   | organizations.id       | Tenant (company) — implied by auth token                                                          |
| subject            | varchar(140) | Y   |                        | ≥ 8 chars                                                                                         |
| description        | text         | Y   |                        | ≥ 20 chars                                                                                        |
| department_id      | varchar(10)  | Y   | service_departments.id |                                                                                                   |
| category_id        | varchar(30)  | Y   | ticket_categories.id   |                                                                                                   |
| priority           | varchar(10)  | Y   |                        | Allowed: Low \| Medium \| High \| Critical                                                        |
| impact             | varchar(14)  | Y   |                        | Allowed: Individual \| Team \| Department \| Organisation                                         |
| status             | varchar(24)  | Y   |                        | Allowed: New \| Assigned \| In Progress \| Waiting on Requester \| Resolved \| Closed \| Reopened |
| channel            | varchar(10)  | Y   |                        | Allowed: Portal \| Email \| Phone \| Walk-in                                                      |
| requester_id       | varchar(20)  | Y   | employees.id           | person the ticket is for                                                                          |
| requester_name     | varchar(120) | Y   |                        |                                                                                                   |
| requester_dept     | varchar(80)  | Y   |                        |                                                                                                   |
| raised_by_id       | varchar(20)  |     | employees.id           | NB: holds the RAISER when raised on behalf (misnamed in UI model)                                 |
| assignee_id        | varchar(20)  |     | employees.id           | must be an agent or head of the department                                                        |
| assignee_name      | varchar(120) |     |                        |                                                                                                   |
| tags               | text[]       | Y   |                        |                                                                                                   |
| related_kind       | varchar(20)  |     |                        | Allowed: Employee \| Asset \| Payroll period \| Leave request \| Other                            |
| related_ref        | varchar(60)  |     |                        |                                                                                                   |
| email_from         | varchar(160) |     |                        | e-mail channel                                                                                    |
| email_message_id   | varchar(200) |     |                        | thread reference                                                                                  |
| email_received_at  | timestamptz  |     |                        |                                                                                                   |
| created_at         | timestamptz  | Y   |                        |                                                                                                   |
| updated_at         | timestamptz  | Y   |                        |                                                                                                   |
| first_response_due | timestamptz  | Y   |                        | created + SLA                                                                                     |
| resolve_due        | timestamptz  | Y   |                        | created + SLA; reset on reopen / priority change                                                  |
| first_response_at  | timestamptz  |     |                        |                                                                                                   |
| resolved_at        | timestamptz  |     |                        |                                                                                                   |
| closed_at          | timestamptz  |     |                        |                                                                                                   |
| resolution         | text         |     |                        | required to resolve                                                                               |
| reopen_count       | smallint     | Y   |                        |                                                                                                   |
| csat_rating        | smallint     |     |                        | requester only, after resolve                                                                     |
| csat_comment       | text         |     |                        |                                                                                                   |
| csat_at            | timestamptz  |     |                        |                                                                                                   |

Indexes: (org_id, department_id, status); (assignee_id, status); (requester_id); (org_id, id) unique

### 9.12 Derived views and catalogues (not tables)

| Name                     | Kind      | Description                                                                                                                                                                                                                                                                                 |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v_upcoming_people_events | view      | Computed (not stored) upcoming birthdays, work anniversaries and retirements from DOB / DOJ — a SQL view.                                                                                                                                                                                   |
| v_probation_status       | view      | Derived view: probation end date, days remaining and HOD per new hire.                                                                                                                                                                                                                      |
| leave_balances           | view      | Derived per employee & type: entitled (credit-to-date + carry-forward), used (scaled opening + approved), pending, available.                                                                                                                                                               |
| report_definitions       | catalogue | Role-scoped report catalogue built live from module stores (attendance, leave, payroll, performance, claims, recruitment, training, revenue/P&L, tasks/goals, exit, grievance, loans, tours, helpdesk, assets, filings). Exposed as read-only query endpoints with CSV/Excel/PDF rendering. |

## 10. Testing and integration guide

### 10.1 Running the prototype

```
npm install
npm run dev          # http://localhost:3000 (vite dev)
npx tsc --noEmit     # type check — must be clean
npm run build        # production build (Vercel / Nitro)
```

All data is in the browser. To reset to seed data, clear site data or run `Object.keys(localStorage).filter(k => k.startsWith('seereon.')).forEach(k => localStorage.removeItem(k))` in the console and reload. Use separate browser profiles to simulate two users acting on the same record.

### 10.2 Demo accounts

Company ID may be left blank on the sign-in page. Seereon platform accounts sign in at **/seereon** (not linked from /login).

| Name                  | Role       | Designation                              | Entity                             | E-mail                                 | Password       | Tab         |
| --------------------- | ---------- | ---------------------------------------- | ---------------------------------- | -------------------------------------- | -------------- | ----------- |
| Group Administrator   | SuperAdmin | Group Super Administrator                | Seereon Technologies (SRN-001)     | superadmin@seereon.co.in               | Super@123      | Super Admin |
| Seereon Administrator | Admin      | Organization Administrator               | Seereon Technologies (SRN-001)     | admin@seereon.co.in                    | Admin@123      | Admin       |
| Santosh Nayak         | CEO        | Chief Executive Officer                  | Seereon Technologies (SRN-001)     | santosh@seereon.co.in                  | Ceo@123        | Employee    |
| Saras Venkatesh       | CFO        | Chief Financial Officer                  | Seereon Technologies (SRN-001)     | saras@seereon.co.in                    | Cfo@123        | Employee    |
| Ashish Nayak          | COO        | Chief Operating Officer                  | Seereon Technologies (SRN-001)     | ashish@seereon.co.in                   | Coo@123        | Employee    |
| Vivek Raman           | CTO        | Chief Technology Officer                 | Seereon Technologies (SRN-001)     | vivek@seereon.co.in                    | Cto@123        | Employee    |
| Farah Khan            | CHRO       | Chief Human Resources Officer            | Seereon Technologies (SRN-001)     | farah@seereon.co.in                    | Chro@123       | Employee    |
| Meera Iyer            | HR         | Vice President — People Operations       | Seereon Technologies (SRN-001)     | meera@seereon.co.in                    | Hrvp@123       | Employee    |
| Varen Mishra          | HR         | Head of Human Resources                  | Seereon Technologies (SRN-001)     | varen@seereon.co.in                    | Hr@123         | Employee    |
| Ritu Bansal           | HR         | HR Business Partner — Engineering        | Seereon Technologies (SRN-001)     | ritu@seereon.co.in                     | Ritu@123       | Employee    |
| Aditya Verma          | HR         | HR Business Partner — Operations & Sales | Seereon Technologies (SRN-001)     | aditya@seereon.co.in                   | Aditya@123     | Employee    |
| Subh Sahoo            | Manager    | Engineering Manager                      | Seereon Technologies (SRN-001)     | subh@seereon.co.in                     | Manager@123    | Employee    |
| Subham Das            | Employee   | Senior Software Engineer                 | Seereon Technologies (SRN-001)     | subham@seereon.co.in                   | Employee@123   | Employee    |
| Neha Kulkarni         | Employee   | QA Engineer                              | Seereon Technologies (SRN-001)     | neha@seereon.co.in                     | Neha@123       | Employee    |
| Rakesh Menon          | Employee   | Data Engineer                            | Seereon Technologies (SRN-001)     | rakesh@seereon.co.in                   | Rakesh@123     | Employee    |
| Ishita Bose           | Employee   | Software Engineer                        | Seereon Technologies (SRN-001)     | ishita@seereon.co.in                   | Ishita@123     | Employee    |
| Aravind Krishnan      | Employee   | DevOps Engineer                          | Seereon Technologies (SRN-001)     | aravind@seereon.co.in                  | Aravind@123    | Employee    |
| Tanvi Joshi           | Employee   | Frontend Engineer                        | Seereon Technologies (SRN-001)     | tanvi@seereon.co.in                    | Tanvi@123      | Employee    |
| Kiran Shetty          | HOD        | Head of Department — Operations          | Seereon Technologies (SRN-001)     | kiran@seereon.co.in                    | Hod@123        | Employee    |
| Devraj Solanki        | HOD        | Head of Department — SAP Delivery        | Seereon SAP entity (ORG-1042)      | devraj.solanki@sap.seereon.co.in       | Devraj@123     | Employee    |
| Falguni Rathore       | HR         | HR Business Partner                      | Seereon SAP entity (ORG-1042)      | falguni.rathore@sap.seereon.co.in      | Falguni@123    | Employee    |
| Manjeet Bhati         | Employee   | SAP ABAP Consultant                      | Seereon SAP entity (ORG-1042)      | manjeet.bhati@sap.seereon.co.in        | Manjeet@123    | Employee    |
| Ritesh Barman         | HOD        | Head of Department — Cloud & DevOps      | Seereon Cloud entity (ORG-1043)    | ritesh.barman@cloud.seereon.co.in      | Ritesh@123     | Employee    |
| Pallavi Chatterjee    | Manager    | DevOps Lead                              | Seereon Cloud entity (ORG-1043)    | pallavi.chatterjee@cloud.seereon.co.in | Pallavi@123    | Employee    |
| Soumen Ghosh          | Employee   | Cloud Support Lead (Night)               | Seereon Cloud entity (ORG-1043)    | soumen.ghosh@cloud.seereon.co.in       | Soumen@123     | Employee    |
| Yashodhara Naik       | HOD        | Head of Department — Product Engineering | Seereon Products entity (ORG-1044) | yashodhara.naik@products.seereon.co.in | Yashodhara@123 | Employee    |
| Biraja Mohanty        | Employee   | QA Automation Engineer                   | Seereon Products entity (ORG-1044) | biraja.mohanty@products.seereon.co.in  | Biraja@123     | Employee    |
| Prakash Mishra        | Admin      | Entity Administrator                     | Seereon SAP entity (ORG-1042)      | admin@sap.seereon.co.in                | Admin@123      | Admin       |
| Ankita Sahu           | Admin      | Entity Administrator                     | Seereon Cloud entity (ORG-1043)    | admin@cloud.seereon.co.in              | Admin@123      | Admin       |
| Rohan Das             | Admin      | Entity Administrator                     | Seereon Products entity (ORG-1044) | admin@products.seereon.co.in           | Admin@123      | Admin       |
| Seereon Dev Team      | Admin      | Platform Engineering                     | Seereon Technologies (SRN-001)     | dev@seereon.co.in                      | Dev@123        | /seereon    |
| Seereon Management    | Admin      | Product Management                       | Seereon Technologies (SRN-001)     | platform@seereon.co.in                 | Platform@123   | /seereon    |

### 10.3 Smoke-test scripts

#### 10.3.1 Platform onboarding — sign in as platform@seereon.co.in

1. Sign in at /seereon.
2. Client Organizations → New: create a group with one entity; complete every wizard step (validation blocks empty required fields).
3. Provision modules and a plan; issue tenant admin credentials.
4. Suspend the entity → its admin can no longer sign in at /login; reactivate → sign-in works again.

#### 10.3.2 Group structure (Super Admin) — sign in as superadmin@seereon.co.in

1. Dashboard shows the group roll-up; switch the scope chip to one entity and back.
2. Groups & entities: add a branch; Masters: add a department and designation.
3. Raise an inter-company transfer; approve it on the platform console; the employee now signs in to the new entity.

#### 10.3.3 Hire to first payslip — sign in as varen@seereon.co.in

1. Recruitment: post a job, add an applicant, schedule an interview, record a scorecard, raise and accept an offer.
2. Convert to new hire; complete the record form (PAN, bank, UAN validations); the new login works after reload.
3. Attendance: mark the month; lock attendance for the period.
4. Payroll: create run → compliance checks → fix failures → submit. Sign in as saras@seereon.co.in (CFO) to approve; the maker cannot approve.
5. Process and confirm payment; the employee sees the payslip under /emp/payslips.

#### 10.3.4 Leave and attendance — sign in as subham@seereon.co.in

1. Clock in/out on My Attendance; apply leave for two days; balance shows as pending.
2. Sign in as subh@seereon.co.in (Manager): approve from the approvals queue; self-approval is blocked for the manager's own leave.
3. Balance is deducted; the leave appears in the Leave Applications report.

#### 10.3.5 Claims and loans — sign in as subham@seereon.co.in

1. Submit a reimbursement claim with a bill; manager approves on /emp/reimbursements team queue; CFO pays.
2. Apply for a salary advance above 1× gross → rejected by validation; within limit → approved by HR; EMIs post in payroll.

#### 10.3.6 Appraisal cycle — sign in as farah@seereon.co.in

1. Open a staged appraisal cycle; employee submits self-appraisal; HOD then HR complete their stages (stage guards prevent skipping).
2. HR sets pay grade and generates the letter; the employee sees it under My Movements & Letters.

#### 10.3.7 Exit to F&F — sign in as subham@seereon.co.in

1. Submit resignation; manager approves; HR sets last working day.
2. Clearance areas (IT, Finance, Admin) are completed by their owners; exit survey submitted.
3. HR completes exit → F&F statement computed; the employee status becomes Exited and is excluded from the next payroll run.

#### 10.3.8 Assets and helpdesk — sign in as varen@seereon.co.in

1. Issue an asset; the employee acknowledges on My Assets; raise a condition issue; Finance records recovery (amount required).
2. Raise a helpdesk ticket as an employee; the agent picks it from the queue, resolves it; the requester closes it.

### 10.4 Integration checklist per module

1. Create the tables for the module from the data dictionary; load the prototype seed.
2. Implement the module's endpoints from the API document with the listed permission key and errors.
3. Port the module's validations (chapter 7) into shared Zod schemas; server returns 422 with field errors.
4. Enforce the lifecycle (chapter 6) — invalid transitions return 409.
5. Swap the module's stores for API hooks (Appendix B); remove the localStorage key.
6. Run the module's smoke test and the flow's alternative paths; confirm entity isolation by signing in to a second entity.
7. Confirm audit events are written for every command.

## 11. Known limitations and deferred items

The code audit fixed every blocking defect. The 24 items below were deliberately deferred because they need a backend, a schema change or a product decision. Each is also in the audit workbook.

| #   | Module               | Limitation                                                                                                                                                                                                                                                                        | Why deferred                                                                                                   |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Roles & Permissions  | Screen/action access is decided only by the app role (ROLE_NAV / ROLE_ACTIONS). RBAC roles designed in Roles & Permissions, temporary access grants and delegations are recorded and displayed but never consulted by canOpen/canOpenPath/can.                                    | design change: RBAC roles are documentation-only today                                                         |
| 2   | Approval Engine      | 'Rework' ends the request (status Rework) and nothing lets the requester resubmit — there is no resubmit operation.                                                                                                                                                               | needs requester-side UI in another domain                                                                      |
| 3   | Shell                | The platform console search box ignores what is typed (always navigates to /app/organizations) and shows a ⌘K hint with no shortcut wired.                                                                                                                                        | target screen in platform domain has no search param                                                           |
| 4   | Claims → Payroll     | Claims with payment mode 'With salary (payroll)' are marked Paid at the Accounts stage but never appear as an earning on any payslip.                                                                                                                                             | needs product decision on cut-off and run linkage                                                              |
| 5   | Loans                | LoanPolicy.approver offers 'HR → Finance' but decideLoan is single-level.                                                                                                                                                                                                         | schema change to add an approval chain                                                                         |
| 6   | Statutory Compliance | The lockMembershipToPeriod toggle is never read; coverage is re-evaluated every month from structure gross (lock only possible via manual 'Covered' override).                                                                                                                    | needs contribution-period history                                                                              |
| 7   | Payroll              | Monthly TDS = annual tax ÷ months on payroll; TDS already deducted in earlier months is not considered (no true-up after a mid-year change in salary/declaration).                                                                                                                | needs YTD TDS source inside the engine                                                                         |
| 8   | Recruitment          | 'Internal note' input is kept in state but never saved anywhere.                                                                                                                                                                                                                  | needs OfferRecord.notes field                                                                                  |
| 9   | Recruitment          | The welcome e-mail hard-codes 'Organisation ID: SRN-001' and the Seereon name/URL for every entity.                                                                                                                                                                               | cosmetic                                                                                                       |
| 10  | Doc Master           | TemplatesTab (and lib/doc-templates.ts store) and pages/AssessmentsPage.tsx and ConfigLinksTab are not rendered by any route; GlobalSearch still indexes the legacy doc-templates store.                                                                                          | dead code; GlobalSearch import is cross-domain                                                                 |
| 11  | Employee master      | Hires created from the Hire dialog / welcome e-mail (no PAN captured) still show generated PAN/UAN/PF numbers.                                                                                                                                                                    | payroll coordination                                                                                           |
| 12  | Handbook             | Handbook versions/acknowledgements are a single global list for every entity.                                                                                                                                                                                                     | schema change                                                                                                  |
| 13  | Exit Management      | todayISO() uses the UTC date; between 00:00 and 05:30 IST it returns yesterday for applied/decision dates.                                                                                                                                                                        | shared date helper; platform-wide change                                                                       |
| 14  | HR policy            | retirementCandidates/computeOutbox derive 'Sent'/'Scheduled' and days-away from new Date() during render.                                                                                                                                                                         | low impact, consumer screens not in scope                                                                      |
| 15  | Documentation        | Download only shows a toast; the uploaded file bytes are never stored. The page also claims client-facing documents appear in every tenant's Help menu, but nothing reads docStore outside this page.                                                                             | needs file storage backend + tenant Help menu consumer                                                         |
| 16  | Support SLA          | SlaConfigDialog, the whole support-sla-data module (SLA rules, routing rules, delegation history) and support-data ORG_TICKETS/TICKET_STATUSES/ISSUE_TYPES are not imported by any screen (helpdesk uses helpdesk-data). SLA/routing rules are also global, not per organisation. | unused — owner of helpdesk should wire or delete                                                               |
| 17  | Client credentials   | Temporary passwords are stored in plaintext in localStorage and displayed indefinitely in the Credentials tab, even after the client changed it (then the displayed value is stale).                                                                                              | UI-only prototype; backend concern                                                                             |
| 18  | Client organisations | Impersonation signs the Seereon user in as the tenant administrator with no confirmation and no audit entry, and works for suspended organisations.                                                                                                                               | needs platform audit-log store                                                                                 |
| 19  | Audit logs           | Audit log is a static array; no platform action (org created, suspended, credentials reset, impersonation, transfer confirmed) writes to it.                                                                                                                                      | cross-cutting audit store                                                                                      |
| 20  | Leave                | LeaveTypesTab is not imported anywhere (leave types now come from Leave Master) and still creates ids with Math.random().                                                                                                                                                         | unreachable, removal is cosmetic                                                                               |
| 21  | Attendance / Payroll | Penalty rules (late / short hours / early exit) are configured but never applied by payroll.                                                                                                                                                                                      | feature: payroll LOP/penalty rule design — rules are stored in penaltyRuleStore for the backend payroll engine |
| 22  | Attendance           | An open punch from an earlier day blocks a new punch-in until punched out (legit for night shifts, but day-shift users get no guidance).                                                                                                                                          | regularisation workflow not in scope                                                                           |
| 23  | Helpdesk             | Desk configuration is one global store and queues/All Tickets are not filtered by orgId (tickets do carry orgId).                                                                                                                                                                 | product decision: group-shared vs per-entity desk                                                              |
| 24  | Reports              | Manager-level reports (task register, goal register, team scorecard) list the whole company, not the manager's reporting line.                                                                                                                                                    | report layer has no viewer context; cross-module change                                                        |

## Appendix A — Route inventory

| Route                        | Portal                   | Screen                       | File                                       |
| ---------------------------- | ------------------------ | ---------------------------- | ------------------------------------------ |
| /app/ai-assistant            | Seereon Platform console | AI Assistant                 | src/routes/app.ai-assistant.tsx            |
| /app/audit-logs              | Seereon Platform console | Audit Logs                   | src/routes/app.audit-logs.tsx              |
| /app/authentication          | Seereon Platform console | Authentication               | src/routes/app.authentication.tsx          |
| /app/catalog                 | Seereon Platform console | Modules & Features           | src/routes/app.catalog.tsx                 |
| /app/dashboard               | Seereon Platform console | Dashboard                    | src/routes/app.dashboard.tsx               |
| /app/documentation           | Seereon Platform console | Documentation                | src/routes/app.documentation.tsx           |
| /app/group-transfers         | Seereon Platform console | Inter-Company Transfers      | src/routes/app.group-transfers.tsx         |
| /app                         | Seereon Platform console |                              | src/routes/app.index.tsx                   |
| /app/integrations            | Seereon Platform console | Integrations                 | src/routes/app.integrations.tsx            |
| /app/notifications           | Seereon Platform console | Notifications                | src/routes/app.notifications.tsx           |
| /app/organizations/{id}      | Seereon Platform console |                              | src/routes/app.organizations.$id.tsx       |
| /app/organizations           | Seereon Platform console | Client Organizations         | src/routes/app.organizations.index.tsx     |
| /app/organizations/new       | Seereon Platform console |                              | src/routes/app.organizations.new.tsx       |
| /app/profile                 | Seereon Platform console | Profile                      | src/routes/app.profile.tsx                 |
| /app/settings                | Seereon Platform console | System Settings              | src/routes/app.settings.tsx                |
| /app/support                 | Seereon Platform console | Support Tickets              | src/routes/app.support.tsx                 |
| /app                         | Seereon Platform console | Layout / shell               | src/routes/app.tsx                         |
| /candidate/{token}           | Candidate portal         |                              | src/routes/candidate.$token.tsx            |
| /emp-login                   | Public / authentication  |                              | src/routes/emp-login.tsx                   |
| /emp/appraisals              | Employee portal          | My Appraisals                | src/routes/emp.appraisals.tsx              |
| /emp/assets                  | Employee portal          | My Assets                    | src/routes/emp.assets.tsx                  |
| /emp/attendance              | Employee portal          | My Attendance                | src/routes/emp.attendance.tsx              |
| /emp/complaints              | Employee portal          | Raise a Grievance            | src/routes/emp.complaints.tsx              |
| /emp/dashboard               | Employee portal          | My Self-Service              | src/routes/emp.dashboard.tsx               |
| /emp/goals                   | Employee portal          | My Goals & Appraisals        | src/routes/emp.goals.tsx                   |
| /emp/handbook                | Employee portal          | Employee Handbook            | src/routes/emp.handbook.tsx                |
| /emp/holidays                | Employee portal          | Holiday Calendar             | src/routes/emp.holidays.tsx                |
| /emp                         | Employee portal          |                              | src/routes/emp.index.tsx                   |
| /emp/it-declaration          | Employee portal          | IT Declaration               | src/routes/emp.it-declaration.tsx          |
| /emp/it-statement            | Employee portal          | IT Statement                 | src/routes/emp.it-statement.tsx            |
| /emp/leave                   | Employee portal          | My Leave                     | src/routes/emp.leave.tsx                   |
| /emp/loans                   | Employee portal          | Loans & Advances             | src/routes/emp.loans.tsx                   |
| /emp/movements               | Employee portal          | My Movements & Letters       | src/routes/emp.movements.tsx               |
| /emp/notices                 | Employee portal          | Notices & Circulars          | src/routes/emp.notices.tsx                 |
| /emp/payroll                 | Employee portal          |                              | src/routes/emp.payroll.tsx                 |
| /emp/payslips                | Employee portal          | My Payslips                  | src/routes/emp.payslips.tsx                |
| /emp/profile                 | Employee portal          | My Profile                   | src/routes/emp.profile.tsx                 |
| /emp/projects                | Employee portal          | Projects & Assignments       | src/routes/emp.projects.tsx                |
| /emp/referrals               | Employee portal          | Refer a Candidate            | src/routes/emp.referrals.tsx               |
| /emp/reimbursements          | Employee portal          | My Claims                    | src/routes/emp.reimbursements.tsx          |
| /emp/reports                 | Employee portal          | My Reports                   | src/routes/emp.reports.tsx                 |
| /emp/resignation             | Employee portal          | Resignation & Exit           | src/routes/emp.resignation.tsx             |
| /emp/reviews                 | Employee portal          | Team Reviews                 | src/routes/emp.reviews.tsx                 |
| /emp/support                 | Employee portal          |                              | src/routes/emp.support.tsx                 |
| /emp/tasks                   | Employee portal          | My Tasks                     | src/routes/emp.tasks.tsx                   |
| /emp/tax                     | Employee portal          | Proof of Investment          | src/routes/emp.tax.tsx                     |
| /emp/timesheets              | Employee portal          | My Timesheets                | src/routes/emp.timesheets.tsx              |
| /emp/tours                   | Employee portal          | My Tours                     | src/routes/emp.tours.tsx                   |
| /emp/training                | Employee portal          | My Trainings                 | src/routes/emp.training.tsx                |
| /emp                         | Employee portal          | Layout / shell               | src/routes/emp.tsx                         |
| /emp/ytd                     | Employee portal          | YTD Reports                  | src/routes/emp.ytd.tsx                     |
| /forgot-password             | Public / authentication  |                              | src/routes/forgot-password.tsx             |
| /helpdesk/all                | Helpdesk                 |                              | src/routes/helpdesk.all.tsx                |
| /helpdesk/catalog            | Helpdesk                 |                              | src/routes/helpdesk.catalog.tsx            |
| /helpdesk                    | Helpdesk                 | Helpdesk                     | src/routes/helpdesk.index.tsx              |
| /helpdesk/new                | Helpdesk                 |                              | src/routes/helpdesk.new.tsx                |
| /helpdesk/queue              | Helpdesk                 |                              | src/routes/helpdesk.queue.tsx              |
| /helpdesk/settings           | Helpdesk                 |                              | src/routes/helpdesk.settings.tsx           |
| /helpdesk/tickets/{id}       | Helpdesk                 |                              | src/routes/helpdesk.tickets.$id.tsx        |
| /helpdesk/tickets            | Helpdesk                 | My Helpdesk Tickets          | src/routes/helpdesk.tickets.index.tsx      |
| /helpdesk                    | Helpdesk                 | Helpdesk                     | src/routes/helpdesk.tsx                    |
| /                            | Public / authentication  |                              | src/routes/index.tsx                       |
| /login                       | Public / authentication  |                              | src/routes/login.tsx                       |
| /org-login                   | Public / authentication  |                              | src/routes/org-login.tsx                   |
| /org/announcements           | Organisation portal      | Announcements                | src/routes/org.announcements.tsx           |
| /org/approvals               | Organisation portal      | Open Approval Engine         | src/routes/org.approvals.tsx               |
| /org/archive                 | Organisation portal      | System Archive & Soft Delete | src/routes/org.archive.tsx                 |
| /org/asset-rollup            | Organisation portal      | Group Asset Rollup           | src/routes/org.asset-rollup.tsx            |
| /org/assets                  | Organisation portal      | Asset Lifecycle              | src/routes/org.assets.tsx                  |
| /org/attendance              | Organisation portal      | Attendance & Shifts          | src/routes/org.attendance.tsx              |
| /org/claims                  | Organisation portal      | Claims & Insurance           | src/routes/org.claims.tsx                  |
| /org/compliance              | Organisation portal      | Statutory Compliance         | src/routes/org.compliance.tsx              |
| /org/dashboard               | Organisation portal      | Dashboard                    | src/routes/org.dashboard.tsx               |
| /org/delegation              | Organisation portal      | Role Delegation              | src/routes/org.delegation.tsx              |
| /org/employees               | Organisation portal      | Employees                    | src/routes/org.employees.tsx               |
| /org/exits                   | Organisation portal      | Exit, Retention & F&F        | src/routes/org.exits.tsx                   |
| /org/expenditure             | Organisation portal      | Expenditure Booking          | src/routes/org.expenditure.tsx             |
| /org/finance                 | Organisation portal      | Payroll, Payslips & Loans    | src/routes/org.finance.tsx                 |
| /org/goals                   | Organisation portal      | Goals                        | src/routes/org.goals.tsx                   |
| /org/grievances              | Organisation portal      | Grievance Redressal          | src/routes/org.grievances.tsx              |
| /org/groups                  | Organisation portal      | Entities & Branches          | src/routes/org.groups.tsx                  |
| /org/holidays                | Organisation portal      |                              | src/routes/org.holidays.tsx                |
| /org                         | Organisation portal      |                              | src/routes/org.index.tsx                   |
| /org/infrastructure          | Organisation portal      |                              | src/routes/org.infrastructure.tsx          |
| /org/leave                   | Organisation portal      | Leave & Comp-off             | src/routes/org.leave.tsx                   |
| /org/masters                 | Organisation portal      | Master Data                  | src/routes/org.masters.tsx                 |
| /org/notifications           | Organisation portal      | Notification Centre          | src/routes/org.notifications.tsx           |
| /org/payroll-reports         | Organisation portal      | Payroll Reports              | src/routes/org.payroll-reports.tsx         |
| /org/performance             | Organisation portal      | Reviews & Appraisals         | src/routes/org.performance.tsx             |
| /org/projects                | Organisation portal      | Projects & Assignments       | src/routes/org.projects.tsx                |
| /org/recruitment/assessments | Organisation portal      |                              | src/routes/org.recruitment.assessments.tsx |
| /org/recruitment/candidates  | Organisation portal      |                              | src/routes/org.recruitment.candidates.tsx  |
| /org/recruitment             | Organisation portal      | Recruitment                  | src/routes/org.recruitment.index.tsx       |
| /org/recruitment/interviews  | Organisation portal      |                              | src/routes/org.recruitment.interviews.tsx  |
| /org/recruitment/locations   | Organisation portal      |                              | src/routes/org.recruitment.locations.tsx   |
| /org/recruitment/masters     | Organisation portal      |                              | src/routes/org.recruitment.masters.tsx     |
| /org/recruitment/offers      | Organisation portal      |                              | src/routes/org.recruitment.offers.tsx      |
| /org/recruitment/postings    | Organisation portal      |                              | src/routes/org.recruitment.postings.tsx    |
| /org/recruitment/rounds      | Organisation portal      |                              | src/routes/org.recruitment.rounds.tsx      |
| /org/recruitment             | Organisation portal      | Recruitment                  | src/routes/org.recruitment.tsx             |
| /org/reports                 | Organisation portal      | Reports & Analytics          | src/routes/org.reports.tsx                 |
| /org/roles                   | Organisation portal      | Roles & Permissions          | src/routes/org.roles.index.tsx             |
| /org/roles/new               | Organisation portal      |                              | src/routes/org.roles.new.tsx               |
| /org/roles                   | Organisation portal      | Roles & Permissions          | src/routes/org.roles.tsx                   |
| /org/settings                | Organisation portal      | Settings                     | src/routes/org.settings.tsx                |
| /org/support                 | Organisation portal      |                              | src/routes/org.support.tsx                 |
| /org/tasks                   | Organisation portal      | Tasks                        | src/routes/org.tasks.tsx                   |
| /org/tax                     | Organisation portal      | Proof of Investment          | src/routes/org.tax.tsx                     |
| /org/team                    | Organisation portal      | My Team                      | src/routes/org.team.tsx                    |
| /org/timesheets              | Organisation portal      | Timesheets                   | src/routes/org.timesheets.tsx              |
| /org/tours                   | Organisation portal      | Tours & Travel               | src/routes/org.tours.tsx                   |
| /org/training                | Organisation portal      | Training                     | src/routes/org.training.tsx                |
| /org                         | Organisation portal      | Layout / shell               | src/routes/org.tsx                         |
| /org/users                   | Organisation portal      | Users & Logins               | src/routes/org.users.tsx                   |
| /reset-password              | Public / authentication  |                              | src/routes/reset-password.tsx              |
| /seereon                     | Seereon Platform console |                              | src/routes/seereon.tsx                     |

## Appendix B — Browser store → table map

| localStorage key                       | Module file                                 | Target table(s)                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| seereon.acks.v1                        | src/lib/ack-data.ts                         | announcement_acknowledgements                                                                                                                                         |
| seereon.announcements.v1               | src/lib/announcement-data.ts                | announcements                                                                                                                                                         |
| seereon.appearance.org.v1              | src/lib/appearance.ts                       | org_themes                                                                                                                                                            |
| seereon.appearance.user.v1             | src/lib/appearance.ts                       | user_preferences, user_wallpapers                                                                                                                                     |
| seereon.appraisal.self                 | src/lib/self-appraisal.ts                   | self_appraisal_approvals, self_appraisal_attachments, self_appraisal_goals, self_appraisal_history, self_appraisal_ratings, self_appraisals                           |
| seereon.appraisals.v2                  | src/lib/appraisal-data.ts                   | hr_appraisal_attachments, hr_appraisal_goals, hr_appraisal_history, hr_appraisal_linked_reviews, hr_appraisal_params, hr_appraisals                                   |
| seereon.approvals.requests.v1          | src/lib/approval-data.ts                    | approval_request_steps, approval_requests                                                                                                                             |
| seereon.approvals.workflows.v1         | src/lib/approval-data.ts                    | approval_workflow_levels, approval_workflows                                                                                                                          |
| seereon.archive.config                 | src/lib/archive-data.ts                     | archive_settings                                                                                                                                                      |
| seereon.archive.records                | src/lib/archive-data.ts                     | archived_records                                                                                                                                                      |
| seereon.assets.issuances.v2            | src/lib/asset-data.ts                       | asset_issuances                                                                                                                                                       |
| seereon.assets.issues.v1               | src/lib/asset-data.ts                       | asset_issue_history, asset_issues                                                                                                                                     |
| seereon.assets.master.v1               | src/lib/asset-data.ts                       | asset_types                                                                                                                                                           |
| seereon.assets.requests.v2             | src/lib/asset-data.ts                       | asset_requests                                                                                                                                                        |
| seereon.assets.transfers.v2            | src/lib/asset-data.ts                       | asset_transfers                                                                                                                                                       |
| seereon.assets.v2                      | src/lib/asset-data.ts                       | assets                                                                                                                                                                |
| seereon.attendance.halfday-policy.v1   | src/lib/attendance-data.ts                  | attendance_work_hour_policy                                                                                                                                           |
| seereon.attendance.overtime-rules.v1   | src/lib/attendance-data.ts                  | attendance_overtime_rules                                                                                                                                             |
| seereon.attendance.penalty-rules.v1    | src/lib/attendance-data.ts                  | attendance_penalty_rules                                                                                                                                              |
| seereon.attendance.punches             | src/lib/attendance-self.ts                  | attendance_punches                                                                                                                                                    |
| seereon.attendance.shifts.v1           | src/lib/attendance-data.ts                  | shifts                                                                                                                                                                |
| seereon.auth.account-overrides.v1      | src/lib/auth-session.ts                     | app_role_permissions, password_reset_requests, user_credentials, user_sessions                                                                                        |
| seereon.brand.default.v1               | src/lib/brand-config.ts                     | brand_profiles                                                                                                                                                        |
| seereon.brand.orgs.v1                  | src/lib/brand-config.ts                     | brand_profiles                                                                                                                                                        |
| seereon.cases.promotions.v2            | src/lib/people-cases.ts                     | promotion_case_approvals, promotion_case_attachments, promotion_case_history, promotion_cases                                                                         |
| seereon.cases.referrals.v2             | src/lib/people-cases.ts                     | referral_case_history, referral_cases                                                                                                                                 |
| seereon.cases.terminations.v2          | src/lib/people-cases.ts                     | termination_case_approvals, termination_case_evidence, termination_case_history, termination_cases                                                                    |
| seereon.cases.transfers.v2             | src/lib/people-cases.ts                     | transfer_case_approvals, transfer_case_attachments, transfer_case_history, transfer_cases                                                                             |
| seereon.cases.warnings.v2              | src/lib/people-cases.ts                     | warning_case_evidence, warning_case_history, warning_cases                                                                                                            |
| seereon.claims.reimbursements.v1       | src/lib/claims-data.ts                      | claim_attachments, claim_line_items, claim_trail, reimbursement_claims                                                                                                |
| seereon.declarations.v2                | src/lib/declaration-data.ts                 | it_declaration_fields, it_declaration_history, it_declaration_proofs, it_declarations                                                                                 |
| seereon.delegations.v1                 | src/lib/delegation-data.ts                  | delegation_events, delegation_modules, delegations                                                                                                                    |
| seereon.docmaster.styles               | src/lib/doc-master.ts                       | doc_styles                                                                                                                                                            |
| seereon.docmaster.templates.v3         | src/lib/doc-master.ts                       | doc_template_fields, doc_template_sections, doc_templates                                                                                                             |
| seereon.employee.alerts                | src/lib/employee-alerts.ts                  | user_alerts                                                                                                                                                           |
| seereon.exit.fnf                       | src/lib/separation-data.ts                  | fnf_config, fnf_history, fnf_lines, fnf_statements                                                                                                                    |
| seereon.exit.fnf-config                | src/lib/separation-data.ts                  | fnf_config                                                                                                                                                            |
| seereon.exit.rejoin                    | src/lib/separation-data.ts                  | rejoin_cases                                                                                                                                                          |
| seereon.exit.retention.v2              | src/lib/separation-data.ts                  | retention_attachments, retention_cases, retention_grounds, retention_history, retention_offer_kinds, retention_types                                                  |
| seereon.exit.surveys                   | src/lib/separation-data.ts                  | exit_surveys                                                                                                                                                          |
| seereon.expenditure.v2                 | src/lib/expenditure-data.ts                 | expenditure_asset_details, expenditure_attachments, expenditure_bills, expenditure_festival_details, expenditure_history, expenditure_outcome_documents, expenditures |
| seereon.finance.loan-policy            | src/lib/loans-data.ts                       | loan_policies                                                                                                                                                         |
| seereon.finance.loans.v2               | src/lib/loans-data.ts                       | loan_history, loan_schedule, loans                                                                                                                                    |
| seereon.goals.v2                       | src/lib/goals-data.ts                       | goal_documents, goal_evaluation_params, goal_history, goal_links, goal_metrics, goal_milestones, goals                                                                |
| seereon.grievances                     | src/lib/grievance-data.ts                   | grievance_attachments, grievance_history, grievance_investigation_notes, grievances                                                                                   |
| seereon.group.groups.v1                | src/lib/group-data.ts                       | company_groups                                                                                                                                                        |
| seereon.group.orgs.v1                  | src/lib/group-data.ts                       | organization_addresses, organizations                                                                                                                                 |
| seereon.group.transfers.v1             | src/lib/group-transfer-data.ts              | group_transfer_asset_dispositions, group_transfer_requests                                                                                                            |
| seereon.handbook                       | src/lib/handbook-data.ts                    | handbook_versions                                                                                                                                                     |
| seereon.hiring.newhires                | src/lib/hiring-data.ts                      | employees, new_hires                                                                                                                                                  |
| seereon.hr.reviews.v1                  | src/lib/hr-review-data.ts                   | hr_review_attachments, hr_review_goals, hr_review_history, hr_review_params, hr_review_skills, hr_reviews                                                             |
| seereon.leave.applications.v1          | src/lib/leave-data.ts                       | leave_application_approvals, leave_application_documents, leave_applications                                                                                          |
| seereon.masters.assessment-params      | src/lib/onboarding-data.ts                  | assessment_param_applies_to, assessment_params                                                                                                                        |
| seereon.masters.departments.v1         | src/lib/dept-data.ts                        | departments                                                                                                                                                           |
| seereon.masters.eval-params            | src/lib/performance-config.ts               | evaluation_parameters                                                                                                                                                 |
| seereon.masters.holiday-calendars      | src/lib/hr-masters.ts                       | holiday_calendars, holidays                                                                                                                                           |
| seereon.masters.insurance-plans        | src/lib/hr-masters.ts                       | insurance_plans                                                                                                                                                       |
| seereon.masters.leave                  | src/lib/hr-masters.ts                       | leave_policies, leave_types                                                                                                                                           |
| seereon.masters.leave-policy           | src/lib/hr-masters.ts                       | leave_policies                                                                                                                                                        |
| seereon.masters.salary-structures      | src/lib/salary-engine.ts                    | salary_components, salary_structures                                                                                                                                  |
| seereon.org.hr-partners.v1             | src/lib/hr-partner.ts                       | hr_partner_assignments                                                                                                                                                |
| seereon.org.managers.v1                | src/lib/manager-data.ts                     | manager_assignments                                                                                                                                                   |
| seereon.org.settings.toggles.v1        | src/pages/OrgSettingsPage.tsx               | org_security_settings                                                                                                                                                 |
| seereon.org.substitutes.v1             | src/lib/manager-data.ts                     | manager_substitutes                                                                                                                                                   |
| seereon.payroll.policy                 | src/lib/salary-engine.ts                    | payroll_policies                                                                                                                                                      |
| seereon.performance.reviews            | src/lib/performance-config.ts               | review_form_evidence, review_form_goals, review_form_ratings, review_forms                                                                                            |
| seereon.pips.v2                        | src/lib/pip-data.ts                         | pip_attachments, pip_checkpoints, pip_concerned_persons, pip_goals, pip_history, pip_objectives, pip_reviews, pip_support, pip_tasks, pips                            |
| seereon.platform.docs                  | src/lib/platform-data.ts                    | platform_documents                                                                                                                                                    |
| seereon.platform.prefs.v1              | src/lib/platform-data.ts                    | user_preferences, user_wallpapers                                                                                                                                     |
| seereon.platform.settings.v1           | src/lib/platform-data.ts                    | platform_settings                                                                                                                                                     |
| seereon.platform.tenant-users          | src/lib/tenant-users.ts                     | tenant_users                                                                                                                                                          |
| seereon.platform.tickets.v1            | src/lib/support-data.ts                     | platform_support_tickets, platform_ticket_history                                                                                                                     |
| seereon.projects.v2                    | src/lib/project-data.ts                     | project_links, projects                                                                                                                                               |
| seereon.rbac.invited.v1                | src/lib/rbac-store.ts                       | users                                                                                                                                                                 |
| seereon.rbac.logins.v1                 | src/lib/rbac-store.ts                       | user_login_events, user_logins                                                                                                                                        |
| seereon.rbac.org-users.v1              | src/lib/user-store.ts                       | org_user_access, org_user_branch_roles                                                                                                                                |
| seereon.rbac.roles.v1                  | src/lib/rbac-store.ts                       | rbac_role_assignments, rbac_role_branches, rbac_role_events, rbac_role_screen_permissions, rbac_roles                                                                 |
| seereon.rbac.signin-policy.v1          | src/lib/rbac-store.ts                       | signin_policies                                                                                                                                                       |
| seereon.rbac.temp-grants.v1            | src/components/users/TemporaryAccessTab.tsx | temporary_access_grant_screens, temporary_access_grants                                                                                                               |
| seereon.recruit.applicants             | src/lib/recruitment-engine.ts               | applicant_ats_reasons, applicant_history, applicant_skills, applicants                                                                                                |
| seereon.recruit.jobs                   | src/lib/recruitment-engine.ts               | job_posts                                                                                                                                                             |
| seereon.recruitment.career-settings.v1 | src/pages/RecruitmentMastersPage.tsx        | career_settings                                                                                                                                                       |
| seereon.recruitment.offers.v2          | src/lib/onboarding-data.ts                  | offer_components, offer_documents, offer_emails, offer_history, offers                                                                                                |
| seereon.recruitment.scorecards         | src/lib/onboarding-data.ts                  | scorecard_scores, scorecards                                                                                                                                          |
| seereon.tasks.v2                       | src/lib/task-data.ts                        | task_assignees, task_attachments, tasks                                                                                                                               |
| seereon.tax.docs.v2                    | src/lib/tax-data.ts                         | tax_document_history, tax_document_quarters, tax_documents                                                                                                            |
| seereon.team.reviews.v2                | src/lib/manager-data.ts                     | team_review_ack, team_review_attachments, team_review_goals, team_review_params, team_reviews                                                                         |
| seereon.timesheets.v3                  | src/lib/timesheet-data.ts                   | timesheet_entries                                                                                                                                                     |
| seereon.tours.v2                       | src/lib/tour-data.ts                        | tour_proof_documents, tour_travellers, tours                                                                                                                          |
| seereon.training.assignments.v2        | src/lib/training-assign.ts                  | training_assignment_modules, training_assignments, training_review_attachments, training_reviews                                                                      |
| seereon.training.catalog.v1            | src/lib/training-assign.ts                  | training_programme_links, training_programme_materials, training_programme_skills, training_programmes                                                                |
| seereon.wage.attendance.v1             | src/lib/wage-workers.ts                     | wage_attendance                                                                                                                                                       |
| seereon.wage.workers.v1                | src/lib/wage-workers.ts                     | wage_workers                                                                                                                                                          |

Also persisted: shared lists under `seereon.list.<key>` (useSharedList) and master CRUD sections under `seereon.crud.<prefix>.<slug>.v1` → `master_entries` / `master_items`.

## Appendix C — Glossary

| Term            | Meaning                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| PF / EPF / VPF  | Employees' Provident Fund; VPF is voluntary contribution above the statutory rate. |
| UAN             | Universal Account Number (PF).                                                     |
| ECR             | Electronic Challan-cum-Return — monthly PF filing file.                            |
| ESI / ESIC / IP | Employees' State Insurance; IP number identifies the insured person.               |
| PT              | Professional Tax (state levy).                                                     |
| LWF             | Labour Welfare Fund (state levy).                                                  |
| TDS             | Tax Deducted at Source on salary (section 192).                                    |
| Form 16         | Annual TDS certificate issued to employees (Part A and Part B).                    |
| POI             | Proof of investment submitted against IT declarations.                             |
| F&F             | Full-and-final settlement on exit.                                                 |
| LOP             | Loss of pay — unpaid days deducted in payroll.                                     |
| LWD             | Last working day.                                                                  |
| CTC             | Cost to company — annual compensation including employer contributions.            |
| Maker–checker   | Control where the person who prepares a transaction cannot approve it.             |
| Entity          | One legal company (organisation) inside a company group.                           |
| Group view      | Super Admin's collective view across all entities of the group.                    |
