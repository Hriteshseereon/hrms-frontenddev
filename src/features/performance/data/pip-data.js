// Performance Improvement Plans — created by managers/HR inside the admin app,
// visibility governed by RBAC + reporting hierarchy.
import { nextId } from "@/lib/store";
import { createPersistentStore } from "@/lib/persist";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { userById } from "@/features/auth/data/auth-session";

export const PIP_REASON_CATEGORIES = [
  "Delivery / productivity slippage",
  "Quality of work",
  "Attendance & punctuality",
  "Behaviour / conduct",
  "Skill or knowledge gap",
  "Client escalation",
  "Missed goals / targets",
  "Probation performance",
  "Other",
];
/**
 * @typedef {(typeof PIP_REASON_CATEGORIES)[number]} PIPReasonCategory
 */
export const PIP_CADENCES = ["Weekly", "Fortnightly", "Monthly"];
export const PIP_SUPPORT = [
  "Training programme",
  "Mentor / buddy assigned",
  "Reduced scope for the period",
  "Pairing with senior",
  "Daily stand-up with manager",
  "Tools / access provided",
  "Counselling / EAP",
];
/**
 * @typedef {Object} PIPPerson
 * @property {string} id
 * @property {string} name
 * @property {string} role
 */

export const PIP_STATUSES = ["Draft", "Active", "Under Review", "Successful", "Failed", "Archived"];
/**
 * @typedef {(typeof PIP_STATUSES)[number]} PIPStatus
 */

/**
 * @typedef {Object} PIPObjective
 * @property {string} id
 * @property {string} objective
 * @property {string} measure
 * @property {boolean} done
 */
/**
 * @typedef {Object} PIPReview
 * @property {string} id
 * @property {string} date
 * @property {string} by
 * @property {string} notes
 */

/**
 * @typedef {PIPObjective & { targetDate?: string, owner?: string }} PIPObjectiveDetail
 */
/**
 * @typedef {Object} PIP
 * @property {string} id
 * @property {string} empId
 * @property {string} employee
 * @property {string} raisedBy
 * @property {string} reason
 * @property {string} start
 * @property {string} end
 * @property {PIPStatus} status
 * @property {PIPObjectiveDetail[]} objectives
 * @property {PIPReview[]} reviews
 * @property {string} managerRemarks
 * @property {string} hrRemarks
 * @property {string} finalEvaluation
 * @property {string} [designation] - Detailed plan (v4)
 * @property {string} [department]
 * @property {string} [raisedById]
 * @property {PIPReasonCategory} [reasonCategory]
 * @property {string} [detailedReason]
 * @property {string} [evidence]
 * @property {string} [priorActions]
 * @property {{ startTime: string, endTime: string }} [timeRange]
 * @property {(typeof PIP_CADENCES)[number]} [cadence]
 * @property {string[]} [checkpoints]
 * @property {{ manager?: PIPPerson, hrPartner?: PIPPerson, mentor?: PIPPerson, others?: PIPPerson[] }} [concerned]
 * @property {{ goalId: string, title: string, status: string, progress: number }[]} [goals]
 * @property {string[]} [tasks]
 * @property {string[]} [support]
 * @property {string} [expectedOutcome]
 * @property {string} [consequences]
 * @property {string[]} [attachments]
 * @property {{ on: string, comment: string } | null} [employeeAck]
 * @property {string} [createdOn]
 * @property {{ at: string, by: string, action: string }[]} [history]
 */

