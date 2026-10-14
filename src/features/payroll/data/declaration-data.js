// -----------------------------------------------------------------------------
// Form 12BB IT declaration store. Split out of payroll-reports.ts so the payroll
// engine (TDS projection) can read declarations without a circular import.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { CURRENT_EMPLOYEE_ID } from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";

/* ------------------------------------------------------------------ */
/* Form 12BB — IT declaration                                          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} DeclarationField
 * @property {string} key
 * @property {string} label
 * @property {number} amount
 */
/**
 * @typedef {Object} DeclarationSection
 * @property {string} title
 * @property {string} [note]
 * @property {DeclarationField[]} fields
 */

/** Component catalogue an employee can add to their declaration — new-regime relevant items only. */
export const DECLARATION_COMPONENTS = [
  { section: "Previous employment (Form 12B)", label: "Salary from previous employer this FY" },
  { section: "Previous employment (Form 12B)", label: "TDS deducted by previous employer" },
  { section: "Other income", label: "Interest — savings account" },
  { section: "Other income", label: "Interest — fixed / recurring deposits" },
  { section: "Other income", label: "Dividend income" },
  { section: "Other income", label: "Rental income (let-out property)" },
  { section: "Let-out house property", label: "Interest on housing loan — let-out property" },
  { section: "Let-out house property", label: "Municipal taxes paid — let-out property" },
  {
    section: "NPS — employer contribution u/s 80CCD(2)",
    label: "Employer NPS contribution (corporate NPS)",
  },
  {
    section: "Exempt allowances (new regime)",
    label: "Transport allowance — specially-abled employee",
  },
  { section: "Exempt allowances (new regime)", label: "Conveyance for official duties (actuals)" },
];

/** Form 12BB layout under the New Tax Regime — Chapter VI-A, HRA and LTA are not applicable and are not collected. */
export const DECLARATION_TEMPLATE = [
  {
    title: "Previous employment (Form 12B)",
    note: "Only for employees who joined during the financial year — attach Form 12B / previous employer's payslips.",
    fields: [
      { key: "prev.salary", label: "Salary from previous employer this FY", amount: 0 },
      { key: "prev.tds", label: "TDS deducted by previous employer", amount: 0 },
      { key: "prev.pf", label: "Employee PF deducted by previous employer", amount: 0 },
    ],
  },
  {
    title: "Other income",
    note: "Declared so TDS on salary covers the total tax liability (s.192(2B)). Losses other than let-out house property cannot be set off here.",
    fields: [
      { key: "other.savings", label: "Interest — savings account", amount: 0 },
      { key: "other.fd", label: "Interest — fixed / recurring deposits", amount: 0 },
      { key: "other.dividend", label: "Dividend income", amount: 0 },
    ],
  },
  {
    title: "Let-out house property",
    note: "Rental income is added; loan interest is set off only against that rental income under the new regime.",
    fields: [
      { key: "house.letout.rent", label: "Annual rent received (let-out property)", amount: 0 },
      {
        key: "house.letout.interest",
        label: "Interest on housing loan — let-out property",
        amount: 0,
      },
    ],
  },
  {
    title: "NPS — employer contribution u/s 80CCD(2)",
    note: "The only Chapter VI-A deduction available under the new regime — up to 14 % of Basic + DA. Auto-filled from the corporate NPS enrolment.",
    fields: [{ key: "80ccd2.employer", label: "Employer NPS contribution (annual)", amount: 0 }],
  },
  {
    title: "Exempt allowances (new regime)",
    fields: [
      {
        key: "exempt.transport",
        label: "Transport allowance — specially-abled employee (₹3,200 p.m.)",
        amount: 0,
      },
      {
        key: "exempt.conveyance",
        label: "Conveyance for official duties (actuals, with bills)",
        amount: 0,
      },
    ],
  },
];

/** Proof documents HR expects for each declaration section under the new regime. */
export const DECLARATION_PROOFS = {
  "Previous employment (Form 12B)": [
    "Form 12B signed by employee",
    "Previous employer payslips / Form 16 (part B)",
  ],
  "Other income": ["Bank interest certificate", "Dividend statement / AIS extract"],
  "Let-out house property": [
    "Rent agreement",
    "Lender's interest certificate",
    "Municipal tax receipt",
  ],
  "NPS — employer contribution u/s 80CCD(2)": ["PRAN card copy", "Corporate NPS enrolment"],
  "Exempt allowances (new regime)": [
    "Disability certificate (transport allowance)",
    "Conveyance bills",
  ],
};

/**
 * @typedef {"Draft" | "Submitted" | "Locked"} DeclarationStatus
 */

/**
 * @typedef {Object} DeclarationProof
 * @property {string} section
 * @property {string} name
 * @property {string} uploadedOn
 * @property {"Uploaded" | "Verified" | "Rejected"} status
 * @property {string} [remark]
 */

