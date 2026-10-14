import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { BookOpen, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  personById,
  priorityTone,
  slaFor,
  useHelpdeskConfig,
} from "@/features/helpdesk/data/helpdesk-data";

/** Service catalogue — what each department handles, who owns it and the SLA. */
function Catalog() {
  const cfg = useHelpdeskConfig();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookOpen className="text-primary h-6 w-6" /> Service Catalogue
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Who handles what, and how fast. Click a category to raise a ticket pre-routed to that
          desk.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cfg.sla.map((s) => (
          <Card key={s.priority} className="shadow-card">
            <CardContent className="p-4">
              <Badge variant="outline" className={priorityTone(s.priority)}>
                {s.priority}
              </Badge>
              <div className="mt-2 text-sm">
                Respond ≤ <b>{s.firstResponseHours} h</b> · Resolve ≤ <b>{s.resolveHours} h</b>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {cfg.departments.map((d) => (
        <Card key={d.id} className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-start gap-3">
              <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-lg text-[11px] font-bold text-white">
                {d.id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{d.name}</div>
                <div className="text-muted-foreground text-xs">{d.description}</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  Head: <b className="text-foreground">{personById(d.headId)?.name}</b> · Agents:{" "}
                  {d.agentIds
                    .map((a) => personById(a)?.name)
                    .filter(Boolean)
                    .join(", ")}{" "}
                  · {d.mailbox} · {d.businessHours}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {d.categories.map((c) => (
                <Link
                  href={buildHref({ to: "/helpdesk/new", search: { dept: d.id, cat: c.id } })}
                  key={c.id}
                  className="border-border hover:bg-muted/30 group rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{c.name}</div>
                    <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4" />
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs">{c.description}</div>
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    Owner {personById(c.defaultAgentId ?? d.headId)?.name} · {c.defaultPriority} ·
                    resolve ≤ {slaFor(c.defaultPriority, cfg).resolveHours} h
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default Catalog;
