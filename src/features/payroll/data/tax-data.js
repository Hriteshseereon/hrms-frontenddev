// Tax & compliance — Form 16 / Form 12BB document records (UI-only), New Tax Regime only.
// A "Generated" Form 16 carries the full Part A / Part B working computed from the payroll engine
// (gross, standard deduction, 80CCD(2), taxable income, slab-wise tax, 87A rebate, cess, quarterly TDS).
import { createPersistentStore } from "@/lib/persist";
import { nextId } from "@/lib/store";
import { computePayslipFor } from "@/features/payroll/data/payroll-engine";
import {
  getStatutoryConfig,
  NEW_REGIME_SLABS,
  slabTax,
  surchargeOn,
} from "@/features/payroll/data/statutory-data";
import { annualEarnings, fyPeriods, slipForPeriod } from "@/features/payroll/data/payroll-reports";
import { ORGANIZATION } from "@/features/auth/data/auth-session";
import { exportMatrixPdf } from "@/lib/export-utils";
import { pushAlert } from "@/features/communications/data/employee-alerts";

export const FINANCIAL_YEARS = ["FY 2026-27", "FY 2025-26", "FY 2024-25", "FY 2023-24"];
export const TAX_FORM_TYPES = ["Form 16", "Form 12BB", "Form 12BA", "Form 16 Part A only"];
/**
 * @typedef {(typeof TAX_FORM_TYPES)[number]} TaxFormType
 */
export const TAX_DOC_STATUSES = ["Generated", "Uploaded", "Pending", "Verified", "Issued"];
/**
 * @typedef {(typeof TAX_DOC_STATUSES)[number]} TaxDocStatus
 */

/**
 * @typedef {Object} TdsQuarter
 * @property {"Q1" | "Q2" | "Q3" | "Q4"} quarter
 * @property {string} period
 * @property {string} receiptNo
 * @property {number} amount
 * @property {string} depositedOn
 * @property {string} challanBsr
 */

/**
 * @typedef {Object} Form16Working
 * @property {"New Regime"} regime
 * @property {string} assessmentYear
 * @property {{ name: string, address: string, tan: string, pan: string, signatory: string, designation: string, place: string }} employer
 * @property {{ pan: string, designation: string, department: string, periodFrom: string, periodTo: string }} employee
 * @property {number} grossSalary - Part B
 * @property {{ label: string, annual: number }[]} salaryComponents
 * @property {number} perquisites
 * @property {number} profitsInLieu
 * @property {number} previousEmployerSalary
 * @property {number} exemptAllowances
 * @property {number} standardDeduction
 * @property {number} professionalTax
 * @property {number} deduction80ccd2
 * @property {number} otherIncome
 * @property {number} letOutLoss
 * @property {number} taxableIncome
 * @property {{ range: string, rate: number, amount: number, tax: number }[]} slabRows
 * @property {number} slabTax
 * @property {number} rebate87a
 * @property {number} surcharge
 * @property {number} cess
 * @property {number} totalTax
 * @property {TdsQuarter[]} quarters - Part A
 * @property {number} tdsDeducted
 * @property {number} previousEmployerTds
 * @property {number} taxPayableOrRefund
 * @property {string} certificateNo
 * @property {"Part A + Part B" | "Part A only" | "Part B only"} parts
 * @property {boolean} digitallySigned
 * @property {string} remarks
 */

/**
 * @typedef {Object} TaxDocument
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {TaxFormType} form
 * @property {string} fy
 * @property {string} quarter
 * @property {string} fileName
 * @property {string} grossSalary
 * @property {string} taxDeducted
 * @property {TaxDocStatus} status
 * @property {string} issuedOn
 * @property {"Generated" | "Uploaded"} source
 * @property {{ at: string, by: string, action: string }[]} history
 * @property {Form16Working} [working]
 * @property {string} [uploadedNote]
 */

const fyStartYear = (fy) => Number(fy.replace("FY ", "").slice(0, 4));
export const assessmentYearOf = (fy) => {
  const y = fyStartYear(fy);
  return `AY ${y + 1}-${String(y + 2).slice(2)}`;
};
const pad = (n) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const money = (n) => `₹\u00A0${Math.round(n).toLocaleString("en-IN")}`;

