// Step 2 · Candidates applied — every applicant per job post from every source. View CV, edit, schedule, shortlist
// (manual) or "Run shortlisting" (ATS engine → scores, remarks, best-fit reasons → auto-shortlist above cut-off).
import { useMemo, useState } from "react";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import { attachmentOf, attachmentStore, isImageName, isPdfName } from "@/lib/attachments";
import { captureFiles } from "@/lib/attachments";
import Link from "@/lib/router";
import {
  Search,
  Sparkles,
  FileText,
  CalendarClock,
  UserCheck,
  Plus,
  Pencil,
  XCircle,
  Info,
} from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { SOURCE_MASTER_SEED } from "@/features/recruitment/data/recruitment-data";
import { useMasterNames } from "@/components/common/CrudSection";
import {
  addApplicant,
  findDuplicateApplicant,
  rejectApplicant,
  runAutoShortlist,
  shortlistManually,
  stageTone,
  updateApplicant,
  useScopedApplicants,
  useScopedJobPosts,
} from "@/features/recruitment/data/recruitment-engine";
import { ScheduleInterviewDialog } from "@/features/recruitment/components/InterviewDialogs";
import { exportLetterPdf } from "@/lib/export-utils";

const act = (r) => toast[r.ok ? "success" : "error"](r.message);

