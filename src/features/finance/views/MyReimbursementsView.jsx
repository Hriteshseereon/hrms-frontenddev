import { useMemo, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Receipt, Plus, ShieldPlus, Eye, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { getEmployeeProfile } from "@/features/employees/data/employee-directory";
import { inr } from "@/lib/store";
import {
  reimbursementStore,
  reimbursementCategoryStore,
  insuranceStore,
  addReimbursement,
  REIMBURSEMENT_TYPES,
  CLAIM_PAYMENT_MODES,
  CLAIM_PAID_VIA,
  claimPayable,
  approveClaim,
  rejectClaim,
  isReportingManagerOf,
} from "@/features/finance/data/claims-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { Field, SectionTitle, AttachmentsInput } from "@/features/employees/components/CasePieces";
import {
  ClaimDetailDialog,
  ClaimStepper,
  claimBadge,
} from "@/features/finance/components/ClaimDetail";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const stamp = () => {
  const d = new Date();
  return `${today()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const blankItem = () => ({
  date: "",
  vendor: "",
  billNo: "",
  description: "",
  amount: 0,
  attachment: "",
  paidVia: "Own card / UPI",
});

const POLICY_LIMITS = {
  Travel: 15000,
  Medical: 5000,
  "Internet & Telecom": 2000,
  "Client Entertainment": 5000,
};

function EmpReimbursements() {
  const me = useCurrentEmployee();
  const profile = getEmployeeProfile(me.id);
  const all = reimbursementStore.use();
  const categories = reimbursementCategoryStore.use();
  const insurance = insuranceStore.use().filter((i) => i.empId === me.id);
  const mine = useMemo(() => all.filter((r) => r.empId === me.id), [all, me.id]);
  // Manager stage of the pipeline: claims of my direct reports awaiting my approval (managers have no /org/claims).
  const user = useCurrentUser();
  const approver = { id: me.id, name: me.name };
  const teamQueue = useMemo(
    () =>
      all.filter(
        (r) =>
          r.empId !== me.id &&
          r.currentStage === "Manager" &&
          r.status !== "Rejected" &&
          isReportingManagerOf(approver, r.empId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, me.id, me.name],
  );
  const [openId, setOpenId] = useState(null);
  const viewing = mine.find((r) => r.id === openId) ?? null;
  const [teamId, setTeamId] = useState(null);
  const teamClaim = teamQueue.find((r) => r.id === teamId) ?? null;
  const [insuranceDetail, setInsuranceDetail] = useState(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("Expense Claim");
  const [category, setCategory] = useState("");
  const [purpose, setPurpose] = useState("");
  const [project, setProject] = useState("");
  const [client, setClient] = useState("");
  const [costCentre, setCostCentre] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [paymentMode, setPaymentMode] = useState("With salary (payroll)");
  const [advanceAdjusted, setAdvanceAdjusted] = useState("");
  const [advanceRef, setAdvanceRef] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [attachments, setAttachments] = useState([]);
  const [description, setDescription] = useState("");
  const [declaration, setDeclaration] = useState(false);

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const periodEnd = periodTo || periodFrom;
  const billDateOk = (d) =>
    !!d && d <= today() && (!periodFrom || (d >= periodFrom && d <= periodEnd));
  // Every bill needs its receipt attached and a date inside the expense period (never in the future).
  const itemsValid =
    items.length > 0 &&
    items.every(
      (i) => billDateOk(i.date) && i.vendor.trim() && Number(i.amount) > 0 && i.attachment,
    );
  const missingReceipt = items.some((i) => !i.attachment);
  const badBillDate = items.some((i) => i.date && !billDateOk(i.date));
  const limit = POLICY_LIMITS[category];
  const advance = Number(advanceAdjusted) || 0;
  const periodOk = (!periodTo || periodTo >= periodFrom) && (!periodFrom || periodFrom <= today());
  const advanceOk = advance >= 0 && advance <= total;
  const valid =
    name.trim() &&
    category &&
    purpose.trim() &&
    periodFrom &&
    periodOk &&
    advanceOk &&
    itemsValid &&
    declaration;
  const formError = !periodOk
    ? "Expense dates must not be in the future, and 'to' cannot be before 'from'."
    : !advanceOk
      ? "Advance to adjust must be between ₹0 and the claim total."
      : badBillDate
        ? "Each bill date must fall within the expense period and not be in the future."
        : missingReceipt
          ? "Attach the receipt for every bill."
          : "";

  const setItem = (idx, patch) =>
    setItems((l) => l.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  function reset() {
    setName("");
    setCategory("");
    setPurpose("");
    setProject("");
    setClient("");
    setCostCentre("");
    setPeriodFrom("");
    setPeriodTo("");
    setPaymentMode("With salary (payroll)");
    setAdvanceAdjusted("");
    setAdvanceRef("");
    setItems([blankItem()]);
    setAttachments([]);
    setDescription("");
    setDeclaration(false);
  }

  function submit() {
    const files = [...new Set([...attachments, ...items.map((i) => i.attachment).filter(Boolean)])];
    addReimbursement({
      empId: me.id,
      employee: me.name,
      name: name.trim(),
      type,
      category,
      amount: total,
      date: periodFrom,
      document: files[0] ?? "",
      description: description.trim(),
      purpose: purpose.trim(),
      project: project.trim() || undefined,
      client: client.trim() || undefined,
      costCentre: costCentre.trim() || undefined,
      periodFrom,
      periodTo: periodTo || periodFrom,
      paymentMode,
      advanceAdjusted: Number(advanceAdjusted) || 0,
      advanceRef: advanceRef.trim() || undefined,
      items: items.map((i) => ({ ...i, amount: Number(i.amount) })),
      attachments: files,
      policyLimit: limit,
      submittedOn: stamp(),
      department: me.dept,
      designation: me.role,
      branch: me.branch,
      bankAccount: `${profile.payroll.bank.bankName} ${profile.payroll.bank.accountNo.slice(-4)}`,
      declaration,
    });
    toast.success(`Reimbursement ticket raised for ${inr(total)} — sent to your manager`);
    setOpen(false);
    reset();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Receipt className="text-primary h-6 w-6" /> Claims & Reimbursements
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Raise a claim with every bill itemised and attached, then track it through Manager → HR
            → CHRO → CEO → CFO → Accounts.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
              <Plus className="h-4 w-4" /> New Reimbursement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Raise a reimbursement claim</DialogTitle>
              <DialogDescription>
                Approvers see exactly this — purpose, period, each bill and its attachment.
                Categories are maintained by HR in Masters.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <SectionTitle n={1} title="Claim" sub="What the claim is for" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Claim title" required className="sm:col-span-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Client visit — Chennai"
                  />
                </Field>
                <Field label="Type">
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REIMBURSEMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Category"
                  required
                  hint={limit ? `Policy limit ${inr(limit)} per claim` : undefined}
                >
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
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
                    placeholder="Why the expense was incurred — meeting, project, policy benefit…"
                  />
                </Field>
                <Field label="Project">
                  <Input
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="e.g. Zensar — Managed QA"
                  />
                </Field>
                <Field label="Client">
                  <Input
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="e.g. Semtech"
                  />
                </Field>
                <Field label="Cost centre">
                  <Input
                    value={costCentre}
                    onChange={(e) => setCostCentre(e.target.value)}
                    placeholder="e.g. CC-ENG-02"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Expense from" required>
                    <Input
                      type="date"
                      value={periodFrom}
                      onChange={(e) => setPeriodFrom(e.target.value)}
                    />
                  </Field>
                  <Field label="Expense to">
                    <Input
                      type="date"
                      value={periodTo}
                      min={periodFrom}
                      onChange={(e) => setPeriodTo(e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <SectionTitle n={2} title="Bills" sub="One row per bill — attach each receipt" />
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="border-border grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-12"
                  >
                    <Field label="Date" className="sm:col-span-2">
                      <Input
                        type="date"
                        value={it.date}
                        onChange={(e) => setItem(idx, { date: e.target.value })}
                      />
                    </Field>
                    <Field label="Vendor" className="sm:col-span-3">
                      <Input
                        value={it.vendor}
                        onChange={(e) => setItem(idx, { vendor: e.target.value })}
                        placeholder="IndiGo / Uber / Apollo…"
                      />
                    </Field>
                    <Field label="Bill no." className="sm:col-span-2">
                      <Input
                        value={it.billNo}
                        onChange={(e) => setItem(idx, { billNo: e.target.value })}
                      />
                    </Field>
                    <Field label="Amount (₹)" className="sm:col-span-2">
                      <Input
                        type="number"
                        min={0}
                        value={it.amount || ""}
                        onChange={(e) => setItem(idx, { amount: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Paid via" className="sm:col-span-3">
                      <Select
                        value={it.paidVia}
                        onValueChange={(v) => setItem(idx, { paidVia: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLAIM_PAID_VIA.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Description" className="sm:col-span-7">
                      <Input
                        value={it.description}
                        onChange={(e) => setItem(idx, { description: e.target.value })}
                        placeholder="What the bill is for"
                      />
                    </Field>
                    <Field label="Receipt" className="sm:col-span-4">
                      <label className="border-border hover:bg-muted flex h-9 cursor-pointer items-center gap-1 rounded-md border border-dashed px-2 text-xs">
                        <Paperclip className="h-3.5 w-3.5" />
                        {it.attachment || "Attach bill"}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            captureFiles(e.target.files);
                            setItem(idx, { attachment: e.target.files?.[0]?.name ?? "" });
                          }}
                        />
                      </label>
                    </Field>
                    <div className="flex items-end justify-end sm:col-span-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={items.length === 1}
                        onClick={() => setItems((l) => l.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setItems((l) => [...l, blankItem()])}
                  >
                    <Plus className="h-4 w-4" /> Add bill
                  </Button>
                  <div className="text-sm">
                    Total <b className="tabular-nums">{inr(total)}</b>
                    {limit && total > limit && (
                      <span className="text-destructive ml-2 text-xs">
                        exceeds policy limit {inr(limit)} — approver justification needed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <SectionTitle n={3} title="Settlement" sub="How you want to be paid" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Payment mode">
                  <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLAIM_PAYMENT_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Advance to adjust (₹)" hint="If you drew a company advance for this">
                  <Input
                    type="number"
                    min={0}
                    value={advanceAdjusted}
                    onChange={(e) => setAdvanceAdjusted(e.target.value)}
                  />
                </Field>
                <Field label="Advance reference">
                  <Input
                    value={advanceRef}
                    onChange={(e) => setAdvanceRef(e.target.value)}
                    placeholder="ADV-2026-…"
                  />
                </Field>
                <Field label="Pay to" className="sm:col-span-3">
                  <Input
                    readOnly
                    className="bg-muted/40"
                    value={`${profile.payroll.bank.bankName} · ${profile.payroll.bank.accountNo} · ${profile.payroll.bank.ifsc}`}
                  />
                </Field>
              </div>

              <SectionTitle n={4} title="Supporting documents & declaration" />
              <AttachmentsInput
                value={attachments}
                onChange={setAttachments}
                label="Other attachments"
                hint="Approval e-mails, travel authorisation, prescription, policy letter…"
              />
              <Field label="Additional notes">
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <label className="border-border bg-muted/30 flex items-start gap-2 rounded-lg border p-3 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={declaration}
                  onChange={(e) => setDeclaration(e.target.checked)}
                />
                <span>
                  I declare that the bills attached are genuine, were incurred for official
                  purposes, and have not been claimed elsewhere or under any other policy.
                </span>
              </label>
            </div>
            <DialogFooter>
              {formError && (
                <span className="text-destructive mr-auto self-center text-xs">{formError}</span>
              )}
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!valid} className="bg-gradient-emerald text-white" onClick={submit}>
                Submit claim · {inr(Math.max(0, total - (Number(advanceAdjusted) || 0)))}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teamQueue.length > 0 && (
        <Card className="shadow-card border-primary/30 overflow-hidden">
          <CardContent className="border-border border-b p-4 font-semibold">
            Team claims awaiting my approval{" "}
            <span className="text-muted-foreground text-xs font-normal">
              · Manager stage · {teamQueue.length} pending
            </span>
          </CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Claim</th>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {teamQueue.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setTeamId(r.id)}
                  >
                    <td className="p-3 font-medium">
                      {r.name}
                      <div className="text-muted-foreground text-xs font-normal">
                        {r.id} · <span className="whitespace-nowrap">{r.date}</span>
                      </div>
                    </td>
                    <td className="p-3">{r.employee}</td>
                    <td className="text-muted-foreground p-3">{r.category}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{inr(r.amount)}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamId(r.id);
                        }}
                      >
                        <Eye className="h-4 w-4" /> Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <CardContent className="border-border border-b p-4 font-semibold">
          My claims{" "}
          <span className="text-muted-foreground text-xs font-normal">
            · click a claim to see what you submitted and where it is
          </span>
        </CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Claim</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Bills</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Approval trail</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {mine.map((r) => (
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
                  <td className="text-muted-foreground p-3">{r.category}</td>
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
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={claimBadge(r.status)}>
                      {r.status}
                    </Badge>
                    {r.remarks && (
                      <div className="text-muted-foreground mt-1 text-xs">{r.remarks}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <ClaimStepper claim={r} />
                  </td>
                  <td className="p-3">
                    <Eye className="text-muted-foreground h-4 w-4" />
                  </td>
                </tr>
              ))}
              {mine.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-10 text-center">
                    You haven't raised any claims yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <CardContent className="border-border flex items-center gap-2 border-b p-4 font-semibold">
          <ShieldPlus className="text-primary h-4 w-4" /> My insurance cover
        </CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Policy</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Cover</th>
                <th className="p-3 text-right">Monthly deduction</th>
                <th className="p-3 text-left">Validity</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {insurance.map((i) => (
                <tr key={i.id} className={clickableRow} onClick={() => setInsuranceDetail(i)}>
                  <td className="text-muted-foreground p-3 font-mono text-xs">{i.id}</td>
                  <td className="p-3 font-medium">{i.type}</td>
                  <td className="text-muted-foreground p-3">{i.category}</td>
                  <td className="p-3 text-right">{inr(i.amount)}</td>
                  <td className="p-3 text-right font-semibold">{inr(i.deduction)}</td>
                  <td className="text-muted-foreground p-3">
                    {i.validFrom} → {i.validTo}
                  </td>
                </tr>
              ))}
              {insurance.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-10 text-center">
                    No insurance assigned to you yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {viewing && <ClaimDetailDialog claim={viewing} onClose={() => setOpenId(null)} />}
      {teamClaim && (
        <ClaimDetailDialog
          claim={teamClaim}
          canAction
          onClose={() => setTeamId(null)}
          onApprove={(rem) => {
            if (!approveClaim(teamClaim.id, user.name, rem || "Approved", user.id))
              return void toast.error("This claim can no longer be approved by you.");
            toast.success(`${teamClaim.id} approved — sent to HR`);
            setTeamId(null);
          }}
          onReject={(reason) => {
            if (rejectClaim(teamClaim.id, user.name, reason, user.id)) {
              toast.success(`${teamClaim.id} rejected — ${teamClaim.employee} has been informed`);
              setTeamId(null);
            }
          }}
        />
      )}
      {insuranceDetail && (
        <RecordDetailDialog
          onClose={() => setInsuranceDetail(null)}
          title={`${insuranceDetail.id} · ${insuranceDetail.type}`}
          subtitle={`${insuranceDetail.insurer} · policy ${insuranceDetail.policyNumber} · ${insuranceDetail.category}`}
          badges={
            <Badge
              variant="outline"
              className={
                insuranceDetail.status === "Active"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }
            >
              {insuranceDetail.status}
            </Badge>
          }
          record={insuranceDetail}
          hide={["empId"]}
          labels={{
            id: "Policy reference",
            tpa: "TPA",
            insurerContact: "Insurer helpline",
            amount: "Sum insured",
            roomRentLimit: "Room rent limit",
            copay: "Co-pay",
            nomineeRelation: "Nominee relation",
            validFrom: "Valid from",
            validTo: "Valid to",
            premium: "Annual premium",
            deduction: "Monthly deduction",
            dateOfBirth: "Date of birth",
          }}
          sections={[
            {
              title: "Cover",
              keys: [
                "id",
                "type",
                "category",
                "amount",
                "roomRentLimit",
                "copay",
                "validFrom",
                "validTo",
                "status",
              ],
            },
            { title: "Insurer", keys: ["insurer", "policyNumber", "tpa", "insurerContact"] },
            { title: "Premium", keys: ["premium", "deduction"] },
            {
              title: "Insured & nominee",
              keys: [
                "employee",
                "department",
                "designation",
                "branch",
                "dateOfBirth",
                "contact",
                "nominee",
                "nomineeRelation",
                "dependents",
              ],
            },
            { title: "Documents & remarks", keys: ["documents", "remarks"] },
          ]}
        />
      )}
    </div>
  );
}

export default EmpReimbursements;
