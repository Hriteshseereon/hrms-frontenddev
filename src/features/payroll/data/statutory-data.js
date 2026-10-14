// -----------------------------------------------------------------------------
// Statutory master data (UI-only) — the state-aware layer under payroll.
//
// Indian payroll compliance is partly central (PF, ESI, TDS) and partly state
// specific (Professional Tax slabs, Labour Welfare Fund, minimum wages). This
// module owns:
//   • the branch → state mapping every payroll line resolves through,
//   • per-state PT slabs, LWF contributions and minimum-wage floors,
//   • the organisation-level statutory configuration (PF ceiling, ESI
//     threshold, TDS regime defaults, remittance due-days) as a persistent
//     store the Statutory Compliance screen edits.
// Rates are the FY 2026-27 published values as understood at build time — the
// screen labels them "policy" so Finance can adjust without a release.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";

export const INDIAN_STATES = [
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Telangana",
  "Odisha",
  "Rajasthan",
  "Jharkhand",
  "West Bengal",
  "Gujarat",
  "Andhra Pradesh",
  "Delhi",
  "Haryana",
  "Uttar Pradesh",
  "Madhya Pradesh",
  "Kerala",
  "Chhattisgarh",
];
/**
 * @typedef {(typeof INDIAN_STATES)[number]} IndianState
 */

/** Every branch / office string used anywhere in the app resolves to a state. */
export const BRANCH_STATE = {
  "Bhubaneswar HQ": "Odisha",
  Whitefield: "Karnataka",
  Mumbai: "Maharashtra",
  BKC: "Maharashtra",
  Pune: "Maharashtra",
  Hinjewadi: "Maharashtra",
  Chennai: "Tamil Nadu",
  OMR: "Tamil Nadu",
  Hyderabad: "Telangana",
  "Hyderabad Office": "Telangana",
  "Pune Office": "Maharashtra",
  "Kolkata Office": "West Bengal",
  Bhubaneswar: "Odisha",
  Kolkata: "West Bengal",
  Ahmedabad: "Gujarat",
  Delhi: "Delhi",
  Gurugram: "Haryana",
};

export const stateOfBranch = (branch) => BRANCH_STATE[branch] ?? "Odisha";

/* ------------------------------------------------------------------ */
/* Professional Tax — state slabs (monthly gross → monthly PT)          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} PtSlab
 * @property {number | null} upTo
 * @property {number} amount
 * @property {string} [note]
 */

/**
 * @typedef {Object} StatePolicy
 * @property {IndianState} state
 * @property {PtSlab[]} ptSlabs - Professional Tax slabs ordered ascending by `upTo`; `null` = and above.
 * @property {{ month: number, amount: number }} [ptAdjustMonth] - Month index (0 = Jan) in which the annual/adjusted PT amount applies (e.g. Maharashtra ₹300 in February).
 * @property {boolean} [ptHalfYearly] - Tamil Nadu / Kerala levy PT per half-year: slabs are half-yearly income → half-yearly amount, deducted in September and March.
 * @property {boolean} ptApplicable
 * @property {{ employee: number, employer: number, frequency: "Monthly" | "Half-yearly" | "Annual" | "Not applicable", months: number[] }} lwf - Labour Welfare Fund contribution per cycle.
 * @property {number} minimumWage - Minimum monthly wage floor (unskilled, Zone A) used for a payroll pre-check.
 * @property {"Implemented" | "Partially implemented"} esiZone - State ESI applicability note (ESI is central but implemented zone-wise).
 */

const NO_LWF = {
  employee: 0,
  employer: 0,
  frequency: "Not applicable",
  months: [],
};

