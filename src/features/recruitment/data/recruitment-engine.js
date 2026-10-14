// -----------------------------------------------------------------------------
// Recruitment engine (UI-only): job posts with JD → applicants from every source → auto / manual shortlisting with
// ATS scores → interview scheduling (dynamic type, online / in-person) → round feedback + assessment scorecard →
// "fit for the job" → finalised candidates → auto-generated, editable offer → send (candidate link).
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { JOB_POSTINGS, SEED_CANDIDATES } from "@/features/recruitment/data/recruitment-data";
import {
  addScorecard,
  createOffer,
  offerStore,
  onOfferDecision,
  sendOffer,
} from "@/features/recruitment/data/onboarding-data";
import {} from "@/features/organization/data/group-data";
import { useScopeMatch } from "@/features/organization/data/tenancy";

/**
 * @typedef {"Applied" | "Shortlisted" | "Interviewing" | "Finalised" | "Offered" | "Onboarding" | "Rejected"} ApplicantStage
 */
export const APPLICANT_STAGES = [
  "Applied",
  "Shortlisted",
  "Interviewing",
  "Finalised",
  "Offered",
  "Onboarding",
];
/**
 * @typedef {"Online" | "In-person"} InterviewMode
 */
/**
 * @typedef {"Scheduled" | "Completed" | "No-show" | "Cancelled"} InterviewStatus
 */
/**
 * @typedef {Object} Interview
 * @property {string} id
 * @property {string} round
 * @property {string} type
 * @property {InterviewMode} mode
 * @property {string} date
 * @property {string} time
 * @property {number} durationMin
 * @property {string} panel
 * @property {string} link
 * @property {string} venue
 * @property {InterviewStatus} status
 * @property {string} scheduledBy
 * @property {string} scheduledOn
 * @property {string} [feedback]
 * @property {"Proceed to next round" | "Fit for the job" | "Reject" | "Hold"} [result]
 * @property {string} [scorecardId]
 * @property {string} [completedOn]
 * @property {string} [completedBy]
 */
/**
 * @typedef {Object} Applicant
 * @property {string} id
 * @property {string} jobId
 * @property {string} jobTitle
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} source
 * @property {string} currentCompany
 * @property {number} experienceYears
 * @property {number} currentCtc
 * @property {number} expectedCtc
 * @property {string[]} skills
 * @property {string} education
 * @property {number} noticeDays
 * @property {string} location
 * @property {string} cvFile
 * @property {string} coverNote
 * @property {string} appliedOn
 * @property {ApplicantStage} stage
 * @property {{ score: number, remarks: string, reasons: string[], ranAt: string }} [ats]
 * @property {{ by: string, how: "Auto" | "Manual", on: string }} [shortlist]
 * @property {Interview[]} interviews
 * @property {string} currentRound
 * @property {string} [finalisedOn]
 * @property {string} [finalisedBy]
 * @property {string} [offerId]
 * @property {string} [rejectedReason]
 * @property {{ at: string, by: string, action: string }[]} history
 */

const today = () => new Date().toISOString().slice(0, 10);
const money = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;
const yrs = (s) => Number(String(s).replace(/[^\d.]/g, "")) || 0;

/* ------------------------------ Job posts (extend the legacy postings with JD + status) ------------------------------ */
/**
 * @typedef {JobPosting & { jdFile?: string, department?: string, grade?: string, status?: "Open" | "On hold" | "Closed", createdOn?: string, createdBy?: string, orgId?: string }} JobPost
 */
