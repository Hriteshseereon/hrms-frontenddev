// -----------------------------------------------------------------------------
// Payroll reporting (UI-only): YTD statement, PF YTD statement and IT statement.
// Every figure is read from the payroll engine's processed runs so the reports,
// payslips, ECR and TDS filings never disagree. Months without a processed run
// show as zero (pending), exactly like a real YTD statement.
// -----------------------------------------------------------------------------
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import {
  computePayslipFor,
  payrollRunStore,
  rosterEmployee,
} from "@/features/payroll/data/payroll-engine";
import { getStatutoryConfig } from "@/features/payroll/data/statutory-data";

export const REPORT_FYS = ["FY 2026-27", "FY 2025-26", "FY 2024-25"];
/**
 * @typedef {(typeof REPORT_FYS)[number]} ReportFY
 */

/** Financial year runs April → March. */
const MONTH_LABELS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

export const fyStartYear = (fy) => Number(fy.slice(3, 7));

export function fyMonths(fy) {
  const y = fyStartYear(fy);
  return MONTH_LABELS.map((m, i) => `${m} ${i <= 8 ? y : y + 1}`);
}

/** "YYYY-MM" pay periods of a financial year, April first. */
export function fyPeriods(fy) {
  const y = fyStartYear(fy);
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((i + 3) % 12) + 1;
    return `${i <= 8 ? y : y + 1}-${String(m).padStart(2, "0")}`;
  });
}

const CURRENT_FY_START = 2026;

/**
 * Payslip for one month of the FY: a processed/paid payroll run is the source
 * of truth; earlier financial years are reconstructed from the salary
 * structure (they pre-date the engine's run history); future / unprocessed
 * months of the current FY return null.
 */
const beforeEngineHistory = (period) => {
  const y = Number(period.slice(0, 4)),
    m = Number(period.slice(5, 7));
  return y < CURRENT_FY_START || (y === CURRENT_FY_START && m < 4);
};

const processedRuns = (period) =>
  payrollRunStore
    .get()
    .filter((r) => r.period === period && (r.status === "Processed" || r.status === "Paid"));

/** The employee's line in a processed run of that period — runs of other organisations are skipped, not mistaken for a gap. */
export function slipForPeriod(empId, period) {
  const runs = processedRuns(period);
  for (const run of runs) {
    const line = run.lines.find((l) => l.empId === empId);
    if (line) return line;
  }
  if (runs.length) return null;
  if (beforeEngineHistory(period)) return computePayslipFor(empId, period);
  return null;
}

/**
 * Annual salary components for a FY: what processed months actually paid (after LOP, incl. encashment once) plus the
 * salary structure for the remaining months the employee is on payroll — never "latest payslip × 12".
 * @returns {{ label: string, annual: number }[]}
 */
export function annualEarnings(empId, fy, slips, monthsOnPayroll = 12) {
  const list = slips ?? fyPeriods(fy).map((p) => slipForPeriod(empId, p));
  const structure = rosterEmployee(empId)?.earnings ?? [];
  const firstMonth = 12 - monthsOnPayroll;
  const totals = new Map();
  const add = (label, amount) => totals.set(label, (totals.get(label) ?? 0) + amount);
  list.forEach((s, i) => {
    if (s) s.earnings.forEach((e) => add(e.label, e.amount));
    else if (i >= firstMonth) structure.forEach((e) => add(e.label, e.amount));
  });
  return [...totals].map(([label, annual]) => ({ label, annual }));
}

/** Months of the FY that have a processed payroll behind them. */
export const processedMonths = (fy) =>
  fyPeriods(fy).filter((p) => processedRuns(p).length > 0 || beforeEngineHistory(p)).length;

export const money = (n) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * @typedef {Object} YtdRow
 * @property {string} label
 * @property {number[]} monthly
 * @property {number} total
 * @property {boolean} [strong]
 */
/**
 * @typedef {Object} YtdGroup
 * @property {string} name
 * @property {YtdRow[]} rows
 */

const rowFrom = (label, monthly, strong = false) => ({
  label,
  monthly,
  total: monthly.reduce((s, v) => s + v, 0),
  strong,
});

const sumRows = (label, rows) => {
  const monthly = Array.from({ length: 12 }, (_, i) => rows.reduce((s, r) => s + r.monthly[i], 0));
  return { label, monthly, total: monthly.reduce((s, v) => s + v, 0), strong: true };
};

/** Turn a list of {label, amount} lines per month into one row per label. */
function pivot(slips, pick) {
  const labels = [];
  slips.forEach(
    (s) =>
      s &&
      pick(s).forEach((l) => {
        if (!labels.includes(l.label)) labels.push(l.label);
      }),
  );
  return labels.map((label) =>
    rowFrom(
      label,
      slips.map((s) => (s ? (pick(s).find((l) => l.label === label)?.amount ?? 0) : 0)),
    ),
  );
}

