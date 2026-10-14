// Org-side Asset Lifecycle workspace: Register, Issuance & Returns, Condition Issues, Requests, Transfers, Licenses.
// One shared record set with the employee "My Assets" view. Asset types / checklists come from Master Data → Assets.
import { useState } from "react";
import {
  Boxes,
  Plus,
  Download,
  KeyRound,
  ArrowLeftRight,
  Undo2,
  CheckCircle2,
  XCircle,
  Search,
  ShieldAlert,
  Settings2,
} from "lucide-react";
import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
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
import { useCurrentUser, can } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { inr } from "@/lib/store";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { canActOn, chainSummary } from "@/features/administration/data/approval-chain";
import { Field, EmployeePicker, KV } from "@/features/employees/components/CasePieces";
import {
  useAssets,
  useIssuances,
  useAssetRequests,
  useAssetTransfers,
  useAssetIssues,
  useAssetMaster,
  deleteAsset,
  retireAsset,
  transferAsset,
  acknowledgeTransfer,
  decideAssetRequest,
  markRequestFulfilled,
  bookValue,
} from "@/features/assets/data/asset-data";
import {
  NewAssetForm,
  IssueAssetForm,
  ReturnCheckForm,
  AssetIssueDetail,
  AssetDetail,
  ChecklistEditor,
  empName,
  assetStatusTone,
  issueStatusTone,
  severityTone,
} from "@/features/assets/components/AssetPieces";
import { useScopeMatch } from "@/features/organization/data/tenancy";

