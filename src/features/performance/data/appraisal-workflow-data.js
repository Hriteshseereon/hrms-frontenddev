// ---------------------------------------------------------------------------
// Appraisal workflow — Self appraisal → HOD appraisal → HR appraisal.
//
// Distinct from the existing single-stage "Team Reviews" tool
// (manager-data.ts's teamReviewStore), which stays as a lightweight manager
// note-taking screen. This module is the formal, staged appraisal cycle the
// client asked for, reusing the same review cycles (REVIEW_CYCLE_ROWS) and
// each employee's live Goals as the basis for self-assessment.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { userById, allUsers } from "@/features/auth/data/auth-session";
import { hodForEmployee } from "@/features/organization/data/dept-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { findEmployee } from "@/features/employees/data/employee-directory";

export const APPRAISAL_STAGES = ["Self Appraisal", "HOD Appraisal", "HR Appraisal", "Completed"];
/**
 * @typedef {(typeof APPRAISAL_STAGES)[number]} AppraisalStage
 */

export const APPRAISAL_RATINGS = [
  "1 — Below",
  "2 — Developing",
  "3 — Meets",
  "4 — Exceeds",
  "5 — Outstanding",
];

/**
 * @typedef {Object} StageRecord
 * @property {string} rating
 * @property {string} comments
 * @property {string | null} submittedBy
 * @property {string} submittedByName
 * @property {string | null} submittedOn
 */

const emptyStage = () => ({
  rating: "",
  comments: "",
  submittedBy: null,
  submittedByName: "",
  submittedOn: null,
});

/**
 * @typedef {Object} AppraisalCycleRecord
 * @property {string} id
 * @property {string} employeeId
 * @property {string} employeeName
 * @property {string | null} hodId
 * @property {string} hodName
 * @property {string} cycle
 * @property {AppraisalStage} stage
 * @property {StageRecord} self
 * @property {StageRecord} hod
 * @property {StageRecord} hr
 * @property {string} createdOn
 * @property {string} [sentBackNote] - Set when HOD sends the self-appraisal back for revision.
 */

export const appraisalWorkflowStore = createPersistentStore("seereon.appraisal.workflow", []);
export const useAppraisalWorkflows = () => appraisalWorkflowStore.use();

export function useMyAppraisals(employeeId) {
  const rows = useAppraisalWorkflows();
  return rows.filter((r) => r.employeeId === employeeId);
}

/** Appraisals awaiting this HOD's action. */
export function useAppraisalsForHod(hodId) {
  const rows = useAppraisalWorkflows();
  return rows.filter((r) => r.hodId === hodId && r.stage === "HOD Appraisal");
}

export function startAppraisalCycle(employeeId, cycle) {
  const existing = appraisalWorkflowStore
    .get()
    .find((r) => r.employeeId === employeeId && r.cycle === cycle);
  if (existing) return existing;

  const emp = userById(employeeId);
  // The department HOD reviews; when the department has no HOD (or the employee is the HOD) the reporting
  // manager takes that stage — otherwise the cycle would sit at "HOD Appraisal" with nobody able to act.
  const deptHod = hodForEmployee(employeeId);
  const hod = deptHod && deptHod.id !== employeeId ? deptHod : userById(emp?.managerId ?? null);
  const nextNo =
    Math.max(
      0,
      ...appraisalWorkflowStore.get().map((r) => Number(r.id.match(/(\d+)$/)?.[1]) || 0),
    ) + 1;
  const row = {
    id: `APW-${String(nextNo).padStart(3, "0")}`,
    employeeId,
    // Directory-only employees (no portal login) have no AppUser — fall back to the directory name, never the raw id.
    employeeName: emp?.name ?? findEmployee(employeeId)?.name ?? employeeId,
    hodId: hod?.id ?? null,
    hodName: hod?.name ?? "No HOD assigned",
    cycle,
    stage: "Self Appraisal",
    self: emptyStage(),
    hod: emptyStage(),
    hr: emptyStage(),
    createdOn: new Date().toISOString().slice(0, 10),
  };
  appraisalWorkflowStore.set((p) => [row, ...p]);
  return row;
}

