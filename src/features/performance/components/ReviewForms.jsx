// Detailed Quarterly review (goals) and Annual appraisal forms — same form used for self-appraisal (with justification +
// evidence upload), manager rating and HR calibration. Evaluation parameters come from Master Data (performance-config.ts).
import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { ClipboardCheck, Paperclip, Send, Star, History, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { allUsers, useCurrentUser } from "@/features/auth/data/auth-session";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { managerStore } from "@/features/organization/data/manager-data";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import { usePerformanceScope } from "@/features/performance/components/scope";
import { useGoals } from "@/features/performance/data/goals-data";
import {
  newReview,
  reviewTone,
  updateReview,
  useEvalParams,
  useReviews,
  weightedRating,
} from "@/features/performance/data/performance-config";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import { templatesOf, renderTemplate } from "@/features/organization/data/doc-master";

const STEPS = ["Open", "Self submitted", "Manager reviewed", "HR calibrated", "Closed"];
/**
 * @typedef {"self" | "manager" | "hr"} Who
 */

function Pills({ value, onChange, max = 5 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn(
            "h-9 w-9 rounded-md border text-xs font-semibold sm:h-7 sm:w-7",
            (value ?? 0) >= n ? "bg-gradient-emerald border-primary text-white" : "border-border",
            onChange && "hover:bg-muted",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function ReviewFormEditor({ review, who }) {
  const me = useCurrentUser();
  const params = useEvalParams().filter((p) => p.active);
  const [r, setR] = useState(review);
  const editable =
    (who === "self" && review.status === "Open") ||
    (who === "manager" && review.status === "Self submitted") ||
    (who === "hr" && review.status === "Manager reviewed");
  const selfAvg = weightedRating(r.ratings, params, "self");
  const mgrAvg = weightedRating(r.ratings, params, "manager");
  const hrAvg = weightedRating(r.ratings, params, "hr");
  const goalScore = (k) => {
    const g = r.goals.filter((x) => x[k]);
    const w = g.reduce((t, x) => t + x.weight, 0) || 1;
    return g.length ? +(g.reduce((t, x) => t + x[k] * x.weight, 0) / w).toFixed(2) : null;
  };
  // A parameter added to Master Data after the form was launched has no rating row yet — create it instead of dropping the click.
  const setRating = (pid, patch) =>
    setR({
      ...r,
      ratings: r.ratings.some((x) => x.paramId === pid)
        ? r.ratings.map((x) => (x.paramId === pid ? { ...x, ...patch } : x))
        : [
            ...r.ratings,
            {
              paramId: pid,
              self: null,
              manager: null,
              hr: null,
              selfNote: "",
              managerNote: "",
              ...patch,
            },
          ],
    });
  const setGoal = (i, patch) =>
    setR({ ...r, goals: r.goals.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
  const save = (status) => {
    const d = new Date().toISOString().slice(0, 10);
    const next = {
      ...r,
      status: status ?? r.status,
      self: status === "Self submitted" ? { ...r.self, submittedOn: d } : r.self,
      manager:
        status === "Manager reviewed" ? { ...r.manager, reviewedOn: d, by: me.name } : r.manager,
      hr:
        status === "HR calibrated" || status === "Closed"
          ? { ...r.hr, closedOn: d, by: me.name }
          : r.hr,
    };
    updateReview(r.id, () => next);
    setR(next);
    toast.success(status ? `${status}` : "Draft saved");
    // Each hand-off notifies the next actor (the form used to change status silently).
    const org = findEmployee(r.empId)?.orgId;
    const hr = allUsers()
      .filter((u) => (u.role === "HR" || u.role === "CHRO") && (!org || u.orgId === org))
      .map((u) => u.id);
    if (status === "Self submitted") {
      const mgr = managerStore.get()[r.empId];
      if (mgr)
        pushAlert({
          empId: mgr,
          kind: "review",
          to: "/emp/reviews",
          title: `${r.kind} to rate — ${r.employee}`,
          body: `${r.cycle}: self-appraisal submitted. Rate goals and parameters under Team Reviews.`,
        });
    }
    if (status === "Manager reviewed")
      hr.forEach((id) =>
        pushAlert({
          empId: id,
          kind: "review",
          to: "/org/performance",
          title: `${r.kind} ready for calibration — ${r.employee}`,
          body: `${r.cycle}: manager review done (${r.manager.recommendation}). Calibrate under Performance → Review Forms.`,
        }),
      );
    if (status === "Closed")
      pushAlert({
        empId: r.empId,
        kind: "review",
        to: "/emp/appraisals",
        title: `${r.kind} closed — ${r.cycle}`,
        body: `Final rating ${next.hr.calibratedRating ?? "—"}${next.hr.finalHikePct ? ` · ${next.hr.finalHikePct} % hike` : ""}. See Review history on My Appraisals.`,
      });
  };
  const missingSelf =
    who === "self" &&
    (params.some((p) => (r.ratings.find((x) => x.paramId === p.id)?.self ?? null) === null) ||
      r.goals.some((g) => g.selfRating === null) ||
      !r.self.justification.trim());
  const missingManager =
    params.some((p) => (r.ratings.find((x) => x.paramId === p.id)?.manager ?? null) === null) ||
    !r.manager.recommendation;
  return (
    <div className="space-y-4 text-sm">
      <WorkflowStepper
        steps={STEPS}
        active={STEPS.indexOf(r.status)}
        title={`${r.kind} · ${r.cycle}`}
        badge={
          <Badge variant="outline" className={reviewTone(r.status)}>
            {r.status}
          </Badge>
        }
      />
      {/* Goals */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            1 · Goals {r.kind === "Quarterly review" ? "for the quarter" : "for the year"} — self
            rating &amp; manager rating
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {r.goals.map((g, i) => (
            <div
              key={i}
              className="border-border grid grid-cols-1 items-start gap-2 rounded-lg border p-2 sm:grid-cols-[1.6fr_1fr_auto_auto]"
            >
              <div>
                <div className="font-medium">
                  {g.title} <Badge variant="outline">{g.weight} %</Badge>
                </div>
                <div className="text-muted-foreground text-xs">Target: {g.target}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  Achieved
                </Label>
                {who === "self" && editable ? (
                  <Input
                    className="h-8"
                    value={g.achieved}
                    onChange={(e) => setGoal(i, { achieved: e.target.value })}
                  />
                ) : (
                  <div className="text-xs">{g.achieved || "—"}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  Self
                </Label>
                <Pills
                  value={g.selfRating}
                  onChange={
                    who === "self" && editable ? (n) => setGoal(i, { selfRating: n }) : undefined
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  Manager
                </Label>
                <Pills
                  value={g.managerRating}
                  onChange={
                    who === "manager" && editable
                      ? (n) => setGoal(i, { managerRating: n })
                      : undefined
                  }
                />
              </div>
            </div>
          ))}
          <div className="text-muted-foreground text-xs">
            Weighted goal score — self {goalScore("selfRating") ?? "—"} · manager{" "}
            {goalScore("managerRating") ?? "—"}
          </div>
        </CardContent>
      </Card>
      {/* Parameters */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            2 · Evaluation parameters (from Master Data) — {params.map((p) => p.name).join(", ")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-muted/40 text-muted-foreground tracking-wider uppercase">
                <tr>
                  <th className="p-2 text-left">Parameter</th>
                  <th className="p-2 text-left">Self</th>
                  <th className="p-2 text-left">Justification / evidence</th>
                  <th className="p-2 text-left">Manager</th>
                  <th className="p-2 text-left">Manager note</th>
                  <th className="p-2 text-left">HR</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {params.map((p) => {
                  const x = r.ratings.find((y) => y.paramId === p.id) ?? {
                    paramId: p.id,
                    self: null,
                    manager: null,
                    hr: null,
                    selfNote: "",
                    managerNote: "",
                  };
                  return (
                    <tr key={p.id}>
                      <td className="p-2">
                        <div className="font-medium">
                          {p.name} <span className="text-muted-foreground">· {p.weight} %</span>
                        </div>
                        <div className="text-muted-foreground">{p.description}</div>
                      </td>
                      <td className="p-2">
                        <Pills
                          value={x.self}
                          onChange={
                            who === "self" && editable
                              ? (n) => setRating(p.id, { self: n })
                              : undefined
                          }
                        />
                      </td>
                      <td className="p-2">
                        {who === "self" && editable ? (
                          <Input
                            className="h-7"
                            value={x.selfNote}
                            onChange={(e) => setRating(p.id, { selfNote: e.target.value })}
                            placeholder="Why this rating"
                          />
                        ) : (
                          x.selfNote || "—"
                        )}
                      </td>
                      <td className="p-2">
                        <Pills
                          value={x.manager}
                          onChange={
                            who === "manager" && editable
                              ? (n) => setRating(p.id, { manager: n })
                              : undefined
                          }
                        />
                      </td>
                      <td className="p-2">
                        {who === "manager" && editable ? (
                          <Input
                            className="h-7"
                            value={x.managerNote}
                            onChange={(e) => setRating(p.id, { managerNote: e.target.value })}
                          />
                        ) : (
                          x.managerNote || "—"
                        )}
                      </td>
                      <td className="p-2">
                        <Pills
                          value={x.hr}
                          onChange={
                            who === "hr" && editable ? (n) => setRating(p.id, { hr: n }) : undefined
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-border border-t font-semibold">
                  <td className="p-2">Weighted rating</td>
                  <td className="p-2">{selfAvg ?? "—"}</td>
                  <td />
                  <td className="p-2">{mgrAvg ?? "—"}</td>
                  <td />
                  <td className="p-2">{hrAvg ?? "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* Self appraisal */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            3 · Self-appraisal{" "}
            {r.self.submittedOn && (
              <span className="text-muted-foreground text-xs font-normal">
                · submitted <span className="whitespace-nowrap">{r.self.submittedOn}</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ["achievements", "Key achievements"],
            ["valueCreated", "Value created (revenue / savings / client impact)"],
            ["justification", "Justification for the ratings claimed *"],
            ["development", "Development needs / training asks"],
          ].map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              {who === "self" && editable ? (
                <Textarea
                  rows={3}
                  value={r.self[k]}
                  onChange={(e) => setR({ ...r, self: { ...r.self, [k]: e.target.value } })}
                />
              ) : (
                <div className="border-border min-h-[40px] rounded-lg border p-2 text-xs">
                  {r.self[k] || "—"}
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Label className="text-xs">Evidence</Label>
            {r.self.evidence.map((e) => (
              <Badge key={e} variant="outline">
                <Paperclip className="mr-1 h-3 w-3" />
                {e}
              </Badge>
            ))}
            {who === "self" && editable && (
              <label className="text-primary cursor-pointer text-xs underline">
                Upload
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(ev) => {
                    captureFiles(ev.target.files);
                    setR({
                      ...r,
                      self: {
                        ...r.self,
                        evidence: [
                          ...r.self.evidence,
                          ...Array.from(ev.target.files ?? []).map((f) => f.name),
                        ],
                      },
                    });
                    ev.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Manager */}
      {(who !== "self" || r.status !== "Open") && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              4 · Manager review{" "}
              {r.manager.reviewedOn && (
                <span className="text-muted-foreground text-xs font-normal">
                  · {r.manager.by} on{" "}
                  <span className="whitespace-nowrap">{r.manager.reviewedOn}</span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_180px_120px_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Comments</Label>
              {who === "manager" && editable ? (
                <Textarea
                  rows={3}
                  value={r.manager.comments}
                  onChange={(e) =>
                    setR({ ...r, manager: { ...r.manager, comments: e.target.value } })
                  }
                />
              ) : (
                <div className="border-border min-h-[40px] rounded-lg border p-2 text-xs">
                  {r.manager.comments || "—"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recommendation</Label>
              <Select
                disabled={!(who === "manager" && editable)}
                value={r.manager.recommendation || undefined}
                onValueChange={(v) => setR({ ...r, manager: { ...r.manager, recommendation: v } })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {["Exceeds", "Meets", "Below"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {r.kind === "Annual appraisal" && (
              <div className="space-y-1">
                <Label className="text-xs">Hike %</Label>
                <Input
                  type="number"
                  disabled={!(who === "manager" && editable)}
                  min={0}
                  value={r.manager.hikePct ?? ""}
                  onChange={(e) =>
                    setR({
                      ...r,
                      manager: {
                        ...r.manager,
                        hikePct: e.target.value === "" ? null : Math.max(0, +e.target.value),
                      },
                    })
                  }
                />
              </div>
            )}
            {r.kind === "Annual appraisal" && (
              <label className="flex items-center gap-2 pb-2 text-xs">
                <Switch
                  disabled={!(who === "manager" && editable)}
                  checked={r.manager.promotion}
                  onCheckedChange={(v) => setR({ ...r, manager: { ...r.manager, promotion: v } })}
                />{" "}
                Promotion
              </label>
            )}
          </CardContent>
        </Card>
      )}
      {/* HR */}
      {(who === "hr" || r.status === "HR calibrated" || r.status === "Closed") && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              5 · HR calibration{" "}
              {r.hr.closedOn && (
                <span className="text-muted-foreground text-xs font-normal">
                  · {r.hr.by} on <span className="whitespace-nowrap">{r.hr.closedOn}</span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_140px_140px]">
            <div className="space-y-1">
              <Label className="text-xs">Calibration note</Label>
              {who === "hr" && editable ? (
                <Textarea
                  rows={2}
                  value={r.hr.comments}
                  onChange={(e) => setR({ ...r, hr: { ...r.hr, comments: e.target.value } })}
                />
              ) : (
                <div className="border-border min-h-[40px] rounded-lg border p-2 text-xs">
                  {r.hr.comments || "—"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Final rating</Label>
              <Input
                type="number"
                step="0.1"
                disabled={!(who === "hr" && editable)}
                min={1}
                max={5}
                value={r.hr.calibratedRating ?? ""}
                onChange={(e) =>
                  setR({
                    ...r,
                    hr: {
                      ...r.hr,
                      calibratedRating: e.target.value === "" ? null : +e.target.value,
                    },
                  })
                }
                placeholder={String(hrAvg ?? mgrAvg ?? "")}
              />
            </div>
            {r.kind === "Annual appraisal" && (
              <div className="space-y-1">
                <Label className="text-xs">Final hike %</Label>
                <Input
                  type="number"
                  disabled={!(who === "hr" && editable)}
                  min={0}
                  value={r.hr.finalHikePct ?? ""}
                  onChange={(e) =>
                    setR({
                      ...r,
                      hr: {
                        ...r.hr,
                        finalHikePct: e.target.value === "" ? null : Math.max(0, +e.target.value),
                      },
                    })
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button variant="outline" onClick={() => save()}>
            Save draft
          </Button>
        )}
        {who === "self" && editable && (
          <Button
            className="bg-gradient-emerald text-white"
            disabled={missingSelf}
            onClick={() => save("Self submitted")}
          >
            <Send className="h-4 w-4" /> Submit self-appraisal
          </Button>
        )}
        {who === "manager" && editable && (
          <Button
            className="bg-gradient-emerald text-white"
            disabled={missingManager}
            onClick={() => save("Manager reviewed")}
          >
            <Star className="h-4 w-4" /> Submit manager review
          </Button>
        )}
        {who === "hr" && editable && (
          <Button
            className="bg-gradient-emerald text-white"
            disabled={
              !(r.hr.calibratedRating && r.hr.calibratedRating >= 1 && r.hr.calibratedRating <= 5)
            }
            onClick={() => save("Closed")}
          >
            <ClipboardCheck className="h-4 w-4" /> Calibrate &amp; close
          </Button>
        )}
        {missingSelf && editable && (
          <span className="text-destructive self-center text-xs">
            Rate every goal and parameter and enter your justification.
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const t = templatesOf("Self-Appraisal Form")[0];
            if (!t) return toast.error("No Self-Appraisal Form template");
            renderTemplate(
              t,
              {
                employee: r.employee,
                employee_name: r.employee,
                employee_id: r.empId,
                cycle: r.cycle,
                kind: r.kind,
                self_rating: String(selfAvg ?? ""),
                manager_rating: String(mgrAvg ?? ""),
                final_rating: String(r.hr.calibratedRating ?? ""),
                date: new Date().toLocaleDateString("en-IN"),
              },
              {
                columns: ["Parameter", "Self", "Manager", "HR"],
                rows: params.map((p) => {
                  const x = r.ratings.find((y) => y.paramId === p.id);
                  return [p.name, x?.self ?? "—", x?.manager ?? "—", x?.hr ?? "—"];
                }),
              },
            );
          }}
        >
          <Download className="h-4 w-4" /> Print form
        </Button>
      </div>
    </div>
  );
}

/** Review history split into Quarterly reviews and Annual reviews (item 29). */
export function ReviewHistory({ empId, who }) {
  const rows = useReviews().filter((r) => r.empId === empId);
  const params = useEvalParams();
  const [open, setOpen] = useState(null);
  const section = (kind, title) => {
    const list = rows.filter((r) => r.kind === kind);
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="text-primary h-4 w-4" /> {title}{" "}
            <Badge variant="outline">{list.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {["Cycle", "Status", "Self", "Manager", "Final", "Recommendation", ""].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-6 text-center">
                    No {title.toLowerCase()} yet.
                  </td>
                </tr>
              )}
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.cycle}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={reviewTone(r.status)}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3">{weightedRating(r.ratings, params, "self") ?? "—"}</td>
                  <td className="p-3">{weightedRating(r.ratings, params, "manager") ?? "—"}</td>
                  <td className="p-3 font-semibold">{r.hr.calibratedRating ?? "—"}</td>
                  <td className="p-3">
                    {r.manager.recommendation || "—"}
                    {r.hr.finalHikePct ? ` · ${r.hr.finalHikePct} % hike` : ""}
                    {r.manager.promotion ? " · promotion" : ""}
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(r)}>
                      {r.status === "Open" && who === "self" ? "Fill form" : "Open"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };
  return (
    <div className="space-y-4">
      {section("Quarterly review", "Quarterly reviews")}
      {section("Annual appraisal", "Annual reviews")}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {open?.employee} · {open?.kind}
            </DialogTitle>
            <DialogDescription>{open?.cycle}</DialogDescription>
          </DialogHeader>
          {open && <ReviewFormEditor key={open.id} review={open} who={who} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** HR / manager: launch a review cycle for one employee, pulling their approved goals. */
export function LaunchReviewDialog({ open, onClose, defaultEmpId, employeeIds }) {
  const params = useEvalParams();
  const goals = useGoals();
  const me = useCurrentUser();
  // Active entity only (the picker listed every entity's employees) and never yourself.
  const emps = useScopedEmployees().filter(
    (e) => e.id !== me.id && (!employeeIds || employeeIds.includes(e.id)),
  );
  const [empId, setEmpId] = useState(defaultEmpId ?? "");
  const [kind, setKind] = useState("Quarterly review");
  const [cycle, setCycle] = useState("Q3 FY27 (Oct–Dec 2026)");
  const [period, setPeriod] = useState("2026-Q3");
  const emp = emps.find((e) => e.id === empId);
  const existingForms = useReviews();
  const duplicate = existingForms.some(
    (r) => r.empId === empId && r.kind === kind && r.period === period.trim(),
  );
  const empGoals = goals.filter((g) => g.ownerId === empId && g.status !== "Rejected");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Launch review form</DialogTitle>
          <DialogDescription>
            Creates the detailed form with the employee's goals and the{" "}
            {params.filter((p) => p.active).length} evaluation parameters from Master Data. The
            employee fills the self-appraisal first.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Employee</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {emps.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Kind</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setKind(v);
                  if (v === "Annual appraisal") {
                    setCycle("Annual FY 2026-27");
                    setPeriod("FY27");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quarterly review">Quarterly review (goals)</SelectItem>
                  <SelectItem value="Annual appraisal">Annual appraisal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Period code</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cycle label</Label>
            <Input value={cycle} onChange={(e) => setCycle(e.target.value)} />
          </div>
          {duplicate && (
            <div className="text-destructive text-xs">
              A {kind.toLowerCase()} for this employee and period already exists.
            </div>
          )}
          <div className="text-muted-foreground text-xs">
            {empGoals.length} goal(s) will be pulled in
            {empGoals.length === 0 &&
              " — the form will still open; goals can be added from My Goals"}
            .
          </div>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={!emp || !cycle.trim() || !period.trim() || duplicate}
            onClick={() => {
              newReview(
                empId,
                emp.name,
                kind,
                cycle,
                period,
                empGoals.map((g) => ({
                  title: g.title,
                  target: g.target,
                  achieved: "",
                  selfRating: null,
                  managerRating: null,
                  weight: g.weight || Math.round(100 / Math.max(empGoals.length, 1)),
                })),
                params,
              );
              toast.success(`${kind} launched for ${emp.name}`);
              onClose();
            }}
          >
            Launch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewCycleAdmin() {
  const perf = usePerformanceScope();
  // Entity + hierarchy scope; only HR roles calibrate — a manager opening a form here acts at the manager step.
  const rows = useReviews().filter((r) => perf.canSee(r.empId));
  const params = useEvalParams();
  const who = perf.isHr ? "hr" : "manager";
  const [launch, setLaunch] = useState(false);
  const [open, setOpen] = useState(null);
  const kpi = (label, v) => (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{label}</div>
        <div className="text-2xl font-bold">{v}</div>
      </CardContent>
    </Card>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-semibold">
            Detailed review forms (Quarterly goals / Annual appraisal)
          </div>
          <div className="text-muted-foreground text-xs">
            Self-appraisal with justification &amp; evidence → manager rating → HR calibration.
            Parameters:{" "}
            {params
              .filter((p) => p.active)
              .map((p) => p.name)
              .join(", ")}{" "}
            (Master Data → Assessment &amp; evaluation).
          </div>
        </div>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() => setLaunch(true)}
        >
          Launch review form
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {kpi("Forms", rows.length)}
        {kpi("Awaiting self", rows.filter((r) => r.status === "Open").length)}
        {kpi("Awaiting manager", rows.filter((r) => r.status === "Self submitted").length)}
        {kpi("Awaiting HR", rows.filter((r) => r.status === "Manager reviewed").length)}
      </div>
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Form",
                  "Employee",
                  "Kind",
                  "Cycle",
                  "Status",
                  "Self",
                  "Manager",
                  "Final",
                  "",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3 font-medium">{r.employee}</td>
                  <td className="p-3">{r.kind}</td>
                  <td className="p-3">{r.cycle}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={reviewTone(r.status)}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3">{weightedRating(r.ratings, params, "self") ?? "—"}</td>
                  <td className="p-3">{weightedRating(r.ratings, params, "manager") ?? "—"}</td>
                  <td className="p-3 font-semibold">{r.hr.calibratedRating ?? "—"}</td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(r)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <LaunchReviewDialog
        open={launch}
        onClose={() => setLaunch(false)}
        employeeIds={perf.orgWide ? undefined : [...perf.visible]}
      />
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {open?.employee} · {open?.kind}
            </DialogTitle>
            <DialogDescription>
              {open?.cycle} · {who === "hr" ? "HR calibration view" : "manager view"}
            </DialogDescription>
          </DialogHeader>
          {open && <ReviewFormEditor key={open.id} review={open} who={who} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
