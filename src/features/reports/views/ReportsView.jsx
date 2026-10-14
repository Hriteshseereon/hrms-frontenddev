import { useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useReports, REPORT_CATEGORIES, reportsForRole } from "@/features/reports/data/reports";
import {
  AiReportStudio,
  CustomReportBuilder,
  ReportCatalog,
} from "@/features/reports/components/ReportStudio";
import { ArrowLeft } from "lucide-react";
import { FINANCIAL_YEARS } from "@/features/reports/data/exec-reports";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { exportCsv, exportExcel, exportReportPdf } from "@/lib/export-utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const YEARS = ["2024", "2025", "2026", "2027"];
const EMPTY_REPORT = {
  key: "none",
  name: "No reports",
  category: "—",
  description: "No report is available for your role.",
  columns: ["—"],
  rows: [],
  summary: [],
};

/** Report packs — category bundles shown as quick filters. */
const PACKS = [
  { key: "all", label: "All reports", cats: [] },
  {
    key: "hr",
    label: "HR pack",
    cats: [
      "People",
      "Exit & Retention",
      "Grievance",
      "Leave",
      "Attendance",
      "Training",
      "Recruitment",
      "Performance",
      "Tasks & Goals",
    ],
  },
  {
    key: "finance",
    label: "Finance & payroll pack",
    cats: ["Payroll", "Loans", "Claims", "Finance", "Expenses", "Revenue", "Compliance", "Tours"],
  },
  {
    key: "manager",
    label: "Manager pack",
    cats: ["Attendance", "Leave", "Timesheets", "Tasks & Goals", "Performance", "Tours"],
  },
  {
    key: "admin",
    label: "Admin & infra pack",
    cats: ["Assets & Infra", "Helpdesk", "People", "Compliance"],
  },
];

