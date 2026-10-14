// Item 14 — Odisha Government statutory register formats generated from the payroll roster / computed payslips:
// Form II Register of Employees (Odisha Shops & Commercial Establishments Rules), Form V Register of Wages / Muster-cum-Wage
// Register (Odisha Minimum Wages Rules), Form XII Register of Wages (Odisha Contract Labour Rules), Form B Wage Register &
// Form D Register of Fines / Deductions (Payment of Wages Act, Odisha), Register of Leave (Form F) and Form XXV (Odisha CLRA annual return).
import { useMemo, useState } from "react";
import { BookOpenCheck, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr } from "@/lib/store";
import { computePayslip, dueDate, payrollRoster } from "@/features/payroll/data/payroll-engine";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { getStatutoryConfig, policyForState } from "@/features/payroll/data/statutory-data";
import { getEmployeeProfile, findEmployee } from "@/features/employees/data/employee-directory";
import { leaveBalances } from "@/features/leave/data/leave-engine";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

/**
 * @typedef {Object} Register
 * @property {string} key
 * @property {string} form
 * @property {string} title
 * @property {string} law
 * @property {string} frequency
 * @property {string[]} columns
 * @property {(s: ComputedPayslip, i: number) => (string | number)[]} rows
 */

const nationality = () => "Indian";
/** Salary is paid on the configured pay day of the following month. */
const payDateOf = (period) => dueDate(period, getStatutoryConfig().payroll.payDay);
const fatherName = (empId) => {
  const p = getEmployeeProfile(empId);
  return p.personal?.fatherName ?? "—";
};
const address = (empId) => {
  const p = getEmployeeProfile(empId);
  return p.personal?.currentAddress ?? p.personal?.address ?? "Bhubaneswar, Odisha";
};