/** Slab-wise working of the new-regime tax on a taxable income. */
export function slabBreakup(taxable) {
  let lower = 0;
  return NEW_REGIME_SLABS.map((s, i, arr) => {
    const upper = s.upTo ?? Infinity;
    const amount = Math.max(0, Math.min(taxable, upper) - lower);
    const row = {
      range:
        i === 0
          ? `Up to ${money(s.upTo)}`
          : s.upTo
            ? `${money(arr[i - 1].upTo)} – ${money(s.upTo)}`
            : `Above ${money(arr[i - 1].upTo)}`,
      rate: s.rate,
      amount,
      tax: Math.round((amount * s.rate) / 100),
    };
    lower = upper;
    return row;
  });
}

/**
 * New-regime tax on a taxable income — slab → s.87A rebate (with marginal relief above the limit) → surcharge
 * (with marginal relief) → 4 % cess. Same working as the payroll engine; used when Form 16 figures are edited.
 */
export function newRegimeTax(taxable, cfg = getStatutoryConfig()) {
  const slab = slabTax(taxable, NEW_REGIME_SLABS);
  const limit = cfg.tds.rebate87aLimitNew;
  let rebate = taxable <= limit ? Math.min(slab, cfg.tds.rebate87aMaxNew) : 0;
  if (taxable > limit && slab > taxable - limit) rebate = slab - (taxable - limit);
  const afterRebate = slab - rebate;
  const surcharge = surchargeOn(taxable, afterRebate, NEW_REGIME_SLABS);
  const cess = Math.round(((afterRebate + surcharge) * cfg.tds.cessRate) / 100);
  return { slab, rebate, surcharge, cess, total: Math.max(0, afterRebate + surcharge + cess) };
}

/** Re-derive taxable income and tax after HR edits perquisites / exempt allowances on a generated working. */
export function recomputeForm16(base, perquisites, exemptAllowances) {
  const taxable = Math.max(
    0,
    base.taxableIncome +
      (perquisites - base.perquisites) -
      (exemptAllowances - base.exemptAllowances),
  );
  const t = newRegimeTax(taxable);
  return {
    ...base,
    perquisites,
    exemptAllowances,
    taxableIncome: taxable,
    slabRows: slabBreakup(taxable),
    slabTax: t.slab,
    rebate87a: t.rebate,
    surcharge: t.surcharge,
    cess: t.cess,
    totalTax: t.total,
    taxPayableOrRefund: t.total - base.tdsDeducted - base.previousEmployerTds,
  };
}

