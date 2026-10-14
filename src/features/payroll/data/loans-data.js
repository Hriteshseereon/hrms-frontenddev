// Loans & salary advances (UI-only): rules, EMI schedule, approval → disbursement → payroll recovery → F&F recovery.
import { createPersistentStore } from "@/lib/persist";
import { pushAlert } from "@/features/communications/data/employee-alerts";
const now = () => new Date().toISOString().slice(0, 10);

/* ---------------------------------- Loans ---------------------------------- */
/**
 * @typedef {"Salary advance" | "Loan"} LoanKind
 */
/**
 * @typedef {"Applied" | "HR approved" | "Approved" | "Disbursed" | "Closing" | "Closed" | "Rejected" | "Cancelled"} LoanStatus
 */
/**
 * @typedef {Object} LoanRecord
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {LoanKind} kind
 * @property {number} amount
 * @property {number} tenureMonths
 * @property {number} emi
 * @property {number} interestPct
 * @property {string} purpose
 * @property {string} appliedOn
 * @property {LoanStatus} status
 * @property {string} [approvedBy]
 * @property {string} [disbursedOn]
 * @property {string} firstEmiPeriod
 * @property {{ period: string, emi: number, principal: number, interest: number, balance: number, paid: boolean, via: "Payroll" | "F&F" | "Cash" | "Bank" | "" }[]} schedule
 * @property {{ id: string, name: string }} [appliedBy] - Who keyed the application (the employee, or HR on their behalf).
 * @property {{ id: string, name: string }} [hrApprovedBy] - First-stage approver under the "HR → Finance" policy.
 * @property {number} [fnfRecovered]
 * @property {{ at: string, by: string, action: string }[]} history
 */
/**
 * @typedef {Object} LoanPolicy
 * @property {number} maxGrossMultiple
 * @property {number} maxTenureMonths
 * @property {number} advanceTenure
 * @property {number} advanceEmiMaxMonths
 * @property {number} interestPct
 * @property {"HR" | "Finance" | "HR → Finance"} approver
 * @property {string} updatedBy
 * @property {string} updatedOn
 */
export const loanPolicyStore = createPersistentStore("seereon.finance.loan-policy", {
  maxGrossMultiple: 3,
  maxTenureMonths: 12,
  advanceTenure: 1,
  advanceEmiMaxMonths: 3,
  interestPct: 0,
  approver: "HR → Finance",
  updatedBy: "Saras Venkatesh",
  updatedOn: "2026-04-01",
});
export const useLoanPolicy = () => loanPolicyStore.use();
export const saveLoanPolicy = (p, by) =>
  loanPolicyStore.set({ ...p, updatedBy: by, updatedOn: new Date().toISOString().slice(0, 10) });
/** Live view of the policy (Master Data → Payroll → Loan & advance policy). */
export const LOAN_RULES = {
  get maxGrossMultiple() {
    return loanPolicyStore.get().maxGrossMultiple;
  },
  get maxTenureMonths() {
    return loanPolicyStore.get().maxTenureMonths;
  },
  get advanceTenure() {
    return loanPolicyStore.get().advanceTenure;
  },
  get interestPct() {
    return loanPolicyStore.get().interestPct;
  },
  get advanceEmiMaxMonths() {
    return loanPolicyStore.get().advanceEmiMaxMonths;
  },
};

