import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Repeat, Send, UserRoundCheck, X, Paperclip, FileText } from "lucide-react";
import { EmployeeCases } from "@/features/employees/components/EmployeeCases";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import * as promotionsApi from "@/services/api/endpoints/promotions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const money = (value) => value == null ? "Not specified" : `₹${Number(value).toLocaleString("en-IN")}`;
const terminal = (promotion) => ["EFFECTIVE", "CANCELLED"].includes(promotion.status);
const acceptedResponse = (promotion) => ["ACCEPTED", "ACKNOWLEDGED"].includes(promotion.employee_response);
const promotionStatusColor = { EFFECTIVE: "border-emerald-300 bg-emerald-50 text-emerald-800", CANCELLED: "border-rose-300 bg-rose-50 text-rose-800", QUERY_RAISED: "border-amber-300 bg-amber-50 text-amber-900", QUERY_RESOLVED: "border-cyan-300 bg-cyan-50 text-cyan-900", SCHEDULED: "border-violet-300 bg-violet-50 text-violet-800", SENT_TO_EMPLOYEE: "border-blue-300 bg-blue-50 text-blue-800" };
function PromotionStatus({ status }) {
  return <Badge variant="outline" className={promotionStatusColor[status?.toUpperCase()] || "border-slate-300 bg-slate-100 text-slate-700"}>{status?.replaceAll("_", " ") || "Pending"}</Badge>;
}

