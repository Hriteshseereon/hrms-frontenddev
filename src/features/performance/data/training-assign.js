// Training delivery — assignments, content modules, progress, assignments upload
// and completion approval. Plus the "Getting Started" resource library.
import { createStore, nextId } from "@/lib/store";
import { createPersistentStore } from "@/lib/persist";
import { allUsers } from "@/features/auth/data/auth-session";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { addGoal, goalStore } from "@/features/performance/data/goals-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { exportLetterPdf, exportReportPdf } from "@/lib/export-utils";

export const ASSIGN_STATUSES = [
  "Not Started",
  "In Progress",
  "Submitted",
  "Under Review",
  "Completed",
  "Reassigned",
];
/**
 * @typedef {(typeof ASSIGN_STATUSES)[number]} AssignStatus
 */

/**
 * @typedef {Object} TrainingModuleItem
 * @property {string} id
 * @property {string} title
 * @property {"Video" | "Document" | "Quiz" | "Assignment"} kind
 * @property {string} duration
 * @property {string} url
 * @property {boolean} done
 */

/**
 * @typedef {Object} TrainingLink
 * @property {string} label
 * @property {string} url
 */
/**
 * @typedef {"Online (self-paced)" | "Online (live)" | "Classroom" | "Blended" | "On-the-job"} TrainingMode
 */
export const TRAINING_MODES = [
  "Online (self-paced)",
  "Online (live)",
  "Classroom",
  "Blended",
  "On-the-job",
];
export const TRAINING_PURPOSES = [
  "Skill upgrade for current role",
  "Compliance / statutory",
  "Onboarding / induction",
  "Client / project requirement",
  "Leadership development",
  "Certification",
  "Performance improvement plan",
  "Cross-skilling",
];

/**
 * Training programme in the catalogue (Master: Training → Trainings, or added inline while assigning).
 * @typedef {Object} TrainingProgramme
 * @property {string} id
 * @property {string} title
 * @property {string} type
 * @property {string} description
 * @property {string} purpose
 * @property {string} trainer
 * @property {TrainingMode} mode
 * @property {TrainingLink[]} links
 * @property {string} start
 * @property {string} end
 * @property {string} deadline
 * @property {number} durationHours
 * @property {boolean} mandatory
 * @property {boolean} includeInGoals
 * @property {string[]} skills
 * @property {string} branch
 * @property {string} location
 * @property {"Planned" | "Ongoing" | "Completed" | "Cancelled"} status
 * @property {string} createdBy
 * @property {string} createdOn
 * @property {string[]} materials
 */

/**
 * @typedef {Object} TrainingReview
 * @property {string} reviewedBy
 * @property {string} reviewedOn
 * @property {number} progressPct
 * @property {"Objectives met" | "Partially met" | "Not met"} outcome
 * @property {string} bottlenecks
 * @property {string} learnings
 * @property {string} applicationPlan
 * @property {{ skills: number, efficiency: number, knowledge: number, participation: number, application: number }} ratings
 * @property {number} overall
 * @property {"Certify" | "Extend deadline" | "Reassign" | "Advanced training"} recommendation
 * @property {string} comments
 * @property {string[]} attachments
 */

/**
 * @typedef {Object} TrainingAssignment
 * @property {string} id
 * @property {string} trainingId
 * @property {string} training
 * @property {string} empId
 * @property {string} employee
 * @property {string} assignedBy
 * @property {string} assignedOn
 * @property {string} dueDate
 * @property {boolean} mandatory
 * @property {AssignStatus} status
 * @property {number} progress
 * @property {string} score
 * @property {string} evaluation
 * @property {string} submission
 * @property {TrainingModuleItem[]} modules
 * @property {string} [purpose] - Detailed assignment (enterprise form)
 * @property {string} [description]
 * @property {TrainingLink[]} [links]
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {TrainingMode} [mode]
 * @property {string} [trainer]
 * @property {number} [durationHours]
 * @property {string[]} [skills]
 * @property {boolean} [includeInGoals]
 * @property {string} [goalId]
 * @property {TrainingReview} [review]
 * @property {string} [certificateRef]
 * @property {string} [certifiedOn]
 */

