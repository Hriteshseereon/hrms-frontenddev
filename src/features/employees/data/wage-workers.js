// Daily-wage / monthly-wage workers (contract labour, site crews, support staff) and their attendance —
// attendance only: no salary or rate is shown in this module; payable days flow to the wage register in payroll.
import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {Object} WageWorker
 * @property {string} id
 * @property {string} name
 * @property {"Daily wage" | "Monthly wage"} wageType
 * @property {string} trade
 * @property {string} contractor
 * @property {string | null} workOrderId
 * @property {string} site
 * @property {string} shiftId
 * @property {string} phone
 * @property {string} idProof
 * @property {string} joinedOn
 * @property {"Active" | "Inactive"} status
 * @property {string} orgId
 */
/**
 * @typedef {"P" | "A" | "H" | "WO" | "PH"} WageMark
 */
export const WAGE_MARKS = [
  { key: "P", label: "Present" },
  { key: "H", label: "Half day" },
  { key: "A", label: "Absent" },
  { key: "WO", label: "Weekly off" },
  { key: "PH", label: "Paid holiday" },
];
/**
 * @typedef {Object} WageAttendance
 * @property {string} workerId
 * @property {string} date
 * @property {WageMark} mark
 * @property {string} inAt
 * @property {string} outAt
 * @property {number} otHours
 * @property {string} markedBy
 * @property {string} note
 */

export const WAGE_TRADES = [
  "Housekeeping",
  "Security guard",
  "Driver",
  "Electrician",
  "Site technician",
  "Helper / loader",
  "Cafeteria",
  "Office boy",
  "Data-entry operator",
  "Field surveyor",
];

const WAGE_WORKERS_SEED = [
  {
    id: "WW-001",
    name: "Bijay Sahu",
    wageType: "Daily wage",
    trade: "Housekeeping",
    contractor: "Utkal Facility Services",
    workOrderId: null,
    site: "Bhubaneswar HQ",
    shiftId: "SHF-01",
    phone: "+91 94370 11201",
    idProof: "Aadhaar ****4412",
    joinedOn: "2025-04-01",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "WW-002",
    name: "Santosh Behera",
    wageType: "Daily wage",
    trade: "Security guard",
    contractor: "Shield Secure Pvt. Ltd.",
    workOrderId: null,
    site: "Bhubaneswar HQ",
    shiftId: "SHF-03",
    phone: "+91 94370 11202",
    idProof: "Aadhaar ****7781",
    joinedOn: "2025-06-15",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "WW-003",
    name: "Rina Pradhan",
    wageType: "Monthly wage",
    trade: "Cafeteria",
    contractor: "Direct",
    workOrderId: null,
    site: "Bhubaneswar HQ",
    shiftId: "SHF-01",
    phone: "+91 94370 11203",
    idProof: "Aadhaar ****3390",
    joinedOn: "2024-11-01",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "WW-004",
    name: "Prakash Nayak",
    wageType: "Monthly wage",
    trade: "Driver",
    contractor: "Direct",
    workOrderId: null,
    site: "Bhubaneswar HQ",
    shiftId: "SHF-01",
    phone: "+91 94370 11204",
    idProof: "DL OD-02-2019-0041",
    joinedOn: "2023-08-01",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "WW-005",
    name: "Manas Jena",
    wageType: "Daily wage",
    trade: "Electrician",
    contractor: "Utkal Facility Services",
    workOrderId: null,
    site: "Bhubaneswar HQ",
    shiftId: "SHF-01",
    phone: "+91 94370 11205",
    idProof: "Aadhaar ****9012",
    joinedOn: "2026-01-10",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "WW-006",
    name: "Sunita Das",
    wageType: "Daily wage",
    trade: "Data-entry operator",
    contractor: "Direct",
    workOrderId: null,
    site: "Bhubaneswar HQ",
    shiftId: "SHF-01",
    phone: "+91 94370 11206",
    idProof: "Aadhaar ****5567",
    joinedOn: "2026-03-02",
    status: "Active",
    orgId: "ORG-SEEREON",
  },
  {
    id: "WW-007",
    name: "Ramesh Kumar",
    wageType: "Daily wage",
    trade: "Site technician",
    contractor: "SkyBridge Labour",
    workOrderId: "WO-001",
    site: "Seereon SAP Practice, Rajasthan",
    shiftId: "SHF-01",
    phone: "+91 94140 33101",
    idProof: "Aadhaar ****2201",
    joinedOn: "2026-02-01",
    status: "Active",
    orgId: "ORG-1042",
  },
  {
    id: "WW-008",
    name: "Deepak Mahto",
    wageType: "Daily wage",
    trade: "Helper / loader",
    contractor: "SkyBridge Labour",
    workOrderId: "WO-002",
    site: "Seereon Cloud Services, Jharkhand",
    shiftId: "SHF-03",
    phone: "+91 96540 22110",
    idProof: "Aadhaar ****8834",
    joinedOn: "2026-02-20",
    status: "Active",
    orgId: "ORG-1043",
  },
];
export const wageWorkerStore = createPersistentStore("seereon.wage.workers.v1", WAGE_WORKERS_SEED);
export const useWageWorkers = () => wageWorkerStore.use();
export function addWageWorker(input) {
  // Highest serial + 1 (length + 1 collides once the persisted roster and the seed diverge).
  const serial =
    wageWorkerStore.get().reduce((m, w) => Math.max(m, Number(w.id.replace(/\D/g, "")) || 0), 0) +
    1;
  const row = { ...input, name: input.name.trim(), id: `WW-${String(serial).padStart(3, "0")}` };
  wageWorkerStore.set((l) => [row, ...l]);
  return row;
}
export const updateWageWorker = (id, patch) =>
  wageWorkerStore.set((l) => l.map((w) => (w.id === id ? { ...w, ...patch } : w)));

