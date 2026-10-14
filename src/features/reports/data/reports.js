// Dynamic reporting layer — every module contributes its own report definition.
import { ATTENDANCE, ATTENDANCE_MONTH } from "@/features/attendance/data/attendance-data";
import { LEAVE_BALANCES, leaveApplicationStore } from "@/features/leave/data/leave-data";
import { PERF_INDICATORS } from "@/features/performance/data/performance-data";
import { hrAppraisalStore } from "@/features/performance/data/appraisal-data";
import { hrReviewStore } from "@/features/performance/data/hr-review-data";
import { payrollRunStore, periodLabel } from "@/features/payroll/data/payroll-engine";
import {
  terminationStore,
  warningStore,
  promotionStore,
  transferStore,
} from "@/features/employees/data/people-cases";
import { grievanceStore } from "@/features/exit/data/grievance-data";
import {
  trainingCatalogStore,
  trainingAssignmentStore,
} from "@/features/performance/data/training-assign";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { useScopeMatch } from "@/features/organization/data/tenancy";
import {
  JOB_POSTINGS,
  INTERVIEWS,
  ASSESSMENTS,
  OFFERS,
  SEED_CANDIDATES,
} from "@/features/recruitment/data/recruitment-data";
import { timesheetStore } from "@/features/timesheets/data/timesheet-data";
import { reimbursementStore, insuranceStore } from "@/features/finance/data/claims-data";
import { teamReviewStore, managerStore } from "@/features/organization/data/manager-data";
import { inr } from "@/lib/store";
import { useTasks } from "@/features/projects/data/task-data";
import { goalStore } from "@/features/performance/data/goals-data";
import { useExtraReports } from "@/features/reports/data/reports-extra";
import {
  FY_MONTHS,
  fyMonthIso,
  revenueFor,
  expensesFor,
  sum,
  EXPENSE_HEADS,
} from "@/features/reports/data/exec-reports";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * @typedef {Object} ReportDef
 * @property {string} key
 * @property {string} name
 * @property {string} category
 * @property {string} description
 * @property {string[]} columns
 * @property {(string | number)[][]} rows
 * @property {{ label: string, value: string }[]} summary
 * @property {number} [dateColumn] - Index of the column holding an ISO date — enables date range / month / year filters.
 * @property {AppRole[]} [roles] - Roles allowed to see this report. Omitted = every org-portal role.
 */

export const REPORT_CATEGORIES = [
  "Exit & Retention",
  "Grievance",
  "Loans",
  "Helpdesk",
  "Assets & Infra",
  "Compliance",
  "Tours",
  "Attendance",
  "Leave",
  "Payroll",
  "Performance",
  "Timesheets",
  "Claims",
  "People",
  "Training",
  "Recruitment",
  "Revenue",
  "Finance",
  "Expenses",
  "Tasks & Goals",
];

/** Reports a role is allowed to open. The group Super Admin sees every report. */
export function reportsForRole(all, role) {
  return all.filter((r) => role === "SuperAdmin" || !r.roles || r.roles.includes(role));
}

/* Role sets for sensitive reports — salary, CTC and disciplinary data must not reach line managers / HODs. */
const PAY_ROLES = ["SuperAdmin", "Admin", "CEO", "CFO", "CHRO", "HR"];
const PEOPLE_CONFIDENTIAL = ["SuperAdmin", "Admin", "CEO", "CHRO", "HR"];
const RECRUITMENT_ROLES = ["SuperAdmin", "Admin", "CEO", "CHRO", "HR"];
const LINE_ROLES = ["SuperAdmin", "Admin", "CEO", "COO", "CTO", "CHRO", "HR", "HOD", "Manager"];

/** Builds every report from live in-memory data. Call inside a component (subscribes to stores). */
export function useReports(fy = "FY 2026-27") {
  const extra = useExtraReports();
  return [...extra, ...useBaseReports(fy)];
}

