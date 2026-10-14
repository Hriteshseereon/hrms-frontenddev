// Super Admin → Organisation Setup: the guided setup of the whole organisation, owned by the Super Admin.
//   1. Organisation type  — group of companies or individual company, structure, industry template;
//   2. Modules & features — what the organisation uses (screens, tabs and actions switchable later too);
//   3. Organisation details — profile, GST, PAN, address, contact (only the name is required);
//   4. Structure — companies and branches (existing ones are kept; new ones are created on Apply);
//   5. Review & apply.
// Day-to-day structure changes (admins, single branches) live in Companies & Branches; fine-grained switches in
// Configuration. This wizard is the one place that sets up or reshapes the organisation as a whole.
import { useMemo, useState } from "react";
import { useRouter } from "@/lib/router";
import Link from "@/lib/router";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Landmark,
  Layers,
  Network,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EntitlementTree } from "@/features/platform/components/EntitlementTree";
import {
  ORG_TYPE_TEMPLATES,
  STRUCTURES,
  orgTypeByKey,
  structureByKey,
} from "@/features/platform/data/feature-catalog";
import {
  companiesOf,
  setupOrganisation,
  useCurrentTenant,
} from "@/features/organization/data/tenancy";
import { useOrgs, visibleBranches } from "@/features/organization/data/group-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";

const STEPS = [
  "Organisation type",
  "Modules & features",
  "Organisation details",
  "Structure",
  "Review & apply",
];

