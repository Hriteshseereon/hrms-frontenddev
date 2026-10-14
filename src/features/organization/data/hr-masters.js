// Leave master (with credit rules), holiday calendars (3 types) and insurance plans — configured under Master Data.
import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {Object} LeaveMasterRow
 * @property {string} id
 * @property {string} name
 * @property {string} code
 * @property {number} annual
 * @property {"Quarterly pro-rata" | "Monthly pro-rata" | "Annual upfront" | "On event"} creditFrequency
 * @property {boolean} carryForward
 * @property {number} maxCarry
 * @property {boolean} encashable
 * @property {"Gross" | "Basic"} encashOn
 * @property {boolean} clubbable
 * @property {number} minDays
 * @property {number} maxConsecutive
 * @property {boolean} needsAttachment
 * @property {number} attachmentAfterDays
 * @property {"Manager" | "Manager → HR" | "HOD" | "HOD → HR" | "Manager → HOD → HR"} approvalChain
 * @property {number} validityDays - Days within which the leave must be applied/availed after credit (comp-off).
 * @property {boolean} paid
 * @property {string} applicableTo
 * @property {boolean} active
 */

export const DEFAULT_LEAVE_MASTER = [
  {
    id: "LM-01",
    name: "Casual Leave",
    code: "CL",
    annual: 12,
    creditFrequency: "Quarterly pro-rata",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: true,
    minDays: 0.5,
    maxConsecutive: 3,
    needsAttachment: false,
    attachmentAfterDays: 0,
    approvalChain: "Manager",
    validityDays: 0,
    paid: true,
    applicableTo: "All",
    active: true,
  },
  {
    id: "LM-02",
    name: "Sick Leave",
    code: "SL",
    annual: 10,
    creditFrequency: "Quarterly pro-rata",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: true,
    minDays: 0.5,
    maxConsecutive: 0,
    needsAttachment: true,
    attachmentAfterDays: 2,
    approvalChain: "Manager",
    validityDays: 0,
    paid: true,
    applicableTo: "All",
    active: true,
  },
  {
    id: "LM-03",
    name: "Earned Leave",
    code: "EL",
    annual: 18,
    creditFrequency: "Quarterly pro-rata",
    carryForward: true,
    maxCarry: 30,
    encashable: true,
    encashOn: "Gross",
    clubbable: true,
    minDays: 1,
    maxConsecutive: 0,
    needsAttachment: false,
    attachmentAfterDays: 0,
    approvalChain: "Manager → HR",
    validityDays: 0,
    paid: true,
    applicableTo: "All",
    active: true,
  },
  {
    id: "LM-04",
    name: "Comp Off",
    code: "CO",
    annual: 0,
    creditFrequency: "On event",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: true,
    minDays: 0.5,
    maxConsecutive: 2,
    needsAttachment: false,
    attachmentAfterDays: 0,
    approvalChain: "HOD",
    validityDays: 7,
    paid: true,
    applicableTo: "All",
    active: true,
  },
  {
    id: "LM-05",
    name: "Outdoor Duty",
    code: "OD",
    annual: 0,
    creditFrequency: "On event",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: true,
    minDays: 0.5,
    maxConsecutive: 0,
    needsAttachment: false,
    attachmentAfterDays: 0,
    approvalChain: "Manager",
    validityDays: 0,
    paid: true,
    applicableTo: "All",
    active: true,
  },
  {
    id: "LM-06",
    name: "Travel Leave (on tour)",
    code: "TL",
    annual: 0,
    creditFrequency: "On event",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: true,
    minDays: 1,
    maxConsecutive: 0,
    needsAttachment: true,
    attachmentAfterDays: 0,
    approvalChain: "HOD → HR",
    validityDays: 0,
    paid: true,
    applicableTo: "All",
    active: true,
  },
  {
    id: "LM-07",
    name: "Maternity Leave",
    code: "ML",
    annual: 182,
    creditFrequency: "On event",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: false,
    minDays: 1,
    maxConsecutive: 0,
    needsAttachment: true,
    attachmentAfterDays: 0,
    approvalChain: "HOD → HR",
    validityDays: 0,
    paid: true,
    applicableTo: "Female employees",
    active: true,
  },
  {
    id: "LM-08",
    name: "Paternity Leave",
    code: "PL",
    annual: 15,
    creditFrequency: "On event",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: false,
    minDays: 1,
    maxConsecutive: 0,
    needsAttachment: true,
    attachmentAfterDays: 0,
    approvalChain: "Manager → HR",
    validityDays: 180,
    paid: true,
    applicableTo: "Male employees",
    active: true,
  },
  {
    id: "LM-09",
    name: "Loss of Pay (LOP)",
    code: "LOP",
    annual: 0,
    creditFrequency: "On event",
    carryForward: false,
    maxCarry: 0,
    encashable: false,
    encashOn: "Gross",
    clubbable: true,
    minDays: 0.5,
    maxConsecutive: 0,
    needsAttachment: false,
    attachmentAfterDays: 0,
    approvalChain: "Manager → HR",
    validityDays: 0,
    paid: false,
    applicableTo: "All",
    active: true,
  },
];
export const leaveMasterStore = createPersistentStore(
  "seereon.masters.leave",
  DEFAULT_LEAVE_MASTER,
);
export const useLeaveMaster = () => leaveMasterStore.use();
export const leaveRule = (name) =>
  leaveMasterStore.get().find((r) => r.name === name || r.code === name) ?? null;