export const HQ_ORG = "ORG-SEEREON";
export const jobOrgId = (j) => j?.orgId ?? HQ_ORG;
const JOB_META = {
  "JP-1001": { jdFile: "JD-Senior-Frontend-Engineer.pdf", department: "Engineering", grade: "G5" },
  "JP-1002": { jdFile: "JD-Enterprise-AE.pdf", department: "Sales", grade: "G4" },
  "JP-1003": { jdFile: "JD-Ops-Manager.pdf", department: "Operations", grade: "M1" },
  "JP-1004": { jdFile: "JD-Financial-Analyst.pdf", department: "Finance", grade: "G3" },
};
export const jobPostStore = createPersistentStore(
  "seereon.recruit.jobs",
  JOB_POSTINGS.map((j) => ({
    ...j,
    ...(JOB_META[j.id] ?? { jdFile: "", department: "", grade: "G3" }),
    status: "Open",
    createdOn: "2026-08-01",
    createdBy: "Varen Mishra",
  })),
);
export const useJobPosts = () => jobPostStore.use();
export function addJobPost(input, by) {
  // Highest existing number + 1 — a count-based id could repeat a surviving post's id.
  const id = `JP-${jobPostStore.get().reduce((m, j) => Math.max(m, Number(j.id.replace(/\D/g, "")) || 0), 1000) + 1}`;
  const row = {
    ...input,
    id,
    portalUrl: `https://careers.seereon.co.in/jobs/${id}`,
    status: input.status ?? "Open",
    createdOn: today(),
    createdBy: by.name,
    orgId: input.orgId ?? by.orgId ?? HQ_ORG,
  };
  jobPostStore.set((l) => [row, ...l]);
  return row;
}
export const updateJobPost = (id, patch) =>
  jobPostStore.set((l) => l.map((j) => (j.id === id ? { ...j, ...patch } : j)));

/* ------------------------------------ Applicants ------------------------------------ */
/** Pipeline position of the seeded candidates that already have a scorecard / offer (onboarding-data.ts), so Step 2 → Step 6 agree. */
const SEED_PROGRESS = {
  "CND-001": {
    stage: "Offered",
    offerId: "OFR-2026-014",
    currentRound: "Technical Round 1",
    finalisedOn: "2026-09-08",
    finalisedBy: "Vivek Raman",
    ats: {
      score: 84,
      remarks: "Strong match — recommend shortlisting",
      reasons: [
        "3/3 required skills matched (react, typescript, tailwind)",
        "Experience 6 yrs within 5–9 yrs band",
        "Expected CTC ₹24,00,000 within budget",
      ],
      ranAt: "2026-09-01",
    },
    shortlist: { by: "ATS (Varen Mishra)", how: "Auto", on: "2026-09-01" },
    interviews: [
      {
        id: "INT-001-1",
        round: "Technical Round 1",
        type: "Technical",
        mode: "Online",
        date: "2026-09-08",
        time: "11:00",
        durationMin: 60,
        panel: "Vivek Raman",
        link: "https://meet.google.com/xyz-abcd",
        venue: "",
        status: "Completed",
        scheduledBy: "Varen Mishra",
        scheduledOn: "2026-09-02",
        feedback: "Clear structured thinking; ready for client-facing work.",
        result: "Fit for the job",
        scorecardId: "SC-001",
        completedOn: "2026-09-08",
        completedBy: "Vivek Raman",
      },
    ],
    history: [
      { at: "2026-08-10", by: "LinkedIn", action: "Applied" },
      { at: "2026-09-01", by: "Varen Mishra", action: "Auto-shortlisted · ATS 84" },
      {
        at: "2026-09-02",
        by: "Varen Mishra",
        action: "Technical Round 1 (Technical, Online) scheduled for 2026-09-08 11:00",
      },
      {
        at: "2026-09-08",
        by: "Vivek Raman",
        action: "Fit for the job after Technical Round 1 — finalised",
      },
      {
        at: "2026-09-10",
        by: "Varen Mishra",
        action: "Offer OFR-2026-014 sent by e-mail with candidate link",
      },
    ],
  },
  "CND-004": {
    stage: "Offered",
    offerId: "OFR-2026-015",
    finalisedOn: "2026-09-12",
    finalisedBy: "Kiran Shetty",
    shortlist: { by: "Varen Mishra", how: "Manual", on: "2026-09-03" },
    history: [
      { at: "2026-08-13", by: "Career Portal", action: "Applied" },
      { at: "2026-09-03", by: "Varen Mishra", action: "Shortlisted manually" },
      {
        at: "2026-09-12",
        by: "Kiran Shetty",
        action: "Fit for the job after Managerial — finalised",
      },
      {
        at: "2026-09-14",
        by: "Varen Mishra",
        action: "Offer OFR-2026-015 sent by e-mail with candidate link",
      },
    ],
  },
};

