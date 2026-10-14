// Shared grievance UI: raise form, detail sheet (HR + employee), KPI/report blocks.
import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Paperclip, Send, ShieldAlert, CheckCircle2, Gavel, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { findEmployee } from "@/features/employees/data/employee-directory";
import {
  GRIEVANCE_CATEGORIES,
  GRIEVANCE_STEPS,
  ROUTING,
  acknowledgeGrievance,
  addInvestigationNote,
  appealGrievance,
  closeGrievance,
  closeWindowEnds,
  daysToResolve,
  grievanceTone,
  isOverdue,
  raiseGrievance,
  resolveGrievance,
  severityTone,
  useGrievances,
  withdrawGrievance,
} from "@/features/exit/data/grievance-data";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import { EmployeePicker } from "@/features/employees/components/CasePieces";
import { BarsChart, ChartCard, DonutChart } from "@/features/dashboard/components/Charts";
import { exportReportPdf } from "@/lib/export-utils";

const act = (r) => toast[r.ok ? "success" : "error"](r.message);

/** `onBehalf`: HR logs a grievance received offline — the complainant is picked, not the HR user themselves. */
export function RaiseGrievanceForm({ onDone, onBehalf }) {
  const me = useCurrentUser();
  const [complainantId, setComplainantId] = useState(onBehalf ? "" : me.id);
  const emp = findEmployee(complainantId);
  const [category, setCategory] = useState("Payroll / salary dispute");
  const [severity, setSeverity] = useState("Medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [against, setAgainst] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState([]);
  const r = ROUTING[category];
  return (
    <div className="space-y-3">
      {onBehalf && (
        <div className="space-y-1">
          <Label className="text-xs">Complainant *</Label>
          <EmployeePicker value={complainantId} onChange={(id) => setComplainantId(id)} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRIEVANCE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Low", "Medium", "High", "Critical"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Against (person / team)</Label>
          <Input
            value={against}
            maxLength={120}
            onChange={(e) => setAgainst(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="bg-muted/40 rounded-lg p-2 text-xs">
        Routed to <b>{r.committee}</b> (owner {r.owner}) · acknowledgement within {r.ackDays}{" "}
        working day(s) · resolution within {r.resolveDays} days.{" "}
        {category === "Harassment (POSH)" &&
          "POSH cases go directly to the Internal Committee and are never visible to the reporting manager."}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Subject</Label>
        <Input value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened, when, who was involved, what outcome you expect"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={anonymous} onCheckedChange={setAnonymous} /> Raise anonymously
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4" /> Attach evidence
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              captureFiles(e.target.files);
              setFiles([...files, ...Array.from(e.target.files ?? []).map((f) => f.name)]);
              e.target.value = "";
            }}
          />
        </label>
        {files.map((f, i) => (
          <Badge key={`${f}-${i}`} variant="outline">
            {f}
          </Badge>
        ))}
      </div>
      <Button
        className="bg-gradient-emerald shadow-premium text-white"
        disabled={!complainantId}
        onClick={() => {
          const res = raiseGrievance({
            empId: complainantId,
            employee: emp?.name ?? me.name,
            dept: emp?.dept ?? me.dept ?? "—",
            branch: emp?.branch ?? me.branch ?? "Bhubaneswar HQ",
            anonymous,
            category,
            severity,
            subject,
            description,
            against,
            attachments: files,
          });
          act(res);
          if (res.ok) {
            setSubject("");
            setDescription("");
            setAgainst("");
            setAnonymous(false);
            setFiles([]);
            if (onBehalf) setComplainantId("");
            onDone?.();
          }
        }}
      >
        <Send className="h-4 w-4" /> Submit grievance
      </Button>
    </div>
  );
}

export function GrievanceDetail({ g, mode }) {
  const me = useCurrentUser();
  const [note, setNote] = useState("");
  const [vis, setVis] = useState(true);
  const [resolution, setResolution] = useState("");
  const [action, setAction] = useState("");
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [appeal, setAppeal] = useState("");
  const stepIdx =
    g.status === "Appealed" ? 2 : g.status === "Withdrawn" ? 0 : GRIEVANCE_STEPS.indexOf(g.status);
  // Only the complainant acts in employee mode; the handler cannot act on a grievance they raised themselves.
  const isComplainant = g.empId === me.id;
  return (
    <div className="space-y-4 text-sm">
      <WorkflowStepper
        steps={GRIEVANCE_STEPS}
        active={stepIdx}
        failed={g.status === "Withdrawn"}
        title={`${g.id} · ${g.category}`}
        badge={
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className={severityTone(g.severity)}>
              {g.severity}
            </Badge>
            <Badge variant="outline" className={grievanceTone(g.status)}>
              {g.status}
            </Badge>
            {isOverdue(g) && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                SLA breached
              </Badge>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ["Raised by", `${g.employee}${g.anonymous ? "" : ` · ${g.empId}`}`],
          ["Department", `${g.dept} · ${g.branch}`],
          ["Against", g.against || "—"],
          ["Raised on", g.raisedOn],
          ["Committee / owner", `${g.committee} · ${g.owner}`],
          ["Ack due / Resolve due", `${g.ackDue} / ${g.resolveDue}`],
        ].map(([k, v]) => (
          <div key={k} className="border-border rounded-lg border p-2">
            <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
            <div className="font-medium">{v}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="font-semibold">{g.subject}</div>
        <p className="text-muted-foreground">{g.description}</p>
        {g.attachments.length > 0 && (
          <div className="mt-1 flex gap-1">
            {g.attachments.map((a) => (
              <Badge key={a} variant="outline">
                <Paperclip className="mr-1 h-3 w-3" />
                {a}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {g.appealReason && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-2">
          <b>Appeal:</b> {g.appealReason}
        </div>
      )}
      <div className="space-y-1">
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Investigation log
        </div>
        {g.investigation
          .filter((n) => mode === "hr" || n.visibleToEmployee)
          .map((n, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-2 text-xs",
                n.visibleToEmployee ? "border-border" : "border-gold/40 bg-gold/5",
              )}
            >
              <span className="text-muted-foreground">
                {n.at} · {n.by}
                {!n.visibleToEmployee && " · internal"}
              </span>
              <div>{n.note}</div>
            </div>
          ))}
        {g.investigation.length === 0 && (
          <div className="text-muted-foreground text-xs">No notes yet.</div>
        )}
      </div>
      {g.resolution && (
        <div className="border-primary/30 bg-primary/5 rounded-lg border p-2">
          <b>Resolution:</b> {g.resolution}
          <div className="text-muted-foreground text-xs">
            Action taken: {g.actionTaken || "—"} · resolved{" "}
            <span className="whitespace-nowrap">{g.resolvedOn}</span>
            {g.employeeRating ? ` · employee rating ${g.employeeRating}/5` : ""}
          </div>
        </div>
      )}

      {mode === "hr" && !isComplainant && !["Closed", "Withdrawn"].includes(g.status) && (
        <div className="border-border space-y-3 rounded-xl border p-3">
          {g.status === "Submitted" && (
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() => act(acknowledgeGrievance(g.id, me))}
            >
              <ShieldAlert className="h-4 w-4" /> Acknowledge &amp; notify employee
            </Button>
          )}
          {g.status === "Submitted" && (
            <div className="text-muted-foreground text-xs">
              Acknowledge first — investigation notes and the resolution open once the SLA clock is
              acknowledged.
            </div>
          )}
          {["Acknowledged", "Under investigation", "Appealed"].includes(g.status) && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Investigation note</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={vis} onCheckedChange={setVis} /> Visible to employee
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!note.trim()}
                  onClick={() => {
                    const r = addInvestigationNote(g.id, me, note, vis);
                    act(r);
                    if (r.ok) setNote("");
                  }}
                >
                  Add note
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Resolution</Label>
                  <Textarea
                    rows={2}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Action taken</Label>
                  <Textarea
                    rows={2}
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="Counselling / warning letter / arrear / policy change"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => act(resolveGrievance(g.id, me, resolution, action))}
              >
                <Gavel className="h-4 w-4" /> Mark resolved
              </Button>
            </>
          )}
          {g.status === "Resolved" && (
            <Button
              size="sm"
              variant="outline"
              disabled={
                !!closeWindowEnds(g) && new Date().toISOString().slice(0, 10) < closeWindowEnds(g)
              }
              title={`Available from ${closeWindowEnds(g) ?? "—"}`}
              onClick={() =>
                act(closeGrievance(g.id, me, null, "Closed by HR after 7-day confirmation window"))
              }
            >
              Close (no employee response in 7 days)
            </Button>
          )}
        </div>
      )}
      {mode === "hr" && isComplainant && !["Closed", "Withdrawn"].includes(g.status) && (
        <div className="border-gold/40 bg-gold/5 rounded-lg border p-2 text-xs">
          You raised this grievance — it must be handled by another officer.
        </div>
      )}
      {mode === "employee" && isComplainant && g.status === "Resolved" && (
        <div className="border-border space-y-2 rounded-xl border p-3">
          <div className="font-medium">Are you satisfied with the resolution?</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={cn(
                  "h-8 w-8 rounded-md border text-sm font-semibold",
                  rating >= n ? "bg-gradient-emerald border-primary text-white" : "border-border",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <Textarea
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback (optional)"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              disabled={!rating}
              onClick={() => act(closeGrievance(g.id, me, rating, feedback))}
            >
              <CheckCircle2 className="h-4 w-4" /> Accept &amp; close
            </Button>
          </div>
          <div className="border-border space-y-1 border-t pt-2">
            <Label className="text-xs">Not satisfied? Appeal to the CHRO</Label>
            <Textarea
              rows={2}
              value={appeal}
              onChange={(e) => setAppeal(e.target.value)}
              placeholder="Reason for appeal"
            />
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive"
              disabled={!appeal.trim()}
              onClick={() => act(appealGrievance(g.id, me, appeal))}
            >
              Lodge appeal
            </Button>
          </div>
        </div>
      )}
      {mode === "employee" && isComplainant && ["Submitted", "Acknowledged"].includes(g.status) && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => act(withdrawGrievance(g.id, me))}
        >
          Withdraw grievance
        </Button>
      )}
      <div className="text-muted-foreground border-border space-y-0.5 border-t pt-2 text-xs">
        {g.history.map((h, i) => (
          <div key={i}>
            {h.at} · {h.by} — {h.action}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GrievanceKpis({ rows, onFilter }) {
  const open = rows.filter((g) => !["Closed", "Withdrawn"].includes(g.status));
  const overdue = rows.filter(isOverdue);
  const resolved = rows.filter((g) => g.resolvedOn);
  const avgDays = resolved.length
    ? Math.round(resolved.reduce((t, g) => t + (daysToResolve(g) ?? 0), 0) / resolved.length)
    : 0;
  const rated = rows.filter((g) => g.employeeRating);
  const csat = rated.length
    ? (rated.reduce((t, g) => t + (g.employeeRating ?? 0), 0) / rated.length).toFixed(1)
    : "—";
  const cards = [
    ["Open grievances", open.length, "open", "text-gold"],
    ["SLA breached", overdue.length, "overdue", overdue.length ? "text-destructive" : ""],
    ["Avg days to resolve", avgDays, "resolved", ""],
    ["Employee satisfaction", `${csat} / 5`, "closed", "text-primary"],
    ["POSH cases (IC)", rows.filter((g) => g.category === "Harassment (POSH)").length, "posh", ""],
    ["Appeals", rows.filter((g) => g.status === "Appealed").length, "appealed", ""],
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
      {cards.map(([k, v, f, c]) => (
        <button key={k} type="button" onClick={() => onFilter(f)} className="text-left">
          <Card className="shadow-card hover:border-primary/40 h-full transition-colors">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
              <div className={cn("text-2xl font-bold", c)}>{v}</div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}

export function GrievanceCharts({ rows }) {
  const byCat = GRIEVANCE_CATEGORIES.map((c) => ({
    name: c.replace(" (POSH)", ""),
    value: rows.filter((g) => g.category === c).length,
  })).filter((d) => d.value);
  const byDept = Object.values(
    rows.reduce((m, g) => {
      const d = m[g.dept] ?? { name: g.dept, Open: 0, Resolved: 0 };
      if (["Closed", "Resolved", "Withdrawn"].includes(g.status)) d.Resolved++;
      else d.Open++;
      m[g.dept] = d;
      return m;
    }, {}),
  );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartCard title="Grievances by category" subtitle="All time">
        <DonutChart data={byCat} height={220} />
      </ChartCard>
      <ChartCard
        title="Open vs resolved by department"
        subtitle="Where issues cluster"
        className="lg:col-span-2"
      >
        <BarsChart
          data={byDept}
          keys={[
            { key: "Open", label: "Open" },
            { key: "Resolved", label: "Resolved" },
          ]}
          stacked
          height={220}
        />
      </ChartCard>
    </div>
  );
}

export function GrievanceTable({ rows, onOpen, showEmployee = true }) {
  return (
    <Card className="shadow-card">
      <CardContent className="overflow-x-auto p-0">
        <div className="flex items-center justify-between p-3">
          <div className="text-sm font-semibold">Grievance register</div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportReportPdf({
                title: "Grievance Redressal Report",
                subtitle: "Seereon Consulting & IT Services",
                columns: [
                  "Ref",
                  "Employee",
                  "Dept",
                  "Category",
                  "Severity",
                  "Raised",
                  "Committee",
                  "Status",
                  "Resolved",
                  "Days",
                ],
                rows: rows.map((g) => [
                  g.id,
                  g.employee,
                  g.dept,
                  g.category,
                  g.severity,
                  g.raisedOn,
                  g.committee,
                  g.status,
                  g.resolvedOn ?? "—",
                  daysToResolve(g) ?? "—",
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
                ...(showEmployee ? ["Employee"] : []),
                "Category",
                "Subject",
                "Severity",
                "Raised",
                "Committee",
                "Due",
                "Status",
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
                <td
                  colSpan={showEmployee ? 9 : 8}
                  className="text-muted-foreground p-8 text-center"
                >
                  No grievances.
                </td>
              </tr>
            )}
            {rows.map((g) => (
              <tr
                key={g.id}
                className="hover:bg-muted/30 cursor-pointer"
                onClick={() => onOpen(g.id)}
              >
                <td className="p-3 font-mono text-xs">{g.id}</td>
                {showEmployee && (
                  <td className="p-3 font-medium">
                    {g.employee}
                    <div className="text-muted-foreground text-xs">{g.dept}</div>
                  </td>
                )}
                <td className="p-3">{g.category}</td>
                <td className="max-w-[260px] truncate p-3">{g.subject}</td>
                <td className="p-3">
                  <Badge variant="outline" className={severityTone(g.severity)}>
                    {g.severity}
                  </Badge>
                </td>
                <td className="p-3">
                  <span className="whitespace-nowrap">{g.raisedOn}</span>
                </td>
                <td className="p-3 text-xs">{g.committee}</td>
                <td className={cn("p-3", isOverdue(g) && "text-destructive font-semibold")}>
                  <span className="whitespace-nowrap">
                    {g.status === "Submitted" ? g.ackDue : g.resolveDue}
                  </span>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={grievanceTone(g.status)}>
                    {g.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function useGrievanceFilter(rows, f) {
  return f === "open"
    ? rows.filter((g) => !["Closed", "Withdrawn"].includes(g.status))
    : f === "overdue"
      ? rows.filter(isOverdue)
      : f === "resolved"
        ? rows.filter((g) => g.resolvedOn)
        : f === "closed"
          ? rows.filter((g) => g.status === "Closed")
          : f === "posh"
            ? rows.filter((g) => g.category === "Harassment (POSH)")
            : f === "appealed"
              ? rows.filter((g) => g.status === "Appealed")
              : rows;
}
export { useGrievances };
