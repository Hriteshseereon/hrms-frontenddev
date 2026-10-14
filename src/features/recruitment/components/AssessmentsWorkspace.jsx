import { useState } from "react";
import { ClipboardList, Plus, Link as LinkIcon } from "lucide-react";
import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useCandidates } from "@/features/recruitment/data/recruitment-store";
import {
  addScorecard,
  useAssessmentParams,
  useScorecards,
  weightedScore,
} from "@/features/recruitment/data/onboarding-data";
import { BarsChart, ChartCard } from "@/features/dashboard/components/Charts";

export function AssessmentsWorkspace() {
  const me = useCurrentUser();
  const params = useAssessmentParams().filter((p) => p.active);
  const cards = useScorecards();
  const candidates = useCandidates();
  const [open, setOpen] = useState(false);
  const [candId, setCandId] = useState("");
  const [round, setRound] = useState("Technical 1");
  const [scores, setScores] = useState({});
  const [rec, setRec] = useState("Proceed");
  const [remarks, setRemarks] = useState("");
  const [view, setView] = useState(null);
  const live = params
    .map((p) => ({
      paramId: p.id,
      score: scores[p.id]?.score ?? 0,
      note: scores[p.id]?.note ?? "",
    }))
    .filter((s) => s.score > 0);
  const pct = weightedScore(live, params);
  const missing = params.filter((p) => p.mandatory && !(scores[p.id]?.score > 0));
  const cand = candidates.find((c) => c.id === candId);
  const byCandidate = Object.values(
    cards.reduce((m, c) => {
      const x = m[c.candidateId] ?? { name: c.candidate, value: 0, n: 0 };
      x.value += c.weightedPct;
      x.n++;
      m[c.candidateId] = x;
      return m;
    }, {}),
  ).map((x) => ({ name: x.name, "Weighted %": Math.round(x.value / x.n) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList className="text-primary h-5 w-5" /> Assessment scorecards
          </h2>
          <p className="text-muted-foreground text-sm">
            Scorecards on the {params.length} parameters configured in Master Data (weights →
            weighted %). Finalisation feeds the offer decision.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref({ to: "/org/masters", hash: "assessparams" })}>
              <LinkIcon className="h-4 w-4" /> Configure parameters
            </Link>
          </Button>
          <Button
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => {
              setScores({});
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New scorecard
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Average weighted score by candidate"
          subtitle="Across all rounds"
          className="lg:col-span-2"
        >
          <BarsChart
            data={byCandidate}
            keys={[{ key: "Weighted %", label: "Weighted %" }]}
            horizontal
            height={220}
          />
        </ChartCard>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-2 text-sm font-semibold">Parameters in use</div>
            <div className="space-y-1">
              {params.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span>
                    {p.name}
                    <span className="text-muted-foreground"> · {p.group}</span>
                  </span>
                  <Badge variant="outline">{p.weight} %</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-5">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Scorecard",
                  "Candidate",
                  "Round",
                  "Assessor",
                  "Date",
                  "Weighted",
                  "Recommendation",
                  "",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {cards.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-8 text-center">
                    No scorecards yet — record one from an interview's Feedback or with "New
                    scorecard".
                  </td>
                </tr>
              )}
              {cards.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{c.id}</td>
                  <td className="p-3 font-medium">
                    <span className="whitespace-nowrap">{c.candidate}</span>
                  </td>
                  <td className="p-3">{c.round}</td>
                  <td className="p-3">{c.assessor}</td>
                  <td className="text-muted-foreground p-3">
                    <span className="whitespace-nowrap">{c.assessedOn}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "font-bold",
                        c.weightedPct >= 75
                          ? "text-primary"
                          : c.weightedPct >= 55
                            ? ""
                            : "text-destructive",
                      )}
                    >
                      {c.weightedPct} %
                    </span>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        c.recommendation === "Strong hire" || c.recommendation === "Proceed"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : c.recommendation === "Reject"
                            ? "border-destructive/30 text-destructive"
                            : ""
                      }
                    >
                      {c.recommendation}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setView(c)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Assessment scorecard</DialogTitle>
            <DialogDescription>
              Score each parameter on its scale; weighted total is computed live. Mandatory
              parameters are starred.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Candidate</Label>
              <Select value={candId} onValueChange={setCandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.position} ({c.stage})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Round</Label>
              <Select value={round} onValueChange={setRound}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["HR Screening", "Technical 1", "Technical 2", "Managerial", "Final"].map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            {params.map((p) => (
              <div
                key={p.id}
                className="border-border grid grid-cols-1 items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1.4fr_auto_1.6fr]"
              >
                <div>
                  <div className="text-sm font-medium">
                    {p.name}
                    {p.mandatory && <span className="text-destructive"> *</span>}{" "}
                    <span className="text-muted-foreground text-xs">
                      · {p.group} · {p.weight} %
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">{p.description}</div>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: p.scale }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setScores({
                          ...scores,
                          [p.id]: { score: n, note: scores[p.id]?.note ?? "" },
                        })
                      }
                      className={cn(
                        "h-9 w-9 rounded-md border text-xs font-semibold sm:h-7 sm:w-7",
                        (scores[p.id]?.score ?? 0) >= n
                          ? "bg-gradient-emerald border-primary text-white"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Input
                  className="h-8"
                  placeholder="Evidence / note"
                  value={scores[p.id]?.note ?? ""}
                  onChange={(e) =>
                    setScores({
                      ...scores,
                      [p.id]: { score: scores[p.id]?.score ?? 0, note: e.target.value },
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_180px_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Remarks</Label>
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recommendation</Label>
              <Select value={rec} onValueChange={(v) => setRec(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Strong hire", "Proceed", "Hold", "Reject"].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-primary/20 bg-primary/5 rounded-xl border px-4 py-2 text-center">
              <div className="text-primary text-2xl font-bold">{pct} %</div>
              <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                weighted
              </div>
            </div>
          </div>
          {missing.length > 0 && (
            <div className="text-destructive text-xs">
              Score mandatory parameters: {missing.map((m) => m.name).join(", ")}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!cand || missing.length > 0}
              onClick={() => {
                addScorecard(
                  {
                    candidateId: cand.id,
                    candidate: cand.name,
                    round,
                    assessor: me.name,
                    assessedOn: new Date().toISOString().slice(0, 10),
                    scores: live,
                    recommendation: rec,
                    remarks,
                  },
                  params,
                );
                setOpen(false);
                toast.success("Scorecard saved");
              }}
            >
              Save scorecard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {view?.candidate} · {view?.round}
            </DialogTitle>
            <DialogDescription>
              {view?.assessor} · {view?.assessedOn} · weighted {view?.weightedPct} % ·{" "}
              {view?.recommendation}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {view?.scores.map((s) => {
              const p = params.find((x) => x.id === s.paramId);
              return (
                <div
                  key={s.paramId}
                  className="border-border flex items-center justify-between rounded-lg border p-2 text-sm"
                >
                  <span>
                    {p?.name ?? s.paramId}
                    <span className="text-muted-foreground text-xs"> · {s.note}</span>
                  </span>
                  <Badge variant="outline">
                    {s.score}/{p?.scale ?? 10}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground text-sm">{view?.remarks}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
