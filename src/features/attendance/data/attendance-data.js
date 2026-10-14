import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {"P" | "A" | "L"} PalStatus
 */

/**
 * @typedef {Object} AttendanceRow
 * @property {string} empId
 * @property {string} name
 * @property {string} designation
 * @property {string} office
 * @property {string} shift
 * @property {Record<string, PalStatus>} days - ISO date -> PAL status
 */

/** Deterministic pseudo-random so SSR and client agree. */
function pick(seed) {
  const v = (seed * 9301 + 49297) % 233280;
  const r = v / 233280;
  if (r > 0.955) return "A";
  if (r > 0.9) return "L";
  return "P";
}

export const ATTENDANCE_MONTH = "2026-07";

function buildDays(seed) {
  const days = {};
  for (let d = 1; d <= 31; d++) {
    const iso = `${ATTENDANCE_MONTH}-${String(d).padStart(2, "0")}`;
    days[iso] = pick(seed * 31 + d);
  }
  return days;
}

export const ATTENDANCE = [
  {
    empId: "SRN-0142",
    name: "Ananya Sharma",
    designation: "Senior Engineer",
    office: "Bhubaneswar HQ",
    shift: "General Shift",
    days: buildDays(3),
  },
  {
    empId: "SRN-0143",
    name: "Vikram Iyer",
    designation: "Account Executive",
    office: "Mumbai",
    shift: "General Shift",
    days: buildDays(7),
  },
  {
    empId: "SRN-0144",
    name: "Priya Nair",
    designation: "HR Business Partner",
    office: "Bhubaneswar HQ",
    shift: "General Shift",
    days: buildDays(11),
  },
  {
    empId: "SRN-0145",
    name: "Rohit Deshmukh",
    designation: "Financial Analyst",
    office: "Pune",
    shift: "Morning Shift",
    days: buildDays(17),
  },
  {
    empId: "SRN-0146",
    name: "Kavya Menon",
    designation: "Ops Manager",
    office: "Chennai",
    shift: "Night Shift",
    days: buildDays(23),
  },
  {
    empId: "SRN-0147",
    name: "Arjun Kapoor",
    designation: "Staff Engineer",
    office: "Bhubaneswar HQ",
    shift: "General Shift",
    days: buildDays(29),
  },
  {
    empId: "SRN-0148",
    name: "Sneha Rao",
    designation: "Content Lead",
    office: "Mumbai",
    shift: "Morning Shift",
    days: buildDays(37),
  },
  {
    empId: "SRN-0149",
    name: "Manish Patel",
    designation: "Engineering Manager",
    office: "Bhubaneswar HQ",
    shift: "General Shift",
    days: buildDays(41),
  },
];

/**
 * @typedef {Object} Shift
 * @property {string} id
 * @property {string} name
 * @property {string} start
 * @property {string} end
 * @property {boolean} breakEnabled
 * @property {string} breakStart
 * @property {string} breakEnd
 * @property {string} office
 * @property {number} employees
 */

export const SHIFTS = [
  {
    id: "SHF-01",
    name: "General Shift",
    start: "09:30",
    end: "18:30",
    breakEnabled: true,
    breakStart: "13:00",
    breakEnd: "13:45",
    office: "Bhubaneswar HQ",
    employees: 318,
  },
  {
    id: "SHF-02",
    name: "Morning Shift",
    start: "06:00",
    end: "14:00",
    breakEnabled: true,
    breakStart: "10:00",
    breakEnd: "10:30",
    office: "Pune",
    employees: 74,
  },
  {
    id: "SHF-03",
    name: "Night Shift",
    start: "22:00",
    end: "06:00",
    breakEnabled: false,
    breakStart: "",
    breakEnd: "",
    office: "Chennai",
    employees: 42,
  },
];

/**
 * Live shift master (Master Data → Shift management). Shift resolution, work orders and wage workers read this store,
 * so a shift created in Master Data is actually assignable (it used to live in an in-memory list nothing else read).
 */
export const shiftStore = createPersistentStore("seereon.attendance.shifts.v1", SHIFTS);
export const useShifts = () => shiftStore.use();
export const allShifts = () => shiftStore.get();
export function addShift(input) {
  const serial =
    shiftStore.get().reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0) + 1;
  const row = { ...input, id: `SHF-${String(serial).padStart(2, "0")}`, employees: 0 };
  shiftStore.set((p) => [row, ...p]);
  return row;
}