const seedApplicants = () => {
  const base = SEED_CANDIDATES.map((c, i) => ({
    id: c.id,
    jobId: /engineer/i.test(c.position)
      ? "JP-1001"
      : /account|sales/i.test(c.position)
        ? "JP-1002"
        : /ops|operations/i.test(c.position)
          ? "JP-1003"
          : "JP-1004",
    jobTitle: /engineer/i.test(c.position)
      ? "Senior Frontend Engineer"
      : /account|sales/i.test(c.position)
        ? "Enterprise Account Executive"
        : /ops|operations/i.test(c.position)
          ? "Ops Manager"
          : "Financial Analyst",
    name: c.name,
    email: c.email,
    phone: c.phone,
    source: c.source,
    currentCompany: c.currentCompany,
    experienceYears: yrs(c.experience),
    currentCtc: money(c.currentCtc),
    expectedCtc: money(c.expectedCtc),
    skills: c.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    education: c.education,
    noticeDays: [30, 60, 15, 90][i % 4],
    location: ["Bhubaneswar", "Mumbai", "Pune", "Hyderabad"][i % 4],
    cvFile: `${c.name.replace(/\s+/g, "-")}-CV.pdf`,
    coverNote: "",
    appliedOn: `2026-08-${String(10 + i).padStart(2, "0")}`,
    stage: "Applied",
    interviews: [],
    currentRound: "",
    history: [
      { at: `2026-08-${String(10 + i).padStart(2, "0")}`, by: c.source, action: "Applied" },
    ],
    ...SEED_PROGRESS[c.id],
  }));
  const extra = [
    {
      id: "CND-005",
      jobId: "JP-1001",
      jobTitle: "Senior Frontend Engineer",
      name: "Ananya Mohapatra",
      email: "ananya.m@mail.com",
      phone: "+91 94370 22110",
      source: "Career Portal",
      currentCompany: "Mindfire Solutions",
      experienceYears: 6,
      currentCtc: 1650000,
      expectedCtc: 2200000,
      skills: ["React", "TypeScript", "Tailwind", "Node", "GraphQL"],
      education: "B.Tech CSE, KIIT",
      noticeDays: 30,
      location: "Bhubaneswar",
      cvFile: "Ananya-Mohapatra-CV.pdf",
      coverNote: "Led the design-system migration at Mindfire; keen on product work at Seereon.",
      appliedOn: "2026-08-12",
      stage: "Applied",
      interviews: [],
      currentRound: "",
      history: [{ at: "2026-08-12", by: "Career Portal", action: "Applied" }],
    },
    {
      id: "CND-006",
      jobId: "JP-1001",
      jobTitle: "Senior Frontend Engineer",
      name: "Rohan Patnaik",
      email: "rohan.p@mail.com",
      phone: "+91 99370 33221",
      source: "LinkedIn",
      currentCompany: "Infosys",
      experienceYears: 4,
      currentCtc: 1100000,
      expectedCtc: 1600000,
      skills: ["Angular", "TypeScript", "RxJS"],
      education: "B.E. IT, BPUT",
      noticeDays: 90,
      location: "Bhubaneswar",
      cvFile: "Rohan-Patnaik-CV.pdf",
      coverNote: "",
      appliedOn: "2026-08-14",
      stage: "Applied",
      interviews: [],
      currentRound: "",
      history: [{ at: "2026-08-14", by: "LinkedIn", action: "Applied" }],
    },
    {
      id: "CND-007",
      jobId: "JP-1001",
      jobTitle: "Senior Frontend Engineer",
      name: "Priyanka Das",
      email: "priyanka.d@mail.com",
      phone: "+91 98610 44332",
      source: "Referral",
      currentCompany: "Tata Consultancy Services",
      experienceYears: 7,
      currentCtc: 1900000,
      expectedCtc: 2500000,
      skills: ["React", "TypeScript", "Next.js", "Tailwind", "Testing Library"],
      education: "M.Tech, NIT Rourkela",
      noticeDays: 60,
      location: "Pune",
      cvFile: "Priyanka-Das-CV.pdf",
      coverNote: "Referred by Subham Das.",
      appliedOn: "2026-08-15",
      stage: "Applied",
      interviews: [],
      currentRound: "",
      history: [{ at: "2026-08-15", by: "Referral", action: "Applied" }],
    },
    {
      id: "CND-008",
      jobId: "JP-1002",
      jobTitle: "Enterprise Account Executive",
      name: "Vikram Nair",
      email: "vikram.n@mail.com",
      phone: "+91 98200 55443",
      source: "Naukri",
      currentCompany: "Freshworks",
      experienceYears: 6,
      currentCtc: 1500000,
      expectedCtc: 1900000,
      skills: ["B2B SaaS", "Enterprise sales", "Negotiation", "Salesforce"],
      education: "MBA, NMIMS",
      noticeDays: 60,
      location: "Mumbai",
      cvFile: "Vikram-Nair-CV.pdf",
      coverNote: "",
      appliedOn: "2026-08-16",
      stage: "Applied",
      interviews: [],
      currentRound: "",
      history: [{ at: "2026-08-16", by: "Naukri", action: "Applied" }],
    },
  ];
  return [...base, ...extra];
};
export const applicantStore = createPersistentStore("seereon.recruit.applicants", seedApplicants());
export const useApplicants = () => applicantStore.use();
const patch = (id, fn) => applicantStore.set((l) => l.map((a) => (a.id === id ? fn(a) : a)));
const log = (a, by, action) => ({ ...a, history: [...a.history, { at: today(), by, action }] });

