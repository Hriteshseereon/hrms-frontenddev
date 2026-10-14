import Link from "@/lib/router";
import {
  Users,
  Clock,
  Plane,
  DollarSign,
  TrendingUp,
  UserMinus,
  Megaphone,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORGANIZATION, can, canOpen, useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import { GroupDashboard } from "@/features/dashboard/components/GroupDashboard";
import { usePunches, todayIso } from "@/features/attendance/data/attendance-self";
import { useLeaveApplications } from "@/features/leave/data/leave-engine";
import { usePayrollRuns, periodLabel } from "@/features/payroll/data/payroll-engine";
import { useExitRequests } from "@/features/exit/data/exit-data";
import { useHolidaysLegacy } from "@/features/organization/data/hr-masters";
import {
  announcementsFor,
  useAnnouncements,
} from "@/features/communications/data/announcement-data";
import { usePromotions } from "@/features/employees/data/people-cases";
import { reimbursementStore } from "@/features/finance/data/claims-data";
import { OPEN_STATUSES, useTickets, slaState } from "@/features/helpdesk/data/helpdesk-data";
import { inr } from "@/lib/store";
import {
  ChartCard,
  DonutChart,
  BarsChart,
  LinesChart,
  inrShort,
} from "@/features/dashboard/components/Charts";
import { ModuleExplorer } from "@/features/dashboard/components/ModuleExplorer";
import { ATTENDANCE, ATTENDANCE_MONTH } from "@/features/attendance/data/attendance-data";
import { useCandidates } from "@/features/recruitment/data/recruitment-store";
import { useAssets } from "@/features/assets/data/asset-data";
import { useFilings, filingTone, isOverdue } from "@/features/payroll/data/statutory-filings";
import { useMemo } from "react";
import { ProbationWidget } from "@/features/employees/components/ProbationWidget";
import { CelebrationsWidget } from "@/features/employees/components/CelebrationsWidget";
import { useScope, useScopeMatch } from "@/features/organization/data/tenancy";

function OrgDashboard() {
  // Collective view (a group Super Admin looking at every company) → the group dashboard.
  const collective = useScope().readOnly;
  if (collective) return <GroupDashboard />;
  return <EntityDashboard />;
}

function EntityDashboard() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  // Reactive read (getOrg() reads the persisted store non-reactively and hydrates it mid-render).
  const org = useOrgs().find((o) => o.id === orgId);
  const directory = useDirectory();
  // Company Admin / Super Admin: the company (or the branch picked in the scope chip); Branch Admin: their branch.
  const inScope = useScopeMatch();
  const employees = directory.filter((e) => inScope(e.orgId, null, e.branch));
  const punches = usePunches();
  const [leaveApps] = useLeaveApplications();
  const runs = usePayrollRuns()
    .filter((r) => inScope(r.orgId))
    .sort((a, b) => (a.period < b.period ? 1 : -1));
  const announcements = announcementsFor(useAnnouncements(), orgId);
  const today = todayIso();
  const ids = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);
  // Tenant scope — every people-linked store is filtered to the active entity's employees / the entity's tickets.
  const exits = useExitRequests().filter((x) => ids.has(x.empId));
  const promotions = usePromotions().filter((p) => ids.has(p.empId));
  const claims = reimbursementStore.use().filter((c) => ids.has(c.empId));
  const tickets = useTickets().filter((t) => inScope(t.orgId, t.requesterId));
  const presentToday = new Set(
    punches.filter((p) => p.date === today && ids.has(p.empId)).map((p) => p.empId),
  ).size;
  const onLeaveToday = leaveApps.filter(
    (l) => l.status === "Approved" && l.from <= today && l.to >= today && ids.has(l.empId),
  );
  const latestRun = runs[0];
  const inNotice = exits.filter((x) =>
    ["Manager Review", "HR Review", "Notice Period", "HR Clearance", "Final Settlement"].includes(
      x.stage,
    ),
  ).length;
  const pendingLeave = leaveApps.filter((l) => l.status === "Pending" && ids.has(l.empId)).length;
  const pendingClaims = claims.filter((c) => c.status === "Submitted");
  const pendingPromotions = promotions.filter(
    (p) => p.status === "Pending approval" || p.status === "Approved",
  ).length;
  const pendingExits = exits.filter(
    (x) => x.stage === "Manager Review" || x.stage === "HR Review",
  ).length;
  const unattended = tickets.filter(
    (t) => OPEN_STATUSES.includes(t.status) && slaState(t).resolve === "Breached",
  ).length;
  const payrollAwaiting = runs.filter((r) => r.status === "Pending Approval").length;

  const stats = [
    {
      label: "Total Employees",
      value: String(employees.length),
      delta: `${org?.name ?? ORGANIZATION.name}`,
      icon: Users,
      tone: "emerald",
      to: "/org/employees",
    },
    {
      label: "Present Today",
      value: String(presentToday),
      delta: employees.length
        ? `${Math.round((presentToday / employees.length) * 100)}% punched in`
        : "—",
      icon: Clock,
      tone: "emerald",
      to: "/org/attendance",
    },
    {
      label: "On Leave Today",
      value: String(onLeaveToday.length),
      delta: onLeaveToday.length
        ? onLeaveToday
            .map((l) => l.employee.split(" ")[0])
            .slice(0, 3)
            .join(", ")
        : "no approved leave today",
      icon: Plane,
      tone: "gold",
      to: "/org/leave",
    },
    {
      label: "Payroll (latest run)",
      value: latestRun ? inr(latestRun.totals.net) : "—",
      delta: latestRun ? `${periodLabel(latestRun.period)} · ${latestRun.status}` : "no runs",
      icon: DollarSign,
      tone: "emerald",
      to: "/org/finance",
    },
    {
      label: "Promotions in progress",
      value: String(pendingPromotions),
      delta: `${promotions.length} in cycle`,
      icon: TrendingUp,
      tone: "gold",
      to: "/org/employees",
    },
    {
      label: "Resignations",
      value: String(inNotice),
      delta: "in exit process",
      icon: UserMinus,
      tone: "danger",
      to: "/org/exits",
    },
    {
      label: "Announcements",
      value: String(announcements.length),
      delta: "published",
      icon: Megaphone,
      tone: "neutral",
      to: "/org/announcements",
    },
    // Only screens this role may open — a Manager / HOD card pointing at Payroll or Employees would land on Access Denied.
  ].filter((s) => canOpen(me.role, s.to));
  /** Chart-card deep link, dropped when the role cannot open the target screen. */
  const link = (path) => (canOpen(me.role, path) ? path : undefined);
  // Data visibility follows screen access: a Manager / HOD / CTO cannot open Finance or Compliance, but the dashboard
  // still showed them the entity's payroll cost trend, statutory remittances and filings (and hiring / asset data).
  const seesPayroll = canOpen(me.role, "/org/finance") || canOpen(me.role, "/org/payroll-reports");
  const seesCompliance = canOpen(me.role, "/org/compliance");
  const seesHiring = canOpen(me.role, "/org/recruitment");
  const seesExits = canOpen(me.role, "/org/exits");
  const seesAssets = canOpen(me.role, "/org/assets");
  const seesPeople = canOpen(me.role, "/org/employees") || canOpen(me.role, "/org/team");
  /* ---------------- ERP analytics (all from live stores) ---------------- */
  const candidates = useCandidates();
  const assets = useAssets();
  const filings = useFilings().filter((f) => inScope(f.orgId));
  const holidays = useHolidaysLegacy();
  const byDept = useMemo(
    () =>
      Object.entries(employees.reduce((m, e) => ((m[e.dept] = (m[e.dept] ?? 0) + 1), m), {}))
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    [employees],
  );
  const byBranch = useMemo(
    () =>
      Object.entries(
        employees.reduce((m, e) => ((m[e.branch] = (m[e.branch] ?? 0) + 1), m), {}),
      ).map(([name, value]) => ({ name, value })),
    [employees],
  );
  const byStatus = useMemo(
    () =>
      ["Active", "On Leave", "Notice"]
        .map((st) => ({ name: st, value: employees.filter((e) => e.status === st).length }))
        .filter((d) => d.value),
    [employees],
  );
  // Plain computation: it depends on the in-scope id set, which is rebuilt every render.
  const attendanceTrend = (() => {
    const [y, m] = ATTENDANCE_MONTH.split("-").map(Number);
    const out = [];
    for (let d = 1; d <= 31; d++) {
      const dt = new Date(y, m - 1, d);
      if (dt.getMonth() !== m - 1 || dt.getDay() === 0 || dt.getDay() === 6) continue;
      const isoD = `${ATTENDANCE_MONTH}-${String(d).padStart(2, "0")}`;
      let P = 0,
        L = 0,
        A = 0;
      // Only employees in the working scope (it counted every company's attendance roster).
      ATTENDANCE.filter((r) => ids.has(r.empId)).forEach((r) => {
        const st = punches.some((p) => p.empId === r.empId && p.date === isoD) ? "P" : r.days[isoD];
        if (st === "P") P++;
        else if (st === "L") L++;
        else A++;
      });
      out.push({ name: String(d), Present: P, Leave: L, Absent: A });
    }
    return out.slice(-12);
  })();
  const payrollTrend = useMemo(
    () =>
      [...runs]
        .filter((r) => r.status === "Processed" || r.status === "Paid")
        .sort((a, b) => (a.period < b.period ? -1 : 1))
        .map((r) => ({
          name: periodLabel(r.period).slice(0, 3),
          Gross: r.totals.earnedGross,
          Deductions: r.totals.deductions,
          Net: r.totals.net,
          "Employer cost": r.totals.employerCost,
        })),
    [runs],
  );
  const statutoryMix = latestRun
    ? [
        {
          name: "PF (EE+ER)",
          value:
            latestRun.totals.pfEmployee +
            latestRun.totals.vpf +
            latestRun.totals.pfEmployer +
            latestRun.totals.pfAdmin +
            latestRun.totals.edli,
        },
        { name: "ESI", value: latestRun.totals.esiEmployee + latestRun.totals.esiEmployer },
        { name: "Professional tax", value: latestRun.totals.pt },
        { name: "TDS", value: latestRun.totals.tds },
        { name: "NPS", value: latestRun.totals.npsEmployee + latestRun.totals.npsEmployer },
        { name: "LWF", value: latestRun.totals.lwfEmployee + latestRun.totals.lwfEmployer },
      ].filter((d) => d.value > 0)
    : [];
  const leaveByType = useMemo(() => {
    const types = Array.from(
      new Set(leaveApps.filter((l) => ids.has(l.empId)).map((l) => l.leaveType)),
    );
    return types.map((t) => {
      const rows = leaveApps.filter((l) => l.leaveType === t && ids.has(l.empId));
      return {
        name: t.replace(" Leave", "").replace(" (LOP)", ""),
        Approved: rows.filter((l) => l.status === "Approved").reduce((s, l) => s + l.days, 0),
        Pending: rows.filter((l) => l.status === "Pending").reduce((s, l) => s + l.days, 0),
        Rejected: rows.filter((l) => l.status === "Rejected").reduce((s, l) => s + l.days, 0),
      };
    });
  }, [leaveApps, ids]);
  const hiringFunnel = useMemo(
    () =>
      // The recruitment pipeline's real stages (the old Screening / Interview / Offer names never matched a record).
      ["Applied", "Shortlisted", "Interviewing", "Finalised", "Offered", "Onboarding"].map(
        (st) => ({
          name: st,
          value: candidates.filter((c) => c.stage === st).length,
        }),
      ),
    [candidates],
  );
  const exitPipeline = useMemo(
    () =>
      [
        "Manager Review",
        "HR Review",
        "Notice Period",
        "HR Clearance",
        "Final Settlement",
        "Exit Completed",
      ].map((st) => ({
        name: st,
        value: exits.filter((x) => x.stage === st).length,
      })),
    [exits],
  );
  const assetMix = useMemo(
    () =>
      Object.entries(
        assets
          .filter((a) => inScope(a.orgId))
          .reduce((m, a) => ((m[a.status] = (m[a.status] ?? 0) + 1), m), {}),
      ).map(([name, value]) => ({ name, value })),
    [assets, inScope],
  );
  // Helpdesk writes New / Assigned / In Progress / Waiting on Requester / Reopened / Resolved / Closed — the old
  // "Unattended" / "Attended" buckets never matched a real status and always showed zero.
  const ticketMix = useMemo(
    () =>
      [
        { name: "Unattended", match: (t) => t.status === "New" || !t.assigneeId },
        {
          name: "In progress",
          match: (t) => OPEN_STATUSES.includes(t.status) && t.status !== "New" && !!t.assigneeId,
        },
        {
          name: "Resolved / closed",
          match: (t) => t.status === "Resolved" || t.status === "Closed",
        },
      ].map(({ name, match }) => ({ name, value: tickets.filter(match).length })),
    [tickets],
  );
  const upcomingHolidays = holidays
    .filter((h) => h.from >= today)
    .sort((a, b) => (a.from < b.from ? -1 : 1))
    .slice(0, 4);
  const complianceRows = [...filings].sort((a, b) => (a.period < b.period ? 1 : -1)).slice(0, 6);

  const pendingApprovals = [
    {
      t: `${pendingLeave} leave request${pendingLeave === 1 ? "" : "s"}`,
      s: "Awaiting manager / HR decision",
      tone: pendingLeave ? "gold" : "emerald",
      to: "/org/leave",
    },
    {
      t: `${pendingClaims.length} expense claim${pendingClaims.length === 1 ? "" : "s"}`,
      s: pendingClaims.some((c) => c.amount > 25000)
        ? "Includes claims above ₹25,000"
        : "Within approval limits",
      tone: pendingClaims.some((c) => c.amount > 25000) ? "danger" : "emerald",
      to: "/org/claims",
    },
    {
      t: `${payrollAwaiting} payroll run${payrollAwaiting === 1 ? "" : "s"}`,
      s: "Pending finance approval",
      tone: payrollAwaiting ? "danger" : "emerald",
      to: "/org/finance",
    },
    {
      t: `${pendingExits} resignation review${pendingExits === 1 ? "" : "s"}`,
      s: "Manager review / HR clearance",
      tone: pendingExits ? "gold" : "emerald",
      to: "/org/exits",
    },
    {
      t: `${unattended} SLA-breached ticket${unattended === 1 ? "" : "s"}`,
      s: `${tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length} open on the helpdesk`,
      tone: unattended ? "gold" : "emerald",
      to: "/helpdesk",
    },
  ].filter((a) => canOpen(me.role, a.to));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {me.name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {me.designation} · {me.dept} — here is what's happening across{" "}
            {org?.legalName ?? ORGANIZATION.legalName} today.
          </p>
        </div>
        <div className="flex gap-2">
          {canOpen(me.role, "/org/announcements") && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/org/announcements">New announcement</Link>
            </Button>
          )}
          {canOpen(me.role, "/org/employees") && can(me.role, "employee.manage") && (
            <Button size="sm" className="bg-gradient-emerald shadow-premium text-white" asChild>
              <Link href="/org/employees">Add Employee</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const tone =
            s.tone === "gold"
              ? "bg-gold/15 text-gold"
              : s.tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : s.tone === "neutral"
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary";
          return (
            <Link href={s.to} key={s.label}>
              <Card className="shadow-card border-border/60 hover:shadow-premium h-full transition">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowUpRight className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                    <div className="text-muted-foreground mt-1 text-xs">{s.label}</div>
                    <div className="text-primary mt-2 text-[11px] font-semibold">{s.delta}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <ModuleExplorer portal="org" />

      <ProbationWidget />

      <CelebrationsWidget />

      {seesPeople && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ChartCard
            title="Headcount by department"
            to={link("/org/employees")}
            subtitle={`${employees.length} employees · ${byDept.length} departments`}
          >
            <DonutChart data={byDept} />
          </ChartCard>
          <ChartCard
            title="Headcount by location"
            to={canOpen(me.role, "/org/masters") ? "/org/infrastructure" : undefined}
            subtitle="Active employment records per branch"
          >
            <BarsChart data={byBranch} keys={[{ key: "value", label: "Employees" }]} horizontal />
          </ChartCard>
          <ChartCard
            title="Workforce status"
            to={link("/org/employees")}
            subtitle="Active · on leave · serving notice"
          >
            <DonutChart data={byStatus} />
          </ChartCard>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Daily attendance"
          to={link("/org/attendance")}
          subtitle={`Register + self-service punches · ${periodLabel(ATTENDANCE_MONTH)} (last 12 working days)`}
        >
          <BarsChart
            data={attendanceTrend}
            keys={[
              { key: "Present", label: "Present" },
              { key: "Leave", label: "Leave" },
              { key: "Absent", label: "Absent" },
            ]}
            stacked
            colors={["#0f766e", "#b8860b", "#dc2626"]}
          />
        </ChartCard>
        {seesPayroll && (
          <ChartCard
            title="Payroll cost trend"
            to={link("/org/finance")}
            subtitle="Processed runs — earned gross, deductions, net and employer cost"
          >
            {payrollTrend.length ? (
              <LinesChart
                data={payrollTrend}
                keys={[
                  { key: "Gross", label: "Earned gross" },
                  { key: "Net", label: "Net pay" },
                  { key: "Employer cost", label: "Employer cost" },
                ]}
                money
                area
              />
            ) : (
              <div className="text-muted-foreground grid h-60 place-items-center text-sm">
                No processed payroll yet.
              </div>
            )}
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {seesPayroll && (
          <ChartCard
            title="Statutory remittance mix"
            to={link("/org/compliance")}
            subtitle={
              latestRun
                ? `${periodLabel(latestRun.period)} · total ${inrShort(statutoryMix.reduce((sm, d) => sm + d.value, 0))}`
                : "—"
            }
          >
            {statutoryMix.length ? (
              <DonutChart data={statutoryMix} money />
            ) : (
              <div className="text-muted-foreground grid h-60 place-items-center text-sm">
                No processed payroll yet.
              </div>
            )}
          </ChartCard>
        )}
        <ChartCard
          title="Leave requests by type"
          to={link("/org/leave")}
          subtitle="Days requested this year, by decision"
        >
          <BarsChart
            data={leaveByType}
            keys={[
              { key: "Approved", label: "Approved" },
              { key: "Pending", label: "Pending" },
              { key: "Rejected", label: "Rejected" },
            ]}
            stacked
            colors={["#0f766e", "#b8860b", "#94a3b8"]}
          />
        </ChartCard>
        {seesHiring && (
          <ChartCard
            title="Hiring funnel"
            to={link("/org/recruitment")}
            subtitle={`${candidates.length} candidates in pipeline`}
          >
            <BarsChart
              data={hiringFunnel}
              keys={[{ key: "value", label: "Candidates" }]}
              colors={["#b8860b"]}
            />
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {seesExits && (
          <ChartCard
            title="Exit pipeline"
            to={link("/org/exits")}
            subtitle={`${exits.length} exit cases`}
          >
            <BarsChart
              data={exitPipeline}
              keys={[{ key: "value", label: "Cases" }]}
              colors={["#64748b"]}
            />
          </ChartCard>
        )}
        {seesAssets && (
          <ChartCard title="Asset register" to={link("/org/assets")} subtitle="By lifecycle status">
            <DonutChart data={assetMix} />
          </ChartCard>
        )}
        <ChartCard title="Support desk" to={link("/helpdesk")} subtitle="Tickets by status">
          <DonutChart data={ticketMix} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {seesCompliance && (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Statutory compliance status</CardTitle>
              <div className="text-muted-foreground text-xs">
                Latest filings — PF (ECR), ESI and TDS
              </div>
            </CardHeader>
            <CardContent className="divide-border divide-y">
              {complianceRows.map((f) => (
                <Link
                  href="/org/compliance"
                  key={f.id}
                  className="hover:bg-muted/30 flex items-center gap-3 rounded-md px-1 py-2.5"
                >
                  <div className="bg-gradient-emerald grid h-9 w-11 place-items-center rounded-md text-[10px] font-bold text-white">
                    {f.kind}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {periodLabel(f.period)} · {inr(f.totalAmount)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {f.memberCount} records · due{" "}
                      <span className="whitespace-nowrap">{f.dueOn}</span>
                      {f.referenceNo ? ` · ${f.referenceNo}` : ""}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${filingTone(f.status)} ${isOverdue(f) ? "border-destructive/40 text-destructive" : ""}`}
                  >
                    {f.status}
                    {isOverdue(f) ? " · overdue" : ""}
                  </Badge>
                </Link>
              ))}
              {complianceRows.length === 0 && (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  No filings yet.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming holidays</CardTitle>
            <div className="text-muted-foreground text-xs">
              From the holiday calendar shared with employees
            </div>
          </CardHeader>
          <CardContent className="divide-border divide-y">
            {upcomingHolidays.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-3">
                <div className="bg-gradient-emerald grid h-10 w-12 place-items-center rounded-lg text-center text-[10px] leading-tight font-bold text-white">
                  {/* "YYYY-MM-DD" parses as UTC midnight — format in UTC so no timezone shows the previous day. */}
                  {new Date(`${o.from}T00:00:00Z`).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{o.name}</div>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CalendarDays className="h-3 w-3" /> {o.from}
                    {o.to !== o.from ? ` → ${o.to}` : ""}
                  </div>
                </div>
                <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold border">
                  {o.type}
                </Badge>
              </div>
            ))}
            {upcomingHolidays.length === 0 && (
              <div className="text-muted-foreground py-6 text-center text-sm">
                No upcoming holidays.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.map((a, i) => (
              <Link
                href={a.to}
                key={i}
                className="border-border/70 hover:bg-muted/40 flex gap-3 rounded-lg border p-3 transition"
              >
                <div
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    a.tone === "danger"
                      ? "bg-destructive"
                      : a.tone === "gold"
                        ? "bg-gold"
                        : "bg-primary"
                  }`}
                />

                <div>
                  <div className="text-sm font-medium">{a.t}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">{a.s}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default OrgDashboard;
