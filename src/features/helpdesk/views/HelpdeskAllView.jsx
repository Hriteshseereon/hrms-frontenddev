import { Users, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  agentDepartments,
  canViewTicket,
  isHelpdeskAdmin,
  slaState,
  useHelpdeskConfig,
  useTickets,
} from "@/features/helpdesk/data/helpdesk-data";
import { TicketTable } from "@/features/helpdesk/components/TicketPieces";
import { exportCsv } from "@/lib/export-utils";

function AllTickets() {
  const me = useCurrentUser();
  const cfg = useHelpdeskConfig();
  const all = useTickets();
  const admin = isHelpdeskAdmin(me);
  const depts = admin ? cfg.departments : agentDepartments(me);
  // Confidential (grievance) tickets only for the people allowed to see them.
  const rows = all.filter(
    (t) => depts.some((d) => d.id === t.departmentId) && canViewTicket(me, t),
  );
  if (!admin && depts.length === 0)
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-10 text-center">
          Only agents and desk admins can view all tickets.
        </CardContent>
      </Card>
    );
  const exportAll = () => {
    exportCsv(
      "helpdesk-tickets",
      [
        "Ticket",
        "Subject",
        "Department",
        "Category",
        "Priority",
        "Impact",
        "Status",
        "Requester",
        "Assignee",
        "Created",
        "Resolved",
        "SLA",
        "Rating",
      ],
      rows.map((t) => [
        t.id,
        t.subject,
        cfg.departments.find((d) => d.id === t.departmentId)?.name ?? t.departmentId,
        t.categoryId,
        t.priority,
        t.impact,
        t.status,
        t.requesterName,
        t.assigneeName ?? "",
        t.createdAt,
        t.resolvedAt ?? "",
        slaState(t).resolve,
        t.satisfaction?.rating ?? "",
      ]),
    );
    toast.success("Ticket register exported");
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="text-primary h-6 w-6" /> All Tickets
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {admin ? "Whole desk" : depts.map((d) => d.name).join(" · ")} · full register with SLA
            state.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportAll}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>
      <TicketTable tickets={rows} />
    </div>
  );
}

export default AllTickets;