/* Deterministic seed attendance for the demo month — built from the seed roster, not the (browser-persisted) store, so server and client agree. */
function seedAttendance() {
  const out = [];
  const month = "2026-07";
  const workers = WAGE_WORKERS_SEED;
  for (let d = 1; d <= 31; d++) {
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    const dow = new Date(iso + "T00:00:00").getDay();
    workers.forEach((w, i) => {
      const v = (d * 17 + i * 31) % 23;
      const mark = dow === 0 ? "WO" : v === 0 ? "A" : v === 1 ? "H" : "P";
      const night = w.shiftId === "SHF-03";
      out.push({
        workerId: w.id,
        date: iso,
        mark,
        inAt: mark === "P" || mark === "H" ? (night ? "22:0" + (v % 6) : "08:5" + (v % 9)) : "",
        outAt:
          mark === "P"
            ? night
              ? "06:1" + (v % 5)
              : "18:0" + (v % 7)
            : mark === "H"
              ? "13:00"
              : "",
        otHours: mark === "P" && v % 7 === 3 ? 2 : 0,
        markedBy: "Kiran Shetty",
        note: "",
      });
    });
  }
  return out;
}
export const wageAttendanceStore = createPersistentStore(
  "seereon.wage.attendance.v1",
  seedAttendance(),
);
export const useWageAttendance = () => wageAttendanceStore.use();

export function markWageAttendance(entries, by) {
  if (!entries.length) return { ok: false, message: "No active workers to mark." };
  const bad = entries.find((e) => (e.mark === "P" || e.mark === "H") && (!e.inAt || !e.outAt));
  if (bad)
    return { ok: false, message: "In and out times are required for present / half-day marks." };
  if (entries.some((e) => e.otHours < 0 || e.otHours > 12))
    return { ok: false, message: "Overtime must be between 0 and 12 hours." };
  wageAttendanceStore.set((l) => {
    const keep = l.filter(
      (x) => !entries.some((e) => e.workerId === x.workerId && e.date === x.date),
    );
    return [...keep, ...entries.map((e) => ({ ...e, markedBy: by.name }))];
  });
  return { ok: true, message: `Attendance marked for ${entries.length} worker(s).` };
}

export function summariseWorker(workerId, month, list = wageAttendanceStore.get()) {
  const rows = list.filter((a) => a.workerId === workerId && a.date.startsWith(month));
  const c = { P: 0, A: 0, H: 0, WO: 0, PH: 0 };
  let ot = 0;
  let hours = 0;
  rows.forEach((a) => {
    c[a.mark] += 1;
    ot += a.otHours;
    if (a.inAt && a.outAt) {
      const [ih, im] = a.inAt.split(":").map(Number);
      const [oh, om] = a.outAt.split(":").map(Number);
      let h = oh + om / 60 - (ih + im / 60);
      if (h < 0) h += 24;
      hours += h;
    }
  });
  const payableDays = c.P + c.H * 0.5 + c.PH;
  return { ...c, otHours: ot, hours: +hours.toFixed(1), payableDays, marked: rows.length };
}
