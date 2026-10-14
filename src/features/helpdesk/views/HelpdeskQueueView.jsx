import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  OPEN_STATUSES,
  agentDepartments,
  canViewTicket,
  isHelpdeskAdmin,
  slaState,
  useHelpdeskConfig,
  useTickets,
  priorityTone,
  statusTone,
} from "@/features/helpdesk/data/helpdesk-data";
import { TicketTable, SlaChip } from "@/features/helpdesk/components/TicketPieces";

/** Agent work queue: my assignments, unassigned in my departments, breached, waiting. */
function Queue() {
  const me = useCurrentUser();
  const cfg = useHelpdeskConfig();
  const all = useTickets();
  const depts = isHelpdeskAdmin(me) ? cfg.departments : agentDepartments(me);
  const scope = useMemo(
    () => all.filter((t) => depts.some((d) => d.id === t.departmentId) && canViewTicket(me, t)),
    [all, depts, me],
  );
  const open = scope.filter((t) => OPEN_STATUSES.includes(t.status));
  const buckets = [
    { key: "mine", label: "Assigned to me", rows: open.filter((t) => t.assigneeId === me.id) },
    {
      key: "new",
      label: "New / unassigned",
      rows: open.filter((t) => t.status === "New" || !t.assigneeId),
    },
    {
      key: "breached",
      label: "SLA breached",
      rows: open.filter((t) => slaState(t).resolve === "Breached"),
      bad: true,
    },
    { key: "risk", label: "At risk", rows: open.filter((t) => slaState(t).resolve === "At risk") },
    {
      key: "waiting",
      label: "Waiting on requester",
      rows: open.filter((t) => t.status === "Waiting on Requester"),
    },
    {
      key: "reopened",
      label: "Reopened",
      rows: open.filter((t) => t.status === "Reopened"),
      bad: true,
    },
  ];
  const [bucket, setBucket] = useState("mine");
  const current = buckets.find((b) => b.key === bucket) ?? buckets[0];
  if (depts.length === 0)
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-10 text-center">
          You are not an agent of any service department.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Inbox className="text-primary h-6 w-6" /> Team Queue
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {depts.map((d) => d.name).join(" · ")} — work the queue oldest-breach first.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {buckets.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              bucket === b.key
                ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                : "border-border hover:bg-muted/30",
            )}
          >
            <div className={cn("text-2xl font-bold", b.bad && b.rows.length && "text-destructive")}>
              {b.rows.length}
            </div>
            <div className="text-muted-foreground text-xs">{b.label}</div>
          </button>
        ))}
      </div>
      <TicketTable tickets={current.rows} emptyText={`Nothing in "${current.label}".`} />
      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 text-sm font-semibold">Oldest open tickets in your departments</div>
          <div className="divide-border divide-y">
            {[...open]
              .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
              .slice(0, 6)
              .map((t) => (
                <Link
                  href={buildHref({ to: "/helpdesk/tickets/$id", params: { id: t.id } })}
                  key={t.id}
                  className="hover:bg-muted/30 flex items-center gap-3 rounded px-1 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.subject}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {t.id} · {t.requesterName} · {t.assigneeName ?? "Unassigned"}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Queue;
