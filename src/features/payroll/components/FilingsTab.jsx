import { useMemo, useState } from "react";
import {
  FileDown,
  FileText,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Upload,
  Banknote,
  Trash2,
  AlertTriangle,
  Eye,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { inr } from "@/lib/store";
import { cn } from "@/lib/utils";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useStatutoryConfig } from "@/features/payroll/data/statutory-data";
import { periodLabel, usePayrollRuns } from "@/features/payroll/data/payroll-engine";
import {
  FILING_STEPS,
  approveFiling,
  deleteDraftFiling,
  downloadEcrFile,
  downloadEcrSummaryPdf,
  downloadEsiFile,
  downloadEsiSummaryPdf,
  downloadForm24Q,
  downloadTdsChallanPdf,
  fileFiling,
  filingTone,
  generateFiling,
  isOverdue,
  payFiling,
  useFilings,
  verifyFiling,
  ECR_HEADER,
  ecrFileContent,
} from "@/features/payroll/data/statutory-filings";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const COPY = {
  ECR: {
    title: "PF — Electronic Challan-cum-Return (ECR)",
    blurb:
      "Generated from the processed payroll: one line per PF member with EPF/EPS/EDLI wages, contributions and NCP days. HR verifies member data, Finance approves the challan, the file is uploaded on the EPFO Unified Portal (TRRN), and payment is made before the 15th.",
    ref: "TRRN from EPFO portal",
    steps: [
      "Generate from payroll",
      "Verify members (HR)",
      "Approve challan (Finance)",
      "Upload → TRRN",
      "Pay challan",
    ],
  },
  ESI: {
    title: "ESI — Monthly Contribution",
    blurb:
      "Insured persons with gross ≤ threshold: days paid, wages, 0.75 % employee and 3.25 % employer. Upload on the ESIC portal and pay the MC challan by the 15th.",
    ref: "ESIC challan number",
    steps: [
      "Generate from payroll",
      "Verify IPs (HR)",
      "Approve (Finance)",
      "Upload → challan",
      "Pay",
    ],
  },
  TDS: {
    title: "TDS on Salary — Challan 281 & Form 24Q",
    blurb:
      "Monthly deposit of TDS deducted under Section 192 via challan ITNS 281 by the 7th; quarterly Form 24Q consolidates the challans per deductee.",
    ref: "CIN (challan identification number)",
    steps: [
      "Generate from payroll",
      "Verify PANs (HR)",
      "Approve (Finance)",
      "Deposit → CIN",
      "Reconcile",
    ],
  },
};