export const saveLeaveMasterRow = (r) =>
  leaveMasterStore.set((l) =>
    l.some((x) => x.id === r.id) ? l.map((x) => (x.id === r.id ? r : x)) : [...l, r],
  );

/** Pro-rata credit for a quarter: annual ÷ 4, reduced for joiners mid-quarter. */
export function quarterlyCredit(row, doj, quarterStart) {
  if (row.creditFrequency !== "Quarterly pro-rata")
    return row.creditFrequency === "Monthly pro-rata" ? +(row.annual / 12).toFixed(2) : 0;
  // Parse both as local dates — a bare "YYYY-MM-DD" is UTC midnight, which is the previous day west of UTC and shifted the quarter.
  const q = new Date(`${quarterStart}T00:00:00`);
  const qEnd = new Date(q.getFullYear(), q.getMonth() + 3, 0);
  const j = new Date(`${doj}T00:00:00`);
  if (Number.isNaN(+q) || Number.isNaN(+j)) return 0;
  if (j > qEnd) return 0;
  const start = j > q ? j : q;
  const days = Math.max(0, (+qEnd - +start) / 86400000 + 1);
  const qDays = (+qEnd - +q) / 86400000 + 1;
  return +(((row.annual / 4) * days) / qDays).toFixed(2);
}

/**
 * @typedef {Object} HolidayCalendar
 * @property {string} id
 * @property {string} name
 * @property {"National" | "Regional / State" | "Optional / Restricted"} type
 * @property {number} year
 * @property {string} appliesTo
 * @property {{ date: string, name: string }[]} holidays
 * @property {string} uploadedFile
 * @property {boolean} active
 */
