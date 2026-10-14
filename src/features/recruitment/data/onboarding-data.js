// -----------------------------------------------------------------------------
// Hiring completion flow (UI-only):
//   Assessment parameters (master) → scorecard per candidate →
//   Offer issued → e-mail with secure candidate URL → candidate accepts on
//   the portal + uploads mandatory documents → HR verifies → welcome e-mail
//   with credentials → employee record + login provisioned.
// Real e-mail / link delivery needs the mail integration; here every step
// produces the exact message and link the production system would send, and
// the candidate portal is a real screen the client can click through.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { hireEmployee, temporaryPassword } from "@/features/recruitment/data/hiring-data";
import { userById } from "@/features/auth/data/auth-session";
import { getOrg } from "@/features/organization/data/group-data";

/* ------------------------ Assessment parameter master ------------------------ */

/**
 * @typedef {Object} AssessmentParam
 * @property {string} id
 * @property {string} name
 * @property {"Technical" | "Behavioural" | "Aptitude" | "Attitude" | "Communication" | "Leadership" | "Domain" | "Culture fit"} group
 * @property {number} weight
 * @property {5 | 10} scale
 * @property {string} description
 * @property {string[]} appliesTo
 * @property {boolean} mandatory
 * @property {boolean} active
 */

export const DEFAULT_ASSESSMENT_PARAMS = [
  {
    id: "AP-01",
    name: "Core technical depth",
    group: "Technical",
    weight: 25,
    scale: 10,
    description: "Hands-on skill in the primary stack (ABAP/CPI/React/Python…)",
    appliesTo: [],
    mandatory: true,
    active: true,
  },
  {
    id: "AP-02",
    name: "Problem solving & design",
    group: "Aptitude",
    weight: 15,
    scale: 10,
    description: "Structured thinking, decomposition, trade-offs",
    appliesTo: [],
    mandatory: true,
    active: true,
  },
  {
    id: "AP-03",
    name: "Communication",
    group: "Communication",
    weight: 10,
    scale: 5,
    description: "Clarity, listening, written articulation",
    appliesTo: [],
    mandatory: true,
    active: true,
  },
  {
    id: "AP-04",
    name: "Behavioural / ownership",
    group: "Behavioural",
    weight: 15,
    scale: 5,
    description: "Accountability, collaboration, response to feedback",
    appliesTo: [],
    mandatory: true,
    active: true,
  },
  {
    id: "AP-05",
    name: "Attitude & learning agility",
    group: "Attitude",
    weight: 10,
    scale: 5,
    description: "Curiosity, coachability, resilience",
    appliesTo: [],
    mandatory: false,
    active: true,
  },
  {
    id: "AP-06",
    name: "Domain / business process",
    group: "Domain",
    weight: 15,
    scale: 10,
    description: "Understanding of the client business process (FI/MM/HR…)",
    appliesTo: ["SAP", "Consulting"],
    mandatory: false,
    active: true,
  },
  {
    id: "AP-07",
    name: "Culture fit",
    group: "Culture fit",
    weight: 5,
    scale: 5,
    description: "Alignment with Seereon values",
    appliesTo: [],
    mandatory: false,
    active: true,
  },
  {
    id: "AP-08",
    name: "Leadership potential",
    group: "Leadership",
    weight: 5,
    scale: 5,
    description: "For lead / manager roles",
    appliesTo: ["Lead", "Manager"],
    mandatory: false,
    active: true,
  },
];

export const assessmentParamStore = createPersistentStore(
  "seereon.masters.assessment-params",
  DEFAULT_ASSESSMENT_PARAMS,
);
export const useAssessmentParams = () => assessmentParamStore.use();
export const saveAssessmentParam = (p) =>
  assessmentParamStore.set((l) =>
    l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p],
  );
export const removeAssessmentParam = (id) =>
  assessmentParamStore.set((l) => l.filter((x) => x.id !== id));