const mod = (id, title, kind, duration, done = false) => ({
  id,
  title,
  kind,
  duration,
  url: "#",
  done,
});

export const trainingAssignmentStore = createPersistentStore("seereon.training.assignments.v2", [
  {
    id: "TA-001",
    trainingId: "TRG-001",
    training: "Advanced React Patterns",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    assignedBy: "Manish Patel",
    assignedOn: "2026-07-20",
    dueDate: "2026-08-15",
    mandatory: true,
    status: "In Progress",
    progress: 50,
    score: "",
    evaluation: "",
    submission: "",
    modules: [
      mod("M1", "Composition & compound components", "Video", "42 min", true),
      mod("M2", "State machines in React", "Video", "38 min", true),
      mod("M3", "Performance patterns handbook", "Document", "20 pages"),
      mod("M4", "Build a data-grid — assignment", "Assignment", "3 h"),
    ],
  },
  {
    id: "TA-002",
    trainingId: "TRG-002",
    training: "POSH Awareness FY26",
    empId: "SRN-0142",
    employee: "Ananya Sharma",
    assignedBy: "Priya Nair",
    assignedOn: "2026-07-01",
    dueDate: "2026-07-15",
    mandatory: true,
    status: "Completed",
    progress: 100,
    score: "94%",
    evaluation: "Passed with distinction.",
    submission: "posh-quiz.pdf",
    modules: [
      mod("M1", "Policy overview", "Video", "18 min", true),
      mod("M2", "Case studies", "Document", "12 pages", true),
      mod("M3", "Compliance quiz", "Quiz", "15 min", true),
    ],
    purpose: "Compliance / statutory",
    mode: "Online (self-paced)",
    trainer: "Meera Suresh",
    durationHours: 2,
    skills: ["POSH awareness", "Workplace conduct"],
    includeInGoals: false,
    review: {
      reviewedBy: "Priya Nair",
      reviewedOn: "2026-07-16",
      progressPct: 100,
      outcome: "Objectives met",
      bottlenecks: "None.",
      learnings: "Clear on the IC process, reporting timelines and bystander responsibilities.",
      applicationPlan: "Acts as the team's first point of contact for POSH queries.",
      ratings: { skills: 5, efficiency: 5, knowledge: 5, participation: 4, application: 5 },
      overall: 4.8,
      recommendation: "Certify",
      comments: "Passed with distinction (94 %).",
      attachments: ["posh-quiz.pdf"],
    },
    certificateRef: "CERT-2026-0002",
    certifiedOn: "2026-07-16",
  },
  {
    id: "TA-003",
    trainingId: "TRG-003",
    training: "Enterprise Negotiation Lab",
    empId: "SRN-0143",
    employee: "Vikram Iyer",
    assignedBy: "Kavya Menon",
    assignedOn: "2026-07-18",
    dueDate: "2026-08-05",
    mandatory: false,
    status: "Submitted",
    progress: 90,
    score: "",
    evaluation: "",
    submission: "negotiation-roleplay.mp4",
    modules: [
      mod("M1", "Anchoring & framing", "Video", "34 min", true),
      mod("M2", "Objection handling playbook", "Document", "16 pages", true),
      mod("M3", "Role-play submission", "Assignment", "1 h", true),
    ],
  },
  {
    id: "TA-004",
    trainingId: "TRG-001",
    training: "Advanced React Patterns",
    empId: "SRN-0147",
    employee: "Arjun Kapoor",
    assignedBy: "Manish Patel",
    assignedOn: "2026-07-22",
    dueDate: "2026-08-20",
    mandatory: true,
    status: "Not Started",
    progress: 0,
    score: "",
    evaluation: "",
    submission: "",
    modules: [
      mod("M1", "Composition & compound components", "Video", "42 min"),
      mod("M2", "State machines in React", "Video", "38 min"),
      mod("M3", "Performance patterns handbook", "Document", "20 pages"),
    ],
  },
]);

export const addAssignment = (a) =>
  trainingAssignmentStore.set((p) => [
    {
      ...a,
      id: nextId("TA", Math.max(0, ...p.map((x) => Number(x.id.match(/(\d+)$/)?.[1]) || 0))),
    },
    ...p,
  ]);

