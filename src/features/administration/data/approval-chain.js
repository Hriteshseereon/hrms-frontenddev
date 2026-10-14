// ---------------------------------------------------------------------------
// Generic, reusable approval chain.
//
// One implementation of "who approves this" shared by Assets, Tours, Comp-off
// and Appraisals. A chain is a list of role steps; each step resolves to a real
// person for the requesting employee (their HOD, their manager, their HR
// partner, or the first holder of a role).
// ---------------------------------------------------------------------------
import { allUsers, userById } from "@/features/auth/data/auth-session";
import { hodForEmployee } from "@/features/organization/data/dept-data";

/**
 * @typedef {AppRole | "HOD" | "Manager" | "HRPartner"} ChainRole
 */

/**
 * @typedef {Object} ApprovalStep
 * @property {ChainRole} role
 * @property {string} label
 * @property {string | null} approverId
 * @property {string} approverName
 * @property {"Pending" | "Approved" | "Rejected" | "Skipped"} status
 * @property {string} [actedOn]
 * @property {string} [note]
 */

export function resolveApprover(role, employeeId) {
  const emp = userById(employeeId); // includes new hires / invited users, not only the seeded roster
  switch (role) {
    case "HOD":
      return hodForEmployee(employeeId);
    case "Manager":
      return userById(emp?.managerId ?? null);
    case "HRPartner":
      return userById(emp?.hrPartnerId ?? null);
    default: {
      // Role holder of the employee's own organisation first (tenant scope); group-level fallback only when the entity has none.
      const users = allUsers();
      return (
        users.find((u) => u.role === role && u.orgId === emp?.orgId) ??
        users.find((u) => u.role === role) ??
        null
      );
    }
  }
}

const LABELS = {
  HOD: "Head of Department",
  Manager: "Reporting Manager",
  HRPartner: "HR Business Partner",
};

export function buildChain(employeeId, roles) {
  const steps = [];
  for (const role of roles) {
    const person = resolveApprover(role, employeeId);
    if (person && person.id === employeeId) continue; // never self-approve
    if (steps.some((s) => s.approverId && s.approverId === person?.id)) continue;
    steps.push({
      role,
      label: LABELS[role] ?? role,
      approverId: person?.id ?? null,
      approverName: person?.name ?? "Unassigned",
      status: person ? "Pending" : "Skipped",
      // Who raised the request — lets canActOn / decideChain refuse self-approval without every caller passing it.
      requesterId: employeeId,
    });
  }
  return steps;
}

export const currentStep = (chain) => chain.find((s) => s.status === "Pending") ?? null;

export const chainStatus = (chain) => {
  if (chain.some((s) => s.status === "Rejected")) return "Rejected";
  return chain.some((s) => s.status === "Pending") ? "Pending" : "Approved";
};

/** Requester of a chain (stamped on every step by buildChain; older persisted chains may not carry it). */
export const chainRequesterOf = (chain) => chain.find((s) => s.requesterId)?.requesterId ?? null;

/**
 * True when `userId` already decided an earlier step of this chain. Steps decided after this fix carry `actedBy`;
 * older steps fall back to the resolved approver when nobody else (an override / peer) acted in their place.
 */
export function hasActedOn(chain, userId) {
  return chain.some(
    (s) =>
      (s.status === "Approved" || s.status === "Rejected") &&
      (s.actedBy
        ? s.actedBy === userId
        : s.approverId === userId && !/\(override\)/.test(s.approverName ?? "")),
  );
}

/**
 * Nobody may act on their own request, and one person may not clear two steps of the same chain (the second step
 * needs a different approver). `requesterId` is optional — chains built by buildChain carry it already.
 */
export function isBarredFromChain(chain, userId, requesterId) {
  const requester = requesterId ?? chainRequesterOf(chain);
  if (requester && requester === userId) return true;
  return hasActedOn(chain, userId);
}

/** Can this user act on the chain right now? SuperAdmin/Admin/CHRO/CEO may always override. */
export function canActOn(chain, userId, role, requesterId) {
  const step = currentStep(chain);
  if (!step) return false;
  if (isBarredFromChain(chain, userId, requesterId)) return false;
  if (step.approverId === userId) return true;
  return role === "SuperAdmin" || role === "Admin" || role === "CEO" || role === "CHRO";
}

/** Actor holds the same kind of approval seat as the step (HR step ↔ HR/CHRO, HOD step ↔ HOD, Manager step ↔ Manager/HOD). */
function isPeerApprover(step, role) {
  const label = `${step.label ?? ""} ${step.role ?? ""}`.toLowerCase();
  if (/\bhr\b|hr partner|hrpartner/.test(label)) return role === "HR" || role === "CHRO";
  if (/hod|head of department/.test(label)) return role === "HOD";
  if (/manager/.test(label)) return role === "Manager" || role === "HOD";
  if (/finance|accounts|cfo/.test(label)) return role === "CFO";
  return false;
}

export function decideChain(chain, userId, decision, note, requesterId) {
  const idx = chain.findIndex((s) => s.status === "Pending");
  if (idx === -1) return chain;
  // Self-approval / one person clearing two steps: the decision is refused and the chain is returned unchanged.
  if (isBarredFromChain(chain, userId, requesterId)) return chain;
  const actor = userById(userId);
  return chain.map((s, i) =>
    i === idx
      ? {
          ...s,
          status: decision,
          actedBy: userId,
          actedOn: (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })(),
          // The resolved approver, or a peer who holds the same kind of seat (e.g. any HR executive on the HR step,
          // any HOD of the department), acts in their own name; only true escalations (Admin / CEO / CHRO stepping in
          // for someone else's step) are labelled as an override.
          approverName:
            s.approverId === userId
              ? s.approverName
              : actor && isPeerApprover(s, actor.role)
                ? actor.name
                : `${actor?.name ?? "Admin"} (override)`,
          note,
        }
      : s,
  );
}

export const chainSummary = (chain) => {
  const done = chain.filter((s) => s.status !== "Pending").length;
  return `${done}/${chain.length} · ${currentStep(chain)?.approverName ?? "Complete"}`;
};
