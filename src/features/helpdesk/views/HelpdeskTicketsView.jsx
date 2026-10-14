import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { Ticket, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useTickets } from "@/features/helpdesk/data/helpdesk-data";
import { TicketTable } from "@/features/helpdesk/components/TicketPieces";

function MyTickets() {
  const me = useCurrentUser();
  const tickets = useTickets().filter(
    (t) =>
      t.requesterId === me.id || t.onBehalfOfId === me.id || t.watchers.some((w) => w.id === me.id),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Ticket className="text-primary h-6 w-6" /> My Tickets
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Requests you raised, raised on your behalf, or are watching.
          </p>
        </div>
        <Button className="bg-gradient-emerald text-white" asChild>
          <Link href={buildHref({ to: "/helpdesk/new", search: { dept: undefined } })}>
            <PlusCircle className="h-4 w-4" /> Raise a Ticket
          </Link>
        </Button>
      </div>
      <TicketTable
        tickets={tickets}
        showRequester={false}
        emptyText="No tickets yet — raise one to reach the right department."
      />
    </div>
  );
}

export default MyTickets;
