// One tree for every configuration layer (all owned by the organisation's Super Admin):
//   mode="ceiling" — Organisation Setup: the modules, screens, features and actions the organisation uses;
//   mode="config"  — Configuration: switch anything inside that selection off — organisation-wide, or (with
//   `scopeId`) for one company or one branch only.
// Locked nodes (dashboard, configuration, users & roles) are always on so nobody can lock themselves out.
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CATALOG_MODULES, featuresOf, isLockedKey } from "@/features/platform/data/feature-catalog";
import {
  ceilingAllows,
  isEnabled,
  isEnabledAt,
  setCeiling,
  setConfig,
  setScopeConfig,
} from "@/features/organization/data/tenancy";

const ACTION_LABELS = {
  "employee.manage": "Create & edit employees",
  "recruitment.manage": "Manage recruitment",
  "attendance.lock": "Lock attendance period",
  "payroll.manage": "Manage payroll set-up",
  "payroll.run": "Create payroll run",
  "payroll.approve": "Approve payroll run",
  "payroll.process": "Process & pay payroll",
  "statutory.configure": "Configure statutory rules",
  "filing.generate": "Generate statutory filings",
  "filing.verify": "Verify filings",
  "filing.approve": "Approve filings",
  "filing.file": "Mark filings as filed",
  "contribution.approve": "Approve contributions",
  "finance.manage": "Manage claims & expenditure",
  "performance.manage": "Manage reviews & appraisals",
  "goal.create": "Create goals",
  "task.assign": "Assign tasks",
  "asset.manage": "Manage asset register",
  "asset.issue": "Issue assets",
  "asset.request": "Request assets",
  "asset.approve": "Approve asset requests",
  "tour.submit": "Submit tours",
  "tour.hod.decide": "HOD tour decision",
  "tour.hr.decide": "HR tour decision",
  "tour.finance.decide": "Finance tour decision",
  "tour.viewAll": "View all tours",
  "compoff.redeem": "Redeem comp-off",
  "compoff.hod.decide": "HOD comp-off decision",
  "compoff.viewAll": "View all comp-off",
  "exit.submit": "Submit resignation",
  "exit.manager.decide": "Manager exit decision",
  "exit.hr.clearance": "Exit clearance",
  "exit.hr.approve": "HR exit approval",
  "exit.notice.configure": "Configure notice periods",
  "exit.complete": "Complete separation",
  "exit.viewAll": "View all exits",
  "role.manage": "Manage roles",
  "department.manage": "Manage departments",
  "group.manage": "Manage companies & branches",
};

/** Pure version of setCeiling for a draft (the setup wizard edits a copy until Apply). */
export function toggleDraft(ent, key, on) {
  if (isLockedKey(key)) return ent;
  if (key.startsWith("m:")) {
    const m = key.slice(2);
    return {
      ...ent,
      modules: on ? [...new Set([...ent.modules, m])] : ent.modules.filter((x) => x !== m),
    };
  }
  const off = ent.off ?? [];
  return { ...ent, off: on ? off.filter((k) => k !== key) : [...new Set([...off, key])] };
}

/**
 * @param {{ tenant?: Tenant, mode: "ceiling" | "config", readOnly?: boolean,
 *   draft?: { modules: string[], off: string[] }, onDraft?: (ent) => void }} props
 */