export default function OrganisationSetupView() {
  const me = useCurrentUser();
  const tenant = useCurrentTenant();
  const orgs = useOrgs();
  const router = useRouter();
  const companies = useMemo(() => (tenant ? companiesOf(tenant, orgs) : []), [tenant, orgs]);
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => ({
    kind: tenant?.kind ?? "group",
    structure: tenant?.structure ?? "group-companies-branches",
    orgType: tenant?.orgType ?? "general",
    name: tenant?.name ?? "",
    legalName: tenant?.legalName ?? "",
    gstin: tenant?.gstin ?? "",
    pan: tenant?.pan ?? "",
    address: tenant?.address ?? "",
    contactName: tenant?.contact?.name ?? "",
    contactEmail: tenant?.contact?.email ?? "",
    contactPhone: tenant?.contact?.phone ?? "",
    entitlements: {
      modules: [...(tenant?.entitlements.modules ?? [])],
      off: [...(tenant?.entitlements.off ?? [])],
    },
    companies: companies.map((o) => ({
      existing: true,
      name: o.name,
      code: o.code,
      city: o.city ?? "",
      state: o.state ?? "",
      gstin: o.gstin ?? "",
      branches: visibleBranches(o).map((b) => ({ existing: true, name: b.name, city: b.city })),
    })),
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  if (!tenant || me.role !== "SuperAdmin") return null;

  const struct = structureByKey(f.structure);
  const withCompanies = f.kind === "group";
  const withBranches = !!struct?.branches;

  const applyTemplate = (key) => {
    const t = orgTypeByKey(key);
    setF((p) => ({ ...p, orgType: key, entitlements: { modules: [...t.modules], off: [] } }));
    toast.success(`${t.name} template applied — ${t.modules.length} modules pre-selected`);
  };

  const next = () => {
    if (step === 2 && !f.name.trim()) return toast.error("Give the organisation a name");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const apply = () => {
    const r = setupOrganisation({
      kind: f.kind,
      structure: f.structure,
      orgType: f.orgType,
      name: f.name,
      legalName: f.legalName,
      gstin: f.gstin,
      pan: f.pan,
      address: f.address,
      contact: { name: f.contactName, email: f.contactEmail, phone: f.contactPhone },
      entitlements: f.entitlements,
      companies: withCompanies
        ? f.companies
        : [
            {
              name: f.name,
              branches: withBranches ? (f.companies[0]?.branches ?? []) : [],
            },
          ],
    });
    if (!r.ok) return toast.error(r.message);
    toast.success("Organisation setup applied");
    router.push("/org/groups");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings2 className="text-primary h-6 w-6" /> Organisation Setup
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Set up {tenant.name} end to end — structure, modules, details, companies and branches.
          Existing companies, branches and their data are never removed from here.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              i === step
                ? "border-primary bg-primary/10 text-primary"
                : i < step
                  ? "border-primary/30 text-primary hover:bg-primary/5"
                  : "border-border text-muted-foreground",
            )}
          >
            {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}.</span>} {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="text-sm font-semibold">What is this organisation?</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    kind: "group",
                    icon: Network,
                    t: "Group of companies",
                    d: "Several legal entities under one group — each with its own payroll and statutory registrations.",
                  },
                  {
                    kind: "company",
                    icon: Building2,
                    t: "Individual company",
                    d: "One legal entity — with branches, or everyone at the head office.",
                  },
                ].map((x) => (
                  <button
                    key={x.kind}
                    type="button"
                    onClick={() => {
                      const first = STRUCTURES.find((s) => s.kind === x.kind);
                      setF((p) => ({
                        ...p,
                        kind: x.kind,
                        structure:
                          structureByKey(p.structure)?.kind === x.kind ? p.structure : first.key,
                      }));
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      f.kind === x.kind
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <x.icon
                      className={cn(
                        "mb-2 h-5 w-5",
                        f.kind === x.kind ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <div className="text-sm font-semibold">{x.t}</div>
                    <div className="text-muted-foreground mt-1 text-xs">{x.d}</div>
                  </button>
                ))}
              </div>
              <div className="text-sm font-semibold">Structure</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {STRUCTURES.filter((s) => s.kind === f.kind).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => set("structure", s.key)}
                    data-testid={`structure-${s.key}`}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      f.structure === s.key
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {s.branches ? (
                        <GitBranch className="text-primary h-4 w-4" />
                      ) : (
                        <Landmark className="text-primary h-4 w-4" />
                      )}
                      {s.name}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">{s.description}</div>
                  </button>
                ))}
              </div>
              <div className="text-muted-foreground text-xs">
                The structure is not a straitjacket: a company without branches can add them later,
                and an individual company that adds a second company becomes a group automatically.
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="text-sm font-semibold">Organisation type</div>
              <div className="text-muted-foreground text-xs">
                The industry template pre-selects modules — refine them in the next step.
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ORG_TYPE_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t.key)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      f.orgType === t.key
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {t.description}
                    </div>
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      {t.modules.length} modules
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && (
        <Card className="shadow-card">
          <CardContent className="p-5">
            <EntitlementTree
              mode="ceiling"
              draft={f.entitlements}
              onDraft={(ent) => set("entitlements", ent)}
            />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="shadow-card">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Organisation / group name *</Label>
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Legal name</Label>
              <Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GST No.</Label>
              <Input
                value={f.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                placeholder="21AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">PAN</Label>
              <Input value={f.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Registered address</Label>
              <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Primary contact</Label>
              <Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact e-mail</Label>
              <Input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact phone</Label>
              <Input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
            </div>
            <div className="text-muted-foreground text-xs sm:col-span-2">
              Only the name is required — everything else can be completed later from this screen.
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <StructureStep
          f={f}
          setF={setF}
          withCompanies={withCompanies}
          withBranches={withBranches}
        />
      )}

      {step === 4 && (
        <Card className="shadow-card">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Organisation", `${f.name || "—"} (${f.kind === "group" ? "group" : "company"})`],
                ["Structure", structureByKey(f.structure)?.name],
                ["Organisation type", orgTypeByKey(f.orgType)?.name],
                ["Modules", `${f.entitlements.modules.length} + core platform`],
                ["GST / PAN", [f.gstin, f.pan].filter(Boolean).join(" · ") || "—"],
                ["Contact", [f.contactName, f.contactEmail].filter(Boolean).join(" · ") || "—"],
              ].map(([k, v]) => (
                <div key={k} className="border-border rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">{k}</div>
                  <div className="mt-0.5 text-sm font-medium">{v}</div>
                </div>
              ))}
            </div>
            {withCompanies && (
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Companies
                </div>
                {f.companies
                  .filter((c) => c.name.trim())
                  .map((c, i) => (
                    <div
                      key={i}
                      className="border-border flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                    >
                      <Building2 className="text-primary h-3.5 w-3.5" />
                      <span className="font-medium">{c.name}</span>
                      {c.existing ? (
                        <Badge variant="outline" className="text-[10px]">
                          exists
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gold/40 text-gold text-[10px]">
                          new
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {withBranches
                          ? `${c.branches.filter((b) => b.name.trim()).length} branches`
                          : "no branches (head office)"}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <div className="border-gold/40 bg-gold/10 rounded-lg border p-3 text-xs">
              Apply updates the organisation profile and module selection, and creates any companies
              or branches that do not exist yet. Nothing is removed. Administrators and employees
              are added afterwards in Companies &amp; Branches and Employees.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="text-muted-foreground hidden text-xs sm:block">
          Step {step + 1} of {STEPS.length} ·{" "}
          <Link href="/org/groups" className="hover:text-primary underline">
            Companies & Branches
          </Link>{" "}
          ·{" "}
          <Link href="/org/configuration" className="hover:text-primary underline">
            Configuration
          </Link>
        </div>
        {step < STEPS.length - 1 ? (
          <Button
            className="bg-gradient-emerald text-white"
            onClick={next}
            data-testid="setup-next"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="bg-gradient-emerald text-white"
            onClick={apply}
            data-testid="setup-apply"
          >
            <Layers className="h-4 w-4" /> Apply setup
          </Button>
        )}
      </div>
    </div>
  );
}

function StructureStep({ f, setF, withCompanies, withBranches }) {
  const setCompany = (i, patch) =>
    setF((p) => ({
      ...p,
      companies: p.companies.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));

  if (!withCompanies && !withBranches)
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-5 text-sm">
          {f.name || "The company"} keeps everyone at the head office — there is nothing to add
          here. Employees are placed automatically; add branches later from Companies &amp; Branches
          if that changes.
        </CardContent>
      </Card>
    );

  if (!withCompanies)
    return (
      <Card className="shadow-card">
        <CardContent className="space-y-3 p-5">
          <div className="text-sm font-semibold">Branches of {f.name || "the company"}</div>
          <BranchListEditor
            branches={f.companies[0]?.branches ?? []}
            onChange={(branches) =>
              setF((p) => ({
                ...p,
                companies: p.companies.length
                  ? p.companies.map((c, j) => (j === 0 ? { ...c, branches } : c))
                  : [{ name: f.name, branches }],
              }))
            }
          />
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      {f.companies.map((c, i) => (
        <Card key={i} className="shadow-card">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="text-primary h-4 w-4" />
              <div className="text-sm font-semibold">
                {c.existing ? c.name : `New company ${i + 1}`}
              </div>
              {c.existing ? (
                <Badge variant="outline" className="text-[10px]">
                  exists — details managed in Companies & Branches
                </Badge>
              ) : (
                <button
                  type="button"
                  aria-label="Remove company"
                  className="text-muted-foreground hover:text-destructive ml-auto"
                  onClick={() =>
                    setF((p) => ({ ...p, companies: p.companies.filter((_, j) => j !== i) }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {!c.existing && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Company name *</Label>
                  <Input value={c.name} onChange={(e) => setCompany(i, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Code</Label>
                  <Input
                    value={c.code}
                    onChange={(e) => setCompany(i, { code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Input value={c.city} onChange={(e) => setCompany(i, { city: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GST No.</Label>
                  <Input
                    value={c.gstin}
                    onChange={(e) => setCompany(i, { gstin: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            )}
            {withBranches && (
              <BranchListEditor
                branches={c.branches}
                companyCity={c.city}
                onChange={(branches) => setCompany(i, { branches })}
              />
            )}
          </CardContent>
        </Card>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          setF((p) => ({
            ...p,
            companies: [
              ...p.companies,
              { existing: false, name: "", code: "", city: "", state: "", gstin: "", branches: [] },
            ],
          }))
        }
        data-testid="setup-add-company"
      >
        <Plus className="h-4 w-4" /> Add company
      </Button>
    </div>
  );
}

function BranchListEditor({ branches, onChange, companyCity = "" }) {
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Branches
      </div>
      {branches.map((b, i) =>
        b.existing ? (
          <div
            key={i}
            className="border-border flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
          >
            <GitBranch className="text-primary h-3.5 w-3.5" />
            <span className="font-medium">{b.name}</span>
            {b.city && <span className="text-muted-foreground">{b.city}</span>}
            <Badge variant="outline" className="ml-auto text-[10px]">
              exists
            </Badge>
          </div>
        ) : (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="h-9"
              placeholder="Branch name"
              value={b.name}
              onChange={(e) =>
                onChange(branches.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
            <Input
              className="h-9"
              placeholder={companyCity ? `City (default: ${companyCity})` : "City"}
              value={b.city ?? ""}
              onChange={(e) =>
                onChange(branches.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))
              }
            />
            <button
              type="button"
              aria-label="Remove branch"
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => onChange(branches.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...branches, { existing: false, name: "", city: "" }])}
      >
        <Plus className="h-3.5 w-3.5" /> Branch
      </Button>
      <div className="text-muted-foreground text-xs">
        A branch left without a city uses the company&apos;s own location.
      </div>
    </div>
  );
}
