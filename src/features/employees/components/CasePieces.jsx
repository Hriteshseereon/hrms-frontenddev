// Shared building blocks for the enterprise People cases (promotions, transfers, terminations, warnings, referrals).
import { useMemo, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Paperclip, X, History, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDirectory } from "@/features/employees/data/employee-directory";
import {} from "@/features/organization/data/group-data";
import { caseTone } from "@/features/employees/data/people-cases";
import { cn } from "@/lib/utils";
import { useScopeMatch } from "@/features/organization/data/tenancy";

export function Field({ label, children, required, hint, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-muted-foreground text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ n, title, sub }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="bg-primary/10 text-primary grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {sub && <div className="text-muted-foreground text-[11px]">{sub}</div>}
      </div>
    </div>
  );
}

export const StatusBadge = ({ status }) => (
  <Badge variant="outline" className={caseTone(status)}>
    {status}
  </Badge>
);

/** Employees visible in the current tenant scope (entity, or whole group for a Super Admin in group view). */
export function useScopedEmployees() {
  const dir = useDirectory();
  const inScope = useScopeMatch();
  // Group view = every entity of the Super Admin's own group (it used to be the whole directory, i.e. every group).
  return useMemo(() => dir.filter((e) => inScope(e.orgId, null, e.branch)), [dir, inScope]);
}

/** Set of employee IDs in the current scope — used to scope case lists per entity / group. */
export function useScopedIds() {
  const list = useScopedEmployees();
  return useMemo(() => new Set(list.map((e) => e.id)), [list]);
}

/** Searchable employee select. */
export function EmployeePicker({
  value,
  onChange,
  placeholder = "Search employee by name / ID / department…",
  exclude,
}) {
  const list = useScopedEmployees();
  const [q, setQ] = useState("");
  const rows = list
    .filter(
      (e) =>
        !exclude?.includes(e.id) &&
        (!q ||
          [e.name, e.id, e.dept, e.role, e.branch]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .slice(0, 40);
  const chosen = list.find((e) => e.id === value);
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      <Select
        value={value}
        onValueChange={(v) =>
          onChange(
            v,
            list.find((e) => e.id === v),
          )
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Select employee" />
        </SelectTrigger>
        <SelectContent>
          {rows.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name} · {e.id} · {e.dept} · {e.role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chosen && (
        <div className="border-border bg-muted/40 grid grid-cols-1 gap-1 rounded-lg border p-2 text-xs sm:grid-cols-4">
          <span>
            <b>ID</b> {chosen.id}
          </span>
          <span>
            <b>Dept</b> {chosen.dept}
          </span>
          <span>
            <b>Designation</b> {chosen.role}
          </span>
          <span>
            <b>Branch</b> {chosen.branch}
          </span>
        </div>
      )}
    </div>
  );
}

/** File names only (UI-only build) with remove chips. */
export function AttachmentsInput({ value, onChange, label = "Attachments", hint }) {
  return (
    <Field
      label={label}
      hint={hint ?? "PDF / DOCX / images · file names are recorded in this UI-only build"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="border-border hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs">
          <Paperclip className="h-3.5 w-3.5" /> Add file
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              captureFiles(e.target.files);
              const names = Array.from(e.target.files ?? []).map((f) => f.name);
              if (names.length) onChange(Array.from(new Set([...value, ...names])));
              /* same file twice → duplicate React keys */ e.currentTarget.value = "";
            }}
          />
        </label>
        {value.map((f) => (
          <Badge key={f} variant="outline" className="gap-1 font-normal">
            {f}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== f))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </Field>
  );
}

export function ApprovalTrail({ approvals, steps }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {steps.map((s) => {
        const a = approvals.find((x) => x.step === s);
        return (
          <div
            key={s}
            className={cn(
              "rounded-lg border p-2 text-xs",
              a
                ? a.decision === "Approved"
                  ? "border-primary/30 bg-primary/5"
                  : "border-destructive/30 bg-destructive/5"
                : "border-border border-dashed",
            )}
          >
            <div className="flex items-center gap-1 font-medium">
              {a ? (
                a.decision === "Approved" ? (
                  <CheckCircle2 className="text-primary h-3.5 w-3.5" />
                ) : (
                  <XCircle className="text-destructive h-3.5 w-3.5" />
                )
              ) : null}
              {s}
            </div>
            {a ? (
              <div className="text-muted-foreground">
                {a.decision} · {a.by} · {a.on}
                {a.note ? ` — ${a.note}` : ""}
              </div>
            ) : (
              <div className="text-muted-foreground">Pending</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HistoryTrail({ history }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs font-semibold">
        <History className="h-3.5 w-3.5" /> History
      </div>
      <ul className="text-muted-foreground space-y-1 text-xs">
        {history.map((h, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-20 shrink-0 tabular-nums">{h.at}</span>
            <span className="w-28 shrink-0 truncate">{h.by}</span>
            <span>{h.action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KV({ items, cols = 2 }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-1.5 text-sm", cols === 2 && "sm:grid-cols-2")}>
      {items.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt
            className={cn(
              "text-muted-foreground shrink-0 pt-0.5 text-xs",
              cols === 2 ? "w-40" : "w-36",
            )}
          >
            {k}
          </dt>
          <dd className="min-w-0 flex-1 break-words">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Toolbar({ q, setQ, placeholder, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="max-w-sm"
      />
      {children}
    </div>
  );
}

export function EmptyRow({ cols, text }) {
  return (
    <tr>
      <td colSpan={cols} className="text-muted-foreground p-6 text-center text-sm">
        {text}
      </td>
    </tr>
  );
}

export { Button };
