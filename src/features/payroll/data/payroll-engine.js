// -----------------------------------------------------------------------------
// Payroll engine (UI-only, deterministic).
//
// One function — computePayslip() — turns an employee + pay period into a fully
// explained payslip: attendance → LOP, pro-rated earnings, PF (with ceiling,
// VPF, EPS/EDLI/admin employer legs), ESI (threshold + period lock), state PT
// and LWF, NPS, TDS (regime-aware, projected annually) and loan EMI. Everything
// downstream — the salary register, payslips, YTD/PF/IT reports, ECR, ESI and
// TDS filings — reads from this so the numbers never disagree.
//
// The run workflow underneath is maker–checker: Draft → compliance checks →
// Pending Approval → Approved → Processed → Paid. Processing is what generates
// payslips and unlocks ECR generation.
// -----------------------------------------------------------------------------
import { useSyncExternalStore } from "react";
import { createPersistentStore } from "@/lib/persist";
import {
  directoryEmployees,
  findEmployee,
  getEmployeeProfile,
  statutoryOverride,
  updateStatutoryIds,
} from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { emiForPeriod, postPayrollRecovery } from "@/features/payroll/data/loans-data";
import { insuranceDeductionFor, insuranceStore } from "@/features/finance/data/claims-data";
import { elEncashmentFor } from "@/features/leave/data/leave-engine";
import { leavePolicyStore } from "@/features/organization/data/hr-masters";
import { ORGANIZATION, can } from "@/features/auth/data/auth-session";
import {
  getStatutoryConfig,
  labourWelfareFund,
  professionalTax,
  slabTax,
  surchargeOn,
  stateOfBranch,
  NEW_REGIME_SLABS,
  policyForState,
} from "@/features/payroll/data/statutory-data";
import { computeLop, isAttendanceLocked } from "@/features/attendance/data/attendance-pattern";
import {
  monthlyNps,
  monthlyVpf,
  statutoryProfileOf,
} from "@/features/payroll/data/contributions-data";
import { getDeclaration } from "@/features/payroll/data/declaration-data";

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} RosterEmployee
 * @property {string} id
 * @property {string} name
 * @property {string} dept
 * @property {string} role
 * @property {string} branch
 * @property {string} orgId
 * @property {string} gender
 * @property {string} dob
 * @property {string} doj
 * @property {number} ctc
 * @property {{ label: string, amount: number }[]} earnings
 * @property {{ pan: string, uan: string, pfNo: string, esiNo: string }} statutory
 * @property {{ bankName: string, accountNo: string, ifsc: string, mode: string }} bank
 * @property {boolean} wageRoll - Wage-roll staff are on the muster but not in the HR directory (drivers, helpers, security).
 * @property {Employee["status"] | "Active"} status
 */

/** Low-wage staff who exercise the PF ceiling and ESI threshold — they only exist on the payroll muster. */
const WAGE_ROLL = [
  {
    id: "SRN-W001",
    name: "Ramesh Gowda",
    dept: "Office Support",
    role: "Driver",
    branch: "Bhubaneswar HQ",
    orgId: ORGANIZATION.id,
    gender: "Male",
    dob: "1988-05-11",
    doj: "2022-08-01",
    ctc: 228000,
    earnings: [
      { label: "Basic", amount: 12000 },
      { label: "House Rent Allowance", amount: 4000 },
      { label: "Conveyance", amount: 1600 },
      { label: "Special Allowance", amount: 1400 },
    ],
    statutory: {
      pan: "BXCPG4412K",
      uan: "100987654321",
      pfNo: "OR/BBS/48723/0101",
      esiNo: "5300123456",
    },
    bank: {
      bankName: "Canara Bank",
      accountNo: "XXXX XXXX 7710",
      ifsc: "CNRB0000123",
      mode: "NEFT",
    },
    wageRoll: true,
    status: "Active",
  },
  {
    id: "SRN-W002",
    name: "Lakshmi Devi",
    dept: "Office Support",
    role: "Office Assistant",
    branch: "Bhubaneswar HQ",
    orgId: ORGANIZATION.id,
    gender: "Female",
    dob: "1992-11-02",
    doj: "2023-02-13",
    ctc: 204000,
    earnings: [
      { label: "Basic", amount: 11000 },
      { label: "House Rent Allowance", amount: 3500 },
      { label: "Conveyance", amount: 1600 },
      { label: "Special Allowance", amount: 900 },
    ],
    statutory: { pan: "", uan: "100987654322", pfNo: "OR/BBS/48723/0102", esiNo: "5300123457" },
    bank: { bankName: "SBI", accountNo: "XXXX XXXX 9021", ifsc: "SBIN0004567", mode: "NEFT" },
    wageRoll: true,
    status: "Active",
  },
  {
    id: "SRN-W003",
    name: "Imran Shaikh",
    dept: "Office Support",
    role: "Security Supervisor",
    branch: "Mumbai",
    orgId: ORGANIZATION.id,
    gender: "Male",
    dob: "1985-01-25",
    doj: "2021-06-21",
    ctc: 264000,
    earnings: [
      { label: "Basic", amount: 14000 },
      { label: "House Rent Allowance", amount: 5000 },
      { label: "Conveyance", amount: 1600 },
      { label: "Special Allowance", amount: 1400 },
    ],
    statutory: {
      pan: "CMSPS7781R",
      uan: "100987654323",
      pfNo: "MH/BAN/48723/0103",
      esiNo: "3100123458",
    },
    bank: {
      bankName: "Bank of Baroda",
      accountNo: "XXXX XXXX 3312",
      ifsc: "BARB0MUMBAI",
      mode: "NEFT",
    },
    wageRoll: true,
    status: "Active",
  },
  {
    id: "SRN-W004",
    name: "Suresh Babu",
    dept: "Office Support",
    role: "Facility Technician",
    branch: "Chennai",
    orgId: ORGANIZATION.id,
    gender: "Male",
    dob: "1990-07-19",
    doj: "2024-01-08",
    ctc: 300000,
    earnings: [
      { label: "Basic", amount: 16000 },
      { label: "House Rent Allowance", amount: 6000 },
      { label: "Conveyance", amount: 1600 },
      { label: "Special Allowance", amount: 1400 },
    ],
    statutory: { pan: "DKRPB2210Q", uan: "", pfNo: "", esiNo: "" },
    bank: {
      bankName: "Indian Bank",
      accountNo: "XXXX XXXX 5580",
      ifsc: "IDIB000C001",
      mode: "NEFT",
    },
    wageRoll: true,
    status: "Active",
  },
];

const fromDirectory = (e) => {
  const p = getEmployeeProfile(e.id);
  return {
    id: e.id,
    name: e.name,
    dept: e.dept,
    role: e.role,
    branch: e.branch,
    orgId: e.orgId,
    gender: p.personal.gender,
    dob: p.personal.dob,
    doj: p.job.dateOfJoining,
    ctc: p.payroll.ctc,
    earnings: p.payroll.earnings,
    statutory: p.payroll.statutory,
    bank: p.payroll.bank,
    wageRoll: false,
    status: e.status,
  };
};

/** Everyone who is paid by the given organization this period. */
const withStatutoryFix = (w) => {
  const o = statutoryOverride(w.id);
  return o ? { ...w, statutory: { ...w.statutory, ...o } } : w;
};

export function payrollRoster(orgId = ORGANIZATION.id) {
  return [
    ...directoryEmployees()
      .filter((e) => e.orgId === orgId && e.status !== "Exited" && e.status !== "Retired")
      .map(fromDirectory),
    ...WAGE_ROLL.filter((w) => w.orgId === orgId).map(withStatutoryFix),
  ];
}

export const rosterEmployee = (empId) => {
  const dir = findEmployee(empId);
  if (dir) return fromDirectory(dir);
  const w = WAGE_ROLL.find((w) => w.id === empId);
  return w ? withStatutoryFix(w) : null;
};

/* ------------------------------------------------------------------ */
/* Period helpers                                                      */
/* ------------------------------------------------------------------ */