/** Build the Form 16 working for an employee & FY from the payroll engine's annual projection. */
export function buildForm16Working(empId, fy, overrides = {}) {
  const y = fyStartYear(fy);
  const periods = fyPeriods(fy);
  // Latest processed payslip of the FY carries the most accurate projection; otherwise compute a month inside the FY.
  const processed = periods.map((p) => slipForPeriod(empId, p));
  const slip =
    [...processed].reverse().find(Boolean) ??
    computePayslipFor(empId, `${y}-${y >= 2026 ? "08" : "12"}`);
  if (!slip) return null;
  const cfg = getStatutoryConfig();
  const t = slip.tds;
  const nps = t.breakdown.find((b) => /80CCD\(2\)/.test(b.label))?.value ?? 0;
  // `0 - x` (not `-x`) so an absent line is 0, not -0 (which printed as "₹ -0").
  const prev = 0 - (t.breakdown.find((b) => /Previous employer salary/.test(b.label))?.value ?? 0);
  // Other income and let-out rent are added to the projection as negative breakdown lines.
  const other =
    0 -
    t.breakdown
      .filter((b) => /Other income|Rental income/.test(b.label))
      .reduce((s, b) => s + b.value, 0);
  const letOut = t.breakdown.find((b) => /Let-out/.test(b.label))?.value ?? 0;
  const prevTds =
    t.breakdown.find((b) => /previous employer/i.test(b.label) && /TDS/.test(b.label))?.value ?? 0;
  const grossSalary = t.annualGross - prev - other;
  const taxable = t.taxable;
  // Same working as the payroll register: slab → 87A → surcharge (with marginal relief) → cess.
  const slab = t.slab ?? slabTax(taxable, NEW_REGIME_SLABS);
  const rebate = t.rebate;
  const surcharge = t.surcharge ?? 0;
  const cess = t.cess ?? Math.round(((slab - rebate + surcharge) * cfg.tds.cessRate) / 100);
  const totalTax = Math.max(0, slab - rebate + surcharge + cess);
  const monthly = t.monthly;
  // Part A: TDS actually deducted in processed months; the projected monthly TDS for months not yet processed
  // (none before the joining month).
  const firstMonth = 12 - (t.months ?? 12);
  const monthTds = processed.map((p, i) => (p ? p.tds.monthly : i >= firstMonth ? monthly : 0));
  const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q, i) => ({
    quarter: q,
    period: [`Apr–Jun ${y}`, `Jul–Sep ${y}`, `Oct–Dec ${y}`, `Jan–Mar ${y + 1}`][i],
    receiptNo: `QTR${y}${q}${empId.replace(/\D/g, "").slice(-4)}`,
    amount: monthTds.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0),
    depositedOn: [`${y}-07-07`, `${y}-10-07`, `${y + 1}-01-07`, `${y + 1}-04-30`][i],
    challanBsr: "0510308",
  }));
  return {
    regime: "New Regime",
    assessmentYear: assessmentYearOf(fy),
    employer: {
      name: ORGANIZATION.legalName,
      address: "Bhubaneswar, Odisha — seereon.co.in",
      tan: cfg.establishment.tan,
      pan: cfg.establishment.pan,
      signatory: "Saras Venkatesh",
      designation: "Chief Financial Officer",
      place: "Bhubaneswar",
    },
    employee: {
      pan: slip.statutory.pan,
      designation: slip.designation,
      department: slip.dept,
      periodFrom: `${y}-04-01`,
      periodTo: `${y + 1}-03-31`,
    },
    grossSalary,
    // Paid months as paid + structure for the remaining months on payroll (not the latest slip × 12).
    salaryComponents: annualEarnings(empId, fy, processed, t.months ?? 12),
    perquisites: 0,
    profitsInLieu: 0,
    previousEmployerSalary: prev,
    exemptAllowances: t.exemptions ?? 0,
    standardDeduction: t.standardDeduction,
    professionalTax: 0,
    deduction80ccd2: nps,
    otherIncome: other,
    letOutLoss: letOut,
    taxableIncome: taxable,
    slabRows: slabBreakup(taxable),
    slabTax: slab,
    rebate87a: rebate,
    surcharge,
    cess,
    totalTax,
    quarters,
    tdsDeducted: quarters.reduce((s, q) => s + q.amount, 0),
    previousEmployerTds: prevTds,
    taxPayableOrRefund: totalTax - quarters.reduce((s, q) => s + q.amount, 0) - prevTds,
    certificateNo: `${cfg.establishment.tan.slice(0, 4)}${y}${empId.replace(/\D/g, "").slice(-4).padStart(4, "0")}`,
    parts: "Part A + Part B",
    digitallySigned: true,
    remarks: "",
    ...overrides,
  };
}

export const taxDocStore = createPersistentStore("seereon.tax.docs.v2", [
  {
    id: "TAX-001",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    form: "Form 16",
    fy: "FY 2025-26",
    quarter: "Annual",
    fileName: "form16-ananya-fy2526.pdf",
    grossSalary: "₹\u00A024,80,000",
    taxDeducted: "₹\u00A03,12,400",
    status: "Issued",
    issuedOn: "2026-06-15",
    source: "Generated",
    history: [
      {
        at: "2026-06-15",
        by: "Payroll Bot",
        action: "Generated from payroll register (new regime)",
      },
      {
        at: "2026-06-16",
        by: "Saras Venkatesh",
        action: "Digitally signed & issued to employee portal",
      },
    ],
  },
  {
    id: "TAX-002",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    form: "Form 12BB",
    fy: "FY 2026-27",
    quarter: "Annual",
    fileName: "form12bb-ananya-fy2627.pdf",
    grossSalary: "—",
    taxDeducted: "—",
    status: "Uploaded",
    issuedOn: "2026-05-04",
    source: "Uploaded",
    history: [
      {
        at: "2026-05-04",
        by: "Ananya Sharma",
        action: "Investment / income declaration uploaded with Form 12B",
      },
    ],
    uploadedNote: "Signed Form 12BB with previous employer Form 12B attached.",
  },
  {
    id: "TAX-003",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    form: "Form 16",
    fy: "FY 2025-26",
    quarter: "Annual",
    fileName: "form16-vikram-fy2526.pdf",
    grossSalary: "₹\u00A018,20,000",
    taxDeducted: "₹\u00A01,94,600",
    status: "Verified",
    issuedOn: "2026-06-15",
    source: "Generated",
    history: [
      {
        at: "2026-06-15",
        by: "Payroll Bot",
        action: "Generated from payroll register (new regime)",
      },
      {
        at: "2026-06-18",
        by: "Rohit Deshmukh",
        action: "Verified against TDS challans / Form 26AS",
      },
    ],
  },
  {
    id: "TAX-004",
    empId: "SRN-0145",
    employee: "Rohit Deshmukh",
    form: "Form 16",
    fy: "FY 2024-25",
    quarter: "Annual",
    fileName: "form16-rohit-fy2425.pdf",
    grossSalary: "₹\u00A015,60,000",
    taxDeducted: "₹\u00A01,40,200",
    status: "Issued",
    issuedOn: "2025-06-20",
    source: "Generated",
    history: [{ at: "2025-06-20", by: "Payroll Bot", action: "Generated from payroll register" }],
  },
]);

