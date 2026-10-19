import {
  getPayGrades,
  getPayGradeById,
  createPayGrade,
  updatePayGrade,
  patchPayGrade,
  deletePayGrade,
} from "@/api/payGradeApi";



import { useSharedList } from "@/lib/shared-list";

import { useEffect, useState } from "react";

import {

  Building,

  FileText,

  Trophy,

  UserX,

  AlertTriangle,

  MessageSquareWarning,

  Coins,

  CalendarDays,

  ShieldCheck,

  Plus,

  BookText,

  FileSignature,

  ClipboardList,

  Layers,

  Wallet,

  GitBranch,

  Clock,

  ShieldPlus,

  Boxes,

  Receipt,

  MapPinned,

  Palette,

  BookOpen,

  Briefcase,

  ListChecks,

  CalendarCheck,

  LifeBuoy,

  BellRing,

  Search,

} from "lucide-react";

import { Download, Eye, Pencil, Trash2 } from "lucide-react";

import { exportCsv, exportReportPdf } from "@/lib/export-utils";

import {

  NamedMasterTab,

  TimesheetFormatsTab,

} from "@/features/organization/components/MasterExtras";

import { GeofencingTab } from "@/features/organization/components/GeofencingTab";

import { AssetMasterTab } from "@/features/organization/components/AssetMasterTab";

import { HandbookTab } from "@/features/organization/components/HandbookTab";

import {

  GrievanceRoutingCard,

  LoanPolicyCard,

} from "@/features/organization/components/PolicyCards";

import { PerformanceMastersTab } from "@/features/performance/components/PerformanceMasters";

import { FnfConfigPanel } from "@/features/exit/components/SeparationPieces";

import { ShiftsTab } from "@/features/attendance/components/ShiftsTab";

import { PenaltyConfigTab } from "@/features/attendance/components/PenaltyConfigTab";

import { PatternsTab } from "@/features/payroll/components/PatternsTab";

import { StatePolicyTab, StatutoryConfigTab } from "@/features/payroll/components/PolicyTabs";

import { Infrastructure } from "@/features/organization/components/InfrastructureWorkspace";

import { GroupsWorkspace } from "@/features/organization/components/GroupsWorkspace";

import { OrgSettings } from "@/features/administration/components/OrgSettingsWorkspace";

import { RecruitmentMasters } from "@/features/recruitment/components/RecruitmentMastersWorkspace";

import { RoundsWorkspace } from "@/features/recruitment/components/RoundsWorkspace";

import { LocationsWorkspace } from "@/features/recruitment/components/LocationsWorkspace";

import { DeskSettings } from "@/features/helpdesk/components/DeskSettingsWorkspace";

import { ApprovalsWorkspace } from "@/features/administration/components/ApprovalsWorkspace";

import { NotificationCentre } from "@/features/communications/components/NotificationCentreWorkspace";

import { RolesHub } from "@/features/administration/components/RolesHubWorkspace";

import { can, useCurrentUser } from "@/features/auth/data/auth-session";

import {

  DocMasterTab,

  SalaryConfigTab,

  AssessmentParamsTab,

  LeaveMasterTab,

  InsurancePlansTab,

} from "@/features/organization/components/ConfigHubTabs";

import {

  insuranceTypeStore,

  insuranceCategoryStore,

  reimbursementCategoryStore,

} from "@/features/finance/data/claims-data";

import { PAY_GRADE_ROWS, PAY_BANDS } from "@/features/payroll/data/comp-config";



import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import { Badge } from "@/components/ui/badge";

import { Switch } from "@/components/ui/switch";

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

import {

  DOCUMENT_MASTER,

  AWARD_MASTER,

  TERMINATION_TYPE_MASTER,

  WARNING_TYPE_MASTER,

  COMPLAINT_TYPE_MASTER,

  PAY_COMPONENTS,

  WEEKDAYS,

  IP_RULES,

} from "@/features/organization/data/master-data";

import { CrudSection } from "@/components/common/CrudSection";

import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

import { POLICY_DOCS, POLICY_CATEGORIES } from "@/features/platform/data/support-data";



function Field({ label, children, required }) {

  return (

    <div className="space-y-1.5">

      <Label className="text-muted-foreground text-xs font-medium">

        {label} {required && <span className="text-destructive">*</span>}

      </Label>

      {children}

    </div>

  );

}



function SectionHead({ icon: Icon, title, desc, children }) {

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

      {children}

    </div>

  );

}



/** Generic name + description master with an optional "required" toggle. */