export const STATE_POLICIES = [
  {
    state: "Karnataka",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 25000, amount: 0 },
      { upTo: null, amount: 200 },
    ],
    lwf: { employee: 20, employer: 40, frequency: "Annual", months: [11] },
    minimumWage: 16118,
    esiZone: "Implemented",
  },
  {
    state: "Maharashtra",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 7500, amount: 0 },
      { upTo: 10000, amount: 175, note: "Women exempt up to ₹25,000" },
      { upTo: null, amount: 200 },
    ],
    ptAdjustMonth: { month: 1, amount: 300 },
    lwf: { employee: 25, employer: 75, frequency: "Half-yearly", months: [5, 11] },
    minimumWage: 13470,
    esiZone: "Implemented",
  },
  {
    state: "Tamil Nadu",
    ptApplicable: true,
    ptHalfYearly: true,
    ptSlabs: [
      { upTo: 21000, amount: 0 },
      { upTo: 30000, amount: 135 },
      { upTo: 45000, amount: 315 },
      { upTo: 60000, amount: 690 },
      { upTo: 75000, amount: 1025 },
      { upTo: null, amount: 1250 },
    ],
    lwf: { employee: 20, employer: 40, frequency: "Annual", months: [11] },
    minimumWage: 11616,
    esiZone: "Implemented",
  },
  {
    state: "Telangana",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 15000, amount: 0 },
      { upTo: 20000, amount: 150 },
      { upTo: null, amount: 200 },
    ],
    lwf: { employee: 2, employer: 5, frequency: "Annual", months: [11] },
    minimumWage: 12140,
    esiZone: "Implemented",
  },
  {
    state: "Odisha",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 13304, amount: 0 },
      { upTo: 25000, amount: 125 },
      { upTo: null, amount: 200 },
    ],
    ptAdjustMonth: { month: 2, amount: 300 },
    lwf: NO_LWF,
    minimumWage: 12220,
    esiZone: "Implemented",
  },
  {
    state: "Rajasthan",
    ptApplicable: false,
    ptSlabs: [{ upTo: null, amount: 0, note: "No Professional Tax levied" }],
    lwf: NO_LWF,
    minimumWage: 7930,
    esiZone: "Implemented",
  },
  {
    state: "Jharkhand",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 25000, amount: 0 },
      { upTo: 41666, amount: 100 },
      { upTo: 66666, amount: 150 },
      { upTo: 83333, amount: 175 },
      { upTo: null, amount: 208 },
    ],
    lwf: NO_LWF,
    minimumWage: 9870,
    esiZone: "Implemented",
  },
  {
    state: "West Bengal",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 10000, amount: 0 },
      { upTo: 15000, amount: 110 },
      { upTo: 25000, amount: 130 },
      { upTo: 40000, amount: 150 },
      { upTo: null, amount: 200 },
    ],
    lwf: { employee: 3, employer: 15, frequency: "Half-yearly", months: [5, 11] },
    minimumWage: 9724,
    esiZone: "Implemented",
  },
  {
    state: "Gujarat",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 12000, amount: 0 },
      { upTo: null, amount: 200 },
    ],
    lwf: { employee: 6, employer: 12, frequency: "Half-yearly", months: [5, 11] },
    minimumWage: 11752,
    esiZone: "Implemented",
  },
  {
    state: "Andhra Pradesh",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 15000, amount: 0 },
      { upTo: 20000, amount: 150 },
      { upTo: null, amount: 200 },
    ],
    lwf: { employee: 30, employer: 70, frequency: "Annual", months: [11] },
    minimumWage: 11400,
    esiZone: "Implemented",
  },
  {
    state: "Delhi",
    ptApplicable: false,
    ptSlabs: [{ upTo: null, amount: 0, note: "No Professional Tax levied" }],
    lwf: { employee: 0.75, employer: 2.25, frequency: "Half-yearly", months: [5, 11] },
    minimumWage: 18066,
    esiZone: "Implemented",
  },
  {
    state: "Haryana",
    ptApplicable: false,
    ptSlabs: [{ upTo: null, amount: 0, note: "No Professional Tax levied" }],
    lwf: {
      employee: 31,
      employer: 62,
      frequency: "Monthly",
      months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
    minimumWage: 10924,
    esiZone: "Implemented",
  },
  {
    state: "Uttar Pradesh",
    ptApplicable: false,
    ptSlabs: [{ upTo: null, amount: 0, note: "No Professional Tax levied" }],
    lwf: NO_LWF,
    minimumWage: 10648,
    esiZone: "Implemented",
  },
  {
    state: "Madhya Pradesh",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 18750, amount: 0 },
      { upTo: 25000, amount: 125 },
      { upTo: 33333, amount: 167 },
      { upTo: null, amount: 208 },
    ],
    ptAdjustMonth: { month: 2, amount: 212 },
    lwf: { employee: 10, employer: 30, frequency: "Half-yearly", months: [5, 11] },
    minimumWage: 11800,
    esiZone: "Implemented",
  },
  {
    state: "Kerala",
    ptApplicable: true,
    ptHalfYearly: true,
    ptSlabs: [
      { upTo: 11999, amount: 0 },
      { upTo: 17999, amount: 120 },
      { upTo: 29999, amount: 180 },
      { upTo: 44999, amount: 300 },
      { upTo: 99999, amount: 450 },
      { upTo: 124999, amount: 600 },
      { upTo: null, amount: 1250 },
    ],
    lwf: { employee: 20, employer: 20, frequency: "Half-yearly", months: [5, 11] },
    minimumWage: 12500,
    esiZone: "Implemented",
  },
  {
    state: "Chhattisgarh",
    ptApplicable: true,
    ptSlabs: [
      { upTo: 12500, amount: 0 },
      { upTo: 16667, amount: 150 },
      { upTo: 20833, amount: 180 },
      { upTo: 25000, amount: 190 },
      { upTo: null, amount: 200 },
    ],
    lwf: { employee: 15, employer: 45, frequency: "Half-yearly", months: [5, 11] },
    minimumWage: 10430,
    esiZone: "Implemented",
  },
];

