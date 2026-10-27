// import { useState } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { companiesOf, useCurrentTenant } from "@/features/organization/data/tenancy";
// import { useOrgs } from "@/features/organization/data/group-data";
import { useOrgs, useActiveOrgId } from "@/features/organization/data/group-data";
import { captureFiles } from "@/lib/attachments";
import Link from "@/lib/router";
import {
  FileSignature,
  Plus,
  Save,
  Copy,
  Eye,
  Wallet,
  ClipboardList,
  CalendarDays,
  ShieldPlus,
  Settings2,
  ExternalLink,
  Sparkles,
  Upload,
  Trash2,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/store";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  DOC_TOKENS,
  DOC_TYPES,
  cloneTemplate,
  removeTemplate,
  renderTemplate,
  saveStyle,
  saveTemplate,
  useDesignStyles,
  useDocTemplates,
  aiDraftTemplate,
  parseUploadedTemplate,
} from "@/features/organization/data/doc-master";
import {
  WAGE_TYPES,
  computeSalaryBreakup,
  saveStructure,
  useSalaryStructures,
  usePayrollPolicy,
  savePayrollPolicy,
  processingDateFor,
} from "@/features/payroll/data/salary-engine";
// import {
//   removeAssessmentParam,
//   saveAssessmentParam,
//   useAssessmentParams,
// } from "@/features/recruitment/data/onboarding-data";
import {
  createAssessmentParamApi,
  apiErrorMessage,
} from "@/features/recruitment/data/recruitmentMasterAdapters";
import { saveEvalParam, useEvalParams } from "@/features/performance/data/performance-config";
import {
  useLeaveMaster,
  saveLeaveMasterRow,
  useHolidayCalendars,
  saveHolidayCalendar,
  useInsurancePlans,
  saveInsurancePlan,
  useLeavePolicy,
  saveLeavePolicy,
} from "@/features/organization/data/hr-masters";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

