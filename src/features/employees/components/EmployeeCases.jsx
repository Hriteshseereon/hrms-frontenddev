// Everything on record for one employee: promotions, transfers, warnings (with acknowledgement), terminations,
// referrals, insurance and retirement — one panel shared by the HR employee record and the employee portal.
import { useState } from "react";
import {
  TrendingUp,
  ArrowRightLeft,
  AlertTriangle,
  UserX,
  UserPlus,
  ShieldPlus,
  FileDown,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/features/employees/components/CasePieces";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  useCasesForEmployee,
  renderPromotionLetter,
  renderTransferLetter,
  renderWarningLetter,
  renderTerminationLetter,
  acknowledgeWarning,
} from "@/features/employees/data/people-cases";
import { insuranceStore } from "@/features/finance/data/claims-data";
import { useRetirements } from "@/features/exit/data/hr-policy";
import { useExitRequests, myExitHistory, fmtDate, stageTone } from "@/features/exit/data/exit-data";

const inr = (n) => Math.round(n).toLocaleString("en-IN");

function Group({ title, icon: Icon, count, children }) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="text-primary h-4 w-4" /> {title}{" "}
          <Badge variant="outline" className="ml-auto">
            {count}
          </Badge>
        </h3>
        {count === 0 ? <p className="text-muted-foreground text-sm">No records.</p> : children}
      </CardContent>
    </Card>
  );
}