export const policyForState = (state) =>
  STATE_POLICIES.find((p) => p.state === state) ?? STATE_POLICIES[0];

/** Monthly Professional Tax for a gross in a given state and calendar month (0 = Jan). */
export function professionalTax(state, monthlyGross, calendarMonth, gender) {
  const p = policyForState(state);
  if (!p.ptApplicable) return 0;
  if (state === "Maharashtra" && gender === "Female" && monthlyGross <= 25000) return 0;
  // Half-yearly states: slabs are half-yearly income → half-yearly amount, deducted with the September and March salary.
  if (p.ptHalfYearly) {
    if (calendarMonth !== 8 && calendarMonth !== 2) return 0;
    const half = monthlyGross * 6;
    return (p.ptSlabs.find((s) => s.upTo === null || half <= s.upTo) ?? p.ptSlabs.at(-1)).amount;
  }
  const slab = p.ptSlabs.find((s) => s.upTo === null || monthlyGross <= s.upTo) ?? p.ptSlabs.at(-1);
  if (slab.amount === 0) return 0;
  if (p.ptAdjustMonth && p.ptAdjustMonth.month === calendarMonth && slab.upTo === null)
    return p.ptAdjustMonth.amount;
  return slab.amount;
}

/** Employee LWF deduction for a calendar month (0 = Jan); employer share returned alongside. */
export function labourWelfareFund(state, calendarMonth) {
  const { lwf } = policyForState(state);
  if (lwf.frequency === "Not applicable" || !lwf.months.includes(calendarMonth))
    return { employee: 0, employer: 0 };
  return { employee: lwf.employee, employer: lwf.employer };
}

/* ------------------------------------------------------------------ */
/* Organisation statutory configuration                                */
/* ------------------------------------------------------------------ */

/**
 * Seereon applies the New Tax Regime (s.115BAC) to every employee — there is no old-regime option in the product.
 * @typedef {"New Regime"} TaxRegime
 */

/**
 * @typedef {Object} StatutoryConfig
 * @property {{ pfCode: string, esiCode: string, tan: string, pan: string, registeredState: IndianState, ptRegistration: string }} establishment
 * @property {{ enabled: boolean, employeeRate: number, employerRate: number, epsRate: number, edliRate: number, adminRate: number, wageCeiling: number, restrictToCeiling: boolean, employerOnActual: boolean, remittanceDueDay: number, ecrVersion: "2.0" }} pf
 * @property {{ enabled: boolean, employeeRate: number, employerRate: number, wageThreshold: number, disabledThreshold: number, remittanceDueDay: number, lockMembershipToPeriod: boolean }} esi
 * @property {{ defaultRegime: TaxRegime, standardDeductionNew: number, cessRate: number, rebate87aLimitNew: number, rebate87aMaxNew: number, remittanceDueDay: number, quarterlyReturnForm: "24Q", npsEmployerDeductionCapNewPct: number }} tds
 * @property {{ approvalLevels: ("Payroll Admin" | "HR Manager" | "Finance" | "CFO")[], enforceMakerChecker: boolean, blockOnErrors: boolean, requireAttendanceLock: boolean, payDay: number }} payroll
 * @property {string} updatedOn
 * @property {string} updatedBy
 */

