import { useMemo, useState } from "react";
import { Receipt, Check, X, Wallet, ShieldPlus, Download, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { InsuranceTab } from "@/features/employees/components/InsuranceTab";
import {
  reimbursementStore,
  approveClaim,
  rejectClaim,
  canActionClaim,
  claimPayable,
  hasActedOn,
} from "@/features/finance/data/claims-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { inr } from "@/lib/store";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import {
  ClaimDetailDialog,
  claimBadge,
  stageBadge,
} from "@/features/finance/components/ClaimDetail";
import { useScopedIds } from "@/features/employees/components/CasePieces";

function OrgClaims() {
  const allRows = reimbursementStore.use();
  const me = useCurrentUser();
  // Tenant scope — claims raised by employees of the active entity (or the whole group for a Super Admin in group view).
  const scopedIds = useScopedIds();
  const rows = useMemo(() => allRows.filter((r) => scopedIds.has(r.empId)), [allRows, scopedIds]);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))], [rows]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (category === "all" || r.category === category) &&
          (!q ||
            `${r.name} ${r.employee} ${r.id} ${r.purpose ?? ""} ${r.client ?? ""}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [rows, status, category, q],
  );
  const pending = rows.filter((r) => r.status === "Submitted");
  const totalPending = pending.reduce((s, r) => s + r.amount, 0);
  const settled = rows.filter((r) => r.status === "Paid").reduce((s, r) => s + r.amount, 0);
  const myQueue = rows.filter((r) => canActionClaim(me, r));

  const claimColumns = [
    "Claim",
    "Name",
    "Date",
    "Employee",
    "Department",
    "Type",
    "Category",
    "Purpose",
    "Bills",
    "Amount",
    "Advance adj.",
    "Net payable",
    "Payment mode",
    "Status",
    "Current Stage",
    "Remarks",
  ];
  const claimRows = filtered.map((r) => [
    r.id,
    r.name,
    r.date,
    r.employee,
    r.department ?? "—",
    r.type,
    r.category,
    r.purpose ?? r.description,
    r.items?.length ?? (r.document ? 1 : 0),
    inr(r.amount),
    inr(r.advanceAdjusted ?? 0),
    inr(claimPayable(r)),
    r.paymentMode ?? "With salary (payroll)",
    r.status,
    r.currentStage,
    r.remarks || "—",
  ]);

  function downloadClaimsPdf() {
    const ok = exportReportPdf({
      title: "Reimbursement Claims Register",
      subtitle: "Employee expense claims with approval and settlement status",
      filters: [
        { label: "Status", value: status === "all" ? "All statuses" : status },
        { label: "Category", value: category === "all" ? "All" : category },
      ],
      summary: [
        { label: "Claims", value: String(filtered.length) },
        { label: "Awaiting approval", value: inr(totalPending) },
        { label: "Settled", value: inr(settled) },
      ],
      columns: claimColumns,
      rows: claimRows,
    });
    if (ok) toast.success("Claims PDF ready in the print dialog");
    else toast.error("Allow pop-ups to generate the PDF");
  }

  const approve = (r, remarks) => {
    if (!canActionClaim(me, r))
      return void toast.error("This claim is not awaiting your approval.");
    if (
      !approveClaim(
        r.id,
        me.name,
        remarks || (r.currentStage === "Accounts" ? "Payment processed" : "Approved"),
        me.id,
      )
    )
      return void toast.error("You already signed an earlier stage of this claim.");
    toast.success(
      r.currentStage === "Accounts"
        ? `Payment processed — ${inr(claimPayable(r))} to ${r.employee}`
        : `Claim approved at ${r.currentStage} stage`,
    );
    setOpenId(null);
  };
  const reject = (r, reason) => {
    if (!canActionClaim(me, r))
      return void toast.error("This claim is not awaiting your approval.");
    if (!rejectClaim(r.id, me.name, reason, me.id))
      return void toast.error("Give a reason for the rejection.");
    toast.success("Claim rejected — the employee has been informed");
    setOpenId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Receipt className="text-primary h-6 w-6" /> Claims & Reimbursements
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Settle employee expense claims and manage the insurance policies assigned to your people.
          Click any claim to see exactly what the employee submitted — purpose, bills, attachments
          and the approval trail.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Pending claims", value: String(pending.length), icon: Receipt },
          { label: "Awaiting approval", value: inr(totalPending), icon: Wallet },
          { label: "In my queue", value: String(myQueue.length), icon: Eye },
          { label: "Settled this year", value: inr(settled), icon: Check },
        ].map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{s.label}</div>
                <div className="text-lg font-bold">{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="claims">
        <ScrollTabsList>
          <TabsTrigger value="claims">
            <Receipt className="h-4 w-4" /> Reimbursement Claims
          </TabsTrigger>
          <TabsTrigger value="insurance">
            <ShieldPlus className="h-4 w-4" /> Employee Insurance
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="claims" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label className="text-muted-foreground text-xs">Search</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Claim, employee, purpose, client…"
                className="w-full sm:w-[240px]"
              />
            </div>
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["Submitted", "Approved", "Rejected", "Paid"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label className="text-muted-foreground text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  exportCsv("reimbursement-claims", claimColumns, claimRows);
                  toast.success("CSV exported");
                }}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={downloadClaimsPdf}>
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
            </div>
          </div>

          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="p-3 text-left">Claim</th>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Purpose</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-left">Bills</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Stage</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-muted/30 cursor-pointer align-top"
                      onClick={() => setOpenId(r.id)}
                    >
                      <td className="p-3 font-medium">
                        {r.name}
                        <div className="text-muted-foreground text-xs font-normal">
                          {r.id} · <span className="whitespace-nowrap">{r.date}</span> · {r.type}
                        </div>
                      </td>
                      <td className="p-3">
                        {r.employee}
                        <div className="text-muted-foreground text-xs">
                          {[r.department, r.branch].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="text-muted-foreground max-w-[260px] p-3 text-xs">
                        <div className="line-clamp-2">{r.purpose ?? r.description}</div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary"
                        >
                          {r.category}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-semibold tabular-nums">
                        {inr(r.amount)}
                        {r.advanceAdjusted ? (
                          <div className="text-muted-foreground text-[11px] font-normal">
                            net {inr(claimPayable(r))}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        {r.items?.length ?? (r.document ? 1 : 0)} bill(s)
                        <div>{r.attachments?.length ?? (r.document ? 1 : 0)} file(s)</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={claimBadge(r.status)}>
                          {r.status}
                        </Badge>
                        {r.remarks && (
                          <div className="text-muted-foreground mt-1 line-clamp-2 max-w-[160px] text-xs">
                            {r.remarks}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={stageBadge(r.currentStage, r.status)}>
                          {r.currentStage}
                        </Badge>
                      </td>
                      <td
                        className="p-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>
                            <Eye className="h-4 w-4" /> View
                          </Button>
                          {canActionClaim(me, r) ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => approve(r, "")}>
                                <Check className="text-primary h-4 w-4" />{" "}
                                {r.currentStage === "Accounts" ? "Process Payment" : "Approve"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>
                                <X className="text-destructive h-4 w-4" /> Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-muted-foreground self-center pl-1 text-xs">
                              {r.currentStage === "Settled"
                                ? "Settled"
                                : r.status === "Rejected"
                                  ? "Rejected"
                                  : r.empId === me.id
                                    ? "Your own claim"
                                    : hasActedOn(r, me)
                                      ? `Signed by you · awaiting ${r.currentStage}`
                                      : `Awaiting ${r.currentStage}`}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-muted-foreground p-10 text-center">
                        No claims here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="pt-4">
          <InsuranceTab />
        </TabsContent>
      </Tabs>

      {open && (
        <ClaimDetailDialog
          claim={open}
          onClose={() => setOpenId(null)}
          canAction={canActionClaim(me, open)}
          onApprove={(rem) => approve(open, rem)}
          onReject={(reason) => reject(open, reason)}
        />
      )}
    </div>
  );
}

export default OrgClaims;
