import { useState, useEffect, useMemo, useCallback } from "react";
import { Scale, Plus, Search, AlertTriangle, ShieldCheck, Clock, CheckCircle2, Star, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ROUTING, useGrievances, isOverdue } from "@/features/exit/data/grievance-data";
import {
  GrievanceCharts,
  GrievanceDetail,
  GrievanceTable,
  RaiseGrievanceForm,
} from "@/features/exit/components/GrievancePieces";
import { useScopeMatch } from "@/features/organization/data/tenancy";
import { grievanceApi } from "@/api/grievanceApi";
import { cn } from "@/lib/utils";

/** Grievance Redressal workspace. `embedded` hides the page heading (used by People → Complaints). */
export function GrievanceWorkspace({ embedded = false }) {
  const me = useCurrentUser();
  const mockAll = useGrievances();
  const isHr = ["HR", "CHRO", "Admin", "SuperAdmin", "CEO"].includes(me.role);
  const dir = useDirectory();
  const scopeMatch = useScopeMatch();

  const [loading, setLoading] = useState(false);
  const [apiRows, setApiRows] = useState(null);
  const [apiStats, setApiStats] = useState(null);
  const [routingData, setRoutingData] = useState(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [raise, setRaise] = useState(false);

  // Load Admin Grievances & Stats
  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [grievancesRes, statsRes, routingRes] = await Promise.allSettled([
        grievanceApi.getAdminGrievances(),
        grievanceApi.getStats(),
        grievanceApi.getRouting(),
      ]);

      if (grievancesRes.status === "fulfilled" && grievancesRes.value) {
        setApiRows(grievancesRes.value.items || grievancesRes.value);
      }
      if (statsRes.status === "fulfilled" && statsRes.value) {
        setApiStats(statsRes.value);
      }
      if (routingRes.status === "fulfilled" && routingRes.value) {
        setRoutingData(routingRes.value);
      }
    } catch {
      // Fallback to local store
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Combined Rows
  const allRows = useMemo(() => {
    return apiRows !== null ? apiRows : mockAll;
  }, [apiRows, mockAll]);

  const scoped = useMemo(() => {
    return allRows.filter(
      (g) => !dir.some((e) => e.id === (g.empId || g.employee_id)) || scopeMatch(undefined, g.empId || g.employee_id),
    );
  }, [allRows, dir, scopeMatch]);

  const isUnitHead = ["HOD", "COO", "CTO"].includes(me.role);

  // Scoped Visibility
  const visible = useMemo(() => {
    return isHr
      ? scoped.filter((g) => !g.against?.toLowerCase().includes(me.name.toLowerCase()))
      : scoped.filter(
          (g) =>
            (g.empId || g.employee_id) !== me.id &&
            g.category !== "Harassment (POSH)" &&
            (g.owner === me.name ||
              g.owner_name === me.name ||
              (isUnitHead &&
                g.committee?.includes("Unit Head") &&
                (me.role !== "HOD" || g.dept === me.dept) &&
                !g.against?.toLowerCase().includes(me.name.toLowerCase()))),
        );
  }, [isHr, scoped, me, isUnitHead]);

  // Filtered Rows
  const rows = useMemo(() => {
    return visible.filter((g) => {
      const gStatus = (g.status || "").toLowerCase();
      const matchStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "open"
            ? !["closed", "withdrawn"].includes(gStatus)
            : statusFilter === "overdue"
              ? isOverdue(g)
              : statusFilter === "posh"
                ? g.category === "Harassment (POSH)"
                : gStatus === statusFilter.toLowerCase();

      const matchSeverity =
        severityFilter === "all" ? true : g.severity?.toLowerCase() === severityFilter.toLowerCase();

      const matchOverdue = overdueOnly ? isOverdue(g) : true;

      const matchQ =
        !q ||
        [g.code || g.id, g.employee || g.display_name, g.subject, g.category, g.dept || g.department]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase());

      return matchStatus && matchSeverity && matchOverdue && matchQ;
    });
  }, [visible, statusFilter, severityFilter, overdueOnly, q]);

  // Computed / API Stats
  const stats = useMemo(() => {
    if (apiStats) return apiStats;
    const openGrievances = visible.filter((g) => !["Closed", "Withdrawn"].includes(g.status));
    const overdueGrievances = visible.filter(isOverdue);
    const resolvedGrievances = visible.filter((g) => g.resolvedOn || g.resolved_on);
    const avgDays = resolvedGrievances.length
      ? (
          resolvedGrievances.reduce((acc, g) => {
            const start = new Date(g.raisedOn || g.raised_on);
            const end = new Date(g.resolvedOn || g.resolved_on);
            return acc + Math.max(0, Math.round((end - start) / 86400000));
          }, 0) / resolvedGrievances.length
        ).toFixed(1)
      : 5.4;
    const rated = visible.filter((g) => g.employeeRating || g.employee_rating);
    const csat = rated.length
      ? (
          rated.reduce((t, g) => t + (g.employeeRating || g.employee_rating || 0), 0) / rated.length
        ).toFixed(1)
      : 4.6;

    return {
      totalOpen: openGrievances.length,
      slaBreached: overdueGrievances.length,
      avgDaysToResolve: Number(avgDays),
      csatRating: Number(csat),
      poshCases: visible.filter((g) => g.category === "Harassment (POSH)").length,
      appealsCount: visible.filter((g) => g.status === "Appealed").length,
    };
  }, [apiStats, visible]);

  const openItem = visible.find((g) => g.id === openId || g.code === openId);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
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
              confirmation or appeal → closed.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {isHr && (
            <Button
              className="bg-gradient-emerald shadow-premium text-white font-medium text-xs h-9"
              onClick={() => setRaise(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Log on behalf
            </Button>
          )}
        </div>
      </div>

      {/* 2. Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          {
            label: "Total Open",
            value: stats.totalOpen,
            filter: "open",
            tone: "text-amber-500",
            bg: "bg-amber-500/10",
          },
          {
            label: "SLA Breached",
            value: stats.slaBreached,
            filter: "overdue",
            tone: stats.slaBreached > 0 ? "text-destructive font-bold" : "text-emerald-500",
            bg: stats.slaBreached > 0 ? "bg-destructive/10 border-destructive/30" : "bg-emerald-500/10",
            highlight: stats.slaBreached > 0,
          },
          {
            label: "Avg Days to Resolve",
            value: `${stats.avgDaysToResolve}d`,
            filter: "resolved",
            tone: "text-foreground",
            bg: "bg-muted/30",
          },
          {
            label: "CSAT Score",
            value: `${stats.csatRating} / 5`,
            filter: "closed",
            tone: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "POSH Cases (IC)",
            value: stats.poshCases,
            filter: "posh",
            tone: "text-purple-500",
            bg: "bg-purple-500/10",
          },
          {
            label: "Appeals (CHRO)",
            value: stats.appealsCount,
            filter: "appealed",
            tone: stats.appealsCount > 0 ? "text-destructive" : "text-muted-foreground",
            bg: "bg-muted/30",
          },
        ].map((kpi, i) => (
          <Card
            key={i}
            className={cn(
              "shadow-card cursor-pointer hover:border-primary/40 transition-all border",
              kpi.highlight && "border-destructive/40 shadow-sm"
            )}
            onClick={() => setStatusFilter(statusFilter === kpi.filter ? "all" : kpi.filter)}
          >
            <CardContent className="p-3.5 space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {kpi.label}
              </div>
              <div className={cn("text-2xl font-bold", kpi.tone)}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. Analytics Charts */}
      <GrievanceCharts rows={visible} />

      {/* 4. Filter Toolbar & Multi-Select Controls */}
      <Card className="shadow-card border-border/80">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {["all", "open", "overdue", "resolved", "closed", "posh", "appealed"].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? "default" : "outline"}
                  className={cn("text-xs h-8 px-3", statusFilter === f ? "bg-gradient-emerald text-white" : "")}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === "posh" ? "POSH (IC)" : f[0].toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>

            {/* Overdue Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="overdue-only"
                checked={overdueOnly}
                onCheckedChange={(c) => setOverdueOnly(Boolean(c))}
              />
              <label htmlFor="overdue-only" className="text-xs font-medium cursor-pointer flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Show SLA Breaches Only
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border">
            {/* Severity Filter Badges */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium mr-1">Severity:</span>
              {["all", "Low", "Medium", "High", "Critical"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                    severityFilter === s
                      ? "bg-foreground text-background font-semibold"
                      : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search reference, employee, subject…"
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Grievances Register Table */}
      <GrievanceTable rows={rows} onOpen={setOpenId} />

      {/* 6. Routing & SLA Matrix (Master Data) */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="mb-2 text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Routing &amp; SLA Matrix (Master Data)
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {Object.entries(ROUTING).map(([c, r]) => (
              <div key={c} className="border-border rounded-lg border p-2.5 text-xs bg-muted/10 space-y-1">
                <div className="font-semibold text-foreground">{c}</div>
                <div className="text-muted-foreground text-[11px]">
                  {r.committee} · <b className="text-foreground">{r.owner}</b>
                </div>
                <div className="flex gap-1 pt-0.5">
                  <Badge variant="outline" className="text-[10px]">Ack {r.ackDays}d</Badge>
                  <Badge variant="outline" className="text-[10px]">Resolve {r.resolveDays}d</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 7. Grievance Detail Sheet */}
      <Sheet open={!!openItem} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl p-6">
          {openItem && (
            <>
              <SheetHeader className="border-b border-border pb-3">
                <SheetTitle className="text-lg font-bold">{openItem.subject}</SheetTitle>
              </SheetHeader>
              <div className="pt-4">
                <GrievanceDetail
                  g={openItem}
                  mode="hr"
                  onRefresh={loadAdminData}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 8. Log On Behalf Dialog */}
      <Dialog open={raise} onOpenChange={setRaise}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log a Grievance on Behalf of Employee</DialogTitle>
            <DialogDescription>
              For grievances received offline (letter, email, or walk-in). Routing and SLA deadlines are applied automatically.
            </DialogDescription>
          </DialogHeader>
          <RaiseGrievanceForm
            onBehalf
            onDone={() => {
              setRaise(false);
              loadAdminData();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GrievanceWorkspace;
