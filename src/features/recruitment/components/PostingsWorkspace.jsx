import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Plus, Briefcase, Link2, Download } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { JOB_TYPES, JOB_LOCATIONS, PRIORITIES } from "@/features/recruitment/data/recruitment-data";
import { useMasterNames } from "@/components/common/CrudSection";
import {
  addJobPost,
  updateJobPost,
  useApplicants,
  useScopedJobPosts,
} from "@/features/recruitment/data/recruitment-engine";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useSalaryStructures } from "@/features/payroll/data/salary-engine";
import Link from "@/lib/router";
import { FileUp, Users } from "lucide-react";
import { BRANCHES } from "@/features/employees/data/hr-data";

const ALL_BRANCHES = Object.values(BRANCHES).flat();

const EMPTY = {
  title: "",
  jobType: "",
  location: "",
  branch: "",
  positions: "",
  priority: "",
  minExp: "",
  maxExp: "",
  minSalary: "",
  maxSalary: "",
  deadline: "",
  skills: "",
  description: "",
  department: "",
  grade: "G4",
  jdFile: "",
};

/** Escapes HR-typed text before it is written into the downloadable HTML form (a title like "<script>" ran as code). */
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function applicationFormHtml(raw) {
  const p = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v]),
  );
  return `<!doctype html><html><head><meta charset="utf-8"><title>${p.title} — Application Form</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#14261f}
h1{margin-bottom:4px}label{display:block;margin:14px 0 4px;font-size:13px;font-weight:600}
input,textarea{width:100%;padding:8px;border:1px solid #ccd;border-radius:8px}
.meta{color:#5a6b64;font-size:13px}</style></head><body>
<h1>${p.title}</h1>
<p class="meta">${p.jobType} · ${p.location}${p.branch ? " · " + p.branch : ""} · ${p.positions} position(s) · Priority: ${p.priority}</p>
<p class="meta">Experience ${p.minExp}-${p.maxExp} yrs · Salary ${p.minSalary}-${p.maxSalary} · Apply before ${p.deadline}</p>
<p>${p.description}</p>
<p class="meta"><strong>Required skills:</strong> ${p.skills}</p>
<hr/>
<form><label>Full Name</label><input/><label>Email</label><input type="email"/><label>Phone</label><input/>
<label>Current Company</label><input/><label>Total Experience</label><input/>
<label>Current CTC</label><input/><label>Expected CTC</label><input/>
<label>Skills</label><textarea rows="3"></textarea><label>Cover Note</label><textarea rows="4"></textarea>
<p><button type="submit">Submit Application</button></p></form></body></html>`;
}