export function buildSchedule(amount, tenure, interestPct, firstPeriod) {
  const r = interestPct / 1200;
  const emi = r
    ? Math.round((amount * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1))
    : Math.round(amount / tenure);
  let bal = amount;
  const [y0, m0] = firstPeriod.split("-").map(Number);
  return Array.from({ length: tenure }, (_, i) => {
    const d = new Date(y0, m0 - 1 + i, 1);
    const interest = Math.round(bal * r);
    const principal = i === tenure - 1 ? bal : emi - interest;
    bal -= principal;
    return {
      period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      emi: principal + interest,
      principal,
      interest,
      balance: Math.max(bal, 0),
      paid: false,
      via: "",
    };
  });
}
export const loanStore = createPersistentStore("seereon.finance.loans.v2", [
  // Only the June EMI is recovered — the June payroll run is the last one paid (July is still in checks).
  {
    id: "LN-2026-011",
    empId: "SRN-0006",
    employee: "Subham Das",
    kind: "Loan",
    amount: 300000,
    tenureMonths: 12,
    emi: 25000,
    interestPct: 0,
    purpose: "Home renovation",
    appliedOn: "2026-05-02",
    status: "Disbursed",
    approvedBy: "Saras Venkatesh",
    disbursedOn: "2026-05-30",
    firstEmiPeriod: "2026-06",
    schedule: buildSchedule(300000, 12, 0, "2026-06").map((s, i) => ({
      ...s,
      paid: i < 1,
      via: i < 1 ? "Payroll" : "",
    })),
    history: [
      { at: "2026-05-02", by: "Subham Das", action: "Applied" },
      { at: "2026-05-06", by: "Saras Venkatesh", action: "Approved" },
      { at: "2026-05-30", by: "Payroll", action: "Disbursed with May salary" },
      { at: "2026-07-01", by: "Payroll", action: "EMI 2026-06 recovered via Payroll" },
    ],
  },
  {
    id: "ADV-2026-004",
    empId: "SRN-0007",
    employee: "Neha Kulkarni",
    kind: "Salary advance",
    amount: 40000,
    tenureMonths: 1,
    emi: 40000,
    interestPct: 0,
    purpose: "Medical emergency",
    appliedOn: "2026-09-03",
    status: "Approved",
    approvedBy: "Varen Mishra",
    firstEmiPeriod: "2026-10",
    schedule: buildSchedule(40000, 1, 0, "2026-10"),
    history: [
      { at: "2026-09-03", by: "Neha Kulkarni", action: "Applied" },
      { at: "2026-09-04", by: "Varen Mishra", action: "Approved — recover from October salary" },
    ],
  },
]);
export const useLoans = () => loanStore.use();
export const activeLoansOf = (empId) =>
  loanStore
    .get()
    .filter((l) => l.empId === empId && (l.status === "Disbursed" || l.status === "Closing"));
export const outstandingOf = (l) =>
  l.schedule.filter((s) => !s.paid).reduce((t, s) => t + s.principal, 0);
/** EMI the payslip for `period` carries: the instalment due that month (still shown once payroll has posted it; F&F / cash recoveries are not re-deducted). */
export const emiForPeriod = (empId, period) =>
  loanStore
    .get()
    .filter((l) => l.empId === empId && (l.status === "Disbursed" || l.status === "Closed"))
    .reduce(
      (t, l) =>
        t +
        (l.schedule.find((s) => s.period === period && (!s.paid || s.via === "Payroll"))?.emi ?? 0),
      0,
    );
/** Payroll for `period` has been paid → the EMI it deducted is recovered; the loan closes on its last instalment. */
export function postPayrollRecovery(empId, period, by) {
  loanStore.set((l) =>
    l.map((x) => {
      if (x.empId !== empId || x.status !== "Disbursed") return x;
      const due = x.schedule.find((s) => s.period === period && !s.paid);
      if (!due) return x;
      const sched = x.schedule.map((s) =>
        s.period === period ? { ...s, paid: true, via: "Payroll" } : s,
      );
      const done = sched.every((s) => s.paid);
      return {
        ...x,
        schedule: sched,
        status: done ? "Closed" : x.status,
        history: [
          ...x.history,
          {
            at: now(),
            by,
            action: `EMI ${period} recovered via Payroll${done ? " — loan closed" : ""}`,
          },
        ],
      };
    }),
  );
}

