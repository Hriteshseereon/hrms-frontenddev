// Retention, Exit date → F&F, continuity rejoin, exit survey and F&F configuration — UI over separation-data.ts.
import { useMemo, useState } from "react";
import {
  HeartHandshake,
  Wallet,
  RotateCcw,
  MessageSquareText,
  Settings2,
  Download,
  CheckCircle2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  ACTIVE_STAGES,
  daysBetween,
  fmtDate,
  markExitInterview,
  todayISO,
} from "@/features/exit/data/exit-data";
import { RetainFormDialog, RetentionAudit } from "@/features/exit/components/ExitWorkflowPieces";
import {
  addExitSurvey,
  advanceFnf,
  computeFnf,
  computeGratuityAmount,
  fnfForExit,
  proposeRejoin,
  retentionForExit,
  retentionTone,
  saveFnf,
  saveFnfConfig,
  startRetention,
  updateRetention,
  useExitSurveys,
  useFnf,
  useFnfConfig,
  useRejoins,
  useRetention,
} from "@/features/exit/data/separation-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { templatesOf, renderTemplate } from "@/features/organization/data/doc-master";
import { exportReportPdf } from "@/lib/export-utils";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import { BarsChart, ChartCard, DonutChart } from "@/features/dashboard/components/Charts";

const act = (r) => toast[r.ok ? "success" : "error"](r.message);
const OFFER_KINDS = [
  "Compensation",
  "Role change",
  "Project change",
  "Location",
  "Flexibility",
  "Counselling",
];

