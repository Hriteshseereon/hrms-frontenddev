import { useState } from "react";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import { captureFiles } from "@/lib/attachments";
import { Plus, ShieldPlus, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import { useScopedEmployees, useScopedIds } from "@/features/employees/components/CasePieces";
import { inr } from "@/lib/store";
import { exportReportPdf } from "@/lib/export-utils";
import {
  insuranceStore,
  insuranceTypeStore,
  insuranceCategoryStore,
  addInsurance,
  insuranceDeductionFor,
  INSURERS,
  actInsuranceClaim,
  useInsuranceClaims,
} from "@/features/finance/data/claims-data";

const RELATIONS = ["Spouse", "Parent", "Child", "Sibling", "Other"];

function F({ label, required, children, full }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-muted-foreground text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function InsuranceTab() {
  // Entity-scoped: the register and the picker showed every entity's (seeded) staff and missed new hires.
  const people = useScopedEmployees();
  const scopedIds = useScopedIds();
  const rows = insuranceStore.use().filter((r) => scopedIds.has(r.empId));
  const types = insuranceTypeStore.use();
  const categories = insuranceCategoryStore.use();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const [empId, setEmpId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [contact, setContact] = useState("");
  const [insurer, setInsurer] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [tpa, setTpa] = useState("");
  const [insurerContact, setInsurerContact] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [roomRentLimit, setRoomRentLimit] = useState("");
  const [copay, setCopay] = useState("");
  const [nominee, setNominee] = useState("");
  const [nomineeRelation, setNomineeRelation] = useState("");
  const [dependents, setDependents] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [premium, setPremium] = useState("");
  const [deduction, setDeduction] = useState("");
  const [documents, setDocuments] = useState([]);
  const [remarks, setRemarks] = useState("");

  const emp = people.find((e) => e.id === empId);
  const dateError =
    validFrom && validTo && validTo <= validFrom ? "Valid-to must be after valid-from." : null;
  const amountError =
    [amount, premium, deduction].some((v) => v !== "" && Number(v) < 0) ||
    (amount !== "" && !(Number(amount) > 0))
      ? "Cover must be greater than zero; premium and deduction cannot be negative."
      : null;
  const dupPolicy =
    policyNumber.trim() &&
    insuranceStore
      .get()
      .some(
        (r) =>
          r.policyNumber.trim().toLowerCase() === policyNumber.trim().toLowerCase() &&
          r.empId === empId,
      )
      ? "This policy number is already assigned to the employee."
      : null;
  const valid =
    !!(empId && insurer && policyNumber.trim() && type && amount && validFrom && validTo) &&
    !dateError &&
    !amountError &&
    !dupPolicy;

  function reset() {
    setEmpId("");
    setDateOfBirth("");
    setContact("");
    setInsurer("");
    setPolicyNumber("");
    setTpa("");
    setInsurerContact("");
    setType("");
    setCategory("");
    setAmount("");
    setRoomRentLimit("");
    setCopay("");
    setNominee("");
    setNomineeRelation("");
    setDependents("");
    setValidFrom("");
    setValidTo("");
    setPremium("");
    setDeduction("");
    setDocuments([]);
    setRemarks("");
  }

  function submit() {
    if (!emp) return;
    addInsurance({
      empId,
      employee: emp.name,
      department: emp.dept,
      designation: emp.role,
      branch: emp.branch,
      dateOfBirth,
      contact: contact || emp.phone,
      insurer,
      policyNumber,
      tpa,
      insurerContact,
      type,
      category: category || "Employee Only",
      amount: Number(amount),
      roomRentLimit,
      copay,
      nominee,
      nomineeRelation,
      dependents,
      validFrom,
      validTo,
      premium: Number(premium || 0),
      deduction: Number(deduction || 0),
      documents,
      remarks,
    });
    toast.success(
      `Insurance assigned to ${emp.name} — ${inr(Number(deduction || 0))}/month added to payroll deductions`,
    );
    setOpen(false);
    reset();
  }

  function exportPolicies() {
    exportReportPdf({
      title: "Employee Insurance Register",
      subtitle: `${rows.length} policies`,
      summary: [
        { label: "Policies", value: String(rows.length) },
        { label: "Total cover", value: inr(rows.reduce((s, r) => s + r.amount, 0)) },
        { label: "Monthly deduction", value: inr(rows.reduce((s, r) => s + r.deduction, 0)) },
      ],
      columns: [
        "Policy",
        "Employee",
        "Insurer",
        "Policy no.",
        "Type",
        "Category",
        "Cover",
        "Validity",
        "Deduction",
        "Status",
      ],
      rows: rows.map((r) => [
        r.id,
        `${r.employee} (${r.empId})`,
        r.insurer,
        r.policyNumber,
        r.type,
        r.category,
        inr(r.amount),
        `${r.validFrom} → ${r.validTo}`,
        inr(r.deduction),
        r.status,
      ]),
    });
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
                <ShieldPlus className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Employee Insurance</div>
                <div className="text-muted-foreground text-xs">
                  Employee, insurer and cover details — the monthly premium flows into payroll
                  deductions
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportPolicies}>
                <FileDown className="h-4 w-4" /> Export PDF
              </Button>
              <Dialog
                open={open}
                onOpenChange={(o) => {
                  setOpen(o);
                  if (!o) reset();
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-emerald text-white">
                    <Plus className="h-4 w-4" /> Assign Insurance
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Assign insurance</DialogTitle>
                    <DialogDescription>
                      Capture the employee, the insurer and the full cover details. Types and
                      categories come from Master Data.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5 py-2">
                    <div>
                      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                        Employee details
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <F label="Employee" required full>
                          <Select
                            value={empId}
                            onValueChange={(v) => {
                              setEmpId(v);
                              const e = people.find((x) => x.id === v);
                              if (e) setContact(e.phone);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                              {people.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.name} · {e.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </F>
                        <F label="Department">
                          <Input value={emp?.dept ?? ""} readOnly placeholder="Auto-filled" />
                        </F>
                        <F label="Designation">
                          <Input value={emp?.role ?? ""} readOnly placeholder="Auto-filled" />
                        </F>
                        <F label="Branch">
                          <Input value={emp?.branch ?? ""} readOnly placeholder="Auto-filled" />
                        </F>
                        <F label="Contact number">
                          <Input
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            placeholder="+91 …"
                          />
                        </F>
                        <F label="Date of birth">
                          <Input
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                          />
                        </F>
                      </div>
                    </div>

                    <Separator />
                    <div>
                      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                        Insurer details
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <F label="Insurer" required>
                          <Select value={insurer} onValueChange={setInsurer}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select insurer" />
                            </SelectTrigger>
                            <SelectContent>
                              {INSURERS.map((i) => (
                                <SelectItem key={i} value={i}>
                                  {i}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </F>
                        <F label="Policy number" required>
                          <Input
                            value={policyNumber}
                            onChange={(e) => setPolicyNumber(e.target.value)}
                            placeholder="GHI/2026/AVN/0142"
                          />
                        </F>
                        <F label="TPA / administrator">
                          <Input
                            value={tpa}
                            onChange={(e) => setTpa(e.target.value)}
                            placeholder="Medi Assist"
                          />
                        </F>
                        <F label="Insurer helpline">
                          <Input
                            value={insurerContact}
                            onChange={(e) => setInsurerContact(e.target.value)}
                            placeholder="1800 …"
                          />
                        </F>
                      </div>
                    </div>

                    <Separator />
                    <div>
                      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                        Insurance cover
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <F label="Insurance type" required>
                          <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {types.map((t) => (
                                <SelectItem key={t.id} value={t.name}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </F>
                        <F label="Category">
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
                        </F>
                        <F label="Sum insured (cover)" required>
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="800000"
                          />
                        </F>
                        <F label="Annual premium">
                          <Input
                            type="number"
                            value={premium}
                            onChange={(e) => setPremium(e.target.value)}
                            placeholder="21400"
                          />
                        </F>
                        <F label="Room rent limit">
                          <Input
                            value={roomRentLimit}
                            onChange={(e) => setRoomRentLimit(e.target.value)}
                            placeholder="1% of sum insured / day"
                          />
                        </F>
                        <F label="Co-pay">
                          <Input
                            value={copay}
                            onChange={(e) => setCopay(e.target.value)}
                            placeholder="Nil / 10%"
                          />
                        </F>
                        <F label="Nominee">
                          <Input
                            value={nominee}
                            onChange={(e) => setNominee(e.target.value)}
                            placeholder="Full name"
                          />
                        </F>
                        <F label="Nominee relation">
                          <Select value={nomineeRelation} onValueChange={setNomineeRelation}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select relation" />
                            </SelectTrigger>
                            <SelectContent>
                              {RELATIONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </F>
                        <F label="Dependents covered" full>
                          <Input
                            value={dependents}
                            onChange={(e) => setDependents(e.target.value)}
                            placeholder="Spouse, 2 children, parents"
                          />
                        </F>
                        <F label="Valid from" required>
                          <Input
                            type="date"
                            value={validFrom}
                            onChange={(e) => setValidFrom(e.target.value)}
                          />
                        </F>
                        <F label="Valid to" required>
                          <Input
                            type="date"
                            value={validTo}
                            onChange={(e) => setValidTo(e.target.value)}
                          />
                        </F>
                        <F label="Monthly payroll deduction" full>
                          <Input
                            type="number"
                            value={deduction}
                            onChange={(e) => setDeduction(e.target.value)}
                            placeholder="1250"
                          />
                        </F>
                      </div>
                    </div>

                    <Separator />
                    <div>
                      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                        Documents & notes
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <F label="Upload documents (policy schedule, e-card, endorsements)" full>
                          <Input
                            type="file"
                            multiple
                            onChange={(e) => {
                              captureFiles(e.target.files);
                              setDocuments(Array.from(e.target.files ?? []).map((f) => f.name));
                            }}
                          />
                          {documents.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {documents.map((d) => (
                                <Badge
                                  key={d}
                                  variant="outline"
                                  className="border-border text-muted-foreground"
                                >
                                  {d}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </F>
                        <F label="Remarks" full>
                          <Textarea
                            rows={2}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                          />
                        </F>
                      </div>
                    </div>

                    {empId && (
                      <div className="border-border bg-muted/40 rounded-lg border p-3 text-sm">
                        Existing insurance deductions for this employee:{" "}
                        <span className="font-semibold">
                          {inr(insuranceDeductionFor(rows, empId))}
                        </span>{" "}
                        / month
                        {deduction && (
                          <>
                            {" "}
                            · after this policy:{" "}
                            <span className="font-semibold">
                              {inr(insuranceDeductionFor(rows, empId) + Number(deduction || 0))}
                            </span>{" "}
                            / month
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {(dateError || amountError || dupPolicy) && (
                    <div className="text-destructive text-xs">
                      {dateError ?? amountError ?? dupPolicy}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!valid}
                      className="bg-gradient-emerald text-white"
                      onClick={submit}
                    >
                      Assign
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Policy</th>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Insurer</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Cover</th>
                  <th className="p-3 text-left">Validity</th>
                  <th className="p-3 text-right">Payroll deduction</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetail(r)}
                  >
                    <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                    <td className="p-3 font-medium">
                      {r.employee}
                      <div className="text-muted-foreground text-xs font-normal">
                        {r.empId} · {r.department}
                      </div>
                    </td>
                    <td className="text-muted-foreground p-3">
                      {r.insurer}
                      <div className="text-xs">{r.policyNumber}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{r.type}</td>
                    <td className="text-muted-foreground p-3">{r.category}</td>
                    <td className="p-3 text-right">{inr(r.amount)}</td>
                    <td className="text-muted-foreground p-3">
                      {r.validFrom} → {r.validTo}
                    </td>
                    <td className="p-3 text-right font-semibold">{inr(r.deduction)}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-muted-foreground p-10 text-center">
                      No insurance assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {detail?.type} — {detail?.employee}
                </DialogTitle>
                <DialogDescription>
                  {detail?.insurer} · Policy {detail?.policyNumber}
                </DialogDescription>
              </DialogHeader>
              {detail && (
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ["Employee", `${detail.employee} (${detail.empId})`],
                    ["Department", detail.department],
                    ["Designation", detail.designation],
                    ["Branch", detail.branch],
                    ["Contact", detail.contact],
                    ["Date of birth", detail.dateOfBirth],
                    ["Insurer", detail.insurer],
                    ["Policy number", detail.policyNumber],
                    ["TPA", detail.tpa],
                    ["Helpline", detail.insurerContact],
                    ["Category", detail.category],
                    ["Sum insured", inr(detail.amount)],
                    ["Annual premium", inr(detail.premium)],
                    ["Monthly deduction", inr(detail.deduction)],
                    ["Room rent limit", detail.roomRentLimit],
                    ["Co-pay", detail.copay],
                    [
                      "Nominee",
                      `${detail.nominee || "—"} ${detail.nomineeRelation ? `(${detail.nomineeRelation})` : ""}`,
                    ],
                    ["Dependents", detail.dependents],
                    ["Validity", `${detail.validFrom} → ${detail.validTo}`],
                    ["Documents", detail.documents.join(", ") || "—"],
                    ["Remarks", detail.remarks],
                  ].map(([k, v]) => (
                    <div key={k} className="border-border bg-muted/30 rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">{k}</div>
                      <div className="font-medium">{v || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <InsuranceClaimsCard scopedIds={scopedIds} />
    </div>
  );
}

/** Insurance claims — review, approve (admissible amount), reject and settle, with the trail on each claim. */
function InsuranceClaimsCard({ scopedIds }) {
  const me = useCurrentUser();
  const claims = useInsuranceClaims().filter((c) => scopedIds.has(c.empId));
  const canAct =
    ["CFO", "Admin", "CHRO", "SuperAdmin"].includes(me.role) || can(me.role, "finance.manage");
  const act = (r) => toast[r.ok ? "success" : "error"](r.message);
  const tone = (st) =>
    st === "Settled" || st === "Approved"
      ? "border-primary/30 bg-primary/10 text-primary"
      : st === "Rejected"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-gold/30 bg-gold/10 text-gold";
  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="mb-3">
          <div className="font-semibold">Insurance claims</div>
          <div className="text-muted-foreground text-xs">
            Hospitalisation and reimbursement claims against the policies above — review, approve
            the admissible amount, reject with a reason, and settle with the payment reference.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Claim",
                  "Employee",
                  "Policy",
                  "Nature",
                  "Claimed",
                  "Approved",
                  "Documents",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {claims.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted-foreground p-8 text-center">
                    No insurance claims raised.
                  </td>
                </tr>
              )}
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 align-top">
                  <td className="p-3 font-mono text-xs">
                    {c.id}
                    <div className="text-muted-foreground">{c.raisedOn}</div>
                  </td>
                  <td className="p-3 font-medium">
                    {c.employee}
                    <div className="text-muted-foreground text-xs font-normal">{c.details}</div>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {c.type}
                    <div>{c.policyNumber}</div>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">{c.nature}</td>
                  <td className="p-3 text-right tabular-nums">{inr(c.claimAmount)}</td>
                  <td className="p-3 text-right tabular-nums">
                    {c.approvedAmount ? inr(c.approvedAmount) : "—"}
                  </td>
                  <td className="p-3">
                    <AttachmentChips
                      names={c.documents}
                      context={`Insurance claim ${c.id}`}
                      size="xs"
                    />
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={tone(c.status)}>
                      {c.status}
                    </Badge>
                    <div className="text-muted-foreground mt-0.5 max-w-[180px] text-[11px]">
                      {c.trail[c.trail.length - 1]?.action} · {c.trail[c.trail.length - 1]?.by}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {!canAct || c.empId === me.id ? (
                      <span className="text-muted-foreground text-xs">
                        {canAct ? "Your own claim" : "—"}
                      </span>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        {c.status === "Pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() =>
                              act(actInsuranceClaim(c.id, me.name, "review", { byId: me.id }))
                            }
                          >
                            Take up for review
                          </Button>
                        )}
                        {(c.status === "Pending" || c.status === "Under Review") && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary h-7"
                              onClick={() => {
                                const amount = window.prompt(
                                  `Admissible amount for ${c.id} (claimed ${inr(c.claimAmount)}):`,
                                  String(c.claimAmount),
                                );
                                if (amount === null) return;
                                act(
                                  actInsuranceClaim(c.id, me.name, "approve", {
                                    amount,
                                    byId: me.id,
                                  }),
                                );
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive h-7"
                              onClick={() => {
                                const note = window.prompt(`Reason for rejecting ${c.id}:`, "");
                                if (!note?.trim()) return;
                                act(
                                  actInsuranceClaim(c.id, me.name, "reject", { note, byId: me.id }),
                                );
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {c.status === "Approved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary h-7"
                            onClick={() => {
                              const ref = window.prompt(`Payment reference (UTR) for ${c.id}:`, "");
                              if (ref === null) return;
                              act(actInsuranceClaim(c.id, me.name, "settle", { ref, byId: me.id }));
                            }}
                          >
                            Settle
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
