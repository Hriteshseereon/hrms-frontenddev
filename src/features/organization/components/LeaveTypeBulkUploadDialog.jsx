import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/features/recruitment/data/recruitmentMasterAdapters";

const COLUMNS = ["Name", "Code", "Annual days", "Credit", "Carry forward days", "Encashable", "Encash on", "Clubbable", "Max consecutive", "Attachment after days", "Approval chain", "Validity days", "Paid", "Applicable to", "Active"];
const MAX_ROWS = 500;
const keyOf = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const truth = (value, fallback = false) => {
  const v = keyOf(value);
  if (!v) return fallback;
  if (["yes", "true", "1", "y"].includes(v)) return true;
  if (["no", "false", "0", "n"].includes(v)) return false;
  return null;
};
const number = (value, fallback = 0) => String(value ?? "").trim() === "" ? fallback : Number(value);
const defaults = { creditFrequency: "Quarterly pro-rata", encashOn: "Gross", applicableTo: "All", approvalChain: "Manager", active: true, paid: true };

function rowToRecord(raw, rowNo) {
  const get = (name) => raw[keyOf(name)];
  const errors = [];
  const name = String(get("Name") ?? "").trim();
  const code = String(get("Code") ?? "").trim();
  const annual = number(get("Annual days"));
  const maxCarry = number(get("Carry forward days"));
  const encashable = truth(get("Encashable"), false);
  const clubbable = truth(get("Clubbable"), true);
  const maxConsecutive = number(get("Max consecutive"));
  const attachmentAfterDays = number(get("Attachment after days"));
  const validityDays = number(get("Validity days"));
  const paid = truth(get("Paid"), true);
  const active = truth(get("Active"), true);
  if (!name) errors.push("Name is required");
  for (const [label, value] of [["Annual days", annual], ["Carry forward days", maxCarry], ["Max consecutive", maxConsecutive], ["Attachment after days", attachmentAfterDays], ["Validity days", validityDays]]) {
    if (!Number.isFinite(value) || value < 0) errors.push(`${label} must be a non-negative number`);
  }
  for (const [label, value] of [["Encashable", encashable], ["Clubbable", clubbable], ["Paid", paid], ["Active", active]]) if (value === null) errors.push(`${label} must be Yes or No`);
  const record = {
    ...defaults, name, code, annual, maxCarry, carryForward: maxCarry > 0,
    encashable: encashable ?? false, encashOn: String(get("Encash on") || defaults.encashOn).trim(),
    clubbable: clubbable ?? true, maxConsecutive, attachmentAfterDays,
    needsAttachment: attachmentAfterDays > 0, approvalChain: String(get("Approval chain") || defaults.approvalChain).trim(),
    validityDays, paid: paid ?? true, applicableTo: String(get("Applicable to") || defaults.applicableTo).trim(), active: active ?? true, minDays: 0.5,
    creditFrequency: String(get("Credit") || defaults.creditFrequency).trim(),
  };
  if (!record.creditFrequency) errors.push("Credit is required");
  return { rowNo, record, errors };
}

export function downloadLeaveTypeTemplate() {
  const example = ["Casual Leave", "CL", 12, "Quarterly pro-rata", 0, "No", "Gross", "Yes", 0, 0, "Manager", 0, "Yes", "All", "Yes"];
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, example]);
  ws["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(c.length + 4, 18) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leave Types");
  XLSX.writeFile(wb, "leave_types_template.xlsx");
}

async function parseFile(file) {
  if (!file) throw new Error("Choose an Excel file");
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Upload an Excel file (.xlsx or .xls)");
  if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB");
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("The workbook has no sheets");
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  const rows = json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [keyOf(k), v])))
    .filter((r) => Object.values(r).some((v) => String(v).trim()));
  if (!rows.length) throw new Error("No data rows found in the first sheet");
  const missing = COLUMNS.filter((c) => !(keyOf(c) in rows[0]));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
  if (rows.length > MAX_ROWS) throw new Error(`Maximum ${MAX_ROWS} rows per upload`);
  const seen = new Set();
  return rows.map((r, i) => {
    const item = rowToRecord(r, i + 2);
    const name = item.record.name.toLowerCase();
    if (name && seen.has(name)) item.errors.push("Duplicate leave type name in this file");
    if (name) seen.add(name);
    return item;
  });
}