export function EntitlementTree({
  tenant: liveTenant,
  mode,
  scopeId = null,
  readOnly = false,
  draft,
  onDraft,
}) {
  const tenant = draft ? { entitlements: draft, config: { off: [] } } : liveTenant;
  const [open, setOpen] = useState({});
  const [q, setQ] = useState("");
  const ceiling = mode === "ceiling";

  const state = (key) => {
    if (isLockedKey(key)) return { on: true, locked: true, why: "Always on" };
    if (ceiling) {
      if (key.startsWith("m:"))
        return { on: tenant.entitlements.modules.includes(key.slice(2)), locked: false };
      const on = !(tenant.entitlements.off ?? []).includes(key);
      return { on, locked: false, parentOff: !ceilingAllows(tenant, key) && on };
    }
    if (!ceilingAllows(tenant, key)) {
      const own = key.startsWith("m:")
        ? !tenant.entitlements.modules.includes(key.slice(2))
        : (tenant.entitlements.off ?? []).includes(key);
      return {
        on: false,
        locked: true,
        why: own ? "Off in Organisation Setup" : "Parent off in Organisation Setup",
      };
    }
    if (scopeId) {
      // Company / branch layer: organisation-wide switches are locked here; this layer only narrows further.
      if (!isEnabled(tenant, key)) return { on: false, locked: true, why: "Off organisation-wide" };
      const own = !(tenant.scopeConfig?.[scopeId] ?? []).includes(key);
      return { on: own, locked: false, parentOff: own && !isEnabledAt(tenant, key, [scopeId]) };
    }
    const own = !(tenant.config?.off ?? []).includes(key);
    return { on: own, locked: false, parentOff: own && !isEnabled(tenant, key) };
  };
  const toggle = (key, on) => {
    if (readOnly) return;
    if (draft && onDraft) onDraft(toggleDraft(draft, key, on));
    else if (ceiling) setCeiling(tenant.id, key, on);
    else if (scopeId) setScopeConfig(tenant.id, scopeId, key, on);
    else setConfig(tenant.id, key, on);
  };

  const modules = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return CATALOG_MODULES;
    return CATALOG_MODULES.filter(
      (m) =>
        m.name.toLowerCase().includes(t) ||
        m.screens.some(
          (s) =>
            s.name.toLowerCase().includes(t) ||
            featuresOf(s.route).some((f) => f.label.toLowerCase().includes(t)),
        ),
    );
  }, [q]);

  const onCount = CATALOG_MODULES.filter((m) => state(`m:${m.key}`).on).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs">
          {onCount} of {CATALOG_MODULES.length} modules on ·{" "}
          {ceiling
            ? "Switching a module off removes it, its screens, tabs and actions for every user of the organisation."
            : scopeId
              ? "Switch anything off for this company or branch only. Items switched off organisation-wide are locked here."
              : "Switch anything off for the whole organisation. Items switched off in Organisation Setup are locked here."}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a module, screen or tab"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      {modules.map((m) => {
        const mk = `m:${m.key}`;
        const st = state(mk);
        const expanded = open[m.key] ?? !!q.trim();
        return (
          <div
            key={m.key}
            className={cn("border-border rounded-xl border", !st.on && "bg-muted/30")}
            data-testid={`ent-${m.key}`}
          >
            <div className="flex items-center gap-3 p-3">
              <button
                type="button"
                aria-label={expanded ? `Collapse ${m.name}` : `Expand ${m.name}`}
                className="hover:bg-muted grid h-7 w-7 shrink-0 place-items-center rounded-md"
                onClick={() => setOpen((p) => ({ ...p, [m.key]: !expanded }))}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {m.name}
                  {st.locked && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Lock className="h-3 w-3" /> {st.why}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground truncate text-xs">{m.description}</div>
              </div>
              <Switch
                checked={st.on}
                disabled={st.locked || readOnly}
                onCheckedChange={(v) => toggle(mk, v)}
                aria-label={`${m.name} module`}
              />
            </div>
            {expanded && (
              <div className="border-border space-y-2 border-t p-3 pl-6 sm:pl-12">
                {m.screens.map((s) => {
                  const sk = `s:${s.route}`;
                  const ss = state(sk);
                  const feats = featuresOf(s.route);
                  const dim = !st.on || ss.parentOff;
                  return (
                    <div key={s.route} className={cn("rounded-lg", dim && "opacity-60")}>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm">
                            {s.name}
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {s.route}
                            </span>
                            {ss.locked && ss.why === "Always on" && (
                              <Lock className="text-muted-foreground h-3 w-3" />
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={ss.on}
                          disabled={ss.locked || readOnly || !st.on}
                          onCheckedChange={(v) => toggle(sk, v)}
                          aria-label={`${s.name} screen`}
                          className="scale-90"
                        />
                      </div>
                      {feats.length > 0 && !isLockedKey(sk) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {feats.map((f) => {
                            const fk = `t:${s.route}#${f.value}`;
                            const fs = state(fk);
                            return (
                              <button
                                key={f.value}
                                type="button"
                                disabled={fs.locked || readOnly || !st.on || !ss.on}
                                onClick={() => toggle(fk, !fs.on)}
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px] transition disabled:cursor-not-allowed",
                                  fs.on
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground line-through",
                                )}
                                title={
                                  fs.locked
                                    ? fs.why
                                    : fs.on
                                      ? "Click to switch off"
                                      : "Click to switch on"
                                }
                              >
                                {f.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {m.actions.length > 0 && (
                  <div className="pt-1">
                    <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                      Actions
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.actions.map((a) => {
                        const ak = `a:${a}`;
                        const as = state(ak);
                        return (
                          <button
                            key={a}
                            type="button"
                            disabled={as.locked || readOnly || !st.on}
                            onClick={() => toggle(ak, !as.on)}
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-[11px] transition disabled:cursor-not-allowed",
                              as.on
                                ? "border-gold/40 bg-gold/10"
                                : "border-border text-muted-foreground line-through",
                            )}
                            title={a}
                          >
                            {ACTION_LABELS[a] ?? a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
