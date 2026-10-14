// HOD and HR facing view of the Self → HOD → HR appraisal workflow. Whoever
// is logged in sees the record set scoped to their role: an HOD sees the
// appraisals awaiting their decision, HR sees everything awaiting HR
// finalization, and everyone can browse the full org-wide list read-only.
import { useState } from "react";
import { ClipboardList, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  useAppraisalWorkflows,
  useAppraisalsForHod,
  useMyAppraisals,
  stageTone,
  startAppraisalCycle,
} from "@/features/performance/data/appraisal-workflow-data";
import { REVIEW_CYCLE_ROWS } from "@/features/performance/data/performance-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { AppraisalCard } from "@/features/performance/components/AppraisalCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, EmployeePicker, useScopedIds } from "@/features/employees/components/CasePieces";
import { usePerformanceScope } from "@/features/performance/components/scope";
import { clickableRow } from "@/components/common/RecordDetail";

const ACTIVE_CYCLES = REVIEW_CYCLE_ROWS.filter((c) => c.status !== "Inactive").map((c) =>
  String(c.name),
);

/** HR starts a cycle for one employee — the record opens at the Self Appraisal stage and the employee is notified. */
function StartCycleDialog({ open, onClose, existing }) {
  const [empId, setEmpId] = useState("");
  const [cycle, setCycle] = useState(ACTIVE_CYCLES[0] ?? "");
  const duplicate = existing.some((r) => r.employeeId === empId && r.cycle === cycle);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start appraisal cycle</DialogTitle>
          <DialogDescription>
            Self appraisal → HOD appraisal → HR appraisal. The employee fills the self-assessment
            first; their HOD is resolved from the department master.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Employee" required>
            <EmployeePicker value={empId} onChange={(id) => setEmpId(id)} />
          </Field>
          <Field label="Review cycle" required>
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_CYCLES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {duplicate && (
            <div className="text-destructive text-xs">
              A cycle for this employee and review cycle already exists.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={!empId || !cycle || duplicate}
            onClick={() => {
              const row = startAppraisalCycle(empId, cycle);
              pushAlert({
                empId,
                kind: "review",
                to: "/emp/appraisals",
                title: `${cycle} — self appraisal open`,
                body: `Complete your self appraisal (${row.id}); it then goes to ${row.hodName} and HR.`,
              });
              toast.success(`${row.id} started for ${row.employeeName} — self appraisal stage`);
              setEmpId("");
              onClose();
            }}
          >
            <Plus className="h-4 w-4" /> Start cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Employee-portal view of the staged cycle: the Self Appraisal stage is editable here, later stages are read-only.
 * Mount on /emp/appraisals — without it an HR-started cycle can never leave the Self Appraisal stage.
 */
export function MyAppraisalCycles({ employeeId }) {
  const rows = useMyAppraisals(employeeId);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ClipboardList className="text-primary h-4 w-4" /> Appraisal cycles (Self → HOD → HR)
      </div>
      {rows.map((r) => (
        <AppraisalCard key={r.id} record={r} viewerId={employeeId} viewerRole="Self" />
      ))}
    </div>
  );
}

export function AppraisalWorkflowTab() {
  const me = useCurrentUser();
  // Entity scope from the employee directory (the login roster missed every directory-only employee, so cycles HR
  // started for them vanished from this list); managers / HODs only browse their own people plus their HOD queue.
  const orgEmployeeIds = useScopedIds();
  const perf = usePerformanceScope();
  const allOrgRows = useAppraisalWorkflows().filter(
    (r) =>
      orgEmployeeIds.has(r.employeeId) &&
      (perf.orgWide || perf.canSee(r.employeeId) || r.hodId === me.id),
  );
  const hodQueue = useAppraisalsForHod(me.id).filter((r) => orgEmployeeIds.has(r.employeeId));
  // Not your own, and not one you rated at the HOD stage (maker-checker).
  const hrQueue = allOrgRows.filter(
    (r) => r.stage === "HR Appraisal" && r.employeeId !== me.id && r.hod.submittedBy !== me.id,
  );
  const canActAsHr =
    me.role === "HR" ||
    me.role === "CHRO" ||
    me.role === "Admin" ||
    me.role === "SuperAdmin" ||
    me.role === "CEO";
  // A record whose HOD could not be resolved would never leave the HOD stage — HR reviews it in the HOD's place.
  const orphanHod = canActAsHr
    ? allOrgRows.filter((r) => r.stage === "HOD Appraisal" && !r.hodId && r.employeeId !== me.id)
    : [];
  const myHodQueue = [...hodQueue, ...orphanHod];

  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [startOpen, setStartOpen] = useState(false);

  const filtered = allOrgRows.filter((r) => {
    const matchesQ = [r.id, r.employeeName, r.cycle]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase());
    const matchesStage = stageFilter === "all" || r.stage === stageFilter;
    return matchesQ && matchesStage;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Awaiting my HOD action
            </div>
            <div className="mt-1 text-xl font-bold">{myHodQueue.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Awaiting HR
            </div>
            <div className="mt-1 text-xl font-bold">{hrQueue.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Completed
            </div>
            <div className="mt-1 text-xl font-bold">
              {allOrgRows.filter((r) => r.stage === "Completed").length}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Total cycles started
            </div>
            <div className="mt-1 text-xl font-bold">{allOrgRows.length}</div>
          </CardContent>
        </Card>
      </div>

      {myHodQueue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="text-primary h-4 w-4" /> Awaiting your HOD review
          </div>
          {myHodQueue.map((r) => (
            <AppraisalCard key={r.id} record={r} viewerId={me.id} viewerRole="HOD" />
          ))}
        </div>
      )}

      {canActAsHr && hrQueue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="text-primary h-4 w-4" /> Awaiting HR final review
          </div>
          {hrQueue.map((r) => (
            <AppraisalCard key={r.id} record={r} viewerId={me.id} viewerRole="HR" />
          ))}
        </div>
      )}

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <ClipboardList className="text-primary h-4 w-4" /> All appraisal cycles
            <span className="text-muted-foreground font-normal">
              — every cycle across the organisation, at any stage.
            </span>
            {canActAsHr && (
              <Button
                size="sm"
                className="bg-gradient-emerald shadow-premium ml-auto text-white"
                onClick={() => setStartOpen(true)}
              >
                <Plus className="h-4 w-4" /> Start cycle
              </Button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search employee or cycle…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                <SelectItem value="Self Appraisal">Self Appraisal</SelectItem>
                <SelectItem value="HOD Appraisal">HOD Appraisal</SelectItem>
                <SelectItem value="HR Appraisal">HR Appraisal</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Cycle</th>
                  <th className="p-3 text-left">HOD</th>
                  <th className="p-3 text-left">Stage</th>
                  <th className="p-3 text-left">Started</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground p-8 text-center">
                      No appraisal cycles yet.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className={clickableRow} onClick={() => setDetail(r)}>
                    <td className="p-3 font-medium">{r.employeeName}</td>
                    <td className="text-muted-foreground p-3">{r.cycle}</td>
                    <td className="text-muted-foreground p-3">{r.hodName}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={stageTone(r.stage)}>
                        {r.stage}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground p-3">
                      <span className="whitespace-nowrap">{r.createdOn}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {detail && (
            <AppraisalCard
              record={allOrgRows.find((r) => r.id === detail.id) ?? detail}
              viewerId={me.id}
              viewerRole="ReadOnly"
            />
          )}
        </DialogContent>
      </Dialog>
      {startOpen && (
        <StartCycleDialog open onClose={() => setStartOpen(false)} existing={allOrgRows} />
      )}
    </div>
  );
}