export function addTaxDocument(d) {
  const { by, byId, ...rest } = d;
  // Highest existing serial + 1 — a length-based counter can repeat an id.
  const id = nextId(
    "TAX",
    taxDocStore.get().reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0),
  );
  taxDocStore.set((p) => [
    {
      ...rest,
      id,
      generatedById: byId,
      history: [{ at: today(), by, action: `${rest.source} · ${rest.form} for ${rest.fy}` }],
    },
    ...p,
  ]);
  return id;
}

/**
 * Allowed status moves: Generated/Uploaded → Verified → Issued. Returns false when the move is not allowed —
 * including maker–checker: whoever generated / uploaded the document cannot verify or issue it, and the verifier
 * cannot also issue it.
 */
export function logTaxAction(id, by, action, status, byId) {
  const doc = taxDocStore.get().find((d) => d.id === id);
  if (!doc) return false;
  if ((status === "Verified" || status === "Issued") && byId && doc.generatedById === byId)
    return false;
  if (status === "Issued" && byId && doc.verifiedById === byId) return false;
  if (status === "Verified" && !(doc.status === "Generated" || doc.status === "Uploaded"))
    return false;
  if (status === "Issued" && doc.status !== "Verified") return false;
  taxDocStore.set((p) =>
    p.map((d) =>
      d.id === id
        ? {
            ...d,
            status: status ?? d.status,
            ...(status === "Verified" ? { verifiedById: byId } : {}),
            history: [{ at: today(), by, action }, ...d.history],
          }
        : d,
    ),
  );
  if (status === "Issued")
    pushAlert({
      empId: doc.empId,
      kind: "payroll",
      to: "/emp/tax",
      title: `${doc.form} issued — ${doc.fy}`,
      body: `Your ${doc.form} for ${doc.fy} (${assessmentYearOf(doc.fy)}) is available to download under Proof of Investment.`,
    });
  return true;
}

