import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { appraisalTone, useSelfAppraisals } from "@/features/performance/data/self-appraisal";
import {
  SelfAppraisalDetail,
  SelfAppraisalForm,
} from "@/features/performance/components/SelfAppraisal";
import { ReviewHistory } from "@/features/performance/components/ReviewForms";
import { TeamReviewDetail } from "@/features/performance/components/TeamReviewForm";
import { teamReviewStore, updateTeamReview } from "@/features/organization/data/manager-data";
import { toast } from "sonner";
import { useHrReviews } from "@/features/performance/data/hr-review-data";
import { HrReviewDetail } from "@/features/performance/components/HrReviews";
import { usePIPs, pipTone } from "@/features/performance/data/pip-data";
import { PIPDetail } from "@/features/performance/components/PIPTab";
import {
  useHrAppraisals,
  appraisalStatusTone,
  renderHrAppraisalLetter,
} from "@/features/performance/data/appraisal-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { MyAppraisalCycles } from "@/features/performance/components/AppraisalWorkflowTab";

function EmpAppraisals() {
  const me = useCurrentUser();
  const mine = useSelfAppraisals().filter((a) => a.empId === me.id);
  const [open, setOpen] = useState(null);
  const [view, setView] = useState(null);
  const live = mine.find((a) => !["Applied", "Rejected"].includes(a.stage));
  const shared = teamReviewStore
    .use()
    .filter((r) => r.empId === me.id && r.status === "Completed" && r.sharedWithEmployee);
  const [viewShared, setViewShared] = useState(null);
  const hrShared = useHrReviews().filter(
    (r) => r.empId === me.id && r.status === "Completed" && r.sharedWithEmployee,
  );
  const [viewHr, setViewHr] = useState(null);
  const myPips = usePIPs().filter((p) => p.empId === me.id && p.status !== "Archived");
  const [viewPip, setViewPip] = useState(null);
  const hrAppraisals = useHrAppraisals().filter(
    (a) => a.empId === me.id && a.status !== "Draft" && a.status !== "Rejected",
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardList className="text-primary h-6 w-6" /> My Appraisals
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Self-appraisal → Manager → HR → Unit Head → HR applies the pay grade and issues your
            letter. Outcomes reflect on your dashboard, salary structure and payslips.
          </p>
        </div>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          disabled={!!live && live.stage !== "Draft" && live.stage !== "Sent back"}
          onClick={() =>
            setOpen({
              edit:
                live && (live.stage === "Draft" || live.stage === "Sent back") ? live : undefined,
            })
          }
        >
          <Plus className="h-4 w-4" />{" "}
          {live && (live.stage === "Draft" || live.stage === "Sent back")
            ? "Continue self-appraisal"
            : "New self-appraisal"}
        </Button>
      </div>
      {live && live.stage !== "Draft" && live.stage !== "Sent back" && (
        <Card className="shadow-card border-gold/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <span>
              Your <b>{live.purpose}</b> ({live.quarter}) is in progress.
            </span>
            <Badge variant="outline" className={appraisalTone(live.stage)}>
              {live.stage}
            </Badge>
          </CardContent>
        </Card>
      )}
      {/* HR-started Self → HOD → HR cycles: the Self Appraisal stage is filled in here (without this the cycle could never leave that stage). */}
      <MyAppraisalCycles employeeId={me.id} />
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {["Ref", "Purpose", "Cycle", "Timeline", "Asked for", "Stage", "Outcome", ""].map(
                  (h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {mine.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-8 text-center">
                    No self-appraisals yet — raise one when a cycle opens or when you want a grade /
                    pay review.
                  </td>
                </tr>
              )}
              {mine.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{a.id}</td>
                  <td className="p-3">{a.purpose}</td>
                  <td className="p-3 text-xs">{a.quarter}</td>
                  <td className="p-3 text-xs">
                    {a.timeline.from} → {a.timeline.to}
                  </td>
                  <td className="p-3 text-xs">
                    {a.value.expectedGrade} · {a.value.expectedHikePct ?? "—"} %
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={appraisalTone(a.stage)}>
                      {a.stage}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">
                    {a.outcome
                      ? `${a.outcome.previousGrade} → ${a.outcome.newGrade} · +${a.outcome.hikePct} %`
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setView(a)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div>
        <h2 className="text-lg font-semibold">Manager reviews shared with me</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Detailed reviews your reporting manager completed and shared — read the feedback and
          acknowledge.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shared.length === 0 && (
            <Card className="shadow-card md:col-span-2">
              <CardContent className="text-muted-foreground p-6 text-center text-sm">
                No manager reviews shared yet.
              </CardContent>
            </Card>
          )}
          {shared.map((r) => (
            <Card key={r.id} className={`shadow-card ${!r.employeeAck ? "border-gold/40" : ""}`}>
              <CardContent className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.cycle}</span>
                  <Badge variant="outline">{r.basis ?? "Performance review"}</Badge>
                  <span className="text-muted-foreground ml-auto text-xs">
                    <span className="whitespace-nowrap">{r.date}</span> · {r.manager}
                  </span>
                </div>
                <div className="text-sm">
                  Overall <b>{r.overallScore ?? "—"}/5</b> · {r.rating || "—"}
                  {r.recommendation ? ` · ${r.recommendation}` : ""}
                </div>
                <div className="text-muted-foreground line-clamp-2 text-xs">{r.feedback}</div>
                <div className="flex items-center gap-2 pt-1">
                  {r.employeeAck ? (
                    <span className="text-primary text-xs">Acknowledged {r.employeeAck.on}</span>
                  ) : (
                    <span className="text-destructive text-xs">Acknowledgement pending</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7"
                    onClick={() => setViewShared(r)}
                  >
                    Read &amp; acknowledge
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">HR reviews shared with me</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Detailed reviews run by HR — skills, evaluation parameters, goals considered and
          recommendation. Read and acknowledge.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {hrShared.length === 0 && (
            <Card className="shadow-card md:col-span-2">
              <CardContent className="text-muted-foreground p-6 text-center text-sm">
                No HR reviews shared yet.
              </CardContent>
            </Card>
          )}
          {hrShared.map((r) => (
            <Card
              key={r.id}
              className={`shadow-card cursor-pointer ${!r.employeeAck ? "border-gold/40" : ""}`}
              onClick={() => setViewHr(r)}
            >
              <CardContent className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.cycle}</span>
                  <Badge variant="outline">{r.type}</Badge>
                  <span className="text-muted-foreground ml-auto text-xs">
                    <span className="whitespace-nowrap">{r.date}</span> · {r.reviewer}
                  </span>
                </div>
                <div className="text-sm">
                  Overall <b>{r.overallScore ?? "—"}/5</b> · {r.rating || "—"} · {r.recommendation}
                </div>
                <div className="text-muted-foreground line-clamp-2 text-xs">{r.remarks}</div>
                <div className="flex items-center gap-2 pt-1">
                  {r.employeeAck ? (
                    <span className="text-primary text-xs">Acknowledged {r.employeeAck.on}</span>
                  ) : (
                    <span className="text-destructive text-xs">Acknowledgement pending</span>
                  )}
                  <Button size="sm" variant="outline" className="ml-auto h-7">
                    Read &amp; acknowledge
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {myPips.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">My improvement plans</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Plans raised for you with objectives, checkpoints and the people supporting you. Read
            and acknowledge.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {myPips.map((p) => (
              <Card
                key={p.id}
                className={`shadow-card cursor-pointer ${!p.employeeAck ? "border-gold/40" : ""}`}
                onClick={() => setViewPip(p)}
              >
                <CardContent className="space-y-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.id}</span>
                    <Badge variant="outline" className={pipTone(p.status)}>
                      {p.status}
                    </Badge>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {p.start} → {p.end}
                    </span>
                  </div>
                  <div className="text-sm">{p.reason}</div>
                  <div className="text-muted-foreground text-xs">
                    {p.objectives.filter((o) => o.done).length}/{p.objectives.length} objectives met
                    · {p.cadence ?? "weekly"} checkpoints · raised by {p.raisedBy}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {p.employeeAck ? (
                      <span className="text-primary text-xs">Acknowledged {p.employeeAck.on}</span>
                    ) : (
                      <span className="text-destructive text-xs">Acknowledgement pending</span>
                    )}
                    <Button size="sm" variant="outline" className="ml-auto h-7">
                      Open plan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {hrAppraisals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Appraisals applied by HR</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {hrAppraisals.map((a) => (
              <Card key={a.id} className="shadow-card">
                <CardContent className="space-y-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.purpose}</span>
                    <Badge variant="outline" className={appraisalStatusTone(a.status)}>
                      {a.status}
                    </Badge>
                    <span className="text-muted-foreground ml-auto text-xs">{a.cycle}</span>
                  </div>
                  <div className="text-sm">
                    {a.method} · +{a.percentage} % · grade {a.grade} → {a.newGrade} · effective{" "}
                    {a.effectiveFrom}
                  </div>
                  <div className="text-muted-foreground line-clamp-2 text-xs">{a.whyHappened}</div>
                  {a.letterRef && (
                    <div className="text-primary flex items-center gap-2 text-xs">
                      {a.letterType} {a.letterRef}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-7"
                        onClick={() => {
                          if (!renderHrAppraisalLetter(a))
                            toast.error(`No ${a.letterType} template available`);
                        }}
                      >
                        Download letter
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold">Review history</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Quarterly (goal) reviews and annual appraisal forms run by HR.
        </p>
        <ReviewHistory empId={me.id} who="self" />
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Self-appraisal</DialogTitle>
            <DialogDescription>
              Purpose → supported goals → quarter & timeline → ratings → value proposition → submit
              for approval.
            </DialogDescription>
          </DialogHeader>
          {open && <SelfAppraisalForm existing={open.edit} onDone={() => setOpen(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewShared} onOpenChange={(o) => !o && setViewShared(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {viewShared && (
            <TeamReviewDetail
              r={shared.find((x) => x.id === viewShared.id) ?? viewShared}
              mode="self"
              onAck={(comment) => {
                updateTeamReview(viewShared.id, {
                  employeeAck: { on: new Date().toISOString().slice(0, 10), comment },
                });
                pushAlert({
                  empId: viewShared.managerId,
                  kind: "review",
                  to: "/emp/reviews",
                  title: `Review acknowledged — ${me.name}`,
                  body: `${viewShared.cycle}${comment ? `: "${comment}"` : ""}`,
                });
                toast.success("Review acknowledged — your manager has been notified.");
                setViewShared(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewHr} onOpenChange={(o) => !o && setViewHr(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {viewHr && (
            <HrReviewDetail r={hrShared.find((x) => x.id === viewHr.id) ?? viewHr} mode="self" />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewPip} onOpenChange={(o) => !o && setViewPip(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {viewPip && (
            <PIPDetail pip={myPips.find((x) => x.id === viewPip.id) ?? viewPip} mode="self" />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{view?.purpose}</DialogTitle>
            <DialogDescription>
              {view?.id} · {view?.quarter}
            </DialogDescription>
          </DialogHeader>
          {view && <SelfAppraisalDetail a={view} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmpAppraisals;