export const updateAssignment = (id, patch) =>
  trainingAssignmentStore.set((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));

export function toggleAssignmentModule(id, moduleId) {
  trainingAssignmentStore.set((p) =>
    p.map((a) => {
      // A certified / completed assignment is closed; an empty module list would divide by zero (NaN progress).
      if (a.id !== id || a.status === "Completed" || !a.modules.length) return a;
      const modules = a.modules.map((m) => (m.id === moduleId ? { ...m, done: !m.done } : m));
      const progress = Math.round((modules.filter((m) => m.done).length / modules.length) * 100);
      // Reaching 100 % no longer auto-submits silently: the employee submits explicitly (which notifies the assigner).
      const status =
        a.status === "Submitted" || a.status === "Under Review"
          ? a.status
          : progress === 0
            ? "Not Started"
            : "In Progress";
      return { ...a, modules, progress, status };
    }),
  );
}

/** Employee submits the assignment for review: every module done (or an assignment file attached); the assigner is notified. */
export function submitAssignment(id, submission, by) {
  const a = trainingAssignmentStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Assignment not found." };
  if (a.empId !== by.id)
    return { ok: false, message: "Only the assignee can submit this training." };
  if (a.status === "Completed")
    return { ok: false, message: "This training is already completed and certified." };
  if ((a.status === "Submitted" || a.status === "Under Review") && submission === a.submission)
    return { ok: false, message: "Already submitted — awaiting review." };
  const pending = a.modules.filter((m) => !m.done).length;
  if (pending && !submission)
    return {
      ok: false,
      message: `Complete the remaining ${pending} module(s) or attach your assignment before submitting.`,
    };
  updateAssignment(id, { submission, status: "Submitted", progress: pending ? a.progress : 100 });
  allUsers()
    .filter((u) => u.name === a.assignedBy)
    .forEach((u) =>
      pushAlert({
        empId: u.id,
        kind: "review",
        to: "/org/training",
        title: `Training submitted for review — ${a.employee}`,
        body: `${a.training}${submission ? ` · ${submission}` : ""}. Review and certify under Training → Assigned Trainings.`,
      }),
    );
  return { ok: true, message: "Submitted for review — the assigner has been notified." };
}

export const assignTone = (s) =>
  s === "Completed"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Submitted" || s === "Under Review"
      ? "border-gold/40 bg-gold/15 text-gold"
      : s === "Reassigned"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

export const useAssignments = () => trainingAssignmentStore.use();

