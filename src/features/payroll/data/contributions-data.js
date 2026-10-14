// -----------------------------------------------------------------------------
// Voluntary contributions (VPF, NPS) and the employee statutory profile.
//
// VPF is an employee-only top-up over the 12 % statutory PF — it flows into
// the same EPF account (A/C 1) and appears in the ECR as part of the member's
// EPF contribution. NPS is a separate corporate-NPS contribution: the employee
// share is a deduction; the employer share is a CTC component that is
// tax-deductible under 80CCD(2). Both were only names on a report before; this
// store is what makes them real payroll inputs.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {Object} ContributionDeclaration
 * @property {string} empId
 * @property {string} fy
 * @property {{ enabled: boolean, mode: "Percent of Basic" | "Fixed amount", value: number }} vpf
 * @property {{ enabled: boolean, pran: string, employeePct: number, employerPct: number }} nps
 * @property {"Draft" | "Submitted" | "Approved" | "Locked"} status
 * @property {{ vpf: ContributionDeclaration["vpf"], nps: ContributionDeclaration["nps"] }} [approved] - Last
 *   HR-approved values; payroll keeps deducting these while a revision is in draft / awaiting approval.
 * @property {string} updatedOn
 * @property {{ at: string, by: string, action: string }[]} history
 */

export const CURRENT_FY = "FY 2026-27";

export const contributionStore = createPersistentStore("seereon.payroll.contributions", [
  {
    empId: "SRN-0142",
    fy: CURRENT_FY,
    vpf: { enabled: true, mode: "Percent of Basic", value: 8 },
    nps: { enabled: true, pran: "110012345678", employeePct: 10, employerPct: 10 },
    status: "Approved",
    updatedOn: "2026-04-12",
    history: [
      { at: "2026-04-10", by: "Ananya Sharma", action: "Declared VPF 8 % and NPS 10 %/10 %" },
      { at: "2026-04-12", by: "Varen Mishra", action: "Approved — effective April 2026 payroll" },
    ],
  },
  {
    empId: "SRN-0006",
    fy: CURRENT_FY,
    vpf: { enabled: true, mode: "Fixed amount", value: 2500 },
    nps: { enabled: false, pran: "", employeePct: 0, employerPct: 0 },
    status: "Approved",
    updatedOn: "2026-04-05",
    history: [
      { at: "2026-04-03", by: "Subham Das", action: "Declared VPF ₹2,500 / month" },
      { at: "2026-04-05", by: "Ritu Bansal", action: "Approved — effective April 2026 payroll" },
    ],
  },
]);
export const useContributions = () => contributionStore.use();

export const emptyDeclaration = (empId, fy = CURRENT_FY) => ({
  empId,
  fy,
  vpf: { enabled: false, mode: "Percent of Basic", value: 0 },
  nps: { enabled: false, pran: "", employeePct: 0, employerPct: 0 },
  status: "Draft",
  updatedOn: "—",
  history: [],
});

export const getContribution = (empId, fy = CURRENT_FY) =>
  contributionStore.get().find((c) => c.empId === empId && c.fy === fy) ??
  emptyDeclaration(empId, fy);

const isApproved = (s) => s === "Approved" || s === "Locked";

export function saveContribution(next, by, action) {
  const at = new Date().toISOString().slice(0, 10);
  const prev = contributionStore.get().find((c) => c.empId === next.empId && c.fy === next.fy);
  // Keep the last approved values when an approved declaration is revised — the revision must not silently stop
  // VPF / NPS on the next payroll before HR approves it.
  const approved = isApproved(next.status)
    ? { vpf: next.vpf, nps: next.nps }
    : prev && isApproved(prev.status)
      ? { vpf: prev.vpf, nps: prev.nps }
      : (next.approved ?? prev?.approved);
  const stamped = {
    ...next,
    ...(approved ? { approved } : {}),
    updatedOn: at,
    history: [{ at, by, action }, ...next.history],
  };
  contributionStore.set((list) => {
    const i = list.findIndex((c) => c.empId === next.empId && c.fy === next.fy);
    if (i === -1) return [stamped, ...list];
    const copy = [...list];
    copy[i] = stamped;
    return copy;
  });
  return stamped;
}

