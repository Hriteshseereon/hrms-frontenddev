// Step 1 · Job posts — create an opening, then manage every opening from one table. Each row's "View applicants"
// opens the candidates of that job only (/org/recruitment/candidates/:jobId, Step 2).
import { useMemo, useRef, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import {
  Plus,
  Briefcase,
  Link2,
  Download,
  FileUp,
  Users,
  Search,
  MoreHorizontal,
  ArrowRight,
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JOB_TYPES, JOB_LOCATIONS, PRIORITIES } from "@/features/recruitment/data/recruitment-data";
import { useMasterNames } from "@/components/common/CrudSection";
import {
  addJobPost,
  nextJobPostId,
  updateJobPost,
  useApplicants,
  useJobPosts,
  useScopedJobPosts,
} from "@/features/recruitment/data/recruitment-engine";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useSalaryStructures } from "@/features/payroll/data/salary-engine";
import Link from "@/lib/router";
import { BRANCHES } from "@/features/employees/data/hr-data";
import { cn } from "@/lib/utils";

const ALL_BRANCHES = Object.values(BRANCHES).flat();
const POST_STATUSES = ["Open", "On hold", "Closed"];

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

const inr = (v) => (v === "" || v == null ? "" : `₹${Number(v).toLocaleString("en-IN")}`);
const range = (a, b, fmt = (x) => x) =>
  a === "" && b === "" ? "—" : a !== "" && b !== "" ? `${fmt(a)} – ${fmt(b)}` : fmt(a || b);

const statusTone = (st) =>
  st === "Open"
    ? "border-primary/30 bg-primary/10 text-primary"
    : st === "On hold"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
      : "border-border bg-muted text-muted-foreground";

