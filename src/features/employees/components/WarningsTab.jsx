import { useState } from "react";
import { Plus, AlertTriangle, Eye, FileDown, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  SectionTitle,
  StatusBadge,
  EmployeePicker,
  AttachmentsInput,
  HistoryTrail,
  KV,
  Toolbar,
  EmptyRow,
  useScopedIds,
} from "@/features/employees/components/CasePieces";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { useSharedList } from "@/lib/shared-list";
import { WARNING_TYPE_MASTER } from "@/features/organization/data/master-data";
import {
  WARNING_TYPES,
  WARNING_CATEGORIES,
  useWarnings,
  issueWarning,
  closeWarning,
  escalateWarning,
  renderWarningLetter,
} from "@/features/employees/data/people-cases";

const APPROVER_ROLES = ["HR", "CHRO", "Admin", "SuperAdmin", "CEO", "COO", "Manager"];
const sevTone = (s) =>
  s === "Level 3 (final)"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : s === "Level 2"
      ? "border-gold/40 bg-gold/15 text-gold"
      : "border-border";
const addMonths = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

export function WarningsTab() {
  const me = useCurrentUser();
  const scopedIds = useScopedIds();
  const rows = useWarnings().filter((c) => scopedIds.has(c.empId));
  useDirectory();
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const list = rows.filter(
    (c) =>
      (sev === "all" || c.severity === sev) &&
      (!q ||
        [c.id, c.employee, c.empId, c.type, c.category, c.description]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const live = detail ? (rows.find((c) => c.id === detail.id) ?? detail) : null;
  const canAct = APPROVER_ROLES.includes(me.role);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Active warnings", rows.filter((c) => c.status === "Effective").length],
          [
            "Awaiting acknowledgement",
            rows.filter((c) => c.status === "Effective" && !c.acknowledged).length,
          ],
          [
            "Level 3 (final)",
            rows.filter((c) => c.severity === "Level 3 (final)" && c.status === "Effective").length,
          ],
          [
            "Reviews due this month",
            rows.filter(
              (c) =>
                c.status === "Effective" &&
                c.reviewDate.slice(0, 7) === new Date().toISOString().slice(0, 7),
            ).length,
          ],
        ].map(([k, v]) => (
          <Card key={String(k)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{k}</div>
              <div className="text-2xl font-bold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Toolbar q={q} setQ={setQ} placeholder="Search employee, type, category…">
            <Select value={sev} onValueChange={setSev}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {["Level 1", "Level 2", "Level 3 (final)"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Toolbar>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium ml-auto text-white"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Issue warning
          </Button>
        </CardContent>
      </Card>
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Type / category</th>
                <th className="p-3 text-left">Severity</th>
                <th className="p-3 text-left">Incident</th>
                <th className="p-3 text-left">Issued</th>
                <th className="p-3 text-left">Review</th>
                <th className="p-3 text-left">Acknowledged</th>
                <th className="p-3 text-left">Letter</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={11} text="No warnings on record." />}
              {list.map((c) => (
                <tr key={c.id} className="border-border hover:bg-muted/30 border-t">
                  <td className="p-3 font-mono text-xs">{c.id}</td>
                  <td className="p-3">
                    <div className="font-medium">{c.employee}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.empId} · {c.dept}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {c.type}
                    <div className="text-muted-foreground">{c.category}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={sevTone(c.severity)}>
                      {c.severity}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="whitespace-nowrap">{c.incidentDate}</span>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="whitespace-nowrap">{c.issuedOn}</span>
                    <div className="text-muted-foreground">{c.issuedBy}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="whitespace-nowrap">{c.reviewDate}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {c.acknowledged ? (
                      <span className="text-primary">
                        Yes · <span className="whitespace-nowrap">{c.acknowledgedOn}</span>
                      </span>
                    ) : (
                      <span className="text-destructive">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {c.letterRef && (
                      <button
                        className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                        onClick={() => renderWarningLetter(c)}
                      >
                        <FileDown className="h-3.5 w-3.5" /> {c.letterRef}
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>
                      <Eye className="h-4 w-4" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Issue warning</DialogTitle>
            <DialogDescription>
              The warning letter is generated from Document Master, e-mailed to the employee and
              shown on their portal for acknowledgement. Repeated warnings escalate to Level 2 /
              Level 3 (final) and link to a PIP.
            </DialogDescription>
          </DialogHeader>
          <WarningForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!live} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {live && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="text-gold h-5 w-5" /> {live.id} · {live.employee}
                </DialogTitle>
                <DialogDescription>
                  {live.severity} · {live.type} · issued{" "}
                  <span className="whitespace-nowrap">{live.issuedOn}</span> by {live.issuedBy}
                </DialogDescription>
              </DialogHeader>
              <KV
                items={[
                  ["Category", live.category],
                  ["Incident date", live.incidentDate],
                  ["Description", live.description],
                  ["Evidence", live.evidence.join(", ")],
                  ["Witnesses", live.witnesses],
                  ["Improvement plan", live.improvementPlan],
                  ["Review date", live.reviewDate],
                  ["Valid for", `${live.validityMonths} months`],
                  ["Escalation on recurrence", live.escalation],
                  ["PIP linked", live.pipLinked ? "Yes" : "No"],
                  [
                    "Acknowledged",
                    live.acknowledged
                      ? `${live.acknowledgedOn} — "${live.employeeComment}"`
                      : "Pending",
                  ],
                  ["Letter", live.letterRef],
                ]}
              />
              <HistoryTrail history={live.history} />
              <DialogFooter className="flex-wrap gap-2">
                {live.letterRef && (
                  <Button variant="outline" onClick={() => renderWarningLetter(live)}>
                    <FileDown className="h-4 w-4" /> Warning letter PDF
                  </Button>
                )}
                {live.status === "Effective" && canAct && live.severity !== "Level 3 (final)" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      escalateWarning(live.id, me);
                      toast.success("Escalated — PIP linked.");
                    }}
                  >
                    <ArrowUpCircle className="h-4 w-4" /> Escalate level
                  </Button>
                )}
                {live.status === "Effective" && canAct && (
                  <Button
                    className="bg-gradient-emerald text-white"
                    onClick={() => {
                      closeWarning(live.id, "Improvement sustained at review", me);
                      toast.success("Warning closed.");
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Close — improvement sustained
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WarningForm({ onDone }) {
  const me = useCurrentUser();
  const today = new Date().toISOString().slice(0, 10);
  // Master Data → Warning types now feeds the form (it was a list no screen read).
  const [masterTypes] = useSharedList("master-WTY", WARNING_TYPE_MASTER);
  const typeOptions = Array.from(new Set([...WARNING_TYPES, ...masterTypes.map((t) => t.name)]));
  const [empId, setEmpId] = useState("");
  const [type, setType] = useState(WARNING_TYPES[0]);
  const [category, setCategory] = useState(WARNING_CATEGORIES[0]);
  const [severity, setSeverity] = useState("Level 1");
  const [incidentDate, setIncidentDate] = useState(today);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [witnesses, setWitnesses] = useState("");
  const [validityMonths, setValidityMonths] = useState("6");
  const [improvementPlan, setImprovementPlan] = useState("");
  const [reviewDate, setReviewDate] = useState(addMonths(today, 1));
  const [escalation, setEscalation] = useState("Level 2 warning on recurrence");
  const [pipLinked, setPipLinked] = useState(false);
  const submit = () => {
    const r = issueWarning(
      {
        empId,
        type,
        severity,
        category,
        incidentDate,
        description,
        evidence,
        witnesses,
        issuedBy: me.name,
        validityMonths: Number(validityMonths) || 6,
        improvementPlan,
        reviewDate,
        escalation,
        pipLinked,
      },
      me,
    );
    r.ok ? (toast.success(r.message), onDone()) : toast.error(r.message);
  };
  return (
    <div className="space-y-4">
      <SectionTitle n={1} title="Employee & incident" />
      <EmployeePicker value={empId} onChange={setEmpId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Warning type" required>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category" required>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WARNING_CATEGORIES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Severity" required>
          <Select
            value={severity}
            onValueChange={(v) => {
              setSeverity(v);
              setEscalation(
                v === "Level 1"
                  ? "Level 2 warning on recurrence"
                  : v === "Level 2"
                    ? "Level 3 (final) warning and PIP on recurrence"
                    : "Termination proceedings on recurrence",
              );
              setPipLinked(v !== "Level 1");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Level 1", "Level 2", "Level 3 (final)"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Incident date" required>
          <Input
            type="date"
            max={today}
            value={incidentDate}
            onChange={(e) => setIncidentDate(e.target.value)}
          />
        </Field>
        <Field label="Witnesses" className="sm:col-span-2">
          <Input
            value={witnesses}
            onChange={(e) => setWitnesses(e.target.value)}
            placeholder="Names, if any"
          />
        </Field>
        <Field
          label="Description of the incident (appears in the letter)"
          required
          className="sm:col-span-3"
        >
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="sm:col-span-3">
          <AttachmentsInput value={evidence} onChange={setEvidence} label="Evidence" />
        </div>
      </div>
      <SectionTitle n={2} title="Improvement plan & review" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Expected improvement / plan" className="sm:col-span-3">
          <Textarea
            rows={2}
            value={improvementPlan}
            onChange={(e) => setImprovementPlan(e.target.value)}
            placeholder="Measurable expectations and support offered"
          />
        </Field>
        <Field label="Review date" required>
          <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </Field>
        <Field label="Valid for (months)">
          <Input
            type="number"
            min={1}
            value={validityMonths}
            onChange={(e) => setValidityMonths(e.target.value)}
          />
        </Field>
        <Field label="Escalation on recurrence">
          <Input value={escalation} onChange={(e) => setEscalation(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox id="pip" checked={pipLinked} onCheckedChange={(v) => setPipLinked(!!v)} />
          <Label htmlFor="pip" className="font-normal">
            Link a performance improvement plan (PIP)
          </Label>
        </div>
      </div>
      <DialogFooter>
        <Button className="bg-gradient-emerald text-white" onClick={submit}>
          Issue warning &amp; generate letter
        </Button>
      </DialogFooter>
    </div>
  );
}
