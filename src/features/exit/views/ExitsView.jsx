import { useMemo, useState } from "react";
import {
  LogOut,
  Check,
  X,
  ShieldCheck,
  CalendarClock,
  Users,
  Search,
  RotateCcw,
  Hourglass,
  Wallet,
  FileCheck2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { exportReportPdf } from "@/lib/export-utils";
import {
  CLEARANCE_AREAS,
  CLOSED_STAGES,
  addDays,
  clearedCount,
  fmtDate,
  hrApprove,
  hrReject,
  managerDecide,
  NOTICE_PRESETS,
  resetExitData,
  stageTone,
  todayISO,
  useExitRequests,
} from "@/features/exit/data/exit-data";
import {
  ClearanceSummary,
  ExitIdentity,
  ExitStepper,
  ExitTimeline,
  NoticePeriodCard,
} from "@/features/exit/components/ExitPieces";
import {
  ExitSurveyForm,
  ExitSurveyReport,
  FnfPanel,
  FnfRegister,
  RejoinPanel,
  RejoinTab,
  RetainButton,
  RetentionPanel,
  RetentionReport,
  useSeparationKpis,
} from "@/features/exit/components/SeparationPieces";
import {
  NoticeActions,
  ClearanceBoard,
  SettlementCard,
} from "@/features/exit/components/ExitWorkflowPieces";
import { useScopeMatch } from "@/features/organization/data/tenancy";

function ExitManagement() {
  const me = useCurrentUser();
  const all = useExitRequests();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);

  const isManagerReviewer = can(me.role, "exit.manager.decide");
  const isHr = can(me.role, "exit.hr.approve");
  const canClear = can(me.role, "exit.hr.clearance");
  const seesEverything = can(me.role, "exit.viewAll");

  const dir = useDirectory();
  // Working scope (collective / company / branch); people no longer in the directory stay visible.
  const scopeMatch = useScopeMatch();
  const inScope = useMemo(
    () => (id) => !dir.some((e) => e.id === id) || scopeMatch(undefined, id),
    [dir, scopeMatch],
  );
  const visible = useMemo(
    () =>
      (seesEverything
        ? all
        : all.filter(
            (r) =>
              r.managerId === me.id ||
              CLEARANCE_AREAS.some((a) => r.clearances[a.key]?.officer === me.name),
          )
      ).filter((r) => inScope(r.empId)),
    [all, seesEverything, me.id, me.name, inScope],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return visible;
    return visible.filter((r) =>
      [r.id, r.empName, r.empId, r.designation, r.dept, r.stage, r.reason]
        .join(" ")
        .toLowerCase()
        .includes(t),
    );
  }, [visible, q]);

  const resignations = filtered.filter(
    (r) => r.stage === "Manager Review" || r.stage === "HR Review",
  );
  const onNotice = filtered.filter((r) => r.stage === "Notice Period");
  const inClearance = filtered.filter((r) => r.stage === "HR Clearance");
  const settling = filtered.filter((r) => r.stage === "Final Settlement");
  const closed = filtered.filter((r) => CLOSED_STAGES.includes(r.stage));
  const openRequest = visible.find((r) => r.id === openId) ?? null;
  // KPIs, retention and rejoin views follow the same tenant scope as the lists (they used to read every entity).
  const sep = useSeparationKpis(visible);

  const exportRegister = () =>
    exportReportPdf({
      title: "Exit register",
      subtitle: `${filtered.length} records · ${new Date().toLocaleDateString("en-IN")}`,
      columns: [
        "Ref",
        "Employee",
        "Department",
        "Applied",
        "Reason",
        "Stage",
        "Notice",
        "LWD",
        "Clearances",
        "F&F",
        "Exit interview",
      ],
      rows: filtered.map((r) => [
        r.id,
        `${r.empName} (${r.empId})`,
        r.dept,
        fmtDate(r.appliedOn),
        r.reason,
        r.stage,
        r.noticeDays ? `${r.noticeDays} d` : "—",
        fmtDate(r.noticeEnd ?? r.requestedLwd),
        `${clearedCount(r)}/${CLEARANCE_AREAS.length}`,
        r.fnfSettled ? "Settled" : "—",
        r.exitInterviewDone ? "Done" : "—",
      ]),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LogOut className="text-primary h-6 w-6" /> Exit Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Resignations → manager &amp; HR acceptance → <b>Notice period</b> (Retain, or move for
            clearance checklist) → <b>HR clearance</b> by the assigned officers →{" "}
            <b>F&amp;F settled + exit interview</b> → <b>Complete exit</b>. Rejoin within 3 days
            keeps continuity. Rules live in Master Data.
            {seesEverything
              ? " Organisation-wide view."
              : " Showing your direct reports and clearances assigned to you."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border bg-muted/40 flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 sm:w-auto sm:min-w-[220px]">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search exits…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportRegister}>
            <Download className="h-4 w-4" /> Exit register PDF
          </Button>
          {isHr && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetExitData();
                toast.success("Exit demo data reset");
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset demo data
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={Hourglass}
          label="Resignations awaiting decision"
          value={
            visible.filter((r) => r.stage === "Manager Review" || r.stage === "HR Review").length
          }
          tone="gold"
        />
        <Kpi
          icon={CalendarClock}
          label="Serving notice"
          value={visible.filter((r) => r.stage === "Notice Period").length}
          tone="primary"
        />
        <Kpi
          icon={ShieldCheck}
          label="In clearance checklist"
          value={visible.filter((r) => r.stage === "HR Clearance").length}
          tone="blue"
        />
        <Kpi
          icon={Wallet}
          label="Final settlement"
          value={visible.filter((r) => r.stage === "Final Settlement").length}
          tone="blue"
        />
        <Kpi icon={Users} label="Retained (HR KRA)" value={sep.retained} tone="primary" />
      </div>

      <Tabs defaultValue="resignations">
        <ScrollTabsList>
          <TabsTrigger value="resignations">Resignations ({resignations.length})</TabsTrigger>
          <TabsTrigger value="notice">Notice Period ({onNotice.length})</TabsTrigger>
          <TabsTrigger value="clearance">HR Clearance ({inClearance.length})</TabsTrigger>
          <TabsTrigger value="settlement">
            F&amp;F &amp; Exit Interview ({settling.length})
          </TabsTrigger>
          <TabsTrigger value="all">All Exits ({filtered.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
          {seesEverything && <TabsTrigger value="retention">Retention</TabsTrigger>}
          {isHr && (
            <TabsTrigger value="rejoin">
              Rejoin ({visible.filter((r) => r.stage === "Exit Completed").length})
            </TabsTrigger>
          )}
          {isHr && <TabsTrigger value="fnf">F&amp;F Register</TabsTrigger>}
          {(isHr || me.role === "HOD" || me.role === "CHRO") && (
            <TabsTrigger value="surveys">Exit Surveys</TabsTrigger>
          )}
        </ScrollTabsList>

        <TabsContent value="resignations" className="mt-6 space-y-4">
          <p className="text-muted-foreground text-xs">
            Employees who have applied for resignation. The reporting manager decides first, then HR
            accepts the resignation and fixes the notice period — accepted resignations move to{" "}
            <b>Notice Period</b>.
          </p>
          {resignations.length === 0 && <Empty text="No resignations awaiting a decision." />}
          {resignations.map((r) =>
            r.stage === "Manager Review" ? (
              <ManagerReviewCard
                key={r.id}
                request={r}
                onOpen={() => setOpenId(r.id)}
                canDecide={
                  isManagerReviewer &&
                  r.empId !== me.id &&
                  (r.managerId === me.id || ["SuperAdmin", "Admin", "CHRO"].includes(me.role))
                }
              />
            ) : (
              <HrAcceptanceCard
                key={r.id}
                request={r}
                onOpen={() => setOpenId(r.id)}
                canDecide={isHr && r.empId !== me.id && r.managerDecision?.by !== me.name}
              />
            ),
          )}
        </TabsContent>

        <TabsContent value="notice" className="mt-6 space-y-4">
          <p className="text-muted-foreground text-xs">
            Accepted resignations serving notice. <b>Retain</b> opens the retention audit form
            (employment continues on the existing records); <b>Move for clearance checklist</b>{" "}
            hands the employee to the clearance officers.
          </p>
          {onNotice.length === 0 && <Empty text="No employee is currently serving notice." />}
          {onNotice.map((r) => (
            <NoticeActions key={r.id} request={r} onOpen={() => setOpenId(r.id)} />
          ))}
        </TabsContent>

        <TabsContent value="clearance" className="mt-6 space-y-4">
          <p className="text-muted-foreground text-xs">
            Officer-wise clearance checklist — Finance, Payroll &amp; statutory, Documents, Project
            handover, Assets, IT access and Admin. Click a clearance to tick the checklist, add a
            note and give or block the clearance. When all seven are cleared, move the file to final
            settlement.
          </p>
          {inClearance.length === 0 && <Empty text="Nothing in the clearance checklist." />}
          {inClearance.map((r) => (
            <ClearanceBoard
              key={r.id}
              request={r}
              onOpen={() => setOpenId(r.id)}
              canClear={canClear}
            />
          ))}
        </TabsContent>

        <TabsContent value="settlement" className="mt-6 space-y-4">
          <p className="text-muted-foreground text-xs">
            Not retained: review the computed F&amp;F statement and mark it settled, record the exit
            interview (employee portal submission, HR interview or uploaded form), then{" "}
            <b>Complete exit</b> — the employee has officially resigned and the relieving letter is
            issued.
          </p>
          {settling.length === 0 && <Empty text="No exits in final settlement." />}
          {settling.map((r) => (
            <SettlementCard key={r.id} request={r} onOpen={() => setOpenId(r.id)} />
          ))}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <ExitTable rows={filtered} onOpen={setOpenId} />
        </TabsContent>
        <TabsContent value="closed" className="mt-6">
          <ExitTable rows={closed} onOpen={setOpenId} />
        </TabsContent>
        <TabsContent value="retention" className="mt-6">
          <RetentionReport exits={visible} />
        </TabsContent>
        <TabsContent value="rejoin" className="mt-6">
          <RejoinTab exits={visible} onOpen={setOpenId} />
        </TabsContent>
        <TabsContent value="fnf" className="mt-6">
          <FnfRegister exits={visible} />
        </TabsContent>
        <TabsContent value="surveys" className="mt-6">
          <ExitSurveyReport exits={visible} />
        </TabsContent>
      </Tabs>

      <Sheet open={!!openRequest} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {openRequest && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {openRequest.empName}
                  <Badge variant="outline" className={stageTone(openRequest.stage)}>
                    {openRequest.stage}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 p-4 pt-0">
                <ExitIdentity request={openRequest} />
                <ExitStepper request={openRequest} />
                <Card className="shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Resignation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row k="Reference" v={openRequest.id} />
                    <Row k="Applied on" v={fmtDate(openRequest.appliedOn)} />
                    <Row k="Reason" v={openRequest.reason} />
                    <Row k="Requested last day" v={fmtDate(openRequest.requestedLwd)} />
                    {openRequest.managerDecision && (
                      <Row
                        k="Manager"
                        v={`${openRequest.managerDecision.action} · ${openRequest.managerDecision.by} · ${fmtDate(openRequest.managerDecision.on)}`}
                      />
                    )}
                    {openRequest.hrDecision && (
                      <Row
                        k="HR"
                        v={`${openRequest.hrDecision.action} · ${openRequest.hrDecision.by} · ${fmtDate(openRequest.hrDecision.on)}`}
                      />
                    )}
                    <div className="text-muted-foreground pt-1">{openRequest.description}</div>
                  </CardContent>
                </Card>
                <RetentionPanel request={openRequest} />
                <NoticePeriodCard request={openRequest} />
                <ClearanceSummary request={openRequest} />
                {isHr && openRequest.empId !== me.id && <FnfPanel request={openRequest} />}
                {openRequest.exitInterview && (
                  <Card className="shadow-card">
                    <CardContent className="p-4 text-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        <FileCheck2 className="text-primary h-4 w-4" /> Exit interview
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {openRequest.exitInterview.mode} ·{" "}
                        <span className="whitespace-nowrap">
                          {fmtDate(openRequest.exitInterview.on)}
                        </span>{" "}
                        · {openRequest.exitInterview.by}
                        {openRequest.exitInterview.file
                          ? ` · ${openRequest.exitInterview.file}`
                          : ""}
                      </div>
                      {openRequest.exitInterview.note && (
                        <div className="mt-1 text-xs">{openRequest.exitInterview.note}</div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {isHr && openRequest.empId !== me.id && <RejoinPanel request={openRequest} />}
                {(isHr || me.role === "HOD" || me.role === "CHRO") && (
                  <ExitSurveyForm request={openRequest} by={me} readOnly />
                )}
                <ExitTimeline request={openRequest} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------- pieces ------------------------------- */

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function Empty({ text }) {
  return (
    <Card className="shadow-card border-dashed">
      <CardContent className="text-muted-foreground p-10 text-center text-sm">{text}</CardContent>
    </Card>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  const toneCls =
    tone === "gold"
      ? "bg-gold/15 text-gold"
      : tone === "blue"
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
        : tone === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground";
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("grid h-10 w-10 place-items-center rounded-xl", toneCls)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl leading-none font-bold">{value}</div>
          <div className="text-muted-foreground mt-1 text-xs">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardShell({ request, onOpen, children }) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{request.empName}</span>
              <Badge variant="outline" className={stageTone(request.stage)}>
                {request.stage}
              </Badge>
              <span className="text-muted-foreground text-xs">{request.id}</span>
            </div>
            <div className="mt-1.5">
              <ExitIdentity request={request} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RetainButton request={request} />
            <Button variant="outline" size="sm" onClick={onOpen}>
              View full exit file
            </Button>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, highlight }) {
  return (
    <div className="border-border bg-muted/30 rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold", highlight && "text-primary")}>{value}</div>
    </div>
  );
}

function ManagerReviewCard({ request, onOpen, canDecide }) {
  const me = useCurrentUser();
  const [action, setAction] = useState(null);
  const [note, setNote] = useState("");
  return (
    <CardShell request={request} onOpen={onOpen}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Applied on" value={fmtDate(request.appliedOn)} />
        <Field label="Reason" value={request.reason} />
        <Field label="Requested last day" value={fmtDate(request.requestedLwd)} />
        <Field label="Awaiting" value={`Manager · ${request.managerName}`} highlight />
      </div>
      <p className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3 text-sm">
        {request.description}
      </p>
      {canDecide ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => {
              setNote("");
              setAction("Approved");
            }}
          >
            <Check className="h-4 w-4" /> Accept &amp; send to HR
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => {
              setNote("");
              setAction("Rejected");
            }}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">
          Waiting for {request.managerName}'s decision.
        </div>
      )}
      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{action === "Rejected" ? "Reject" : "Accept"} resignation</DialogTitle>
            <DialogDescription>
              {request.empName} · {request.id} ·{" "}
              {action === "Approved"
                ? "this sends the resignation to HR for acceptance and notice-period fixing."
                : "the employee will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-muted-foreground text-xs">
              Manager note <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action === "Rejected"
                  ? "Why is this resignation being rejected?"
                  : "Handover plan, backfill notes…"
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              disabled={!note.trim()}
              className={
                action === "Rejected"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-gradient-emerald shadow-premium text-white"
              }
              onClick={() => {
                if (!managerDecide(request.id, action, me, note.trim())) {
                  toast.error(
                    "This resignation is no longer awaiting the manager (or it is your own).",
                  );
                  setAction(null);
                  return;
                }
                toast.success(
                  action === "Approved"
                    ? `${request.empName}'s resignation accepted — sent to HR`
                    : `${request.empName}'s resignation rejected`,
                );
                setAction(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardShell>
  );
}

function HrAcceptanceCard({ request, onOpen, canDecide }) {
  const me = useCurrentUser();
  const [action, setAction] = useState(null);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("60");
  const days = Number(notice) || 0;
  // Same arithmetic as hrApprove (the local-date preview could differ by a day from the LWD actually stored).
  const lwd = useMemo(() => addDays(todayISO(), days), [days]);
  return (
    <CardShell request={request} onOpen={onOpen}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Applied on" value={fmtDate(request.appliedOn)} />
        <Field label="Reason" value={request.reason} />
        <Field
          label="Manager decision"
          value={`${request.managerDecision?.action} · ${request.managerDecision?.by}`}
        />
        <Field label="Awaiting" value="HR acceptance & notice period" highlight />
      </div>
      <p className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3 text-sm">
        {request.description}
        {request.managerDecision?.note ? ` — Manager: ${request.managerDecision.note}` : ""}
      </p>
      {canDecide ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => {
              setNote("");
              setAction("Approved");
            }}
          >
            <Check className="h-4 w-4" /> Accept resignation &amp; start notice
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => {
              setNote("");
              setAction("Rejected");
            }}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">Waiting for HR acceptance.</div>
      )}
      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "Rejected"
                ? "Reject resignation"
                : "Accept resignation & fix notice period"}
            </DialogTitle>
            <DialogDescription>
              {request.empName} · {request.id}
              {action === "Approved"
                ? ` · notice starts today; last working day ${fmtDate(lwd)}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {action === "Approved" && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Notice period (days)</Label>
              <div className="flex gap-2">
                <Select value={notice} onValueChange={setNotice}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTICE_PRESETS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                  className="w-28"
                />
              </div>
              <p className="text-muted-foreground text-[11px]">
                Requested last day{" "}
                <span className="whitespace-nowrap">{fmtDate(request.requestedLwd)}</span> · policy
                default per grade in Master Data.
              </p>
            </div>
          )}
          <div className="space-y-1.5 py-2">
            <Label className="text-muted-foreground text-xs">
              HR note <span className="text-destructive">*</span>
            </Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              disabled={!note.trim() || (action === "Approved" && days <= 0)}
              className={
                action === "Rejected"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-gradient-emerald shadow-premium text-white"
              }
              onClick={() => {
                const ok =
                  action === "Approved"
                    ? hrApprove(request.id, me, days, note.trim())
                    : hrReject(request.id, me, note.trim());
                if (!ok)
                  toast.error("This resignation is no longer awaiting HR (or it is your own).");
                else
                  toast.success(
                    action === "Approved"
                      ? `${request.empName}'s resignation accepted — ${days}-day notice started, LWD ${fmtDate(lwd)}`
                      : "Resignation rejected",
                  );
                setAction(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardShell>
  );
}

function ExitTable({ rows, onOpen }) {
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th className="p-3 text-left">Reference</th>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Manager</th>
              <th className="p-3 text-left">Applied</th>
              <th className="p-3 text-left">Reason</th>
              <th className="p-3 text-left">Clearances</th>
              <th className="p-3 text-left">Notice</th>
              <th className="p-3 text-left">Last working day</th>
              <th className="p-3 text-left">F&amp;F / interview</th>
              <th className="p-3 text-left">Stage</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-muted-foreground p-8 text-center">
                  No exit records.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30 transition">
                <td className="p-3 font-medium">{r.id}</td>
                <td className="p-3">
                  <div className="font-semibold">{r.empName}</div>
                  <div className="text-muted-foreground text-xs">
                    {r.empId} · {r.designation}
                  </div>
                </td>
                <td className="text-muted-foreground p-3">{r.managerName}</td>
                <td className="text-muted-foreground p-3 text-xs">
                  <span className="whitespace-nowrap">{fmtDate(r.appliedOn)}</span>
                </td>
                <td className="max-w-[180px] truncate p-3">{r.reason}</td>
                <td className="p-3 text-xs">
                  {clearedCount(r)}/{CLEARANCE_AREAS.length}
                </td>
                <td className="p-3 text-xs">{r.noticeDays ? `${r.noticeDays} days` : "—"}</td>
                <td className="text-muted-foreground p-3 text-xs">
                  <span className="whitespace-nowrap">
                    {fmtDate(r.noticeEnd ?? r.requestedLwd)}
                  </span>
                </td>
                <td className="p-3 text-xs">
                  {r.fnfSettled ? "F&F ✓" : "F&F —"} ·{" "}
                  {r.exitInterviewDone ? "Interview ✓" : "Interview —"}
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={stageTone(r.stage)}>
                    {r.stage}
                  </Badge>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <RetainButton request={r} size="xs" />
                    {r.stage === "Exit Completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => onOpen(r.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Rejoin
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onOpen(r.id)}
                    >
                      Open
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default ExitManagement;