export function PostingsWorkspace() {
  const locationNames = useMasterNames("JL", "Job Locations", JOB_LOCATIONS);
  const me = useCurrentUser();
  const rows = useScopedJobPosts();
  const orgId = useActiveOrgId();
  const todayIso = new Date().toISOString().slice(0, 10);
  const applicants = useApplicants();
  const structures = useSalaryStructures().filter((x) => x.active);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const rangeError =
    form.minExp !== "" && form.maxExp !== "" && Number(form.minExp) > Number(form.maxExp)
      ? "Minimum experience cannot exceed the maximum."
      : form.minSalary !== "" &&
          form.maxSalary !== "" &&
          Number(form.minSalary) > Number(form.maxSalary)
        ? "Minimum salary cannot exceed the maximum."
        : form.positions !== "" && Number(form.positions) < 1
          ? "Number of positions must be at least 1."
          : [form.minExp, form.maxExp, form.minSalary, form.maxSalary].some(
                (v) => v !== "" && Number(v) < 0,
              )
            ? "Experience and salary cannot be negative."
            : form.deadline && form.deadline < todayIso
              ? "The application deadline cannot be in the past."
              : rows.some(
                    (r) =>
                      r.title.trim().toLowerCase() === form.title.trim().toLowerCase() &&
                      (r.status ?? "Open") === "Open",
                  )
                ? "An open post with this title already exists."
                : null;
  const valid = form.title.trim() && form.jobType && form.location && !rangeError;

  function submit() {
    // Tagged with the entity in view so each company sees only its own openings.
    addJobPost({ ...form, title: form.title.trim(), status: "Open", orgId }, me);
    setForm({ ...EMPTY });
    setOpen(false);
    toast.success(
      `Job posting published${form.jdFile ? ` with JD ${form.jdFile}` : ""} — applicants land in Step 2`,
    );
  }

  function download(p) {
    const blob = new Blob([applicationFormHtml(p)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.id}-application-form.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Application form downloaded");
  }

  async function copyLink(p) {
    try {
      await navigator.clipboard.writeText(p.portalUrl);
      toast.success("Career portal link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">Step 1 · Job posts</h2>
          <p className="text-muted-foreground text-sm">
            Every opening generates a shareable link and a downloadable application form.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-emerald shrink-0 text-white">
              <Plus className="h-4 w-4" /> New Job Posting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Job Posting</DialogTitle>
              <DialogDescription>
                Publishes the role and generates the application form.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
              <F label="Title" required full>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
              </F>
              <F label="Job Type" required>
                <Select value={form.jobType} onValueChange={(v) => set("jobType", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Location" required>
                <Select value={form.location} onValueChange={(v) => set("location", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationNames.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Branch">
                <Select value={form.branch} onValueChange={(v) => set("branch", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_BRANCHES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Priority">
                <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Number of Positions">
                <Input
                  type="number"
                  value={form.positions}
                  onChange={(e) => set("positions", e.target.value)}
                />
              </F>
              <F label="Application Deadline">
                <Input
                  type="date"
                  min={todayIso}
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                />
              </F>
              <F label="Min Experience (yrs)">
                <Input
                  type="number"
                  value={form.minExp}
                  onChange={(e) => set("minExp", e.target.value)}
                />
              </F>
              <F label="Max Experience (yrs)">
                <Input
                  type="number"
                  value={form.maxExp}
                  onChange={(e) => set("maxExp", e.target.value)}
                />
              </F>
              <F label="Min Salary">
                <Input
                  type="number"
                  value={form.minSalary}
                  onChange={(e) => set("minSalary", e.target.value)}
                />
              </F>
              <F label="Max Salary">
                <Input
                  type="number"
                  value={form.maxSalary}
                  onChange={(e) => set("maxSalary", e.target.value)}
                />
              </F>
              <F label="Required Skills" full>
                <Textarea
                  rows={2}
                  value={form.skills}
                  onChange={(e) => set("skills", e.target.value)}
                />
              </F>
              <F label="Department">
                <Input
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                  placeholder="Engineering"
                />
              </F>
              <F label="Grade (salary structure)">
                <Select value={form.grade} onValueChange={(v) => set("grade", v)}>
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
              </F>
              <F label="Job description (JD) upload — PDF / DOCX" full>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    className="text-xs"
                    onChange={(e) => set("jdFile", e.target.files?.[0]?.name ?? "")}
                  />
                  {form.jdFile && (
                    <Badge variant="outline">
                      <FileUp className="mr-1 h-3 w-3" />
                      {form.jdFile}
                    </Badge>
                  )}
                </div>
              </F>
              <F label="Summary shown on the careers portal" full>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </F>
            </div>
            {rangeError && <div className="text-destructive text-xs">{rangeError}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={submit}>
                Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((p) => (
          <Card key={p.id} className="shadow-card">
            <CardContent className="space-y-3 p-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="bg-gradient-emerald grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {p.id} · {p.jobType} · {p.location}
                    {p.branch ? ` · ${p.branch}` : ""}
                  </div>
                </div>
                {p.priority && (
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary shrink-0"
                  >
                    {p.priority}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{p.description}</p>
              <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <div className="text-foreground font-medium">{p.positions || "—"}</div>Positions
                </div>
                <div>
                  <div className="text-foreground font-medium">
                    {p.minExp}-{p.maxExp} yrs
                  </div>
                  Experience
                </div>
                <div>
                  <div className="text-foreground font-medium">
                    {p.minSalary}-{p.maxSalary}
                  </div>
                  Salary
                </div>
                <div>
                  <div className="text-foreground font-medium">{p.deadline || "—"}</div>Deadline
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                Skills: {p.skills || "—"}
                {p.department ? ` · ${p.department}` : ""}
                {p.grade ? ` · grade ${p.grade}` : ""}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {p.jdFile ? (
                  <Badge variant="outline">
                    <FileUp className="mr-1 h-3 w-3" />
                    {p.jdFile}
                  </Badge>
                ) : (
                  <label className="text-primary cursor-pointer underline">
                    Upload JD
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        captureFiles(e.target.files);
                        const f = e.target.files?.[0];
                        if (f) {
                          updateJobPost(p.id, { jdFile: f.name });
                          toast.success(`JD ${f.name} attached`);
                        }
                      }}
                    />
                  </label>
                )}
                {/* Status was display-only — a filled or cancelled opening could never be put on hold or closed. */}
                <Select
                  value={p.status ?? "Open"}
                  onValueChange={(v) => {
                    updateJobPost(p.id, { status: v });
                    toast.success(`${p.title} is now ${v.toLowerCase()}`);
                  }}
                >
                  <SelectTrigger
                    className={`h-7 w-[110px] text-xs ${(p.status ?? "Open") === "Open" ? "border-primary/30 bg-primary/10 text-primary" : ""}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Open", "On hold", "Closed"].map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link
                  href="/org/recruitment/candidates"
                  className="text-primary ml-auto inline-flex items-center gap-1 hover:underline"
                >
                  <Users className="h-3.5 w-3.5" />{" "}
                  {applicants.filter((a) => a.jobId === p.id && a.stage !== "Rejected").length}{" "}
                  applicants →
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copyLink(p)}>
                  <Link2 className="h-4 w-4" /> Copy career link
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={() => download(p)}
                >
                  <Download className="h-4 w-4" /> Download form
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="shadow-card lg:col-span-2">
            <CardContent className="text-muted-foreground p-10 text-center text-sm">
              No job posts yet — publish the first opening.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function F({ label, required, full, children }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-muted-foreground text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
