import { useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { payslipsFor, useHydrated, usePayrollRuns } from "@/features/payroll/data/payroll-engine";
import { leaveBalances, useLeaveApplications } from "@/features/leave/data/leave-engine";
import { usePunches, punchesOf, punchHours } from "@/features/attendance/data/attendance-self";
import { reimbursementStore } from "@/features/finance/data/claims-data";
import { useLoans, outstandingOf } from "@/features/payroll/data/loans-data";
import { useGoals } from "@/features/performance/data/goals-data";
import {
  useReviews,
  useEvalParams,
  weightedRating,
} from "@/features/performance/data/performance-config";
import { useTours, tourRoi } from "@/features/travel/data/tour-data";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";

/** Reports read several persisted stores with `.get()` — render after hydration so SSR and client agree. */
function ReportsPage() {
  return useHydrated() ? (
    <Page />
  ) : (
    <div className="text-muted-foreground p-10 text-center text-sm">Loading reports…</div>
  );
}

/**
 * @typedef {Object} R
 * @property {string} key
 * @property {string} name
 * @property {string} description
 * @property {string[]} columns
 * @property {(string | number)[][]} rows
 * @property {{ label: string, value: string }[]} summary
 */

function Page() {
  const me = useCurrentUser();
  const runs = usePayrollRuns();
  const [leave] = useLeaveApplications();
  const punches = usePunches();
  const claims = reimbursementStore.use();
  const loans = useLoans();
  const goals = useGoals();
  const reviews = useReviews();
  const params = useEvalParams();
  const tours = useTours();
  const reports = useMemo(() => {
    const slips = payslipsFor(me.id);
    const my = punchesOf(punches, me.id);
    const bal = leaveBalances(me.id);
    return [
      {
        key: "payslips",
        name: "Salary & payslips",
        description: "Every processed payslip with gross, deductions and net",
        columns: ["Period", "Gross", "PF", "ESI", "PT", "TDS", "Loan EMI", "Deductions", "Net"],
        rows: slips.map(({ run, slip }) => [
          run.period,
          inr(slip.earnedGross),
          inr(slip.pf.employee),
          inr(slip.esi.employee),
          inr(slip.pt),
          inr(slip.tds.monthly),
          inr(slip.loanEmi),
          inr(slip.totalDeductions),
          inr(slip.net),
        ]),
        summary: [
          { label: "Payslips", value: String(slips.length) },
          { label: "Net paid (total)", value: inr(slips.reduce((t, x) => t + x.slip.net, 0)) },
        ],
      },
      {
        key: "attendance",
        name: "Attendance log",
        description: "Your punches with hours worked",
        columns: ["Date", "In", "Out", "Hours", "Source"],
        rows: my.map((p) => [
          p.date,
          p.inAt || "—",
          p.outAt || "—",
          punchHours(p).toFixed(1),
          p.source,
        ]),
        summary: [
          { label: "Days punched", value: String(my.length) },
          {
            label: "Avg hours",
            value: my.length
              ? (my.reduce((t, p) => t + punchHours(p), 0) / my.length).toFixed(1)
              : "—",
          },
        ],
      },
      {
        key: "leave",
        name: "Leave ledger & balances",
        description: "Balances by type and every application",
        columns: ["Type", "Entitled to date", "Used", "On hold", "Available"],
        rows: bal.map((b) => [
          b.type,
          b.entitled,
          b.used,
          b.pending,
          Number.isFinite(b.available) ? b.available : "∞",
        ]),
        summary: [
          { label: "Applications", value: String(leave.filter((l) => l.empId === me.id).length) },
          {
            label: "Pending",
            value: String(leave.filter((l) => l.empId === me.id && l.status === "Pending").length),
          },
        ],
      },
      {
        key: "leave-apps",
        name: "Leave applications",
        description: "Status of each request with approval chain",
        columns: ["Ref", "Type", "From", "To", "Days", "Chain", "Status", "Decided by"],
        rows: leave
          .filter((l) => l.empId === me.id)
          .map((l) => [
            l.id,
            l.leaveType,
            l.from,
            l.to,
            l.days,
            l.approvalChain ?? "Manager",
            l.status,
            l.decidedBy ?? "—",
          ]),
        summary: [],
      },
      {
        key: "claims",
        name: "Claims & reimbursements",
        description: "Expense, petty cash and insurance claims",
        columns: ["Ref", "Claim", "Type", "Category", "Amount", "Date", "Stage", "Status"],
        rows: claims
          .filter((c) => c.empId === me.id)
          .map((c) => [
            c.id,
            c.name,
            c.type,
            c.category,
            inr(c.amount),
            c.date,
            c.currentStage,
            c.status,
          ]),
        summary: [
          {
            label: "Claimed",
            value: inr(claims.filter((c) => c.empId === me.id).reduce((t, c) => t + c.amount, 0)),
          },
        ],
      },
      {
        key: "loans",
        name: "Loans & advances",
        description: "Applications, EMI and outstanding",
        columns: ["Ref", "Type", "Amount", "EMI × tenure", "First EMI", "Outstanding", "Status"],
        rows: loans
          .filter((l) => l.empId === me.id)
          .map((l) => [
            l.id,
            l.kind,
            inr(l.amount),
            `${inr(l.emi)} × ${l.tenureMonths}`,
            l.firstEmiPeriod,
            inr(outstandingOf(l)),
            l.status,
          ]),
        summary: [],
      },
      {
        key: "goals",
        name: "Goals",
        description: "Progress, self and manager rating",
        columns: ["Goal", "Level", "Due", "Progress", "Status", "Self rating", "Manager rating"],
        rows: goals
          .filter((g) => g.ownerId === me.id)
          .map((g) => [
            g.title,
            g.level,
            g.due,
            `${g.progress}%`,
            g.status,
            g.selfRating ?? "—",
            g.managerRating ?? "—",
          ]),
        summary: [],
      },
      {
        key: "reviews",
        name: "Review history",
        description: "Quarterly reviews and annual appraisals",
        columns: ["Form", "Kind", "Cycle", "Status", "Self", "Manager", "Final", "Hike %"],
        rows: reviews
          .filter((r) => r.empId === me.id)
          .map((r) => [
            r.id,
            r.kind,
            r.cycle,
            r.status,
            weightedRating(r.ratings, params, "self") ?? "—",
            weightedRating(r.ratings, params, "manager") ?? "—",
            r.hr.calibratedRating ?? "—",
            r.hr.finalHikePct ?? "—",
          ]),
        summary: [],
      },
      {
        key: "tours",
        name: "Tours & outcomes",
        description: "Tours with cost, revenue generated / saved and ROI",
        columns: [
          "Tour",
          "Destination",
          "Dates",
          "Status",
          "Cost",
          "Revenue generated",
          "Revenue saved",
          "ROI %",
        ],
        rows: tours
          .filter((t) => t.employeeId === me.id)
          .map((t) => {
            const r = tourRoi(t);
            return [
              t.id,
              t.destination,
              `${t.startDate} → ${t.endDate}`,
              t.status,
              inr(r.cost),
              inr(t.outcomes?.revenueGenerated ?? 0),
              inr(t.outcomes?.revenueSaved ?? 0),
              t.outcomes ? r.roi : "—",
            ];
          }),
        summary: [],
      },
    ];
    // `runs` re-derives the payslip report (payslips are read from the payroll store).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, runs, punches, leave, claims, loans, goals, reviews, params, tours]);
  const [active, setActive] = useState("payslips");
  const r = reports.find((x) => x.key === active) ?? reports[0];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="text-primary h-6 w-6" /> My Reports
          </h1>
          <p className="text-muted-foreground text-sm">
            Your personal reports — export any of them as PDF or CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportCsv(`${r.key}-${me.id}`, r.columns, r.rows);
              toast.success("CSV exported");
            }}
          >
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            className="bg-gradient-emerald text-white"
            onClick={() => {
              const ok = exportReportPdf({
                title: `${r.name} — ${me.name}`,
                subtitle: r.description,
                summary: r.summary,
                columns: r.columns,
                rows: r.rows,
              });
              if (!ok) toast.error("Allow pop-ups to download the PDF");
            }}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="shadow-card">
          <CardContent className="p-2">
            {reports.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setActive(x.key)}
                className={cn(
                  "flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm",
                  x.key === active ? "bg-gradient-emerald text-white" : "hover:bg-muted",
                )}
              >
                <span className="font-medium">{x.name}</span>
                <span
                  className={cn(
                    "text-[11px]",
                    x.key === active ? "text-white/70" : "text-muted-foreground",
                  )}
                >
                  {x.rows.length} rows
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="border-border border-b p-4">
              <div className="font-semibold">{r.name}</div>
              <div className="text-muted-foreground text-xs">{r.description}</div>
              {r.summary.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.summary.map((s) => (
                    <span key={s.label} className="bg-muted/40 rounded-lg px-2 py-1 text-xs">
                      <span className="text-muted-foreground">{s.label}: </span>
                      <b>{s.value}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {r.columns.map((c) => (
                      <th key={c} className="p-3 text-left whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {r.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={r.columns.length}
                        className="text-muted-foreground p-8 text-center"
                      >
                        Nothing to report yet.
                      </td>
                    </tr>
                  )}
                  {r.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      {row.map((c, k) => (
                        <td key={k} className="p-3 whitespace-nowrap">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ReportsPage;