export const periodLabel = (period) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};
export const shortPeriod = (period) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
};
export const fyOfPeriod = (period) => {
  const [y, m] = period.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `FY ${start}-${String(start + 1).slice(2)}`;
};
/** ESI contribution period: Apr–Sep or Oct–Mar. */
export const esiPeriodOf = (period) => {
  const [y, m] = period.split("-").map(Number);
  return m >= 4 && m <= 9
    ? `Apr–Sep ${y}`
    : `Oct ${m >= 10 ? y : y - 1}–Mar ${m >= 10 ? y + 1 : y}`;
};
const nextMonth = (period) => {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const dueDate = (period, day) => `${nextMonth(period)}-${String(day).padStart(2, "0")}`;

const r0 = (n) => Math.round(n);

/**
 * The run store is created after the seed runs are computed (seeding builds payslips before the store exists), so
 * look-ups of earlier processed months go through this reference and simply find nothing while seeding.
 */
let runStoreRef = null;
/** The employee's line in a processed / paid run of `period` (any entity), or null. */
function processedLineOf(empId, period) {
  if (!runStoreRef) return null;
  for (const r of runStoreRef.get()) {
    if (r.period !== period || (r.status !== "Processed" && r.status !== "Paid")) continue;
    const l = r.lines.find((x) => x.empId === empId);
    if (l) return l;
  }
  return null;
}
const prevMonth = (period) => {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const pct = (base, rate) => r0((base * rate) / 100);
/** The PF-base component: "Basic" on salaried structures, the flat wage on the W1 / D1 wage-type structures. */
const isBasic = (label) => /basic|monthly wage|daily rate/i.test(label);

/* ------------------------------------------------------------------ */
/* Payslip                                                             */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} Line
 * @property {string} label
 * @property {number} amount
 * @property {string} [note]
 */

/**
 * @typedef {Object} ComputedPayslip
 * @property {string} empId
 * @property {string} name
 * @property {string} dept
 * @property {string} designation
 * @property {string} branch
 * @property {IndianState} state
 * @property {string} period
 * @property {string} periodLabel
 * @property {boolean} wageRoll
 * @property {number} structureGross
 * @property {LopResult} lop
 * @property {Line[]} earnings
 * @property {number} earnedGross
 * @property {{ applicable: boolean, reason: string, wages: number, epsWages: number, edliWages: number, employee: number, vpf: number, employerEpf: number, employerEps: number, edli: number, admin: number, ncpDays: number }} pf
 * @property {{ applicable: boolean, reason: string, wages: number, employee: number, employer: number, period: string }} esi
 * @property {number} pt
 * @property {{ employee: number, employer: number }} lwf
 * @property {{ employee: number, employer: number, pran: string }} nps
 * @property {{ regime: "New Regime", monthly: number, annualGross: number, exemptions: number, standardDeduction: number, chapterVia: number, taxable: number, slab: number, rebate: number, surcharge: number, cess: number, annualTax: number, months?: number, breakdown: { label: string, value: number }[] }} tds
 * @property {number} loanEmi
 * @property {Line[]} deductions
 * @property {number} totalDeductions
 * @property {number} net
 * @property {number} employerCost
 * @property {RosterEmployee["statutory"]} statutory
 * @property {RosterEmployee["bank"]} bank
 * @property {string} gender
 * @property {string} dob
 * @property {string} doj
 */

/** Loan / salary-advance EMI due this period from the Loans & Advances module (loans-data.ts). */
function loanEmiFor(empId, period) {
  return emiForPeriod(empId, period);
}

function computeTds(emp, earnedGross, structureGross, basic, npsEr, period, cfg) {
  // Seereon runs every employee on the New Tax Regime (s.115BAC default) — no old-regime option anywhere.
  const regime = "New Regime";
  const fy = fyOfPeriod(period);
  // Months of this FY the employee is on the payroll (a mid-year joiner is not projected for months before joining).
  const [py, pm] = period.split("-").map(Number);
  const fyStart = pm >= 4 ? py : py - 1;
  const fyIdx = (y, m) => (y - fyStart) * 12 + (m - 4);
  const curIdx = fyIdx(py, pm);
  const dojIdx = /^\d{4}-\d{2}/.test(emp.doj ?? "")
    ? fyIdx(Number(emp.doj.slice(0, 4)), Number(emp.doj.slice(5, 7)))
    : 0;
  const monthsInFy = 12 - Math.min(Math.max(0, dojIdx), curIdx);
  // Projected annual gross: this month's earned gross + the structure gross for the other months on payroll this FY.
  const salaryGross = earnedGross + structureGross * (monthsInFy - 1);
  const breakdown = [];
  // s.16(ia): standard deduction is the lower of ₹75,000 and the salary itself.
  const std = Math.min(cfg.tds.standardDeductionNew, salaryGross);
  const decl = getDeclaration(emp.id, fy);
  const amt = (f) => Math.max(0, Number(f.amount) || 0);
  const declared = (key) =>
    amt(decl.sections.flatMap((s) => s.fields).find((f) => f.key === key) ?? { amount: 0 });
  // Totals by Form 12BB section title so components the employee added to a section (custom.* keys) count too.
  const sectionTotal = (title) =>
    decl.sections
      .filter((s) => s.title === title)
      .flatMap((s) => s.fields)
      .reduce((s, f) => s + amt(f), 0);
  const declarationCounts = decl.status === "Submitted" || decl.status === "Locked";

  // Income declared by the employee (Form 12BB — new-regime fields only): previous employer salary, other income
  // and rent from a let-out property (its loan interest is set off only within that rental income, s.115BAC).
  const prevEmployer = declarationCounts ? declared("prev.salary") : 0;
  const otherIncome = declarationCounts ? sectionTotal("Other income") : 0;
  const rent = declarationCounts ? declared("house.letout.rent") : 0;
  const prevTds = declarationCounts ? declared("prev.tds") : 0;
  const annualGross = salaryGross + prevEmployer + otherIncome + rent;
  if (prevEmployer)
    breakdown.push({ label: "Previous employer salary (Form 12B)", value: -prevEmployer });
  if (otherIncome)
    breakdown.push({ label: "Other income declared (interest / dividend)", value: -otherIncome });
  if (rent) breakdown.push({ label: "Rental income — let-out property", value: -rent });

  // Allowances exempt under the new regime (transport allowance for specially-abled ₹3,200 p.m.; official conveyance).
  const transportExempt = Math.min(declared("exempt.transport"), 3200 * 12);
  const otherExempt = sectionTotal("Exempt allowances (new regime)") - declared("exempt.transport");
  const exemptions = declarationCounts ? Math.min(salaryGross, transportExempt + otherExempt) : 0;
  if (exemptions)
    breakdown.push({ label: "Exempt allowances u/s 10 (new regime)", value: exemptions });

  // Deductions that survive under the new regime: employer NPS u/s 80CCD(2) and the s.16 standard deduction.
  const npsEr80 = Math.min(npsEr * 12, basic * 12 * (cfg.tds.npsEmployerDeductionCapNewPct / 100));
  if (npsEr80) breakdown.push({ label: "80CCD(2) employer NPS (≤ 14 % of Basic)", value: npsEr80 });
  // Let-out property: 30 % standard deduction u/s 24(a) + loan interest u/s 24(b), capped at the rent (no loss set-off).
  const letOutLoss = rent ? Math.min(r0(rent * 0.3) + declared("house.letout.interest"), rent) : 0;
  if (letOutLoss)
    breakdown.push({
      label: "Let-out property — 30 % standard deduction + loan interest (within rent)",
      value: letOutLoss,
    });
  const chapterVia = npsEr80 + letOutLoss;
  breakdown.unshift({ label: "Standard deduction u/s 16(ia)", value: std });

  const taxable = Math.max(0, r0(annualGross - exemptions - std - chapterVia));
  const slab = slabTax(taxable, NEW_REGIME_SLABS);
  // s.87A rebate (new regime): full rebate up to the limit, then marginal relief so tax never exceeds the excess income.
  let rebate = taxable <= cfg.tds.rebate87aLimitNew ? Math.min(slab, cfg.tds.rebate87aMaxNew) : 0;
  if (taxable > cfg.tds.rebate87aLimitNew && slab > taxable - cfg.tds.rebate87aLimitNew) {
    rebate = slab - (taxable - cfg.tds.rebate87aLimitNew);
    breakdown.push({ label: "Marginal relief u/s 87A", value: rebate });
  }
  const afterRebate = slab - rebate;
  // Surcharge above ₹50 L (with marginal relief); cess is levied on tax + surcharge.
  const surcharge = surchargeOn(taxable, afterRebate, NEW_REGIME_SLABS);
  if (surcharge)
    breakdown.push({ label: "Surcharge on income-tax (with marginal relief)", value: surcharge });
  const cess = pct(afterRebate + surcharge, cfg.tds.cessRate);
  const annualTax = Math.max(0, afterRebate + surcharge + cess - prevTds);
  if (prevTds)
    breakdown.push({ label: "TDS already deducted by previous employer", value: prevTds });
  // True-up: what this employer has already deducted this FY (processed months; a month on payroll without a
  // processed run is assumed to have carried the even projection) is netted off, and the balance is spread over the
  // months left — so a mid-year declaration / revision is recovered instead of leaving a permanent short-deduction.
  const startIdx = Math.min(Math.max(0, dojIdx), curIdx);
  const evenMonthly = annualTax / monthsInFy;
  let ytdDeducted = 0;
  for (let i = startIdx; i < curIdx; i++) {
    const y = fyStart + Math.floor((3 + i) / 12);
    const m = ((3 + i) % 12) + 1;
    const prior = processedLineOf(emp.id, `${y}-${String(m).padStart(2, "0")}`);
    ytdDeducted += prior ? prior.tds.monthly : evenMonthly;
  }
  const remainingMonths = Math.max(1, 12 - curIdx);
  return {
    regime,
    monthly: r0(Math.max(0, annualTax - ytdDeducted) / remainingMonths),
    months: monthsInFy,
    ytdDeducted: r0(ytdDeducted),
    remainingMonths,
    annualGross,
    exemptions,
    standardDeduction: std,
    chapterVia,
    taxable,
    slab,
    rebate,
    surcharge,
    cess,
    annualTax,
    breakdown,
  };
}

export function computePayslip(emp, period, cfg = getStatutoryConfig()) {
  const state = stateOfBranch(emp.branch);
  const calMonth = Number(period.split("-")[1]) - 1;
  const structureGross = emp.earnings.reduce((s, e) => s + e.amount, 0);
  const lop = computeLop(emp.id, period, structureGross);
  const factor = lop.pattern.lopEnabled ? lop.payableDays / lop.pattern.workingDays : 1;

  const earnings = emp.earnings.map((e) => ({
    label: e.label,
    amount: r0(e.amount * factor),
    note:
      factor < 1
        ? `₹${e.amount.toLocaleString("en-IN")} × ${lop.payableDays}/${lop.pattern.workingDays}`
        : undefined,
  }));
  // Item 22 — year-end Earned Leave encashment as a separate (taxable) component, linked to IT.
  const structureBasic0 =
    emp.earnings.find((e) => isBasic(e.label))?.amount ?? r0(structureGross * 0.5);
  if (Number(period.slice(5, 7)) === leavePolicyStore.get().elEncashmentMonth) {
    const enc = elEncashmentFor(emp.id, structureGross, structureBasic0);
    if (enc.amount > 0)
      earnings.push({
        label: enc.component,
        amount: enc.amount,
        note: `${enc.days} EL days × ${enc.basis}/30 · year-end encashment`,
      });
  }
  const earnedGross = earnings.reduce((s, e) => s + e.amount, 0);
  const basic = earnings.find((e) => isBasic(e.label))?.amount ?? r0(earnedGross * 0.5);

  // ---------------- PF ----------------
  const sp = statutoryProfileOf(emp.id);
  const pfOn = cfg.pf.enabled && sp.pfApplicable;
  const pfMode = sp.pfMode ?? "Org default";
  const ceilingApplies =
    pfMode === "Capped"
      ? true
      : pfMode === "Full"
        ? false
        : cfg.pf.restrictToCeiling && !sp.pfInternationalWorker;
  const pfWages = pfOn ? (ceilingApplies ? Math.min(basic, cfg.pf.wageCeiling) : basic) : 0;
  const epsWages = pfOn ? Math.min(basic, cfg.pf.wageCeiling) : 0; // EPS is always ceiling-restricted
  const edliWages = epsWages;
  const pfEmployee = pct(pfWages, cfg.pf.employeeRate);
  const vpf = pfOn ? monthlyVpf(emp.id, basic, fyOfPeriod(period)) : 0;
  const employerBase = pfOn ? (cfg.pf.employerOnActual ? basic : pfWages) : 0;
  const employerEps = pct(epsWages, cfg.pf.epsRate);
  const employerTotal = pct(employerBase, cfg.pf.employerRate);
  const employerEpf = Math.max(employerTotal - employerEps, 0);
  const edli = pct(edliWages, cfg.pf.edliRate);
  const admin = pct(pfWages, cfg.pf.adminRate);
  const pfReason = !cfg.pf.enabled
    ? "PF disabled for organisation"
    : !sp.pfApplicable
      ? "Exempt — Form 11 declared, wages above ceiling"
      : ceilingApplies && basic > cfg.pf.wageCeiling
        ? `Capped — 12% of ₹${cfg.pf.wageCeiling.toLocaleString("en-IN")} ceiling${pfMode === "Capped" ? " (employee-specific)" : ""}`
        : pfMode === "Full"
          ? "12% on full basic (employee-specific, no ceiling)"
          : sp.pfInternationalWorker
            ? "International worker — full wages"
            : "Statutory member — 12% on full basic";

  // ---------------- ESI ----------------
  const esiThreshold = sp.personWithDisability ? cfg.esi.disabledThreshold : cfg.esi.wageThreshold;
  const esiAuto = structureGross <= esiThreshold;
  // Contribution-period lock: an employee covered earlier in the same Apr–Sep / Oct–Mar period stays covered until
  // the period ends even when wages cross the threshold mid-period.
  const esiPeriod = esiPeriodOf(period);
  let esiLockedIn = false;
  if (cfg.esi.lockMembershipToPeriod && sp.esiOverride === "Auto" && !esiAuto) {
    for (let p = prevMonth(period); esiPeriodOf(p) === esiPeriod; p = prevMonth(p)) {
      if (processedLineOf(emp.id, p)?.esi.applicable) {
        esiLockedIn = true;
        break;
      }
    }
  }
  const esiOn =
    cfg.esi.enabled &&
    (sp.esiOverride === "Covered" || (sp.esiOverride === "Auto" && (esiAuto || esiLockedIn)));
  const esiWages = esiOn ? earnedGross : 0;
  const esiEmployee = esiOn ? Math.ceil((esiWages * cfg.esi.employeeRate) / 100) : 0;
  const esiEmployer = esiOn ? Math.ceil((esiWages * cfg.esi.employerRate) / 100) : 0;
  const esiReason = !cfg.esi.enabled
    ? "ESI disabled"
    : sp.esiOverride === "Not covered"
      ? "Excluded by HR"
      : sp.esiOverride === "Covered"
        ? "Covered until end of contribution period"
        : esiAuto
          ? `Gross ≤ ₹${esiThreshold.toLocaleString("en-IN")}`
          : esiLockedIn
            ? `Gross above ₹${esiThreshold.toLocaleString("en-IN")} — covered until the end of ${esiPeriod} (contribution-period lock)`
            : `Gross above ₹${esiThreshold.toLocaleString("en-IN")} threshold`;

  // ---------------- State levies ----------------
  const pt = professionalTax(state, earnedGross, calMonth, emp.gender);
  const lwf = labourWelfareFund(state, calMonth);

  // ---------------- NPS ----------------
  const nps = monthlyNps(emp.id, basic, fyOfPeriod(period));

  // ---------------- TDS ----------------
  const tds = computeTds(emp, earnedGross, structureGross, basic, nps.employer, period, cfg);

  const loanEmi = loanEmiFor(emp.id, period);
  // Employee share of assigned insurance policies (Employees → Insurance) — the "monthly payroll deduction" shown there.
  const insurance = insuranceDeductionFor(insuranceStore.get(), emp.id, period);

  const deductions = [
    { label: "Provident Fund (Employee 12%)", amount: pfEmployee, note: pfReason },
    ...(vpf ? [{ label: "Voluntary PF", amount: vpf }] : []),
    ...(esiEmployee ? [{ label: "ESI (Employee 0.75%)", amount: esiEmployee }] : []),
    ...(pt ? [{ label: `Professional Tax (${state})`, amount: pt }] : []),
    ...(lwf.employee ? [{ label: `Labour Welfare Fund (${state})`, amount: lwf.employee }] : []),
    ...(nps.employee ? [{ label: "NPS (Employee)", amount: nps.employee }] : []),
    ...(tds.monthly ? [{ label: `TDS (${tds.regime})`, amount: tds.monthly }] : []),
    ...(insurance ? [{ label: "Insurance premium (employee share)", amount: insurance }] : []),
    ...(loanEmi ? [{ label: "Loan EMI", amount: loanEmi }] : []),
  ].filter((d) => d.amount > 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const net = earnedGross - totalDeductions;
  const employerCost =
    earnedGross +
    employerEpf +
    employerEps +
    edli +
    admin +
    esiEmployer +
    nps.employer +
    lwf.employer;

  return {
    empId: emp.id,
    name: emp.name,
    dept: emp.dept,
    designation: emp.role,
    branch: emp.branch,
    state,
    period,
    periodLabel: periodLabel(period),
    wageRoll: emp.wageRoll,
    structureGross,
    lop,
    earnings,
    earnedGross,
    pf: {
      applicable: pfOn,
      reason: pfReason,
      wages: pfWages,
      epsWages,
      edliWages,
      employee: pfEmployee,
      vpf,
      employerEpf,
      employerEps,
      edli,
      admin,
      ncpDays: lop.lopDays,
    },
    esi: {
      applicable: esiOn,
      reason: esiReason,
      wages: esiWages,
      employee: esiEmployee,
      employer: esiEmployer,
      period: esiPeriod,
    },
    pt,
    lwf,
    nps,
    tds,
    loanEmi,
    deductions,
    totalDeductions,
    net,
    employerCost,
    statutory: emp.statutory,
    bank: emp.bank,
    gender: emp.gender,
    dob: emp.dob,
    doj: emp.doj,
  };
}

/**
 * False during SSR and the hydration render, true afterwards. Screens that compute payslips / YTD / tax from the
 * persisted stores with `.get()` (which already holds the browser's localStorage data while React hydrates the
 * seed-based server HTML) render their data only once this is true — otherwise React reports a hydration mismatch.
 */
const noopSubscribe = () => () => {};
export const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

export const computePayslipFor = (empId, period) => {
  const emp = rosterEmployee(empId);
  return emp ? computePayslip(emp, period) : null;
};

/* ------------------------------------------------------------------ */
/* Compliance checks                                                   */
/* ------------------------------------------------------------------ */

/**
 * @typedef {"error" | "warning" | "info"} CheckLevel
 */
/**
 * @typedef {"Open" | "Resolved" | "Overridden" | "Escalated"} CheckStatus
 */
/**
 * @typedef {Object} CheckResolution
 * @property {string} by
 * @property {string} on
 * @property {"Record fixed" | "Verified manually" | "Overridden with justification"} action
 * @property {string} note
 * @property {string} [changes]
 */
/**
 * @typedef {Object} CheckEscalation
 * @property {string} toId
 * @property {string} toName
 * @property {string} toRole
 * @property {string} by
 * @property {string} on
 * @property {string} note
 * @property {string} [due]
 * @property {string} [alertId]
 */
/**
 * @typedef {Object} ComplianceCheck
 * @property {string} id - Stable across re-runs: `${code}:${empId ?? "RUN"}` — lets resolutions and escalations survive a re-check.
 * @property {string} code
 * @property {CheckLevel} level
 * @property {string} [empId]
 * @property {string} [employee]
 * @property {string} message
 * @property {boolean} [acknowledged]
 * @property {CheckStatus} [status]
 * @property {CheckResolution} [resolution]
 * @property {CheckEscalation} [escalation]
 */

/**
 * @typedef {"HR records" | "Payroll" | "Finance" | "Attendance" | "Employee" | "Statutory"} CheckArea
 */
/**
 * @typedef {Object} CheckGuide
 * @property {string} title
 * @property {CheckArea} area
 * @property {string} owner - Who normally owns the fix when HR cannot do it from here.
 * @property {string} cause
 * @property {string} fix
 * @property {boolean} hrFixable - HR can correct the record from the payroll screen itself.
 * @property {keyof StatutoryPatch} [field]
 * @property {string} [fieldLabel]
 * @property {string} [fieldHint]
 * @property {RegExp} [pattern]
 * @property {string} [route] - Route in the employee portal the concerned person is pointed to.
 */

export const CHECK_GUIDE = {
  "ATT-LOCK": {
    title: "Attendance month not locked",
    area: "Attendance",
    owner: "HR / Attendance admin",
    cause:
      "Payroll policy requires the attendance register to be frozen before LOP is computed, so late punches or regularisations cannot change pay after checks.",
    fix: "Lock the month from the Workflow actions card (or Attendance → Payroll Sync) and re-run checks.",
    hrFixable: true,
  },
  "NET-NEG": {
    title: "Negative net pay",
    area: "Payroll",
    owner: "Payroll / Finance",
    cause:
      "Fixed deductions (loan EMI, recoveries, PT) exceed the gross earned after LOP — usually a heavy-LOP month with an active loan EMI.",
    fix: "Defer or reduce the loan EMI for this period (Loans & Advances), or convert part of LOP to approved leave if attendance was wrong. Re-run checks after the correction.",
    hrFixable: false,
    route: "/org/finance",
  },
  "LOP-GT-WD": {
    title: "LOP exceeds working days",
    area: "Attendance",
    owner: "HR / Attendance admin",
    cause:
      "The day-wise register has more absent days than the pattern's working days — typically a wrong pattern mapped to the employee or duplicate absent marks.",
    fix: "Correct the attendance pattern mapping or regularise the extra absent days, then re-run checks.",
    hrFixable: false,
    route: "/org/attendance",
  },
  "PF-UAN": {
    title: "UAN missing or invalid",
    area: "HR records",
    owner: "HR (statutory records)",
    cause: "EPFO's ECR file rejects any member line without a 12-digit Universal Account Number.",
    fix: "Enter the employee's UAN below (from the EPFO member portal / previous employer's PF passbook). If the employee is a new PF member, generate the UAN on the EPFO unified portal first.",
    hrFixable: true,
    field: "uan",
    fieldLabel: "UAN (12 digits)",
    fieldHint: "As on EPFO member portal — 12 numeric digits.",
    pattern: /^\d{12}$/,
  },
  "PF-NO": {
    title: "PF member ID missing",
    area: "HR records",
    owner: "HR (statutory records)",
    cause:
      "The establishment-level PF member ID (e.g. OR/BBS/48723/0101) is not on the record; ECR still files by UAN but the register and Form 3A need it.",
    fix: "Enter the PF member ID allotted under the establishment code.",
    hrFixable: true,
    field: "pfNo",
    fieldLabel: "PF member ID",
    fieldHint: "Format: <region>/<office>/<est. code>/<member serial>",
    pattern: /^.{6,}$/,
  },
  "ESI-IP": {
    title: "ESI IP number missing",
    area: "HR records",
    owner: "HR (statutory records)",
    cause:
      "The employee is within the ESI wage ceiling and covered, but no Insured Person (IP) number is on record — the monthly contribution file cannot include them.",
    fix: "Register the employee on the ESIC portal (or fetch the existing IP number) and enter the 10–17 digit IP number below.",
    hrFixable: true,
    field: "esiNo",
    fieldLabel: "ESI IP number",
    fieldHint: "10–17 numeric digits as allotted on the ESIC portal.",
    pattern: /^\d{10,17}$/,
  },
  "ESI-EXCL": {
    title: "ESI coverage flag looks wrong",
    area: "Statutory",
    owner: "HR (statutory records)",
    cause: "Gross wages are within the ESI threshold but the employee is flagged as not covered.",
    fix: "Confirm coverage on Statutory Compliance → Attendance Patterns (contributions queue) (statutory profile). If the employee is exempt (e.g. covered elsewhere), verify manually with the reason.",
    hrFixable: false,
    route: "/org/compliance",
  },
  "ESI-LOCK": {
    title: "ESI contribution-period lock",
    area: "Statutory",
    owner: "Payroll",
    cause:
      "Wages crossed the ceiling mid contribution-period; ESI rules keep the employee covered until the period ends.",
    fix: "No action — informational. Coverage will drop from the next contribution period.",
    hrFixable: false,
  },
  "TDS-PAN": {
    title: "PAN missing or invalid",
    area: "Employee",
    owner: "Employee (self-service) / HR",
    cause:
      "TDS is being deducted but the PAN on record is blank or malformed. Without PAN, section 206AA requires deduction at 20 % and Form 16 cannot be generated.",
    fix: "Enter the PAN below if HR has the document, or send this to the employee to update their PAN in My Profile → Documents.",
    hrFixable: true,
    field: "pan",
    fieldLabel: "PAN",
    fieldHint: "Format AAAAA9999A (5 letters, 4 digits, 1 letter).",
    pattern: /^[A-Z]{5}\d{4}[A-Z]$/,
    route: "/emp/profile",
  },
  "MIN-WAGE": {
    title: "Below state minimum wage",
    area: "Payroll",
    owner: "HR / Compensation",
    cause:
      "Earned gross for a full-attendance month is below the state minimum wage floor configured for the employee's work location.",
    fix: "Revise the salary structure (Master Data → Salary Configuration) or correct the work-location mapping. If the floor in policy is outdated, update the state master under Statutory Compliance.",
    hrFixable: false,
    route: "/org/masters",
  },
  "NCP-DIM": {
    title: "NCP days exceed days in month",
    area: "Attendance",
    owner: "HR / Attendance admin",
    cause:
      "Non-contributory-period days sent to ECR are more than the calendar days in the month — bad LOP data.",
    fix: "Correct the attendance register for the period and re-run checks.",
    hrFixable: false,
    route: "/org/attendance",
  },
  "ATT-SRC": {
    title: "Attendance from summary",
    area: "Attendance",
    owner: "HR / Attendance admin",
    cause: "The day-wise register had no rows for this employee, so the monthly summary was used.",
    fix: "Informational. Import biometric punches or mark the register if day-wise LOP is needed.",
    hrFixable: false,
  },
  "VPF-CAP": {
    title: "VPF above Basic",
    area: "Statutory",
    owner: "Payroll",
    cause:
      "The voluntary PF percentage requested by the employee exceeds 100 % of Basic, which EPFO does not accept.",
    fix: "Cap the VPF request on Statutory Compliance → Attendance Patterns (contributions queue), or ask the employee to re-declare.",
    hrFixable: false,
    route: "/org/compliance",
  },
  "PT-STATE": {
    title: "Professional tax remittance",
    area: "Statutory",
    owner: "Finance",
    cause: "Reminder of the state PT liability created by this run.",
    fix: "Informational — remit under the PTRC by the due date shown on Statutory Compliance.",
    hrFixable: false,
  },
};
export const guideFor = (code) =>
  CHECK_GUIDE[code] ?? {
    title: code,
    area: "Payroll",
    owner: "Payroll",
    cause: "",
    fix: "Review the record and re-run checks.",
    hrFixable: false,
  };

/** A check still blocks the run unless it was resolved or overridden. */
export const isOpenCheck = (c) => c.status !== "Resolved" && c.status !== "Overridden";
export const checkStatusOf = (c) => c.status ?? "Open";
/** Worst outstanding level for one employee in a run. */
export function employeeCheckState(run, empId) {
  const mine = run.checks.filter((c) => c.empId === empId);
  const open = mine.filter(isOpenCheck);
  if (
    open.some((c) => c.level === "error" && c.status === "Escalated") &&
    !open.some((c) => c.level === "error" && c.status !== "Escalated")
  )
    return { label: "Escalated", checks: mine };
  if (open.some((c) => c.level === "error")) return { label: "Check failed", checks: mine };
  if (open.some((c) => c.level === "warning")) return { label: "Warning", checks: mine };
  if (mine.some((c) => c.status === "Resolved" || c.status === "Overridden"))
    return { label: "Resolved", checks: mine };
  return { label: "OK", checks: mine };
}

export function runComplianceChecks(
  lines,
  period,
  cfg = getStatutoryConfig(),
  /** The run's entity — the attendance lock is per company, not whichever entity is active on screen. */
  orgId,
) {
  const out = [];
  const dim = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate();
  if (cfg.payroll.requireAttendanceLock && !isAttendanceLocked(period, orgId)) {
    out.push({
      code: "ATT-LOCK",
      level: "error",
      message: `Attendance for ${periodLabel(period)} is not locked. Lock it on the Attendance → Payroll Sync tab before running payroll.`,
    });
  }
  for (const l of lines) {
    const tag = { empId: l.empId, employee: l.name };
    if (l.net < 0)
      out.push({
        code: "NET-NEG",
        level: "error",
        ...tag,
        message: `Net pay is negative (₹${l.net.toLocaleString("en-IN")}) — deductions exceed earned gross.`,
      });
    if (l.lop.lopDays > l.lop.pattern.workingDays)
      out.push({
        code: "LOP-GT-WD",
        level: "error",
        ...tag,
        message: `LOP days (${l.lop.lopDays}) exceed the pattern's working days.`,
      });
    if (l.pf.applicable && !/^\d{12}$/.test(l.statutory.uan))
      out.push({
        code: "PF-UAN",
        level: "error",
        ...tag,
        message: "UAN missing or not 12 digits — ECR line would be rejected by EPFO.",
      });
    if (l.pf.applicable && !l.statutory.pfNo)
      out.push({
        code: "PF-NO",
        level: "warning",
        ...tag,
        message: "PF member ID missing on the record.",
      });
    if (l.esi.applicable && !/^\d{10,17}$/.test(l.statutory.esiNo))
      out.push({
        code: "ESI-IP",
        level: "error",
        ...tag,
        message: "ESI covered but IP number missing — cannot file monthly contribution.",
      });
    // Persons with disability are covered up to the higher PWD threshold.
    if (
      cfg.esi.enabled &&
      !l.esi.applicable &&
      l.structureGross <=
        (statutoryProfileOf(l.empId).personWithDisability
          ? cfg.esi.disabledThreshold
          : cfg.esi.wageThreshold)
    )
      out.push({
        code: "ESI-EXCL",
        level: "warning",
        ...tag,
        message: "Gross is within the ESI threshold but the employee is marked not covered.",
      });
    if (l.esi.applicable && l.structureGross > cfg.esi.wageThreshold)
      out.push({
        code: "ESI-LOCK",
        level: "info",
        ...tag,
        message: `Gross crossed the ESI threshold — coverage continues until the end of ${l.esi.period} (contribution-period lock).`,
      });
    if (l.tds.monthly > 0 && !/^[A-Z]{5}\d{4}[A-Z]$/.test(l.statutory.pan))
      out.push({
        code: "TDS-PAN",
        level: "error",
        ...tag,
        message:
          "TDS deducted but PAN missing/invalid — deduct at 20 % u/s 206AA or collect PAN before processing.",
      });
    const policy = policyForState(l.state);
    if (l.earnedGross < policy.minimumWage && l.lop.lopDays === 0)
      out.push({
        code: "MIN-WAGE",
        level: "warning",
        ...tag,
        message: `Earned gross ₹${l.earnedGross.toLocaleString("en-IN")} is below the ${l.state} minimum wage floor (₹${policy.minimumWage.toLocaleString("en-IN")}).`,
      });
    if (l.pf.ncpDays > dim)
      out.push({
        code: "NCP-DIM",
        level: "error",
        ...tag,
        message: "NCP days exceed days in month.",
      });
    if (l.lop.attendance.source === "Profile summary")
      out.push({
        code: "ATT-SRC",
        level: "info",
        ...tag,
        message:
          "Attendance for this period came from the monthly summary, not the day-wise register.",
      });
    if (
      l.pf.vpf > 0 &&
      l.pf.vpf > (l.earnings.find((e) => isBasic(e.label))?.amount ?? r0(l.earnedGross * 0.5))
    )
      out.push({
        code: "VPF-CAP",
        level: "warning",
        ...tag,
        message: "VPF exceeds Basic — EPFO caps voluntary contribution at 100 % of Basic.",
      });
  }
  const ptStates = new Set(lines.filter((l) => l.pt > 0).map((l) => l.state));
  ptStates.forEach((s) =>
    out.push({
      code: "PT-STATE",
      level: "info",
      message: `${s} Professional Tax applied to ${lines.filter((l) => l.state === s && l.pt > 0).length} employee(s); remit by the 20th under PTRC.`,
    }),
  );
  const seen = new Map();
  return out.map((c) => {
    const base = `${c.code}:${c.empId ?? "RUN"}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...c, id: n === 1 ? base : `${base}#${n}`, status: "Open" };
  });
}

/** Re-run keeps resolutions / escalations recorded against the same check id. */
function mergeCheckState(fresh, previous) {
  const prev = new Map(previous.map((c) => [c.id, c]));
  return fresh.map((c) => {
    const p = prev.get(c.id);
    if (!p) return c;
    return {
      ...c,
      acknowledged: p.acknowledged,
      status: p.status === "Resolved" ? "Open" : (p.status ?? "Open"),
      resolution: p.status === "Overridden" ? p.resolution : undefined,
      escalation: p.status === "Escalated" ? p.escalation : undefined,
    };
  });
}
/** Checks that disappeared after a record fix are kept as "Resolved" for the audit trail. */
function resolvedSince(previous, fresh) {
  const now = new Set(fresh.map((c) => c.id));
  return previous.filter(
    (c) => !now.has(c.id) && (c.status === "Resolved" || c.status === "Escalated" || c.resolution),
  );
}

/* ------------------------------------------------------------------ */
/* Payroll run workflow                                                */
/* ------------------------------------------------------------------ */

/**
 * @typedef {| "Draft" | "Checks Failed" | "Checks Passed" | "Pending Approval" | "Approved" | "Rejected" | "Processed" | "Paid"} RunStatus
 */

/**
 * @typedef {Object} Approval
 * @property {string} level
 * @property {string} by
 * @property {string} byId
 * @property {string} on
 * @property {"Approved" | "Rejected"} decision
 * @property {string} remarks
 */

/**
 * @typedef {Object} RunTotals
 * @property {number} employees
 * @property {number} structureGross
 * @property {number} lop
 * @property {number} lopDays
 * @property {number} earnedGross
 * @property {number} deductions
 * @property {number} net
 * @property {number} pfEmployee
 * @property {number} vpf
 * @property {number} pfEmployer
 * @property {number} pfAdmin
 * @property {number} edli
 * @property {number} esiEmployee
 * @property {number} esiEmployer
 * @property {number} pt
 * @property {number} lwfEmployee
 * @property {number} lwfEmployer
 * @property {number} npsEmployee
 * @property {number} npsEmployer
 * @property {number} tds
 * @property {number} loanEmi
 * @property {number} employerCost
 */

/**
 * @typedef {Object} PayrollRunV2
 * @property {string} id
 * @property {string} orgId
 * @property {string} title
 * @property {string} period
 * @property {string} frequency
 * @property {string} payDate
 * @property {string} bankAccount
 * @property {RunStatus} status
 * @property {{ id: string, name: string }} preparedBy
 * @property {string} preparedOn
 * @property {ComplianceCheck[]} checks
 * @property {string} [checkedOn]
 * @property {Approval[]} approvals
 * @property {string[]} approvalLevels
 * @property {string} [processedOn]
 * @property {string} [processedBy]
 * @property {string} [paidOn]
 * @property {string} [paymentRef]
 * @property {ComputedPayslip[]} lines
 * @property {RunTotals} totals
 * @property {{ at: string, by: string, action: string }[]} history
 */

export function totalsOf(lines) {
  const t = {
    employees: lines.length,
    structureGross: 0,
    lop: 0,
    lopDays: 0,
    earnedGross: 0,
    deductions: 0,
    net: 0,
    pfEmployee: 0,
    vpf: 0,
    pfEmployer: 0,
    pfAdmin: 0,
    edli: 0,
    esiEmployee: 0,
    esiEmployer: 0,
    pt: 0,
    lwfEmployee: 0,
    lwfEmployer: 0,
    npsEmployee: 0,
    npsEmployer: 0,
    tds: 0,
    loanEmi: 0,
    employerCost: 0,
  };
  for (const l of lines) {
    t.structureGross += l.structureGross;
    t.lop += l.lop.lopAmount;
    t.lopDays += l.lop.lopDays;
    t.earnedGross += l.earnedGross;
    t.deductions += l.totalDeductions;
    t.net += l.net;
    t.pfEmployee += l.pf.employee;
    t.vpf += l.pf.vpf;
    t.pfEmployer += l.pf.employerEpf + l.pf.employerEps;
    t.pfAdmin += l.pf.admin;
    t.edli += l.pf.edli;
    t.esiEmployee += l.esi.employee;
    t.esiEmployer += l.esi.employer;
    t.pt += l.pt;
    t.lwfEmployee += l.lwf.employee;
    t.lwfEmployer += l.lwf.employer;
    t.npsEmployee += l.nps.employee;
    t.npsEmployer += l.nps.employer;
    t.tds += l.tds.monthly;
    t.loanEmi += l.loanEmi;
    t.employerCost += l.employerCost;
  }
  return t;
}

const now = () => new Date().toISOString().slice(0, 10);

function buildRun(partial) {
  const cfg = getStatutoryConfig();
  const preparedOn = partial.preparedOn ?? now();
  // Employees serving notice are still paid until their last working day.
  const lines = payrollRoster(partial.orgId).map((e) => computePayslip(e, partial.period, cfg));
  return {
    ...partial,
    frequency: partial.frequency ?? "Monthly",
    status: partial.status ?? "Draft",
    preparedOn,
    checks: [],
    approvals: [],
    approvalLevels: cfg.payroll.approvalLevels,
    lines,
    totals: totalsOf(lines),
    history: [{ at: preparedOn, by: partial.preparedBy.name, action: "Payroll run created" }],
  };
}

/** Seed: two completed months and the current month as a draft, so every workflow state is visible on first load. */
function seedRuns() {
  const hr = { id: "SRN-0004", name: "Varen Mishra" };
  const mk = (period, status, extra = {}) => {
    const run = buildRun({
      id: `PR-${period.replace("-", "")}`,
      orgId: ORGANIZATION.id,
      title: `${periodLabel(period)} Salary`,
      period,
      payDate: dueDate(period, 1),
      bankAccount: "HDFC Bank — Payroll ••4821",
      preparedBy: hr,
      status,
      // Seeds must be deterministic (same on server and client) — never stamp them with today's date.
      preparedOn: `${period}-28`,
    });
    return { ...run, ...extra };
  };
  const done = (period, checkedOn, approvedOn, processedOn, paidOn) =>
    mk(period, "Paid", {
      preparedOn: checkedOn,
      checkedOn,
      checks: [
        {
          id: "PT-STATE:RUN",
          code: "PT-STATE",
          level: "info",
          status: "Open",
          message: "Odisha / Maharashtra / Tamil Nadu Professional Tax applied.",
        },
      ],
      approvals: [
        {
          level: "Payroll Admin",
          by: "Varen Mishra",
          byId: "SRN-0004",
          on: checkedOn,
          decision: "Approved",
          remarks: "Register reconciled with attendance.",
        },
        {
          level: "Finance",
          by: "Saras Venkatesh",
          byId: "SRN-0002",
          on: approvedOn,
          decision: "Approved",
          remarks: "Bank file authorised.",
        },
      ],
      processedOn,
      processedBy: "Varen Mishra",
      paidOn,
      paymentRef: `NEFT-BULK-${period.replace("-", "")}`,
      history: [
        { at: checkedOn, by: "Varen Mishra", action: "Run created & compliance checks passed" },
        { at: approvedOn, by: "Saras Venkatesh", action: "Approved at Finance level" },
        { at: processedOn, by: "Varen Mishra", action: "Processed — payslips generated" },
        { at: paidOn, by: "Saras Venkatesh", action: "Bank transfer confirmed" },
      ],
    });
  // July is left at "Checks Failed" so the drill-down (resolve here / send to concerned person) is visible on first load.
  const july = mk("2026-07", "Draft");
  let julyChecks = [];
  try {
    julyChecks = runComplianceChecks(july.lines, "2026-07", getStatutoryConfig()).filter(
      (c) => c.code !== "ATT-LOCK",
    );
  } catch {
    julyChecks = [];
  }
  const julyErrors = julyChecks.filter((c) => c.level === "error").length;
  const julyRun = {
    ...july,
    checks: julyChecks,
    checkedOn: julyChecks.length ? "2026-07-28 10:12" : undefined,
    status: julyChecks.length ? (julyErrors ? "Checks Failed" : "Checks Passed") : "Draft",
    history: julyChecks.length
      ? [
          ...july.history,
          {
            at: "2026-07-28 10:12",
            by: hr.name,
            action: `Compliance checks run — ${julyErrors} open error(s), ${julyChecks.filter((c) => c.level === "warning").length} warning(s)`,
          },
        ]
      : july.history,
  };
  return [
    julyRun,
    done("2026-06", "2026-06-29", "2026-06-30", "2026-06-30", "2026-07-01"),
    done("2026-05", "2026-05-29", "2026-05-30", "2026-05-30", "2026-06-01"),
    done("2026-04", "2026-04-29", "2026-04-30", "2026-04-30", "2026-05-01"),
  ];
}

export const payrollRunStore = createPersistentStore("seereon.payroll.runs.v3", seedRuns());
runStoreRef = payrollRunStore;
export const usePayrollRuns = () => payrollRunStore.use();
export const runById = (id) => payrollRunStore.get().find((r) => r.id === id) ?? null;

const update = (id, fn) =>
  payrollRunStore.set((list) => list.map((r) => (r.id === id ? fn(r) : r)));

const log = (r, by, action) => ({
  ...r,
  history: [...r.history, { at: now(), by, action }],
});

/**
 * @typedef {Object} WorkflowResult
 * @property {boolean} ok
 * @property {string} message
 */

export function createRun(input, user) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period))
    return { ok: false, message: "Choose a valid pay period (month)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.payDate) || input.payDate < `${input.period}-01`)
    return {
      ok: false,
      message: "Pay date must be a valid date on or after the start of the pay period.",
    };
  const exists = payrollRunStore
    .get()
    .find((r) => r.orgId === input.orgId && r.period === input.period && r.status !== "Rejected");
  if (exists)
    return {
      ok: false,
      message: `A payroll run for ${periodLabel(input.period)} already exists (${exists.id} · ${exists.status}). Reject or complete it before creating another.`,
    };
  const run = buildRun({
    id: `PR-${input.period.replace("-", "")}-${Math.floor(100 + Math.random() * 899)}`,
    ...input,
    preparedBy: { id: user.id, name: user.name },
  });
  payrollRunStore.set((p) => [run, ...p]);
  return {
    ok: true,
    message: `${run.id} created with ${run.lines.length} employees — run compliance checks next.`,
  };
}

