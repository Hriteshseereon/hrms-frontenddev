import { useEffect, useState } from "react";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { KeyRound, Plus, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RBAC_MODULES, PERMISSION_ACTIONS, screenId } from "@/features/auth/data/rbac";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { useOrgUsers } from "@/features/auth/data/user-store";
import { tempGrantStore } from "@/features/auth/data/rbac-store";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

/**
 * @typedef {Object} TempGrant
 * @property {string} id
 * @property {string} user
 * @property {string} branch
 * @property {string} from
 * @property {string} to
 * @property {string} reason
 * @property {{ id: string, label: string, perms: PermissionAction[] }[]} screens
 * @property {"Active" | "Revoked"} status
 */

const STEPS = ["User & window", "Modules & permissions", "Review & submit"];

// Persisted grants live in rbac-store, which also turns live grants into screen access (they used to grant nothing).

/** Today in IST (grants are Indian working days) — evaluated on the client only, inside effects / handlers. */
const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function TemporaryAccessTab() {
  const grants = tempGrantStore.use();
  const setGrants = tempGrantStore.set;
  const me = useCurrentUser();
  const canManage = can(me.role, "role.manage");
  // Users from the User Assignment store, so people added there can be granted access (the static seed hid them).
  const ORG_USERS = useOrgUsers();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [detail, setDetail] = useState(null);
  // "Expire automatically": a grant whose window has passed reads as Expired. Today is read after mount so the
  // server-rendered table (which has no clock of its own) matches the first client render.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(istToday());
  }, []);
  const effectiveStatus = (g) =>
    g.status === "Active" && today && g.to < today ? "Expired" : g.status;

  const [user, setUser] = useState("");
  const [branch, setBranch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [perms, setPerms] = useState({});

  const labelFor = (m, s, sc) => `${m.name} › ${s.name} › ${sc.name}`;
  const windowInvalid = !!from && !!to && to < from;

  const togglePerm = (id, action, on) =>
    setPerms((p) => {
      const cur = p[id] ?? [];
      const next = on ? Array.from(new Set([...cur, action])) : cur.filter((a) => a !== action);
      const copy = { ...p };
      if (next.length) copy[id] = next;
      else delete copy[id];
      return copy;
    });

  const selected = Object.entries(perms);
  const canNext =
    step === 0
      ? !!user && !!from && !!to && !windowInvalid
      : step === 1
        ? selected.length > 0
        : true;

  function reset() {
    setStep(0);
    setUser("");
    setBranch("");
    setFrom("");
    setTo("");
    setReason("");
    setPerms({});
  }

  function submit() {
    const screens = selected.map(([id, list]) => {
      let label = id;
      RBAC_MODULES.forEach((m) =>
        m.submodules.forEach((s) =>
          s.screens.forEach((sc) => {
            if (screenId(m.key, s.key, sc.key) === id) label = labelFor(m, s, sc);
          }),
        ),
      );
      return { id, label, perms: list };
    });
    setGrants((p) => [
      {
        // Highest existing number + 1 — a count-based ref would collide once the seed and session grants interleave.
        id: `TMP-${String(p.reduce((m, g) => Math.max(m, Number(g.id.replace(/^TMP-/, "")) || 0), 0) + 1).padStart(3, "0")}`,
        user,
        // The grant is matched to the login by e-mail when access is checked.
        userEmail: ORG_USERS.find((u) => u.name === user)?.email,
        branch: branch || "All branches",
        from,
        to,
        reason,
        screens,
        status: "Active",
      },
      ...p,
    ]);
    toast.success(`Temporary access granted to ${user} until ${to}`);
    setOpen(false);
    reset();
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Temporary Access</div>
              <div className="text-muted-foreground text-xs">
                Time-boxed permissions that expire automatically
              </div>
            </div>
          </div>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald text-white" disabled={!canManage}>
                <Plus className="h-4 w-4" /> Grant Access
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Grant temporary access</DialogTitle>
                <DialogDescription>
                  Pick the person, the exact screens and permissions, then review before granting.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 py-2">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                        i === step
                          ? "bg-gradient-emerald text-white"
                          : i < step
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>} {s}
                    </div>
                    {i < STEPS.length - 1 && (
                      <ChevronRight className="text-muted-foreground h-3 w-3" />
                    )}
                  </div>
                ))}
              </div>

              {step === 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-muted-foreground text-xs">
                      User <span className="text-destructive">*</span>
                    </Label>
                    <Select value={user} onValueChange={setUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_USERS.map((u) => (
                          <SelectItem key={u.id} value={u.name}>
                            {u.name} · {u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-muted-foreground text-xs">Branch scope</Label>
                    <Select value={branch} onValueChange={setBranch}>
                      <SelectTrigger>
                        <SelectValue placeholder="All branches" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_MANAGED_BRANCHES.map((b) => (
                          <SelectItem key={b.id} value={b.name}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Valid from <span className="text-destructive">*</span>
                    </Label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Valid to <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      min={from || undefined}
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                    {windowInvalid && (
                      <p className="text-destructive text-xs">
                        "Valid to" must be on or after "Valid from".
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-muted-foreground text-xs">Reason</Label>
                    <Textarea
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Covering payroll during leave"
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  {RBAC_MODULES.map((m) => (
                    <div key={m.key} className="border-border rounded-lg border">
                      <div className="bg-muted/40 px-3 py-2 text-sm font-semibold">{m.name}</div>
                      {m.submodules.map((s) => (
                        <div key={s.key} className="border-border border-t px-3 py-2">
                          <div className="text-muted-foreground mb-2 text-xs font-medium">
                            {s.name}
                          </div>
                          <div className="space-y-2">
                            {s.screens.map((sc) => {
                              const id = screenId(m.key, s.key, sc.key);
                              return (
                                <div
                                  key={id}
                                  className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2"
                                >
                                  <div className="text-sm">{sc.name}</div>
                                  <div className="flex gap-3">
                                    {PERMISSION_ACTIONS.map((a) => (
                                      <label
                                        key={a}
                                        className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs"
                                      >
                                        <Checkbox
                                          checked={(perms[id] ?? []).includes(a)}
                                          onCheckedChange={(v) => togglePerm(id, a, !!v)}
                                        />{" "}
                                        {a}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="border-border bg-muted/30 grid grid-cols-1 gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">User:</span>{" "}
                      <span className="font-medium">{user}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Branch:</span>{" "}
                      <span className="font-medium">{branch || "All branches"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Window:</span>{" "}
                      <span className="font-medium">
                        {from} → {to}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Screens:</span>{" "}
                      <span className="font-medium">{selected.length}</span>
                    </div>
                    {reason && (
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Reason:</span> {reason}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selected.map(([id, list]) => {
                      let label = id;
                      RBAC_MODULES.forEach((m) =>
                        m.submodules.forEach((s) =>
                          s.screens.forEach((sc) => {
                            if (screenId(m.key, s.key, sc.key) === id) label = labelFor(m, s, sc);
                          }),
                        ),
                      );
                      return (
                        <div
                          key={id}
                          className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <span>{label}</span>
                          <div className="flex gap-1">
                            {list.map((p) => (
                              <Badge
                                key={p}
                                variant="outline"
                                className="border-primary/30 bg-primary/10 text-primary"
                              >
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                    Back
                  </Button>
                )}
                {step < 2 ? (
                  <Button
                    disabled={!canNext}
                    className="bg-gradient-emerald text-white"
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button className="bg-gradient-emerald text-white" onClick={submit}>
                    Grant access
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Ref</th>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Branch</th>
                <th className="p-3 text-left">Window</th>
                <th className="p-3 text-left">Screens & permissions</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {grants.map((g) => {
                const status = effectiveStatus(g);
                return (
                  <tr
                    key={g.id}
                    className={`${clickableRow} align-top`}
                    onClick={() => setDetail(g)}
                  >
                    <td className="text-muted-foreground p-3 font-mono text-xs">{g.id}</td>
                    <td className="p-3 font-medium">
                      {g.user}
                      <div className="text-muted-foreground text-xs font-normal">{g.reason}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{g.branch}</td>
                    <td className="text-muted-foreground p-3">
                      {g.from} → {g.to}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {g.screens.map((s) => (
                          <div key={s.id} className="text-xs">
                            {s.label}{" "}
                            <span className="text-muted-foreground">({s.perms.join(", ")})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          status === "Active"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {status === "Active" && canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setGrants((p) =>
                              p.map((x) => (x.id === g.id ? { ...x, status: "Revoked" } : x)),
                            );
                            toast.success("Temporary access revoked");
                          }}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detail && (
          <RecordDetailDialog
            onClose={() => setDetail(null)}
            title={`${detail.id} · ${detail.user}`}
            subtitle={`${detail.branch} · ${detail.from} → ${detail.to}`}
            badges={
              <Badge
                variant="outline"
                className={
                  effectiveStatus(detail) === "Active"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }
              >
                {effectiveStatus(detail)}
              </Badge>
            }
            record={{
              ...detail,
              status: effectiveStatus(detail),
              screens: detail.screens.map((s) => ({
                screen: s.label,
                permissions: s.perms.join(", "),
              })),
            }}
            labels={{ from: "From date", to: "To date", screens: "Screens & permissions" }}
            sections={[
              { title: "Grant", keys: ["id", "user", "branch", "status"] },
              { title: "Window & reason", keys: ["from", "to", "reason"] },
              { title: "Screens & permissions", keys: ["screens"] },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