/**
 * @typedef {Object} Scorecard
 * @property {string} id
 * @property {string} candidateId
 * @property {string} candidate
 * @property {string} round
 * @property {string} assessor
 * @property {string} assessedOn
 * @property {{ paramId: string, score: number, note: string }[]} scores
 * @property {number} weightedPct
 * @property {"Proceed" | "Hold" | "Reject" | "Strong hire"} recommendation
 * @property {string} remarks
 */

export const scorecardStore = createPersistentStore("seereon.recruitment.scorecards", [
  {
    id: "SC-001",
    candidateId: "CND-001",
    candidate: "Meera Raghavan",
    round: "Technical Round 1",
    assessor: "Vivek Raman",
    assessedOn: "2026-09-08",
    scores: [
      { paramId: "AP-01", score: 8, note: "Solid React + system design" },
      { paramId: "AP-02", score: 8, note: "" },
      { paramId: "AP-03", score: 4, note: "" },
      { paramId: "AP-04", score: 4, note: "" },
      { paramId: "AP-05", score: 5, note: "" },
      { paramId: "AP-06", score: 7, note: "" },
      { paramId: "AP-07", score: 4, note: "" },
    ],
    weightedPct: 81,
    recommendation: "Strong hire",
    remarks: "Clear structured thinking; ready for client-facing work.",
  },
]);
export const useScorecards = () => scorecardStore.use();

export function weightedScore(scores, params) {
  const used = params.filter((p) => p.active && scores.some((s) => s.paramId === p.id));
  const totalW = used.reduce((s, p) => s + p.weight, 0) || 1;
  return Math.round(
    (used.reduce((s, p) => {
      const sc = scores.find((x) => x.paramId === p.id);
      return s + (sc.score / p.scale) * p.weight;
    }, 0) /
      totalW) *
      100,
  );
}

export function addScorecard(c, params) {
  const row = {
    ...c,
    id: `SC-${String(scorecardStore.get().length + 1).padStart(3, "0")}`,
    weightedPct: weightedScore(c.scores, params),
  };
  scorecardStore.set((l) => [row, ...l]);
  return row;
}

/* ------------------------------ Offer lifecycle ------------------------------ */

/**
 * @typedef {"Draft" | "Sent" | "Viewed" | "Accepted" | "Declined" | "Docs Submitted" | "Verified" | "Welcome Sent" | "Joined" | "Expired"} OfferStatus
 */
export const OFFER_STEPS = [
  "Draft",
  "Sent",
  "Accepted",
  "Docs Submitted",
  "Verified",
  "Welcome Sent",
  "Joined",
];

/**
 * @typedef {Object} RequiredDoc
 * @property {string} key
 * @property {string} label
 * @property {boolean} mandatory
 */
export const REQUIRED_DOCS = [
  { key: "pan", label: "PAN card", mandatory: true },
  { key: "aadhaar", label: "Aadhaar (masked)", mandatory: true },
  { key: "photo", label: "Passport photo", mandatory: true },
  { key: "edu", label: "Highest education certificate", mandatory: true },
  { key: "relieving", label: "Relieving / experience letter (last employer)", mandatory: false },
  { key: "payslip", label: "Last 3 payslips", mandatory: false },
  { key: "bank", label: "Cancelled cheque / bank proof", mandatory: true },
  { key: "address", label: "Address proof", mandatory: true },
  { key: "uan", label: "UAN / PF details (if any)", mandatory: false },
  { key: "form11", label: "EPF Form 11 (signed)", mandatory: true },
];

/**
 * @typedef {Object} UploadedDoc
 * @property {string} key
 * @property {string} fileName
 * @property {number} size
 * @property {string} uploadedAt
 * @property {"Uploaded" | "Verified" | "Rejected"} status
 * @property {string} [note]
 */