export function buildYtd(empId, fy) {
  const slips = fyPeriods(fy).map((p) => slipForPeriod(empId, p));
  const paid = slips.filter(Boolean).length;

  const income = pivot(slips, (s) => s.earnings);
  const gross = sumRows("Gross Earned", income);

  const deductions = pivot(slips, (s) => s.deductions);
  const totalDed = sumRows("Total Deductions", deductions);

  const lopRow = rowFrom(
    "Loss of Pay (₹)",
    slips.map((s) => s?.lop.lopAmount ?? 0),
  );
  const lopDays = rowFrom(
    "LOP Days",
    slips.map((s) => s?.lop.lopDays ?? 0),
  );
  const workdays = rowFrom(
    "Payable Days",
    slips.map((s) => s?.lop.payableDays ?? 0),
  );
  const daysInMonth = rowFrom(
    "Days In Month",
    slips.map((s) => s?.lop.attendance.daysInMonth ?? 0),
  );

  const employer = [
    rowFrom(
      "Employer PF (EPF 3.67%)",
      slips.map((s) => s?.pf.employerEpf ?? 0),
    ),
    rowFrom(
      "Employer Pension (EPS 8.33%)",
      slips.map((s) => s?.pf.employerEps ?? 0),
    ),
    rowFrom(
      "EDLI + Admin",
      slips.map((s) => (s ? s.pf.edli + s.pf.admin : 0)),
    ),
    rowFrom(
      "Employer ESI",
      slips.map((s) => s?.esi.employer ?? 0),
    ),
    rowFrom(
      "Employer NPS",
      slips.map((s) => s?.nps.employer ?? 0),
    ),
  ].filter((r) => r.total > 0);

  const netPay = {
    label: "Net Pay",
    monthly: gross.monthly.map((g, i) => g - totalDed.monthly[i]),
    total: gross.total - totalDed.total,
    strong: true,
  };

  const groups = [
    { name: "Income", rows: [...income, gross] },
    { name: "Deduction", rows: [...deductions, totalDed] },
    { name: "Attendance", rows: [workdays, daysInMonth, lopDays, lopRow] },
    ...(employer.length ? [{ name: "Employer Contributions (not deducted)", rows: employer }] : []),
    { name: "(Blanks)", rows: [netPay] },
  ];

  return { months: fyMonths(fy), groups, gross, totalDed, netPay, paid };
}

/**
 * @typedef {Object} PfRow
 * @property {string} month
 * @property {number} earnings
 * @property {number} employeePf
 * @property {number} vpf
 * @property {number} employerPf
 * @property {number} pensionFund
 */

export function buildPfYtd(empId, fy) {
  const months = fyMonths(fy);
  const rows = fyPeriods(fy)
    .map((p, i) => ({ p, s: slipForPeriod(empId, p), i }))
    .filter((x) => x.s)
    .map(({ s, i }) => ({
      month: months[i],
      earnings: s.pf.wages,
      employeePf: s.pf.employee,
      vpf: s.pf.vpf,
      employerPf: s.pf.employerEpf,
      pensionFund: s.pf.employerEps,
    }));

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

  return {
    rows,
    total,
    // rosterEmployee also resolves wage-roll staff (getEmployeeProfile falls back to another employee for unknown ids).
    statutory: rosterEmployee(empId)?.statutory ?? getEmployeeProfile(empId).payroll.statutory,
    establishment: getStatutoryConfig().establishment.pfCode,
  };
}

/**
 * @typedef {Object} EsiRow
 * @property {string} month
 * @property {string} period
 * @property {boolean} covered
 * @property {number} wages
 * @property {number} employee
 * @property {number} employer
 * @property {number} daysPaid
 * @property {string} contributionPeriod
 */

/** ESI year-to-date: wages, employee 0.75 % and employer 3.25 % per processed month, with the Apr–Sep / Oct–Mar contribution periods. */
export function buildEsiYtd(empId, fy) {
  const months = fyMonths(fy);
  const rows = fyPeriods(fy)
    .map((p, i) => ({ p, s: slipForPeriod(empId, p), i }))
    .filter((x) => x.s)
    .map(({ p, s, i }) => ({
      month: months[i],
      period: p,
      covered: s.esi.applicable,
      wages: s.esi.wages,
      employee: s.esi.employee,
      employer: s.esi.employer,
      daysPaid: s.lop.attendance.daysInMonth - s.lop.lopDays,
      contributionPeriod: s.esi.period,
    }));
  const total = rows.reduce(
    (t, r) => ({
      wages: t.wages + r.wages,
      employee: t.employee + r.employee,
      employer: t.employer + r.employer,
      coveredMonths: t.coveredMonths + (r.covered ? 1 : 0),
    }),
    { wages: 0, employee: 0, employer: 0, coveredMonths: 0 },
  );
  return {
    rows,
    total,
    esiNo: (rosterEmployee(empId)?.statutory ?? getEmployeeProfile(empId).payroll.statutory).esiNo,
    threshold: getStatutoryConfig().esi.wageThreshold,
    employerCode: getStatutoryConfig().establishment.esiCode,
  };
}

