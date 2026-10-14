import { useMemo, useState } from "react";
import { Workflow, Plus, Check, X, RotateCcw, Trash2, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPROVAL_MODULES,
  APPROVER_ROLES,
  addWorkflow,
  updateWorkflow,
  deleteWorkflow,
  workflowStore,
  approvalStore,
  actOnApproval,
  canActOnApproval,
  resubmitApproval,
} from "@/features/administration/data/approval-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useScopedIds } from "@/features/employees/components/CasePieces";

const tone = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Rework"
        ? "border-gold/40 bg-gold/15 text-gold"
        : "border-border bg-muted text-muted-foreground";

export function ApprovalsWorkspace() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Workflow className="text-primary h-6 w-6" /> Approval Engine
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure the approval hierarchy for every request type, then track requests as they move
          level by level.
        </p>
      </div>

      <Tabs defaultValue="inbox">
        <ScrollTabsList>
          <TabsTrigger value="inbox">
            <Check className="h-4 w-4" /> Approval Inbox
          </TabsTrigger>
          <TabsTrigger value="workflows">
            <Workflow className="h-4 w-4" /> Workflow Configuration
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="inbox" className="pt-4">
          <Inbox />
        </TabsContent>
        <TabsContent value="workflows" className="pt-4">
          <Workflows />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ inbox */