/**
 * @typedef {Object} Declaration
 * @property {string} empId
 * @property {string} fy
 * @property {"New Regime"} regime - Always "New Regime" — the product does not offer the old regime.
 * @property {DeclarationSection[]} sections
 * @property {DeclarationStatus} status
 * @property {string} updatedOn
 * @property {{ at: string, action: string }[]} history
 * @property {DeclarationProof[]} [proofs] - Proof of investment / income documents uploaded by the employee.
 * @property {string} [note] - Free-text notes from the employee (e.g. "joined mid-year, Form 12B attached").
 */

const clone = (s) => s.map((sec) => ({ ...sec, fields: sec.fields.map((f) => ({ ...f })) }));

const withAmounts = (pairs) =>
  clone(DECLARATION_TEMPLATE).map((sec) => ({
    ...sec,
    fields: sec.fields.map((f) => ({ ...f, amount: pairs[f.key] ?? f.amount })),
  }));

export const declarationStore = createPersistentStore("seereon.declarations.v2", [
  {
    empId: CURRENT_EMPLOYEE_ID,
    fy: "FY 2025-26",
    regime: "New Regime",
    sections: withAmounts({ "other.savings": 8400, "other.fd": 21500, "80ccd2.employer": 43200 }),
    status: "Locked",
    updatedOn: "2025-04-14",
    history: [{ at: "2025-04-14", action: "Declared and locked for FY 2025-26" }],
    proofs: [
      {
        section: "Other income",
        name: "hdfc-interest-certificate-fy2526.pdf",
        uploadedOn: "2026-01-12",
        status: "Verified",
      },
      {
        section: "NPS — employer contribution u/s 80CCD(2)",
        name: "pran-card.pdf",
        uploadedOn: "2025-04-14",
        status: "Verified",
      },
    ],
  },
  {
    empId: "SRN-0142",
    fy: "FY 2026-27",
    regime: "New Regime",
    sections: withAmounts({
      "prev.salary": 640000,
      "prev.tds": 38500,
      "prev.pf": 28800,
      "other.savings": 6200,
      "house.letout.rent": 180000,
      "house.letout.interest": 96000,
      "80ccd2.employer": 52000,
    }),
    status: "Submitted",
    updatedOn: "2026-05-04",
    history: [
      { at: "2026-05-04", action: "Declaration submitted for FY 2026-27" },
      { at: "2026-04-28", action: "Draft saved for FY 2026-27" },
    ],
    proofs: [
      {
        section: "Previous employment (Form 12B)",
        name: "form12b-ananya.pdf",
        uploadedOn: "2026-05-04",
        status: "Verified",
      },
      {
        section: "Previous employment (Form 12B)",
        name: "prev-employer-payslips-apr.pdf",
        uploadedOn: "2026-05-04",
        status: "Uploaded",
      },
      {
        section: "Let-out house property",
        name: "rent-agreement-whitefield.pdf",
        uploadedOn: "2026-05-04",
        status: "Uploaded",
      },
      {
        section: "Let-out house property",
        name: "sbi-home-loan-interest-cert.pdf",
        uploadedOn: "2026-05-04",
        status: "Uploaded",
      },
    ],
    note: "Joined Seereon on 18 Apr 2026 — previous employer figures from Form 12B attached.",
  },
  {
    empId: "SRN-0143",
    fy: "FY 2026-27",
    regime: "New Regime",
    sections: withAmounts({ "other.fd": 42000, "other.dividend": 11000, "80ccd2.employer": 36000 }),
    status: "Submitted",
    updatedOn: "2026-05-09",
    history: [{ at: "2026-05-09", action: "Declaration submitted for FY 2026-27" }],
    proofs: [
      {
        section: "Other income",
        name: "icici-fd-interest-fy2627.pdf",
        uploadedOn: "2026-05-09",
        status: "Uploaded",
      },
    ],
  },
]);

export const useDeclarations = () => declarationStore.use();

export function getDeclaration(empId, fy) {
  return (
    declarationStore.get().find((d) => d.empId === empId && d.fy === fy) ?? {
      empId,
      fy,
      regime: "New Regime",
      sections: clone(DECLARATION_TEMPLATE),
      status: "Draft",
      updatedOn: "—",
      history: [],
    }
  );
}

export function addDeclarationProof(empId, fy, proof) {
  const today = new Date().toISOString().slice(0, 10);
  declarationStore.set((list) => {
    const idx = list.findIndex((x) => x.empId === empId && x.fy === fy);
    const base = idx === -1 ? getDeclaration(empId, fy) : list[idx];
    const next = {
      ...base,
      proofs: [...(base.proofs ?? []), { ...proof, uploadedOn: today, status: "Uploaded" }],
      history: [{ at: today, action: `Proof uploaded — ${proof.name}` }, ...base.history],
    };
    if (idx === -1) return [next, ...list];
    const copy = [...list];
    copy[idx] = next;
    return copy;
  });
}