export const pipStore = createPersistentStore("seereon.pips.v2", [
  {
    id: "PIP-001",
    empId: "SRN-0147",
    employee: "Arjun Kapoor",
    raisedBy: "Manish Patel",
    reason: "Sustained delivery slippage across two consecutive sprints.",
    start: "2026-07-01",
    end: "2026-09-30",
    status: "Active",
    objectives: [
      {
        id: "OBJ-1",
        objective: "Close all committed sprint stories",
        measure: "≥ 90% sprint completion for 6 sprints",
        done: false,
      },
      {
        id: "OBJ-2",
        objective: "Reduce review rework",
        measure: "< 2 rework cycles per PR",
        done: true,
      },
    ],
    reviews: [
      {
        id: "PR-1",
        date: "2026-07-25",
        by: "Manish Patel",
        notes: "Improvement visible in review turnaround; delivery still behind.",
      },
    ],
    managerRemarks: "Weekly check-ins scheduled every Monday.",
    hrRemarks: "HR to sit in on the mid-point review.",
    finalEvaluation: "",
    designation: "Software Engineer",
    department: "Engineering",
    raisedById: "SRN-0149",
    reasonCategory: "Delivery / productivity slippage",
    detailedReason:
      "Sprint completion fell to 58 % and 61 % in the last two sprints against a team average of 88 %; two client-committed stories slipped a release. Code review rework averaged 3.4 cycles per PR. Feedback was given informally on 12 Jun and formally on 24 Jun without sustained improvement.",
    evidence: "Jira sprint reports S-31/S-32; PR analytics June; client escalation mail 26 Jun.",
    priorActions:
      "Verbal feedback 12 Jun; written feedback 24 Jun; pairing with Ananya for two weeks.",
    timeRange: { startTime: "09:30", endTime: "18:30" },
    cadence: "Weekly",
    checkpoints: [
      "2026-07-08",
      "2026-07-15",
      "2026-07-22",
      "2026-07-29",
      "2026-08-05",
      "2026-08-12",
      "2026-08-19",
      "2026-08-26",
      "2026-09-02",
      "2026-09-09",
      "2026-09-16",
      "2026-09-23",
      "2026-09-30",
    ],
    concerned: {
      manager: { id: "SRN-0149", name: "Manish Patel", role: "Engineering Manager" },
      hrPartner: { id: "SRN-0144", name: "Priya Nair", role: "HR Business Partner" },
      mentor: { id: "SRN-0142", name: "Ananya Sharma", role: "Senior Engineer" },
    },
    goals: [
      {
        goalId: "GOL-003",
        title: "Deliver Spotlight sprint commitments",
        status: "In Progress",
        progress: 40,
      },
    ],
    tasks: [
      "Close SPOT-412, SPOT-418 by sprint 33",
      "Reduce PR rework to < 2 cycles",
      "Attend daily 15-minute stand-up with manager",
    ],
    support: ["Mentor / buddy assigned", "Pairing with senior", "Daily stand-up with manager"],
    expectedOutcome:
      "≥ 90 % sprint completion for six consecutive sprints and < 2 review cycles per PR.",
    consequences:
      "If the objectives are not met by 30 Sep 2026, the plan may be extended once or further action taken under the HR policy, up to separation.",
    attachments: ["sprint-report-s31-s32.pdf", "feedback-24jun.pdf"],
    employeeAck: {
      on: "2026-07-01",
      comment: "Understood the plan; will work with Ananya on the review checklist.",
    },
    createdOn: "2026-07-01",
    history: [
      { at: "2026-07-01", by: "Manish Patel", action: "PIP created and shared with the employee" },
      { at: "2026-07-01", by: "Arjun Kapoor", action: "Acknowledged" },
      { at: "2026-07-25", by: "Manish Patel", action: "Checkpoint note added" },
    ],
  },
  {
    id: "PIP-002",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    raisedBy: "Kavya Menon",
    reason: "Quota attainment below 60% for two quarters.",
    start: "2026-03-01",
    end: "2026-05-31",
    status: "Successful",
    objectives: [
      {
        id: "OBJ-1",
        objective: "Achieve 85% of quarterly quota",
        measure: "Closed-won revenue",
        done: true,
      },
    ],
    reviews: [
      { id: "PR-1", date: "2026-05-28", by: "Kavya Menon", notes: "Exceeded the recovery target." },
    ],
    managerRemarks: "Strong turnaround.",
    hrRemarks: "Closed with a positive outcome.",
    finalEvaluation: "Objectives met — PIP closed successfully.",
  },
]);