/**
 * @typedef {Object} OfferRecord
 * @property {string} id
 * @property {string} candidateId
 * @property {string} candidate
 * @property {string} email
 * @property {string} phone
 * @property {string} position
 * @property {string} department
 * @property {string} grade
 * @property {string} branch
 * @property {number} ctc
 * @property {string} joiningDate
 * @property {string} expiryDate
 * @property {string} templateId
 * @property {string} [orgId] - Entity issuing the offer (tenant scope); seeded offers belong to the head-office entity.
 * @property {string} [letterBody] - HR-edited letter body (overrides the Doc Master template text) and salary structure (overrides the grade's structure).
 * @property {{ label: string, monthly: number }[]} [customComponents]
 * @property {OfferStatus} status
 * @property {string} token
 * @property {string} [sentAt]
 * @property {string} [viewedAt]
 * @property {string} [acceptedAt]
 * @property {string} [signature]
 * @property {string} [declineReason]
 * @property {UploadedDoc[]} docs
 * @property {string} [verifiedBy]
 * @property {string} [verifiedAt]
 * @property {string} [welcomeSentAt]
 * @property {string} [employeeId]
 * @property {string} [workEmail]
 * @property {string} [tempPassword]
 * @property {{ at: string, to: string, subject: string, body: string, kind: "Offer" | "Reminder" | "Welcome" | "Docs query" }[]} emails
 * @property {{ at: string, by: string, action: string }[]} history
 */

const now = () => new Date().toISOString();
const token = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
const PORTAL_BASE = "https://seereon.hrms.seereon.co.in/candidate/";
export const offerUrl = (o) => `${PORTAL_BASE}${o.token}`;

export const offerStore = createPersistentStore("seereon.recruitment.offers.v2", [
  {
    id: "OFR-2026-014",
    candidateId: "CND-001",
    candidate: "Meera Raghavan",
    email: "meera.r@mail.com",
    phone: "+91 98450 11223",
    position: "Senior Frontend Engineer",
    department: "Engineering",
    grade: "G5",
    branch: "Bhubaneswar HQ",
    ctc: 2400000,
    joiningDate: "2026-10-01",
    expiryDate: "2026-09-25",
    templateId: "TPL-OFFER-STD",
    status: "Docs Submitted",
    token: "k3m9x2p7q1w8e5r4",
    sentAt: "2026-09-10T05:30:00.000Z",
    viewedAt: "2026-09-10T09:12:00.000Z",
    acceptedAt: "2026-09-11T04:05:00.000Z",
    signature: "Meera Raghavan",
    docs: [
      {
        key: "pan",
        fileName: "pan-meera.pdf",
        size: 210000,
        uploadedAt: "2026-09-11T04:20:00.000Z",
        status: "Uploaded",
      },
      {
        key: "aadhaar",
        fileName: "aadhaar-masked.pdf",
        size: 340000,
        uploadedAt: "2026-09-11T04:21:00.000Z",
        status: "Uploaded",
      },
      {
        key: "photo",
        fileName: "photo.jpg",
        size: 90000,
        uploadedAt: "2026-09-11T04:21:00.000Z",
        status: "Uploaded",
      },
      {
        key: "edu",
        fileName: "btech-degree.pdf",
        size: 880000,
        uploadedAt: "2026-09-11T04:25:00.000Z",
        status: "Uploaded",
      },
      {
        key: "bank",
        fileName: "cheque.jpg",
        size: 150000,
        uploadedAt: "2026-09-11T04:26:00.000Z",
        status: "Uploaded",
      },
      {
        key: "address",
        fileName: "electricity-bill.pdf",
        size: 120000,
        uploadedAt: "2026-09-11T04:27:00.000Z",
        status: "Uploaded",
      },
      {
        key: "form11",
        fileName: "form11-signed.pdf",
        size: 260000,
        uploadedAt: "2026-09-11T04:30:00.000Z",
        status: "Uploaded",
      },
      {
        key: "relieving",
        fileName: "relieving-tcs.pdf",
        size: 190000,
        uploadedAt: "2026-09-11T04:31:00.000Z",
        status: "Uploaded",
      },
    ],
    emails: [
      {
        at: "2026-09-10T05:30:00.000Z",
        to: "meera.r@mail.com",
        subject: "Offer of employment — Senior Frontend Engineer, Seereon",
        body: "Dear Meera, we are delighted to offer you the position of Senior Frontend Engineer… Review and accept: https://seereon.hrms.seereon.co.in/candidate/k3m9x2p7q1w8e5r4 (valid till 25 Sep 2026).",
        kind: "Offer",
      },
    ],
    history: [
      {
        at: "2026-09-10T05:30:00.000Z",
        by: "Varen Mishra",
        action: "Offer sent by e-mail with candidate link",
      },
      { at: "2026-09-10T09:12:00.000Z", by: "Candidate", action: "Offer viewed" },
      { at: "2026-09-11T04:05:00.000Z", by: "Candidate", action: "Offer accepted (e-signed)" },
      { at: "2026-09-11T04:31:00.000Z", by: "Candidate", action: "8 documents uploaded" },
    ],
  },
  {
    id: "OFR-2026-015",
    candidateId: "CND-004",
    candidate: "Imran Qureshi",
    email: "imran.q@mail.com",
    phone: "+91 98111 40098",
    position: "Ops Manager",
    department: "Operations",
    grade: "M1",
    branch: "Bhubaneswar HQ",
    ctc: 2700000,
    joiningDate: "2026-10-15",
    expiryDate: "2026-09-30",
    templateId: "TPL-OFFER-STD",
    status: "Sent",
    token: "a8s7d6f5g4h3j2k1",
    sentAt: "2026-09-14T06:00:00.000Z",
    docs: [],
    emails: [
      {
        at: "2026-09-14T06:00:00.000Z",
        to: "imran.q@mail.com",
        subject: "Offer of employment — Ops Manager, Seereon",
        body: "Dear Imran, … Review and accept: https://seereon.hrms.seereon.co.in/candidate/a8s7d6f5g4h3j2k1 (valid till 30 Sep 2026).",
        kind: "Offer",
      },
    ],
    history: [
      {
        at: "2026-09-14T06:00:00.000Z",
        by: "Varen Mishra",
        action: "Offer sent by e-mail with candidate link",
      },
    ],
  },
]);
export const useOffers = () => offerStore.use();
export const offerById = (id) => offerStore.get().find((o) => o.id === id) ?? null;
export const offerByToken = (t) => offerStore.get().find((o) => o.token === t) ?? null;
const upd = (id, fn) => offerStore.set((l) => l.map((o) => (o.id === id ? fn(o) : o)));
const log = (o, by, action) => ({ ...o, history: [...o.history, { at: now(), by, action }] });

