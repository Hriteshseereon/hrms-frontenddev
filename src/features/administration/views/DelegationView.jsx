import { useMemo, useState } from "react";
import { UserCog, Plus, Check, X, History } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useScopedEmployees, useScopedIds } from "@/features/employees/components/CasePieces";
import {
  DELEGATABLE_MODULES,
  DELEGATION_LEVELS,
  LEVEL_HINT,
  addDelegation,
  delegatedPermissions,
  delegationTone,
  effectiveStatus,
  overlappingDelegation,
  setDelegationStatus,
  useDelegations,
} from "@/features/administration/data/delegation-data";
import { rolesOfUser, roleActionGroups } from "@/features/auth/data/rbac-store";
import { userById, useCurrentUser } from "@/features/auth/data/auth-session";
import { pushAlert } from "@/features/communications/data/employee-alerts";

function DelegationPage() {
  const me = useCurrentUser();
  const all = useDelegations();
  // Tenant scope — only delegations between people of the active entity (or the whole group in group view).
  const scopedIds = useScopedIds();
  const rows = useMemo(
    () => all.filter((d) => scopedIds.has(d.fromId) || scopedIds.has(d.toId)),
    [all, scopedIds],
  );
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(null);

  const filtered = useMemo(
    () => rows.filter((d) => status === "all" || effectiveStatus(d) === status),
    [rows, status],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserCog className="text-primary h-6 w-6" /> Role Delegation
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Any user can hand selected module responsibilities to a colleague for a fixed period.
          Delegations expire automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Active delegations",
            value: rows.filter((d) => effectiveStatus(d) === "Active").length,
          },
          {
            label: "Awaiting approval",
            value: rows.filter((d) => effectiveStatus(d) === "Pending Approval").length,
          },
          { label: "Total on record", value: rows.length },
        ].map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="text-muted-foreground text-xs tracking-wider uppercase">
                {s.label}
              </div>
              <div className="mt-1 text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Pending Approval", "Active", "Expired", "Revoked", "Rejected"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
                <Plus className="h-4 w-4" /> New Delegation
              </Button>
            </DialogTrigger>
            {/* Mounted only while open so a second delegation starts from a clean form (it reopened with the last one's values). */}
            {open && <DelegationDialog onDone={() => setOpen(false)} />}
          </Dialog>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Ref</th>
                <th className="p-3 text-left">Delegated by</th>
                <th className="p-3 text-left">Delegated to</th>
                <th className="p-3 text-left">Modules</th>
                <th className="p-3 text-left">Permission</th>
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((d) => {
                const st = effectiveStatus(d);
                return (
                  <tr key={d.id} className="hover:bg-muted/30 align-top">
                    <td className="p-3 font-medium">{d.id}</td>
                    <td className="p-3">
                      {d.from}
                      <div className="text-muted-foreground text-xs">{d.fromId}</div>
                    </td>
                    <td className="p-3">
                      {d.to}
                      <div className="text-muted-foreground text-xs">{d.toId}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {d.modules.map((m) => (
                          <Badge key={m} variant="outline" className="text-[10px]">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">{d.level}</td>
                    <td className="text-muted-foreground p-3 text-xs">
                      {d.start} → {d.end}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={delegationTone(st)}>
                        {st}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {/* The delegator, the delegate or whoever entered it approving their own delegation defeats the approval step. */}
                        {st === "Pending Approval" &&
                          me.id !== d.fromId &&
                          me.id !== d.toId &&
                          me.id !== d.createdById && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDelegationStatus(d.id, "Active", me.name);
                                  pushAlert({
                                    empId: d.toId,
                                    kind: "general",
                                    to: "/emp/dashboard",
                                    title: "Delegation approved",
                                    body: `${d.from}'s ${d.modules.join(", ")} responsibilities (${d.level}) are yours ${d.start} → ${d.end}.`,
                                  });
                                  toast.success("Delegation approved");
                                }}
                              >
                                <Check className="text-primary h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDelegationStatus(d.id, "Rejected", me.name);
                                  pushAlert({
                                    empId: d.fromId,
                                    kind: "general",
                                    to: "/emp/dashboard",
                                    title: "Delegation rejected",
                                    body: `Your delegation ${d.id} to ${d.to} was rejected by ${me.name}.`,
                                  });
                                  toast.success("Delegation rejected");
                                }}
                              >
                                <X className="text-destructive h-4 w-4" />
                              </Button>
                            </>
                          )}
                        {st === "Active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => {
                              setDelegationStatus(d.id, "Revoked", me.name);
                              toast.success("Delegation revoked");
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setHistory(d)}>
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-10 text-center">
                    No delegations match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delegation {history?.id}</DialogTitle>
            <DialogDescription>
              {history?.from} → {history?.to} · {history?.level} · {history?.start} → {history?.end}
            </DialogDescription>
          </DialogHeader>
          {history && (
            <PermissionsGranted
              modules={history.modules}
              level={history.level}
              toId={history.toId}
            />
          )}
          <div className="text-muted-foreground pt-2 text-[11px] font-semibold tracking-wider uppercase">
            History
          </div>
          <div className="space-y-2 py-1">
            {history?.history.map((h, i) => (
              <div key={i} className="border-border rounded-lg border p-3">
                <div className="text-sm font-medium">{h.action}</div>
                <div className="text-muted-foreground text-xs">
                  {h.by} · {h.at}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DelegationDialog({ onDone }) {
  const me = useCurrentUser();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [modules, setModules] = useState([]);
  const [level, setLevel] = useState("View Only");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Tenant-scoped, reactive directory (the static EMPLOYEES seed listed every entity and missed new hires).
  const EMPLOYEES = useScopedEmployees();
  const from = EMPLOYEES.find((e) => e.id === fromId);
  const to = EMPLOYEES.find((e) => e.id === toId);
  const datesOk = !!start && !!end && end >= start;
  const overlap = from && to && datesOk ? overlappingDelegation(fromId, toId, start, end) : null;
  const valid = from && to && fromId !== toId && modules.length > 0 && datesOk && !overlap;
  const allSelected = modules.length === DELEGATABLE_MODULES.length;

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>New delegation</DialogTitle>
        <DialogDescription>
          Hand over selected responsibilities for a bounded period. Access expires automatically on
          the end date.
        </DialogDescription>
      </DialogHeader>
      <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto py-2 pr-1 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Delegated by *</Label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEES.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Delegated to *</Label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEES.filter((e) => e.id !== fromId).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Permission level *</Label>
          <Select value={level} onValueChange={(v) => setLevel(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELEGATION_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-muted-foreground text-[11px]">{LEVEL_HINT[level]}</div>
        </div>
        <div className="border-border flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Needs approval</div>
            <div className="text-muted-foreground text-xs">Route through an approver first</div>
          </div>
          <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Start date *</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">End date *</Label>
          <Input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
          {start && end && end < start && (
            <div className="text-destructive text-[11px]">
              End date must be on or after the start date.
            </div>
          )}
          {overlap && (
            <div className="text-destructive text-[11px]">
              {overlap.id} already delegates to {overlap.to} for {overlap.start} → {overlap.end} —
              revoke it or pick other dates.
            </div>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-xs tracking-wider uppercase">
              Modules *
            </Label>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 text-xs"
              onClick={() => setModules(allSelected ? [] : [...DELEGATABLE_MODULES])}
            >
              {allSelected ? "Clear all" : "Select all"}
            </Button>
          </div>
          <div className="border-border grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-3">
            {DELEGATABLE_MODULES.map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={modules.includes(m)}
                  onCheckedChange={(v) =>
                    setModules((p) => (v ? [...p, m] : p.filter((x) => x !== m)))
                  }
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-muted-foreground text-xs">Reason</Label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Annual leave cover"
          />
        </div>
        <div className="sm:col-span-2">
          {to && modules.length > 0 ? (
            <PermissionsGranted modules={modules} level={level} toId={to.id} />
          ) : (
            <div className="border-border text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
              Pick the delegate and at least one module to preview exactly which permissions they
              will receive.
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            const id = addDelegation(
              {
                fromId: from.id,
                from: from.name,
                toId: to.id,
                to: to.name,
                modules,
                level,
                start,
                end,
                reason: reason.trim(),
                status: requiresApproval ? "Pending Approval" : "Active",
                requiresApproval,
                createdById: me.id,
              },
              me.id === from.id ? from.name : `${me.name} (on behalf of ${from.name})`,
            );
            // The delegate is told (in-app bell) — nothing reached them before.
            if (!requiresApproval)
              pushAlert({
                empId: to.id,
                kind: "general",
                to: "/emp/dashboard",
                title: `Delegation ${id} — ${modules.length} module(s)`,
                body: `${from.name} delegated ${modules.join(", ")} (${level}) to you, ${start} → ${end}.`,
              });
            toast.success(
              requiresApproval
                ? `${id} submitted for approval`
                : `Responsibilities delegated to ${to.name}`,
            );
            onDone();
          }}
        >
          Create delegation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Exactly what the delegate receives — screens and actions per module — plus what they already hold. */
function PermissionsGranted({ modules, level, toId }) {
  const perms = delegatedPermissions(modules, level);
  const user = userById(toId);
  const existingRoles = rolesOfUser(toId);
  const existingActions = user
    ? roleActionGroups(user.role).flatMap((g) => g.actions.map((a) => `${g.module}.${a}`))
    : [];
  return (
    <div className="border-primary/30 bg-primary/5 space-y-2 rounded-xl border p-3">
      <div className="text-primary text-xs font-semibold tracking-wider uppercase">
        Permissions {user ? `${user.name.split(" ")[0]} receives` : "granted"} · {level}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {perms.map((p) => (
          <div key={p.module} className="border-border bg-card rounded-lg border p-2.5 text-sm">
            <div className="font-medium">{p.module}</div>
            <div className="text-muted-foreground text-xs">Screens: {p.screens.join(", ")}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.actions.map((a) => (
                <Badge
                  key={a}
                  variant="outline"
                  className={`font-mono text-[10px] ${existingActions.includes(a) ? "border-border text-muted-foreground" : "border-primary/40 text-primary"}`}
                >
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      {user && (
        <div className="text-muted-foreground text-[11px]">
          Already holds: app role <b>{user.role}</b>
          {existingRoles.length ? ` · RBAC ${existingRoles.map((r) => r.name).join(", ")}` : ""}.
          Greyed actions are already covered by their own role; highlighted ones are new for the
          delegation period.
        </div>
      )}
    </div>
  );
}

export default DelegationPage;
