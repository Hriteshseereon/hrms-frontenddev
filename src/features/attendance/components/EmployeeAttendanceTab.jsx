// Admin "Employee Attendance": attendance of ALL employees in the admin's scope, straight from
// GET /attendance/employee-attendance/*. Nothing is computed here — the server's numbers are shown as they come.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { employeeAttendanceApi } from "@/api/attendanceApi";
import { getEmployees } from "@/api/employeeApi";
import Branch_api from "@/api/branch";
import designationApi from "@/api/designationApi";
import { parseApiError } from "@/api/meApi";
import { useCompanyScope, CompanyScopeSelect } from "@/features/organization/components/CompanyScopeSelect";
import { todayLocalIso } from "@/features/attendance/data/attendance-live";
import { PunchCorrectionsCard } from "@/features/attendance/components/PunchCorrectionsCard";

const STATUS = {
  P: { label: "Present", cell: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  A: { label: "Absent", cell: "bg-red-100 text-red-700 border-red-300" },
  WO: { label: "Week off", cell: "bg-muted text-muted-foreground border-border" },
  L: { label: "Leave", cell: "bg-blue-100 text-blue-700 border-blue-300" },
  H: { label: "Holiday", cell: "bg-purple-100 text-purple-700 border-purple-300" },
};

const rowsOf = (res) => {
  const p = res?.data ?? res;
  if (Array.isArray(p)) return p;
  return p?.items ?? p?.results ?? p?.employees ?? (Array.isArray(p?.data) ? p.data : (p?.data?.items ?? []));
};

const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Monday → Sunday of the week containing today. */
function thisWeek() {
  const d = new Date();
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  return [isoOf(mon), isoOf(sun)];
}

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
const hhmm = (t) => (t ? String(t).slice(0, 5) : "—");
const hours = (h) => (h === null || h === undefined || h === "" ? "—" : `${Number(h).toFixed(2)} h`);
const pct = (v) => (v === null || v === undefined ? "—" : `${Number(v).toFixed(1)} %`);

function StatusPill({ status, title }) {
  const s = STATUS[status];
  if (!s)
    return (
      <span className="text-muted-foreground inline-grid h-7 w-7 place-items-center text-xs" title={title}>
        -
      </span>
    );
  return (
    <span
      title={title ?? s.label}
      className={cn("inline-grid h-7 min-w-7 place-items-center rounded-md border px-1 text-[11px] font-bold", s.cell)}
    >
      {status}
    </span>
  );
}

function ErrorState({ kind }) {
  const text =
    kind === "forbidden"
      ? ["No access", "Employee attendance is available to admin logins only."]
      : ["Attendance is not enabled", "The Attendance module is not enabled for this company."];
  return (
    <Card className="shadow-card">
      <CardContent className="p-10 text-center">
        <div className="text-base font-semibold">{text[0]}</div>
        <p className="text-muted-foreground mt-1 text-sm">{text[1]}</p>
      </CardContent>
    </Card>
  );
}

/** Searchable employee picker: sends the employee's id as `employee_id`. */
function EmployeeFilter({ value, onChange, scope }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      getEmployees({ search: text, limit: 8, company_id: scope.companyId, branch_id: scope.branchId })
        .then((res) => alive && setOptions(rowsOf(res)))
        .catch(() => alive && setOptions([]));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text, open, scope.companyId, scope.branchId]);

  const nameOf = (e) =>
    e.full_name || [e.first_name, e.last_name].filter(Boolean).join(" ") || e.name || e.work_email || "Employee";

  if (value)
    return (
      <div className="border-border bg-muted/40 flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
        <span className="max-w-[180px] truncate">{value.label}</span>
        <button type="button" aria-label="Clear employee" onClick={() => onChange(null)}>
          <X className="text-muted-foreground h-4 w-4" />
        </button>
      </div>
    );

  return (
    <div className="relative">
      <div className="border-border bg-muted/40 flex h-9 w-[220px] items-center gap-2 rounded-lg border px-3">
        <Search className="text-muted-foreground h-4 w-4" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search employee…"
          className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {open && options.length > 0 && (
        <ul className="border-border bg-popover absolute z-20 mt-1 max-h-56 w-72 overflow-auto rounded-md border p-1 text-sm shadow-md">
          {options.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="hover:bg-muted w-full rounded px-2 py-1.5 text-left"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  onChange({ id: e.id, label: nameOf(e) });
                  setText("");
                  setOpen(false);
                }}
              >
                {nameOf(e)}
                <span className="text-muted-foreground ml-1 text-xs">{e.employee_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmployeeDetail({ employeeId, query, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    employeeAttendanceApi
      .employee(employeeId, query)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(parseApiError(e).general));
    return () => {
      alive = false;
    };
  }, [employeeId, query]);

  const s = data?.summary ?? {};
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.employee_display ?? data?.employee_name ?? "Employee attendance"}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {!data && !error && <Skeleton className="h-40 w-full" />}
        {data && (
          <div className="space-y-4">
            <div className="text-muted-foreground text-xs">
              {[data.department, data.branch_name, data.date_of_joining && `Joined ${data.date_of_joining}`]
                .filter(Boolean)
                .join(" · ")}{" "}
              · {data.start_date} → {data.end_date}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {["present", "absent", "week_off", "leave", "holiday"].map((k) => (
                <Badge key={k} variant="outline">
                  {k.replace("_", " ")} · {s[k] ?? 0}
                </Badge>
              ))}
              <Badge variant="outline">Attendance · {pct(data.attendance_percentage)}</Badge>
              {s.total_working_hours !== undefined && (
                <Badge variant="outline">Hours · {hours(s.total_working_hours)}</Badge>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs uppercase">
                <tr>
                  <th className="py-1">Date</th>
                  <th>Status</th>
                  <th>In</th>
                  <th>Out</th>
                  <th className="text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {(data.days ?? []).map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5">
                      {d.date} <span className="text-muted-foreground text-xs">{d.day}</span>
                    </td>
                    <td>
                      <StatusPill status={d.status} />
                    </td>
                    <td>{hhmm(d.punch_in)}</td>
                    <td>{hhmm(d.punch_out)}</td>
                    <td className="text-right tabular-nums">{hours(d.working_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeAttendanceTab() {
  const scope = useCompanyScope();
  const [view, setView] = useState("daily");
  const [date, setDate] = useState(todayLocalIso);
  const [[start, end], setRange] = useState(thisWeek);
  const [monthValue, setMonthValue] = useState(() => todayLocalIso().slice(0, 7));
  const [employee, setEmployee] = useState(null);
  const [designation, setDesignation] = useState("");
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState([]);
  const [designations, setDesignations] = useState([]);

  const [list, setList] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null);
  const [detail, setDetail] = useState(null);

  // Company / branch dropdowns (only narrow what the admin already sees).
  useEffect(() => {
    setBranchId("");
    Branch_api.getBranches(scope.companyId || null)
      .then((res) => setBranches(rowsOf(res?.data ?? res)))
      .catch(() => setBranches([]));
    designationApi
      .getDesignations(scope.companyId ? { company_id: scope.companyId } : {})
      .then((res) => setDesignations(rowsOf(res?.data ?? res)))
      .catch(() => setDesignations([]));
  }, [scope.companyId]);

  const [year, month] = monthValue.split("-");
  const rangeDays = daysBetween(start, end);
  const rangeError = view === "weekly" && (rangeDays < 1 || rangeDays > 31) ? "Pick a range of 1 to 31 days." : "";

  const filters = useMemo(
    () => ({
      employee_id: employee?.id,
      designation,
      status,
      company_id: scope.companyId,
      branch_id: branchId,
    }),
    [employee, designation, status, scope.companyId, branchId],
  );

  /** Period part of the query for the active tab. */
  const period = useMemo(() => {
    if (view === "daily") return { date };
    if (view === "weekly") return { start_date: start, end_date: end };
    return { month: Number(month), year: Number(year) };
  }, [view, date, start, end, month, year]);

  const load = useCallback(async () => {
    if (rangeError) return;
    setLoading(true);
    setBlocked(null);
    const listCall = employeeAttendanceApi[view];
    try {
      const [rows, sum] = await Promise.all([
        listCall({ ...period, ...filters }),
        employeeAttendanceApi.summary({
          view,
          ...period,
          company_id: filters.company_id,
          branch_id: filters.branch_id,
          employee_id: filters.employee_id,
          designation: filters.designation,
        }),
      ]);
      setList(rows);
      setSummary(sum);
    } catch (err) {
      const { status: code, general } = parseApiError(err);
      setList(null);
      setSummary(null);
      if (code === 403 && /module not enabled/i.test(general)) setBlocked("module");
      else if (code === 403) setBlocked("forbidden");
      else if (code !== 401) toast.error(general || "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [view, period, filters, rangeError]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  if (blocked) return <ErrorState kind={blocked} />;

  const employees = list?.employees ?? [];
  const dates =
    view === "daily"
      ? []
      : (employees[0]?.attendance ?? []).map((a) => ({ date: a.date, day: a.day }));

  const cards =
    view === "daily"
      ? [
          ["Employees", summary?.total_employees],
          ["Present", summary?.present],
          ["Absent", summary?.absent],
          ["Week off", summary?.week_off],
          ["On leave", summary?.leave],
          ["Holiday", summary?.holiday],
          ["Attendance", pct(summary?.attendance_percentage)],
        ]
      : [
          ["Employees", summary?.total_employees],
          ["Present days", summary?.present],
          ["Absent days", summary?.absent],
          ["Week-off days", summary?.week_off],
          ["Leave days", summary?.leave],
          ["Holiday days", summary?.holiday],
          ["Attendance", pct(summary?.attendance_percentage)],
        ];

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>

          {view === "daily" && (
            <Input type="date" className="h-9 w-[160px]" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
          )}
          {view === "weekly" && (
            <div className="flex items-center gap-1 text-sm">
              <Input type="date" className="h-9 w-[150px]" value={start} onChange={(e) => e.target.value && setRange([e.target.value, end])} aria-label="From" />
              <span className="text-muted-foreground">to</span>
              <Input type="date" className="h-9 w-[150px]" value={end} onChange={(e) => e.target.value && setRange([start, e.target.value])} aria-label="To" />
            </div>
          )}
          {view === "monthly" && (
            <Input type="month" className="h-9 w-[160px]" value={monthValue} onChange={(e) => e.target.value && setMonthValue(e.target.value)} aria-label="Month" />
          )}

          <CompanyScopeSelect scope={scope} />

          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            aria-label="Branch"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.branch_name}
              </option>
            ))}
          </select>

          <select
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            aria-label="Designation"
          >
            <option value="">All designations</option>
            {designations.map((d) => (
              <option key={d.id} value={d.name ?? d.designation_name}>
                {d.name ?? d.designation_name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          <EmployeeFilter value={employee} onChange={setEmployee} scope={{ companyId: scope.companyId, branchId }} />
        </CardContent>
      </Card>

      {rangeError && <p className="text-destructive text-sm">{rangeError}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(([label, value]) => (
          <Card key={label} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{label}</div>
              {loading && !summary ? (
                <Skeleton className="mt-1 h-6 w-12" />
              ) : (
                <div className="text-xl font-bold tabular-nums">{value ?? "—"}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {summary?.branch_wise?.length > 1 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-wrap gap-2 p-3 text-xs">
            {summary.branch_wise.map((b) => (
              <Badge key={b.branch_id ?? b.branch_name} variant="outline">
                {b.branch_name} · {b.present}P / {b.absent}A · {pct(b.attendance_percentage)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="bg-muted/40 sticky left-0 p-3 text-left">Employee</th>
                <th className="p-3 text-left">Branch</th>
                {view === "daily" ? (
                  <>
                    <th className="p-3 text-left">Shift</th>
                    <th className="p-3 text-left">In</th>
                    <th className="p-3 text-left">Out</th>
                    <th className="p-3 text-right">Hours</th>
                    <th className="p-3 text-center">Status</th>
                  </>
                ) : (
                  <>
                    {dates.map((d) => (
                      <th key={d.date} className="p-2 text-center font-semibold" title={`${d.date} ${d.day}`}>
                        {d.date.slice(-2)}
                      </th>
                    ))}
                    <th className="p-3 text-center">P / A / L</th>
                    <th className="p-3 text-right">Hours</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading &&
                !list &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="p-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading && !employees.length && !rangeError && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-8 text-center">
                    No employees in this scope
                  </td>
                </tr>
              )}
              {employees.map((e) => (
                <tr
                  key={e.employee_id}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => setDetail(e.employee_id)}
                >
                  <td className="bg-card sticky left-0 p-3 font-medium whitespace-nowrap">
                    {e.employee_display ?? e.employee_name}
                  </td>
                  <td className="text-muted-foreground p-3 whitespace-nowrap">{e.branch_name ?? "—"}</td>
                  {view === "daily" ? (
                    <>
                      <td className="text-muted-foreground p-3 whitespace-nowrap">{e.shift_name ?? "—"}</td>
                      <td className="p-3">{hhmm(e.punch_in)}</td>
                      <td className="p-3">{hhmm(e.punch_out)}</td>
                      <td className="p-3 text-right tabular-nums">{hours(e.working_hours)}</td>
                      <td className="p-3 text-center">
                        <StatusPill status={e.attendance_status} title={STATUS[e.attendance_status]?.label} />
                      </td>
                    </>
                  ) : (
                    <>
                      {(e.attendance ?? []).map((a) => (
                        <td key={a.date} className="p-1.5 text-center">
                          <StatusPill
                            status={a.status}
                            title={`${a.date} · ${STATUS[a.status]?.label ?? "Not marked"}${a.working_hours ? ` · ${hours(a.working_hours)}` : ""}`}
                          />
                        </td>
                      ))}
                      <td className="p-3 text-center text-xs font-medium whitespace-nowrap">
                        {e.summary?.present ?? 0} / {e.summary?.absent ?? 0} / {e.summary?.leave ?? 0}
                      </td>
                      <td className="p-3 text-right tabular-nums">{hours(e.summary?.total_working_hours)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PunchCorrectionsCard />

      {detail && (
        <EmployeeDetail
          employeeId={detail}
          query={
            view === "daily"
              ? { month: Number(date.slice(5, 7)), year: Number(date.slice(0, 4)) }
              : period
          }
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
