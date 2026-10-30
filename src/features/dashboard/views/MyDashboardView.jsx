import Link from "@/lib/router";
import {
  CalendarCheck2,
  Plane,
  Wallet,
  ListTodo,
  Megaphone,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getEmployeeProfile, initials } from "@/features/employees/data/employee-directory";
import { useCurrentEmployee, useEmployeeAvatar } from "@/features/auth/data/emp-session";
import {
  useTasks,
  priorityClass,
  statusToneClass,
  dueDateClass,
  isDelayed,
} from "@/features/projects/data/task-data";
import { useHolidaysLegacy } from "@/features/organization/data/hr-masters";
import {
  payslipsFor,
  usePayrollRuns,
  computePayslipFor,
  periodLabel,
} from "@/features/payroll/data/payroll-engine";
import { ATTENDANCE_MONTH } from "@/features/attendance/data/attendance-data";
import {
  ChartCard,
  DonutChart,
  BarsChart,
  LinesChart,
} from "@/features/dashboard/components/Charts";
import { ModuleExplorer } from "@/features/dashboard/components/ModuleExplorer";
import { AppraisalOutcomeCard } from "@/features/performance/components/SelfAppraisal";
import { usePunches, punchHours } from "@/features/attendance/data/attendance-self";
import { useGoals } from "@/features/performance/data/goals-data";
import { attendanceForPeriod } from "@/features/attendance/data/attendance-pattern";
import { useEffect, useMemo, useState } from "react";
import { attendanceApi } from "@/api/attendanceApi";
import { leaveBalances, useLeaveApplications } from "@/features/leave/data/leave-engine";
import {
  announcementsForEmployee,
  useAnnouncements,
} from "@/features/communications/data/announcement-data";
import { todayIso } from "@/features/attendance/data/attendance-self";
import { inr } from "@/features/finance/data/finance-data";
import { MyTeamCelebrationsCard } from "@/features/employees/components/CelebrationsWidget";

