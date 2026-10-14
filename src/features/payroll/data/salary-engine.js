// -----------------------------------------------------------------------------
// Salary configuration & calculation engine (UI-only).
//
// MoM #15/#16/#31: enter a CTC → every component is computed from the master
// salary structure for the employee's grade. Components are grouped into
// INCLUSIONS (part of gross pay) and EXCLUSIONS (employer cost / benefits that
// sit inside CTC but are not paid in the monthly gross — employer PF, gratuity,
// insurance premium, variable pay). Each employee is on one of three wage
// types: Salaried (monthly structure), Monthly-wage (flat monthly wage,
// pro-rata by days) or Daily-wage (rate × days). Structures are per grade and
// live under Master Data → Salary Configuration.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {"Salaried" | "Monthly wage" | "Daily wage"} WageType
 */
export const WAGE_TYPES = ["Salaried", "Monthly wage", "Daily wage"];

/**
 * @typedef {"% of CTC" | "% of Basic" | "Fixed monthly" | "Balancing"} ComponentBasis
 */
/**
 * @typedef {Object} SalaryComponent
 * @property {string} code
 * @property {string} label
 * @property {"Inclusion" | "Exclusion"} section
 * @property {ComponentBasis} basis
 * @property {number} value
 * @property {number} [cap]
 * @property {boolean} taxable
 * @property {"PF_BASE" | "ESI_BASE" | "GRATUITY" | "EMPLOYER_PF" | "EMPLOYER_ESI" | "INSURANCE" | "VARIABLE"} [statutory]
 * @property {boolean} showOnPayslip
 */

/**
 * @typedef {Object} SalaryStructure
 * @property {string} grade
 * @property {string} name
 * @property {WageType} wageType
 * @property {SalaryComponent[]} components
 * @property {number} workingDays - For daily/monthly wage: default working days for the rate.
 * @property {string} notes
 * @property {boolean} active
 */

const STD = [
  {
    code: "BASIC",
    label: "Basic",
    section: "Inclusion",
    basis: "% of CTC",
    value: 40,
    taxable: true,
    statutory: "PF_BASE",
    showOnPayslip: true,
  },
  {
    code: "HRA",
    label: "House Rent Allowance",
    section: "Inclusion",
    basis: "% of Basic",
    value: 40,
    taxable: true,
    showOnPayslip: true,
  },
  {
    code: "CONV",
    label: "Conveyance",
    section: "Inclusion",
    basis: "Fixed monthly",
    value: 1600,
    taxable: true,
    showOnPayslip: true,
  },
  {
    code: "MED",
    label: "Medical Allowance",
    section: "Inclusion",
    basis: "Fixed monthly",
    value: 1250,
    taxable: true,
    showOnPayslip: true,
  },
  {
    code: "LTA",
    label: "Leave Travel Allowance",
    section: "Inclusion",
    basis: "% of Basic",
    value: 8.33,
    taxable: true,
    showOnPayslip: true,
  },
  {
    code: "SPL",
    label: "Special Allowance",
    section: "Inclusion",
    basis: "Balancing",
    value: 0,
    taxable: true,
    showOnPayslip: true,
  },
  {
    code: "EPF_ER",
    label: "Employer PF",
    section: "Exclusion",
    basis: "% of Basic",
    value: 12,
    cap: 1800,
    taxable: false,
    statutory: "EMPLOYER_PF",
    showOnPayslip: false,
  },
  {
    code: "GRAT",
    label: "Gratuity provision",
    section: "Exclusion",
    basis: "% of Basic",
    value: 4.81,
    taxable: false,
    statutory: "GRATUITY",
    showOnPayslip: false,
  },
  {
    code: "GMC",
    label: "Group mediclaim premium",
    section: "Exclusion",
    basis: "Fixed monthly",
    value: 650,
    taxable: false,
    statutory: "INSURANCE",
    showOnPayslip: false,
  },
];