export function submitSelfAppraisal(id, employeeId, rating, comments) {
  const emp = userById(employeeId);
  const row = appraisalWorkflowStore.get().find((r) => r.id === id);
  // Only the appraisee, and only while the record is at the Self stage (a stale screen must not re-open a later stage).
  if (!row || row.stage !== "Self Appraisal" || row.employeeId !== employeeId) return false;
  appraisalWorkflowStore.set((p) =>
    p.map((r) =>
      r.id === id
        ? {
            ...r,
            self: {
              rating,
              comments,
              submittedBy: employeeId,
              submittedByName: emp?.name ?? employeeId,
              submittedOn: new Date().toISOString().slice(0, 10),
            },
            stage: "HOD Appraisal",
            sentBackNote: undefined,
          }
        : r,
    ),
  );
  if (row.hodId)
    pushAlert({
      empId: row.hodId,
      kind: "review",
      to: "/org/performance",
      title: `Appraisal awaiting your HOD review — ${emp?.name ?? employeeId}`,
      body: `${row.cycle} · self rating ${rating}. Rate and comment under Performance → Appraisal Workflow.`,
    });
  return true;
}

export function submitHodAppraisal(id, hodId, rating, comments) {
  const hod = userById(hodId);
  const row = appraisalWorkflowStore.get().find((r) => r.id === id);
  if (!row || row.stage !== "HOD Appraisal" || row.employeeId === hodId) return false;
  appraisalWorkflowStore.set((p) =>
    p.map((r) =>
      r.id === id
        ? {
            ...r,
            hod: {
              rating,
              comments,
              submittedBy: hodId,
              submittedByName: hod?.name ?? hodId,
              submittedOn: new Date().toISOString().slice(0, 10),
            },
            stage: "HR Appraisal",
          }
        : r,
    ),
  );
  const orgId = userById(row.employeeId)?.orgId ?? findEmployee(row.employeeId)?.orgId;
  allUsers()
    .filter((u) => (u.role === "HR" || u.role === "CHRO") && (!orgId || u.orgId === orgId))
    .forEach((u) =>
      pushAlert({
        empId: u.id,
        kind: "review",
        to: "/org/performance",
        title: `Appraisal awaiting HR — ${row.employeeName}`,
        body: `${row.cycle} · HOD ${hod?.name ?? hodId} rated ${rating}. Finalise under Performance → Appraisal Workflow.`,
      }),
    );
  return true;
}

/** HOD sends the self-appraisal back for revision — reopens the Self stage. */
export function sendBackToSelf(id, hodId, note) {
  const row = appraisalWorkflowStore.get().find((r) => r.id === id);
  if (!row || row.stage !== "HOD Appraisal") return false;
  appraisalWorkflowStore.set((p) =>
    p.map((r) => (r.id === id ? { ...r, stage: "Self Appraisal", sentBackNote: note } : r)),
  );
  pushAlert({
    empId: row.employeeId,
    kind: "review",
    to: "/emp/appraisals",
    title: `${row.cycle} — self appraisal sent back`,
    body: `${userById(hodId)?.name ?? row.hodName}: ${note}`,
  });
  return true;
}

export function submitHrAppraisal(id, hrId, rating, comments) {
  const hrUser = userById(hrId);
  const row = appraisalWorkflowStore.get().find((r) => r.id === id);
  if (!row || row.stage !== "HR Appraisal" || row.employeeId === hrId) return false;
  // Maker-checker: whoever took the HOD stage (e.g. HR standing in for a missing HOD) cannot also finalise.
  if (row.hod.submittedBy === hrId) return false;
  appraisalWorkflowStore.set((p) =>
    p.map((r) =>
      r.id === id
        ? {
            ...r,
            hr: {
              rating,
              comments,
              submittedBy: hrId,
              submittedByName: hrUser?.name ?? hrId,
              submittedOn: new Date().toISOString().slice(0, 10),
            },
            stage: "Completed",
          }
        : r,
    ),
  );
  pushAlert({
    empId: row.employeeId,
    kind: "review",
    to: "/emp/appraisals",
    title: `${row.cycle} — appraisal completed`,
    body: `Final rating ${rating} by ${hrUser?.name ?? hrId}. ${comments}`.trim(),
  });
  return true;
}

export const stageIndex = (stage) => APPRAISAL_STAGES.indexOf(stage);

export const stageTone = (stage) =>
  stage === "Completed"
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-gold/40 bg-gold/10 text-gold";