/* ------------------------------------------------ Training catalogue */
export const trainingCatalogStore = createPersistentStore("seereon.training.catalog.v1", [
  {
    id: "TRG-001",
    title: "Advanced React Patterns",
    type: "Technical Upskilling",
    description:
      "Composition, state machines, performance patterns and a hands-on data-grid build.",
    purpose: "Skill upgrade for current role",
    trainer: "Sanjay Rao",
    mode: "Blended",
    links: [
      { label: "Course portal", url: "https://learn.seereon.co.in/react-advanced" },
      { label: "Reading list", url: "https://learn.seereon.co.in/react-advanced/reading" },
    ],
    start: "2026-08-03",
    end: "2026-08-05",
    deadline: "2026-08-20",
    durationHours: 16,
    mandatory: true,
    includeInGoals: true,
    skills: ["React", "TypeScript", "Performance"],
    branch: "Bhubaneswar HQ",
    location: "Training Room A, Block 2",
    status: "Ongoing",
    createdBy: "Ritu Bansal",
    createdOn: "2026-07-10",
    materials: ["react-patterns-handbook.pdf"],
  },
  {
    id: "TRG-002",
    title: "POSH Awareness FY26",
    type: "POSH & Compliance",
    description:
      "Annual mandatory awareness programme on prevention of sexual harassment at the workplace.",
    purpose: "Compliance / statutory",
    trainer: "Meera Suresh",
    mode: "Online (self-paced)",
    links: [{ label: "LMS module", url: "https://learn.seereon.co.in/posh-fy26" }],
    start: "2026-07-01",
    end: "2026-07-15",
    deadline: "2026-07-15",
    durationHours: 2,
    mandatory: true,
    includeInGoals: false,
    skills: ["POSH awareness", "Workplace conduct"],
    branch: "All branches",
    location: "Online",
    status: "Completed",
    createdBy: "Farah Khan",
    createdOn: "2026-06-20",
    materials: ["posh-policy-v3.pdf"],
  },
  {
    id: "TRG-003",
    title: "Enterprise Negotiation Lab",
    type: "Sales Enablement",
    description: "Anchoring, framing, objection handling and a recorded role-play assessment.",
    purpose: "Client / project requirement",
    trainer: "Aditya Menon",
    mode: "Classroom",
    links: [{ label: "Playbook", url: "https://learn.seereon.co.in/negotiation" }],
    start: "2026-07-27",
    end: "2026-07-29",
    deadline: "2026-08-05",
    durationHours: 12,
    mandatory: false,
    includeInGoals: true,
    skills: ["Negotiation", "Client communication"],
    branch: "Mumbai",
    location: "Meeting Hub 4",
    status: "Ongoing",
    createdBy: "Kavya Menon",
    createdOn: "2026-07-05",
    materials: [],
  },
  {
    id: "TRG-004",
    title: "SAP CPI Integration Fundamentals",
    type: "Technical Upskilling",
    description:
      "iFlows, adapters, message mapping, error handling and monitoring on SAP Integration Suite.",
    purpose: "Certification",
    trainer: "Subh Sahoo",
    mode: "Online (live)",
    links: [{ label: "SAP Learning Hub", url: "https://learning.sap.com/cpi" }],
    start: "2026-10-06",
    end: "2026-10-17",
    deadline: "2026-10-31",
    durationHours: 24,
    mandatory: false,
    includeInGoals: true,
    skills: ["SAP CPI", "Integration", "Groovy"],
    branch: "Bhubaneswar HQ",
    location: "Online",
    status: "Planned",
    createdBy: "Varen Mishra",
    createdOn: "2026-09-10",
    materials: [],
  },
]);
export const useTrainingCatalog = () => trainingCatalogStore.use();
export function addProgramme(input, by) {
  const id = `TRG-${String(Math.max(0, ...trainingCatalogStore.get().map((t) => Number(t.id.match(/(\d+)$/)?.[1]) || 0)) + 1).padStart(3, "0")}`;
  const row = {
    ...input,
    id,
    createdBy: by.name,
    createdOn: new Date().toISOString().slice(0, 10),
  };
  trainingCatalogStore.set((l) => [row, ...l]);
  return row;
}