/* ------------------------------- Retention ------------------------------- */
/** Compact "Retain" action shown on every live resignation (cards, table rows) — opens the retention audit form. */
/** Roles configured under Master Data → Exit & F&F ("retention workflow owners"), plus the admin / CEO overrides. */
export function useCanRetain() {
  const me = useCurrentUser();
  const cfg = useFnfConfig();
  return (
    ["SuperAdmin", "Admin", "CEO"].includes(me.role) || cfg.retentionOwnerRoles.includes(me.role)
  );
}
export function RetainButton({ request, size = "sm" }) {
  useRetention();
  const canRetain = useCanRetain();
  const rc = retentionForExit(request.id);
  const [open, setOpen] = useState(false);
  const live = ACTIVE_STAGES.includes(request.stage);
  if (!live && !rc) return null;
  if (rc && (rc.status === "Retained" || rc.status === "Not retained" || rc.status === "Withdrawn"))
    return (
      <Badge
        variant="outline"
        className={cn(retentionTone(rc.status), size === "xs" && "text-[10px]")}
      >
        {rc.status}
      </Badge>
    );
  if (!live || !canRetain) return null;
  return (
    <>
      <Button
        size="sm"
        className={cn("bg-gradient-emerald text-white", size === "xs" && "h-7 px-2 text-xs")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <HeartHandshake className={size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"} />{" "}
        {rc ? "Retention in progress · Retain" : "Retain"}
      </Button>
      <RetainFormDialog request={request} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RetentionPanel({ request }) {
  const me = useCurrentUser();
  useRetention();
  const rc = retentionForExit(request.id);
  const [offer, setOffer] = useState(rc?.offer ?? "");
  const [hike, setHike] = useState(rc?.hikePct ?? 0);
  const [kinds, setKinds] = useState(rc?.offerKind ?? []);
  const [note, setNote] = useState("");
  const canRetain = useCanRetain();
  const active = ACTIVE_STAGES.includes(request.stage) && canRetain;
  const [formOpen, setFormOpen] = useState(false);
  if (!rc)
    return (
      <Card className="shadow-card border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <HeartHandshake className="text-primary h-4 w-4" /> Retention
            </div>
            <div className="text-muted-foreground text-xs">
              Start a retention discussion before the exit proceeds. Retained employees count
              towards the HR retention KRA.
            </div>
          </div>
          {active && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => act(startRetention(request, me))}>
                Start discussion
              </Button>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => setFormOpen(true)}
              >
                <HeartHandshake className="h-4 w-4" /> Retain (audit form)
              </Button>
            </div>
          )}
          <RetainFormDialog request={request} open={formOpen} onClose={() => setFormOpen(false)} />
        </CardContent>
      </Card>
    );
  const closed =
    rc.status === "Retained" || rc.status === "Not retained" || rc.status === "Withdrawn";
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <HeartHandshake className="text-primary h-4 w-4" /> Retention · {rc.id}
          </span>
          <Badge variant="outline" className={retentionTone(rc.status)}>
            {rc.status === "In discussion" || rc.status === "Open"
              ? "Retention in progress"
              : rc.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="text-muted-foreground text-xs">
          Started <span className="whitespace-nowrap">{rc.startedOn}</span> by {rc.startedBy} ·
          owner {rc.owner}
        </div>
        <div className="bg-muted/40 rounded-lg p-2 text-xs">
          <b>Reason stated:</b> {rc.reasonStated}
        </div>
        {!closed && active ? (
          <>
            <div className="flex flex-wrap gap-1">
              {OFFER_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs",
                    kinds.includes(k)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
              <Textarea
                rows={2}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Retention offer (e.g., 12 % correction + move to Semtech data pod)"
              />
              <div className="space-y-1">
                <Label className="text-xs">Hike %</Label>
                <Input type="number" value={hike} onChange={(e) => setHike(+e.target.value)} />
              </div>
            </div>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Discussion note / outcome"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (hike < 0) return toast.error("Hike % cannot be negative.");
                  updateRetention(
                    rc.id,
                    { status: "Offer made", offer, hikePct: hike, offerKind: kinds },
                    me,
                    `Offer made: ${offer}`,
                  );
                  toast.success("Offer recorded");
                }}
                disabled={!offer.trim()}
              >
                Record offer
              </Button>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => setFormOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" /> Mark Retained (audit form)
              </Button>
              <RetainFormDialog
                request={request}
                open={formOpen}
                onClose={() => setFormOpen(false)}
              />
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive"
                onClick={() => {
                  updateRetention(
                    rc.id,
                    {
                      status: "Not retained",
                      outcomeNote: note || "Employee declined; exit continues.",
                    },
                    me,
                    "Not retained — exit continues",
                  );
                  toast("Exit continues");
                }}
              >
                Not retained
              </Button>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => {
                  const t = templatesOf("Retention Discussion Form")[0];
                  if (!t) return toast.error("No Retention Discussion Form template");
                  renderTemplate(t, {
                    employee_name: request.empName,
                    employee_id: request.empId,
                    department: request.dept,
                    manager: request.managerName,
                    reason: rc.reasonStated,
                    offer,
                    date: new Date().toLocaleDateString("en-IN"),
                  });
                }}
              >
                <Download className="h-3.5 w-3.5" /> Retention discussion form (Doc Master)
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div>
              <b>Offer:</b> {rc.offer || "—"}
              {rc.hikePct ? ` (${rc.hikePct} %)` : ""}{" "}
              {rc.offerKind.map((k) => (
                <Badge key={k} variant="outline" className="ml-1">
                  {k}
                </Badge>
              ))}
            </div>
            <div>
              <b>Outcome:</b> {rc.outcomeNote}
            </div>
            {rc.form && <RetentionAudit rc={rc} />}
          </div>
        )}
        <div className="text-muted-foreground border-border space-y-0.5 border-t pt-2 text-xs">
          {rc.history.map((h, i) => (
            <div key={i}>
              {h.at} · {h.by} — {h.action}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RetentionReport({ exits }) {
  const cases = useRetention();
  const [detail, setDetail] = useState(null);
  const resignations = exits.filter(
    (e) => e.stage !== "Manager Rejected" && e.stage !== "HR Rejected",
  ).length;
  const retained = cases.filter((c) => c.status === "Retained").length;
  const inProgress = cases.filter(
    (c) => c.status === "In discussion" || c.status === "Offer made" || c.status === "Open",
  ).length;
  const rate = cases.length ? Math.round((retained / cases.length) * 100) : 0;
  const byDept = Object.values(
    cases.reduce((m, c) => {
      const d = m[c.dept] ?? { name: c.dept, Retained: 0, "Not retained": 0, "In progress": 0 };
      if (c.status === "Retained") d.Retained++;
      else if (c.status === "Not retained") d["Not retained"]++;
      else d["In progress"]++;
      m[c.dept] = d;
      return m;
    }, {}),
  );
  const byKind = OFFER_KINDS.map((k) => ({
    name: k,
    value: cases.filter((c) => c.offerKind.includes(k)).length,
  })).filter((d) => d.value);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Resignations (all time)", resignations, ""],
          ["Retention cases", cases.length, ""],
          ["Retained", retained, "text-primary"],
          ["Retention rate (HR KRA)", `${rate} %`, rate >= 50 ? "text-primary" : "text-gold"],
        ].map(([k, v, c]) => (
          <Card key={String(k)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
              <div className={cn("text-2xl font-bold", c)}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Retention outcomes by department"
          subtitle={`${inProgress} in progress`}
          className="lg:col-span-2"
        >
          <BarsChart
            data={byDept}
            keys={[
              { key: "Retained", label: "Retained" },
              { key: "In progress", label: "In progress" },
              { key: "Not retained", label: "Not retained" },
            ]}
            stacked
            height={220}
          />
        </ChartCard>
        <ChartCard title="Levers used" subtitle="Offer types">
          <DonutChart data={byKind} height={220} />
        </ChartCard>
      </div>
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <div className="flex items-center justify-between p-3">
            <div className="text-sm font-semibold">Retention register</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportReportPdf({
                  title: "Employee Retention Report",
                  subtitle: "Seereon Consulting & IT Services · HR KRA",
                  summary: [
                    { label: "Cases", value: String(cases.length) },
                    { label: "Retained", value: String(retained) },
                    { label: "Rate", value: `${rate} %` },
                  ],
                  columns: [
                    "Case",
                    "Employee",
                    "Dept",
                    "Started",
                    "Owner",
                    "Offer",
                    "Status",
                    "Closed",
                  ],
                  rows: cases.map((c) => [
                    c.id,
                    c.employee,
                    c.dept,
                    c.startedOn,
                    c.owner,
                    c.offer || "—",
                    c.status,
                    c.closedOn ?? "—",
                  ]),
                })
              }
            >
              <Download className="h-4 w-4" /> Report
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Case",
                  "Employee",
                  "Dept",
                  "Manager",
                  "Started",
                  "Owner",
                  "Levers",
                  "Offer",
                  "Status",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {cases.map((c) => (
                <tr key={c.id} className={clickableRow} onClick={() => setDetail(c)}>
                  <td className="p-3 font-mono text-xs">{c.id}</td>
                  <td className="p-3 font-medium">
                    {c.employee}
                    <div className="text-muted-foreground text-xs">{c.empId}</div>
                  </td>
                  <td className="p-3">{c.dept}</td>
                  <td className="p-3">{c.managerName}</td>
                  <td className="p-3">
                    <span className="whitespace-nowrap">{c.startedOn}</span>
                  </td>
                  <td className="p-3">{c.owner}</td>
                  <td className="p-3">{c.offerKind.join(", ") || "—"}</td>
                  <td className="max-w-[260px] truncate p-3" title={c.offer}>
                    {c.offer || "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={retentionTone(c.status)}>
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.employee}`}
          subtitle={`${detail.empId} · ${detail.dept} · manager ${detail.managerName}`}
          badges={
            <Badge variant="outline" className={retentionTone(detail.status)}>
              {detail.status}
            </Badge>
          }
          record={detail}
          labels={{
            empId: "Employee ID",
            exitId: "Exit reference",
            dept: "Department",
            managerName: "Manager",
            offerKind: "Levers",
            hikePct: "Hike %",
            form: "Retention audit form",
          }}
          sections={[
            {
              title: "Case",
              keys: [
                "id",
                "exitId",
                "employee",
                "empId",
                "dept",
                "managerName",
                "status",
                "owner",
                "startedOn",
                "startedBy",
                "closedOn",
              ],
            },
            {
              title: "Discussion & offer",
              keys: ["reasonStated", "offerKind", "offer", "hikePct", "outcomeNote"],
            },
            { title: "Audit form", keys: ["form"] },
            { title: "History", keys: ["history"] },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------ Exit date → F&F ------------------------------ */
const FNF_STEPS = ["Draft", "HR reviewed", "Finance approved", "Paid"];
export function FnfPanel({ request }) {
  const me = useCurrentUser();
  useFnf();
  const cfg = useFnfConfig();
  const existing = fnfForExit(request.id);
  const [lwd, setLwd] = useState(request.noticeEnd ?? request.requestedLwd);
  const [recover, setRecover] = useState(cfg.noticeRecovery === "Always");
  const [draft, setDraft] = useState(null);
  const [ref, setRef] = useState("");
  const f = existing ?? draft;
  const canCompute = [
    "Notice Period",
    "HR Clearance",
    "Final Settlement",
    "Exit Completed",
  ].includes(request.stage);
  const recompute = () =>
    setDraft(
      computeFnf(
        {
          exitId: request.id,
          empId: request.empId,
          employee: request.empName,
          lwd,
          noticeDays: request.noticeDays ?? 30,
          noticeStart: request.noticeStart,
          recoverNotice: recover,
          by: me,
        },
        cfg,
      ),
    );
  const toggle = (i) => {
    if (!f || existing) return;
    const lines = f.lines.map((l, k) => (k === i ? { ...l, enabled: !l.enabled } : l));
    const t = (k) =>
      lines.filter((l) => l.kind === k && l.enabled).reduce((s, l) => s + l.amount, 0);
    setDraft({
      ...f,
      lines,
      gross: t("earning"),
      deductions: t("deduction"),
      net: t("earning") - t("deduction"),
    });
  };
  const setAmt = (i, v) => {
    if (!f || existing) return;
    const lines = f.lines.map((l, k) => (k === i ? { ...l, amount: v } : l));
    const t = (k) =>
      lines.filter((l) => l.kind === k && l.enabled).reduce((s, l) => s + l.amount, 0);
    setDraft({
      ...f,
      lines,
      gross: t("earning"),
      deductions: t("deduction"),
      net: t("earning") - t("deduction"),
    });
  };
  const g = computeGratuityAmount(request.empId, lwd, cfg);
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Wallet className="text-primary h-4 w-4" /> Exit date → Full &amp; Final settlement
          </span>
          {f && (
            <Badge
              variant="outline"
              className={
                f.status === "Paid"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-gold/40 bg-gold/15 text-gold"
              }
            >
              {f.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!existing && (
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[160px_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Exit date (LWD)</Label>
              <Input type="date" value={lwd} onChange={(e) => setLwd(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Switch
                checked={recover}
                disabled={cfg.noticeRecovery !== "Optional"}
                onCheckedChange={setRecover}
              />{" "}
              Recover notice shortfall (
              {cfg.noticeRecovery === "Optional"
                ? "optional per policy"
                : cfg.noticeRecovery.toLowerCase()}
              )
            </div>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              disabled={!canCompute}
              onClick={recompute}
            >
              Compute F&amp;F
            </Button>
          </div>
        )}
        {!canCompute && !existing && (
          <div className="text-muted-foreground text-xs">
            F&amp;F can be computed once the resignation is in HR clearance or notice period.
          </div>
        )}
        <div className="bg-muted/40 rounded-lg p-2 text-xs">
          <b>Gratuity check:</b> service {g.tenureYears} yrs from{" "}
          <span className="whitespace-nowrap">{fmtDate(g.start)}</span> →{" "}
          {g.eligible
            ? `${g.formula} = ${inr(g.amount)} (cap ${inr(cfg.gratuityCap)})`
            : `not eligible (< ${cfg.gratuityMinYears} yrs)`}{" "}
          · payable within {cfg.gratuityDaysPerYear} days after F&amp;F.
        </div>
        {f && (
          <>
            <WorkflowStepper
              steps={FNF_STEPS}
              active={FNF_STEPS.indexOf(f.status)}
              title={`${f.id} · exit ${fmtDate(f.exitDate)} · notice ${f.noticeServed}/${f.noticeDays} days served`}
            />
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground tracking-wider uppercase">
                <tr>
                  <th className="p-2 text-left">Component</th>
                  <th className="p-2 text-left">Note</th>
                  <th className="p-2 text-right">Earning</th>
                  <th className="p-2 text-right">Deduction</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {f.lines.map((l, i) => (
                  <tr key={i} className={cn(!l.enabled && "opacity-50")}>
                    <td className="p-2 font-medium">{l.label}</td>
                    <td className="text-muted-foreground p-2">{l.note}</td>
                    <td className="p-2 text-right">
                      {l.kind === "earning" ? (
                        existing ? (
                          inr(l.amount)
                        ) : (
                          <Input
                            type="number"
                            className="ml-auto h-7 w-28 text-right"
                            value={l.amount}
                            onChange={(e) => setAmt(i, +e.target.value)}
                          />
                        )
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="text-destructive p-2 text-right">
                      {l.kind === "deduction" ? (
                        existing ? (
                          inr(l.amount)
                        ) : (
                          <Input
                            type="number"
                            className="ml-auto h-7 w-28 text-right"
                            value={l.amount}
                            onChange={(e) => setAmt(i, +e.target.value)}
                          />
                        )
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-2">
                      {!existing && (
                        <Switch checked={l.enabled} onCheckedChange={() => toggle(i)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-border border-t font-semibold">
                  <td className="p-2" colSpan={2}>
                    Totals
                  </td>
                  <td className="p-2 text-right">{inr(f.gross)}</td>
                  <td className="text-destructive p-2 text-right">{inr(f.deductions)}</td>
                  <td />
                </tr>
                <tr className="font-bold">
                  <td className="p-2" colSpan={2}>
                    Net payable
                  </td>
                  <td className="text-primary p-2 text-right" colSpan={2}>
                    {inr(f.net)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <div className="flex flex-wrap items-end gap-2">
              {!existing && (
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={() => {
                    act(saveFnf(f));
                    setDraft(null);
                  }}
                >
                  Save statement
                </Button>
              )}
              {existing && existing.status !== "Paid" && (
                <>
                  {existing.status === "Finance approved" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Payment reference (UTR)</Label>
                      <Input
                        className="h-8 w-full sm:w-52"
                        value={ref}
                        onChange={(e) => setRef(e.target.value)}
                        placeholder="HDFC-UTR-…"
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    onClick={() => act(advanceFnf(existing.id, me, ref))}
                  >
                    {existing.status === "Draft"
                      ? "HR review done"
                      : existing.status === "HR reviewed"
                        ? "Finance approve"
                        : "Mark paid"}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const t = templatesOf("Full & Final Statement")[0];
                  if (!t) return toast.error("No F&F template in Doc Master");
                  renderTemplate(
                    t,
                    {
                      employee_name: f.employee,
                      employee_id: f.empId,
                      exit_date: fmtDate(f.exitDate),
                      net_payable: inr(f.net),
                      gross: inr(f.gross),
                      deductions: inr(f.deductions),
                      date: new Date().toLocaleDateString("en-IN"),
                    },
                    {
                      columns: ["Component", "Earning", "Deduction"],
                      rows: f.lines
                        .filter((l) => l.enabled)
                        .map((l) => [
                          l.label,
                          l.kind === "earning" ? inr(l.amount) : "",
                          l.kind === "deduction" ? inr(l.amount) : "",
                        ]),
                    },
                  );
                }}
              >
                <Download className="h-4 w-4" /> F&amp;F statement (Doc Master)
              </Button>
            </div>
            {existing && (
              <div className="text-muted-foreground border-border space-y-0.5 border-t pt-2 text-xs">
                {existing.history.map((h, i) => (
                  <div key={i}>
                    {h.at} · {h.by} — {h.action}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function FnfRegister({ exits }) {
  // Only statements of exits in the viewer's scope (every company's settlements were listed).
  const ids = exits ? new Set(exits.map((e) => e.id)) : null;
  const rows = useFnf().filter((f) => !ids || ids.has(f.exitId));
  const [detail, setDetail] = useState(null);
  return (
    <Card className="shadow-card">
      <CardContent className="overflow-x-auto p-0">
        <div className="p-3 text-sm font-semibold">Full &amp; Final register</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              {[
                "Ref",
                "Employee",
                "Exit date",
                "Gross",
                "Deductions",
                "Net",
                "Gratuity",
                "Status",
                "Prepared",
              ].map((h) => (
                <th key={h} className="p-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-muted-foreground p-8 text-center">
                  No F&amp;F statements yet — open an exit in notice period and compute.
                </td>
              </tr>
            )}
            {rows.map((f) => (
              <tr key={f.id} className={clickableRow} onClick={() => setDetail(f)}>
                <td className="p-3 font-mono text-xs">{f.id}</td>
                <td className="p-3 font-medium">{f.employee}</td>
                <td className="p-3">
                  <span className="whitespace-nowrap">{fmtDate(f.exitDate)}</span>
                </td>
                <td className="p-3">{inr(f.gross)}</td>
                <td className="text-destructive p-3">{inr(f.deductions)}</td>
                <td className="p-3 font-semibold">{inr(f.net)}</td>
                <td className="p-3">{f.gratuity.eligible ? inr(f.gratuity.amount) : "n/a"}</td>
                <td className="p-3">
                  <Badge variant="outline">{f.status}</Badge>
                </td>
                <td className="text-muted-foreground p-3">
                  {f.preparedBy} · <span className="whitespace-nowrap">{f.preparedOn}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail && (
          <RecordDetailDialog
            onClose={() => setDetail(null)}
            title={`${detail.id} · ${detail.employee}`}
            subtitle={`${detail.empId} · exit ${fmtDate(detail.exitDate)} · period ${detail.period}`}
            badges={<Badge variant="outline">{detail.status}</Badge>}
            record={detail}
            labels={{
              empId: "Employee ID",
              exitId: "Exit reference",
              lwd: "Last working day",
              noticeServed: "Notice served (days)",
              noticeDays: "Notice period (days)",
              paymentRef: "Payment reference (UTR)",
              lines: "Statement lines",
            }}
            sections={[
              {
                title: "Statement",
                keys: [
                  "id",
                  "exitId",
                  "employee",
                  "empId",
                  "lwd",
                  "exitDate",
                  "period",
                  "noticeDays",
                  "noticeServed",
                  "status",
                ],
              },
              { title: "Amounts", keys: ["gross", "deductions", "net", "gratuity"] },
              { title: "Components", keys: ["lines"] },
              {
                title: "Workflow",
                keys: ["preparedBy", "preparedOn", "approvedBy", "paidOn", "paymentRef", "history"],
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Continuity rejoin ------------------------------ */
export function RejoinPanel({ request }) {
  const me = useCurrentUser();
  const cfg = useFnfConfig();
  const rejoins = useRejoins().filter((r) => r.exitId === request.id);
  const [on, setOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);
  if (request.stage !== "Exit Completed" && rejoins.length === 0) return null;
  const exited = request.noticeEnd ?? request.requestedLwd;
  const gap = daysBetween(exited, on);
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <RotateCcw className="text-primary h-4 w-4" /> Rejoin after exit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground text-xs">
          Special case: if the employee returns within <b>{cfg.rejoinContinuityWindowDays} days</b>{" "}
          of exit, employment resumes with the <b>original DOJ</b>, F&amp;F is reversed and salary
          continues on the existing structure (no new joining). Beyond that, a fresh employment
          record is created.
        </p>
        {rejoins.map((r) => (
          <div key={r.id} className="border-primary/30 bg-primary/5 rounded-lg border p-2 text-xs">
            <b>{r.id}</b> · rejoined{" "}
            <span className="whitespace-nowrap">{fmtDate(r.rejoinOn)}</span> after {r.daysGap} days
            · {r.mode} · DOJ <span className="whitespace-nowrap">{fmtDate(r.originalDoj)}</span>{" "}
            {r.fnfReversed && "· F&F reversed"} · {r.note}
          </div>
        ))}
        {rejoins.length === 0 && (
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[160px_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Rejoin date</Label>
              <Input type="date" value={on} onChange={(e) => setOn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Offer at other company fell through"
              />
            </div>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() =>
                act(
                  proposeRejoin(
                    {
                      empId: request.empId,
                      exitId: request.id,
                      exitedOn: exited,
                      rejoinOn: on,
                      note,
                      forceContinuity: force,
                    },
                    me,
                    cfg,
                  ),
                )
              }
            >
              Approve rejoin
            </Button>
            <div className="flex items-center gap-2 text-xs sm:col-span-3">
              <Badge
                variant="outline"
                className={
                  gap <= cfg.rejoinContinuityWindowDays
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : ""
                }
              >
                {gap} day gap →{" "}
                {gap <= cfg.rejoinContinuityWindowDays || force ? "Continuity" : "Fresh hire"}
              </Badge>
              <Switch
                checked={force}
                disabled={!["CHRO", "SuperAdmin", "Admin"].includes(me.role)}
                onCheckedChange={setForce}
              />{" "}
              CHRO override: treat as continuity
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Rejoin tab: exits completed within the continuity window (MoM special case) and the rejoin register. */
export function RejoinTab({ exits, onOpen }) {
  const cfg = useFnfConfig();
  const exitIds = new Set(exits.map((e) => e.id));
  const rejoins = useRejoins().filter((r) => exitIds.has(r.exitId));
  const [detail, setDetail] = useState(null);
  const completed = exits.filter((e) => e.stage === "Exit Completed");
  const eligible = completed.filter((e) => {
    const gap = daysBetween(e.noticeEnd ?? e.requestedLwd, todayISO());
    return (
      gap >= 0 && gap <= cfg.rejoinContinuityWindowDays && !rejoins.some((r) => r.exitId === e.id)
    );
  });
  return (
    <div className="space-y-4">
      <Card className="shadow-card border-primary/20">
        <CardContent className="p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <RotateCcw className="text-primary h-4 w-4" /> Rejoin within{" "}
            {cfg.rejoinContinuityWindowDays} days of exit — continuity of employment
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Special case from the MoM: an employee who completes the exit but returns within{" "}
            {cfg.rejoinContinuityWindowDays} days is <b>not</b> treated as a new joiner. Employment
            resumes with the <b>original date of joining</b>, the F&amp;F is reversed and salary
            continues on the existing structure. Beyond the window a fresh employment record is
            created (CHRO override available). The window is configurable under Master Data → Exit,
            gratuity &amp; F&amp;F.
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <div className="p-3 text-sm font-semibold">
            Eligible for continuity rejoin now ({eligible.length})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Employee",
                  "Exit reference",
                  "Last working day",
                  "Days since exit",
                  "Original DOJ",
                  "",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {eligible.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-6 text-center">
                    No completed exits inside the {cfg.rejoinContinuityWindowDays}-day window.
                    Completed exits older than that can still be rejoined as a fresh hire from the
                    Closed tab.
                  </td>
                </tr>
              )}
              {eligible.map((e) => {
                const lwd = e.noticeEnd ?? e.requestedLwd;
                const gap = daysBetween(lwd, todayISO());
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {e.empName}
                      <div className="text-muted-foreground text-xs">
                        {e.empId} · {e.designation}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{e.id}</td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">{fmtDate(lwd)}</span>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        {gap} day(s)
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">
                        {fmtDate(computeGratuityAmount(e.empId, lwd).start)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        className="bg-gradient-emerald text-white"
                        onClick={() => onOpen(e.id)}
                      >
                        <RotateCcw className="h-4 w-4" /> Rejoin with continuity
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <div className="p-3 text-sm font-semibold">Rejoin register</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Case",
                  "Employee",
                  "Exited",
                  "Rejoined",
                  "Gap",
                  "Mode",
                  "DOJ retained",
                  "F&F",
                  "Decided by",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rejoins.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted-foreground p-6 text-center">
                    No rejoin cases yet.
                  </td>
                </tr>
              )}
              {rejoins.map((r) => (
                <tr key={r.id} className={clickableRow} onClick={() => setDetail(r)}>
                  <td className="p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3 font-medium">{r.employee}</td>
                  <td className="p-3">
                    <span className="whitespace-nowrap">{fmtDate(r.exitedOn)}</span>
                  </td>
                  <td className="p-3">
                    <span className="whitespace-nowrap">{fmtDate(r.rejoinOn)}</span>
                  </td>
                  <td className="p-3">{r.daysGap} d</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        r.mode.startsWith("Continuity")
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : ""
                      }
                    >
                      {r.mode}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <span className="whitespace-nowrap">{fmtDate(r.originalDoj)}</span>
                  </td>
                  <td className="p-3">{r.fnfReversed ? "Reversed" : "Settled"}</td>
                  <td className="text-muted-foreground p-3">{r.decidedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.employee}`}
          subtitle={`${detail.empId} · exit ${detail.exitId}`}
          badges={
            <>
              <Badge variant="outline">{detail.status}</Badge>
              <Badge
                variant="outline"
                className={
                  detail.mode.startsWith("Continuity")
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : ""
                }
              >
                {detail.mode}
              </Badge>
            </>
          }
          record={{
            ...detail,
            exitedOn: fmtDate(detail.exitedOn),
            rejoinOn: fmtDate(detail.rejoinOn),
            originalDoj: fmtDate(detail.originalDoj),
            requestedOn: fmtDate(detail.requestedOn),
            daysGap: `${detail.daysGap} day(s)`,
          }}
          labels={{
            empId: "Employee ID",
            exitId: "Exit reference",
            daysGap: "Gap",
            originalDoj: "Original DOJ",
            fnfReversed: "F&F reversed",
          }}
          sections={[
            { title: "Rejoin case", keys: ["id", "employee", "empId", "exitId", "status", "mode"] },
            {
              title: "Dates",
              keys: ["exitedOn", "requestedOn", "rejoinOn", "daysGap", "originalDoj"],
            },
            { title: "Decision", keys: ["decidedBy", "note", "fnfReversed"] },
          ]}
        />
      )}
    </div>
  );
}

/* -------------------------------- Exit survey -------------------------------- */
const SURVEY_Q = [
  { key: "manager", label: "Relationship with manager" },
  { key: "culture", label: "Team culture & respect" },
  { key: "growth", label: "Learning & career growth" },
  { key: "comp", label: "Compensation & benefits" },
  { key: "workLife", label: "Work-life balance" },
];
export function ExitSurveyForm({ request, by, asInterviewer, readOnly }) {
  const surveys = useExitSurveys();
  const done = surveys.find((s) => s.exitId === request.id);
  // All hooks run before any early return: the read-only branch used to return before these useState calls, so opening
  // an exit with a survey after one without (same sheet instance) changed the hook count and crashed React.
  const [ratings, setRatings] = useState({
    manager: 0,
    culture: 0,
    growth: 0,
    comp: 0,
    workLife: 0,
  });
  const [rejoin, setRejoin] = useState("Maybe");
  const [recommend, setRecommend] = useState("Yes");
  const [reason, setReason] = useState(request.reason);
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");
  if (readOnly && !done)
    return (
      <Card className="shadow-card border-dashed">
        <CardContent className="p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <MessageSquareText className="text-primary h-4 w-4" /> Exit survey
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            Filled in by the employee from their Resignation &amp; Exit page during the notice
            period.{" "}
            {request.stage === "Notice Period"
              ? "Not submitted yet — the employee has been reminded."
              : "Not submitted."}
          </div>
        </CardContent>
      </Card>
    );
  if (done)
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquareText className="text-primary h-4 w-4" /> Exit survey · {done.id}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-5">
            {SURVEY_Q.map((q) => (
              <div key={q.key} className="border-border rounded-lg border p-2 text-center">
                <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  {q.label}
                </div>
                <div className="text-lg font-bold">{done.ratings[q.key]}/5</div>
              </div>
            ))}
          </div>
          <div className="text-xs">
            <b>Primary reason:</b> {done.reason} · <b>Would rejoin:</b> {done.rejoin} ·{" "}
            <b>Would recommend:</b> {done.recommend}
          </div>
          <div className="text-muted-foreground">{done.feedback}</div>
          {done.interviewNotes && (
            <div className="text-xs">
              <b>Interviewer ({done.interviewer}):</b> {done.interviewNotes}
            </div>
          )}
        </CardContent>
      </Card>
    );
  const complete = Object.values(ratings).every((v) => v > 0);
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquareText className="text-primary h-4 w-4" /> Exit survey / interview form
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground text-xs">
          Responses are visible to the HR Head and the Unit / Department Head only. Form layout
          comes from the Doc Master "Exit Survey Form" template.
        </p>
        {SURVEY_Q.map((q) => (
          <div key={q.key} className="flex items-center justify-between gap-2">
            <span>{q.label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRatings({ ...ratings, [q.key]: n })}
                  className={cn(
                    "h-9 w-9 rounded-md border text-xs font-semibold sm:h-7 sm:w-7",
                    ratings[q.key] >= n
                      ? "bg-gradient-emerald border-primary text-white"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Primary reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Would you rejoin?</Label>
            <Select value={rejoin} onValueChange={(v) => setRejoin(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Yes", "Maybe", "No"].map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Recommend Seereon?</Label>
            <Select value={recommend} onValueChange={(v) => setRecommend(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Yes", "Maybe", "No"].map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What could we have done differently?"
        />
        {asInterviewer && (
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Interviewer notes (HR)"
          />
        )}
        <Button
          size="sm"
          className="bg-gradient-emerald text-white"
          disabled={!complete}
          onClick={() => {
            if (!asInterviewer && by.id !== request.empId)
              return toast.error("Only the employee can submit their own exit survey.");
            addExitSurvey({
              exitId: request.id,
              empId: request.empId,
              employee: request.empName,
              dept: request.dept,
              submittedOn: new Date().toISOString().slice(0, 10),
              reason,
              ratings,
              rejoin,
              recommend,
              feedback,
              interviewer: asInterviewer ? by.name : "Self-service",
              interviewNotes: notes,
            });
            if (!asInterviewer && !request.exitInterviewDone)
              markExitInterview(request.id, by, {
                mode: "Employee portal",
                note: "Exit survey submitted from the employee portal.",
              });
            toast.success("Exit survey submitted");
          }}
        >
          Submit survey
        </Button>
      </CardContent>
    </Card>
  );
}

export function ExitSurveyReport({ exits }) {
  const ids = exits ? new Set(exits.map((e) => e.id)) : null;
  const s = useExitSurveys().filter((x) => !ids || ids.has(x.exitId));
  const [detail, setDetail] = useState(null);
  const avg = (k) =>
    s.length ? +(s.reduce((t, x) => t + x.ratings[k], 0) / s.length).toFixed(1) : 0;
  const bars = SURVEY_Q.map((q) => ({ name: q.label, "Avg rating": avg(q.key) }));
  const reasons = Object.entries(
    s.reduce((m, x) => {
      m[x.reason] = (m[x.reason] ?? 0) + 1;
      return m;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Surveys", s.length],
          ["Would rejoin", s.filter((x) => x.rejoin === "Yes").length],
          ["Would recommend", s.filter((x) => x.recommend === "Yes").length],
          [
            "Lowest area",
            s.length ? SURVEY_Q.reduce((a, b) => (avg(a.key) <= avg(b.key) ? a : b)).label : "—",
          ],
        ].map(([k, v]) => (
          <Card key={String(k)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
              <div className="text-2xl font-bold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Average rating by area" subtitle="1–5 scale" className="lg:col-span-2">
          <BarsChart
            data={bars}
            keys={[{ key: "Avg rating", label: "Avg rating" }]}
            horizontal
            height={220}
          />
        </ChartCard>
        <ChartCard title="Reasons for leaving" subtitle="From surveys">
          <DonutChart data={reasons} height={220} />
        </ChartCard>
      </div>
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <div className="flex items-center justify-between p-3">
            <div className="text-sm font-semibold">
              Exit interview register{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · visible to HR Head & Unit/Dept Heads
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportReportPdf({
                  title: "Exit Survey Report",
                  columns: [
                    "Ref",
                    "Employee",
                    "Dept",
                    "Date",
                    "Reason",
                    "Mgr",
                    "Culture",
                    "Growth",
                    "Comp",
                    "WLB",
                    "Rejoin",
                    "Feedback",
                  ],
                  rows: s.map((x) => [
                    x.id,
                    x.employee,
                    x.dept,
                    x.submittedOn,
                    x.reason,
                    x.ratings.manager,
                    x.ratings.culture,
                    x.ratings.growth,
                    x.ratings.comp,
                    x.ratings.workLife,
                    x.rejoin,
                    x.feedback,
                  ]),
                })
              }
            >
              <Download className="h-4 w-4" /> Report
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Ref",
                  "Employee",
                  "Dept",
                  "Submitted",
                  "Reason",
                  "Avg",
                  "Rejoin",
                  "Feedback",
                  "Interviewer",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {s.map((x) => {
                const a = +(Object.values(x.ratings).reduce((t, v) => t + v, 0) / 5).toFixed(1);
                return (
                  <tr key={x.id} className={clickableRow} onClick={() => setDetail(x)}>
                    <td className="p-3 font-mono text-xs">{x.id}</td>
                    <td className="p-3 font-medium">{x.employee}</td>
                    <td className="p-3">{x.dept}</td>
                    <td className="p-3">
                      <span className="whitespace-nowrap">{x.submittedOn}</span>
                    </td>
                    <td className="p-3">{x.reason}</td>
                    <td className="p-3 font-semibold">{a}</td>
                    <td className="p-3">{x.rejoin}</td>
                    <td className="max-w-[280px] truncate p-3" title={x.feedback}>
                      {x.feedback}
                    </td>
                    <td className="text-muted-foreground p-3">{x.interviewer}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.id} · ${detail.employee}`}
          subtitle={`${detail.empId} · ${detail.dept} · submitted ${detail.submittedOn}`}
          badges={
            <>
              <Badge variant="outline">Would rejoin: {detail.rejoin}</Badge>
              <Badge variant="outline">Would recommend: {detail.recommend}</Badge>
            </>
          }
          record={{
            ...detail,
            ratings: Object.fromEntries(
              SURVEY_Q.map((q) => [q.label, `${detail.ratings[q.key]} / 5`]),
            ),
            averageRating: `${+(Object.values(detail.ratings).reduce((t, v) => t + v, 0) / 5).toFixed(1)} / 5`,
          }}
          labels={{
            empId: "Employee ID",
            exitId: "Exit reference",
            dept: "Department",
            reason: "Primary reason",
            rejoin: "Would rejoin",
            recommend: "Would recommend",
            interviewNotes: "Interviewer notes",
          }}
          sections={[
            {
              title: "Survey",
              keys: ["id", "exitId", "employee", "empId", "dept", "submittedOn", "interviewer"],
            },
            {
              title: "Responses",
              keys: [
                "reason",
                "rejoin",
                "recommend",
                "averageRating",
                "feedback",
                "interviewNotes",
              ],
            },
            { title: "Ratings", keys: ["ratings"] },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------ Configuration ------------------------------ */
export function FnfConfigPanel() {
  const me = useCurrentUser();
  const cfg = useFnfConfig();
  const [c, setC] = useState(cfg);
  const num = (k, label, hint) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={c[k]} onChange={(e) => setC({ ...c, [k]: +e.target.value })} />
      {hint && <div className="text-muted-foreground text-[11px]">{hint}</div>}
    </div>
  );
  const bool = (k, label) => (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={c[k]} onCheckedChange={(v) => setC({ ...c, [k]: v })} /> {label}
    </label>
  );
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings2 className="text-primary h-4 w-4" /> Exit, gratuity &amp; F&amp;F configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {num(
            "gratuityDaysPerYear",
            "Gratuity days per completed year",
            "Payment of Gratuity Act: 15 days of last basic per year",
          )}
          {num("gratuityMinYears", "Minimum service (years)")}
          {num("gratuityMonthsRoundUp", "Round up when months ≥")}
          {num("gratuityCap", "Gratuity ceiling (₹)")}
          {num(
            "settlementDaysAfterLwd",
            "Pay F&F within (days of LWD)",
            "Gratuity due 15 days after F&F",
          )}
          {num(
            "rejoinContinuityWindowDays",
            "Continuity rejoin window (days)",
            "Return within this window → original DOJ retained",
          )}
          <div className="space-y-1">
            <Label className="text-xs">Notice shortfall recovery</Label>
            <Select
              value={c.noticeRecovery}
              onValueChange={(v) => setC({ ...c, noticeRecovery: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Optional", "Always", "Never"].map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notice recovery basis</Label>
            <Select
              value={c.noticeRecoveryBasis}
              onValueChange={(v) => setC({ ...c, noticeRecoveryBasis: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gross">Gross</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Leave encashment basis</Label>
            <Select
              value={c.leaveEncashmentBasis}
              onValueChange={(v) => setC({ ...c, leaveEncashmentBasis: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gross">Gross (per MoM)</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {bool("leaveOverdrawRecovery", "Recover over-taken leaves in F&F")}
          {bool("loanRecoveryFromFnf", "Recover loan / advance balance from F&F")}
          {bool("exitSurveyMandatory", "Exit survey mandatory before F&F payout")}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            Retention workflow owners (roles that can press "Retain")
          </Label>
          <Input
            value={c.retentionOwnerRoles.join(", ")}
            onChange={(e) =>
              setC({
                ...c,
                retentionOwnerRoles: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs">
            Last updated <span className="whitespace-nowrap">{cfg.updatedOn}</span> by{" "}
            {cfg.updatedBy}
          </div>
          <Button
            className="bg-gradient-emerald text-white"
            onClick={() => act(saveFnfConfig(c, me.name))}
          >
            Save configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function useSeparationKpis(exits) {
  const ret = useRetention();
  const fnf = useFnf();
  return useMemo(
    () => ({
      retained: ret.filter((r) => r.status === "Retained").length,
      retentionOpen: ret.filter(
        (r) => r.status === "In discussion" || r.status === "Offer made" || r.status === "Open",
      ).length,
      fnfPending: fnf.filter((f) => f.status !== "Paid").length,
      exits: exits.length,
    }),
    [ret, fnf, exits],
  );
}