function Kpi({ label, value, sub, icon: Icon, to }) {
  return (
    <Link href={to}>
      <Card className="shadow-card hover:shadow-premium h-full transition">
        <CardContent className="p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
            <Icon className="h-3.5 w-3.5" /> {label}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
          {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

function EmpDashboard() {
  const me = useCurrentEmployee();
  const avatar = useEmployeeAvatar();
  const p = getEmployeeProfile(me.id);
  const tasks = useTasks().filter((t) => t.assignees.includes(me.id));
  const openTasks = tasks.filter((t) => t.status !== "Completed");
  usePayrollRuns();
  const lastPaid = payslipsFor(me.id)[0];
  const lastSlip = lastPaid ? { net: lastPaid.slip.net, period: lastPaid.slip.periodLabel } : null;
  const [leaveApps] = useLeaveApplications();
  const punches = usePunches().filter((x) => x.empId === me.id);
  const goals = useGoals();
  const myGoals = goals.filter((g) => g.ownerId === me.id || g.owner === me.name);
  // Recomputed on every render so a new punch or leave decision shows at once (both stores re-render this view).
  const attendanceNow = attendanceForPeriod(me.id, ATTENDANCE_MONTH);
  // Projection for the month after the attendance register (the period the next payroll run covers).
  const slipPeriod = (() => {
    const [y, m] = ATTENDANCE_MONTH.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  })();
  const currentSlip = useMemo(() => computePayslipFor(me.id, slipPeriod), [me.id, slipPeriod]);
  const hoursTrend = useMemo(
    () =>
      [...punches]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(-10)
        .map((x) => ({ name: x.date.slice(5), Hours: Number(punchHours(x).toFixed(1)) })),
    [punches],
  );
  const announcements = announcementsForEmployee(useAnnouncements(), me);
  // Upcoming only — the card listed the first four holidays of the year, including ones long past.
  const today = todayIso();
  const holidays = useHolidaysLegacy()
    .filter((h) => h.to >= today)
    .sort((a, b) => (a.from < b.from ? -1 : 1));
  const leaveLines = leaveBalances(me.id, leaveApps).filter((l) => Number.isFinite(l.available));
  const leaveTotal = leaveLines.reduce((s, l) => s + l.entitled, 0);
  const leaveUsed = leaveLines.reduce((s, l) => s + l.used + l.pending, 0);

  const [attendanceSummary, setAttendanceSummary] = useState(null);

  useEffect(() => {
    let mounted = true;
    attendanceApi
      .getMySummary()
      .then((data) => {
        if (mounted && data) setAttendanceSummary(data);
      })
      .catch((err) => console.warn("Dashboard attendance summary error:", err));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card className="shadow-card overflow-hidden">
        <div className="bg-gradient-emerald flex flex-wrap items-center gap-4 p-6 text-white">
          <Avatar className="border-gold/50 h-16 w-16 border-2">
            {avatar && <AvatarImage src={avatar} alt={me.name} />}
            <AvatarFallback className="bg-white/10 text-lg font-semibold text-white">
              {initials(me.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {me.name.split(" ")[0]}
            </h1>
            <p className="mt-0.5 text-sm text-white/70">
              {me.role} · {me.dept} · {me.branch} · {me.id}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Badge variant="outline" className="border-gold/40 text-gold bg-white/10">
              Shift: {p.job.shift}
            </Badge>
            <Badge variant="outline" className="border-white/25 bg-white/10 text-white">
              Manager: {p.job.reportingManager}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Present days"
          value={
            attendanceSummary
              ? String(attendanceSummary.present_days ?? 0)
              : String(p.attendance.present)
          }
          sub={
            attendanceSummary
              ? `${attendanceSummary.absent_days ?? 0} absent · ${attendanceSummary.leave_days ?? 0} leave`
              : `${p.attendance.absent} absent · ${p.attendance.leave} leave`
          }
          icon={CalendarCheck2}
          to="/emp/attendance"
        />

        <Kpi
          label="Leave balance"
          value={`${leaveTotal - leaveUsed} days`}
          sub={`${leaveUsed} of ${leaveTotal} used`}
          icon={Plane}
          to="/emp/leave"
        />

        <Kpi
          label="Last net pay"
          value={lastSlip ? inr(lastSlip.net) : "—"}
          sub={lastSlip ? lastSlip.period : "No processed payroll yet"}
          icon={Wallet}
          to="/emp/payslips"
        />

        <Kpi
          label="Open tasks"
          value={String(openTasks.length)}
          sub={`${tasks.length} assigned in total`}
          icon={ListTodo}
          to="/emp/tasks"
        />
      </div>

      <AppraisalOutcomeCard empId={me.id} />
      <ModuleExplorer portal="emp" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title="My leave balances"
          to="/emp/leave"
          subtitle="Available · used · on hold, by type"
        >
          <BarsChart
            data={leaveLines.map((l) => ({
              name: l.type.replace(" Leave", ""),
              Available: l.available,
              Used: l.used,
              "On hold": l.pending,
            }))}
            keys={[
              { key: "Available", label: "Available" },
              { key: "Used", label: "Used" },
              { key: "On hold", label: "On hold" },
            ]}
            stacked
            colors={["#0f766e", "#94a3b8", "#b8860b"]}
            height={220}
          />
        </ChartCard>
        <ChartCard
          title={`Attendance · ${periodLabel(ATTENDANCE_MONTH)}`}
          to="/emp/attendance"
          subtitle={`${attendanceNow.present} present · ${attendanceNow.paidLeave} leave · ${attendanceNow.absent} absent`}
        >
          <DonutChart
            data={[
              { name: "Present", value: attendanceNow.present },
              { name: "Paid leave", value: attendanceNow.paidLeave },
              { name: "Absent", value: attendanceNow.absent },
              { name: "Weekly offs", value: attendanceNow.weeklyOffs },
            ].filter((d) => d.value)}
            height={220}
          />
        </ChartCard>
        <ChartCard
          title="Salary composition"
          to="/emp/payslips"
          subtitle={
            currentSlip ? `Projected net ${inr(currentSlip.net)} · ${periodLabel(slipPeriod)}` : "—"
          }
        >
          {currentSlip ? (
            <DonutChart
              data={[
                ...currentSlip.earnings.map((e) => ({ name: e.label, value: e.amount })),
                ...currentSlip.deductions.map((d) => ({
                  name: d.label.replace(/ \(.*\)/, ""),
                  value: d.amount,
                })),
              ]}
              money
              height={220}
            />
          ) : null}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title="Daily hours (last 10 punches)"
          to="/emp/attendance"
          subtitle="From your manual / biometric / geofence punches"
          className="lg:col-span-2"
        >
          {hoursTrend.length ? (
            <LinesChart
              data={hoursTrend}
              keys={[{ key: "Hours", label: "Hours" }]}
              area
              height={200}
            />
          ) : (
            <div className="text-muted-foreground grid h-48 place-items-center text-sm">
              No punches yet — mark attendance from My Attendance.
            </div>
          )}
        </ChartCard>
        <ChartCard
          title="Goal progress"
          to="/emp/goals"
          subtitle={`${myGoals.length} goals this cycle`}
        >
          {myGoals.length ? (
            <BarsChart
              data={myGoals.slice(0, 5).map((g) => ({
                name: g.title.length > 18 ? g.title.slice(0, 18) + "…" : g.title,
                Progress: g.progress,
              }))}
              keys={[{ key: "Progress", label: "Progress %" }]}
              horizontal
              height={200}
            />
          ) : (
            <div className="text-muted-foreground grid h-48 place-items-center text-sm">
              No goals set.
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <ListTodo className="text-primary h-4 w-4" /> My tasks
              </h2>
              <Link
                href="/emp/tasks"
                className="text-primary flex items-center gap-1 text-sm hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {openTasks.slice(0, 4).map((t) => (
                <div key={t.id} className="border-border rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="outline" className={priorityClass(t.priority)}>
                      {t.priority}
                    </Badge>
                    <Badge variant="outline" className={statusToneClass(t)}>
                      {t.status}
                    </Badge>
                    <span className={`ml-auto text-xs ${dueDateClass(t)}`}>
                      Due <span className="whitespace-nowrap">{t.dueDate}</span>
                      {isDelayed(t) ? " · delayed" : ""}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={t.progress} className="h-2 flex-1" />
                    <span className="text-xs font-semibold">{t.progress}%</span>
                  </div>
                </div>
              ))}
              {openTasks.length === 0 && (
                <p className="text-muted-foreground text-sm">No open tasks. Nice work.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Plane className="text-primary h-4 w-4" /> Leave balance
            </h2>
            {leaveLines.map((l) => (
              <div key={l.type} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{l.type}</span>
                  <span className="text-muted-foreground">
                    {l.available} / {l.entitled} left
                  </span>
                </div>
                <Progress
                  value={l.entitled ? ((l.used + l.pending) / l.entitled) * 100 : 0}
                  className="h-2"
                />
              </div>
            ))}
            <Link
              href="/emp/leave"
              className="text-primary flex items-center gap-1 text-sm hover:underline"
            >
              Apply for leave <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <MyTeamCelebrationsCard />

        <Card className="shadow-card lg:col-span-2">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Megaphone className="text-primary h-4 w-4" /> Notices & circulars
              </h2>
              <Link
                href="/emp/notices"
                className="text-primary flex items-center gap-1 text-sm hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {announcements.slice(0, 4).map((a) => (
              <div key={a.id} className="border-border rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{a.type}</Badge>
                  <span className="min-w-0 text-sm font-medium break-words">{a.subject}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{a.from}</span>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{a.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarDays className="text-primary h-4 w-4" /> Upcoming holidays
            </h2>
            {holidays.length === 0 && (
              <p className="text-muted-foreground text-sm">No upcoming holidays.</p>
            )}
            {holidays.slice(0, 4).map((h) => (
              <div
                key={h.id}
                className="border-border flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">
                    {h.from.slice(5, 7)}/{h.from.slice(2, 4)}
                  </div>
                  <div className="text-lg leading-none font-bold">{h.from.slice(8, 10)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">{h.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {h.type} · {h.paid ? "Paid" : "Unpaid"}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default EmpDashboard;