/**
 * @typedef {Object} R
 * @property {boolean} ok
 * @property {string} message
 * @property {string} [id]
 */

/**
 * Recruitment registers here so a declined / expired offer moves the applicant out of "Offered" (avoids a circular import).
 * @typedef {(candidateId: string, outcome: "Declined" | "Expired", reason?: string) => void} OfferDecisionListener
 */
const decisionListeners = [];
export const onOfferDecision = (fn) => {
  if (!decisionListeners.includes(fn)) decisionListeners.push(fn);
};
const notifyOfferDecision = (candidateId, outcome, reason) =>
  decisionListeners.forEach((f) => f(candidateId, outcome, reason));

export function createOffer(input, by) {
  if (!input.candidate.trim() || !/^\S+@\S+\.\S+$/.test(input.email))
    return { ok: false, message: "Candidate name and a valid e-mail are required." };
  if (!(input.ctc > 0)) return { ok: false, message: "CTC must be greater than zero." };
  if (!input.expiryDate || !input.joiningDate)
    return { ok: false, message: "Offer expiry and joining date are required." };
  // An expiry already in the past made the candidate link unusable the moment it was sent.
  if (input.expiryDate < new Date().toISOString().slice(0, 10))
    return { ok: false, message: "Offer expiry cannot be in the past." };
  if (input.joiningDate < input.expiryDate)
    return { ok: false, message: "Joining date cannot be before the offer expiry." };
  const active = offerStore
    .get()
    .find(
      (o) => o.candidateId === input.candidateId && !["Declined", "Expired"].includes(o.status),
    );
  if (active)
    return {
      ok: false,
      message: `${input.candidate} already has offer ${active.id} (${active.status}).`,
    };
  // Highest existing sequence + 1 (count-based ids can repeat a surviving offer's id).
  const id = `OFR-2026-${String(offerStore.get().reduce((m, o) => Math.max(m, Number(o.id.slice(-3)) || 0), 15) + 1).padStart(3, "0")}`;
  offerStore.set((l) => [
    {
      ...input,
      id,
      status: "Draft",
      token: token(),
      docs: [],
      emails: [],
      history: [
        {
          at: now(),
          by: by.name,
          action: `Offer drafted${input.internalNote ? ` — note: ${input.internalNote}` : ""}`,
        },
      ],
    },
    ...l,
  ]);
  return { ok: true, id, message: `${id} drafted — send it to e-mail the candidate link.` };
}