function MasterTable({ icon, title, desc, prefix, seed, withRequired, addLabel }) {

  // Shared (session-wide) list — a local useState lost every added / edited master the moment the tab changed.

  const [rows, setRows] = useSharedList(`master-${prefix}`, seed);

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [required, setRequired] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [viewRow, setViewRow] = useState(null);

  const [deleteRow, setDeleteRow] = useState(null);



  const duplicate = rows.some(

    (r) => r.id !== editingId && r.name.trim().toLowerCase() === name.trim().toLowerCase(),

  );

  function submit() {

    if (duplicate) {

      toast.error(`"${name.trim()}" already exists in ${title.toLowerCase()}`);

      return;

    }

    if (editingId) {

      setRows((p) =>

        p.map((r) =>

          r.id === editingId

            ? {

                ...r,

                name: name.trim(),

                description: description.trim(),

                required: withRequired ? required : r.required,

              }

            : r,

        ),

      );

      setOpen(false);

      setEditingId(null);

      setName("");

      setDescription("");

      setRequired(false);

      toast.success(`${title} entry updated`);

      return;

    }

    setRows((p) => {

      // Next free number — a count-based id reused the code of a surviving row after a delete (duplicate keys).

      const n = p.reduce((m, r) => Math.max(m, Number(r.id.slice(prefix.length + 1)) || 0), 0) + 1;

      return [

        {

          id: `${prefix}-${String(n).padStart(2, "0")}`,

          name: name.trim(),

          description: description.trim(),

          required: withRequired ? required : undefined,

        },

        ...p,

      ];

    });

    setOpen(false);

    setName("");

    setDescription("");

    setRequired(false);

    toast.success(`${title} entry added`);

  }



  function startEdit(r) {

    setEditingId(r.id);

    setName(r.name);

    setDescription(r.description ?? "");

    setRequired(!!r.required);

    setOpen(true);

  }



  const exportColumns = ["Code", "Name", "Description", ...(withRequired ? ["Required"] : [])];

  const exportRows = rows.map((r) => [

    r.id,

    r.name,

    r.description || "—",

    ...(withRequired ? [r.required ? "Mandatory" : "Optional"] : []),

  ]);

  const slug = title

    .toLowerCase()

    .replace(/[^a-z0-9]+/g, "-")

    .replace(/^-|-$/g, "");



  function downloadPdf() {

    const ok = exportReportPdf({

      title,

      subtitle: desc,

      summary: [{ label: "Records", value: String(rows.length) }],

      columns: exportColumns,

      rows: exportRows,

    });

    if (ok) toast.success(`${title} PDF ready in the print dialog`);

    else toast.error("Allow pop-ups to generate the PDF");

  }



  return (

    <Card className="shadow-card">

      <CardContent className="p-6">

        <SectionHead icon={icon} title={title} desc={desc}>

          <div className="flex flex-wrap items-center gap-2">

            <Button

              size="sm"

              variant="outline"

              onClick={() => {

                exportCsv(slug, exportColumns, exportRows);

                toast.success("CSV exported");

              }}

            >

              <Download className="h-4 w-4" /> CSV

            </Button>

            <Button size="sm" variant="outline" onClick={downloadPdf}>

              <FileText className="h-4 w-4" /> PDF

            </Button>

            <Dialog

              open={open}

              onOpenChange={(o) => {

                setOpen(o);

                if (!o) {

                  setEditingId(null);

                  setName("");

                  setDescription("");

                  setRequired(false);

                }

              }}

            >

              <DialogTrigger asChild>

                <Button

                  size="sm"

                  className="bg-gradient-emerald text-white"

                  onClick={() => {

                    setEditingId(null);

                    setName("");

                    setDescription("");

                    setRequired(false);

                  }}

                >

                  <Plus className="h-4 w-4" /> {addLabel}

                </Button>

              </DialogTrigger>

              <DialogContent className="sm:max-w-md">

                <DialogHeader>

                  <DialogTitle>{editingId ? `Edit ${editingId}` : addLabel}</DialogTitle>

                  <DialogDescription>

                    {editingId

                      ? `Updates this ${title.toLowerCase()} record.`

                      : `Adds a new entry to the ${title.toLowerCase()}.`}

                  </DialogDescription>

                </DialogHeader>

                <div className="space-y-4 py-2">

                  <Field label="Name" required>

                    <Input

                      value={name}

                      onChange={(e) => setName(e.target.value)}

                      placeholder="Enter name"

                    />

                  </Field>

                  <Field label="Description">

                    <Textarea

                      rows={3}

                      value={description}

                      onChange={(e) => setDescription(e.target.value)}

                      placeholder="Short description"

                    />

                  </Field>

                  {withRequired && (

                    <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2.5">

                      <div>

                        <div className="text-sm font-medium">Mandatory document</div>

                        <div className="text-muted-foreground text-xs">

                          Employees must upload this during onboarding

                        </div>

                      </div>

                      <Switch checked={required} onCheckedChange={setRequired} />

                    </div>

                  )}

                </div>

                <DialogFooter>

                  <Button variant="outline" onClick={() => setOpen(false)}>

                    Cancel

                  </Button>

                  <Button

                    disabled={!name.trim() || duplicate}

                    className="bg-gradient-emerald text-white"

                    onClick={submit}

                  >

                    {editingId ? "Save changes" : "Save"}

                  </Button>

                </DialogFooter>

              </DialogContent>

            </Dialog>

          </div>

        </SectionHead>



        <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>

          <DialogContent className="sm:max-w-md">

            <DialogHeader>

              <DialogTitle>{viewRow?.id}</DialogTitle>

              <DialogDescription>{title} record detail</DialogDescription>

            </DialogHeader>

            <dl className="divide-border divide-y text-sm">

              {[

                ["Name", viewRow?.name ?? ""],

                ["Description", viewRow?.description ?? ""],

                ...(withRequired

                  ? [["Required", viewRow?.required ? "Mandatory" : "Optional"]]

                  : []),

              ].map(([k, v]) => (

                <div key={k} className="grid grid-cols-3 gap-3 py-2">

                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">{k}</dt>

                  <dd className="col-span-2 break-words">{v || "—"}</dd>

                </div>

              ))}

            </dl>

            <DialogFooter>

              <Button variant="outline" onClick={() => setViewRow(null)}>

                Close

              </Button>

              <Button

                className="bg-gradient-emerald text-white"

                onClick={() => {

                  const r = viewRow;

                  setViewRow(null);

                  if (r) startEdit(r);

                }}

              >

                <Pencil className="h-4 w-4" /> Edit

              </Button>

            </DialogFooter>

          </DialogContent>

        </Dialog>



        <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>

          <DialogContent className="sm:max-w-md">

            <DialogHeader>

              <DialogTitle>Delete {deleteRow?.id}?</DialogTitle>

              <DialogDescription>

                This removes the record from {title.toLowerCase()}. This cannot be undone.

              </DialogDescription>

            </DialogHeader>

            <DialogFooter>

              <Button variant="outline" onClick={() => setDeleteRow(null)}>

                Cancel

              </Button>

              <Button

                variant="destructive"

                onClick={() => {

                  setRows((p) => p.filter((r) => r.id !== deleteRow.id));

                  toast.success(`${deleteRow.id} deleted`);

                  setDeleteRow(null);

                }}

              >

                <Trash2 className="h-4 w-4" /> Delete

              </Button>

            </DialogFooter>

          </DialogContent>

        </Dialog>



        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">

              <tr>

                <th className="p-3 text-left">Code</th>

                <th className="p-3 text-left">Name</th>

                <th className="p-3 text-left">Description</th>

                {withRequired && <th className="p-3 text-left">Required</th>}

                <th className="p-3 text-right">Actions</th>

              </tr>

            </thead>

            <tbody className="divide-border divide-y">

              {rows.map((r) => (

                <tr key={r.id} className="hover:bg-muted/30">

                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>

                  <td className="p-3 font-medium">{r.name}</td>

                  <td className="text-muted-foreground p-3">{r.description || "—"}</td>

                  {withRequired && (

                    <td className="p-3">

                      <Badge

                        variant="outline"

                        className={

                          r.required

                            ? "border-primary/30 bg-primary/10 text-primary"

                            : "border-border bg-muted text-muted-foreground"

                        }

                      >

                        {r.required ? "Mandatory" : "Optional"}

                      </Badge>

                    </td>

                  )}

                  <td className="p-3">

                    <div className="flex flex-wrap items-center justify-end gap-1">

                      <Button

                        size="icon"

                        variant="ghost"

                        className="h-8 w-8"

                        title="View"

                        onClick={() => setViewRow(r)}

                      >

                        <Eye className="h-4 w-4" />

                      </Button>

                      <Button

                        size="icon"

                        variant="ghost"

                        className="h-8 w-8"

                        title="Edit"

                        onClick={() => startEdit(r)}

                      >

                        <Pencil className="h-4 w-4" />

                      </Button>

                      <Button

                        size="icon"

                        variant="ghost"

                        className="text-destructive hover:text-destructive h-8 w-8"

                        title="Delete"

                        onClick={() => setDeleteRow(r)}

                      >

                        <Trash2 className="h-4 w-4" />

                      </Button>

                    </div>

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



const KINDS = ["Earning", "Allowance", "Deduction", "Statutory"];



function PayrollConfigTab() {

  const [rows, setRows] = useSharedList("pay-components", PAY_COMPONENTS);

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");

  const [code, setCode] = useState("");

  const [kind, setKind] = useState("");

  const [calculation, setCalculation] = useState("");

  const [value, setValue] = useState("");

  const [description, setDescription] = useState("");

  const [show, setShow] = useState(true);

  const [detail, setDetail] = useState(null);



  const codeTaken = rows.some((r) => r.code.toLowerCase() === code.trim().toLowerCase());

  const valueInvalid =

    /%/.test(value) &&

    !(Number(value.replace(/[^\d.]/g, "")) >= 0 && Number(value.replace(/[^\d.]/g, "")) <= 100);

  function submit() {

    if (codeTaken) {

      toast.error(`Component code ${code.trim().toUpperCase()} is already used`);

      return;

    }

    setRows((p) => [

      {

        id: `PC-${String(p.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`,

        name: name.trim(),

        code: code.trim().toUpperCase(),

        kind: kind,

        calculation: calculation || "Flat",

        value: value.trim() || "—",

        description: description.trim(),

        showInEmployeeForm: show,

      },

      ...p,

    ]);

    setOpen(false);

    setName("");

    setCode("");

    setKind("");

    setCalculation("");

    setValue("");

    setDescription("");

    setShow(true);

    toast.success("Payroll component added");

  }



  return (

    <Card className="shadow-card">

      <CardContent className="p-6">

        <SectionHead

          icon={Coins}

          title="Payroll Configuration"

          desc="Allowances, deductions and statutory heads rendered dynamically in employee and payroll forms"

        >

          <Dialog open={open} onOpenChange={setOpen}>

            <DialogTrigger asChild>

              <Button size="sm" className="bg-gradient-emerald text-white">

                <Plus className="h-4 w-4" /> Add Component

              </Button>

            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">

              <DialogHeader>

                <DialogTitle>Add Payroll Component</DialogTitle>

                <DialogDescription>

                  Fields added here appear in the employee compensation form and payslips.

                </DialogDescription>

              </DialogHeader>

              <div className="space-y-4 py-2">

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <Field label="Field name" required>

                    <Input

                      value={name}

                      onChange={(e) => setName(e.target.value)}

                      placeholder="e.g. Transport Allowance"

                    />

                  </Field>

                  <Field label="Code" required>

                    <Input

                      value={code}

                      onChange={(e) => setCode(e.target.value)}

                      placeholder="TPA"

                    />

                  </Field>

                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <Field label="Type" required>

                    <Select value={kind} onValueChange={(v) => setKind(v)}>

                      <SelectTrigger>

                        <SelectValue placeholder="Select type" />

                      </SelectTrigger>

                      <SelectContent>

                        {KINDS.map((k) => (

                          <SelectItem key={k} value={k}>

                            {k}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </Field>

                  <Field label="Calculation">

                    <Select value={calculation} onValueChange={setCalculation}>

                      <SelectTrigger>

                        <SelectValue placeholder="Flat" />

                      </SelectTrigger>

                      <SelectContent>

                        {["Flat", "% of Basic", "% of CTC", "Balancing", "Annual"].map((c) => (

                          <SelectItem key={c} value={c}>

                            {c}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </Field>

                </div>

                <Field label="Default value">

                  <Input

                    value={value}

                    onChange={(e) => setValue(e.target.value)}

                    placeholder="₹\u00A01,600 or 40%"

                  />

                </Field>

                <Field label="Description">

                  <Textarea

                    rows={2}

                    value={description}

                    onChange={(e) => setDescription(e.target.value)}

                    placeholder="How this component is used"

                  />

                </Field>

                <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2.5">

                  <div>

                    <div className="text-sm font-medium">Show in employee form</div>

                    <div className="text-muted-foreground text-xs">

                      Render this field in the Add Employee compensation section

                    </div>

                  </div>

                  <Switch checked={show} onCheckedChange={setShow} />

                </div>

              </div>

              <DialogFooter>

                <Button variant="outline" onClick={() => setOpen(false)}>

                  Cancel

                </Button>

                {(codeTaken || valueInvalid) && (

                  <span className="text-destructive mr-auto text-xs">

                    {codeTaken

                      ? "This code is already used."

                      : "A percentage must be between 0 and 100."}

                  </span>

                )}

                <Button

                  disabled={!name.trim() || !code.trim() || !kind || codeTaken || valueInvalid}

                  className="bg-gradient-emerald text-white"

                  onClick={submit}

                >

                  Save Component

                </Button>

              </DialogFooter>

            </DialogContent>

          </Dialog>

        </SectionHead>



        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">

              <tr>

                <th className="p-3 text-left">Field</th>

                <th className="p-3 text-left">Code</th>

                <th className="p-3 text-left">Type</th>

                <th className="p-3 text-left">Calculation</th>

                <th className="p-3 text-left">Value</th>

                <th className="p-3 text-left">Description</th>

                <th className="p-3 text-left">In Employee Form</th>

              </tr>

            </thead>

            <tbody className="divide-border divide-y">

              {rows.map((r) => (

                <tr key={r.id} className={clickableRow} onClick={() => setDetail(r)}>

                  <td className="p-3 font-medium">{r.name}</td>

                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.code}</td>

                  <td className="p-3">

                    <Badge

                      variant="outline"

                      className={

                        r.kind === "Deduction" || r.kind === "Statutory"

                          ? "border-destructive/30 bg-destructive/10 text-destructive"

                          : "border-primary/30 bg-primary/10 text-primary"

                      }

                    >

                      {r.kind}

                    </Badge>

                  </td>

                  <td className="text-muted-foreground p-3">{r.calculation}</td>

                  <td className="text-primary p-3 font-semibold">{r.value}</td>

                  <td className="text-muted-foreground max-w-[240px] p-3 text-xs">

                    {r.description}

                  </td>

                  <td className="p-3">{r.showInEmployeeForm ? "Yes" : "No"}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>



        {detail && (

          <RecordDetailDialog

            onClose={() => setDetail(null)}

            title={detail.name}

            subtitle={`${detail.id} · ${detail.code}`}

            badges={

              <Badge

                variant="outline"

                className={

                  detail.kind === "Deduction" || detail.kind === "Statutory"

                    ? "border-destructive/30 bg-destructive/10 text-destructive"

                    : "border-primary/30 bg-primary/10 text-primary"

                }

              >

                {detail.kind}

              </Badge>

            }

            record={detail}

            labels={{

              id: "Component ID",

              name: "Field name",

              kind: "Type",

              value: "Default value",

              showInEmployeeForm: "Show in employee form",

            }}

          />

        )}

      </CardContent>

    </Card>

  );

}



function WorkdayConfigTab() {

  // Saved configuration lives in the shared list so it survives navigation; the switches edit a draft until saved.

  const [saved, setSaved] = useSharedList("workday-config", [

    "Monday",

    "Tuesday",

    "Wednesday",

    "Thursday",

    "Friday",

  ]);

  const [days, setDays] = useState(saved);

  useEffect(() => {

    setDays(saved);

  }, [saved]);

  const toggle = (d) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const dirty = WEEKDAYS.some((d) => days.includes(d) !== saved.includes(d));



  return (

    <Card className="shadow-card">

      <CardContent className="p-6">

        <SectionHead

          icon={CalendarDays}

          title="Workday Configuration"

          desc="Select the working days per week for attendance and payroll calculations"

        >

          <Button

            size="sm"

            className="bg-gradient-emerald text-white"

            disabled={!dirty || days.length === 0}

            onClick={() => {

              setSaved(days);

              toast.success(`${days.length}-day work week saved`);

            }}

          >

            Save Configuration

          </Button>

        </SectionHead>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {WEEKDAYS.map((d) => (

            <div

              key={d}

              className="border-border bg-muted/30 flex items-center justify-between rounded-lg border px-4 py-3"

            >

              <span className="text-sm font-medium">{d}</span>

              <Switch checked={days.includes(d)} onCheckedChange={() => toggle(d)} />

            </div>

          ))}

        </div>

        <div className="text-muted-foreground mt-4 text-sm">

          Working days per week:{" "}

          <span className="text-foreground font-semibold">{days.length}</span>

        </div>

      </CardContent>

    </Card>

  );

}



function IpRestrictTab() {

  const [rows, setRows] = useSharedList("ip-rules", IP_RULES);

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");

  const [address, setAddress] = useState("");

  const [restricted, setRestricted] = useState(true);



  // IPv4 address or CIDR range — any text used to be accepted and enforced for sign-in.

  const ipValid =

    /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([0-9]|[12]\d|3[0-2]))?$/.test(

      address.trim(),

    );

  const ipDup = rows.some((r) => r.address === address.trim());

  function submit() {

    if (!ipValid || ipDup) return;

    setRows((p) => [

      {

        id: `IP-${String(p.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`,

        name: name.trim(),

        address: address.trim(),

        restricted,

      },

      ...p,

    ]);

    setOpen(false);

    setName("");

    setAddress("");

    setRestricted(true);

    toast.success("IP rule added");

  }



  return (

    <Card className="shadow-card">

      <CardContent className="p-6">

        <SectionHead

          icon={ShieldCheck}

          title="IP Restrictions"

          desc="Restrict sign-in and attendance punching to approved networks"

        >

          <Dialog open={open} onOpenChange={setOpen}>

            <DialogTrigger asChild>

              <Button size="sm" className="bg-gradient-emerald text-white">

                <Plus className="h-4 w-4" /> Add IP

              </Button>

            </DialogTrigger>

            <DialogContent className="sm:max-w-md">

              <DialogHeader>

                <DialogTitle>Add IP Address</DialogTitle>

                <DialogDescription>

                  Register a network and choose whether access is restricted to it.

                </DialogDescription>

              </DialogHeader>

              <div className="space-y-4 py-2">

                <Field label="IP address name" required>

                  <Input

                    value={name}

                    onChange={(e) => setName(e.target.value)}

                    placeholder="e.g. Bhubaneswar HQ Wi-Fi"

                  />

                </Field>

                <Field label="IP address / range" required>

                  <Input

                    value={address}

                    onChange={(e) => setAddress(e.target.value)}

                    placeholder="103.21.244.10"

                  />

                </Field>

                <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2.5">

                  <div>

                    <div className="text-sm font-medium">Restrict</div>

                    <div className="text-muted-foreground text-xs">

                      Enforce this rule for sign-in

                    </div>

                  </div>

                  <Switch checked={restricted} onCheckedChange={setRestricted} />

                </div>

              </div>

              <DialogFooter>

                <Button variant="outline" onClick={() => setOpen(false)}>

                  Cancel

                </Button>

                {address.trim() && (!ipValid || ipDup) && (

                  <span className="text-destructive mr-auto text-xs">

                    {ipDup

                      ? "This address is already registered."

                      : "Enter an IPv4 address or CIDR range, e.g. 103.21.244.10 or 10.8.0.0/24."}

                  </span>

                )}

                <Button

                  disabled={!name.trim() || !address.trim() || !ipValid || ipDup}

                  className="bg-gradient-emerald text-white"

                  onClick={submit}

                >

                  Save

                </Button>

              </DialogFooter>

            </DialogContent>

          </Dialog>

        </SectionHead>



        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">

              <tr>

                <th className="p-3 text-left">Name</th>

                <th className="p-3 text-left">IP address</th>

                <th className="p-3 text-left">Restrict</th>

              </tr>

            </thead>

            <tbody className="divide-border divide-y">

              {rows.map((r) => (

                <tr key={r.id} className="hover:bg-muted/30">

                  <td className="p-3 font-medium">{r.name}</td>

                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.address}</td>

                  <td className="p-3">

                    <Switch

                      checked={r.restricted}

                      onCheckedChange={(v) =>

                        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, restricted: v } : x)))

                      }

                    />

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



/**

 * @typedef {Object} Item

 * @property {string} key

 * @property {string} label

 * @property {any} icon

 * @property {boolean} [superOnly]

 * @property {string} [hint]

 * @property {ActionKey} [perm]

 */

const GROUPS = [

  {

    group: "Organisation",

    items: [

      {

        key: "infrastructure",

        label: "Infrastructure — branches, buildings, departments, designations",

        icon: Building,

      },

      { key: "entities", label: "Group, entities & branches", icon: GitBranch, superOnly: true },

      { key: "branding", label: "Colours & branding, security, notifications", icon: Palette },

      { key: "paygrade", label: "Pay grades & bands", icon: Layers, perm: "payroll.manage" },

    ],

  },

  {

    group: "Documents",

    items: [

      {

        key: "docmaster",

        label: "Doc Master — templates, styles, letters, forms",

        icon: FileSignature,

      },

      { key: "handbook", label: "Employee Handbook — publish & acknowledgements", icon: BookText },

      { key: "documents", label: "Onboarding document master", icon: FileText },

      { key: "policies", label: "Policies & circulars", icon: BookOpen },

      { key: "awards", label: "Award master", icon: Trophy },

    ],

  },

  {

    group: "Recruitment",

    items: [

      {

        key: "recmasters",

        label: "Job types, sources, interview types, checklists",

        icon: Briefcase,

        perm: "recruitment.manage",

      },

      {

        key: "rounds",

        label: "Interview rounds & stages",

        icon: ListChecks,

        perm: "recruitment.manage",

      },

      { key: "locations", label: "Job locations", icon: MapPinned, perm: "recruitment.manage" },

      {

        key: "assessparams",

        label: "Assessment & evaluation parameters",

        icon: ClipboardList,

        perm: "recruitment.manage",

      },

    ],

  },

  {

    group: "Attendance & time",

    items: [

      { key: "shifts", label: "Shift management", icon: Clock },

      { key: "workday", label: "Workday configuration", icon: CalendarDays },

      { key: "patterns", label: "Attendance patterns & overrides", icon: CalendarCheck },

      { key: "rules", label: "Penalty & overtime rules", icon: AlertTriangle },

      { key: "timesheet", label: "Timesheet formats", icon: Clock },

      { key: "holidays", label: "Holiday calendars (3 types)", icon: CalendarDays },

    ],

  },

  {

    group: "Leave",

    items: [{ key: "leavemaster", label: "Leave master & leave policy", icon: CalendarDays }],

  },

  {

    group: "Payroll & statutory",

    items: [

      {

        key: "salaryconfig",

        label: "Salary configuration & payroll policy",

        icon: Wallet,

        perm: "payroll.manage",

      },

      { key: "payroll", label: "Pay components", icon: Coins, perm: "payroll.manage" },

      {

        key: "statutory",

        label: "Statutory configuration — PF methods, ESI, TDS",

        icon: ShieldCheck,

        perm: "statutory.configure",

      },

      {

        key: "states",

        label: "State policies — PT, LWF, minimum wage",

        icon: MapPinned,

        perm: "statutory.configure",

      },

      { key: "insurance", label: "Insurance & benefit plans", icon: ShieldPlus },

      { key: "loanpolicy", label: "Loan & advance policy", icon: Wallet, perm: "finance.manage" },

      { key: "reimcat", label: "Reimbursement categories", icon: Receipt },

    ],

  },

  {

    group: "Performance",

    items: [

      {

        key: "perfmasters",

        label: "Indicators, categories, goal types, review cycles",

        icon: Layers,

      },

    ],

  },

  {

    group: "Assets",

    items: [

      { key: "assetmaster", label: "Asset master — types, checklists, accessories", icon: Boxes },

    ],

  },

  {

    group: "Exit, cases & grievance",

    items: [

      { key: "fnf", label: "Exit, gratuity & F&F configuration", icon: UserX },

      { key: "grievance", label: "Grievance routing & SLA", icon: MessageSquareWarning },

      { key: "termination", label: "Termination types", icon: UserX },

      { key: "warning", label: "Warning types", icon: AlertTriangle },

      { key: "complaint", label: "Complaint types", icon: MessageSquareWarning },

    ],

  },

  {

    group: "Helpdesk & workflows",

    items: [

      { key: "helpdesk", label: "Helpdesk desks, categories, SLA", icon: LifeBuoy },

      { key: "approvals", label: "Approval engine (workflows per module)", icon: GitBranch },

      { key: "hrpolicy", label: "HR policy & notification rules", icon: BellRing },

    ],

  },

  {

    group: "Access & security",

    items: [

      { key: "roles", label: "Roles & permissions", icon: ShieldCheck, perm: "role.manage" },

      { key: "ip", label: "IP restrictions", icon: ShieldCheck },

      { key: "geofence", label: "Geofencing", icon: MapPinned },

    ],

  },

];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

const readHash = () => (typeof window !== "undefined" ? window.location.hash.replace("#", "") : "");



function Masters() {

  const me = useCurrentUser();

  const [tab, setTab] = useState("infrastructure");

  const [q, setQ] = useState("");

  // Hash (#docmaster, #handbook …) is applied after hydration so server and client markup match.

  useEffect(() => {

    const on = () => {

      const h = readHash();

      if (ALL_ITEMS.some((i) => i.key === h)) setTab(h);

    };

    on();

    window.addEventListener("hashchange", on);

    return () => window.removeEventListener("hashchange", on);

  }, []);

  const go = (k) => {

    setTab(k);

    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${k}`);

  };

  // Sections are filtered by the action they configure: a COO could open Roles & permissions, payroll and statutory

  // configuration here although ROLE_ACTIONS grants none of those (and HR could edit roles without role.manage).

  const allowed = (i) =>

    (!i.superOnly || me.role === "SuperAdmin") && (!i.perm || can(me.role, i.perm));

  const visible = GROUPS.map((g) => ({

    ...g,

    items: g.items.filter(

      (i) => allowed(i) && (!q || `${g.group} ${i.label}`.toLowerCase().includes(q.toLowerCase())),

    ),

  })).filter((g) => g.items.length);

  const activeItem = ALL_ITEMS.find((i) => i.key === tab);

  // A deep link (#roles) to a section the role may not open falls back to the first allowed one.

  const firstAllowed = visible[0]?.items[0]?.key ?? "infrastructure";

  if (activeItem && !allowed(activeItem) && tab !== firstAllowed) setTab(firstAllowed);

  const active = activeItem;

  const group = GROUPS.find((g) => g.items.some((i) => i.key === tab));



  return (

    <div className="space-y-6">

      <div className="flex flex-wrap items-end justify-between gap-3">

        <div>

          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">

            <Building className="text-primary h-6 w-6" /> Master Data

          </h1>

          <p className="text-muted-foreground mt-1 text-sm">

            Every master and configuration in the product, in one place — set these up first; every

            module reads from here.{" "}

            {me.role === "SuperAdmin"

              ? "Entity-specific masters apply to the company selected in the top bar."

              : "Masters apply to your company."}

          </p>

        </div>

        <div className="border-border bg-muted/40 flex min-w-[240px] items-center gap-2 rounded-lg border px-3 py-2">

          <Search className="text-muted-foreground h-4 w-4" />

          <Input

            value={q}

            onChange={(e) => setQ(e.target.value)}

            placeholder="Find a master…"

            className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"

          />

        </div>

      </div>



      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[290px_1fr]">

        <Card className="shadow-card lg:sticky lg:top-4">

          <CardContent className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto p-3">

            {visible.map((g) => (

              <div key={g.group} className="space-y-1">

                <div className="text-muted-foreground px-3 text-[11px] font-semibold tracking-wider uppercase">

                  {g.group}

                </div>

                {g.items.map((i) => (

                  <button

                    key={i.key}

                    onClick={() => go(i.key)}

                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${i.key === tab ? "bg-gradient-emerald text-white shadow-sm" : "hover:bg-muted"}`}

                  >

                    <i.icon className="h-4 w-4 shrink-0" />

                    <span className="truncate">{i.label}</span>

                  </button>

                ))}

              </div>

            ))}

          </CardContent>

        </Card>



        <div className="min-w-0 space-y-4">

          <div className="text-muted-foreground text-xs">

            Master Data › {group?.group} ›{" "}

            <span className="text-foreground font-medium">{active?.label}</span>

          </div>



          {tab === "infrastructure" && <Infrastructure />}

          {tab === "entities" && <GroupsWorkspace />}

          {tab === "branding" && <OrgSettings />}

          {tab === "paygrade" && (

            <CrudSection

              icon={Layers}

              title="Pay Grade Definitions"

              desc="Grades and CTC bands — each grade maps to a salary structure in Salary configuration"

              addLabel="Add Pay Grade"

              idPrefix="PG"

              seed={PAY_GRADE_ROWS}
            
api={{
  list: getPayGrades,
  getById: getPayGradeById, // GET /pay-grades/{id}
  create: createPayGrade,
  update: updatePayGrade, // PUT /pay-grades/{id}
  patch: patchPayGrade, // PATCH /pay-grades/{id}
  remove: deletePayGrade,

  toPayload: (form) => ({
    grade_code: String(form.name ?? "").trim(),
    band: form.band,
    minimum_ctc: Number(form.minCtc),
    maximum_ctc: Number(form.maxCtc),
    currency: form.currency || "INR",
    status: form.status || "Active",
    description: form.description || "",
  }),

  // PATCH sends only the fields that changed.
  toPatchPayload: (form, originalRow) => {
    const payload = {};

    if (form.name !== originalRow.name) {
      payload.grade_code = String(form.name ?? "").trim();
    }

    if (form.band !== originalRow.band) {
      payload.band = form.band;
    }

    if (String(form.minCtc ?? "") !== String(originalRow.minCtc ?? "")) {
      payload.minimum_ctc = Number(form.minCtc);
    }

    if (String(form.maxCtc ?? "") !== String(originalRow.maxCtc ?? "")) {
      payload.maximum_ctc = Number(form.maxCtc);
    }

    if (form.currency !== originalRow.currency) {
      payload.currency = form.currency;
    }

    if (form.status !== originalRow.status) {
      payload.status = form.status;
    }

    if (form.description !== originalRow.description) {
      payload.description = form.description ?? "";
    }

    return payload;
  },

  fromApi: (record) => ({
    id: String(record.id),
    _apiId: record.id,
    name: record.grade_code ?? "",
    band: record.band ?? "",
    minCtc: String(record.minimum_ctc ?? ""),
    maxCtc: String(record.maximum_ctc ?? ""),
    currency: record.currency ?? "INR",
    status: record.status ?? "Active",
    description: record.description ?? "",
  }),
}}


              fields={[

                { key: "name", label: "Grade code", required: true, placeholder: "e.g. G4" },

                {

                  key: "band",

                  label: "Band",

                  type: "select",

                  options: PAY_BANDS,

                  required: true,

                  badge: true,

                },

                { key: "minCtc", label: "Minimum CTC", type: "number", required: true },

                { key: "maxCtc", label: "Maximum CTC", type: "number", required: true },

                {

                  key: "currency",

                  label: "Currency",

                  type: "select",

                  options: ["INR", "USD", "AED", "GBP"],

                },

                {

                  key: "status",

                  label: "Status",

                  type: "select",

                  options: ["Active", "Inactive"],

                  badge: true,

                },

                { key: "description", label: "Description", type: "textarea", full: true },

              ]}

            />

          )}



          {tab === "docmaster" && <DocMasterTab />}

          {tab === "handbook" && <HandbookTab />}

          {tab === "documents" && (

            <MasterTable

              icon={FileText}

              title="Onboarding Document Master"

              desc="Documents collected from candidates and new hires"

              prefix="DOC"

              seed={DOCUMENT_MASTER}

              withRequired

              addLabel="Add Document"

            />

          )}

          {tab === "policies" && (

            <CrudSection

              icon={BookText}

              title="Policies & Circulars"

              desc="Upload and maintain organisation policies and circulars (the Employee Handbook has its own section)"

              addLabel="Upload Document"

              idPrefix="PLC"

              seed={POLICY_DOCS}

              fields={[

                { key: "name", label: "Document name", required: true },

                {

                  key: "category",

                  label: "Category",

                  type: "select",

                  options: POLICY_CATEGORIES,

                  required: true,

                  badge: true,

                },

                { key: "updated", label: "Effective date", type: "date" },

                { key: "file", label: "Document", type: "file" },

                { key: "description", label: "Description", type: "textarea" },

              ]}

            />

          )}

          {tab === "awards" && (

            <MasterTable

              icon={Trophy}

              title="Award Master"

              desc="Recognition programmes available to managers"

              prefix="AWD"

              seed={AWARD_MASTER}

              addLabel="Add Award"

            />

          )}



          {tab === "recmasters" && <RecruitmentMasters />}

          {tab === "rounds" && <RoundsWorkspace />}

          {tab === "locations" && <LocationsWorkspace />}

          {tab === "assessparams" && <AssessmentParamsTab />}



          {tab === "shifts" && <ShiftsTab />}

          {tab === "workday" && <WorkdayConfigTab />}

          {tab === "patterns" && <PatternsTab />}

          {tab === "rules" && <PenaltyConfigTab />}

          {tab === "timesheet" && <TimesheetFormatsTab />}

          {tab === "holidays" && <LeaveMasterTab section="holidays" />}



          {tab === "leavemaster" && <LeaveMasterTab section="leave" />}



          {tab === "salaryconfig" && <SalaryConfigTab />}

          {tab === "payroll" && <PayrollConfigTab />}

          {tab === "statutory" && <StatutoryConfigTab />}

          {tab === "states" && <StatePolicyTab />}

          {tab === "insurance" && (

            <div className="space-y-4">

              <InsurancePlansTab />

              <NamedMasterTab

                icon={ShieldPlus}

                title="Insurance Types"

                desc="Policy types that can be assigned to employees"

                addLabel="Add Insurance Type"

                prefix="INT"

                store={insuranceTypeStore}

              />

              <NamedMasterTab

                icon={Boxes}

                title="Insurance Categories"

                desc="Coverage categories used when assigning policies"

                addLabel="Add Category"

                prefix="INC"

                store={insuranceCategoryStore}

              />

            </div>

          )}

          {tab === "loanpolicy" && <LoanPolicyCard />}

          {tab === "reimcat" && (

            <NamedMasterTab

              icon={Receipt}

              title="Reimbursement Categories"

              desc="Categories employees pick when raising a claim"

              addLabel="Add Category"

              prefix="RMC"

              store={reimbursementCategoryStore}

            />

          )}



          {tab === "perfmasters" && <PerformanceMastersTab />}

          {tab === "assetmaster" && <AssetMasterTab />}



          {tab === "fnf" && <FnfConfigPanel />}

          {tab === "grievance" && <GrievanceRoutingCard />}

          {tab === "termination" && (

            <MasterTable

              icon={UserX}

              title="Termination Types"

              desc="Categories used in the employee termination form"

              prefix="TTY"

              seed={TERMINATION_TYPE_MASTER}

              addLabel="Add Termination Type"

            />

          )}

          {tab === "warning" && (

            <MasterTable

              icon={AlertTriangle}

              title="Warning Types"

              desc="Categories used when issuing warnings"

              prefix="WTY"

              seed={WARNING_TYPE_MASTER}

              addLabel="Add Warning Type"

            />

          )}

          {tab === "complaint" && (

            <MasterTable

              icon={MessageSquareWarning}

              title="Complaint Types"

              desc="Categories used when logging complaints"

              prefix="CTY"

              seed={COMPLAINT_TYPE_MASTER}

              addLabel="Add Complaint Type"

            />

          )}



          {tab === "helpdesk" && <DeskSettings />}

          {tab === "approvals" && <ApprovalsWorkspace />}

          {tab === "hrpolicy" && <NotificationCentre />}



          {tab === "roles" && <RolesHub />}

          {tab === "ip" && <IpRestrictTab />}

          {tab === "geofence" && <GeofencingTab />}

        </div>

      </div>

    </div>

  );

}



export default Masters;