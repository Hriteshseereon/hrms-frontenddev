// Expenditure Booking workspace — organisation-scoped spend records with a full booking form (purpose, reason,
// who asked / who it concerns / who approved, department, date & time, vendor, GST, bills, category specifics such
// as asset purchases and festival spend), click-to-detail popup, approval / payment lifecycle and reports.
import { useMemo, useState } from "react";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import { captureFiles } from "@/lib/attachments";
import {
  IndianRupee,
  Plus,
  Search,
  FileCheck2,
  Upload,
  Trash2,
  Eye,
  Download,
  FileText,
  BarChart3,
  Check,
  X,
  Banknote,
  Paperclip,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { inr } from "@/lib/store";
import { cn } from "@/lib/utils";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { findEmployee } from "@/features/employees/data/employee-directory";
import {
  useExpenditures,
  bookExpenditure,
  submitExpenditureOutcome,
  removeExpenditure,
  approveExpenditure,
  rejectExpenditure,
  markExpenditurePaid,
  expenditureReport,
  filterExpenditures,
  monthLabelOf,
  personOf,
  isOwnExpenditure,
  EXPENDITURE_CATEGORIES,
  CATEGORY_META,
  EXPENDITURE_PAYMENT_MODES,
  EXPENDITURE_PRIORITIES,
  EXPENDITURE_STATUSES,
  APPROVER_ROLES,
} from "@/features/finance/data/expenditure-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
  useScopedEmployees,
} from "@/features/employees/components/CasePieces";
import { clickableRow } from "@/components/common/RecordDetail";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const statusTone = {
  Booked: "border-gold/40 bg-gold/15 text-gold",
  Approved: "border-primary/40 bg-primary/10 text-primary",
  Paid: "border-primary/40 bg-primary/10 text-primary",
  Rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};
