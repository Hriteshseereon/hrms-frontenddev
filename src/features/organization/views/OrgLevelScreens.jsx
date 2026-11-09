// Organisation-level screens a Super Admin sees before opening a company: dashboard, reports, company modules.
// No X-Company-Id travels with these calls and no employee rows are shown — counts and aggregates only.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Building2, Loader2, Save, Users } from "lucide-react";
import { toast } from "sonner";
import Company_api from "@/api/company";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrgMode } from "@/features/auth/data/module-access";
import { useSessionStore } from "@/features/auth/data/session-store";
import { ModuleChooser } from "@/features/organization/components/ModuleChooser";
import { moduleLabel, optionalOf } from "@/config/modules";

const WorkspaceDashboard = lazy(() => import("@/features/dashboard/views/DashboardView"));
const WorkspaceReports = lazy(() => import("@/features/reports/views/ReportsView"));

const unwrap = (res) => res?.data?.data ?? res?.data ?? res;
const listOf = (res) => {
  const d = unwrap(res) ?? [];
  return Array.isArray(d) ? d : (d.items ?? d.companies ?? d.cards ?? []);
};
const num = (...v) => Number(v.find((x) => x !== undefined && x !== null) ?? 0) || 0;
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  return typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : fallback;
};

/** One row per company: GET /org/dashboard when the server has it, otherwise the company list counts. */
function useOrgCards() {
  const [state, setState] = useState({ loading: true, cards: [], error: "" });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      let rows;
      try {
        rows = listOf(await Company_api.getOrgDashboard());
      } catch (e) {
        if (![404, 405].includes(e?.response?.status)) throw e;
        rows = listOf(await Company_api.getCompanies());
      }
      const cards = rows.map((c) => {
        const total = num(c.employees, c.total_employees, c.employee_count, c.employees_count);
        const trend = (c.headcount_trend ?? c.trend ?? []).map((t) =>
          typeof t === "number" ? t : num(t?.count, t?.headcount, t?.value),
        );
        return {
          id: c.id ?? c.company_id,
          name: c.name ?? c.company_name ?? "Company",
          code: c.code ?? "",
          active: c.is_active === false || String(c.status ?? "").toLowerCase() === "inactive" ? false : true,
          employees: total,
          activeEmployees: num(c.active_employees, c.active, c.active_count, total),
          branches: num(c.branches, c.branch_count, c.branches_count),
          trend,
        };
      });
      setState({ loading: false, cards, error: "" });
    } catch (e) {
      setState({ loading: false, cards: [], error: errText(e, "Could not load the organisation data.") });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

function Sparkline({ values }) {
  if (!values?.length || values.length < 2) return <div className="text-muted-foreground text-[11px]">No trend yet</div>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-label="Headcount trend">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function State({ loading, error, empty, onRetry }) {
  if (loading)
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  if (error)
    return (
      <div className="text-destructive space-y-2 rounded-md border p-6 text-sm">
        {error}
        <div>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  if (empty)
    return <div className="text-muted-foreground rounded-md border p-8 text-center text-sm">No companies yet. Create one under Companies.</div>;
  return null;
}

function OrgDashboard() {
  const selectCompany = useSessionStore((s) => s.selectCompany);
  const { loading, error, cards, reload } = useOrgCards();
  const totals = useMemo(
    () => ({
      employees: cards.reduce((a, c) => a + c.employees, 0),
      active: cards.reduce((a, c) => a + c.activeEmployees, 0),
    }),
    [cards],
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Building2 className="text-primary h-6 w-6" /> Organisation Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Companies at a glance. Open a company to work with its employees, roles, masters, attendance and payroll.
        </p>
      </div>
      <State loading={loading} error={error} empty={!loading && !error && !cards.length} onRetry={reload} />
      {!loading && !error && cards.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Companies", cards.length],
              ["Employees", totals.employees],
              ["Active employees", totals.active],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <div className="text-muted-foreground text-xs">{label}</div>
                  <div className="text-3xl font-bold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate">{c.name}</span>
                    <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? "Active" : "Disabled"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xl font-semibold">{c.employees}</div>
                      <div className="text-muted-foreground text-[11px]">Employees</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold">{c.activeEmployees}</div>
                      <div className="text-muted-foreground text-[11px]">Active</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold">{c.branches}</div>
                      <div className="text-muted-foreground text-[11px]">Branches</div>
                    </div>
                  </div>
                  <Sparkline values={c.trend} />
                  <Button size="sm" variant="outline" className="w-full" disabled={!c.active} onClick={() => selectCompany(String(c.id), c.name)}>
                    Open company
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrgReports() {
  const { loading, error, cards, reload } = useOrgCards();
  const max = Math.max(1, ...cards.map((c) => c.employees));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="text-primary h-6 w-6" /> Reports &amp; Analytics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Aggregate numbers across companies. Employee-level reports live inside each company.
        </p>
      </div>
      <State loading={loading} error={error} empty={!loading && !error && !cards.length} onRetry={reload} />
      {!loading && !error && cards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Headcount by company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cards.map((c) => (
              <div key={c.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {c.activeEmployees} active / {c.employees} total
                  </span>
                </div>
                <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${(c.employees / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** /org/company-modules — core + optional modules per company. Saving replaces the optional set. */
function CompanyModules() {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // { id, name, saved, value, available, loading, saving }

  const load = useCallback(async () => {
    try {
      setError("");
      const rows = listOf(await Company_api.getCompanies());
      setCompanies(rows);
    } catch (e) {
      setError(errText(e, "Could not load companies."));
      setCompanies([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const open = async (c) => {
    setEditing({ id: c.id, name: c.name, saved: [], value: [], available: undefined, loading: true });
    try {
      const d = unwrap(await Company_api.getCompanyModules(c.id)) ?? {};
      const value = optionalOf(d.optional ?? d.optional_modules ?? d.enabled_modules);
      setEditing({
        id: c.id,
        name: c.name,
        saved: value,
        value,
        available: Array.isArray(d.available_optional) && d.available_optional.length ? d.available_optional : undefined,
        loading: false,
      });
    } catch (e) {
      toast.error(errText(e, "Could not load this company's modules."));
      setEditing(null);
    }
  };

  const save = async () => {
    const removed = editing.saved.filter((k) => !editing.value.includes(k));
    if (
      removed.length &&
      !window.confirm(
        `Turn off ${removed.map(moduleLabel).join(", ")} for ${editing.name}? Its users lose access immediately; the data is kept.`,
      )
    )
      return;
    setEditing((e) => ({ ...e, saving: true }));
    try {
      await Company_api.updateCompanyModules(editing.id, editing.value);
      toast.success(`Modules updated for ${editing.name}`);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(errText(e, "Could not update the modules."));
      setEditing((x) => ({ ...x, saving: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Boxes className="text-primary h-6 w-6" /> Company Modules
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Core modules are on for every company. Choose the optional ones each company can use.
        </p>
      </div>
      <State loading={companies === null} error={error} empty={companies?.length === 0 && !error} onRetry={load} />
      <div className="grid gap-4 lg:grid-cols-2">
        {(companies ?? []).map((c) => {
          const optional = optionalOf(c.optional_modules ?? c.enabled_modules ?? c.modules);
          const isOpen = editing?.id === c.id;
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="truncate">{c.name}</span>
                  {!isOpen && (
                    <Button size="sm" variant="outline" onClick={() => open(c)}>
                      Edit modules
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isOpen && (
                  <div className="flex flex-wrap gap-1">
                    {optional.length ? (
                      optional.map((k) => (
                        <Badge key={k} variant="secondary" className="font-normal">
                          {moduleLabel(k)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">Core modules only</span>
                    )}
                  </div>
                )}
                {isOpen &&
                  (editing.loading ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <>
                      <ModuleChooser
                        value={editing.value}
                        optional={editing.available}
                        onChange={(value) => setEditing((e) => ({ ...e, value }))}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" disabled={editing.saving} onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" disabled={editing.saving} onClick={save}>
                          {editing.saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                          Save modules
                        </Button>
                      </div>
                    </>
                  ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const Fallback = () => (
  <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
  </div>
);

/** /org/dashboard: organisation view for a Super Admin without a company, the workspace dashboard otherwise. */
export function DashboardRouter() {
  const orgMode = useOrgMode();
  return orgMode ? (
    <OrgDashboard />
  ) : (
    <Suspense fallback={<Fallback />}>
      <WorkspaceDashboard />
    </Suspense>
  );
}

/** /org/reports: aggregates in organisation mode, the full report studio inside a company. */
export function ReportsRouter() {
  const orgMode = useOrgMode();
  return orgMode ? (
    <OrgReports />
  ) : (
    <Suspense fallback={<Fallback />}>
      <WorkspaceReports />
    </Suspense>
  );
}

export default CompanyModules;
