// src/features/organization/data/employeeHolidayAdapter.js
//
// Turns the holiday calendars from GET /attendance/holiday-calendars into the flat
// holiday list the Employee Holiday page already renders (same shape as useHolidaysLegacy):
//   { id, name, type, paid, from, to, description }
//
// API calendar (one per Holiday Title + Year)        →  one entry per holiday inside it
//   type            NATIONAL / REGIONAL_STATE / OPTIONAL_RESTRICTED  →  "Public" / "State" / "Optional"
//   leave_category  PAID / UNPAID (null on older calendars)          →  paid true / false
//   holidays[]      { holiday_date, holiday_name }                   →  from / to / name
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Employee_holidayCalendar from "@/api/employee_holiday_calendar";

const PAGE_SIZE = 100;

// Badge labels used by typeTone() on the Holiday page.
// If typeTone() expects other words, change only these three values.
const TYPE_LABEL = {
  NATIONAL: "Public",
  REGIONAL_STATE: "State",
  OPTIONAL_RESTRICTED: "Optional",
};

// Older labels, in case a calendar was saved with the readable name.
const TYPE_ALIASES = {
  NATIONAL: "NATIONAL",
  "REGIONAL / STATE": "REGIONAL_STATE",
  "OPTIONAL / RESTRICTED": "OPTIONAL_RESTRICTED",
};

const typeCode = (t) => {
  const v = String(t ?? "").trim().toUpperCase();
  return TYPE_ALIASES[v] ?? v;
};

function isPaid(calendar) {
  const c = String(calendar.leave_category ?? "").toUpperCase();
  if (c === "PAID") return true;
  if (c === "UNPAID") return false;
  // Older calendars have no category: optional / restricted is unpaid, the rest paid.
  return typeCode(calendar.type) !== "OPTIONAL_RESTRICTED";
}

function readItems(res) {
  const data = res?.data;
  return Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
}

/** API calendars → sorted, de-duplicated holiday entries. */
export function calendarsToHolidays(calendars) {
  const seen = new Set();
  const list = [];

  calendars.forEach((cal) => {
    const code = typeCode(cal.type);
    const type = TYPE_LABEL[code] ?? cal.type ?? "";
    const paid = isPaid(cal);
    const title = String(cal.holiday_title ?? "").trim();
    const year = cal.year ?? "";
    const description = title && !title.includes(String(year)) ? `${title} ${year}` : title;

    (Array.isArray(cal.holidays) ? cal.holidays : []).forEach((h) => {
      const date = h.holiday_date ?? "";
      const name = String(h.holiday_name ?? "").trim();
      if (!date || !name) return;

      // The same holiday uploaded twice (same date, name and type) shows once.
      const key = `${date}|${name.toLowerCase()}|${code}`;
      if (seen.has(key)) return;
      seen.add(key);

      list.push({
        id: h.id ?? `${cal.id}-${date}`,
        name,
        type,
        paid,
        from: date,
        to: date,
        description,
        calendarId: cal.id,
        calendarType: code,
      });
    });
  });

  return list.sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name));
}

/** Loads every page of holiday calendars for the logged-in employee. */
export async function loadEmployeeHolidays(params) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await Employee_holidayCalendar.getAll({ ...params, page, page_size: PAGE_SIZE });
    const items = readItems(res);
    all.push(...items);
    const pages = Number(res?.data?.pages ?? 1);
    if (Array.isArray(res?.data) || page >= pages || items.length < PAGE_SIZE) break;
  }
  return calendarsToHolidays(all);
}

/**
 * React hook for the Employee Holiday page.
 * Returns { holidays, loading } — holidays is [] while loading or if the request fails.
 */
export function useEmployeeHolidays(params) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params ?? {});

  useEffect(() => {
    let active = true;
    setLoading(true);

    loadEmployeeHolidays(JSON.parse(key))
      .then((list) => {
        if (active) setHolidays(list);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load holidays:", error);
        const detail = error?.response?.data?.detail;
        toast.error(typeof detail === "string" && detail ? detail : "Unable to load holidays.");
        setHolidays([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [key]);

  return { holidays, loading };
}