import { useParams, useSearchParams } from "@/lib/router";
import { captureFiles } from "@/lib/attachments";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSignature, Upload, ShieldCheck, Clock3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import {
  REQUIRED_DOCS,
  candidateDecide,
  candidateSubmitDocs,
  candidateUpload,
  candidateView,
  useOffers,
} from "@/features/recruitment/data/onboarding-data";
import { computeSalaryBreakup } from "@/features/payroll/data/salary-engine";

/** Public page reached from the e-mailed link — no HRMS login. */

function CandidatePortal() {
  const { token } = useParams();
  // HR's "Open candidate page (preview)" must not record a candidate view or let HR act for the candidate.
  const preview = useSearchParams().get("preview") === "1";
  const o = useOffers().find((x) => x.token === token);
  const [sig, setSig] = useState("");
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const fileKey = useRef("");
  const fileRef = useRef(null);
  // The offer store is browser-persisted: the server (and the hydration pass) only know the seeded offers, so every
  // newly issued link first rendered "This link is not valid". Wait for the client store before deciding.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    if (!preview) candidateView(token);
  }, [token, preview]);
  const act = (r) =>
    preview
      ? toast.info("Preview only — the candidate takes these actions from their own link.")
      : toast[r.ok ? "success" : "error"](r.message);

  return (
    <div className="bg-muted/30 min-h-dvh">
      <header className="bg-gradient-emerald text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <BrandLogo variant="dark" />
          <span className="text-xs text-white/70">Candidate portal · secure link</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {!ready ? (
          <Card className="shadow-card">
            <CardContent className="text-muted-foreground p-10 text-center text-sm">
              Loading your offer…
            </CardContent>
          </Card>
        ) : !o ? (
          <Card className="shadow-card">
            <CardContent className="p-10 text-center">
              <XCircle className="text-destructive mx-auto h-10 w-10" />
              <div className="mt-3 font-semibold">This link is not valid</div>
              <div className="text-muted-foreground text-sm">
                It may have expired or been replaced. Please contact hr@seereon.co.in.
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1">
                    <div className="text-muted-foreground text-xs tracking-wider uppercase">
                      Offer of employment
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      Welcome, {o.candidate.split(" ")[0]}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Seereon Consulting &amp; IT Services Pvt. Ltd. is pleased to offer you the
                      position of <b className="text-foreground">{o.position}</b> in {o.department},{" "}
                      {o.branch}.
                    </p>
                    {o.letterBody && (
                      <details className="mt-2 text-sm">
                        <summary className="text-primary cursor-pointer">
                          Read the full offer letter
                        </summary>
                        <pre className="bg-muted/40 mt-2 rounded-lg p-3 font-sans text-xs whitespace-pre-wrap">
                          {o.letterBody}
                        </pre>
                      </details>
                    )}
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {o.status === "Viewed" || o.status === "Sent"
                      ? "Awaiting your acceptance"
                      : o.status}
                  </Badge>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {[
                    ["Annual CTC", inr(o.ctc)],
                    [
                      "Monthly gross",
                      inr(
                        o.customComponents
                          ? o.customComponents.reduce((t, e) => t + e.monthly, 0)
                          : computeSalaryBreakup(o.ctc, o.grade).monthlyGross,
                      ),
                    ],
                    ["Joining date", o.joiningDate],
                    ["Offer valid till", o.expiryDate],
                  ].map(([k, v]) => (
                    <div key={k} className="border-border bg-muted/30 rounded-xl border p-3">
                      <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                        {k}
                      </div>
                      <div className="font-bold">{v}</div>
                    </div>
                  ))}
                </div>
                <details className="border-border mt-4 rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    Salary annexure (monthly)
                  </summary>
                  <table className="mt-2 w-full text-xs">
                    <tbody>
                      {(o.customComponents ?? computeSalaryBreakup(o.ctc, o.grade).earnings).map(
                        (e) => (
                          <tr key={e.label}>
                            <td className="text-muted-foreground py-1">{e.label}</td>
                            <td className="py-1 text-right">{inr(e.monthly)}</td>
                          </tr>
                        ),
                      )}
                      <tr className="border-border border-t font-semibold">
                        <td className="py-1">Gross</td>
                        <td className="py-1 text-right">
                          {inr(
                            o.customComponents
                              ? o.customComponents.reduce((t, e) => t + e.monthly, 0)
                              : computeSalaryBreakup(o.ctc, o.grade).monthlyGross,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </details>
              </CardContent>
            </Card>

            {/* Step 1 — accept */}
            <Card
              className={cn(
                "shadow-card",
                ["Accepted", "Docs Submitted", "Verified", "Welcome Sent", "Joined"].includes(
                  o.status,
                ) && "border-primary/30",
              )}
            >
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  <FileSignature className="text-primary h-4 w-4 shrink-0" /> 1 · Accept the offer{" "}
                  {o.acceptedAt && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary sm:ml-2"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Accepted on {o.acceptedAt.slice(0, 10)} · e-signed {o.signature}
                    </Badge>
                  )}
                </div>
                {["Sent", "Viewed"].includes(o.status) && (
                  <div className="mt-4 space-y-3">
                    <p className="text-muted-foreground text-sm">
                      By typing your full name you electronically sign and accept the terms of the
                      offer letter and annexure, the six-month probation and the Employee Handbook.
                    </p>
                    {!declining ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[240px] flex-1 space-y-1">
                          <Label className="text-xs">Type your full name to e-sign</Label>
                          <Input
                            value={sig}
                            onChange={(e) => setSig(e.target.value)}
                            placeholder={o.candidate}
                          />
                        </div>
                        <Button
                          className="bg-gradient-emerald text-white"
                          disabled={!sig.trim()}
                          onClick={() => act(candidateDecide(token, true, sig))}
                        >
                          Accept offer
                        </Button>
                        <Button variant="outline" onClick={() => setDeclining(true)}>
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason for declining (helps us improve)"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-destructive/40 text-destructive"
                            disabled={!reason.trim()}
                            onClick={() => act(candidateDecide(token, false, "", reason))}
                          >
                            Confirm decline
                          </Button>
                          <Button variant="ghost" onClick={() => setDeclining(false)}>
                            Back
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {o.status === "Declined" && (
                  <p className="text-muted-foreground mt-3 text-sm">
                    You declined this offer. Thank you for your time.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Step 2 — documents */}
            {["Accepted", "Docs Submitted", "Verified", "Welcome Sent", "Joined"].includes(
              o.status,
            ) && (
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 font-semibold">
                    <Upload className="text-primary h-4 w-4" />
                    <span className="min-w-0">
                      {" "}
                      2 · Upload your documents{" "}
                      <span className="text-muted-foreground text-xs font-normal">
                        (PDF / JPG, ≤ 5 MB each)
                      </span>
                    </span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      captureFiles(e.target.files);
                      const f = e.target.files?.[0];
                      if (f && fileKey.current)
                        act(
                          candidateUpload(token, fileKey.current, { name: f.name, size: f.size }),
                        );
                      e.target.value = "";
                    }}
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {REQUIRED_DOCS.map((d) => {
                      const u = o.docs.find((x) => x.key === d.key);
                      return (
                        <div
                          key={d.key}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border p-2.5 text-sm",
                            u?.status === "Verified"
                              ? "border-primary/30 bg-primary/5"
                              : u?.status === "Rejected"
                                ? "border-destructive/30 bg-destructive/5"
                                : "border-border",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">
                              {d.label}
                              {d.mandatory && <span className="text-destructive"> *</span>}
                            </div>
                            <div className="text-muted-foreground truncate text-xs">
                              {u
                                ? `${u.fileName} · ${u.status}${u.note ? ` — ${u.note}` : ""}`
                                : "Not uploaded"}
                            </div>
                          </div>
                          {o.status !== "Verified" &&
                            o.status !== "Welcome Sent" &&
                            o.status !== "Joined" &&
                            u?.status !== "Verified" && (
                              <Button
                                size="sm"
                                variant={u ? "ghost" : "outline"}
                                className="h-7"
                                onClick={() => {
                                  fileKey.current = d.key;
                                  fileRef.current?.click();
                                }}
                              >
                                {u ? "Replace" : "Upload"}
                              </Button>
                            )}
                          {u?.status === "Verified" && (
                            <CheckCircle2 className="text-primary h-4 w-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {o.status === "Accepted" && (
                    <Button
                      className="bg-gradient-emerald mt-4 text-white"
                      onClick={() => act(candidateSubmitDocs(token))}
                    >
                      Submit documents for verification
                    </Button>
                  )}
                  {o.status === "Docs Submitted" && (
                    <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
                      <Clock3 className="h-4 w-4" /> Documents submitted — HR is verifying them. You
                      will receive a welcome e-mail with your login once done.
                    </div>
                  )}
                  {(o.status === "Verified" ||
                    o.status === "Welcome Sent" ||
                    o.status === "Joined") && (
                    <div className="text-primary mt-4 flex items-center gap-2 text-sm">
                      <ShieldCheck className="h-4 w-4" /> All documents verified
                      {o.welcomeSentAt
                        ? ` · welcome e-mail sent to ${o.email} with your HRMS login ${o.workEmail}`
                        : " · your welcome e-mail is on its way"}
                      .
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <p className="text-muted-foreground text-center text-xs">
              Questions? Write to hr@seereon.co.in · This page is personal to you; do not share the
              link.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

export default CandidatePortal;
