# Routes

Every URL of the app, the screen (view) that renders it and who can open it. Generated from `src/routes/manifest.js` — keep it in sync when adding screens (`node tools/gen-feature-catalog.mjs` refreshes the feature catalogue too).

| Portal              | Prefix              | Layout (shell)                            | Sign-in                                       |
| ------------------- | ------------------- | ----------------------------------------- | --------------------------------------------- |
| Organisation portal | `/org/*`            | `src/components/layout/OrgShell.jsx`      | `/login` → Super Admin or Admin tab           |
| Employee portal     | `/emp/*`            | `src/components/layout/EmployeeShell.jsx` | `/login` → Employee tab (admins also have it) |
| Helpdesk            | `/helpdesk/*`       | `src/components/layout/HelpdeskShell.jsx` | any signed-in user                            |
| Candidate portal    | `/candidate/:token` | none (public, token link)                 | none                                          |

## Screens

| URL                           | Screen                         | View file                                                      | Who can open it                                   |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------- |
| `/candidate/:token`           | Your offer — Seereon           | `src/features/recruitment/views/CandidatePortalView.jsx`       | Public (token link)                               |
| `/emp/appraisals`             | My Appraisals                  | `src/features/performance/views/MyAppraisalsView.jsx`          | Every employee (own records)                      |
| `/emp/assets`                 | My Assets                      | `src/features/assets/views/MyAssetsView.jsx`                   | Every employee (own records)                      |
| `/emp/attendance`             | My Attendance                  | `src/features/attendance/views/MyAttendanceView.jsx`           | Every employee (own records)                      |
| `/emp/complaints`             | Grievances                     | `src/features/exit/views/MyComplaintsView.jsx`                 | Every employee (own records)                      |
| `/emp/dashboard`              | My Dashboard                   | `src/features/dashboard/views/MyDashboardView.jsx`             | Every employee (own records)                      |
| `/emp/goals`                  | My Goals                       | `src/features/performance/views/MyGoalsView.jsx`               | Every employee (own records)                      |
| `/emp/handbook`               | Employee Handbook              | `src/features/organization/views/MyHandbookView.jsx`           | Every employee (own records)                      |
| `/emp/holidays`               | Holiday Calendar               | `src/features/organization/views/MyHolidaysView.jsx`           | Every employee (own records)                      |
| `/emp/it-declaration`         | IT Declaration (Form 12BB)     | `src/features/payroll/views/MyItDeclarationView.jsx`           | Every employee (own records)                      |
| `/emp/it-statement`           | IT Statement                   | `src/features/payroll/views/MyItStatementView.jsx`             | Every employee (own records)                      |
| `/emp/leave`                  | My Leave                       | `src/features/leave/views/MyLeaveView.jsx`                     | Every employee (own records)                      |
| `/emp/loans`                  | Loans & Advances               | `src/features/payroll/views/MyLoansView.jsx`                   | Every employee (own records)                      |
| `/emp/movements`              | My Movements & Letters         | `src/features/employees/views/MyMovementsView.jsx`             | Every employee (own records)                      |
| `/emp/notices`                | Notices & Circulars            | `src/features/communications/views/MyNoticesView.jsx`          | Every employee (own records)                      |
| `/emp/payslips`               | My Payslips & Salary Structure | `src/features/payroll/views/MyPayslipsView.jsx`                | Every employee (own records)                      |
| `/emp/profile`                | My Profile                     | `src/features/employees/views/MyProfileView.jsx`               | Every employee (own records)                      |
| `/emp/projects`               | Projects & Assignments         | `src/features/projects/views/MyProjectsView.jsx`               | Every employee (own records)                      |
| `/emp/referrals`              | Refer a Candidate              | `src/features/employees/views/MyReferralsView.jsx`             | Every employee (own records)                      |
| `/emp/reimbursements`         | Claims & Reimbursements        | `src/features/finance/views/MyReimbursementsView.jsx`          | Every employee (own records)                      |
| `/emp/reports`                | My Reports                     | `src/features/reports/views/MyReportsView.jsx`                 | Every employee (own records)                      |
| `/emp/resignation`            | Resignation & Exit             | `src/features/exit/views/MyResignationView.jsx`                | Every employee (own records)                      |
| `/emp/reviews`                | Team Reviews                   | `src/features/performance/views/MyReviewsView.jsx`             | Every employee (own records)                      |
| `/emp/tasks`                  | My Tasks                       | `src/features/projects/views/MyTasksView.jsx`                  | Every employee (own records)                      |
| `/emp/tax`                    | Proof of Investment            | `src/features/payroll/views/MyTaxView.jsx`                     | Every employee (own records)                      |
| `/emp/timesheets`             | My Timesheets                  | `src/features/timesheets/views/MyTimesheetsView.jsx`           | Every employee (own records)                      |
| `/emp/tours`                  | My Tours                       | `src/features/travel/views/MyToursView.jsx`                    | Every employee (own records)                      |
| `/emp/training`               | My Trainings                   | `src/features/performance/views/MyTrainingView.jsx`            | Every employee (own records)                      |
| `/emp/ytd`                    | YTD Reports & PF Statement     | `src/features/payroll/views/MyYtdView.jsx`                     | Every employee (own records)                      |
| `/forgot-password`            | Forgot Password                | `src/features/auth/views/ForgotPasswordView.jsx`               | Public                                            |
| `/helpdesk`                   | Helpdesk                       | `src/features/helpdesk/views/HelpdeskHomeView.jsx`             | Any signed-in user                                |
| `/helpdesk/all`               | All Tickets                    | `src/features/helpdesk/views/HelpdeskAllView.jsx`              | Any signed-in user                                |
| `/helpdesk/catalog`           | Service Catalogue              | `src/features/helpdesk/views/HelpdeskCatalogView.jsx`          | Any signed-in user                                |
| `/helpdesk/new`               | Raise a Ticket                 | `src/features/helpdesk/views/HelpdeskNewView.jsx`              | Any signed-in user                                |
| `/helpdesk/queue`             | Team Queue                     | `src/features/helpdesk/views/HelpdeskQueueView.jsx`            | Any signed-in user                                |
| `/helpdesk/settings`          | Desk Settings                  | `src/features/helpdesk/views/HelpdeskSettingsView.jsx`         | Any signed-in user                                |
| `/helpdesk/tickets`           | My Helpdesk Tickets            | `src/features/helpdesk/views/HelpdeskTicketsView.jsx`          | Any signed-in user                                |
| `/helpdesk/tickets/:id`       | Ticket                         | `src/features/helpdesk/views/HelpdeskTicketDetailView.jsx`     | Any signed-in user                                |
| `/login`                      | Sign in                        | `src/features/auth/views/SignInView.jsx`                       | Public                                            |
| `/org/announcements`          | Announcements                  | `src/features/communications/views/AnnouncementsView.jsx`      | By role matrix + custom roles (`auth-session.js`) |
| `/org/approvals`              | Approval Engine                | `src/features/administration/views/ApprovalsView.jsx`          | By role matrix + custom roles (`auth-session.js`) |
| `/org/archive`                | System Archive & Soft Delete   | `src/features/administration/views/ArchiveView.jsx`            | By role matrix + custom roles (`auth-session.js`) |
| `/org/asset-rollup`           | Asset Rollup                   | `src/features/assets/views/AssetRollupView.jsx`                | By role matrix + custom roles (`auth-session.js`) |
| `/org/assets`                 | Asset Lifecycle                | `src/features/assets/views/AssetsView.jsx`                     | By role matrix + custom roles (`auth-session.js`) |
| `/org/attendance`             | Attendance                     | `src/features/attendance/views/AttendanceView.jsx`             | By role matrix + custom roles (`auth-session.js`) |
| `/org/claims`                 | Claims & Reimbursements        | `src/features/finance/views/ClaimsView.jsx`                    | By role matrix + custom roles (`auth-session.js`) |
| `/org/compliance`             | Statutory Compliance           | `src/features/payroll/views/ComplianceView.jsx`                | By role matrix + custom roles (`auth-session.js`) |
| `/org/configuration`          | Configuration                  | `src/features/administration/views/ConfigurationView.jsx`      | Super Admin only                                  |
| `/org/dashboard`              | Workspace Dashboard            | `src/features/dashboard/views/DashboardView.jsx`               | By role matrix + custom roles (`auth-session.js`) |
| `/org/delegation`             | Role Delegation                | `src/features/administration/views/DelegationView.jsx`         | By role matrix + custom roles (`auth-session.js`) |
| `/org/employees`              | Employees                      | `src/features/employees/views/EmployeesView.jsx`               | By role matrix + custom roles (`auth-session.js`) |
| `/org/exits`                  | Exit Management                | `src/features/exit/views/ExitsView.jsx`                        | By role matrix + custom roles (`auth-session.js`) |
| `/org/expenditure`            | Expenditure Booking            | `src/features/finance/views/ExpenditureView.jsx`               | By role matrix + custom roles (`auth-session.js`) |
| `/org/finance`                | Finance & Accounts             | `src/features/finance/views/FinanceView.jsx`                   | By role matrix + custom roles (`auth-session.js`) |
| `/org/goals`                  | Goals Management               | `src/features/performance/views/GoalsView.jsx`                 | By role matrix + custom roles (`auth-session.js`) |
| `/org/grievances`             | Grievance Redressal            | `src/features/exit/views/GrievancesView.jsx`                   | By role matrix + custom roles (`auth-session.js`) |
| `/org/groups`                 | Company Groups                 | `src/features/organization/views/GroupsView.jsx`               | By role matrix + custom roles (`auth-session.js`) |
| `/org/holidays`               | Holiday Calendar               | `src/features/organization/views/HolidaysView.jsx`             | By role matrix + custom roles (`auth-session.js`) |
| `/org/leave`                  | Leave Management               | `src/features/leave/views/LeaveView.jsx`                       | By role matrix + custom roles (`auth-session.js`) |
| `/org/masters`                | Master Data                    | `src/features/organization/views/MastersView.jsx`              | By role matrix + custom roles (`auth-session.js`) |
| `/org/notifications`          | Notification Centre            | `src/features/communications/views/NotificationsView.jsx`      | By role matrix + custom roles (`auth-session.js`) |
| `/org/organisation-setup`     | Organisation Setup             | `src/features/administration/views/OrganisationSetupView.jsx`  | Super Admin only                                  |
| `/org/payroll-reports`        | Payroll Reports — YTD, PF & IT | `src/features/payroll/views/PayrollReportsView.jsx`            | By role matrix + custom roles (`auth-session.js`) |
| `/org/performance`            | Performance                    | `src/features/performance/views/PerformanceView.jsx`           | By role matrix + custom roles (`auth-session.js`) |
| `/org/projects`               | Projects & Assignments         | `src/features/projects/views/ProjectsView.jsx`                 | By role matrix + custom roles (`auth-session.js`) |
| `/org/recruitment`            | Recruitment Pipeline           | `src/features/recruitment/views/RecruitmentView.jsx`           | By role matrix + custom roles (`auth-session.js`) |
| `/org/recruitment/candidates` | Candidates                     | `src/features/recruitment/views/RecruitmentCandidatesView.jsx` | By role matrix + custom roles (`auth-session.js`) |
| `/org/recruitment/interviews` | Interviews                     | `src/features/recruitment/views/RecruitmentInterviewsView.jsx` | By role matrix + custom roles (`auth-session.js`) |
| `/org/recruitment/offers`     | Offer Letters & Onboarding     | `src/features/recruitment/views/RecruitmentOffersView.jsx`     | By role matrix + custom roles (`auth-session.js`) |
| `/org/recruitment/postings`   | Job Postings                   | `src/features/recruitment/views/RecruitmentPostingsView.jsx`   | By role matrix + custom roles (`auth-session.js`) |
| `/org/reports`                | Reports                        | `src/features/reports/views/ReportsView.jsx`                   | By role matrix + custom roles (`auth-session.js`) |
| `/org/roles`                  | Roles & Permissions            | `src/features/administration/views/RolesView.jsx`              | By role matrix + custom roles (`auth-session.js`) |
| `/org/roles/new`              | Create Role                    | `src/features/administration/views/RolesNewView.jsx`           | By role matrix + custom roles (`auth-session.js`) |
| `/org/settings`               | Settings                       | `src/features/administration/views/SettingsView.jsx`           | By role matrix + custom roles (`auth-session.js`) |
| `/org/tasks`                  | Task Management                | `src/features/projects/views/TasksView.jsx`                    | By role matrix + custom roles (`auth-session.js`) |
| `/org/tax`                    | Proof of Investment            | `src/features/payroll/views/TaxView.jsx`                       | By role matrix + custom roles (`auth-session.js`) |
| `/org/team`                   | My Team                        | `src/features/employees/views/TeamView.jsx`                    | By role matrix + custom roles (`auth-session.js`) |
| `/org/timesheets`             | Timesheets                     | `src/features/timesheets/views/TimesheetsView.jsx`             | By role matrix + custom roles (`auth-session.js`) |
| `/org/tours`                  | Tours                          | `src/features/travel/views/ToursView.jsx`                      | By role matrix + custom roles (`auth-session.js`) |
| `/org/training`               | Training                       | `src/features/performance/views/TrainingView.jsx`              | By role matrix + custom roles (`auth-session.js`) |
| `/org/users`                  | Users & Logins                 | `src/features/administration/views/UsersView.jsx`              | By role matrix + custom roles (`auth-session.js`) |
| `/reset-password`             | Reset Password                 | `src/features/auth/views/ResetPasswordView.jsx`                | Public                                            |

Legacy URLs (`/org`, `/emp`, `/org/payroll`, `/org/infrastructure`, …) redirect — see `REDIRECTS` in `src/routes/AppRouter.jsx`.
