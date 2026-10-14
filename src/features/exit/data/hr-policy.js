// -----------------------------------------------------------------------------
// HR policy parameters, automated notifications and retirement handling.
//
// MoM items covered here:
//   • Retirement age is a configurable parameter; an automatic notification
//     fires when the retirement date is within the configured lead time.
//   • Retire-and-rehire: on retirement the employment closes and a new
//     contract engagement can start (re-hire on contract, history preserved).
//   • Automated notifications for birthdays, work anniversaries, retirement
//     and the probation-completion trigger e-mail to the HOD.
// Outbound e-mail needs a real mail integration; here every trigger lands in a
// notification outbox with a simulated "Sent" status so HR can see exactly
// what would go out, to whom, and why.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { useNewHires, hireEmployee } from "@/features/recruitment/data/hiring-data";
import {
  allPeople,
  upcomingAnniversaries,
  upcomingBirthdays,
  upcomingRetirements,
} from "@/features/communications/data/notifications-data";
import { useProbationStatuses } from "@/features/employees/data/probation-data";
import {
  findEmployee,
  getEmployeeProfile,
  updateEmployeeRecord,
} from "@/features/employees/data/employee-directory";
import { userById } from "@/features/auth/data/auth-session";

/* ------------------------------ Policy ---------------------------------- */

/**
 * @typedef {Object} HrPolicy
 * @property {number} retirementAge
 * @property {number} retirementNoticeDays
 * @property {number} probationReminderDays
 * @property {number} birthdayNoticeDays
 * @property {number} anniversaryNoticeDays
 * @property {number} contractExtensionMonths
 * @property {("Email" | "In-app" | "WhatsApp")[]} notifyChannels
 * @property {string} updatedOn
 * @property {string} updatedBy
 */

export const DEFAULT_HR_POLICY = {
  retirementAge: 58,
  retirementNoticeDays: 180,
  probationReminderDays: 15,
  birthdayNoticeDays: 7,
  anniversaryNoticeDays: 7,
  contractExtensionMonths: 12,
  notifyChannels: ["Email", "In-app"],
  updatedOn: "2026-04-01",
  updatedBy: "Varen Mishra",
};

export const hrPolicyStore = createPersistentStore("seereon.hr.policy", DEFAULT_HR_POLICY);
export const useHrPolicy = () => hrPolicyStore.use();
export const getHrPolicy = () => hrPolicyStore.get();
export const saveHrPolicy = (p, by) =>
  hrPolicyStore.set({ ...p, updatedOn: new Date().toISOString().slice(0, 10), updatedBy: by });

/* --------------------------- Notification outbox --------------------------- */

/**
 * @typedef {| "Birthday" | "Work anniversary" | "Retirement approaching" | "Probation ending (HOD)" | "Retirement processed"} NotificationKind
 */

/**
 * @typedef {Object} OutboxEntry
 * @property {string} id
 * @property {NotificationKind} kind
 * @property {string} to
 * @property {string} toEmail
 * @property {string} subject
 * @property {string} body
 * @property {string} triggerDate
 * @property {string} dueOn
 * @property {string} channel
 * @property {"Scheduled" | "Sent"} status
 * @property {string} [sentOn]
 * @property {string} empId
 * @property {string} orgId
 */

// Local calendar date (not `toISOString`, which shifts a local midnight to the previous UTC day in IST).
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (date, days) => {
  const [y, m, dd] = date.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, dd || 1); // local-time parse of "YYYY-MM-DD"
  d.setDate(d.getDate() + days);
  return iso(d);
};
const today = () => iso(new Date());

const emailOf = (id) => userById(id)?.email ?? findEmployee(id)?.email ?? "";