export function EmployeeCases({ empId, mode }) {
  const me = useCurrentUser();
  const { promotions, transfers, terminations, warnings, referrals } = useCasesForEmployee(empId);
  const insurance = insuranceStore.use().filter((i) => i.empId === empId);
  const retirements = useRetirements().filter((r) => r.empId === empId);
  const resignations = myExitHistory(useExitRequests(), empId);
  const [ack, setAck] = useState({});
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Group title="Promotions & appraisal outcomes" icon={TrendingUp} count={promotions.length}>
        {promotions.map((c) => (
          <div key={c.id} className="border-border space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{c.id}</span>
              <StatusBadge status={c.status} />
              <span className="text-muted-foreground ml-auto text-xs">
                Effective {c.effectiveFrom}
              </span>
            </div>
            <div>
              <b>{c.fromDesignation}</b> → <b>{c.toDesignation}</b> · grade {c.fromGrade} →{" "}
              {c.toGrade} · CTC ₹{inr(c.fromCtc)} → ₹{inr(c.toCtc)} ({c.hikePct} %)
            </div>
            <div className="text-muted-foreground text-xs">
              {c.purpose}
              {c.appraisalRef ? ` · ${c.appraisalRef}` : ""} · {c.basis}
            </div>
            {c.status === "Effective" && c.letterMode !== "Attach signed letter" && (
              <Button size="sm" variant="outline" onClick={() => renderPromotionLetter(c)}>
                <FileDown className="h-4 w-4" /> {c.letterType} {c.letterRef}
              </Button>
            )}
            {c.status === "Effective" && c.letterMode === "Attach signed letter" && (
              <Badge variant="outline">{c.letterFile}</Badge>
            )}
          </div>
        ))}
      </Group>
      <Group title="Transfers" icon={ArrowRightLeft} count={transfers.length}>
        {transfers.map((c) => (
          <div key={c.id} className="border-border space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{c.id}</span>
              <Badge variant="outline">{c.type}</Badge>
              <StatusBadge status={c.status} />
              <span className="text-muted-foreground ml-auto text-xs">
                Effective {c.effectiveFrom}
              </span>
            </div>
            <div>
              {c.fromDept}, {c.fromBranch} →{" "}
              <b>
                {c.toDept}, {c.toBranch}
              </b>
              {c.toManager ? ` · reports to ${c.toManager}` : ""}
              {c.newDesignation ? ` · ${c.newDesignation}` : ""}
            </div>
            <div className="text-muted-foreground text-xs">
              {c.reason}
              {c.relocationAllowance ? ` · relocation ₹${inr(c.relocationAllowance)}` : ""}
              {c.handoverTo ? ` · handover to ${c.handoverTo}` : ""}
            </div>
            {c.letterRef && (
              <Button size="sm" variant="outline" onClick={() => renderTransferLetter(c)}>
                <FileDown className="h-4 w-4" /> Transfer letter {c.letterRef}
              </Button>
            )}
          </div>
        ))}
      </Group>
      <Group title="Warnings" icon={AlertTriangle} count={warnings.length}>
        {warnings.map((c) => (
          <div key={c.id} className="border-border space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{c.id}</span>
              <Badge
                variant="outline"
                className={
                  c.severity === "Level 3 (final)" ? "border-destructive/40 text-destructive" : ""
                }
              >
                {c.severity}
              </Badge>
              <StatusBadge status={c.status} />
              <span className="text-muted-foreground ml-auto text-xs">
                Issued <span className="whitespace-nowrap">{c.issuedOn}</span> by {c.issuedBy}
              </span>
            </div>
            <div>
              <b>{c.type}</b> · {c.category} · incident{" "}
              <span className="whitespace-nowrap">{c.incidentDate}</span>
            </div>
            <div className="text-muted-foreground text-xs">{c.description}</div>
            {c.improvementPlan && (
              <div className="text-xs">
                <b>Improvement plan:</b> {c.improvementPlan} · review{" "}
                <span className="whitespace-nowrap">{c.reviewDate}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {c.letterRef && (
                <Button size="sm" variant="outline" onClick={() => renderWarningLetter(c)}>
                  <FileDown className="h-4 w-4" /> Letter {c.letterRef}
                </Button>
              )}
              {c.acknowledged ? (
                <span className="text-primary inline-flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged{" "}
                  <span className="whitespace-nowrap">{c.acknowledgedOn}</span>
                  {c.employeeComment ? ` — "${c.employeeComment}"` : ""}
                </span>
              ) : mode === "self" ? null : (
                <span className="text-destructive text-xs">Awaiting employee acknowledgement</span>
              )}
            </div>
            {mode === "self" && !c.acknowledged && c.status === "Effective" && (
              <div className="border-gold/40 bg-gold/5 space-y-2 rounded-lg border p-2">
                <Textarea
                  rows={2}
                  value={ack[c.id] ?? ""}
                  onChange={(e) => setAck({ ...ack, [c.id]: e.target.value })}
                  placeholder="Your comment (optional)"
                />
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={() => {
                    acknowledgeWarning(c.id, ack[c.id] ?? "", me);
                    toast.success("Acknowledgement recorded and shared with HR.");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Acknowledge receipt
                </Button>
              </div>
            )}
          </div>
        ))}
      </Group>
      <Group
        title="Resignation & exit"
        icon={UserX}
        count={resignations.length + terminations.length}
      >
        {resignations.map((r) => (
          <div key={r.id} className="border-border space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{r.id}</span>
              <Badge variant="outline" className={stageTone(r.stage)}>
                {r.stage}
              </Badge>
              <span className="text-muted-foreground ml-auto text-xs">
                Applied <span className="whitespace-nowrap">{fmtDate(r.appliedOn)}</span>
              </span>
            </div>
            <div>
              Resignation · requested last working day{" "}
              <span className="whitespace-nowrap">{fmtDate(r.requestedLwd)}</span>
              {r.noticeEnd ? ` · notice ends ${fmtDate(r.noticeEnd)}` : ""}
            </div>
            <div className="text-muted-foreground text-xs">{r.reason}</div>
          </div>
        ))}
        {terminations.map((c) => (
          <div key={c.id} className="border-destructive/30 space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{c.id}</span>
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {c.type}
              </Badge>
              <StatusBadge status={c.status} />
              <span className="text-muted-foreground ml-auto text-xs">LWD {c.lastWorkingDay}</span>
            </div>
            {mode === "hr" && (
              <div className="text-muted-foreground text-xs">
                {c.reason} · {c.noticeMode} · approvals{" "}
                {c.approvals.filter((a) => a.decision === "Approved").length}/3
              </div>
            )}
            {mode === "self" && c.status === "Effective" && (
              <div className="text-muted-foreground text-xs">
                Termination letter issued · complete exit formalities and asset return on this
                portal.
              </div>
            )}
            {c.letterRef && (
              <Button size="sm" variant="outline" onClick={() => renderTerminationLetter(c)}>
                <FileDown className="h-4 w-4" /> Letter {c.letterRef}
              </Button>
            )}
          </div>
        ))}
      </Group>
      <Group title="Referrals made" icon={UserPlus} count={referrals.length}>
        {referrals.map((r) => (
          <div key={r.id} className="border-border rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{r.id}</span>
              <StatusBadge status={r.status} />
              <span className="text-muted-foreground ml-auto text-xs">{r.createdOn}</span>
            </div>
            <div>
              <b>{r.candidate}</b> · {r.jobTitle}
              {r.bonusEligible
                ? ` · bonus ₹${inr(r.bonusAmount)}${r.bonusPaidOn ? ` paid ${r.bonusPaidOn}` : ""}`
                : ""}
            </div>
          </div>
        ))}
      </Group>
      <Group
        title="Insurance & retirement"
        icon={ShieldPlus}
        count={insurance.length + retirements.length}
      >
        {insurance.map((i) => (
          <div key={i.id} className="border-border rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{i.id}</span>
              <Badge variant="outline">{i.type}</Badge>
              <span className="text-muted-foreground ml-auto text-xs">
                {i.validFrom} → {i.validTo}
              </span>
            </div>
            <div>
              {i.insurer} · policy {i.policyNumber} · sum insured ₹{inr(i.amount)}
            </div>
            <div className="text-muted-foreground text-xs">
              Nominee {i.nominee} ({i.nomineeRelation}) · premium ₹{inr(i.premium)}
              {i.deduction ? ` · employee share ₹${inr(i.deduction)}/month` : ""}
            </div>
          </div>
        ))}
        {retirements.map((r) => (
          <div key={r.empId + r.retiredOn} className="border-border rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{r.reason}</Badge>
              <span className="text-muted-foreground ml-auto text-xs">
                Retired <span className="whitespace-nowrap">{r.retiredOn}</span>
              </span>
            </div>
            <div>
              {r.reEngaged
                ? `Re-engaged on contract for ${r.contractMonths} months from ${r.contractFrom} at ₹${inr(r.contractCtc ?? 0)}`
                : "Superannuation processed"}{" "}
              · {r.note}
            </div>
          </div>
        ))}
      </Group>
    </div>
  );
}