function useBaseReports(fy = "FY 2026-27") {
  // Working scope (company / branch, or the group in the collective view). Every people-linked record is kept only
  // when its company — or its employee's company and branch — is in scope; the base reports used to show every
  // company's leave, payroll, appraisals and cases to any company admin, HOD or manager.
  const inScope = useScopeMatch();
  const ALL_EMPLOYEES = useDirectory();
  const idByName = new Map(ALL_EMPLOYEES.map((e) => [e.name, e.id]));
  const keep = (r) =>
    inScope(
      r.orgId,
      r.empId ??
        r.employeeId ??
        r.ownerId ??
        (typeof r.employee === "string" ? idByName.get(r.employee) : undefined) ??
        (typeof r.name === "string" ? idByName.get(r.name) : undefined),
    );
  const timesheets = timesheetStore.use().filter(keep);
  const claims = reimbursementStore.use().filter(keep);
  const insurance = insuranceStore.use().filter(keep);
  const teamReviews = teamReviewStore.use().filter(keep);
  // Live stores — the reports previously read the static seeds and never showed anything created in the app.
  const LEAVE_APPLICATIONS = leaveApplicationStore.use().filter(keep);
  const APPRAISALS = hrAppraisalStore
    .use()
    .filter(keep)
    .map((a) => ({
      id: a.id,
      employee: a.employee,
      cycle: a.cycle,
      rating: a.rating,
      method: a.method,
      percentage: a.percentage,
      currentCtc: a.currentCtc,
      newCtc: a.newCtc,
      effectiveFrom: a.effectiveFrom,
      status: a.status,
    }));
  const EMPLOYEE_REVIEW_ROWS = hrReviewStore
    .use()
    .filter(keep)
    .map((r) => ({
      id: r.id,
      employee: r.employee,
      reviewer: r.reviewer,
      cycle: r.cycle,
      date: r.date,
      rating: r.rating,
      status: r.status,
    }));
  const managers = managerStore.use();
  const tasks = useTasks();
  const goals = goalStore.use().filter(keep);
  // Payroll runs belong to one company; their lines are narrowed to the branch in view.
  const payrollRuns = payrollRunStore.use().filter((r) => inScope(r.orgId));
  const TERMINATIONS = terminationStore.use().filter(keep);
  const WARNINGS = warningStore.use().filter(keep);
  const COMPLAINTS = grievanceStore.use().filter(keep);
  const PROMOTIONS = promotionStore.use().filter(keep);
  const TRANSFERS = transferStore.use().filter(keep);
  const TRAININGS = trainingCatalogStore.use();
  const TRAINING_ASSIGNMENTS = trainingAssignmentStore.use().filter(keep);
  // Live directory (seeded employees + hires registered this session) so headcount reports include new joiners.
  const EMPLOYEES = ALL_EMPLOYEES.filter((e) => inScope(e.orgId, null, e.branch));

  const empName = (id) => ALL_EMPLOYEES.find((e) => e.id === id)?.name ?? id;
  const revenue = revenueFor(fy);
  const expenses = expensesFor(fy);
  const monthRevenue = FY_MONTHS.map((_, m) => revenue.filter((r) => r.monthIndex === m));
  const monthExpense = FY_MONTHS.map((_, m) => expenses.filter((r) => r.monthIndex === m));
  const totalInvoiced = sum(revenue.map((r) => r.invoiced));
  const totalCollected = sum(revenue.map((r) => r.collected));
  const totalExpense = sum(expenses.map((r) => r.amount));
  const salaryCost = sum(
    expenses
      .filter((e) => e.head === "Salaries & Wages" || e.head === "Statutory Contributions")
      .map((e) => e.amount),
  );

  const attendanceRows = ATTENDANCE.filter(keep).map((r) => {
    const vals = Object.values(r.days);
    const p = vals.filter((v) => v === "P").length;
    const a = vals.filter((v) => v === "A").length;
    const l = vals.filter((v) => v === "L").length;
    return [
      r.empId,
      r.name,
      r.designation,
      r.office,
      r.shift,
      p,
      a,
      l,
      `${Math.round((p / vals.length) * 100)}%`,
    ];
  });
  const totalP = attendanceRows.reduce((s, r) => s + r[5], 0);
  const totalA = attendanceRows.reduce((s, r) => s + r[6], 0);
  const totalL = attendanceRows.reduce((s, r) => s + r[7], 0);

  const leaveBalanceRows = LEAVE_BALANCES.filter(keep).map((b) => {
    const used = Object.values(b.balances).reduce((s, x) => s + x.used, 0);
    const total = Object.values(b.balances).reduce((s, x) => s + x.total, 0);
    return [b.empId, b.employee, b.designation, b.office, used, total - used, total];
  });

  // Deductions & net pay come from the latest processed / paid payroll register — the same numbers as the payslips.
  const latestRun = [...payrollRuns]
    .filter((p) => p.status === "Processed" || p.status === "Paid")
    .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
  const deductionRows = (latestRun?.lines ?? [])
    .filter((l) => inScope(latestRun.orgId, l.empId))
    .map((l) => {
      const ins = l.deductions.find((d) => /insurance/i.test(d.label))?.amount ?? 0;
      return [
        l.empId,
        l.name,
        l.dept,
        inr(l.earnedGross),
        inr(l.totalDeductions - ins),
        inr(ins),
        inr(l.totalDeductions),
        inr(l.net),
      ];
    });

  const tsByEmp = new Map();
  timesheets.forEach((t) => {
    const cur = tsByEmp.get(t.empId) ?? { name: t.employee, hours: 0, entries: 0, approved: 0 };
    cur.hours += t.hours;
    cur.entries += 1;
    cur.approved += t.status === "Approved" ? 1 : 0;
    tsByEmp.set(t.empId, cur);
  });

  return [
    {
      key: "attendance-summary",
      name: "Attendance Summary (PAL)",
      category: "Attendance",
      description: `Present / Absent / Leave counts for ${ATTENDANCE_MONTH}`,
      columns: [
        "Emp ID",
        "Employee",
        "Designation",
        "Office",
        "Shift",
        "Present",
        "Absent",
        "Leave",
        "Attendance %",
      ],
      rows: attendanceRows,
      summary: [
        { label: "Employees", value: String(attendanceRows.length) },
        { label: "Present days", value: String(totalP) },
        { label: "Absent days", value: String(totalA) },
        { label: "Leave days", value: String(totalL) },
      ],
    },
    {
      key: "leave-applications",
      name: "Leave Applications",
      category: "Leave",
      description: "Every leave request with its approval outcome",
      columns: ["Ref", "Employee", "Leave Type", "From", "To", "Days", "Status", "Reason"],
      dateColumn: 3,
      rows: LEAVE_APPLICATIONS.map((l) => [
        l.id,
        l.employee,
        l.leaveType,
        l.from,
        l.to,
        l.days,
        l.status,
        l.decisionReason ?? l.description,
      ]),
      summary: [
        { label: "Total", value: String(LEAVE_APPLICATIONS.length) },
        {
          label: "Pending",
          value: String(LEAVE_APPLICATIONS.filter((l) => l.status === "Pending").length),
        },
        {
          label: "Approved",
          value: String(LEAVE_APPLICATIONS.filter((l) => l.status === "Approved").length),
        },
        { label: "Leave days", value: String(LEAVE_APPLICATIONS.reduce((s, l) => s + l.days, 0)) },
      ],
    },
    {
      key: "leave-balance",
      name: "Leave Balance",
      category: "Leave",
      description: "Consumed versus remaining leave per employee",
      columns: ["Emp ID", "Employee", "Designation", "Office", "Used", "Remaining", "Entitlement"],
      rows: leaveBalanceRows,
      summary: [
        { label: "Employees", value: String(leaveBalanceRows.length) },
        {
          label: "Leave used",
          value: String(leaveBalanceRows.reduce((s, r) => s + r[4], 0)),
        },
        {
          label: "Leave remaining",
          value: String(leaveBalanceRows.reduce((s, r) => s + r[5], 0)),
        },
      ],
    },
    {
      key: "payroll-runs",
      name: "Payroll Runs",
      category: "Payroll",
      roles: PAY_ROLES,
      description:
        "Payroll cycles with attendance-linked LOP, statutory totals and approval status",
      columns: [
        "Run",
        "Title",
        "Period",
        "Pay date",
        "Employees",
        "Structure gross",
        "LOP",
        "Earned gross",
        "PF (EE)",
        "ESI (EE)",
        "PT",
        "TDS",
        "Deductions",
        "Net",
        "Status",
      ],
      dateColumn: 3,
      rows: payrollRuns.map((p) => [
        p.id,
        p.title,
        periodLabel(p.period),
        p.payDate,
        p.totals.employees,
        inr(p.totals.structureGross),
        inr(p.totals.lop),
        inr(p.totals.earnedGross),
        inr(p.totals.pfEmployee + p.totals.vpf),
        inr(p.totals.esiEmployee),
        inr(p.totals.pt),
        inr(p.totals.tds),
        inr(p.totals.deductions),
        inr(p.totals.net),
        p.status,
      ]),
      summary: [
        { label: "Runs", value: String(payrollRuns.length) },
        {
          label: "Net paid (processed)",
          value: inr(
            payrollRuns
              .filter((p) => p.status === "Processed" || p.status === "Paid")
              .reduce((s, p) => s + p.totals.net, 0),
          ),
        },
        {
          label: "TDS deducted",
          value: inr(
            payrollRuns
              .filter((p) => p.status === "Processed" || p.status === "Paid")
              .reduce((s, p) => s + p.totals.tds, 0),
          ),
        },
      ],
    },
    {
      key: "deductions",
      name: "Deductions & Net Pay",
      category: "Payroll",
      roles: PAY_ROLES,
      description: latestRun
        ? `Statutory, insurance and total deductions per employee — ${periodLabel(latestRun.period)} register (${latestRun.id})`
        : "Statutory, insurance and total deductions per employee — no processed payroll yet",
      columns: [
        "Emp ID",
        "Employee",
        "Department",
        "Gross",
        "Standard deductions",
        "Insurance",
        "Total deductions",
        "Net pay",
      ],
      rows: deductionRows,
      summary: [
        { label: "Employees", value: String(deductionRows.length) },
        { label: "Gross", value: inr(latestRun?.totals.earnedGross ?? 0) },
        {
          label: "Insurance deductions",
          value: inr(
            insurance.filter((i) => i.status === "Active").reduce((s, i) => s + i.deduction, 0),
          ),
        },
      ],
    },
    {
      key: "appraisals",
      name: "Appraisals",
      category: "Performance",
      roles: PAY_ROLES,
      description: "Hikes granted by review cycle and method",
      columns: [
        "Ref",
        "Employee",
        "Cycle",
        "Rating",
        "Method",
        "Hike %",
        "Current CTC",
        "New CTC",
        "Effective",
        "Status",
      ],
      dateColumn: 8,
      rows: APPRAISALS.map((a) => [
        a.id,
        a.employee,
        a.cycle,
        a.rating,
        a.method,
        `${a.percentage}%`,
        inr(a.currentCtc),
        inr(a.newCtc),
        a.effectiveFrom,
        a.status,
      ]),
      summary: [
        { label: "Appraisals", value: String(APPRAISALS.length) },
        {
          label: "Avg hike",
          value: `${(APPRAISALS.reduce((s, a) => s + a.percentage, 0) / (APPRAISALS.length || 1)).toFixed(1)}%`,
        },
        {
          label: "CTC impact",
          value: inr(APPRAISALS.reduce((s, a) => s + (a.newCtc - a.currentCtc), 0)),
        },
      ],
    },
    {
      key: "reviews",
      name: "Performance Reviews",
      category: "Performance",
      description: "HR-scheduled reviews plus manager reviews from the employee portal",
      columns: ["Ref", "Employee", "Reviewer", "Cycle", "Date", "Rating", "Status", "Source"],
      rows: [
        ...EMPLOYEE_REVIEW_ROWS.map((r) => [
          r.id,
          r.employee,
          r.reviewer,
          r.cycle,
          r.date,
          r.rating || "—",
          r.status,
          "HR",
        ]),
        ...teamReviews.map((r) => [
          r.id,
          r.employee,
          r.manager,
          r.cycle,
          r.date,
          r.rating || "—",
          r.status,
          "Manager",
        ]),
      ],
      summary: [
        { label: "Reviews", value: String(EMPLOYEE_REVIEW_ROWS.length + teamReviews.length) },
        {
          label: "Completed",
          value: String(
            teamReviews.filter((r) => r.status === "Completed").length +
              EMPLOYEE_REVIEW_ROWS.filter((r) => r.status === "Completed").length,
          ),
        },
        { label: "Manager-led", value: String(teamReviews.length) },
      ],
    },
    {
      key: "indicators",
      name: "Performance Indicators",
      category: "Performance",
      description: "Indicator master with targets in use",
      columns: ["Code", "Name", "Category", "Unit", "Target", "Status"],
      rows: PERF_INDICATORS.map((i) => [i.id, i.name, i.category, i.unit, i.target, i.status]),
      summary: [{ label: "Indicators", value: String(PERF_INDICATORS.length) }],
    },
    {
      key: "timesheets",
      name: "Timesheet Effort",
      category: "Timesheets",
      description: "Hours logged per employee and approval progress",
      columns: ["Emp ID", "Employee", "Entries", "Approved", "Total hours"],
      rows: Array.from(tsByEmp.entries()).map(([id, v]) => [
        id,
        v.name,
        v.entries,
        v.approved,
        v.hours,
      ]),
      summary: [
        { label: "Entries", value: String(timesheets.length) },
        { label: "Hours logged", value: timesheets.reduce((s, t) => s + t.hours, 0).toFixed(2) },
        {
          label: "Pending approval",
          value: String(timesheets.filter((t) => t.status === "Submitted").length),
        },
      ],
    },
    {
      key: "reimbursements",
      name: "Reimbursement Claims",
      category: "Claims",
      roles: PAY_ROLES,
      description: "Claims raised, approved, rejected and settled",
      columns: ["Claim", "Employee", "Type", "Category", "Amount", "Date", "Status"],
      dateColumn: 5,
      rows: claims.map((c) => [
        c.id,
        c.employee,
        c.type,
        c.category,
        inr(c.amount),
        c.date,
        c.status,
      ]),
      summary: [
        { label: "Claims", value: String(claims.length) },
        { label: "Claimed", value: inr(claims.reduce((s, c) => s + c.amount, 0)) },
        { label: "Pending", value: String(claims.filter((c) => c.status === "Submitted").length) },
      ],
    },
    {
      key: "insurance",
      name: "Insurance Coverage",
      category: "Claims",
      roles: PAY_ROLES,
      description: "Policies assigned and their payroll impact",
      columns: [
        "Policy",
        "Employee",
        "Type",
        "Category",
        "Cover",
        "Monthly deduction",
        "Valid from",
        "Valid to",
        "Status",
      ],
      dateColumn: 6,
      rows: insurance.map((i) => [
        i.id,
        i.employee,
        i.type,
        i.category,
        inr(i.amount),
        inr(i.deduction),
        i.validFrom,
        i.validTo,
        i.status,
      ]),
      summary: [
        { label: "Policies", value: String(insurance.length) },
        { label: "Total cover", value: inr(insurance.reduce((s, i) => s + i.amount, 0)) },
        { label: "Monthly premium", value: inr(insurance.reduce((s, i) => s + i.deduction, 0)) },
      ],
    },
    {
      key: "headcount",
      name: "Headcount & Reporting Lines",
      category: "People",
      description: "Directory with department, branch and reporting manager",
      columns: [
        "Emp ID",
        "Employee",
        "Department",
        "Designation",
        "Branch",
        "Reporting manager",
        "Status",
      ],
      rows: EMPLOYEES.map((e) => [
        e.id,
        e.name,
        e.dept,
        e.role,
        e.branch,
        EMPLOYEES.find((m) => m.id === managers[e.id])?.name ?? "—",
        e.status,
      ]),
      summary: [
        { label: "Headcount", value: String(EMPLOYEES.length) },
        { label: "Active", value: String(EMPLOYEES.filter((e) => e.status === "Active").length) },
        {
          label: "On notice",
          value: String(EMPLOYEES.filter((e) => e.status === "Notice").length),
        },
      ],
    },
    {
      key: "cases",
      name: "Disciplinary & Grievance Cases",
      category: "People",
      roles: PEOPLE_CONFIDENTIAL,
      description: "Terminations, warnings and complaints in one register",
      columns: ["Ref", "Kind", "Employee", "Type", "Date", "Status", "Detail"],
      rows: [
        ...TERMINATIONS.map((t) => [
          t.id,
          "Termination",
          t.employee,
          t.type,
          t.lastWorkingDay,
          t.status,
          t.reason,
        ]),
        ...WARNINGS.map((w) => [
          w.id,
          "Warning",
          w.employee,
          `${w.type} · ${w.severity}`,
          w.issuedOn,
          w.acknowledged ? "Acknowledged" : w.status,
          w.category,
        ]),
        ...COMPLAINTS.map((c) => [
          c.id,
          "Grievance",
          c.anonymous ? "Anonymous" : c.employee,
          c.category,
          c.raisedOn,
          c.status,
          c.subject,
        ]),
      ],
      summary: [
        { label: "Terminations", value: String(TERMINATIONS.length) },
        { label: "Warnings", value: String(WARNINGS.length) },
        { label: "Grievances", value: String(COMPLAINTS.length) },
      ],
    },
    {
      key: "movements",
      name: "Promotions & Transfers Register",
      category: "People",
      roles: PEOPLE_CONFIDENTIAL,
      description: "Every promotion / appraisal outcome and transfer with letter references",
      columns: ["Ref", "Kind", "Employee", "From", "To", "Effective", "Status", "Letter"],
      rows: [
        ...PROMOTIONS.map((p) => [
          p.id,
          "Promotion",
          p.employee,
          `${p.fromDesignation} · ${p.fromGrade} · ₹${p.fromCtc.toLocaleString("en-IN")}`,
          `${p.toDesignation} · ${p.toGrade} · ₹${p.toCtc.toLocaleString("en-IN")} (${p.hikePct} %)`,
          p.effectiveFrom,
          p.status,
          p.letterRef ?? "—",
        ]),
        ...TRANSFERS.map((t) => [
          t.id,
          `Transfer · ${t.type}`,
          t.employee,
          `${t.fromDept}, ${t.fromBranch}`,
          `${t.toDept}, ${t.toBranch}`,
          t.effectiveFrom,
          t.status,
          t.letterRef ?? "—",
        ]),
      ],
      summary: [
        { label: "Promotions", value: String(PROMOTIONS.length) },
        { label: "Transfers", value: String(TRANSFERS.length) },
        {
          label: "Effective",
          value: String(
            [...PROMOTIONS, ...TRANSFERS].filter((x) => x.status === "Effective").length,
          ),
        },
      ],
    },
    {
      key: "job-postings",
      name: "Job Postings",
      category: "Recruitment",
      description: "Open requisitions with positions, experience band and deadlines",
      columns: [
        "Ref",
        "Title",
        "Job type",
        "Location",
        "Branch",
        "Positions",
        "Priority",
        "Experience",
        "Salary band",
        "Deadline",
      ],
      dateColumn: 9,
      rows: JOB_POSTINGS.map((j) => [
        j.id,
        j.title,
        j.jobType,
        j.location,
        j.branch,
        j.positions,
        j.priority,
        `${j.minExp} – ${j.maxExp}`,
        `${j.minSalary} – ${j.maxSalary}`,
        j.deadline,
      ]),
      summary: [
        { label: "Postings", value: String(JOB_POSTINGS.length) },
        {
          label: "Open positions",
          value: String(JOB_POSTINGS.reduce((s, j) => s + (Number(j.positions) || 0), 0)),
        },
      ],
    },
    {
      key: "candidates",
      name: "Candidate Pipeline",
      category: "Recruitment",
      roles: RECRUITMENT_ROLES,
      description: "Applicants with source, experience and current pipeline stage",
      columns: [
        "Ref",
        "Candidate",
        "Position",
        "Job type",
        "Source",
        "Experience",
        "Current CTC",
        "Expected CTC",
        "Stage",
      ],
      rows: SEED_CANDIDATES.map((c) => [
        c.id,
        c.name,
        c.position,
        c.jobType,
        c.source,
        c.experience,
        c.currentCtc,
        c.expectedCtc,
        c.stage,
      ]),
      summary: [
        { label: "Candidates", value: String(SEED_CANDIDATES.length) },
        {
          label: "In interview",
          value: String(SEED_CANDIDATES.filter((c) => c.stage === "Interviewing").length),
        },
      ],
    },
    {
      key: "interviews",
      name: "Interviews",
      category: "Recruitment",
      description: "Scheduled interviews, panels and feedback",
      columns: [
        "Ref",
        "Candidate",
        "Round",
        "Type",
        "Scheduled",
        "Duration",
        "Location",
        "Interviewers",
        "Feedback",
      ],
      dateColumn: 4,
      rows: INTERVIEWS.map((i) => [
        i.id,
        i.candidate,
        i.round,
        i.type,
        i.scheduledAt,
        i.duration,
        i.location,
        i.interviewers,
        i.feedback,
      ]),
      summary: [{ label: "Interviews", value: String(INTERVIEWS.length) }],
    },
    {
      key: "assessments",
      name: "Candidate Assessments",
      category: "Recruitment",
      description: "Scores and recommendations captured by interview panels",
      columns: [
        "Ref",
        "Candidate",
        "Round",
        "Criteria",
        "Score",
        "Rating",
        "Recommendation",
        "Remarks",
      ],
      rows: ASSESSMENTS.map((a) => [
        a.id,
        a.candidate,
        a.round,
        a.criteria,
        a.score,
        a.rating,
        a.recommendation,
        a.remarks,
      ]),
      summary: [
        { label: "Assessments", value: String(ASSESSMENTS.length) },
        {
          label: "Recommended",
          value: String(ASSESSMENTS.filter((a) => a.recommendation === "Proceed").length),
        },
      ],
    },
    {
      key: "offers",
      name: "Offers Released",
      category: "Recruitment",
      roles: RECRUITMENT_ROLES,
      description: "Offer letters issued and their acceptance status",
      columns: ["Ref", "Candidate", "Position", "Department", "Salary", "Status"],
      rows: OFFERS.map((o) => [
        o.id,
        o.candidate,
        o.position,
        o.department,
        o.salary,
        o.status || "—",
      ]),
      summary: [{ label: "Offers", value: String(OFFERS.length) }],
    },
    {
      key: "training",
      name: "Training Programmes",
      category: "Training",
      description:
        "Catalogue with purpose, mode, timeline, deadline and assignment / certification counts",
      columns: [
        "Code",
        "Title",
        "Type",
        "Purpose",
        "Trainer",
        "Mode",
        "Hours",
        "Start",
        "End",
        "Deadline",
        "Mandatory",
        "Assigned",
        "Certified",
        "Status",
      ],
      rows: TRAININGS.map((t) => {
        const a = TRAINING_ASSIGNMENTS.filter((x) => x.trainingId === t.id);
        return [
          t.id,
          t.title,
          t.type,
          t.purpose,
          t.trainer,
          t.mode,
          t.durationHours,
          t.start,
          t.end,
          t.deadline,
          t.mandatory ? "Yes" : "No",
          a.length,
          a.filter((x) => x.certificateRef).length,
          t.status,
        ];
      }),
      summary: [
        { label: "Programmes", value: String(TRAININGS.length) },
        { label: "Assignments", value: String(TRAINING_ASSIGNMENTS.length) },
        {
          label: "Certified",
          value: String(TRAINING_ASSIGNMENTS.filter((x) => x.certificateRef).length),
        },
      ],
    },
    {
      key: "training-reviews",
      name: "Training Reviews & Certifications",
      category: "Training",
      description:
        "Parameter-based training reviews per employee with ratings, outcome, recommendation and certificate",
      columns: [
        "Employee",
        "Training",
        "Purpose",
        "Deadline",
        "Progress",
        "Status",
        "Skills",
        "Efficiency",
        "Knowledge",
        "Participation",
        "Application",
        "Overall",
        "Outcome",
        "Recommendation",
        "Certificate",
      ],
      rows: TRAINING_ASSIGNMENTS.map((a) => [
        `${a.employee} (${a.empId})`,
        a.training,
        a.purpose ?? "—",
        a.dueDate,
        `${a.progress} %`,
        a.status,
        a.review?.ratings.skills ?? "—",
        a.review?.ratings.efficiency ?? "—",
        a.review?.ratings.knowledge ?? "—",
        a.review?.ratings.participation ?? "—",
        a.review?.ratings.application ?? "—",
        a.review?.overall ?? "—",
        a.review?.outcome ?? "—",
        a.review?.recommendation ?? "—",
        a.certificateRef ?? "—",
      ]),
      summary: [
        { label: "Reviewed", value: String(TRAINING_ASSIGNMENTS.filter((x) => x.review).length) },
        {
          label: "Certified",
          value: String(TRAINING_ASSIGNMENTS.filter((x) => x.certificateRef).length),
        },
        {
          label: "Overdue",
          value: String(
            TRAINING_ASSIGNMENTS.filter((x) => x.status !== "Completed" && x.dueDate < todayLocal())
              .length,
          ),
        },
      ],
    },

    /* ---------------- Executive: revenue ---------------- */
    {
      key: "revenue-summary",
      name: "Revenue Summary (Month-wise)",
      category: "Revenue",
      description: `Invoiced vs collected revenue, ${fy} (Apr–Mar)`,
      roles: ["Admin", "CEO", "CFO"],
      columns: ["Month", "Period", "Invoiced", "Collected", "Outstanding", "Realisation %"],
      dateColumn: 1,
      rows: FY_MONTHS.map((m, i) => {
        const inv = sum(monthRevenue[i].map((r) => r.invoiced));
        const col = sum(monthRevenue[i].map((r) => r.collected));
        return [
          m,
          fyMonthIso(fy, i),
          inr(inv),
          inr(col),
          inr(inv - col),
          `${inv ? Math.round((col / inv) * 100) : 0}%`,
        ];
      }),
      summary: [
        { label: "Invoiced", value: inr(totalInvoiced) },
        { label: "Collected", value: inr(totalCollected) },
        { label: "Outstanding", value: inr(totalInvoiced - totalCollected) },
        {
          label: "Realisation",
          value: `${totalInvoiced ? Math.round((totalCollected / totalInvoiced) * 100) : 0}%`,
        },
      ],
    },
    {
      key: "revenue-clients",
      name: "Revenue by Client & Service Line",
      category: "Revenue",
      description: `Client-wise contribution for ${fy}`,
      roles: ["Admin", "CEO", "CFO"],
      columns: ["Client", "Service line", "Region", "Invoiced", "Collected", "Share %"],
      rows: Array.from(new Set(revenue.map((r) => r.client))).map((client) => {
        const rs = revenue.filter((r) => r.client === client);
        const inv = sum(rs.map((r) => r.invoiced));
        return [
          client,
          rs[0].serviceLine,
          rs[0].region,
          inr(inv),
          inr(sum(rs.map((r) => r.collected))),
          `${totalInvoiced ? Math.round((inv / totalInvoiced) * 100) : 0}%`,
        ];
      }),
      summary: [
        { label: "Clients", value: String(new Set(revenue.map((r) => r.client)).size) },
        { label: "Invoiced", value: inr(totalInvoiced) },
      ],
    },

    /* ---------------- Executive: finance ---------------- */
    {
      key: "pnl",
      name: "Profit & Loss Statement",
      category: "Finance",
      description: `Month-wise revenue, cost and margin for ${fy}`,
      roles: ["Admin", "CEO", "CFO"],
      columns: ["Month", "Period", "Revenue", "Total cost", "EBITDA", "Margin %"],
      dateColumn: 1,
      rows: FY_MONTHS.map((m, i) => {
        const rev = sum(monthRevenue[i].map((r) => r.invoiced));
        const cost = sum(monthExpense[i].map((r) => r.amount));
        return [
          m,
          fyMonthIso(fy, i),
          inr(rev),
          inr(cost),
          inr(rev - cost),
          `${rev ? Math.round(((rev - cost) / rev) * 100) : 0}%`,
        ];
      }),
      summary: [
        { label: "Revenue", value: inr(totalInvoiced) },
        { label: "Cost", value: inr(totalExpense) },
        { label: "EBITDA", value: inr(totalInvoiced - totalExpense) },
        {
          label: "Margin",
          value: `${totalInvoiced ? Math.round(((totalInvoiced - totalExpense) / totalInvoiced) * 100) : 0}%`,
        },
      ],
    },
    {
      key: "expense-analysis",
      name: "Expense Analysis (Budget vs Actual)",
      category: "Expenses",
      description: `Cost head performance against budget for ${fy}`,
      roles: ["Admin", "CEO", "CFO"],
      columns: ["Cost head", "Cost centre", "Budget", "Actual", "Variance", "Utilisation %"],
      rows: EXPENSE_HEADS.map((head) => {
        const rs = expenses.filter((e) => e.head === head);
        const bud = sum(rs.map((r) => r.budget));
        const act = sum(rs.map((r) => r.amount));
        return [
          head,
          rs[0]?.costCentre ?? "—",
          inr(bud),
          inr(act),
          inr(bud - act),
          `${bud ? Math.round((act / bud) * 100) : 0}%`,
        ];
      }),
      summary: [
        { label: "Budget", value: inr(sum(expenses.map((e) => e.budget))) },
        { label: "Actual", value: inr(totalExpense) },
        { label: "Variance", value: inr(sum(expenses.map((e) => e.budget)) - totalExpense) },
      ],
    },
    {
      key: "salary-cost",
      name: "Salary & People Cost",
      category: "Expenses",
      description: `Month-wise payroll outflow and statutory contributions, ${fy}`,
      roles: ["Admin", "CEO", "CFO", "CHRO", "HR"],
      columns: ["Month", "Period", "Salaries & wages", "Statutory", "People cost", "% of revenue"],
      dateColumn: 1,
      rows: FY_MONTHS.map((m, i) => {
        const sal = sum(
          monthExpense[i].filter((e) => e.head === "Salaries & Wages").map((e) => e.amount),
        );
        const stat = sum(
          monthExpense[i].filter((e) => e.head === "Statutory Contributions").map((e) => e.amount),
        );
        const rev = sum(monthRevenue[i].map((r) => r.invoiced));
        return [
          m,
          fyMonthIso(fy, i),
          inr(sal),
          inr(stat),
          inr(sal + stat),
          `${rev ? Math.round(((sal + stat) / rev) * 100) : 0}%`,
        ];
      }),
      summary: [
        { label: "People cost", value: inr(salaryCost) },
        { label: "Headcount", value: String(EMPLOYEES.length) },
        {
          label: "Cost / head",
          value: inr(Math.round(salaryCost / Math.max(EMPLOYEES.length, 1))),
        },
      ],
    },

    /* ---------------- Manager: tasks, goals, team ---------------- */
    {
      key: "task-register",
      name: "Task Register & Effort",
      category: "Tasks & Goals",
      description: "Assigned tasks with progress, effort and deadlines",
      roles: LINE_ROLES,
      columns: [
        "Ref",
        "Task",
        "Assignees",
        "Priority",
        "Status",
        "Progress %",
        "Estimated hrs",
        "Logged hrs",
        "Due",
      ],
      dateColumn: 8,
      rows: tasks.map((t) => [
        t.id,
        t.name,
        t.assignees.map(empName).join(", "),
        t.priority,
        t.status,
        t.progress,
        t.estimatedHours,
        t.loggedHours,
        t.dueDate || t.deadline || "",
      ]),
      summary: [
        { label: "Tasks", value: String(tasks.length) },
        { label: "Completed", value: String(tasks.filter((t) => t.status === "Completed").length) },
        {
          label: "In progress",
          value: String(tasks.filter((t) => t.status === "In Progress").length),
        },
        { label: "Hours logged", value: String(sum(tasks.map((t) => t.loggedHours))) },
      ],
    },
    {
      key: "goal-register",
      name: "Goal Achievement Report",
      category: "Tasks & Goals",
      description: "Goals by level, owner, progress and rating",
      roles: LINE_ROLES,
      columns: ["Ref", "Goal", "Owner", "Level", "Weight", "Progress %", "Status", "Rating", "Due"],
      dateColumn: 8,
      rows: goals.map((g) => [
        g.id,
        g.title,
        g.owner,
        g.level,
        g.weight,
        g.progress,
        g.status,
        g.rating,
        g.due,
      ]),
      summary: [
        { label: "Goals", value: String(goals.length) },
        { label: "Completed", value: String(goals.filter((g) => g.status === "Completed").length) },
        {
          label: "Avg progress",
          value: `${goals.length ? Math.round(sum(goals.map((g) => g.progress)) / goals.length) : 0}%`,
        },
      ],
    },
    {
      key: "team-performance",
      name: "Team Performance Scorecard",
      category: "Performance",
      description: "Per-employee goals, tasks and review outcome for the reporting line",
      roles: LINE_ROLES,
      columns: [
        "Emp ID",
        "Employee",
        "Reporting manager",
        "Goals",
        "Avg goal progress",
        "Open tasks",
        "Latest review",
        "Rating",
      ],
      rows: EMPLOYEES.map((e) => {
        const eg = goals.filter((g) => g.ownerId === e.id);
        const et = tasks.filter((t) => t.assignees.includes(e.id) && t.status !== "Completed");
        const rev = teamReviews.filter((r) => r.employee === e.name).slice(-1)[0];
        return [
          e.id,
          e.name,
          EMPLOYEES.find((m) => m.id === managers[e.id])?.name ?? "—",
          eg.length,
          `${eg.length ? Math.round(sum(eg.map((g) => g.progress)) / eg.length) : 0}%`,
          et.length,
          rev?.cycle ?? "—",
          rev?.rating || "—",
        ];
      }),
      summary: [
        { label: "Employees", value: String(EMPLOYEES.length) },
        { label: "Goals tracked", value: String(goals.length) },
        { label: "Reviews recorded", value: String(teamReviews.length) },
      ],
    },
  ];
}
