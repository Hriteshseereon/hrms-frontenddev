import { useMemo, useState } from "react";
import { captureFiles, downloadAttachment } from "@/lib/attachments";
import {
  FileBadge,
  Plus,
  Upload,
  Download,
  Search,
  Eye,
  ClipboardList,
  FileCheck2,
  Lock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { NEW_REGIME_RULES, NEW_REGIME_SLAB_ROWS } from "@/features/payroll/data/statutory-data";
import {
  declarationTotal,
  lockBlocker,
  lockDeclaration,
  reviewDeclarationProof,
  useDeclarations,
} from "@/features/payroll/data/declaration-data";
import {
  FINANCIAL_YEARS,
  TAX_FORM_TYPES,
  addTaxDocument,
  assessmentYearOf,
  buildForm16Working,
  logTaxAction,
  recomputeForm16,
  renderForm16Pdf,
  taxTone,
  useTaxDocs,
} from "@/features/payroll/data/tax-data";
import {
  Field,
  SectionTitle,
  EmployeePicker,
  KV,
  useScopedIds,
} from "@/features/employees/components/CasePieces";
import { clickableRow } from "@/components/common/RecordDetail";

const inr = (n) => `₹\u00A0${Math.round(n).toLocaleString("en-IN")}`;
const declTone = (s) =>
  s === "Locked"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Submitted"
      ? "border-gold/40 bg-gold/15 text-gold"
      : "border-border bg-muted text-muted-foreground";
const proofTone = (s) =>
  s === "Verified"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-gold/40 bg-gold/15 text-gold";

function TaxPage() {
  // Tenant scope (as on Claims / Goals): only declarations and tax documents of the active entity's employees.
  const scopedIds = useScopedIds();
  const allDocs = useTaxDocs();
  const allDeclarations = useDeclarations();
  const docs = useMemo(() => allDocs.filter((d) => scopedIds.has(d.empId)), [allDocs, scopedIds]);
  const declarations = useMemo(
    () => allDeclarations.filter((d) => scopedIds.has(d.empId)),
    [allDeclarations, scopedIds],
  );
  const me = useCurrentUser();
  const [fy, setFy] = useState("All");
  const [form, setForm] = useState("All");
  const [q, setQ] = useState("");
  const [docId, setDocId] = useState(null);
  const [declKey, setDeclKey] = useState(null);
  const [gen, setGen] = useState(null);
  const [upload, setUpload] = useState(false);

  const rows = useMemo(
    () =>
      docs.filter(
        (d) =>
          (fy === "All" || d.fy === fy) &&
          (form === "All" || d.form === form) &&
          (d.employee.toLowerCase().includes(q.toLowerCase()) ||
            d.empId.toLowerCase().includes(q.toLowerCase())),
      ),
    [docs, fy, form, q],
  );
  const declRows = useMemo(
    () =>
      declarations
        .filter(
          (d) =>
            (fy === "All" || d.fy === fy) &&
            (!q ||
              `${findEmployee(d.empId)?.name ?? ""} ${d.empId}`
                .toLowerCase()
                .includes(q.toLowerCase())),
        )
        .map((d) => ({
          ...d,
          name: findEmployee(d.empId)?.name ?? d.empId,
          dept: findEmployee(d.empId)?.dept ?? "—",
          total: declarationTotal(d.sections),
          proofs: d.proofs ?? [],
        }))
        .sort((a, b) => (a.updatedOn < b.updatedOn ? 1 : -1)),
    [declarations, fy, q],
  );
  const doc = docs.find((d) => d.id === docId) ?? null;
  const decl = declarations.find((d) => `${d.empId}|${d.fy}` === declKey) ?? null;
  const pendingProofs = declarations.reduce(
    (s, d) => s + (d.proofs ?? []).filter((p) => p.status === "Uploaded").length,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileBadge className="text-primary h-6 w-6" /> Proof of Investment &amp; Tax Documents
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What each employee declared and uploaded for the year, HR verification, and Form 16 / 12BB
          generation — all under the <b>New Tax Regime (s.115BAC)</b>. Click any row to open the
          details.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Declarations submitted",
            value: declarations.filter((d) => d.status !== "Draft").length,
          },
          { label: "Proofs awaiting verification", value: pendingProofs },
          {
            label: "Form 16 issued / generated",
            value: docs.filter((d) => d.form.startsWith("Form 16")).length,
          },
          { label: "Tax regime", value: "New (115BAC)" },
        ].map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="text-muted-foreground text-xs tracking-wider uppercase">
                {s.label}
              </div>
              <div className="mt-1 text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="border-border bg-muted/40 flex max-w-sm min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search employee…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All financial years</SelectItem>
              {FINANCIAL_YEARS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={form} onValueChange={setForm}>
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All forms</SelectItem>
              {TAX_FORM_TYPES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setUpload(true)}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
            <Button size="sm" className="bg-gradient-emerald text-white" onClick={() => setGen({})}>
              <Plus className="h-4 w-4" /> Generate tax document
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="declarations">
        <ScrollTabsList>
          <TabsTrigger value="declarations">
            <ClipboardList className="h-4 w-4" /> Declarations &amp; Proofs
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileCheck2 className="h-4 w-4" /> Tax Documents
          </TabsTrigger>
          <TabsTrigger value="regime">
            <ShieldCheck className="h-4 w-4" /> New Regime Rules
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="declarations" className="pt-4">
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "Employee",
                      "FY",
                      "Declared (annual)",
                      "Previous employer",
                      "Other income",
                      "80CCD(2)",
                      "Proofs",
                      "Status",
                      "Updated",
                      "",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {declRows.map((d) => {
                    const amt = (k) =>
                      d.sections.flatMap((s) => s.fields).find((f) => f.key === k)?.amount ?? 0;
                    const other =
                      d.sections
                        .find((s) => s.title === "Other income")
                        ?.fields.reduce((s, f) => s + f.amount, 0) ?? 0;
                    return (
                      <tr
                        key={`${d.empId}|${d.fy}`}
                        className={clickableRow}
                        onClick={() => setDeclKey(`${d.empId}|${d.fy}`)}
                      >
                        <td className="p-3">
                          <div className="font-semibold">{d.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {d.empId} · {d.dept}
                          </div>
                        </td>
                        <td className="p-3">{d.fy}</td>
                        <td className="p-3 font-semibold tabular-nums">{inr(d.total)}</td>
                        <td className="p-3 tabular-nums">
                          {amt("prev.salary") ? inr(amt("prev.salary")) : "—"}
                        </td>
                        <td className="p-3 tabular-nums">{other ? inr(other) : "—"}</td>
                        <td className="p-3 tabular-nums">
                          {amt("80ccd2.employer") ? inr(amt("80ccd2.employer")) : "—"}
                        </td>
                        <td className="p-3 text-xs">
                          {d.proofs.length} file(s)
                          {d.proofs.some((p) => p.status === "Uploaded") && (
                            <div className="text-gold">
                              {d.proofs.filter((p) => p.status === "Uploaded").length} to verify
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={declTone(d.status)}>
                            {d.status}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground p-3 text-xs">
                          <span className="whitespace-nowrap">{d.updatedOn}</span>
                        </td>
                        <td className="p-3">
                          <Eye className="text-muted-foreground h-4 w-4" />
                        </td>
                      </tr>
                    );
                  })}
                  {declRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-muted-foreground p-8 text-center">
                        No declarations match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "Ref",
                      "Employee",
                      "Form",
                      "Financial Year",
                      "Gross",
                      "TDS",
                      "Status",
                      "Issued",
                      "",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((d) => (
                    <tr key={d.id} className={clickableRow} onClick={() => setDocId(d.id)}>
                      <td className="p-3 font-medium">{d.id}</td>
                      <td className="p-3">
                        <div className="font-semibold">{d.employee}</div>
                        <div className="text-muted-foreground text-xs">{d.empId}</div>
                      </td>
                      <td className="p-3">
                        {d.form}
                        <div className="text-muted-foreground text-[11px]">
                          {d.working ? d.working.parts : d.source}
                        </div>
                      </td>
                      <td className="p-3">
                        {d.fy}
                        <div className="text-muted-foreground text-[11px]">
                          {assessmentYearOf(d.fy)}
                        </div>
                      </td>
                      <td className="p-3 tabular-nums">{d.grossSalary}</td>
                      <td className="p-3 tabular-nums">{d.taxDeducted}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={taxTone(d.status)}>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        <span className="whitespace-nowrap">{d.issuedOn}</span>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (d.working) renderForm16Pdf(d);
                              else
                                downloadAttachment(
                                  d.fileName,
                                  `${d.form} · ${d.fy} · ${d.employeeName ?? ""}`,
                                );
                              logTaxAction(d.id, me.name, "Downloaded");
                              toast.success(
                                d.working
                                  ? `${d.form} ready in the print dialog`
                                  : `${d.fileName} downloaded`,
                              );
                            }}
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDocId(d.id)}>
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-muted-foreground p-8 text-center">
                        No tax documents match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="regime" className="pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="mb-2 font-semibold">
                  Income-tax slabs — FY 2026-27 (New Regime, s.115BAC)
                </div>
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-xs tracking-wider uppercase">
                    <tr>
                      <th className="py-1 text-left">Taxable income</th>
                      <th className="py-1 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {NEW_REGIME_SLAB_ROWS.map((r) => (
                      <tr key={r.range}>
                        <td className="py-1.5">{r.range}</td>
                        <td className="py-1.5 text-right font-medium">{r.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-muted-foreground mt-2 text-xs">
                  {NEW_REGIME_RULES.surcharge} Health &amp; Education Cess 4 %. Rates as per the
                  Finance Act — verify each FY before the first payroll run.
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="space-y-2 p-5 text-sm">
                <div className="font-semibold">What employees can and cannot declare</div>
                <div className="text-primary text-xs font-semibold">Allowed</div>
                <ul className="text-muted-foreground list-disc pl-5 text-xs">
                  {NEW_REGIME_RULES.allowed.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <div className="text-destructive pt-1 text-xs font-semibold">
                  Not applicable — fields removed from Form 12BB
                </div>
                <ul className="text-muted-foreground list-disc pl-5 text-xs">
                  {NEW_REGIME_RULES.notAllowed.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {decl && (
        <DeclarationDetailDialog
          decl={decl}
          onClose={() => setDeclKey(null)}
          onGenerate={() => {
            setDeclKey(null);
            setGen({ empId: decl.empId, fy: decl.fy });
          }}
        />
      )}
      {doc && <TaxDocDetailDialog doc={doc} onClose={() => setDocId(null)} />}
      {gen && (
        <GenerateTaxDocDialog
          initialEmpId={gen.empId}
          initialFy={gen.fy}
          onClose={() => setGen(null)}
        />
      )}
      {upload && <UploadTaxDocDialog onClose={() => setUpload(false)} />}
    </div>
  );
}

/* ---------------- Declaration & proofs popup ---------------- */
function DeclarationDetailDialog({ decl, onClose, onGenerate }) {
  const me = useCurrentUser();
  const emp = findEmployee(decl.empId);
  const [remark, setRemark] = useState("");
  const total = declarationTotal(decl.sections);
  // HR never reviews or locks their own declaration.
  const own = decl.empId === me.id;
  const lockWhy = lockBlocker(decl, me.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="text-primary h-4 w-4" /> {emp?.name ?? decl.empId} · Form 12BB
            declaration · {decl.fy}
          </DialogTitle>
          <DialogDescription>
            {decl.empId} · {emp?.role} · {emp?.dept} · New Tax Regime · last updated{" "}
            <span className="whitespace-nowrap">{decl.updatedOn}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={declTone(decl.status)}>
            {decl.status}
          </Badge>
          <Badge variant="outline">Total declared {inr(total)}</Badge>
          <Badge variant="outline">{(decl.proofs ?? []).length} proof(s)</Badge>
          {decl.note && <span className="text-muted-foreground text-xs">“{decl.note}”</span>}
        </div>

        <div className="space-y-3">
          {decl.sections.map((s) => (
            <div key={s.title} className="border-border rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-sm font-semibold tabular-nums">
                  {inr(s.fields.reduce((t, f) => t + f.amount, 0))}
                </div>
              </div>
              {s.note && <div className="text-muted-foreground text-[11px]">{s.note}</div>}
              <table className="mt-2 w-full text-sm">
                <tbody className="divide-border/60 divide-y">
                  {s.fields.map((f) => (
                    <tr key={f.key}>
                      <td className="text-muted-foreground py-1">
                        {f.label}
                        {f.key.startsWith("custom.") && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            added by employee
                          </Badge>
                        )}
                      </td>
                      <td
                        className={cn(
                          "py-1 text-right tabular-nums",
                          f.amount ? "font-medium" : "text-muted-foreground",
                        )}
                      >
                        {f.amount ? inr(f.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-sm font-semibold">Proofs uploaded by the employee</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-[11px] tracking-wider uppercase">
              <tr>
                <th className="p-2 text-left">Section</th>
                <th className="p-2 text-left">Document</th>
                <th className="p-2 text-left">Uploaded</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Verify</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {(decl.proofs ?? []).map((p, i) => (
                <tr key={`${i}|${p.section}|${p.name}`}>
                  <td className="text-muted-foreground p-2">{p.section}</td>
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="text-muted-foreground p-2">
                    <span className="whitespace-nowrap">{p.uploadedOn}</span>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className={proofTone(p.status)}>
                      {p.status}
                    </Badge>
                    {p.remark && (
                      <div className="text-muted-foreground text-[11px]">{p.remark}</div>
                    )}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {p.status === "Uploaded" && decl.status !== "Locked" && own && (
                      <span className="text-muted-foreground text-[11px]">Your own proof</span>
                    )}
                    {p.status === "Uploaded" && decl.status !== "Locked" && !own && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const ok = reviewDeclarationProof(
                              decl.empId,
                              decl.fy,
                              p.name,
                              "Verified",
                              me.name,
                              remark.trim(),
                              me.id,
                            );
                            toast[ok ? "success" : "error"](
                              ok ? `${p.name} verified` : `${p.name} could not be verified`,
                            );
                          }}
                        >
                          <CheckCircle2 className="text-primary h-4 w-4" /> Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (!remark.trim())
                              return toast.error("Add a remark explaining the rejection first");
                            const ok = reviewDeclarationProof(
                              decl.empId,
                              decl.fy,
                              p.name,
                              "Rejected",
                              me.name,
                              remark.trim(),
                              me.id,
                            );
                            toast[ok ? "success" : "error"](
                              ok
                                ? `${p.name} rejected — employee informed`
                                : `${p.name} could not be rejected`,
                            );
                          }}
                        >
                          <XCircle className="text-destructive h-4 w-4" /> Reject
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {(decl.proofs ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground p-4 text-center text-xs">
                    No proofs uploaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {decl.status !== "Locked" && (
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Verification remark (used for the next verify / reject)"
            />
          )}
        </div>

        <div className="border-border space-y-1 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            History
          </div>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {decl.history.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-24 shrink-0 tabular-nums">{h.at}</span>
                <span>{h.action}</span>
              </li>
            ))}
            {decl.history.length === 0 && <li>—</li>}
          </ul>
        </div>

        <DialogFooter className="gap-2">
          {decl.status === "Submitted" && lockWhy && (
            <span className="text-muted-foreground mr-auto self-center text-xs">{lockWhy}</span>
          )}
          {decl.status === "Submitted" && (
            <Button
              variant="outline"
              disabled={Boolean(lockWhy)}
              onClick={() => {
                const ok = lockDeclaration(decl.empId, decl.fy, me.name, me.id);
                toast[ok ? "success" : "error"](
                  ok ? "Declaration verified and locked for payroll" : (lockWhy ?? "Cannot lock"),
                );
              }}
            >
              <Lock className="h-4 w-4" /> Verify &amp; lock for payroll
            </Button>
          )}
          <Button className="bg-gradient-emerald text-white" onClick={onGenerate}>
            <Plus className="h-4 w-4" /> Generate Form 16 for {decl.fy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Tax document popup ---------------- */
function TaxDocDetailDialog({ doc, onClose }) {
  const me = useCurrentUser();
  const w = doc.working;
  // Verify / issue: a filing approver who neither generated the document nor (for issue) verified it.
  const canSign =
    can(me.role, "filing.approve") &&
    doc.generatedById !== me.id &&
    !(doc.status === "Verified" && doc.verifiedById === me.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBadge className="text-primary h-4 w-4" /> {doc.form} · {doc.employee} · {doc.fy}
          </DialogTitle>
          <DialogDescription>
            {doc.id} · {doc.empId} · {assessmentYearOf(doc.fy)} · {doc.source} on{" "}
            <span className="whitespace-nowrap">{doc.issuedOn}</span> · {doc.fileName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={taxTone(doc.status)}>
            {doc.status}
          </Badge>
          <Badge variant="outline">New Tax Regime</Badge>
          {w && (
            <Badge variant="outline">
              {w.parts}
              {w.digitallySigned ? " · DSC" : ""}
            </Badge>
          )}
        </div>
        {w ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="border-border space-y-2 rounded-xl border p-4">
              <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Deductor / deductee
              </div>
              <KV
                cols={1}
                items={[
                  ["Employer", w.employer.name],
                  ["TAN / PAN", `${w.employer.tan} / ${w.employer.pan}`],
                  ["Employee PAN", w.employee.pan],
                  ["Period", `${w.employee.periodFrom} → ${w.employee.periodTo}`],
                  ["Certificate no.", w.certificateNo],
                  ["Signatory", `${w.employer.signatory}, ${w.employer.designation}`],
                ]}
              />
            </div>
            <div className="border-border space-y-2 rounded-xl border p-4">
              <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Part B — computation
              </div>
              <KV
                cols={1}
                items={[
                  ["Gross salary", inr(w.grossSalary + w.previousEmployerSalary)],
                  ["Standard deduction", inr(w.standardDeduction)],
                  ["80CCD(2) employer NPS", inr(w.deduction80ccd2)],
                  ["Other income", inr(w.otherIncome)],
                  ["Taxable income", inr(w.taxableIncome)],
                  ["Tax on income", inr(w.slabTax)],
                  ["Rebate 87A", `− ${inr(w.rebate87a)}`],
                  ["Surcharge + cess", inr(w.surcharge + w.cess)],
                  ["Total tax", inr(w.totalTax)],
                ]}
              />
            </div>
            <div className="border-border rounded-xl border p-4 sm:col-span-2">
              <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                Slab-wise tax (s.115BAC)
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  <tr>
                    <th className="py-1 text-left">Slab</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Income in slab</th>
                    <th className="py-1 text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {w.slabRows.map((r) => (
                    <tr key={r.range}>
                      <td className="py-1">{r.range}</td>
                      <td className="py-1 text-right">{r.rate} %</td>
                      <td className="py-1 text-right tabular-nums">{inr(r.amount)}</td>
                      <td className="py-1 text-right tabular-nums">{inr(r.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-border rounded-xl border p-4 sm:col-span-2">
              <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                Part A — quarterly TDS deposited
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  <tr>
                    <th className="py-1 text-left">Quarter</th>
                    <th className="py-1 text-left">Receipt no.</th>
                    <th className="py-1 text-left">BSR</th>
                    <th className="py-1 text-left">Deposited</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {w.quarters.map((qq) => (
                    <tr key={qq.quarter}>
                      <td className="py-1">
                        {qq.quarter} · {qq.period}
                      </td>
                      <td className="py-1 font-mono">{qq.receiptNo}</td>
                      <td className="py-1 font-mono">{qq.challanBsr}</td>
                      <td className="py-1">
                        <span className="whitespace-nowrap">{qq.depositedOn}</span>
                      </td>
                      <td className="py-1 text-right tabular-nums">{inr(qq.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1" colSpan={4}>
                      Total TDS ·{" "}
                      {w.taxPayableOrRefund >= 0
                        ? `balance payable ${inr(w.taxPayableOrRefund)}`
                        : `refund due ${inr(-w.taxPayableOrRefund)}`}
                    </td>
                    <td className="py-1 text-right tabular-nums">{inr(w.tdsDeducted)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="border-border rounded-xl border p-4 text-sm">
            <KV
              items={[
                ["Gross salary", doc.grossSalary],
                ["Tax deducted", doc.taxDeducted],
                ["Source", doc.source],
                ["File", doc.fileName],
                ["Note", doc.uploadedNote ?? "—"],
              ]}
            />
          </div>
        )}
        <div className="border-border space-y-1 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            History
          </div>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {doc.history.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-24 shrink-0 tabular-nums">{h.at}</span>
                <span className="w-32 shrink-0 truncate">{h.by}</span>
                <span>{h.action}</span>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="gap-2">
          {!canSign &&
            (doc.status === "Generated" ||
              doc.status === "Uploaded" ||
              doc.status === "Verified") && (
              <span className="text-muted-foreground mr-auto self-center text-xs">
                {doc.generatedById === me.id
                  ? "You generated this document — a different approver verifies and issues it."
                  : doc.verifiedById === me.id && doc.status === "Verified"
                    ? "You verified this document — a different approver issues it."
                    : "Verification and issue need a filing approver (CFO / CHRO)."}
              </span>
            )}
          {canSign && (doc.status === "Generated" || doc.status === "Uploaded") && (
            <Button
              variant="outline"
              onClick={() => {
                const ok = logTaxAction(
                  doc.id,
                  me.name,
                  "Verified against TDS challans / Form 26AS",
                  "Verified",
                  me.id,
                );
                toast[ok ? "success" : "error"](
                  ok ? "Marked verified" : "This document cannot be verified by you.",
                );
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Mark verified
            </Button>
          )}
          {canSign && doc.status === "Verified" && (
            <Button
              variant="outline"
              onClick={() => {
                const ok = logTaxAction(
                  doc.id,
                  me.name,
                  "Digitally signed & issued to employee portal",
                  "Issued",
                  me.id,
                );
                toast[ok ? "success" : "error"](
                  ok ? "Issued to the employee portal" : "This document cannot be issued by you.",
                );
              }}
            >
              <ShieldCheck className="h-4 w-4" /> Sign &amp; issue
            </Button>
          )}
          <Button
            className="bg-gradient-emerald text-white"
            onClick={() => {
              if (w) renderForm16Pdf(doc);
              else downloadAttachment(doc.fileName, `${doc.form} · ${doc.fy}`);
              logTaxAction(doc.id, me.name, "Downloaded");
              toast.success(w ? "Form ready in the print dialog" : `${doc.fileName} downloaded`);
            }}
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Generate (detailed) ---------------- */
function GenerateTaxDocDialog({ initialEmpId, initialFy, onClose }) {
  const me = useCurrentUser();
  const [empId, setEmpId] = useState(initialEmpId ?? "");
  const [form, setForm] = useState("Form 16");
  const [fy, setFy] = useState(initialFy ?? FINANCIAL_YEARS[0]);
  const [parts, setParts] = useState("Part A + Part B");
  const [signatory, setSignatory] = useState("Saras Venkatesh");
  const [designation, setDesignation] = useState("Chief Financial Officer");
  const [place, setPlace] = useState("Bhubaneswar");
  const [dsc, setDsc] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [perquisites, setPerquisites] = useState("0");
  // null = use the exempt allowances computed from the declaration (a hard "0" default silently dropped them).
  const [exempt, setExempt] = useState(null);
  const [quarterEdits, setQuarterEdits] = useState({});
  const emp = findEmployee(empId);
  const base = useMemo(() => (empId ? buildForm16Working(empId, fy) : null), [empId, fy]);
  const working = useMemo(() => {
    if (!base) return null;
    const quarters = base.quarters.map((qq) => ({
      ...qq,
      receiptNo: quarterEdits[qq.quarter]?.receiptNo ?? qq.receiptNo,
      amount: Math.max(0, Number(quarterEdits[qq.quarter]?.amount ?? qq.amount) || 0),
      depositedOn: quarterEdits[qq.quarter]?.depositedOn ?? qq.depositedOn,
    }));
    const tds = quarters.reduce((s, qq) => s + qq.amount, 0);
    // Perquisites / exempt allowance edits change taxable income, so the tax is recomputed — not just the labels.
    const taxed = recomputeForm16(
      { ...base, tdsDeducted: tds },
      Math.max(0, Number(perquisites) || 0),
      exempt === null ? base.exemptAllowances : Math.max(0, Number(exempt) || 0),
    );
    return {
      ...taxed,
      parts: form === "Form 16 Part A only" ? "Part A only" : parts,
      digitallySigned: dsc,
      remarks,
      employer: { ...base.employer, signatory, designation, place },
      quarters,
      tdsDeducted: tds,
    };
  }, [
    base,
    form,
    parts,
    dsc,
    remarks,
    perquisites,
    exempt,
    signatory,
    designation,
    place,
    quarterEdits,
  ]);
  const duplicate = useTaxDocs().find(
    (d) => d.empId === empId && d.fy === fy && d.form === form && d.source === "Generated",
  );

  function submit() {
    if (!emp || !working) return;
    if (duplicate)
      return void toast.error(
        `${duplicate.id} already holds the ${form} for ${emp.name} · ${fy} (${duplicate.status}).`,
      );
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(working.employee.pan))
      return void toast.error(
        `${emp.name} has no valid PAN on record — Form 16 cannot be issued without PAN.`,
      );
    const id = addTaxDocument({
      empId: emp.id,
      employee: emp.name,
      form,
      fy,
      quarter: "Annual",
      fileName: `${form.toLowerCase().replace(/[^a-z0-9]+/g, "")}-${emp.id.toLowerCase()}-${fy.replace(/\s/g, "").toLowerCase()}.pdf`,
      grossSalary: inr(working.grossSalary + working.previousEmployerSalary),
      taxDeducted: inr(working.tdsDeducted),
      status: "Generated",
      issuedOn: new Date().toISOString().slice(0, 10),
      source: "Generated",
      by: me.name,
      byId: me.id,
      working,
    });
    toast.success(`${form} generated for ${emp.name} · ${id} — total tax ${inr(working.totalTax)}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Generate tax document — New Tax Regime</DialogTitle>
          <DialogDescription>
            Form 16 is computed from the payroll register for the financial year: gross, standard
            deduction, 80CCD(2), slab-wise tax u/s 115BAC, 87A rebate, cess and quarter-wise TDS.
            Review every figure before generating.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <SectionTitle n={1} title="Employee & document" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Employee" required className="sm:col-span-3">
              <EmployeePicker value={empId} onChange={(id) => setEmpId(id)} />
            </Field>
            <Field label="Form" required>
              <Select value={form} onValueChange={(v) => setForm(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_FORM_TYPES.filter((f) => f !== "Form 12BB").map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Financial year" required>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_YEARS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assessment year">
              <Input readOnly className="bg-muted/40" value={assessmentYearOf(fy)} />
            </Field>
            <Field label="Parts to generate">
              <Select value={parts} onValueChange={(v) => setParts(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Part A + Part B", "Part A only", "Part B only"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tax regime">
              <Input readOnly className="bg-muted/40" value="New Regime (s.115BAC)" />
            </Field>
            <Field label="Certificate no.">
              <Input
                readOnly
                className="bg-muted/40 font-mono"
                value={working?.certificateNo ?? "—"}
              />
            </Field>
          </div>

          {working && emp ? (
            <>
              <SectionTitle
                n={2}
                title="Part B — salary & deductions (from payroll)"
                sub={`${emp.name} · PAN ${working.employee.pan} · ${working.employee.designation}`}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="border-border rounded-xl border p-4">
                  <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                    Salary components (annual)
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-border/60 divide-y">
                      {working.salaryComponents.map((c) => (
                        <tr key={c.label}>
                          <td className="text-muted-foreground py-1">{c.label}</td>
                          <td className="py-1 text-right tabular-nums">{inr(c.annual)}</td>
                        </tr>
                      ))}
                      {working.previousEmployerSalary > 0 && (
                        <tr>
                          <td className="text-muted-foreground py-1">
                            Previous employer (Form 12B)
                          </td>
                          <td className="py-1 text-right tabular-nums">
                            {inr(working.previousEmployerSalary)}
                          </td>
                        </tr>
                      )}
                      <tr className="font-semibold">
                        <td className="py-1">Gross salary</td>
                        <td className="py-1 text-right tabular-nums">
                          {inr(working.grossSalary + working.previousEmployerSalary)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Field label="Perquisites s.17(2) (₹)">
                      <Input
                        type="number"
                        min={0}
                        value={perquisites}
                        onChange={(e) => setPerquisites(e.target.value)}
                      />
                    </Field>
                    <Field label="Exempt allowances u/s 10 (₹)">
                      <Input
                        type="number"
                        min={0}
                        value={exempt ?? String(working.exemptAllowances)}
                        onChange={(e) => setExempt(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
                <div className="border-border rounded-xl border p-4">
                  <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                    Computation
                  </div>
                  <KV
                    cols={1}
                    items={[
                      ["Standard deduction 16(ia)", inr(working.standardDeduction)],
                      ["80CCD(2) employer NPS", inr(working.deduction80ccd2)],
                      ["Other income declared", inr(working.otherIncome)],
                      ["Let-out interest set off", inr(working.letOutLoss)],
                      ["Taxable income", <b key="t">{inr(working.taxableIncome)}</b>],
                      ["Tax on income (slabs)", inr(working.slabTax)],
                      ["Rebate u/s 87A", `− ${inr(working.rebate87a)}`],
                      ["Surcharge", inr(working.surcharge)],
                      ["Cess 4 %", inr(working.cess)],
                      ["Total tax payable", <b key="tt">{inr(working.totalTax)}</b>],
                    ]}
                  />
                </div>
                <div className="border-border rounded-xl border p-4 sm:col-span-2">
                  <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                    Slab-wise tax (new regime, FY {fy.replace("FY ", "")})
                  </div>
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground text-[10px] tracking-wider uppercase">
                      <tr>
                        <th className="py-1 text-left">Slab</th>
                        <th className="py-1 text-right">Rate</th>
                        <th className="py-1 text-right">Income in slab</th>
                        <th className="py-1 text-right">Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {working.slabRows.map((r) => (
                        <tr key={r.range} className={cn(!r.amount && "text-muted-foreground")}>
                          <td className="py-1">{r.range}</td>
                          <td className="py-1 text-right">{r.rate} %</td>
                          <td className="py-1 text-right tabular-nums">{inr(r.amount)}</td>
                          <td className="py-1 text-right tabular-nums">{inr(r.tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <SectionTitle
                n={3}
                title="Part A — TDS deducted & deposited (quarter-wise)"
                sub="Pre-filled from the projected monthly TDS; correct receipt numbers and amounts against the 24Q acknowledgements."
              />
              <div className="border-border overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-[11px] tracking-wider uppercase">
                    <tr>
                      <th className="p-2 text-left">Quarter</th>
                      <th className="p-2 text-left">24Q receipt no.</th>
                      <th className="p-2 text-left">BSR code</th>
                      <th className="p-2 text-left">Deposited on</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {working.quarters.map((qq) => (
                      <tr key={qq.quarter}>
                        <td className="p-2">
                          {qq.quarter} · {qq.period}
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8 font-mono"
                            value={qq.receiptNo}
                            onChange={(e) =>
                              setQuarterEdits((m) => ({
                                ...m,
                                [qq.quarter]: { ...m[qq.quarter], receiptNo: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2 font-mono text-xs">{qq.challanBsr}</td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            type="date"
                            value={qq.depositedOn}
                            onChange={(e) =>
                              setQuarterEdits((m) => ({
                                ...m,
                                [qq.quarter]: { ...m[qq.quarter], depositedOn: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2 text-right">
                          <Input
                            className="h-8 text-right"
                            type="number"
                            min={0}
                            value={qq.amount}
                            onChange={(e) =>
                              setQuarterEdits((m) => ({
                                ...m,
                                [qq.quarter]: { ...m[qq.quarter], amount: e.target.value },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="p-2" colSpan={4}>
                        Total TDS · previous employer {inr(working.previousEmployerTds)} ·{" "}
                        {working.taxPayableOrRefund >= 0
                          ? `balance payable ${inr(working.taxPayableOrRefund)}`
                          : `refund due ${inr(-working.taxPayableOrRefund)}`}
                      </td>
                      <td className="p-2 text-right tabular-nums">{inr(working.tdsDeducted)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <SectionTitle n={4} title="Verification & signature" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Signatory" required>
                  <Input value={signatory} onChange={(e) => setSignatory(e.target.value)} />
                </Field>
                <Field label="Designation" required>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
                </Field>
                <Field label="Place">
                  <Input value={place} onChange={(e) => setPlace(e.target.value)} />
                </Field>
                <Field label="Deductor TAN / PAN">
                  <Input
                    readOnly
                    className="bg-muted/40 font-mono"
                    value={`${working.employer.tan} / ${working.employer.pan}`}
                  />
                </Field>
                <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={dsc} onChange={(e) => setDsc(e.target.checked)} />{" "}
                  Apply digital signature (DSC) and publish to the employee portal on issue
                </label>
                <Field label="Remarks (printed on the certificate)" className="sm:col-span-3">
                  <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </Field>
              </div>
            </>
          ) : (
            <div className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
              Select an employee to compute the Form 16 working from payroll.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {duplicate && (
            <span className="text-destructive mr-auto self-center text-xs">
              {duplicate.id} already exists for this employee, form and year.
            </span>
          )}
          <Button
            disabled={!working || !signatory.trim() || Boolean(duplicate)}
            className="bg-gradient-emerald text-white"
            onClick={submit}
          >
            <Plus className="h-4 w-4" /> Generate {form}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Upload ---------------- */
function UploadTaxDocDialog({ onClose }) {
  const me = useCurrentUser();
  const [empId, setEmpId] = useState("");
  const [form, setForm] = useState("Form 12BB");
  const [fy, setFy] = useState(FINANCIAL_YEARS[0]);
  const [gross, setGross] = useState("");
  const [tds, setTds] = useState("");
  const [file, setFile] = useState("");
  const [note, setNote] = useState("");
  const emp = findEmployee(empId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload tax document</DialogTitle>
          <DialogDescription>
            Attach a signed or externally issued tax document against an employee record.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <Field label="Employee" required className="sm:col-span-2">
            <EmployeePicker value={empId} onChange={(id) => setEmpId(id)} />
          </Field>
          <Field label="Form" required>
            <Select value={form} onValueChange={(v) => setForm(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_FORM_TYPES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Financial year" required>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_YEARS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gross salary">
            <Input
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              placeholder="₹\u00A024,80,000"
            />
          </Field>
          <Field label="Tax deducted">
            <Input
              value={tds}
              onChange={(e) => setTds(e.target.value)}
              placeholder="₹\u00A03,12,400"
            />
          </Field>
          <Field label="Document" required className="sm:col-span-2">
            <Input
              type="file"
              onChange={(e) => {
                captureFiles(e.target.files);
                setFile(e.target.files?.[0]?.name ?? "");
              }}
            />
          </Field>
          <div className="sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!emp || !file}
            className="bg-gradient-emerald text-white"
            onClick={() => {
              if (!emp) return;
              addTaxDocument({
                empId: emp.id,
                employee: emp.name,
                form,
                fy,
                quarter: "Annual",
                fileName: file,
                grossSalary: gross || "—",
                taxDeducted: tds || "—",
                status: "Uploaded",
                issuedOn: new Date().toISOString().slice(0, 10),
                source: "Uploaded",
                by: me.name,
                byId: me.id,
                uploadedNote: note.trim() || undefined,
              });
              toast.success(`${form} uploaded for ${emp.name}`);
              onClose();
            }}
          >
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TaxPage;
