// Statutory Compliance Library — every act Seereon's payroll operates under, with rates, thresholds, due dates,
// forms, registers, penalties and the latest government update, checked against the organisation's config.
import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  Search,
  Eye,
  FileText,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStatutoryConfig } from "@/features/payroll/data/statutory-data";
import { exportReportPdf } from "@/lib/export-utils";
import {
  ANNUAL_COMPLIANCE_CALENDAR,
  COMPLIANCE_LIBRARY,
  complianceStatus,
} from "@/features/payroll/data/compliance-guide";
import { KV } from "@/features/employees/components/CasePieces";
import { clickableRow } from "@/components/common/RecordDetail";

const CATEGORIES = [...new Set(COMPLIANCE_LIBRARY.map((e) => e.category))];
const tone = (label) =>
  label === "Aligned"
    ? "border-primary/30 bg-primary/10 text-primary"
    : label === "Review"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-border bg-muted text-muted-foreground";

export function ComplianceLibraryTab() {
  const cfg = useStatutoryConfig();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(null);
  const rows = useMemo(
    () =>
      COMPLIANCE_LIBRARY.filter(
        (e) =>
          (cat === "all" || e.category === cat) &&
          (!q ||
            `${e.act} ${e.short} ${e.code} ${e.authority} ${e.applicability}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ).map((e) => ({ e, st: complianceStatus(e, cfg) })),
    [q, cat, cfg],
  );
  const review = rows.filter((r) => r.st.label === "Review").length;
  const exportPdf = () => {
    const ok = exportReportPdf({
      title: "Statutory Compliance Library",
      subtitle: "Acts, rates, due dates and configuration alignment — FY 2026-27",
      summary: [
        { label: "Acts tracked", value: String(COMPLIANCE_LIBRARY.length) },
        { label: "Needing review", value: String(review) },
        { label: "Config updated", value: `${cfg.updatedOn} · ${cfg.updatedBy}` },
      ],
      columns: [
        "Code",
        "Act",
        "Category",
        "Authority",
        "Key rates",
        "Due dates",
        "Status",
        "Latest update",
      ],
      rows: rows.map(({ e, st }) => [
        e.code,
        e.act,
        e.category,
        e.authority,
        e.rates.map((r) => `${r.label}: ${r.value}`).join(" | "),
        e.dueDates.map((d) => `${d.what} — ${d.when}`).join(" | "),
        `${st.label} · ${st.note}`,
        `${e.latest.on}: ${e.latest.note}`,
      ]),
    });
    toast[ok ? "success" : "error"](
      ok ? "Compliance library PDF ready in the print dialog" : "Allow pop-ups to generate the PDF",
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          [
            "Acts & codes tracked",
            String(COMPLIANCE_LIBRARY.length),
            "central, state (Odisha) and Labour Codes",
          ],
          [
            "Aligned with config",
            String(rows.filter((r) => r.st.label === "Aligned").length),
            "rates match statutory values",
          ],
          [
            "Needing review",
            String(review),
            review ? "config differs from statutory value" : "nothing to review",
          ],
          ["Labour Codes", "In force", "since 21 Nov 2025 — 50 % wage rule applied"],
        ].map(([l, v, s]) => (
          <Card key={l} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{l}</div>
              <div className="mt-1 text-xl font-bold">{v}</div>
              <div className="text-muted-foreground text-[11px]">{s}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpenCheck className="text-primary h-4 w-4" /> Compliance library
            </div>
            <div className="border-border bg-muted/40 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 sm:flex-none">
              <Search className="text-muted-foreground h-4 w-4" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search act, authority, keyword…"
                className="h-6 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 sm:w-56"
              />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="ml-auto" onClick={exportPdf}>
              <Download className="h-4 w-4" /> Library PDF
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Click an act to see applicability, rates, due dates, forms, registers, penalties and the
            latest government update. Statutory values are as understood at build time — each entry
            carries a note on what to verify against the current notification.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  {[
                    "Act / code",
                    "Category",
                    "Authority",
                    "Key rate / threshold",
                    "Next due",
                    "Config",
                    "",
                  ].map((h) => (
                    <th key={h} className="p-3 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map(({ e, st }) => (
                  <tr key={e.code} className={clickableRow} onClick={() => setOpen(e)}>
                    <td className="p-3">
                      <div className="font-semibold">{e.short}</div>
                      <div className="text-muted-foreground text-xs">
                        {e.code} · {e.act}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{e.category}</Badge>
                    </td>
                    <td className="text-muted-foreground p-3 text-xs">{e.authority}</td>
                    <td className="max-w-[280px] p-3 text-xs">
                      <div className="line-clamp-2">
                        {e.rates[0]?.label}: {e.rates[0]?.value}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="font-medium">{e.dueDates[0]?.when}</div>
                      <div className="text-muted-foreground">{e.dueDates[0]?.what}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={tone(st.label)}>
                        {st.label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Eye className="text-muted-foreground h-4 w-4" />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted-foreground p-8 text-center">
                      No acts match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="text-primary h-4 w-4" /> Annual compliance calendar (beyond
            monthly PF / ESI / TDS / PT remittances)
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ANNUAL_COMPLIANCE_CALENDAR.map((m) => (
              <button
                key={m.month}
                type="button"
                onClick={() => setOpen(COMPLIANCE_LIBRARY.find((e) => e.code === m.code) ?? null)}
                className="border-border hover:bg-muted/30 rounded-lg border p-3 text-left text-xs transition"
              >
                <div className="text-sm font-semibold">{m.month}</div>
                <div className="text-muted-foreground mt-0.5">{m.item}</div>
                <div className="text-primary mt-1 text-[11px]">{m.authority}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {open && <ComplianceEntryDialog entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ComplianceEntryDialog({ entry: e, onClose }) {
  const cfg = useStatutoryConfig();
  const st = complianceStatus(e, cfg);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="text-primary h-4 w-4" /> {e.short}
          </DialogTitle>
          <DialogDescription>
            {e.act} · {e.authority}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{e.category}</Badge>
          <Badge variant="outline" className={tone(st.label)}>
            {st.label === "Aligned" ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : st.label === "Review" ? (
              <AlertTriangle className="mr-1 h-3 w-3" />
            ) : null}
            {st.label}
          </Badge>
          <span className="text-muted-foreground text-xs">{st.note}</span>
        </div>
        <div
          className={cn(
            "rounded-xl border p-4 text-sm",
            e.latest.on >= "2025-11-01"
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-muted/20",
          )}
        >
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Latest update · {e.latest.on}
          </div>
          <p className="mt-1">{e.latest.note}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            <b>Verify:</b> {e.verify}
          </p>
        </div>
        <div className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Applicability & coverage
          </div>
          <KV
            items={[
              ["Applies to", e.applicability],
              ["Wage / coverage base", e.coverage],
              ["Configured in Seereon HRMS", e.configuredIn ?? "—"],
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-border rounded-xl border p-4">
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Rates & thresholds
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-border/60 divide-y">
                {e.rates.map((r) => (
                  <tr key={r.label}>
                    <td className="text-muted-foreground w-40 py-1.5 pr-2 align-top">{r.label}</td>
                    <td className="py-1.5 font-medium">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border rounded-xl border p-4">
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Due dates
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-border/60 divide-y">
                {e.dueDates.map((d) => (
                  <tr key={d.what}>
                    <td className="py-1.5 pr-2 align-top">
                      <div>{d.what}</div>
                      <div className="text-muted-foreground text-[11px]">{d.frequency}</div>
                    </td>
                    <td className="py-1.5 font-medium whitespace-nowrap">{d.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border rounded-xl border p-4">
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Forms & returns
            </div>
            <div className="flex flex-wrap gap-1.5">
              {e.forms.map((f) => (
                <Badge key={f} variant="outline" className="font-normal">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
          <div className="border-border rounded-xl border p-4">
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Registers to maintain
            </div>
            <div className="flex flex-wrap gap-1.5">
              {e.registers.map((f) => (
                <Badge key={f} variant="outline" className="font-normal">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-4 text-sm">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Penalties for non-compliance
          </div>
          <p className="mt-1">{e.penalties}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
