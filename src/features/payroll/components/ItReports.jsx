import { useMemo, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import {
  Download,
  Lock,
  Send,
  Save,
  FileSpreadsheet,
  Plus,
  Trash2,
  Paperclip,
  Upload,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DECLARATION_COMPONENTS,
  REPORT_FYS,
  buildItStatement,
  declarationTotal,
  getDeclaration,
  money,
  saveDeclaration,
  useDeclarations,
  withAddedField,
  withRemovedField,
} from "@/features/payroll/data/payroll-reports";
import { exportMatrixPdf } from "@/lib/export-utils";
import { DECLARATION_PROOFS, addDeclarationProof } from "@/features/payroll/data/declaration-data";
import { NEW_REGIME_RULES } from "@/features/payroll/data/statutory-data";
import { usePayrollRuns, useHydrated } from "@/features/payroll/data/payroll-engine";
import { ReportLoading } from "@/features/payroll/components/YtdReport";

const statusTone = (s) =>
  s === "Locked"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : s === "Submitted"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-gold/40 bg-gold/15 text-gold";

/** Sections A → R, accordion style. */
export function ItStatement({ emp }) {
  return useHydrated() ? <ItStatementInner emp={emp} /> : <ReportLoading />;
}
function ItStatementInner({ emp }) {
  const [fy, setFy] = useState(REPORT_FYS[0]);
  // Recompute when payroll runs or the declaration change (TDS projection reads both).
  const runs = usePayrollRuns();
  const decls = useDeclarations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sections = useMemo(() => buildItStatement(emp.id, fy), [emp.id, fy, runs, decls]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={fy} onValueChange={setFy}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_FYS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          {emp.name} · {emp.id}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => {
            const ok = exportMatrixPdf({
              title: "Income Tax Statement",
              subtitle: `${fy} · ${emp.name} (${emp.id})`,
              details: [
                { label: "Employee", value: `${emp.name} (${emp.id})` },
                { label: "Designation", value: emp.role },
                { label: "Department", value: emp.dept },
                { label: "Financial Year", value: fy },
              ],
              columns: ["Amount (₹)"],
              groups: sections.map((s) => ({
                rows: [
                  { label: `${s.code}. ${s.label}`, values: [money(s.value)], strong: true },
                  ...(s.children ?? []).map((c) => ({
                    label: `    ${c.label}`,
                    values: [money(c.value)],
                  })),
                ],
              })),
            });
            toast[ok ? "success" : "error"](
              ok
                ? `IT statement for ${fy} ready — save as PDF`
                : "Allow pop-ups to download the statement",
            );
          }}
        >
          <Download className="h-4 w-4" /> Download statement
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-3 sm:p-5">
          <Accordion type="multiple" className="w-full">
            {sections.map((s) => (
              <AccordionItem key={s.code} value={s.code}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex w-full items-center gap-3 pr-3 text-left">
                    <span className="bg-primary/10 text-primary grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold">
                      {s.code}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                      <span className="flex-1 text-sm font-medium">{s.label}</span>
                      <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                        ₹&nbsp;{money(s.value)}
                      </span>
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {s.children?.length ? (
                    <div className="border-border rounded-lg border">
                      {s.children.map((c) => (
                        <div
                          key={c.label}
                          className="border-border/60 flex justify-between border-b px-3 py-2 text-sm last:border-0"
                        >
                          <span className="text-muted-foreground">{c.label}</span>
                          <span className="font-medium tabular-nums">₹&nbsp;{money(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground px-1 text-sm">
                      {s.computed
                        ? "Computed from the sections above."
                        : "No components recorded for this section."}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

/** Form 12BB declaration — editable when not locked. */
export function ItDeclaration(props) {
  // The draft is seeded from the persisted declaration store — wait for hydration so SSR and client agree.
  return useHydrated() ? <ItDeclarationInner {...props} /> : <ReportLoading />;
}
function ItDeclarationInner({ emp, readOnly = false }) {
  useDeclarations();
  const [fy, setFy] = useState(REPORT_FYS[0]);
  const stored = getDeclaration(emp.id, fy);
  const [draft, setDraft] = useState(stored);

  // Re-sync when employee or FY changes.
  const key = `${emp.id}|${fy}`;
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setDraft(getDeclaration(emp.id, fy));
  }

  const locked = readOnly || draft.status === "Locked";
  const total = declarationTotal(draft.sections);
  const declaredRows = draft.sections.flatMap((s) =>
    s.fields
      .filter((f) => (Number(f.amount) || 0) > 0)
      .map((f) => ({
        section: s.title,
        key: f.key,
        label: f.label,
        amount: Number(f.amount) || 0,
      })),
  );

  const sectionTitles = draft.sections.map((s) => s.title);
  const [addSection, setAddSection] = useState(sectionTitles[3] ?? sectionTitles[0]);
  const [addComponent, setAddComponent] = useState("__custom");
  const [customLabel, setCustomLabel] = useState("");
  const [basis, setBasis] = useState("Annual");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [proofSection, setProofSection] = useState(sectionTitles[0]);

  const catalogue = DECLARATION_COMPONENTS.filter((c) => c.section === addSection);

  const addField = () => {
    const label = addComponent === "__custom" ? customLabel.trim() : addComponent;
    const value = Number(amount) || 0;
    if (!label) return toast.error("Give the component a name");
    if (value <= 0) return toast.error("Enter an amount greater than zero");
    const annual = basis === "Monthly" ? value * 12 : value;
    setDraft((d) => withAddedField(d, addSection, label, annual, note.trim() || undefined));
    setCustomLabel("");
    setAmount("");
    setNote("");
    toast.success(`${label} added — ₹\u00A0${money(annual)} declared for ${fy}`);
  };

  const setFieldAmount = (sectionIdx, fieldIdx, value) =>
    setDraft((d) => {
      const sections = d.sections.map((s, i) =>
        i !== sectionIdx
          ? s
          : {
              ...s,
              fields: s.fields.map((f, j) =>
                j === fieldIdx ? { ...f, amount: Math.max(0, Number(value) || 0) } : f,
              ),
            },
      );
      return { ...d, sections };
    });

  const persist = (status) => {
    const amt = (k) =>
      Number(draft.sections.flatMap((s) => s.fields).find((f) => f.key === k)?.amount) || 0;
    if (status === "Submitted" && amt("prev.tds") > amt("prev.salary"))
      return void toast.error(
        "TDS by the previous employer cannot exceed the salary declared from that employer.",
      );
    const saved = saveDeclaration(draft, status);
    if (!saved) {
      setDraft(getDeclaration(emp.id, fy));
      return void toast.error(
        `Payroll has locked your ${fy} declaration — your changes were not saved.`,
      );
    }
    setDraft(saved);
    toast.success(
      status === "Submitted" ? `Declaration submitted for ${fy}` : `Draft saved for ${fy}`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={fy} onValueChange={setFy}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_FYS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          New Tax Regime (s.115BAC)
        </Badge>
        <Badge variant="outline" className={statusTone(draft.status)}>
          {draft.status === "Locked" && <Lock className="mr-1 h-3 w-3" />}
          {draft.status.toUpperCase()}
        </Badge>
        <span className="text-muted-foreground text-xs">
          Last updated <span className="whitespace-nowrap">{draft.updatedOn}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => {
            const ok = exportMatrixPdf({
              title: "Form 12BB — Details of claims and evidence thereof",
              subtitle: `${fy} · ${draft.regime} · ${draft.status}`,
              details: [
                { label: "Name of the employee", value: `${emp.name} (${emp.id})` },
                { label: "Designation", value: emp.role },
                { label: "Financial Year", value: fy },
                { label: "Tax regime", value: draft.regime },
                { label: "Total declared", value: `₹\u00A0${money(total)}` },
              ],
              columns: ["Amount (₹)"],
              groups: draft.sections.map((s) => ({
                name: s.title,
                rows: [
                  ...s.fields.map((f) => ({ label: f.label, values: [money(f.amount)] })),
                  {
                    label: "Sub total",
                    strong: true,
                    values: [money(s.fields.reduce((t, f) => t + (Number(f.amount) || 0), 0))],
                  },
                ],
              })),
              note: "Declared by the employee under Rule 26C of the Income-tax Rules, 1962. Supporting evidence to be produced on demand.",
            });
            toast[ok ? "success" : "error"](
              ok
                ? `Form 12BB for ${fy} ready — save as PDF`
                : "Allow pop-ups to download Form 12BB",
            );
          }}
        >
          <FileSpreadsheet className="h-4 w-4" /> Download Form 12BB
        </Button>
      </div>

      <div className="border-border bg-muted/30 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span className="text-muted-foreground">Employee</span>
          <span className="font-medium">
            {emp.name} ({emp.id})
          </span>
          <span className="text-muted-foreground">Total declared</span>
          <span className="font-semibold">₹&nbsp;{money(total)}</span>
        </div>
      </div>
      <div className="border-primary/30 bg-primary/5 space-y-1 rounded-xl border p-4 text-xs">
        <div className="text-sm font-semibold">What counts under the New Tax Regime</div>
        <ul className="text-muted-foreground list-disc pl-4">
          {NEW_REGIME_RULES.allowed.slice(0, 3).map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <div className="text-muted-foreground pt-1">
          Not collected (not deductible under the new regime):{" "}
          {NEW_REGIME_RULES.notAllowed.join("; ")}.
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Paperclip className="text-primary h-4 w-4" /> Proof of investment / income
                documents
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                HR verifies these against the declared amounts.{" "}
                {readOnly ? "" : "Upload one file per document."}
              </p>
            </div>
            {!readOnly && draft.status !== "Locked" && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Select value={proofSection} onValueChange={setProofSection}>
                  <SelectTrigger className="w-full sm:w-[260px]">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionTitles.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="border-border hover:bg-muted inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 text-xs">
                  <Upload className="h-3.5 w-3.5" /> Upload proof
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      captureFiles(e.target.files);
                      const input = e.currentTarget;
                      const f = input.files?.[0];
                      if (!f) return;
                      addDeclarationProof(emp.id, fy, { section: proofSection, name: f.name });
                      const fresh = getDeclaration(emp.id, fy);
                      /* keep unsaved amount edits — only pull the new proof list + history */ setDraft(
                        (d) => ({ ...d, proofs: fresh.proofs, history: fresh.history }),
                      );
                      toast.success(`${f.name} uploaded under ${proofSection}`);
                      input.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </div>
          {DECLARATION_PROOFS[proofSection] && !readOnly && (
            <div className="text-muted-foreground text-[11px]">
              Expected for this section: {DECLARATION_PROOFS[proofSection].join(" · ")}
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-2 text-left">Section</th>
                <th className="p-2 text-left">Document</th>
                <th className="p-2 text-left">Uploaded</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {(draft.proofs ?? []).map((p, i) => (
                <tr key={`${i}-${p.name}`}>
                  <td className="text-muted-foreground p-2">{p.section}</td>
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="text-muted-foreground p-2">
                    <span className="whitespace-nowrap">{p.uploadedOn}</span>
                  </td>
                  <td className="p-2">
                    <Badge
                      variant="outline"
                      className={
                        p.status === "Verified"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : p.status === "Rejected"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-gold/40 bg-gold/15 text-gold"
                      }
                    >
                      {p.status}
                    </Badge>
                    {p.remark && (
                      <div className="text-muted-foreground text-[11px]">{p.remark}</div>
                    )}
                  </td>
                </tr>
              ))}
              {(draft.proofs ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground p-6 text-center">
                    No proofs uploaded for {fy} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!locked && (
        <Card className="shadow-card border-primary/30">
          <CardContent className="space-y-4 p-5">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Plus className="text-primary h-4 w-4" /> Add a declaration component
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Declare an annual amount, or a monthly amount that is applied across all 12 months
                of {fy}.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Section</Label>
                <Select
                  value={addSection}
                  onValueChange={(v) => {
                    setAddSection(v);
                    setAddComponent("__custom");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionTitles.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Component</Label>
                <Select value={addComponent} onValueChange={setAddComponent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogue.map((c) => (
                      <SelectItem key={c.label} value={c.label}>
                        {c.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom">Other (type your own)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {addComponent === "__custom" && (
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="cl">
                    Component name
                  </Label>
                  <Input
                    id="cl"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Interest — post office savings"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Basis</Label>
                <Select value={basis} onValueChange={(v) => setBasis(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual">Annual amount</SelectItem>
                    <SelectItem value="Monthly">Monthly × 12 (bulk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="amt">
                  Amount (₹)
                </Label>
                <Input
                  id="amt"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="dt">
                  Details / policy or receipt no.
                </Label>
                <Input
                  id="dt"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="bg-gradient-emerald text-white" onClick={addField}>
                <Plus className="h-4 w-4" /> Add component
              </Button>
              {basis === "Monthly" && Number(amount) > 0 && (
                <span className="text-muted-foreground text-xs">
                  Will be declared as ₹&nbsp;{money(Number(amount) * 12)} for the year.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <div className="border-border flex flex-wrap items-center gap-2 border-b p-4">
          <div>
            <div className="text-sm font-semibold">Declarations I have added</div>
            <div className="text-muted-foreground text-xs">
              Every component currently declared for {fy}
            </div>
          </div>
          <Badge variant="outline" className="ml-auto">
            {declaredRows.length} component(s) · ₹&nbsp;{money(total)}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Section</th>
                <th className="p-3 text-left">Component</th>
                <th className="p-3 text-right">Annual amount (₹)</th>
                <th className="p-3 text-right">Monthly (₹)</th>
                <th className="p-3 text-left">Type</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {declaredRows.map((r) => (
                <tr key={`${r.section}-${r.key}`} className="hover:bg-muted/30">
                  <td className="text-muted-foreground p-3">{r.section}</td>
                  <td className="p-3 font-medium">{r.label}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{money(r.amount)}</td>
                  <td className="text-muted-foreground p-3 text-right tabular-nums">
                    {money(Math.round(r.amount / 12))}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">
                      {r.key.startsWith("custom.") ? "Added by me" : "Standard"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {declaredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground p-10 text-center">
                    Nothing declared yet — add a component above to start your {fy} declaration.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4">
        {draft.sections.map((s, si) => (
          <Card key={s.title} className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                {s.note && <p className="text-muted-foreground mt-0.5 text-xs">{s.note}</p>}
              </div>
              <div className="grid gap-2">
                {s.fields.map((f, fi) => (
                  <div
                    key={f.key}
                    className="border-border/60 flex flex-wrap items-center gap-3 border-b pb-2 last:border-0"
                  >
                    <span className="text-muted-foreground min-w-[220px] flex-1 text-sm">
                      {f.label}
                    </span>
                    {locked ? (
                      <span className="text-sm font-semibold tabular-nums">
                        ₹&nbsp;{money(f.amount)}
                      </span>
                    ) : (
                      <>
                        <Input
                          type="number"
                          min={0}
                          value={f.amount}
                          onChange={(e) => setFieldAmount(si, fi, e.target.value)}
                          className="h-9 w-full text-right sm:w-[160px]"
                        />

                        {f.key.startsWith("custom.") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive h-9 w-9"
                            aria-label={`Remove ${f.label}`}
                            onClick={() => {
                              setDraft((d) => withRemovedField(d, s.title, f.key));
                              toast.success(`${f.label} removed`);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => persist("Draft")}>
            <Save className="h-4 w-4" /> Save draft
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={() => persist("Submitted")}>
            <Send className="h-4 w-4" /> Submit declaration
          </Button>
        </div>
      )}
      {draft.status === "Locked" && !readOnly && (
        <p className="text-muted-foreground text-sm">
          This declaration is locked by payroll for {fy}. Contact HR to reopen it.
        </p>
      )}

      {draft.history.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="space-y-2 p-5">
            <h3 className="text-sm font-semibold">Declaration history</h3>
            {draft.history.map((h, i) => (
              <div
                key={i}
                className="border-border/60 flex justify-between border-b pb-1.5 text-sm last:border-0"
              >
                <span className="text-muted-foreground">{h.action}</span>
                <span className="font-medium">{h.at}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
