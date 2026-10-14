// Report Studio — the three ways into reporting beyond the fixed catalogue:
//   • ReportCatalog        — card wall of every report available to the role (the Reports landing screen);
//   • CustomReportBuilder  — dynamic selection: data source → columns → filter → group & aggregate → export;
//   • AiReportStudio       — describe the report in plain words; the assistant picks the source, filters,
//     grouping and columns, explains what it did, and the result exports like any other report.
// Custom and AI reports can be saved; saved ones appear as cards on the landing screen.
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Download,
  FileSpreadsheet,
  FileText,
  Play,
  Save,
  Search,
  Sparkles,
  Table2,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createPersistentStore } from "@/lib/persist";
import { exportCsv, exportExcel, exportReportPdf } from "@/lib/export-utils";

/* ------------------------------ saved reports ------------------------------ */

/** Saved custom / AI reports: { id, name, source, columns:[idx], groupBy, agg, aggCol, filter, by, on, origin } */
export const customReportStore = createPersistentStore("seereon.reports.custom.v1", []);
export const useCustomReports = () => customReportStore.use();
export const removeCustomReport = (id) =>
  customReportStore.set((p) => p.filter((r) => r.id !== id));

/* ------------------------------ build engine ------------------------------ */

/**
 * A cell as a number, or null when it is not one. Only plain amounts count ("₹ 1,20,000", "42", "-3.5", "12.5 %"):
 * placeholders ("—"), dates and mixed text ("3 of 5", "12 h / 40 h") are not numbers — they used to become 0 or 35.
 */