export function LeaveTypeBulkUploadDialog({ open, onOpenChange, leaveApi, onDone }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const validRows = rows.filter((r) => !r.errors.length);
  const errorRows = rows.filter((r) => r.errors.length);
  const reset = () => { setFile(null); setRows([]); setResult(null); };
  async function chooseFile(picked) {
    if (!picked) return;
    try { setRows(await parseFile(picked)); setFile(picked); setResult(null); }
    catch (error) { toast.error(error?.message || "Unable to read this Excel file"); }
  }
  async function upload() {
    if (!file || !validRows.length || errorRows.length) return;
    setUploading(true);
    let created = 0;
    try {
      for (const row of validRows) { await leaveApi.create(row.record); created += 1; }
      await onDone?.();
      setResult({ created });
      toast.success(`${created} leave type(s) uploaded`);
    } catch (error) {
      const message = apiErrorMessage(error, "Unable to upload leave types.");
      setResult({ created, error: message });
      toast.error(created ? `${created} leave type(s) created. ${message}` : message);
    } finally { setUploading(false); }
  }
  return <Dialog open={open} onOpenChange={(value) => { if (uploading) return; onOpenChange(value); if (!value) reset(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="text-primary h-5 w-5" />Bulk upload leave types</DialogTitle>
        <DialogDescription>Upload an Excel file with one leave type per row. Required headings: {COLUMNS.join(", ")}.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-muted-foreground text-xs">Download the template and fill in your leave types.</span>
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={downloadLeaveTypeTemplate}><Download className="mr-1 h-4 w-4" />Download template</Button></div>
        <label className="border-border hover:bg-muted/30 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4"><Upload className="text-primary h-5 w-5" /><div><div className="text-sm font-semibold">Choose Excel file</div><div className="text-muted-foreground text-xs">{file?.name || ".xlsx or .xls · max 5 MB"}</div></div>
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={uploading} onChange={(e) => { chooseFile(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
        {rows.length > 0 && <><div className="flex items-center gap-2 text-xs"><Badge variant="outline">{rows.length} rows</Badge><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">{validRows.length} valid</Badge>{errorRows.length > 0 && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">{errorRows.length} with errors</Badge>}</div>
          <div className="border-border max-h-[340px] overflow-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-muted/40 text-muted-foreground sticky top-0 uppercase"><tr>{["Row", "Name", "Code", "Annual", "Credit", "Approval", "Status"].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody className="divide-border divide-y">{rows.map((r) => <tr key={r.rowNo} className={r.errors.length ? "bg-destructive/5" : ""}><td className="p-2">{r.rowNo}</td><td className="p-2">{r.record.name || "—"}</td><td className="p-2">{r.record.code || "—"}</td><td className="p-2">{r.record.annual}</td><td className="p-2">{r.record.creditFrequency}</td><td className="p-2">{r.record.approvalChain}</td><td className="p-2">{r.errors.length ? <span className="text-destructive flex gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />{r.errors.join("; ")}</span> : <CheckCircle2 className="text-primary h-4 w-4" />}</td></tr>)}</tbody></table></div>
          {errorRows.length > 0 && <p className="text-destructive text-xs">Fix the rows marked in red and choose the file again. No rows are uploaded while errors remain.</p>}</>}
        {result?.created > 0 && <p className="rounded-lg border p-3 text-sm">Created {result.created} leave type(s) from {file?.name}.{result.error && <span className="text-destructive block">Upload stopped: {result.error}</span>}</p>}
        {result?.error && !result.created && <p className="text-destructive rounded-lg border p-3 text-sm">{result.error}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={uploading} onClick={() => { onOpenChange(false); reset(); }}>{result?.created ? "Close" : "Cancel"}</Button>
        {!result?.created && <Button className="bg-gradient-emerald text-white" disabled={!file || !validRows.length || errorRows.length > 0 || uploading} onClick={upload}>{uploading ? "Uploading…" : `Upload ${validRows.length} leave type(s)`}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