/** Recompute the register against live attendance/config and run all checks. */
/** Another live (non-rejected) run for the same organisation and period — reviving a rejected run would double-pay. */
const otherActiveRun = (run) =>
  payrollRunStore
    .get()
    .find(
      (r) =>
        r.id !== run.id &&
        r.orgId === run.orgId &&
        r.period === run.period &&
        r.status !== "Rejected",
    ) ?? null;

export function runChecks(id, user) {
  const run = runById(id);
  if (!run) return { ok: false, message: "Run not found." };
  if (!["Draft", "Checks Failed", "Checks Passed", "Rejected"].includes(run.status))
    return { ok: false, message: `Cannot re-check a run that is ${run.status}.` };
  const dup = run.status === "Rejected" ? otherActiveRun(run) : null;
  if (dup)
    return {
      ok: false,
      message: `${dup.id} is already the live run for ${periodLabel(run.period)} — this rejected run cannot be revived.`,
    };
  const cfg = getStatutoryConfig();
  const lines = payrollRoster(run.orgId).map((e) => computePayslip(e, run.period, cfg));
  const fresh = runComplianceChecks(lines, run.period, cfg, run.orgId);
  const checks = [
    ...mergeCheckState(fresh, run.checks),
    ...resolvedSince(run.checks, fresh).map((c) => ({
      ...c,
      status: "Resolved",
      resolution: c.resolution ?? {
        by: c.escalation?.toName ?? user.name,
        on: now(),
        action: "Record fixed",
        note: c.escalation
          ? `Fixed after escalation to ${c.escalation.toName}`
          : "No longer detected on re-check",
      },
    })),
  ];
  const errors = checks.filter((c) => c.level === "error" && isOpenCheck(c)).length;
  const status = errors > 0 && cfg.payroll.blockOnErrors ? "Checks Failed" : "Checks Passed";
  update(id, (r) =>
    log(
      {
        ...r,
        lines,
        totals: totalsOf(lines),
        checks,
        checkedOn: now(),
        status,
        approvalLevels: cfg.payroll.approvalLevels,
        // A rejected / sent-back run starts the approval chain afresh — earlier "Approved" decisions must not let it
        // skip levels after the register is recomputed.
        approvals: r.status === "Rejected" || r.status === "Draft" ? [] : r.approvals,
      },
      user.name,
      `Compliance checks run — ${errors} open error(s), ${checks.filter((c) => c.level === "warning" && isOpenCheck(c)).length} warning(s)`,
    ),
  );
  return {
    ok: status === "Checks Passed",
    message:
      status === "Checks Passed"
        ? `All checks passed for ${lines.length} employees.`
        : `${errors} blocking error(s) — click an employee marked "Check failed" to resolve or escalate.`,
  };
}

