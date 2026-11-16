// Company Admin dashboard — one API file. It only CALLS existing endpoints (no new backend work);
// all field mapping lives in src/features/dashboard/data/dashboardAdapter.js.
import SuperAdmin_axios from "./SuperAdmin_axios";
import { listPromotions } from "@/services/api/endpoints/promotions";

/** Drops empty params so the backend only sees real filters. */
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));

const dashboardApi = {
  // GET /employees — `total` for the headcount card, `items` for birthdays / anniversaries / retirements.
  // Pages of 100 (max 10 pages) so a large company is still covered.
  employees: async (params) => {
    const limit = 100;
    const items = [];
    let total = null;
    for (let page = 1; page <= 10; page += 1) {
      const { data } = await SuperAdmin_axios.get("/employees", {
        params: clean({ page, limit, ...params }),
      });
      const rows = Array.isArray(data) ? data : (data?.items ?? []);
      total = Array.isArray(data) ? rows.length : (data?.total ?? total);
      items.push(...rows);
      if (Array.isArray(data) || rows.length < limit || items.length >= (total ?? 0)) break;
    }
    return { total: total ?? items.length, items };
  },

  // GET /attendance/employee-attendance/summary?view=daily&date=YYYY-MM-DD
  attendanceSummary: (params) =>
    SuperAdmin_axios.get("/attendance/employee-attendance/summary", {
      params: clean({ view: "daily", ...params }),
    }).then((r) => r.data),

  // GET /payroll/runs
  payrollRuns: (params) =>
    SuperAdmin_axios.get("/payroll/runs", { params: clean({ page: 1, limit: 20, ...params }) }).then(
      (r) => r.data,
    ),

  // GET /cases/promotions
  promotions: (options) => listPromotions(options),
};

export default dashboardApi;