export const addPIP = (p) => {
  // From the highest existing number — `length` collides once a plan is removed or the list is re-seeded.
  const id = nextId(
    "PIP",
    Math.max(0, ...pipStore.get().map((x) => Number(x.id.match(/(\d+)$/)?.[1]) || 0)),
  );
  pipStore.set((prev) => [{ ...p, id }, ...prev]);
  return id;
};

/** Create a detailed PIP, notify the employee and everyone concerned. */
export function createDetailedPIP(input, by) {
  if (!input.empId) return { ok: false, message: "Choose the employee." };
  if (!input.reason.trim() || !input.detailedReason?.trim())
    return { ok: false, message: "Summary and detailed reason are required." };
  if (!input.start || !input.end || input.end < input.start)
    return { ok: false, message: "Set a valid date range." };
  if (!input.objectives.some((o) => o.objective.trim() && o.measure.trim()))
    return { ok: false, message: "Add at least one objective with a measure." };
  if (input.empId === by.id) return { ok: false, message: "You cannot raise a PIP for yourself." };
  if (
    pipStore
      .get()
      .some(
        (p) =>
          p.empId === input.empId &&
          (p.status === "Active" || p.status === "Under Review" || p.status === "Draft"),
      )
  )
    return { ok: false, message: `${input.employee} already has an open improvement plan.` };
  const today = new Date().toISOString().slice(0, 10);
  const id = addPIP({
    ...input,
    status: "Active",
    reviews: [],
    managerRemarks: "",
    hrRemarks: "",
    finalEvaluation: "",
    createdOn: today,
    history: [{ at: today, by: by.name, action: "PIP created and shared with the employee" }],
  });
  pushAlert({
    empId: input.empId,
    kind: "review",
    to: "/emp/appraisals",
    title: `Performance improvement plan ${id}`,
    body: `${input.reasonCategory ?? "PIP"} · ${input.start} → ${input.end} (${input.cadence ?? "weekly"} checkpoints). Read the plan and objectives on My Appraisals and acknowledge.`,
  });
  [
    input.concerned?.manager,
    input.concerned?.hrPartner,
    input.concerned?.mentor,
    ...(input.concerned?.others ?? []),
  ]
    .filter(Boolean)
    .forEach((p) => {
      if (p && p.id !== by.id)
        pushAlert({
          empId: p.id,
          kind: "review",
          // Employee-role mentors cannot open the org performance screen.
          to: userById(p.id)?.role === "Employee" ? "/emp/dashboard" : "/org/performance",
          title: `You are listed on PIP ${id} for ${input.employee}`,
          body: `${input.reason} · ${input.start} → ${input.end}. Checkpoints ${input.cadence ?? "weekly"}.`,
        });
    });
  return {
    ok: true,
    message: `${id} created for ${input.employee} — employee and concerned persons notified.`,
    id,
  };
}

export const ackPIP = (id, comment) => {
  const today = new Date().toISOString().slice(0, 10);
  pipStore.set((p) =>
    p.map((x) =>
      x.id === id && !x.employeeAck
        ? {
            ...x,
            employeeAck: { on: today, comment },
            history: [
              ...(x.history ?? []),
              {
                at: today,
                by: x.employee,
                action: `Acknowledged${comment ? ` — "${comment}"` : ""}`,
              },
            ],
          }
        : x,
    ),
  );
};

export const updatePIP = (id, patch) =>
  pipStore.set((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

export const addPIPReview = (id, by, notes, date) =>
  pipStore.set((p) =>
    p.map((x) =>
      x.id === id
        ? {
            ...x,
            reviews: [
              {
                id: `PR-${Math.max(0, ...x.reviews.map((r) => Number(r.id.replace(/\D/g, "")) || 0)) + 1}`,
                date,
                by,
                notes,
              },
              ...x.reviews,
            ],
          }
        : x,
    ),
  );

export const pipTone = (s) =>
  s === "Successful"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Failed"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Active" || s === "Under Review"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";

export const usePIPs = () => pipStore.use();
