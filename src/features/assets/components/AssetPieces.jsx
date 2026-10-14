// Shared asset dialogs: detailed register form, issue form (with checklist), return check, condition-issue
// tracker and the "report an issue" form. Used by the org Asset Lifecycle workspace and the employee portal.
import { useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  XCircle,
  Wrench,
  ShieldAlert,
  FileDown,
  History,
  AlertTriangle,
  IndianRupee,
  UserCheck,
  Undo2,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCurrentUser, userById, can } from "@/features/auth/data/auth-session";
import { inr } from "@/lib/store";
import { exportReportPdf } from "@/lib/export-utils";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { WorkflowStepper } from "@/features/payroll/components/PayslipBreakdown";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  AttachmentsInput,
  KV,
} from "@/features/employees/components/CasePieces";
import {
  ASSET_CONDITIONS,
  ASSET_KINDS,
  ISSUE_CATEGORIES,
  ISSUE_RESOLUTIONS,
  ISSUE_SEVERITIES,
  RECOVERY_MODES,
  addAsset,
  assessAssetIssue,
  financeReviewAssetIssue,
  canManagerReviewIssue,
  canFinanceReviewIssue,
  issueAsset,
  issueStepIndex,
  issueSteps,
  managerReviewAssetIssue,
  raiseAssetIssue,
  recordReturnCheck,
  resolveAssetIssue,
  closeAssetIssue,
  useAssetMaster,
  useAssets,
  useIssuances,
  bookValue,
  activeIssuanceOf,
  useAssetIssues,
  assetTypeByName,
} from "@/features/assets/data/asset-data";

export const empName = (id) => (id ? (userById(id)?.name ?? id) : "—");
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Local calendar date — toISOString() is UTC and is a day behind in IST before 05:30.
const today = () => isoLocal(new Date());

