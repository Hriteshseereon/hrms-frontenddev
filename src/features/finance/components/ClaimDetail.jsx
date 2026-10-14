// Claim detail popup — what the employee submitted (purpose, period, bills line by line, attachments, payment
// preference, declaration) plus the approval pipeline. Shared by the org Claims screen (with approve / reject
// actions) and the employee portal (read-only).
import { useState } from "react";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import { Check, Receipt, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { KV } from "@/features/employees/components/CasePieces";
import { REIMBURSEMENT_STAGES, claimPayable } from "@/features/finance/data/claims-data";

export const claimBadge = (s) =>
  s === "Approved" || s === "Paid"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-gold/30 bg-gold/10 text-gold";

export const stageBadge = (stage, status) =>
  status === "Rejected"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : stage === "Settled"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-gold/30 bg-gold/10 text-gold";

export function ClaimStepper({ claim }) {
  const rejected = claim.status === "Rejected";
  const currentIdx =
    claim.currentStage === "Settled"
      ? REIMBURSEMENT_STAGES.length
      : REIMBURSEMENT_STAGES.indexOf(claim.currentStage);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {REIMBURSEMENT_STAGES.map((stage, idx) => {
        const done = idx < currentIdx || claim.currentStage === "Settled";
        const cur = idx === currentIdx;
        return (
          <div key={stage} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                rejected && cur
                  ? "border-destructive bg-destructive text-white"
                  : done
                    ? "border-primary bg-primary text-white"
                    : cur
                      ? "border-gold bg-gold text-gold"
                      : "border-border bg-muted text-muted-foreground",
              )}
            >
              <span>{idx + 1}</span>
              <span className="font-medium">{stage}</span>
            </div>
            {idx < REIMBURSEMENT_STAGES.length - 1 && (
              <div className={cn("h-px w-3", done ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ClaimDetailDialog({ claim, onClose, canAction, onApprove, onReject }) {
  const [remarks, setRemarks] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const items = claim.items ?? [];
  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  const overLimit = claim.policyLimit ? claim.amount > claim.policyLimit : false;
  const attachments = claim.attachments ?? (claim.document ? [claim.document] : []);
  const actionable = canAction && claim.currentStage !== "Settled" && claim.status !== "Rejected";
  const isAccounts = claim.currentStage === "Accounts";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="text-primary h-4 w-4" /> {claim.name}
          </DialogTitle>
          <DialogDescription>
            {claim.id} · {claim.employee} ({claim.empId})
            {claim.department ? ` · ${claim.department}` : ""}
            {claim.designation ? ` · ${claim.designation}` : ""}
            {claim.branch ? ` · ${claim.branch}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {[
            ["Claimed", inr(claim.amount)],
            ["Advance adjusted", claim.advanceAdjusted ? `− ${inr(claim.advanceAdjusted)}` : "—"],
            ["Net payable", inr(claimPayable(claim))],
            ["Policy limit", claim.policyLimit ? inr(claim.policyLimit) : "—"],
          ].map(([k, v]) => (
            <div
              key={k}
              className={cn(
                "border-border bg-muted/30 rounded-lg border p-3",
                k === "Policy limit" && overLimit && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
              <div
                className={cn(
                  "font-semibold tabular-nums",
                  k === "Policy limit" && overLimit && "text-destructive",
                )}
              >
                {v}
              </div>
              {k === "Policy limit" && overLimit && (
                <div className="text-destructive text-[10px]">
                  exceeds limit by {inr(claim.amount - (claim.policyLimit ?? 0))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={claimBadge(claim.status)}>
            {claim.status}
          </Badge>
          <Badge variant="outline" className={stageBadge(claim.currentStage, claim.status)}>
            Stage: {claim.currentStage}
          </Badge>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {claim.category}
          </Badge>
          <Badge variant="outline">{claim.type}</Badge>
          <div className="ml-auto">
            <ClaimStepper claim={claim} />
          </div>
        </div>

        <div className="border-border space-y-3 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Submitted by the employee
          </div>
          <KV
            items={[
              ["Purpose", claim.purpose ?? claim.description],
              ["Description", claim.description],
              ["Expense date", claim.date],
              [
                "Expense period",
                claim.periodFrom
                  ? `${claim.periodFrom} → ${claim.periodTo ?? claim.periodFrom}`
                  : "—",
              ],
              [
                "Project / client",
                [claim.project, claim.client].filter(Boolean).join(" · ") || "—",
              ],
              ["Cost centre", claim.costCentre ?? "—"],
              ["Payment preference", claim.paymentMode ?? "With salary (payroll)"],
              ["Pay to", claim.bankAccount ?? "Salary account on record"],
              ["Advance reference", claim.advanceRef ?? "—"],
              ["Submitted on", claim.submittedOn ?? claim.trail[0]?.at ?? claim.date],
              [
                "Declaration",
                claim.declaration
                  ? "Employee declared bills are genuine, not claimed elsewhere"
                  : "—",
              ],
            ]}
          />
        </div>

        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-muted/30 text-muted-foreground flex items-center justify-between border-b px-4 py-2 text-xs font-semibold tracking-wider uppercase">
            <span>Bills ({items.length})</span>
            <span className="tabular-nums">Total {inr(itemsTotal || claim.amount)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-muted-foreground text-[11px] tracking-wider uppercase">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Vendor</th>
                <th className="p-2 text-left">Bill no.</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Paid via</th>
                <th className="p-2 text-left">Attachment</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {items.map((i, k) => (
                <tr key={k}>
                  <td className="text-muted-foreground p-2 whitespace-nowrap">
                    <span className="whitespace-nowrap">{i.date}</span>
                  </td>
                  <td className="p-2 font-medium">{i.vendor}</td>
                  <td className="p-2 font-mono text-xs">{i.billNo || "—"}</td>
                  <td className="p-2">{i.description}</td>
                  <td className="text-muted-foreground p-2 text-xs">{i.paidVia}</td>
                  <td className="p-2 text-xs">
                    {i.attachment ? (
                      <AttachmentChips
                        names={[i.attachment]}
                        context={`Bill ${i.billNo || ""} · ${i.vendor || ""}`}
                        size="xs"
                      />
                    ) : (
                      <span className="text-destructive">missing</span>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums">{inr(i.amount)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-4 text-center text-xs">
                    No itemised bills — single document {claim.document || "not attached"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Attachments
          </div>
          <div className="flex flex-wrap gap-2">
            <AttachmentChips names={attachments} context={`Claim ${claim.id}`} />
            {attachments.length === 0 && (
              <span className="text-muted-foreground text-xs">None attached.</span>
            )}
          </div>
        </div>

        <div className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Approval trail
          </div>
          <ul className="space-y-1.5 text-sm">
            {claim.trail.map((t, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2">
                <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">
                  {t.at}
                </span>
                <span className="font-medium">
                  {t.stage} — {t.action}
                </span>
                <span className="text-muted-foreground text-xs">by {t.actor}</span>
                {t.remarks && <span className="text-xs">“{t.remarks}”</span>}
              </li>
            ))}
          </ul>
        </div>

        {actionable && onApprove && onReject && (
          <div className="border-primary/30 bg-primary/5 space-y-3 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Your action · {claim.currentStage} stage
            </div>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                rejecting
                  ? "Reason for rejection (the employee sees this)…"
                  : "Remarks (optional) — e.g. verified against bills / within policy…"
              }
            />
            <div className="flex flex-wrap justify-end gap-2">
              {!rejecting ? (
                <>
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive"
                    onClick={() => setRejecting(true)}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    className="bg-gradient-emerald text-white"
                    onClick={() => onApprove(remarks.trim())}
                  >
                    <Check className="h-4 w-4" /> {isAccounts ? "Process payment" : "Approve"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setRejecting(false)}>
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!remarks.trim()}
                    onClick={() => onReject(remarks.trim())}
                  >
                    <X className="h-4 w-4" /> Confirm rejection
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