/** An applicant already on file for the same job with this e-mail (duplicate applications / referrals). */
export const findDuplicateApplicant = (email, jobId) =>
  applicantStore
    .get()
    .find(
      (a) =>
        a.jobId === jobId &&
        a.email.trim().toLowerCase() === email.trim().toLowerCase() &&
        a.stage !== "Rejected",
    ) ?? null;

export function addApplicant(input, by) {
  const id = `CND-${String(applicantStore.get().reduce((m, a) => Math.max(m, Number(a.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(3, "0")}`;
  const row = {
    ...input,
    id,
    appliedOn: today(),
    stage: "Applied",
    interviews: [],
    currentRound: "",
    history: [{ at: today(), by, action: `Applied via ${input.source}` }],
  };
  applicantStore.set((l) => [row, ...l]);
  return row;
}
export const updateApplicant = (id, p, by) =>
  patch(id, (a) => log({ ...a, ...p }, by, "Profile updated"));

/* ------------------------------------ ATS shortlisting engine ------------------------------------ */
export function atsScore(a, job) {
  const req = job.skills
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const have = a.skills.map((s) => s.toLowerCase());
  const matched = req.filter((r) => have.some((h) => h.includes(r) || r.includes(h)));
  const skillPct = req.length ? matched.length / req.length : 0.5;
  const minE = Number(job.minExp) || 0,
    maxE = Number(job.maxExp) || 99;
  const expFit =
    a.experienceYears >= minE && a.experienceYears <= maxE
      ? 1
      : a.experienceYears < minE
        ? Math.max(0, 1 - (minE - a.experienceYears) / Math.max(minE, 1))
        : Math.max(0.6, 1 - (a.experienceYears - maxE) / 10);
  const minS = Number(job.minSalary) || 0,
    maxS = Number(job.maxSalary) || Infinity;
  const ctcFit =
    a.expectedCtc <= maxS ? 1 : Math.max(0, 1 - (a.expectedCtc - maxS) / Math.max(maxS, 1));
  const noticeFit = a.noticeDays <= 30 ? 1 : a.noticeDays <= 60 ? 0.8 : 0.6;
  const eduFit = /m\.?tech|mba|ca\b|nit|iit|kiit/i.test(a.education) ? 1 : 0.8;
  const sourceFit = a.source === "Referral" ? 1 : 0.9;
  const score = Math.round(
    skillPct * 45 + expFit * 20 + ctcFit * 15 + noticeFit * 10 + eduFit * 5 + sourceFit * 5,
  );
  const reasons = [];
  reasons.push(
    `${matched.length}/${req.length} required skills matched${matched.length ? ` (${matched.join(", ")})` : ""}`,
  );
  reasons.push(
    a.experienceYears >= minE && a.experienceYears <= maxE
      ? `Experience ${a.experienceYears} yrs within ${minE}–${maxE} yrs band`
      : `Experience ${a.experienceYears} yrs outside ${minE}–${maxE} yrs band`,
  );
  reasons.push(
    a.expectedCtc <= maxS
      ? `Expected CTC ₹${a.expectedCtc.toLocaleString("en-IN")} within budget`
      : `Expected CTC ₹${a.expectedCtc.toLocaleString("en-IN")} exceeds the ₹${maxS.toLocaleString("en-IN")} ceiling`,
  );
  if (a.noticeDays <= 30) reasons.push(`Short notice (${a.noticeDays} days)`);
  else reasons.push(`Notice period ${a.noticeDays} days`);
  if (a.source === "Referral") reasons.push("Employee referral");
  if (minS && a.expectedCtc < minS) reasons.push("Expected CTC below band — verify seniority");
  const remarks =
    score >= 80
      ? "Strong match — recommend shortlisting"
      : score >= 65
        ? "Good match — shortlist for screening"
        : score >= 50
          ? "Partial match — consider if pipeline is thin"
          : "Weak match";
  return { score, remarks, reasons, ranAt: today() };
}

