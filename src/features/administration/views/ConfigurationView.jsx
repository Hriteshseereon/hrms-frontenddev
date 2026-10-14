// Super Admin → Configuration: everything the organisation switches on or off, in one place.
//   • Modules & features — organisation-wide, or narrowed per company / per branch;
//   • Master data sharing (groups) — one copy of a master for every company, or one per company.
// What the organisation uses at all (module selection, structure, profile) lives in Organisation Setup.
import { useMemo, useState } from "react";
import { Building2, GitBranch, Globe2, Settings2, SlidersHorizontal } from "lucide-react";
import Link from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { EntitlementTree } from "@/features/platform/components/EntitlementTree";
import { MasterSharingPanel } from "@/features/administration/components/MasterSharingPanel";
import {
  companiesOf,
  structureByKeyName,
  useCurrentTenant,
} from "@/features/organization/data/tenancy";
import { visibleBranches, useOrgs } from "@/features/organization/data/group-data";
import { orgTypeByKey } from "@/features/platform/data/feature-catalog";

export default function ConfigurationView() {
  const tenant = useCurrentTenant();
  const orgs = useOrgs();
  const [scopeId, setScopeId] = useState("org");
  const companies = useMemo(() => (tenant ? companiesOf(tenant, orgs) : []), [tenant, orgs]);
  if (!tenant) return null;
  const isGroup = tenant.kind === "group";

  const scopeLabel =
    scopeId === "org"
      ? "the whole organisation"
      : (() => {
          for (const o of companies) {
            if (o.id === scopeId) return `${o.name} (company)`;
            const b = (o.branches ?? []).find((x) => x.id === scopeId);
            if (b) return `${o.name} › ${b.name} (branch)`;
          }
          return "the whole organisation";
        })();

  const overridden = Object.entries(tenant.scopeConfig ?? {}).filter(([, v]) => v?.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <SlidersHorizontal className="text-primary h-6 w-6" /> Configuration
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {tenant.name} · {structureByKeyName(tenant.structure)} ·{" "}
            {orgTypeByKey(tenant.orgType)?.name}. Switch screens, tabs and actions off — for
            everyone, or for one company or branch.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/org/organisation-setup">
            <Settings2 className="h-4 w-4" /> Organisation Setup
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="modules">
        <ScrollTabsList>
          <TabsTrigger value="modules">Modules & features</TabsTrigger>
          {isGroup && <TabsTrigger value="masters">Master data sharing</TabsTrigger>}
        </ScrollTabsList>

        <TabsContent value="modules" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">Applies to</div>
                <Select value={scopeId} onValueChange={setScopeId}>
                  <SelectTrigger className="h-9 w-full sm:w-80" aria-label="Configuration scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">
                      <span className="flex items-center gap-2">
                        <Globe2 className="text-primary h-4 w-4" /> Entire organisation
                      </span>
                    </SelectItem>
                    {companies.map((o) => (
                      <SelectGroup key={o.id}>
                        <SelectLabel className="text-muted-foreground text-[11px] uppercase">
                          {o.name}
                        </SelectLabel>
                        <SelectItem value={o.id}>
                          <span className="flex items-center gap-2">
                            <Building2 className="text-primary h-4 w-4" /> {o.name} — whole company
                          </span>
                        </SelectItem>
                        {visibleBranches(o).map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <span className="flex items-center gap-2 pl-4">
                              <GitBranch className="text-muted-foreground h-3.5 w-3.5" /> {b.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-[11px]">
                  Editing: {scopeLabel}
                </Badge>
              </div>
              <EntitlementTree
                tenant={tenant}
                mode="config"
                scopeId={scopeId === "org" ? null : scopeId}
              />
              {overridden.length > 0 && scopeId === "org" && (
                <div className="border-border text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
                  Company / branch overrides active:{" "}
                  {overridden
                    .map(([id, keys]) => {
                      const o = companies.find((c) => c.id === id);
                      const b = companies
                        .flatMap((c) => (c.branches ?? []).map((x) => ({ ...x, company: c.name })))
                        .find((x) => x.id === id);
                      const name = o ? o.name : b ? `${b.company} › ${b.name}` : id;
                      return `${name} (${keys.length} off)`;
                    })
                    .join(" · ")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isGroup && (
          <TabsContent value="masters" className="pt-4">
            <MasterSharingPanel tenant={tenant} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
