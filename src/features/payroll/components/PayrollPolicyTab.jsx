// Per-company wage rules and statutory settings: GET / PUT /payroll/policy.
// The screen shows what is saved as tables; Edit / Add open a form. Only an admin can save (others get 403).
// PUT merges, so each form sends only its own section. Rule errors come back as a plain string, field errors as a list.
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { payrollRunApi, detailText } from "@/api/payrollRunApi";
import { useSessionStore } from "@/features/auth/data/session-store";

const inr = (n) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const str = (v) => (v === null || v === undefined ? "" : String(v));
const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);

const WAGE_NUMBERS = [
  { key: "ot_multiplier", label: "Overtime multiplier", hint: "0 to 10. 0 pays no overtime.", min: 0, max: 10, step: "any", show: (v) => (v === 0 ? "No overtime" : `${v}× hourly rate`) },
  { key: "std_days_per_month", label: "Standard days per month", hint: "Whole number 1 to 31. Used by the salary preview only.", min: 1, max: 31, step: 1, show: (v) => `${v} days` },
  { key: "std_shift_hours", label: "Standard shift hours", hint: "Overtime divisor when an employee has no shift (above 0, up to 24).", min: 0.01, max: 24, step: "any", show: (v) => `${v} hours` },
];
const WAGE_TOGGLES = [
  { key: "weekly_off_paid", label: "Weekly offs are paid", hint: "Daily workers are paid for weekly offs." },
  { key: "paid_holidays_paid", label: "Paid holidays are paid", hint: "Daily workers are paid for holidays." },
];
// What a level can require. The server accepts exactly these three.
const LEVEL_PERMISSIONS = [
  { value: "payroll.run", label: "Prepare — payroll.run", who: "HR Manager, Payroll Admin" },
  { value: "payroll.approve", label: "Approve — payroll.approve", who: "Finance Manager" },
  { value: "payroll.process", label: "Process & pay — payroll.process", who: "Finance Manager" },
];
const permissionLabel = (v) => LEVEL_PERMISSIONS.find((p) => p.value === v) ?? { label: v, who: "" };

const RATES = [
  { key: "pf_rate", label: "PF rate", hint: "% of the PF wage, employee and employer.", show: pct },
  { key: "pf_wage_cap", label: "PF wage cap", hint: "The PF wage is the earned basic, up to this amount.", show: inr },
  { key: "esi_rate", label: "ESI rate — employee", hint: "% of the earned gross.", show: pct },
  { key: "esi_employer_rate", label: "ESI rate — employer", hint: "% of the earned gross.", show: pct },
  { key: "esi_gross_limit", label: "ESI gross limit", hint: "ESI applies while the monthly gross is at or below this.", show: inr },
];

/** A message when the slab rows break the server's rules (rising "up to", no limit only on the last row). */
function slabError(rows) {
  if (!rows.length) return "Add at least one slab.";
  let last = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const { upto, amount } = rows[i];
    const isLast = i === rows.length - 1;
    if (amount === "" || Number(amount) < 0) return `Slab ${i + 1}: enter the tax amount (0 or more).`;
    if (upto === "") {
      if (!isLast) return `Slab ${i + 1}: only the last slab can have no upper limit.`;
    } else {
      if (Number(upto) <= last) return `Slab ${i + 1}: "up to" must be higher than the previous slab.`;
      last = Number(upto);
    }
  }
  return "";
}
const rowsToSlabs = (rows) =>
  rows.map((r, i) => ({
    upto: i === rows.length - 1 && r.upto === "" ? null : Number(r.upto),
    amount: Number(r.amount || 0),
  }));
const slabsToRows = (slabs) => (slabs ?? []).map((s) => ({ upto: str(s.upto), amount: str(s.amount) }));