/** Render the Form 16 (Part A + Part B) working as a printable PDF. */
export function renderForm16Pdf(doc) {
  const w = doc.working;
  if (!w) return false;
  return exportMatrixPdf({
    title: `${doc.form} — ${doc.fy} (${w.assessmentYear})`,
    subtitle: `Certificate u/s 203 of the Income-tax Act, 1961 · ${w.regime} (s.115BAC) · Certificate no. ${w.certificateNo}`,
    details: [
      { label: "Employee", value: `${doc.employee} (${doc.empId}) · PAN ${w.employee.pan}` },
      {
        label: "Designation / Dept",
        value: `${w.employee.designation} · ${w.employee.department}`,
      },
      { label: "Period", value: `${w.employee.periodFrom} → ${w.employee.periodTo}` },
      {
        label: "Employer",
        value: `${w.employer.name} · TAN ${w.employer.tan} · PAN ${w.employer.pan}`,
      },
      { label: "Address", value: w.employer.address },
      { label: "Parts", value: `${w.parts}${w.digitallySigned ? " · digitally signed" : ""}` },
    ],
    columns: ["Amount (₹)"],
    groups: [
      {
        name: "Part A — Tax deducted and deposited (quarter-wise)",
        rows: [
          ...w.quarters.map((q) => ({
            label: `${q.quarter} ${q.period} · receipt ${q.receiptNo} · BSR ${q.challanBsr} · deposited ${q.depositedOn}`,
            values: [q.amount.toLocaleString("en-IN")],
          })),
          {
            label: "Total TDS deposited",
            strong: true,
            values: [w.tdsDeducted.toLocaleString("en-IN")],
          },
        ],
      },
      {
        name: "Part B — 1. Gross salary (s.17)",
        rows: [
          ...w.salaryComponents.map((c) => ({
            label: c.label,
            values: [c.annual.toLocaleString("en-IN")],
          })),
          { label: "Perquisites (s.17(2))", values: [w.perquisites.toLocaleString("en-IN")] },
          { label: "Profits in lieu (s.17(3))", values: [w.profitsInLieu.toLocaleString("en-IN")] },
          {
            label: "Salary from previous employer (Form 12B)",
            values: [w.previousEmployerSalary.toLocaleString("en-IN")],
          },
          {
            label: "Gross salary",
            strong: true,
            values: [(w.grossSalary + w.previousEmployerSalary).toLocaleString("en-IN")],
          },
        ],
      },
      {
        name: "2. Allowances exempt u/s 10 (new regime)",
        rows: [
          { label: "Exempt allowances", values: [w.exemptAllowances.toLocaleString("en-IN")] },
        ],
      },
      {
        name: "3. Deductions u/s 16",
        rows: [
          {
            label: "Standard deduction u/s 16(ia)",
            values: [w.standardDeduction.toLocaleString("en-IN")],
          },
          { label: "Professional tax u/s 16(iii) — not allowed under new regime", values: ["0"] },
        ],
      },
      {
        name: "4. Other income & house property",
        rows: [
          {
            label: "Other income reported by employee",
            values: [w.otherIncome.toLocaleString("en-IN")],
          },
          {
            label: "Let-out property interest set off",
            values: [(-w.letOutLoss).toLocaleString("en-IN")],
          },
        ],
      },
      {
        name: "5. Chapter VI-A (new regime)",
        rows: [
          {
            label: "80CCD(2) employer NPS contribution",
            values: [w.deduction80ccd2.toLocaleString("en-IN")],
          },
        ],
      },
      {
        name: "6. Total taxable income",
        rows: [
          {
            label: "Taxable income",
            strong: true,
            values: [w.taxableIncome.toLocaleString("en-IN")],
          },
        ],
      },
      {
        name: "7. Tax on total income — slab-wise (s.115BAC)",
        rows: [
          ...w.slabRows
            .filter((r) => r.amount > 0)
            .map((r) => ({
              label: `${r.range} @ ${r.rate} % on ${r.amount.toLocaleString("en-IN")}`,
              values: [r.tax.toLocaleString("en-IN")],
            })),
          {
            label: "Tax on total income",
            strong: true,
            values: [w.slabTax.toLocaleString("en-IN")],
          },
          { label: "Less: rebate u/s 87A", values: [(-w.rebate87a).toLocaleString("en-IN")] },
          { label: "Surcharge", values: [w.surcharge.toLocaleString("en-IN")] },
          { label: "Health & Education Cess @ 4 %", values: [w.cess.toLocaleString("en-IN")] },
          {
            label: "Total tax payable",
            strong: true,
            values: [w.totalTax.toLocaleString("en-IN")],
          },
        ],
      },
      {
        name: "8. Tax deducted / payable",
        rows: [
          {
            label: "TDS deducted by this employer",
            values: [w.tdsDeducted.toLocaleString("en-IN")],
          },
          {
            label: "TDS by previous employer",
            values: [w.previousEmployerTds.toLocaleString("en-IN")],
          },
          {
            label: w.taxPayableOrRefund >= 0 ? "Balance tax payable" : "Refund due",
            strong: true,
            values: [Math.abs(w.taxPayableOrRefund).toLocaleString("en-IN")],
          },
        ],
      },
    ],
    note: `Verification: I, ${w.employer.signatory}, ${w.employer.designation}, working in the capacity of ${w.employer.designation}, do hereby certify that a sum of ₹\u00A0${w.tdsDeducted.toLocaleString("en-IN")} has been deducted and deposited to the credit of the Central Government. Place: ${w.employer.place} · Date: ${today()}.${w.remarks ? ` Remarks: ${w.remarks}` : ""}`,
  });
}

export const taxTone = (s) =>
  s === "Verified" || s === "Generated" || s === "Issued"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Uploaded"
      ? "border-gold/40 bg-gold/15 text-gold"
      : "border-border bg-muted text-muted-foreground";

export const useTaxDocs = () => taxDocStore.use();
