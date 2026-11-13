// Bulk employee import (up to ~1,800 rows). The file is read in the browser, ordered so managers come first, then sent
// to POST /employees/bulk in chunks of 250, one after another. "Validate file" sends the same chunks with dry_run, so
// nothing is saved. Credentials are never sent by the import; "Send credentials" is a separate step.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Mail, Play, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { employeeBulkApi } from "@/api/employeeBulkApi";
import { useOrgMode } from "@/features/auth/data/module-access";
import { useSessionStore } from "@/features/auth/data/session-store";
import {
  BULK_CHUNK_SIZE,
  apiErrorText,
  chunkRecords,
  downloadErrorReport,
  downloadFailedRows,
  isRetryable,
  loadBatches,
  newBatchId,
  orderForManagers,
  parseImportFile,
  saveBatch,
  updateBatch,
} from "./bulkImport";
import { downloadImportTemplate } from "./importTemplate";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const num = (n) => Number(n ?? 0).toLocaleString("en-IN");
const when = (iso) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function BulkEmployeeImportDialog({ open, onOpenChange, onCreated }) {
  const orgMode = useOrgMode();
  const companyName = useSessionStore((s) => s.scopeCompanyName || s.companyName || "");
  const inputRef = useRef(null);
  const batchIdRef = useRef(newBatchId());
  const cancelRef = useRef(false);

  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | running | paused | done
  const [run, setRun] = useState(null); // { mode, chunk, chunks, rowsDone, rowsTotal }
  const [report, setReport] = useState(null); // { mode, created, skipped, failed, items, ignored }
  const [resume, setResume] = useState(null); // { mode, index, message, agg }
  const [batches, setBatches] = useState(() => loadBatches());
  const [creds, setCreds] = useState({}); // batch_id -> { loading, result, error }

  const busy = phase === "running";

  // Rows with a problem the browser can already see never go to the server; the rest are ordered and chunked.
  const plan = useMemo(() => {
    if (!parsed) return null;
    const bad = parsed.records.filter((r) => r.clientErrors.length);
    const ready = parsed.records.filter((r) => !r.clientErrors.length);
    return { bad, ready, chunks: chunkRecords(orderForManagers(ready)) };
  }, [parsed]);

  useEffect(() => {
    if (open) setBatches(loadBatches());
  }, [open]);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setParseError("");
    setPhase("idle");
    setRun(null);
    setReport(null);
    setResume(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    onOpenChange(false);
    reset();
  };

  const pickFile = async (event) => {
    const chosen = event.target.files?.[0] ?? null;
    reset();
    if (!chosen) return;
    setFile(chosen);
    batchIdRef.current = newBatchId(); // a new file is a new run
    try {
      setParsed(await parseImportFile(chosen));
    } catch (e) {
      setParseError(e.message || "Could not read this file.");
    }
  };

  const sendChunk = async (chunk, dry) => {
    const body = {
      batch_id: batchIdRef.current,
      dry_run: dry,
      on_duplicate: "skip", // makes sending a chunk again safe
      send_credentials: false, // credentials are sent later, on purpose
      rows: chunk.map((r) => r.data),
    };
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await employeeBulkApi.importRows(body);
      } catch (e) {
        if (!isRetryable(e) || attempt >= 2) throw e;
        await wait(1500 * (attempt + 1)); // same chunk again; saved rows come back as "skipped"
      }
    }
  };

  const snapshot = (agg, mode) => ({
    mode,
    created: agg.created,
    skipped: agg.skipped,
    failed: agg.failed,
    items: agg.items,
    ignored: [...agg.ignored],
  });

  const execute = async (mode, startAt = 0, carried = null) => {
    if (!plan) return;
    const dry = mode === "validate";
    const agg = carried ?? {
      created: 0,
      skipped: 0,
      failed: plan.bad.length,
      ignored: new Set(),
      items: plan.bad.map((r) => ({ fileRow: r.fileRow, employee_code: r.data.employee_code, status: "failed", errors: r.clientErrors })),
    };
    const rowsTotal = plan.ready.length;
    cancelRef.current = false;
    setResume(null);
    setPhase("running");
    setReport(snapshot(agg, mode));

    for (let i = startAt; i < plan.chunks.length; i += 1) {
      if (cancelRef.current) {
        setResume({ mode, index: i, message: "Stopped. Resume to carry on with the next call.", agg });
        setPhase("paused");
        return;
      }
      const chunk = plan.chunks[i];
      setRun({ mode, chunk: i + 1, chunks: plan.chunks.length, rowsDone: i * BULK_CHUNK_SIZE, rowsTotal });
      let res;
      try {
        res = await sendChunk(chunk, dry);
      } catch (e) {
        setResume({ mode, index: i, message: apiErrorText(e), agg });
        setPhase("paused");
        return;
      }
      for (const r of res.results ?? []) {
        const rec = chunk[r.row - 1];
        agg.items.push({
          fileRow: rec?.fileRow ?? r.row,
          employee_code: r.employee_code ?? rec?.data.employee_code,
          status: r.status,
          work_email: r.work_email,
          errors: r.errors ?? [],
        });
      }
      agg.created += res.created ?? 0;
      agg.skipped += res.skipped ?? 0;
      agg.failed += res.failed ?? 0;
      (res.ignored_columns ?? []).forEach((c) => agg.ignored.add(c));
      setReport(snapshot(agg, mode));
      if (!dry && agg.created > 0) {
        setBatches(
          saveBatch({ batch_id: batchIdRef.current, file: file?.name ?? "", company: companyName, at: new Date().toISOString(), created: agg.created, skipped: agg.skipped, failed: agg.failed }),
        );
      }
    }

    setRun({ mode, chunk: plan.chunks.length, chunks: plan.chunks.length, rowsDone: rowsTotal, rowsTotal });
    setPhase("done");
    if (!dry) {
      if (agg.created > 0) {
        toast.success(`${num(agg.created)} employee${agg.created === 1 ? "" : "s"} imported.`);
        onCreated?.();
      }
      batchIdRef.current = newBatchId(); // the next import is a new run
    }
  };

  const failedItems = useMemo(
    () => (report?.items ?? []).filter((i) => i.status === "failed").sort((a, b) => a.fileRow - b.fileRow),
    [report],
  );
  const skippedItems = useMemo(() => (report?.items ?? []).filter((i) => i.status === "skipped"), [report]);
  const failedRecords = useMemo(() => {
    if (!parsed) return [];
    const rows = new Set(failedItems.map((i) => i.fileRow));
    return parsed.records.filter((r) => rows.has(r.fileRow));
  }, [parsed, failedItems]);

  const sendCredentials = async (batch) => {
    if (!window.confirm(`Email login details to every employee imported in "${batch.file || "this import"}"? They can sign in only after this.`)) return;
    setCreds((c) => ({ ...c, [batch.batch_id]: { loading: true } }));
    try {
      const result = await employeeBulkApi.sendCredentials(batch.batch_id);
      setCreds((c) => ({ ...c, [batch.batch_id]: { result } }));
      setBatches(updateBatch(batch.batch_id, { credentialsQueuedAt: new Date().toISOString() }));
    } catch (e) {
      setCreds((c) => ({ ...c, [batch.batch_id]: { error: e?.response?.status === 404 ? "This import was not found on the server." : apiErrorText(e, "Could not queue the credentials.") } }));
    }
  };

  const downloadTemplate = async () => {
    try {
      const missing = await downloadImportTemplate();
      if (missing.length) toast.warning(`Template downloaded, but these lists could not be loaded: ${missing.join(", ")}.`);
    } catch {
      toast.error("Could not build the template. Try again.");
    }
  };

  const isValidation = report?.mode === "validate";
  const pct = run && run.rowsTotal ? Math.min(100, Math.round((run.rowsDone / run.rowsTotal) * 100)) : 0;
  const canRun = Boolean(plan) && !busy && !orgMode && plan.ready.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4" /> Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk upload employees</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file. Check it first with <strong>Validate file</strong> (nothing is saved), then import.
            {companyName && !orgMode ? <> Importing into <strong>{companyName}</strong>.</> : null}
          </DialogDescription>
        </DialogHeader>

        {orgMode && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Open a company from the header first. Employees are imported into one company.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} disabled={busy}>
              <Download className="h-4 w-4" /> Download template
            </Button>
            <span className="text-muted-foreground text-xs">The template lists the department, designation, branch, shift and grade names that exist.</span>
          </div>

          <div className="rounded-lg border border-dashed p-4">
            <Label htmlFor="employee-bulk-file">Employee file (Excel .xlsx or CSV)</Label>
            <Input ref={inputRef} id="employee-bulk-file" type="file" accept=".csv,.xlsx" className="mt-2" disabled={busy} onChange={pickFile} />
          </div>

          {parseError && <div className="text-destructive rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">{parseError}</div>}

          {parsed && plan && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div>
                <span className="font-medium">{file?.name}</span> · {num(parsed.records.length)} employee{parsed.records.length === 1 ? "" : "s"} ·{" "}
                {plan.chunks.length} call{plan.chunks.length === 1 ? "" : "s"} of up to {BULK_CHUNK_SIZE}
              </div>
              {plan.bad.length > 0 && (
                <div className="text-xs text-amber-700">
                  {num(plan.bad.length)} row{plan.bad.length === 1 ? "" : "s"} have a problem the file already shows (a repeated employee_code or a bank-account mismatch) and will be reported as failed.
                </div>
              )}
              {parsed.ignoredColumns.length > 0 && (
                <div className="text-xs text-amber-700">Columns the server does not use and will ignore: {parsed.ignoredColumns.join(", ")}.</div>
              )}
              {parsed.notSentColumns.length > 0 && (
                <div className="text-muted-foreground text-xs">Not sent (the company comes from your login and the work email is generated): {parsed.notSentColumns.join(", ")}.</div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={!canRun} onClick={() => execute("validate")}>
              <ShieldCheck className="h-4 w-4" /> Validate file
            </Button>
            <Button type="button" disabled={!canRun} onClick={() => execute("import")} className="bg-gradient-emerald text-white">
              <Play className="h-4 w-4" /> Import {plan ? `${num(plan.ready.length)} employees` : "employees"}
            </Button>
            {busy && (
              <Button type="button" variant="ghost" onClick={() => (cancelRef.current = true)}>
                Stop after this call
              </Button>
            )}
          </div>

          {run && (phase === "running" || phase === "paused") && (
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {run.mode === "validate" ? "Validating" : "Importing"} · call {run.chunk} of {run.chunks} · {num(run.rowsDone)} of {num(run.rowsTotal)} rows done
              </div>
              <Progress value={pct} />
            </div>
          )}

          {resume && (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div>{resume.message}</div>
              <Button size="sm" onClick={() => execute(resume.mode, resume.index, resume.agg)} disabled={busy || orgMode || !plan}>
                Resume from call {resume.index + 1}
              </Button>
              <div className="text-xs">Sending the same call again is safe: employees already saved come back as &quot;already exists&quot;.</div>
            </div>
          )}

          {report && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-xl font-semibold text-emerald-700">{num(report.created)}</div>
                  <div className="text-muted-foreground text-xs">{isValidation ? "Would be created" : "Created"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xl font-semibold">{num(report.skipped)}</div>
                  <div className="text-muted-foreground text-xs">Already exist (skipped)</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className={`text-xl font-semibold ${report.failed ? "text-destructive" : ""}`}>{num(report.failed)}</div>
                  <div className="text-muted-foreground text-xs">Failed</div>
                </div>
              </div>

              {report.ignored.length > 0 && (
                <div className="text-xs text-amber-700">The server ignored these columns: {report.ignored.join(", ")}.</div>
              )}

              {phase === "done" && isValidation && (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {report.failed ? "Fix the failed rows in your file, then validate again." : "No problems found. Nothing was saved. You can import now."}
                </div>
              )}
              {phase === "done" && !isValidation && (
                <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Login details have <strong>not</strong> been sent. Imported employees cannot sign in until you use <strong>Send credentials</strong> below.
                </div>
              )}

              {failedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">Rows that need fixing ({num(failedItems.length)})</div>
                    <Button size="sm" variant="outline" onClick={() => downloadErrorReport(failedItems)}>
                      <Download className="h-3.5 w-3.5" /> Error report (CSV)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadFailedRows(parsed.headers, failedRecords)}>
                      <Download className="h-3.5 w-3.5" /> Failed rows (Excel)
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0 text-left uppercase">
                        <tr>
                          <th className="p-2">Row</th>
                          <th className="p-2">Employee code</th>
                          <th className="p-2">Problem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {failedItems.slice(0, 300).map((item) => (
                          <tr key={`${item.fileRow}-${item.employee_code}`} className="align-top">
                            <td className="p-2 tabular-nums">{item.fileRow}</td>
                            <td className="p-2">{item.employee_code ?? "—"}</td>
                            <td className="p-2">
                              {(item.errors.length ? item.errors : [{ field: "", msg: "Not imported" }]).map((e, i) => (
                                <div key={i}>
                                  {e.field ? <span className="font-medium">{e.field}: </span> : null}
                                  {e.msg}
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {failedItems.length > 300 && (
                    <div className="text-muted-foreground text-xs">Showing the first 300. The error report has all {num(failedItems.length)}.</div>
                  )}
                  <div className="text-muted-foreground text-xs">Fix the file and upload it again. Employees already imported are skipped, so nobody is created twice.</div>
                </div>
              )}

              {skippedItems.length > 0 && (
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer">
                    {num(skippedItems.length)} row{skippedItems.length === 1 ? "" : "s"} already exist and were left alone
                  </summary>
                  <div className="text-muted-foreground mt-1 max-h-32 overflow-auto">
                    {skippedItems.slice(0, 100).map((i) => (
                      <div key={`${i.fileRow}-${i.employee_code}`}>
                        Row {i.fileRow} ({i.employee_code ?? "—"}): {i.errors[0]?.field ? `same ${i.errors[0].field}` : "already exists"}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {batches.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" /> Send credentials
              </div>
              <div className="text-muted-foreground text-xs">
                An import never emails anyone. When you are ready to go live, send each employee their login. Emails go out in the background, about 2 per second.
              </div>
              <div className="space-y-2">
                {batches.map((b) => {
                  const state = creds[b.batch_id] ?? {};
                  const result = state.result;
                  return (
                    <div key={b.batch_id} className="space-y-1 rounded-md border p-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{b.file || "Import"}</div>
                          <div className="text-muted-foreground">
                            {when(b.at)} · {num(b.created)} created{b.company ? ` · ${b.company}` : ""}
                          </div>
                        </div>
                        {b.credentialsQueuedAt && !result && <Badge variant="secondary">Queued {when(b.credentialsQueuedAt)}</Badge>}
                        <Button size="sm" variant="outline" disabled={state.loading} onClick={() => sendCredentials(b)}>
                          {state.loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1 h-3.5 w-3.5" />}
                          {b.credentialsQueuedAt ? "Send again" : "Send credentials"}
                        </Button>
                      </div>
                      {state.error && <div className="text-destructive">{state.error}</div>}
                      {result && (
                        <div className="space-y-0.5">
                          <div>
                            Queued {num(result.queued)} · already queued {num(result.already_queued)} · already sent {num(result.already_sent)}
                          </div>
                          {result.no_personal_email > 0 && (
                            <div className="text-amber-700">{num(result.no_personal_email)} employee{result.no_personal_email === 1 ? " has" : "s have"} no personal email and cannot be mailed. HR must handle them.</div>
                          )}
                          {result.email_configured === false && (
                            <div className="text-destructive">The server cannot send email right now (email is not configured).</div>
                          )}
                          <div className="text-muted-foreground">Emails are being sent in the background.</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
