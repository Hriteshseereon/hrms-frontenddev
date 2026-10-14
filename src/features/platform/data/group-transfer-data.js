// ---------------------------------------------------------------------------
// Inter-company employee transfer — moving an employee from one Organization
// to another WITHIN THE SAME Company Group.
//
// This is distinct from the existing branch/office transfer in
// TransfersTab.tsx: it changes which legal entity employs the person. Their
// Group Joining Date and gratuity tenure carry forward unchanged (see
// group-data.ts); a new Organization Joining Date is set for the destination
// entity; PF/UAN are carried forward read-only. Because it moves the
// employee out of the initiating organisation entirely, it is routed through
// a Super Admin confirmation step before the destination organisation's records
// are updated — a cross-company move touches two companies' records
// on a specific employee record, since no single Org Admin has authority
// over both entities involved.
// ---------------------------------------------------------------------------
import { moveUserAccount } from "@/features/auth/data/auth-session";
import { createPersistentStore } from "@/lib/persist";
import { allUsers, userById } from "@/features/auth/data/auth-session";
import {
  getEmployeeProfile,
  recordOverride,
  updateEmployeeRecord,
} from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import {
  getOrg,
  groupJoiningDate,
  orgsOfGroup,
  setGroupJoiningDate,
} from "@/features/organization/data/group-data";
import { assetsOfEmployee, returnAsset } from "@/features/assets/data/asset-data";

/**
 * @typedef {"return" | "transfer-request" | "retain-pending-decision"} AssetDisposition
 */

/**
 * @typedef {Object} GroupTransferRequest
 * @property {string} id
 * @property {string} employeeId
 * @property {string} employeeName
 * @property {string} fromOrgId
 * @property {string} toOrgId
 * @property {string} effectiveDate
 * @property {string} newDesignation
 * @property {string} reason
 * @property {{ assetId: string, assetName: string, disposition: AssetDisposition }[]} assetDispositions - How each of the employee's currently-issued assets should be handled.
 * @property {"Pending Confirmation" | "Confirmed" | "Rejected"} status
 * @property {string} raisedOn
 * @property {string} raisedBy
 * @property {string} [decidedOn]
 * @property {string} [decidedBy]
 * @property {string} [decisionNote]
 */

const nextId = (n) => `GTR-${String(n + 1).padStart(3, "0")}`;
const today = () => new Date().toISOString().slice(0, 10);

// Persisted: the request is raised by the company's HR / Admin and confirmed by the group Super Admin,
// which is a separate sign-in and a full page load — an in-memory store lost every request on the way.
export const groupTransferStore = createPersistentStore("seereon.group.transfers.v1", []);
export const useGroupTransfers = () => groupTransferStore.use();

export function useMyOrgGroupTransfers(orgId) {
  const rows = useGroupTransfers();
  return rows.filter((r) => r.fromOrgId === orgId || r.toOrgId === orgId);
}

/** PF/UAN/gratuity snapshot shown on the transfer form so both are visibly carried forward, not re-entered. */
export function carryForwardSnapshot(employeeId) {
  const user = userById(employeeId);
  const profile = getEmployeeProfile(employeeId);
  return {
    pan: profile.payroll.statutory.pan,
    uan: profile.payroll.statutory.uan,
    pfNo: profile.payroll.statutory.pfNo,
    esiNo: profile.payroll.statutory.esiNo,
    groupJoiningDate: groupJoiningDate(employeeId, user?.doj),
  };
}

/** Every asset currently issued to this employee, for the disposition prompt. */
export function assetsNeedingDisposition(employeeId) {
  return assetsOfEmployee(employeeId).filter((a) => a.status === "Issued");
}

export function raiseGroupTransfer(input) {
  const user = userById(input.employeeId);
  // One open request per employee — a second click / second HR raising the same move must not create a duplicate
  // that could be confirmed twice.
  const open = groupTransferStore
    .get()
    .find((r) => r.employeeId === input.employeeId && r.status === "Pending Confirmation");
  if (open) return open;
  // Destination must be another entity of the same group (the form offers only those, the rule is enforced here too).
  if (!transferDestinations(input.fromOrgId).some((o) => o.id === input.toOrgId)) return null;
  const row = {
    id: nextId(groupTransferStore.get().length),
    employeeId: input.employeeId,
    employeeName: user?.name ?? input.employeeId,
    fromOrgId: input.fromOrgId,
    toOrgId: input.toOrgId,
    effectiveDate: input.effectiveDate,
    newDesignation: input.newDesignation,
    reason: input.reason,
    assetDispositions: input.assetDispositions,
    status: "Pending Confirmation",
    raisedOn: today(),
    raisedBy: input.raisedBy,
  };
  groupTransferStore.set((p) => [row, ...p]);
  return row;
}

