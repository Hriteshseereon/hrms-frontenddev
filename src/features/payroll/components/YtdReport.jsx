import { Fragment, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  REPORT_FYS,
  buildEsiYtd,
  buildPfYtd,
  buildYtd,
  fyMonths,
  money,
  sliceYtd,
} from "@/features/payroll/data/payroll-reports";
import { usePayrollRuns, useHydrated } from "@/features/payroll/data/payroll-engine";
import { exportReportPdf } from "@/lib/export-utils";
import { exportMatrixPdf } from "@/lib/export-utils";

function MonthRange({ months, from, to, onFrom, onTo }) {
  return (
    <>
      <Select value={String(from)} onValueChange={(v) => onFrom(Number(v))}>
        <SelectTrigger className="w-full sm:w-[140px]" aria-label="From month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m, i) => (
            <SelectItem key={m} value={String(i)}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground text-xs">to</span>
      <Select value={String(to)} onValueChange={(v) => onTo(Number(v))}>
        <SelectTrigger className="w-full sm:w-[140px]" aria-label="To month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m, i) => (
            <SelectItem key={m} value={String(i)}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function DetailCard({ emp, fy }) {
  return (
    <div className="border-border bg-muted/30 grid grid-cols-1 gap-x-8 gap-y-2 rounded-xl border p-4 text-sm sm:grid-cols-2">
      {[
        ["Employee", `${emp.name} (${emp.id})`],
        ["Designation", emp.role],
        ["Department", emp.dept],
        ["Location", emp.branch],
        ["Financial Year", fy],
        ["Status", emp.status],
      ].map(([k, v]) => (
        <div key={k} className="border-border/50 flex justify-between gap-4 border-b pb-1.5">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-right font-medium">{v}</span>
        </div>
      ))}
    </div>
  );
}

/** Placeholder while hydrating — the reports read the browser's persisted payroll data. */
export function ReportLoading() {
  return (
    <Card className="shadow-card">
      <CardContent className="text-muted-foreground p-10 text-center text-sm">
        Loading payroll data…
      </CardContent>
    </Card>
  );
}

/** Tab 1 — YTD summary grid (Apr to Mar). */
export function YtdSummary({ emp }) {
  return useHydrated() ? <YtdSummaryInner emp={emp} /> : <ReportLoading />;
}
function YtdSummaryInner({ emp }) {
  const [fy, setFy] = useState(REPORT_FYS[0]);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(11);
  const allMonths = fyMonths(fy);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  // Subscribe to payroll runs so a newly processed month shows up without a reload.
  const runs = usePayrollRuns();
  const { months, groups, netTotal } = useMemo(
    () => sliceYtd(buildYtd(emp.id, fy), lo, hi),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emp.id, fy, lo, hi, runs],
  );

  const download = () => {
    const ok = exportMatrixPdf({
      title: "YTD Summary",
      subtitle: `${fy} · ${months[0]} to ${months.at(-1)}`,
      details: [
        ["Employee", `${emp.name} (${emp.id})`],
        ["Designation", emp.role],
        ["Department", emp.dept],
        ["Location", emp.branch],
        ["Financial Year", fy],
        ["Period", `${months[0]} — ${months.at(-1)}`],
      ].map(([label, value]) => ({ label, value })),
      columns: months,
      totalLabel: "Total",
      groups: groups.map((g) => ({
        name: g.name,
        rows: g.rows.map((r) => ({
          label: r.label,
          values: r.monthly.map(money),
          total: money(r.total),
          strong: r.strong,
        })),
      })),
    });
    toast[ok ? "success" : "error"](
      ok ? "YTD summary opened — save as PDF" : "Allow pop-ups to download the report",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={fy} onValueChange={setFy}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_FYS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MonthRange months={allMonths} from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          Net paid ₹&nbsp;{money(netTotal)}
        </Badge>
        <Button variant="outline" size="sm" className="ml-auto" onClick={download}>
          <Download className="h-4 w-4" /> Download
        </Button>
      </div>

      <DetailCard emp={emp} fy={fy} />

      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="bg-muted sticky left-0 z-10 px-3 py-2.5 font-semibold">
                    YTD Summary
                  </th>
                  {months.map((m) => (
                    <th key={m} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.name}>
                    <tr className="bg-primary/5">
                      <td
                        colSpan={months.length + 2}
                        className="text-primary px-3 py-2 font-semibold"
                      >
                        {g.name}
                      </td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={g.name + r.label} className="border-border/60 border-t">
                        <td
                          className={cn(
                            "bg-card sticky left-0 z-10 px-3 py-2 whitespace-nowrap",
                            r.strong && "font-semibold",
                          )}
                        >
                          {r.label}
                        </td>
                        {r.monthly.map((v, i) => (
                          <td
                            key={i}
                            className={cn(
                              "px-3 py-2 text-right tabular-nums",
                              r.strong && "font-semibold",
                              v === 0 && "text-muted-foreground",
                            )}
                          >
                            {money(v)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {money(r.total)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Tab 2 — PF YTD statement. */
export function PfYtdStatement({ emp }) {
  return useHydrated() ? <PfYtdStatementInner emp={emp} /> : <ReportLoading />;
}
function PfYtdStatementInner({ emp }) {
  const [fy, setFy] = useState(REPORT_FYS[0]);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(11);
  const allMonths = fyMonths(fy);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  usePayrollRuns(); // re-render when a run is processed
  const built = buildPfYtd(emp.id, fy);
  const statutory = built.statutory;
  const rows = built.rows.filter((r) => {
    const i = allMonths.indexOf(r.month);
    return i >= lo && i <= hi;
  });
  const total = rows.reduce(
    (t, r) => ({
      earnings: t.earnings + r.earnings,
      employeePf: t.employeePf + r.employeePf,
      vpf: t.vpf + r.vpf,
      employerPf: t.employerPf + r.employerPf,
      pensionFund: t.pensionFund + r.pensionFund,
    }),
    { earnings: 0, employeePf: 0, vpf: 0, employerPf: 0, pensionFund: 0 },
  );

  const download = () => {
    const ok = exportMatrixPdf({
      title: "PF YTD Statement",
      subtitle: `${fy} · ${allMonths[lo]} to ${allMonths[hi]}`,
      details: [
        ["Name", emp.name],
        ["Employee ID", emp.id],
        ["PAN", statutory.pan],
        ["UAN", statutory.uan],
        ["PF Number", statutory.pfNo],
        ["ESI Number", statutory.esiNo],
      ].map(([label, value]) => ({ label, value })),
      columns: ["Earnings ₹", "Employee PF", "VPF", "Employer PF", "Pension Fund"],
      groups: [
        {
          rows: [
            ...rows.map((r) => ({
              label: r.month,
              values: [
                money(r.earnings),
                money(r.employeePf),
                money(r.vpf),
                money(r.employerPf),
                money(r.pensionFund),
              ],
            })),
            {
              label: "Total",
              strong: true,
              values: [
                money(total.earnings),
                money(total.employeePf),
                money(total.vpf),
                money(total.employerPf),
                money(total.pensionFund),
              ],
            },
          ],
        },
      ],
    });
    toast[ok ? "success" : "error"](
      ok ? "PF statement opened — save as PDF" : "Allow pop-ups to download the report",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={fy} onValueChange={setFy}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_FYS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MonthRange months={allMonths} from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <Button variant="outline" size="sm" className="ml-auto" onClick={download}>
          <Download className="h-4 w-4" /> Download
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-1">
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold">Employee details</h3>
            {[
              ["Name", emp.name],
              ["Employee ID", emp.id],
              ["PAN", statutory.pan],
              ["UAN", statutory.uan],
              ["PF Number", statutory.pfNo],
              ["ESI Number", statutory.esiNo],
            ].map(([k, v]) => (
              <div key={k} className="border-border/60 flex justify-between gap-3 border-b pb-1.5">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-right font-medium">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="bg-muted/60">
                    <th rowSpan={2} className="px-3 py-2 text-left font-semibold">
                      Month
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold">
                      Earnings In ₹
                    </th>
                    <th
                      colSpan={2}
                      className="border-border border-l px-3 py-2 text-center font-semibold"
                    >
                      Employee Contribution
                    </th>
                    <th
                      colSpan={2}
                      className="border-border border-l px-3 py-2 text-center font-semibold"
                    >
                      Employer's Contribution
                    </th>
                  </tr>
                  <tr className="bg-muted/40 text-[11px]">
                    <th className="border-border border-l px-3 py-1.5 text-right font-medium">
                      PF
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium">VPF</th>
                    <th className="border-border border-l px-3 py-1.5 text-right font-medium">
                      PF
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium">Pension Fund</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.month} className="border-border/60 border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{r.month}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.earnings)}</td>
                      <td className="border-border/60 border-l px-3 py-2 text-right tabular-nums">
                        {money(r.employeePf)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.vpf)}</td>
                      <td className="border-border/60 border-l px-3 py-2 text-right tabular-nums">
                        {money(r.employerPf)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.pensionFund)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground px-3 py-6 text-center">
                        No PF contributions for {fy} yet.
                      </td>
                    </tr>
                  )}
                  <tr className="border-border bg-muted/40 border-t-2 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(total.earnings)}</td>
                    <td className="border-border/60 border-l px-3 py-2 text-right tabular-nums">
                      {money(total.employeePf)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(total.vpf)}</td>
                    <td className="border-border/60 border-l px-3 py-2 text-right tabular-nums">
                      {money(total.employerPf)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(total.pensionFund)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Tab — ESI YTD statement (MoM: ESI year-to-date tracking). */
export function EsiYtdStatement({ emp }) {
  return useHydrated() ? <EsiYtdStatementInner emp={emp} /> : <ReportLoading />;
}
function EsiYtdStatementInner({ emp }) {
  const [fy, setFy] = useState(REPORT_FYS[0]);
  const runs = usePayrollRuns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => buildEsiYtd(emp.id, fy), [emp.id, fy, runs]);
  const download = () => {
    const ok = exportReportPdf({
      title: "ESI Year-to-Date Statement",
      subtitle: `${fy} · ${emp.name} (${emp.id}) · IP ${built.esiNo || "—"} · employer code ${built.employerCode}`,
      summary: [
        { label: "Covered months", value: String(built.total.coveredMonths) },
        { label: "ESI wages", value: money(built.total.wages) },
        { label: "Employee 0.75%", value: money(built.total.employee) },
        { label: "Employer 3.25%", value: money(built.total.employer) },
      ],
      columns: [
        "Month",
        "Contribution period",
        "Covered",
        "Days paid",
        "ESI wages",
        "Employee",
        "Employer",
      ],
      rows: built.rows.map((r) => [
        r.month,
        r.contributionPeriod,
        r.covered ? "Yes" : "No",
        r.daysPaid,
        money(r.wages),
        money(r.employee),
        money(r.employer),
      ]),
    });
    toast[ok ? "success" : "error"](
      ok ? "ESI YTD ready — save as PDF" : "Allow pop-ups to download",
    );
  };
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="font-semibold">ESI YTD Statement</div>
            <div className="text-muted-foreground text-xs">
              IP number {built.esiNo || "not allotted"} · coverage applies when gross ≤ ₹
              {built.threshold.toLocaleString("en-IN")} and is locked for the contribution period.
            </div>
          </div>
          <div className="ml-auto flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_FYS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {[
            ["Covered months", String(built.total.coveredMonths)],
            ["ESI wages (YTD)", money(built.total.wages)],
            ["Employee 0.75 %", money(built.total.employee)],
            ["Employer 3.25 %", money(built.total.employer)],
          ].map(([k, v]) => (
            <div key={k} className="border-border bg-muted/30 rounded-xl border p-3">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
              <div className="mt-1 text-lg font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Month",
                  "Contribution period",
                  "Covered",
                  "Days paid",
                  "ESI wages",
                  "Employee",
                  "Employer",
                ].map((h) => (
                  <th key={h} className="px-3 py-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {built.rows.map((r) => (
                <tr key={r.period}>
                  <td className="px-3 py-2">{r.month}</td>
                  <td className="text-muted-foreground px-3 py-2">{r.contributionPeriod}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={
                        r.covered
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {r.covered ? "Covered" : "Not covered"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{r.daysPaid}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.wages)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.employee)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.employer)}</td>
                </tr>
              ))}
              {built.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-6 text-center">
                    No processed payroll months in this financial year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