/** Monthly VPF amount for a given basic — only applies when HR has approved the declaration. */
/** The values payroll applies: the declaration itself once approved, else the last approved snapshot. */
const effective = (c) => (isApproved(c.status) ? c : (c.approved ?? null));

export function monthlyVpf(empId, basic, fy = CURRENT_FY) {
  const c = effective(getContribution(empId, fy));
  if (!c || !c.vpf.enabled) return 0;
  return c.vpf.mode === "Fixed amount"
    ? Math.round(c.vpf.value)
    : Math.round((basic * c.vpf.value) / 100);
}

export function monthlyNps(empId, basic, fy = CURRENT_FY) {
  const c = effective(getContribution(empId, fy));
  if (!c || !c.nps.enabled) return { employee: 0, employer: 0, pran: "" };
  return {
    employee: Math.round((basic * c.nps.employeePct) / 100),
    employer: Math.round((basic * c.nps.employerPct) / 100),
    pran: c.nps.pran,
  };
}

/* ------------------------------------------------------------------ */
/* Employee statutory profile                                          */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} EmployeeStatutoryProfile
 * @property {string} empId
 * @property {TaxRegime} regime
 * @property {boolean} pfApplicable - PF is mandatory below the ceiling; above it an employee may be exempt (Form 11) if never a member.
 * @property {boolean} pfInternationalWorker - International worker / excluded employee flag — PF on full wages, no ceiling.
 * @property {"Org default" | "Capped" | "Full"} [pfMode] - Item 13/17 — employee-specific PF basis: "Capped" = 12 % of ₹15,000 ceiling; "Full" = 12 % of actual basic; "Org default" follows Payroll Config.
 * @property {string[]} [insurancePlanIds] - Q2 — insurance plan assigned from Master Data → Insurance plans (ESI / group mediclaim / term life).
 * @property {"Auto" | "Covered" | "Not covered"} esiOverride - ESI opt-in forced (e.g. disability threshold) or explicitly not covered.
 * @property {boolean} personWithDisability
 * @property {boolean} panVerified - Days of NCP (non-contributory period) reported to EPFO come from LOP days automatically.
 */

export const statutoryProfileStore = createPersistentStore(
  "seereon.payroll.statutory-profiles.v2",
  [
    {
      empId: "SRN-0001",
      regime: "New Regime",
      pfApplicable: true,
      pfInternationalWorker: false,
      esiOverride: "Auto",
      personWithDisability: false,
      panVerified: true,
    },
    {
      empId: "SRN-0142",
      regime: "New Regime",
      pfApplicable: true,
      pfInternationalWorker: false,
      esiOverride: "Auto",
      personWithDisability: false,
      panVerified: true,
    },
    {
      empId: "SRN-0143",
      regime: "New Regime",
      pfApplicable: true,
      pfInternationalWorker: false,
      esiOverride: "Auto",
      personWithDisability: false,
      panVerified: false,
    },
  ],
);
export const useStatutoryProfiles = () => statutoryProfileStore.use();

export const statutoryProfileOf = (empId) =>
  statutoryProfileStore.get().find((p) => p.empId === empId) ?? {
    empId,
    regime: "New Regime",
    pfApplicable: true,
    pfInternationalWorker: false,
    esiOverride: "Auto",
    personWithDisability: false,
    panVerified: true,
  };

export function saveStatutoryProfile(next) {
  statutoryProfileStore.set((list) =>
    list.some((p) => p.empId === next.empId)
      ? list.map((p) => (p.empId === next.empId ? next : p))
      : [...list, next],
  );
}