export const DEFAULT_CALENDARS = [
  {
    id: "HC-NAT-2026",
    name: "National holidays 2026",
    type: "National",
    year: 2026,
    appliesTo: "",
    uploadedFile: "national-2026.csv",
    active: true,
    holidays: [
      { date: "2026-01-26", name: "Republic Day" },
      { date: "2026-08-15", name: "Independence Day" },
      { date: "2026-10-02", name: "Gandhi Jayanti" },
      { date: "2026-10-20", name: "Dussehra" },
      { date: "2026-11-08", name: "Diwali" },
      { date: "2026-12-25", name: "Christmas" },
    ],
  },
  {
    id: "HC-OD-2026",
    name: "Odisha regional 2026",
    type: "Regional / State",
    year: 2026,
    appliesTo: "Bhubaneswar HQ",
    uploadedFile: "odisha-2026.csv",
    active: true,
    holidays: [
      { date: "2026-04-01", name: "Utkal Divas" },
      { date: "2026-06-14", name: "Raja Parba" },
      { date: "2026-07-16", name: "Rath Yatra" },
      { date: "2026-09-18", name: "Ganesh Chaturthi" },
      { date: "2026-10-26", name: "Kumar Purnima" },
    ],
  },
  {
    id: "HC-OPT-2026",
    name: "Optional / restricted 2026",
    type: "Optional / Restricted",
    year: 2026,
    appliesTo: "",
    uploadedFile: "optional-2026.csv",
    active: true,
    holidays: [
      { date: "2026-01-14", name: "Makar Sankranti" },
      { date: "2026-03-04", name: "Holi" },
      { date: "2026-03-20", name: "Eid ul-Fitr" },
      { date: "2026-08-26", name: "Janmashtami" },
      { date: "2026-11-24", name: "Guru Nanak Jayanti" },
    ],
  },
];
export const holidayCalendarStore = createPersistentStore(
  "seereon.masters.holiday-calendars",
  DEFAULT_CALENDARS,
);
export const useHolidayCalendars = () => holidayCalendarStore.use();
export const saveHolidayCalendar = (c) =>
  holidayCalendarStore.set((l) =>
    l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [...l, c],
  );
export const holidaysForBranch = (branch) =>
  holidayCalendarStore
    .get()
    .filter(
      (c) =>
        c.active &&
        (!c.appliesTo ||
          c.appliesTo
            .split(",")
            .map((s) => s.trim())
            .includes(branch)),
    )
    .flatMap((c) => c.holidays.map((h) => ({ ...h, type: c.type, calendar: c.name })));

/**
 * @typedef {Object} InsurancePlan
 * @property {string} id
 * @property {string} name
 * @property {"ESI" | "Group mediclaim" | "Group term life" | "Personal accident"} kind
 * @property {string} provider
 * @property {number} sumInsured
 * @property {number} employeePremiumMonthly
 * @property {number} employerPremiumMonthly
 * @property {"Employee" | "Employee + Spouse" | "Family floater" | "Family + Parents"} coverage
 * @property {string} eligibility
 * @property {boolean} active
 */
export const DEFAULT_PLANS = [
  {
    id: "INS-01",
    name: "ESI (statutory)",
    kind: "ESI",
    provider: "ESIC",
    sumInsured: 0,
    employeePremiumMonthly: 0,
    employerPremiumMonthly: 0,
    coverage: "Family floater",
    eligibility: "Gross ≤ ₹21,000",
    active: true,
  },
  {
    id: "INS-02",
    name: "Group Mediclaim — Standard",
    kind: "Group mediclaim",
    provider: "ICICI Lombard",
    sumInsured: 300000,
    employeePremiumMonthly: 0,
    employerPremiumMonthly: 650,
    coverage: "Family floater",
    eligibility: "All salaried above ESI threshold",
    active: true,
  },
  {
    id: "INS-03",
    name: "Group Mediclaim — Managers",
    kind: "Group mediclaim",
    provider: "ICICI Lombard",
    sumInsured: 500000,
    employeePremiumMonthly: 0,
    employerPremiumMonthly: 1100,
    coverage: "Family + Parents",
    eligibility: "Grade M1 and above",
    active: true,
  },
  {
    id: "INS-04",
    name: "Group Term Life",
    kind: "Group term life",
    provider: "HDFC Life",
    sumInsured: 2000000,
    employeePremiumMonthly: 0,
    employerPremiumMonthly: 220,
    coverage: "Employee",
    eligibility: "All salaried",
    active: true,
  },
];
export const insurancePlanStore = createPersistentStore(
  "seereon.masters.insurance-plans",
  DEFAULT_PLANS,
);
export const useInsurancePlans = () => insurancePlanStore.use();
export const saveInsurancePlan = (p) =>
  insurancePlanStore.set((l) =>
    l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p],
  );

