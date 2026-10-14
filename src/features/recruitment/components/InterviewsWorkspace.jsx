// Step 3 · Interview stages & assessment.
//   Shortlisted  → "Schedule" (dynamic type, online / in-person)
//   Interview stages → scheduled candidates, filters by round / type / status, "Feedback" (descriptive + scorecard + fit)
//   Finalised → selected candidates, scorecard PDF, "Create offer letter" → auto-generated, editable → "Send offer letter"
import { useMemo, useState } from "react";
import Link from "@/lib/router";
import {
  CalendarClock,
  ClipboardCheck,
  UserCheck,
  Download,
  FileSignature,
  Send,
  Video,
  MapPin,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
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
import { inr } from "@/lib/store";
import { ORGANIZATION, useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import { OFFICES } from "@/features/employees/data/hr-data";
import {
  ROUNDS,
  createOfferForApplicant,
  stageTone,
  useJobPosts,
  useScopedApplicants,
  useScopedJobPosts,
} from "@/features/recruitment/data/recruitment-engine";
import { useAssessmentParams, useScorecards } from "@/features/recruitment/data/onboarding-data";
import { computeSalaryBreakup, useSalaryStructures } from "@/features/payroll/data/salary-engine";
import { useDocTemplates } from "@/features/organization/data/doc-master";
import { fillTokens } from "@/lib/export-utils";
import { exportReportPdf } from "@/lib/export-utils";
import {
  FeedbackDialog,
  ScheduleInterviewDialog,
} from "@/features/recruitment/components/InterviewDialogs";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

export function InterviewsWorkspace() {
  const all = useScopedApplicants();
  const jobs = useScopedJobPosts();
  const [jobId, setJobId] = useState("all");
  const shortlisted = all.filter(
    (a) => a.stage === "Shortlisted" && (jobId === "all" || a.jobId === jobId),
  );
  const interviewing = all.filter(
    (a) => a.stage === "Interviewing" && (jobId === "all" || a.jobId === jobId),
  );
  const finalised = all.filter(
    (a) =>
      (a.stage === "Finalised" || a.stage === "Offered") && (jobId === "all" || a.jobId === jobId),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Step 3 · Interview stages &amp; assessment</h2>
          <p className="text-muted-foreground text-sm">
            Schedule shortlisted candidates, record feedback and the assessment scorecard per round,
            mark "fit for the job" to finalise, then generate and send the offer.
          </p>
        </div>
        <div className="min-w-[240px] space-y-1">
          <Label className="text-xs">Job post</Label>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All job posts</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Tabs
        defaultValue={
          shortlisted.length ? "shortlisted" : interviewing.length ? "stages" : "finalised"
        }
      >
        <ScrollTabsList>
          <TabsTrigger value="shortlisted">
            <UserCheck className="h-4 w-4" /> Shortlisted ({shortlisted.length})
          </TabsTrigger>
          <TabsTrigger value="stages">
            <CalendarClock className="h-4 w-4" /> Interview stages ({interviewing.length})
          </TabsTrigger>
          <TabsTrigger value="finalised">
            <ClipboardCheck className="h-4 w-4" /> Finalised candidates ({finalised.length})
          </TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="shortlisted" className="pt-4">
          <ShortlistedTab rows={shortlisted} />
        </TabsContent>
        <TabsContent value="stages" className="pt-4">
          <StagesTab rows={interviewing} />
        </TabsContent>
        <TabsContent value="finalised" className="pt-4">
          <FinalisedTab rows={finalised} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ShortlistedTab({ rows }) {
  const [schedule, setSchedule] = useState(null);
  return (
    <Card className="shadow-card">
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              {["Candidate", "Job post", "Shortlisted", "ATS", "Skills", ""].map((h) => (
                <th key={h} className="p-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground p-8 text-center">
                  No shortlisted candidates waiting — shortlist from{" "}
                  <Link href="/org/recruitment/candidates" className="text-primary underline">
                    Step 2
                  </Link>
                  .
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <td className="p-3">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {a.currentCompany} · {a.experienceYears} yrs · {a.email}
                  </div>
                </td>
                <td className="p-3 text-xs">{a.jobTitle}</td>
                <td className="p-3 text-xs">
                  {a.shortlist?.how} · {a.shortlist?.on}
                  <div className="text-muted-foreground">{a.shortlist?.by}</div>
                </td>
                <td className="p-3 font-bold">{a.ats?.score ?? "—"}</td>
                <td className="max-w-[220px] p-3 text-xs">{a.skills.join(", ")}</td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    onClick={() => setSchedule(a)}
                  >
                    <CalendarClock className="h-4 w-4" /> Schedule
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedule && (
          <ScheduleInterviewDialog applicant={schedule} onClose={() => setSchedule(null)} />
        )}
      </CardContent>
    </Card>
  );
}

function StagesTab({ rows }) {
  const [round, setRound] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [fb, setFb] = useState(null);
  const [next, setNext] = useState(null);
  const [detail, setDetail] = useState(null);
  const items = useMemo(
    () =>
      rows
        .flatMap((a) => a.interviews.map((iv) => ({ a, iv })))
        .filter(
          ({ a, iv }) =>
            (round === "all" || iv.round === round) &&
            (type === "all" || iv.type === type) &&
            (status === "all" || iv.status === status) &&
            (!q || a.name.toLowerCase().includes(q.toLowerCase())),
        )
        .sort((x, y) => (x.iv.date + x.iv.time < y.iv.date + y.iv.time ? -1 : 1)),
    [rows, round, type, status, q],
  );
  const types = Array.from(new Set(rows.flatMap((a) => a.interviews.map((i) => i.type))));
  return (
    <div className="space-y-3">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-2 p-3">
          <div className="border-border bg-muted/40 flex h-9 min-w-[200px] items-center gap-2 rounded-lg border px-3">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Candidate…"
              className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="w-full min-w-0 space-y-1 sm:w-auto">
            <Label className="text-xs">Round</Label>
            <Select value={round} onValueChange={setRound}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rounds</SelectItem>
                {ROUNDS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1 sm:w-auto">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1 sm:w-auto">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {["Scheduled", "Completed", "No-show", "Cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1 text-xs sm:ml-auto">
            {ROUNDS.map((r) => (
              <Badge
                key={r}
                variant="outline"
                className={cn(round === r && "border-primary bg-primary/10 text-primary")}
              >
                {r}: {rows.filter((a) => a.currentRound === r).length}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {["Candidate", "Round", "Type · mode", "When", "Panel", "Status", "Result", ""].map(
                  (h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-8 text-center">
                    No interviews match — schedule from the Shortlisted tab.
                  </td>
                </tr>
              )}
              {items.map(({ a, iv }) => (
                <tr key={iv.id} className={clickableRow} onClick={() => setDetail({ a, iv })}>
                  <td className="p-3">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {a.jobTitle} · current stage {a.currentRound}
                    </div>
                  </td>
                  <td className="p-3">{iv.round}</td>
                  <td className="p-3 text-xs">
                    {iv.type}
                    <div className="text-muted-foreground flex items-center gap-1">
                      {iv.mode === "Online" ? (
                        <Video className="h-3 w-3" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}{" "}
                      {iv.mode} · {iv.mode === "Online" ? iv.link : iv.venue}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="whitespace-nowrap">{iv.date}</span> {iv.time}
                    <div className="text-muted-foreground">{iv.durationMin} min</div>
                  </td>
                  <td className="p-3 text-xs">{iv.panel}</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        iv.status === "Completed"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-gold/40 bg-gold/15 text-gold"
                      }
                    >
                      {iv.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">{iv.result ?? "—"}</td>
                  <td
                    className="p-3 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {iv.status === "Scheduled" ? (
                      <Button
                        size="sm"
                        className="bg-gradient-emerald text-white"
                        onClick={() => setFb({ a, iv })}
                      >
                        <ClipboardCheck className="h-4 w-4" /> Feedback
                      </Button>
                    ) : (iv.result === "Proceed to next round" || iv.result === "Hold") &&
                      iv.id === a.interviews[a.interviews.length - 1]?.id &&
                      !a.interviews.some((x) => x.status === "Scheduled") ? (
                      <Button size="sm" variant="outline" onClick={() => setNext(a)}>
                        <CalendarClock className="h-4 w-4" /> Schedule {a.currentRound}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {fb && <FeedbackDialog applicant={fb.a} interview={fb.iv} onClose={() => setFb(null)} />}
      {next && (
        <ScheduleInterviewDialog
          applicant={next}
          defaultRound={next.currentRound}
          onClose={() => setNext(null)}
        />
      )}
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={`${detail.a.name} · ${detail.iv.round}`}
          subtitle={`${detail.a.jobTitle} · ${detail.iv.type} · ${detail.iv.date} ${detail.iv.time}`}
          badges={
            <>
              <Badge
                variant="outline"
                className={
                  detail.iv.status === "Completed"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-gold/40 bg-gold/15 text-gold"
                }
              >
                {detail.iv.status}
              </Badge>
              {detail.iv.result && <Badge variant="outline">{detail.iv.result}</Badge>}
            </>
          }
          record={{
            ...detail.iv,
            candidate: detail.a.name,
            email: detail.a.email,
            phone: detail.a.phone,
            jobTitle: detail.a.jobTitle,
            currentCompany: detail.a.currentCompany,
            experienceYears: detail.a.experienceYears,
            currentRound: detail.a.currentRound,
          }}
          labels={{
            id: "Interview ID",
            durationMin: "Duration (min)",
            link: "Meeting link",
            jobTitle: "Job post",
            currentRound: "Candidate's current stage",
            experienceYears: "Experience (years)",
            scorecardId: "Scorecard",
          }}
          sections={[
            {
              title: "Candidate",
              keys: [
                "candidate",
                "email",
                "phone",
                "jobTitle",
                "currentCompany",
                "experienceYears",
                "currentRound",
              ],
            },
            {
              title: "Interview",
              keys: [
                "id",
                "round",
                "type",
                "mode",
                "date",
                "time",
                "durationMin",
                "panel",
                "link",
                "venue",
                "status",
              ],
            },
            { title: "Scheduling", keys: ["scheduledBy", "scheduledOn"] },
            {
              title: "Outcome",
              keys: ["result", "feedback", "scorecardId", "completedOn", "completedBy"],
            },
          ]}
        />
      )}
    </div>
  );
}

function FinalisedTab({ rows }) {
  const cards = useScorecards();
  const params = useAssessmentParams();
  const [offer, setOffer] = useState(null);
  const scorecardPdf = (a) => {
    const mine = cards.filter((c) => c.candidateId === a.id);
    exportReportPdf({
      title: `Assessment scorecard — ${a.name}`,
      subtitle: `${a.jobTitle} · ${mine.length} round(s) · finalised ${a.finalisedOn ?? ""} by ${a.finalisedBy ?? ""}`,
      summary: [
        {
          label: "Average weighted",
          value: mine.length
            ? `${Math.round(mine.reduce((t, c) => t + c.weightedPct, 0) / mine.length)} %`
            : "—",
        },
        { label: "ATS", value: String(a.ats?.score ?? "—") },
        { label: "Expected CTC", value: inr(a.expectedCtc) },
      ],
      columns: [
        "Round",
        "Assessor",
        "Date",
        ...params.filter((p) => p.active).map((p) => p.name),
        "Weighted %",
        "Recommendation",
        "Remarks",
      ],
      rows: mine.map((c) => [
        c.round,
        c.assessor,
        c.assessedOn,
        ...params
          .filter((p) => p.active)
          .map((p) => c.scores.find((s) => s.paramId === p.id)?.score ?? "—"),
        `${c.weightedPct} %`,
        c.recommendation,
        c.remarks,
      ]),
    });
  };
  return (
    <div className="space-y-3">
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Candidate",
                  "Job post",
                  "Rounds",
                  "Avg scorecard",
                  "Expected CTC",
                  "Finalised",
                  "Stage",
                  "",
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
                  <td colSpan={8} className="text-muted-foreground p-8 text-center">
                    No finalised candidates yet — mark "Fit for the job" in the feedback dialog.
                  </td>
                </tr>
              )}
              {rows.map((a) => {
                const mine = cards.filter((c) => c.candidateId === a.id);
                const avg = mine.length
                  ? Math.round(mine.reduce((t, c) => t + c.weightedPct, 0) / mine.length)
                  : null;
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {a.email} · {a.phone} · {a.currentCompany}
                      </div>
                    </td>
                    <td className="p-3 text-xs">{a.jobTitle}</td>
                    <td className="p-3 text-xs">
                      {a.interviews
                        .filter((i) => i.status === "Completed")
                        .map((i) => (
                          <div key={i.id}>
                            {i.round} · {i.result}
                          </div>
                        ))}
                    </td>
                    <td className="p-3">
                      <span className={cn("font-bold", (avg ?? 0) >= 75 ? "text-primary" : "")}>
                        {avg !== null ? `${avg} %` : "—"}
                      </span>
                    </td>
                    <td className="p-3">{inr(a.expectedCtc)}</td>
                    <td className="p-3 text-xs">
                      <span className="whitespace-nowrap">{a.finalisedOn}</span>
                      <div className="text-muted-foreground">{a.finalisedBy}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={stageTone(a.stage)}>
                        {a.stage}
                      </Badge>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => scorecardPdf(a)}>
                          <Download className="h-4 w-4" /> Scorecard PDF
                        </Button>
                        {a.stage === "Finalised" ? (
                          <Button
                            size="sm"
                            className="bg-gradient-emerald text-white"
                            onClick={() => setOffer(a)}
                          >
                            <FileSignature className="h-4 w-4" /> Create offer letter
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" asChild>
                            <Link href="/org/recruitment/offers">Offer {a.offerId} →</Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {offer && <OfferComposer a={offer} onClose={() => setOffer(null)} />}
    </div>
  );
}

/** Auto-generated offer: name, designation and job post pre-filled; HR reviews the letter and the salary structure, then sends. */
function OfferComposer({ a, onClose }) {
  const me = useCurrentUser();
  // Letters name the entity the offer is issued from — not a hard-coded head-office legal name.
  const orgId = useActiveOrgId();
  const entity = useOrgs().find((o) => o.id === orgId);
  const entityName = entity?.legalName ?? ORGANIZATION.legalName;
  const jobs = useJobPosts();
  const job = jobs.find((j) => j.id === a.jobId);
  const structures = useSalaryStructures().filter((x) => x.active);
  const templates = useDocTemplates().filter((t) => t.docType === "Offer Letter" && t.active);
  const plus = (d) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  };
  const [f, setF] = useState({
    department: job?.department ?? "Engineering",
    grade: job?.grade ?? "G4",
    branch: job?.location && OFFICES.includes(job.location) ? job.location : OFFICES[0],
    ctc: a.expectedCtc || Number(job?.maxSalary) || 1200000,
    joiningDate: plus(a.noticeDays || 30),
    expiryDate: plus(7),
    templateId: templates[0]?.id ?? "TPL-OFFER-STD",
  });
  const auto = useMemo(() => computeSalaryBreakup(f.ctc, f.grade), [f.ctc, f.grade]);
  const [components, setComponents] = useState(null);
  const comps = components ?? auto.earnings.map((e) => ({ label: e.label, monthly: e.monthly }));
  const gross = comps.reduce((t, c) => t + c.monthly, 0);
  const tpl = templates.find((t) => t.id === f.templateId);
  const values = {
    candidate: a.name,
    position: a.jobTitle,
    department: f.department,
    entity: entityName,
    branch: f.branch,
    grade: f.grade,
    ctc: f.ctc.toLocaleString("en-IN"),
    joiningDate: f.joiningDate,
    expiryDate: f.expiryDate,
  };
  // Plain derivation — `values` is rebuilt every render, so memoising it bought nothing.
  const generated = tpl
    ? fillTokens(tpl.body, values)
    : `Dear ${a.name},\n\nWe are pleased to offer you the position of ${a.jobTitle} in ${f.department} at ${entity?.name ?? ORGANIZATION.name}, ${f.branch}, grade ${f.grade}, at an annual CTC of ₹${f.ctc.toLocaleString("en-IN")}. Proposed joining date ${f.joiningDate}; offer valid until ${f.expiryDate}.`;
  const [body, setBody] = useState(null);
  const letter = body ?? generated;
  const finish = (send) => {
    const r = createOfferForApplicant(
      a.id,
      { ...f, letterBody: letter, customComponents: components ?? undefined },
      me,
      send,
    );
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="text-primary h-5 w-5" /> Offer letter — {a.name} ·{" "}
            {a.jobTitle}
          </DialogTitle>
          <DialogDescription>
            Auto-generated from the job post and the Doc Master template. Review, edit the salary
            structure and the letter, then send — the candidate gets an e-mail with a link to sign
            and upload documents.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Input
                  value={f.department}
                  onChange={(e) => setF({ ...f, department: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Branch</Label>
                <Select value={f.branch} onValueChange={(v) => setF({ ...f, branch: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grade → structure</Label>
                <Select
                  value={f.grade}
                  onValueChange={(v) => {
                    setF({ ...f, grade: v });
                    setComponents(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {structures.map((x) => (
                      <SelectItem key={x.grade} value={x.grade}>
                        {x.grade} · {x.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Annual CTC (₹)</Label>
                <Input
                  type="number"
                  value={f.ctc}
                  onChange={(e) => {
                    setF({ ...f, ctc: +e.target.value });
                    setComponents(null);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Joining date</Label>
                <Input
                  type="date"
                  value={f.joiningDate}
                  onChange={(e) => setF({ ...f, joiningDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Offer valid till</Label>
                <Input
                  type="date"
                  value={f.expiryDate}
                  onChange={(e) => setF({ ...f, expiryDate: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Letter template (Doc Master)</Label>
                <Select
                  value={f.templateId}
                  onValueChange={(v) => {
                    setF({ ...f, templateId: v });
                    setBody(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · v{t.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-border rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Salary structure (monthly) — editable</div>
                <div className="text-muted-foreground text-xs">
                  Gross {inr(gross)} · {components ? "edited by HR" : `auto from grade ${f.grade}`}
                </div>
              </div>
              <div className="space-y-1">
                {comps.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_140px_auto] items-center gap-2">
                    <Input
                      className="h-8"
                      value={c.label}
                      onChange={(e) =>
                        setComponents(
                          comps.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      className="h-8 text-right"
                      type="number"
                      value={c.monthly}
                      onChange={(e) =>
                        setComponents(
                          comps.map((x, k) => (k === i ? { ...x, monthly: +e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-8 text-xs"
                      onClick={() => setComponents(comps.filter((_, k) => k !== i))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    setComponents([...comps, { label: "Special allowance", monthly: 0 }])
                  }
                >
                  + Component
                </Button>
                {components && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setComponents(null)}
                  >
                    Reset to grade structure
                  </Button>
                )}
              </div>
              <div className="text-muted-foreground mt-2 text-[11px]">
                Employer cost (PF / ESI / gratuity from structure): {inr(auto.employerCostMonthly)}{" "}
                / month · CTC {inr(f.ctc)}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Offer letter (review &amp; edit)</Label>
              {body && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setBody(null)}
                >
                  Regenerate from template
                </Button>
              )}
            </div>
            <Textarea
              rows={22}
              className="font-mono text-xs"
              value={letter}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="text-muted-foreground text-[11px]">
              The annexure table above is appended automatically; the candidate signs on their
              secure link and uploads PAN, Aadhaar, education and relieving documents.
            </div>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => finish(false)}>
            Save as draft
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={!(f.ctc > 0) || !f.joiningDate || !f.expiryDate}
            onClick={() => finish(true)}
          >
            <Send className="h-4 w-4" /> Send offer letter to {a.email}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