export function applyLoan(input, by) {
  // Salary advance: one-time (1) or EMI over up to the policy's advance EMI months — was always forced to 1.
  const tenure =
    input.kind === "Salary advance"
      ? Math.min(Math.max(1, Math.round(input.tenureMonths) || 1), LOAN_RULES.advanceEmiMaxMonths)
      : Math.round(input.tenureMonths);
  if (!(input.amount > 0)) return { ok: false, message: "Enter an amount." };
  if (input.kind === "Salary advance" && input.amount > input.monthlyGross)
    return {
      ok: false,
      message: `Salary advance cannot exceed one month's gross (₹${input.monthlyGross.toLocaleString("en-IN")}).`,
    };
  if (input.kind === "Loan" && input.amount > input.monthlyGross * LOAN_RULES.maxGrossMultiple)
    return {
      ok: false,
      message: `Loan capped at ${LOAN_RULES.maxGrossMultiple} × gross = ₹${(input.monthlyGross * LOAN_RULES.maxGrossMultiple).toLocaleString("en-IN")}.`,
    };
  if (tenure < 1 || tenure > LOAN_RULES.maxTenureMonths)
    return { ok: false, message: `Tenure must be 1–${LOAN_RULES.maxTenureMonths} months.` };
  if (activeLoansOf(input.empId).length)
    return { ok: false, message: "An active loan / advance is still being recovered." };
  if (
    loanStore
      .get()
      .some(
        (l) =>
          l.empId === input.empId &&
          (l.status === "Applied" || l.status === "HR approved" || l.status === "Approved"),
      )
  )
    return {
      ok: false,
      message: "A loan / advance application is already pending approval or disbursement.",
    };
  if (!input.purpose.trim())
    return { ok: false, message: "Enter the purpose of the loan / advance." };
  // Recovery starts with next month's payroll (rolls over the year end in December).
  const d = new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const first = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  const sched = buildSchedule(input.amount, tenure, LOAN_RULES.interestPct, first);
  const prefix = `${input.kind === "Loan" ? "LN" : "ADV"}-${new Date().getFullYear()}-`;
  const serial =
    loanStore
      .get()
      .filter((l) => l.id.startsWith(prefix))
      .reduce((m, l) => Math.max(m, Number(l.id.slice(prefix.length)) || 0), 0) + 1;
  const row = {
    id: `${prefix}${String(serial).padStart(3, "0")}`,
    empId: input.empId,
    employee: input.employee,
    kind: input.kind,
    amount: input.amount,
    tenureMonths: tenure,
    emi: sched[0].emi,
    interestPct: LOAN_RULES.interestPct,
    purpose: input.purpose,
    appliedOn: now(),
    status: "Applied",
    firstEmiPeriod: sched[0].period,
    schedule: sched,
    appliedBy: { id: by.id, name: by.name },
    history: [{ at: now(), by: by.name, action: "Applied" }],
  };
  loanStore.set((l) => [row, ...l]);
  return {
    ok: true,
    message: `${row.id} applied · EMI ₹${row.emi.toLocaleString("en-IN")} × ${tenure} from ${row.firstEmiPeriod}.`,
    id: row.id,
  };
}
/** Roles that sign each loan approval stage (Master Data → Loan policy decides how many stages there are). */
export const LOAN_HR_ROLES = ["HR", "CHRO", "Admin", "SuperAdmin"];
export const LOAN_FINANCE_ROLES = ["CFO", "Admin", "SuperAdmin", "CEO"];

/** The stage a loan is waiting at, and who may sign it, under the current policy. */
export function loanStageOf(l, policy = loanPolicyStore.get()) {
  if (l.status === "Applied")
    return policy.approver === "Finance"
      ? { stage: "Finance", roles: LOAN_FINANCE_ROLES }
      : { stage: "HR", roles: LOAN_HR_ROLES };
  if (l.status === "HR approved") return { stage: "Finance", roles: LOAN_FINANCE_ROLES };
  return null;
}

/** Can `by` decide this loan now? Nobody decides their own loan, an application they keyed, or both stages. */
export function canDecideLoan(l, by) {
  const st = loanStageOf(l);
  if (!st || !st.roles.includes(by.role)) return false;
  if (l.empId === by.id || l.appliedBy?.id === by.id) return false;
  if (l.hrApprovedBy?.id === by.id) return false;
  return true;
}