export function PostingsWorkspace() {
  const me = useCurrentUser();
  const rows = useScopedJobPosts();
  const applicants = useApplicants();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const jdInput = useRef(null);
  const [jdTarget, setJdTarget] = useState(null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (p) =>
          (status === "all" || (p.status ?? "Open") === status) &&
          (!q ||
            [p.id, p.title, p.department, p.location, p.jobType]
              .join(" ")
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [rows, q, status],
  );
  const countOf = (st) =>
    st === "all" ? rows.length : rows.filter((p) => (p.status ?? "Open") === st).length;
  const applicantsOf = (id) => applicants.filter((a) => a.jobId === id && a.stage !== "Rejected");

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
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">Step 1 · Job posts</h2>
          <p className="text-muted-foreground text-sm">
            Create an opening, then open its applicants from the row.
          </p>
        </div>
        <Button className="bg-gradient-emerald shrink-0 text-white" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Create job
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="border-border bg-muted/40 flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search job ID, title, department, location…"
              className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {["all", ...POST_STATUSES].map((st) => (
              <Button
                key={st}
                size="sm"
                variant={status === st ? "default" : "outline"}
                className={status === st ? "bg-gradient-emerald text-white" : ""}
                onClick={() => setStatus(st)}
              >
                {st === "all" ? "All" : st} ({countOf(st)})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Job ID",
                  "Job title",
                  "Type · Location",
                  "Positions",
                  "Experience",
                  "Salary",
                  "Deadline",
                  "Applicants",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th key={i} className="p-3 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-muted-foreground p-10 text-center">
                    {rows.length === 0 ? (
                      <div className="space-y-3">
                        <Briefcase className="mx-auto h-8 w-8 opacity-40" />
                        <div>No job posts yet — create the first opening.</div>
                        <Button
                          size="sm"
                          className="bg-gradient-emerald text-white"
                          onClick={() => setOpen(true)}
                        >
                          <Plus className="h-4 w-4" /> Create job
                        </Button>
                      </div>
                    ) : (
                      "No job posts match this filter."
                    )}
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const list = applicantsOf(p.id);
                const fresh = list.filter((a) => a.stage === "Applied").length;
                const st = p.status ?? "Open";
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs font-medium whitespace-nowrap">{p.id}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.title}</span>
                        {p.priority && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 text-[10px]",
                              p.priority === "Urgent" || p.priority === "High"
                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                                : "",
                            )}
                          >
                            {p.priority}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {[p.department, p.grade && `Grade ${p.grade}`]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {p.jobType}
                      <div className="text-muted-foreground">
                        {p.location}
                        {p.branch ? ` · ${p.branch}` : ""}
                      </div>
                    </td>
                    <td className="p-3 text-center">{p.positions || "—"}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {range(p.minExp, p.maxExp)}
                      {(p.minExp !== "" || p.maxExp !== "") && " yrs"}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {range(p.minSalary, p.maxSalary, inr)}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">{p.deadline || "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-semibold">{list.length}</span>
                      {fresh > 0 && (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary ml-2 h-5 text-[10px]"
                        >
                          {fresh} new
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <Select
                        value={st}
                        onValueChange={(v) => {
                          updateJobPost(p.id, { status: v });
                          toast.success(`${p.title} is now ${v.toLowerCase()}`);
                        }}
                      >
                        <SelectTrigger className={cn("h-7 w-[100px] text-xs", statusTone(st))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POST_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          size="sm"
                          className="bg-gradient-emerald h-8 text-xs whitespace-nowrap text-white"
                        >
                          <Link href={`/org/recruitment/candidates/${encodeURIComponent(p.id)}`}>
                            <Users className="h-3.5 w-3.5" /> View applicants
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label="More"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => copyLink(p)}>
                              <Link2 className="h-4 w-4" /> Copy career link
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => download(p)}>
                              <Download className="h-4 w-4" /> Download application form
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => {
                                setJdTarget(p);
                                jdInput.current?.click();
                              }}
                            >
                              <FileUp className="h-4 w-4" />{" "}
                              {p.jdFile ? `Replace JD (${p.jdFile})` : "Upload JD"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <input
        ref={jdInput}
        type="file"
        accept=".pdf,.docx,.doc"
        className="hidden"
        onChange={(e) => {
          captureFiles(e.target.files);
          const f = e.target.files?.[0];
          if (f && jdTarget) {
            updateJobPost(jdTarget.id, { jdFile: f.name });
            toast.success(`JD ${f.name} attached to ${jdTarget.id}`);
          }
          e.target.value = "";
          setJdTarget(null);
        }}
      />

      <CreateJobDialog open={open} onClose={() => setOpen(false)} rows={rows} me={me} />
    </div>
  );
}

function CreateJobDialog({ open, onClose, rows, me }) {
  const locationNames = useMasterNames("JL", "Job Locations", JOB_LOCATIONS);
  const orgId = useActiveOrgId();
  const structures = useSalaryStructures().filter((x) => x.active);
  // Every entity's posts, not only the scoped ones: ids are unique across the store.
  const allPosts = useJobPosts();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ ...EMPTY });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const nextId = nextJobPostId(allPosts);

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
  const valid =
    form.title.trim() && form.jobType && form.location && form.positions !== "" && !rangeError;

  function close() {
    setForm({ ...EMPTY });
    onClose();
  }

  function submit() {
    // Tagged with the entity in view so each company sees only its own openings.
    const row = addJobPost({ ...form, title: form.title.trim(), status: "Open", orgId }, me);
    close();
    toast.success(`${row.id} · ${row.title} created — applicants appear under View applicants`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create job</DialogTitle>
          <DialogDescription>
            Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>

        <Section title="Job details" first>
          <F label="Job ID">
            <Input value={nextId} readOnly disabled className="font-mono" />
            <p className="text-muted-foreground text-[11px]">Generated automatically</p>
          </F>
          <F label="Job title" required>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Senior React Developer"
            />
          </F>
          <F label="Department">
            <Input
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="e.g. Engineering"
            />
          </F>
          <F label="Job type" required>
            <Pick
              value={form.jobType}
              onChange={(v) => set("jobType", v)}
              options={JOB_TYPES}
              placeholder="Select job type"
            />
          </F>
          <F label="Location" required>
            <Pick
              value={form.location}
              onChange={(v) => set("location", v)}
              options={locationNames}
              placeholder={
                locationNames.length ? "Select location" : "Add locations in Master Data"
              }
            />
          </F>
          <F label="Branch">
            <Pick
              value={form.branch}
              onChange={(v) => set("branch", v)}
              options={ALL_BRANCHES}
              placeholder="Select branch"
            />
          </F>
          <F label="Number of positions" required>
            <Input
              type="number"
              min={1}
              value={form.positions}
              onChange={(e) => set("positions", e.target.value)}
            />
          </F>
          <F label="Priority">
            <Pick
              value={form.priority}
              onChange={(v) => set("priority", v)}
              options={PRIORITIES}
              placeholder="Select priority"
            />
          </F>
          <F label="Application deadline">
            <Input
              type="date"
              min={todayIso}
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </F>
        </Section>

        <Section title="Requirements">
          <F label="Min experience (yrs)">
            <Input
              type="number"
              value={form.minExp}
              onChange={(e) => set("minExp", e.target.value)}
            />
          </F>
          <F label="Max experience (yrs)">
            <Input
              type="number"
              value={form.maxExp}
              onChange={(e) => set("maxExp", e.target.value)}
            />
          </F>
          <F label="Required skills" full>
            <Input
              value={form.skills}
              onChange={(e) => set("skills", e.target.value)}
              placeholder="Comma separated — e.g. React, Node.js, SQL (used for ATS scoring)"
            />
          </F>
        </Section>

        <Section title="Compensation">
          <F label="Min salary (₹ / year)">
            <Input
              type="number"
              value={form.minSalary}
              onChange={(e) => set("minSalary", e.target.value)}
            />
          </F>
          <F label="Max salary (₹ / year)">
            <Input
              type="number"
              value={form.maxSalary}
              onChange={(e) => set("maxSalary", e.target.value)}
            />
          </F>
          <F label="Grade (salary structure)" full>
            <Select value={form.grade} onValueChange={(v) => set("grade", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
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
        </Section>

        <Section title="Description">
          <F label="Job summary (shown on the careers page)" full>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </F>
          <F label="Job description (JD) file — PDF / DOCX" full>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.docx,.doc"
                className="text-xs"
                onChange={(e) => {
                  captureFiles(e.target.files);
                  set("jdFile", e.target.files?.[0]?.name ?? "");
                }}
              />
              {form.jdFile && (
                <Badge variant="outline">
                  <FileUp className="mr-1 h-3 w-3" />
                  {form.jdFile}
                </Badge>
              )}
            </div>
          </F>
        </Section>

        {rangeError && <div className="text-destructive text-xs">{rangeError}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={submit}>
            Create job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, first, children }) {
  return (
    <div className={cn("space-y-3", !first && "border-t pt-4")}>
      <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {title}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Pick({ value, onChange, options, placeholder }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
