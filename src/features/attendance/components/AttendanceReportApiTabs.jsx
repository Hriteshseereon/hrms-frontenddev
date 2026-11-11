// Attendance Report and Work Hours & Overtime on the real API (GET /attendance/report, /attendance/work-hours).
// Needs attendance.view (or an admin login). The server's numbers are shown as they come.
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { attendanceApi } from "@/api/attendanceApi";
import { detailText } from "@/api/payrollRunApi";
import Branch_api from "@/api/branch";
import { useCompanyScope, CompanyScopeSelect } from "@/features/organization/components/CompanyScopeSelect";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const rowsOf = (res) => {
  const p = res?.data ?? res;
  return Array.isArray(p) ? p : (p?.items ?? p?.results ?? (Array.isArray(p?.data) ? p.data : []));
};
const pctTone = (v) =>
  v === null || v === undefined
    ? ""
    : v >= 95
      ? "text-emerald-600"
      : v >= 80
        ? "text-amber-600"
        : "text-red-600";
const num = (v) => (v === null || v === undefined ? "—" : v);
const hhmm = (t) => (t ? String(t).slice(0, 5) : "—");

const SELECT = "border-input bg-background h-9 rounded-md border px-2 text-sm";

function Filters({ value, onChange, withBand, scope }) {
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    Branch_api.getBranches(scope.companyId || null)
      .then((res) => setBranches(rowsOf(res?.data ?? res)))
      .catch(() => setBranches([]));
  }, [scope.companyId]);
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <Card className="shadow-card">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <Input type="month" className="h-9 w-[150px]" value={value.month} onChange={(e) => e.target.value && set({ month: e.target.value })} aria-label="Month" />
        <CompanyScopeSelect scope={scope} />
        <select className={SELECT} value={value.office} onChange={(e) => set({ office: e.target.value })} aria-label="Office">
          <option value="">All offices</option>
          {branches.map((b) => (
            <option key={b.id} value={b.name ?? b.branch_name}>
              {b.name ?? b.branch_name}
            </option>
          ))}
        </select>
        <Input className="h-9 w-[150px]" placeholder="Department" value={value.dept} onChange={(e) => set({ dept: e.target.value })} />
        <Input className="h-9 w-[140px]" placeholder="Shift" value={value.shift} onChange={(e) => set({ shift: e.target.value })} />
        <Input className="h-9 w-[160px]" placeholder="Employee id / code" value={value.empId} onChange={(e) => set({ empId: e.target.value })} />
        {withBand && (
          <>
            <select className={SELECT} value={value.band} onChange={(e) => set({ band: e.target.value })} aria-label="Attendance band">
              <option value="">All attendance</option>
              <option value="high">High (95%+)</option>
              <option value="medium">Medium (80-95%)</option>
              <option value="low">Low (&lt;80%)</option>
            </select>
            <select className={SELECT} value={value.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
              <option value="">Sort: default</option>
              <option value="name">Name</option>
              <option value="-attendance_pct">Attendance % (high first)</option>
              <option value="attendance_pct">Attendance % (low first)</option>
              <option value="-absent">Most absent</option>
              <option value="-late_marks">Most late marks</option>
              <option value="-overtime_hours">Most overtime</option>
            </select>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Loads `fetcher(params)` (debounced) and tracks loading / error. */
function useReport(fetcher, params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { status, message }
  const key = JSON.stringify(params);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetcher(params)
        .then((d) => alive && (setData(d), setError(null)))
        .catch((e) => alive && (setData(null), setError({ status: e?.response?.status, message: detailText(e) })))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading, error };
}

function Blocked({ error }) {
  if (!error) return null;
  const text =
    error.status === 403 && /module not enabled/i.test(error.message)
      ? "Attendance is not enabled for this company."
      : error.status === 403
        ? "No access. You need the attendance.view permission."
        : error.message;
  return (
    <Card className="shadow-card">
      <CardContent className="text-muted-foreground p-8 text-center text-sm">{text}</CardContent>
    </Card>
  );
}

const baseParams = (f, scope) => ({
  month: f.month,
  dept: f.dept.trim(),
  office: f.office,
  shift: f.shift.trim(),
  empId: f.empId.trim(),
});

const EMPTY = { month: currentMonth(), office: "", dept: "", shift: "", empId: "", band: "", sort: "" };

export function AttendanceReportApiTab() {
  const scope = useCompanyScope();
  const [f, setF] = useState(EMPTY);
  const { data, loading, error } = useReport(attendanceApi.getReport, {
    ...baseParams(f, scope),
    band: f.band,
    sort: f.sort,
  });
  const rows = data?.employees ?? [];
  return (
    <div className="space-y-5">
      <Filters value={f} onChange={setF} withBand scope={scope} />
      {error ? (
        <Blocked error={error} />
      ) : (
        <Card className="shadow-card overflow-hidden">
          <div className="text-muted-foreground border-b px-4 py-2 text-xs">
            {loading ? "Loading…" : `${data?.total_employees ?? rows.length} employees · ${data?.month ?? f.month}`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Dept</th>
                  <th className="p-3 text-left">Office</th>
                  <th className="p-3 text-left">Shift</th>
                  {["Working", "Present", "Absent", "Leave", "WO", "Holidays", "Half", "Late", "OT h", "Short h"].map((h) => (
                    <th key={h} className="p-3 text-right">
                      {h}
                    </th>
                  ))}
                  <th className="p-3 text-right">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading &&
                  !data &&
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={15} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="text-muted-foreground p-8 text-center">
                      No employees in this scope
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.employee_id}>
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground text-xs">{r.employee_code}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{r.department ?? "—"}</td>
                    <td className="text-muted-foreground p-3">{r.office ?? "—"}</td>
                    <td className="text-muted-foreground p-3">{r.shift ?? "—"}</td>
                    {[r.working_days, r.present, r.absent, r.leave, r.weekly_offs, r.holidays, r.half_days, r.late_marks, r.overtime_hours, r.short_hours].map((v, i) => (
                      <td key={i} className="p-3 text-right tabular-nums">
                        {num(v)}
                      </td>
                    ))}
                    <td className={cn("p-3 text-right font-semibold tabular-nums", pctTone(r.attendance_pct))}>
                      {r.attendance_pct === null || r.attendance_pct === undefined ? "—" : `${r.attendance_pct} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export function WorkHoursApiTab() {
  const scope = useCompanyScope();
  const [f, setF] = useState(EMPTY);
  const [open, setOpen] = useState(null);
  const { data, loading, error } = useReport(attendanceApi.getPayrollWorkHours, baseParams(f, scope));
  const rows = data?.employees ?? [];
  const detail = rows.find((r) => r.employee_id === open);
  return (
    <div className="space-y-5">
      <Filters value={f} onChange={setF} scope={scope} />
      {error ? (
        <Blocked error={error} />
      ) : (
        <Card className="shadow-card overflow-hidden">
          <div className="text-muted-foreground border-b px-4 py-2 text-xs">
            {loading ? "Loading…" : `${data?.total_employees ?? rows.length} employees · ${data?.month ?? f.month}`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Shift</th>
                  {["Days worked", "Worked h", "Overtime h", "Short h", "Late days", "Half days"].map((h) => (
                    <th key={h} className="p-3 text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading &&
                  !data &&
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="p-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-muted-foreground p-8 text-center">
                      No employees in this scope
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.employee_id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setOpen(r.employee_id)}>
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground text-xs">{r.employee_code}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{r.shift ?? "—"}</td>
                    {[r.totals?.days_worked, r.totals?.worked_hours, r.totals?.overtime_hours, r.totals?.short_hours, r.totals?.late_days, r.totals?.half_days].map((v, i) => (
                      <td key={i} className="p-3 text-right tabular-nums">
                        {num(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detail && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {detail.name} · {detail.employee_code}
              </DialogTitle>
            </DialogHeader>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs uppercase">
                <tr>
                  <th className="py-1">Date</th>
                  <th>In</th>
                  <th>Out</th>
                  <th className="text-right">Worked h</th>
                  <th className="text-right">OT h</th>
                  <th className="text-right">Short h</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {(detail.days ?? []).map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5">{d.date}</td>
                    <td>{hhmm(d.in)}</td>
                    <td>{hhmm(d.out)}</td>
                    <td className="text-right tabular-nums">{num(d.worked_hours)}</td>
                    <td className="text-right tabular-nums">{num(d.overtime_hours)}</td>
                    <td className="text-right tabular-nums">{num(d.short_hours)}</td>
                    <td className="space-x-1 pl-2">
                      {d.late && <Badge variant="outline">Late</Badge>}
                      {d.half_day && <Badge variant="outline">Half day</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