function MyPromotions({ employeeKey }) {
  const query = useApiQuery(["promotions", "mine", employeeKey], (options) => promotionsApi.myPromotions(options));
  const [drafts, setDrafts] = useState({});
  const [queryFiles, setQueryFiles] = useState({});
  const [queryFor, setQueryFor] = useState(null);
  const refresh = () => query.refetch();
  const ack = useApiMutation((id) => promotionsApi.acknowledgeMyPromotion(id), {
    invalidate: [["promotions", "mine", employeeKey]], onSuccess: (data) => { toast[data?.email_status === "LETTER_SENT" ? "success" : "warning"](data?.email_status === "LETTER_SENT" ? "Promotion accepted and letter emailed to you" : "Promotion accepted; letter email needs attention"); refresh(); },
  });
  const ask = useApiMutation(({ id, description, attachments }) => promotionsApi.queryMyPromotion(id, { description, attachments }), {
    invalidate: [["promotions", "mine", employeeKey]], onSuccess: (data, variables) => { toast[data?.email_status === "SENT" ? "success" : "warning"](data?.email_status === "SENT" ? "Query sent to HR and email notification accepted" : "Query saved, but email delivery failed"); setDrafts((previous) => ({ ...previous, [variables.id]: "" })); setQueryFiles((previous) => ({ ...previous, [variables.id]: [] })); setQueryFor(null); refresh(); },
  });
  const items = query.data ?? [];

  return <section className="space-y-4">
    <div>
      <h2 className="text-xl font-semibold">My Promotions <Badge variant="outline" className="ml-1">{items.length}</Badge></h2>
      <p className="text-muted-foreground mt-1 text-sm">Review your promotion, respond to HR, and follow the effective-date and payroll updates here.</p>
    </div>
    {query.isLoading ? <Card><CardContent className="p-5 text-sm">Loading promotions…</CardContent></Card>
      : query.isError ? <Card><CardContent className="text-destructive p-5 text-sm">Could not load promotions: {query.error?.detail || query.error?.message}</CardContent></Card>
      : items.length === 0 ? <Card><CardContent className="text-muted-foreground p-5 text-sm">No promotions have been issued to you.</CardContent></Card>
      : items.map((item) => {
        const closed = terminal(item);
        const draft = drafts[item.id] || "";
        const files = queryFiles[item.id] || [];
        const accepted = acceptedResponse(item);
        const queryPending = item.status === "QUERY_RAISED";
        const latestMessage = item.query_history?.at(-1);
        return <Card key={item.id} className="shadow-card"><CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="font-mono text-xs text-muted-foreground">{item.id} · Revision {item.revision || 1}</div><div className="mt-1 text-lg font-semibold">{item.from_designation || "Current designation"} → {item.to_designation}</div><div className="text-sm text-muted-foreground">{item.purpose} · Effective {item.effective_from}</div></div>
            <PromotionStatus status={queryPending ? "QUERY_RAISED" : item.status} />
          </div>

          <div className="grid gap-3 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-3">
            <div><div className="text-muted-foreground text-xs">New pay grade</div><b>{item.to_grade || "No change"}</b></div>
            <div><div className="text-muted-foreground text-xs">New annual CTC</div><b>{money(item.to_ctc)}</b></div>
            <div><div className="text-muted-foreground text-xs">Your response</div><b className={accepted ? "text-emerald-700" : queryPending ? "text-amber-800" : "text-orange-700"}>{accepted ? "Accepted" : queryPending ? "Query sent to HR" : "Please respond"}</b></div>
          </div>

          <div className={`rounded-lg p-3 text-sm ${queryPending ? "bg-amber-50 text-amber-900" : accepted ? item.status === "EFFECTIVE" ? "bg-emerald-50 text-emerald-900" : "bg-blue-50 text-blue-900" : "bg-orange-50 text-orange-900"}`}>
            {queryPending ? "Your query is with HR. We’ll show the reply here." : accepted ? item.status === "EFFECTIVE" ? "Promotion is effective. Your profile and salary records have been updated." : `Accepted. Profile and payroll update on ${item.effective_from}.` : "Choose Accept promotion or Raise a query."}
          </div>

          <details className="rounded-lg border px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Promotion letter, supporting files and query conversation</summary><div className="mt-3 space-y-3"><p><b>Reason: </b>{item.basis}</p>{item.letter_body && <div className="whitespace-pre-wrap rounded bg-muted/30 p-3">{item.letter_body}</div>}{item.letter_file_url && <a className="text-primary underline" href={item.letter_file_url} target="_blank" rel="noreferrer">Open attached letter</a>}{item.history?.flatMap((entry) => entry.action === "ISSUED" ? (entry.details?.attachments || []) : []).map((file) => <button key={file.url} className="mr-2 inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs text-primary" onClick={() => promotionsApi.openQueryAttachment(item.id, file)}><FileText className="h-3.5 w-3.5" />{file.name}</button>)}{item.query_history?.map((entry, index) => <div key={`${entry.at}-${index}`} className={`rounded-lg border p-3 ${entry.type === "QUERY" ? "border-amber-200 bg-amber-50/60" : "border-blue-200 bg-blue-50/60"}`}><div className="mb-1 text-xs font-medium text-muted-foreground">{entry.type === "QUERY" ? "Your query" : "HR response"} · {entry.at ? new Date(entry.at).toLocaleString() : ""}</div><p className="whitespace-pre-wrap">{entry.description || entry.reply}</p>{entry.attachments?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{entry.attachments.map((file) => <button key={file.url} className="inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs text-primary" onClick={() => promotionsApi.openQueryAttachment(item.id, file)}><FileText className="h-3.5 w-3.5" />{file.name}</button>)}</div>}</div>)}{item.history?.some((entry) => entry.action === "REVISED") && <p className="text-cyan-800">HR revised this promotion. You are viewing revision {item.revision || 1}.</p>}</div></details>

          {item.email_status && <div className={`rounded-lg p-3 text-sm ${["SENT", "LETTER_SENT"].includes(item.email_status) ? "bg-emerald-50 text-emerald-800" : ["FAILED", "LETTER_FAILED"].includes(item.email_status) ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>{item.email_status === "LETTER_SENT" ? "Promotion letter emailed to your registered addresses." : item.email_status === "LETTER_FAILED" ? "Promotion letter email failed. Your letter is available above; HR can resend it." : item.email_status === "SENT" ? "Promotion email notification was accepted by the mail server." : item.email_status === "FAILED" ? "Promotion email could not be delivered. Please contact HR to confirm your email address." : "No successful employee email is recorded yet. HR can check the address and mail settings."}</div>}
          {!closed && <div className="space-y-3 border-t pt-4">
            {!accepted && !queryPending && <div className="flex flex-wrap gap-3"><Button disabled={ack.isPending} onClick={() => ack.mutate(item.id)}><UserRoundCheck className="h-4 w-4" /> Accept promotion</Button><Button variant="outline" onClick={() => setQueryFor(queryFor === item.id ? null : item.id)}><MessageSquare className="h-4 w-4" /> Raise a query</Button></div>}
            {queryPending && latestMessage && <div className="rounded border border-amber-200 p-3 text-sm"><b>Your query:</b> {latestMessage.description}</div>}
            {queryFor === item.id && !accepted && !queryPending && <div className="space-y-3 rounded-lg border bg-muted/20 p-4"><div><label className="text-sm font-medium" htmlFor={`promotion-query-${item.id}`}>What would you like HR to review?</label><Textarea id={`promotion-query-${item.id}`} className="mt-2" rows={3} value={draft} onChange={(event) => setDrafts((previous) => ({ ...previous, [item.id]: event.target.value }))} placeholder="Describe the issue or requested correction" /></div><label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"><Paperclip className="h-4 w-4" /> Attach files<input className="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setQueryFiles((previous) => ({ ...previous, [item.id]: Array.from(event.target.files || []).slice(0, 5) }))} /></label><p className="text-xs text-muted-foreground">PDF or image files, up to 5 files and 5 MB each.</p>{files.length > 0 && <div className="flex flex-wrap gap-2">{files.map((file) => <span key={`${file.name}-${file.size}`} className="rounded bg-background px-2 py-1 text-xs">{file.name}</span>)}</div>}<div className="flex gap-2"><Button disabled={!draft.trim() || ask.isPending} onClick={async () => { try { const attachments = files.length ? (await promotionsApi.uploadQueryAttachments(item.id, files)).attachments : []; ask.mutate({ id: item.id, description: draft.trim(), attachments }); } catch (error) { toast.error(error?.detail || error?.message || "Could not upload attachments"); } }}><Send className="h-4 w-4" /> Submit query to HR</Button><Button variant="ghost" onClick={() => { setQueryFor(null); setQueryFiles((previous) => ({ ...previous, [item.id]: [] })); }}><X className="h-4 w-4" /> Cancel</Button></div></div>}
          </div>}
          {closed && item.status === "CANCELLED" && <p className="text-destructive text-sm">This promotion was cancelled. Contact HR if you need more information.</p>}
        </CardContent></Card>;
      })}
  </section>;
}

function EmpMovements() {
  const me = useCurrentEmployee();
  return <div className="space-y-6">
    <MyPromotions employeeKey={me.id} />
    <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Repeat className="text-primary h-6 w-6" /> My Movements &amp; Letters</h1><p className="text-muted-foreground mt-1 text-sm">Your promotion letters, transfers, warnings, and other employee movement records are available below.</p></div>
    <EmployeeCases empId={me.id} mode="self" />
  </div>;
}

export default EmpMovements;
