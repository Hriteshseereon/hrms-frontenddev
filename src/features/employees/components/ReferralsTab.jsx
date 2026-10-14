import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import Link from "@/lib/router";
import { Plus, UserPlus, Eye, IndianRupee, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  SectionTitle,
  StatusBadge,
  EmployeePicker,
  HistoryTrail,
  KV,
  Toolbar,
  EmptyRow,
  useScopedIds,
} from "@/features/employees/components/CasePieces";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { useScopedJobPosts, useApplicants } from "@/features/recruitment/data/recruitment-engine";
import {
  REFERRAL_RELATIONS,
  useReferrals,
  createReferral,
  updateReferralStatus,
} from "@/features/employees/data/people-cases";

const STATUSES = ["Submitted", "Screening", "Interviewing", "Hired", "Bonus paid", "Not selected"];

export function ReferralsTab() {
  const me = useCurrentUser();
  const scopedIds = useScopedIds();
  const rows = useReferrals().filter((c) => scopedIds.has(c.referrerId));
  const applicants = useApplicants();
  useDirectory();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const list = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!q ||
        [r.id, r.candidate, r.referrer, r.jobTitle, r.skills]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const live = detail ? (rows.find((c) => c.id === detail.id) ?? detail) : null;
  const stageOf = (r) => applicants.find((a) => a.id === r.applicantId)?.stage;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Referrals this FY", rows.length],
          [
            "In pipeline",
            rows.filter((r) => ["Submitted", "Screening", "Interviewing"].includes(r.status))
              .length,
          ],
          ["Hired", rows.filter((r) => r.status === "Hired" || r.status === "Bonus paid").length],
          [
            "Bonus paid (₹)",
            rows
              .filter((r) => r.status === "Bonus paid")
              .reduce((s, r) => s + r.bonusAmount, 0)
              .toLocaleString("en-IN"),
          ],
        ].map(([k, v]) => (
          <Card key={String(k)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{k}</div>
              <div className="text-2xl font-bold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Toolbar q={q} setQ={setQ} placeholder="Search candidate, referrer, job…">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Toolbar>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium ml-auto text-white"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Log referral on behalf
          </Button>
        </CardContent>
      </Card>
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Candidate</th>
                <th className="p-3 text-left">Referred by</th>
                <th className="p-3 text-left">Job post</th>
                <th className="p-3 text-left">Experience / skills</th>
                <th className="p-3 text-left">Recruitment stage</th>
                <th className="p-3 text-right">Bonus (₹)</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={9} text="No referrals." />}
              {list.map((r) => (
                <tr key={r.id} className="border-border hover:bg-muted/30 border-t">
                  <td className="p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3">
                    <div className="font-medium">
                      <span className="whitespace-nowrap">{r.candidate}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {r.email} · {r.phone}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {r.referrer}
                    <div className="text-muted-foreground">
                      {r.referrerDept} · {r.relationship}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {r.jobTitle}
                    <div className="text-muted-foreground">{r.jobId}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {r.experienceYears} yrs
                    <div className="text-muted-foreground max-w-[180px] truncate">{r.skills}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {r.applicantId ? (
                      <Link
                        href="/org/recruitment/candidates"
                        className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline"
                      >
                        {stageOf(r) ?? "Applied"} · {r.applicantId}{" "}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.bonusEligible ? r.bonusAmount.toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                      <Eye className="h-4 w-4" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log referral</DialogTitle>
            <DialogDescription>
              The candidate is added to Recruitment → Candidates applied (source: Referral) and the
              referrer tracks the outcome on their portal. Bonus is paid with payroll after the
              90-day retention period.
            </DialogDescription>
          </DialogHeader>
          <ReferralForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!live} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          {live && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="text-primary h-5 w-5" /> {live.id} ·{" "}
                  <span className="whitespace-nowrap">{live.candidate}</span>
                </DialogTitle>
                <DialogDescription>
                  Referred by {live.referrer} on{" "}
                  <span className="whitespace-nowrap">{live.createdOn}</span>
                </DialogDescription>
              </DialogHeader>
              <KV
                items={[
                  ["Job post", `${live.jobTitle} (${live.jobId})`],
                  ["Relationship", live.relationship],
                  ["Experience", `${live.experienceYears} years`],
                  ["Skills", live.skills],
                  ["CV", live.cvFile],
                  ["Note", live.note],
                  [
                    "Applicant",
                    live.applicantId
                      ? `${live.applicantId} · stage ${stageOf(live) ?? "Applied"}`
                      : "—",
                  ],
                  [
                    "Bonus",
                    live.bonusEligible
                      ? `₹${live.bonusAmount.toLocaleString("en-IN")}${live.bonusPaidOn ? ` · paid ${live.bonusPaidOn}` : ""}`
                      : "Not eligible",
                  ],
                ]}
              />
              <HistoryTrail history={live.history} />
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-muted-foreground text-xs">Update status</Label>
                <Select
                  value={live.status}
                  onValueChange={(v) => {
                    updateReferralStatus(live.id, v, me);
                    toast.success(`Status → ${v}; referrer notified.`);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* "Bonus paid" only through the button below (Hired + eligible) — picking it here paid any referral. */}
                    {STATUSES.filter((s) => s !== "Bonus paid" || live.status === "Bonus paid").map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                {live.status === "Hired" && live.bonusEligible && (
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    onClick={() => {
                      updateReferralStatus(live.id, "Bonus paid", me);
                      toast.success(
                        `₹${live.bonusAmount.toLocaleString("en-IN")} referral bonus queued for payroll.`,
                      );
                    }}
                  >
                    <IndianRupee className="h-4 w-4" /> Pay bonus with payroll
                  </Button>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ReferralForm({ onDone, referrerId: fixedReferrer }) {
  const me = useCurrentUser();
  // Job posts of the referrer's entity only (every entity's openings were listed).
  const jobs = useScopedJobPosts();
  const [referrerId, setReferrerId] = useState(fixedReferrer ?? "");
  const [candidate, setCandidate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState(REFERRAL_RELATIONS[0]);
  const [jobId, setJobId] = useState("");
  const [cvFile, setCvFile] = useState("");
  const [skills, setSkills] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [note, setNote] = useState("");
  const [bonusEligible, setBonusEligible] = useState(true);
  const [bonusAmount, setBonusAmount] = useState("25000");
  const submit = () => {
    const job = jobs.find((j) => j.id === jobId);
    const r = createReferral(
      {
        referrerId,
        candidate,
        email,
        phone,
        relationship,
        jobId,
        jobTitle: job?.title ?? "",
        cvFile,
        skills,
        experienceYears: Number(experienceYears) || 0,
        note,
        bonusEligible,
        bonusAmount: Number(bonusAmount) || 0,
      },
      me,
    );
    r.ok ? (toast.success(r.message), onDone()) : toast.error(r.message);
  };
  return (
    <div className="space-y-4">
      {!fixedReferrer && (
        <>
          <SectionTitle n={1} title="Referring employee" />
          <EmployeePicker value={referrerId} onChange={setReferrerId} />
        </>
      )}
      <SectionTitle n={fixedReferrer ? 1 : 2} title="Candidate" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Candidate name" required>
          <Input value={candidate} onChange={(e) => setCandidate(e.target.value)} />
        </Field>
        <Field label="E-mail" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Relationship" required>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFERRAL_RELATIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Job post" required>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger>
              <SelectValue placeholder="Open job posts" />
            </SelectTrigger>
            <SelectContent>
              {jobs
                .filter((j) => (j.status ?? "Open") === "Open")
                .map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} · {j.id} · {j.location}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Experience (years)">
          <Input
            type="number"
            min={0}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
          />
        </Field>
        <Field label="Key skills" className="sm:col-span-2">
          <Input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Comma separated — used by the ATS shortlisting engine"
          />
        </Field>
        <Field label="CV">
          <div className="flex items-center gap-2">
            <label className="border-border hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs">
              Upload CV
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  captureFiles(e.target.files);
                  setCvFile(e.target.files?.[0]?.name ?? "");
                }}
              />
            </label>
            {cvFile && <Badge variant="outline">{cvFile}</Badge>}
          </div>
        </Field>
        <Field label="Why this candidate?" className="sm:col-span-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {/* An employee referring from the portal could set their own bonus eligibility and amount — HR-only fields. */}
        {!fixedReferrer && (
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="be"
              checked={bonusEligible}
              onCheckedChange={(v) => setBonusEligible(!!v)}
            />
            <Label htmlFor="be" className="font-normal">
              Eligible for referral bonus
            </Label>
          </div>
        )}
        {!fixedReferrer && bonusEligible && (
          <Field label="Bonus amount (₹) — per policy by grade">
            <Input
              type="number"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
            />
          </Field>
        )}
      </div>
      <DialogFooter>
        <Button className="bg-gradient-emerald text-white" onClick={submit}>
          Submit referral
        </Button>
      </DialogFooter>
    </div>
  );
}
