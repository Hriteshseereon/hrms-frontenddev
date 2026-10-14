import { useState } from "react";
import { UserPlus, Plus, IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReferralForm } from "@/features/employees/components/ReferralsTab";
import { StatusBadge, HistoryTrail } from "@/features/employees/components/CasePieces";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { useReferrals } from "@/features/employees/data/people-cases";
import { useApplicants, useScopedJobPosts } from "@/features/recruitment/data/recruitment-engine";

function EmpReferrals() {
  const me = useCurrentEmployee();
  const mine = useReferrals().filter((r) => r.referrerId === me.id);
  const applicants = useApplicants();
  const jobs = useScopedJobPosts().filter((j) => (j.status ?? "Open") === "Open");
  const [open, setOpen] = useState(false);
  const paid = mine.filter((r) => r.status === "Bonus paid").reduce((s, r) => s + r.bonusAmount, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <UserPlus className="text-primary h-6 w-6" /> My Referrals
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Refer someone from your network for an open job post. Your referral enters Recruitment →
            Candidates applied and you can follow every stage here. Bonus is paid with payroll after
            the 90-day retention period.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" /> Refer a candidate
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Referrals made", mine.length],
          [
            "In pipeline",
            mine.filter((r) => ["Submitted", "Screening", "Interviewing"].includes(r.status))
              .length,
          ],
          ["Hired", mine.filter((r) => r.status === "Hired" || r.status === "Bonus paid").length],
          ["Bonus received (₹)", paid.toLocaleString("en-IN")],
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
        <CardContent className="p-4">
          <div className="mb-2 text-sm font-semibold">Open job posts you can refer for</div>
          <div className="flex flex-wrap gap-2">
            {jobs.map((j) => (
              <Badge key={j.id} variant="outline" className="font-normal">
                {j.title} · {j.location} · {j.id}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {mine.length === 0 && (
          <Card className="shadow-card lg:col-span-2">
            <CardContent className="text-muted-foreground p-8 text-center text-sm">
              No referrals yet — click “Refer a candidate”.
            </CardContent>
          </Card>
        )}
        {mine.map((r) => {
          const a = applicants.find((x) => x.id === r.applicantId);
          return (
            <Card key={r.id} className="shadow-card">
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{r.id}</span>
                  <StatusBadge status={r.status} />
                  <span className="text-muted-foreground ml-auto text-xs">{r.createdOn}</span>
                </div>
                <div className="font-semibold">
                  {r.candidate}{" "}
                  <span className="text-muted-foreground font-normal">· {r.jobTitle}</span>
                </div>
                <div className="text-muted-foreground text-xs">
                  {r.relationship} · {r.experienceYears} yrs · {r.skills}
                </div>
                {a && (
                  <div className="text-xs">
                    Recruitment stage: <Badge variant="outline">{a.stage}</Badge>
                    {a.currentRound ? (
                      <span className="text-muted-foreground"> · {a.currentRound}</span>
                    ) : null}
                    {a.interviews
                      .filter((i) => i.status === "Scheduled")
                      .map((i) => (
                        <div key={i.id} className="text-muted-foreground mt-1">
                          Interview {i.round} · {i.type} ·{" "}
                          <span className="whitespace-nowrap">{i.date}</span> {i.time} ({i.mode})
                        </div>
                      ))}
                  </div>
                )}
                {r.bonusEligible && (
                  <div className="inline-flex items-center gap-1 text-xs">
                    <IndianRupee className="h-3.5 w-3.5" /> Bonus ₹
                    {r.bonusAmount.toLocaleString("en-IN")}
                    {r.bonusPaidOn
                      ? ` · paid ${r.bonusPaidOn}`
                      : " · payable 90 days after joining"}
                  </div>
                )}
                <HistoryTrail history={r.history} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Refer a candidate</DialogTitle>
            <DialogDescription>
              Referring as {me.name} · {me.id}
            </DialogDescription>
          </DialogHeader>
          <ReferralForm referrerId={me.id} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmpReferrals;