/** The group Super Admin confirms the cross-org move: finalises gratuity carry-forward and actions each asset disposition. */
export function confirmGroupTransfer(id, decidedBy, note) {
  const row = groupTransferStore.get().find((r) => r.id === id);
  // Only a pending request can be confirmed — confirming twice re-ran the asset returns and the employee move.
  if (!row || row.status !== "Pending Confirmation") return;

  // Group Joining Date is untouched — it already carries forward automatically
  // via group-data.ts's groupJoiningDate() lookup. We only need to make sure
  // there's no stray manual override blocking that from the new org's side.
  setGroupJoiningDate(row.employeeId, groupJoiningDate(row.employeeId));

  for (const d of row.assetDispositions) {
    if (d.disposition === "return") {
      returnAsset(d.assetId, "Returned as part of inter-company transfer", 0, false);
    } else if (d.disposition === "transfer-request") {
      // Assets are organisation-scoped by design (Priority 2), so a transfer
      // across companies isn't an automatic holder reassignment — it frees
      // the asset up at the source org, flagged for the destination org's
      // admin to formally re-issue once the employee's new-org record exists.
      returnAsset(
        d.assetId,
        "Released for re-issue at destination organisation (inter-company transfer)",
        0,
        false,
      );
    }
    // "retain-pending-decision" — left as-is; source org HR resolves manually.
  }

  // The confirmation is what moves the person: the employee record now belongs to the destination organisation
  // (with the agreed designation). Previously only the request's status changed and the employee stayed in the
  // source org's roster, payroll and approvals.
  const dest = getOrg(row.toOrgId);
  updateEmployeeRecord(row.employeeId, {
    orgId: row.toOrgId,
    role: row.newDesignation.trim() || undefined,
    branch: dest?.branches?.[0]?.name || undefined,
  });
  // The login moves too — otherwise the person keeps signing in to (and being scoped to) the old company.
  moveUserAccount(row.employeeId, {
    orgId: row.toOrgId,
    groupId: dest?.groupId ?? undefined,
    designation: row.newDesignation.trim() || undefined,
    branch: dest?.branches?.[0]?.name || undefined,
  });

  groupTransferStore.set((p) =>
    p.map((r) =>
      r.id === id
        ? { ...r, status: "Confirmed", decidedOn: today(), decidedBy, decisionNote: note }
        : r,
    ),
  );
  notifyRaiser(
    row,
    `Inter-company transfer confirmed — ${row.employeeName}`,
    `Transfer ${row.id} confirmed: ${row.employeeName} moves from ${getOrg(row.fromOrgId)?.name ?? row.fromOrgId} to ${dest?.name ?? row.toOrgId} effective ${row.effectiveDate}.${note ? ` Note: ${note}` : ""}`,
  );
}

/** The HR / Admin who raised the request hears back when the Super Admin decides. */
function notifyRaiser(row, title, body) {
  if (!userById(row.raisedBy)) return;
  pushAlert({ empId: row.raisedBy, kind: "general", to: "/org/employees", title, body });
}

export function rejectGroupTransfer(id, decidedBy, note) {
  const row = groupTransferStore.get().find((r) => r.id === id);
  if (!row || row.status !== "Pending Confirmation" || !note.trim()) return;
  groupTransferStore.set((p) =>
    p.map((r) =>
      r.id === id
        ? { ...r, status: "Rejected", decidedOn: today(), decidedBy, decisionNote: note }
        : r,
    ),
  );
  notifyRaiser(
    row,
    `Inter-company transfer rejected — ${row.employeeName}`,
    `Transfer ${row.id} rejected: ${note}`,
  );
}

/** Destination organisations available for a transfer — must be in the same group. */
export function transferDestinations(fromOrgId) {
  const fromOrg = getOrg(fromOrgId);
  if (!fromOrg?.groupId) return [];
  return orgsOfGroup(fromOrg.groupId).filter((o) => o.id !== fromOrgId);
}

/** Employees eligible to be transferred out of a given organisation — only that org's own people (after any confirmed
 *  transfer, the directory record's org wins over the seeded one) and nobody with a request already pending. */
export function transferableEmployees(fromOrgId) {
  const pending = new Set(
    groupTransferStore
      .get()
      .filter((r) => r.status === "Pending Confirmation")
      .map((r) => r.employeeId),
  );
  // Administrator accounts (group Super Admin / entity Admin) are logins, not employees of an entity — they were offered
  // for transfer, and confirming moved the group Super Admin "into" another company.
  return allUsers().filter(
    (u) =>
      u.role !== "SuperAdmin" &&
      u.role !== "Admin" &&
      u.role !== "BranchAdmin" &&
      (recordOverride(u.id)?.orgId ?? u.orgId) === fromOrgId &&
      !pending.has(u.id),
  );
}
