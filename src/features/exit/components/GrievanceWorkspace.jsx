import { useState } from "react";
import { Scale, Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { ROUTING, useGrievances } from "@/features/exit/data/grievance-data";
import {
  GrievanceCharts,
  GrievanceDetail,
  GrievanceKpis,
  GrievanceTable,
  RaiseGrievanceForm,
  useGrievanceFilter,
} from "@/features/exit/components/GrievancePieces";
import { useScopeMatch } from "@/features/organization/data/tenancy";

/** Grievance Redressal workspace. `embedded` hides the page heading (used by People → Complaints). */
export function GrievanceWorkspace({ embedded = false }) {
  const me = useCurrentUser();
  const all = useGrievances();
  const isHr = ["HR", "CHRO", "Admin", "SuperAdmin", "CEO"].includes(me.role);
  const dir = useDirectory();
  const scopeMatch = useScopeMatch();
  const scoped = all.filter(
    (g) => !dir.some((e) => e.id === g.empId) || scopeMatch(undefined, g.empId),
  );
  // Non-HR viewers (HOD / COO / CTO / CFO…) see only grievances routed to them as owner, or — for unit heads — the
  // "HR Head + Unit Head" cases of their own department. Previously every "Manager behaviour" case in the entity was
  // listed, including complaints about the viewer themselves; POSH cases stay with the Internal Committee.
  const isUnitHead = ["HOD", "COO", "CTO"].includes(me.role);
  // HR too: a grievance naming the viewer in "against" is handled by someone else.
  const visible = isHr
    ? scoped.filter((g) => !g.against?.toLowerCase().includes(me.name.toLowerCase()))
    : scoped.filter(
        (g) =>
          g.empId !== me.id &&
          g.category !== "Harassment (POSH)" &&
          (g.owner === me.name ||
            (isUnitHead &&
              g.committee.includes("Unit Head") &&
              (me.role !== "HOD" || g.dept === me.dept) &&
              !g.against.toLowerCase().includes(me.name.toLowerCase()))),
      );
  const [filter, setFilter] = useState("open");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [raise, setRaise] = useState(false);
  const rows = useGrievanceFilter(visible, filter).filter(
    (g) =>
      !q ||
      [g.id, g.employee, g.subject, g.category, g.dept]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const open = visible.find((g) => g.id === openId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {embedded ? (
          <p className="text-muted-foreground text-sm">
            Complaints are handled by the Grievance Redressal system: submitted → acknowledged (SLA)
            → committee investigation → resolution → employee confirmation or appeal → closed.
          </p>
        ) : (
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Scale className="text-primary h-6 w-6" /> Grievance Redressal
            </h1>
            <p className="text-muted-foreground text-sm">
              Submitted → acknowledged (SLA) → committee investigation → resolution → employee
              confirmation or appeal → closed. Click a KPI to filter.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <div className="border-border bg-muted/40 flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          {isHr && (
            <Button
              className="bg-gradient-emerald shadow-premium text-white"
              onClick={() => setRaise(true)}
            >
              <Plus className="h-4 w-4" /> Log on behalf
            </Button>
          )}
        </div>
      </div>
      <GrievanceKpis rows={visible} onFilter={(f) => setFilter(filter === f ? "all" : f)} />
      <GrievanceCharts rows={visible} />
      <div className="flex flex-wrap gap-1">
        {["all", "open", "overdue", "resolved", "closed", "posh", "appealed"].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className={filter === f ? "bg-gradient-emerald text-white" : ""}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>
      <GrievanceTable rows={rows} onOpen={setOpenId} />
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="mb-2 text-sm font-semibold">Routing &amp; SLA matrix (Master Data)</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {Object.entries(ROUTING).map(([c, r]) => (
              <div key={c} className="border-border rounded-lg border p-2 text-xs">
                <div className="font-medium">{c}</div>
                <div className="text-muted-foreground">
                  {r.committee} · {r.owner}
                </div>
                <div>
                  <Badge variant="outline">Ack {r.ackDays}d</Badge>{" "}
                  <Badge variant="outline">Resolve {r.resolveDays}d</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.subject}</SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <GrievanceDetail g={open} mode="hr" />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={raise} onOpenChange={setRaise}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log a grievance</DialogTitle>
            <DialogDescription>
              For grievances received offline (letter / walk-in). Routing and SLA are applied
              automatically.
            </DialogDescription>
          </DialogHeader>
          <RaiseGrievanceForm onBehalf onDone={() => setRaise(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