/** Runs the ATS across a job's applicants; shortlists everyone at or above the cutoff. */
export function runAutoShortlist(jobId, by, cutoff = 65) {
  const job = jobPostStore.get().find((j) => j.id === jobId);
  if (!job) return { ok: false, message: "Job post not found.", shortlisted: 0, scored: 0 };
  let shortlisted = 0,
    scored = 0;
  applicantStore.set((l) =>
    l.map((a) => {
      if (a.jobId !== jobId) return a;
      const ats = atsScore(a, job);
      scored++;
      if (a.stage === "Applied" && ats.score >= cutoff) {
        shortlisted++;
        return log(
          {
            ...a,
            ats,
            stage: "Shortlisted",
            shortlist: { by: `ATS (${by.name})`, how: "Auto", on: today() },
          },
          by.name,
          `Auto-shortlisted · ATS ${ats.score}`,
        );
      }
      return { ...a, ats };
    }),
  );
  return {
    ok: true,
    message: `ATS scored ${scored} applicant(s) for ${job.title}; ${shortlisted} shortlisted at ≥ ${cutoff}.`,
    shortlisted,
    scored,
  };
}
export function shortlistManually(id, by) {
  const a = applicantStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Candidate not found." };
  if (a.stage !== "Applied")
    return { ok: false, message: `${a.name} is already ${a.stage.toLowerCase()}.` };
  patch(id, (a) =>
    log(
      { ...a, stage: "Shortlisted", shortlist: { by: by.name, how: "Manual", on: today() } },
      by.name,
      "Shortlisted manually",
    ),
  );
  return { ok: true, message: "Shortlisted — schedule the interview from Step 3." };
}
export function rejectApplicant(id, by, reason) {
  patch(id, (a) =>
    log({ ...a, stage: "Rejected", rejectedReason: reason }, by.name, `Rejected — ${reason}`),
  );
  return { ok: true, message: "Candidate rejected; regret e-mail queued." };
}