export function decideLoan(id, by, approve, note = "") {
  const cur = loanStore.get().find((x) => x.id === id);
  if (!cur) return { ok: false, message: "Loan not found." };
  const st = loanStageOf(cur);
  if (!st) return { ok: false, message: `${cur.id} is already ${cur.status.toLowerCase()}.` };
  if (cur.empId === by.id)
    return { ok: false, message: "You cannot decide your own loan / advance application." };
  if (cur.appliedBy?.id === by.id)
    return {
      ok: false,
      message: "Maker–checker: you keyed this application — a different approver must decide it.",
    };
  if (cur.hrApprovedBy?.id === by.id)
    return {
      ok: false,
      message: "You approved the HR stage — the Finance stage needs a different approver.",
    };
  if (!st.roles.includes(by.role))
    return {
      ok: false,
      message: `The ${st.stage} stage is decided by ${st.roles.join(" / ")}.`,
    };
  // Under "HR → Finance" an HR approval only moves the loan to the Finance stage.
  const twoStage = loanPolicyStore.get().approver === "HR → Finance";
  const nextStatus = !approve
    ? "Rejected"
    : twoStage && cur.status === "Applied"
      ? "HR approved"
      : "Approved";
  loanStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: nextStatus,
            hrApprovedBy:
              nextStatus === "HR approved" ? { id: by.id, name: by.name } : x.hrApprovedBy,
            approvedBy: nextStatus === "Approved" ? by.name : undefined,
            rejectedBy: approve ? undefined : by.name,
            approvedOn: new Date().toISOString().slice(0, 10),
            history: [
              ...x.history,
              {
                at: now(),
                by: by.name,
                action: approve
                  ? `${nextStatus === "HR approved" ? "Approved at HR stage — awaiting Finance" : "Approved"}${note ? ` — ${note}` : ""}`
                  : `Rejected at ${st.stage} stage — ${note}`,
              },
            ],
          }
        : x,
    ),
  );
  const l = loanStore.get().find((x) => x.id === id);
  if (l && nextStatus !== "HR approved")
    pushAlert({
      empId: l.empId,
      kind: "loan",
      to: "/emp/loans",
      title: approve ? `${l.kind} approved` : `${l.kind} rejected`,
      body: approve
        ? `${l.id} ₹${l.amount.toLocaleString("en-IN")} approved — EMI ₹${l.emi.toLocaleString("en-IN")} × ${l.tenureMonths} from ${l.firstEmiPeriod}.`
        : `${l.id} rejected${note ? ` — ${note}` : ""}.`,
    });
  return {
    ok: true,
    message: !approve
      ? "Rejected."
      : nextStatus === "HR approved"
        ? "Approved at HR stage — sent to Finance."
        : "Approved — disburse with the next payroll.",
  };
}
export function disburseLoan(id, by) {
  const cur = loanStore.get().find((x) => x.id === id);
  if (!cur || cur.status !== "Approved")
    return { ok: false, message: "Only an approved loan can be disbursed." };
  // The schedule was drafted at application; recovery can only start the month after the money is paid out, so
  // a late disbursement shifts the schedule instead of leaving instalments in months already run.
  const d = new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const nextPeriod = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  const first = cur.firstEmiPeriod > nextPeriod ? cur.firstEmiPeriod : nextPeriod;
  const schedule =
    first === cur.firstEmiPeriod
      ? cur.schedule
      : buildSchedule(cur.amount, cur.tenureMonths, cur.interestPct, first);
  loanStore.set((l) =>
    l.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "Disbursed",
            disbursedOn: now(),
            firstEmiPeriod: schedule[0].period,
            emi: schedule[0].emi,
            schedule,
            history: [
              ...x.history,
              {
                at: now(),
                by: by.name,
                action:
                  first === cur.firstEmiPeriod
                    ? "Disbursed"
                    : `Disbursed — recovery rescheduled to start ${first}`,
              },
            ],
          }
        : x,
    ),
  );
  return {
    ok: true,
    message: `Disbursed — EMI recovery starts ${schedule[0].period}.`,
  };
}
export function recordEmi(id, period, via, by) {
  loanStore.set((l) =>
    l.map((x) => {
      if (
        x.id !== id ||
        x.status !== "Disbursed" ||
        !x.schedule.some((s) => s.period === period && !s.paid)
      )
        return x;
      const sched = x.schedule.map((s) => (s.period === period ? { ...s, paid: true, via } : s));
      const done = sched.every((s) => s.paid);
      return {
        ...x,
        schedule: sched,
        status: done ? "Closed" : x.status,
        history: [
          ...x.history,
          {
            at: now(),
            by: by.name,
            action: `EMI ${period} recovered via ${via}${done ? " — loan closed" : ""}`,
          },
        ],
      };
    }),
  );
}
export function recoverFromFnf(empId, by) {
  let total = 0;
  loanStore.set((l) =>
    l.map((x) => {
      if (x.empId !== empId) return x;
      // Sanctioned but never paid out — nothing to recover; the sanction lapses with the exit.
      if (x.status === "Applied" || x.status === "HR approved" || x.status === "Approved")
        return {
          ...x,
          status: "Cancelled",
          history: [
            ...x.history,
            { at: now(), by: by.name, action: "Cancelled at exit — never disbursed" },
          ],
        };
      if (!(x.status === "Disbursed" || x.status === "Closing")) return x;
      const out = outstandingOf(x);
      total += out;
      return {
        ...x,
        status: "Closed",
        fnfRecovered: out,
        schedule: x.schedule.map((s) => (s.paid ? s : { ...s, paid: true, via: "F&F" })),
        history: [
          ...x.history,
          {
            at: now(),
            by: by.name,
            action: `Outstanding ₹${out.toLocaleString("en-IN")} recovered from full & final settlement`,
          },
        ],
      };
    }),
  );
  return total;
}
export const loanTone = (s) =>
  s === "Closed" || s === "Disbursed" || s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected" || s === "Cancelled"
      ? "border-destructive/30 text-destructive"
      : "border-gold/40 bg-gold/15 text-gold";