const REGISTERS = [
  {
    key: "form-ii",
    form: "Form II",
    title: "Register of Employees",
    law: "Odisha Shops & Commercial Establishments Rules, 1958 (Rule 15)",
    frequency: "Maintained continuously",
    columns: [
      "Sl.",
      "Name of employee",
      "Father's / Husband's name",
      "Sex",
      "Date of birth",
      "Nationality",
      "Designation",
      "Date of joining",
      "Rate of wages (₹/month)",
      "Weekly holiday",
      "Hours of work",
      "Residential address",
      "Remarks",
    ],
    rows: (s, i) => [
      i + 1,
      s.name,
      fatherName(s.empId),
      s.gender,
      s.dob,
      nationality(),
      s.designation,
      s.doj,
      s.structureGross,
      "Sunday",
      "9:30–18:30",
      address(s.empId),
      s.wageRoll ? "Wage roll" : "",
    ],
  },
  {
    key: "form-v",
    form: "Form V",
    title: "Muster-cum-Wage Register",
    law: "Odisha Minimum Wages Rules, 1954 (Rule 26)",
    frequency: "Monthly",
    columns: [
      "Sl.",
      "Name",
      "Father's name",
      "Designation",
      "Category (skilled / semi / unskilled)",
      "Min. wage rate",
      "Days worked",
      "Overtime hrs",
      "Basic + DA",
      "Other allowances",
      "Gross",
      "PF",
      "ESI",
      "PT",
      "Other deductions",
      "Net paid",
      "Date of payment",
      "Signature / thumb",
    ],
    rows: (s, i) => [
      i + 1,
      s.name,
      fatherName(s.empId),
      s.designation,
      s.wageRoll ? "Semi-skilled" : "Skilled",
      s.wageRoll ? policyForState(s.state).minimumWage : "n/a",
      s.lop.payableDays,
      0,
      s.earnings
        .filter((e) => /basic|da\b|dearness/i.test(e.label))
        .reduce((t, e) => t + e.amount, 0),
      s.earnings
        .filter((e) => !/basic|da\b|dearness/i.test(e.label))
        .reduce((t, e) => t + e.amount, 0),
      s.earnedGross,
      s.pf.employee,
      s.esi.employee,
      s.pt,
      s.totalDeductions - s.pf.employee - s.esi.employee - s.pt,
      s.net,
      payDateOf(s.period),
      "",
    ],
  },
  {
    key: "form-xii",
    form: "Form XII",
    title: "Register of Wages (Contract Labour)",
    law: "Odisha Contract Labour (Regulation & Abolition) Rules, 1975 (Rule 78)",
    frequency: "Monthly",
    columns: [
      "Sl.",
      "Name of workman",
      "Sl. in Form XIII",
      "Designation / nature of work",
      "No. of days worked",
      "Units of work",
      "Daily rate / piece rate",
      "Basic wages",
      "DA",
      "Overtime",
      "Other cash payments",
      "Total",
      "Deductions",
      "Net paid",
      "Initials of contractor",
    ],
    rows: (s, i) => [
      i + 1,
      s.name,
      `XIII-${String(i + 1).padStart(3, "0")}`,
      s.designation,
      s.lop.payableDays,
      "—",
      Math.round(s.structureGross / 26),
      s.earnings.find((e) => /basic/i.test(e.label))?.amount ?? 0,
      s.earnings.find((e) => /da\b|dearness/i.test(e.label))?.amount ?? 0,
      0,
      s.earnedGross - (s.earnings.find((e) => /basic/i.test(e.label))?.amount ?? 0),
      s.earnedGross,
      s.totalDeductions,
      s.net,
      "",
    ],
  },
  {
    key: "form-b",
    form: "Form B",
    title: "Register of Wages",
    law: "Payment of Wages (Odisha) Rules, 1936 (Rule 5)",
    frequency: "Monthly",
    columns: [
      "Sl.",
      "Name",
      "Designation",
      "Wage period",
      "Days worked",
      "Rate of wages",
      "Basic",
      "Allowances",
      "Overtime",
      "Gross wages",
      "Deductions (PF/ESI/PT/TDS/LWF)",
      "Advances / loans",
      "Net wages",
      "Date paid",
      "Mode",
    ],
    rows: (s, i) => [
      i + 1,
      s.name,
      s.designation,
      s.periodLabel,
      s.lop.payableDays,
      s.structureGross,
      s.earnings.find((e) => /basic/i.test(e.label))?.amount ?? 0,
      s.earnedGross - (s.earnings.find((e) => /basic/i.test(e.label))?.amount ?? 0),
      0,
      s.earnedGross,
      s.totalDeductions - s.loanEmi,
      s.loanEmi,
      s.net,
      payDateOf(s.period),
      "Bank (NEFT)",
    ],
  },
  {
    key: "form-d",
    form: "Form D",
    title: "Register of Fines & Deductions for Damage / Loss",
    law: "Payment of Wages (Odisha) Rules, 1936 (Rules 3 & 4)",
    frequency: "Monthly (nil-return when no fines)",
    columns: [
      "Sl.",
      "Name",
      "Designation",
      "Wage period",
      "Act / omission",
      "Amount of fine / deduction",
      "Date",
      "Whether employee showed cause",
      "Amount realised",
      "Remarks",
    ],
    rows: (s, i) => [
      i + 1,
      s.name,
      s.designation,
      s.periodLabel,
      s.lop.lopDays > 0 ? `${s.lop.lopDays} day(s) loss of pay` : "Nil",
      s.lop.lopDays > 0
        ? Math.round((s.structureGross / (s.lop.pattern.workingDays || 26)) * s.lop.lopDays)
        : 0,
      payDateOf(s.period),
      "Yes",
      s.lop.lopDays > 0
        ? Math.round((s.structureGross / (s.lop.pattern.workingDays || 26)) * s.lop.lopDays)
        : 0,
      s.lop.lopDays > 0 ? "Attendance-linked" : "Nil",
    ],
  },
  {
    key: "form-f",
    form: "Form F",
    title: "Register of Leave with Wages",
    law: "Odisha Shops & Commercial Establishments Rules (Rule 17)",
    frequency: "Annual",
    columns: [
      "Sl.",
      "Name",
      "Date of joining",
      "Leave type",
      "Entitlement",
      "Availed",
      "Pending",
      "Balance",
      "Encashed (year-end)",
      "Remarks",
    ],
    rows: (s, i) => {
      const el = leaveBalances(s.empId).find((b) => b.type === "Earned Leave");
      return [
        i + 1,
        s.name,
        s.doj,
        "Earned Leave",
        el?.entitled ?? 0,
        el?.used ?? 0,
        el?.pending ?? 0,
        el?.available ?? 0,
        0,
        findEmployee(s.empId) ? "" : "Wage roll",
      ];
    },
  },
  {
    key: "form-xxv",
    form: "Form XXV",
    title: "Annual Return — Contract Labour",
    law: "Odisha CLRA Rules (Rule 82) · due 15 Feb",
    frequency: "Annual",
    columns: [
      "Sl.",
      "Name",
      "Designation",
      "Male / Female",
      "Days worked (year)",
      "Wages paid (year)",
      "Deductions (year)",
      "PF number",
      "ESI number",
      "Bank a/c (masked)",
    ],
    rows: (s, i) => [
      i + 1,
      s.name,
      s.designation,
      s.gender,
      s.lop.payableDays * 12,
      s.earnedGross * 12,
      s.totalDeductions * 12,
      s.pf.applicable ? "Yes" : "No",
      s.esi.applicable ? "Yes" : "No",
      "XXXX",
    ],
  },
];

