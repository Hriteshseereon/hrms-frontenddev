import { useMemo, useState } from "react";
import { Eye, Plus, TrendingUp, Printer, MessageSquare, Pencil, XCircle, Mail, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyRow, Field, Toolbar } from "@/features/employees/components/CasePieces";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { api } from "@/services/api/client";
import * as promotionsApi from "@/services/api/endpoints/promotions";

const money = (value) => value == null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`;
const displayName = (employee) => [employee?.first_name, employee?.last_name].filter(Boolean).join(" ") || "Employee";
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const statusStyle = {
  DRAFT: "border-slate-300 bg-slate-100 text-slate-700",
  SENT_TO_EMPLOYEE: "border-blue-300 bg-blue-50 text-blue-800",
  SCHEDULED: "border-violet-300 bg-violet-50 text-violet-800",
  QUERY_RAISED: "border-amber-300 bg-amber-50 text-amber-900",
  QUERY_RESOLVED: "border-cyan-300 bg-cyan-50 text-cyan-900",
  EFFECTIVE: "border-emerald-300 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-rose-300 bg-rose-50 text-rose-800",
};
function PromotionStatus({ status }) {
  const key = status?.toUpperCase();
  return <Badge variant="outline" className={statusStyle[key] || "border-slate-300 bg-slate-100 text-slate-700"}>{status?.replaceAll("_", " ") || "Pending"}</Badge>;
}
function ResponseStatus({ response }) {
  const style = response === "ACCEPTED" || response === "ACKNOWLEDGED" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : response === "QUERY_RAISED" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-orange-300 bg-orange-50 text-orange-900";
  return <Badge variant="outline" className={style}>{response?.replaceAll("_", " ") || "PENDING"}</Badge>;
}

export function PromotionsTab() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const promotions = useApiQuery(["promotions"], (options) => promotionsApi.listPromotions(options));
  const employees = useApiQuery(["employees", "promotion-picker"], (options) => api.get("/employees", { ...options, query: { limit: 100 } }));
  const employeeById = useMemo(() => new Map((employees.data?.items ?? []).map((item) => [item.id, item])), [employees.data]);
  const rows = promotions.data ?? [];
  const filtered = rows.filter((row) => {
    const employee = employeeById.get(row.employee_id);
    const name = displayName(employee);
    return (status === "all" || row.status === status) &&
      (!query || [row.id, employee?.employee_code, name, row.to_designation, row.purpose].join(" ").toLowerCase().includes(query.toLowerCase()));
  });
  const statuses = ["DRAFT", "SENT_TO_EMPLOYEE", "QUERY_RAISED", "QUERY_RESOLVED", "SCHEDULED", "EFFECTIVE", "CANCELLED"];
  const cards = [
    ["Total promotions", rows.length],
    ["Sent to employee", rows.filter((r) => r.status === "SENT_TO_EMPLOYEE").length],
    ["Queries raised", rows.filter((r) => r.status === "QUERY_RAISED").length],
    ["Effective", rows.filter((r) => r.status === "EFFECTIVE").length],
  ];

  return <div className="space-y-4">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => <Card key={label} className="shadow-card"><CardContent className="p-4"><div className="text-muted-foreground text-xs">{label}</div><div className="text-2xl font-bold">{value}</div></CardContent></Card>)}
    </div>
    <Card className="shadow-card"><CardContent className="flex flex-wrap items-center gap-3 p-4">
      <Toolbar q={query} setQ={setQuery} placeholder="Search by employee, promotion ID, designation…">
        <select className="border-input bg-background h-9 rounded-md border px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
      </Toolbar>
      <Button className="bg-gradient-emerald ml-auto text-white" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New promotion</Button>
    </CardContent></Card>
    {promotions.isLoading ? <p className="text-muted-foreground p-6 text-sm">Loading promotions…</p> : promotions.isError ? <p className="text-destructive p-6 text-sm">Could not load promotions: {promotions.error?.detail || promotions.error?.message}</p> :
      <Card className="shadow-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-muted-foreground text-xs uppercase"><tr>
        {["Promotion ID", "Employee", "Purpose", "Designation", "Grade", "Annual CTC", "Effective date", "Response", "Status", "Actions"].map((h) => <th key={h} className="p-3 text-left">{h}</th>)}
      </tr></thead><tbody>{filtered.length === 0 ? <EmptyRow cols={10} text="No promotions found." /> : filtered.map((row) => {
        const employee = employeeById.get(row.employee_id);
        return <tr key={row.id} className="border-border border-t"><td className="p-3 font-mono text-xs">{row.id}</td><td className="p-3"><b>{displayName(employee)}</b><div className="text-muted-foreground text-xs">{employee?.employee_code ?? row.employee_id}</div></td>
          <td className="p-3">{row.purpose}</td><td className="p-3">{row.from_designation || "—"} → <b>{row.to_designation}</b></td><td className="p-3">{row.from_grade || "—"} → <b>{row.to_grade || "—"}</b></td>
          <td className="p-3">{money(row.from_ctc)} → {money(row.to_ctc)}</td><td className="p-3">{row.effective_from}</td><td className="p-3"><ResponseStatus response={row.employee_response} /></td><td className="p-3"><PromotionStatus status={row.status} /></td>
          <td className="p-3"><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setSelected({ ...row, __edit: false })}><Eye className="h-4 w-4" /> View</Button>{!['EFFECTIVE', 'CANCELLED'].includes(row.status) && <Button size="sm" variant="outline" onClick={() => setSelected({ ...row, __edit: true })}><Pencil className="h-4 w-4" /> Edit</Button>}</div></td></tr>;
      })}</tbody></table></div></Card>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Issue a promotion</DialogTitle><DialogDescription>Promotion details are sent directly to the employee. There is no approval step.</DialogDescription></DialogHeader>
      <PromotionCreateForm employees={employees.data?.items ?? []} onDone={() => setOpen(false)} />
    </DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><DialogContent className="max-h-[94dvh] w-[min(96vw,900px)] max-w-none gap-5 overflow-y-auto rounded-2xl p-5 sm:p-7"><DialogHeader className="border-b pb-4"><DialogTitle className="flex items-center gap-2 text-xl"><TrendingUp className="h-5 w-5 text-primary" />{selected?.id}</DialogTitle><DialogDescription>Promotion details, employee correspondence and actions</DialogDescription></DialogHeader>
      {selected && <PromotionDetails key={`${selected.id}-${selected.__edit}`} promotion={selected} employee={employeeById.get(selected.employee_id)} startEditing={selected.__edit} onChanged={() => { setSelected(null); promotions.refetch(); }} />}
      <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function PromotionCreateForm({ employees, onDone }) {
  const [employeeId, setEmployeeId] = useState("");
  const [promotionFiles, setPromotionFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [purpose, setPurpose] = useState("Annual Appraisal Outcome");
  const [basis, setBasis] = useState("");
  const [designation, setDesignation] = useState("");
  const [grade, setGrade] = useState("");
  const [ctc, setCtc] = useState("");
  const [effective, setEffective] = useState("");
  const [appraisal, setAppraisal] = useState("");
  const [department, setDepartment] = useState("");
  const [internalRemarks, setInternalRemarks] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const mutation = useApiMutation(promotionsApi.createPromotion, {
    invalidate: [["promotions"]], onSuccess: (data) => { toast[data?.email_status === "SENT" ? "success" : "warning"](data?.email_status === "SENT" ? "Promotion issued and email sent to the employee" : "Promotion issued, but employee email delivery needs attention"); onDone(); },
  });
  const employee = employees.find((item) => item.id === employeeId);
  const employeeDetails = useApiQuery(["employee", "promotion-form", employeeId], (options) => api.get(`/employees/${encodeURIComponent(employeeId)}`, options), { enabled: !!employeeId });
  const current = employeeDetails.data ?? employee;
  const currentCTC = Number(current?.ctc ?? current?.compensation?.ctc ?? 0);
  const increase = currentCTC && Number(ctc) ? (((Number(ctc) - currentCTC) / currentCTC) * 100).toFixed(1) : null;
  const payGrades = useApiQuery(["pay-grades", "promotion", employee?.organization_id], (options) => api.get("/pay-grades", { ...options, query: { ...options.query, organization_id: employee?.organization_id, status: "Active", page_size: 100 } }), { enabled: !!employee });
  const designations = useApiQuery(["designations", "promotion", employee?.company_id], (options) => api.get("/super-admin/designations", { ...options, query: { ...options.query, company_id: employee?.company_id, is_active: true, page_size: 200 } }), { enabled: !!employee });
  const departments = useApiQuery(["departments", "promotion", employee?.company_id], (options) => api.get("/super-admin/departments", { ...options, query: { ...options.query, company_id: employee?.company_id, is_active: true, page_size: 200 } }), { enabled: !!employee?.company_id });
  const gradeOptions = payGrades.data?.items ?? [];
  const designationOptions = designations.data?.items ?? [];
  const departmentOptions = departments.data?.items ?? (Array.isArray(departments.data) ? departments.data : []);
  const selectedGrade = gradeOptions.find((item) => item.grade_code === grade);
  const ctcValue = Number(ctc);
  const gradeRangeError = selectedGrade && ctcValue > 0 && (ctcValue < Number(selectedGrade.minimum_ctc) || ctcValue > Number(selectedGrade.maximum_ctc));

  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault();
    if (!employeeId || !basis.trim() || !designation.trim() || !grade || !effective || !ctc) { toast.error("Complete the required promotion fields."); return; }
    if (gradeRangeError) { toast.error(`Annual CTC must be between ${money(selectedGrade.minimum_ctc)} and ${money(selectedGrade.maximum_ctc)} for ${selectedGrade.grade_code}.`); return; }
    try {
      setUploadingFiles(true);
      const attachments = promotionFiles.length ? (await promotionsApi.uploadPromotionIssueAttachments(employeeId, promotionFiles)).attachments : [];
      mutation.mutate({ employee_id: employeeId, purpose, appraisal_ref: appraisal || null, basis: basis.trim(), from_designation: current?.designation || null, to_designation: designation.trim(), from_grade: current?.grade || null, to_grade: grade || null, from_ctc: currentCTC || null, to_ctc: ctc ? Number(ctc) : null, effective_from: effective, letter_type: "Promotion Letter", letter_ref: null, letter_file_url: null, letter_body: letterBody.trim() || null, new_department: department.trim() || null, internal_remarks: internalRemarks.trim() || null, attachments });
    } catch (error) {
      toast.error(error?.detail || error?.message || "Could not upload promotion attachments");
    } finally {
      setUploadingFiles(false);
    }
  }}>
    <Field label="Employee" required><select className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required><option value="">Select employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.employee_code} · {displayName(item)} · {item.department || "No department"}</option>)}</select></Field>
    {employee && <div className="bg-muted/40 grid gap-2 rounded-md p-3 text-xs sm:grid-cols-3"><span>Company: {employee.company_name || "—"}</span><span>Branch: {employee.branch_name || "—"}</span><span>Current role: {current?.designation || "—"}</span><span>Department: {employee.department || "—"}</span><span>Current grade: {current?.grade || "—"}</span><span>Current annual CTC: {money(currentCTC || null)}</span><span>Employee ID: {employee.employee_code}</span><span>Joining: {employee.date_of_joining || "—"}</span></div>}
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Promotion type"><select className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" value={purpose} onChange={(event) => setPurpose(event.target.value)}>{["Annual Appraisal Outcome", "Performance Based", "Career Progression", "Role / Responsibility Change", "Special Promotion", "Other"].map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Linked appraisal (optional)"><Input value={appraisal} onChange={(e) => setAppraisal(e.target.value)} /></Field>
      <Field label="New designation" required><select className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" value={designation} onChange={(e) => setDesignation(e.target.value)} required disabled={!employee || designations.isLoading}><option value="">{!employee ? "Select an employee first" : designations.isLoading ? "Loading designations…" : "Select designation"}</option>{designationOptions.map((item) => <option key={item.id} value={item.designation_name}>{item.designation_name}{item.department_name ? ` · ${item.department_name}` : ""}</option>)}</select>{designations.isError && <span className="text-destructive text-xs">Unable to load designations: {designations.error?.detail || designations.error?.message}</span>}{employee && !designations.isLoading && !designationOptions.length && !designations.isError && <span className="text-muted-foreground text-xs">No active designations found for this company.</span>}</Field>
      <Field label="New pay grade" required><select className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={!employee || payGrades.isLoading} required><option value="">{!employee ? "Select an employee first" : payGrades.isLoading ? "Loading pay grades…" : "Select pay grade"}</option>{gradeOptions.map((item) => <option key={item.id} value={item.grade_code}>{item.grade_code} · {item.band} ({money(item.minimum_ctc)} – {money(item.maximum_ctc)})</option>)}</select>{payGrades.isError && <span className="text-destructive text-xs">Unable to load pay grades: {payGrades.error?.detail || payGrades.error?.message}</span>}{employee && !payGrades.isLoading && !gradeOptions.length && !payGrades.isError && <span className="text-muted-foreground text-xs">No active pay grades found for this organization.</span>}</Field><Field label="New annual CTC" required><Input type="number" min={selectedGrade?.minimum_ctc ?? 0} max={selectedGrade?.maximum_ctc} value={ctc} onChange={(e) => setCtc(e.target.value)} required aria-invalid={Boolean(gradeRangeError)} />{increase != null && <span className="text-muted-foreground text-xs">Increase: {increase}%</span>}{gradeRangeError && <span role="alert" className="text-destructive text-xs">For {selectedGrade.grade_code}, annual CTC must be between {money(selectedGrade.minimum_ctc)} and {money(selectedGrade.maximum_ctc)}.</span>}</Field><Field label="Effective date" required><Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} required /></Field>
      <Field label="New department (optional)"><select className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!employee || departments.isLoading}><option value="">{!employee ? "Select an employee first" : departments.isLoading ? "Loading departments…" : `Keep current department${current?.department ? ` (${current.department})` : ""}`}</option>{departmentOptions.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.department_name}>{item.department_name}{item.department_code ? ` · ${item.department_code}` : ""}</option>)}</select>{departments.isError && <span className="text-destructive text-xs">Unable to load departments: {departments.error?.detail || departments.error?.message}</span>}</Field>
    </div><Field label="Basis / justification" required><Textarea rows={3} value={basis} onChange={(e) => setBasis(e.target.value)} required /></Field><Field label="Promotion letter body"><Textarea rows={4} value={letterBody} onChange={(e) => setLetterBody(e.target.value)} placeholder="Optional letter text; a standard letter will be generated if left blank" /></Field><Field label="Supporting files for employee"><div className="space-y-3 rounded-lg border border-dashed p-3"><label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent"><Paperclip className="h-4 w-4" /> Choose files<input className="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => { const picked = Array.from(event.target.files || []); setPromotionFiles((currentFiles) => [...currentFiles, ...picked.filter((file) => !currentFiles.some((current) => current.name === file.name && current.size === file.size))].slice(0, 5)); event.target.value = ""; }} /></label><span className="ml-2 text-xs text-muted-foreground">PDF or image · up to 5 files · 5 MB each</span>{promotionFiles.length === 0 ? <p className="text-xs text-muted-foreground">No files selected. Selected files will be attached to the employee email.</p> : <ul className="space-y-2">{promotionFiles.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"><span className="min-w-0 truncate text-sm">{file.name}<span className="ml-2 text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</span></span><button type="button" className="shrink-0 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10" aria-label={`Remove ${file.name}`} onClick={() => setPromotionFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index))}>Remove</button></li>)}</ul>}</div></Field><Field label="Internal HR remarks"><Textarea rows={2} value={internalRemarks} onChange={(e) => setInternalRemarks(e.target.value)} placeholder="Visible to HR users only" /></Field>
    <p className="text-muted-foreground text-xs">The generated promotion letter and selected supporting files are emailed to the employee when you issue the promotion.</p>
    <DialogFooter><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" disabled={uploadingFiles || mutation.isPending || Boolean(gradeRangeError)} className="bg-gradient-emerald text-white">{uploadingFiles ? "Uploading files…" : mutation.isPending ? "Sending…" : "Issue and email to employee"}</Button></DialogFooter>
  </form>;
}

function PromotionDetails({ promotion, employee, startEditing = false, onChanged }) {
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const [editing, setEditing] = useState(startEditing);
  const [revision, setRevision] = useState({ purpose: promotion.purpose, to_designation: promotion.to_designation, to_grade: promotion.to_grade || "", to_ctc: promotion.to_ctc || "", effective_from: promotion.effective_from, new_department: promotion.new_department || "", basis: promotion.basis, letter_body: promotion.letter_body || "" });
  const departmentQuery = useApiQuery(["departments", "promotion-edit", employee?.company_id], (options) => api.get("/super-admin/departments", { ...options, query: { ...options.query, company_id: employee?.company_id, is_active: true, page_size: 200 } }), { enabled: !!employee?.company_id });
  const departmentOptions = departmentQuery.data?.items ?? (Array.isArray(departmentQuery.data) ? departmentQuery.data : []);
  const replyMutation = useApiMutation((body) => promotionsApi.replyPromotionQuery(promotion.id, body), { invalidate: [["promotions"]], onSuccess: (data) => { toast[data?.email_status === "SENT" ? "success" : "warning"](data?.email_status === "SENT" ? "Reply sent and employee email notification accepted" : "Reply saved, but employee email delivery needs attention"); onChanged(); } });
  const reviseMutation = useApiMutation((body) => promotionsApi.revisePromotion(promotion.id, body), { invalidate: [["promotions"]], success: "Promotion revised and reissued", onSuccess: onChanged });
  const cancelMutation = useApiMutation((body) => promotionsApi.cancelPromotion(promotion.id, body), { invalidate: [["promotions"]], success: "Promotion cancelled", onSuccess: onChanged });
  const resendLetterMutation = useApiMutation(() => promotionsApi.resendPromotionLetter(promotion.id), { invalidate: [["promotions"]], success: "Promotion letter emailed to the employee", onSuccess: onChanged });
  const printLetter = () => {
    const body = promotion.letter_body || `Dear ${displayName(employee)},\n\nWe are pleased to inform you of your promotion to ${promotion.to_designation}${promotion.to_grade ? ` (${promotion.to_grade})` : ""}, effective ${promotion.effective_from}.\n\n${promotion.basis}\n\nRegards,\nHuman Resources`;
    const company = employee?.company_name || "WCS HRMS";
    const details = [
      ["New designation", promotion.to_designation],
      ["Pay grade", promotion.to_grade || "No change"],
      ["Revised annual CTC", money(promotion.to_ctc)],
      ["Effective from", promotion.effective_from],
    ];
    const detailRows = details.map(([label, value]) => `<div class="item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(promotion.id)} - Promotion Letter</title><style>
      @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px Arial,Helvetica,sans-serif;color:#1c2c27;margin:0;line-height:1.65}.sheet{max-width:780px;margin:38px auto;padding:48px 56px;background:#fff}.letterhead{display:flex;justify-content:space-between;align-items:center}.brand{display:flex;align-items:center;gap:12px}.mark{width:38px;height:38px;border-radius:50%;background:#075b43;color:#fff;font-weight:bold;display:grid;place-items:center;font-size:17px}.brand-name{font-weight:700;font-size:18px;color:#075b43}.brand-sub{display:block;font-size:10px;letter-spacing:1.5px;color:#64756f;text-transform:uppercase}.kind{text-align:right;color:#64756f;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}.rule{height:3px;background:#087353;margin:22px 0 30px}.eyebrow{color:#087353;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;margin:0 0 6px}h1{font-size:28px;margin:0 0 10px;color:#142b23}.ref{font-size:11px;color:#64756f;margin-bottom:28px}.recipient{margin:0 0 18px}.subject{font-size:14px;font-weight:700;margin:16px 0}.details{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dce7e2;border-radius:8px;margin:22px 0 26px;overflow:hidden}.item{padding:11px 14px;border-bottom:1px solid #e7eeeb}.item:nth-child(odd){border-right:1px solid #e7eeeb}.item:nth-last-child(-n+2){border-bottom:0}.item span{display:block;font-size:10px;color:#64756f;text-transform:uppercase;letter-spacing:.4px}.item strong{font-size:13px;color:#193c30}.letter-body{white-space:pre-wrap;line-height:1.8}.sign{margin-top:34px}.signature{font-weight:700;color:#173b2e;margin-top:28px}.footer{border-top:1px solid #dce7e2;margin-top:42px;padding-top:12px;color:#708078;font-size:9px;display:flex;justify-content:space-between}@media print{body{background:#fff}.sheet{max-width:none;margin:0;padding:0}.footer{position:fixed;bottom:0;left:0;right:0}}
      </style></head><body><main class="sheet"><header class="letterhead"><div class="brand"><div class="mark">${escapeHtml(company.slice(0,1).toUpperCase())}</div><div><div class="brand-name">${escapeHtml(company)}</div><span class="brand-sub">Human Resources</span></div></div><div class="kind">Official employee letter</div></header><div class="rule"></div><p class="eyebrow">Confidential employee communication</p><h1>Promotion Letter</h1><div class="ref">Reference ${escapeHtml(promotion.letter_ref || promotion.id)} &nbsp; · &nbsp; Issued ${escapeHtml(promotion.letter_issue_date || new Date().toISOString().slice(0, 10))}</div><p class="recipient"><b>To</b><br>${escapeHtml(displayName(employee))}<br>Employee ID: ${escapeHtml(employee?.employee_code || promotion.employee_id)}</p><p class="subject">Subject: Promotion to ${escapeHtml(promotion.to_designation)}</p><section class="details">${detailRows}</section><div class="letter-body">${escapeHtml(body)}</div><div class="sign">For ${escapeHtml(company)}<div class="signature">Human Resources</div></div><footer class="footer"><span>Confidential · Issued to the employee named above</span><span>${escapeHtml(promotion.id)}</span></footer></main><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };
  return <div className="space-y-4 text-sm">
    <section className="space-y-4 rounded-xl border bg-card p-4"><div className="grid gap-3 sm:grid-cols-2">{[["Employee", displayName(employee)], ["Purpose", promotion.purpose], ["Previous role", promotion.from_designation || "—"], ["New role", promotion.to_designation], ["Grade", `${promotion.from_grade || "—"} → ${promotion.to_grade || "—"}`], ["Annual CTC", `${money(promotion.from_ctc)} → ${money(promotion.to_ctc)}`], ["Effective date", promotion.effective_from], ["Email delivery", promotion.email_status || "PENDING"]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-muted/30 px-3 py-2"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-0.5 break-words font-medium">{value}</div></div>)}</div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Response</span><ResponseStatus response={promotion.employee_response} /><span className="ml-2 text-xs text-muted-foreground">Status</span><PromotionStatus status={promotion.status} /></div><div className="space-y-2 border-t pt-3"><div><b>Promotion basis</b><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{promotion.basis}</p></div>{promotion.internal_remarks && <div><b>Internal HR remarks</b><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{promotion.internal_remarks}</p></div>}</div></section>
    {promotion.letter_file_url && <a className="text-primary underline" href={promotion.letter_file_url} target="_blank" rel="noreferrer">Uploaded letter file</a>}
    {promotion.history?.flatMap((entry) => entry.action === "ISSUED" ? (entry.details?.attachments || []) : []).length > 0 && <section className="rounded-xl border p-4"><h3 className="mb-2 font-semibold">Files sent with the promotion</h3><div className="flex flex-wrap gap-2">{promotion.history.flatMap((entry) => entry.action === "ISSUED" ? (entry.details?.attachments || []) : []).map((file) => <button key={file.url} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs text-primary hover:bg-muted" onClick={() => promotionsApi.openQueryAttachment(promotion.id, file)}><FileText className="h-3.5 w-3.5" />{file.name}</button>)}</div></section>}
    <Button variant="outline" onClick={printLetter}><Printer className="h-4 w-4" /> Print / save letter as PDF</Button>
    {(promotion.employee_response === "ACCEPTED" || promotion.employee_response === "ACKNOWLEDGED" || promotion.status === "EFFECTIVE") && <Button variant="outline" disabled={resendLetterMutation.isPending} onClick={() => resendLetterMutation.mutate()}><Mail className="h-4 w-4" /> Resend letter to employee</Button>}
    <section className="space-y-3 rounded-xl border p-4"><div><h3 className="font-semibold">Query conversation</h3><p className="text-xs text-muted-foreground">Messages and attached files are included in email notifications.</p></div>{promotion.query_history?.length ? promotion.query_history.map((entry, i) => <article key={`${entry.at}-${i}`} className={`rounded-lg border p-3 ${entry.type === "QUERY" ? "border-amber-200 bg-amber-50/60" : "border-blue-200 bg-blue-50/60"}`}><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><b>{entry.type === "QUERY" ? "Employee query" : "HR reply"}</b><time className="text-xs text-muted-foreground">{entry.at ? new Date(entry.at).toLocaleString() : ""}</time></div><p className="whitespace-pre-wrap">{entry.description || entry.reply}</p>{entry.attachments?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{entry.attachments.map((file) => <button key={file.url} className="inline-flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs text-primary hover:bg-muted" onClick={() => promotionsApi.openQueryAttachment(promotion.id, file)}><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{file.name}</span></button>)}</div>}</article>) : <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">No queries or replies yet.</p>}{promotion.status === "QUERY_RAISED" && <div className="space-y-3 border-t pt-3"><Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Write a reply to the employee" /><label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"><Paperclip className="h-4 w-4" /> Attach files<input className="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setReplyFiles(Array.from(event.target.files || []).slice(0, 5))} /></label><p className="text-xs text-muted-foreground">PDF or image files, up to 5 files and 5 MB each.</p>{replyFiles.length > 0 && <div className="flex flex-wrap gap-2">{replyFiles.map((file) => <span key={`${file.name}-${file.size}`} className="rounded bg-muted px-2 py-1 text-xs">{file.name}</span>)}</div>}<Button disabled={!reply.trim() || replyMutation.isPending} onClick={async () => { try { const attachments = replyFiles.length ? (await promotionsApi.uploadQueryAttachments(promotion.id, replyFiles, true)).attachments : []; replyMutation.mutate({ reply, resolve: true, attachments }); } catch (error) { toast.error(error?.detail || error?.message || "Could not upload attachments"); } }}><MessageSquare className="h-4 w-4" /> Reply and resolve</Button></div>}</section>
    {!['EFFECTIVE', 'CANCELLED'].includes(promotion.status) && (editing ? <div className="grid gap-3 rounded border p-3"><b>Edit promotion details</b><div className="grid gap-2 sm:grid-cols-2"><Input value={revision.purpose} onChange={(e) => setRevision({ ...revision, purpose: e.target.value })} placeholder="Promotion type" /><Input value={revision.to_designation} onChange={(e) => setRevision({ ...revision, to_designation: e.target.value })} placeholder="New designation" /><Input value={revision.to_grade} onChange={(e) => setRevision({ ...revision, to_grade: e.target.value })} placeholder="New grade" /><Input type="number" value={revision.to_ctc} onChange={(e) => setRevision({ ...revision, to_ctc: e.target.value })} placeholder="Annual CTC" /><Input type="date" value={revision.effective_from} onChange={(e) => setRevision({ ...revision, effective_from: e.target.value })} /><select className="border-input bg-background h-10 rounded-md border px-3 text-sm" value={revision.new_department} onChange={(e) => setRevision({ ...revision, new_department: e.target.value })} disabled={departmentQuery.isLoading}><option value="">Keep current department</option>{departmentOptions.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.department_name}>{item.department_name}{item.department_code ? ` · ${item.department_code}` : ""}</option>)}</select></div>{departmentQuery.isError && <span className="text-destructive text-xs">Could not load departments: {departmentQuery.error?.detail || departmentQuery.error?.message}</span>}<Textarea rows={2} value={revision.basis} onChange={(e) => setRevision({ ...revision, basis: e.target.value })} placeholder="Promotion basis" /><Textarea rows={3} value={revision.letter_body} onChange={(e) => setRevision({ ...revision, letter_body: e.target.value })} placeholder="Promotion letter" /><div className="flex flex-wrap gap-2"><Button disabled={reviseMutation.isPending} onClick={() => reviseMutation.mutate({ ...revision, to_ctc: revision.to_ctc ? Number(revision.to_ctc) : null, new_department: revision.new_department || null })}><Pencil className="h-4 w-4" /> Save and reissue</Button><Button variant="outline" onClick={() => setEditing(false)}>Close editor</Button><Button variant="destructive" disabled={cancelMutation.isPending} onClick={() => { const reason = window.prompt("Reason for cancellation?"); if (reason?.trim()) cancelMutation.mutate({ reason }); }}><XCircle className="h-4 w-4" /> Cancel promotion</Button></div></div> : <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit promotion</Button>)}
    {promotion.history?.length > 0 && <div className="space-y-1 border-t pt-2"><b>Promotion history</b>{promotion.history.map((entry, i) => <p key={i} className="text-muted-foreground text-xs">{entry.at?.slice(0, 16)} · {entry.action} · {entry.note || ""}</p>)}</div>}
  </div>;
}