function ReportsPage() {
  const me = useCurrentUser();
  const [fy, setFy] = useState("FY 2026-27");
  const all = useReports(fy);
  const reports = useMemo(() => reportsForRole(all, me.role), [all, me.role]);
  const [category, setCategory] = useState("all");
  const [pack, setPack] = useState("all");
  const [active, setActive] = useState(reports[0]?.key ?? "");
  const [view, setView] = useState("catalog"); // catalog · explorer · builder · ai
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");

  const categories = useMemo(
    () => REPORT_CATEGORIES.filter((c) => reports.some((r) => r.category === c)),
    [reports],
  );
  const visible = useMemo(() => {
    const packCats = PACKS.find((p) => p.key === pack)?.cats ?? [];
    return reports.filter(
      (r) =>
        (category === "all" || r.category === category) &&
        (pack === "all" || packCats.includes(r.category)),
    );
  }, [reports, category, pack]);
  // A role with no report in scope must not crash the page (`report.dateColumn` on undefined).
  const report = visible.find((r) => r.key === active) ?? visible[0] ?? reports[0] ?? EMPTY_REPORT;
  const dateCol = report.dateColumn;
  const rangeBad = !!from && !!to && to < from;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return report.rows.filter((r) => {
      if (term && !r.some((c) => String(c).toLowerCase().includes(term))) return false;
      if (dateCol === undefined) return true;
      const raw = String(r[dateCol] ?? "");
      const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (!iso) return !(from || to || month !== "all" || year !== "all");
      if (from && iso < from) return false;
      if (to && iso > to) return false;
      if (year !== "all" && iso.slice(0, 4) !== year) return false;
      if (month !== "all" && iso.slice(5, 7) !== String(MONTHS.indexOf(month) + 1).padStart(2, "0"))
        return false;
      return true;
    });
  }, [report, q, from, to, month, year, dateCol]);

  // The definition's KPIs are computed over every record; once a search / date filter narrows the table, say so
  // (the PDF used to print "Total 120" above a filtered list of 12 rows).
  const isFiltered = rows.length !== report.rows.length;
  const summary = isFiltered
    ? [
        { label: "Rows shown", value: `${rows.length} of ${report.rows.length}` },
        ...report.summary.map((s) => ({ label: `${s.label} (all records)`, value: s.value })),
      ]
    : report.summary;

  const filterMeta = [
    { label: "Category", value: report.category },
    { label: "Financial year", value: fy },
    {
      label: "Date range",
      value: from || to ? `${from || "start"} → ${to || "today"}` : "All dates",
    },
    { label: "Month", value: month === "all" ? "All months" : month },
    { label: "Year", value: year === "all" ? "All years" : year },
    { label: "Search", value: q.trim() || "—" },
  ];

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setMonth("all");
    setYear("all");
    setQ("");
  };

  function downloadPdf() {
    const ok = exportReportPdf({
      title: report.name,
      subtitle: `${report.description} · Prepared for ${me.name} (${me.role})`,
      filters: filterMeta.filter(
        (f) =>
          f.value !== "—" &&
          f.value !== "All dates" &&
          f.value !== "All months" &&
          f.value !== "All years",
      ),
      summary,
      columns: report.columns,
      rows,
      totals: true,
      note: `${report.name} · ${report.category} · prepared from live Seereon HRMS data. Figures are as on the generation date.`,
    });
    if (ok) toast.success(`${report.name} — PDF ready in the print dialog`);
    else toast.error("Allow pop-ups to generate the PDF");
  }

  if (view === "catalog")
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="text-primary h-6 w-6" /> Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every report available to your role, plus custom and AI-generated reports — open a card
            to filter and export it.
          </p>
        </div>
        <ReportCatalog
          reports={reports}
          me={me}
          onOpen={(key) => {
            setActive(key);
            setView("explorer");
          }}
          onBuilder={() => setView("builder")}
          onAi={() => setView("ai")}
        />
      </div>
    );
  if (view === "builder")
    return <CustomReportBuilder reports={reports} me={me} onBack={() => setView("catalog")} />;
  if (view === "ai")
    return <AiReportStudio reports={reports} me={me} onBack={() => setView("catalog")} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("catalog")}>
              <ArrowLeft className="h-4 w-4" /> All reports
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <BarChart3 className="text-primary h-6 w-6" /> Reports
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {reports.length} reports for your {me.role === "SuperAdmin" ? "Super Admin" : me.role}{" "}
            role, grouped into designation packs — filter by financial year, date or month, then
            export PDF / Excel / CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportCsv(report.key, report.columns, rows);
              toast.success("CSV exported");
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportExcel(report.key, report.name, report.columns, rows, filterMeta);
              toast.success("Excel exported");
            }}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={downloadPdf}
          >
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {PACKS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={pack === p.key ? "default" : "outline"}
            className={pack === p.key ? "bg-gradient-emerald text-white" : ""}
            onClick={() => {
              setPack(p.key);
              setCategory("all");
              const first = reports.find((r) => p.key === "all" || p.cats.includes(r.category));
              if (first) setActive(first.key);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                const first = reports.find((r) => v === "all" || r.category === v);
                if (first) setActive(first.key);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Financial year</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_YEARS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">From</Label>
            <Input
              type="date"
              className="w-full sm:w-[150px]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={dateCol === undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">To</Label>
            <Input
              type="date"
              className={cn("w-[150px]", rangeBad && "border-destructive")}
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              disabled={dateCol === undefined}
            />
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Month</Label>
            <Select value={month} onValueChange={setMonth} disabled={dateCol === undefined}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Year</Label>
            <Select value={year} onValueChange={setYear} disabled={dateCol === undefined}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label className="text-muted-foreground text-xs">Search within report</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Employee, status, department…"
              />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        </CardContent>
      </Card>

      {rangeBad && (
        <div className="text-destructive text-xs">
          “To” is before “From” — no rows can match this range.
        </div>
      )}
      {dateCol === undefined && (
        <div className="text-muted-foreground text-xs">
          This report has no date column — date, month and year filters are disabled for it.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="shadow-card h-fit">
          <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto p-3">
            {visible.map((r) => (
              <button
                key={r.key}
                onClick={() => setActive(r.key)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                  r.key === report.key
                    ? "bg-gradient-emerald text-white shadow-sm"
                    : "hover:bg-muted",
                )}
              >
                <div className="font-medium">{r.name}</div>
                <div
                  className={cn(
                    "text-xs",
                    r.key === report.key ? "text-white/70" : "text-muted-foreground",
                  )}
                >
                  {r.category} · {r.rows.length} rows
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summary.map((s) => (
              <Card key={s.label} className="shadow-card">
                <CardContent className="p-4">
                  <div className="text-muted-foreground text-xs">{s.label}</div>
                  <div className="text-xl font-bold">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-card overflow-hidden">
            <CardContent className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <div>
                <div className="font-semibold">{report.name}</div>
                <div className="text-muted-foreground text-xs">{report.description}</div>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {rows.length} rows
              </Badge>
            </CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {report.columns.map((c) => (
                      <th key={c} className="p-3 text-left whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      {r.map((c, j) => (
                        <td
                          key={j}
                          className={cn("p-3", j === 1 ? "font-medium" : "text-muted-foreground")}
                        >
                          {String(c) || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={report.columns.length}
                        className="text-muted-foreground p-10 text-center"
                      >
                        Nothing matches your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