const CHECK_EDITABLE = ["Draft", "Checks Failed", "Checks Passed", "Rejected"];

/** Errors that describe impossible pay data — they must be corrected at source, never overridden. */
export const NON_OVERRIDABLE_CHECKS = new Set(["NET-NEG", "NCP-DIM", "LOP-GT-WD"]);

/**
 * Can `user` override / manually verify this check? Warnings and info: anyone working the run. Blocking errors: never
 * for the non-overridable codes; otherwise only an approver who did not prepare the run (maker–checker).
 * @returns {{ ok: boolean, reason?: string }}
 */
export function overridePermission(run, check, user) {
  if (check.level !== "error") return { ok: true };
  if (NON_OVERRIDABLE_CHECKS.has(check.code))
    return {
      ok: false,
      reason: `${guideFor(check.code).title} cannot be overridden — correct the underlying record and re-run checks.`,
    };
  if (run.preparedBy.id === user.id)
    return {
      ok: false,
      reason: "Maker–checker: the person who prepared the run cannot override a blocking error.",
    };
  if (!can(user.role, "payroll.approve"))
    return { ok: false, reason: "Only a payroll approver can override a blocking error." };
  return { ok: true };
}

/**
 * HR resolves a failed check from the payroll screen: either by fixing the statutory record
 * (UAN / PF ID / ESI IP / PAN — the register is recomputed and the check re-evaluated) or by
 * verifying / overriding with a written justification that stays on the run's audit trail.
 */
