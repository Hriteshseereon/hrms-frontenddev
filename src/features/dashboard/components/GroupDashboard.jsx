// Super Admin collective dashboard — every entity of the client's group side by side, with one-click switch into any company.
import Link from "@/lib/router";
import {
  Layers,
  Building2,
  Users,
  Wallet,
  DoorOpen,
  LifeBuoy,
  ArrowRight,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useGroups, useOrgs } from "@/features/organization/data/group-data";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { usePayrollRuns } from "@/features/payroll/data/payroll-engine";
import { useExitRequests } from "@/features/exit/data/exit-data";
import { OPEN_STATUSES, useTickets } from "@/features/helpdesk/data/helpdesk-data";
import { leaveOrgOf, useLeaveApplications } from "@/features/leave/data/leave-engine";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { userById } from "@/features/auth/data/auth-session";
import { useRetention } from "@/features/exit/data/separation-data";
import { inr } from "@/lib/store";
import { BarsChart, ChartCard, DonutChart } from "@/features/dashboard/components/Charts";
import { ModuleExplorer } from "@/features/dashboard/components/ModuleExplorer";
import { setActiveCompany } from "@/features/organization/data/tenancy";

export function GroupDashboard() {
  const me = useCurrentUser();
  // Reactive snapshots (accessibleOrgs()/groupOf() read the persisted stores directly — a hydration mismatch once an
  // entity had been created in the browser).
  const allOrgs = useOrgs();
  const groups = useGroups();
  const myGroupId = me.groupId ?? allOrgs.find((o) => o.id === me.orgId)?.groupId ?? null;
  const orgs = myGroupId
    ? allOrgs.filter((o) => o.groupId === myGroupId)
    : allOrgs.filter((o) => o.id === me.orgId);
  const group = groups.find((g) => g.id === myGroupId) ?? null;
  const orgIds = new Set(orgs.map((o) => o.id));
  const orgOfEmp = (id) => findEmployee(id)?.orgId ?? userById(id)?.orgId ?? "";
  const dir = useDirectory();
  const runs = usePayrollRuns();
  // Only this group's entities — exits, tickets and leave were counted across every client on the platform.
  const exits = useExitRequests().filter((e) => orgIds.has(orgOfEmp(e.empId)));
  const tickets = useTickets().filter((t) => orgIds.has(t.orgId));
  const [allLeave] = useLeaveApplications();
  const leave = allLeave.filter((l) => orgIds.has(leaveOrgOf(l)));
  const retention = useRetention().filter((r) => orgIds.has(orgOfEmp(r.empId)));
  const headcount = orgs.reduce(
    (t, o) => t + Math.max(o.employees, dir.filter((e) => e.orgId === o.id).length),
    0,
  );
  const payrollCost = orgs.reduce((t, o) => {
    const r = runs
      .filter((x) => x.orgId === o.id)
      .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
    return t + (r?.totals?.employerCost ?? 0);
  }, 0);
  // Per-entity figures (each bar used to show the group total divided by the number of entities).
  const perEntity = orgs.map((o) => ({
    name: o.name.replace("Seereon ", ""),
    Employees: Math.max(o.employees, dir.filter((e) => e.orgId === o.id).length),
    "Open tickets": tickets.filter((t) => t.orgId === o.id && OPEN_STATUSES.includes(t.status))
      .length,
    "Pending leave": leave.filter((l) => l.status === "Pending" && leaveOrgOf(l) === o.id).length,
  }));
  // Headcount share per company (the old "Entity status · Licences" donut was a vendor licensing leftover —
  // Trial / Suspended are not states of a company in a single organisation).
  const headcountShare = perEntity
    .map((e) => ({ name: e.name, value: e.Employees }))
    .filter((d) => d.value);
  const enter = (id, name) => {
    // Same path as the scope chip: resets the branch and persists the choice.
    setActiveCompany(id);
    toast.success(`Switched into ${name}`);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Layers className="text-gold h-6 w-6" /> {group?.name ?? "Group"} — collective view
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Welcome, {me.name}. Everything below aggregates the {orgs.length} entities in your
            group. Switch into any company from the top bar or the cards below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/org/roles">
              <ShieldCheck className="h-4 w-4" /> Roles &amp; permissions
            </Link>
          </Button>
          <Button size="sm" className="bg-gradient-emerald shadow-premium text-white" asChild>
            <Link href="/org/groups">
              <Plus className="h-4 w-4" /> Add entity / branch
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [Building2, "Entities", String(orgs.length), "/org/groups"],
          [Users, "Group headcount", headcount.toLocaleString("en-IN"), "/org/employees"],
          [Wallet, "Monthly employer cost", inr(payrollCost), "/org/finance"],
          [
            DoorOpen,
            "Live resignations · retained",
            `${exits.filter((e) => ["Manager Review", "HR Review", "Notice Period", "HR Clearance", "Final Settlement"].includes(e.stage)).length} · ${retention.filter((r) => r.status === "Retained").length}`,
            "/org/exits",
          ],
          [
            LifeBuoy,
            "Open helpdesk tickets",
            String(tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length),
            "/helpdesk",
          ],
        ].map(([Icon, k, v, to]) => (
          <Link href={to} key={k} className="block">
            <Card className="shadow-card hover:border-primary/40 h-full transition">
              <CardContent className="p-4">
                <div className="text-muted-foreground flex items-center gap-2 text-[11px] tracking-wider uppercase">
                  <Icon className="h-3.5 w-3.5" /> {k}
                </div>
                <div className="mt-1 text-2xl font-bold">{v}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Headcount by entity"
          subtitle="Employees · open tickets · pending leave"
          className="lg:col-span-2"
          to="/org/employees"
        >
          <BarsChart
            data={perEntity}
            keys={[
              { key: "Employees", label: "Employees" },
              { key: "Open tickets", label: "Open tickets" },
              { key: "Pending leave", label: "Pending leave" },
            ]}
            height={240}
          />
        </ChartCard>
        <ChartCard title="Headcount share" subtitle="Employees by company" to="/org/groups">
          <DonutChart data={headcountShare} height={240} />
        </ChartCard>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold">Entities in {group?.name}</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((o) => {
            const n = Math.max(o.employees, dir.filter((e) => e.orgId === o.id).length);
            const r = runs
              .filter((x) => x.orgId === o.id)
              .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
            return (
              <Card key={o.id} className="shadow-card">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{o.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {o.legalName} · {o.country}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        o.status === "Active" ? "border-primary/30 bg-primary/10 text-primary" : ""
                      }
                    >
                      {o.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted/40 rounded-lg p-2">
                      <div className="text-muted-foreground">Employees</div>
                      <div className="font-semibold">{n}</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <div className="text-muted-foreground">Last payroll</div>
                      <div className="font-semibold">{r ? r.period : "—"}</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <div className="text-muted-foreground">Modules</div>
                      <div className="font-semibold">{o.modules.length}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => enter(o.id, o.name)}
                  >
                    Open {o.name} <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <ModuleExplorer portal="org" />
    </div>
  );
}