/* ---------------------------------------------------------------------------
 * Work hours: overtime, short hours, half-days and penalty / reward config
 * ------------------------------------------------------------------------- */

/**
 * @typedef {Object} WorkDayRecord
 * @property {string} empId
 * @property {string} name
 * @property {string} designation
 * @property {string} office
 * @property {string} shift
 * @property {string} date
 * @property {string} checkIn
 * @property {string} checkOut
 * @property {number} worked - Hours actually worked (excluding unpaid break).
 * @property {number} required - Contracted hours for the shift.
 * @property {number} breakMins
 * @property {number} lateMins
 * @property {number} earlyOutMins
 * @property {"Full Day" | "Half Day" | "Absent" | "Leave" | "Week Off"} dayType
 * @property {boolean} approvedOt
 */

const WORKDAY_SEEDS = [
  ["SRN-0142", "Ananya Sharma", "Senior Engineer", "Bhubaneswar HQ", "General Shift"],
  ["SRN-0143", "Vikram Iyer", "Account Executive", "Mumbai", "General Shift"],
  ["SRN-0144", "Priya Nair", "HR Business Partner", "Bhubaneswar HQ", "General Shift"],
  ["SRN-0145", "Rohit Deshmukh", "Financial Analyst", "Pune", "Morning Shift"],
  ["SRN-0146", "Kavya Menon", "Ops Manager", "Chennai", "Night Shift"],
  ["SRN-0147", "Arjun Kapoor", "Staff Engineer", "Bhubaneswar HQ", "General Shift"],
  ["SRN-0148", "Sneha Rao", "Content Lead", "Mumbai", "Morning Shift"],
  ["SRN-0149", "Manish Patel", "Engineering Manager", "Bhubaneswar HQ", "General Shift"],
];