/** Assign a programme to employees with the full field set; optionally creates a goal per employee. */
export function assignTraining(input, by) {
  if (!input.empIds.length) return { ok: false, message: "Select at least one employee." };
  if (!input.dueDate) return { ok: false, message: "Deadline is required." };
  if (input.startDate && input.dueDate < input.startDate)
    return { ok: false, message: "The deadline cannot be before the start date." };
  if (input.programme.status === "Cancelled")
    return { ok: false, message: "This programme is cancelled and cannot be assigned." };
  const today = new Date().toISOString().slice(0, 10);
  const p = input.programme;
  const modules = [
    {
      id: "M1",
      title: `${p.title} — introduction`,
      kind: "Video",
      duration: "15 min",
      url: p.links[0]?.url ?? "#",
      done: false,
    },
    {
      id: "M2",
      title: "Core content pack",
      kind: "Document",
      duration: `${Math.max(1, Math.round(p.durationHours * 0.6))} h`,
      url: p.links[1]?.url ?? p.links[0]?.url ?? "#",
      done: false,
    },
    {
      id: "M3",
      title: "Assessment / assignment",
      kind: p.mode === "On-the-job" ? "Assignment" : "Quiz",
      duration: "30 min",
      url: "#",
      done: false,
    },
  ];
  let created = 0;
  let skipped = 0;
  input.empIds.forEach((empId) => {
    const e = findEmployee(empId);
    if (!e) return;
    // Don't assign the same programme twice while an earlier assignment is still open.
    if (
      trainingAssignmentStore
        .get()
        .some((x) => x.empId === e.id && x.trainingId === p.id && x.status !== "Completed")
    ) {
      skipped++;
      return;
    }
    let goalId;
    if (input.includeInGoals) {
      goalId = addGoal({
        title: `Complete training: ${p.title}`,
        description: `${p.description}\nPurpose: ${input.purpose}. Deadline ${input.dueDate}.`,
        level: "Individual",
        ownerId: e.id,
        owner: e.name,
        createdBy: by.name,
        createdByRole:
          by.role === "Manager"
            ? "Manager"
            : by.role === "Admin" || by.role === "SuperAdmin"
              ? "Admin"
              : "HR",
        start: input.startDate || today,
        due: input.dueDate,
        weight: 10,
        target: `Certified · ${p.skills.join(", ") || p.title}`,
        progress: 0,
        status: "Approved",
        rating: "Not Rated",
        managerRemarks: `Auto-created from training assignment (${p.id}).`,
        documents: [],
        milestones: [
          { id: "MS1", title: "Modules completed", due: input.dueDate, done: false },
          { id: "MS2", title: "Assessment passed & certified", due: input.dueDate, done: false },
        ],
      });
    }
    addAssignment({
      trainingId: p.id,
      training: p.title,
      empId: e.id,
      employee: e.name,
      assignedBy: by.name,
      assignedOn: today,
      dueDate: input.dueDate,
      mandatory: input.mandatory,
      status: "Not Started",
      progress: 0,
      score: "",
      evaluation: "",
      submission: "",
      modules,
      purpose: input.purpose,
      description: p.description,
      links: p.links,
      startDate: input.startDate || p.start,
      endDate: p.end,
      mode: p.mode,
      trainer: p.trainer,
      durationHours: p.durationHours,
      skills: p.skills,
      includeInGoals: input.includeInGoals,
      goalId,
    });
    pushAlert({
      empId: e.id,
      kind: "general",
      to: "/emp/training",
      title: `Training assigned: ${p.title}`,
      body: `${input.mandatory ? "Mandatory · " : ""}${p.mode} · ${p.durationHours} h · deadline ${input.dueDate}${input.includeInGoals ? " · added to your goals" : ""}. ${input.note}`.trim(),
    });
    created++;
  });
  if (!created)
    return {
      ok: false,
      message: skipped
        ? `${p.title} is already assigned (and not yet completed) to the selected employee(s).`
        : "No valid employees selected.",
    };
  return {
    ok: true,
    message: `${p.title} assigned to ${created} employee(s)${input.includeInGoals ? " and added to their goals" : ""}${skipped ? ` · ${skipped} skipped (already assigned)` : ""}.`,
  };
}

