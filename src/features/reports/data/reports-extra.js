// Reports built from the newer stores (retention, exit surveys, grievances, loans, handbook, tours, helpdesk, assets,
// statutory filings). Merged into useReports() so every designation gets its own catalogue in Reports & Analytics.
import { inr } from "@/lib/store";
import {
  useRetention,
  useExitSurveys,
  useFnf,
  useRejoins,
} from "@/features/exit/data/separation-data";
import { useGrievances, daysToResolve, isOverdue } from "@/features/exit/data/grievance-data";
import { useLoans, outstandingOf } from "@/features/payroll/data/loans-data";
import { useHandbook } from "@/features/organization/data/handbook-data";
import { useTours, tourRoi, tourExpenseTotals } from "@/features/travel/data/tour-data";
import {
  useTickets,
  OPEN_STATUSES,
  departmentById,
  isConfidential,
} from "@/features/helpdesk/data/helpdesk-data";
import { useAssets } from "@/features/assets/data/asset-data";
import { useFilings } from "@/features/payroll/data/statutory-filings";
import { useExitRequests } from "@/features/exit/data/exit-data";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { useLeaveApplications } from "@/features/leave/data/leave-engine";
import {
  useReviews,
  useEvalParams,
  weightedRating,
} from "@/features/performance/data/performance-config";
import { useScopeMatch } from "@/features/organization/data/tenancy";

export const EXTRA_REPORT_CATEGORIES = [
  "Exit & Retention",
  "Grievance",
  "Loans",
  "Helpdesk",
  "Assets & Infra",
  "Compliance",
  "Tours",
];