/** Everything the automation would send for the org, computed from policy + live data. */
export function computeOutbox(orgId, hires, probations, policy = getHrPolicy()) {
  const people = allPeople(hires, orgId);
  const chan = policy.notifyChannels.join(" + ");
  const out = [];
  const hrLead = people.find(
    (p) => userById(p.id)?.role === "HR" || userById(p.id)?.role === "CHRO",
  );
  upcomingBirthdays(people, policy.birthdayNoticeDays).forEach((b) =>
    out.push({
      id: `NTF-BD-${b.id}`,
      kind: "Birthday",
      to: "All employees",
      toEmail: `everyone@${emailOf(b.id).split("@")[1] || "seereon.co.in"}`,
      subject: `🎂 ${b.name}'s birthday on ${b.date}`,
      body: `Join us in wishing ${b.name} (${b.dept}) a very happy birthday.`,
      triggerDate: b.date,
      dueOn: b.date,
      channel: chan,
      status: b.daysAway === 0 ? "Sent" : "Scheduled",
      sentOn: b.daysAway === 0 ? today() : undefined,
      empId: b.id,
      orgId,
    }),
  );
  upcomingAnniversaries(people, policy.anniversaryNoticeDays).forEach((a) =>
    out.push({
      id: `NTF-WA-${a.id}`,
      kind: "Work anniversary",
      to: a.name,
      toEmail: emailOf(a.id),
      subject: `🎉 ${a.years} year${a.years === 1 ? "" : "s"} with Seereon`,
      body: `Congratulations ${a.name} on completing ${a.years} year${a.years === 1 ? "" : "s"} with us on ${a.date}.`,
      triggerDate: a.date,
      dueOn: a.date,
      channel: chan,
      status: a.daysAway === 0 ? "Sent" : "Scheduled",
      sentOn: a.daysAway === 0 ? today() : undefined,
      empId: a.id,
      orgId,
    }),
  );
  upcomingRetirements(people, policy.retirementAge, policy.retirementNoticeDays).forEach((r) => {
    const due = shift(r.retirementDate, -policy.retirementNoticeDays);
    out.push({
      id: `NTF-RT-${r.id}`,
      kind: "Retirement approaching",
      to: `${r.name}; HR (${hrLead?.name ?? "HR"})`,
      toEmail: `${emailOf(r.id)}; ${hrLead ? emailOf(hrLead.id) : ""}`,
      subject: `Retirement due on ${r.retirementDate} — ${r.name}`,
      body: `${r.name} (${r.dept}) reaches the retirement age of ${policy.retirementAge} on ${r.retirementDate}. Please initiate the retirement / contract re-engagement decision.`,
      triggerDate: r.retirementDate,
      dueOn: due,
      channel: chan,
      status: due <= today() ? "Sent" : "Scheduled",
      sentOn: due <= today() ? due : undefined,
      empId: r.id,
      orgId,
    });
  });
  probations
    .filter(
      (p) =>
        p.orgId === orgId &&
        p.daysRemaining >= 0 &&
        p.daysRemaining <= policy.probationReminderDays,
    )
    .forEach((p) => {
      const due = shift(p.probationEndDate, -policy.probationReminderDays);
      out.push({
        id: `NTF-PB-${p.employeeId}`,
        kind: "Probation ending (HOD)",
        to: p.hodName || "Head of Department",
        toEmail: p.hodId ? emailOf(p.hodId) : "",
        subject: `Probation review due — ${p.name} (${p.probationEndDate})`,
        body: `${p.name}'s ${p.probationMonths}-month probation ends on ${p.probationEndDate}. Please complete the probation review (confirm / extend / do not confirm) before the end date.`,
        triggerDate: p.probationEndDate,
        dueOn: due,
        channel: chan,
        status: due <= today() ? "Sent" : "Scheduled",
        sentOn: due <= today() ? due : undefined,
        empId: p.employeeId,
        orgId,
      });
    });
  return out.sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
}

export function useOutbox(orgId) {
  const hires = useNewHires();
  const probations = useProbationStatuses(orgId);
  const policy = useHrPolicy();
  const retirements = useRetirements();
  return [
    ...computeOutbox(orgId, hires, probations, policy),
    ...retirements
      .filter((r) => r.orgId === orgId)
      .map((r) => ({
        id: `NTF-RD-${r.empId}`,
        kind: "Retirement processed",
        to: r.name,
        toEmail: emailOf(r.empId),
        subject: `Retirement confirmed — ${r.retiredOn}`,
        body: r.contractHireId
          ? `Your employment with the organisation closes on ${r.retiredOn}. A new ${r.contractMonths}-month contract engagement starts on ${r.contractFrom} (record ${r.contractHireId}).`
          : `Your employment closes on ${r.retiredOn}. Thank you for your service.`,
        triggerDate: r.retiredOn,
        dueOn: r.processedOn,
        channel: policy.notifyChannels.join(" + "),
        status: "Sent",
        sentOn: r.processedOn,
        empId: r.empId,
        orgId: r.orgId,
      })),
  ];
}

/* ------------------------------ Retirement -------------------------------- */