export function CandidatesWorkspace() {
  const me = useCurrentUser();
  // Scoped to the entity in view (applicants of every entity were listed and could be shortlisted by any entity).
  const jobs = useScopedJobPosts();
  const all = useScopedApplicants();
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "all");
  // A job id from another entity (after switching entity) would leave the list empty with no matching option.
  if (jobId !== "all" && jobs.length && !jobs.some((j) => j.id === jobId)) setJobId("all");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("Applied");
  const [cv, setCv] = useState(null);
  const [edit, setEdit] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [cutoff, setCutoff] = useState(65);
  const rows = useMemo(
    () =>
      all
        .filter(
          (a) =>
            (jobId === "all" || a.jobId === jobId) &&
            (stage === "all" || a.stage === stage) &&
            (!q ||
              [a.name, a.email, a.currentCompany, a.skills.join(" "), a.source]
                .join(" ")
                .toLowerCase()
                .includes(q.toLowerCase())),
        )
        .sort((a, b) => (b.ats?.score ?? -1) - (a.ats?.score ?? -1)),
    [all, jobId, stage, q],
  );
  const job = jobs.find((j) => j.id === jobId);
  const counts = (s) =>
    all.filter((a) => (jobId === "all" || a.jobId === jobId) && (s === "all" || a.stage === s))
      .length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Step 2 · Candidates applied</h2>
          <p className="text-muted-foreground text-sm">
            Applicants from the careers portal, LinkedIn, Naukri, referrals and agencies. Shortlist
            manually or run the ATS engine; shortlisted candidates move to Step 3.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add applicant
        </Button>
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[260px] space-y-1">
            <Label className="text-xs">Job post</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All job posts</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} · {j.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="border-border bg-muted/40 flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, company, skill, source…"
              className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ATS cut-off</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="h-9 w-20"
              value={cutoff}
              onChange={(e) => setCutoff(Math.min(100, Math.max(0, +e.target.value || 0)))}
            />
          </div>
          <Button
            className="bg-gradient-emerald shadow-premium h-9 text-white"
            disabled={jobId === "all"}
            title={jobId === "all" ? "Pick a job post to run the ATS" : ""}
            onClick={() => {
              const r = runAutoShortlist(jobId, me, cutoff);
              act(r);
              if (r.ok) setStage("all");
            }}
          >
            <Sparkles className="h-4 w-4" /> Run shortlisting
          </Button>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-1">
        {["Applied", "Shortlisted", "Interviewing", "Finalised", "Offered", "Rejected", "all"].map(
          (s) => (
            <Button
              key={s}
              size="sm"
              variant={stage === s ? "default" : "outline"}
              className={stage === s ? "bg-gradient-emerald text-white" : ""}
              onClick={() => setStage(s)}
            >
              {s === "all" ? "All" : s} ({counts(s)})
            </Button>
          ),
        )}
      </div>
      {job && (
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <Info className="h-3.5 w-3.5" />
          <span className="min-w-0">
            {" "}
            ATS matches against the JD: skills <b className="mx-1">{job.skills}</b> · {job.minExp}–
            {job.maxExp} yrs · budget ₹{Number(job.minSalary).toLocaleString("en-IN")}–₹
            {Number(job.maxSalary).toLocaleString("en-IN")} ·{" "}
            {job.jdFile ? `JD ${job.jdFile}` : "no JD uploaded"}
          </span>
        </div>
      )}
      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Candidate",
                  "Job post",
                  "Source",
                  "Exp / notice",
                  "Current → expected CTC",
                  "Skills",
                  "ATS",
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
                  <td colSpan={9} className="text-muted-foreground p-8 text-center">
                    No candidates in this view.
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30 align-top">
                  <td className="p-3">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {a.currentCompany} · {a.education}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {a.email} · {a.phone}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {a.jobTitle}
                    <div className="text-muted-foreground">
                      {a.jobId} · applied <span className="whitespace-nowrap">{a.appliedOn}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{a.source}</Badge>
                  </td>
                  <td className="p-3 text-xs">
                    {a.experienceYears} yrs
                    <div className="text-muted-foreground">{a.noticeDays} days notice</div>
                  </td>
                  <td className="p-3 text-xs">
                    ₹{a.currentCtc.toLocaleString("en-IN")}
                    <div className="text-muted-foreground">
                      → ₹{a.expectedCtc.toLocaleString("en-IN")}
                    </div>
                  </td>
                  <td className="max-w-[200px] p-3 text-xs">{a.skills.join(", ")}</td>
                  <td className="p-3">
                    {a.ats ? (
                      <div title={a.ats.reasons.join("\n")}>
                        <div
                          className={cn(
                            "text-lg font-bold",
                            a.ats.score >= 80
                              ? "text-primary"
                              : a.ats.score >= 65
                                ? ""
                                : "text-destructive",
                          )}
                        >
                          {a.ats.score}
                        </div>
                        <div className="text-muted-foreground max-w-[160px] text-[10px]">
                          {a.ats.remarks}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={stageTone(a.stage)}>
                      {a.stage}
                    </Badge>
                    {a.shortlist && (
                      <div className="text-muted-foreground text-[10px]">
                        {a.shortlist.how} · {a.shortlist.on}
                      </div>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setCv(a)}
                      >
                        <FileText className="h-3.5 w-3.5" /> CV
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setEdit(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {a.stage === "Applied" && (
                        <Button
                          size="sm"
                          className="bg-gradient-emerald h-7 text-xs text-white"
                          onClick={() => act(shortlistManually(a.id, me))}
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Shortlist
                        </Button>
                      )}
                      {(a.stage === "Shortlisted" || a.stage === "Interviewing") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setSchedule(a)}
                        >
                          <CalendarClock className="h-3.5 w-3.5" /> Schedule
                        </Button>
                      )}
                      {a.stage === "Applied" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-7 text-xs"
                          onClick={() => {
                            const r = window.prompt("Reason for rejection");
                            if (r) act(rejectApplicant(a.id, me, r));
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="text-muted-foreground text-xs">
        Shortlisted candidates appear in{" "}
        <Link href="/org/recruitment/interviews" className="text-primary underline">
          Step 3 · Interview stages &amp; assessment
        </Link>{" "}
        with a Schedule button.
      </div>

      <CvDialog a={cv} onClose={() => setCv(null)} />
      <EditDialog a={edit} onClose={() => setEdit(null)} />
      {schedule && (
        <ScheduleInterviewDialog applicant={schedule} onClose={() => setSchedule(null)} />
      )}
      <AddApplicantDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

/** Valid Indian phone: optional +91 / 0, then 10 digits starting 6-9 (spaces and hyphens ignored). */
const PHONE = /^(\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;

/** The actual uploaded CV, when its bytes were captured in this browser (PDF inline, image inline). */
function UploadedCv({ name }) {
  attachmentStore.use();
  const file = name ? attachmentOf(name) : null;
  if (!file?.dataUrl) return null;
  if (file.type === "application/pdf" || isPdfName(name))
    return (
      <iframe
        src={file.dataUrl}
        title={name}
        className="border-border h-[50dvh] w-full rounded-lg border"
      />
    );
  if (file.type.startsWith("image/") || isImageName(name))
    return (
      <img
        src={file.dataUrl}
        alt={name}
        className="border-border max-h-[50dvh] w-full rounded-lg border object-contain"
      />
    );
  return null;
}

function CvDialog({ a, onClose }) {
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {a && (
          <>
            <DialogHeader>
              <DialogTitle>{a.name} — CV</DialogTitle>
              <DialogDescription>
                {a.cvFile ? (
                  <AttachmentChips names={[a.cvFile]} context={`CV · ${a.name}`} size="xs" />
                ) : (
                  "No file uploaded"
                )}{" "}
                · applied <span className="whitespace-nowrap">{a.appliedOn}</span> via {a.source}{" "}
                for {a.jobTitle}
              </DialogDescription>
            </DialogHeader>
            <UploadedCv name={a.cvFile} />
            <div className="border-border bg-muted/20 space-y-3 rounded-xl border p-5 font-serif text-sm">
              <div>
                <div className="text-xl font-bold">{a.name}</div>
                <div className="text-muted-foreground">
                  {a.email} · {a.phone} · {a.location}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Profile
                </div>
                <p>
                  {a.coverNote ||
                    `${a.experienceYears} years of experience, currently at ${a.currentCompany}. ${a.education}.`}
                </p>
              </div>
              <div>
                <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Skills
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.skills.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Experience
                  </div>
                  {a.experienceYears} yrs · {a.currentCompany}
                </div>
                <div>
                  <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Education
                  </div>
                  {a.education}
                </div>
                <div>
                  <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Compensation
                  </div>
                  ₹{a.currentCtc.toLocaleString("en-IN")} → ₹{a.expectedCtc.toLocaleString("en-IN")}
                </div>
                <div>
                  <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Notice
                  </div>
                  {a.noticeDays} days
                </div>
              </div>
              {a.ats && (
                <div className="border-primary/30 bg-primary/5 rounded-lg border p-3">
                  <div className="font-semibold">
                    ATS score {a.ats.score} — {a.ats.remarks}
                  </div>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {a.ats.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="text-muted-foreground space-y-0.5 text-xs">
              {a.history.map((h, i) => (
                <div key={i}>
                  {h.at} · {h.by} — {h.action}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  exportLetterPdf({
                    title: `CV — ${a.name}`,
                    reference: a.id,
                    bodyHtml: `<p><b>${a.jobTitle}</b> · ${a.source} · ${a.email} · ${a.phone}</p><p>${a.coverNote || ""}</p><p><b>Skills:</b> ${a.skills.join(", ")}</p><p><b>Experience:</b> ${a.experienceYears} yrs · ${a.currentCompany}<br/><b>Education:</b> ${a.education}<br/><b>CTC:</b> ₹${a.currentCtc.toLocaleString("en-IN")} → ₹${a.expectedCtc.toLocaleString("en-IN")} · notice ${a.noticeDays} days</p>${a.ats ? `<p><b>ATS ${a.ats.score}</b> — ${a.ats.remarks}<br/>${a.ats.reasons.join("<br/>")}</p>` : ""}`,
                  })
                }
              >
                Download PDF
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ a, onClose }) {
  const me = useCurrentUser();
  const [f, setF] = useState(a);
  if (a && (!f || f.id !== a.id)) setF(a);
  // Drop the draft on close so cancelled edits do not resurface the next time the same candidate is opened.
  const close = () => {
    setF(null);
    onClose();
  };
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-xl">
        {f && (
          <>
            <DialogHeader>
              <DialogTitle>Edit candidate</DialogTitle>
              <DialogDescription>
                {f.id} · {f.jobTitle}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["name", "Name"],
                ["email", "E-mail"],
                ["phone", "Phone"],
                ["currentCompany", "Current company"],
                ["education", "Education"],
                ["location", "Location"],
              ].map(([k, l]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{l}</Label>
                  <Input
                    value={String(f[k] ?? "")}
                    onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  />
                </div>
              ))}
              {[
                ["experienceYears", "Experience (yrs)"],
                ["currentCtc", "Current CTC"],
                ["expectedCtc", "Expected CTC"],
                ["noticeDays", "Notice (days)"],
              ].map(([k, l]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{l}</Label>
                  <Input
                    type="number"
                    value={Number(f[k] ?? 0)}
                    onChange={(e) => setF({ ...f, [k]: +e.target.value })}
                  />
                </div>
              ))}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Skills (comma separated)</Label>
                <Input
                  value={f.skills.join(", ")}
                  onChange={(e) =>
                    setF({
                      ...f,
                      skills: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Replace CV</Label>
                <Input
                  type="file"
                  className="text-xs"
                  onChange={(e) => {
                    captureFiles(e.target.files);
                    setF({ ...f, cvFile: e.target.files?.[0]?.name ?? f.cvFile });
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-emerald text-white"
                disabled={!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)}
                onClick={() => {
                  // Patch only the profile fields: saving the whole snapshot overwrote stage / interviews / offer changes made while the dialog was open.
                  const {
                    name,
                    email,
                    phone,
                    currentCompany,
                    education,
                    location,
                    experienceYears,
                    currentCtc,
                    expectedCtc,
                    noticeDays,
                    skills,
                    cvFile,
                  } = f;
                  if ([experienceYears, currentCtc, expectedCtc, noticeDays].some((n) => n < 0)) {
                    toast.error("Experience, CTC and notice cannot be negative.");
                    return;
                  }
                  updateApplicant(
                    f.id,
                    {
                      name: name.trim(),
                      email: email.trim(),
                      phone,
                      currentCompany,
                      education,
                      location,
                      experienceYears,
                      currentCtc,
                      expectedCtc,
                      noticeDays,
                      skills,
                      cvFile,
                    },
                    me.name,
                  );
                  toast.success("Candidate updated");
                  close();
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddApplicantDialog({ open, onClose }) {
  const sourceNames = useMasterNames("CS", "Candidate Sources", SOURCE_MASTER_SEED);
  const me = useCurrentUser();
  // Only open posts of the entity in view accept new applicants.
  const jobs = useScopedJobPosts().filter((j) => (j.status ?? "Open") === "Open");
  const blank = () => ({
    jobId: jobs[0]?.id ?? "",
    name: "",
    email: "",
    phone: "",
    source: "Career Portal",
    currentCompany: "",
    experienceYears: 3,
    currentCtc: 800000,
    expectedCtc: 1100000,
    skills: "",
    education: "",
    noticeDays: 30,
    location: "",
    cvFile: "",
    coverNote: "",
  });
  const [f, setF] = useState(blank);
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add applicant</DialogTitle>
          <DialogDescription>
            Walk-in, agency or e-mail applications that did not come through the careers portal.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Job post</Label>
            <Select value={f.jobId} onValueChange={(v) => set("jobId", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail *</Label>
            <Input value={f.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone *</Label>
            <Input
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+91 98XXXXXXXX"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Select value={f.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceNames.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Current company</Label>
            <Input
              value={f.currentCompany}
              onChange={(e) => set("currentCompany", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Education</Label>
            <Input value={f.education} onChange={(e) => set("education", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Experience (yrs)</Label>
            <Input
              type="number"
              value={f.experienceYears}
              onChange={(e) => set("experienceYears", +e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notice (days)</Label>
            <Input
              type="number"
              value={f.noticeDays}
              onChange={(e) => set("noticeDays", +e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Current CTC</Label>
            <Input
              type="number"
              value={f.currentCtc}
              onChange={(e) => set("currentCtc", +e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expected CTC</Label>
            <Input
              type="number"
              value={f.expectedCtc}
              onChange={(e) => set("expectedCtc", +e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Skills (comma separated) *</Label>
            <Input value={f.skills} onChange={(e) => set("skills", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CV *</Label>
            <Input
              type="file"
              className="text-xs"
              onChange={(e) => {
                captureFiles(e.target.files);
                set("cvFile", e.target.files?.[0]?.name ?? "");
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Location</Label>
            <Input value={f.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Cover note</Label>
            <Textarea
              rows={2}
              value={f.coverNote}
              onChange={(e) => set("coverNote", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email) || !f.jobId}
            onClick={() => {
              const job = jobs.find((j) => j.id === f.jobId);
              if (!job) {
                toast.error("Pick a job post");
                return;
              }
              if (!PHONE.test(f.phone.trim())) {
                toast.error("Enter a valid phone number (10 digits, +91 optional).");
                return;
              }
              if (!f.skills.split(",").some((x) => x.trim())) {
                toast.error("List at least one skill.");
                return;
              }
              if (!f.cvFile) {
                toast.error("Attach the candidate's CV.");
                return;
              }
              if (
                [f.experienceYears, f.currentCtc, f.expectedCtc, f.noticeDays].some((n) => n < 0)
              ) {
                toast.error("Experience, CTC and notice cannot be negative.");
                return;
              }
              const dup = findDuplicateApplicant(f.email, f.jobId);
              if (dup) {
                toast.error(`${dup.name} already applied for this post (${dup.id}).`);
                return;
              }
              addApplicant(
                {
                  ...f,
                  jobTitle: job.title,
                  skills: f.skills
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                me.name,
              );
              toast.success("Applicant added");
              setF(blank());
              onClose();
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