/* ------------------------------ Doc Master ------------------------------ */
export function DocMasterTab() {
  const me = useCurrentUser();
  const tenant = useCurrentTenant();
  const orgs = useOrgs();
  const companies = tenant ? companiesOf(tenant, orgs) : [];
  const templates = useDocTemplates();
  const styles = useDesignStyles();
  const [type, setType] = useState("all");
  const [edit, setEdit] = useState(null);
  const [styleEdit, setStyleEdit] = useState(null);
  const rows = templates.filter((t) => type === "all" || t.docType === type);
  const preview = (t) => {
    const ok = renderTemplate(t, {
      candidate: "Meera Raghavan",
      employee: "Subham Das",
      employeeId: "SRN-0006",
      position: "Senior Software Engineer",
      department: "Engineering",
      grade: "G4",
      branch: "Bhubaneswar HQ",
      entity: "Seereon Consulting & IT Services Pvt. Ltd.",
      ctc: "18,00,000",
      monthlyGross: "1,26,000",
      basic: "60,000",
      hra: "24,000",
      joiningDate: "2026-10-01",
      expiryDate: "2026-09-25",
      date: new Date().toISOString().slice(0, 10),
      reportingManager: "Subh Sahoo",
      lastWorkingDay: "2026-11-30",
      noticeDays: "60",
      amount: "1,50,000",
      emi: "12,500",
      tenure: "12",
      gratuity: "1,03,846",
      signatory: t.signatory,
      signatoryDesignation: t.signatoryDesignation,
    });
    toast[ok ? "success" : "error"](ok ? "Preview opened — save as PDF" : "Allow pop-ups");
  };
  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <FileSignature className="text-primary h-4 w-4" /> Document Master
              </div>
              <div className="text-muted-foreground text-xs">
                Multiple templates per document type, each on a design style (header, footer,
                watermark, font). Used by offers, appointments, F&F, forms, handbook and every
                letter.
              </div>
            </div>
            <div className="ml-auto flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
              <Select value={type} onValueChange={(v) => setType(v)}>
                <SelectTrigger className="h-8 w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All document types</SelectItem>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() =>
                  setEdit({
                    id: `TPL-${Date.now().toString(36).toUpperCase()}`,
                    docType: type === "all" ? "Offer Letter" : type,
                    name: "",
                    styleId: styles[0].id,
                    entity: "All entities",
                    subject: "",
                    body: "",
                    signatory: "",
                    signatoryDesignation: "",
                    version: 1,
                    active: true,
                    updatedOn: "",
                    updatedBy: "",
                  })
                }
              >
                <Plus className="h-4 w-4" /> New template
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  {[
                    "Document type",
                    "Template",
                    "Style",
                    "Entity",
                    "Version",
                    "Fields",
                    "Status",
                    "",
                  ].map((h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{t.docType}</td>
                    <td className="p-3">
                      {t.name}
                      <div className="text-muted-foreground font-mono text-xs">{t.id}</div>
                    </td>
                    <td className="p-3 text-xs">{styles.find((s) => s.id === t.styleId)?.name}</td>
                    <td className="p-3 text-xs">{t.entity}</td>
                    <td className="p-3">
                      v{t.version}
                      <div className="text-muted-foreground text-[11px]">
                        <span className="whitespace-nowrap">{t.updatedOn}</span> · {t.updatedBy}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {t.fields
                        ? `${t.fields.length} form fields`
                        : t.sections
                          ? `${t.sections.length} sections`
                          : "letter"}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={t.active ? "border-primary/30 bg-primary/10 text-primary" : ""}
                      >
                        {t.active ? "Active" : "Draft"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => preview(t)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setEdit(t)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => {
                            cloneTemplate(t.id, me.name);
                            toast.success("Template copied as draft");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-7"
                          aria-label={`Delete template ${t.name}`}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete template "${t.name}"? It moves to the System Archive.`,
                              )
                            )
                              return;
                            removeTemplate(t.id);
                            toast.success(`${t.name} moved to the archive`);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Design styles (header · footer · watermark)</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setStyleEdit({
                  id: `STY-${Date.now().toString(36).toUpperCase()}`,
                  name: "",
                  headerStyle: "Logo left",
                  footerStyle: "Address + CIN",
                  watermark: "",
                  font: "Calibri",
                  accent: "#0f766e",
                  fontSize: 11,
                  marginMm: 20,
                  showSignatureBlock: true,
                })
              }
            >
              <Plus className="h-4 w-4" /> Style
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {styles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyleEdit(s)}
                className="border-border hover:bg-muted/30 rounded-xl border p-3 text-left"
              >
                <div className="h-6 rounded-t" style={{ background: s.accent }} />
                <div className="mt-2 text-sm font-semibold">{s.name}</div>
                <div className="text-muted-foreground text-xs">
                  {s.headerStyle} · {s.footerStyle}
                  {s.watermark ? ` · ${s.watermark}` : ""} · {s.font} {s.fontSize}pt
                </div>
                <div className="text-muted-foreground text-[11px]">
                  used by {templates.filter((t) => t.styleId === s.id).length} template(s)
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{edit?.name || "New template"}</DialogTitle>
            <DialogDescription>
              Tokens: {DOC_TOKENS.map((t) => `{{${t}}}`).join(" ")}
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Document type</Label>
                <Select
                  value={edit.docType}
                  onValueChange={(v) => setEdit({ ...edit, docType: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Template name</Label>
                <Input
                  className="h-8"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Design style</Label>
                <Select
                  value={edit.styleId}
                  onValueChange={(v) => setEdit({ ...edit, styleId: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Company (template applies to)</Label>
                <Select value={edit.entity} onValueChange={(v) => setEdit({ ...edit, entity: v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All entities">All companies (shared)</SelectItem>
                    {companies.map((o) => (
                      <SelectItem key={o.id} value={o.legalName || o.name}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-muted-foreground text-[10px]">
                  Letters pick the company&apos;s own template first, then the shared one.
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Subject / title</Label>
                <Input
                  className="h-8"
                  value={edit.subject}
                  onChange={(e) => setEdit({ ...edit, subject: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs">Body</Label>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        const d = aiDraftTemplate(edit.docType);
                        setEdit({ ...edit, subject: edit.subject || d.subject, body: d.body });
                        toast.success(
                          "Draft generated — review the tokens and wording before saving",
                        );
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Generate with AI
                    </Button>
                    <label className="border-input hover:bg-muted inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-xs font-medium">
                      <Upload className="h-3.5 w-3.5" /> Import PDF / letter
                      <input
                        type="file"
                        accept=".pdf,.txt,.html,.htm"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const r = parseUploadedTemplate(String(reader.result ?? ""), file.name);
                            setEdit({
                              ...edit,
                              subject: edit.subject || r.subject,
                              body: r.body,
                              name: edit.name || file.name.replace(/\.[^.]+$/, ""),
                            });
                            toast[r.ok ? "success" : "info"](
                              r.ok
                                ? `${file.name} parsed — dates and amounts replaced with tokens`
                                : `${file.name} has no readable text layer — a stub was inserted`,
                            );
                          };
                          reader.readAsText(file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <Textarea
                  rows={8}
                  value={edit.body}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                />
              </div>
              {edit.sections && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs">Sections</Label>
                  {edit.sections.map((s, i) => (
                    <div key={i} className="border-border grid gap-1 rounded-lg border p-2">
                      <Input
                        className="h-8 font-semibold"
                        value={s.heading}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            sections: edit.sections.map((x, j) =>
                              j === i ? { ...x, heading: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <Textarea
                        rows={3}
                        value={s.body}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            sections: edit.sections.map((x, j) =>
                              j === i ? { ...x, body: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEdit({
                        ...edit,
                        sections: [...edit.sections, { heading: "New section", body: "" }],
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Section
                  </Button>
                </div>
              )}
              {edit.fields && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Form fields</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {edit.fields.map((f) => (
                      <Badge key={f.key} variant="outline">
                        {f.label} · {f.type}
                        {f.required ? " *" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Signatory</Label>
                <Input
                  className="h-8"
                  value={edit.signatory}
                  onChange={(e) => setEdit({ ...edit, signatory: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Designation</Label>
                <Input
                  className="h-8"
                  value={edit.signatoryDesignation}
                  onChange={(e) => setEdit({ ...edit, signatoryDesignation: e.target.value })}
                />
              </div>
              <div className="border-border flex items-center justify-between rounded-lg border p-2 text-sm sm:col-span-2">
                <span>Active (available to modules)</span>
                <Switch
                  checked={edit.active}
                  onCheckedChange={(v) => setEdit({ ...edit, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => edit && preview(edit)}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!edit?.name.trim() || !edit?.subject.trim()}
              onClick={() => {
                saveTemplate(edit, me.name);
                setEdit(null);
                toast.success("Template saved (new version)");
              }}
            >
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!styleEdit} onOpenChange={(o) => !o && setStyleEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Design style</DialogTitle>
            <DialogDescription>Applied to every template that uses it.</DialogDescription>
          </DialogHeader>
          {styleEdit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input
                  className="h-8"
                  value={styleEdit.name}
                  onChange={(e) => setStyleEdit({ ...styleEdit, name: e.target.value })}
                />
              </div>
              {[
                ["headerStyle", ["Logo left", "Logo centre", "Letterhead band", "Minimal"]],
                [
                  "footerStyle",
                  ["Address + CIN", "Page number only", "Confidentiality note", "None"],
                ],
                ["watermark", ["", "CONFIDENTIAL", "DRAFT", "SEEREON", "ORIGINAL"]],
                ["font", ["Calibri", "Inter", "Georgia", "Times New Roman"]],
              ].map(([k, opts]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs capitalize">{k.replace("Style", " style")}</Label>
                  <Select
                    value={String(styleEdit[k]) || "none"}
                    onValueChange={(v) =>
                      setStyleEdit({ ...styleEdit, [k]: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opts.map((o) => (
                        <SelectItem key={o || "none"} value={o || "none"}>
                          {o || "None"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Accent colour</Label>
                <Input
                  className="h-8"
                  type="color"
                  value={styleEdit.accent}
                  onChange={(e) => setStyleEdit({ ...styleEdit, accent: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font size (pt)</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={styleEdit.fontSize}
                  onChange={(e) => setStyleEdit({ ...styleEdit, fontSize: Number(e.target.value) })}
                />
              </div>
              <div className="border-border flex items-center justify-between rounded-lg border p-2 text-sm sm:col-span-2">
                <span>Signature block</span>
                <Switch
                  checked={styleEdit.showSignatureBlock}
                  onCheckedChange={(v) => setStyleEdit({ ...styleEdit, showSignatureBlock: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!styleEdit?.name.trim()}
              onClick={() => {
                saveStyle(styleEdit);
                setStyleEdit(null);
                toast.success("Style saved");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------- Salary configuration --------------------------- */
export function SalaryConfigTab() {
  const me = useCurrentUser();
  const structures = useSalaryStructures();
  const [grade, setGrade] = useState(structures[0]?.grade ?? "G3");
  const [ctc, setCtc] = useState("1800000");
  const s = structures.find((x) => x.grade === grade) ?? structures[0];
  const [draft, setDraft] = useState(null);
  // Grade the draft was opened from (null = new) — saving under another existing grade silently overwrote that structure.
  const [draftFrom, setDraftFrom] = useState(null);
  const gradeClash =
    !!draft &&
    draft.grade.trim() !== draftFrom &&
    structures.some((x) => x.grade === draft.grade.trim());
  const nextGrade = () => {
    let n = structures.length + 1;
    while (structures.some((x) => x.grade === `G${n}`)) n++;
    return `G${n}`;
  };
  const bk = computeSalaryBreakup(Number(ctc) || 0, grade, structures);
  const policy = usePayrollPolicy();
  const [pol, setPol] = useState(policy);
  // The persisted policy arrives after hydration (the server renders the defaults); refresh the draft from it so
  // "Save" does not silently write the defaults back over the saved policy.
  const [seenPolicy, setSeenPolicy] = useState(policy);
  if (seenPolicy !== policy) {
    setSeenPolicy(policy);
    setPol(policy);
  }
  const [compDetail, setCompDetail] = useState(null);
  const setComp = (i, patch) =>
    draft &&
    setDraft({
      ...draft,
      components: draft.components.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });
  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Wallet className="text-primary h-4 w-4" /> Salary Configuration — structures by
                grade
              </div>
              <div className="text-muted-foreground text-xs">
                Inclusions form the monthly gross; exclusions are employer cost inside CTC. Enter a
                CTC to see every component computed.
              </div>
            </div>
            <div className="ml-auto flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="h-8 w-full sm:w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((x) => (
                    <SelectItem key={x.grade} value={x.grade}>
                      {x.grade} — {x.name} ({x.wageType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraftFrom(s.grade);
                  setDraft({ ...s });
                }}
              >
                Edit structure
              </Button>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={() => {
                  setDraftFrom(null);
                  setDraft({
                    grade: nextGrade(),
                    name: "New structure",
                    wageType: "Salaried",
                    components: [...s.components],
                    workingDays: 26,
                    notes: "",
                    active: true,
                  });
                }}
              >
                <Plus className="h-4 w-4" /> New
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "Section",
                      "Component",
                      "Basis",
                      "Value",
                      "Cap",
                      "Taxable",
                      "Payslip",
                      "Monthly @ CTC",
                    ].map((h) => (
                      <th key={h} className="p-2 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {s.components.map((c) => {
                    const v =
                      [...bk.earnings, ...bk.exclusions].find((x) => x.code === c.code)?.monthly ??
                      0;
                    return (
                      <tr
                        key={c.code}
                        className={cn(
                          clickableRow,
                          c.section === "Exclusion" && "text-muted-foreground",
                        )}
                        onClick={() => setCompDetail(c)}
                      >
                        <td className="p-2">
                          <Badge
                            variant="outline"
                            className={
                              c.section === "Inclusion"
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : ""
                            }
                          >
                            {c.section}
                          </Badge>
                        </td>
                        <td className="text-foreground p-2 font-medium">
                          {c.label}
                          <div className="text-muted-foreground font-mono text-[10px]">
                            {c.code}
                            {c.statutory ? ` · ${c.statutory}` : ""}
                          </div>
                        </td>
                        <td className="p-2">{c.basis}</td>
                        <td className="p-2">
                          {c.basis === "Fixed monthly"
                            ? inr(c.value)
                            : c.basis === "Balancing"
                              ? "residual"
                              : `${c.value} %`}
                        </td>
                        <td className="p-2">{c.cap ? inr(c.cap) : "—"}</td>
                        <td className="p-2">{c.taxable ? "Yes" : "No"}</td>
                        <td className="p-2">{c.showOnPayslip ? "Yes" : "No"}</td>
                        <td className="text-foreground p-2 text-right tabular-nums">{inr(v)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="text-xs font-semibold">
                  <tr>
                    <td className="p-2" colSpan={7}>
                      Monthly gross (inclusions)
                    </td>
                    <td className="p-2 text-right">{inr(bk.monthlyGross)}</td>
                  </tr>
                  <tr>
                    <td className="p-2" colSpan={7}>
                      Employer cost (gross + exclusions) = CTC ÷ 12
                    </td>
                    <td className="p-2 text-right">{inr(bk.employerCostMonthly)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="space-y-3">
              <div className="border-primary/20 bg-primary/5 rounded-xl border p-4">
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <Calculator className="h-3.5 w-3.5" /> Salary calculator
                </div>
                <Label className="text-muted-foreground mt-2 block text-xs">Annual CTC (₹)</Label>
                <Input
                  type="number"
                  value={ctc}
                  onChange={(e) => setCtc(e.target.value)}
                  className="mt-1 h-8"
                />
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Wage type</span>
                    <b>{bk.wageType}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Basic</span>
                    <b>{inr(bk.basic)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly gross</span>
                    <b>{inr(bk.monthlyGross)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily rate ({bk.workingDays} d)</span>
                    <b>{inr(bk.dailyRate)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Employer PF / month</span>
                    <b>{inr(bk.exclusions.find((e) => e.code === "EPF_ER")?.monthly ?? 0)}</b>
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground text-xs">{s.notes}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="text-primary h-4 w-4" /> Payroll processing policy
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Salary processed on</Label>
              <Select
                value={pol.processingDay}
                onValueChange={(v) => setPol({ ...pol, processingDay: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Last day of month", "Last working day", "Fixed day"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fixed day</Label>
              <Input
                className="h-8"
                type="number"
                disabled={pol.processingDay !== "Fixed day"}
                value={pol.fixedDay}
                onChange={(e) => setPol({ ...pol, fixedDay: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Input cut-off day</Label>
              <Input
                className="h-8"
                type="number"
                value={pol.cutoffDay}
                onChange={(e) => setPol({ ...pol, cutoffDay: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">HR-head evaluation (days before)</Label>
              <Input
                className="h-8"
                type="number"
                value={pol.evaluationLeadDays}
                onChange={(e) => setPol({ ...pol, evaluationLeadDays: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Evaluator</Label>
              <Select
                value={pol.evaluatorRole}
                onValueChange={(v) => setPol({ ...pol, evaluatorRole: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["HR", "CHRO", "CFO"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span>
              This month processes on{" "}
              <b className="text-foreground">
                {processingDateFor(new Date().toISOString().slice(0, 7), pol)}
              </b>
              ; evaluation window opens {pol.evaluationLeadDays} day(s) earlier; attendance inputs
              close on the {pol.cutoffDay}th.
            </span>
            <Button
              size="sm"
              className="bg-gradient-emerald ml-auto text-white"
              onClick={() => {
                savePayrollPolicy(pol, me.name);
                toast.success("Payroll policy saved");
              }}
            >
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Salary structure — {draft?.grade}</DialogTitle>
            <DialogDescription>
              Inclusions must leave room for the balancing component; exclusions are employer-side.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Grade code</Label>
                  <Input
                    className="h-8"
                    value={draft.grade}
                    onChange={(e) => setDraft({ ...draft, grade: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-8"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Wage type</Label>
                  <Select
                    value={draft.wageType}
                    onValueChange={(v) => setDraft({ ...draft, wageType: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WAGE_TYPES.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                {draft.components.map((c, i) => (
                  <div
                    key={i}
                    className="border-border grid grid-cols-1 items-center gap-2 rounded-lg border p-2 text-xs sm:grid-cols-[1fr_1.4fr_1.2fr_0.8fr_0.8fr_auto_auto_auto]"
                  >
                    <Select value={c.section} onValueChange={(v) => setComp(i, { section: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inclusion">Inclusion</SelectItem>
                        <SelectItem value="Exclusion">Exclusion</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8"
                      value={c.label}
                      onChange={(e) => setComp(i, { label: e.target.value })}
                    />
                    <Select value={c.basis} onValueChange={(v) => setComp(i, { basis: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["% of CTC", "% of Basic", "Fixed monthly", "Balancing"].map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8"
                      type="number"
                      value={c.value}
                      disabled={c.basis === "Balancing"}
                      onChange={(e) => setComp(i, { value: Number(e.target.value) })}
                    />
                    <Input
                      className="h-8"
                      type="number"
                      placeholder="cap"
                      value={c.cap ?? ""}
                      onChange={(e) =>
                        setComp(i, { cap: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                    <label className="flex items-center gap-1">
                      <Switch
                        checked={c.taxable}
                        onCheckedChange={(v) => setComp(i, { taxable: v })}
                      />
                      Tax
                    </label>
                    <label className="flex items-center gap-1">
                      <Switch
                        checked={c.showOnPayslip}
                        onCheckedChange={(v) => setComp(i, { showOnPayslip: v })}
                      />
                      Slip
                    </label>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          components: draft.components.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      components: [
                        ...draft.components,
                        {
                          code: `C${draft.components.length + 1}`,
                          label: "New component",
                          section: "Inclusion",
                          basis: "Fixed monthly",
                          value: 0,
                          taxable: true,
                          showOnPayslip: true,
                        },
                      ],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Component
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input
                  className="h-8"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {gradeClash && (
              <span className="text-destructive mr-auto text-xs">
                Grade {draft?.grade} already has a structure — choose another code.
              </span>
            )}
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={
                !draft?.grade.trim() ||
                !draft?.name.trim() ||
                gradeClash ||
                !!draft?.components.some((c) => c.value < 0 || !c.label.trim())
              }
              onClick={() => {
                const d = { ...draft, grade: draft.grade.trim() };
                saveStructure(d);
                setGrade(d.grade);
                setDraft(null);
                toast.success("Structure saved — used by offers, appointments and payroll");
              }}
            >
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {compDetail &&
        (() => {
          const monthly =
            [...bk.earnings, ...bk.exclusions].find((x) => x.code === compDetail.code)?.monthly ??
            0;
          return (
            <RecordDetailDialog
              onClose={() => setCompDetail(null)}
              title={compDetail.label}
              subtitle={`${compDetail.code} · ${s.grade} — ${s.name} (${s.wageType})`}
              badges={
                <Badge
                  variant="outline"
                  className={
                    compDetail.section === "Inclusion"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : ""
                  }
                >
                  {compDetail.section}
                </Badge>
              }
              record={{
                code: compDetail.code,
                label: compDetail.label,
                section: compDetail.section,
                statutory: compDetail.statutory ?? "—",
                basis: compDetail.basis,
                value:
                  compDetail.basis === "Fixed monthly"
                    ? inr(compDetail.value)
                    : compDetail.basis === "Balancing"
                      ? "Residual"
                      : `${compDetail.value} %`,
                cap: compDetail.cap ? inr(compDetail.cap) : "—",
                taxable: compDetail.taxable,
                showOnPayslip: compDetail.showOnPayslip,
                structure: `${s.grade} — ${s.name}`,
                wageType: s.wageType,
                annualCtc: inr(Number(ctc) || 0),
                monthlyAtCtc: inr(monthly),
              }}
              labels={{
                code: "Component code",
                label: "Component",
                statutory: "Statutory mapping",
                showOnPayslip: "Show on payslip",
                monthlyAtCtc: "Monthly @ CTC",
                annualCtc: "Annual CTC (calculator)",
                wageType: "Wage type",
              }}
              sections={[
                { title: "Component", keys: ["code", "label", "section", "statutory"] },
                {
                  title: "Computation",
                  keys: ["basis", "value", "cap", "taxable", "showOnPayslip"],
                },
                {
                  title: "At current CTC",
                  keys: ["structure", "wageType", "annualCtc", "monthlyAtCtc"],
                },
              ]}
            />
          );
        })()}
    </div>
  );
}

/* --------------------- Assessment & evaluation parameters --------------------- */
/* --------------------- Assessment & evaluation parameters --------------------- */
export function AssessmentParamsTab() {
  const orgId = useActiveOrgId();
  const api = useMemo(() => createAssessmentParamApi(orgId), [orgId]);
  const [params, setParams] = useState([]);
  const evals = useEvalParams();
  const [edit, setEdit] = useState(null);
  const [ev, setEv] = useState(null);
  const totalW = params.filter((p) => p.active).reduce((s, p) => s + p.weight, 0);
  // Next free ids — a count-based id reused an existing one after a parameter was removed, so "Save" overwrote it.
  const nextId = (prefix, rows) =>
    `${prefix}-${String(rows.reduce((m, r) => Math.max(m, Number(r.id.replace(`${prefix}-`, "")) || 0), 0) + 1).padStart(2, "0")}`;

  // GET /recruitment/assessment-parameters
  const reload = useCallback(async () => {
    try {
      setParams(await api.list());
    } catch (error) {
      console.error("Failed to load assessment parameters:", error);
      toast.error(apiErrorMessage(error, "Unable to load assessment parameters."));
    }
  }, [api]);

  useEffect(() => {
    reload();
  }, [reload]);

  // POST (new) or PUT (existing — rows loaded from the API carry _apiId)
  const handleSave = async () => {
    try {
      if (edit._apiId) await api.update(edit._apiId, edit);
      else await api.create(edit);
      setEdit(null);
      toast.success("Saved");
      await reload();
    } catch (error) {
      console.error("Failed to save assessment parameter:", error);
      toast.error(apiErrorMessage(error, "Unable to save the parameter."));
    }
  };

  // PATCH /{id}/status
  const handleToggle = async (p, active) => {
    try {
      await api.toggleStatus(p._apiId, active);
      await reload();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(apiErrorMessage(error, "Unable to update the status."));
    }
  };

  // DELETE /{id}
  const handleRemove = async (p) => {
    try {
      await api.remove(p._apiId);
      toast.success("Removed");
      await reload();
    } catch (error) {
      console.error("Failed to remove assessment parameter:", error);
      toast.error(apiErrorMessage(error, "Unable to remove the parameter."));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <ClipboardList className="text-primary h-4 w-4" /> Candidate assessment parameters
              </div>
              <div className="text-muted-foreground text-xs">
                Used in the recruitment scorecard; weights must total 100 % (currently {totalW} %).
              </div>
            </div>
            <Button
              size="sm"
              className="bg-gradient-emerald ml-auto text-white"
              onClick={() =>
                setEdit({
                  id: nextId("AP", params),
                  name: "",
                  group: "Technical",
                  weight: 10,
                  scale: 10,
                  description: "",
                  appliesTo: [],
                  mandatory: false,
                  active: true,
                })
              }
            >
              <Plus className="h-4 w-4" /> Parameter
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {[
                  "Parameter",
                  "Group",
                  "Weight",
                  "Scale",
                  "Applies to",
                  "Mandatory",
                  "Active",
                  "",
                ].map((h) => (
                  <th key={h} className="p-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {params.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="p-2 font-medium">
                    {p.name}
                    <div className="text-muted-foreground text-xs">{p.description}</div>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline">{p.group}</Badge>
                  </td>
                  <td className="p-2">{p.weight} %</td>
                  <td className="p-2">1–{p.scale}</td>
                  <td className="p-2 text-xs">
                    {p.appliesTo.length ? p.appliesTo.join(", ") : "All roles"}
                  </td>
                  <td className="p-2">{p.mandatory ? "Yes" : "—"}</td>
                  <td className="p-2">
                    <Switch checked={p.active} onCheckedChange={(v) => handleToggle(p, v)} />
                  </td>
                  <td className="p-2">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setEdit(p)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-7"
                      onClick={() => handleRemove(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <div>
              <div className="text-sm font-semibold">
                Employee evaluation parameters (appraisal, goals, reviews)
              </div>
              <div className="text-muted-foreground text-xs">
                Rated by the employee (self) and the manager on every quarterly review and the
                annual appraisal.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() =>
                setEv({
                  id: nextId("EP", evals),
                  name: "",
                  weight: 10,
                  description: "",
                  forRoles: "All",
                  active: true,
                })
              }
            >
              <Plus className="h-4 w-4" /> Parameter
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {evals.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEv(e)}
                className={cn(
                  "hover:bg-muted/30 rounded-lg border p-3 text-left",
                  !e.active && "opacity-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{e.name}</span>
                  <Badge variant="outline">{e.weight} %</Badge>
                </div>
                <div className="text-muted-foreground text-xs">
                  {e.description} · {e.forRoles}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assessment parameter</DialogTitle>
            <DialogDescription>Weight is relative to other active parameters.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input
                  className="h-8"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Group</Label>
                <Select value={edit.group} onValueChange={(v) => setEdit({ ...edit, group: v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Technical",
                      "Behavioural",
                      "Aptitude",
                      "Attitude",
                      "Communication",
                      "Leadership",
                      "Domain",
                      "Culture fit",
                    ].map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weight %</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={edit.weight}
                  onChange={(e) => setEdit({ ...edit, weight: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Scale</Label>
                <Select
                  value={String(edit.scale)}
                  onValueChange={(v) => setEdit({ ...edit, scale: Number(v) })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">1–5</SelectItem>
                    <SelectItem value="10">1–10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Applies to (comma-separated job families)</Label>
                <Input
                  className="h-8"
                  value={edit.appliesTo.join(", ")}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      appliesTo: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Description</Label>
                <Input
                  className="h-8"
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={edit.mandatory}
                  onCheckedChange={(v) => setEdit({ ...edit, mandatory: v })}
                />{" "}
                Mandatory in every scorecard
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!edit?.name.trim() || !(edit.weight > 0 && edit.weight <= 100)}
              title="Weight must be between 1 and 100"
              onClick={handleSave}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!ev} onOpenChange={(o) => !o && setEv(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Evaluation parameter</DialogTitle>
            <DialogDescription>
              Shown on self-appraisal, manager review and goals.
            </DialogDescription>
          </DialogHeader>
          {ev && (
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  className="h-8"
                  value={ev.name}
                  onChange={(e) => setEv({ ...ev, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  className="h-8"
                  value={ev.description}
                  onChange={(e) => setEv({ ...ev, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Weight %</Label>
                  <Input
                    className="h-8"
                    type="number"
                    value={ev.weight}
                    onChange={(e) => setEv({ ...ev, weight: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">For roles</Label>
                  <Input
                    className="h-8"
                    value={ev.forRoles}
                    onChange={(e) => setEv({ ...ev, forRoles: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={ev.active} onCheckedChange={(v) => setEv({ ...ev, active: v })} />{" "}
                Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!ev?.name.trim() || !(ev.weight >= 0 && ev.weight <= 100)}
              onClick={() => {
                saveEvalParam(ev);
                setEv(null);
                toast.success("Saved");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------- Leave master & calendars --------------------------- */
function LeavePolicyCard() {
  const me = useCurrentUser();
  const cur = useLeavePolicy();
  const [p, setP] = useState(cur);
  // Saved policy arrives after hydration (server renders the defaults) — refresh the draft so Save keeps it.
  const [seen, setSeen] = useState(cur);
  if (seen !== cur) {
    setSeen(cur);
    setP(cur);
  }
  const b = (k, label) => (
    <label className="border-border flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
      <span>{label}</span>
      <Switch checked={p[k]} onCheckedChange={(v) => setP({ ...p, [k]: v })} />
    </label>
  );
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-5">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Settings2 className="text-primary h-4 w-4" /> Leave policy (clubbing, encashment,
            comp-off validity)
          </div>
          <div className="text-muted-foreground text-xs">
            Q3 — clubbing SL/CL with holidays or EL · item 22 — EL encashed at year end on gross as
            a separate IT-linked component · item 19 — comp-off validity.
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {b("allowClubSLCLWithHoliday", "Allow SL / CL clubbed with holidays & weekly offs")}
          {b("allowClubSLCLWithEL", "Allow SL / CL clubbed with Earned Leave")}
          {b("sandwichRule", "Sandwich rule (holidays between leaves count)")}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">EL encashment month</Label>
            <Select
              value={String(p.elEncashmentMonth)}
              onValueChange={(v) => setP({ ...p, elEncashmentMonth: +v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ].map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max EL days encashable</Label>
            <Input
              type="number"
              value={p.elEncashMaxDays}
              onChange={(e) => setP({ ...p, elEncashMaxDays: +e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Encash on</Label>
            <Select value={p.elEncashBasis} onValueChange={(v) => setP({ ...p, elEncashBasis: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gross">Gross</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Salary component name</Label>
            <Input
              value={p.elEncashComponent}
              onChange={(e) => setP({ ...p, elEncashComponent: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comp-off validity (days)</Label>
            <Input
              type="number"
              value={p.compOffValidityDays}
              onChange={(e) => setP({ ...p, compOffValidityDays: +e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs">
            Updated <span className="whitespace-nowrap">{cur.updatedOn}</span> by {cur.updatedBy}
          </div>
          <Button
            size="sm"
            className="bg-gradient-emerald text-white"
            onClick={() => {
              saveLeavePolicy(p, me.name);
              toast.success(
                "Leave policy saved — applies to new applications and the year-end payroll run",
              );
            }}
          >
            <Save className="h-4 w-4" /> Save policy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Holidays must be named, fall inside the calendar year and not repeat a date (they were saved unchecked). */
function calendarError(c) {
  if (c.holidays.some((h) => !h.name.trim() || !h.date))
    return "Every holiday needs a date and a name.";
  if (c.holidays.some((h) => !h.date.startsWith(`${c.year}-`)))
    return `All dates must fall in ${c.year}.`;
  if (new Set(c.holidays.map((h) => h.date)).size !== c.holidays.length)
    return "The same date is listed twice.";
  return null;
}

export function LeaveMasterTab({ section = "both" }) {
  const rows = useLeaveMaster();
  const cals = useHolidayCalendars();
  const [edit, setEdit] = useState(null);
  const [cal, setCal] = useState(null);
  const showLeave = section !== "holidays";
  const showHol = section !== "leave";
  return (
    <div className="space-y-4">
      {showLeave && <LeavePolicyCard />}
      {showLeave && (
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="text-primary h-4 w-4" /> Leave master
                </div>
                <div className="text-muted-foreground text-xs">
                  Annual entitlement is credited pro-rata each quarter. Comp-off validity, clubbing
                  and encashment rules live here.
                </div>
              </div>
              <Button
                size="sm"
                className="bg-gradient-emerald ml-auto text-white"
                onClick={() =>
                  setEdit({
                    id: `LM-${String(rows.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`,
                    name: "",
                    code: "",
                    annual: 0,
                    creditFrequency: "Quarterly pro-rata",
                    carryForward: false,
                    maxCarry: 0,
                    encashable: false,
                    encashOn: "Gross",
                    clubbable: true,
                    minDays: 0.5,
                    maxConsecutive: 0,
                    needsAttachment: false,
                    attachmentAfterDays: 0,
                    approvalChain: "Manager",
                    validityDays: 0,
                    paid: true,
                    applicableTo: "All",
                    active: true,
                  })
                }
              >
                <Plus className="h-4 w-4" /> Leave type
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "Type",
                      "Annual",
                      "Credit",
                      "Carry fwd",
                      "Encash",
                      "Clubbable",
                      "Max consecutive",
                      "Attachment",
                      "Approval",
                      "Validity",
                      "Paid",
                      "",
                    ].map((h) => (
                      <th key={h} className="p-2 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("hover:bg-muted/30", !r.active && "opacity-50")}>
                      <td className="p-2 font-medium">
                        {r.name} <span className="text-muted-foreground text-xs">{r.code}</span>
                      </td>
                      <td className="p-2">{r.annual}</td>
                      <td className="p-2 text-xs">{r.creditFrequency}</td>
                      <td className="p-2 text-xs">{r.carryForward ? `≤ ${r.maxCarry}` : "No"}</td>
                      <td className="p-2 text-xs">
                        {r.encashable ? `Year-end on ${r.encashOn}` : "No"}
                      </td>
                      <td className="p-2 text-xs">{r.clubbable ? "Yes" : "No"}</td>
                      <td className="p-2">{r.maxConsecutive || "—"}</td>
                      <td className="p-2 text-xs">
                        {r.needsAttachment ? `> ${r.attachmentAfterDays} d` : "—"}
                      </td>
                      <td className="p-2 text-xs">{r.approvalChain}</td>
                      <td className="p-2 text-xs">
                        {r.validityDays ? `${r.validityDays} days` : "—"}
                      </td>
                      <td className="p-2">{r.paid ? "Yes" : "LOP"}</td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setEdit(r)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      {showHol && (
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div>
                <div className="text-sm font-semibold">Holiday calendars (3 types)</div>
                <div className="text-muted-foreground text-xs">
                  National, state/regional and optional/restricted — each uploaded separately and
                  assigned by branch.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() =>
                  setCal({
                    id: `HC-${Date.now().toString(36).toUpperCase()}`,
                    name: "",
                    type: "Regional / State",
                    year: 2026,
                    appliesTo: "",
                    holidays: [],
                    uploadedFile: "",
                    active: true,
                  })
                }
              >
                <Plus className="h-4 w-4" /> Calendar
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {cals.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCal(c)}
                  className="border-border hover:bg-muted/30 rounded-xl border p-4 text-left"
                >
                  <Badge variant="outline" className="mb-2">
                    {c.type}
                  </Badge>
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {c.year} · {c.holidays.length} holidays · {c.appliesTo || "all branches"}
                  </div>
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    {c.uploadedFile ? `Uploaded: ${c.uploadedFile}` : "Not uploaded"}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave type</DialogTitle>
            <DialogDescription>Changes apply from the next credit cycle.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input
                  className="h-8"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input
                  className="h-8"
                  value={edit.code}
                  onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Annual days</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={edit.annual}
                  onChange={(e) => setEdit({ ...edit, annual: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Credit</Label>
                <Select
                  value={edit.creditFrequency}
                  onValueChange={(v) => setEdit({ ...edit, creditFrequency: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Quarterly pro-rata", "Monthly pro-rata", "Annual upfront", "On event"].map(
                      (o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Approval chain</Label>
                <Select
                  value={edit.approvalChain}
                  onValueChange={(v) => setEdit({ ...edit, approvalChain: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Manager", "Manager → HR", "HOD", "HOD → HR", "Manager → HOD → HR"].map(
                      (o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max consecutive (0 = none)</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={edit.maxConsecutive}
                  onChange={(e) => setEdit({ ...edit, maxConsecutive: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Validity days (comp-off)</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={edit.validityDays}
                  onChange={(e) => setEdit({ ...edit, validityDays: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Attachment after (days)</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={edit.attachmentAfterDays}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      attachmentAfterDays: Number(e.target.value),
                      needsAttachment: Number(e.target.value) > 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max carry-forward</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={edit.maxCarry}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      maxCarry: Number(e.target.value),
                      carryForward: Number(e.target.value) > 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Encash on</Label>
                <Select
                  value={edit.encashOn}
                  onValueChange={(v) => setEdit({ ...edit, encashOn: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gross">Gross</SelectItem>
                    <SelectItem value="Basic">Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Applicable to</Label>
                <Input
                  className="h-8"
                  value={edit.applicableTo}
                  onChange={(e) => setEdit({ ...edit, applicableTo: e.target.value })}
                />
              </div>
              {[
                ["encashable", "Encashable at year end"],
                ["clubbable", "Clubbable with holidays / other leave"],
                ["paid", "Paid leave"],
                ["active", "Active"],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(edit[k])}
                    onCheckedChange={(v) => setEdit({ ...edit, [k]: v })}
                  />
                  {l}
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            {edit &&
              rows.some((r) => r.id !== edit.id && r.code && r.code === edit.code.trim()) && (
                <span className="text-destructive mr-auto text-xs">
                  Leave code {edit.code} is already used.
                </span>
              )}
            <Button
              className="bg-gradient-emerald text-white"
              disabled={
                !edit?.name.trim() ||
                !edit?.code.trim() ||
                rows.some((r) => r.id !== edit.id && r.code === edit.code.trim()) ||
                [
                  edit.annual,
                  edit.maxConsecutive,
                  edit.validityDays,
                  edit.attachmentAfterDays,
                  edit.maxCarry,
                ].some((n) => n < 0)
              }
              onClick={() => {
                saveLeaveMasterRow({ ...edit, code: edit.code.trim() });
                setEdit(null);
                toast.success("Leave type saved");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!cal} onOpenChange={(o) => !o && setCal(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Holiday calendar</DialogTitle>
            <DialogDescription>Upload a CSV (date, name) or add holidays inline.</DialogDescription>
          </DialogHeader>
          {cal && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-8"
                    value={cal.name}
                    onChange={(e) => setCal({ ...cal, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={cal.type} onValueChange={(v) => setCal({ ...cal, type: v })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["National", "Regional / State", "Optional / Restricted"].map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Input
                    className="h-8"
                    type="number"
                    value={cal.year}
                    onChange={(e) => setCal({ ...cal, year: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Applies to (branches)</Label>
                  <Input
                    className="h-8"
                    value={cal.appliesTo}
                    onChange={(e) => setCal({ ...cal, appliesTo: e.target.value })}
                    placeholder="Bhubaneswar HQ, Kolkata Office"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Upload CSV</Label>
                  <Input
                    className="h-8"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      captureFiles(e.target.files);
                      const f = e.target.files?.[0];
                      if (!f) return;
                      f.text().then((txt) => {
                        const rows = txt
                          .split(/\r?\n/)
                          .map((l) => l.split(","))
                          .filter((r) => r[0] && /\d{4}-\d{2}-\d{2}/.test(r[0]))
                          .map((r) => ({ date: r[0].trim(), name: (r[1] ?? "Holiday").trim() }));
                        setCal({
                          ...cal,
                          uploadedFile: f.name,
                          holidays: rows.length ? rows : cal.holidays,
                        });
                        toast.success(`${rows.length} holidays parsed`);
                      });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                {cal.holidays.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      className="h-8 w-full sm:w-[150px]"
                      type="date"
                      value={h.date}
                      onChange={(e) =>
                        setCal({
                          ...cal,
                          holidays: cal.holidays.map((x, j) =>
                            j === i ? { ...x, date: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Input
                      className="h-8"
                      value={h.name}
                      onChange={(e) =>
                        setCal({
                          ...cal,
                          holidays: cal.holidays.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCal({ ...cal, holidays: cal.holidays.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="text-muted-foreground h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCal({
                      ...cal,
                      holidays: [...cal.holidays, { date: `${cal.year}-01-01`, name: "" }],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Holiday
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            {cal && calendarError(cal) && (
              <span className="text-destructive mr-auto text-xs">{calendarError(cal)}</span>
            )}
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!cal?.name.trim() || !!(cal && calendarError(cal))}
              onClick={() => {
                saveHolidayCalendar(cal);
                setCal(null);
                toast.success("Calendar saved — visible on Holidays for the assigned branches");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Insurance plans ------------------------------ */
export function InsurancePlansTab() {
  const plans = useInsurancePlans();
  const [edit, setEdit] = useState(null);
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <ShieldPlus className="text-primary h-4 w-4" /> Insurance & benefit plans
            </div>
            <div className="text-muted-foreground text-xs">
              ESI (statutory, gross ≤ threshold) or group mediclaim / term life (employer plan).
              Assigned per employee on the Employment Configuration card; premium flows to payroll.
            </div>
          </div>
          <Button
            size="sm"
            className="bg-gradient-emerald ml-auto text-white"
            onClick={() =>
              setEdit({
                id: `INS-${String(plans.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`,
                name: "",
                kind: "Group mediclaim",
                provider: "",
                sumInsured: 300000,
                employeePremiumMonthly: 0,
                employerPremiumMonthly: 650,
                coverage: "Employee",
                eligibility: "All salaried",
                active: true,
              })
            }
          >
            <Plus className="h-4 w-4" /> Plan
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              {[
                "Plan",
                "Kind",
                "Provider",
                "Sum insured",
                "Employee / month",
                "Employer / month",
                "Coverage",
                "Eligibility",
                "",
              ].map((h) => (
                <th key={h} className="p-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {plans.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2">
                  <Badge variant="outline">{p.kind}</Badge>
                </td>
                <td className="p-2 text-xs">{p.provider}</td>
                <td className="p-2">{p.kind === "ESI" ? "Statutory" : inr(p.sumInsured)}</td>
                <td className="p-2">
                  {p.kind === "ESI" ? "0.75 % of gross" : inr(p.employeePremiumMonthly)}
                </td>
                <td className="p-2">
                  {p.kind === "ESI" ? "3.25 % of gross" : inr(p.employerPremiumMonthly)}
                </td>
                <td className="p-2 text-xs">{p.coverage}</td>
                <td className="p-2 text-xs">{p.eligibility}</td>
                <td className="p-2">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setEdit(p)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Insurance plan</DialogTitle>
              <DialogDescription>Premiums in ₹&nbsp;per month.</DialogDescription>
            </DialogHeader>
            {edit && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-8"
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kind</Label>
                  <Select value={edit.kind} onValueChange={(v) => setEdit({ ...edit, kind: v })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["ESI", "Group mediclaim", "Group term life", "Personal accident"].map(
                        (o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Provider</Label>
                  <Input
                    className="h-8"
                    value={edit.provider}
                    onChange={(e) => setEdit({ ...edit, provider: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sum insured</Label>
                  <Input
                    className="h-8"
                    type="number"
                    value={edit.sumInsured}
                    onChange={(e) => setEdit({ ...edit, sumInsured: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Coverage</Label>
                  <Select
                    value={edit.coverage}
                    onValueChange={(v) => setEdit({ ...edit, coverage: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Employee", "Employee + Spouse", "Family floater", "Family + Parents"].map(
                        (o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Employee premium / month</Label>
                  <Input
                    className="h-8"
                    type="number"
                    value={edit.employeePremiumMonthly}
                    onChange={(e) =>
                      setEdit({ ...edit, employeePremiumMonthly: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Employer premium / month</Label>
                  <Input
                    className="h-8"
                    type="number"
                    value={edit.employerPremiumMonthly}
                    onChange={(e) =>
                      setEdit({ ...edit, employerPremiumMonthly: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Eligibility</Label>
                  <Input
                    className="h-8"
                    value={edit.eligibility}
                    onChange={(e) => setEdit({ ...edit, eligibility: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                className="bg-gradient-emerald text-white"
                disabled={
                  !edit?.name.trim() ||
                  [edit.sumInsured, edit.employeePremiumMonthly, edit.employerPremiumMonthly].some(
                    (n) => n < 0,
                  )
                }
                onClick={() => {
                  saveInsurancePlan(edit);
                  setEdit(null);
                  toast.success("Plan saved");
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/** Cross-links to every configuration screen that lives in its own module so Master Data is the single entry point. */
export function ConfigLinksTab() {
  const links = [
    [
      "Statutory configuration (PF / ESI / TDS, approval chain)",
      "/org/compliance",
      "Statutory Compliance → Statutory Config",
    ],
    [
      "State policies (PT slabs, LWF, minimum wage)",
      "/org/compliance",
      "Statutory Compliance → State Policies",
    ],
    [
      "Attendance patterns & workday overrides",
      "/org/compliance",
      "Statutory Compliance → Attendance Patterns",
    ],
    [
      "HR policy parameters (retirement age, probation reminders)",
      "/org/notifications",
      "Notification Centre → HR policy",
    ],
    ["Helpdesk departments, categories, SLA", "/helpdesk/settings", "Helpdesk → Desk Settings"],
    ["Approval engine (workflows per module)", "/org/approvals", "Approval Engine"],
    ["Company groups, entities, branding", "/org/groups", "Company Groups"],
    ["Branches, biometric devices, geofences", "/org/infrastructure", "Infrastructure"],
    ["Roles & permissions", "/org/roles", "Roles & Permissions"],
    ["Integrations (SSO, AD, e-mail-to-ticket)", "/org/settings", "Settings → Integrations"],
    ["Exit & F&F configuration", "/org/exits", "Exit Management → Configuration"],
    ["Recruitment masters (locations, rounds)", "/org/recruitment/masters", "Recruitment Master"],
    ["Grievance routing & SLA matrix", "/org/grievances", "Grievance Redressal"],
    [
      "Loan / advance policy (3 × gross, ≤ 12 months)",
      "/org/finance",
      "Finance → Loans & Advances",
    ],
    ["Evaluation parameters & review forms", "/org/performance", "Performance → Review Forms"],
  ];
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <ExternalLink className="text-primary h-4 w-4" /> Configuration in other modules
        </div>
        <div className="text-muted-foreground mb-3 text-xs">
          Every configuration in the product is reachable from Master Data. These open their owning
          screen.
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {links.map(([l, to, where]) => (
            <Link
              href={to}
              key={l}
              className="border-border hover:bg-muted/30 flex items-center gap-2 rounded-lg border p-3 text-sm"
            >
              <span className="flex-1">
                {l}
                <div className="text-muted-foreground text-xs">{where}</div>
              </span>
              <ExternalLink className="text-muted-foreground h-4 w-4" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