export function useExtraReports() {
  const retention = useRetention();
  const surveys = useExitSurveys();
  const fnf = useFnf();
  const rejoins = useRejoins();
  const exits = useExitRequests();
  const grievances = useGrievances();
  const loans = useLoans();
  const { versions, acks } = useHandbook();
  const tours = useTours();
  // Assets and tickets carry an orgId — report only the entity in view, not every company in the group.
  const inScope = useScopeMatch();
  const tickets = useTickets().filter((t) => !t.orgId || inScope(t.orgId, t.requesterId));
  const assets = useAssets().filter((a) => inScope(a.orgId));
  const filings = useFilings();
  const dir = useDirectory();
  const [leave] = useLeaveApplications();
  const reviews = useReviews();
  const params = useEvalParams();
  const hb = versions[0];
  const retained = retention.filter((r) => r.status === "Retained").length;
  return [
    {
      key: "retention",
      name: "Employee Retention (HR KRA)",
      category: "Exit & Retention",
      description: "Every retention case opened from a resignation, levers used and outcome",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CHRO", "HR", "HOD"],
      dateColumn: 4,
      columns: [
        "Case",
        "Employee",
        "Department",
        "Manager",
        "Started",
        "Owner",
        "Levers",
        "Offer",
        "Hike %",
        "Status",
        "Closed",
      ],
      rows: retention.map((r) => [
        r.id,
        r.employee,
        r.dept,
        r.managerName,
        r.startedOn,
        r.owner,
        r.offerKind.join(", ") || "—",
        r.offer || "—",
        r.hikePct ?? "—",
        r.status,
        r.closedOn ?? "—",
      ]),
      summary: [
        { label: "Cases", value: String(retention.length) },
        { label: "Retained", value: String(retained) },
        {
          label: "Retention rate",
          value: retention.length ? `${Math.round((retained / retention.length) * 100)} %` : "—",
        },
      ],
    },
    {
      key: "attrition",
      name: "Attrition & Exits",
      category: "Exit & Retention",
      description: "Resignations by stage, reason and notice with F&F status",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CHRO", "HR", "HOD", "Manager"],
      dateColumn: 4,
      columns: [
        "Exit",
        "Employee",
        "Department",
        "Reason",
        "Applied",
        "Stage",
        "Notice days",
        "Last working day",
        "F&F",
      ],
      rows: exits.map((e) => [
        e.id,
        e.empName,
        e.dept,
        e.reason,
        e.appliedOn,
        e.stage,
        e.noticeDays ?? "—",
        e.noticeEnd ?? e.requestedLwd,
        fnf.find((f) => f.exitId === e.id)?.status ?? "—",
      ]),
      summary: [
        { label: "Resignations", value: String(exits.length) },
        {
          label: "Completed",
          value: String(exits.filter((e) => e.stage === "Exit Completed").length),
        },
        {
          label: "Withdrawn / retained",
          value: String(
            exits.filter((e) => e.stage === "Withdrawn" || e.stage === "Retained").length,
          ),
        },
      ],
    },
    {
      key: "exit-surveys",
      name: "Exit Survey / Interview Report",
      category: "Exit & Retention",
      description:
        "Ratings, reasons and rejoin intent — visible to HR Head and Unit / Department Heads",
      roles: ["SuperAdmin", "Admin", "CEO", "CHRO", "HR", "HOD"],
      dateColumn: 3,
      columns: [
        "Ref",
        "Employee",
        "Department",
        "Submitted",
        "Reason",
        "Manager",
        "Culture",
        "Growth",
        "Compensation",
        "Work-life",
        "Would rejoin",
        "Recommend",
        "Feedback",
      ],
      rows: surveys.map((s) => [
        s.id,
        s.employee,
        s.dept,
        s.submittedOn,
        s.reason,
        s.ratings.manager,
        s.ratings.culture,
        s.ratings.growth,
        s.ratings.comp,
        s.ratings.workLife,
        s.rejoin,
        s.recommend,
        s.feedback,
      ]),
      summary: [
        { label: "Surveys", value: String(surveys.length) },
        { label: "Would rejoin", value: String(surveys.filter((s) => s.rejoin === "Yes").length) },
        {
          label: "Avg compensation rating",
          value: surveys.length
            ? (surveys.reduce((t, s) => t + s.ratings.comp, 0) / surveys.length).toFixed(1)
            : "—",
        },
      ],
    },
    {
      key: "fnf-register",
      name: "Full & Final Settlements",
      category: "Exit & Retention",
      description: "Computed settlements with gratuity and recoveries",
      roles: ["SuperAdmin", "Admin", "CEO", "CFO", "CHRO", "HR"],
      dateColumn: 2,
      columns: [
        "Ref",
        "Employee",
        "Exit date",
        "Gross",
        "Deductions",
        "Net",
        "Gratuity",
        "Status",
        "Prepared by",
      ],
      rows: fnf.map((f) => [
        f.id,
        f.employee,
        f.exitDate,
        inr(f.gross),
        inr(f.deductions),
        inr(f.net),
        f.gratuity.eligible ? inr(f.gratuity.amount) : "n/a",
        f.status,
        f.preparedBy,
      ]),
      summary: [
        { label: "Statements", value: String(fnf.length) },
        { label: "Net payable", value: inr(fnf.reduce((t, f) => t + f.net, 0)) },
        { label: "Paid", value: String(fnf.filter((f) => f.status === "Paid").length) },
      ],
    },
    {
      key: "rejoins",
      name: "Rejoin Register (continuity cases)",
      category: "Exit & Retention",
      description: "Employees who returned after exit — continuity vs fresh hire",
      roles: ["SuperAdmin", "Admin", "CEO", "CHRO", "HR"],
      dateColumn: 3,
      columns: [
        "Case",
        "Employee",
        "Exited",
        "Rejoined",
        "Gap (days)",
        "Mode",
        "Original DOJ",
        "F&F reversed",
        "Decided by",
      ],
      rows: rejoins.map((r) => [
        r.id,
        r.employee,
        r.exitedOn,
        r.rejoinOn,
        r.daysGap,
        r.mode,
        r.originalDoj,
        r.fnfReversed ? "Yes" : "No",
        r.decidedBy,
      ]),
      summary: [
        { label: "Rejoins", value: String(rejoins.length) },
        {
          label: "Continuity",
          value: String(rejoins.filter((r) => r.mode.startsWith("Continuity")).length),
        },
      ],
    },
    {
      key: "grievances",
      name: "Grievance Redressal Report",
      category: "Grievance",
      description: "Grievances by category, committee, SLA and resolution time",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CHRO", "HR", "HOD"],
      dateColumn: 5,
      columns: [
        "Ref",
        "Employee",
        "Department",
        "Category",
        "Severity",
        "Raised",
        "Committee",
        "Status",
        "SLA",
        "Resolved",
        "Days",
        "Rating",
      ],
      rows: grievances.map((g) => [
        g.id,
        g.employee,
        g.dept,
        g.category,
        g.severity,
        g.raisedOn,
        g.committee,
        g.status,
        isOverdue(g) ? "Breached" : "On track",
        g.resolvedOn ?? "—",
        daysToResolve(g) ?? "—",
        g.employeeRating ?? "—",
      ]),
      summary: [
        { label: "Grievances", value: String(grievances.length) },
        {
          label: "Open",
          value: String(
            grievances.filter((g) => !["Closed", "Withdrawn"].includes(g.status)).length,
          ),
        },
        { label: "SLA breached", value: String(grievances.filter(isOverdue).length) },
      ],
    },
    {
      key: "loans-advances",
      name: "Loans & Salary Advances",
      category: "Loans",
      description:
        "Applications, EMI schedules and outstanding principal (recovered from payroll / F&F)",
      roles: ["SuperAdmin", "Admin", "CEO", "CFO", "CHRO", "HR"],
      dateColumn: 6,
      columns: [
        "Ref",
        "Employee",
        "Type",
        "Amount",
        "EMI",
        "Tenure",
        "Applied",
        "First EMI",
        "Outstanding",
        "Status",
      ],
      rows: loans.map((l) => [
        l.id,
        l.employee,
        l.kind,
        inr(l.amount),
        inr(l.emi),
        l.tenureMonths,
        l.appliedOn,
        l.firstEmiPeriod,
        inr(outstandingOf(l)),
        l.status,
      ]),
      summary: [
        { label: "Applications", value: String(loans.length) },
        {
          label: "Outstanding",
          value: inr(
            loans.filter((l) => l.status === "Disbursed").reduce((t, l) => t + outstandingOf(l), 0),
          ),
        },
      ],
    },
    {
      key: "handbook-ack",
      name: "Employee Handbook Acknowledgement",
      category: "People",
      description: `Who has acknowledged handbook v${hb?.version ?? "—"}`,
      roles: ["SuperAdmin", "Admin", "CEO", "CHRO", "HR", "HOD"],
      columns: ["Employee", "ID", "Department", "Branch", "Status", "Acknowledged on", "Signature"],
      rows: dir
        .filter((e) => e.status === "Active")
        .map((e) => {
          const a = acks.find((x) => x.empId === e.id && x.version === hb?.version);
          return [
            e.name,
            e.id,
            e.dept,
            e.branch,
            a ? "Acknowledged" : "Pending",
            a?.acknowledgedOn ?? "—",
            a?.signature ?? "—",
          ];
        }),
      summary: [
        { label: "Employees", value: String(dir.filter((e) => e.status === "Active").length) },
        {
          label: "Acknowledged",
          value: String(acks.filter((a) => a.version === hb?.version).length),
        },
      ],
    },
    {
      key: "tour-roi",
      name: "Tour Outcomes & ROI",
      category: "Tours",
      description: "Revenue generated / saved against tour cost, petty cash encashment",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CFO", "HR", "HOD", "Manager"],
      dateColumn: 3,
      columns: [
        "Tour",
        "Employee",
        "Destination",
        "Start",
        "Cost (approved)",
        "Target revenue",
        "Revenue generated",
        "Target savings",
        "Revenue saved",
        "ROI %",
        "Petty cash",
      ],
      rows: tours
        .filter((t) => t.outcomes)
        .map((t) => {
          const r = tourRoi(t);
          const o = t.outcomes;
          return [
            t.id,
            t.employeeName,
            t.destination,
            t.startDate,
            inr(r.cost),
            inr(o.targetRevenue),
            inr(o.revenueGenerated),
            inr(o.targetSavings),
            inr(o.revenueSaved),
            r.roi,
            t.encashment ? inr(t.encashment.amount) : "—",
          ];
        }),
      summary: [
        { label: "Tours", value: String(tours.length) },
        {
          label: "Expenses claimed",
          value: inr(tours.reduce((t, x) => t + tourExpenseTotals(x).all, 0)),
        },
      ],
    },
    {
      key: "helpdesk-tickets",
      name: "Helpdesk Tickets by Department",
      category: "Helpdesk",
      description: "Every ticket with desk, priority, SLA and status",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CTO", "CHRO", "HR", "HOD"],
      dateColumn: 5,
      columns: [
        "Ticket",
        "Subject",
        "Desk",
        "Requester",
        "Priority",
        "Created",
        "Assignee",
        "Status",
      ],
      rows: tickets.map((t) => [
        t.id,
        isConfidential(t) ? "Confidential — grievance" : t.subject,
        departmentById(t.departmentId)?.name ?? t.departmentId,
        t.requesterName,
        t.priority,
        t.createdAt.slice(0, 10),
        t.assigneeName ?? "—",
        t.status,
      ]),
      summary: [
        { label: "Tickets", value: String(tickets.length) },
        {
          label: "Open",
          value: String(tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length),
        },
      ],
    },
    {
      key: "assets-register",
      name: "Asset & Infrastructure Register",
      category: "Assets & Infra",
      description: "Hardware, software and licences with holder and status",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CTO", "CFO", "HR"],
      dateColumn: 5,
      columns: [
        "Tag",
        "Asset",
        "Type",
        "Kind",
        "Serial",
        "Purchased",
        "Cost",
        "Condition",
        "Status",
        "Holder",
      ],
      rows: assets.map((a) => [
        a.tag,
        a.name,
        a.type,
        a.kind,
        a.serial,
        a.purchaseDate,
        inr(a.cost),
        a.condition,
        a.status,
        a.holderId
          ? `${dir.find((e) => e.id === a.holderId)?.name ?? a.holderId} (${a.holderId})`
          : "—",
      ]),
      summary: [
        { label: "Assets", value: String(assets.length) },
        { label: "Value", value: inr(assets.reduce((t, a) => t + a.cost, 0)) },
      ],
    },
    {
      key: "statutory-filings",
      name: "Statutory Filings (PF ECR / ESI / TDS)",
      category: "Compliance",
      description: "Filing status per period with reference numbers",
      roles: ["SuperAdmin", "Admin", "CEO", "CFO", "CHRO", "HR"],
      columns: ["Filing", "Kind", "Period", "Status", "Due", "Filed on", "Reference", "Amount"],
      rows: filings.map((f) => [
        f.id,
        f.kind,
        f.period,
        f.status,
        f.dueOn,
        f.filedOn ?? "—",
        f.referenceNo ?? "—",
        inr(f.totalAmount),
      ]),
      summary: [
        { label: "Filings", value: String(filings.length) },
        {
          label: "Filed / paid",
          value: String(filings.filter((f) => f.status === "Filed" || f.status === "Paid").length),
        },
      ],
    },
    {
      key: "leave-register",
      name: "Leave Applications Register",
      category: "Leave",
      description: "All leave applications with approval chain and status",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CHRO", "HR", "HOD", "Manager"],
      dateColumn: 3,
      columns: ["Ref", "Employee", "Type", "From", "To", "Days", "Chain", "Status", "Decided by"],
      rows: leave.map((l) => [
        l.id,
        l.employee,
        l.leaveType,
        l.from,
        l.to,
        l.days,
        l.approvalChain ?? "Manager",
        l.status,
        l.decidedBy ?? "—",
      ]),
      summary: [
        { label: "Applications", value: String(leave.length) },
        { label: "Pending", value: String(leave.filter((l) => l.status === "Pending").length) },
      ],
    },
    {
      key: "review-forms",
      name: "Review Forms — Quarterly & Annual",
      category: "Performance",
      description: "Self, manager and HR ratings per review form",
      roles: ["SuperAdmin", "Admin", "CEO", "COO", "CHRO", "HR", "HOD", "Manager"],
      columns: [
        "Form",
        "Employee",
        "Kind",
        "Cycle",
        "Status",
        "Self",
        "Manager",
        "Final",
        "Recommendation",
        "Hike %",
      ],
      rows: reviews.map((r) => [
        r.id,
        r.employee,
        r.kind,
        r.cycle,
        r.status,
        weightedRating(r.ratings, params, "self") ?? "—",
        weightedRating(r.ratings, params, "manager") ?? "—",
        r.hr.calibratedRating ?? "—",
        r.manager.recommendation || "—",
        r.hr.finalHikePct ?? r.manager.hikePct ?? "—",
      ]),
      summary: [
        { label: "Forms", value: String(reviews.length) },
        { label: "Closed", value: String(reviews.filter((r) => r.status === "Closed").length) },
      ],
    },
  ];
}
