import { useMemo, useState } from "react";
import { FileText, Settings2, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEFAULT_PAYSLIP_CONFIG } from "@/features/finance/data/finance-data";
import { inr } from "@/lib/store";
import { exportCsv, exportPayslipPdf, exportPayslipsBundlePdf } from "@/lib/export-utils";
import {
  periodLabel,
  rosterEmployee,
  runTone,
  usePayrollRuns,
} from "@/features/payroll/data/payroll-engine";
import { PayslipBreakdown } from "@/features/payroll/components/PayslipBreakdown";
import { createPersistentStore } from "@/lib/persist";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const payslipConfigStore = createPersistentStore(
  "seereon.payroll.payslip-config",
  DEFAULT_PAYSLIP_CONFIG,
);

/** Branded, print-ready payslip built from an engine payslip. */
export function downloadPayslip(slip, status, cfg = payslipConfigStore.get()) {
  return exportPayslipPdf(payslipExportOpts(slip, status, cfg));
}

/** The payslip export payload (shared by single and bulk downloads). */
export function payslipExportOpts(slip, status, cfg = payslipConfigStore.get()) {
  const show = (key) => cfg.fields.find((f) => f.key === key)?.enabled ?? true;
  const hidden = (label) =>
    (/TDS/i.test(label) && !show("tds")) ||
    (/Loan/i.test(label) && !show("loan")) ||
    (/Professional Tax/i.test(label) && !show("pt")) ||
    (/Provident Fund/i.test(label) && !show("pf"));
  // A field switched off in Payslip Configuration is not itemised, but its amount stays on the slip as
  // "Other deductions" — otherwise earnings − deductions would not equal the net pay printed below.
  const hiddenTotal = slip.deductions
    .filter((d) => hidden(d.label))
    .reduce((t, d) => t + d.amount, 0);
  const deductions = [
    ...slip.deductions.filter((d) => !hidden(d.label)),
    ...(hiddenTotal ? [{ label: "Other deductions", amount: hiddenTotal }] : []),
  ];
  const earnings = [...slip.earnings];
  if (slip.lop.lopAmount > 0)
    earnings.push({
      label: `Loss of Pay (${slip.lop.lopDays} day${slip.lop.lopDays === 1 ? "" : "s"}) — already netted`,
      amount: 0,
    });
  return {
    employee: {
      name: slip.name,
      id: slip.empId,
      role: slip.designation,
      dept: slip.dept,
      branch: `${slip.branch} (${slip.state})`,
    },
    statutory: [
      { label: "PAN", value: slip.statutory.pan || "—" },
      { label: "UAN", value: slip.statutory.uan || "—" },
      { label: "PF No.", value: slip.statutory.pfNo || "—" },
      { label: "ESI No.", value: slip.statutory.esiNo || "—" },
      { label: "Bank", value: `${slip.bank.bankName} ${slip.bank.accountNo}` },
      {
        label: "Payable days",
        value: `${slip.lop.payableDays} / ${slip.lop.pattern.workingDays} (${slip.lop.pattern.name})`,
      },
      { label: "Tax regime", value: slip.tds.regime },
      // CTC includes employer contributions — use the employee's CTC, not 12 × monthly gross.
      ...(show("ctc")
        ? [
            {
              label: "Annual CTC",
              value: inr(rosterEmployee(slip.empId)?.ctc || slip.structureGross * 12),
            },
          ]
        : []),
    ],
    period: slip.periodLabel,
    earnings,
    deductions,
    net: slip.net,
    status,
  };
}

