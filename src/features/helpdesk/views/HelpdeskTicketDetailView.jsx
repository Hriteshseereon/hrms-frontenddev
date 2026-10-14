import { useParams } from "@/lib/router";
import { captureFiles } from "@/lib/attachments";
import Link from "@/lib/router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Paperclip,
  Send,
  Lock,
  UserCog,
  ArrowRightLeft,
  Flame,
  RotateCcw,
  CheckCircle2,
  X,
  Star,
  Users,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { initials } from "@/features/employees/data/employee-directory";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  PRIORITIES,
  STATUSES,
  addAttachments,
  addReply,
  addWatcher,
  agentsOf,
  assignTicket,
  canViewTicket,
  canWorkTicket,
  closeTicket,
  escalateTicket,
  fmtDate,
  fmtSize,
  personById,
  priorityTone,
  rateTicket,
  removeWatcher,
  reopenTicket,
  setPriority,
  setStatus,
  slaState,
  slaTone,
  statusTone,
  transferTicket,
  useHelpdeskConfig,
  useTickets,
} from "@/features/helpdesk/data/helpdesk-data";
import { PersonPicker } from "@/features/helpdesk/components/TicketPieces";

function TicketDetail() {
  const { id } = useParams();
  const me = useCurrentUser();
  const cfg = useHelpdeskConfig();
  const t = useTickets().find((x) => x.id === id);
  const [msg, setMsg] = useState("");
  const [internal, setInternal] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState("");
  const [pick2, setPick2] = useState("");
  const [rating, setRating] = useState(5);
  const fileRef = useRef(null);

  if (!t)
    return (
      <div className="space-y-3">
        <Link href="/helpdesk/tickets" className="text-primary text-sm hover:underline">
          ← Back
        </Link>
        <Card className="shadow-card">
          <CardContent className="text-muted-foreground p-10 text-center">
            Ticket {id} not found.
          </CardContent>
        </Card>
      </div>
    );
  if (!canViewTicket(me, t))
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-10 text-center">
          You are not part of ticket {id}.
        </CardContent>
      </Card>
    );

  const agent = canWorkTicket(me, t);
  const requester = me.id === t.requesterId || me.id === t.onBehalfOfId;
  // A department removed from Desk Settings must not crash old tickets.
  const dept = cfg.departments.find((d) => d.id === t.departmentId) ?? {
    id: t.departmentId,
    name: t.departmentId,
    headId: "",
    categories: [],
    agentIds: [],
    description: "",
    mailbox: "",
    businessHours: "",
  };
  const cat = dept.categories.find((c) => c.id === t.categoryId);
  // Dialogs share the pick / note state — always open one clean, otherwise e.g. the assignee id picked in "Assign"
  // was submitted as the new status from the "Status" dialog.
  const open = (d, preset = "") => {
    setPick(preset);
    setPick2("");
    setNote("");
    setDlg(d);
  };
  const sla = slaState(t);
  const act = (r) => {
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) {
      setDlg(null);
      setNote("");
      setPick("");
      setPick2("");
    }
  };
  const timeline = t.timeline.filter((e) => e.type !== "internal" || agent);
  const closed = t.status === "Closed";

  return (
    <div className="space-y-5">
      <Link
        href="/helpdesk/tickets"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Tickets
      </Link>

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-muted-foreground font-mono text-xs">
                {t.id} · {t.channel}
                {t.emailThread ? ` · ${t.emailThread.from}` : ""}
              </div>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">{t.subject}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusTone(t.status)}>
                  {t.status}
                </Badge>
                <Badge variant="outline" className={priorityTone(t.priority)}>
                  {t.priority}
                </Badge>
                <Badge variant="outline">{t.impact} impact</Badge>
                <Badge variant="outline">
                  {dept.name} · {cat?.name}
                </Badge>
                {t.tags.map((x) => (
                  <Badge key={x} variant="outline" className="bg-muted/40">
                    #{x}
                  </Badge>
                ))}
                {t.reopenCount > 0 && (
                  <Badge variant="outline" className="border-destructive/30 text-destructive">
                    reopened ×{t.reopenCount}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="border-border rounded-lg border px-3 py-2">
                <div className={cn("text-sm font-bold", slaTone(sla.response))}>{sla.response}</div>
                <div className="text-muted-foreground text-[10px]">
                  first response · due{" "}
                  <span className="whitespace-nowrap">{fmtDate(t.firstResponseDue)}</span>
                </div>
              </div>
              <div className="border-border rounded-lg border px-3 py-2">
                <div className={cn("text-sm font-bold", slaTone(sla.resolve))}>
                  {sla.resolve}
                  {sla.resolve === "On track" || sla.resolve === "At risk"
                    ? ` · ${sla.hoursLeft} h`
                    : ""}
                </div>
                <div className="text-muted-foreground text-[10px]">
                  resolution · due{" "}
                  <span className="whitespace-nowrap">{fmtDate(t.resolveDue)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {agent && !closed && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => open("assign", t.assigneeId ?? "")}
                >
                  <UserCog className="h-4 w-4" /> Assign
                </Button>
                <Button size="sm" variant="outline" onClick={() => open("status")}>
                  <Clock3 className="h-4 w-4" /> Status
                </Button>
                <Button size="sm" variant="outline" onClick={() => open("transfer")}>
                  <ArrowRightLeft className="h-4 w-4" /> Transfer
                </Button>
                {t.status !== "Resolved" && (
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    onClick={() => open("resolve")}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Resolve
                  </Button>
                )}
              </>
            )}
            {!closed && t.status !== "Resolved" && t.priority !== "Critical" && (
              <Button size="sm" variant="outline" onClick={() => open("escalate")}>
                <Flame className="h-4 w-4" /> Escalate
              </Button>
            )}
            {t.status === "Resolved" && (requester || agent) && (
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => act(closeTicket(t.id, me))}
              >
                <CheckCircle2 className="h-4 w-4" /> Confirm &amp; close
              </Button>
            )}
            {(t.status === "Resolved" || closed) && (requester || agent) && (
              <Button size="sm" variant="outline" onClick={() => open("reopen")}>
                <RotateCcw className="h-4 w-4" /> Reopen
              </Button>
            )}
            {(t.status === "Resolved" || closed) && me.id === t.requesterId && !t.satisfaction && (
              <Button size="sm" variant="outline" onClick={() => open("rate")}>
                <Star className="h-4 w-4" /> Rate resolution
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <span className="bg-gradient-emerald grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white">
                  {initials(t.requesterName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <b>{t.requesterName}</b>{" "}
                    <span className="text-muted-foreground">
                      · {t.requesterDept} ·{" "}
                      <span className="whitespace-nowrap">{fmtDate(t.createdAt)}</span>
                    </span>
                    {t.onBehalfOfId && (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        (raised by {personById(t.onBehalfOfId)?.name})
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{t.description}</p>
                  {t.related && (
                    <div className="mt-2 text-xs">
                      <Badge variant="outline">
                        Related {t.related.kind}: {t.related.ref}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-5">
              <div className="mb-3 text-sm font-semibold">Conversation &amp; activity</div>
              <div className="space-y-3">
                {timeline.map((e) => {
                  const isMsg = e.type === "reply" || e.type === "internal";
                  return isMsg ? (
                    <div
                      key={e.id}
                      className={cn(
                        "rounded-xl border p-3",
                        e.type === "internal"
                          ? "border-gold/40 bg-gold/10"
                          : e.byId === t.requesterId
                            ? "border-border bg-muted/20"
                            : "border-primary/20 bg-primary/5",
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-gradient-emerald grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white">
                          {initials(e.by)}
                        </span>
                        <b>{e.by}</b>
                        <span className="text-muted-foreground">{fmtDate(e.at)}</span>
                        {e.type === "internal" && (
                          <Badge variant="outline" className="border-gold/40 h-4 px-1 text-[10px]">
                            <Lock className="mr-0.5 h-3 w-3" />
                            internal note
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap">{e.text}</p>
                    </div>
                  ) : (
                    <div
                      key={e.id}
                      className="text-muted-foreground flex items-center gap-2 pl-2 text-xs"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          e.type === "escalation"
                            ? "bg-destructive"
                            : e.type === "status"
                              ? "bg-primary"
                              : "bg-border",
                        )}
                      />

                      <span>{e.text}</span>
                      <span>
                        · {e.by} · <span className="whitespace-nowrap">{fmtDate(e.at)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {!closed && (
                <div className="border-border mt-4 space-y-2 border-t pt-4">
                  <Textarea
                    rows={3}
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    placeholder={
                      internal
                        ? "Internal note — visible to agents only…"
                        : "Write a reply… the requester, assignee and watchers are notified."
                    }
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    {agent && (
                      <button
                        type="button"
                        onClick={() => setInternal((v) => !v)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                          internal ? "border-gold/40 bg-gold/15" : "border-border",
                        )}
                      >
                        <Lock className="h-3 w-3" /> Internal note
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        captureFiles(e.target.files);
                        const files = Array.from(e.target.files ?? []).map((f) => ({
                          name: f.name,
                          size: f.size,
                          type: f.type,
                        }));
                        act(addAttachments(t.id, files, me));
                        e.target.value = "";
                      }}
                    />

                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                      <Paperclip className="h-4 w-4" /> Attach
                    </Button>
                    <Button
                      size="sm"
                      className="bg-gradient-emerald ml-auto text-white"
                      disabled={!msg.trim()}
                      onClick={() => {
                        act(addReply(t.id, me, msg, internal));
                        setMsg("");
                      }}
                    >
                      <Send className="h-4 w-4" /> {internal ? "Add note" : "Send reply"}
                    </Button>
                  </div>
                </div>
              )}
              {closed && (
                <div className="border-border bg-muted/20 text-muted-foreground mt-4 rounded-lg border p-3 text-xs">
                  This ticket is closed. Reopen it if the issue persists.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-5 text-sm">
              <div className="font-semibold">Properties</div>
              {[
                ["Assignee", t.assigneeName ?? "Unassigned"],
                ["Department", dept.name],
                ["Category", cat?.name ?? t.categoryId],
                ["Escalation owner", personById(dept.headId)?.name ?? "—"],
                ["Requester", `${t.requesterName} (${t.requesterId})`],
                ["Created", fmtDate(t.createdAt)],
                ["Last update", fmtDate(t.updatedAt)],
                ["First response", t.firstResponseAt ? fmtDate(t.firstResponseAt) : "pending"],
                ["Resolved", t.resolvedAt ? fmtDate(t.resolvedAt) : "—"],
                ["Closed", t.closedAt ? fmtDate(t.closedAt) : "—"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="border-border/60 flex justify-between gap-3 border-b py-1.5"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ))}
              {agent && !closed && (
                <div className="pt-1">
                  <Label className="text-muted-foreground text-xs">Priority</Label>
                  <Select value={t.priority} onValueChange={(v) => act(setPriority(t.id, v, me))}>
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {t.resolution && (
                <div className="border-primary/20 bg-primary/5 rounded-lg border p-2.5 text-xs">
                  <div className="text-primary font-semibold">Resolution</div>
                  {t.resolution}
                </div>
              )}
              {t.satisfaction && (
                <div className="border-gold/40 bg-gold/10 rounded-lg border p-2.5 text-xs">
                  <div className="font-semibold">
                    Requester rating {"★".repeat(t.satisfaction.rating)}
                    {"☆".repeat(5 - t.satisfaction.rating)}
                  </div>
                  {t.satisfaction.comment}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="text-primary h-4 w-4" /> People involved
              </div>
              <div className="text-xs">
                <b>{t.requesterName}</b> <span className="text-muted-foreground">requester</span>
              </div>
              {t.assigneeName && (
                <div className="text-xs">
                  <b>{t.assigneeName}</b> <span className="text-muted-foreground">assignee</span>
                </div>
              )}
              {t.watchers.map((w) => (
                <div key={w.id} className="flex items-center text-xs">
                  <b>{w.name}</b>&nbsp;<span className="text-muted-foreground">watcher</span>
                  {!closed && (agent || w.id === me.id) && (
                    <button
                      aria-label={`Remove ${w.name}`}
                      className="text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => act(removeWatcher(t.id, w.id, me))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {!closed && (
                <PersonPicker
                  exclude={[t.requesterId, ...t.watchers.map((w) => w.id)]}
                  onPick={(p) => act(addWatcher(t.id, p.id, me))}
                  placeholder="Add a watcher…"
                />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="text-primary h-4 w-4" /> Attachments ({t.attachments.length})
              </div>
              {t.attachments.map((a) => (
                <div key={a.id} className="border-border rounded-lg border p-2 text-xs">
                  <div className="truncate font-medium">{a.name}</div>
                  <div className="text-muted-foreground">
                    {fmtSize(a.size)} · {a.addedBy} ·{" "}
                    <span className="whitespace-nowrap">{fmtDate(a.at)}</span>
                  </div>
                </div>
              ))}
              {t.attachments.length === 0 && (
                <div className="text-muted-foreground text-xs">No files attached.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={dlg === "assign"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign ticket</DialogTitle>
            <DialogDescription>
              Agents of {dept.name} only. Use Transfer to move it to another department.
            </DialogDescription>
          </DialogHeader>
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger>
              <SelectValue placeholder="Choose agent" />
            </SelectTrigger>
            <SelectContent>
              {agentsOf(dept.id).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.designation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for the new assignee (optional)"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!pick}
              onClick={() => act(assignTicket(t.id, pick, me, note))}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "status"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              Waiting on Requester pauses the SLA clock. Resolving needs a resolution note (use
              Resolve).
            </DialogDescription>
          </DialogHeader>
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger>
              <SelectValue placeholder="New status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.filter(
                (s) => s !== "Resolved" && s !== "Closed" && s !== "Reopened" && s !== "New",
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!pick}
              onClick={() => act(setStatus(t.id, pick, me, note))}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "resolve"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve ticket</DialogTitle>
            <DialogDescription>
              The requester is asked to confirm and close (auto-closes after {cfg.autoCloseDays}{" "}
              days).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution — what was done, root cause, references…"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!note.trim()}
              onClick={() => act(setStatus(t.id, "Resolved", me, note))}
            >
              Mark resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "transfer"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer to another department</DialogTitle>
            <DialogDescription>
              The ticket is re-routed to the target category's default owner.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={pick}
            onValueChange={(v) => {
              setPick(v);
              setPick2("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              {cfg.departments
                .filter((d) => d.id !== dept.id)
                .map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={pick2} onValueChange={setPick2} disabled={!pick}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {(cfg.departments.find((d) => d.id === pick)?.categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for transfer *"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!pick || !pick2 || !note.trim()}
              onClick={() => act(transferTicket(t.id, pick, pick2, me, note))}
            >
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "escalate"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalate</DialogTitle>
            <DialogDescription>
              Raises priority one level, recalculates the SLA and adds{" "}
              {personById(dept.headId)?.name} ({dept.name} head) as a watcher.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why does this need escalation? *"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!note.trim()}
              onClick={() => act(escalateTicket(t.id, me, note))}
            >
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "reopen"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reopen ticket</DialogTitle>
            <DialogDescription>Goes back to the assignee with a fresh clock.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is still not working? *"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!note.trim()}
              onClick={() => act(reopenTicket(t.id, me, note))}
            >
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "rate"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate the resolution</DialogTitle>
            <DialogDescription>Feeds the desk's CSAT score.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={cn("text-2xl", n <= rating ? "text-gold" : "text-muted-foreground/40")}
              >
                ★
              </button>
            ))}
          </div>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comment (optional)"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => act(rateTicket(t.id, me, rating, note))}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TicketDetail;