export function sendOffer(id, by) {
  const o = offerById(id);
  if (!o) return { ok: false, message: "Offer not found." };
  if (o.status !== "Draft" && o.status !== "Sent" && o.status !== "Viewed")
    return { ok: false, message: `Offer already ${o.status.toLowerCase()}.` };
  const kind = o.status === "Draft" ? "Offer" : "Reminder";
  const body = `Dear ${o.candidate.split(" ")[0]},\n\nWe are delighted to offer you the position of ${o.position} (${o.department}, ${o.branch}) at Seereon Consulting & IT Services Pvt. Ltd. with an annual CTC of ₹${o.ctc.toLocaleString("en-IN")} and a proposed joining date of ${o.joiningDate}.\n\nPlease review the offer letter and annexure, accept it and upload the listed documents on your secure candidate page:\n${offerUrl(o)}\n\nThe link is valid until ${o.expiryDate}.\n\nWarm regards,\nPeople Operations · Seereon`;
  upd(id, (x) =>
    log(
      {
        ...x,
        status: "Sent",
        sentAt: x.sentAt ?? now(),
        emails: [
          ...x.emails,
          {
            at: now(),
            to: x.email,
            subject: `${kind === "Reminder" ? "Reminder: " : ""}Offer of employment — ${x.position}, Seereon`,
            body,
            kind,
          },
        ],
      },
      by.name,
      kind === "Offer" ? "Offer sent by e-mail with candidate link" : "Reminder sent",
    ),
  );
  return { ok: true, message: `${kind} e-mailed to ${o.email} with the candidate link.` };
}