/**
 * @typedef {Object} RetirementRecord
 * @property {string} empId
 * @property {string} name
 * @property {string} orgId
 * @property {string} retiredOn
 * @property {string} processedOn
 * @property {string} processedBy
 * @property {"Superannuation" | "Voluntary retirement" | "Medical"} reason
 * @property {boolean} reEngaged
 * @property {string} [contractHireId]
 * @property {string} [contractFrom]
 * @property {number} [contractMonths]
 * @property {number} [contractCtc]
 * @property {string} note
 */

export const retirementStore = createPersistentStore("seereon.hr.retirements", []);
export const useRetirements = () => retirementStore.use();
export const isRetired = (empId) => retirementStore.get().some((r) => r.empId === empId);

/**
 * @typedef {PersonBase & { age: number, retirementDate: string, daysAway: number, flagged: boolean, retired: boolean }} RetirementCandidate
 */

/** Every employee with their computed retirement date; flagged when inside the notice window. */
export function retirementCandidates(orgId, hires, policy = getHrPolicy()) {
  const now = new Date();
  return allPeople(hires, orgId)
    .map((p) => {
      const b = new Date(p.dob);
      const rd = new Date(b.getFullYear() + policy.retirementAge, b.getMonth(), b.getDate());
      const daysAway = Math.round((+rd - +now) / 86_400_000);
      const age =
        now.getFullYear() -
        b.getFullYear() -
        (now < new Date(now.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
      return {
        ...p,
        age,
        retirementDate: iso(rd),
        daysAway,
        flagged: daysAway <= policy.retirementNoticeDays,
        retired: isRetired(p.id),
      };
    })
    .sort((a, b) => a.daysAway - b.daysAway);
}

export function useRetirementCandidates(orgId) {
  const hires = useNewHires();
  const policy = useHrPolicy();
  useRetirements();
  return retirementCandidates(orgId, hires, policy);
}

/**
 * Retire an employee. With `reEngage`, a new contract-type hire is created with
 * the retiree's identity linked (rehireOfId) so history, group joining date and
 * PF/UAN continuity are preserved while the employment record is new.
 */
export function retireEmployee(input) {
  const emp = findEmployee(input.empId);
  if (!emp) return { ok: false, message: "Employee not found." };
  if (isRetired(input.empId)) return { ok: false, message: `${emp.name} is already retired.` };
  if (!input.retiredOn) return { ok: false, message: "Retirement date is required." };
  let contractHireId, contractFrom;
  if (input.reEngage) {
    const months = input.contractMonths ?? getHrPolicy().contractExtensionMonths;
    if (!(months > 0)) return { ok: false, message: "Contract length must be at least 1 month." };
    if (!(input.contractCtc && input.contractCtc > 0))
      return { ok: false, message: "Enter the contract CTC." };
    contractFrom = shift(input.retiredOn, 1);
    const [first, ...rest] = emp.name.split(" ");
    const profile = getEmployeeProfile(emp.id);
    const u = userById(emp.id);
    const row = hireEmployee({
      firstName: first,
      lastName: rest.join(" ") || "—",
      personalEmail: profile.personal.personalEmail,
      phone: emp.phone,
      dob: profile.personal.dob,
      gender: profile.personal.gender,
      orgId: emp.orgId,
      branch: emp.branch,
      dept: emp.dept,
      designation: `${emp.role} (Contract)`,
      role: u?.role ?? "Employee",
      employmentType: "Contract",
      managerId: u?.managerId ?? null,
      doj: contractFrom,
      probationMonths: 0,
      ctc: input.contractCtc,
      workEmail: emp.email,
      rehireOfId: emp.id,
    });
    contractHireId = row.id;
  }
  retirementStore.set((p) => [
    {
      empId: emp.id,
      name: emp.name,
      orgId: emp.orgId,
      retiredOn: input.retiredOn,
      processedOn: today(),
      processedBy: input.by.name,
      reason: input.reason,
      reEngaged: input.reEngage,
      contractHireId,
      contractFrom,
      contractMonths: input.reEngage
        ? (input.contractMonths ?? getHrPolicy().contractExtensionMonths)
        : undefined,
      contractCtc: input.contractCtc,
      note: input.note,
    },
    ...p,
  ]);
  updateEmployeeRecord(input.empId, { status: "Retired" });
  return {
    ok: true,
    message: input.reEngage
      ? `${emp.name} retired on ${input.retiredOn}; contract engagement ${contractHireId} starts ${contractFrom}.`
      : `${emp.name} retired on ${input.retiredOn}.`,
  };
}