export function StatutoryRegistersTab() {
  const [period, setPeriod] = useState("2026-08");
  const [branch, setBranch] = useState("All");
  const [key, setKey] = useState("form-v");
  const [detail, setDetail] = useState(null);
  // Active entity's roster (was hard-wired to the Seereon entity) — reactive to directory changes.
  const orgId = useActiveOrgId();
  const directory = useDirectory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roster = useMemo(() => payrollRoster(orgId), [orgId, directory]);
  const branches = ["All", ...Array.from(new Set(roster.map((r) => r.branch)))];
  const slips = useMemo(
    () =>
      roster
        .filter((r) => branch === "All" || r.branch === branch)
        .map((r) => computePayslip(r, period)),
    [roster, branch, period],
  );
  const reg = REGISTERS.find((r) => r.key === key);
  const rows = slips.map((s, i) => reg.rows(s, i));
  const filters = [
    {
      label: "Establishment",
      value: "Seereon Consulting & IT Services Pvt. Ltd., Khandagiri, Bhubaneswar 751003",
    },
    { label: "Registration", value: "OD/BBSR/S&E/2019/04412" },
    { label: "Wage period", value: slips[0]?.periodLabel ?? period },
    { label: "Branch", value: branch },
  ];
  const fmt = (v) => (typeof v === "number" ? v.toLocaleString("en-IN") : v);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <BookOpenCheck className="text-primary h-4 w-4" /> Statutory registers — Odisha
            Government formats
          </div>
          <div className="text-muted-foreground text-xs">
            Generated live from the payroll roster and computed payslips; export as PDF (print
            format) or CSV (inspector upload).
          </div>
        </div>
        <div className="ml-auto flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto">
          <div className="w-full min-w-0 space-y-1 sm:w-auto">
            <Label className="text-xs">Wage period</Label>
            <Input
              type="month"
              className="h-9 w-full sm:w-40"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div className="w-full min-w-0 space-y-1 sm:w-auto">
            <Label className="text-xs">Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="h-9 w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {REGISTERS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setKey(r.key)}
            className={`rounded-xl border p-3 text-left text-sm transition ${key === r.key ? "border-primary bg-primary/5 shadow-card" : "border-border hover:bg-muted/30"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 font-semibold whitespace-nowrap">{r.form}</span>
              <Badge variant="outline" className="min-w-0 shrink text-[10px]">
                {r.frequency}
              </Badge>
            </div>
            <div>{r.title}</div>
            <div className="text-muted-foreground line-clamp-2 text-xs">{r.law}</div>
          </button>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div>
              <div className="font-semibold">
                {reg.form} · {reg.title}
              </div>
              <div className="text-muted-foreground text-xs">
                {reg.law} · {rows.length} employee(s) · {slips[0]?.periodLabel ?? period}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportCsv(`${reg.form.replace(" ", "-")}-${period}.csv`, reg.columns, rows)
                }
              >
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </Button>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() =>
                  exportReportPdf({
                    title: `${reg.form} — ${reg.title}`,
                    subtitle: reg.law,
                    filters,
                    summary: [
                      { label: "Employees", value: String(rows.length) },
                      {
                        label: "Gross wages",
                        value: inr(slips.reduce((t, s) => t + s.earnedGross, 0)),
                      },
                      { label: "Net paid", value: inr(slips.reduce((t, s) => t + s.net, 0)) },
                    ],
                    columns: reg.columns,
                    rows: rows.map((r) => r.map(fmt)),
                  })
                }
              >
                <Download className="h-4 w-4" /> PDF (print format)
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground tracking-wider uppercase">
                <tr>
                  {reg.columns.map((c) => (
                    <th key={c} className="p-2 text-left whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={clickableRow}
                    onClick={() => setDetail({ slip: slips[i], values: r })}
                  >
                    {r.map((c, k) => (
                      <td key={k} className="p-2 whitespace-nowrap">
                        {fmt(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${reg.form} · ${detail.slip.name}`}
          subtitle={`${reg.title} · ${detail.slip.empId} · ${detail.slip.periodLabel}`}
          badges={<Badge variant="outline">{reg.law}</Badge>}
          record={Object.fromEntries(reg.columns.map((c, k) => [c, fmt(detail.values[k] ?? "")]))}
          labels={Object.fromEntries(reg.columns.map((c) => [c, c]))}
        />
      )}
    </div>
  );
}