export function FilingsTab({ kind }) {
  const me = useCurrentUser();
  const inScope = useScopeMatch();
  const cfg = useStatutoryConfig();
  const runs = usePayrollRuns()
    .filter((r) => inScope(r.orgId) && (r.status === "Processed" || r.status === "Paid"))
    .sort((a, b) => (a.period < b.period ? 1 : -1));
  const filings = useFilings()
    .filter((f) => f.kind === kind && inScope(f.orgId))
    .sort((a, b) =>
      a.period < b.period ? 1 : a.period > b.period ? -1 : a.generatedOn < b.generatedOn ? 1 : -1,
    );
  const [runId, setRunId] = useState("");
  const [sel, setSel] = useState("");
  const [ref, setRef] = useState("");
  const [payRef, setPayRef] = useState("");
  const [preview, setPreview] = useState(null);
  const f = filings.find((x) => x.id === sel) ?? filings[0];
  const c = COPY[kind];

  const canGen = can(me.role, "filing.generate");
  const canVerify = can(me.role, "filing.verify");
  const canApprove = can(me.role, "filing.approve");
  const canFile = can(me.role, "filing.file");
  const act = (r) => {
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok && r.id) setSel(r.id);
  };

  const pending = runs.filter(
    (r) => !filings.some((x) => x.runId === r.id && x.status !== "Draft"),
  );
  const dl = (fn, label) => (x) => {
    const ok = fn(x);
    toast[ok ? "success" : "error"](ok ? label : "Allow pop-ups / downloads and retry");
  };

  const quarters = useMemo(() => {
    if (kind !== "TDS") return [];
    const m = new Map();
    filings
      .filter((x) => x.status === "Paid")
      .forEach((x) => {
        const [y, mm] = x.period.split("-").map(Number);
        const q =
          mm >= 4 && mm <= 6
            ? `Q1 FY ${y}-${String(y + 1).slice(2)}`
            : mm >= 7 && mm <= 9
              ? `Q2 FY ${y}-${String(y + 1).slice(2)}`
              : mm >= 10
                ? `Q3 FY ${y}-${String(y + 1).slice(2)}`
                : `Q4 FY ${y - 1}-${String(y).slice(2)}`;
        m.set(q, [...(m.get(q) ?? []), x]);
      });
    return [...m.entries()];
  }, [filings, kind]);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-semibold">
                <FileText className="text-primary h-4 w-4" /> {c.title}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{c.blurb}</p>
              <div className="text-muted-foreground mt-2 text-xs">
                {kind === "ECR" && (
                  <>
                    Establishment <b className="text-foreground">{cfg.establishment.pfCode}</b> ·
                    ECR v{cfg.pf.ecrVersion} · due day {cfg.pf.remittanceDueDay}
                  </>
                )}
                {kind === "ESI" && (
                  <>
                    Employer code <b className="text-foreground">{cfg.establishment.esiCode}</b> ·
                    threshold {inr(cfg.esi.wageThreshold)} · due day {cfg.esi.remittanceDueDay}
                  </>
                )}
                {kind === "TDS" && (
                  <>
                    TAN <b className="text-foreground">{cfg.establishment.tan}</b> · Section 192 ·
                    due day {cfg.tds.remittanceDueDay} · quarterly {cfg.tds.quarterlyReturnForm}
                  </>
                )}
              </div>
            </div>
            {canGen && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full min-w-0 space-y-1 sm:w-auto">
                  <div className="text-muted-foreground text-xs">Processed payroll run</div>
                  <Select value={runId} onValueChange={setRunId}>
                    <SelectTrigger className="w-full sm:w-[260px]">
                      <SelectValue
                        placeholder={
                          runs.length ? "Choose a processed run" : "No processed runs yet"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {runs.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {periodLabel(r.period)} · {r.id}
                          {pending.some((p) => p.id === r.id) ? "" : " (filed)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="bg-gradient-emerald shadow-premium text-white"
                  disabled={!runId}
                  onClick={() => act(generateFiling(kind, runId, me))}
                >
                  <Plus className="h-4 w-4" /> Generate {kind}
                </Button>
              </div>
            )}
          </div>
          {pending.length > 0 && (
            <div className="border-gold/40 bg-gold/10 mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs">
              <AlertTriangle className="h-4 w-4" />
              {pending.length} processed month(s) without a {kind} filing:{" "}
              {pending.map((r) => periodLabel(r.period)).join(", ")}.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-0">
            <div className="border-border border-b p-4 text-sm font-semibold">Filings</div>
            <div className="divide-border max-h-[520px] divide-y overflow-y-auto">
              {filings.map((x) => (
                <button
                  key={x.id}
                  onClick={() => setSel(x.id)}
                  className={cn(
                    "hover:bg-muted/30 w-full p-4 text-left transition",
                    f?.id === x.id && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {periodLabel(x.period)}
                      {x.supplementary ? " · supplementary" : ""}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        filingTone(x.status),
                        isOverdue(x) && "border-destructive/40 text-destructive",
                      )}
                    >
                      {x.status}
                      {isOverdue(x) ? " · overdue" : ""}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {x.id} · {x.memberCount} {kind === "TDS" ? "deductees" : "members"} ·{" "}
                    {inr(x.totalAmount)} · due <span className="whitespace-nowrap">{x.dueOn}</span>
                  </div>
                </button>
              ))}
              {filings.length === 0 && (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No {kind} filings yet — generate one from a processed payroll run.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {f ? (
            <>
              <WorkflowStepper
                steps={c.steps}
                active={FILING_STEPS.indexOf(f.status)}
                title={`${f.id} · ${periodLabel(f.period)}`}
                badge={
                  <Badge variant="outline" className={filingTone(f.status)}>
                    {f.status}
                  </Badge>
                }
              />

              <Card className="shadow-card">
                <CardContent className="space-y-4 p-5">
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                        {kind === "TDS" ? "Deductees" : "Members"}
                      </div>
                      <div className="text-lg font-bold">{f.memberCount}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                        Total remittance
                      </div>
                      <div className="text-primary text-lg font-bold">{inr(f.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                        Due
                      </div>
                      <div className={cn("text-lg font-bold", isOverdue(f) && "text-destructive")}>
                        {f.dueOn}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                        Source
                      </div>
                      <div className="font-semibold">{f.runId}</div>
                      <div className="text-muted-foreground text-xs">
                        by {f.generatedBy.name} ·{" "}
                        <span className="whitespace-nowrap">{f.generatedOn}</span>
                      </div>
                    </div>
                  </div>

                  {f.accounts && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {[
                        ["A/C 1", "EPF (EE + VPF + ER 3.67%)", f.accounts.ac1],
                        ["A/C 2", "Admin 0.5% (min ₹500)", f.accounts.ac2],
                        ["A/C 10", "EPS 8.33%", f.accounts.ac10],
                        ["A/C 21", "EDLI 0.5%", f.accounts.ac21],
                        ["A/C 22", "EDLI admin (waived)", f.accounts.ac22],
                      ].map(([k, l, v]) => (
                        <div key={k} className="border-border bg-muted/20 rounded-lg border p-2.5">
                          <div className="text-[11px] font-bold">{k}</div>
                          <div className="text-muted-foreground text-[10px] leading-tight">{l}</div>
                          <div className="mt-1 text-sm font-semibold tabular-nums">{inr(v)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {f.validation.length > 0 && (
                    <div className="space-y-1.5">
                      {f.validation.map((v, i) => (
                        <div
                          key={i}
                          className={cn(
                            "rounded-lg border p-2 text-xs",
                            v.level === "error"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-gold/40 bg-gold/15",
                          )}
                        >
                          {v.message}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreview(f)}>
                      <Eye className="h-4 w-4" /> Preview lines
                    </Button>
                    {kind === "ECR" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => dl(downloadEcrFile, `${f.fileName} downloaded`)(f)}
                        >
                          <FileDown className="h-4 w-4" /> ECR .txt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            dl(downloadEcrSummaryPdf, "ECR challan summary ready — save as PDF")(f)
                          }
                        >
                          <FileText className="h-4 w-4" /> Challan summary PDF
                        </Button>
                      </>
                    )}
                    {kind === "ESI" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => dl(downloadEsiFile, "ESI contribution file downloaded")(f)}
                        >
                          <FileSpreadsheet className="h-4 w-4" /> MC upload file
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            dl(downloadEsiSummaryPdf, "ESI summary ready — save as PDF")(f)
                          }
                        >
                          <FileText className="h-4 w-4" /> Summary PDF
                        </Button>
                      </>
                    )}
                    {kind === "TDS" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          dl(downloadTdsChallanPdf, "Challan 281 ready — save as PDF")(f)
                        }
                      >
                        <FileText className="h-4 w-4" /> Challan 281 PDF
                      </Button>
                    )}
                    {f.status === "Draft" && canGen && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => act(deleteDraftFiling(f.id))}
                      >
                        <Trash2 className="h-4 w-4" /> Discard draft
                      </Button>
                    )}
                  </div>

                  <div className="border-border space-y-2 rounded-xl border p-4">
                    <div className="text-sm font-semibold">Next step</div>
                    {f.status === "Draft" &&
                      (canVerify &&
                      f.generatedBy.id === me.id &&
                      cfg.payroll.enforceMakerChecker ? (
                        <div className="border-gold/40 bg-gold/10 rounded-lg border p-2.5 text-xs">
                          You generated this filing — maker–checker requires a different verifier.
                        </div>
                      ) : canVerify ? (
                        <Button
                          className="bg-gradient-emerald text-white"
                          disabled={f.validation.some((v) => v.level === "error")}
                          onClick={() => act(verifyFiling(f.id, me))}
                        >
                          <ShieldCheck className="h-4 w-4" /> Verify{" "}
                          {kind === "TDS" ? "PAN data" : "member data"}
                        </Button>
                      ) : (
                        <div className="text-muted-foreground text-xs">
                          Awaiting HR verification.
                        </div>
                      ))}
                    {f.status === "Verified" &&
                      (canApprove ? (
                        (f.generatedBy.id === me.id || f.verifiedById === me.id) &&
                        cfg.payroll.enforceMakerChecker ? (
                          <div className="border-gold/40 bg-gold/10 rounded-lg border p-2.5 text-xs">
                            You {f.generatedBy.id === me.id ? "generated" : "verified"} this filing
                            — maker–checker requires a different approver.
                          </div>
                        ) : (
                          <Button
                            className="bg-gradient-emerald text-white"
                            onClick={() => act(approveFiling(f.id, me, ""))}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve {inr(f.totalAmount)} for
                            remittance
                          </Button>
                        )
                      ) : (
                        <div className="text-muted-foreground text-xs">
                          Awaiting Finance approval.
                        </div>
                      ))}
                    {f.status === "Approved" &&
                      (canFile ? (
                        <div className="flex gap-2">
                          <Input
                            value={ref}
                            onChange={(e) => setRef(e.target.value)}
                            placeholder={c.ref}
                          />

                          <Button
                            className="bg-gradient-emerald shrink-0 text-white"
                            disabled={!ref.trim()}
                            onClick={() => {
                              act(fileFiling(f.id, me, ref));
                              setRef("");
                            }}
                          >
                            <Upload className="h-4 w-4" /> Mark filed
                          </Button>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs">
                          Upload on the portal and record the reference (Finance / Payroll).
                        </div>
                      ))}
                    {f.status === "Filed" &&
                      (canFile ? (
                        <div className="flex gap-2">
                          <Input
                            value={payRef}
                            onChange={(e) => setPayRef(e.target.value)}
                            placeholder="Bank / challan receipt reference"
                          />

                          <Button
                            className="bg-gradient-emerald shrink-0 text-white"
                            disabled={!payRef.trim()}
                            onClick={() => {
                              act(payFiling(f.id, me, payRef));
                              setPayRef("");
                            }}
                          >
                            <Banknote className="h-4 w-4" /> Record payment
                          </Button>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs">
                          Awaiting payment confirmation.
                        </div>
                      ))}
                    {f.status === "Paid" && (
                      <div className="text-primary flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-4 w-4" /> Closed — {f.referenceNo} · paid{" "}
                        <span className="whitespace-nowrap">{f.paidOn}</span> · {f.paymentRef}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 text-sm font-semibold">History</div>
                    <div className="space-y-1 text-xs">
                      {[...f.history].reverse().map((h, i) => (
                        <div key={i} className="border-border border-l-2 pl-2">
                          <span>{h.action}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            — {h.by} · {h.at}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-card">
              <CardContent className="text-muted-foreground p-10 text-center">
                Select or generate a filing.
              </CardContent>
            </Card>
          )}

          {kind === "TDS" && quarters.length > 0 && (
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="mb-2 text-sm font-semibold">Form 24Q — quarterly statements</div>
                <div className="space-y-2">
                  {quarters.map(([q, list]) => (
                    <div
                      key={q}
                      className="border-border flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{q}</div>
                        <div className="text-muted-foreground text-xs">
                          {list.length}/3 monthly challans paid ·{" "}
                          {inr(list.reduce((s, x) => s + x.totalAmount, 0))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const ok = downloadForm24Q(list, q);
                          toast[ok ? "success" : "error"](
                            ok ? "Form 24Q ready — save as PDF" : "Allow pop-ups",
                          );
                        }}
                      >
                        <FileDown className="h-4 w-4" /> 24Q {list.length < 3 ? "(partial)" : ""}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{preview?.fileName}</DialogTitle>
            <DialogDescription>
              {preview && periodLabel(preview.period)} · {preview?.memberCount} records
            </DialogDescription>
          </DialogHeader>
          {preview?.ecrLines && (
            <div className="space-y-3">
              <pre className="bg-muted/40 overflow-x-auto rounded-lg p-3 text-[11px]">
                <span className="text-muted-foreground">{ECR_HEADER}</span>
                {"\n"}
                {ecrFileContent(preview.ecrLines)}
              </pre>
            </div>
          )}
          {preview?.esiLines && (
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground tracking-wider uppercase">
                <tr>
                  {["IP number", "IP name", "Days", "Wages", "Employee", "Employer"].map((h) => (
                    <th key={h} className="p-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {preview.esiLines.map((l) => (
                  <tr key={l.empId}>
                    <td className="p-2 font-mono">{l.ipNumber || "—"}</td>
                    <td className="p-2">{l.ipName}</td>
                    <td className="p-2">{l.daysPaid}</td>
                    <td className="p-2 tabular-nums">{inr(l.wages)}</td>
                    <td className="p-2 tabular-nums">{inr(l.employee)}</td>
                    <td className="p-2 tabular-nums">{inr(l.employer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview?.tdsLines && (
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground tracking-wider uppercase">
                <tr>
                  {["PAN", "Deductee", "Regime", "Projected taxable", "TDS"].map((h) => (
                    <th key={h} className="p-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {preview.tdsLines.map((l) => (
                  <tr key={l.empId}>
                    <td className="p-2 font-mono">{l.pan || "PANNOTAVBL"}</td>
                    <td className="p-2">{l.employee}</td>
                    <td className="p-2">{l.regime}</td>
                    <td className="p-2 tabular-nums">{inr(l.taxable)}</td>
                    <td className="p-2 tabular-nums">{inr(l.tds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
