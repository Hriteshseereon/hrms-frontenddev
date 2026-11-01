import { useState, useEffect, useMemo, useCallback } from "react";
import {
  UserPlus,
  Plus,
  IndianRupee,
  Calendar,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Search,
  AlertCircle,
  Eye,
  X,
  UploadCloud,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { captureFiles } from "@/lib/attachments";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import {
  useReferrals,
  createReferral as mockCreateReferral,
  REFERRAL_RELATIONS,
  caseTone,
} from "@/features/employees/data/people-cases";
import {
  useScopedJobPosts,
} from "@/features/recruitment/data/recruitment-engine";
import { referralApi, getErrorMessage } from "@/api/referralApi";

const ATS_STAGES = ["Applied", "Shortlisted", "Interviewing", "Offered", "Hired"];

export default function MyReferralsView() {
  const me = useCurrentEmployee();
  const rawReferrals = useReferrals();
  const mockMine = useMemo(() => {
    return rawReferrals.filter((r) => r.referrerId === me?.id);
  }, [rawReferrals, me?.id]);

  const rawScopedJobs = useScopedJobPosts();
  const mockScopedJobs = useMemo(() => {
    return rawScopedJobs.filter((j) => (j.status ?? "Open") === "Open");
  }, [rawScopedJobs]);

  const [loading, setLoading] = useState(false);
  const [apiReferrals, setApiReferrals] = useState(null);
  const [apiStats, setApiStats] = useState(null);
  const [openJobs, setOpenJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Referral Modal State
  const [isReferOpen, setIsReferOpen] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState(REFERRAL_RELATIONS[0]);
  const [jobId, setJobId] = useState("");
  const [skills, setSkills] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [note, setNote] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [cvFileUrl, setCvFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal State
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load My Referrals
  const loadReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await referralApi.getMyReferrals();
      if (res) {
        if (res.items) setApiReferrals(res.items);
        else if (Array.isArray(res)) setApiReferrals(res);
        if (res.stats) setApiStats(res.stats);
      }
    } catch {
      // Fallback silently to mock store
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Open Job Posts
  const loadOpenJobs = useCallback(async () => {
    try {
      const res = await referralApi.getOpenPosts();
      if (Array.isArray(res) && res.length > 0) {
        setOpenJobs(res);
      } else if (res && Array.isArray(res.items)) {
        setOpenJobs(res.items);
      } else if (res && Array.isArray(res.data)) {
        setOpenJobs(res.data);
      }
    } catch {
      // Fallback handled seamlessly via displayJobs
    }
  }, []);

  useEffect(() => {
    loadReferrals();
    loadOpenJobs();
  }, [loadReferrals, loadOpenJobs]);

  // Combined Rows
  const referrals = useMemo(() => {
    return apiReferrals !== null ? apiReferrals : mockMine;
  }, [apiReferrals, mockMine]);

  // Available Open Jobs (Prefer live backend API data, fallback to mock store)
  const displayJobs = useMemo(() => {
    return openJobs.length > 0 ? openJobs : mockScopedJobs;
  }, [openJobs, mockScopedJobs]);

  // Computed KPI Stats
  const stats = useMemo(() => {
    if (apiStats) return apiStats;
    const paid = referrals
      .filter((r) => r.status === "Bonus paid")
      .reduce((sum, r) => sum + (Number(r.bonusAmount || r.bonus_amount) || 0), 0);
    return {
      referralsMade: referrals.length,
      inPipeline: referrals.filter((r) =>
        ["Submitted", "Screening", "Interviewing"].includes(r.status)
      ).length,
      hired: referrals.filter((r) => r.status === "Hired" || r.status === "Bonus paid").length,
      totalBonusReceived: paid,
    };
  }, [apiStats, referrals]);

  // Filtered List
  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      const matchStatus =
        statusFilter === "all" ? true : r.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchSearch =
        !searchQuery ||
        [
          r.candidate || r.candidate_name,
          r.email,
          r.jobTitle || r.job_title,
          r.skills,
          r.id || r.code,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(searchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [referrals, statusFilter, searchQuery]);

  // Self-referral check warning
  const isSelfReferral = useMemo(() => {
    if (!email.trim() || !me?.email) return false;
    return email.trim().toLowerCase() === me.email.toLowerCase();
  }, [email, me?.email]);

  // Open single referral detail
  const handleOpenDetail = async (ref) => {
    setSelectedReferral(ref);
    setDetailData(ref);

    const refId = ref.id || ref.code;
    try {
      setDetailLoading(true);
      const detail = await referralApi.getMyReferralDetail(refId);
      if (detail) {
        setDetailData(detail);
      }
    } catch {
      // Fallback
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Referral Form
  const handleReferSubmit = async (e) => {
    e?.preventDefault();
    if (!candidateName.trim() || !email.trim() || !jobId) {
      toast.error("Candidate name, valid email, and job post are required.");
      return;
    }
    if (isSelfReferral) {
      toast.error("You cannot refer yourself for open job posts.");
      return;
    }

    const selectedJob = displayJobs.find((j) => j.id === jobId);
    const jobTitle = selectedJob?.title || selectedJob?.jobTitle || "Open Role";

    setSubmitting(true);
    const payload = {
      candidateName: candidateName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      relationship,
      jobId,
      jobTitle,
      skills: skills.trim() || undefined,
      experienceYears: Number(experienceYears) || 0,
      note: note.trim() || undefined,
      cvFileUrl: cvFileUrl || undefined,
      cvFileName: cvFileName || undefined,
    };

    try {
      await referralApi.submitReferral(payload);
      toast.success(
        `Referral submitted! ${candidateName} has been enrolled in the Recruitment ATS pipeline.`
      );
      setIsReferOpen(false);
      resetReferForm();
      loadReferrals();
    } catch (err) {
      // Fallback to local recruitment engine
      const mockRes = mockCreateReferral(
        {
          referrerId: me.id,
          candidate: candidateName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          relationship,
          jobId,
          jobTitle,
          cvFile: cvFileName || "CV.pdf",
          skills: skills.trim(),
          experienceYears: Number(experienceYears) || 0,
          note: note.trim(),
          bonusEligible: true,
          bonusAmount: 25000,
        },
        me
      );

      if (mockRes.ok) {
        toast.success(mockRes.message);
        setIsReferOpen(false);
        resetReferForm();
        loadReferrals();
      } else {
        toast.error(getErrorMessage(err, mockRes.message));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetReferForm = () => {
    setCandidateName("");
    setEmail("");
    setPhone("");
    setRelationship(REFERRAL_RELATIONS[0]);
    setJobId("");
    setSkills("");
    setExperienceYears("");
    setNote("");
    setCvFileName("");
    setCvFileUrl("");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Action */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-xl border border-indigo-800/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
              <UserPlus className="h-3.5 w-3.5" /> Employee Talent Network
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Refer a Candidate &amp; Earn Rewards
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Help us grow by referring exceptional talent from your network. Track live ATS interview
              stages in real-time. Referral bonuses are disbursed with payroll following the 90-day
              retention milestone.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-gradient-emerald shadow-premium hover:opacity-95 text-white font-semibold shrink-0 gap-2 px-6 h-12"
            onClick={() => setIsReferOpen(true)}
          >
            <Plus className="h-5 w-5" /> Refer a Candidate
          </Button>
        </div>
      </div>

      {/* 2. KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Referrals Made",
            value: stats.referralsMade,
            icon: UserPlus,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            title: "In Recruitment Pipeline",
            value: stats.inPipeline,
            icon: TrendingUp,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
          {
            title: "Hired Candidates",
            value: stats.hired,
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            title: "Total Bonus Earned",
            value: `₹${Number(stats.totalBonusReceived || 0).toLocaleString("en-IN")}`,
            icon: IndianRupee,
            color: "text-primary",
            bg: "bg-primary/10",
          },
        ].map((kpi, idx) => (
          <Card key={idx} className="shadow-card border-border/80 hover:border-primary/30 transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {kpi.title}
                </div>
                <div className="text-2xl font-bold tracking-tight">{kpi.value}</div>
              </div>
              <div className={cn("p-3 rounded-xl", kpi.bg)}>
                <kpi.icon className={cn("h-6 w-6", kpi.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. Open Job Positions Ticker */}
      <Card className="shadow-card border-border/80">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-primary" /> Open Positions You Can Refer For
            </div>
            <Badge variant="outline" className="text-[11px] font-medium">
              {displayJobs.length} Active Openings
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {displayJobs.map((j) => (
              <Badge
                key={j.id}
                variant="secondary"
                className="text-xs py-1 px-2.5 font-normal hover:bg-muted cursor-pointer transition border border-border"
                onClick={() => {
                  setJobId(j.id);
                  setIsReferOpen(true);
                }}
              >
                <b>{j.title || j.jobTitle}</b>
                <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                  · {j.location || "On-site"}
                </span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Controls & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80">
          {[
            { id: "all", label: "All Referrals" },
            { id: "Submitted", label: "Submitted" },
            { id: "Screening", label: "Screening" },
            { id: "Interviewing", label: "Interviewing" },
            { id: "Hired", label: "Hired" },
            { id: "Bonus paid", label: "Bonus Paid" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === tab.id
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, job, skills…"
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* 5. Pipeline Tracker Table */}
      <Card className="shadow-card border-border/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <tr>
                <th className="p-3.5 text-left font-semibold">Candidate</th>
                <th className="p-3.5 text-left font-semibold">Job Post</th>
                <th className="p-3.5 text-left font-semibold">Submitted Date</th>
                <th className="p-3.5 text-left font-semibold">Live ATS Pipeline Stage</th>
                <th className="p-3.5 text-left font-semibold">Interview Schedule</th>
                <th className="p-3.5 text-left font-semibold">Referral Bonus</th>
                <th className="p-3.5 text-left font-semibold">Status</th>
                <th className="p-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && referrals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Clock className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading your referrals…
                  </td>
                </tr>
              ) : filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                    <div className="font-medium text-foreground">No referrals found</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {searchQuery
                        ? "Try adjusting your search criteria."
                        : "Click 'Refer a Candidate' above to refer your first peer."}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReferrals.map((r) => {
                  const candidate = r.candidate || r.candidate_name;
                  const jobTitle = r.jobTitle || r.job_title;
                  const date = r.createdOn || r.created_on;
                  const bonusAmt = Number(r.bonusAmount || r.bonus_amount || 25000);
                  const isEligible = r.bonusEligible !== false && r.bonus_eligible !== false;
                  const isPaid = r.status === "Bonus paid";

                  // Find applicant stage from recruitment engine
                  const applicant = mockApplicants.find((a) => a.id === (r.applicantId || r.applicant_id));
                  const currentStage = r.ats_stage || applicant?.stage || "Applied";
                  const scheduledInterview = r.interview_date || applicant?.interviews?.find((i) => i.status === "Scheduled");

                  return (
                    <tr
                      key={r.id || r.code}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => handleOpenDetail(r)}
                    >
                      {/* Candidate */}
                      <td className="p-3.5">
                        <div className="font-semibold text-foreground">{candidate}</div>
                        <div className="text-muted-foreground text-xs">{r.email}</div>
                        {r.relationship && (
                          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                            {r.relationship} · {r.experienceYears || r.experience_years || 0} yrs
                          </div>
                        )}
                      </td>

                      {/* Job Post */}
                      <td className="p-3.5 text-xs">
                        <div className="font-medium text-foreground">{jobTitle}</div>
                        <div className="text-muted-foreground text-[11px]">{r.jobId || r.job_id}</div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {date}
                      </td>

                      {/* Live ATS Stage Stepper */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1">
                          {ATS_STAGES.map((stg, i) => {
                            const isCurrent = currentStage.toLowerCase() === stg.toLowerCase();
                            const isPassed =
                              ATS_STAGES.findIndex((s) => s.toLowerCase() === currentStage.toLowerCase()) >= i;

                            return (
                              <div key={stg} className="flex items-center">
                                <div
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-semibold transition-all",
                                    isCurrent
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : isPassed
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted text-muted-foreground/60"
                                  )}
                                  title={`Stage: ${stg}`}
                                >
                                  {stg}
                                </div>
                                {i < ATS_STAGES.length - 1 && (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Scheduled Interview */}
                      <td className="p-3.5 text-xs">
                        {scheduledInterview ? (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 text-[11px] py-1 gap-1">
                            <Clock className="h-3 w-3" />
                            {typeof scheduledInterview === "string"
                              ? scheduledInterview.slice(0, 10)
                              : `${scheduledInterview.date || "Scheduled"} (${scheduledInterview.round || "Round 1"})`}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">No interview scheduled</span>
                        )}
                      </td>

                      {/* Bonus */}
                      <td className="p-3.5 text-xs whitespace-nowrap">
                        {isEligible ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] font-semibold py-1",
                              isPaid
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                : "border-primary/30 bg-primary/10 text-primary"
                            )}
                          >
                            <IndianRupee className="h-3 w-3 mr-0.5" />
                            {bonusAmt.toLocaleString("en-IN")}{" "}
                            {isPaid ? "Paid" : "Eligible"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Not eligible</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <Badge variant="outline" className={cn("text-[11px] font-semibold", caseTone(r.status))}>
                          {r.status}
                        </Badge>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-primary group-hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(r);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 6. Refer a Candidate Modal */}
      <Dialog open={isReferOpen} onOpenChange={setIsReferOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <UserPlus className="h-5 w-5 text-primary" /> Refer a Candidate
            </DialogTitle>
            <DialogDescription className="text-xs">
              Referring as <b>{me.name}</b> ({me.id}). The candidate will be automatically entered into Step 2 (Candidates Applied) of the Recruitment ATS pipeline.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReferSubmit} className="space-y-4 pt-2">
            {/* Open Job Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Open Job Position *</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose an open position" />
                </SelectTrigger>
                <SelectContent>
                  {displayJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs">
                      {j.title || j.jobTitle} · {j.location || "HQ"} ({j.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Candidate Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Candidate Full Name *</Label>
                <Input
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Arun Kumar"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className={cn("h-9 text-xs", isSelfReferral && "border-destructive text-destructive")}
                  required
                />
                {isSelfReferral && (
                  <div className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3 w-3" /> Anti-self-referral policy: You cannot refer your own email address.
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91-9876543210"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Professional Relationship *</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_RELATIONS.map((rel) => (
                      <SelectItem key={rel} value={rel} className="text-xs">
                        {rel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Skills & Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Key Skills (Comma Separated)</Label>
                <Input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Python, React, Docker, Postgres"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Experience (Years)</Label>
                <Input
                  type="number"
                  min="0"
                  max="40"
                  step="0.5"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 4.5"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Resume Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resume / CV Document</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/20">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded-md bg-background border px-3 py-1.5 hover:bg-muted transition">
                  <UploadCloud className="h-4 w-4 text-primary" /> Choose File
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      captureFiles(e.target.files);
                      const file = e.target.files?.[0];
                      if (file) {
                        setCvFileName(file.name);
                        setCvFileUrl(URL.createObjectURL(file));
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {cvFileName ? (
                  <Badge variant="outline" className="text-xs py-1 px-2.5 gap-1.5">
                    <FileText className="h-3 w-3 text-primary" /> {cvFileName}
                    <button
                      type="button"
                      onClick={() => {
                        setCvFileName("");
                        setCvFileUrl("");
                      }}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX up to 10MB
                  </span>
                )}
              </div>
            </div>

            {/* Recommendation Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Why do you recommend this candidate?</Label>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Highlight their strengths, project accomplishments, and cultural fit…"
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Bonus Advisory */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <IndianRupee className="h-3.5 w-3.5 text-primary" /> Referral Bonus Eligibility
                </div>
                <div className="text-muted-foreground">
                  ₹25,000 standard reward payable after the candidate completes 90 days retention.
                </div>
              </div>
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-xs font-semibold">
                Policy Active
              </Badge>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsReferOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-emerald shadow-premium text-white font-medium"
                disabled={submitting || isSelfReferral}
              >
                {submitting ? "Submitting Referral…" : "Submit Referral"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. Detail View Modal */}
      <Dialog open={!!selectedReferral} onOpenChange={(o) => !o && setSelectedReferral(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          {detailData && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {detailData.code || detailData.id}
                  </span>
                  <Badge variant="outline" className={caseTone(detailData.status)}>
                    {detailData.status}
                  </Badge>
                </div>
                <DialogTitle className="text-lg font-bold">
                  {detailData.candidate || detailData.candidate_name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Referred for <b>{detailData.jobTitle || detailData.job_title}</b> on {detailData.createdOn || detailData.created_on}
                </DialogDescription>
              </DialogHeader>

              {/* Live ATS Stage Banner */}
              <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>ATS Recruitment Pipeline</span>
                  <Badge variant="secondary" className="text-xs">
                    Stage: {detailData.ats_stage || "Applied"}
                  </Badge>
                </div>

                <div className="grid grid-cols-5 gap-1 pt-1">
                  {ATS_STAGES.map((stg) => {
                    const current = (detailData.ats_stage || "Applied").toLowerCase();
                    const isPassed =
                      ATS_STAGES.findIndex((s) => s.toLowerCase() === current) >=
                      ATS_STAGES.findIndex((s) => s.toLowerCase() === stg.toLowerCase());

                    return (
                      <div
                        key={stg}
                        className={cn(
                          "py-1.5 px-1 rounded text-center text-[10px] font-semibold transition-all",
                          stg.toLowerCase() === current
                            ? "bg-primary text-primary-foreground shadow"
                            : isPassed
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground/60"
                        )}
                      >
                        {stg}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Key Information */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Email &amp; Phone</div>
                  <div className="font-medium text-foreground mt-0.5">{detailData.email}</div>
                  <div className="text-muted-foreground text-[11px]">{detailData.phone || "No phone provided"}</div>
                </div>

                <div className="p-2.5 rounded-lg border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Experience &amp; Relation</div>
                  <div className="font-medium text-foreground mt-0.5">
                    {detailData.experienceYears || detailData.experience_years || 0} years experience
                  </div>
                  <div className="text-muted-foreground text-[11px]">{detailData.relationship}</div>
                </div>

                <div className="p-2.5 rounded-lg border border-border col-span-2">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Skills</div>
                  <div className="font-medium text-foreground mt-0.5">{detailData.skills || "—"}</div>
                </div>

                {detailData.note && (
                  <div className="p-2.5 rounded-lg border border-border col-span-2 bg-muted/10">
                    <div className="text-muted-foreground text-[10px] uppercase font-semibold">Referrer Recommendation</div>
                    <div className="text-foreground mt-0.5 leading-relaxed">{detailData.note}</div>
                  </div>
                )}
              </div>

              {/* Scheduled Interviews if any */}
              {detailData.interview_details && detailData.interview_details.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Interview Details
                  </div>
                  <div className="space-y-1.5">
                    {detailData.interview_details.map((round, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-between text-xs"
                      >
                        <div className="font-medium">
                          Round {round.round || i + 1}: {round.type || "Evaluation"}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {round.status || "Completed"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bonus Information */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <IndianRupee className="h-3.5 w-3.5 text-primary" /> Bonus Amount: ₹
                    {Number(detailData.bonusAmount || detailData.bonus_amount || 25000).toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {detailData.status === "Bonus paid"
                      ? `Paid on ${detailData.bonusPaidOn || detailData.bonus_paid_on}`
                      : detailData.status === "Hired"
                        ? "Hired — payable after 90 days retention"
                        : "Payable upon candidate completion of 90 days tenure"}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-medium">
                  {detailData.status === "Bonus paid" ? "Disbursed" : "Pending Retention"}
                </Badge>
              </div>

              {/* History Trail */}
              {detailData.history && detailData.history.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Audit Trail
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {detailData.history.map((h, i) => (
                      <div key={i} className="text-muted-foreground text-[11px] flex items-center gap-2">
                        <span>{h.at || h.action_at}</span> ·
                        <b className="text-foreground">{h.by || h.action_by}</b> —
                        <span>{h.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedReferral(null)}>
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