export const DEFAULT_STRUCTURES = [
  {
    grade: "G3",
    name: "Standard India — Individual Contributor",
    wageType: "Salaried",
    components: STD,
    workingDays: 26,
    notes: "Default for grades G3/G4/G5. Employer PF on statutory ceiling.",
    active: true,
  },
  {
    grade: "G4",
    name: "Standard India — Senior IC",
    wageType: "Salaried",
    components: STD,
    workingDays: 26,
    notes: "",
    active: true,
  },
  {
    grade: "G5",
    name: "Standard India — Lead",
    wageType: "Salaried",
    components: STD.map((c) => (c.code === "EPF_ER" ? { ...c, cap: undefined } : c)),
    workingDays: 26,
    notes: "Employer PF on actual Basic (no ceiling).",
    active: true,
  },
  {
    grade: "M1",
    name: "Manager structure",
    wageType: "Salaried",
    components: [
      ...STD.filter((c) => c.code !== "SPL"),
      {
        code: "CAR",
        label: "Car / fuel allowance",
        section: "Inclusion",
        basis: "Fixed monthly",
        value: 8000,
        taxable: true,
        showOnPayslip: true,
      },
      {
        code: "VAR",
        label: "Variable pay (annual)",
        section: "Exclusion",
        basis: "% of CTC",
        value: 10,
        taxable: true,
        statutory: "VARIABLE",
        showOnPayslip: false,
      },
      STD.find((c) => c.code === "SPL"),
    ],
    workingDays: 26,
    notes: "10 % of CTC is variable, paid annually on rating.",
    active: true,
  },
  {
    grade: "W1",
    name: "Monthly-wage staff",
    wageType: "Monthly wage",
    components: [
      {
        code: "WAGE",
        label: "Monthly wage",
        section: "Inclusion",
        basis: "% of CTC",
        value: 100,
        taxable: true,
        statutory: "PF_BASE",
        showOnPayslip: true,
      },
      {
        code: "EPF_ER",
        label: "Employer PF",
        section: "Exclusion",
        basis: "% of Basic",
        value: 12,
        cap: 1800,
        taxable: false,
        statutory: "EMPLOYER_PF",
        showOnPayslip: false,
      },
      {
        code: "ESI_ER",
        label: "Employer ESI",
        section: "Exclusion",
        basis: "% of Basic",
        value: 3.25,
        taxable: false,
        statutory: "EMPLOYER_ESI",
        showOnPayslip: false,
      },
    ],
    workingDays: 26,
    notes: "Flat monthly wage; pro-rated by payable days. PF on full wage (below ceiling).",
    active: true,
  },
  {
    grade: "D1",
    name: "Daily-wage workers",
    wageType: "Daily wage",
    components: [
      {
        code: "DAILY",
        label: "Daily rate",
        section: "Inclusion",
        basis: "% of CTC",
        value: 100,
        taxable: true,
        statutory: "PF_BASE",
        showOnPayslip: true,
      },
      {
        code: "EPF_ER",
        label: "Employer PF",
        section: "Exclusion",
        basis: "% of Basic",
        value: 12,
        cap: 1800,
        taxable: false,
        statutory: "EMPLOYER_PF",
        showOnPayslip: false,
      },
      {
        code: "ESI_ER",
        label: "Employer ESI",
        section: "Exclusion",
        basis: "% of Basic",
        value: 3.25,
        taxable: false,
        statutory: "EMPLOYER_ESI",
        showOnPayslip: false,
      },
    ],
    workingDays: 26,
    notes: "CTC ÷ 12 ÷ working days = daily rate. Wage register per Odisha rules.",
    active: true,
  },
];

export const salaryStructureStore = createPersistentStore(
  "seereon.masters.salary-structures",
  DEFAULT_STRUCTURES,
);
export const useSalaryStructures = () => salaryStructureStore.use();
export const structureFor = (grade, list = salaryStructureStore.get()) =>
  list.find((s) => s.grade === grade && s.active) ?? list[0];
export const saveStructure = (s) =>
  salaryStructureStore.set((l) =>
    l.some((x) => x.grade === s.grade) ? l.map((x) => (x.grade === s.grade ? s : x)) : [...l, s],
  );

/**
 * @typedef {Object} Breakup
 * @property {string} grade
 * @property {WageType} wageType
 * @property {number} ctc
 * @property {number} monthlyCtc
 * @property {{ code: string, label: string, monthly: number, annual: number, taxable: boolean }[]} earnings
 * @property {{ code: string, label: string, monthly: number, annual: number }[]} exclusions
 * @property {number} monthlyGross
 * @property {number} employerCostMonthly
 * @property {number} basic
 * @property {number} dailyRate
 * @property {number} workingDays
 */