export const DEFAULT_STATUTORY_CONFIG = {
  establishment: {
    pfCode: "ORBBS0048723000",
    esiCode: "53000123450001001",
    tan: "BBNS12345E",
    pan: "AAECS1234F",
    registeredState: "Odisha",
    ptRegistration: "PTRC-OD-2019-018273",
  },
  pf: {
    enabled: true,
    employeeRate: 12,
    employerRate: 12,
    epsRate: 8.33,
    edliRate: 0.5,
    adminRate: 0.5,
    wageCeiling: 15000,
    restrictToCeiling: true,
    employerOnActual: false,
    remittanceDueDay: 15,
    ecrVersion: "2.0",
  },
  esi: {
    enabled: true,
    employeeRate: 0.75,
    employerRate: 3.25,
    wageThreshold: 21000,
    disabledThreshold: 25000,
    remittanceDueDay: 15,
    lockMembershipToPeriod: true,
  },
  tds: {
    defaultRegime: "New Regime",
    standardDeductionNew: 75000,
    cessRate: 4,
    rebate87aLimitNew: 1200000,
    rebate87aMaxNew: 60000,
    remittanceDueDay: 7,
    quarterlyReturnForm: "24Q",
    npsEmployerDeductionCapNewPct: 14,
  },
  payroll: {
    approvalLevels: ["Payroll Admin", "Finance"],
    enforceMakerChecker: true,
    blockOnErrors: true,
    requireAttendanceLock: true,
    payDay: 1,
  },
  updatedOn: "2026-04-01",
  updatedBy: "Saras Venkatesh (CFO)",
};

export const statutoryConfigStore = createPersistentStore(
  "seereon.statutory.config",
  DEFAULT_STATUTORY_CONFIG,
);
export const useStatutoryConfig = () => statutoryConfigStore.use();
export const getStatutoryConfig = () => statutoryConfigStore.get();
export function saveStatutoryConfig(next, by) {
  statutoryConfigStore.set({
    ...next,
    updatedOn: new Date().toISOString().slice(0, 10),
    updatedBy: by,
  });
}

/* ------------------------------------------------------------------ */
/* Income-tax slabs — New Regime (s.115BAC), FY 2026-27 / AY 2027-28    */
/* Per Finance Act 2025 rates; verify against the latest Finance Act    */
/* before each financial year.                                          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} Slab
 * @property {number | null} upTo
 * @property {number} rate
 */

export const NEW_REGIME_SLABS = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 5 },
  { upTo: 1200000, rate: 10 },
  { upTo: 1600000, rate: 15 },
  { upTo: 2000000, rate: 20 },
  { upTo: 2400000, rate: 25 },
  { upTo: null, rate: 30 },
];

/** Human-readable slab table for the tax document form and the compliance screen. */
export const NEW_REGIME_SLAB_ROWS = NEW_REGIME_SLABS.map((s, i, arr) => ({
  range:
    i === 0
      ? `Up to ₹${(s.upTo / 100000).toFixed(0)} L`
      : s.upTo
        ? `₹${(arr[i - 1].upTo / 100000).toFixed(0)} L – ₹${(s.upTo / 100000).toFixed(0)} L`
        : `Above ₹${(arr[i - 1].upTo / 100000).toFixed(0)} L`,
  rate: `${s.rate} %`,
}));