/** Parameter-based review; certifies and closes the linked goal when the recommendation is "Certify". */
export function submitTrainingReview(id, review, by) {
  const a = trainingAssignmentStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Assignment not found." };
  if (a.empId === by.id) return { ok: false, message: "You cannot review your own training." };
  // Review only what the employee has submitted (a Not Started assignment could be certified outright),
  // and never reopen a certified one — its certificate and closed goal would be left behind.
  if (!["Submitted", "Under Review"].includes(a.status))
    return {
      ok: false,
      message:
        a.status === "Completed"
          ? "This training is already certified and closed."
          : `The employee has not submitted this training yet (${a.status}).`,
    };
  if (Object.values(review.ratings).some((v) => !(v >= 1 && v <= 5)))
    return { ok: false, message: "Rate every parameter from 1 to 5." };
  if (review.progressPct < 0 || review.progressPct > 100)
    return { ok: false, message: "Progress must be between 0 and 100 %." };
  const r = review.ratings;
  const overall = +(
    (r.skills + r.efficiency + r.knowledge + r.participation + r.application) /
    5
  ).toFixed(1);
  const today = new Date().toISOString().slice(0, 10);
  const full = { ...review, reviewedBy: by.name, reviewedOn: today, overall };
  const certify = review.recommendation === "Certify" && review.outcome !== "Not met";
  const certificateRef = certify
    ? (a.certificateRef ??
      `CERT-2026-${String(trainingAssignmentStore.get().filter((x) => x.certificateRef).length + 1).padStart(4, "0")}`)
    : a.certificateRef;
  const status = certify
    ? "Completed"
    : review.recommendation === "Reassign"
      ? "Reassigned"
      : review.recommendation === "Extend deadline"
        ? "In Progress"
        : "Under Review";
  updateAssignment(id, {
    review: full,
    status,
    progress: certify ? 100 : review.progressPct,
    score: `${Math.round((overall / 5) * 100)}%`,
    evaluation: review.comments || review.learnings,
    certificateRef,
    certifiedOn: certify ? today : a.certifiedOn,
    ...(review.recommendation === "Reassign"
      ? { modules: a.modules.map((m) => ({ ...m, done: false })) }
      : {}),
  });
  if (a.goalId)
    goalStore.set((l) =>
      l.map((g) =>
        g.id === a.goalId
          ? {
              ...g,
              progress: certify ? 100 : review.progressPct,
              status: certify ? "Completed" : g.status,
              managerRating: Math.round(overall),
              managerRemarks: `Training review ${today}: ${review.outcome} · ${review.recommendation}`,
              milestones: g.milestones.map((m) => ({ ...m, done: certify })),
            }
          : g,
      ),
    );
  pushAlert({
    empId: a.empId,
    kind: "review",
    to: "/emp/training",
    title: certify ? `Certified: ${a.training}` : `Training review: ${a.training}`,
    body: `${review.outcome} · overall ${overall}/5 · ${review.recommendation}${certify ? ` · certificate ${certificateRef} available on My Trainings` : ""}.`,
  });
  return {
    ok: true,
    message: certify
      ? `Review saved — ${a.employee} certified (${certificateRef}); goal closed.`
      : `Review saved — ${review.recommendation}.`,
  };
}

const PARAM_LABELS = [
  ["skills", "Skills acquired"],
  ["efficiency", "Efficiency / speed of learning"],
  ["knowledge", "Knowledge & understanding"],
  ["participation", "Participation & discipline"],
  ["application", "Application on the job"],
];
export const TRAINING_REVIEW_PARAMS = PARAM_LABELS;

/** Downloadable review report (HR / manager / employee). */
export function renderTrainingReviewPdf(a) {
  const r = a.review;
  if (!r) return false;
  exportReportPdf({
    title: `Training review report — ${a.training}`,
    subtitle: `${a.employee} (${a.empId}) · reviewed by ${r.reviewedBy} on ${r.reviewedOn}`,
    summary: [
      { label: "Outcome", value: r.outcome },
      { label: "Overall", value: `${r.overall} / 5` },
      { label: "Progress", value: `${r.progressPct} %` },
      { label: "Recommendation", value: r.recommendation },
      ...(a.certificateRef ? [{ label: "Certificate", value: a.certificateRef }] : []),
    ],
    columns: ["Item", "Detail"],
    rows: [
      ["Purpose", a.purpose ?? "—"],
      ["Mode / trainer", `${a.mode ?? "—"} · ${a.trainer ?? "—"} · ${a.durationHours ?? "—"} h`],
      ["Timeline", `${a.startDate ?? a.assignedOn} → ${a.dueDate}`],
      ["Skills", (a.skills ?? []).join(", ") || "—"],
      ["Modules", a.modules.map((m) => `${m.title} (${m.done ? "done" : "pending"})`).join("; ")],
      ...PARAM_LABELS.map(([k, label]) => [`Rating — ${label}`, `${r.ratings[k]} / 5`]),
      ["Outcome", r.outcome],
      ["Bottlenecks", r.bottlenecks || "—"],
      ["Learnings", r.learnings || "—"],
      ["Application plan", r.applicationPlan || "—"],
      ["Reviewer comments", r.comments || "—"],
      ["Attachments", r.attachments.join(", ") || "—"],
    ],
  });
  return true;
}