/** Enter CTC → every component. Balancing component absorbs the residual so inclusions + exclusions = CTC/12. */
export function computeSalaryBreakup(ctc, grade, list = salaryStructureStore.get()) {
  const s = structureFor(grade, list);
  const monthlyCtc = Math.round(ctc / 12);
  const basicComp = s.components.find((c) => c.statutory === "PF_BASE");
  const balancing = s.components.find((c) => c.basis === "Balancing");
  const basicFromCtc = basicComp
    ? basicComp.basis === "% of CTC"
      ? Math.round((monthlyCtc * basicComp.value) / 100)
      : basicComp.value
    : Math.round(monthlyCtc * 0.4);
  /** Every non-balancing component for a given Basic (the PF-base component *is* the Basic). */
  const fixedFor = (basic) =>
    s.components
      .filter((c) => c.basis !== "Balancing")
      .map((c) => {
        if (c === basicComp) return { c, v: basic };
        let v =
          c.basis === "% of CTC"
            ? (monthlyCtc * c.value) / 100
            : c.basis === "% of Basic"
              ? (basic * c.value) / 100
              : c.basis === "Fixed monthly"
                ? c.value
                : 0;
        if (c.cap) v = Math.min(v, c.cap);
        return { c, v: Math.round(v) };
      });
  const sumOf = (rows) => rows.reduce((t, x) => t + x.v, 0);
  let basic = basicFromCtc;
  let fixed = fixedFor(basic);
  // No balancing component (wage-type structures): the wage is 100 % of CTC and the employer PF / ESI sit on top,
  // so shrink the wage until wage + employer statutory cost fits inside the CTC.
  if (!balancing && basicComp && sumOf(fixed) > monthlyCtc) {
    let lo = 0;
    let hi = basic;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (sumOf(fixedFor(mid)) <= monthlyCtc) lo = mid;
      else hi = mid;
    }
    basic = lo;
    fixed = fixedFor(basic);
  }
  const residual = Math.max(monthlyCtc - sumOf(fixed), 0);
  const all = [...fixed, ...(balancing ? [{ c: balancing, v: residual }] : [])];
  const earnings = all
    .filter((x) => x.c.section === "Inclusion")
    .map((x) => ({
      code: x.c.code,
      label: x.c.label,
      monthly: x.v,
      annual: x.v * 12,
      taxable: x.c.taxable,
    }));
  const exclusions = all
    .filter((x) => x.c.section === "Exclusion")
    .map((x) => ({ code: x.c.code, label: x.c.label, monthly: x.v, annual: x.v * 12 }));
  const monthlyGross = earnings.reduce((t, e) => t + e.monthly, 0);
  return {
    grade: s.grade,
    wageType: s.wageType,
    ctc,
    monthlyCtc,
    earnings,
    exclusions,
    monthlyGross,
    employerCostMonthly: monthlyGross + exclusions.reduce((t, e) => t + e.monthly, 0),
    basic,
    dailyRate: Math.round(monthlyGross / s.workingDays),
    workingDays: s.workingDays,
  };
}

/* ------------------------- Payroll processing policy ------------------------ */
/**
 * @typedef {Object} PayrollPolicy
 * @property {"Last day of month" | "Last working day" | "Fixed day"} processingDay
 * @property {number} fixedDay
 * @property {number} evaluationLeadDays
 * @property {"HR" | "CHRO" | "CFO"} evaluatorRole
 * @property {number} cutoffDay
 * @property {string} updatedBy
 * @property {string} updatedOn
 */
export const payrollPolicyStore = createPersistentStore("seereon.payroll.policy", {
  processingDay: "Last working day",
  fixedDay: 28,
  evaluationLeadDays: 3,
  evaluatorRole: "CHRO",
  cutoffDay: 25,
  updatedBy: "Saras Venkatesh",
  updatedOn: "2026-04-01",
});
export const usePayrollPolicy = () => payrollPolicyStore.use();
export const savePayrollPolicy = (p, by) =>
  payrollPolicyStore.set({ ...p, updatedBy: by, updatedOn: new Date().toISOString().slice(0, 10) });
export function processingDateFor(period, p = payrollPolicyStore.get()) {
  const [y, m] = period.split("-").map(Number);
  if (p.processingDay === "Fixed day")
    return `${period}-${String(Math.min(p.fixedDay, new Date(y, m, 0).getDate())).padStart(2, "0")}`;
  const d = new Date(y, m, 0);
  if (p.processingDay === "Last working day")
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  // Format in local time — toISOString() would shift a local-midnight date to the previous day for IST (+05:30).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
