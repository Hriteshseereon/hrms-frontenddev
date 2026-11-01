import { useState, useEffect, useMemo, useCallback } from "react";
import { captureFiles } from "@/lib/attachments";
import Link from "@/lib/router";
import { Plus, UserPlus, Eye, IndianRupee, ExternalLink, Clock, AlertCircle } from "lucide-react";
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
  createReferral as mockCreateReferral,
  updateReferralStatus as mockUpdateReferralStatus,
} from "@/features/employees/data/people-cases";
import { referralApi, getErrorMessage } from "@/api/referralApi";

const STATUSES = ["Submitted", "Screening", "Interviewing", "Hired", "Bonus paid", "Not selected"];

export function getRetentionStatus(r) {
  const dateStr = r.hiredOn || r.hired_on || r.createdOn || r.created_on;
  if (!dateStr) return { elapsed: 0, remaining: 90, eligible: false };
  const d = new Date(dateStr);
  const diffDays = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, 90 - diffDays);
  return {
    elapsed: diffDays,
    remaining,
    eligible: remaining === 0,
  };
}

export function ReferralsTab() {
  const me = useCurrentUser();
  const scopedIds = useScopedIds();
  const mockRows = useReferrals().filter((c) => scopedIds.has(c.referrerId));
  const applicants = useApplicants();
  useDirectory();

  const [loading, setLoading] = useState(false);
  const [apiRows, setApiRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [payingBonusId, setPayingBonusId] = useState(null);

  // Load Admin Referrals
  const loadReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await referralApi.getAdminReferrals();
      if (res) {
        if (res.items) setApiRows(res.items);
        else if (Array.isArray(res)) setApiRows(res);
      }
    } catch {
      // Fallback to local store
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  // Combined Rows
  const rows = useMemo(() => {
    return apiRows !== null ? apiRows : mockRows;
  }, [apiRows, mockRows]);

  const list = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!q ||
        [r.id || r.code, r.candidate || r.candidate_name, r.referrer, r.jobTitle || r.job_title, r.skills]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  const live = detail ? (rows.find((c) => c.id === detail.id || c.code === detail.code) ?? detail) : null;
  const stageOf = (r) => applicants.find((a) => a.id === (r.applicantId || r.applicant_id))?.stage;

  // Handle Status Update
  const handleStatusChange = async (referralId, newStatus) => {
    try {
      await referralApi.updateStatus(referralId, newStatus);
      toast.success(`Status updated to ${newStatus}; candidate and referrer notified.`);
      loadReferrals();
    } catch (err) {
      mockUpdateReferralStatus(referralId, newStatus, me);
      toast.success(`Status → ${newStatus}; referrer notified.`);
      loadReferrals();
    }
  };

  // Handle Pay Bonus (with 90-day retention verification)
  const handlePayBonus = async (r) => {
    const id = r.id || r.code;
    const retention = getRetentionStatus(r);

    if (!retention.eligible) {
      toast.error(
        `Cannot disburse bonus yet. Candidate has ${retention.remaining} day(s) remaining in the 90-day retention period.`
      );
      return;
    }

    setPayingBonusId(id);
    try {
      await referralApi.payBonus(id, "Disbursed with current payroll batch.");
      toast.success(
        `₹${(r.bonusAmount || r.bonus_amount || 25000).toLocaleString("en-IN")} referral bonus queued for payroll.`
      );
      loadReferrals();
    } catch (err) {
      mockUpdateReferralStatus(id, "Bonus paid", me);
      toast.success(
        `₹${(r.bonusAmount || r.bonus_amount || 25000).toLocaleString("en-IN")} referral bonus queued for payroll.`
      );
      loadReferrals();
    } finally {
      setPayingBonusId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
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
              .reduce((s, r) => s + (Number(r.bonusAmount || r.bonus_amount) || 0), 0)
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

      {/* Toolbar & Actions */}
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Toolbar q={q} setQ={setQ} placeholder="Search candidate, referrer, job…">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40 text-xs h-9">
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

      {/* Referrals Register Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase border-b border-border">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Candidate</th>
                <th className="p-3 text-left">Referred by</th>
                <th className="p-3 text-left">Job post</th>
                <th className="p-3 text-left">Recruitment Stage</th>
                <th className="p-3 text-left">Quick Status Shift</th>
                <th className="p-3 text-right">Bonus (₹)</th>
                <th className="p-3 text-right">Bonus Action</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={9} text="No referrals found." />}
              {list.map((r) => {
                const candidate = r.candidate || r.candidate_name;
                const jobTitle = r.jobTitle || r.job_title;
                const bonusAmt = Number(r.bonusAmount || r.bonus_amount || 0);
                const isBonusEligible = r.bonusEligible !== false && r.bonus_eligible !== false;
                const retention = getRetentionStatus(r);
                const id = r.id || r.code;

                return (
                  <tr key={id} className="border-border hover:bg-muted/30 border-t transition">
                    <td className="p-3 font-mono text-xs font-semibold text-primary">{id}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">
                        <span className="whitespace-nowrap">{candidate}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {r.email} {r.phone ? `· ${r.phone}` : ""}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="font-medium text-foreground">{r.referrer}</div>
                      <div className="text-muted-foreground">
                        {r.referrerDept || "Operations"} · {r.relationship}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="font-medium text-foreground">{jobTitle}</div>
                      <div className="text-muted-foreground font-mono text-[11px]">{r.jobId || r.job_id}</div>
                    </td>
                    <td className="p-3 text-xs">
                      {r.applicantId || r.applicant_id ? (
                        <Link
                          href="/org/recruitment/candidates"
                          className="text-primary inline-flex items-center gap-1 whitespace-nowrap hover:underline font-medium"
                        >
                          {stageOf(r) ?? "Applied"} · {r.applicantId || r.applicant_id}{" "}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Quick Status Shift Dropdown */}
                    <td className="p-3">
                      <Select
                        value={r.status}
                        onValueChange={(newSts) => handleStatusChange(id, newSts)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Screening", "Interviewing", "Hired", "Not selected"].map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                          {r.status === "Bonus paid" && (
                            <SelectItem value="Bonus paid" className="text-xs">
                              Bonus paid
                            </SelectItem>
                          )}
                          {r.status === "Submitted" && (
                            <SelectItem value="Submitted" className="text-xs">
                              Submitted
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="p-3 text-right tabular-nums text-xs font-medium">
                      {isBonusEligible ? bonusAmt.toLocaleString("en-IN") : "—"}
                    </td>

                    {/* Pay Bonus Action with 90-day retention tooltip */}
                    <td className="p-3 text-right">
                      {r.status === "Bonus paid" ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          Disbursed
                        </Badge>
                      ) : r.status === "Hired" && isBonusEligible ? (
                        retention.eligible ? (
                          <Button
                            size="sm"
                            className="bg-gradient-emerald text-white text-xs h-7 px-2.5 shadow-sm"
                            disabled={payingBonusId === id}
                            onClick={() => handlePayBonus(r)}
                          >
                            <IndianRupee className="h-3 w-3 mr-0.5" /> Pay Bonus
                          </Button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium cursor-help"
                            title={`Candidate must complete 90 days retention. ${retention.remaining} day(s) remaining.`}
                          >
                            <Clock className="h-3 w-3" />
                            {retention.remaining}d retention
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                        <Eye className="h-4 w-4" /> View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Log Referral Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log referral on behalf</DialogTitle>
            <DialogDescription>
              HR records a referral on behalf of an employee. Candidate is added to Recruitment → Candidates applied (source: Referral).
            </DialogDescription>
          </DialogHeader>
          <ReferralForm
            onDone={() => {
              setOpen(false);
              loadReferrals();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={!!live} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          {live && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="text-primary h-5 w-5" /> {live.id || live.code} ·{" "}
                  <span className="whitespace-nowrap">{live.candidate || live.candidate_name}</span>
                </DialogTitle>
                <DialogDescription>
                  Referred by {live.referrer} on{" "}
                  <span className="whitespace-nowrap">{live.createdOn || live.created_on}</span>
                </DialogDescription>
              </DialogHeader>
              <KV
                items={[
                  ["Job post", `${live.jobTitle || live.job_title} (${live.jobId || live.job_id})`],
                  ["Relationship", live.relationship],
                  ["Experience", `${live.experienceYears || live.experience_years || 0} years`],
                  ["Skills", live.skills || "—"],
                  ["CV", live.cvFile || live.cv_file_name || "—"],
                  ["Note", live.note || "—"],
                  [
                    "Applicant",
                    live.applicantId || live.applicant_id
                      ? `${live.applicantId || live.applicant_id} · stage ${stageOf(live) ?? "Applied"}`
                      : "—",
                  ],
                  [
                    "Bonus",
                    live.bonusEligible !== false && live.bonus_eligible !== false
                      ? `₹${(live.bonusAmount || live.bonus_amount || 0).toLocaleString("en-IN")}${live.bonusPaidOn ? ` · paid ${live.bonusPaidOn}` : ""}`
                      : "Not eligible",
                  ],
                ]}
              />
              <HistoryTrail history={live.history || []} />
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                <Label className="text-muted-foreground text-xs">Update status</Label>
                <Select
                  value={live.status}
                  onValueChange={(v) => handleStatusChange(live.id || live.code, v)}
                >
                  <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.filter((s) => s !== "Bonus paid" || live.status === "Bonus paid").map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                {live.status === "Hired" && (live.bonusEligible !== false) && (
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white text-xs h-8"
                    onClick={() => handlePayBonus(live)}
                  >
                    <IndianRupee className="h-3.5 w-3.5 mr-1" /> Pay bonus with payroll
                  </Button>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDetail(null)}>
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
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!candidate.trim() || !email.trim() || !jobId) {
      toast.error("Candidate name, valid email, and job post are required.");
      return;
    }
    const job = jobs.find((j) => j.id === jobId);
    setSubmitting(true);

    const payload = {
      referrerId: referrerId || me.id,
      candidateName: candidate.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      relationship,
      jobId,
      jobTitle: job?.title ?? "",
      cvFileName: cvFile,
      skills: skills.trim(),
      experienceYears: Number(experienceYears) || 0,
      note: note.trim(),
      bonusEligible,
      bonusAmount: Number(bonusAmount) || 0,
    };

    try {
      await referralApi.createReferralOnBehalf(payload);
      toast.success(`Referral logged successfully for ${candidate}.`);
      onDone?.();
    } catch (err) {
      const r = mockCreateReferral(
        {
          referrerId: referrerId || me.id,
          candidate: candidate.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          relationship,
          jobId,
          jobTitle: job?.title ?? "",
          cvFile,
          skills: skills.trim(),
          experienceYears: Number(experienceYears) || 0,
          note: note.trim(),
          bonusEligible,
          bonusAmount: Number(bonusAmount) || 0,
        },
        me,
      );
      if (r.ok) {
        toast.success(r.message);
        onDone?.();
      } else {
        toast.error(getErrorMessage(err, r.message));
      }
    } finally {
      setSubmitting(false);
    }
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
        <Button
          className="bg-gradient-emerald text-white"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit referral"}
        </Button>
      </DialogFooter>
    </div>
  );
}
