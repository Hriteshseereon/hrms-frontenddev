import {
  Check,
  Clock3,
  CalendarClock,
  FileText,
  User2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CLEARANCE_AREAS,
  EXIT_STEPS,
  clearanceTone,
  fmtDate,
  noticeProgress,
  stageTone,
  stepIndex,
} from "@/features/exit/data/exit-data";

/** 5-step horizontal workflow stepper. */
export function ExitStepper({ request }) {
  const rejected = request.stage === "Manager Rejected" || request.stage === "HR Rejected";
  const withdrawn = request.stage === "Withdrawn" || request.stage === "Retained";
  const active = stepIndex(request.stage);
  // A completed exit ticks every step (the last one used to stay "current" forever).
  const completed = request.stage === "Exit Completed";

  return (
    <div className="border-border bg-card shadow-card rounded-xl border p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Exit Workflow</div>
        <Badge variant="outline" className={stageTone(request.stage)}>
          {request.stage}
        </Badge>
      </div>
      <div className="steps-scroll flex min-w-0 items-start">
        {EXIT_STEPS.map((label, i) => {
          const done = !rejected && !withdrawn && (completed || i < active);
          const current = !rejected && !withdrawn && !completed && i === active;
          const failed = (rejected || withdrawn) && i === active;
          return (
            <div key={label} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-full flex-col items-center gap-2">
                <div className="flex w-full items-center">
                  <div
                    className={cn(
                      "h-[2px] flex-1",
                      i === 0 ? "bg-transparent" : done || current ? "bg-primary" : "bg-border",
                    )}
                  />
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition",
                      failed
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : done
                          ? "border-primary bg-primary text-primary-foreground"
                          : current
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {failed ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div
                    className={cn(
                      "h-[2px] flex-1",
                      i === EXIT_STEPS.length - 1
                        ? "bg-transparent"
                        : done
                          ? "bg-primary"
                          : "bg-border",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "text-center text-[11px] leading-tight",
                    current || done ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {rejected && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive mt-4 rounded-lg border px-3 py-2 text-xs">
          {request.stage === "Manager Rejected"
            ? `Rejected by ${request.managerDecision?.by}: ${request.managerDecision?.note}`
            : `Rejected by HR (${request.hrDecision?.by}): ${request.hrDecision?.note}`}
        </div>
      )}
    </div>
  );
}

/** Notice-period countdown card, shown to HR/manager and the employee. */
export function NoticePeriodCard({ request }) {
  const { served, remaining, pct } = noticeProgress(request);
  if (
    !["Notice Period", "HR Clearance", "Final Settlement", "Exit Completed"].includes(request.stage)
  )
    return null;

  return (
    <Card className="shadow-card border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="text-primary h-4 w-4" /> Notice Period
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Notice length" value={`${request.noticeDays ?? 0} days`} />
          <Metric label="Started on" value={fmtDate(request.noticeStart)} />
          <Metric label="Last working day" value={fmtDate(request.noticeEnd)} highlight />
          <Metric label="Days remaining" value={`${remaining}`} highlight />
        </div>
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              {served} of {request.noticeDays ?? 0} days served
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge
            variant="outline"
            className={
              request.exitInterviewDone
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border"
            }
          >
            Exit interview {request.exitInterviewDone ? "done" : "pending"}
          </Badge>
          <Badge
            variant="outline"
            className={
              request.fnfSettled ? "border-primary/30 bg-primary/10 text-primary" : "border-border"
            }
          >
            F&amp;F {request.fnfSettled ? "settled" : "pending"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className="border-border bg-muted/30 rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold", highlight && "text-primary")}>{value}</div>
    </div>
  );
}

/** Read-only clearance summary (employee view). */
export function ClearanceSummary({ request }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="text-primary h-4 w-4" /> HR Clearance Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CLEARANCE_AREAS.map((a) => {
          const c = request.clearances[a.key];
          return (
            <div key={a.key} className="border-border rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{a.label}</div>
                <Badge variant="outline" className={clearanceTone(c.status)}>
                  {c.status}
                </Badge>
              </div>
              <div className="text-muted-foreground mt-1 text-[11px]">
                {a.owner} · officer <b className="text-foreground">{c.officer || "—"}</b>
                {c.ticked?.length ? ` · ${c.ticked.length}/${a.checklist.length} items` : ""}
              </div>
              {c.note && <div className="mt-1.5 text-xs">{c.note}</div>}
              {c.by && (
                <div className="text-muted-foreground mt-1 text-[11px]">
                  {c.by} · <span className="whitespace-nowrap">{fmtDate(c.on)}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Vertical audit timeline. */
export function ExitTimeline({ request }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock3 className="text-primary h-4 w-4" /> Exit Trail
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="border-border relative space-y-4 border-l pl-5">
          {[...request.timeline].reverse().map((t, i) => (
            <li key={i} className="relative">
              <span className="border-primary bg-background absolute top-1 -left-[26px] grid h-3 w-3 place-items-center rounded-full border-2" />
              <div className="text-sm font-semibold">{t.stage}</div>
              <div className="text-muted-foreground text-[11px]">
                {t.by} · {t.role} · <span className="whitespace-nowrap">{fmtDate(t.on)}</span>
              </div>
              {t.note && <div className="text-muted-foreground mt-1 text-xs">{t.note}</div>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/** Compact employee identity strip used on exit cards. */
export function ExitIdentity({ request }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-1.5">
        <User2 className="h-3.5 w-3.5" />
        {request.empId}
      </span>
      <span>{request.designation}</span>
      <span>{request.dept}</span>
      <span>{request.branch}</span>
      <span>Manager: {request.managerName}</span>
      <span className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" />
        {request.document || "No letter attached"}
      </span>
    </div>
  );
}
