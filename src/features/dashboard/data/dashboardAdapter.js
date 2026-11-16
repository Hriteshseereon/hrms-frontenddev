// Adapter for the Company Admin dashboard cards.
// API file only calls endpoints (@/api/dashboardApi); all field mapping lives here.
// Every section is loaded independently: a failed API gives `null` for that card only (the card shows "—").
import dashboardApi from "@/api/dashboardApi";
import { useApiQuery } from "@/hooks/use-api";
import { useSessionStore } from "@/features/auth/data/session-store";
import { loadEmployeeHolidays } from "@/features/organization/data/employeeHolidayAdapter";

const unwrap = (res) => {
  let d = res?.data ?? res;
  if (d?.data != null && !Array.isArray(d)) d = d.data;
  return d;
};

const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Promotion statuses that are still moving (not draft / finished / cancelled). */
const PROMOTION_IN_PROGRESS = ["SENT_TO_EMPLOYEE", "SCHEDULED", "QUERY_RAISED", "QUERY_RESOLVED"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const isoDay = (v) => (typeof v === "string" && ISO_DATE.test(v) ? v.slice(0, 10) : "");

/** Backend employee → the { id, name, dept, dob, doj } shape the celebration helpers expect. */
const toPerson = (e = {}) => ({
  id: String(e.id ?? ""),
  name: [e.first_name, e.last_name].filter(Boolean).join(" ") || e.name || e.work_email || "",
  dept: e.department ?? "—",
  dob: isoDay(e.date_of_birth),
  doj: isoDay(e.date_of_joining),
  active: e.is_active !== false && String(e.status ?? "").toUpperCase() !== "INACTIVE",
});

export const fromEmployees = (res) => {
  const d = unwrap(res);
  const rows = Array.isArray(d) ? d : (d?.items ?? []);
  return {
    total: Array.isArray(d) ? d.length : num(d?.total ?? d?.count ?? rows.length),
    people: rows.map(toPerson).filter((p) => p.id && p.name && p.active),
  };
};

export const fromAttendance = (res) => {
  const d = unwrap(res);
  const s = d?.summary ?? d ?? {};
  const total = num(s.total_employees);
  const present = num(s.present);
  return {
    total,
    present,
    onLeave: num(s.leave),
    percent:
      num(s.attendance_percentage) ??
      (total && present != null ? Math.round((present / total) * 100) : null),
  };
};

export const fromPayrollRuns = (res) => {
  const d = unwrap(res);
  const items = Array.isArray(d) ? d : (d?.items ?? []);
  const latest = [...items].sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1))[0];
  if (!latest) return { latest: null, awaiting: 0 };
  return {
    latest: {
      period: latest.period,
      status: latest.status,
      net: num(latest.net ?? latest.totals?.net),
    },
    awaiting: items.filter((r) => r.status === "Pending Approval").length,
  };
};

export const fromPromotions = (res) => {
  const d = unwrap(res);
  const rows = Array.isArray(d) ? d : (d?.items ?? []);
  return {
    inProgress: rows.filter((r) => PROMOTION_IN_PROGRESS.includes(r.status)).length,
    total: rows.length,
  };
};

const settle = (r, map) => (r.status === "fulfilled" ? safe(() => map(r.value)) : null);
const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

/** Loads every card's data in parallel. `allow` lists the sections the role may open (skips the call otherwise). */
export async function loadDashboardSummary({ date, companyId, allow = {} } = {}) {
  const skip = Promise.resolve(null);
  const scope = companyId ? { company_id: companyId } : {};
  const [emp, att, pay, promo, hol] = await Promise.allSettled([
    allow.employees === false ? skip : dashboardApi.employees(scope),
    allow.attendance === false ? skip : dashboardApi.attendanceSummary({ date, ...scope }),
    allow.payroll === false ? skip : dashboardApi.payrollRuns(),
    allow.promotions === false ? skip : dashboardApi.promotions(),
    // Same holiday calendars + mapping the Holiday page uses (employeeHolidayAdapter).
    allow.holidays === false ? skip : loadEmployeeHolidays(scope),
  ]);
  const ok = (r) => r.status === "fulfilled" && r.value != null;
  return {
    employees: ok(emp) ? settle(emp, fromEmployees) : null,
    attendance: ok(att) ? settle(att, fromAttendance) : null,
    payroll: ok(pay) ? settle(pay, fromPayrollRuns) : null,
    promotions: ok(promo) ? settle(promo, fromPromotions) : null,
    holidays: ok(hol) && Array.isArray(hol.value) ? hol.value : null,
  };
}

/** React hook for the dashboard cards. `data` sections are `null` until loaded or when their API fails. */
export function useDashboardSummary({ date, allow }) {
  const companyId = useSessionStore((s) => s.scopeCompanyId) ?? "";
  const q = useApiQuery(
    ["dashboard", "company-summary", companyId, date, JSON.stringify(allow)],
    () => loadDashboardSummary({ date, companyId, allow }),
    { staleTime: 60_000, retry: false, refetchOnWindowFocus: false },
  );
  return { data: q.data ?? {}, loading: q.isLoading };
}
