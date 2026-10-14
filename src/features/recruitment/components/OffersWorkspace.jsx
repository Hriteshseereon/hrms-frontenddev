import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useState } from "react";
import {
  FileSignature,
  Send,
  Mail,
  ShieldCheck,
  ExternalLink,
  UserPlus,
  Plus,
  CheckCircle2,
  XCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { inr } from "@/lib/store";
import { allUsers, useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useCandidates } from "@/features/recruitment/data/recruitment-store";
import { OFFICES } from "@/features/employees/data/hr-data";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import {
  createOfferForApplicant,
  markApplicantOnboarding,
  useOrgScopeFilter,
} from "@/features/recruitment/data/recruitment-engine";
import { syncReferralOnHire } from "@/features/employees/data/people-cases";
import {
  OFFER_STEPS,
  REQUIRED_DOCS,
  markJoined,
  offerStep,
  offerTone,
  offerUrl,
  reviewDoc,
  sendOffer,
  sendWelcome,
  useOffers,
  verifyOffer,
} from "@/features/recruitment/data/onboarding-data";
import {
  useDocTemplates,
  templatesOf,
  renderTemplate,
} from "@/features/organization/data/doc-master";
import { computeSalaryBreakup, useSalaryStructures } from "@/features/payroll/data/salary-engine";

export function OffersWorkspace() {
  const me = useCurrentUser();
  // Offers of the entity in view only (every entity's offers, documents and temporary passwords were visible).
  const inScope = useOrgScopeFilter();
  const offers = useOffers().filter((o) => inScope(o.orgId));
  const candidates = useCandidates();
  const templates = useDocTemplates().filter((t) => t.docType === "Offer Letter" && t.active);
  const structures = useSalaryStructures();
  const [sel, setSel] = useState(offers[0]?.id ?? "");
  const o = offers.find((x) => x.id === sel) ?? offers[0];
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    candidateId: "",
    position: "",
    department: "SAP Delivery",
    grade: "G3",
    branch: OFFICES[0],
    ctc: "",
    joiningDate: "",
    expiryDate: "",
    templateId: templates[0]?.id ?? "TPL-OFFER-STD",
  });
  const orgId = useActiveOrgId();
  // Reporting managers of the entity the hire joins (the list used to span every entity and defaulted to a head-office manager).
  const managers = allUsers().filter(
    (u) =>
      u.orgId === orgId && !["Employee", "Admin", "SuperAdmin", "BranchAdmin"].includes(u.role),
  );
  const [managerId, setManagerId] = useState("");
  const [note, setNote] = useState("");
  const act = (r) => {
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok && r.id) {
      setSel(r.id);
      setOpen(false);
    }
  };
  const cand = candidates.find((c) => c.id === f.candidateId);
  const previewBreakup = f.ctc ? computeSalaryBreakup(Number(f.ctc), f.grade, structures) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileSignature className="text-primary h-5 w-5" /> Step 4 · Offer letter → documents
            verified → welcome e-mail
          </h2>
          <p className="text-muted-foreground text-sm">
            Offer → e-mail with candidate link → accept &amp; upload documents → HR verification →
            welcome e-mail with credentials → joined.
          </p>
        </div>
        <Button
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" /> Create Offer
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="border-border border-b p-4 text-sm font-semibold">
              Offers ({offers.length})
            </div>
            <div className="divide-border max-h-[640px] divide-y overflow-y-auto">
              {offers.map((x) => (
                <button
                  key={x.id}
                  onClick={() => setSel(x.id)}
                  className={cn(
                    "hover:bg-muted/30 w-full p-4 text-left",
                    o?.id === x.id && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{x.candidate}</div>
                    <Badge variant="outline" className={offerTone(x.status)}>
                      {x.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {x.id} · {x.position} · {inr(x.ctc)} · joins{" "}
                    <span className="whitespace-nowrap">{x.joiningDate}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {o ? (
          <div className="space-y-4 lg:col-span-2">
            <WorkflowStepper
              steps={OFFER_STEPS}
              active={offerStep(o.status)}
              failed={o.status === "Declined" || o.status === "Expired"}
              title={`${o.id} · ${o.candidate}`}
              badge={
                <Badge variant="outline" className={offerTone(o.status)}>
                  {o.status}
                </Badge>
              }
            />
            <Card className="shadow-card">
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
                  {[
                    ["Position", o.position],
                    ["Department", `${o.department} · ${o.grade}`],
                    ["Branch", o.branch],
                    ["CTC", inr(o.ctc)],
                    ["Joining", o.joiningDate],
                    ["Offer expiry", o.expiryDate],
                    ["Template", o.templateId],
                    ["Contact", `${o.email} · ${o.phone}`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                        {k}
                      </div>
                      <div className="font-medium">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
                  <ExternalLink className="text-primary h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-mono">{offerUrl(o)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Copy candidate link"
                    className="h-9 w-9 sm:h-7 sm:w-auto"
                    onClick={() => {
                      navigator.clipboard?.writeText(offerUrl(o));
                      toast.success("Link copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Link
                    href={buildHref({
                      to: "/candidate/$token",
                      params: { token: o.token },
                      search: { preview: "1" },
                    })}
                    className="text-primary ml-auto hover:underline"
                  >
                    Open candidate page (preview)
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LetterButtons o={o} />
                  {["Draft", "Sent", "Viewed"].includes(o.status) && (
                    <Button
                      size="sm"
                      className="bg-gradient-emerald text-white"
                      onClick={() => act(sendOffer(o.id, me))}
                    >
                      <Send className="h-4 w-4" />{" "}
                      {o.status === "Draft" ? "Send offer e-mail" : "Send reminder"}
                    </Button>
                  )}
                  {o.status === "Docs Submitted" && (
                    <Button
                      size="sm"
                      className="bg-gradient-emerald text-white"
                      onClick={() => act(verifyOffer(o.id, me))}
                    >
                      <ShieldCheck className="h-4 w-4" /> Mark all verified
                    </Button>
                  )}
                  {o.status === "Verified" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={managerId} onValueChange={setManagerId}>
                        <SelectTrigger className="h-9 w-full sm:w-[240px]">
                          <SelectValue placeholder="Reporting manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} — {u.designation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="bg-gradient-emerald text-white"
                        disabled={!managerId}
                        title={!managerId ? "Pick the reporting manager first" : ""}
                        onClick={() => {
                          const r = sendWelcome(
                            o.id,
                            me,
                            managerId,
                            "Employee",
                            "Full-time",
                            o.orgId ?? orgId,
                          );
                          act(r);
                          if (r.ok) {
                            markApplicantOnboarding(o.candidateId, me.name);
                            syncReferralOnHire(o.candidateId, me);
                            setManagerId("");
                          }
                        }}
                      >
                        <UserPlus className="h-4 w-4" /> Send welcome e-mail &amp; create login
                      </Button>
                    </div>
                  )}
                  {o.status === "Welcome Sent" && (
                    <Button
                      size="sm"
                      className="bg-gradient-emerald text-white"
                      onClick={() => {
                        const r = markJoined(o.id, me);
                        act(r);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark joined
                    </Button>
                  )}
                </div>
                {o.employeeId && (
                  <div className="border-primary/20 bg-primary/5 rounded-lg border p-3 text-xs">
                    Employee <b>{o.employeeId}</b> provisioned · login <b>{o.workEmail}</b> ·
                    temporary password <b>{o.tempPassword}</b> · appears in Employees, payroll
                    roster and can sign in on the employee portal.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <div className="mb-2 text-sm font-semibold">
                    Documents ({o.docs.length}/{REQUIRED_DOCS.length})
                  </div>
                  <div className="space-y-1.5">
                    {REQUIRED_DOCS.map((d) => {
                      const u = o.docs.find((x) => x.key === d.key);
                      return (
                        <div
                          key={d.key}
                          className="border-border flex items-center gap-2 rounded-lg border p-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">
                              {d.label}
                              {d.mandatory && <span className="text-destructive"> *</span>}
                            </div>
                            <div className="text-muted-foreground truncate">
                              {u
                                ? `${u.fileName} · ${Math.round(u.size / 1024)} KB`
                                : "not uploaded"}
                              {u?.note ? ` — ${u.note}` : ""}
                            </div>
                          </div>
                          {u && (
                            <Badge
                              variant="outline"
                              className={
                                u.status === "Verified"
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : u.status === "Rejected"
                                    ? "border-destructive/30 text-destructive"
                                    : ""
                              }
                            >
                              {u.status}
                            </Badge>
                          )}
                          {u && o.status === "Docs Submitted" && u.status !== "Verified" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0 sm:h-7 sm:w-7"
                                onClick={() => act(reviewDoc(o.id, d.key, "Verified", "", me))}
                              >
                                <CheckCircle2 className="text-primary h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0 sm:h-7 sm:w-7"
                                onClick={() => {
                                  const r = window.prompt("Reason for rejection");
                                  if (r) act(reviewDoc(o.id, d.key, "Rejected", r, me));
                                }}
                              >
                                <XCircle className="text-destructive h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Mail className="text-primary h-4 w-4" /> E-mails sent ({o.emails.length})
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {o.emails.map((e, i) => (
                      <div key={i} className="border-border rounded-lg border p-2 text-xs">
                        <div className="font-medium">{e.subject}</div>
                        <div className="text-muted-foreground">
                          {e.kind} · to {e.to} ·{" "}
                          {new Date(e.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </div>
                        <pre className="text-muted-foreground mt-1 line-clamp-4 font-sans text-[11px] whitespace-pre-wrap">
                          {e.body}
                        </pre>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 mb-1 text-sm font-semibold">History</div>
                  <div className="space-y-1 text-xs">
                    {[...o.history].reverse().map((h, i) => (
                      <div key={i} className="border-border border-l-2 pl-2">
                        {h.action}{" "}
                        <span className="text-muted-foreground">
                          — {h.by} ·{" "}
                          {new Date(h.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="shadow-card lg:col-span-2">
            <CardContent className="text-muted-foreground p-10 text-center">
              Create an offer for a shortlisted candidate.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create offer</DialogTitle>
            <DialogDescription>
              The annexure is computed from the CTC by the salary engine (grade structure). The
              candidate accepts and uploads documents on the link e-mailed to them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">
                Candidate (pipeline: Assessment / Offer)
              </Label>
              <Select
                value={f.candidateId}
                onValueChange={(v) => {
                  const c = candidates.find((x) => x.id === v);
                  setF({ ...f, candidateId: v, position: c?.position ?? f.position });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates
                    .filter((c) => c.stage === "Finalised" || c.stage === "Interviewing")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.position} ({c.stage})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Position</Label>
              <Input
                value={f.position}
                onChange={(e) => setF({ ...f, position: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Department</Label>
              <Input
                value={f.department}
                onChange={(e) => setF({ ...f, department: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Grade (drives salary structure)
              </Label>
              <Select value={f.grade} onValueChange={(v) => setF({ ...f, grade: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((s) => (
                    <SelectItem key={s.grade} value={s.grade}>
                      {s.grade} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Branch</Label>
              <Select value={f.branch} onValueChange={(v) => setF({ ...f, branch: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Annual CTC (₹)</Label>
              <Input
                type="number"
                value={f.ctc}
                onChange={(e) => setF({ ...f, ctc: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Offer template</Label>
              <Select value={f.templateId} onValueChange={(v) => setF({ ...f, templateId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Offer expiry</Label>
              <Input
                type="date"
                value={f.expiryDate}
                onChange={(e) => setF({ ...f, expiryDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Joining date</Label>
              <Input
                type="date"
                value={f.joiningDate}
                onChange={(e) => setF({ ...f, joiningDate: e.target.value })}
              />
            </div>
            {previewBreakup && (
              <div className="border-border bg-muted/20 rounded-lg border p-3 text-xs sm:col-span-2">
                <div className="mb-1 font-semibold">
                  Annexure preview (monthly, from salary engine)
                </div>
                <div className="grid grid-cols-2 gap-x-6">
                  {previewBreakup.earnings.map((e) => (
                    <div key={e.label} className="flex justify-between">
                      <span className="text-muted-foreground">{e.label}</span>
                      <span>{inr(e.monthly)}</span>
                    </div>
                  ))}
                  <div className="border-border col-span-2 mt-1 flex justify-between border-t pt-1 font-semibold">
                    <span>Monthly gross</span>
                    <span>{inr(previewBreakup.monthlyGross)}</span>
                  </div>
                  <div className="col-span-2 flex justify-between">
                    <span className="text-muted-foreground">
                      Employer statutory (PF/ESI/gratuity)
                    </span>
                    <span>
                      {inr(previewBreakup.employerCostMonthly - previewBreakup.monthlyGross)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">Internal note</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Negotiation notes, approvals…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!cand || !(Number(f.ctc) > 0) || !f.joiningDate || !f.expiryDate}
              onClick={() =>
                act(
                  createOfferForApplicant(
                    cand.id,
                    {
                      position: f.position,
                      department: f.department,
                      grade: f.grade,
                      branch: f.branch,
                      ctc: Number(f.ctc),
                      joiningDate: f.joiningDate,
                      expiryDate: f.expiryDate,
                      templateId: f.templateId,
                      internalNote: note.trim() || undefined,
                    },
                    me,
                    false,
                  ),
                )
              }
            >
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Item 15 — Offer / LoI / Appointment letter with salary annexure generated from Doc Master templates + salary engine. */
function LetterButtons({ o }) {
  const bk = computeSalaryBreakup(o.ctc, o.grade);
  const values = {
    candidate: o.candidate,
    employee: o.candidate,
    employee_name: o.candidate,
    position: o.position,
    designation: o.position,
    department: o.department,
    branch: o.branch,
    grade: o.grade,
    ctc: inr(o.ctc),
    monthly_gross: inr(
      o.customComponents ? o.customComponents.reduce((t, c) => t + c.monthly, 0) : bk.monthlyGross,
    ),
    joining_date: o.joiningDate,
    joiningDate: o.joiningDate,
    expiry_date: o.expiryDate,
    date: new Date().toLocaleDateString("en-IN"),
    reference: o.id,
  };
  // The split the candidate saw and signed (HR-edited components) wins over the grade structure.
  const earnings = o.customComponents
    ? o.customComponents.map((c) => ({
        label: c.label,
        monthly: c.monthly,
        annual: c.monthly * 12,
      }))
    : bk.earnings;
  const gross = earnings.reduce((t, e) => t + e.monthly, 0);
  const table = {
    columns: ["Component", "Monthly (₹)", "Annual (₹)"],
    rows: [
      ...earnings.map((e) => [e.label, inr(e.monthly), inr(e.annual)]),
      ["Gross", inr(gross), inr(gross * 12)],
      ...bk.exclusions.map((e) => [`${e.label} (employer)`, inr(e.monthly), inr(e.annual)]),
      ["Cost to company", inr(Math.round(o.ctc / 12)), inr(o.ctc)],
    ],
  };
  const gen = (type) => {
    const t = templatesOf(type)[0];
    if (!t) return toast.error(`No ${type} template in Doc Master`);
    // The offer letter is the HR-edited body the candidate received, when there is one.
    renderTemplate(
      type === "Offer Letter" && o.letterBody ? { ...t, body: o.letterBody } : t,
      values,
      table,
    );
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => gen("Offer Letter")}>
        Offer letter + annexure
      </Button>
      <Button size="sm" variant="outline" onClick={() => gen("Letter of Intent")}>
        LoI
      </Button>
      {["Verified", "Welcome Sent", "Joined"].includes(o.status) && (
        <Button size="sm" variant="outline" onClick={() => gen("Appointment Letter")}>
          Appointment letter
        </Button>
      )}
    </>
  );
}