function SlabSummary({ slabs }) {
  return (
    <div className="space-y-0.5">
      {(slabs ?? []).map((s, i) => (
        <div key={i} className="text-xs">
          {s.upto === null || s.upto === undefined ? "Above that" : `Up to ${inr(s.upto)}`}
          {" → "}
          <span className="font-medium">{inr(s.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function SlabForm({ rows, onChange }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground grid grid-cols-[1fr_1fr_2rem] gap-2 text-[11px] font-semibold uppercase">
        <span>Monthly gross up to (₹)</span>
        <span>Tax (₹)</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder={i === rows.length - 1 ? "No limit" : "e.g. 15000"}
            value={r.upto}
            onChange={(e) => set(i, { upto: e.target.value })}
            aria-label="Gross up to"
          />
          <Input type="number" min={0} placeholder="e.g. 200" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} aria-label="Tax amount" />
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={rows.length < 2} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove slab">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onChange([...rows, { upto: "", amount: "" }])}>
        <Plus className="h-3.5 w-3.5" /> Add slab
      </Button>
      <div className="text-muted-foreground text-[11px]">
        Slabs rise by gross. Leave the last &quot;up to&quot; empty for no upper limit.
      </div>
    </div>
  );
}

function FormDialog({ title, description, onClose, onSave, saving, disabled, children }) {
  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || disabled}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <Card className="shadow-card overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

const TH = "p-3 text-left";

export function PayrollPolicyTab() {
  const role = useSessionStore((s) => String(s.role ?? "").toUpperCase());
  const isAdmin = ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(role);
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // { kind: "wage" | "statutory" | "pt", ... }
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError("");
    payrollRunApi
      .getPolicy()
      .then(setPolicy)
      .catch((e) => setError(detailText(e, "Could not load the payroll policy.")));
  }, []);
  useEffect(load, [load]);

  /** Sends one section and closes the form on success; the server's message stays visible on failure. */
  const save = async (body, okMessage) => {
    setSaving(true);
    try {
      setPolicy(await payrollRunApi.updatePolicy(body));
      setDialog(null);
      toast.success(okMessage);
      return true;
    } catch (e) {
      toast.error(e?.response?.status === 403 ? "Only an admin can change the payroll policy." : detailText(e, "Could not save the policy."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (error)
    return (
      <div className="text-destructive space-y-2 rounded-md border p-6 text-sm">
        {error}
        <div>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      </div>
    );
  if (!policy)
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );

  const st = policy.statutory ?? {};
  const byState = Object.entries(st.pt_slabs_by_state ?? {});
  const editBtn = (kind, label = "Edit") =>
    isAdmin && (
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setDialog({ kind })}>
        <Pencil className="h-3.5 w-3.5" /> {label}
      </Button>
    );

  return (
    <div className="space-y-5">
      {!isAdmin && (
        <div className="text-muted-foreground rounded-md border p-3 text-xs">You can view the policy. Only an admin can change it.</div>
      )}

      <SectionCard
        title="Approval workflow"
        subtitle="Who must sign a payroll run, in order, before it can be processed."
        action={editBtn("approval")}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th className={TH}>Level</th>
              <th className={TH}>Name</th>
              <th className={TH}>Needs permission</th>
              <th className={`${TH} hidden md:table-cell`}>Usually held by</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(policy.approval_levels ?? []).map((lv) => (
              <tr key={lv.level_no}>
                <td className="p-3 font-medium tabular-nums">{lv.level_no}</td>
                <td className="p-3">{lv.name}</td>
                <td className="p-3">
                  <Badge variant="secondary">{permissionLabel(lv.permission).label}</Badge>
                </td>
                <td className="text-muted-foreground hidden p-3 text-xs md:table-cell">{permissionLabel(lv.permission).who}</td>
              </tr>
            ))}
            <tr>
              <td className="p-3 font-medium" colSpan={2}>
                Preparer cannot approve (maker–checker)
              </td>
              <td className="p-3" colSpan={2}>
                <Badge variant={policy.enforce_maker_checker !== false ? "secondary" : "outline"}>
                  {policy.enforce_maker_checker !== false ? "On" : "Off"}
                </Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Wage rules" subtitle="How Daily-wage workers are paid, and the defaults the salary preview uses." action={editBtn("wage")}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th className={TH}>Rule</th>
              <th className={TH}>Value</th>
              <th className={`${TH} hidden md:table-cell`}>What it does</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {WAGE_NUMBERS.map((f) => (
              <tr key={f.key}>
                <td className="p-3 font-medium">{f.label}</td>
                <td className="p-3 tabular-nums">{policy[f.key] === null || policy[f.key] === undefined ? "—" : f.show(policy[f.key])}</td>
                <td className="text-muted-foreground hidden p-3 text-xs md:table-cell">{f.hint}</td>
              </tr>
            ))}
            <tr>
              <td className="p-3 font-medium">Minimum daily wage</td>
              <td className="p-3 tabular-nums">{policy.minimum_daily_wage === null || policy.minimum_daily_wage === undefined ? "Not set" : inr(policy.minimum_daily_wage)}</td>
              <td className="text-muted-foreground hidden p-3 text-xs md:table-cell">A Daily rate below this raises a payroll warning.</td>
            </tr>
            {WAGE_TOGGLES.map((f) => (
              <tr key={f.key}>
                <td className="p-3 font-medium">{f.label}</td>
                <td className="p-3">
                  <Badge variant={policy[f.key] !== false ? "secondary" : "outline"}>{policy[f.key] !== false ? "Yes" : "No"}</Badge>
                </td>
                <td className="text-muted-foreground hidden p-3 text-xs md:table-cell">{f.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Statutory settings" subtitle="PF and ESI rates and limits for this company." action={editBtn("statutory")}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th className={TH}>Setting</th>
              <th className={TH}>Value</th>
              <th className={`${TH} hidden md:table-cell`}>What it does</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {RATES.map((f) => (
              <tr key={f.key}>
                <td className="p-3 font-medium">{f.label}</td>
                <td className="p-3 tabular-nums">{f.show(st[f.key])}</td>
                <td className="text-muted-foreground hidden p-3 text-xs md:table-cell">{f.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        title="Professional tax"
        subtitle="An employee's PT state picks the slabs. No state, or a state not listed here, uses the default slabs."
        action={
          isAdmin && (
            <Button size="sm" className="gap-1" onClick={() => setDialog({ kind: "pt", mode: "add" })}>
              <Plus className="h-3.5 w-3.5" /> Add state
            </Button>
          )
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              <th className={TH}>State</th>
              <th className={TH}>Slabs (monthly gross → tax)</th>
              <th className="p-3 text-right">{isAdmin ? "Actions" : ""}</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            <tr>
              <td className="p-3 align-top">
                <div className="font-medium">Default</div>
                <div className="text-muted-foreground text-xs">No state, or a state not listed</div>
              </td>
              <td className="p-3">
                <SlabSummary slabs={st.pt_slabs} />
              </td>
              <td className="p-3 text-right align-top">
                {isAdmin && (
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => setDialog({ kind: "pt", mode: "default" })}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </td>
            </tr>
            {byState.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted-foreground p-5 text-center text-xs">
                  No state-specific slabs yet. The default slabs apply to every employee.
                </td>
              </tr>
            )}
            {byState.map(([state, slabs]) => (
              <tr key={state}>
                <td className="p-3 align-top font-medium">{state}</td>
                <td className="p-3">
                  <SlabSummary slabs={slabs} />
                </td>
                <td className="p-3 text-right align-top">
                  {isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setDialog({ kind: "pt", mode: "edit", state })}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive gap-1"
                        disabled={saving}
                        onClick={() => {
                          if (!window.confirm(`Remove the ${state} slabs? Employees in ${state} will use the default slabs.`)) return;
                          const rest = Object.fromEntries(byState.filter(([s]) => s !== state));
                          save({ statutory: { pt_slabs_by_state: rest } }, `${state} slabs removed`);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {dialog?.kind === "approval" && <ApprovalDialog policy={policy} saving={saving} onClose={() => setDialog(null)} onSave={save} />}
      {dialog?.kind === "wage" && <WageDialog policy={policy} saving={saving} onClose={() => setDialog(null)} onSave={save} />}
      {dialog?.kind === "statutory" && <StatutoryDialog statutory={st} saving={saving} onClose={() => setDialog(null)} onSave={save} />}
      {dialog?.kind === "pt" && (
        <PtDialog
          mode={dialog.mode}
          state={dialog.state}
          statutory={st}
          saving={saving}
          onClose={() => setDialog(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function WageDialog({ policy, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nums: Object.fromEntries(WAGE_NUMBERS.map((f) => [f.key, str(policy[f.key])])),
    toggles: Object.fromEntries(WAGE_TOGGLES.map((f) => [f.key, policy[f.key] !== false])),
    minimum: str(policy.minimum_daily_wage),
  }));
  const submit = () => {
    const body = {};
    WAGE_NUMBERS.forEach(({ key }) => {
      if (form.nums[key] !== str(policy[key]) && form.nums[key] !== "") body[key] = Number(form.nums[key]);
    });
    WAGE_TOGGLES.forEach(({ key }) => {
      if (form.toggles[key] !== (policy[key] !== false)) body[key] = form.toggles[key];
    });
    if (form.minimum !== str(policy.minimum_daily_wage)) body.minimum_daily_wage = form.minimum === "" ? null : Number(form.minimum);
    if (!Object.keys(body).length) return onClose();
    onSave(body, "Wage rules saved");
  };
  return (
    <FormDialog title="Edit wage rules" description="Applies to the next payroll run and the salary preview." onClose={onClose} onSave={submit} saving={saving}>
      {WAGE_NUMBERS.map((f) => (
        <label key={f.key} className="block space-y-1 text-xs">
          <span className="font-medium">{f.label}</span>
          <Input type="number" min={f.min} max={f.max} step={f.step} value={form.nums[f.key]} onChange={(e) => setForm((x) => ({ ...x, nums: { ...x.nums, [f.key]: e.target.value } }))} />
          <span className="text-muted-foreground block text-[11px]">{f.hint}</span>
        </label>
      ))}
      <label className="block space-y-1 text-xs">
        <span className="font-medium">Minimum daily wage (₹)</span>
        <Input type="number" min={0} step="any" placeholder="Not set" value={form.minimum} onChange={(e) => setForm((x) => ({ ...x, minimum: e.target.value }))} />
        <span className="text-muted-foreground block text-[11px]">A Daily rate below this raises a payroll warning. Empty clears it.</span>
      </label>
      {WAGE_TOGGLES.map((f) => (
        <div key={f.key} className="flex items-center gap-3 text-sm">
          <Switch checked={form.toggles[f.key]} onCheckedChange={(v) => setForm((x) => ({ ...x, toggles: { ...x.toggles, [f.key]: v } }))} aria-label={f.label} />
          <div>
            <div className="font-medium">{f.label}</div>
            <div className="text-muted-foreground text-[11px]">{f.hint}</div>
          </div>
        </div>
      ))}
    </FormDialog>
  );
}

function StatutoryDialog({ statutory, saving, onClose, onSave }) {
  const [vals, setVals] = useState(() => Object.fromEntries(RATES.map((f) => [f.key, str(statutory[f.key])])));
  const submit = () => {
    const body = {};
    RATES.forEach(({ key }) => {
      if (vals[key] !== str(statutory[key]) && vals[key] !== "") body[key] = Number(vals[key]);
    });
    if (!Object.keys(body).length) return onClose();
    onSave({ statutory: body }, "Statutory settings saved");
  };
  return (
    <FormDialog title="Edit statutory settings" description="PF and ESI rates and limits for this company." onClose={onClose} onSave={submit} saving={saving}>
      {RATES.map((f) => (
        <label key={f.key} className="block space-y-1 text-xs">
          <span className="font-medium">{f.label}</span>
          <Input type="number" min={0} step="any" value={vals[f.key]} onChange={(e) => setVals((x) => ({ ...x, [f.key]: e.target.value }))} />
          <span className="text-muted-foreground block text-[11px]">{f.hint}</span>
        </label>
      ))}
    </FormDialog>
  );
}

function PtDialog({ mode, state, statutory, saving, onClose, onSave }) {
  const isDefault = mode === "default";
  const byState = statutory.pt_slabs_by_state ?? {};
  const [name, setName] = useState(mode === "edit" ? state : "");
  const [rows, setRows] = useState(() =>
    isDefault ? slabsToRows(statutory.pt_slabs) : mode === "edit" ? slabsToRows(byState[state]) : [{ upto: "", amount: "" }],
  );
  const trimmed = name.trim();
  const clash = !isDefault && trimmed && trimmed.toLowerCase() !== (state ?? "").toLowerCase() &&
    Object.keys(byState).some((s) => s.toLowerCase() === trimmed.toLowerCase());
  const problem = (!isDefault && !trimmed ? "Enter the state name." : "") || (clash ? `${trimmed} already has slabs. Edit that row instead.` : "") || slabError(rows);

  const submit = () => {
    if (problem) return toast.error(problem);
    const slabs = rowsToSlabs(rows);
    if (isDefault) return onSave({ statutory: { pt_slabs: slabs } }, "Default slabs saved");
    // pt_slabs_by_state is replaced as a whole, so send the full map with this state added, changed or renamed.
    const next = Object.fromEntries(Object.entries(byState).filter(([s]) => s !== state));
    next[trimmed] = slabs;
    onSave({ statutory: { pt_slabs_by_state: next } }, `${trimmed} slabs saved`);
  };

  return (
    <FormDialog
      title={isDefault ? "Edit default slabs" : mode === "edit" ? `Edit ${state} slabs` : "Add a state"}
      description={isDefault ? "Used when an employee has no PT state, or a state that is not listed." : "Use the same state name you type in the employee's Professional tax state field."}
      onClose={onClose}
      onSave={submit}
      saving={saving}
    >
      {!isDefault && (
        <label className="block space-y-1 text-xs">
          <span className="font-medium">State name</span>
          <Input value={name} placeholder="e.g. Odisha" onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <SlabForm rows={rows} onChange={setRows} />
      {problem && (trimmed || isDefault || rows.some((r) => r.upto !== "" || r.amount !== "")) && (
        <div className="text-destructive text-xs">{problem}</div>
      )}
    </FormDialog>
  );
}

function ApprovalDialog({ policy, saving, onClose, onSave }) {
  const [levels, setLevels] = useState(() =>
    (policy.approval_levels ?? []).map((lv) => ({ name: lv.name ?? "", permission: lv.permission ?? "payroll.approve" })),
  );
  const [makerChecker, setMakerChecker] = useState(policy.enforce_maker_checker !== false);
  const set = (i, patch) => setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i, d) =>
    setLevels((ls) => {
      const j = i + d;
      if (j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const problem = !levels.length
    ? "Add at least one level."
    : levels.some((l) => !l.name.trim())
      ? "Give every level a name."
      : "";

  const submit = () => {
    if (problem) return toast.error(problem);
    // Levels are numbered by their position here: 1, 2, 3 ... without gaps, as the server requires.
    onSave(
      {
        approval_levels: levels.map((l, i) => ({ level_no: i + 1, name: l.name.trim(), permission: l.permission })),
        enforce_maker_checker: makerChecker,
      },
      "Approval workflow saved",
    );
  };

  return (
    <FormDialog
      title="Edit approval workflow"
      description="Levels are signed in order. A run already waiting for approval follows the new levels straight away."
      onClose={onClose}
      onSave={submit}
      saving={saving}
    >
      <div className="space-y-2">
        {levels.map((l, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="bg-muted grid h-7 w-7 place-items-center rounded-full text-xs font-semibold">{i + 1}</span>
              <Input className="h-9" placeholder="Level name, e.g. Finance" value={l.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Level name" />
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === levels.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={levels.length < 2} onClick={() => setLevels((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove level">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <select
              value={l.permission}
              onChange={(e) => set(i, { permission: e.target.value })}
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              aria-label="Required permission"
            >
              {LEVEL_PERMISSIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} ({p.who})
                </option>
              ))}
            </select>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setLevels((ls) => [...ls, { name: "", permission: "payroll.approve" }])}>
          <Plus className="h-3.5 w-3.5" /> Add level
        </Button>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Switch checked={makerChecker} onCheckedChange={setMakerChecker} aria-label="Preparer cannot approve" />
        <div>
          <div className="font-medium">Preparer cannot approve</div>
          <div className="text-muted-foreground text-[11px]">The person who prepared a run cannot sign any level of it.</div>
        </div>
      </div>
      {problem && <div className="text-destructive text-xs">{problem}</div>}
    </FormDialog>
  );
}