/* ------------------------------ Leave policy (Q3 / item 22) ------------------------------ */
/**
 * @typedef {Object} LeavePolicy
 * @property {boolean} allowClubSLCLWithHoliday
 * @property {boolean} allowClubSLCLWithEL
 * @property {boolean} sandwichRule
 * @property {number} elEncashmentMonth
 * @property {number} elEncashMaxDays
 * @property {"Gross" | "Basic"} elEncashBasis
 * @property {string} elEncashComponent
 * @property {number} compOffValidityDays
 * @property {string} updatedBy
 * @property {string} updatedOn
 */
export const leavePolicyStore = createPersistentStore("seereon.masters.leave-policy", {
  allowClubSLCLWithHoliday: true,
  allowClubSLCLWithEL: false,
  sandwichRule: true,
  elEncashmentMonth: 3,
  elEncashMaxDays: 15,
  elEncashBasis: "Gross",
  elEncashComponent: "Leave Encashment (EL)",
  compOffValidityDays: 7,
  updatedBy: "Farah Khan",
  updatedOn: "2026-04-01",
});
export const useLeavePolicy = () => leavePolicyStore.use();
export const saveLeavePolicy = (p, by) =>
  leavePolicyStore.set({ ...p, updatedBy: by, updatedOn: new Date().toISOString().slice(0, 10) });

/** Leave credited to date this FY (Apr–Mar) under the row's credit frequency — quarterly pro-rata per MoM item 20. */
export function creditedToDate(row, doj, today = new Date()) {
  if (row.creditFrequency === "Annual upfront" || row.creditFrequency === "On event")
    return row.annual;
  const fyStart = new Date(today.getFullYear() - (today.getMonth() < 3 ? 1 : 0), 3, 1);
  let total = 0;
  if (row.creditFrequency === "Quarterly pro-rata") {
    // Format the quarter start in local time: `toISOString()` shifts a local midnight to the previous UTC day for any
    // timezone east of UTC (IST), which moved every quarter to "Mar 31 – May 31" and mis-credited the balance.
    for (let q = 0; q < 4; q++) {
      const qs = new Date(fyStart.getFullYear(), 3 + q * 3, 1);
      if (qs > today) break;
      total += quarterlyCredit(
        row,
        doj,
        `${qs.getFullYear()}-${String(qs.getMonth() + 1).padStart(2, "0")}-01`,
      );
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const ms = new Date(fyStart.getFullYear(), 3 + m, 1);
      if (ms > today) break;
      if (new Date(`${doj}T00:00:00`) <= new Date(ms.getFullYear(), ms.getMonth() + 1, 0))
        total += row.annual / 12;
    }
  }
  return Math.min(+total.toFixed(2), row.annual);
}

/** Legacy calendar shape (from/to/type/paid) built from the three Master Data calendars — one source for org & employee views. */
export const holidaysAsLegacy = (branch) =>
  holidayCalendarStore
    .get()
    .filter(
      (c) =>
        c.active &&
        (!branch ||
          !c.appliesTo ||
          c.appliesTo
            .split(",")
            .map((x) => x.trim())
            .includes(branch)),
    )
    .flatMap((c) =>
      c.holidays.map((h, i) => ({
        id: `${c.id}-${i}`,
        name: h.name,
        from: h.date,
        to: h.date,
        type:
          c.type === "National"
            ? "Public"
            : c.type === "Regional / State"
              ? "Festival"
              : "Optional",
        description: `${c.name}${c.appliesTo ? ` · ${c.appliesTo}` : ""}`,
        paid: c.type !== "Optional / Restricted",
      })),
    )
    .sort((a, b) => (a.from < b.from ? -1 : 1));
export const useHolidaysLegacy = (branch) => {
  holidayCalendarStore.use();
  return holidaysAsLegacy(branch);
};