function Inbox() {
  const me = useCurrentUser();
  const all = approvalStore.use();
  // Tenant scope — requests raised by employees of the active entity (whole group for a Super Admin in group view).
  const scopedIds = useScopedIds();
  const rows = useMemo(() => all.filter((r) => scopedIds.has(r.requestedBy)), [all, scopedIds]);
  const [mod, setMod] = useState("all");
  const [status, setStatus] = useState("all");
  const [act, setAct] = useState(null);
  const awaitingMe = rows.filter((r) => canActOnApproval(r, me)).length;
  const [remarks, setRemarks] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (mod === "all" || r.module === mod) && (status === "all" || r.status === status),
      ),
    [rows, mod, status],
  );

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Module</Label>
            <Select value={mod} onValueChange={setMod}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {APPROVAL_MODULES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Pending", "Approved", "Rejected", "Rework"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="border-border bg-muted/40 ml-auto rounded-lg border px-4 py-2 text-sm">
            <span className="text-muted-foreground">Awaiting action</span>{" "}
            <span className="font-semibold">
              {rows.filter((r) => r.status === "Pending").length}
            </span>
            <span className="text-muted-foreground"> · on you </span>
            <span className="font-semibold">{awaitingMe}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filtered.map((r) => (
          <Card key={r.id} className="shadow-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{r.module}</Badge>
                    <Badge variant="outline" className={tone(r.status)}>
                      {r.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {r.id} · {r.reference}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold">{r.title}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Raised by {r.requestedByName} on{" "}
                    <span className="whitespace-nowrap">{r.raisedOn}</span>
                    {r.amount ? ` · ${r.amount}` : ""}
                  </p>
                </div>
                {r.status === "Pending" && !canActOnApproval(r, me) && (
                  <span className="text-muted-foreground text-xs">
                    Awaiting L{r.currentLevel} ·{" "}
                    {r.steps.find((s) => s.level === r.currentLevel)?.role}
                  </span>
                )}
                {r.status === "Rework" && r.requestedBy === me.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (resubmitApproval(r.id, me)) toast.success("Resubmitted for approval");
                    }}
                  >
                    <RotateCcw className="h-4 w-4" /> Resubmit
                  </Button>
                )}
                {canActOnApproval(r, me) && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-gradient-emerald text-white"
                      onClick={() => {
                        setAct({ req: r, decision: "Approved" });
                        setRemarks("");
                      }}
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAct({ req: r, decision: "Rework" });
                        setRemarks("");
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> Rework
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => {
                        setAct({ req: r, decision: "Rejected" });
                        setRemarks("");
                      }}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {r.steps.map((s, i) => (
                  <div key={s.level} className="flex items-center gap-2">
                    <div
                      className={
                        "rounded-lg border px-3 py-2 text-xs " +
                        (s.status === "Approved"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : s.status === "Rejected"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : s.level === r.currentLevel && r.status === "Pending"
                              ? "border-gold/50 bg-gold/15 text-gold"
                              : "border-border bg-muted/40 text-muted-foreground")
                      }
                    >
                      <div className="font-semibold">
                        L{s.level} · {s.role}
                      </div>
                      <div>
                        {s.actedBy ? `${s.status} by ${s.actedBy} · ${s.actedAt}` : s.status}
                      </div>
                      {s.remarks && <div className="mt-0.5 italic">“{s.remarks}”</div>}
                    </div>
                    {i < r.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="text-muted-foreground p-10 text-center">
              No approval requests match these filters.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!act} onOpenChange={(o) => !o && setAct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {act?.decision === "Approved"
                ? "Approve request"
                : act?.decision === "Rework"
                  ? "Request rework"
                  : "Reject request"}
            </DialogTitle>
            <DialogDescription>
              {act?.req.title} · level {act?.req.currentLevel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Remarks {act?.decision !== "Approved" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAct(null)}>
              Cancel
            </Button>
            <Button
              disabled={act?.decision !== "Approved" && !remarks.trim()}
              className={act?.decision === "Approved" ? "bg-gradient-emerald text-white" : ""}
              variant={act?.decision === "Rejected" ? "destructive" : "default"}
              onClick={() => {
                // The engine re-checks the actor (a stale dialog or a second level by the same person is refused).
                if (!actOnApproval(act.req.id, act.decision, me, remarks.trim())) {
                  toast.error("You cannot act on this request at its current level.");
                  setAct(null);
                  return;
                }
                toast.success(`Request ${act.decision.toLowerCase()}`);
                setAct(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------- workflows */

function Workflows() {
  const rows = workflowStore.use();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex items-center gap-3 p-4">
          <p className="text-muted-foreground text-sm">
            Each request type routes through the ordered chain below. Add or remove levels to match
            your organization policy.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
                <Plus className="h-4 w-4" /> New Workflow
              </Button>
            </DialogTrigger>
            {open && <WorkflowDialog onDone={() => setOpen(false)} />}
          </Dialog>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((w) => (
          <Card key={w.id} className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{w.module}</Badge>
                    <span className="text-muted-foreground text-xs">{w.id}</span>
                  </div>
                  <h3 className="mt-2 font-semibold">{w.name}</h3>
                  <p className="text-muted-foreground text-xs">{w.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={w.active}
                    onCheckedChange={(v) => {
                      updateWorkflow(w.id, { active: v });
                      if (v)
                        toast.info(
                          `${w.name} is now the active ${w.module} chain — other ${w.module} workflows were switched off`,
                        );
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-8 w-8"
                    onClick={() => {
                      deleteWorkflow(w.id);
                      toast.success("Workflow removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="border-border bg-muted/30 rounded-lg border px-3 py-2 text-xs font-medium">
                  Employee (requester)
                </div>
                {w.levels.map((l) => (
                  <div key={l.level}>
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="text-muted-foreground h-3.5 w-3.5" />
                    </div>
                    <div className="border-primary/25 bg-primary/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                      <span className="font-semibold">L{l.level}</span>
                      <span>{l.role}</span>
                      <span className="text-muted-foreground ml-auto">
                        SLA {l.slaDays}d{l.optional ? " · optional" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkflowDialog({ onDone }) {
  const [mod, setMod] = useState("Leave");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [levels, setLevels] = useState([
    { level: 1, role: "Reporting Manager", slaDays: 2, optional: false },
  ]);

  const setRole = (i, role) => setLevels((p) => p.map((l, x) => (x === i ? { ...l, role } : l)));
  const setSla = (i, slaDays) =>
    setLevels((p) => p.map((l, x) => (x === i ? { ...l, slaDays } : l)));
  const setOptional = (i, optional) =>
    setLevels((p) => p.map((l, x) => (x === i ? { ...l, optional } : l)));
  const addLevel = () =>
    setLevels((p) => [...p, { level: p.length + 1, role: "HR", slaDays: 2, optional: false }]);
  const removeLevel = (i) =>
    setLevels((p) => p.filter((_, x) => x !== i).map((l, x) => ({ ...l, level: x + 1 })));

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>New approval workflow</DialogTitle>
        <DialogDescription>Define the ordered approval chain for a request type.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2 pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Module *</Label>
            <Select value={mod} onValueChange={(v) => setMod(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVAL_MODULES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Workflow name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Leave Approval"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Approval levels
            </Label>
            <Button size="sm" variant="outline" className="ml-auto" onClick={addLevel}>
              <Plus className="h-3.5 w-3.5" /> Add level
            </Button>
          </div>
          {levels.map((l, i) => (
            <div
              key={i}
              className="border-border flex flex-wrap items-end gap-2 rounded-lg border p-3"
            >
              <div className="w-8 pb-2 text-xs font-semibold">L{l.level}</div>
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <Label className="text-muted-foreground text-[10px]">Approver</Label>
                <Select value={l.role} onValueChange={(v) => setRole(i, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPROVER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1.5">
                <Label className="text-muted-foreground text-[10px]">SLA (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={l.slaDays}
                  onChange={(e) => setSla(i, Number(e.target.value) || 1)}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={l.optional} onCheckedChange={(v) => setOptional(i, v)} />
                <span className="text-muted-foreground text-xs">Optional</span>
              </div>
              {levels.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive h-9 w-9"
                  onClick={() => removeLevel(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!name.trim()}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            addWorkflow({
              module: mod,
              name: name.trim(),
              description: description.trim(),
              active: true,
              levels,
            });
            toast.success("Approval workflow created");
            onDone();
          }}
        >
          Create workflow
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