export function resolveCheck(runId, checkId, user, input) {
  const run = runById(runId);
  if (!run) return { ok: false, message: "Run not found." };
  if (!CHECK_EDITABLE.includes(run.status))
    return { ok: false, message: `Checks are frozen once a run is ${run.status}.` };
  const check = run.checks.find((c) => c.id === checkId);
  if (!check) return { ok: false, message: "Check not found on this run." };
  const guide = guideFor(check.code);
  if (input.action === "Record fixed") {
    if (!check.empId || !guide.field || !input.patch)
      return { ok: false, message: "This check has no record field HR can edit here." };
    const value = (input.patch[guide.field] ?? "").trim();
    if (guide.pattern && !guide.pattern.test(value))
      return {
        ok: false,
        message: `${guide.fieldLabel ?? guide.field} is not in the expected format.`,
      };
    updateStatutoryIds(check.empId, { [guide.field]: value });
    const cfg = getStatutoryConfig();
    const lines = payrollRoster(run.orgId).map((e) => computePayslip(e, run.period, cfg));
    const fresh = runComplianceChecks(lines, run.period, cfg, run.orgId);
    if (fresh.some((c) => c.id === checkId))
      return {
        ok: false,
        message: "Record saved, but the check still fails — verify the value entered.",
      };
    const resolution = {
      by: user.name,
      on: now(),
      action: "Record fixed",
      note: input.note.trim(),
      changes: `${guide.fieldLabel ?? guide.field} → ${value}`,
    };
    const checks = [
      ...mergeCheckState(fresh, run.checks),
      ...resolvedSince(run.checks, fresh).map((c) =>
        c.id === checkId ? { ...c, status: "Resolved", resolution } : { ...c, status: "Resolved" },
      ),
    ];
    if (!checks.some((c) => c.id === checkId))
      checks.push({ ...check, status: "Resolved", resolution });
    const errors = checks.filter((c) => c.level === "error" && isOpenCheck(c)).length;
    const status = errors > 0 && cfg.payroll.blockOnErrors ? "Checks Failed" : "Checks Passed";
    update(runId, (r) =>
      log(
        { ...r, lines, totals: totalsOf(lines), checks, checkedOn: now(), status },
        user.name,
        `${check.code} resolved for ${check.employee} — ${resolution.changes}`,
      ),
    );
    return {
      ok: true,
      message: `${guide.title} fixed for ${check.employee}. ${errors ? `${errors} error(s) still open.` : "All checks now pass."}`,
    };
  }
  if (!input.note.trim())
    return {
      ok: false,
      message: "A justification note is required to verify or override a check.",
    };
  const perm = overridePermission(run, check, user);
  if (!perm.ok) return { ok: false, message: perm.reason };
  const resolution = { by: user.name, on: now(), action: input.action, note: input.note.trim() };
  update(runId, (r) => {
    const checks = r.checks.map((c) =>
      c.id === checkId
        ? { ...c, status: "Overridden", acknowledged: true, resolution, escalation: undefined }
        : c,
    );
    const errors = checks.filter((c) => c.level === "error" && isOpenCheck(c)).length;
    const cfg = getStatutoryConfig();
    const status =
      r.status === "Draft" || r.status === "Rejected"
        ? r.status
        : errors > 0 && cfg.payroll.blockOnErrors
          ? "Checks Failed"
          : "Checks Passed";
    return log(
      { ...r, checks, status },
      user.name,
      `${check.code} ${input.action.toLowerCase()} for ${check.employee ?? "run"} — ${resolution.note}`,
    );
  });
  return {
    ok: true,
    message: `${guide.title} marked "${input.action}" — recorded on the run's audit trail.`,
  };
}

