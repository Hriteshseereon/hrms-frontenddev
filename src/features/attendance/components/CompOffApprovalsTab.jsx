// HOD-facing comp-off redemption queue, plus an org-wide ledger for HR/Admin
// visibility into every credit/debit regardless of which HOD it routed to.
import { useState } from "react";
import { CalendarClock, CheckCircle2, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser, allUsers, can } from "@/features/auth/data/auth-session";
import { canActOn } from "@/features/administration/data/approval-chain";
import {
  useCompOffRedemptions,
  decideCompOffRedemption,
  useCompOffLedger,
  compOffBalance,
} from "@/features/travel/data/compoff-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const tone = {
  "Pending Approval": "border-gold/40 bg-gold/10 text-gold",
  Approved: "border-primary/30 bg-primary/10 text-primary",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  Pending: "border-gold/40 bg-gold/10 text-gold",
};

export function CompOffApprovalsTab() {
  const me = useCurrentUser();
  // All users of the entity (seeded roster + new hires / invited users), not just the seed list.
  const inScope = useScopeMatch();
  const orgUsers = allUsers().filter((u) => inScope(u.orgId, null, u.branch));
  const orgEmployeeIds = new Set(orgUsers.map((u) => u.id));
  // Without `compoff.viewAll` (Managers) only the requests routed to you are listed.
  const viewAll = can(me.role, "compoff.viewAll");
  const redemptions = useCompOffRedemptions().filter(
    (r) =>
      orgEmployeeIds.has(r.employeeId) && (viewAll || r.chain.some((s) => s.approverId === me.id)),
  );
  const ledger = useCompOffLedger().filter(
    (e) =>
      orgEmployeeIds.has(e.employeeId) &&
      (viewAll || redemptions.some((r) => r.employeeId === e.employeeId)),
  );
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);

  const pendingMine = redemptions.filter(
    (r) =>
      r.status === "Pending Approval" &&
      r.employeeId !== me.id &&
      canActOn(r.chain, me.id, me.role, r.employeeId),
  ).length;
  const totalCreditedThisMonth = ledger
    .filter(
      (e) =>
        e.type === "Credit" &&
        e.createdOn.slice(0, 7) ===
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    )
    .reduce((s, e) => s + e.days, 0);

  const filtered = redemptions.filter((r) => {
    const matchesQ = [r.id, r.employeeName, r.reason]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesQ && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Pending my approval
            </div>
            <div className="mt-1 text-xl font-bold">{pendingMine}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Auto-credited this month
            </div>
            <div className="mt-1 text-xl font-bold">{totalCreditedThisMonth} days</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Total redemptions
            </div>
            <div className="mt-1 text-xl font-bold">{redemptions.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Ledger entries
            </div>
            <div className="mt-1 text-xl font-bold">{ledger.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="text-primary h-4 w-4" />
            <span className="min-w-0">
              {" "}
              Redemption requests
              <span className="text-muted-foreground font-normal">
                — every organization-wide request, regardless of which HOD it routes to.
              </span>
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search employee or reason…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-muted-foreground py-6 text-center text-sm">
                No comp-off redemption requests yet.
              </div>
            )}
            {filtered.map((r) => {
              const bal = compOffBalance(r.employeeId);
              return (
                <div key={r.id} className="border-border rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.employeeName}</span>
                        <Badge variant="outline" className={tone[r.status]}>
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {r.id} · <span className="whitespace-nowrap">{r.fromDate}</span> →{" "}
                        <span className="whitespace-nowrap">{r.toDate}</span> · {r.days} day(s) ·
                        raised <span className="whitespace-nowrap">{r.raisedOn}</span> · balance{" "}
                        {bal.available} available
                      </div>
                      <div className="mt-2 text-sm">{r.reason}</div>
                    </div>
                    {r.status === "Pending Approval" &&
                      r.employeeId !== me.id &&
                      canActOn(r.chain, me.id, me.role, r.employeeId) && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-gradient-emerald text-white"
                            onClick={() => {
                              try {
                                decideCompOffRedemption(r.id, me.id, "Approved");
                                toast.success("Approved");
                              } catch (e) {
                                toast.error(e.message);
                              }
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => {
                              const note = window
                                .prompt("Reason for rejecting this comp-off redemption?")
                                ?.trim();
                              if (!note) {
                                toast.error("A reason is required to reject.");
                                return;
                              }
                              try {
                                decideCompOffRedemption(r.id, me.id, "Rejected", note);
                                toast.success("Rejected");
                              } catch (e) {
                                toast.error(e.message);
                              }
                            }}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                        </div>
                      )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.chain.map((s, i) => (
                      <Badge key={i} variant="outline" className={tone[s.status] ?? ""}>
                        {s.label}: {s.approverName} · {s.status}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-4 text-sm font-semibold">Balances across the organisation</div>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-right">Earned</th>
                  <th className="p-3 text-right">Redeemed</th>
                  <th className="p-3 text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {orgUsers
                  .filter(
                    (u) =>
                      viewAll ||
                      (orgEmployeeIds.has(u.id) && ledger.some((e) => e.employeeId === u.id)),
                  )
                  .map((u) => {
                    const bal = compOffBalance(u.id);
                    if (bal.earned === 0 && bal.redeemed === 0) return null;
                    return (
                      <tr key={u.id} className={clickableRow} onClick={() => setDetail(u)}>
                        <td className="p-3 font-medium">{u.name}</td>
                        <td className="p-3 text-right">{bal.earned}</td>
                        <td className="p-3 text-right">{bal.redeemed}</td>
                        <td className="text-primary p-3 text-right font-semibold">
                          {bal.available}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {detail &&
        (() => {
          const bal = compOffBalance(detail.id);
          const entries = ledger
            .filter((e) => e.employeeId === detail.id)
            .map((e) => ({
              id: e.id,
              type: e.type,
              days: e.days,
              reason: e.reason,
              source: e.source,
              createdOn: e.createdOn,
              expiresOn: e.expiresOn,
            }));
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={detail.name}
              subtitle={`${detail.id} · ${detail.designation} · ${detail.dept}`}
              badges={<Badge variant="outline">{bal.available} day(s) available</Badge>}
              record={{
                name: detail.name,
                employeeId: detail.id,
                designation: detail.designation,
                dept: detail.dept,
                branch: detail.branch,
                earned: bal.earned,
                redeemed: bal.redeemed,
                available: bal.available,
                ledger: entries,
              }}
              labels={{
                dept: "Department",
                earned: "Earned (days)",
                redeemed: "Redeemed (days)",
                available: "Available (days)",
                ledger: "Ledger entries",
              }}
              sections={[
                {
                  title: "Employee",
                  keys: ["name", "employeeId", "designation", "dept", "branch"],
                },
                { title: "Comp-off balance", keys: ["earned", "redeemed", "available"] },
                { title: "Ledger", keys: ["ledger"] },
              ]}
            />
          );
        })()}
    </div>
  );
}