const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v ?? "")
    .replace(/₹|Rs\.?|INR|,|\s|\u00A0/gi, "")
    .replace(/%$/, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

/** Runs a custom-report config against its base report → { name, columns, rows, note }. */
export function buildCustomReport(base, cfg) {
  if (!base) return null;
  const colIdx = cfg.columns?.length ? cfg.columns : base.columns.map((_, i) => i);
  const term = (cfg.filter ?? "").trim().toLowerCase();
  let rows = base.rows.filter(
    (r) => !term || r.some((c) => String(c).toLowerCase().includes(term)),
  );
  let columns = colIdx.map((i) => base.columns[i]);
  let note = `${rows.length} of ${base.rows.length} rows from “${base.name}”${term ? ` matching “${cfg.filter}”` : ""}.`;

  if (cfg.groupBy != null && cfg.groupBy !== "none") {
    const g = Number(cfg.groupBy);
    const aggCol = cfg.aggCol != null && cfg.aggCol !== "none" ? Number(cfg.aggCol) : null;
    const groups = new Map();
    for (const r of rows) {
      const key = String(r[g] ?? "—");
      const cur = groups.get(key) ?? { count: 0, sum: 0, numCount: 0 };
      cur.count += 1;
      if (aggCol != null) {
        const n = num(r[aggCol]);
        if (n !== null) {
          cur.sum += n;
          cur.numCount += 1;
        }
      }
      groups.set(key, cur);
    }
    // Sum / average need a numeric column; without one (or with no numbers in it) the report is a plain count and
    // is labelled as such instead of "Total …" over row counts.
    const numericCol = aggCol != null && [...groups.values()].some((v) => v.numCount > 0);
    const agg = numericCol ? (cfg.agg ?? "count") : "count";
    columns = [
      base.columns[g],
      agg === "count" ? "Count" : `${agg === "avg" ? "Average" : "Total"} ${base.columns[aggCol]}`,
    ];
    rows = [...groups.entries()]
      .map(([k, v]) => [
        k,
        agg === "count"
          ? v.count
          : v.numCount
            ? Math.round(agg === "avg" ? v.sum / v.numCount : v.sum).toLocaleString("en-IN")
            : "—",
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    note += ` Grouped by ${base.columns[g]} (${rows.length} groups, ${agg}).`;
  } else {
    rows = rows.map((r) => colIdx.map((i) => r[i]));
  }
  return { name: cfg.name || `Custom · ${base.name}`, columns, rows, note, source: base.key };
}

/* ------------------------------ AI parsing ------------------------------ */

const MONTH_WORDS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * Turns a plain-language ask into a custom-report config over the catalogue.
 * Deterministic keyword engine in the demo build; the API build sends the same prompt to the AI service and
 * receives the same config shape back, so the screen works identically.
 */
export function aiParsePrompt(prompt, reports) {
  const p = prompt.toLowerCase();
  const steps = [];

  // 1. Source: the report sharing the most words with the prompt — preferring one that can honour
  //    the "by <column>" grouping the prompt asks for.
  const words = p.split(/[^a-z]+/).filter((w) => w.length > 3);
  const byWord = p
    .match(/\b(?:by|per|across)\s+([a-z ]{3,24})/)?.[1]
    ?.trim()
    .split(" ")[0];
  let best = null;
  let bestScore = 0;
  for (const r of reports) {
    const hay = `${r.name} ${r.category} ${r.description}`.toLowerCase();
    const hasGroupCol = byWord && r.columns.some((c) => c.toLowerCase().includes(byWord));
    const score =
      words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) +
      (p.includes(r.category.toLowerCase()) ? 2 : 0) +
      (hasGroupCol ? 3 : 0);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  if (!best)
    return { ok: false, message: "Could not match a data source — name a module or report." };
  steps.push(`Data source: “${best.name}” (best match for your words).`);

  // 2. Group by: "by <column>" / "per <column>".
  let groupBy = "none";
  const by = p.match(/\b(?:by|per|across)\s+([a-z ]{3,24})/);
  if (by) {
    const want = by[1].trim();
    const idx = best.columns.findIndex((c) => {
      const cl = c.toLowerCase();
      return cl.includes(want.split(" ")[0]) || want.includes(cl);
    });
    if (idx >= 0) {
      groupBy = String(idx);
      steps.push(`Grouped by ${best.columns[idx]}.`);
    }
  }

  // 3. Aggregation: totals over the first ₹/amount-like column when asked for cost / total / sum.
  let agg = "count";
  let aggCol = "none";
  if (/\b(cost|total|sum|amount|spend|salary|net|gross|value)\b/.test(p)) {
    const idx = best.columns.findIndex(
      (c) =>
        !/date|day|period|month/i.test(c) &&
        /amount|cost|net|gross|ctc|total|₹|salary|value|spend/i.test(c),
    );
    if (idx >= 0) {
      agg = "sum";
      aggCol = String(idx);
      steps.push(`Totalled ${best.columns[idx]}.`);
    }
  }
  if (/\b(average|avg|mean)\b/.test(p) && aggCol !== "none") agg = "avg";

  // 4. Filter words: months, quoted terms, branch/department-looking words after "for"/"in".
  let filter = "";
  const m = MONTH_WORDS.find((x) => p.includes(x));
  if (m) {
    filter = m.slice(0, 3);
    steps.push(`Filtered to rows mentioning ${m[0].toUpperCase() + m.slice(1)}.`);
  } else {
    const quoted = prompt.match(/"([^"]+)"|'([^']+)'/);
    const loc = p.match(
      /\b(?:for|in|at)\s+([a-z][a-z ]{2,20}?)(?:\s+(?:branch|office|department|dept|company)|[,.]|$)/,
    );
    const term = quoted?.[1] ?? quoted?.[2] ?? loc?.[1]?.trim();
    if (term && !["the", "all", "every"].includes(term)) {
      filter = term;
      steps.push(`Filtered to rows matching “${term}”.`);
    }
  }

  return {
    ok: true,
    config: {
      name: `AI · ${best.name}${groupBy !== "none" ? ` by ${best.columns[Number(groupBy)]}` : ""}`,
      source: best.key,
      columns: [],
      groupBy,
      agg,
      aggCol,
      filter,
    },
    base: best,
    steps,
  };
}

/* ------------------------------ shared result card ------------------------------ */

export function GeneratedReportCard({ result, subtitle }) {
  if (!result) return null;
  const exportMeta = [{ label: "Definition", value: result.note }];
  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <div className="font-semibold">{result.name}</div>
          <div className="text-muted-foreground text-xs">{subtitle ?? result.note}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary self-center"
          >
            {result.rows.length} rows
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportCsv(
                result.name.replace(/\W+/g, "-").toLowerCase(),
                result.columns,
                result.rows,
              );
              toast.success("CSV exported");
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportExcel(
                result.name.replace(/\W+/g, "-").toLowerCase(),
                result.name,
                result.columns,
                result.rows,
                exportMeta,
              );
              toast.success("Excel exported");
            }}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button
            size="sm"
            className="bg-gradient-emerald text-white"
            onClick={() => {
              const ok = exportReportPdf({
                title: result.name,
                subtitle: result.note,
                filters: [],
                summary: [],
                columns: result.columns,
                rows: result.rows,
                totals: true,
                note: result.note,
              });
              toast[ok ? "success" : "error"](
                ok ? "PDF ready in the print dialog" : "Allow pop-ups",
              );
            }}
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </CardContent>
      <div className="max-h-[55vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground sticky top-0 text-xs tracking-wider uppercase">
            <tr>
              {result.columns.map((c) => (
                <th key={c} className="p-3 text-left whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {result.rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/30">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={cn("p-3", j === 0 ? "font-medium" : "text-muted-foreground")}
                  >
                    {String(c) || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td
                  colSpan={result.columns.length}
                  className="text-muted-foreground p-10 text-center"
                >
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------ catalog ------------------------------ */

const CATEGORY_TONES = [
  "text-primary bg-primary/10",
  "text-gold bg-gold/10",
  "text-[oklch(0.5_0.15_260)] bg-[oklch(0.5_0.15_260)]/10 dark:text-[oklch(0.78_0.12_260)]",
];

export function ReportCatalog({ reports, onOpen, onBuilder, onAi, me }) {
  const [q, setQ] = useState("");
  const saved = useCustomReports();
  const [savedResult, setSavedResult] = useState(null);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return reports.filter(
      (r) => !t || `${r.name} ${r.category} ${r.description}`.toLowerCase().includes(t),
    );
  }, [reports, q]);
  const byCategory = useMemo(() => {
    const map = new Map();
    for (const r of visible) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category).push(r);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <div className="space-y-6">
      {/* The two generators lead the wall. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onBuilder}
          data-testid="open-custom-report"
          className="border-primary/40 bg-primary/5 hover:shadow-premium group rounded-2xl border-2 border-dashed p-5 text-left transition"
        >
          <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
            <Table2 className="h-5 w-5" />
          </div>
          <div className="mt-3 font-semibold">Custom report</div>
          <div className="text-muted-foreground mt-1 text-sm">
            Build your own: pick a data source, choose the columns, filter, group and total — then
            export or save it for reuse.
          </div>
        </button>
        <button
          type="button"
          onClick={onAi}
          data-testid="open-ai-report"
          className="border-gold/50 bg-gold/5 hover:shadow-premium group rounded-2xl border-2 border-dashed p-5 text-left transition"
        >
          <div className="bg-gold/90 grid h-10 w-10 place-items-center rounded-xl text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="mt-3 font-semibold">AI report</div>
          <div className="text-muted-foreground mt-1 text-sm">
            Describe it in plain words — “payroll cost by department”, “leave summary for Pune in
            September” — and the report is generated for you.
          </div>
        </button>
      </div>

      {saved.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Saved custom & AI reports
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((c) => {
              const base = reports.find((r) => r.key === c.source);
              return (
                <Card key={c.id} className="shadow-card hover:shadow-premium transition">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Wand2 className="text-gold mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {base ? `on “${base.name}”` : c.source} · saved by {c.by} · {c.on}
                        </div>
                      </div>
                      {/* Only the author (or an administrator) removes a saved report — not every viewer. */}
                      {(c.by === me?.name || me?.role === "SuperAdmin" || me?.role === "Admin") && (
                        <button
                          type="button"
                          aria-label={`Delete saved report ${c.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            removeCustomReport(c.id);
                            toast.success("Saved report removed");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full"
                      disabled={!base}
                      onClick={() => setSavedResult(buildCustomReport(base, c))}
                    >
                      <Play className="h-3.5 w-3.5" /> Run
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {savedResult && <GeneratedReportCard result={savedResult} />}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs">
          {visible.length} reports available to your{" "}
          {me.role === "SuperAdmin" ? "Super Admin" : me.role} role
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a report…"
          />
        </div>
      </div>

      {byCategory.map(([cat, list], ci) => (
        <div key={cat} className="space-y-2">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {cat}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onOpen(r.key)}
                data-testid={`report-card-${r.key}`}
                className="border-border bg-card hover:shadow-premium hover:border-primary/40 rounded-xl border p-4 text-left transition"
              >
                <div
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg",
                    CATEGORY_TONES[ci % CATEGORY_TONES.length],
                  )}
                >
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="mt-2 text-sm leading-tight font-semibold">{r.name}</div>
                <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {r.description}
                </div>
                <div className="text-muted-foreground mt-2 text-[11px]">{r.rows.length} rows</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ custom builder ------------------------------ */

export function CustomReportBuilder({ reports, onBack, me }) {
  const [source, setSource] = useState(reports[0]?.key ?? "");
  const base = reports.find((r) => r.key === source);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState([]); // column indexes; empty = all
  const [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState("none");
  const [agg, setAgg] = useState("count");
  const [aggCol, setAggCol] = useState("none");
  const [result, setResult] = useState(null);

  const cfg = { name, columns: picked, filter, groupBy, agg, aggCol };
  const run = () => {
    const r = buildCustomReport(base, cfg);
    setResult(r);
    toast.success(`${r.rows.length} rows generated`);
  };
  const save = () => {
    if (!name.trim()) return toast.error("Name the report before saving.");
    customReportStore.set((p) => [
      {
        ...cfg,
        name: name.trim(),
        source,
        id: `CRP-${Date.now().toString(36).toUpperCase()}`,
        by: me.name,
        on: new Date().toISOString().slice(0, 10),
        origin: "custom",
      },
      ...p,
    ]);
    toast.success("Saved — it now appears on the Reports landing screen");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> All reports
        </Button>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Table2 className="text-primary h-5 w-5" /> Custom report builder
        </h2>
      </div>
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Data source *</Label>
              <Select
                value={source}
                onValueChange={(v) => {
                  setSource(v);
                  setPicked([]);
                  setGroupBy("none");
                  setAggCol("none");
                  setResult(null);
                }}
              >
                <SelectTrigger data-testid="builder-source">
                  <SelectValue placeholder="Choose the data to report on" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {reports.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.category} · {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Report name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={base ? `e.g. ${base.name} — my view` : ""}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Filter (any column contains)</Label>
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="e.g. Pune · Approved · Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Group by</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping (row list)</SelectItem>
                  {(base?.columns ?? []).map((c, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aggregate</Label>
              <div className="flex gap-2">
                <Select value={agg} onValueChange={setAgg} disabled={groupBy === "none"}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="sum">Total</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={aggCol}
                  onValueChange={setAggCol}
                  disabled={groupBy === "none" || agg === "count"}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="of column…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {(base?.columns ?? []).map((c, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {groupBy === "none" && base && (
            <div className="space-y-1.5">
              <Label className="text-xs">Columns (none ticked = all)</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {base.columns.map((c, i) => (
                  <label key={i} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={picked.length === 0 || picked.includes(i)}
                      onCheckedChange={(v) => {
                        setPicked((prev) => {
                          const cur = prev.length ? prev : base.columns.map((_, j) => j);
                          const next = v ? [...new Set([...cur, i])] : cur.filter((x) => x !== i);
                          return next.length === base.columns.length
                            ? []
                            : next.sort((a, b) => a - b);
                        });
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-gradient-emerald text-white"
              onClick={run}
              disabled={!base}
              data-testid="builder-run"
            >
              <Play className="h-4 w-4" /> Run report
            </Button>
            <Button variant="outline" onClick={save} disabled={!base}>
              <Save className="h-4 w-4" /> Save for reuse
            </Button>
          </div>
        </CardContent>
      </Card>
      {result && <GeneratedReportCard result={result} />}
    </div>
  );
}

/* ------------------------------ AI studio ------------------------------ */

const AI_EXAMPLES = [
  "Payroll cost by department",
  "Leave applications for Pune in September",
  "Attendance summary by branch",
  "Open helpdesk tickets by department",
  "Asset value by category",
];

export function AiReportStudio({ reports, onBack, me }) {
  const [prompt, setPrompt] = useState("");
  const [outcome, setOutcome] = useState(null); // { steps, result, config }
  const run = (text = prompt) => {
    if (!text.trim()) return toast.error("Describe the report you need.");
    const parsed = aiParsePrompt(text, reports);
    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }
    const result = buildCustomReport(parsed.base, parsed.config);
    setOutcome({ steps: parsed.steps, result, config: parsed.config });
    toast.success(`Report generated from “${parsed.base.name}”`);
  };
  const save = () => {
    if (!outcome) return;
    customReportStore.set((p) => [
      {
        ...outcome.config,
        id: `AIR-${Date.now().toString(36).toUpperCase()}`,
        by: me.name,
        on: new Date().toISOString().slice(0, 10),
        origin: "ai",
      },
      ...p,
    ]);
    toast.success("Saved — it now appears on the Reports landing screen");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> All reports
        </Button>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Bot className="text-gold h-5 w-5" /> AI report
        </h2>
      </div>
      <Card className="shadow-card">
        <CardContent className="space-y-3 p-5">
          <Label className="text-xs">What do you need?</Label>
          <Textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "Payroll cost by department for this financial year"'
            data-testid="ai-prompt"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => run()}
              data-testid="ai-generate"
            >
              <Sparkles className="h-4 w-4" /> Generate report
            </Button>
            {outcome && (
              <Button variant="outline" onClick={save}>
                <Save className="h-4 w-4" /> Save for reuse
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AI_EXAMPLES.map((x) => (
              <button
                key={x}
                type="button"
                className="border-border text-muted-foreground hover:border-gold/60 hover:text-foreground rounded-full border px-2.5 py-1 text-xs transition"
                onClick={() => {
                  setPrompt(x);
                  run(x);
                }}
              >
                {x}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      {outcome && (
        <>
          <Card className="border-gold/40 bg-gold/5 shadow-card border">
            <CardContent className="p-4 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <Bot className="text-gold h-4 w-4" /> How this report was built
              </div>
              <ul className="text-muted-foreground list-inside list-disc space-y-0.5 text-xs">
                {outcome.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <GeneratedReportCard result={outcome.result} />
        </>
      )}
    </div>
  );
}