function hhmm(baseMin) {
  const h = Math.floor(baseMin / 60) % 24;
  const m = baseMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const WORK_RECORDS = WORKDAY_SEEDS.flatMap(([empId, name, designation, office, shift], si) =>
  Array.from({ length: 10 }, (_, di) => {
    const day = 20 + di;
    const seed = (si * 17 + di * 7) % 23;
    const startBase = shift === "Morning Shift" ? 360 : shift === "Night Shift" ? 1320 : 570;
    const lateMins = seed % 5 === 0 ? 10 + (seed % 25) : 0;
    const checkInMin = startBase + lateMins;
    let worked = 8 + ((seed % 7) - 3) * 0.45;
    let dayType = "Full Day";
    if (seed === 4) {
      dayType = "Absent";
      worked = 0;
    } else if (seed === 9) {
      dayType = "Leave";
      worked = 0;
    } else if (seed === 13) {
      dayType = "Half Day";
      worked = 4.2;
    }
    const breakMins = shift === "Night Shift" ? 0 : 45;
    const outMin = checkInMin + Math.round(worked * 60) + breakMins;
    return {
      empId,
      name,
      designation,
      office,
      shift,
      date: `${ATTENDANCE_MONTH}-${String(day).padStart(2, "0")}`,
      checkIn: worked === 0 ? "—" : hhmm(checkInMin),
      checkOut: worked === 0 ? "—" : hhmm(outMin),
      worked: Number(worked.toFixed(2)),
      required: 8,
      breakMins,
      lateMins,
      earlyOutMins:
        worked > 0 && worked < 8 && dayType === "Full Day" ? Math.round((8 - worked) * 60) : 0,
      dayType,
      approvedOt: worked > 9 && seed % 2 === 0,
    };
  }),
);

/**
 * @typedef {Object} PenaltyRule
 * @property {string} id
 * @property {string} name
 * @property {"Short Hours" | "Late Arrival" | "Half Day" | "Absent" | "Early Exit"} trigger
 * @property {string} threshold
 * @property {"Fixed Amount" | "% of Daily Wage" | "Leave Deduction"} deductionType
 * @property {string} deductionValue
 * @property {number} graceCount
 * @property {string} appliesTo
 * @property {boolean} active
 */

export const PENALTY_RULES = [
  {
    id: "PEN-01",
    name: "Short work hours deduction",
    trigger: "Short Hours",
    threshold: "< 7.5 hrs / day",
    deductionType: "% of Daily Wage",
    deductionValue: "25%",
    graceCount: 2,
    appliesTo: "All offices",
    active: true,
  },
  {
    id: "PEN-02",
    name: "Late arrival penalty",
    trigger: "Late Arrival",
    threshold: "> 15 mins after shift start",
    deductionType: "Fixed Amount",
    deductionValue: "₹\u00A0250",
    graceCount: 3,
    appliesTo: "All offices",
    active: true,
  },
  {
    id: "PEN-03",
    name: "Half-day conversion",
    trigger: "Short Hours",
    threshold: "< 4.5 hrs / day",
    deductionType: "Leave Deduction",
    deductionValue: "0.5 day",
    graceCount: 0,
    appliesTo: "All offices",
    active: true,
  },
  {
    id: "PEN-04",
    name: "Unapproved absence",
    trigger: "Absent",
    threshold: "No approved leave",
    deductionType: "% of Daily Wage",
    deductionValue: "100%",
    graceCount: 0,
    appliesTo: "All offices",
    active: true,
  },
  {
    id: "PEN-05",
    name: "Early exit warning",
    trigger: "Early Exit",
    threshold: "> 30 mins before shift end",
    deductionType: "Fixed Amount",
    deductionValue: "₹\u00A0150",
    graceCount: 4,
    appliesTo: "Bhubaneswar HQ",
    active: false,
  },
];

/**
 * @typedef {Object} OvertimeRule
 * @property {string} id
 * @property {string} name
 * @property {string} appliesAfter
 * @property {"Multiplier of Hourly Rate" | "Fixed Amount / hr" | "Comp Off"} rewardType
 * @property {string} rewardValue
 * @property {boolean} requiresApproval
 * @property {string} monthlyCap
 * @property {boolean} active
 */

export const OVERTIME_RULES = [
  {
    id: "OTR-01",
    name: "Weekday overtime",
    appliesAfter: "> 8.5 hrs / day",
    rewardType: "Multiplier of Hourly Rate",
    rewardValue: "1.5×",
    requiresApproval: true,
    monthlyCap: "30 hrs",
    active: true,
  },
  {
    id: "OTR-02",
    name: "Weekend / holiday overtime",
    appliesAfter: "Any hours on week-off",
    rewardType: "Multiplier of Hourly Rate",
    rewardValue: "2.0×",
    requiresApproval: true,
    monthlyCap: "16 hrs",
    active: true,
  },
  {
    id: "OTR-03",
    name: "Night shift allowance",
    appliesAfter: "Shift starting after 22:00",
    rewardType: "Fixed Amount / hr",
    rewardValue: "₹\u00A0180",
    requiresApproval: false,
    monthlyCap: "No cap",
    active: true,
  },
  {
    id: "OTR-04",
    name: "Comp-off accrual",
    appliesAfter: "> 4 hrs on a week-off",
    rewardType: "Comp Off",
    rewardValue: "0.5 day",
    requiresApproval: true,
    monthlyCap: "2 days",
    active: true,
  },
];

export const HALF_DAY_POLICY = {
  minHoursFullDay: 7.5,
  minHoursHalfDay: 4,
  firstHalfWindow: "09:30 – 13:30",
  secondHalfWindow: "14:15 – 18:30",
  maxPerMonth: 4,
  countsAgainstLeave: true,
};

/**
 * @typedef {Object} HalfDayPolicy
 * @property {number} minHoursFullDay
 * @property {number} minHoursHalfDay
 * @property {string} firstHalfWindow
 * @property {string} secondHalfWindow
 * @property {number} maxPerMonth
 * @property {boolean} countsAgainstLeave
 */

/** Persisted penalty / overtime rules and half-day policy (Master Data → Attendance & time). "Save" used to only toast. */
export const penaltyRuleStore = createPersistentStore(
  "seereon.attendance.penalty-rules.v1",
  PENALTY_RULES,
);
export const overtimeRuleStore = createPersistentStore(
  "seereon.attendance.overtime-rules.v1",
  OVERTIME_RULES,
);
export const halfDayPolicyStore = createPersistentStore(
  "seereon.attendance.halfday-policy.v1",
  HALF_DAY_POLICY,
);