const pad = (n) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ExpenditureWorkspace() {
  const me = useCurrentUser();
  const activeOrgId = useActiveOrgId();
  const inScope = useScopeMatch();
  const rows = useExpenditures().filter((e) => inScope(e.orgId, e.requestedBy?.id));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const detail = rows.find((r) => r.id === detailId) ?? null;
  const canApprove = APPROVER_ROLES.includes(me.role);

  const filtered = rows.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      (category === "all" || e.category === category) &&
      [
        e.id,
        e.title,
        e.bookedByName,
        e.requestedBy.name,
        e.concernedPerson.name,
        e.vendor,
        e.purpose,
        e.category,
        e.department,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const report = expenditureReport(rows);

  const registerCols = [
    "Ref",
    "Title",
    "Category",
    "Sub-category",
    "Department",
    "Requested by",
    "Concerned person",
    "Approved by",
    "Date",
    "Time",
    "Vendor",
    "Invoice",
    "Payment",
    "Amount",
    "GST",
    "Total",
    "Status",
    "Outcome",
  ];
  const registerRows = filtered.map((e) => [
    e.id,
    e.title,
    e.category,
    e.subcategory,
    e.department,
    e.requestedBy.name,
    e.concernedPerson.name,
    e.approvedBy?.name ?? "—",
    e.spendDate,
    e.spendTime,
    e.vendor,
    e.invoiceNo ?? "—",
    e.paymentMode,
    inr(e.amount),
    inr(e.gstAmount),
    inr(e.total),
    e.status,
    e.outcome ? "Captured" : "Pending",
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          ["Total booked", inr(report.total), `${report.count} records`],
          ["Capex", inr(report.capex), "asset & site equipment"],
          ["Opex", inr(report.opex), "everything else"],
          ["Payable", inr(report.payable), "booked / approved, not paid"],
          ["Outcome captured", `${report.withOutcome}/${report.count}`, "what the spend achieved"],
        ].map(([l, v, s]) => (
          <Card key={l} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{l}</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{v}</div>
              <div className="text-muted-foreground text-[11px]">{s}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="records">
        <ScrollTabsList>
          <TabsTrigger value="records">
            <IndianRupee className="h-4 w-4" /> Expenditure Records
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="h-4 w-4" /> Expenditure Reports
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="records" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder="Search title, vendor, person, purpose…"
                      className="w-full pl-9 sm:w-[280px]"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {EXPENDITURE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {EXPENDITURE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      exportCsv("expenditure-register", registerCols, registerRows);
                      toast.success("CSV exported");
                    }}
                  >
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportReportPdf({
                        title: "Expenditure Register",
                        subtitle: "All booked expenditure for this organisation",
                        filters: [
                          { label: "Status", value: status === "all" ? "All" : status },
                          { label: "Category", value: category === "all" ? "All" : category },
                        ],
                        summary: [
                          { label: "Records", value: String(filtered.length) },
                          { label: "Total", value: inr(filtered.reduce((s, r) => s + r.total, 0)) },
                        ],
                        columns: registerCols,
                        rows: registerRows,
                      })
                    }
                  >
                    <FileText className="h-4 w-4" /> Register PDF
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-emerald shadow-premium text-white"
                    onClick={() => setOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Book Expenditure
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                    <tr>
                      {[
                        "Ref / Title",
                        "Category",
                        "Department",
                        "Requested by",
                        "Concerned person",
                        "Date & time",
                        "Vendor",
                        "Total",
                        "Status",
                        "",
                      ].map((h) => (
                        <th key={h} className="p-3 text-left whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {filtered.map((e) => (
                      <tr
                        key={e.id}
                        className={cn(clickableRow, "align-top")}
                        onClick={() => setDetailId(e.id)}
                      >
                        <td className="p-3">
                          <div className="font-medium">{e.title}</div>
                          <div className="text-muted-foreground text-xs">
                            {e.id} · booked by {e.bookedByName}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{e.category}</Badge>
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            {e.subcategory}
                          </div>
                        </td>
                        <td className="text-muted-foreground p-3">
                          {e.department}
                          <div className="text-[11px]">{e.costCentre}</div>
                        </td>
                        <td className="p-3">
                          {e.requestedBy.name}
                          <div className="text-muted-foreground text-[11px]">
                            {e.requestedBy.role}
                          </div>
                        </td>
                        <td className="p-3">
                          {e.concernedPerson.name}
                          <div className="text-muted-foreground text-[11px]">
                            {e.concernedPerson.role}
                          </div>
                        </td>
                        <td className="text-muted-foreground p-3 whitespace-nowrap">
                          <span className="whitespace-nowrap">{e.spendDate}</span>
                          <div className="text-[11px]">{e.spendTime}</div>
                        </td>
                        <td className="p-3">
                          {e.vendor}
                          <div className="text-muted-foreground text-[11px]">
                            {e.bills.length} bill(s) · {e.paymentMode}
                          </div>
                        </td>
                        <td className="p-3 font-semibold tabular-nums">
                          {inr(e.total)}
                          <div className="text-muted-foreground text-[11px] font-normal">
                            incl. GST {inr(e.gstAmount)}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={statusTone[e.status]}>
                            {e.status}
                          </Badge>
                          {e.outcome && (
                            <div className="text-primary mt-0.5 flex items-center gap-1 text-[11px]">
                              <FileCheck2 className="h-3 w-3" /> outcome
                            </div>
                          )}
                        </td>
                        <td className="p-3" onClick={(ev) => ev.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => setDetailId(e.id)}
                            title="Full details — bills, approval history, payment status, outcome"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-muted-foreground p-10 text-center text-sm">
                          No expenditure booked yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="pt-4">
          <ExpenditureReports rows={rows} />
        </TabsContent>
      </Tabs>

      {open && <BookExpenditureDialog onClose={() => setOpen(false)} orgId={activeOrgId} />}
      {detail && (
        <ExpenditureDetailDialog
          row={detail}
          canApprove={canApprove}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/* ---------------- Detail popup ---------------- */
function ExpenditureDetailDialog({ row, canApprove, onClose }) {
  const me = useCurrentUser();
  const [remarks, setRemarks] = useState("");
  const [payRef, setPayRef] = useState("");
  const [outcome, setOutcome] = useState("");
  const [outcomeDoc, setOutcomeDoc] = useState("");
  const [mode, setMode] = useState(null);
  const meP = { id: me.id, name: me.name, role: me.role };
  const cm = CATEGORY_META[row.category] ?? CATEGORY_META.Other;
  // Maker–checker: the booker / requester cannot approve their own spend.
  const own = isOwnExpenditure(row, me.id);
  const mayDecide = canApprove && !own;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="text-primary h-4 w-4" /> {row.title}
          </DialogTitle>
          <DialogDescription>
            {row.id} · {row.category} › {row.subcategory} · {row.department} · booked by{" "}
            {row.bookedByName} on <span className="whitespace-nowrap">{row.createdOn}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusTone[row.status]}>
            {row.status}
          </Badge>
          <Badge variant="outline">{cm.capex ? "Capex" : "Opex"}</Badge>
          <Badge variant="outline">{row.priority}</Badge>
          {row.recurring && <Badge variant="outline">Recurring</Badge>}
          <span className="ml-auto text-lg font-bold tabular-nums">{inr(row.total)}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-border space-y-2 rounded-xl border p-4 sm:col-span-2">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Purpose & reason
            </div>
            <p className="text-sm">
              <b>Purpose:</b> {row.purpose}
            </p>
            <p className="text-sm">
              <b>Reason:</b> {row.reason}
            </p>
            {row.description && <p className="text-muted-foreground text-sm">{row.description}</p>}
          </div>
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              People
            </div>
            <KV
              cols={1}
              items={[
                [
                  "Requested by",
                  `${row.requestedBy.name}${row.requestedBy.role ? ` · ${row.requestedBy.role}` : ""}`,
                ],
                [
                  "Concerned person",
                  `${row.concernedPerson.name}${row.concernedPerson.role ? ` · ${row.concernedPerson.role}` : ""}`,
                ],
                [
                  "Approved by",
                  row.approvedBy
                    ? `${row.approvedBy.name}${row.approvedBy.role ? ` · ${row.approvedBy.role}` : ""}`
                    : "Pending",
                ],
                ["Booked by", row.bookedByName],
                ...(row.preApprovalRef ? [["Pre-approval reference", row.preApprovalRef]] : []),
                ["Department", row.department],
                ["Branch", row.branch],
              ]}
            />
          </div>
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              When & where
            </div>
            <KV
              cols={1}
              items={[
                ["Date & time", `${row.spendDate} ${row.spendTime}`],
                ["Cost centre", row.costCentre],
                ["Budget line", row.budgetLine ?? "—"],
                ["Project", row.project ?? "—"],
                ["Client", row.client ?? "—"],
                ["Priority", row.priority],
              ]}
            />
          </div>
          <div className="border-border space-y-2 rounded-xl border p-4 sm:col-span-2">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Vendor & payment
            </div>
            <KV
              items={[
                ["Vendor", row.vendor],
                ["GSTIN", row.vendorGstin ?? "—"],
                ["Invoice no.", row.invoiceNo ?? "—"],
                ["Payment mode", row.paymentMode],
                ["Payment reference", row.paymentRef ?? "—"],
                ["Taxable amount", inr(row.amount)],
                [`GST @ ${row.gstPct}%`, inr(row.gstAmount)],
                ["Total", inr(row.total)],
              ]}
            />
          </div>
          {row.asset && (
            <div className="border-primary/30 bg-primary/5 space-y-2 rounded-xl border p-4 sm:col-span-2">
              <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Asset purchase
              </div>
              <KV
                items={[
                  ["Asset", row.asset.assetName],
                  ["Quantity", String(row.asset.quantity)],
                  ["Unit cost", inr(row.asset.unitCost)],
                  ["Asset tag(s)", row.asset.assetTag ?? "to be tagged"],
                  ["Capitalised", row.asset.capitalise ? "Yes — goes to asset register" : "No"],
                  ["Useful life", `${row.asset.usefulLifeYears} years`],
                  ["Location", row.asset.location],
                  ["Custodian", row.asset.custodian],
                ]}
              />
            </div>
          )}
          {row.festival && (
            <div className="border-gold/40 bg-gold/10 space-y-2 rounded-xl border p-4 sm:col-span-2">
              <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Festival / celebration
              </div>
              <KV
                items={[
                  ["Occasion", row.festival.occasion],
                  ["Beneficiaries", row.festival.beneficiaries],
                  ["Headcount", String(row.festival.headcount)],
                  ["Per-head cost", inr(row.festival.perHeadCost)],
                  ["Gift / item", row.festival.giftType],
                ]}
              />
            </div>
          )}
        </div>
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-muted/30 text-muted-foreground flex items-center justify-between border-b px-4 py-2 text-xs font-semibold tracking-wider uppercase">
            <span>Bills ({row.bills.length})</span>
            <span>{inr(row.bills.reduce((s, b) => s + b.amount, 0))}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-muted-foreground text-[11px] tracking-wider uppercase">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Vendor</th>
                <th className="p-2 text-left">Bill no.</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Attachment</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {row.bills.map((b, i) => (
                <tr key={i}>
                  <td className="text-muted-foreground p-2 whitespace-nowrap">
                    <span className="whitespace-nowrap">{b.date}</span>
                  </td>
                  <td className="p-2">{b.vendor}</td>
                  <td className="p-2 font-mono text-xs">{b.billNo || "—"}</td>
                  <td className="p-2">{b.description}</td>
                  <td className="p-2 text-xs">
                    {b.attachment ? (
                      <AttachmentChips
                        names={[b.attachment]}
                        context={`Bill ${b.billNo || ""} · ${b.vendor || ""}`}
                        size="xs"
                      />
                    ) : (
                      <span className="text-destructive">missing</span>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums">{inr(b.amount)}</td>
                </tr>
              ))}
              {row.bills.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-3 text-center text-xs">
                    No bills itemised.
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
            <AttachmentChips names={row.attachments} context={`Expenditure ${row.id}`} />
            {row.attachments.length === 0 && (
              <span className="text-muted-foreground text-xs">None.</span>
            )}
          </div>
        </div>
        {row.outcome && (
          <div className="bg-muted/50 rounded-xl p-4 text-sm">
            <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold">
              <FileCheck2 className="h-3.5 w-3.5" /> Outcome — submitted{" "}
              <span className="whitespace-nowrap">{row.outcomeSubmittedOn}</span>
            </div>
            {row.outcome}
            {row.outcomeDocuments?.length ? (
              <div className="text-muted-foreground mt-1 text-xs">
                Documents: {row.outcomeDocuments.map((d) => d.name).join(", ")}
              </div>
            ) : null}
          </div>
        )}
        <div className="border-border space-y-1 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            History
          </div>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {row.history.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-28 shrink-0 tabular-nums">{h.at}</span>
                <span className="w-32 shrink-0 truncate">{h.by}</span>
                <span>{h.action}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-primary/30 bg-primary/5 space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap gap-2">
            {mayDecide && row.status === "Booked" && (
              <>
                <Button
                  size="sm"
                  variant={mode === "approve" ? "default" : "outline"}
                  onClick={() => setMode("approve")}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive"
                  onClick={() => setMode("reject")}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </>
            )}
            {canApprove && row.status === "Approved" && (
              <Button
                size="sm"
                variant={mode === "pay" ? "default" : "outline"}
                onClick={() => setMode("pay")}
              >
                <Banknote className="h-4 w-4" /> Mark paid
              </Button>
            )}
            {!row.outcome && row.status !== "Rejected" && (
              <Button
                size="sm"
                variant={mode === "outcome" ? "default" : "outline"}
                onClick={() => setMode("outcome")}
              >
                <Upload className="h-4 w-4" /> Add outcome
              </Button>
            )}
            {row.status === "Booked" && (row.bookedBy === me.id || canApprove) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive ml-auto"
                onClick={() => {
                  removeExpenditure(row.id);
                  toast.success("Record removed");
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          {mode === "approve" && (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Approval remarks — budget line, PO reference…"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={() => {
                    approveExpenditure(row.id, meP, remarks.trim());
                    toast.success("Expenditure approved");
                    onClose();
                  }}
                >
                  Confirm approval
                </Button>
              </div>
            </div>
          )}
          {mode === "reject" && (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Reason for rejection (required)"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!remarks.trim()}
                  onClick={() => {
                    rejectExpenditure(row.id, meP, remarks.trim());
                    toast.success("Expenditure rejected");
                    onClose();
                  }}
                >
                  Confirm rejection
                </Button>
              </div>
            </div>
          )}
          {mode === "pay" && (
            <div className="space-y-2">
              <Input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Payment reference — UTR / cheque no. / voucher"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  disabled={!payRef.trim()}
                  onClick={() => {
                    markExpenditurePaid(row.id, meP, payRef.trim());
                    toast.success("Marked paid");
                    onClose();
                  }}
                >
                  Confirm payment
                </Button>
              </div>
            </div>
          )}
          {mode === "outcome" && (
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What did this spend achieve? Result, usage, savings…"
              />
              <Input
                value={outcomeDoc}
                onChange={(e) => setOutcomeDoc(e.target.value)}
                placeholder="Supporting document name (optional)"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  disabled={!outcome.trim()}
                  onClick={() => {
                    submitExpenditureOutcome(
                      row.id,
                      outcome.trim(),
                      outcomeDoc.trim() ? [{ name: outcomeDoc.trim(), url: "#" }] : [],
                      me.name,
                    );
                    toast.success("Outcome recorded");
                    onClose();
                  }}
                >
                  Save outcome
                </Button>
              </div>
            </div>
          )}
          {!mode && (
            <p className="text-muted-foreground text-[11px]">
              {canApprove && own && row.status === "Booked"
                ? "You booked or requested this spend — another Finance / leadership approver must approve it."
                : canApprove
                  ? "Approve, reject, mark paid or record the outcome from here."
                  : "Approval and payment are done by Finance / leadership roles; you can add the outcome once known."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Booking form ---------------- */
const blankBill = () => ({
  date: "",
  vendor: "",
  billNo: "",
  description: "",
  amount: 0,
  attachment: "",
});

function BookExpenditureDialog({ onClose, orgId }) {
  const me = useCurrentUser();
  const people = useScopedEmployees();
  const departments = useMemo(() => [...new Set(people.map((p) => p.dept))].sort(), [people]);
  const branches = useMemo(() => [...new Set(people.map((p) => p.branch))].sort(), [people]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Office Supplies & Consumables");
  const [subcategory, setSubcategory] = useState("");
  const [purpose, setPurpose] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [concerned, setConcerned] = useState("");
  const [preApprovalRef, setPreApprovalRef] = useState("");
  const [spendDate, setSpendDate] = useState(todayIso());
  const [spendTime, setSpendTime] = useState(nowTime());
  const [project, setProject] = useState("");
  const [client, setClient] = useState("");
  const [costCentre, setCostCentre] = useState("");
  const [budgetLine, setBudgetLine] = useState("");
  const [priority, setPriority] = useState("Planned (budgeted)");
  const [recurring, setRecurring] = useState(false);
  const [vendor, setVendor] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [paymentMode, setPaymentMode] = useState("Bank transfer (NEFT/RTGS)");
  const [paymentRef, setPaymentRef] = useState("");
  const [amount, setAmount] = useState("");
  const [gstPct, setGstPct] = useState("18");
  const [bills, setBills] = useState([blankBill()]);
  const [attachments, setAttachments] = useState([]);
  const [asset, setAsset] = useState({
    assetName: "",
    quantity: 1,
    unitCost: 0,
    assetTag: "",
    capitalise: true,
    usefulLifeYears: 3,
    location: "",
    custodian: "",
  });
  const [festival, setFestival] = useState({
    occasion: "",
    beneficiaries: "",
    headcount: 0,
    perHeadCost: 0,
    giftType: "",
  });

  const cm = CATEGORY_META[category];
  const gst = Math.round(((Number(amount) || 0) * (Number(gstPct) || 0)) / 100);
  const total = (Number(amount) || 0) + gst;
  const billsTotal = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const isAsset = category === "Asset Purchase" || category === "Site Equipment";
  const isFestival = category === "Festival & Celebrations";
  const gstinOk =
    !vendorGstin.trim() || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(vendorGstin.trim());
  // At least one bill, every bill with its attachment, and the bills must add up to the booked total.
  const billRows = bills.filter((b) => b.vendor.trim() || b.amount);
  const billsOk =
    billRows.length > 0 &&
    billRows.every((b) => Number(b.amount) > 0 && b.attachment) &&
    Math.abs(billsTotal - total) <= 1;
  const billsError =
    Number(amount) > 0 && !billsOk
      ? billRows.length === 0
        ? "Add at least one bill."
        : billRows.some((b) => !b.attachment)
          ? "Attach the document for every bill."
          : "Bills must add up to the total (taxable + GST)."
      : "";
  const valid =
    title.trim() &&
    purpose.trim() &&
    reason.trim() &&
    department &&
    requestedBy &&
    concerned &&
    spendDate &&
    spendTime &&
    costCentre.trim() &&
    vendor.trim() &&
    Number(amount) > 0 &&
    gstinOk &&
    billsOk &&
    (!isAsset || (asset.assetName.trim() && Number(asset.quantity) >= 1)) &&
    (!isFestival || festival.occasion.trim());
  const setBill = (i, patch) =>
    setBills((l) => l.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  function submit() {
    const files = [...new Set([...attachments, ...bills.map((b) => b.attachment).filter(Boolean)])];
    const row = bookExpenditure({
      orgId,
      title: title.trim(),
      category,
      subcategory: subcategory || cm.sub[0],
      purpose: purpose.trim(),
      reason: reason.trim(),
      description: description.trim(),
      department,
      branch: branch || findEmployee(concerned)?.branch || "",
      requestedBy: personOf(requestedBy),
      concernedPerson: personOf(concerned),
      preApprovalRef: preApprovalRef.trim() || undefined,
      bookedBy: me.id,
      bookedByName: me.name,
      spendDate,
      spendTime,
      project: project.trim() || undefined,
      client: client.trim() || undefined,
      costCentre: costCentre.trim(),
      budgetLine: budgetLine.trim() || undefined,
      priority,
      recurring,
      vendor: vendor.trim(),
      vendorGstin: vendorGstin.trim() || undefined,
      invoiceNo: invoiceNo.trim() || undefined,
      paymentMode,
      paymentRef: paymentRef.trim() || undefined,
      amount: Number(amount),
      gstPct: Number(gstPct) || 0,
      bills: bills
        .filter((b) => b.vendor.trim() || b.amount)
        .map((b) => ({ ...b, amount: Number(b.amount) })),
      attachments: files,
      asset: isAsset
        ? {
            ...asset,
            quantity: Number(asset.quantity) || 1,
            unitCost: Number(asset.unitCost) || Math.round(total / (Number(asset.quantity) || 1)),
            usefulLifeYears: Number(asset.usefulLifeYears) || 3,
          }
        : undefined,
      festival: isFestival
        ? {
            ...festival,
            headcount: Number(festival.headcount) || 0,
            perHeadCost:
              Number(festival.perHeadCost) ||
              (festival.headcount ? Math.round(total / Number(festival.headcount)) : 0),
          }
        : undefined,
    });
    toast.success(`${row.id} booked — ${inr(row.total)} under ${row.category}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Book expenditure</DialogTitle>
          <DialogDescription>
            Everything an auditor asks for — what, why, who asked, who it concerns, who approved,
            when, vendor, bills. Outcome can be added once it's known.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <SectionTitle n={1} title="What & why" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" required className="sm:col-span-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Diwali gifts for Bhubaneswar HQ / 4 laptops for new joiners"
              />
            </Field>
            <Field label="Category" required hint={cm.hint || undefined}>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setSubcategory("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENDITURE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                      {CATEGORY_META[c].capex ? " · capex" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sub-category">
              <Select value={subcategory || cm.sub[0]} onValueChange={setSubcategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cm.sub.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Purpose" required className="sm:col-span-2">
              <Textarea
                rows={2}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="What the spend is for"
              />
            </Field>
            <Field label="Reason / justification" required className="sm:col-span-2">
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why it was needed now — budget approval, audit finding, headcount, statutory requirement…"
              />
            </Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENDITURE_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />{" "}
              Recurring spend (monthly / annual)
            </label>
          </div>

          <SectionTitle n={2} title="Who" sub="Department and the people on the record" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Department" required>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Branch / location">
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Who asked for this expense" required>
              <EmployeePicker value={requestedBy} onChange={(id) => setRequestedBy(id)} />
            </Field>
            <Field label="Concerned person (owner / beneficiary)" required>
              <EmployeePicker
                value={concerned}
                onChange={(id, e) => {
                  setConcerned(id);
                  if (e && !department) setDepartment(e.dept);
                  if (e && !branch) setBranch(e.branch);
                }}
              />
            </Field>
            <Field
              label="Pre-approval reference (optional)"
              className="sm:col-span-2"
              hint="E-mail / PO / budget note. Approval itself is always recorded by the approver on the record."
            >
              <Input
                value={preApprovalRef}
                onChange={(e) => setPreApprovalRef(e.target.value)}
                placeholder="e.g. CFO e-mail 12 Aug · PO-2026-118"
              />
            </Field>
          </div>

          <SectionTitle n={3} title="When & where" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Date" required>
              <Input type="date" value={spendDate} onChange={(e) => setSpendDate(e.target.value)} />
            </Field>
            <Field label="Time" required>
              <Input type="time" value={spendTime} onChange={(e) => setSpendTime(e.target.value)} />
            </Field>
            <Field label="Cost centre" required>
              <Input
                value={costCentre}
                onChange={(e) => setCostCentre(e.target.value)}
                placeholder="CC-ENG-02"
              />
            </Field>
            <Field label="Budget line">
              <Input
                value={budgetLine}
                onChange={(e) => setBudgetLine(e.target.value)}
                placeholder="FY27 Capex — IT"
              />
            </Field>
            <Field label="Project" className="sm:col-span-2">
              <Input value={project} onChange={(e) => setProject(e.target.value)} />
            </Field>
            <Field label="Client" className="sm:col-span-2">
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Semtech / RCU / ZooPlus…"
              />
            </Field>
          </div>

          <SectionTitle n={4} title="Vendor, amount & bills" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Vendor" required className="sm:col-span-2">
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
            <Field
              label="Vendor GSTIN"
              hint={gstinOk ? undefined : "Invalid GSTIN — 15 characters, e.g. 21AAAAA0000A1Z5"}
            >
              <Input
                className={cn(!gstinOk && "border-destructive")}
                value={vendorGstin}
                onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
                placeholder="21AAAAA0000A1Z5"
              />
            </Field>
            <Field label="Invoice no.">
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Field>
            <Field label="Taxable amount (₹)" required>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="GST %">
              <Select value={gstPct} onValueChange={setGstPct}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["0", "5", "12", "18", "28"].map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment mode">
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENDITURE_PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment reference">
              <Input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="UTR / cheque / card"
              />
            </Field>
            <div className="bg-muted/40 flex flex-wrap gap-6 rounded-lg p-3 text-sm sm:col-span-4">
              <span>
                Taxable <b>{inr(Number(amount) || 0)}</b>
              </span>
              <span>
                GST <b>{inr(gst)}</b>
              </span>
              <span>
                Total <b className="text-primary">{inr(total)}</b>
              </span>
              {bills.some((b) => b.amount) && (
                <span
                  className={cn(
                    "self-center text-xs",
                    Math.abs(billsTotal - total) > 1 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  Bills add up to {inr(billsTotal)}
                  {Math.abs(billsTotal - total) > 1 ? " — differs from total" : " ✓"}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">
              Bills (one row per bill, attach each)
            </Label>
            {bills.map((b, i) => (
              <div
                key={i}
                className="border-border grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-12"
              >
                <Field label="Date" className="sm:col-span-2">
                  <Input
                    type="date"
                    value={b.date}
                    onChange={(e) => setBill(i, { date: e.target.value })}
                  />
                </Field>
                <Field label="Vendor" className="sm:col-span-3">
                  <Input
                    value={b.vendor}
                    onChange={(e) => setBill(i, { vendor: e.target.value })}
                  />
                </Field>
                <Field label="Bill no." className="sm:col-span-2">
                  <Input
                    value={b.billNo}
                    onChange={(e) => setBill(i, { billNo: e.target.value })}
                  />
                </Field>
                <Field label="Amount (₹)" className="sm:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    value={b.amount || ""}
                    onChange={(e) => setBill(i, { amount: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Attachment" className="sm:col-span-3">
                  <label className="border-border hover:bg-muted flex h-9 cursor-pointer items-center gap-1 rounded-md border border-dashed px-2 text-xs">
                    <Paperclip className="h-3.5 w-3.5" />
                    {b.attachment || "Attach bill"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        captureFiles(e.target.files);
                        setBill(i, { attachment: e.target.files?.[0]?.name ?? "" });
                      }}
                    />
                  </label>
                </Field>
                <Field label="Description" className="sm:col-span-11">
                  <Input
                    value={b.description}
                    onChange={(e) => setBill(i, { description: e.target.value })}
                  />
                </Field>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={bills.length === 1}
                    onClick={() => setBills((l) => l.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBills((l) => [...l, blankBill()])}
            >
              <Plus className="h-4 w-4" /> Add bill
            </Button>
          </div>

          {isAsset && (
            <>
              <SectionTitle
                n={5}
                title="Asset details"
                sub="Capitalised purchases flow into the asset register"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Field label="Asset name / model" required className="sm:col-span-2">
                  <Input
                    value={asset.assetName}
                    onChange={(e) => setAsset({ ...asset, assetName: e.target.value })}
                  />
                </Field>
                <Field label="Quantity">
                  <Input
                    type="number"
                    min={1}
                    value={asset.quantity}
                    onChange={(e) => setAsset({ ...asset, quantity: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Unit cost (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={asset.unitCost || ""}
                    onChange={(e) => setAsset({ ...asset, unitCost: Number(e.target.value) })}
                    placeholder={String(Math.round(total / (asset.quantity || 1)))}
                  />
                </Field>
                <Field label="Asset tag(s)">
                  <Input
                    value={asset.assetTag}
                    onChange={(e) => setAsset({ ...asset, assetTag: e.target.value })}
                    placeholder="assigned on receipt"
                  />
                </Field>
                <Field label="Useful life (years)">
                  <Input
                    type="number"
                    min={1}
                    value={asset.usefulLifeYears}
                    onChange={(e) =>
                      setAsset({ ...asset, usefulLifeYears: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Location">
                  <Input
                    value={asset.location}
                    onChange={(e) => setAsset({ ...asset, location: e.target.value })}
                  />
                </Field>
                <Field label="Custodian">
                  <Input
                    value={asset.custodian}
                    onChange={(e) => setAsset({ ...asset, custodian: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-4">
                  <input
                    type="checkbox"
                    checked={asset.capitalise}
                    onChange={(e) => setAsset({ ...asset, capitalise: e.target.checked })}
                  />{" "}
                  Capitalise (add to asset register & depreciation schedule)
                </label>
              </div>
            </>
          )}
          {isFestival && (
            <>
              <SectionTitle n={5} title="Festival / celebration details" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Field label="Occasion" required>
                  <Input
                    value={festival.occasion}
                    onChange={(e) => setFestival({ ...festival, occasion: e.target.value })}
                    placeholder={subcategory || "Diwali"}
                  />
                </Field>
                <Field label="Beneficiaries" className="sm:col-span-2">
                  <Input
                    value={festival.beneficiaries}
                    onChange={(e) => setFestival({ ...festival, beneficiaries: e.target.value })}
                    placeholder="All HQ staff + contract workers"
                  />
                </Field>
                <Field label="Headcount">
                  <Input
                    type="number"
                    min={0}
                    value={festival.headcount || ""}
                    onChange={(e) =>
                      setFestival({ ...festival, headcount: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Per-head cost (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={festival.perHeadCost || ""}
                    onChange={(e) =>
                      setFestival({ ...festival, perHeadCost: Number(e.target.value) })
                    }
                    placeholder={
                      festival.headcount ? String(Math.round(total / festival.headcount)) : ""
                    }
                  />
                </Field>
                <Field label="Gift / item" className="sm:col-span-3">
                  <Input
                    value={festival.giftType}
                    onChange={(e) => setFestival({ ...festival, giftType: e.target.value })}
                    placeholder="Sweets box, voucher, hamper…"
                  />
                </Field>
              </div>
            </>
          )}

          <SectionTitle n={isAsset || isFestival ? 6 : 5} title="Supporting documents & notes" />
          <AttachmentsInput
            value={attachments}
            onChange={setAttachments}
            label="Other attachments"
            hint="Approval e-mail, PO, quotation comparison, delivery challan…"
          />
          <Field label="Notes">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          {billsError && (
            <span className="text-destructive mr-auto self-center text-xs">{billsError}</span>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={submit}>
            Book {inr(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Reports ---------------- */
function ExpenditureReports({ rows }) {
  const [f, setF] = useState({
    from: "",
    to: "",
    category: "all",
    department: "all",
    status: "all",
  });
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows]);
  const filtered = useMemo(() => filterExpenditures(rows, f), [rows, f]);
  const rep = useMemo(() => expenditureReport(filtered), [filtered]);
  const filters = [
    { label: "Period", value: f.from || f.to ? `${f.from || "…"} → ${f.to || "…"}` : "All" },
    { label: "Category", value: f.category === "all" ? "All" : f.category },
    { label: "Department", value: f.department === "all" ? "All" : f.department },
    { label: "Status", value: f.status === "all" ? "All" : f.status },
  ];
  const summary = [
    { label: "Records", value: String(rep.count) },
    { label: "Total", value: inr(rep.total) },
    { label: "Capex", value: inr(rep.capex) },
    { label: "Opex", value: inr(rep.opex) },
    { label: "GST", value: inr(rep.gst) },
  ];
  const pdf = (title, subtitle, columns, data) => {
    const ok = exportReportPdf({ title, subtitle, filters, summary, columns, rows: data });
    toast[ok ? "success" : "error"](
      ok ? `${title} ready in the print dialog` : "Allow pop-ups to generate the PDF",
    );
  };
  const grpCols = (k) => [k, "Records", "Total", "GST", "Share"];
  const grpRows = (g) =>
    g.map((x) => [
      x.key,
      x.count,
      inr(x.total),
      inr(x.gst),
      rep.total ? `${Math.round((x.total / rep.total) * 100)}%` : "0%",
    ]);
  const detailCols = [
    "Ref",
    "Title",
    "Category",
    "Department",
    "Requested by",
    "Concerned",
    "Approved by",
    "Date",
    "Vendor",
    "Payment",
    "Total",
    "Status",
  ];
  const detailRows = filtered.map((e) => [
    e.id,
    e.title,
    e.category,
    e.department,
    e.requestedBy.name,
    e.concernedPerson.name,
    e.approvedBy?.name ?? "—",
    `${e.spendDate} ${e.spendTime}`,
    e.vendor,
    e.paymentMode,
    inr(e.total),
    e.status,
  ]);

  const Block = ({ title, k, data, onPdf }) => (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <Button size="sm" variant="ghost" onClick={onPdf}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-[10px] tracking-wider uppercase">
            <tr>
              <th className="py-1 text-left">{k}</th>
              <th className="py-1 text-right">#</th>
              <th className="py-1 text-right">Total</th>
              <th className="py-1 text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {data.map((x) => (
              <tr key={x.key}>
                <td className="py-1.5">{x.key}</td>
                <td className="py-1.5 text-right">{x.count}</td>
                <td className="py-1.5 text-right tabular-nums">{inr(x.total)}</td>
                <td className="w-24 py-1.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="bg-muted h-1.5 w-12 overflow-hidden rounded">
                      <div
                        className="bg-primary h-full"
                        style={{ width: `${rep.total ? (x.total / rep.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right">
                      {rep.total ? Math.round((x.total / rep.total) * 100) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground py-4 text-center">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <Field label="From">
            <Input
              type="date"
              value={f.from}
              onChange={(e) => setF({ ...f, from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {EXPENDITURE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Department">
            <Select value={f.department} onValueChange={(v) => setF({ ...f, department: v })}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {EXPENDITURE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                exportCsv("expenditure-report", detailCols, detailRows);
                toast.success("CSV exported");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald text-white"
              onClick={() =>
                pdf(
                  "Expenditure Report",
                  "Detailed expenditure with requester, concerned person and approver",
                  detailCols,
                  detailRows,
                )
              }
            >
              <FileText className="h-4 w-4" /> Full report PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Records", String(rep.count)],
          ["Total", inr(rep.total)],
          ["Capex", inr(rep.capex)],
          ["Opex", inr(rep.opex)],
          ["Paid", inr(rep.paid)],
          ["Payable", inr(rep.payable)],
        ].map(([l, v]) => (
          <Card key={l} className="shadow-card">
            <CardContent className="p-3">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{l}</div>
              <div className="font-bold tabular-nums">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Block
          title="By category"
          k="Category"
          data={rep.byCategory}
          onPdf={() =>
            pdf(
              "Expenditure by Category",
              "Spend grouped by category (capex / opex)",
              grpCols("Category"),
              grpRows(rep.byCategory),
            )
          }
        />
        <Block
          title="By department"
          k="Department"
          data={rep.byDepartment}
          onPdf={() =>
            pdf(
              "Expenditure by Department",
              "Spend grouped by department",
              grpCols("Department"),
              grpRows(rep.byDepartment),
            )
          }
        />
        <Block
          title="By month"
          k="Month"
          data={rep.byMonth.map((m) => ({ ...m, key: monthLabelOf(m.key) }))}
          onPdf={() =>
            pdf(
              "Monthly Expenditure Trend",
              "Spend by month",
              grpCols("Month"),
              grpRows(rep.byMonth.map((m) => ({ ...m, key: monthLabelOf(m.key) }))),
            )
          }
        />
        <Block
          title="Top vendors"
          k="Vendor"
          data={rep.byVendor}
          onPdf={() =>
            pdf(
              "Expenditure by Vendor",
              "Top vendors by spend",
              grpCols("Vendor"),
              grpRows(rep.byVendor),
            )
          }
        />
        <Block
          title="By requester"
          k="Requested by"
          data={rep.byRequester}
          onPdf={() =>
            pdf(
              "Expenditure by Requester",
              "Who asked for the spend",
              grpCols("Requested by"),
              grpRows(rep.byRequester),
            )
          }
        />
        <Block
          title="By payment mode"
          k="Payment mode"
          data={rep.byPayment}
          onPdf={() =>
            pdf(
              "Expenditure by Payment Mode",
              "How the spend was paid",
              grpCols("Payment mode"),
              grpRows(rep.byPayment),
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Festival & celebration spend</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  pdf(
                    "Festival & Celebration Expenditure",
                    "Occasion-wise spend with beneficiaries and per-head cost",
                    [
                      "Ref",
                      "Occasion",
                      "Date",
                      "Beneficiaries",
                      "Headcount",
                      "Per head",
                      "Total",
                      "Status",
                    ],
                    rep.festivals.map((r) => [
                      r.id,
                      r.festival.occasion,
                      r.spendDate,
                      r.festival.beneficiaries,
                      r.festival.headcount,
                      inr(r.festival.perHeadCost),
                      inr(r.total),
                      r.status,
                    ]),
                  )
                }
              >
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground text-[10px] tracking-wider uppercase">
                <tr>
                  <th className="py-1 text-left">Occasion</th>
                  <th className="py-1 text-left">Date</th>
                  <th className="py-1 text-right">Headcount</th>
                  <th className="py-1 text-right">Per head</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rep.festivals.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5">
                      {r.festival.occasion}
                      <div className="text-muted-foreground">{r.festival.beneficiaries}</div>
                    </td>
                    <td className="py-1.5">
                      <span className="whitespace-nowrap">{r.spendDate}</span>
                    </td>
                    <td className="py-1.5 text-right">{r.festival.headcount}</td>
                    <td className="py-1.5 text-right">{inr(r.festival.perHeadCost)}</td>
                    <td className="py-1.5 text-right tabular-nums">{inr(r.total)}</td>
                  </tr>
                ))}
                {rep.festivals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground py-4 text-center">
                      No festival spend in range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Asset purchases (capex)</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  pdf(
                    "Asset Purchase Register",
                    "Capitalised purchases with custodian and useful life",
                    [
                      "Ref",
                      "Asset",
                      "Qty",
                      "Unit cost",
                      "Total",
                      "Tag",
                      "Custodian",
                      "Location",
                      "Life (yrs)",
                      "Status",
                    ],
                    rep.assets.map((r) => [
                      r.id,
                      r.asset.assetName,
                      r.asset.quantity,
                      inr(r.asset.unitCost),
                      inr(r.total),
                      r.asset.assetTag ?? "—",
                      r.asset.custodian,
                      r.asset.location,
                      r.asset.usefulLifeYears,
                      r.status,
                    ]),
                  )
                }
              >
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground text-[10px] tracking-wider uppercase">
                <tr>
                  <th className="py-1 text-left">Asset</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-left">Custodian</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rep.assets.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5">
                      {r.asset.assetName}
                      <div className="text-muted-foreground">
                        {r.asset.location} · {r.asset.usefulLifeYears} yrs
                      </div>
                    </td>
                    <td className="py-1.5 text-right">{r.asset.quantity}</td>
                    <td className="py-1.5">{r.asset.custodian}</td>
                    <td className="py-1.5 text-right tabular-nums">{inr(r.total)}</td>
                  </tr>
                ))}
                {rep.assets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground py-4 text-center">
                      No asset purchases in range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
