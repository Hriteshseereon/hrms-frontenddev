// -----------------------------------------------------------------------------
// Statutory filings generated FROM a processed payroll run (UI-only).
//
// ECR (Electronic Challan-cum-Return) is the monthly EPFO return. The real
// process HR/Finance follows:
//   1. Payroll for the wage month is processed (this is the only valid source).
//   2. Payroll/HR generates the ECR text file (v2.0, `#~#` delimited) — one
//      line per PF member with EPF/EPS/EDLI wages, contributions and NCP days.
//   3. HR verifies member data (UAN present & valid, NCP ≤ days, exits marked).
//   4. Finance approves the challan value (A/C 1, 2, 10, 21, 22) — maker/checker.
//   5. The file is uploaded on the EPFO Unified Portal → TRRN generated.
//   6. Payment is made against the TRRN before the 15th → challan receipt.
// The same shape is used for the ESI monthly contribution file and the monthly
// TDS deposit (challan ITNS 281) + quarterly Form 24Q so all three live on the
// Statutory Compliance screen with one workflow vocabulary.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { getStatutoryConfig } from "@/features/payroll/data/statutory-data";
import { dueDate, fyOfPeriod, periodLabel, runById } from "@/features/payroll/data/payroll-engine";

/**
 * @typedef {"ECR" | "ESI" | "TDS"} FilingKind
 */
/**
 * @typedef {"Draft" | "Verified" | "Approved" | "Filed" | "Paid"} FilingStatus
 */
export const FILING_STEPS = ["Draft", "Verified", "Approved", "Filed", "Paid"];

/**
 * @typedef {Object} EcrLine
 * @property {string} uan
 * @property {string} memberName
 * @property {number} grossWages
 * @property {number} epfWages
 * @property {number} epsWages
 * @property {number} edliWages
 * @property {number} epfContribution
 * @property {number} epsContribution
 * @property {number} epfEpsDiff
 * @property {number} ncpDays
 * @property {number} refundOfAdvances
 * @property {string} empId
 */

/**
 * @typedef {Object} EcrAccounts
 * @property {number} ac1
 * @property {number} ac2
 * @property {number} ac10
 * @property {number} ac21
 * @property {number} ac22
 * @property {number} total
 */

/**
 * @typedef {Object} EsiLine
 * @property {string} ipNumber
 * @property {string} ipName
 * @property {number} daysPaid
 * @property {number} wages
 * @property {number} employee
 * @property {number} employer
 * @property {string} reasonCode
 * @property {string} empId
 */
/**
 * @typedef {Object} TdsLine
 * @property {string} pan
 * @property {string} employee
 * @property {string} empId
 * @property {number} taxable
 * @property {number} tds
 * @property {string} regime
 */

/**
 * @typedef {Object} Filing
 * @property {string} id
 * @property {FilingKind} kind
 * @property {string} orgId
 * @property {string} runId
 * @property {string} period
 * @property {FilingStatus} status
 * @property {string} dueOn
 * @property {number} memberCount
 * @property {number} totalAmount
 * @property {EcrAccounts} [accounts]
 * @property {EcrLine[]} [ecrLines]
 * @property {EsiLine[]} [esiLines]
 * @property {TdsLine[]} [tdsLines]
 * @property {{ level: "error" | "warning", message: string }[]} validation
 * @property {string} fileName
 * @property {{ id: string, name: string }} generatedBy
 * @property {string} generatedOn
 * @property {string} [verifiedBy]
 * @property {string} [verifiedById]
 * @property {string} [approvedBy]
 * @property {string} [referenceNo] - EPFO TRRN / ESIC challan number / CIN for TDS
 * @property {string} [filedOn]
 * @property {string} [paidOn]
 * @property {string} [paymentRef]
 * @property {boolean} supplementary
 * @property {{ at: string, by: string, action: string }[]} history
 */

const now = () => new Date().toISOString().slice(0, 10);
const r0 = (n) => Math.round(n);