export const assetStatusTone = {
  "In Stock": "bg-muted text-muted-foreground border-border",
  Issued: "bg-primary/10 text-primary border-primary/20",
  "Return Pending": "bg-gold/15 text-gold border-gold/40",
  "Under Maintenance": "bg-gold/15 text-gold border-gold/40",
  Retired: "bg-destructive/10 text-destructive border-destructive/20",
  Lost: "bg-destructive/10 text-destructive border-destructive/20",
  Pending: "bg-gold/15 text-gold border-gold/40",
  Approved: "bg-primary/10 text-primary border-primary/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};
export const issueStatusTone = (s) =>
  s === "Resolved" || s === "Closed"
    ? "bg-primary/10 text-primary border-primary/20"
    : s === "Open"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-gold/15 text-gold border-gold/40";
export const severityTone = (s) =>
  s === "Critical" || s === "High"
    ? "border-destructive/40 text-destructive"
    : s === "Medium"
      ? "border-gold/50 text-gold"
      : "border-border text-muted-foreground";

/* ------------------------------ Add asset ------------------------------ */
export function NewAssetForm({ orgId, onDone }) {
  const me = useCurrentUser();
  const master = useAssetMaster().filter((t) => t.active);
  const allAssets = useAssets();
  const [f, setF] = useState({
    tag: "",
    name: "",
    model: "",
    type: master[0]?.name ?? "Laptop",
    kind: master[0]?.kind ?? "Hardware",
    serial: "",
    specifications: "",
    purchaseDate: today(),
    vendor: "",
    invoiceNo: "",
    cost: "",
    warrantyTill: "",
    condition: "Excellent",
    location: "",
    custodianDept: master[0]?.custodianDept ?? "IT & Systems",
    licenseKey: "",
    seats: "",
    renewalDate: "",
    accessories: master[0]?.accessories ?? [],
    attachments: [],
    notes: "",
  });
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const type = master.find((t) => t.name === f.type);
  // Next free running number for the type code (deterministic — Math.random in render re-rolled the placeholder on every keystroke).
  const nextTag = (code) => {
    const prefix = `SRN-${code}-`;
    const n = allAssets
      .filter((a) => a.tag.startsWith(prefix))
      .reduce((m, a) => Math.max(m, Number(a.tag.slice(prefix.length)) || 0), 0);
    return `${prefix}${String(n + 1).padStart(3, "0")}`;
  };
  const tagTaken =
    !!f.tag.trim() && allAssets.some((a) => a.tag.toUpperCase() === f.tag.trim().toUpperCase());
  const serialTaken =
    !!f.serial.trim() &&
    f.serial.trim() !== "—" &&
    allAssets.some((a) => a.serial.toUpperCase() === f.serial.trim().toUpperCase());
  const dateBad =
    !f.purchaseDate ||
    f.purchaseDate > today() ||
    (!!f.warrantyTill && f.warrantyTill < f.purchaseDate) ||
    (!!f.renewalDate && f.renewalDate < f.purchaseDate);
  const valid = !!(
    f.tag.trim() &&
    !tagTaken &&
    !serialTaken &&
    !dateBad &&
    f.name.trim() &&
    f.vendor.trim() &&
    Number(f.cost) > 0 &&
    (!type?.requiresSerial || f.serial.trim())
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Boxes className="text-primary h-5 w-5" /> Add asset to the register
        </DialogTitle>
        <DialogDescription>
          Types, checklists and accessories come from Master Data → Assets. Serial number is
          mandatory for serialised types.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <SectionTitle n={1} title="Identification" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Asset type" required>
            <Select
              value={f.type}
              onValueChange={(v) => {
                const t = master.find((x) => x.name === v);
                set({
                  type: v,
                  kind: t?.kind ?? f.kind,
                  custodianDept: t?.custodianDept ?? f.custodianDept,
                  accessories: t?.accessories ?? [],
                  tag: f.tag || nextTag(t?.code ?? "AS"),
                });
              }}
            >
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
          <Field label="Category">
            <Select value={f.kind} onValueChange={(v) => set({ kind: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Asset tag"
            required
            hint={tagTaken ? "This tag is already on another asset" : "Unique sticker / label id"}
          >
            <Input
              value={f.tag}
              onChange={(e) => set({ tag: e.target.value.toUpperCase() })}
              placeholder={nextTag(type?.code ?? "AS")}
            />
          </Field>
          <Field
            label={type?.requiresSerial ? "Serial / IMEI / registration no." : "Serial (optional)"}
            required={type?.requiresSerial}
            hint={serialTaken ? "This serial is already registered" : undefined}
          >
            <Input
              value={f.serial}
              onChange={(e) => set({ serial: e.target.value })}
              className="font-mono"
              placeholder="Exactly as printed on the device"
            />
          </Field>
          <Field label="Asset name" required className="sm:col-span-2">
            <Input
              value={f.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="MacBook Air M3 13-inch"
            />
          </Field>
          <Field label="Model / variant" className="sm:col-span-2">
            <Input
              value={f.model}
              onChange={(e) => set({ model: e.target.value })}
              placeholder="M3 · 16 GB · 512 GB · Midnight"
            />
          </Field>
          <Field label="Specifications / description" className="sm:col-span-2 lg:col-span-4">
            <Textarea
              rows={2}
              value={f.specifications}
              onChange={(e) => set({ specifications: e.target.value })}
              placeholder="Configuration, colour, included software, any identifying marks"
            />
          </Field>
        </div>

        <SectionTitle n={2} title="Procurement & warranty" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Vendor / supplier" required>
            <Input
              value={f.vendor}
              onChange={(e) => set({ vendor: e.target.value })}
              placeholder="Supplier name"
            />
          </Field>
          <Field label="Invoice number">
            <Input
              value={f.invoiceNo}
              onChange={(e) => set({ invoiceNo: e.target.value })}
              placeholder="INV-…"
            />
          </Field>
          <Field label="Purchase date" required>
            <Input
              type="date"
              value={f.purchaseDate}
              max={today()}
              onChange={(e) => set({ purchaseDate: e.target.value })}
            />
          </Field>
          <Field label="Cost (₹, incl. GST)" required>
            <Input
              type="number"
              min={0}
              value={f.cost}
              onChange={(e) => set({ cost: e.target.value })}
              placeholder="Invoice value"
            />
          </Field>
          <Field
            label="Warranty / AMC till"
            hint={
              f.warrantyTill && f.warrantyTill < f.purchaseDate
                ? "Cannot be before the purchase date"
                : undefined
            }
          >
            <Input
              type="date"
              value={f.warrantyTill}
              min={f.purchaseDate}
              onChange={(e) => set({ warrantyTill: e.target.value })}
            />
          </Field>
          <Field label="Useful life (from master)">
            <Input
              value={type ? `${type.usefulLifeYears} years · ${type.depreciationPct}% p.a.` : "—"}
              disabled
            />
          </Field>
          <Field label="Condition">
            <Select value={f.condition} onValueChange={(v) => set({ condition: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Custodian department">
            <Input
              value={f.custodianDept}
              onChange={(e) => set({ custodianDept: e.target.value })}
            />
          </Field>
          <Field label="Location / store" className="sm:col-span-2">
            <Select
              value={f.location || "none"}
              onValueChange={(v) => set({ location: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {ALL_MANAGED_BRANCHES.map((b) => (
                  <SelectItem key={b.id} value={`${b.office} · ${b.name}`}>
                    {b.office} · {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {f.kind === "Software License" && (
            <>
              <Field label="License key / seat ref">
                <Input
                  value={f.licenseKey}
                  onChange={(e) => set({ licenseKey: e.target.value })}
                  className="font-mono"
                />
              </Field>
              <Field label="Seats">
                <Input
                  type="number"
                  min={1}
                  value={f.seats}
                  onChange={(e) => set({ seats: e.target.value })}
                />
              </Field>
              <Field label="Renewal / expiry">
                <Input
                  type="date"
                  value={f.renewalDate}
                  onChange={(e) => set({ renewalDate: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>

        <SectionTitle n={3} title="Accessories, documents & notes" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Accessories included (from master — untick what is missing)
            </Label>
            <div className="border-border space-y-1.5 rounded-lg border p-3">
              {(type?.accessories ?? []).map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={f.accessories.includes(a)}
                    onCheckedChange={(v) =>
                      set({
                        accessories: v
                          ? [...f.accessories, a]
                          : f.accessories.filter((x) => x !== a),
                      })
                    }
                  />
                  {a}
                </label>
              ))}
              {(type?.accessories ?? []).length === 0 && (
                <div className="text-muted-foreground text-xs">
                  No accessories defined for this type.
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <AttachmentsInput
              value={f.attachments}
              onChange={(v) => set({ attachments: v })}
              label="Documents"
              hint="Invoice, warranty card, photos"
            />
            <Field label="Notes">
              <Textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() => {
            const row = addAsset({
              orgId,
              tag: f.tag.trim(),
              name: f.name.trim(),
              model: f.model.trim() || undefined,
              type: f.type,
              kind: f.kind,
              serial: f.serial.trim() || "—",
              specifications: f.specifications.trim() || undefined,
              purchaseDate: f.purchaseDate,
              vendor: f.vendor.trim() || "—",
              invoiceNo: f.invoiceNo.trim() || undefined,
              cost: Number(f.cost),
              warrantyTill: f.warrantyTill || undefined,
              condition: f.condition,
              location: f.location || undefined,
              custodianDept: f.custodianDept || undefined,
              licenseKey: f.kind === "Software License" ? f.licenseKey || undefined : undefined,
              seats: f.seats ? Number(f.seats) : undefined,
              renewalDate: f.renewalDate || undefined,
              accessories: f.accessories,
              attachments: f.attachments,
              notes: f.notes.trim() || undefined,
              usefulLifeYears: type?.usefulLifeYears,
              by: me.name,
            });
            toast.success(`${row.tag} added to the register`);
            onDone(row.id);
          }}
        >
          Add asset
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------ Issue asset ------------------------------ */
export function IssueAssetForm({ asset, presetEmployeeId, requestNote, onDone }) {
  const me = useCurrentUser();
  const type = assetTypeByName(asset.type);
  const [employeeId, setEmployeeId] = useState(presetEmployeeId ?? "");
  const [purpose, setPurpose] = useState(requestNote ? "Approved request" : "Regular work");
  const [expectedReturn, setExpectedReturn] = useState(
    type?.defaultReturnDays
      ? isoLocal(new Date(Date.now() + type.defaultReturnDays * 86400000))
      : "",
  );
  const [untilSeparation, setUntilSeparation] = useState(!type?.defaultReturnDays);
  const [location, setLocation] = useState(asset.location ?? "");
  const [condition, setCondition] = useState(asset.condition);
  const [serialTyped, setSerialTyped] = useState("");
  const [accessories, setAccessories] = useState(asset.accessories ?? type?.accessories ?? []);
  const [checklist, setChecklist] = useState(
    (type?.checklist ?? []).map((item) => ({ item, ok: true, remark: "" })),
  );
  const [notes, setNotes] = useState(requestNote ?? "");
  const serialOk =
    !type?.requiresSerial ||
    asset.serial === "—" ||
    serialTyped.trim().toUpperCase() === asset.serial.toUpperCase();
  const valid =
    !!employeeId &&
    serialOk &&
    (untilSeparation || (!!expectedReturn && expectedReturn >= today()));
  const emp = userById(employeeId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Issue {asset.tag} — {asset.name}
        </DialogTitle>
        <DialogDescription>
          Verify the serial, tick the condition checklist and accessories being handed over, and
          record purpose and return date. The employee acknowledges receipt on their portal.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <SectionTitle n={1} title="Who & why" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Issue to"
            required
            className="sm:col-span-2"
            hint={
              presetEmployeeId
                ? "Fixed — this issue fulfils the employee's approved request"
                : undefined
            }
          >
            {presetEmployeeId ? (
              <Input value={`${empName(presetEmployeeId)} (${presetEmployeeId})`} disabled />
            ) : (
              <EmployeePicker value={employeeId} onChange={(id) => setEmployeeId(id)} />
            )}
          </Field>
          {emp && (
            <div className="text-muted-foreground text-xs sm:col-span-2">
              {emp.name} · {emp.designation} · {emp.dept} · {emp.branch} · reports to{" "}
              {empName(emp.managerId)}
            </div>
          )}
          <Field label="Purpose of issue" required>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "Regular work",
                  "New joiner kit",
                  "Approved request",
                  "Project / client site",
                  "Work from home",
                  "Temporary / loaner",
                  "Replacement for faulty asset",
                  "Role-based access",
                  "Travel",
                ].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Location of use">
            <Select
              value={location || "none"}
              onValueChange={(v) => setLocation(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="Work from home">Work from home</SelectItem>
                <SelectItem value="Client site">Client site</SelectItem>
                {ALL_MANAGED_BRANCHES.map((b) => (
                  <SelectItem key={b.id} value={`${b.office} · ${b.name}`}>
                    {b.office} · {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expected return date" required={!untilSeparation}>
            <Input
              type="date"
              value={expectedReturn}
              disabled={untilSeparation}
              min={today()}
              onChange={(e) => setExpectedReturn(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox checked={untilSeparation} onCheckedChange={(v) => setUntilSeparation(!!v)} />{" "}
            Until separation / role change
          </label>
        </div>

        <SectionTitle n={2} title="Verification & condition at issue" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={`Serial on the device${type?.requiresSerial ? " (must match register)" : ""}`}
            hint={`Register: ${asset.serial}`}
          >
            <Input
              value={serialTyped}
              onChange={(e) => setSerialTyped(e.target.value)}
              className={cn(
                "font-mono",
                serialTyped && (serialOk ? "border-primary" : "border-destructive"),
              )}
              placeholder="Type the serial you see"
            />
          </Field>
          <Field label="Condition on issue">
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <ChecklistEditor
          value={checklist}
          onChange={setChecklist}
          title="Condition checklist (from master)"
        />
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Accessories handed over</Label>
          <div className="border-border flex flex-wrap gap-3 rounded-lg border p-3">
            {(asset.accessories ?? type?.accessories ?? []).map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={accessories.includes(a)}
                  onCheckedChange={(v) =>
                    setAccessories((p) => (v ? [...p, a] : p.filter((x) => x !== a)))
                  }
                />
                {a}
              </label>
            ))}
            {(asset.accessories ?? type?.accessories ?? []).length === 0 && (
              <span className="text-muted-foreground text-xs">None</span>
            )}
          </div>
        </div>
        <Field label="Remarks">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any existing scratches, missing items, special instructions"
          />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            const iss = issueAsset(asset.id, employeeId, condition, notes.trim() || undefined, {
              purpose,
              expectedReturn: untilSeparation ? null : expectedReturn,
              location: location || undefined,
              serialVerified: serialOk && (!!serialTyped || asset.serial === "—"),
              accessoriesIssued: accessories,
              checklistOnIssue: checklist,
              issuedBy: me.name,
            });
            if (!iss) {
              toast.error(`${asset.tag} is no longer in stock — it cannot be issued`);
              onDone(false);
              return;
            }
            toast.success(
              `${asset.tag} issued to ${empName(employeeId)} — acknowledgement requested`,
            );
            onDone(true);
          }}
        >
          Issue asset
        </Button>
      </DialogFooter>
    </>
  );
}

export function ChecklistEditor({ value, onChange, title, readOnly }) {
  if (!value.length) return null;
  const upd = (i, patch) => onChange?.(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const okCount = value.filter((c) => c.ok).length;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">{title}</Label>
        <span
          className={cn(
            "text-xs font-semibold",
            okCount === value.length ? "text-primary" : "text-destructive",
          )}
        >
          {okCount}/{value.length} OK
        </span>
      </div>
      <div className="border-border divide-border divide-y rounded-lg border">
        {value.map((c, i) => (
          <div
            key={c.item}
            className="grid grid-cols-1 items-center gap-2 p-2 text-sm sm:grid-cols-[1fr_auto_1fr]"
          >
            <span>{c.item}</span>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant={c.ok ? "default" : "outline"}
                className={cn("h-7", c.ok && "bg-primary text-white")}
                disabled={readOnly}
                onClick={() => upd(i, { ok: true })}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> OK
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!c.ok ? "default" : "outline"}
                className={cn("h-7", !c.ok && "bg-destructive text-white")}
                disabled={readOnly}
                onClick={() => upd(i, { ok: false })}
              >
                <XCircle className="h-3.5 w-3.5" /> Not OK
              </Button>
            </div>
            {readOnly ? (
              <span className="text-muted-foreground text-xs">{c.remark || (c.ok ? "" : "—")}</span>
            ) : (
              <Input
                className="h-7 text-xs"
                value={c.remark ?? ""}
                onChange={(e) => upd(i, { remark: e.target.value })}
                placeholder={c.ok ? "Remark (optional)" : "What is wrong?"}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Return check ------------------------------ */
export function ReturnCheckForm({ issuance, onDone }) {
  const me = useCurrentUser();
  const asset = useAssets().find((a) => a.id === issuance.assetId);
  const type = asset ? assetTypeByName(asset.type) : undefined;
  const [checklist, setChecklist] = useState(
    (issuance.checklistOnIssue?.length
      ? issuance.checklistOnIssue
      : (type?.checklist ?? []).map((item) => ({ item, ok: true }))
    ).map((c) => ({ item: c.item, ok: true, remark: "" })),
  );
  const [accessories, setAccessories] = useState(issuance.accessoriesIssued ?? []);
  const [condition, setCondition] = useState(issuance.conditionOnIssue);
  const [serialTyped, setSerialTyped] = useState("");
  const [remarks, setRemarks] = useState("");
  const [category, setCategory] = useState("Physical damage");
  const [severity, setSeverity] = useState("High");
  const [evidence, setEvidence] = useState([]);
  const [issueDesc, setIssueDesc] = useState("");
  const missing = (issuance.accessoriesIssued ?? []).filter((a) => !accessories.includes(a));
  const notOk = checklist.filter((c) => !c.ok);
  const outcome = useMemo(() => {
    if (condition === "Not working") return "Not working";
    if (condition === "Damaged" || notOk.length > 0) return "Damaged";
    if (missing.length > 0) return "Missing accessories";
    return "OK";
  }, [condition, notOk.length, missing.length]);
  const problem = outcome !== "OK";
  const serialOk =
    !asset ||
    asset.serial === "—" ||
    !type?.requiresSerial ||
    serialTyped.trim().toUpperCase() === asset.serial.toUpperCase();
  const valid = serialOk && (!problem || issueDesc.trim());

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Undo2 className="text-primary h-5 w-5" /> Return check — {asset?.tag} · {asset?.name}
        </DialogTitle>
        <DialogDescription>
          Returned by {empName(issuance.employeeId)} · issued{" "}
          <span className="whitespace-nowrap">{issuance.issuedOn}</span>
          {issuance.expectedReturn ? ` · expected back ${issuance.expectedReturn}` : ""}. Verify the
          same items that were checked at issue. If everything is OK the asset is marked returned;
          otherwise a condition issue is opened and tracked.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {issuance.employeeReturnRemarks && (
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <span className="text-muted-foreground text-xs">Employee's note: </span>
            {issuance.employeeReturnRemarks}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Serial on the returned item" hint={`Register: ${asset?.serial ?? "—"}`}>
            <Input
              value={serialTyped}
              onChange={(e) => setSerialTyped(e.target.value)}
              className={cn(
                "font-mono",
                serialTyped && (serialOk ? "border-primary" : "border-destructive"),
              )}
            />
          </Field>
          <Field label="Condition at issue">
            <Input value={issuance.conditionOnIssue} disabled />
          </Field>
          <Field label="Condition on return">
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <ChecklistEditor
          value={checklist}
          onChange={setChecklist}
          title="Condition checklist — same items as at issue"
        />
        {(issuance.accessoriesIssued?.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Accessories returned (issued: {issuance.accessoriesIssued.join(", ")})
            </Label>
            <div className="border-border flex flex-wrap gap-3 rounded-lg border p-3">
              {issuance.accessoriesIssued.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={accessories.includes(a)}
                    onCheckedChange={(v) =>
                      setAccessories((p) => (v ? [...p, a] : p.filter((x) => x !== a)))
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>
        )}
        <Field label="Checker's remarks">
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>

        <div
          className={cn(
            "rounded-xl border p-4",
            problem ? "border-destructive/40 bg-destructive/5" : "border-primary/40 bg-primary/5",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {problem ? (
              <AlertTriangle className="text-destructive h-4 w-4" />
            ) : (
              <CheckCircle2 className="text-primary h-4 w-4" />
            )}{" "}
            Outcome: {outcome}
          </div>
          {!problem ? (
            <p className="text-muted-foreground mt-1 text-xs">
              All items OK and accessories complete — approving marks {asset?.tag} returned and back
              in stock.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-muted-foreground text-xs">
                A condition issue will be opened. The asset manager then assesses whether the
                employee mishandled the asset (→ manager remarks → Finance recovery) or the asset
                failed on its own (→ repair / replacement).
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Issue category">
                  <Select value={category} onValueChange={(v) => setCategory(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Severity">
                  <Select value={severity} onValueChange={(v) => setSeverity(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_SEVERITIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Describe the damage / fault" required className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={issueDesc}
                    onChange={(e) => setIssueDesc(e.target.value)}
                    placeholder={`${notOk.map((c) => c.item).join(", ")}${missing.length ? ` · missing: ${missing.join(", ")}` : ""}`}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <AttachmentsInput
                    value={evidence}
                    onChange={setEvidence}
                    label="Photos / evidence"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          className={cn(
            "text-white",
            problem ? "bg-destructive hover:bg-destructive/90" : "bg-gradient-emerald",
          )}
          onClick={() => {
            const r = recordReturnCheck(
              issuance.id,
              {
                checklist,
                accessoriesReturned: accessories,
                condition,
                outcome,
                remarks: remarks.trim(),
                checkedBy: me.name,
              },
              me,
              problem ? { category, severity, description: issueDesc.trim(), evidence } : undefined,
            );
            toast[r.ok ? "success" : "error"](r.message);
            onDone(r.ok ? { issueId: r.issueId } : undefined);
          }}
        >
          {problem ? "Record & open condition issue" : "Approve return"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------ Report an issue (employee) ------------------------------ */
export function ReportIssueForm({ asset, employeeId, onDone }) {
  const me = useCurrentUser();
  const [category, setCategory] = useState("Not working / breakdown");
  const [severity, setSeverity] = useState("Medium");
  const [when, setWhen] = useState(today());
  const [desc, setDesc] = useState("");
  const [evidence, setEvidence] = useState([]);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldAlert className="text-destructive h-5 w-5" /> Report an issue — {asset.name}
        </DialogTitle>
        <DialogDescription>
          {asset.tag} · {asset.serial}. The asset manager assesses the cause; you can follow every
          step on My Assets.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What happened" required>
          <Select value={category} onValueChange={(v) => setCategory(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="How badly does it affect your work">
          <Select value={severity} onValueChange={(v) => setSeverity(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_SEVERITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="When did you notice it">
          <Input type="date" value={when} max={today()} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <div />
        <Field
          label="Describe the problem in detail"
          required
          className="sm:col-span-2"
          hint="What happened, when, what you were doing, error messages, anything you tried"
        >
          <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <AttachmentsInput value={evidence} onChange={setEvidence} label="Photos / screenshots" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          disabled={!desc.trim()}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            const id = raiseAssetIssue(
              {
                assetId: asset.id,
                issuanceId: activeIssuanceOf(asset.id)?.id ?? null,
                employeeId,
                source: "Employee report",
                category,
                severity,
                description: desc.trim(),
                evidence,
                whenNoticed: when,
              },
              me,
            );
            toast.success(`Issue ${id} raised — the asset manager has been notified`);
            onDone(id);
          }}
        >
          Submit issue
        </Button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------ Issue detail & workflow ------------------------------ */
export function AssetIssueDetail({ issue, mode }) {
  const me = useCurrentUser();
  const asset = useAssets().find((a) => a.id === issue.assetId);
  const issuance = useIssuances().find((i) => i.id === issue.issuanceId);
  const steps = issueSteps(issue);
  const active =
    issueStepIndex(issue) + (issue.status === "Resolved" || issue.status === "Closed" ? 1 : 0);
  const isAssetManager = can(me.role, "asset.manage");
  const isFinance =
    me.role === "CFO" ||
    me.role === "Admin" ||
    me.role === "SuperAdmin" ||
    can(me.role, "finance.manage");
  // Segregation of duties: whoever assessed the issue (or holds the asset) cannot also give the manager remarks, and
  // neither the assessor nor the reviewing manager can take the Finance recovery decision.
  const mayManagerReview = canManagerReviewIssue(issue, me);
  const mayFinanceReview = isFinance && canFinanceReviewIssue(issue, me);

  const [cause, setCause] = useState(
    issue.cause === "Undetermined" ? "Asset fault / breakdown" : issue.cause,
  );
  const [causeDetails, setCauseDetails] = useState(issue.causeDetails ?? "");
  const [estCost, setEstCost] = useState(String(issue.estimatedCost ?? ""));
  const [mgrDecision, setMgrDecision] = useState("Agree — employee at fault");
  const [mgrRemarks, setMgrRemarks] = useState("");
  const [finDecision, setFinDecision] = useState("Recover partially");
  const [recovery, setRecovery] = useState(
    String(issue.estimatedCost ? Math.round(issue.estimatedCost / 2) : 0),
  );
  const [recoveryMode, setRecoveryMode] = useState("Salary deduction");
  const [finRemarks, setFinRemarks] = useState("");
  const [resolution, setResolution] = useState("Repaired");
  const [vendor, setVendor] = useState(issue.repairVendor ?? "");
  const [repairCost, setRepairCost] = useState(
    String(issue.repairCost ?? issue.estimatedCost ?? ""),
  );
  const [resNotes, setResNotes] = useState("");
  const recoveryCap = Math.max(issue.estimatedCost ?? 0, asset?.cost ?? 0);
  const recoveryNum = Number(recovery);
  const recoveryBad =
    finDecision !== "Waive" &&
    (!(recoveryNum > 0) || (recoveryCap > 0 && recoveryNum > recoveryCap));
  const estBad = estCost !== "" && !(Number(estCost) >= 0);
  const [toStock, setToStock] = useState(true);

  const pdf = () =>
    exportReportPdf({
      title: `Asset condition issue ${issue.id}`,
      subtitle: `${asset?.tag ?? ""} · ${asset?.name ?? issue.assetId} · ${issue.category} · ${issue.status}`,
      columns: ["Item", "Detail"],
      rows: [
        ["Asset", `${asset?.tag} · ${asset?.name} · ${asset?.serial}`],
        ["Holder", empName(issue.employeeId)],
        ["Raised", `${issue.raisedOn} by ${issue.raisedBy} (${issue.source})`],
        ["Category / severity", `${issue.category} · ${issue.severity}`],
        ["Description", issue.description],
        ["Cause", `${issue.cause}${issue.causeDetails ? ` — ${issue.causeDetails}` : ""}`],
        ["Estimated cost", issue.estimatedCost ? inr(issue.estimatedCost) : "—"],
        [
          "Manager review",
          issue.managerDecision ? `${issue.managerDecision} — ${issue.managerRemarks ?? ""}` : "—",
        ],
        [
          "Finance",
          issue.financeDecision
            ? `${issue.financeDecision} · ${inr(issue.recoveryAmount ?? 0)} · ${issue.recoveryMode}`
            : "—",
        ],
        [
          "Resolution",
          issue.resolution
            ? `${issue.resolution}${issue.repairCost ? ` · ${inr(issue.repairCost)}` : ""} — ${issue.resolutionNotes ?? ""}`
            : "—",
        ],
        ...issue.history.map((h) => [
          `${h.at} · ${h.by}`,
          `${h.action}${h.note ? ` — ${h.note}` : ""}`,
        ]),
      ],
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldAlert className="text-destructive h-5 w-5" /> {issue.id} ·{" "}
          {asset?.name ?? issue.assetId}
        </DialogTitle>
        <DialogDescription>
          {asset?.tag} · {asset?.serial} · held by {empName(issue.employeeId)} · raised{" "}
          <span className="whitespace-nowrap">{issue.raisedOn}</span> by {issue.raisedBy} (
          {issue.source})
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={issueStatusTone(issue.status)}>
            {issue.status}
          </Badge>
          <Badge variant="outline">{issue.category}</Badge>
          <Badge variant="outline" className={severityTone(issue.severity)}>
            {issue.severity}
          </Badge>
          <Badge
            variant="outline"
            className={
              issue.cause === "Employee mishandling"
                ? "border-destructive/40 text-destructive"
                : issue.cause === "Asset fault / breakdown"
                  ? "border-primary/40 text-primary"
                  : ""
            }
          >
            Cause: {issue.cause}
          </Badge>
          <Button size="sm" variant="outline" className="ml-auto" onClick={pdf}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </div>
        <WorkflowStepper
          steps={steps}
          active={active}
          title="Tracking"
          badge={
            <span className="text-muted-foreground text-xs">
              {issue.cause === "Employee mishandling"
                ? "Mishandling path: manager remarks → Finance recovery"
                : issue.cause === "Asset fault / breakdown"
                  ? "Asset-fault path: repair / replacement"
                  : "Awaiting assessment"}
            </span>
          }
        />
        <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">
          {issue.description}
        </div>
        {issue.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.evidence.map((e) => (
              <Badge key={e} variant="outline" className="gap-1 font-normal">
                <Paperclip className="h-3 w-3" />
                {e}
              </Badge>
            ))}
          </div>
        )}
        <KV
          items={[
            ["Noticed on", issue.whenNoticed ?? "—"],
            ["Linked issuance", issuance ? `${issuance.id} · issued ${issuance.issuedOn}` : "—"],
            [
              "Assessment",
              issue.assessedBy ? `${issue.assessedOn} · ${issue.assessedBy}` : "Pending",
            ],
            ["Cause details", issue.causeDetails ?? "—"],
            ["Estimated cost", issue.estimatedCost ? inr(issue.estimatedCost) : "—"],
            ["Book value", asset ? inr(bookValue(asset)) : "—"],
          ]}
        />

        {(issue.managerDecision || issue.status === "Manager review") && (
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserCheck className="text-primary h-4 w-4" /> Reporting manager's remarks —{" "}
              {empName(issue.managerId)}
            </div>
            {issue.managerDecision ? (
              <KV
                cols={1}
                items={[
                  ["Decision", issue.managerDecision],
                  ["Remarks", issue.managerRemarks ?? "—"],
                  ["On", issue.managerDecidedOn ?? "—"],
                ]}
              />
            ) : (
              <p className="text-muted-foreground text-xs">
                Awaiting the manager's remarks on whether the employee was at fault.
              </p>
            )}
            {issue.status === "Manager review" && mayManagerReview && mode !== "self" && (
              <div className="border-border grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
                <Field label="Your view">
                  <Select value={mgrDecision} onValueChange={(v) => setMgrDecision(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Agree — employee at fault",
                        "Partial responsibility",
                        "Disagree — treat as asset fault",
                      ].map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Remarks" required>
                  <Textarea
                    rows={2}
                    value={mgrRemarks}
                    onChange={(e) => setMgrRemarks(e.target.value)}
                    placeholder="Context — was the asset used as instructed, any prior warnings, mitigating factors"
                  />
                </Field>
                <div className="flex justify-end sm:col-span-2">
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    disabled={!mgrRemarks.trim()}
                    onClick={() => {
                      const r = managerReviewAssetIssue(issue.id, me, {
                        decision: mgrDecision,
                        remarks: mgrRemarks.trim(),
                      });
                      toast[r.ok ? "success" : "error"](r.message);
                    }}
                  >
                    Submit remarks
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {(issue.financeDecision || issue.status === "Finance review") && (
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <IndianRupee className="text-primary h-4 w-4" /> Finance — recovery decision
            </div>
            {issue.financeDecision ? (
              <KV
                cols={1}
                items={[
                  ["Decision", issue.financeDecision],
                  ["Recovery", `${inr(issue.recoveryAmount ?? 0)} · ${issue.recoveryMode}`],
                  ["Remarks", issue.financeRemarks ?? "—"],
                  ["By", `${issue.financeDecidedBy} · ${issue.financeDecidedOn}`],
                ]}
              />
            ) : (
              <p className="text-muted-foreground text-xs">
                Manager confirmed rough handling — Finance decides how much (if anything) to recover
                and how.
              </p>
            )}
            {issue.status === "Finance review" && mayFinanceReview && mode !== "self" && (
              <div className="border-border grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3">
                <Field label="Decision">
                  <Select value={finDecision} onValueChange={(v) => setFinDecision(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Recover full cost", "Recover partially", "Waive"].map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Recovery amount (₹)"
                  hint={
                    recoveryBad
                      ? recoveryNum > recoveryCap && recoveryCap > 0
                        ? `Cannot exceed ${inr(recoveryCap)}`
                        : "Enter an amount above zero"
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    min={0}
                    max={recoveryCap || undefined}
                    value={finDecision === "Waive" ? "0" : recovery}
                    disabled={finDecision === "Waive"}
                    onChange={(e) => setRecovery(e.target.value)}
                  />
                </Field>
                <Field label="Recovery mode">
                  <Select
                    value={recoveryMode ?? "Salary deduction"}
                    onValueChange={(v) => setRecoveryMode(v)}
                    disabled={finDecision === "Waive"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECOVERY_MODES.filter((m) => m !== "Waived").map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Remarks" required className="sm:col-span-3">
                  <Textarea
                    rows={2}
                    value={finRemarks}
                    onChange={(e) => setFinRemarks(e.target.value)}
                    placeholder="Basis — book value, insurance, policy clause"
                  />
                </Field>
                <div className="flex justify-end sm:col-span-3">
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    disabled={!finRemarks.trim() || recoveryBad}
                    onClick={() => {
                      const r = financeReviewAssetIssue(issue.id, me, {
                        decision: finDecision,
                        recoveryAmount: Number(recovery) || 0,
                        recoveryMode,
                        remarks: finRemarks.trim(),
                      });
                      toast[r.ok ? "success" : "error"](r.message);
                    }}
                  >
                    Record decision
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {(issue.status === "Open" || issue.status === "Under assessment") &&
          isAssetManager &&
          mode === "manage" && (
            <div className="border-gold/40 bg-gold/5 space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4" /> Asset manager assessment — what caused it?
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCause("Employee mishandling")}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm",
                    cause === "Employee mishandling"
                      ? "border-destructive bg-destructive/5"
                      : "border-border",
                  )}
                >
                  <div className="font-semibold">Employee mishandled the asset</div>
                  <div className="text-muted-foreground text-xs">
                    Drop, liquid, negligence, unauthorised use → manager remarks → Finance decides
                    recovery.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCause("Asset fault / breakdown")}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm",
                    cause === "Asset fault / breakdown"
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <div className="font-semibold">Asset faulty / broke down</div>
                  <div className="text-muted-foreground text-xs">
                    Wear & tear, manufacturing defect, warranty case → repair / replacement; nothing
                    recovered.
                  </div>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
                <Field label="Assessment details" required>
                  <Textarea
                    rows={2}
                    value={causeDetails}
                    onChange={(e) => setCauseDetails(e.target.value)}
                    placeholder="What you found on inspection, service-centre opinion, warranty status"
                  />
                </Field>
                <Field label="Estimated repair / replacement cost (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={estCost}
                    onChange={(e) => setEstCost(e.target.value)}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {issue.status === "Open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = assessAssetIssue(issue.id, me, {
                        cause: "Undetermined",
                        causeDetails: causeDetails.trim() || "Inspection in progress",
                        estimatedCost: Number(estCost) || undefined,
                      });
                      toast[r.ok ? "success" : "error"](r.message);
                    }}
                  >
                    Mark under assessment
                  </Button>
                )}
                <Button
                  size="sm"
                  className={cn(
                    "text-white",
                    cause === "Employee mishandling"
                      ? "bg-destructive hover:bg-destructive/90"
                      : "bg-gradient-emerald",
                  )}
                  disabled={!causeDetails.trim() || estBad}
                  onClick={() => {
                    const r = assessAssetIssue(issue.id, me, {
                      cause,
                      causeDetails: causeDetails.trim(),
                      estimatedCost: Number(estCost) || undefined,
                    });
                    toast[r.ok ? "success" : "error"](r.message);
                  }}
                >
                  {cause === "Employee mishandling"
                    ? "Confirm mishandling → send to manager"
                    : "Confirm asset fault → repair / replace"}
                </Button>
              </div>
            </div>
          )}

        {issue.status === "Repair / replacement" && isAssetManager && mode === "manage" && (
          <div className="border-border space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wrench className="text-primary h-4 w-4" /> Close the loop — repair / replacement
              outcome
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Resolution">
                <Select value={resolution} onValueChange={(v) => setResolution(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_RESOLUTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Repair vendor / service centre">
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
              </Field>
              <Field label="Actual cost (₹)">
                <Input
                  type="number"
                  min={0}
                  value={repairCost}
                  onChange={(e) => setRepairCost(e.target.value)}
                />
              </Field>
              <Field label="Notes" required className="sm:col-span-3">
                <Textarea
                  rows={2}
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder="Job sheet number, parts replaced, warranty claim reference"
                />
              </Field>
              {issue.source !== "Return check" && asset?.holderId && (
                <label className="flex items-center gap-2 text-sm sm:col-span-3">
                  <Checkbox checked={toStock} onCheckedChange={(v) => setToStock(!!v)} /> Take the
                  asset back from {empName(asset.holderId)} into stock (untick if it stays with the
                  employee after repair)
                </label>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                disabled={!resNotes.trim() || (repairCost !== "" && !(Number(repairCost) >= 0))}
                onClick={() => {
                  const r = resolveAssetIssue(issue.id, me, {
                    resolution,
                    repairVendor: vendor.trim() || undefined,
                    repairCost: Number(repairCost) || undefined,
                    notes: resNotes.trim(),
                    returnToStock: toStock,
                  });
                  toast[r.ok ? "success" : "error"](r.message);
                }}
              >
                <CheckCircle2 className="h-4 w-4" /> Mark resolved
              </Button>
            </div>
          </div>
        )}

        {issue.resolution && (
          <div className="border-primary/30 bg-primary/5 rounded-xl border p-4">
            <div className="text-sm font-semibold">Resolved — {issue.resolution}</div>
            <KV
              cols={1}
              items={[
                ["Vendor", issue.repairVendor ?? "—"],
                ["Actual cost", issue.repairCost ? inr(issue.repairCost) : "—"],
                ["Notes", issue.resolutionNotes ?? "—"],
                ["By", `${issue.resolvedBy} · ${issue.resolvedOn}`],
              ]}
            />
            {issue.status === "Resolved" && isAssetManager && mode === "manage" && (
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (closeAssetIssue(issue.id, me.name)) toast.success("Issue closed");
                    else toast.error("Only a resolved issue can be closed");
                  }}
                >
                  Close issue
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
            <History className="h-3.5 w-3.5" /> History
          </div>
          {issue.history.map((h, i) => (
            <div key={i} className="border-border rounded-lg border p-2.5 text-sm">
              <div className="text-muted-foreground text-xs">
                {h.at} · {h.by}
              </div>
              <div>
                {h.action}
                {h.note ? <span className="text-muted-foreground"> — {h.note}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------ Asset detail ------------------------------ */
export function AssetDetail({
  asset,
  onIssue,
  onReturnCheck,
  onTransfer,
  onRetire,
  onDelete,
  onOpenIssue,
  canManage,
}) {
  const issuances = useIssuances().filter((i) => i.assetId === asset.id);
  const issues = useAssetIssues().filter((i) => i.assetId === asset.id);
  const active = issuances.find((i) => i.status === "Active");
  const type = assetTypeByName(asset.type);
  const pdf = () =>
    exportReportPdf({
      title: `Asset ${asset.tag} — ${asset.name}`,
      subtitle: `${asset.type} · ${asset.kind} · ${asset.status}`,
      columns: ["Item", "Detail"],
      rows: [
        ["Serial", asset.serial],
        ["Model", asset.model ?? "—"],
        ["Specifications", asset.specifications ?? "—"],
        ["Vendor / invoice", `${asset.vendor} · ${asset.invoiceNo ?? "—"}`],
        ["Purchased", `${asset.purchaseDate} · ${inr(asset.cost)}`],
        ["Warranty till", asset.warrantyTill ?? "—"],
        ["Book value", inr(bookValue(asset))],
        ["Condition", asset.condition],
        ["Holder", empName(asset.holderId)],
        ["Location", asset.location ?? "—"],
        ["Accessories", (asset.accessories ?? []).join(", ") || "—"],
        ...issuances.map((i) => [
          `Issuance ${i.id}`,
          `${empName(i.employeeId)} · ${i.issuedOn} → ${i.returnedOn ?? "active"} · ${i.status}`,
        ]),
        ...(asset.history ?? []).map((h) => [`${h.at} · ${h.by}`, h.action]),
      ],
    });
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Boxes className="text-primary h-5 w-5" /> {asset.tag} · {asset.name}
        </DialogTitle>
        <DialogDescription>
          {asset.type} · {asset.kind}
          {asset.model ? ` · ${asset.model}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={assetStatusTone[asset.status]}>
            {asset.status}
          </Badge>
          <Badge variant="outline">{asset.condition}</Badge>
          {asset.warrantyTill && (
            <Badge
              variant="outline"
              className={
                asset.warrantyTill < today() ? "border-destructive/40 text-destructive" : ""
              }
            >
              Warranty {asset.warrantyTill < today() ? "expired" : `till ${asset.warrantyTill}`}
            </Badge>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {canManage && asset.status === "In Stock" && onIssue && (
              <Button size="sm" className="bg-gradient-emerald text-white" onClick={onIssue}>
                Issue
              </Button>
            )}
            {canManage &&
              (asset.status === "Issued" || asset.status === "Return Pending") &&
              active &&
              onReturnCheck && (
                <Button size="sm" variant="outline" onClick={() => onReturnCheck(active)}>
                  <Undo2 className="h-4 w-4" /> Return check
                </Button>
              )}
            {canManage && asset.status === "Issued" && onTransfer && (
              <Button size="sm" variant="outline" onClick={onTransfer}>
                Transfer
              </Button>
            )}
            {canManage && asset.status !== "Retired" && onRetire && (
              <Button size="sm" variant="ghost" onClick={onRetire}>
                Retire
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={pdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Serial", asset.licenseKey ?? asset.serial],
            ["Cost", inr(asset.cost)],
            ["Book value", inr(bookValue(asset))],
            ["Holder", empName(asset.holderId)],
          ].map(([k, v]) => (
            <div key={k} className="border-border rounded-lg border p-3">
              <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{k}</div>
              <div className="mt-0.5 text-sm font-semibold break-all">{v}</div>
            </div>
          ))}
        </div>
        <KV
          items={[
            ["Specifications", asset.specifications ?? "—"],
            [
              "Vendor · invoice",
              `${asset.vendor}${asset.invoiceNo ? ` · ${asset.invoiceNo}` : ""}`,
            ],
            ["Purchased", asset.purchaseDate],
            ["Useful life", `${asset.usefulLifeYears ?? type?.usefulLifeYears ?? "—"} years`],
            ["Location", asset.location ?? "—"],
            ["Custodian dept", asset.custodianDept ?? "—"],
            ["Accessories", (asset.accessories ?? []).join(", ") || "—"],
            ["Notes", asset.notes ?? "—"],
            ...(asset.kind === "Software License"
              ? [
                  ["Seats", String(asset.seats ?? "—")],
                  ["Renewal", asset.renewalDate ?? "—"],
                ]
              : []),
          ]}
        />
        {active && (
          <div className="border-primary/30 bg-primary/5 space-y-2 rounded-xl border p-4">
            <div className="text-sm font-semibold">Current issuance — {active.id}</div>
            <KV
              items={[
                ["Issued to", empName(active.employeeId)],
                ["Issued on", `${active.issuedOn} by ${active.issuedBy ?? "—"}`],
                ["Purpose", active.purpose ?? "—"],
                ["Expected return", active.expectedReturn ?? "Until separation"],
                ["Location", active.location ?? "—"],
                ["Serial verified", active.serialVerified ? "Yes" : "No"],
                ["Accessories issued", (active.accessoriesIssued ?? []).join(", ") || "—"],
                [
                  "Employee acknowledgement",
                  active.employeeAck ? `Yes · ${active.ackOn}` : "Pending",
                ],
                [
                  "Return",
                  active.returnStatus === "Requested"
                    ? `Requested ${active.returnRequestedOn} — awaiting check`
                    : active.returnStatus === "Issue raised"
                      ? `Issue ${active.issueId} open`
                      : (active.returnStatus ?? "Not started"),
                ],
              ]}
            />
            {(active.checklistOnIssue?.length ?? 0) > 0 && (
              <ChecklistEditor
                value={active.checklistOnIssue}
                title="Checklist at issue"
                readOnly
              />
            )}
          </div>
        )}
        {issues.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Condition issues
            </div>
            {issues.map((i) => (
              <div
                key={i.id}
                className="border-border hover:bg-muted/30 flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
                onClick={() => onOpenIssue?.(i.id)}
              >
                <span className="font-mono text-xs">{i.id}</span>
                <span className="flex-1">
                  {i.category} · <span className="whitespace-nowrap">{i.raisedOn}</span>
                </span>
                <Badge variant="outline" className={issueStatusTone(i.status)}>
                  {i.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {issuances.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Issuance history
            </div>
            {issuances.map((i) => (
              <div key={i.id} className="border-border rounded-lg border p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{i.id}</span>
                  <span className="font-medium">{empName(i.employeeId)}</span>
                  <span className="text-muted-foreground text-xs">
                    <span className="whitespace-nowrap">{i.issuedOn}</span> →{" "}
                    <span className="whitespace-nowrap">{i.returnedOn ?? "active"}</span>
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {i.status}
                  </Badge>
                </div>
                {i.returnOutcome && (
                  <div className="text-muted-foreground mt-1 text-xs">
                    Return: {i.returnOutcome} · {i.conditionOnReturn} · checked by{" "}
                    {i.returnCheckedBy}
                    {i.deduction ? ` · recovery ${inr(i.deduction)}` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {(asset.history?.length ?? 0) > 0 && (
          <div className="space-y-1">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              History
            </div>
            {asset.history.map((h, i) => (
              <div key={i} className="text-muted-foreground text-xs">
                {h.at} · {h.by} · {h.action}
              </div>
            ))}
          </div>
        )}
      </div>
      {canManage && onDelete && (
        <DialogFooter>
          <Button variant="outline" className="text-destructive" onClick={onDelete}>
            Delete from register
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