export function PayslipsTab() {
  const inScope = useScopeMatch();
  const runs = usePayrollRuns()
    .filter((r) => inScope(r.orgId) && (r.status === "Processed" || r.status === "Paid"))
    .sort((a, b) => (a.period < b.period ? 1 : -1));
  const config = payslipConfigStore.use();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const [runId, setRunId] = useState("");
  const [q, setQ] = useState("");
  const [slip, setSlip] = useState(null);
  const run = runs.find((r) => r.id === runId) ?? runs[0];
  const rows = useMemo(
    () =>
      (run?.lines ?? []).filter((l) =>
        `${l.name} ${l.empId}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [run, q],
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">
                  {config.title} — {config.brandName}
                </div>
                <div className="text-muted-foreground text-xs">
                  Payslips exist only for processed payroll runs · {runs.length} run(s) available ·
                  Logo: {config.brandLogo || "—"}
                </div>
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={!run}
                title="Every listed payslip in one printable PDF"
                onClick={() => {
                  const ok = exportPayslipsBundlePdf(
                    rows.map((l) =>
                      payslipExportOpts(l, run.status === "Paid" ? "Paid" : "Processed", config),
                    ),
                    periodLabel(run.period),
                  );
                  toast[ok ? "success" : "error"](
                    ok
                      ? `${rows.length} payslips in one document — save as PDF`
                      : "Allow pop-ups to download",
                  );
                }}
              >
                <Download className="h-4 w-4" /> All payslips (PDF)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!run}
                title="Net-pay register of the listed payslips"
                onClick={() => {
                  exportCsv(
                    `payslips-${run.period}.csv`,
                    [
                      "Employee",
                      "ID",
                      "Period",
                      "Payable days",
                      "LOP",
                      "Earned gross",
                      "Deductions",
                      "Net pay",
                    ],
                    rows.map((l) => [
                      l.name,
                      l.empId,
                      periodLabel(run.period),
                      l.lop.payableDays,
                      l.lop.lopDays,
                      l.earnedGross,
                      l.totalDeductions,
                      l.net,
                    ]),
                  );
                  toast.success(`${rows.length} payslips exported to CSV`);
                }}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Select value={run?.id ?? ""} onValueChange={setRunId}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Select processed run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title} · {r.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v);
                  if (v) setDraft(config);
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Settings2 className="h-4 w-4" /> Payslip Configuration
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Payslip Configuration</DialogTitle>
                    <DialogDescription>
                      Branding and the fields printed on every generated payslip.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-medium">Title</Label>
                      <Input
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-medium">
                        Brand name
                      </Label>
                      <Input
                        value={draft.brandName}
                        onChange={(e) => setDraft({ ...draft, brandName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-medium">Logo file</Label>
                      <Input
                        value={draft.brandLogo}
                        onChange={(e) => setDraft({ ...draft, brandLogo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-medium">
                        Printed fields
                      </Label>
                      {draft.fields.map((f) => (
                        <div
                          key={f.key}
                          className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        >
                          <span>{f.label}</span>
                          <Switch
                            checked={f.enabled}
                            onCheckedChange={(v) =>
                              setDraft({
                                ...draft,
                                fields: draft.fields.map((x) =>
                                  x.key === f.key ? { ...x, enabled: v } : x,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-gradient-emerald text-white"
                      onClick={() => {
                        payslipConfigStore.set(draft);
                        setOpen(false);
                        toast.success("Payslip configuration saved");
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {run ? (
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  {run.title}{" "}
                  <Badge variant="outline" className={runTone(run.status)}>
                    {run.status}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-xs">
                  Processed <span className="whitespace-nowrap">{run.processedOn}</span> by{" "}
                  {run.processedBy} · {run.lines.length} payslips · net {inr(run.totals.net)}
                </div>
              </div>
              <div className="border-border bg-muted/40 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 sm:flex-none">
                <Search className="text-muted-foreground h-4 w-4" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="h-6 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 sm:w-40"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "Employee",
                      "Period",
                      "Payable days",
                      "Earned gross",
                      "Deductions",
                      "Net pay",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((l) => (
                    <tr key={l.empId} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">
                        {l.name}
                        <div className="text-muted-foreground font-mono text-xs">{l.empId}</div>
                      </td>
                      <td className="text-muted-foreground p-3">{periodLabel(run.period)}</td>
                      <td className="p-3 tabular-nums">
                        {l.lop.payableDays}
                        {l.lop.lopDays ? (
                          <span className="text-destructive text-xs"> ({l.lop.lopDays} LOP)</span>
                        ) : null}
                      </td>
                      <td className="p-3 tabular-nums">{inr(l.earnedGross)}</td>
                      <td className="text-destructive p-3 tabular-nums">
                        − {inr(l.totalDeductions)}
                      </td>
                      <td className="text-primary p-3 font-semibold tabular-nums">{inr(l.net)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSlip(l)}>
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const ok = downloadPayslip(
                                l,
                                run.status === "Paid" ? "Paid" : "Processed",
                                config,
                              );
                              toast[ok ? "success" : "error"](
                                ok ? "Payslip ready — save as PDF" : "Allow pop-ups to download",
                              );
                            }}
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card">
          <CardContent className="text-muted-foreground p-10 text-center">
            No processed payroll run yet — payslips are generated when a run is processed on the
            Payroll tab.
          </CardContent>
        </Card>
      )}

      <Dialog open={!!slip} onOpenChange={(o) => !o && setSlip(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {slip?.name} · {slip?.periodLabel}
            </DialogTitle>
            <DialogDescription>
              {slip?.empId} · {slip?.designation}
            </DialogDescription>
          </DialogHeader>
          {slip && <PayslipBreakdown slip={slip} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
