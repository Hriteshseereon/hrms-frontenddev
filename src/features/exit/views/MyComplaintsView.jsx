import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MessageSquareWarning,
  Plus,
  ShieldAlert,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Star,
  FileText,
  Search,
  ExternalLink,
  Info,
  Calendar,
  X,
  History as HistoryIcon,
  ShieldCheck,
  Building2,
  User,
  Gavel,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { captureFiles } from "@/lib/attachments";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import {
  GRIEVANCE_CATEGORIES,
  ROUTING,
  useGrievances,
  raiseGrievance as mockRaiseGrievance,
  withdrawGrievance as mockWithdrawGrievance,
  closeGrievance as mockCloseGrievance,
  appealGrievance as mockAppealGrievance,
  grievanceTone,
  severityTone,
  isOverdue,
} from "@/features/exit/data/grievance-data";
import { grievanceApi, getErrorMessage } from "@/api/grievanceApi";

export default function MyComplaintsView() {
  const me = useCurrentEmployee();
  const allGrievances = useGrievances();
  const mockRows = useMemo(() => {
    return (allGrievances || []).filter((g) => g.empId === me?.id);
  }, [allGrievances, me?.id]);

  const [loading, setLoading] = useState(false);
  const [apiRows, setApiRows] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRaiseOpen, setIsRaiseOpen] = useState(false);

  // Selected grievance for detail sheet
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  // Actions states in detail sheet
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Form states for Raise Grievance
  const [category, setCategory] = useState("Payroll / salary dispute");
  const [severity, setSeverity] = useState("Medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [against, setAgainst] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [submittingRaise, setSubmittingRaise] = useState(false);

  // Fetch grievances
  const loadMyGrievances = useCallback(async () => {
    try {
      setLoading(true);
      const res = await grievanceApi.getMyGrievances();
      if (res) {
        if (Array.isArray(res)) {
          setApiRows(res);
        } else if (Array.isArray(res.items)) {
          setApiRows(res.items);
        } else if (Array.isArray(res.data)) {
          setApiRows(res.data);
        }
      }
    } catch {
      // Fallback silently to mock store if backend is offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyGrievances();
  }, [loadMyGrievances]);

  // Combined rows (prefer live API data, fallback to mock store)
  const rows = useMemo(() => {
    const list = apiRows !== null ? apiRows : mockRows;
    return Array.isArray(list) ? list : [];
  }, [apiRows, mockRows]);

  // Filtered list
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchTab =
        activeTab === "all"
          ? true
          : activeTab === "under_investigation"
            ? r.status === "Under investigation" || r.status === "Acknowledged"
            : r.status?.toLowerCase() === activeTab.toLowerCase();

      const matchSearch =
        !searchQuery ||
        [r.code || r.id, r.subject, r.category, r.against, r.status]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(searchQuery.toLowerCase()));

      return matchTab && matchSearch;
    });
  }, [rows, activeTab, searchQuery]);

  // Load single grievance detail
  const handleOpenDetail = async (id) => {
    setSelectedId(id);
    setDetailTab("overview");
    setRating(5);
    setFeedback("");
    setAppealReason("");

    // Look up in current list first
    const localItem = rows.find((g) => (g.id === id || g.code === id));
    setDetailData(localItem || null);

    try {
      setDetailLoading(true);
      const detail = await grievanceApi.getMyGrievanceDetail(id);
      if (detail) {
        setDetailData(detail);
      }
    } catch {
      // Keep localItem fallback
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit new grievance
  const handleRaiseSubmit = async (e) => {
    e?.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Please enter both subject and description.");
      return;
    }
    if (subject.trim().length > 150) {
      toast.error("Subject must be under 150 characters.");
      return;
    }

    setSubmittingRaise(true);
    const payload = {
      category,
      severity,
      subject: subject.trim(),
      description: description.trim(),
      against: against.trim() || undefined,
      isAnonymous,
      attachments: attachments.map((a) => a.url || a.name || a),
    };

    try {
      await grievanceApi.submitGrievance(payload);
      toast.success("Grievance submitted successfully. SLA routing assigned.");
      setIsRaiseOpen(false);
      resetRaiseForm();
      loadMyGrievances();
    } catch (err) {
      // Fallback to mock store
      const mockRes = mockRaiseGrievance({
        empId: me?.id || "EMP-001",
        employee: me?.name || "Employee",
        dept: me?.dept || "Engineering",
        branch: me?.branch || "Bhubaneswar HQ",
        anonymous: isAnonymous,
        category,
        severity,
        subject: subject.trim(),
        description: description.trim(),
        against: against.trim(),
        attachments: attachments.map((a) => a.name || a),
      });

      if (mockRes.ok) {
        toast.success(mockRes.message);
        setIsRaiseOpen(false);
        resetRaiseForm();
        loadMyGrievances();
      } else {
        toast.error(getErrorMessage(err, mockRes.message));
      }
    } finally {
      setSubmittingRaise(false);
    }
  };

  const resetRaiseForm = () => {
    setCategory("Payroll / salary dispute");
    setSeverity("Medium");
    setSubject("");
    setDescription("");
    setAgainst("");
    setIsAnonymous(false);
    setAttachments([]);
  };

  // Withdraw grievance
  const handleWithdraw = async (id) => {
    if (!window.confirm("Are you sure you want to withdraw this grievance? This action cannot be undone.")) {
      return;
    }
    try {
      await grievanceApi.withdrawGrievance(id);
      toast.success("Grievance withdrawn successfully.");
      setSelectedId(null);
      loadMyGrievances();
    } catch (err) {
      const mockRes = mockWithdrawGrievance(id, me);
      if (mockRes.ok) {
        toast.success(mockRes.message);
        setSelectedId(null);
        loadMyGrievances();
      } else {
        toast.error(getErrorMessage(err, mockRes.message));
      }
    }
  };

  // Close grievance (CSAT rating)
  const handleClose = async () => {
    if (!selectedId) return;
    setSubmittingAction(true);
    try {
      await grievanceApi.closeGrievance(selectedId, { rating, feedback });
      toast.success("Resolution accepted and case closed. Thank you for your feedback!");
      setShowCloseDialog(false);
      setSelectedId(null);
      loadMyGrievances();
    } catch (err) {
      const mockRes = mockCloseGrievance(selectedId, me, rating, feedback);
      if (mockRes.ok) {
        toast.success(mockRes.message);
        setShowCloseDialog(false);
        setSelectedId(null);
        loadMyGrievances();
      } else {
        toast.error(getErrorMessage(err, mockRes.message));
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  // Appeal grievance to CHRO
  const handleAppeal = async () => {
    if (!selectedId) return;
    if (!appealReason.trim() || appealReason.trim().length < 5) {
      toast.error("Please provide a valid appeal reason (at least 5 characters).");
      return;
    }
    setSubmittingAction(true);
    try {
      await grievanceApi.appealGrievance(selectedId, { reason: appealReason.trim() });
      toast.success("Appeal lodged. Case escalated to CHRO with a 15-day resolution SLA.");
      setShowAppealDialog(false);
      setSelectedId(null);
      loadMyGrievances();
    } catch (err) {
      const mockRes = mockAppealGrievance(selectedId, me, appealReason.trim());
      if (mockRes.ok) {
        toast.success(mockRes.message);
        setShowAppealDialog(false);
        setSelectedId(null);
        loadMyGrievances();
      } else {
        toast.error(getErrorMessage(err, mockRes.message));
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  // Calculate remaining days in 7-day confirmation window
  const getDaysRemainingInAppealWindow = (resolvedOn) => {
    if (!resolvedOn) return 0;
    const resolvedDate = new Date(resolvedOn);
    const deadline = new Date(resolvedDate);
    deadline.setDate(deadline.getDate() + 7);
    const now = new Date();
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const selectedRouting = ROUTING[category] || { committee: "HR Operations", ackDays: 2, resolveDays: 10 };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-6 md:p-8 text-white shadow-xl border border-emerald-800/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="h-3.5 w-3.5" /> Confidential & Time-Bound Redressal
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Need Help or Have a Workplace Concern?
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Every employee has the right to a safe, respectful, and transparent workplace.
              Submit concerns regarding harassment, salary, manager conduct, or facilities with
              guaranteed acknowledgment SLAs and confidential committee handling.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-gradient-emerald shadow-premium hover:opacity-95 text-white font-semibold shrink-0 gap-2 px-6 h-12"
            onClick={() => setIsRaiseOpen(true)}
          >
            <Plus className="h-5 w-5" /> Raise a Grievance
          </Button>
        </div>
      </div>

      {/* 2. Filter & Tab Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80">
          {[
            { id: "all", label: "All Grievances" },
            { id: "Submitted", label: "Submitted" },
            { id: "under_investigation", label: "In Investigation" },
            { id: "Resolved", label: "Resolved" },
            { id: "Closed", label: "Closed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reference, subject, category…"
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* 3. Grievances Table */}
      <Card className="shadow-card border-border/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <tr>
                <th className="p-3.5 text-left font-semibold">Ref Code</th>
                <th className="p-3.5 text-left font-semibold">Category</th>
                <th className="p-3.5 text-left font-semibold">Subject</th>
                <th className="p-3.5 text-left font-semibold">Severity</th>
                <th className="p-3.5 text-left font-semibold">Raised On</th>
                <th className="p-3.5 text-left font-semibold">Committee / Owner</th>
                <th className="p-3.5 text-left font-semibold">SLA Deadline</th>
                <th className="p-3.5 text-left font-semibold">Status</th>
                <th className="p-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <Clock className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading your grievances…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-muted-foreground">
                    <MessageSquareWarning className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                    <div className="font-medium text-foreground">No grievances found</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {searchQuery
                        ? "Try clearing your search query."
                        : "You currently have no raised grievances in this category."}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const code = r.code || r.id;
                  const isBreached = isOverdue(r);
                  const isSubmitted = r.status === "Submitted";
                  const deadline = isSubmitted ? (r.ackDue || r.ack_due) : (r.resolveDue || r.resolve_due);

                  return (
                    <tr
                      key={r.id || code}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => handleOpenDetail(r.id || code)}
                    >
                      <td className="p-3.5 font-mono text-xs font-semibold text-primary">
                        {code}
                      </td>
                      <td className="p-3.5 text-xs font-medium">{r.category}</td>
                      <td className="p-3.5 max-w-[240px] truncate font-medium text-foreground">
                        {r.subject}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="outline" className={cn("text-[11px] font-medium", severityTone(r.severity))}>
                          {r.severity}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {r.raisedOn || r.raised_on}
                      </td>
                      <td className="p-3.5 text-xs">
                        <div className="font-medium">{r.committee}</div>
                        <div className="text-muted-foreground text-[11px]">{r.owner || r.owner_name}</div>
                      </td>
                      <td className="p-3.5 text-xs whitespace-nowrap">
                        <div className={cn("font-medium", isBreached && "text-destructive font-semibold flex items-center gap-1")}>
                          {isBreached && <AlertTriangle className="h-3 w-3 shrink-0" />}
                          {deadline || "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {isSubmitted ? "Ack due" : "Resolve due"}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <Badge variant="outline" className={cn("text-[11px] font-semibold", grievanceTone(r.status))}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-primary group-hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(r.id || code);
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

      {/* 4. Raise Grievance Modal */}
      <Dialog open={isRaiseOpen} onOpenChange={setIsRaiseOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageSquareWarning className="h-5 w-5 text-primary" /> Raise a Workplace Grievance
            </DialogTitle>
            <DialogDescription>
              Submit your concern confidentially. It will be routed according to company policy with an acknowledgment SLA.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRaiseSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRIEVANCE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Severity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Severity *</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Low", "Medium", "High", "Critical"].map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Against */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Against (Person, Manager, or Team)</Label>
              <Input
                value={against}
                maxLength={120}
                onChange={(e) => setAgainst(e.target.value)}
                placeholder="Optional (e.g. Reporting Manager, Facilities vendor)"
                className="h-9 text-xs"
              />
            </div>

            {/* SLA Routing Advisory */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary" /> Routing & SLA Matrix
              </div>
              <p className="text-muted-foreground">
                Assigned to <b className="text-foreground">{selectedRouting.committee}</b> · Acknowledgment within{" "}
                <b className="text-foreground">{selectedRouting.ackDays} working day(s)</b> · Resolution within{" "}
                <b className="text-foreground">{selectedRouting.resolveDays} days</b>.
              </p>
              {category === "Harassment (POSH)" && (
                <p className="text-amber-500 font-medium pt-1">
                  🛡️ POSH cases strictly route to the Internal Committee (POSH) and are never disclosed to your reporting manager or department head.
                </p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subject *</Label>
              <Input
                value={subject}
                maxLength={150}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue (max 150 characters)"
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Detailed Description *</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what occurred, dates, people present, impact, and desired outcome."
                className="text-xs leading-relaxed"
                required
              />
            </div>

            {/* Anonymous Toggle & File Upload */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <Switch id="anon-switch" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                <Label htmlFor="anon-switch" className="text-xs cursor-pointer">
                  <b>Keep my name confidential</b>
                  <div className="text-[11px] text-muted-foreground">
                    Your name will be masked as &quot;Anonymous&quot; from handlers.
                  </div>
                </Label>
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded-md border border-dashed border-border px-3 py-2 bg-background hover:bg-muted transition">
                <Paperclip className="h-3.5 w-3.5 text-primary" /> Attach Evidence
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  className="hidden"
                  onChange={(e) => {
                    captureFiles(e.target.files);
                    const newFiles = Array.from(e.target.files ?? []).map((f) => ({
                      name: f.name,
                      size: f.size,
                    }));
                    setAttachments([...attachments, ...newFiles]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {/* File Badges */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, i) => (
                  <Badge key={i} variant="outline" className="text-xs py-1 px-2.5 gap-1.5 bg-background">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    {file.name || file}
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsRaiseOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-emerald shadow-premium text-white font-medium"
                disabled={submittingRaise}
              >
                {submittingRaise ? "Submitting…" : <><Send className="h-4 w-4 mr-1.5" /> Submit Grievance</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Detail Sheet (Drawer) */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-6 space-y-6">
          {detailData && (
            <>
              <SheetHeader className="space-y-2 border-b border-border pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {detailData.code || detailData.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={severityTone(detailData.severity)}>
                      {detailData.severity}
                    </Badge>
                    <Badge variant="outline" className={grievanceTone(detailData.status)}>
                      {detailData.status}
                    </Badge>
                    {isOverdue(detailData) && (
                      <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">
                        SLA Breached
                      </Badge>
                    )}
                  </div>
                </div>
                <SheetTitle className="text-xl font-bold leading-tight">
                  {detailData.subject}
                </SheetTitle>
                <div className="text-xs text-muted-foreground">
                  Raised on {detailData.raisedOn || detailData.raised_on} · Handled by{" "}
                  <b className="text-foreground">{detailData.committee}</b>
                </div>
              </SheetHeader>

              {/* SLA Deadline Tracker */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border text-xs">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Ack SLA Due</div>
                  <div className="font-medium text-foreground mt-0.5">
                    {detailData.ackDue || detailData.ack_due || "—"}
                  </div>
                  {detailData.acknowledgedOn && (
                    <div className="text-emerald-500 text-[11px] mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Ack on {detailData.acknowledgedOn}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Resolution Due</div>
                  <div className="font-medium text-foreground mt-0.5">
                    {detailData.resolveDue || detailData.resolve_due || "—"}
                  </div>
                  {detailData.resolvedOn && (
                    <div className="text-emerald-500 text-[11px] mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Resolved on {detailData.resolvedOn}
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution Banner & Confirmation Card */}
              {detailData.status === "Resolved" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Gavel className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-emerald-950 dark:text-emerald-300">
                        Resolution Provided by Committee
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">
                        {detailData.resolution}
                      </p>
                      {detailData.actionTaken && (
                        <div className="text-xs text-muted-foreground pt-1">
                          <b>Action taken:</b> {detailData.actionTaken}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 7-day Confirmation Window Info */}
                  <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      ⏰ <b>{getDaysRemainingInAppealWindow(detailData.resolvedOn || detailData.resolved_on)} days remaining</b> in confirmation window
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-gradient-emerald text-white text-xs h-8"
                        onClick={() => setShowCloseDialog(true)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept &amp; Close Case
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setShowAppealDialog(true)}
                      >
                        Appeal to CHRO
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* If already closed */}
              {detailData.status === "Closed" && detailData.employeeRating && (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs space-y-1.5">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Case Closed with CSAT Rating
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          "h-3.5 w-3.5",
                          s <= detailData.employeeRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        )}
                      />
                    ))}
                    <span className="font-semibold ml-1">{detailData.employeeRating}/5</span>
                  </div>
                  {detailData.employeeFeedback && (
                    <div className="text-muted-foreground italic">&quot;{detailData.employeeFeedback}&quot;</div>
                  )}
                </div>
              )}

              {/* If Appealed */}
              {detailData.status === "Appealed" && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs space-y-1">
                  <div className="font-semibold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Under CHRO Appeal Review
                  </div>
                  <p className="text-muted-foreground">
                    <b>Reason for appeal:</b> {detailData.appealReason}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    Escalated to the Chief Human Resources Officer with a 15-day resolution SLA.
                  </p>
                </div>
              )}

              {/* Drawer Tabs Navigation */}
              <div className="flex border-b border-border text-xs font-medium">
                {[
                  { id: "overview", label: "Case Overview" },
                  { id: "investigation", label: "Investigation Progress" },
                  { id: "documents", label: "Documents" },
                  { id: "history", label: "Activity Timeline" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDetailTab(t.id)}
                    className={cn(
                      "py-2 px-3 border-b-2 -mb-px transition-colors",
                      detailTab === t.id
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Case Overview */}
              {detailTab === "overview" && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-lg border border-border">
                      <div className="text-muted-foreground text-[10px] uppercase font-semibold">Category</div>
                      <div className="font-medium text-foreground mt-0.5">{detailData.category}</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border">
                      <div className="text-muted-foreground text-[10px] uppercase font-semibold">Against</div>
                      <div className="font-medium text-foreground mt-0.5">{detailData.against || "None specified"}</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border">
                      <div className="text-muted-foreground text-[10px] uppercase font-semibold">Department &amp; Branch</div>
                      <div className="font-medium text-foreground mt-0.5">{detailData.dept || detailData.department || "—"}</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border">
                      <div className="text-muted-foreground text-[10px] uppercase font-semibold">Anonymity</div>
                      <div className="font-medium text-foreground mt-0.5">
                        {detailData.anonymous || detailData.is_anonymous ? "Confidential (Anonymous)" : "Disclosed"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/10">
                    <div className="font-semibold text-foreground">Complainant Description</div>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {detailData.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Investigation Progress (Employee Visible Notes Only) */}
              {detailTab === "investigation" && (
                <div className="space-y-3">
                  {detailData.investigation && detailData.investigation.filter((n) => n.visibleToEmployee !== false && n.visible_to_employee !== false).length > 0 ? (
                    detailData.investigation
                      .filter((n) => n.visibleToEmployee !== false && n.visible_to_employee !== false)
                      .map((note, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-border bg-muted/10 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                            <span className="font-semibold text-foreground">{note.by || note.action_by}</span>
                            <span>{note.at || note.action_at}</span>
                          </div>
                          <p className="text-foreground leading-relaxed pt-0.5">{note.note}</p>
                        </div>
                      ))
                  ) : (
                    <div className="text-center p-8 text-muted-foreground text-xs border border-dashed rounded-lg">
                      <Clock className="h-6 w-6 mx-auto mb-2 opacity-40 text-primary" />
                      Investigation notes and committee updates will be logged here as they occur.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Supporting Documents */}
              {detailTab === "documents" && (
                <div className="space-y-2">
                  {detailData.attachments && detailData.attachments.length > 0 ? (
                    detailData.attachments.map((file, idx) => {
                      const name = typeof file === "string" ? file : file.fileName || file.file_name || file.name || "Attachment";
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg border border-border text-xs hover:bg-muted/30 transition"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-medium">{name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            Attached
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center p-8 text-muted-foreground text-xs border border-dashed rounded-lg">
                      No documents were attached to this grievance.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Activity Timeline */}
              {detailTab === "history" && (
                <div className="space-y-3">
                  {detailData.history && detailData.history.length > 0 ? (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {detailData.history.map((h, i) => (
                        <div key={i} className="relative text-xs">
                          <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                          <div className="text-[11px] text-muted-foreground">
                            {h.at || h.action_at} · <b className="text-foreground">{h.by || h.action_by}</b>
                          </div>
                          <div className="text-foreground font-medium mt-0.5">{h.action}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 text-muted-foreground text-xs border border-dashed rounded-lg">
                      No history entries available.
                    </div>
                  )}
                </div>
              )}

              {/* Withdrawal action button */}
              {["Submitted", "Acknowledged"].includes(detailData.status) && (
                <div className="pt-4 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleWithdraw(detailData.id || detailData.code)}
                  >
                    Withdraw Grievance
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 6. Accept & Close CSAT Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Confirm Resolution &amp; Rate CSAT
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you satisfied with how this grievance was resolved? Your rating helps ensure quality redressal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5 text-center">
              <Label className="text-xs">Your Satisfaction Rating (1 to 5 Stars)</Label>
              <div className="flex justify-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRating(num)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        "h-7 w-7",
                        num <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30 hover:text-amber-400"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Feedback (Optional)</Label>
              <Textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share any comments on the resolution speed and support…"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={handleClose}
              disabled={submittingAction}
            >
              {submittingAction ? "Submitting…" : "Confirm & Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Appeal to CHRO Dialog */}
      <Dialog open={showAppealDialog} onOpenChange={setShowAppealDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-5 w-5" /> Appeal to CHRO
            </DialogTitle>
            <DialogDescription className="text-xs">
              If the committee resolution was unsatisfactory or unfulfilled, you can appeal directly to the company CHRO with a 15-day resolution SLA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Appeal *</Label>
              <Textarea
                rows={4}
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Explain why the resolution was inadequate and what correction is requested…"
                className="text-xs"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAppealDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleAppeal}
              disabled={submittingAction || !appealReason.trim()}
            >
              {submittingAction ? "Submitting Appeal…" : "Lodge Appeal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