/** Not an HR fix → send to the concerned person; they get an in-app notification and the check shows as Escalated until it clears. */
export function escalateCheck(runId, checkId, user, input) {
  const run = runById(runId);
  if (!run) return { ok: false, message: "Run not found." };
  if (!CHECK_EDITABLE.includes(run.status))
    return { ok: false, message: `Checks are frozen once a run is ${run.status}.` };
  const check = run.checks.find((c) => c.id === checkId);
  if (!check) return { ok: false, message: "Check not found on this run." };
  if (!input.toId) return { ok: false, message: "Choose the concerned person." };
  const guide = guideFor(check.code);
  const escalation = {
    toId: input.toId,
    toName: input.toName,
    toRole: input.toRole,
    by: user.name,
    on: now(),
    note: input.note.trim(),
    due: input.due,
  };
  pushAlert({
    empId: input.toId,
    kind: "payroll",
    to: guide.route ?? "/emp/dashboard",
    title: `Payroll check ${check.code} needs your action — ${periodLabel(run.period)}`,
    body: `${guide.title}${check.employee ? ` for ${check.employee} (${check.empId})` : ""}: ${check.message} ${input.note.trim() ? `Note from ${user.name}: ${input.note.trim()}` : ""}${input.due ? ` Due by ${input.due}.` : ""}`,
  });
  update(runId, (r) =>
    log(
      {
        ...r,
        checks: r.checks.map((c) =>
          c.id === checkId ? { ...c, status: "Escalated", escalation } : c,
        ),
      },
      user.name,
      `${check.code} for ${check.employee ?? "run"} sent to ${input.toName} (${input.toRole})${input.due ? ` · due ${input.due}` : ""}`,
    ),
  );
  return { ok: true, message: `Sent to ${input.toName} — notification delivered to their portal.` };
}