/* ------------------------------------ Interviews ------------------------------------ */
export function scheduleInterview(id, input, by) {
  if (!input.date || !input.time) return { ok: false, message: "Date and time are required." };
  if (input.mode === "Online" && !input.link.trim())
    return { ok: false, message: "Add the meeting link for an online interview." };
  if (input.mode === "In-person" && !input.venue.trim())
    return { ok: false, message: "Add the venue for an in-person interview." };
  const cur = applicantStore.get().find((x) => x.id === id);
  if (!cur) return { ok: false, message: "Candidate not found." };
  if (cur.stage !== "Shortlisted" && cur.stage !== "Interviewing")
    return {
      ok: false,
      message: `${cur.name} is ${cur.stage.toLowerCase()} — only shortlisted candidates can be interviewed.`,
    };
  if (cur.interviews.some((i) => i.status === "Scheduled"))
    return { ok: false, message: "An interview is already scheduled — record its feedback first." };
  patch(id, (a) => {
    const iv = {
      ...input,
      id: `INT-${a.id.slice(-3)}-${a.interviews.length + 1}`,
      status: "Scheduled",
      scheduledBy: by.name,
      scheduledOn: today(),
    };
    return log(
      { ...a, stage: "Interviewing", currentRound: input.round, interviews: [...a.interviews, iv] },
      by.name,
      `${input.round} (${input.type}, ${input.mode}) scheduled for ${input.date} ${input.time}`,
    );
  });
  return { ok: true, message: `Interview scheduled — invite e-mailed to the candidate and panel.` };
}
export function submitInterviewFeedback(id, interviewId, input, by) {
  if (!input.feedback.trim()) return { ok: false, message: "Write the interview feedback." };
  const a = applicantStore.get().find((x) => x.id === id);
  const iv = a?.interviews.find((x) => x.id === interviewId);
  if (!a || !iv) return { ok: false, message: "Interview not found." };
  // Feedback after an offer / rejection used to drag the applicant back to Finalised or Rejected while the offer lived.
  if (a.stage !== "Interviewing")
    return {
      ok: false,
      message: `${a.name} is already ${a.stage.toLowerCase()} — interview feedback can no longer change the outcome.`,
    };
  if (iv.status !== "Scheduled")
    return { ok: false, message: `Feedback for ${iv.round} was already recorded.` };
  if (input.result === "Proceed to next round" && !input.nextRound)
    return { ok: false, message: "Choose the next round." };
  const card = addScorecard(
    {
      candidateId: a.id,
      candidate: a.name,
      round: iv.round,
      assessor: by.name,
      assessedOn: today(),
      scores: input.scores,
      recommendation: input.recommendation,
      remarks: input.feedback,
    },
    input.params,
  );
  patch(id, (x) => {
    const interviews = x.interviews.map((i) =>
      i.id === interviewId
        ? {
            ...i,
            status: "Completed",
            feedback: input.feedback,
            result: input.result,
            scorecardId: card.id,
            completedOn: today(),
            completedBy: by.name,
          }
        : i,
    );
    if (input.result === "Fit for the job")
      return log(
        { ...x, interviews, stage: "Finalised", finalisedOn: today(), finalisedBy: by.name },
        by.name,
        `Fit for the job after ${iv.round} — finalised`,
      );
    if (input.result === "Reject")
      return log(
        { ...x, interviews, stage: "Rejected", rejectedReason: `Not selected after ${iv.round}` },
        by.name,
        `Rejected after ${iv.round}`,
      );
    return log(
      { ...x, interviews, currentRound: input.nextRound || iv.round },
      by.name,
      `${iv.round} completed — ${input.result}${input.nextRound ? ` (${input.nextRound})` : ""}`,
    );
  });
  return {
    ok: true,
    message:
      input.result === "Fit for the job"
        ? `${a.name} moved to Finalised candidates.`
        : input.result === "Reject"
          ? "Candidate rejected."
          : `Feedback saved — schedule ${input.nextRound || "the next round"}.`,
  };
}

