// Comp-off balance + redemption, embedded on the employee's Leave page.
// Auto-accrual runs live against the punch/tour stores — no manual entry.
import { useState } from "react";
import { CalendarClock, Plus, History } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCompOffAutoAccrual,
  useCompOffLedgerOf,
  useMyCompOffRedemptions,
  requestCompOffRedemption,
  withdrawCompOffRedemption,
  compOffDaysBetween,
} from "@/features/travel/data/compoff-data";

const tone = {
  "Pending Approval": "border-gold/40 bg-gold/10 text-gold",
  Approved: "border-primary/30 bg-primary/10 text-primary",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function CompOffCard({ employeeId }) {
  const balance = useCompOffAutoAccrual(employeeId);
  const ledger = useCompOffLedgerOf(employeeId);
  const redemptions = useMyCompOffRedemptions(employeeId);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [half, setHalf] = useState(false);

  // Working days only (weekends are off anyway), 0 when the range is reversed — the old calendar-day count clamped a
  // reversed range to 1 day. Credits accrue in 0.5-day units, so a single day can be redeemed as a half day.
  const workDays = compOffDaysBetween(from, to);
  const days = half && from === to && workDays === 1 ? 0.5 : workDays;
  const onHold = redemptions
    .filter((r) => r.status === "Pending Approval")
    .reduce((s, r) => s + r.days, 0);
  const free = Math.max(0, balance.available - onHold);
  const valid = from && to && days > 0 && days <= free && reason.trim();

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="text-primary h-4 w-4" /> Comp-off
          </div>
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" /> Ledger
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold">{balance.earned}</div>
            <div className="text-muted-foreground text-[11px]">Earned</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold">{balance.redeemed}</div>
            <div className="text-muted-foreground text-[11px]">Redeemed</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-2">
            <div className="text-primary text-lg font-bold">{balance.available}</div>
            <div className="text-muted-foreground text-[11px]">Available</div>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Credited automatically when you work on a declared off day or are on tour during one — no
          request needed for the credit itself. Redeeming a comp-off day needs your HOD's approval.
        </p>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="w-full" disabled={free <= 0}>
              <Plus className="h-3.5 w-3.5" /> Redeem comp-off
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Redeem comp-off</DialogTitle>
              <DialogDescription>
                Routed to your HOD for approval. You have {free} day(s) available
                {onHold ? ` (${onHold} on hold in pending requests)` : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">From *</Label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      if (!to || to < e.target.value) setTo(e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">To *</Label>
                  <Input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
              {from && to && from === to && workDays === 1 && (
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={half} onCheckedChange={(v) => setHalf(!!v)} /> Half day (0.5)
                </label>
              )}
              {from && to && (
                <div className="text-muted-foreground text-xs">
                  {days} working day(s){" "}
                  {days === 0 && (
                    <span className="text-destructive">— the range has no working day</span>
                  )}
                  {days > free && (
                    <span className="text-destructive">
                      — exceeds available balance{onHold ? ` (${onHold} on hold)` : ""}
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Reason *</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!valid}
                className="bg-gradient-emerald text-white"
                onClick={() => {
                  try {
                    requestCompOffRedemption({
                      employeeId,
                      fromDate: from,
                      toDate: to,
                      days,
                      reason: reason.trim(),
                    });
                    toast.success("Comp-off redemption submitted to your HOD");
                    setOpen(false);
                    setFrom("");
                    setTo("");
                    setReason("");
                    setHalf(false);
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Submit request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {redemptions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {redemptions.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="border-border flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs"
              >
                <span>
                  <span className="whitespace-nowrap">{r.fromDate}</span> →{" "}
                  <span className="whitespace-nowrap">{r.toDate}</span> · {r.days}d
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={tone[r.status]}>
                    {r.status}
                  </Badge>
                  {r.status === "Pending Approval" && (
                    <button
                      aria-label={`Withdraw ${r.id}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        withdrawCompOffRedemption(r.id);
                        toast.success("Withdrawn");
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Comp-off ledger</DialogTitle>
              <DialogDescription>Every credit and debit, in order.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {ledger.length === 0 && (
                <p className="text-muted-foreground text-sm">No comp-off activity yet.</p>
              )}
              {ledger.map((e) => (
                <div
                  key={e.id}
                  className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <div
                      className={
                        e.type === "Credit"
                          ? "text-primary font-medium"
                          : "text-destructive font-medium"
                      }
                    >
                      {e.type === "Credit" ? "+" : "−"}
                      {e.days} day(s)
                    </div>
                    <div className="text-muted-foreground text-xs">{e.reason}</div>
                  </div>
                  <div className="text-muted-foreground shrink-0 text-xs">{e.createdOn}</div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