/** Completion certificate. */
export function renderTrainingCertificate(a) {
  if (!a.certificateRef) return false;
  exportLetterPdf({
    title: "Certificate of Completion",
    reference: `${a.certificateRef} · ${a.certifiedOn ?? ""}`,
    bodyHtml: `<div style="text-align:center;padding:24px 8px"><div style="font-size:12px;letter-spacing:4px;color:#64748b">THIS IS TO CERTIFY THAT</div><div style="font-size:28px;font-weight:700;margin:12px 0;color:#0f766e">${a.employee}</div><div style="font-size:12px;color:#64748b">${a.empId}</div><div style="margin:18px 0;font-size:13px">has successfully completed the training programme</div><div style="font-size:20px;font-weight:600">${a.training}</div><div style="font-size:12px;color:#64748b;margin-top:6px">${a.mode ?? ""}${a.durationHours ? ` · ${a.durationHours} hours` : ""}${a.trainer ? ` · Trainer ${a.trainer}` : ""}</div><div style="margin-top:14px;font-size:12px">Overall rating <b>${a.review?.overall ?? "—"} / 5</b> · ${a.review?.outcome ?? ""}</div>${a.skills?.length ? `<div style="margin-top:8px;font-size:11px;color:#64748b">Skills: ${a.skills.join(" · ")}</div>` : ""}<div style="margin-top:22px;font-size:11px;color:#64748b">Certificate no. ${a.certificateRef} · issued ${a.certifiedOn ?? ""} · Seereon Consulting &amp; IT Services Pvt. Ltd.</div></div>`,
    signatory: { name: "Farah Khan", designation: "Chief Human Resources Officer" },
  });
  return true;
}

/* ------------------------------------------------ Getting Started resources */

export const RESOURCE_CATEGORIES = [
  "Product Videos",
  "Documentation",
  "SOPs",
  "FAQs",
  "User Guides",
];
/**
 * @typedef {(typeof RESOURCE_CATEGORIES)[number]} ResourceCategory
 */

/**
 * @typedef {Object} Resource
 * @property {string} id
 * @property {string} title
 * @property {ResourceCategory} category
 * @property {string} description
 * @property {string} format
 * @property {string} duration
 * @property {string} audience
 * @property {string} url
 */

export const resourceStore = createStore([
  {
    id: "RES-001",
    title: "Seereon HRMS in 10 minutes",
    category: "Product Videos",
    description: "A guided walkthrough of the dashboard, people and payroll modules.",
    format: "MP4",
    duration: "10 min",
    audience: "All employees",
    url: "#",
  },
  {
    id: "RES-002",
    title: "Applying for leave",
    category: "Product Videos",
    description: "How to raise, track and cancel a leave application from the employee portal.",
    format: "MP4",
    duration: "4 min",
    audience: "All employees",
    url: "#",
  },
  {
    id: "RES-003",
    title: "Admin configuration handbook",
    category: "Documentation",
    description: "Masters, infrastructure, payroll configuration and approval workflows explained.",
    format: "PDF",
    duration: "68 pages",
    audience: "Org admins",
    url: "#",
  },
  {
    id: "RES-004",
    title: "Monthly payroll run SOP",
    category: "SOPs",
    description: "Step-by-step standard operating procedure for closing payroll each cycle.",
    format: "PDF",
    duration: "9 pages",
    audience: "Finance / HR",
    url: "#",
  },
  {
    id: "RES-005",
    title: "Onboarding a new employee SOP",
    category: "SOPs",
    description: "From offer acceptance to day-one asset handover.",
    format: "PDF",
    duration: "6 pages",
    audience: "HR",
    url: "#",
  },
  {
    id: "RES-006",
    title: "Frequently asked questions",
    category: "FAQs",
    description: "Answers to the 40 most common questions raised with the HR helpdesk.",
    format: "Web",
    duration: "—",
    audience: "All employees",
    url: "#",
  },
  {
    id: "RES-007",
    title: "Manager user guide",
    category: "User Guides",
    description: "Approvals, team analytics, goals, PIPs and timesheet review for managers.",
    format: "PDF",
    duration: "34 pages",
    audience: "Managers",
    url: "#",
  },
  {
    id: "RES-008",
    title: "Employee portal user guide",
    category: "User Guides",
    description: "Everything an employee can do in the portal, screen by screen.",
    format: "PDF",
    duration: "22 pages",
    audience: "All employees",
    url: "#",
  },
]);

export const addResource = (r) =>
  resourceStore.set((p) => [{ ...r, id: nextId("RES", p.length) }, ...p]);

export const useResources = () => resourceStore.use();