function Head({ icon: Icon, title, desc, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-muted-foreground text-xs">{desc}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function AssetsWorkspace() {
  const me = useCurrentUser();
  const manage = can(me.role, "asset.manage") || can(me.role, "asset.issue");
  const activeOrgId = useActiveOrgId();
  const allAssets = useAssets();
  const allIssuances = useIssuances();
  const allRequests = useAssetRequests();
  const allTransfers = useAssetTransfers();
  const allIssues = useAssetIssues();
  const master = useAssetMaster();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [detailAssetId, setDetailAssetId] = useState(null);
  const [detailIssuance, setDetailIssuance] = useState(null);
  const [detailTransfer, setDetailTransfer] = useState(null);
  const [detailIssueId, setDetailIssueId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [issueFor, setIssueFor] = useState(null);
  const [returnFor, setReturnFor] = useState(null);
  const [transferFor, setTransferFor] = useState(null);
  const [issueFilter, setIssueFilter] = useState("open");

  // Assets are organisation-scoped — only show this org's own records.
  const inScope = useScopeMatch();
  const assets = allAssets.filter((a) => inScope(a.orgId, a.assignedTo ?? a.holderId));
  const assetIdsInOrg = new Set(assets.map((a) => a.id));
  const issuances = allIssuances.filter((i) => assetIdsInOrg.has(i.assetId));
  const requests = allRequests.filter((r) => inScope(r.orgId, r.employeeId));
  const transfers = allTransfers.filter((t) => assetIdsInOrg.has(t.assetId));
  const issues = allIssues.filter((i) => assetIdsInOrg.has(i.assetId));
  const detailAsset = assets.find((a) => a.id === detailAssetId) ?? null;
  const detailIssue = issues.find((i) => i.id === detailIssueId) ?? null;

  const filtered = assets.filter(
    (a) =>
      (statusFilter === "all" || a.status === statusFilter) &&
      (typeFilter === "all" || a.type === typeFilter) &&
      [a.tag, a.name, a.type, a.serial, a.model ?? "", a.vendor, empName(a.holderId)]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const spend = assets.reduce((s, a) => s + a.cost, 0);
  const licenses = assets.filter((a) => a.kind === "Software License");
  const pendingReturns = issuances.filter(
    (i) => i.status === "Active" && i.returnStatus === "Requested",
  );
  const openIssues = issues.filter((i) => i.status !== "Resolved" && i.status !== "Closed");
  const shownIssues = issues.filter(
    (i) =>
      issueFilter === "all" ||
      (issueFilter === "open"
        ? i.status !== "Resolved" && i.status !== "Closed"
        : i.status === issueFilter),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { l: "Total assets", v: String(assets.length) },
          { l: "Issued", v: String(assets.filter((a) => a.status === "Issued").length) },
          { l: "Returns to check", v: String(pendingReturns.length) },
          { l: "Open condition issues", v: String(openIssues.length) },
          { l: "Capital value", v: inr(spend) },
        ].map((s) => (
          <Card key={s.l} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                {s.l}
              </div>
              <div className="mt-1 text-xl font-bold">{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="register">
        <ScrollTabsList>
          <TabsTrigger value="register">Asset Register</TabsTrigger>
          <TabsTrigger value="issuance">
            Issuance & Returns
            {pendingReturns.length > 0 && (
              <Badge variant="outline" className="border-gold/60 text-gold ml-1">
                {pendingReturns.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="issues">
            <ShieldAlert className="h-4 w-4" /> Condition Issues
            {openIssues.length > 0 && (
              <Badge variant="outline" className="ml-1">
                {openIssues.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests ({requests.filter((r) => r.status === "Pending").length})
          </TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="licenses">Licenses</TabsTrigger>
        </ScrollTabsList>

        {/* ---------------- Register ---------------- */}
        <TabsContent value="register" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <Head
                icon={Boxes}
                title="Asset Register"
                desc="Every asset owned by this organisation — types, checklists and accessories are defined in Master Data → Assets."
              >
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search tag, serial, model, holder"
                    className="w-full pl-8 sm:w-56"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {master.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {[
                      "In Stock",
                      "Issued",
                      "Return Pending",
                      "Under Maintenance",
                      "Retired",
                      "Lost",
                    ].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportCsv(
                      "asset-register",
                      [
                        "Tag",
                        "Asset",
                        "Model",
                        "Type",
                        "Serial",
                        "Vendor",
                        "Invoice",
                        "Purchased",
                        "Warranty till",
                        "Cost",
                        "Book value",
                        "Condition",
                        "Status",
                        "Holder",
                        "Location",
                      ],
                      filtered.map((a) => [
                        a.tag,
                        a.name,
                        a.model ?? "",
                        a.type,
                        a.licenseKey ?? a.serial,
                        a.vendor,
                        a.invoiceNo ?? "",
                        a.purchaseDate,
                        a.warrantyTill ?? "",
                        a.cost,
                        bookValue(a),
                        a.condition,
                        a.status,
                        empName(a.holderId),
                        a.location ?? "",
                      ]),
                    );
                    toast.success("Asset register exported");
                  }}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportReportPdf({
                      title: "Asset Register",
                      subtitle: "Organisation-owned assets with custody and book value",
                      filters: [
                        { label: "Type", value: typeFilter === "all" ? "All" : typeFilter },
                        { label: "Status", value: statusFilter === "all" ? "All" : statusFilter },
                      ],
                      summary: [
                        { label: "Assets", value: String(assets.length) },
                        {
                          label: "Issued",
                          value: String(assets.filter((a) => a.status === "Issued").length),
                        },
                        { label: "Capital value", value: inr(spend) },
                        {
                          label: "Book value",
                          value: inr(assets.reduce((s, a) => s + bookValue(a), 0)),
                        },
                      ],
                      columns: [
                        "Tag",
                        "Asset",
                        "Type",
                        "Serial",
                        "Purchased",
                        "Cost",
                        "Book value",
                        "Status",
                        "Holder",
                      ],
                      rows: filtered.map((a) => [
                        a.tag,
                        a.name,
                        a.type,
                        a.licenseKey ?? a.serial,
                        a.purchaseDate,
                        inr(a.cost),
                        inr(bookValue(a)),
                        a.status,
                        empName(a.holderId),
                      ]),
                    });
                  }}
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
                {manage && (
                  <Link href={buildHref({ to: "/org/masters", hash: "assetmaster" })}>
                    <Button variant="outline" size="sm">
                      <Settings2 className="h-4 w-4" /> Asset master
                    </Button>
                  </Link>
                )}
                {manage && (
                  <Button
                    size="sm"
                    className="bg-gradient-emerald shadow-premium text-white"
                    onClick={() => setNewOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Add Asset
                  </Button>
                )}
              </Head>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                      {[
                        "Tag",
                        "Asset",
                        "Type",
                        "Serial / Key",
                        "Purchased",
                        "Cost · Book",
                        "Condition",
                        "Status",
                        "Holder",
                        "",
                      ].map((h) => (
                        <th key={h} className="py-2.5 pr-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const active = issuances.find(
                        (i) => i.assetId === a.id && i.status === "Active",
                      );
                      return (
                        <tr
                          key={a.id}
                          className={`border-border/60 border-b ${clickableRow}`}
                          onClick={() => setDetailAssetId(a.id)}
                        >
                          <td className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap">
                            {a.tag}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="font-medium">{a.name}</div>
                            <div className="text-muted-foreground text-xs">
                              {a.model ?? a.vendor}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">{a.type}</td>
                          <td className="py-2.5 pr-3 font-mono text-xs">
                            {a.licenseKey ?? a.serial}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            <span className="whitespace-nowrap">{a.purchaseDate}</span>
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {inr(a.cost)}
                            <div className="text-muted-foreground text-xs">{inr(bookValue(a))}</div>
                          </td>
                          <td className="py-2.5 pr-3">{a.condition}</td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline" className={assetStatusTone[a.status]}>
                              {a.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3">
                            {empName(a.holderId)}
                            {active && !active.employeeAck && (
                              <div className="text-gold text-[10px]">ack pending</div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3" onClick={(e) => e.stopPropagation()}>
                            {manage && (
                              <div className="flex gap-1.5">
                                {a.status === "In Stock" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIssueFor({ asset: a })}
                                  >
                                    Issue
                                  </Button>
                                )}
                                {(a.status === "Issued" || a.status === "Return Pending") &&
                                  active && (
                                    <Button
                                      size="sm"
                                      variant={
                                        a.status === "Return Pending" ? "default" : "outline"
                                      }
                                      className={
                                        a.status === "Return Pending"
                                          ? "bg-gradient-emerald text-white"
                                          : ""
                                      }
                                      onClick={() => setReturnFor(active)}
                                    >
                                      <Undo2 className="h-3.5 w-3.5" /> Return check
                                    </Button>
                                  )}
                                {a.status === "Issued" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setTransferFor(a)}
                                  >
                                    <ArrowLeftRight className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-muted-foreground py-8 text-center text-sm">
                          No assets match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Issuance & Returns ---------------- */}
        <TabsContent value="issuance" className="space-y-4 pt-4">
          {pendingReturns.length > 0 && (
            <Card className="shadow-card border-gold/40">
              <CardContent className="p-5">
                <Head
                  icon={Undo2}
                  title="Returns awaiting check"
                  desc="Employees have handed these back — verify the same checklist as at issue, then approve or open a condition issue."
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {pendingReturns.map((i) => {
                    const a = assets.find((x) => x.id === i.assetId);
                    return (
                      <div
                        key={i.id}
                        className="border-border flex flex-wrap items-center gap-3 rounded-xl border p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            {a?.tag} · {a?.name}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {empName(i.employeeId)} · requested{" "}
                            <span className="whitespace-nowrap">{i.returnRequestedOn}</span>
                            {i.employeeReturnRemarks ? ` · “${i.employeeReturnRemarks}”` : ""}
                          </div>
                        </div>
                        {manage && (
                          <Button
                            size="sm"
                            className="bg-gradient-emerald text-white"
                            onClick={() => setReturnFor(i)}
                          >
                            Run return check
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="shadow-card">
            <CardContent className="p-5">
              <Head
                icon={CheckCircle2}
                title="Issuance & Returns"
                desc="Every issuance recorded against an employee — purpose, expected return, checklist at issue and at return."
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCsv(
                      "asset-issuance",
                      [
                        "Issuance",
                        "Asset",
                        "Employee",
                        "Issued on",
                        "By",
                        "Purpose",
                        "Expected return",
                        "Ack",
                        "Returned on",
                        "Outcome",
                        "Condition (return)",
                        "Recovery",
                        "Status",
                      ],
                      issuances.map((i) => {
                        const a = assets.find((x) => x.id === i.assetId);
                        return [
                          i.id,
                          `${a?.tag ?? i.assetId} ${a?.name ?? ""}`,
                          empName(i.employeeId),
                          i.issuedOn,
                          i.issuedBy ?? "",
                          i.purpose ?? "",
                          i.expectedReturn ?? "Until separation",
                          i.employeeAck ? "Yes" : "No",
                          i.returnedOn ?? "",
                          i.returnOutcome ?? "",
                          i.conditionOnReturn ?? "",
                          i.deduction ?? 0,
                          i.status,
                        ];
                      }),
                    )
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </Head>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                      {[
                        "Issuance",
                        "Asset",
                        "Employee",
                        "Issued",
                        "Purpose",
                        "Expected return",
                        "Ack",
                        "Return",
                        "Outcome",
                        "Recovery",
                        "Status",
                      ].map((h) => (
                        <th key={h} className="py-2.5 pr-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {issuances.map((i) => {
                      const asset = assets.find((a) => a.id === i.assetId);
                      return (
                        <tr
                          key={i.id}
                          className={`border-border/60 border-b ${clickableRow}`}
                          onClick={() => setDetailIssuance(i)}
                        >
                          <td className="py-2.5 pr-3 font-mono text-xs">{i.id}</td>
                          <td className="py-2.5 pr-3">
                            {asset?.tag} · {asset?.name}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">{empName(i.employeeId)}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            <span className="whitespace-nowrap">{i.issuedOn}</span>
                          </td>
                          <td className="py-2.5 pr-3">{i.purpose ?? "—"}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {i.expectedReturn ?? "Until separation"}
                          </td>
                          <td className="py-2.5 pr-3">
                            {i.employeeAck ? (
                              <CheckCircle2 className="text-primary h-4 w-4" />
                            ) : (
                              <span className="text-gold text-xs">Pending</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {i.returnedOn ??
                              (i.returnStatus === "Requested" ? (
                                <span className="text-gold text-xs">
                                  Requested{" "}
                                  <span className="whitespace-nowrap">{i.returnRequestedOn}</span>
                                </span>
                              ) : i.returnStatus === "Issue raised" ? (
                                <span className="text-destructive text-xs">Issue {i.issueId}</span>
                              ) : (
                                "—"
                              ))}
                          </td>
                          <td className="py-2.5 pr-3">{i.returnOutcome ?? "—"}</td>
                          <td className="py-2.5 pr-3">{i.deduction ? inr(i.deduction) : "—"}</td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline">{i.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Condition issues ---------------- */}
        <TabsContent value="issues" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <Head
                icon={ShieldAlert}
                title="Asset Condition Issues"
                desc="Damaged / not-working assets from return checks or employee reports. Asset manager assesses the cause → mishandling goes to the manager, then Finance for recovery; asset faults go to repair / replacement."
              >
                <Select value={issueFilter} onValueChange={setIssueFilter}>
                  <SelectTrigger className="w-full sm:w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open (all stages)</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                    {[
                      "Open",
                      "Under assessment",
                      "Manager review",
                      "Finance review",
                      "Repair / replacement",
                      "Resolved",
                      "Closed",
                    ].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportReportPdf({
                      title: "Asset Condition Issues",
                      subtitle: "Damage / breakdown tracking with cause and recovery",
                      columns: [
                        "Issue",
                        "Asset",
                        "Holder",
                        "Category",
                        "Severity",
                        "Cause",
                        "Stage",
                        "Est. cost",
                        "Recovery",
                      ],
                      rows: shownIssues.map((i) => {
                        const a = assets.find((x) => x.id === i.assetId);
                        return [
                          i.id,
                          `${a?.tag ?? ""} ${a?.name ?? i.assetId}`,
                          empName(i.employeeId),
                          i.category,
                          i.severity,
                          i.cause,
                          i.status,
                          i.estimatedCost ? inr(i.estimatedCost) : "—",
                          i.recoveryAmount ? inr(i.recoveryAmount) : "—",
                        ];
                      }),
                    })
                  }
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </Head>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["Manager review", "Awaiting manager remarks"],
                  ["Finance review", "Awaiting Finance"],
                  ["Repair / replacement", "In repair / replacement"],
                ].map(([s, l]) => (
                  <div key={s} className="border-border rounded-lg border p-3">
                    <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                      {l}
                    </div>
                    <div className="text-lg font-bold">
                      {issues.filter((i) => i.status === s).length}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                      {[
                        "Issue",
                        "Asset",
                        "Holder",
                        "Category",
                        "Severity",
                        "Source",
                        "Cause",
                        "Est. cost",
                        "Recovery",
                        "Stage",
                      ].map((h) => (
                        <th key={h} className="py-2.5 pr-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownIssues.map((i) => {
                      const a = assets.find((x) => x.id === i.assetId);
                      return (
                        <tr
                          key={i.id}
                          className={`border-border/60 border-b ${clickableRow}`}
                          onClick={() => setDetailIssueId(i.id)}
                        >
                          <td className="py-2.5 pr-3 font-mono text-xs">
                            {i.id}
                            <div className="text-muted-foreground text-[10px]">
                              <span className="whitespace-nowrap">{i.raisedOn}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="font-medium">{a?.name ?? i.assetId}</div>
                            <div className="text-muted-foreground text-xs">{a?.tag}</div>
                          </td>
                          <td className="py-2.5 pr-3">{empName(i.employeeId)}</td>
                          <td className="py-2.5 pr-3">{i.category}</td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline" className={severityTone(i.severity)}>
                              {i.severity}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-xs">{i.source}</td>
                          <td className="py-2.5 pr-3 text-xs">{i.cause}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {i.estimatedCost ? inr(i.estimatedCost) : "—"}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {i.recoveryAmount
                              ? `${inr(i.recoveryAmount)} · ${i.recoveryMode}`
                              : i.financeDecision === "Waive"
                                ? "Waived"
                                : "—"}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline" className={issueStatusTone(i.status)}>
                              {i.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {shownIssues.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-muted-foreground py-8 text-center text-sm">
                          No condition issues in this view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Requests ---------------- */}
        <TabsContent value="requests" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <Head
                icon={Plus}
                title="Asset Requests"
                desc="Employee requests routed through the HOD → HR → Admin approval chain, then fulfilled from stock."
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportReportPdf({
                      title: "Asset Requests",
                      subtitle: "Employee requests and approval stage",
                      columns: [
                        "Request",
                        "Employee",
                        "Asset",
                        "Purpose",
                        "Needed by",
                        "Urgency",
                        "Stage",
                        "Status",
                      ],
                      rows: requests.map((r) => [
                        r.id,
                        r.employeeName,
                        r.assetType,
                        r.purpose ?? "—",
                        r.neededBy ?? "—",
                        r.urgency,
                        chainSummary(r.chain),
                        r.status,
                      ]),
                    })
                  }
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </Head>
              <div className="space-y-3">
                {requests.length === 0 && (
                  <div className="text-muted-foreground text-sm">No asset requests yet.</div>
                )}
                {requests.map((r) => (
                  <div key={r.id} className="border-border rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.assetType}</span>
                          <Badge variant="outline" className={assetStatusTone[r.status] ?? ""}>
                            {r.status}
                          </Badge>
                          <Badge variant="outline">{r.urgency}</Badge>
                          {r.neededBy && <Badge variant="outline">Needed by {r.neededBy}</Badge>}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          {r.id} · {r.employeeName} · raised{" "}
                          <span className="whitespace-nowrap">{r.raisedOn}</span>
                          {r.purpose ? ` · ${r.purpose}` : ""}
                          {r.project ? ` · ${r.project}` : ""}
                          {r.duration ? ` · ${r.duration}` : ""}
                        </div>
                        <div className="mt-2 text-sm">{r.reason}</div>
                        {r.specifications && (
                          <div className="text-muted-foreground mt-1 text-xs">
                            Specs: {r.specifications}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.status === "Pending" &&
                          r.employeeId !== me.id &&
                          canActOn(r.chain, me.id, me.role) && (
                            <>
                              <Button
                                size="sm"
                                className="bg-gradient-emerald text-white"
                                onClick={() => {
                                  if (decideAssetRequest(r.id, me.id, "Approved"))
                                    toast.success("Approved");
                                  else toast.error("You cannot decide this request");
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  if (
                                    decideAssetRequest(
                                      r.id,
                                      me.id,
                                      "Rejected",
                                      "Rejected by approver",
                                    )
                                  )
                                    toast.success("Rejected");
                                  else toast.error("You cannot decide this request");
                                }}
                              >
                                <XCircle className="h-4 w-4" /> Reject
                              </Button>
                            </>
                          )}
                        {r.status === "Approved" && manage && (
                          <FulfilPicker
                            requestId={r.id}
                            assetType={r.assetType}
                            assets={assets}
                            onPick={(a) =>
                              setIssueFor({
                                asset: a,
                                presetEmployeeId: r.employeeId,
                                requestId: r.id,
                              })
                            }
                          />
                        )}
                        {r.status === "Issued" && r.issuedAssetId && (
                          <Badge variant="outline" className="self-center">
                            Issued:{" "}
                            {assets.find((a) => a.id === r.issuedAssetId)?.tag ?? r.issuedAssetId}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.chain.map((s, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={assetStatusTone[s.status] ?? ""}
                        >
                          {s.label}: {s.approverName} · {s.status}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Transfers ---------------- */}
        <TabsContent value="transfers" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <Head
                icon={ArrowLeftRight}
                title="Transfers & Handover"
                desc="Asset handovers between employees inside this organisation."
              />
              {transfers.length === 0 ? (
                <div className="text-muted-foreground text-sm">
                  No transfers recorded. Use “Transfer” on an issued asset in the register.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                        {[
                          "Transfer",
                          "Asset",
                          "From",
                          "To",
                          "Handover",
                          "Condition",
                          "Acknowledgements",
                        ].map((h) => (
                          <th key={h} className="py-2.5 pr-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((t) => {
                        const asset = assets.find((a) => a.id === t.assetId);
                        return (
                          <tr
                            key={t.id}
                            className={`border-border/60 border-b ${clickableRow}`}
                            onClick={() => setDetailTransfer(t)}
                          >
                            <td className="py-2.5 pr-3 font-mono text-xs">{t.id}</td>
                            <td className="py-2.5 pr-3">
                              {asset?.tag} · {asset?.name}
                            </td>
                            <td className="py-2.5 pr-3">{empName(t.fromId)}</td>
                            <td className="py-2.5 pr-3">{empName(t.toId)}</td>
                            <td className="py-2.5 pr-3">
                              <span className="whitespace-nowrap">{t.handoverDate}</span>
                            </td>
                            <td className="py-2.5 pr-3">{t.condition}</td>
                            <td className="py-2.5 pr-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-wrap gap-1.5">
                                <Button
                                  size="sm"
                                  variant={t.fromAck ? "secondary" : "outline"}
                                  disabled={!manage || t.fromAck}
                                  onClick={() => {
                                    acknowledgeTransfer(t.id, "from");
                                    toast.success(`Handover by ${empName(t.fromId)} acknowledged`);
                                  }}
                                >
                                  {t.fromAck ? "From ✓" : "Ack (from)"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={t.toAck ? "secondary" : "outline"}
                                  disabled={!manage || t.toAck}
                                  onClick={() => {
                                    acknowledgeTransfer(t.id, "to");
                                    toast.success(`Receipt by ${empName(t.toId)} acknowledged`);
                                  }}
                                >
                                  {t.toAck ? "To ✓" : "Ack (to)"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Licenses ---------------- */}
        <TabsContent value="licenses" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <Head
                icon={KeyRound}
                title="Software Licenses"
                desc="SAP, AWS and other seat-based licenses with renewal dates."
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                      {[
                        "Tag",
                        "License",
                        "Vendor",
                        "Key / Seat ref",
                        "Seats",
                        "Renewal",
                        "Assigned to",
                        "Annual cost",
                      ].map((h) => (
                        <th key={h} className="py-2.5 pr-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((a) => (
                      <tr
                        key={a.id}
                        className={`border-border/60 border-b ${clickableRow}`}
                        onClick={() => setDetailAssetId(a.id)}
                      >
                        <td className="py-2.5 pr-3 font-mono text-xs">{a.tag}</td>
                        <td className="py-2.5 pr-3 font-medium">{a.name}</td>
                        <td className="py-2.5 pr-3">{a.vendor}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{a.licenseKey}</td>
                        <td className="py-2.5 pr-3">{a.seats ?? "—"}</td>
                        <td className="py-2.5 pr-3">
                          <span className="whitespace-nowrap">{a.renewalDate ?? "—"}</span>
                        </td>
                        <td className="py-2.5 pr-3">{empName(a.holderId)}</td>
                        <td className="py-2.5 pr-3">{inr(a.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---------------- dialogs ---------------- */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {newOpen && (
            <NewAssetForm
              orgId={activeOrgId}
              onDone={(id) => {
                setNewOpen(false);
                if (id) setDetailAssetId(id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailAsset} onOpenChange={(o) => !o && setDetailAssetId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {detailAsset && (
            <AssetDetail
              asset={detailAsset}
              canManage={manage}
              onIssue={() => setIssueFor({ asset: detailAsset })}
              onReturnCheck={(iss) => setReturnFor(iss)}
              onTransfer={() => setTransferFor(detailAsset)}
              onRetire={() => {
                if (
                  !window.confirm(
                    `Retire ${detailAsset.tag}?${detailAsset.holderId ? ` It is held by ${empName(detailAsset.holderId)} — the issuance will be closed.` : ""}`,
                  )
                )
                  return;
                retireAsset(detailAsset.id, "Retired by asset manager", me.name);
                toast.success(`${detailAsset.tag} retired`);
              }}
              onDelete={() => {
                if (detailAsset.holderId) {
                  toast.error(
                    `${detailAsset.tag} is held by ${empName(detailAsset.holderId)} — take it back (return check) before deleting`,
                  );
                  return;
                }
                if (
                  !window.confirm(
                    `Delete ${detailAsset.tag} from the register? Its issuance history is removed too.`,
                  )
                )
                  return;
                deleteAsset(detailAsset.id);
                toast.success("Asset deleted");
                setDetailAssetId(null);
              }}
              onOpenIssue={(id) => setDetailIssueId(id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!issueFor} onOpenChange={(o) => !o && setIssueFor(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {issueFor && (
            <IssueAssetForm
              asset={issueFor.asset}
              presetEmployeeId={issueFor.presetEmployeeId}
              requestNote={issueFor.requestId ? `Fulfils ${issueFor.requestId}` : undefined}
              onDone={(ok) => {
                if (ok && issueFor.requestId)
                  markRequestFulfilled(issueFor.requestId, issueFor.asset.id);
                setIssueFor(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!returnFor} onOpenChange={(o) => !o && setReturnFor(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {returnFor && (
            <ReturnCheckForm
              issuance={returnFor}
              onDone={(r) => {
                setReturnFor(null);
                if (r?.issueId) setDetailIssueId(r.issueId);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailIssue} onOpenChange={(o) => !o && setDetailIssueId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {detailIssue && <AssetIssueDetail issue={detailIssue} mode="manage" />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferFor} onOpenChange={(o) => !o && setTransferFor(null)}>
        <DialogContent>
          {transferFor && <TransferForm asset={transferFor} onDone={() => setTransferFor(null)} />}
        </DialogContent>
      </Dialog>

      {detailIssuance &&
        (() => {
          const asset = assets.find((a) => a.id === detailIssuance.assetId);
          return (
            <RecordDetailDialog
              onClose={() => setDetailIssuance(null)}
              title={`${detailIssuance.id} · ${empName(detailIssuance.employeeId)}`}
              subtitle={asset ? `${asset.tag} · ${asset.name}` : detailIssuance.assetId}
              badges={<Badge variant="outline">{detailIssuance.status}</Badge>}
              record={{
                ...detailIssuance,
                asset: asset ? `${asset.tag} · ${asset.name}` : detailIssuance.assetId,
                employee: empName(detailIssuance.employeeId),
                expectedReturn: detailIssuance.expectedReturn ?? "Until separation",
                employeeAck: detailIssuance.employeeAck
                  ? `Yes · ${detailIssuance.ackOn}`
                  : "Pending",
                accessoriesIssued: (detailIssuance.accessoriesIssued ?? []).join(", "),
                accessoriesReturned: (detailIssuance.accessoriesReturned ?? []).join(", "),
              }}
              hide={["assetId", "employeeId", "checklistOnIssue", "checklistOnReturn", "issueId"]}
              sections={[
                {
                  title: "Issuance",
                  keys: [
                    "id",
                    "asset",
                    "employee",
                    "issuedOn",
                    "issuedBy",
                    "purpose",
                    "expectedReturn",
                    "location",
                    "serialVerified",
                    "conditionOnIssue",
                    "accessoriesIssued",
                    "employeeAck",
                    "notes",
                    "status",
                  ],
                },
                {
                  title: "Return",
                  keys: [
                    "returnStatus",
                    "returnRequestedOn",
                    "employeeReturnRemarks",
                    "returnedOn",
                    "returnCheckedBy",
                    "returnOutcome",
                    "conditionOnReturn",
                    "accessoriesReturned",
                    "returnRemarks",
                    "deduction",
                    "returnApprovedBy",
                  ],
                },
              ]}
            >
              <div className="space-y-3">
                {(detailIssuance.checklistOnIssue?.length ?? 0) > 0 && (
                  <ChecklistEditor
                    value={detailIssuance.checklistOnIssue}
                    title="Checklist at issue"
                    readOnly
                  />
                )}
                {(detailIssuance.checklistOnReturn?.length ?? 0) > 0 && (
                  <ChecklistEditor
                    value={detailIssuance.checklistOnReturn}
                    title="Checklist at return"
                    readOnly
                  />
                )}
                {detailIssuance.issueId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailIssueId(detailIssuance.issueId);
                      setDetailIssuance(null);
                    }}
                  >
                    <ShieldAlert className="h-4 w-4" /> Open condition issue{" "}
                    {detailIssuance.issueId}
                  </Button>
                )}
              </div>
            </RecordDetailDialog>
          );
        })()}
      {detailTransfer &&
        (() => {
          const asset = assets.find((a) => a.id === detailTransfer.assetId);
          return (
            <RecordDetailDialog
              onClose={() => setDetailTransfer(null)}
              title={`${detailTransfer.id} · ${asset ? asset.tag : detailTransfer.assetId}`}
              subtitle={`${empName(detailTransfer.fromId)} → ${empName(detailTransfer.toId)}`}
              record={{
                ...detailTransfer,
                asset: asset ? `${asset.tag} · ${asset.name}` : detailTransfer.assetId,
                from: empName(detailTransfer.fromId),
                to: empName(detailTransfer.toId),
              }}
              hide={["assetId", "fromId", "toId"]}
              sections={[
                {
                  title: "Transfer",
                  keys: ["id", "asset", "from", "to", "handoverDate", "condition", "notes"],
                },
                { title: "Acknowledgements", keys: ["fromAck", "toAck"] },
              ]}
              labels={{ fromAck: "Acknowledged by sender", toAck: "Acknowledged by receiver" }}
            />
          );
        })()}
    </div>
  );
}

function FulfilPicker({ requestId, assetType, assets, onPick }) {
  const stock = assets.filter((a) => a.status === "In Stock");
  const preferred = stock.filter((a) => a.type === assetType);
  const [assetId, setAssetId] = useState(preferred[0]?.id ?? stock[0]?.id ?? "");
  return (
    <div className="flex items-end gap-2">
      <Field label={`Fulfil ${requestId} from stock`}>
        <Select value={assetId} onValueChange={setAssetId}>
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue placeholder="Select asset" />
          </SelectTrigger>
          <SelectContent>
            {[...preferred, ...stock.filter((a) => a.type !== assetType)].map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.tag} · {a.name}
                {a.type !== assetType ? ` (${a.type})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button
        size="sm"
        disabled={!assetId}
        className="bg-gradient-emerald text-white"
        onClick={() => {
          const a = assets.find((x) => x.id === assetId);
          if (a) onPick(a);
        }}
      >
        Issue…
      </Button>
    </div>
  );
}

function TransferForm({ asset, onDone }) {
  const [toId, setToId] = useState("");
  const [condition, setCondition] = useState(asset.condition);
  const [notes, setNotes] = useState("");
  return (
    <>
      <DialogHeader>
        <DialogTitle>Transfer {asset.tag}</DialogTitle>
        <DialogDescription>
          Handover from {empName(asset.holderId)} to another employee in this organisation. Both
          sides acknowledge.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Field label="Transfer to" required>
          <EmployeePicker
            value={toId}
            onChange={(id) => setToId(id)}
            exclude={asset.holderId ? [asset.holderId] : []}
          />
        </Field>
        <Field label="Condition at handover">
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Excellent", "Good", "Fair", "Poor"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <KV
          items={[
            ["Accessories moving with it", (asset.accessories ?? []).join(", ") || "—"],
            ["Serial", asset.serial],
          ]}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!toId}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            const t = transferAsset(asset.id, toId, condition, notes);
            if (!t) {
              toast.error(
                `${asset.tag} can only be transferred while it is issued and in normal use`,
              );
              return;
            }
            toast.success(`${asset.tag} transferred to ${empName(toId)}`);
            onDone();
          }}
        >
          Record transfer
        </Button>
      </DialogFooter>
    </>
  );
}