/** What the new regime allows and disallows — surfaced on the declaration & tax document screens. */
export const NEW_REGIME_RULES = {
  allowed: [
    "Standard deduction ₹75,000 u/s 16(ia)",
    "Employer NPS contribution u/s 80CCD(2) — up to 14 % of Basic + DA",
    "Rebate u/s 87A when taxable income ≤ ₹12,00,000 (max ₹60,000) with marginal relief just above the limit",
    "Health & Education Cess 4 % on tax after rebate",
    "Exempt allowances: gratuity, leave encashment on exit, employer PF within limits, transport allowance for specially-abled, conveyance for official duty",
    "Family pension deduction ₹25,000 (where applicable)",
  ],
  notAllowed: [
    "Chapter VI-A deductions — 80C (PF, PPF, ELSS, LIC, tuition), 80D (mediclaim), 80E, 80G, 80TTA",
    "HRA exemption u/s 10(13A) and LTA u/s 10(5)",
    "Professional tax deduction u/s 16(iii)",
    "Housing-loan interest on self-occupied property u/s 24(b)",
    "Employee NPS u/s 80CCD(1B)",
  ],
  surcharge:
    "Surcharge 10 % above ₹50 L, 15 % above ₹1 Cr, 25 % above ₹2 Cr (capped at 25 % in the new regime).",
};

/** Slab tax on a taxable income, before rebate and cess. */
export function slabTax(taxable, slabs) {
  let tax = 0;
  let lower = 0;
  for (const s of slabs) {
    const upper = s.upTo ?? Infinity;
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * (s.rate / 100);
    lower = upper;
    if (taxable <= upper) break;
  }
  return Math.round(tax);
}

/** Surcharge tiers on income-tax under the new regime (s.115BAC caps the top rate at 25 %). */
export const NEW_REGIME_SURCHARGE = [
  { above: 5000000, rate: 10 },
  { above: 10000000, rate: 15 },
  { above: 20000000, rate: 25 },
];

/**
 * Surcharge on `taxAfterRebate` for a taxable income, with marginal relief: tax + surcharge may not exceed
 * the tax (+ surcharge) at the tier threshold plus the income above that threshold.
 */
export function surchargeOn(taxable, taxAfterRebate, slabs = NEW_REGIME_SLABS) {
  for (let i = NEW_REGIME_SURCHARGE.length - 1; i >= 0; i--) {
    const tier = NEW_REGIME_SURCHARGE[i];
    if (taxable <= tier.above) continue;
    const raw = Math.round((taxAfterRebate * tier.rate) / 100);
    const taxAtThreshold = slabTax(tier.above, slabs);
    const lower = NEW_REGIME_SURCHARGE[i - 1];
    const surchargeAtThreshold = lower ? Math.round((taxAtThreshold * lower.rate) / 100) : 0;
    const maxTotal = taxAtThreshold + surchargeAtThreshold + (taxable - tier.above);
    return Math.max(0, Math.min(raw, maxTotal - taxAfterRebate));
  }
  return 0;
}

/**
 * Compliance calendar — statutory due dates per month, used for the Overview tab.
 * @typedef {Object} ComplianceDue
 * @property {string} code
 * @property {string} title
 * @property {number} dueDay
 * @property {string} form
 * @property {string} authority
 * @property {string} frequency
 */
export function complianceCalendar(cfg = getStatutoryConfig()) {
  return [
    {
      code: "TDS",
      title: "TDS on salaries — deposit",
      dueDay: cfg.tds.remittanceDueDay,
      form: "Challan ITNS 281",
      authority: "Income Tax Dept.",
      frequency: "Monthly",
    },
    {
      code: "PF",
      title: "EPF contribution & ECR filing",
      dueDay: cfg.pf.remittanceDueDay,
      form: `ECR v${cfg.pf.ecrVersion} + TRRN challan`,
      authority: "EPFO Unified Portal",
      frequency: "Monthly",
    },
    {
      code: "ESI",
      title: "ESI contribution",
      dueDay: cfg.esi.remittanceDueDay,
      form: "MC challan",
      authority: "ESIC",
      frequency: "Monthly",
    },
    {
      code: "PT",
      title: "Professional Tax — remit & return",
      dueDay: 20,
      form: "PTRC return",
      authority: "State Commercial Tax",
      frequency: "Monthly / as per state",
    },
    {
      code: "24Q",
      title: "Quarterly TDS return",
      dueDay: 31,
      form: "Form 24Q",
      authority: "TRACES",
      frequency: "Quarterly",
    },
    {
      code: "LWF",
      title: "Labour Welfare Fund",
      dueDay: 15,
      form: "State LWF challan",
      authority: "State Labour Welfare Board",
      frequency: "Half-yearly / annual (state)",
    },
  ];
}
