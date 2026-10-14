import { useState } from "react";
import { LogOut, Send, Info, Undo2, CalendarClock, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { userById, useCurrentUser } from "@/features/auth/data/auth-session";
import {
  ACTIVE_STAGES,
  RESIGNATION_REASONS,
  addDays,
  fmtDate,
  myExit,
  myExitHistory,
  stageTone,
  submitResignation,
  todayISO,
  withdrawResignation,
  useExitRequests,
} from "@/features/exit/data/exit-data";
import {
  ClearanceSummary,
  ExitStepper,
  ExitTimeline,
  NoticePeriodCard,
} from "@/features/exit/components/ExitPieces";
import { ExitSurveyForm } from "@/features/exit/components/SeparationPieces";
import { useFnf } from "@/features/exit/data/separation-data";
import { inr } from "@/lib/store";

function MyResignation() {
  const me = useCurrentUser();
  const all = useExitRequests();
  const active = myExit(all, me.id);
  const history = myExitHistory(all, me.id);
  const manager = userById(me.managerId);

  const openRequest = active && ACTIVE_STAGES.includes(active.stage) ? active : null;
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LogOut className="text-primary h-6 w-6" /> Resignation &amp; Exit
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {openRequest
              ? "Track your resignation through manager approval, HR clearance and your notice period."
              : "Apply for resignation here. It goes to your reporting manager first, then to HR for clearance, then your notice period."}
          </p>
        </div>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          disabled={!!openRequest}
          title={openRequest ? "A resignation is already in progress" : ""}
          onClick={() => setApplyOpen(true)}
        >
          <Send className="h-4 w-4" /> Apply for resignation
        </Button>
      </div>

      {openRequest ? (
        <ActiveExit request={openRequest} />
      ) : active && (active.stage === "Exit Completed" || active.stage === "Retained") ? (
        // Closed outcomes used to disappear from this page (only a one-line history row remained).
        <div className="space-y-5">
          <ExitStepper request={active} />
          <Card className="shadow-card border-primary/30">
            <CardContent className="p-4 text-sm">
              {active.stage === "Exit Completed" ? (
                <>
                  <div className="font-semibold">
                    Exit completed on{" "}
                    <span className="whitespace-nowrap">{fmtDate(active.completedOn)}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Last working day{" "}
                    <span className="whitespace-nowrap">
                      {fmtDate(active.noticeEnd ?? active.requestedLwd)}
                    </span>
                    . Relieving and experience letters have been issued
                    {active.fnfRef ? ` · F&F reference ${active.fnfRef}` : ""}.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-semibold">
                    Resignation withdrawn — you have been retained
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Closed on{" "}
                    <span className="whitespace-nowrap">{fmtDate(active.retainedOn)}</span> after
                    the retention discussion; your employment continues on the existing records.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <MyFnf exitId={active.id} />
          <ExitTimeline request={active} />
        </div>
      ) : (
        <Card className="shadow-card border-dashed">
          <CardContent className="p-6 text-sm">
            <div className="font-semibold">No resignation in progress</div>
            <p className="text-muted-foreground mt-1">
              Your reporting manager is{" "}
              <b className="text-foreground">{manager?.name ?? "your reporting manager"}</b>. When
              you apply, HR may open a retention discussion before the exit proceeds; if you
              complete the exit and return within the continuity window, your original joining date
              is kept.
            </p>
            <Button
              className="bg-gradient-emerald mt-3 text-white"
              onClick={() => setApplyOpen(true)}
            >
              <Send className="h-4 w-4" /> Apply for resignation
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Apply for resignation</DialogTitle>
            <DialogDescription>
              Goes to {manager?.name ?? "your reporting manager"} for approval, then HR clearance.
            </DialogDescription>
          </DialogHeader>
          <ResignationForm
            managerName={manager?.name ?? "your reporting manager"}
            onSubmitted={() => setApplyOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {history.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">My exit records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((r) => (
              <div
                key={r.id}
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{r.id}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · applied <span className="whitespace-nowrap">
                      {fmtDate(r.appliedOn)}
                    </span> · {r.reason}
                  </span>
                </div>
                <Badge variant="outline" className={stageTone(r.stage)}>
                  {r.stage}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActiveExit({ request }) {
  const me = useCurrentUser();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [note, setNote] = useState("");
  const req = request;

  return (
    <div className="space-y-5">
      <ExitStepper request={req} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="text-primary h-4 w-4" /> My Resignation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Kv k="Reference" v={req.id} />
              <Kv k="Applied on" v={fmtDate(req.appliedOn)} />
              <Kv k="Reason" v={req.reason} />
              <Kv k="Requested last working day" v={fmtDate(req.requestedLwd)} />
              <Kv k="Reporting manager" v={req.managerName} />
              <Kv k="Letter" v={req.document || "Not attached"} />
            </div>
            <p className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3">
              {req.description}
            </p>

            {req.managerDecision && (
              <div className="border-border bg-muted/20 rounded-lg border p-3 text-xs">
                <span className="text-foreground font-semibold">
                  Manager · {req.managerDecision.action}
                </span>{" "}
                — {req.managerDecision.by},{" "}
                <span className="whitespace-nowrap">{fmtDate(req.managerDecision.on)}</span>.{" "}
                {req.managerDecision.note}
              </div>
            )}
            {req.hrDecision && (
              <div className="border-border bg-muted/20 rounded-lg border p-3 text-xs">
                <span className="text-foreground font-semibold">HR · {req.hrDecision.action}</span>{" "}
                — {req.hrDecision.by},{" "}
                <span className="whitespace-nowrap">{fmtDate(req.hrDecision.on)}</span>.{" "}
                {req.hrDecision.note}
              </div>
            )}

            {req.stage === "Manager Review" && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="border-gold/40 bg-gold/10 text-gold flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <Info className="h-3.5 w-3.5" /> Waiting for {req.managerName} to review your
                  resignation.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNote("");
                    setWithdrawOpen(true);
                  }}
                >
                  <Undo2 className="h-4 w-4" /> Withdraw resignation
                </Button>
              </div>
            )}
            {req.stage === "HR Review" && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
                <Info className="h-3.5 w-3.5" /> Your manager approved. HR is reviewing the
                resignation and will confirm your notice period.
              </div>
            )}
            {req.stage === "Notice Period" && (
              <div className="border-primary/30 bg-primary/10 text-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <CalendarClock className="h-3.5 w-3.5" /> HR accepted your resignation. Your notice
                period is running — see the countdown alongside.
              </div>
            )}
            {req.stage === "HR Clearance" && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
                <Info className="h-3.5 w-3.5" /> Clearance checklist in progress — finance, payroll,
                documents, project handover, assets, IT access and admin. Return your assets and
                complete the handover.
              </div>
            )}
            {req.stage === "Final Settlement" && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
                <Info className="h-3.5 w-3.5" /> All clearances received. Your full &amp; final
                settlement is being processed
                {req.exitInterviewDone ? "" : " — please submit the exit survey below"}.
              </div>
            )}
            {req.stage === "Retained" && (
              <div className="border-primary/30 bg-primary/10 text-primary flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <Info className="h-3.5 w-3.5" /> Your resignation was withdrawn after the retention
                discussion on <span className="whitespace-nowrap">{fmtDate(req.retainedOn)}</span> —
                your employment continues on the existing records.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {["Notice Period", "HR Clearance", "Final Settlement", "Exit Completed"].includes(
            req.stage,
          ) ? (
            <NoticePeriodCard request={req} />
          ) : (
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Notice Period</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                Your notice period is confirmed by HR when the resignation is accepted. It will
                appear here with your confirmed last working day and a live countdown.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ClearanceSummary request={req} />
        <ExitTimeline request={req} />
      </div>
      {["Notice Period", "HR Clearance", "Final Settlement", "Exit Completed"].includes(
        req.stage,
      ) && <ExitSurveyForm request={req} by={me} />}
      <MyFnf exitId={req.id} />

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw resignation</DialogTitle>
            <DialogDescription>
              This closes {req.id}. You can submit a new resignation later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-muted-foreground text-xs">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!note.trim()}
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (withdrawResignation(req.id, me, note.trim()))
                  toast.success("Resignation withdrawn");
                else toast.error("Your manager has already acted — speak to HR to withdraw.");
                setWithdrawOpen(false);
              }}
            >
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kv({ k, v }) {
  return (
    <div className="border-border bg-muted/30 rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
      <div className="mt-0.5 text-sm font-semibold">{v}</div>
    </div>
  );
}

function ResignationForm({ managerName, onSubmitted }) {
  const me = useCurrentUser();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [lwd, setLwd] = useState(addDays(todayISO(), 30));
  const [doc, setDoc] = useState("");
  const [confirm, setConfirm] = useState(false);
  const valid = reason && description.trim().length > 10 && lwd && lwd >= todayISO();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="shadow-card lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Submit Resignation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-border bg-muted/30 rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Submitting as</span>{" "}
            <span className="font-semibold">{me.name}</span>{" "}
            <span className="text-muted-foreground">
              · {me.id} · {me.designation} · {me.dept}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Reason <span className="text-destructive">*</span>
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {RESIGNATION_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Requested last working day <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={lwd}
                min={todayISO()}
                onChange={(e) => setLwd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Resignation note <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share the context of your decision and your handover plan…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Resignation letter (file name)</Label>
            <Input
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              placeholder="resignation-letter.pdf"
            />
          </div>

          <Button
            className="bg-gradient-emerald shadow-premium text-white"
            disabled={!valid}
            onClick={() => setConfirm(true)}
          >
            <Send className="h-4 w-4" /> Submit to {managerName}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">How the exit process works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 text-sm">
            {[
              ["You submit", "Your resignation is recorded and routed to your reporting manager."],
              ["Manager review", `${managerName} approves or rejects with a note.`],
              ["HR clearance", "HR verifies finance dues, documents, project handover and assets."],
              [
                "Notice period",
                "HR sets your notice period in days — the countdown and your last working day appear here.",
              ],
              ["Exit complete", "Exit interview and full & final settlement close the record."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="bg-primary/10 text-primary grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold">
                  {i + 1}
                </span>
                <span>
                  <span className="font-semibold">{t}</span>
                  <span className="text-muted-foreground block text-xs">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm resignation</DialogTitle>
            <DialogDescription>
              This sends your resignation to {managerName}. Requested last working day{" "}
              <span className="whitespace-nowrap">{fmtDate(lwd)}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald shadow-premium text-white"
              onClick={() => {
                const req = submitResignation({
                  employee: me,
                  reason,
                  description: description.trim(),
                  requestedLwd: lwd,
                  document: doc.trim(),
                });
                toast.success(
                  req.appliedOn === todayISO() && req.reason === reason
                    ? `Resignation submitted to ${managerName}`
                    : `You already have resignation ${req.id} in progress.`,
                );
                setConfirm(false);
                onSubmitted?.();
              }}
            >
              Submit resignation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyFnf({ exitId }) {
  const f = useFnf().find((x) => x.exitId === exitId);
  if (!f) return null;
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          Full &amp; Final settlement · {f.id}{" "}
          <Badge variant="outline" className="ml-2">
            {f.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {f.lines
          .filter((l) => l.enabled)
          .map((l, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">{l.label}</span>
              <span className={l.kind === "deduction" ? "text-destructive" : ""}>
                {l.kind === "deduction" ? "−" : ""}
                {inr(l.amount)}
              </span>
            </div>
          ))}
        <div className="border-border flex justify-between border-t pt-2 font-bold">
          <span>Net payable</span>
          <span className="text-primary">{inr(f.net)}</span>
        </div>
        {f.paidOn && (
          <div className="text-muted-foreground text-xs">
            Paid on <span className="whitespace-nowrap">{f.paidOn}</span> · ref {f.paymentRef}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MyResignation;
