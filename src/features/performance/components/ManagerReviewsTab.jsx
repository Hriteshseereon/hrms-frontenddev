import { useMemo, useState } from "react";
import { ClipboardCheck, EyeOff, FileDown, Eye } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TeamReviewDetail } from "@/features/performance/components/TeamReviewForm";
import { clickableRow } from "@/components/common/RecordDetail";
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
import { toast } from "sonner";
import { teamReviewStore } from "@/features/organization/data/manager-data";
import { REVIEW_CYCLE_ROWS } from "@/features/performance/data/performance-data";
import { exportReportPdf } from "@/lib/export-utils";
import { usePerformanceScope } from "@/features/performance/components/scope";

/** HR / admin view of manager-run reviews. Never surfaced to the reviewed employee. */
export function ManagerReviewsTab() {
  const perf = usePerformanceScope();
  // Was every entity's manager reviews to any role that opens Performance (incl. a Manager, where this is the default tab):
  // now the active entity for HR / CXOs, and a manager / HOD sees only reviews of their own reporting tree.
  const reviews = teamReviewStore.use().filter((r) => perf.canSee(r.empId));
  const [cycle, setCycle] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const open = reviews.find((r) => r.id === openId) ?? null;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return reviews.filter(
      (r) =>
        (cycle === "all" || r.cycle === cycle) &&
        (!term || `${r.employee} ${r.manager} ${r.cycle} ${r.rating}`.toLowerCase().includes(term)),
    );
  }, [reviews, cycle, q]);

  function exportPdf() {
    const ok = exportReportPdf({
      title: "Manager Performance Reviews (Confidential)",
      subtitle: "Feedback recorded by reporting managers — restricted to HR and administrators",
      filters: [{ label: "Cycle", value: cycle === "all" ? "All cycles" : cycle }],
      summary: [
        { label: "Reviews", value: String(rows.length) },
        { label: "Completed", value: String(rows.filter((r) => r.status === "Completed").length) },
        {
          label: "In progress",
          value: String(rows.filter((r) => r.status !== "Completed").length),
        },
      ],
      columns: [
        "Ref",
        "Employee",
        "Manager",
        "Cycle",
        "Basis",
        "Period",
        "Date",
        "Overall",
        "Rating",
        "Recommendation",
        "Status",
        "Strengths",
        "Areas to improve",
        "Feedback",
      ],
      rows: rows.map((r) => [
        r.id,
        r.employee,
        r.manager,
        r.cycle,
        r.basis ?? "—",
        r.period ? `${r.period.from} → ${r.period.to}` : "—",
        r.date,
        r.overallScore ?? "—",
        r.rating || "—",
        r.recommendation ?? "—",
        r.status,
        r.strengths || "—",
        r.improvements || "—",
        r.feedback || r.remarks || "—",
      ]),
    });
    if (ok) toast.success("Confidential review report ready");
    else toast.error("Allow pop-ups to generate the PDF");
  }

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Manager Reviews</div>
              <div className="text-muted-foreground text-xs">
                Reviews written by reporting managers in My Team — view only for HR; click a row to
                read the full review (goals, parameter ratings, feedback, recommendation)
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={exportPdf}>
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
        </div>

        <div className="border-gold/40 bg-gold/10 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <EyeOff className="h-4 w-4 shrink-0" />
          Confidential — manager feedback is visible to HR and administrators only, never to the
          reviewed employee.
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Review cycle</Label>
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cycles</SelectItem>
                {REVIEW_CYCLE_ROWS.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label className="text-muted-foreground text-xs">Search</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Employee, manager, rating…"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Ref</th>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Manager</th>
                <th className="p-3 text-left">Cycle</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Basis · period</th>
                <th className="p-3 text-left">Overall</th>
                <th className="p-3 text-left">Goals · params</th>
                <th className="p-3 text-left">Recommendation</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`${clickableRow} align-top`}
                  onClick={() => setOpenId(r.id)}
                >
                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3 font-medium">
                    {r.employee}
                    <div className="text-muted-foreground text-xs font-normal">{r.empId}</div>
                  </td>
                  <td className="text-muted-foreground p-3">{r.manager}</td>
                  <td className="text-muted-foreground p-3">{r.cycle}</td>
                  <td className="text-muted-foreground p-3">
                    <span className="whitespace-nowrap">{r.date}</span>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {r.basis ?? "—"}
                    {r.period && (
                      <div>
                        {r.period.from} → {r.period.to}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {r.overallScore ? (
                      <span className="font-semibold">
                        {r.overallScore}
                        <span className="text-muted-foreground text-xs font-normal"> / 5</span>
                      </span>
                    ) : (
                      "—"
                    )}
                    <div className="text-muted-foreground text-xs">
                      {r.rating || (r.status === "Completed" ? "unrated" : "pending")}
                    </div>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {r.goals?.length ?? 0} goals · {r.params?.filter((p) => p.rating).length ?? 0}/
                    {r.params?.length ?? 0} rated
                  </td>
                  <td className="p-3 text-xs">{r.recommendation ?? "—"}</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        r.status === "Completed"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-gold/30 bg-gold/10 text-gold"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Eye className="text-muted-foreground h-4 w-4" />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-muted-foreground p-10 text-center">
                    No manager reviews recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {open && (
          <Dialog open onOpenChange={(o) => !o && setOpenId(null)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
              {open.status === "Completed" || open.status === "In Progress" ? (
                <TeamReviewDetail r={open} mode={perf.isHr ? "hr" : "manager"} />
              ) : (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  {open.id} · {open.employee} — review scheduled by {open.manager} for{" "}
                  <span className="whitespace-nowrap">{open.date}</span>; the manager has not
                  written it yet.
                </div>
              )}
              <p className="text-muted-foreground text-[11px]">
                View only — manager reviews are written and edited by the reporting manager under My
                Workspace → My Team.
              </p>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