/* ---- Candidate-side actions (from the public link) ---- */
export function candidateView(tokenStr) {
  const o = offerByToken(tokenStr);
  if (!o) return;
  if (o.status === "Sent")
    upd(o.id, (x) => log({ ...x, status: "Viewed", viewedAt: now() }, "Candidate", "Offer viewed"));
}
export function candidateDecide(tokenStr, accept, signature, reason = "") {
  const o = offerByToken(tokenStr);
  if (!o) return { ok: false, message: "Link is invalid." };
  // "Valid till <date>" means the whole day — a bare date parses as 00:00 UTC and expired the link a day early.
  if (
    new Date(`${o.expiryDate}T23:59:59Z`) < new Date() &&
    (o.status === "Sent" || o.status === "Viewed")
  ) {
    // Record the lapse so HR sees "Expired" instead of an offer that stays "Sent" forever.
    upd(o.id, (x) =>
      log({ ...x, status: "Expired" }, "System", "Offer link used after expiry — marked expired"),
    );
    notifyOfferDecision(o.candidateId, "Expired");
    return { ok: false, message: "This offer has expired — contact HR." };
  }
  if (!["Sent", "Viewed"].includes(o.status))
    return { ok: false, message: `Offer already ${o.status.toLowerCase()}.` };
  if (accept && signature.trim().toLowerCase() !== o.candidate.trim().toLowerCase())
    return { ok: false, message: "Type your full name exactly as on the offer to e-sign." };
  if (!accept && !reason.trim())
    return { ok: false, message: "Please tell us why you are declining." };
  if (!accept) notifyOfferDecision(o.candidateId, "Declined", reason.trim());
  upd(o.id, (x) =>
    log(
      {
        ...x,
        status: accept ? "Accepted" : "Declined",
        acceptedAt: accept ? now() : undefined,
        signature: accept ? signature.trim() : undefined,
        declineReason: accept ? undefined : reason.trim(),
      },
      "Candidate",
      accept ? "Offer accepted (e-signed)" : `Offer declined: ${reason.trim()}`,
    ),
  );
  return {
    ok: true,
    message: accept
      ? "Offer accepted — please upload your documents."
      : "We have recorded your decision.",
  };
}
export function candidateUpload(tokenStr, key, file) {
  const o = offerByToken(tokenStr);
  if (!o) return { ok: false, message: "Link is invalid." };
  if (o.status !== "Accepted" && o.status !== "Docs Submitted")
    return { ok: false, message: "Accept the offer first." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "Each file must be under 5 MB." };
  upd(o.id, (x) => ({
    ...x,
    docs: [
      ...x.docs.filter((d) => d.key !== key),
      { key, fileName: file.name, size: file.size, uploadedAt: now(), status: "Uploaded" },
    ],
  }));
  return { ok: true, message: `${file.name} uploaded.` };
}
export function candidateSubmitDocs(tokenStr) {
  const o = offerByToken(tokenStr);
  if (!o) return { ok: false, message: "Link is invalid." };
  const missing = REQUIRED_DOCS.filter((d) => d.mandatory && !o.docs.some((u) => u.key === d.key));
  if (missing.length)
    return { ok: false, message: `Missing mandatory: ${missing.map((m) => m.label).join(", ")}.` };
  upd(o.id, (x) =>
    log(
      { ...x, status: "Docs Submitted" },
      "Candidate",
      `${x.docs.length} documents submitted for verification`,
    ),
  );
  return {
    ok: true,
    message: "Documents submitted — HR will verify and send your welcome e-mail.",
  };
}