export function acknowledgeWarnings(id, user) {
  update(id, (r) =>
    log(
      {
        ...r,
        checks: r.checks.map((c) => (c.level === "warning" ? { ...c, acknowledged: true } : c)),
      },
      user.name,
      "Warnings acknowledged",
    ),
  );
}

export function submitForApproval(id, user) {
  const run = runById(id);
  if (!run) return { ok: false, message: "Run not found." };
  if (run.status !== "Checks Passed")
    return {
      ok: false,
      message: "Run compliance checks (and pass them) before submitting for approval.",
    };
  if (run.checks.some((c) => c.level === "warning" && !c.acknowledged && isOpenCheck(c)))
    return { ok: false, message: "Acknowledge all warnings before submitting." };
  const cfg = getStatutoryConfig();
  // Attendance may have been unlocked after the checks passed — LOP could change, so the checks must be re-run.
  if (cfg.payroll.requireAttendanceLock && !isAttendanceLocked(run.period, run.orgId))
    return {
      ok: false,
      message: `Attendance for ${periodLabel(run.period)} was unlocked after the checks — lock it and re-run checks before submitting.`,
    };
  if (!run.approvalLevels.length)
    return {
      ok: false,
      message:
        "No approval levels are configured — set the approval chain under Statutory Compliance → Statutory Config.",
    };
  update(id, (r) =>
    log(
      { ...r, status: "Pending Approval" },
      user.name,
      `Submitted for approval → ${r.approvalLevels[0]}`,
    ),
  );
  return { ok: true, message: `Submitted — awaiting ${run.approvalLevels[0]}.` };
}