/* ------------------------------------ Offer from a finalised candidate ------------------------------------ */
export function createOfferForApplicant(id, input, by, send) {
  const a = applicantStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Candidate not found." };
  // Only a finalised candidate (or one still interviewing, for a fast-track offer) can receive an offer.
  if (a.stage !== "Finalised" && a.stage !== "Interviewing")
    return {
      ok: false,
      message: `${a.name} is ${a.stage.toLowerCase()} — an offer needs a finalised candidate.`,
    };
  if (
    input.customComponents &&
    input.customComponents.some((c) => !c.label.trim() || c.monthly < 0)
  )
    return { ok: false, message: "Salary components need a name and a non-negative amount." };
  // The edited monthly components are what the candidate signs — they must fit inside the offered CTC.
  if (
    input.customComponents &&
    input.customComponents.reduce((t, c) => t + (Number(c.monthly) || 0), 0) * 12 >
      Number(input.ctc || 0)
  )
    return {
      ok: false,
      message: "The salary components add up to more than the annual CTC — adjust them or the CTC.",
    };
  const { position, ...rest } = input;
  const job = jobPostStore.get().find((j) => j.id === a.jobId);
  const r = createOffer(
    {
      candidateId: a.id,
      candidate: a.name,
      email: a.email,
      phone: a.phone,
      position: position?.trim() || a.jobTitle,
      orgId: jobOrgId(job),
      ...rest,
    },
    by,
  );
  if (!r.ok || !r.id) return r;
  let msg = r.message;
  if (send) {
    const s = sendOffer(r.id, by);
    msg = s.message;
  }
  patch(id, (x) =>
    log(
      {
        ...x,
        stage: "Offered",
        offerId: r.id,
        // A fast-track offer closes any interview still on the calendar (it was left "Scheduled" forever).
        interviews: x.interviews.map((i) =>
          i.status === "Scheduled" ? { ...i, status: "Cancelled" } : i,
        ),
      },
      by.name,
      send ? `Offer ${r.id} sent by e-mail with candidate link` : `Offer ${r.id} drafted`,
    ),
  );
  return { ok: true, message: msg, id: r.id };
}
export const markApplicantOnboarding = (id, by) =>
  patch(id, (a) =>
    a.stage === "Onboarding"
      ? a
      : log({ ...a, stage: "Onboarding" }, by, "Welcome sent — onboarding"),
  );

/** A declined or expired offer returns the applicant from "Offered" to "Rejected" with the reason (was stuck in Offered). */
const closeOffered = (candidateId, outcome, reason) =>
  patch(candidateId, (a) =>
    a.stage === "Offered"
      ? log(
          {
            ...a,
            stage: "Rejected",
            rejectedReason:
              outcome === "Declined"
                ? `Declined the offer${reason ? `: ${reason}` : ""}`
                : "Offer expired",
          },
          "Candidate",
          outcome === "Declined"
            ? `Offer declined${reason ? ` — ${reason}` : ""}`
            : "Offer expired",
        )
      : a,
  );
onOfferDecision(closeOffered);
// The candidate page (public link) does not load this module, so a decision taken there is reconciled on the next load.
if (typeof window !== "undefined") {
  const offered = new Set(
    applicantStore
      .get()
      .filter((a) => a.stage === "Offered")
      .map((a) => a.id),
  );
  offerStore
    .get()
    .filter(
      (o) => offered.has(o.candidateId) && (o.status === "Declined" || o.status === "Expired"),
    )
    .forEach((o) => closeOffered(o.candidateId, o.status, o.declineReason));
}

/* ------------------------------------ Tenant scope ------------------------------------ */
/** Is this entity visible in the current scope (active entity, or every accessible entity in a Super Admin's group view)? */
export function useOrgScopeFilter() {
  const match = useScopeMatch();
  return (entity) => match(entity ?? HQ_ORG);
}
/** Job posts of the entity in scope — recruitment data used to be shared by every entity of every group. */
export function useScopedJobPosts() {
  const all = useJobPosts();
  const inScope = useOrgScopeFilter();
  return all.filter((j) => inScope(j.orgId));
}
/** Applicants whose job post belongs to the entity in scope (applicants without a post fall back to the head office). */
export function useScopedApplicants() {
  const all = useApplicants();
  const jobs = useJobPosts();
  const inScope = useOrgScopeFilter();
  return all.filter((a) => inScope(jobs.find((j) => j.id === a.jobId)?.orgId));
}

export const stageTone = (s) =>
  s === "Finalised" || s === "Offered" || s === "Onboarding"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 text-destructive"
      : s === "Applied"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/40 bg-gold/15 text-gold";
export const ROUNDS = ["HR Screening", "Technical 1", "Technical 2", "Managerial", "HR / Final"];