export function reviewDeclarationProof(empId, fy, name, status, by, remark = "", byId) {
  const today = new Date().toISOString().slice(0, 10);
  // Nobody verifies their own proofs.
  if (byId && byId === empId) return false;
  const decl = declarationStore.get().find((d) => d.empId === empId && d.fy === fy);
  // Only a pending ("Uploaded") proof of an unlocked declaration can be reviewed — a proof with the same file name
  // that was already verified / rejected keeps its decision.
  if (
    !decl ||
    decl.status === "Locked" ||
    !(decl.proofs ?? []).some((p) => p.name === name && p.status === "Uploaded")
  )
    return false;
  let done = false;
  declarationStore.set((list) =>
    list.map((d) =>
      d.empId === empId && d.fy === fy
        ? {
            ...d,
            proofs: (d.proofs ?? []).map((p) =>
              !done && p.name === name && p.status === "Uploaded"
                ? ((done = true), { ...p, status, remark })
                : p,
            ),
            history: [
              {
                at: today,
                action: `${name} ${status.toLowerCase()} by ${by}${remark ? ` — ${remark}` : ""}`,
              },
              ...d.history,
            ],
          }
        : d,
    ),
  );
  pushAlert({
    empId,
    kind: "payroll",
    to: "/emp/it-declaration",
    title: `Proof ${status.toLowerCase()} — ${fy}`,
    body: `${name} was ${status.toLowerCase()} by ${by}${remark ? `: ${remark}` : ""}.${status === "Rejected" ? " Upload a corrected document." : ""}`,
  });
  return true;
}

/** Why a declaration cannot be locked by `byId` now, or null when it can. */
export function lockBlocker(decl, byId) {
  if (!decl || decl.status !== "Submitted") return "Only a submitted declaration can be locked.";
  if (byId && byId === decl.empId) return "You cannot verify and lock your own declaration.";
  const open = (decl.proofs ?? []).filter(
    (p) => p.status === "Uploaded" || p.status === "Rejected",
  );
  if (open.length)
    return `${open.length} proof(s) are still pending or rejected — review them (or have the employee re-upload) before locking.`;
  return null;
}

export function lockDeclaration(empId, fy, by, byId) {
  const today = new Date().toISOString().slice(0, 10);
  const decl = declarationStore.get().find((d) => d.empId === empId && d.fy === fy);
  if (lockBlocker(decl, byId)) return false;
  declarationStore.set((list) =>
    list.map((d) =>
      d.empId === empId && d.fy === fy
        ? {
            ...d,
            status: "Locked",
            updatedOn: today,
            history: [
              { at: today, action: `Declaration verified and locked by ${by}` },
              ...d.history,
            ],
          }
        : d,
    ),
  );
  pushAlert({
    empId,
    kind: "payroll",
    to: "/emp/it-declaration",
    title: `IT declaration locked — ${fy}`,
    body: `Your Form 12BB declaration for ${fy} was verified and locked for payroll by ${by}.`,
  });
  return true;
}

/**
 * Save the employee's edits. Returns null when payroll locked the declaration meanwhile. Proofs and history are taken
 * from the stored record (HR may have verified proofs since the form was opened) — only the amounts come from `d`.
 */
export function saveDeclaration(d, status) {
  const today = new Date().toISOString().slice(0, 10);
  const stored = declarationStore.get().find((x) => x.empId === d.empId && x.fy === d.fy);
  if (stored?.status === "Locked") return null;
  const next = {
    ...d,
    proofs: stored ? stored.proofs : d.proofs,
    status,
    updatedOn: today,
    history: [
      {
        at: today,
        action:
          status === "Submitted" ? `Declaration submitted for ${d.fy}` : `Draft saved for ${d.fy}`,
      },
      ...(stored ? stored.history : d.history),
    ],
  };
  declarationStore.set((list) => {
    const idx = list.findIndex((x) => x.empId === d.empId && x.fy === d.fy);
    if (idx === -1) return [next, ...list];
    const copy = [...list];
    copy[idx] = next;
    return copy;
  });
  return next;
}

export const declarationTotal = (sections) =>
  sections.reduce((s, sec) => s + sec.fields.reduce((t, f) => t + (Number(f.amount) || 0), 0), 0);

/** Add a component (custom or catalogue) to a declaration draft. */
export function withAddedField(d, sectionTitle, label, amount, note) {
  const key = `custom.${Date.now()}.${Math.round(Math.random() * 1e4)}`;
  const field = { key, label: note ? `${label} — ${note}` : label, amount };
  const exists = d.sections.some((s) => s.title === sectionTitle);
  const sections = exists
    ? d.sections.map((s) => (s.title === sectionTitle ? { ...s, fields: [...s.fields, field] } : s))
    : [...d.sections, { title: sectionTitle, fields: [field] }];
  return { ...d, sections };
}

export function withRemovedField(d, sectionTitle, key) {
  return {
    ...d,
    sections: d.sections
      .map((s) =>
        s.title === sectionTitle ? { ...s, fields: s.fields.filter((f) => f.key !== key) } : s,
      )
      .filter((s) => s.fields.length > 0),
  };
}

/** Slice a built YTD grid down to a month window (inclusive indices). */