/** Remittance due date for a wage month. TDS deducted in March is due by 30 April (Rule 30), not the 7th. */
export function filingDueDate(kind, period, cfg = getStatutoryConfig()) {
  if (kind === "TDS")
    return period.endsWith("-03")
      ? `${period.slice(0, 4)}-04-30`
      : dueDate(period, cfg.tds.remittanceDueDay);
  return dueDate(period, kind === "ECR" ? cfg.pf.remittanceDueDay : cfg.esi.remittanceDueDay);
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export function buildEcrLines(lines) {
  return lines
    .filter((l) => l.pf.applicable)
    .map((l) => ({
      uan: l.statutory.uan,
      memberName: l.name.toUpperCase(),
      grossWages: l.earnedGross,
      epfWages: l.pf.wages,
      epsWages: l.pf.epsWages,
      edliWages: l.pf.edliWages,
      epfContribution: l.pf.employee + l.pf.vpf,
      epsContribution: l.pf.employerEps,
      epfEpsDiff: l.pf.employerEpf,
      ncpDays: l.pf.ncpDays,
      refundOfAdvances: 0,
      empId: l.empId,
    }));
}

export function ecrAccounts(lines) {
  const pfLines = lines.filter((l) => l.pf.applicable);
  const ac1 = pfLines.reduce((s, l) => s + l.pf.employee + l.pf.vpf + l.pf.employerEpf, 0);
  // A/C 2 administrative charges: 0.5 % of EPF wages, statutory minimum ₹500 per establishment.
  const ac2 = Math.max(
    pfLines.reduce((s, l) => s + l.pf.admin, 0),
    pfLines.length ? 500 : 0,
  );
  const ac10 = pfLines.reduce((s, l) => s + l.pf.employerEps, 0);
  const ac21 = pfLines.reduce((s, l) => s + l.pf.edli, 0);
  const ac22 = 0; // EDLI admin charges waived since April 2017
  return { ac1, ac2, ac10, ac21, ac22, total: ac1 + ac2 + ac10 + ac21 + ac22 };
}

export const ECR_HEADER =
  "UAN#~#MEMBER NAME#~#GROSS WAGES#~#EPF WAGES#~#EPS WAGES#~#EDLI WAGES#~#EPF CONTRI REMITTED#~#EPS CONTRI REMITTED#~#EPF EPS DIFF REMITTED#~#NCP DAYS#~#REFUND OF ADVANCES";

/** EPFO ECR v2.0 text file content (no header row is uploaded — kept as a comment for readability). */
export function ecrFileContent(lines) {
  return lines
    .map((l) =>
      [
        l.uan,
        l.memberName,
        l.grossWages,
        l.epfWages,
        l.epsWages,
        l.edliWages,
        l.epfContribution,
        l.epsContribution,
        l.epfEpsDiff,
        l.ncpDays,
        l.refundOfAdvances,
      ].join("#~#"),
    )
    .join("\n");
}

export function buildEsiLines(lines) {
  const dim = (p) => new Date(Number(p.slice(0, 4)), Number(p.slice(5, 7)), 0).getDate();
  return lines
    .filter((l) => l.esi.applicable)
    .map((l) => ({
      ipNumber: l.statutory.esiNo,
      ipName: l.name,
      daysPaid: dim(l.period) - l.lop.lopDays,
      wages: l.esi.wages,
      employee: l.esi.employee,
      employer: l.esi.employer,
      // ESIC reason codes apply only to zero-day months; a wage month with paid days is always "0".
      reasonCode: "0",
      empId: l.empId,
    }));
}

export const buildTdsLines = (lines) =>
  lines
    .filter((l) => l.tds.monthly > 0)
    .map((l) => ({
      pan: l.statutory.pan,
      employee: l.name,
      empId: l.empId,
      taxable: l.tds.taxable,
      tds: l.tds.monthly,
      regime: l.tds.regime,
    }));

function validate(kind, run, filings) {
  const out = [];
  const dim = new Date(Number(run.period.slice(0, 4)), Number(run.period.slice(5, 7)), 0).getDate();
  if (run.status !== "Processed" && run.status !== "Paid")
    out.push({
      level: "error",
      message: `Payroll run ${run.id} is ${run.status} — only a processed run can be filed.`,
    });
  const dup = filings.find(
    (f) =>
      f.kind === kind && f.orgId === run.orgId && f.period === run.period && f.status !== "Draft",
  );
  if (dup)
    out.push({
      level: "warning",
      message: `A ${kind} for ${periodLabel(run.period)} was already ${dup.status.toLowerCase()} (${dup.id}) — this will be a supplementary filing.`,
    });
  if (kind === "ECR") {
    run.lines
      .filter((l) => l.pf.applicable)
      .forEach((l) => {
        if (!/^\d{12}$/.test(l.statutory.uan))
          out.push({
            level: "error",
            message: `${l.name} (${l.empId}): UAN missing/invalid — EPFO rejects the whole file.`,
          });
        if (l.name.length > 85)
          out.push({ level: "error", message: `${l.name}: member name exceeds 85 characters.` });
        if (l.pf.ncpDays > dim)
          out.push({ level: "error", message: `${l.name}: NCP days > days in month.` });
        if (l.pf.epsWages > getStatutoryConfig().pf.wageCeiling)
          out.push({ level: "error", message: `${l.name}: EPS wages above ceiling.` });
      });
    if (run.lines.filter((l) => l.pf.applicable).length === 0)
      out.push({ level: "error", message: "No PF members in this run." });
  }
  if (kind === "ESI") {
    run.lines
      .filter((l) => l.esi.applicable)
      .forEach((l) => {
        if (!/^\d{10,17}$/.test(l.statutory.esiNo))
          out.push({ level: "error", message: `${l.name} (${l.empId}): ESI IP number missing.` });
      });
    if (run.lines.filter((l) => l.esi.applicable).length === 0)
      out.push({
        level: "warning",
        message: "No ESI-covered employees this month — file a NIL return.",
      });
  }
  if (kind === "TDS") {
    run.lines
      .filter((l) => l.tds.monthly > 0)
      .forEach((l) => {
        if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(l.statutory.pan))
          out.push({
            level: "error",
            message: `${l.name} (${l.empId}): PAN invalid — 24Q will show PANNOTAVBL.`,
          });
      });
    if (!getStatutoryConfig().establishment.tan)
      out.push({ level: "error", message: "Deductor TAN not configured." });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Supplementary returns — only the difference from what was filed      */
/* ------------------------------------------------------------------ */

const sumBy = (list, empId, keys) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  list.filter((l) => l.empId === empId).forEach((l) => keys.forEach((k) => (out[k] += l[k] ?? 0)));
  return out;
};
/** Per-employee difference between the fresh lines and everything already filed for the month. */
function deltaLines(fresh, filedLines, keys, mustChange) {
  return fresh
    .map((l) => {
      const before = sumBy(filedLines, l.empId, keys);
      return { ...l, ...Object.fromEntries(keys.map((k) => [k, (l[k] ?? 0) - before[k]])) };
    })
    .filter((l) => mustChange.some((k) => l[k] !== 0));
}
/** ECR challan accounts for a set of (delta) ECR lines. */
function ecrAccountsFromLines(lines, cfg) {
  const ac1 = lines.reduce((s, l) => s + l.epfContribution + l.epfEpsDiff, 0);
  const ac2 = Math.max(0, r0(lines.reduce((s, l) => s + l.epfWages, 0) * (cfg.pf.adminRate / 100)));
  const ac10 = lines.reduce((s, l) => s + l.epsContribution, 0);
  const ac21 = Math.max(
    0,
    r0(lines.reduce((s, l) => s + l.edliWages, 0) * (cfg.pf.edliRate / 100)),
  );
  return { ac1, ac2, ac10, ac21, ac22: 0, total: ac1 + ac2 + ac10 + ac21 };
}

/* ------------------------------------------------------------------ */
/* Store & workflow                                                    */
/* ------------------------------------------------------------------ */

function seedFilings() {
  const cfg = getStatutoryConfig();
  const mk = (kind, period, status, ref, paidOn) => {
    const run = runById(`PR-${period.replace("-", "")}`);
    if (!run) return null;
    const ecr = kind === "ECR" ? buildEcrLines(run.lines) : undefined;
    const esi = kind === "ESI" ? buildEsiLines(run.lines) : undefined;
    const tds = kind === "TDS" ? buildTdsLines(run.lines) : undefined;
    const accounts = kind === "ECR" ? ecrAccounts(run.lines) : undefined;
    const total =
      kind === "ECR"
        ? accounts.total
        : kind === "ESI"
          ? esi.reduce((s, l) => s + l.employee + l.employer, 0)
          : tds.reduce((s, l) => s + l.tds, 0);
    const due = filingDueDate(kind, period, cfg);
    return {
      id: `${kind}-${period.replace("-", "")}`,
      kind,
      orgId: run.orgId,
      runId: run.id,
      period,
      status,
      dueOn: due,
      memberCount: (ecr ?? esi ?? tds).length,
      totalAmount: total,
      accounts,
      ecrLines: ecr,
      esiLines: esi,
      tdsLines: tds,
      validation: [],
      fileName:
        kind === "ECR"
          ? `ECR_${cfg.establishment.pfCode}_${period.replace("-", "")}.txt`
          : kind === "ESI"
            ? `ESI_MC_${period.replace("-", "")}.xls`
            : `TDS_281_${period.replace("-", "")}.pdf`,
      generatedBy: { id: "SRN-0004", name: "Varen Mishra" },
      generatedOn: run.processedOn ?? due,
      verifiedBy: "Varen Mishra",
      approvedBy: "Saras Venkatesh",
      referenceNo: ref,
      filedOn: paidOn,
      paidOn,
      paymentRef: `${kind}-PAY-${period.replace("-", "")}`,
      supplementary: false,
      history: [
        {
          at: run.processedOn ?? due,
          by: "Varen Mishra",
          action: `${kind} generated from ${run.id}`,
        },
        { at: run.processedOn ?? due, by: "Varen Mishra", action: "Verified member data" },
        { at: paidOn, by: "Saras Venkatesh", action: `Approved · filed (${ref}) · paid` },
      ],
    };
  };
  return [
    mk("ECR", "2026-06", "Paid", "TRRN 2260600431182", "2026-07-10"),
    mk("ESI", "2026-06", "Paid", "MC-53000123-062026", "2026-07-12"),
    mk("TDS", "2026-06", "Paid", "CIN 0510308072026-00412", "2026-07-06"),
    mk("ECR", "2026-05", "Paid", "TRRN 2260500398210", "2026-06-11"),
    mk("ESI", "2026-05", "Paid", "MC-53000123-052026", "2026-06-12"),
    mk("TDS", "2026-05", "Paid", "CIN 0510308062026-00388", "2026-06-05"),
    mk("ECR", "2026-04", "Paid", "TRRN 2260400361077", "2026-05-12"),
    mk("ESI", "2026-04", "Paid", "MC-53000123-042026", "2026-05-13"),
    mk("TDS", "2026-04", "Paid", "CIN 0510308052026-00301", "2026-05-06"),
  ].filter((f) => f !== null);
}

export const filingStore = createPersistentStore("seereon.statutory.filings", seedFilings());
export const useFilings = () => filingStore.use();
export const filingById = (id) => filingStore.get().find((f) => f.id === id) ?? null;

const update = (id, fn) => filingStore.set((l) => l.map((f) => (f.id === id ? fn(f) : f)));
const log = (f, by, action) => ({
  ...f,
  history: [...f.history, { at: now(), by, action }],
});

/**
 * @typedef {Object} Result
 * @property {boolean} ok
 * @property {string} message
 * @property {string} [id]
 */

export function generateFiling(kind, runId, user) {
  const run = runById(runId);
  if (!run) return { ok: false, message: "Payroll run not found." };
  if (run.status !== "Processed" && run.status !== "Paid")
    return {
      ok: false,
      message: `Process payroll for ${periodLabel(run.period)} first — filings are generated from processed runs only.`,
    };
  const cfg = getStatutoryConfig();
  const existing = filingStore.get();
  const openDraft = existing.find(
    (f) =>
      f.kind === kind && f.orgId === run.orgId && f.period === run.period && f.status === "Draft",
  );
  if (openDraft)
    return {
      ok: false,
      id: openDraft.id,
      message: `${openDraft.id} is already a draft for ${periodLabel(run.period)} — verify it or discard it before generating again.`,
    };
  const validation = validate(kind, run, existing);
  const filed = existing.filter(
    (f) =>
      f.kind === kind && f.period === run.period && f.orgId === run.orgId && f.status !== "Draft",
  );
  const supplementary = filed.length > 0;
  let ecr = kind === "ECR" ? buildEcrLines(run.lines) : undefined;
  let esi = kind === "ESI" ? buildEsiLines(run.lines) : undefined;
  let tds = kind === "TDS" ? buildTdsLines(run.lines) : undefined;
  let accounts = kind === "ECR" ? ecrAccounts(run.lines) : undefined;
  if (supplementary) {
    // A supplementary return carries only what changed since the filed return(s) — re-filing the full month
    // would remit (and report in Form 24Q) the same contributions twice.
    if (kind === "ECR") {
      ecr = deltaLines(
        ecr,
        filed.flatMap((f) => f.ecrLines ?? []),
        [
          "grossWages",
          "epfWages",
          "epsWages",
          "edliWages",
          "epfContribution",
          "epsContribution",
          "epfEpsDiff",
        ],
        ["epfContribution", "epsContribution", "epfEpsDiff"],
      );
      accounts = ecrAccountsFromLines(ecr, cfg);
    } else if (kind === "ESI") {
      esi = deltaLines(
        esi,
        filed.flatMap((f) => f.esiLines ?? []),
        ["wages", "employee", "employer"],
        ["employee", "employer"],
      );
    } else {
      tds = deltaLines(
        tds,
        filed.flatMap((f) => f.tdsLines ?? []),
        ["tds"],
        ["tds"],
      );
    }
    if ((ecr ?? esi ?? tds).length === 0)
      return {
        ok: false,
        message: `Nothing changed since the ${kind} already filed for ${periodLabel(run.period)} — no supplementary return is needed.`,
      };
  }
  const total =
    kind === "ECR"
      ? accounts.total
      : kind === "ESI"
        ? esi.reduce((s, l) => s + l.employee + l.employer, 0)
        : tds.reduce((s, l) => s + l.tds, 0);
  // Unique id even after a discarded draft (a count-based suffix could repeat an existing id) and across entities.
  const base = `${kind}-${run.period.replace("-", "")}`;
  let seq = 0;
  while (existing.some((f) => f.id === (seq ? `${base}-S${seq}` : base))) seq++;
  const id = seq ? `${base}-S${seq}` : base;
  const filing = {
    id,
    kind,
    orgId: run.orgId,
    runId: run.id,
    period: run.period,
    status: "Draft",
    dueOn: filingDueDate(kind, run.period, cfg),
    memberCount: (ecr ?? esi ?? tds).length,
    totalAmount: total,
    accounts,
    ecrLines: ecr,
    esiLines: esi,
    tdsLines: tds,
    validation,
    fileName:
      kind === "ECR"
        ? `ECR_${cfg.establishment.pfCode}_${run.period.replace("-", "")}${supplementary ? "_SUPP" : ""}.txt`
        : kind === "ESI"
          ? `ESI_MC_${run.period.replace("-", "")}.xls`
          : `TDS_281_${run.period.replace("-", "")}.pdf`,
    generatedBy: { id: user.id, name: user.name },
    generatedOn: now(),
    supplementary,
    history: [
      {
        at: now(),
        by: user.name,
        action: `${kind} generated from ${run.id} (${(ecr ?? esi ?? tds).length} records)`,
      },
    ],
  };
  filingStore.set((p) => [filing, ...p]);
  const errors = validation.filter((v) => v.level === "error").length;
  return {
    ok: true,
    id,
    message: errors
      ? `${kind} draft created with ${errors} error(s) to fix before verification.`
      : `${kind} draft created — verify member data next.`,
  };
}

export function verifyFiling(id, user) {
  const f = filingById(id);
  if (!f) return { ok: false, message: "Filing not found." };
  if (f.status !== "Draft") return { ok: false, message: `Already ${f.status.toLowerCase()}.` };
  if (f.validation.some((v) => v.level === "error"))
    return {
      ok: false,
      message: "Resolve validation errors (regenerate after fixing records) before verifying.",
    };
  if (getStatutoryConfig().payroll.enforceMakerChecker && f.generatedBy.id === user.id)
    return {
      ok: false,
      message: "Maker–checker: the person who generated the filing cannot also verify it.",
    };
  update(id, (x) =>
    log(
      { ...x, status: "Verified", verifiedBy: user.name, verifiedById: user.id },
      user.name,
      "Member data verified",
    ),
  );
  return { ok: true, message: "Verified — awaiting Finance approval." };
}

export function approveFiling(id, user, remarks) {
  const f = filingById(id);
  if (!f) return { ok: false, message: "Filing not found." };
  if (f.status !== "Verified")
    return { ok: false, message: "Only a verified filing can be approved." };
  if (getStatutoryConfig().payroll.enforceMakerChecker && f.generatedBy.id === user.id)
    return {
      ok: false,
      message: "Maker–checker: the person who generated the filing cannot approve it.",
    };
  if (getStatutoryConfig().payroll.enforceMakerChecker && f.verifiedById === user.id)
    return {
      ok: false,
      message: "Maker–checker: the person who verified the filing cannot also approve it.",
    };
  update(id, (x) =>
    log(
      { ...x, status: "Approved", approvedBy: user.name },
      user.name,
      `Approved for remittance${remarks ? ` — ${remarks}` : ""}`,
    ),
  );
  return {
    ok: true,
    message: "Approved — upload the file on the portal and record the reference.",
  };
}

export function fileFiling(id, user, referenceNo) {
  const f = filingById(id);
  if (!f) return { ok: false, message: "Filing not found." };
  if (f.status !== "Approved") return { ok: false, message: "Approve before filing." };
  if (!referenceNo.trim())
    return {
      ok: false,
      message:
        f.kind === "ECR"
          ? "Enter the TRRN generated by the EPFO portal."
          : "Enter the portal reference / challan number.",
    };
  update(id, (x) =>
    log(
      { ...x, status: "Filed", referenceNo: referenceNo.trim(), filedOn: now() },
      user.name,
      `Filed · ${referenceNo.trim()}`,
    ),
  );
  return { ok: true, message: "Filed — record the payment once the challan is settled." };
}

export function payFiling(id, user, paymentRef) {
  const f = filingById(id);
  if (!f) return { ok: false, message: "Filing not found." };
  if (f.status !== "Filed") return { ok: false, message: "File before recording payment." };
  if (!paymentRef.trim())
    return { ok: false, message: "Enter the bank payment / challan receipt reference." };
  update(id, (x) =>
    log(
      { ...x, status: "Paid", paidOn: now(), paymentRef: paymentRef.trim() },
      user.name,
      `Payment recorded · ${paymentRef.trim()}`,
    ),
  );
  return { ok: true, message: "Paid — compliance closed for the month." };
}

export function deleteDraftFiling(id) {
  const f = filingById(id);
  if (!f || f.status !== "Draft") return { ok: false, message: "Only drafts can be discarded." };
  filingStore.set((p) => p.filter((x) => x.id !== id));
  return { ok: true, message: "Draft discarded." };
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

function downloadText(fileName, content, type = "text/plain") {
  if (typeof window === "undefined") return false;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function downloadEcrFile(f) {
  if (!f.ecrLines) return false;
  return downloadText(f.fileName, ecrFileContent(f.ecrLines));
}

/** ECR in .csv (MoM: PF ECR output in CSV) — same columns as the EPFO text file. */
export function downloadEcrCsv(f) {
  if (!f.ecrLines) return false;
  exportCsv(
    f.fileName.replace(/\.txt$/, ".csv"),
    ECR_HEADER.split("#~#"),
    f.ecrLines.map((l) => [
      l.uan,
      l.memberName,
      l.grossWages,
      l.epfWages,
      l.epsWages,
      l.edliWages,
      l.epfContribution,
      l.epsContribution,
      l.epfEpsDiff,
      l.ncpDays,
      l.refundOfAdvances,
    ]),
  );
  return true;
}

export function downloadEcrSummaryPdf(f) {
  if (!f.ecrLines || !f.accounts) return false;
  const cfg = getStatutoryConfig();
  const inr = (n) => n.toLocaleString("en-IN");
  return exportReportPdf({
    title: `ECR — ${periodLabel(f.period)}`,
    subtitle: `Establishment ${cfg.establishment.pfCode} · ECR v${cfg.pf.ecrVersion} · ${f.status}${f.referenceNo ? ` · ${f.referenceNo}` : ""}`,
    filters: [
      { label: "Wage month", value: periodLabel(f.period) },
      { label: "Members", value: String(f.memberCount) },
      { label: "Due on", value: f.dueOn },
      { label: "Source run", value: f.runId },
    ],
    summary: [
      { label: "A/C 1 — EPF", value: `₹\u00A0${inr(f.accounts.ac1)}` },
      { label: "A/C 2 — Admin", value: `₹\u00A0${inr(f.accounts.ac2)}` },
      { label: "A/C 10 — EPS", value: `₹\u00A0${inr(f.accounts.ac10)}` },
      { label: "A/C 21 — EDLI", value: `₹\u00A0${inr(f.accounts.ac21)}` },
      { label: "Total challan", value: `₹\u00A0${inr(f.accounts.total)}` },
    ],
    columns: [
      "UAN",
      "Member",
      "Gross",
      "EPF wages",
      "EPS wages",
      "EDLI wages",
      "EPF (EE+VPF)",
      "EPS (ER)",
      "EPF diff (ER)",
      "NCP",
    ],
    rows: f.ecrLines.map((l) => [
      l.uan,
      l.memberName,
      inr(l.grossWages),
      inr(l.epfWages),
      inr(l.epsWages),
      inr(l.edliWages),
      inr(l.epfContribution),
      inr(l.epsContribution),
      inr(l.epfEpsDiff),
      l.ncpDays,
    ]),
  });
}

export function downloadEsiFile(f) {
  if (!f.esiLines) return false;
  exportCsv(
    f.fileName.replace(".xls", ".csv"),
    [
      "IP Number",
      "IP Name",
      "No of Days",
      "Total Monthly Wages",
      "Reason Code",
      "Last Working Day",
    ],
    f.esiLines.map((l) => [l.ipNumber, l.ipName, l.daysPaid, l.wages, l.reasonCode, ""]),
  );
  return true;
}

export function downloadEsiSummaryPdf(f) {
  if (!f.esiLines) return false;
  const inr = (n) => n.toLocaleString("en-IN");
  const ee = f.esiLines.reduce((s, l) => s + l.employee, 0);
  const er = f.esiLines.reduce((s, l) => s + l.employer, 0);
  return exportReportPdf({
    title: `ESI Monthly Contribution — ${periodLabel(f.period)}`,
    subtitle: `Employer code ${getStatutoryConfig().establishment.esiCode} · ${f.status}${f.referenceNo ? ` · ${f.referenceNo}` : ""}`,
    summary: [
      { label: "Insured persons", value: String(f.memberCount) },
      { label: "Employee 0.75 %", value: `₹\u00A0${inr(ee)}` },
      { label: "Employer 3.25 %", value: `₹\u00A0${inr(er)}` },
      { label: "Total", value: `₹\u00A0${inr(ee + er)}` },
    ],
    columns: ["IP Number", "IP Name", "Days", "Wages", "Employee", "Employer"],
    rows: f.esiLines.map((l) => [
      l.ipNumber,
      l.ipName,
      l.daysPaid,
      inr(l.wages),
      inr(l.employee),
      inr(l.employer),
    ]),
  });
}

export function downloadTdsChallanPdf(f) {
  if (!f.tdsLines) return false;
  const cfg = getStatutoryConfig();
  const inr = (n) => n.toLocaleString("en-IN");
  return exportReportPdf({
    title: `TDS on Salary — Challan ITNS 281 · ${periodLabel(f.period)}`,
    subtitle: `TAN ${cfg.establishment.tan} · Section 192 · Minor head 200 (TDS payable by taxpayer) · ${f.status}${f.referenceNo ? ` · ${f.referenceNo}` : ""}`,
    filters: [
      {
        label: "Assessment year",
        value: fyOfPeriod(f.period)
          .replace("FY ", "AY ")
          .replace(
            /(\d{4})-(\d{2})/,
            (_m, a, b) => `${Number(a) + 1}-${String(Number(b) + 1).padStart(2, "0")}`,
          ),
      },
      { label: "Deductees", value: String(f.memberCount) },
      { label: "Due on", value: f.dueOn },
    ],
    summary: [
      { label: "Income tax", value: `₹\u00A0${inr(f.totalAmount)}` },
      { label: "Surcharge", value: "included" },
      { label: "Education cess", value: "included" },
      { label: "Total", value: `₹\u00A0${inr(f.totalAmount)}` },
    ],
    columns: ["PAN", "Deductee", "Regime", "Projected taxable", "TDS this month"],
    rows: f.tdsLines.map((l) => [
      l.pan || "PANNOTAVBL",
      l.employee,
      l.regime,
      inr(l.taxable),
      inr(l.tds),
    ]),
  });
}

/** Form 24Q quarterly summary across the three wage months of a quarter. */
export function downloadForm24Q(filings, quarterLabel) {
  const inr = (n) => n.toLocaleString("en-IN");
  const byEmp = new Map();
  filings.forEach((f) =>
    f.tdsLines?.forEach((l) => {
      const cur = byEmp.get(l.empId) ?? {
        pan: l.pan,
        employee: l.employee,
        tds: 0,
        periods: new Set(),
      };
      cur.tds += l.tds;
      // A supplementary challan for the same month adds its difference, not another month.
      cur.periods.add(f.period);
      byEmp.set(l.empId, cur);
    }),
  );
  const total = [...byEmp.values()].reduce((s, x) => s + x.tds, 0);
  return exportReportPdf({
    title: `Form 24Q — ${quarterLabel}`,
    subtitle: `TAN ${getStatutoryConfig().establishment.tan} · Quarterly statement of TDS on salaries (Annexure I)`,
    summary: [
      { label: "Challans", value: String(filings.length) },
      { label: "Deductees", value: String(byEmp.size) },
      { label: "Total TDS deposited", value: `₹\u00A0${inr(total)}` },
    ],
    columns: ["PAN", "Deductee", "Months", "TDS deposited"],
    rows: [...byEmp.values()].map((x) => [
      x.pan || "PANNOTAVBL",
      x.employee,
      x.periods.size,
      inr(x.tds),
    ]),
  });
}

export const filingTone = (s) =>
  s === "Paid" || s === "Filed" || s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Verified"
      ? "border-gold/40 bg-gold/15 text-gold"
      : "border-border bg-muted text-muted-foreground";

export const isOverdue = (f) => f.status !== "Paid" && f.dueOn < now();
