// Self-service assets: what I hold today, acknowledge receipt, return an asset, report a condition issue and
// follow the issue through assessment → manager → finance → resolution. Requests with their approval trail.
import { useState } from "react";
import {
  Laptop,
  Plus,
  KeyRound,
  Download,
  Undo2,
  ShieldAlert,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useCurrentUser, can } from "@/features/auth/data/auth-session";
import { exportReportPdf } from "@/lib/export-utils";
import { useProjects } from "@/features/projects/data/project-data";
import { Field, KV } from "@/features/employees/components/CasePieces";
import {
  useMyAssets,
  useMyAssetRequests,
  useMyAssetIssues,
  useIssuances,
  useAssetMaster,
  useAssets,
  useAssetIssues,
  submitAssetRequest,
  acknowledgeIssuance,
  requestReturn,
  issueSteps,
  issueStepIndex,
  canManagerReviewIssue,
  canFinanceReviewIssue,
} from "@/features/assets/data/asset-data";
import {
  ReportIssueForm,
  AssetIssueDetail,
  ChecklistEditor,
  assetStatusTone,
  issueStatusTone,
  severityTone,
  empName,
} from "@/features/assets/components/AssetPieces";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const tone = {
  Pending: "bg-gold/15 text-gold border-gold/40",
  Approved: "bg-primary/10 text-primary border-primary/20",
  Issued: "bg-primary/10 text-primary border-primary/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

/** Compact card for the employee profile / dashboard. */
export function MyAssetsCard({ employeeId }) {
  const assets = useMyAssets(employeeId);
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Laptop className="text-primary h-4 w-4" />
          <span className="text-sm font-semibold">My Assets</span>
          <Badge variant="outline" className="ml-auto">
            {assets.length} issued
          </Badge>
        </div>
        {assets.length === 0 ? (
          <div className="text-muted-foreground text-sm">No assets issued to you yet.</div>
        ) : (
          <div className="space-y-2">
            {assets.map((a) => (
              <div
                key={a.id}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {a.tag} · {a.licenseKey ?? a.serial}
                  </div>
                </div>
                <Badge variant="outline">{a.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MyAssetsScreen() {
  const me = useCurrentUser();
  const assets = useMyAssets(me.id);
  const requests = useMyAssetRequests(me.id);
  const issues = useMyAssetIssues(me.id);
  const issuances = useIssuances();
  const allAssets = useAssets();
  const allIssues = useAssetIssues();
  // Reporting managers (remarks on a mishandling finding) and Finance (recovery decision) act from here — line
  // managers and the CFO cannot open /org/assets, so without this queue the mishandling path could never advance.
  const isFinance = me.role === "CFO" || can(me.role, "finance.manage");
  // Same rules as the data layer: own company only, and never the employee / assessor / reviewing manager.
  const toAct = allIssues.filter(
    (i) =>
      (i.status === "Manager review" && canManagerReviewIssue(i, me)) ||
      (i.status === "Finance review" && isFinance && canFinanceReviewIssue(i, me)),
  );
  const [actIssueId, setActIssueId] = useState(null);
  const actIssue = allIssues.find((i) => i.id === actIssueId) ?? null;
  const [detail, setDetail] = useState(null);
  const [reportFor, setReportFor] = useState(null);
  const [returnFor, setReturnFor] = useState(null);
  const [issueId, setIssueId] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const issue = issues.find((i) => i.id === issueId) ?? null;
  const activeOf = (a) => issuances.find((i) => i.assetId === a.id && i.status === "Active");
  const openIssues = issues.filter((i) => i.status !== "Closed");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Assets</h1>
          <p className="text-muted-foreground text-sm">
            Equipment and licenses issued to you — acknowledge receipt, return an asset, report a
            problem, and raise new requests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportReportPdf({
                title: "My Assets",
                subtitle: `${me.name} · ${me.designation}`,
                columns: [
                  "Tag",
                  "Asset",
                  "Type",
                  "Serial / Key",
                  "Issued on",
                  "Expected return",
                  "Condition",
                ],
                rows: assets.map((a) => {
                  const i = activeOf(a);
                  return [
                    a.tag,
                    a.name,
                    a.type,
                    a.licenseKey ?? a.serial,
                    i?.issuedOn ?? a.issuedOn ?? "—",
                    i?.expectedReturn ?? "Until separation",
                    a.condition,
                  ];
                }),
              })
            }
          >
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => setRequestOpen(true)}
          >
            <Plus className="h-4 w-4" /> Request Asset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {assets.map((a) => {
          const i = activeOf(a);
          const myIssue = issues.find(
            (x) => x.assetId === a.id && x.status !== "Closed" && x.status !== "Resolved",
          );
          return (
            <Card
              key={a.id}
              className="shadow-card hover:shadow-premium cursor-pointer transition"
              onClick={() => setDetail(a)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{a.name}</div>
                    <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {a.tag}
                      {a.model ? ` · ${a.model}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className={assetStatusTone[a.status]}>
                    {a.status}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Type</div>
                    {a.type}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Condition at issue</div>
                    {i?.conditionOnIssue ?? a.condition}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Issued on</div>
                    {i?.issuedOn ?? a.issuedOn ?? "—"}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Return by</div>
                    {i?.expectedReturn ?? "Until separation"}
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground flex items-center gap-1 text-xs">
                      <KeyRound className="h-3 w-3" /> Serial / License
                    </div>
                    <span className="font-mono text-xs">{a.licenseKey ?? a.serial}</span>
                  </div>
                  {(i?.accessoriesIssued?.length ?? 0) > 0 && (
                    <div className="text-muted-foreground col-span-2 text-xs">
                      With: {i.accessoriesIssued.join(", ")}
                    </div>
                  )}
                  {a.renewalDate && (
                    <div className="text-muted-foreground col-span-2 text-xs">
                      Renewal due <span className="whitespace-nowrap">{a.renewalDate}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {i && !i.employeeAck && (
                    <Button
                      size="sm"
                      className="bg-gradient-emerald text-white"
                      onClick={() => {
                        acknowledgeIssuance(i.id);
                        toast.success(`Receipt of ${a.tag} acknowledged`);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Acknowledge receipt
                    </Button>
                  )}
                  {i &&
                    i.employeeAck &&
                    i.returnStatus !== "Requested" &&
                    i.returnStatus !== "Issue raised" &&
                    a.status === "Issued" && (
                      <Button size="sm" variant="outline" onClick={() => setReturnFor(a)}>
                        <Undo2 className="h-4 w-4" /> Return asset
                      </Button>
                    )}
                  {i?.returnStatus === "Requested" && (
                    <Badge variant="outline" className="border-gold/60 text-gold self-center">
                      Return requested {i.returnRequestedOn} — awaiting check
                    </Badge>
                  )}
                  {myIssue ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => setIssueId(myIssue.id)}
                    >
                      <ShieldAlert className="h-4 w-4" /> Issue {myIssue.id} · {myIssue.status}
                    </Button>
                  ) : (
                    a.status !== "Return Pending" && (
                      <Button size="sm" variant="outline" onClick={() => setReportFor(a)}>
                        <ShieldAlert className="h-4 w-4" /> Report an issue
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {assets.length === 0 && (
          <Card className="shadow-card md:col-span-2">
            <CardContent className="text-muted-foreground p-8 text-center text-sm">
              No assets issued to you yet. Raise a request and it routes to your HOD and HR.
            </CardContent>
          </Card>
        )}
      </div>

      {toAct.length > 0 && (
        <Card className="shadow-card border-gold/40">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <ShieldAlert className="text-gold h-4 w-4" /> Asset issues awaiting your action
            </div>
            <p className="text-muted-foreground mb-3 text-xs">
              {isFinance ? "Recovery decisions for confirmed mishandling, and " : ""}remarks
              requested from you as the reporting manager.
            </p>
            <div className="space-y-2">
              {toAct.map((i) => (
                <div
                  key={i.id}
                  className="border-border flex flex-wrap items-center gap-2 rounded-xl border p-3"
                >
                  <span className="font-mono text-xs">{i.id}</span>
                  <span className="font-medium">
                    {allAssets.find((a) => a.id === i.assetId)?.name ?? i.assetId}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    held by {empName(i.employeeId)} · {i.category}
                  </span>
                  <Badge variant="outline" className={issueStatusTone(i.status)}>
                    {i.status}
                  </Badge>
                  <Button
                    size="sm"
                    className="bg-gradient-emerald ml-auto text-white"
                    onClick={() => setActIssueId(i.id)}
                  >
                    {i.status === "Finance review" ? "Record decision" : "Give remarks"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {openIssues.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <ShieldAlert className="text-destructive h-4 w-4" /> My asset issues
            </div>
            <p className="text-muted-foreground mb-3 text-xs">
              Damage / breakdown reports and what happens next. Mishandling findings go to your
              manager for remarks and then to Finance; asset faults go straight to repair.
            </p>
            <div className="space-y-3">
              {openIssues.map((i) => (
                <div
                  key={i.id}
                  className="border-border hover:bg-muted/20 cursor-pointer rounded-xl border p-4"
                  onClick={() => setIssueId(i.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{i.id}</span>
                    <span className="font-medium">
                      {allAssets.find((a) => a.id === i.assetId)?.name ?? i.assetId}
                    </span>
                    <Badge variant="outline">{i.category}</Badge>
                    <Badge variant="outline" className={severityTone(i.severity)}>
                      {i.severity}
                    </Badge>
                    <Badge variant="outline" className={issueStatusTone(i.status)}>
                      {i.status}
                    </Badge>
                    <span className="text-muted-foreground ml-auto text-xs">
                      <span className="whitespace-nowrap">{i.raisedOn}</span> · {i.source}
                    </span>
                  </div>
                  <div className="mt-3">
                    <WorkflowStepper
                      steps={issueSteps(i)}
                      active={
                        issueStepIndex(i) +
                        (i.status === "Resolved" || i.status === "Closed" ? 1 : 0)
                      }
                    />
                  </div>
                  {i.financeDecision && (
                    <div className="mt-2 text-xs">
                      {i.financeDecision === "Waive"
                        ? "Recovery waived."
                        : `Finance: ${i.financeDecision} — ₹\u00A0${(i.recoveryAmount ?? 0).toLocaleString("en-IN")} via ${i.recoveryMode}.`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 font-semibold">My asset requests</div>
          {requests.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              You haven't raised any asset requests.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="border-border rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.assetType}</span>
                    <Badge variant="outline" className={tone[r.status] ?? ""}>
                      {r.status}
                    </Badge>
                    <Badge variant="outline">{r.urgency}</Badge>
                    {r.neededBy && <Badge variant="outline">Needed by {r.neededBy}</Badge>}
                    <span className="text-muted-foreground ml-auto text-xs">
                      {r.id} · <span className="whitespace-nowrap">{r.raisedOn}</span>
                    </span>
                  </div>
                  <div className="mt-2 text-sm">{r.reason}</div>
                  {(r.purpose || r.specifications) && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      {r.purpose}
                      {r.project ? ` · ${r.project}` : ""}
                      {r.specifications ? ` · ${r.specifications}` : ""}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.chain.map((s, i) => (
                      <Badge key={i} variant="outline" className={tone[s.status] ?? ""}>
                        {s.label}: {s.approverName} · {s.status}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* dialogs */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {requestOpen && <RequestForm onDone={() => setRequestOpen(false)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detail && <MyAssetDetail asset={detail} issuance={activeOf(detail)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!reportFor} onOpenChange={(o) => !o && setReportFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {reportFor && (
            <ReportIssueForm
              asset={reportFor}
              employeeId={me.id}
              onDone={(id) => {
                setReportFor(null);
                if (id) setIssueId(id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!returnFor} onOpenChange={(o) => !o && setReturnFor(null)}>
        <DialogContent>
          {returnFor && (
            <ReturnRequestForm
              asset={returnFor}
              issuance={activeOf(returnFor)}
              onDone={() => setReturnFor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!actIssue} onOpenChange={(o) => !o && setActIssueId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {actIssue && <AssetIssueDetail issue={actIssue} mode="manager" />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!issue} onOpenChange={(o) => !o && setIssueId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {issue && <AssetIssueDetail issue={issue} mode="self" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyAssetDetail({ asset, issuance }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {asset.tag} · {asset.name}
        </DialogTitle>
        <DialogDescription>
          {asset.type} · {asset.kind}
          {asset.model ? ` · ${asset.model}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={assetStatusTone[asset.status]}>
            {asset.status}
          </Badge>
          <Badge variant="outline">{asset.condition}</Badge>
          {asset.warrantyTill && (
            <Badge variant="outline">Warranty till {asset.warrantyTill}</Badge>
          )}
        </div>
        <KV
          items={[
            ["Serial / key", asset.licenseKey ?? asset.serial],
            ["Specifications", asset.specifications ?? "—"],
            ["Issued on", issuance?.issuedOn ?? asset.issuedOn ?? "—"],
            ["Issued by", issuance?.issuedBy ?? "—"],
            ["Purpose", issuance?.purpose ?? "—"],
            ["Expected return", issuance?.expectedReturn ?? "Until separation"],
            ["Location of use", issuance?.location ?? asset.location ?? "—"],
            ["Accessories with you", (issuance?.accessoriesIssued ?? []).join(", ") || "—"],
            ["Acknowledged", issuance?.employeeAck ? `Yes · ${issuance.ackOn}` : "Not yet"],
            ["Remarks at issue", issuance?.notes ?? "—"],
          ]}
        />
        {(issuance?.checklistOnIssue?.length ?? 0) > 0 && (
          <ChecklistEditor
            value={issuance.checklistOnIssue}
            title="Condition recorded at issue (the same items are checked when you return it)"
            readOnly
          />
        )}
        {(asset.attachments?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {asset.attachments.map((a) => (
              <Badge key={a} variant="outline" className="gap-1 font-normal">
                <Paperclip className="h-3 w-3" />
                {a}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ReturnRequestForm({ asset, issuance, onDone }) {
  const me = useCurrentUser();
  const [remarks, setRemarks] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Undo2 className="text-primary h-5 w-5" /> Return {asset.name}
        </DialogTitle>
        <DialogDescription>
          {asset.tag} · hand the asset and its accessories to the asset manager. They verify the
          same checklist as at issue and approve the return (or open a condition issue if something
          is damaged).
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <KV
          cols={1}
          items={[
            [
              "Return with",
              (issuance?.accessoriesIssued ?? []).join(", ") || "No accessories recorded",
            ],
            ["Condition at issue", issuance?.conditionOnIssue ?? asset.condition],
          ]}
        />
        <Field label="Anything the checker should know?">
          <Textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. minor scratch on the lid since day one; charger cable frayed"
          />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />{" "}
          I have backed up my data and am returning the asset with all accessories listed above.
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!confirm || !issuance}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            const r = requestReturn(issuance.id, me, remarks.trim() || undefined);
            toast[r.ok ? "success" : "error"](r.message);
            onDone();
          }}
        >
          Request return
        </Button>
      </DialogFooter>
    </>
  );
}

function RequestForm({ onDone }) {
  const me = useCurrentUser();
  const master = useAssetMaster().filter((t) => t.active);
  const projects = useProjects();
  const [assetType, setAssetType] = useState(master[0]?.name ?? "Laptop");
  const [urgency, setUrgency] = useState("Normal");
  const [neededBy, setNeededBy] = useState("");
  const [purpose, setPurpose] = useState("Regular work");
  const [project, setProject] = useState("none");
  const [duration, setDuration] = useState("Until separation");
  const [specs, setSpecs] = useState("");
  const [reason, setReason] = useState("");
  const type = master.find((t) => t.name === assetType);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Request an asset</DialogTitle>
        <DialogDescription>
          Routed to your HOD, then HR, then the asset manager who issues it from stock.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Asset type" required>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {master.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name} · {t.kind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Purpose" required>
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Regular work",
                "Replacement for faulty asset",
                "Project / client site",
                "Work from home",
                "Role-based access",
                "Travel",
                "Temporary / loaner",
              ].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Urgency">
          <Select value={urgency} onValueChange={(v) => setUrgency(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Low", "Normal", "High", "Critical"].map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Needed by">
          <Input
            type="date"
            value={neededBy}
            min={todayLocal()}
            onChange={(e) => setNeededBy(e.target.value)}
          />
        </Field>
        <Field label="Concerned project">
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.code}>
                  {p.code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Duration needed">
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Until separation", "1 month", "3 months", "6 months", "12 months"].map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Preferred specifications"
          className="sm:col-span-2"
          hint={type ? `Typical: ${type.description}` : undefined}
        >
          <Input
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            placeholder="e.g. 16 GB RAM, 512 GB SSD, 14-inch"
          />
        </Field>
        <Field label="Reason / justification" required className="sm:col-span-2">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need this asset and what happens without it?"
          />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!reason.trim() || (!!neededBy && neededBy < todayLocal())}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            submitAssetRequest({
              employeeId: me.id,
              assetType,
              kind: type?.kind ?? "Hardware",
              urgency,
              reason: reason.trim(),
              neededBy: neededBy || undefined,
              purpose,
              specifications: specs.trim() || undefined,
              project: project === "none" ? undefined : project,
              duration,
            });
            toast.success("Asset request submitted — tracking approvals now");
            onDone();
          }}
        >
          Submit request
        </Button>
      </DialogFooter>
    </>
  );
}