/**
 * @typedef {Object} ItSection
 * @property {string} code
 * @property {string} label
 * @property {number} value
 * @property {{ label: string, value: number }[]} [children]
 * @property {boolean} [computed]
 */

export function buildItStatement(empId, fy) {
  const periods = fyPeriods(fy);
  const slips = periods.map((p) => slipForPeriod(empId, p));
  const latest = [...slips].reverse().find(Boolean) ?? computePayslipFor(empId, periods[0]);
  if (!latest) return [];
  const t = latest.tds;
  const paidTillDate = slips.reduce((s, x) => s + (x?.tds.monthly ?? 0), 0);
  const components = annualEarnings(empId, fy, slips, t.months ?? 12).map((e) => ({
    label: e.label,
    value: e.annual,
  }));
  const income = t.annualGross;
  const balance = Math.max(t.annualTax - paidTillDate, 0);
  // Remaining months this FY on payroll (a mid-year joiner has fewer than 12 months in total).
  const remaining = Math.max((t.months ?? 12) - slips.filter(Boolean).length, 0);

  return [
    {
      code: "A",
      label: `Projected Income (${t.regime})`,
      value: income,
      children: [
        ...components,
        // Declared income added to the projection (Form 12BB) — stored as negative lines in the engine's working.
        ...t.breakdown
          .filter((b) => /^(Previous employer salary|Other income|Rental income)/.test(b.label))
          .map((b) => ({ label: b.label, value: -b.value })),
      ],
    },
    {
      code: "B",
      // New regime: only s.10 exempt allowances — no HRA exemption and no professional-tax deduction u/s 16(iii).
      label: "Exempt allowances u/s 10 (new regime)",
      value: t.exemptions,
      children: t.breakdown.filter((b) => /Exempt allowances/i.test(b.label)),
    },
    {
      code: "C",
      label: "Gross Salary after exemptions (A − B)",
      value: income - t.exemptions,
      computed: true,
    },
    {
      code: "D",
      label: "Less Deduction under Section 16(ia)",
      value: t.standardDeduction,
      children: [{ label: "Standard Deduction", value: t.standardDeduction }],
    },
    {
      code: "E",
      label: "Income Chargeable Under The Head Salaries (C − D)",
      value: income - t.exemptions - t.standardDeduction,
      computed: true,
    },
    {
      code: "F",
      label: "Deduction Under Chapter VI-A",
      value: t.chapterVia,
      // Only the deductions that make up the Chapter VI-A figure — not the income / TDS lines of the working.
      children: t.breakdown.filter((b) => /^(80CCD|Let-out)/.test(b.label)),
    },
    { code: "G", label: "Taxable Income (E − F)", value: t.taxable, computed: true },
    { code: "H", label: "Tax on Taxable Income", value: t.slab },
    { code: "I", label: "Less Rebate u/s 87A", value: t.rebate },
    { code: "J", label: "Surcharge (above ₹50 L, with marginal relief)", value: t.surcharge ?? 0 },
    {
      code: "K",
      label: `Health & Education Cess (${getStatutoryConfig().tds.cessRate}%)`,
      value: t.cess,
    },
    {
      code: "L",
      label: "Annual Tax Liability (H − I + J + K, less TDS by previous employer)",
      value: t.annualTax,
      computed: true,
    },
    { code: "M", label: "Tax Deducted Till Date", value: paidTillDate },
    { code: "N", label: "Balance Payable", value: balance, computed: true },
    {
      code: "O",
      label: `Monthly TDS (balance ÷ ${Math.max(remaining, 1)} remaining month${remaining === 1 ? "" : "s"})`,
      value: remaining > 0 ? Math.round(balance / remaining) : 0,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Form 12BB — IT declaration (lives in declaration-data.ts)            */
/* ------------------------------------------------------------------ */
export {
  DECLARATION_COMPONENTS,
  DECLARATION_TEMPLATE,
  declarationStore,
  useDeclarations,
  getDeclaration,
  saveDeclaration,
  declarationTotal,
  withAddedField,
  withRemovedField,
} from "@/features/payroll/data/declaration-data";

export function sliceYtd(built, fromIdx, toIdx) {
  const cut = (a) => a.slice(fromIdx, toIdx + 1);
  const groups = built.groups.map((g) => ({
    name: g.name,
    rows: g.rows.map((r) => {
      const monthly = cut(r.monthly);
      return { ...r, monthly, total: monthly.reduce((s, v) => s + v, 0) };
    }),
  }));
  const netRow = groups.at(-1)?.rows.at(-1);
  return { months: cut(built.months), groups, netTotal: netRow?.total ?? 0 };
}
