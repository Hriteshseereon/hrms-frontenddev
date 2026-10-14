// Legacy candidate API kept for the pipeline board, dashboards and offers — now a thin view over recruitment-engine.ts
// so every recruitment screen reads the same applicants.
import { useMemo } from "react";
import {
  applicantStore,
  useScopedApplicants,
  addApplicant,
  shortlistManually,
} from "@/features/recruitment/data/recruitment-engine";
import { getCurrentUser } from "@/features/auth/data/auth-session";
import { useOffers } from "@/features/recruitment/data/onboarding-data";

/**
 * @typedef {Object} ConvertedEmployee
 * @property {string} empId
 * @property {string} name
 * @property {string} position
 * @property {string} joinedFrom
 */

const toCandidate = (a) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  phone: a.phone,
  jobType: "Full Time",
  source: a.source,
  position: a.jobTitle,
  currentCompany: a.currentCompany,
  experience: `${a.experienceYears} yrs`,
  currentCtc: `₹\u00A0${a.currentCtc.toLocaleString("en-IN")}`,
  expectedCtc: `₹\u00A0${a.expectedCtc.toLocaleString("en-IN")}`,
  skills: a.skills.join(", "),
  education: a.education,
  stage: a.stage,
});

export function useCandidates() {
  // Scoped to the entity in view — every entity used to see (and move) every other entity's applicants.
  const rows = useScopedApplicants();
  return useMemo(() => rows.filter((a) => a.stage !== "Rejected").map(toCandidate), [rows]);
}
export function useHires() {
  const rows = useScopedApplicants();
  const offers = useOffers();
  // The employee id is the one provisioned by the welcome e-mail (hiring-data), not a made-up "SRN-2xx".
  return useMemo(
    () =>
      rows
        .filter((a) => a.stage === "Onboarding")
        .map((a) => ({
          empId:
            offers.find((o) => o.id === a.offerId || o.candidateId === a.id)?.employeeId ??
            "Pending welcome e-mail",
          name: a.name,
          position: a.jobTitle,
          joinedFrom: a.id,
        })),
    [rows, offers],
  );
}
export function addCandidate(c) {
  const row = addApplicant(
    {
      jobId: "",
      jobTitle: c.position,
      name: c.name,
      email: c.email,
      phone: c.phone,
      source: c.source,
      currentCompany: c.currentCompany,
      experienceYears: Number(String(c.experience).replace(/[^\d.]/g, "")) || 0,
      currentCtc: Number(String(c.currentCtc).replace(/[^\d]/g, "")) || 0,
      expectedCtc: Number(String(c.expectedCtc).replace(/[^\d]/g, "")) || 0,
      skills: c.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      education: c.education,
      noticeDays: 30,
      location: "",
      cvFile: "",
      coverNote: "",
    },
    getCurrentUser().name,
  );
  return row.id;
}
/**
 * Moves an applicant along the pipeline board (kept for the Kanban view). Only the screening step (Applied ⇄ Shortlisted)
 * can be moved by hand: the later stages are produced by their own step — interview feedback finalises, the offer
 * composer makes "Offered", the welcome e-mail makes "Onboarding". Free moves used to create "Offered" candidates without
 * an offer and "Onboarding" candidates without an employee record.
 */
export function moveCandidate(id, stage) {
  const me = getCurrentUser();
  const a = applicantStore.get().find((x) => x.id === id);
  if (!a) return { ok: false, message: "Candidate not found." };
  if (a.stage === "Applied" && stage === "Shortlisted") return shortlistManually(id, me);
  if (a.stage === "Shortlisted" && stage === "Applied") {
    applicantStore.set((l) =>
      l.map((x) =>
        x.id === id
          ? {
              ...x,
              stage: "Applied",
              shortlist: undefined,
              history: [
                ...x.history,
                {
                  at: new Date().toISOString().slice(0, 10),
                  by: me.name,
                  action: "Moved back to Applied",
                },
              ],
            }
          : x,
      ),
    );
    return { ok: true, message: `${a.name} moved back to Applied.` };
  }
  const where = {
    Interviewing: "Schedule the interview from Step 3",
    Finalised: 'Record "Fit for the job" feedback in Step 3',
    Offered: "Create the offer from Step 3 · Finalised",
    Onboarding: "Send the welcome e-mail from Step 4 · Offers",
  };
  return {
    ok: false,
    message: `${where[stage] ?? "This move is done from its own step"} — the board only moves candidates between Applied and Shortlisted.`,
  };
}
