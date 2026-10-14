import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useMemo } from "react";
import { PlusCircle, Ticket, Inbox, Timer, Star, LifeBuoy, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  OPEN_STATUSES,
  agentDepartments,
  canViewTicket,
  isHelpdeskAdmin,
  slaState,
  useHelpdeskConfig,
  useTickets,
  statusTone,
  priorityTone,
} from "@/features/helpdesk/data/helpdesk-data";
import { ChartCard, DonutChart, BarsChart } from "@/features/dashboard/components/Charts";
import { SlaChip } from "@/features/helpdesk/components/TicketPieces";

function Overview() {
  const me = useCurrentUser();
  const tickets = useTickets();
  const cfg = useHelpdeskConfig();
  const depts = agentDepartments(me);
  const admin = isHelpdeskAdmin(me);
  const mine = tickets.filter(
    (t) =>
      t.requesterId === me.id || t.watchers.some((w) => w.id === me.id) || t.onBehalfOfId === me.id,
  );
  const scope = (
    admin
      ? tickets
      : depts.length
        ? tickets.filter((t) => depts.some((d) => d.id === t.departmentId))
        : mine
  ).filter((t) => canViewTicket(me, t));
  const open = scope.filter((t) => OPEN_STATUSES.includes(t.status));
  const breached = open.filter((t) => slaState(t).resolve === "Breached");
  const resolved = scope.filter((t) => t.status === "Resolved" || t.status === "Closed");
  const avgHours = resolved.length
    ? Math.round(
        resolved.reduce(
          (s, t) =>
            s +
            (+new Date(t.resolvedAt ?? t.closedAt ?? t.updatedAt) - +new Date(t.createdAt)) /
              3600_000,
          0,
        ) / resolved.length,
      )
    : 0;
  const rated = scope.filter((t) => t.satisfaction);
  const csat = rated.length
    ? (rated.reduce((s, t) => s + (t.satisfaction?.rating ?? 0), 0) / rated.length).toFixed(1)
    : "—";

  // Counts come from the tickets this person may see — the chart used to count every ticket on the desk
  // (other companies' and confidential grievances included) for every employee.
  const byDept = useMemo(
    () =>
      cfg.departments.map((d) => ({
        name: d.name.replace(" & ", " / "),
        Open: scope.filter((t) => t.departmentId === d.id && OPEN_STATUSES.includes(t.status))
          .length,
        Resolved: scope.filter((t) => t.departmentId === d.id && !OPEN_STATUSES.includes(t.status))
          .length,
      })),
    [scope, cfg],
  );
  const byStatus = useMemo(
    () =>
      ["New", "Assigned", "In Progress", "Waiting on Requester", "Reopened", "Resolved", "Closed"]
        .map((s) => ({ name: s, value: scope.filter((t) => t.status === s).length }))
        .filter((d) => d.value),
    [scope],
  );
  const byPriority = useMemo(
    () =>
      ["Critical", "High", "Medium", "Low"]
        .map((p) => ({ name: p, value: open.filter((t) => t.priority === p).length }))
        .filter((d) => d.value),
    [open],
  );

  const kpis = [
    {
      l: admin || depts.length ? "Open in scope" : "My open tickets",
      v: String(open.length),
      s: `${scope.length} total`,
      i: Ticket,
      to: admin || depts.length ? "/helpdesk/queue" : "/helpdesk/tickets",
    },
    {
      l: "SLA breached",
      v: String(breached.length),
      s: breached.length ? "needs attention" : "all within SLA",
      i: Timer,
      to: admin || depts.length ? "/helpdesk/queue" : "/helpdesk/tickets",
      bad: breached.length > 0,
    },
    {
      l: "Avg. resolution",
      v: avgHours ? `${avgHours} h` : "—",
      s: `${resolved.length} resolved`,
      i: Inbox,
      // Requesters cannot open All Tickets (agents / desk admins only) — send them to their own list.
      to: admin || depts.length ? "/helpdesk/all" : "/helpdesk/tickets",
    },
    {
      l: "CSAT",
      v: csat,
      s: `${rated.length} rating${rated.length === 1 ? "" : "s"}`,
      i: Star,
      to: admin || depts.length ? "/helpdesk/all" : "/helpdesk/tickets",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LifeBuoy className="text-primary h-6 w-6" /> Service Desk
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Raise a request with the right department and the concerned person. Every ticket carries
            an SLA clock, an owner and a full conversation trail.
          </p>
        </div>
        <Button className="bg-gradient-emerald shadow-premium text-white" asChild>
          <Link href={buildHref({ to: "/helpdesk/new", search: { dept: undefined } })}>
            <PlusCircle className="h-4 w-4" /> Raise a Ticket
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link href={k.to} key={k.l}>
            <Card className="shadow-card hover:shadow-premium h-full transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl ${k.bad ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                  >
                    <k.i className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="text-muted-foreground h-4 w-4" />
                </div>
                <div className="mt-4 text-2xl font-bold">{k.v}</div>
                <div className="text-muted-foreground text-xs">{k.l}</div>
                <div className="text-primary mt-1 text-[11px] font-semibold">{k.s}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title="Tickets by service department"
          subtitle={admin ? "Open vs resolved across the desk" : "Open vs resolved in your view"}
          className="lg:col-span-1"
        >
          <BarsChart
            data={byDept}
            keys={[
              { key: "Open", label: "Open" },
              { key: "Resolved", label: "Resolved" },
            ]}
            stacked
            horizontal
            height={230}
          />
        </ChartCard>
        <ChartCard
          title="Status distribution"
          subtitle={admin ? "Whole desk" : depts.length ? "Your departments" : "Your tickets"}
        >
          <DonutChart data={byStatus} height={230} />
        </ChartCard>
        <ChartCard title="Open tickets by priority" subtitle="Drives the SLA clock">
          <DonutChart data={byPriority} height={230} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">My recent tickets</div>
              <Link href="/helpdesk/tickets" className="text-primary text-xs hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-border divide-y">
              {mine
                .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
                .slice(0, 5)
                .map((t) => (
                  <Link
                    href={buildHref({ to: "/helpdesk/tickets/$id", params: { id: t.id } })}
                    key={t.id}
                    className="hover:bg-muted/30 flex items-center gap-3 rounded-md px-1 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.subject}</div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {t.id} · {t.assigneeName ?? "Unassigned"}
                      </div>
                    </div>
                    <Badge variant="outline" className={priorityTone(t.priority)}>
                      {t.priority}
                    </Badge>
                    <Badge variant="outline" className={statusTone(t.status)}>
                      {t.status}
                    </Badge>
                    <SlaChip t={t} />
                  </Link>
                ))}
              {mine.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  You have not raised any tickets yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-3 font-semibold">Service departments</div>
            <div className="space-y-2">
              {cfg.departments.map((d) => {
                const o = scope.filter(
                  (t) => t.departmentId === d.id && OPEN_STATUSES.includes(t.status),
                ).length;
                return (
                  <Link
                    href={buildHref({ to: "/helpdesk/new", search: { dept: d.id } })}
                    key={d.id}
                    className="border-border hover:bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="bg-gradient-emerald grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white">
                      {d.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-muted-foreground truncate text-xs">{d.description}</div>
                    </div>
                    <div className="text-muted-foreground w-full pl-12 text-xs sm:w-auto sm:pl-0 sm:text-right">
                      {o} open · {d.businessHours}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Overview;