/** Roles allowed to sign each approval level (SuperAdmin may stand in, but never for two levels of one run). */
export const LEVEL_ROLES = {
  "Payroll Admin": ["SuperAdmin", "Admin", "CHRO", "HR"],
  "HR Manager": ["SuperAdmin", "Admin", "CHRO", "HR"],
  Finance: ["CFO", "SuperAdmin"],
  CFO: ["CFO", "SuperAdmin"],
};
export const roleMayApproveLevel = (role, level) => (LEVEL_ROLES[level] ?? []).includes(role);

export const nextApprovalLevel = (run) =>
  run.approvalLevels[run.approvals.filter((a) => a.decision === "Approved").length] ?? null;

export function decideRun(id, user, decision, remarks) {
  const run = runById(id);
  if (!run) return { ok: false, message: "Run not found." };
  if (run.status !== "Pending Approval")
    return { ok: false, message: "Run is not awaiting approval." };
  const cfg = getStatutoryConfig();
  // Maker–checker applies to every role (the policy text promises "can never approve"); rejection is always allowed.
  if (cfg.payroll.enforceMakerChecker && decision === "Approved" && run.preparedBy.id === user.id) {
    return {
      ok: false,
      message: "Maker–checker: the person who prepared the run cannot approve it.",
    };
  }
  const level = nextApprovalLevel(run);
  if (!level) return { ok: false, message: "No pending approval level." };
  if (decision === "Approved" && !roleMayApproveLevel(user.role, level))
    return {
      ok: false,
      message: `The ${level} level must be approved by ${(LEVEL_ROLES[level] ?? []).join(" / ") || "a configured role"} — your role (${user.role}) cannot sign it.`,
    };
  // Each level needs a different approver — one person cannot clear the whole chain.
  if (
    decision === "Approved" &&
    run.approvals.some((a) => a.decision === "Approved" && a.byId === user.id)
  )
    return {
      ok: false,
      message: `You already approved this run at an earlier level — ${level} needs a different approver.`,
    };
  const approval = { level, by: user.name, byId: user.id, on: now(), decision, remarks };
  update(id, (r) => {
    const approvals = [...r.approvals, approval];
    const remaining = r.approvalLevels[approvals.filter((a) => a.decision === "Approved").length];
    const status =
      decision === "Rejected" ? "Rejected" : remaining ? "Pending Approval" : "Approved";
    return log(
      { ...r, approvals, status },
      user.name,
      decision === "Rejected"
        ? `Rejected at ${level}: ${remarks}`
        : remaining
          ? `Approved at ${level} → awaiting ${remaining}`
          : `Approved at ${level} — ready to process`,
    );
  });
  return {
    ok: true,
    message:
      decision === "Rejected" ? "Run rejected and returned to payroll." : `Approved at ${level}.`,
  };
}

/** An approver returns the run to HR without rejecting it outright: straight back to Draft with the note on the trail. */
export function sendBackRun(id, user, remarks) {
  const run = runById(id);
  if (!run) return { ok: false, message: "Run not found." };
  if (run.status !== "Pending Approval")
    return { ok: false, message: "Only a run awaiting approval can be sent back." };
  if (!String(remarks ?? "").trim())
    return { ok: false, message: "Say what needs correcting before sending it back." };
  const level = nextApprovalLevel(run);
  update(id, (r) =>
    log(
      {
        ...r,
        status: "Draft",
        // The register will be corrected and recomputed — every level must approve it afresh (the earlier decisions
        // stay on the history trail).
        approvals: [],
      },
      user.name,
      `Sent back to payroll at ${level}: ${remarks}`,
    ),
  );
  return { ok: true, message: "Run sent back to payroll for correction." };
}

export function processRun(id, user) {
  const run = runById(id);
  if (!run) return { ok: false, message: "Run not found." };
  if (run.status !== "Approved")
    return { ok: false, message: "Only an approved run can be processed." };
  update(id, (r) =>
    log(
      { ...r, status: "Processed", processedOn: now(), processedBy: user.name },
      user.name,
      `Processed — ${r.lines.length} payslips generated; ECR / ESI / TDS filings unlocked`,
    ),
  );
  return {
    ok: true,
    message: `${run.lines.length} payslips generated for ${periodLabel(run.period)}.`,
  };
}

export function markPaid(id, user, paymentRef) {
  const run = runById(id);
  if (!run) return { ok: false, message: "Run not found." };
  if (run.status !== "Processed")
    return { ok: false, message: "Process the run before recording the bank transfer." };
  update(id, (r) =>
    log(
      { ...r, status: "Paid", paidOn: now(), paymentRef },
      user.name,
      `Bank transfer confirmed · ${paymentRef}`,
    ),
  );
  // The EMIs this run deducted are now recovered — post them to the loan ledger (Loans & Advances).
  run.lines
    .filter((l) => l.loanEmi > 0)
    .forEach((l) => postPayrollRecovery(l.empId, run.period, user.name));
  return { ok: true, message: "Payment recorded." };
}

export function reopenRun(id, user) {
  const run = runById(id);
  if (!run) return { ok: false, message: "Run not found." };
  if (!["Rejected", "Checks Failed", "Checks Passed"].includes(run.status))
    return { ok: false, message: "Only rejected / unsubmitted runs can be reopened." };
  const dup = run.status === "Rejected" ? otherActiveRun(run) : null;
  if (dup)
    return {
      ok: false,
      message: `${dup.id} is already the live run for ${periodLabel(run.period)} — this rejected run cannot be reopened.`,
    };
  update(id, (r) =>
    log({ ...r, status: "Draft", approvals: [], checks: [] }, user.name, "Reopened as draft"),
  );
  return { ok: true, message: "Run reopened." };
}

/** Payslips visible to an employee: only from processed/paid runs. */
export function payslipsFor(empId) {
  return payrollRunStore
    .get()
    .filter((r) => r.status === "Processed" || r.status === "Paid")
    .map((r) => ({ run: r, slip: r.lines.find((l) => l.empId === empId) }))
    .filter((x) => x.slip)
    .sort((a, b) => (a.run.period < b.run.period ? 1 : -1));
}

export const runTone = (s) =>
  s === "Paid" || s === "Processed" || s === "Approved" || s === "Checks Passed"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Pending Approval"
      ? "border-gold/40 bg-gold/15 text-gold"
      : s === "Rejected" || s === "Checks Failed"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

export const RUN_STEPS = [
  "Draft",
  "Checks Passed",
  "Pending Approval",
  "Approved",
  "Processed",
  "Paid",
];
export const runStepIndex = (s) => {
  if (s === "Checks Failed") return 0;
  if (s === "Rejected") return 2;
  return RUN_STEPS.indexOf(s);
};
