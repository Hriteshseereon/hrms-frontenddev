// Schedule-interview and Feedback + Assessment dialogs shared by Step 2 (Candidates) and Step 3 (Interview stages).
import { useState } from "react";
import { CalendarClock, ClipboardCheck, Video, MapPin } from "lucide-react";
import { toast } from "sonner";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_MASTER_SEED,
} from "@/features/recruitment/data/recruitment-data";
import { useMasterNames } from "@/components/common/CrudSection";
import {
  ROUNDS,
  scheduleInterview,
  submitInterviewFeedback,
} from "@/features/recruitment/data/recruitment-engine";
import { useAssessmentParams } from "@/features/recruitment/data/onboarding-data";
import { weightedScore } from "@/features/recruitment/data/onboarding-data";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";

const act = (r) => toast[r.ok ? "success" : "error"](r.message);
/** Today in IST — interviews are scheduled on Indian working days; evaluated in the click handler only. */
const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function ScheduleInterviewDialog({ applicant, onClose, defaultRound }) {
  const me = useCurrentUser();
  // Panel members come from the employee directory of the active entity (the old fixed list mislabelled people,
  // e.g. an HR business partner as "COO", and could not be extended).
  const people = useScopedEmployees();
  const PANEL = Array.from(new Set(people.map((e) => `${e.name} (${e.role})`)));
  const defaultPanel = PANEL.find((p) => p.startsWith(`${me.name} (`)) ?? PANEL[0] ?? "";
  const done = applicant.interviews.map((i) => i.round);
  const nextRound = defaultRound || ROUNDS.find((r) => !done.includes(r)) || ROUNDS[0];
  const interviewTypes = useMasterNames("IT", "Interview Types", INTERVIEW_TYPE_MASTER_SEED);
  const [f, setF] = useState({
    round: nextRound,
    type: INTERVIEW_TYPES[1],
    mode: "Online",
    date: "",
    time: "10:30",
    durationMin: 45,
    panel: defaultPanel,
    link: "https://meet.google.com/seereon-" + applicant.id.toLowerCase(),
    venue: "Seereon HQ, Khandagiri — Meeting room 2",
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  const schedule = () => {
    if (f.date && f.date < istToday()) {
      toast.error("Pick today or a future date for the interview.");
      return;
    }
    if (!f.panel) {
      toast.error("Choose the interviewer / panel.");
      return;
    }
    if (!(f.durationMin > 0)) {
      toast.error("Duration must be at least a few minutes.");
      return;
    }
    const r = scheduleInterview(
      applicant.id,
      {
        ...f,
        link: f.mode === "Online" ? f.link : "",
        venue: f.mode === "In-person" ? f.venue : "",
      },
      me,
    );
    act(r);
    if (r.ok) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="text-primary h-5 w-5" /> Schedule interview — {applicant.name}
          </DialogTitle>
          <DialogDescription>
            {applicant.jobTitle} · {applicant.interviews.length} round(s) so far. Calendar invites
            go to the candidate and the panel.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Round / stage</Label>
            <Select value={f.round} onValueChange={(v) => set("round", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                    {done.includes(r) ? " (done)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Interview type (Master Data)</Label>
            <Select value={f.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...interviewTypes, f.type]))
                  .filter(Boolean)
                  .map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Mode</Label>
            <div className="flex gap-2">
              {["Online", "In-person"].map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm",
                    f.mode === m ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="mode"
                    checked={f.mode === m}
                    onChange={() => set("mode", m)}
                  />
                  {m === "Online" ? (
                    <Video className="text-primary h-4 w-4" />
                  ) : (
                    <MapPin className="text-primary h-4 w-4" />
                  )}{" "}
                  {m}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date *</Label>
            <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Time *</Label>
            <Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Duration (min)</Label>
            <Input
              type="number"
              value={f.durationMin}
              onChange={(e) => set("durationMin", +e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Panel / interviewer</Label>
            <Select value={f.panel} onValueChange={(v) => set("panel", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PANEL.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {f.mode === "Online" ? (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Meeting link *</Label>
              <Input value={f.link} onChange={(e) => set("link", e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Venue *</Label>
              <Input value={f.venue} onChange={(e) => set("venue", e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={schedule}>
            Schedule &amp; send invites
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FeedbackDialog({ applicant, interview, onClose }) {
  const me = useCurrentUser();
  const params = useAssessmentParams().filter((p) => p.active);
  const [feedback, setFeedback] = useState("");
  const [scores, setScores] = useState({});
  const [rec, setRec] = useState("Proceed");
  const [result, setResult] = useState("Proceed to next round");
  const done = applicant.interviews.map((i) => i.round);
  const [nextRound, setNextRound] = useState(ROUNDS.find((r) => !done.includes(r)) ?? "");
  const live = params
    .map((p) => ({
      paramId: p.id,
      score: scores[p.id]?.score ?? 0,
      note: scores[p.id]?.note ?? "",
    }))
    .filter((s) => s.score > 0);
  const pct = weightedScore(live, params);
  const missing = params.filter((p) => p.mandatory && !(scores[p.id]?.score > 0));
  const submit = (res) => {
    const r = submitInterviewFeedback(
      applicant.id,
      interview.id,
      {
        feedback,
        result: res,
        nextRound: res === "Proceed to next round" ? nextRound : undefined,
        scores: live,
        recommendation:
          res === "Fit for the job"
            ? pct >= 80
              ? "Strong hire"
              : "Proceed"
            : res === "Reject"
              ? "Reject"
              : rec,
        params,
      },
      me,
    );
    act(r);
    if (r.ok) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="text-primary h-5 w-5" /> Feedback &amp; assessment —{" "}
            {applicant.name}
          </DialogTitle>
          <DialogDescription>
            {interview.round} · {interview.type} · {interview.mode} ·{" "}
            <span className="whitespace-nowrap">{interview.date}</span> {interview.time} · panel{" "}
            {interview.panel}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Interview feedback (descriptive) *</Label>
            <Textarea
              rows={5}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Strengths, gaps, how they solved the problems, communication, culture fit, salary discussion, red flags…"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">
                Assessment scorecard{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  — parameters from Master Data; weighted total live
                </span>
              </div>
              <div className="border-primary/20 bg-primary/5 rounded-lg border px-3 py-1 text-center">
                <div className="text-primary text-lg font-bold">{pct} %</div>
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
            {missing.length > 0 && (
              <div className="text-destructive mt-1 text-xs">
                Score mandatory parameters: {missing.map((m) => m.name).join(", ")}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Outcome of this round</Label>
              <Select value={result} onValueChange={(v) => setResult(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Proceed to next round", "Fit for the job", "Hold", "Reject"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {result === "Proceed to next round" && (
              <div className="space-y-1">
                <Label className="text-xs">Next round / stage</Label>
                <Select value={nextRound} onValueChange={setNextRound}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUNDS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                        {done.includes(r) ? " (repeat)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {result !== "Fit for the job" && result !== "Reject" && (
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
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            Previous rounds:{" "}
            {applicant.interviews
              .filter((i) => i.status === "Completed")
              .map((i) => (
                <Badge key={i.id} variant="outline" className="mr-1">
                  {i.round} · {i.result}
                </Badge>
              ))}
            {applicant.interviews.filter((i) => i.status === "Completed").length === 0 && "none"}
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {result === "Fit for the job" ? (
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!feedback.trim() || missing.length > 0}
              onClick={() => submit("Fit for the job")}
            >
              Fit for the job — select for onboarding
            </Button>
          ) : result === "Reject" ? (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive"
              disabled={!feedback.trim()}
              onClick={() => submit("Reject")}
            >
              Reject candidate
            </Button>
          ) : (
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!feedback.trim() || missing.length > 0}
              onClick={() => submit(result)}
            >
              Save feedback {result === "Proceed to next round" ? "& move to next stage" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