/* ---- HR-side verification & welcome ---- */
export function reviewDoc(id, key, status, note, by) {
  const o = offerById(id);
  if (!o) return { ok: false, message: "Offer not found." };
  if (status === "Rejected" && !note.trim())
    return { ok: false, message: "Give the candidate a reason." };
  upd(id, (x) =>
    log(
      {
        ...x,
        docs: x.docs.map((d) => (d.key === key ? { ...d, status, note } : d)),
        emails:
          status === "Rejected"
            ? [
                ...x.emails,
                {
                  at: now(),
                  to: x.email,
                  subject: `Document query — ${REQUIRED_DOCS.find((r) => r.key === key)?.label}`,
                  body: `Hi ${x.candidate.split(" ")[0]}, please re-upload: ${note}. ${offerUrl(x)}`,
                  kind: "Docs query",
                },
              ]
            : x.emails,
      },
      by.name,
      `${REQUIRED_DOCS.find((r) => r.key === key)?.label} ${status.toLowerCase()}${note ? ` — ${note}` : ""}`,
    ),
  );
  return { ok: true, message: `${status}.` };
}
export function verifyOffer(id, by) {
  const o = offerById(id);
  if (!o) return { ok: false, message: "Offer not found." };
  if (o.status !== "Docs Submitted")
    return { ok: false, message: "Candidate has not submitted documents yet." };
  const pending = REQUIRED_DOCS.filter(
    (d) => d.mandatory && o.docs.find((u) => u.key === d.key)?.status !== "Verified",
  );
  if (pending.length)
    return {
      ok: false,
      message: `Verify all mandatory documents first: ${pending.map((p) => p.label).join(", ")}.`,
    };
  upd(id, (x) =>
    log(
      { ...x, status: "Verified", verifiedBy: by.name, verifiedAt: now() },
      by.name,
      "Documents verified — ready for welcome e-mail",
    ),
  );
  return { ok: true, message: "Verified. Send the welcome e-mail to provision login." };
}
export function sendWelcome(
  id,
  by,
  managerId,
  role = "Employee",
  employmentType = "Full-time",
  orgId,
) {
  const o = offerById(id);
  if (!o) return { ok: false, message: "Offer not found." };
  if (o.status !== "Verified")
    return {
      ok: false,
      message: "Verify the candidate's documents before sending the welcome e-mail.",
    };
  const [first, ...rest] = o.candidate.trim().split(/\s+/);
  // Provisioned in the organisation of the HR user sending the welcome (was hard-coded to ORG-SEEREON, so an entity's
  // hire landed in another tenant's roster); the offered grade drives the salary structure.
  const hire = hireEmployee({
    firstName: first,
    lastName: rest.join(" "),
    personalEmail: o.email,
    phone: o.phone,
    dob: "",
    gender: "",
    orgId: orgId || o.orgId || by.orgId || "ORG-SEEREON",
    branch: o.branch,
    dept: o.department,
    designation: o.position,
    role,
    employmentType,
    managerId,
    doj: o.joiningDate,
    probationMonths: 6,
    ctc: o.ctc,
    grade: o.grade || undefined,
    // The split the candidate accepted travels with the new-hire record (payroll still derives from the grade).
    customComponents: o.customComponents,
  });
  const pw = temporaryPassword(hire);
  const managerName = userById(managerId)?.name ?? managerId ?? "to be assigned";
  // The hiring company's own name / ID (every client's new hire used to be welcomed to "Seereon", org SRN-001).
  const org = getOrg(hire.orgId);
  const orgName = org?.name ?? "Seereon";
  const body = `Welcome to ${orgName}, ${first}!\n\nYour HRMS account is ready.\nLogin: https://seereon.hrms.seereon.co.in/login\nOrganisation ID: ${org?.code ?? hire.orgId}\nUsername: ${hire.workEmail}\nTemporary password: ${pw} (change it on first sign-in)\n\nJoining date: ${o.joiningDate} · Reporting to: ${managerName}\nPlease complete your profile, read the Employee Handbook and submit your IT declaration in the first week.\n\nPeople Operations · Seereon`;
  upd(id, (x) =>
    log(
      {
        ...x,
        status: "Welcome Sent",
        welcomeSentAt: now(),
        employeeId: hire.id,
        workEmail: hire.workEmail,
        tempPassword: pw,
        emails: [
          ...x.emails,
          {
            at: now(),
            to: x.email,
            subject: `Welcome to ${orgName} — your HRMS login`,
            body,
            kind: "Welcome",
          },
        ],
      },
      by.name,
      `Welcome e-mail sent · employee ${hire.id} provisioned (${hire.workEmail})`,
    ),
  );
  return {
    ok: true,
    message: `Welcome e-mail sent; ${hire.id} created with login ${hire.workEmail}.`,
  };
}
export function markJoined(id, by) {
  const o = offerById(id);
  if (!o) return { ok: false, message: "Offer not found." };
  if (o.status !== "Welcome Sent") return { ok: false, message: "Send the welcome e-mail first." };
  upd(id, (x) =>
    log({ ...x, status: "Joined" }, by.name, "Candidate joined — onboarding complete"),
  );
  return { ok: true, message: "Marked as joined." };
}

export const offerTone = (s) =>
  ["Joined", "Welcome Sent", "Verified", "Accepted"].includes(s)
    ? "border-primary/30 bg-primary/10 text-primary"
    : ["Sent", "Viewed", "Docs Submitted"].includes(s)
      ? "border-gold/40 bg-gold/15 text-gold"
      : ["Declined", "Expired"].includes(s)
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";
export const offerStep = (s) => {
  const i = OFFER_STEPS.indexOf(s);
  return i >= 0 ? i : s === "Viewed" ? 1 : s === "Declined" || s === "Expired" ? 1 : 0;
};
