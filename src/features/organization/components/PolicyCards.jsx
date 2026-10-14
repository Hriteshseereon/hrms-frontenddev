// Small configuration cards that live only in Master Data: grievance routing / SLA matrix and loan & advance policy.
import { useState } from "react";
import { Scale, Wallet, Save } from "lucide-react";
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
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { ROUTING } from "@/features/exit/data/grievance-data";
import { saveLoanPolicy, useLoanPolicy } from "@/features/payroll/data/loans-data";

export function GrievanceRoutingCard() {
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <Scale className="text-primary h-4 w-4" /> Grievance routing &amp; SLA matrix
        </div>
        <div className="text-muted-foreground mb-3 text-xs">
          Category → committee / redressal owner, acknowledgement and resolution SLAs. POSH cases go
          straight to the Internal Committee and are never visible to the reporting manager.
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Object.entries(ROUTING).map(([c, r]) => (
            <div key={c} className="border-border rounded-lg border p-2 text-xs">
              <div className="font-medium">{c}</div>
              <div className="text-muted-foreground">
                {r.committee} · {r.owner}
              </div>
              <div className="mt-1">
                <Badge variant="outline">Ack {r.ackDays}d</Badge>{" "}
                <Badge variant="outline">Resolve {r.resolveDays}d</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LoanPolicyCard() {
  const me = useCurrentUser();
  const cur = useLoanPolicy();
  const [p, setP] = useState(cur);
  // Saved policy arrives after hydration (server renders the defaults) — refresh the draft so Save keeps it.
  const [seen, setSeen] = useState(cur);
  if (seen !== cur) {
    setSeen(cur);
    setP(cur);
  }
  const num = (k, label) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={p[k]} onChange={(e) => setP({ ...p, [k]: +e.target.value })} />
    </div>
  );
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-5">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Wallet className="text-primary h-4 w-4" /> Loan &amp; salary-advance policy
          </div>
          <div className="text-muted-foreground text-xs">
            MoM: loan ≤ 3 × gross recovered within 12 months; salary advance is next month's salary
            only, repaid one-time or by EMI.
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {num("maxGrossMultiple", "Loan cap (× monthly gross)")}
          {num("maxTenureMonths", "Max loan tenure (months)")}
          {num("interestPct", "Interest % p.a.")}
          {num("advanceTenure", "Advance recovery — default months")}
          {num("advanceEmiMaxMonths", "Advance EMI max months")}
          <div className="space-y-1">
            <Label className="text-xs">Approver</Label>
            <Select value={p.approver} onValueChange={(v) => setP({ ...p, approver: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["HR", "Finance", "HR → Finance"].map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs">
            Updated <span className="whitespace-nowrap">{cur.updatedOn}</span> by {cur.updatedBy}
          </div>
          <Button
            size="sm"
            className="bg-gradient-emerald text-white"
            disabled={
              !(
                p.maxGrossMultiple > 0 &&
                p.maxTenureMonths >= 1 &&
                p.interestPct >= 0 &&
                p.advanceTenure >= 1 &&
                p.advanceEmiMaxMonths >= 1
              )
            }
            title="Caps and tenures must be positive; interest cannot be negative"
            onClick={() => {
              saveLoanPolicy(p, me.name);
              toast.success("Loan policy saved");
            }}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
