// Org Admin: Company Group structure — groups, org assignment, per-entity
// branding and the cross-org group employee directory.
import { useMemo, useState } from "react";

import { Network, Plus, Building2, Palette, Users, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGroups,
  useOrgs,
  addGroup,
  removeGroup,
  assignOrgToGroup,
  addOrg,
  addBranch,
  removeBranch,
  groupDirectory,
  computeGratuity,
  groupsStore,
  orgsStore,
} from "@/features/organization/data/group-data";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useResolvedBrand, setOrgBrand } from "@/features/administration/data/brand-config";
import { exportReportPdf } from "@/lib/export-utils";
import { provisionEntityAdmin } from "@/features/auth/data/tenant-users";
import { useCurrentUser, userByLogin } from "@/features/auth/data/auth-session";
import { TenantStructure } from "@/features/organization/components/TenantStructure";
import { branchInUse, useCurrentTenant } from "@/features/organization/data/tenancy";

export function GroupsWorkspace() {
  const me = useCurrentUser();
  const allGroups = useGroups();
  const allOrgs = useOrgs();
  // Scope: everyone works inside the organisation's own group.
  const isPlatform = false; // single-organisation build — there is no separate platform console
  const tenant = useCurrentTenant();
  // Only the group head (Super Admin) changes the group structure. Admin / CEO have "*" navigation and
  // could previously create entities, issue Admin logins, delete sibling entities' branches and re-assign entities.
  const isGroupHead = me.role === "SuperAdmin";
  // A company Admin is locked to their own company (brief: Admin sees only that company) — never the whole group.
  const entityOnly = me.role === "Admin";
  const canEditBranches = (orgId) => isGroupHead || (entityOnly && orgId === me.orgId);
  const myGroupId = me.groupId ?? allOrgs.find((o) => o.id === me.orgId)?.groupId ?? null;
  const groups = useMemo(
    () => (myGroupId ? allGroups.filter((g) => g.id === myGroupId) : isPlatform ? allGroups : []),
    [allGroups, myGroupId, isPlatform],
  );
  const orgs = useMemo(
    () =>
      isPlatform
        ? allOrgs
        : entityOnly || !myGroupId
          ? allOrgs.filter((o) => o.id === me.orgId)
          : allOrgs.filter((o) => o.groupId === myGroupId || o.id === me.orgId),
    [allOrgs, myGroupId, isPlatform, entityOnly, me.orgId],
  );
  const standalone = orgs.filter((o) => !o.groupId || !groups.some((g) => g.id === o.groupId));
  const [pickedGroup, setActiveGroup] = useState(myGroupId ?? allGroups[0]?.id ?? "");
  // Fall back to an in-scope group (the initial pick could be another client's group, or stale after a group is created).
  const activeGroup = groups.some((g) => g.id === pickedGroup)
    ? pickedGroup
    : (groups[0]?.id ?? "");
  const [tenureDetail, setTenureDetail] = useState(null);
  // Admin: only people currently employed by their own company. Others: the whole group (in their scope).
  const directoryRows = activeGroup
    ? groupDirectory(activeGroup).filter(
        (r) => !entityOnly || r.records.some((x) => x.current && x.orgId === me.orgId),
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Network className="text-primary h-6 w-6" /> Companies &amp; Branches
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your organisation&apos;s companies, branches and their administrators. Gratuity tenure
            and long-service recognition follow the group joining date.
          </p>
        </div>
        {isPlatform && <NewGroupDialog />}
      </div>

      <Tabs defaultValue="structure">
        <ScrollTabsList>
          <TabsTrigger value="structure">Structure &amp; admins</TabsTrigger>
          <TabsTrigger value="branding">Entity Branding</TabsTrigger>
          <TabsTrigger value="directory">Group Directory</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="structure" className="space-y-4 pt-4">
          {/* Client workspace: the organisation's own structure — companies, branches and their administrators. */}
          {!isPlatform && tenant && (
            <TenantStructure
              tenant={tenant}
              canManage={isGroupHead || entityOnly}
              limitToOrgId={entityOnly ? me.orgId : undefined}
              actor={me.name}
            />
          )}
          {isPlatform &&
            groups.map((g) => {
              const members = orgs.filter((o) => o.groupId === g.id);
              return (
                <Card key={g.id} className="shadow-card">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{g.name}</span>
                          <Badge variant="outline">{g.code}</Badge>
                          <Badge variant="outline">{members.length} entities</Badge>
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          {g.holdingEntity} · {g.country} · since{" "}
                          <span className="whitespace-nowrap">{g.createdOn}</span>
                        </div>
                        <div className="mt-2 max-w-2xl text-sm">{g.notes}</div>
                      </div>
                      <div className="flex gap-2">
                        {isGroupHead && (
                          <NewEntityDialog
                            groupId={g.id}
                            groupName={g.name}
                            parentOrgId={me.orgId}
                          />
                        )}
                        {isPlatform && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            title="Remove group"
                            onClick={() => {
                              if (
                                !window.confirm(`Remove ${g.name}? Its entities become standalone.`)
                              )
                                return;
                              removeGroup(g.id);
                              toast.success("Group removed");
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {members.map((o) => (
                        <div key={o.id} className="border-border rounded-lg border p-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Building2 className="text-primary h-4 w-4" /> {o.name}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            {o.industry} · {o.employees} employees · {o.status}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {o.modules.slice(0, 5).map((m) => (
                              <Badge key={m} variant="outline" className="text-[10px]">
                                {m}
                              </Badge>
                            ))}
                            {o.modules.length > 5 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{o.modules.length - 5}
                              </Badge>
                            )}
                          </div>
                          <BranchList
                            orgId={o.id}
                            branches={o.branches ?? []}
                            editable={canEditBranches(o.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          {/* A "single company" client (no group yet) previously saw nothing here: no entity, no branches, no way to add
               an entity although onboarding promised "entities can still be added later". */}
          {isPlatform && standalone.length > 0 && (
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      Standalone {standalone.length === 1 ? "company" : "companies"}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      Not part of a company group.
                      {isGroupHead && !isPlatform
                        ? " Adding an entity creates your group and places this company in it."
                        : ""}
                    </div>
                  </div>
                  {isGroupHead && !isPlatform && (
                    <NewEntityDialog
                      groupId={null}
                      groupName={standalone[0].name}
                      parentOrgId={me.orgId}
                    />
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {standalone.map((o) => (
                    <div key={o.id} className="border-border rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Building2 className="text-primary h-4 w-4" /> {o.name}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {o.industry} · {o.employees} employees · {o.status}
                      </div>
                      <BranchList
                        orgId={o.id}
                        branches={o.branches ?? []}
                        editable={canEditBranches(o.id)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {isPlatform && (
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="mb-3 font-semibold">Assign organisations to a group</div>
                <div className="space-y-2">
                  {orgs.map((o) => (
                    <div
                      key={o.id}
                      className="border-border flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-48">
                        <div className="text-sm font-medium">{o.name}</div>
                        <div className="text-muted-foreground text-xs">{o.legalName}</div>
                      </div>
                      <Select
                        value={o.groupId ?? "none"}
                        onValueChange={(v) => {
                          assignOrgToGroup(o.id, v === "none" ? null : v);
                          toast.success(`${o.name} updated`);
                        }}
                      >
                        <SelectTrigger className="ml-auto w-full sm:w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No group (standalone)</SelectItem>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="branding" className="pt-4">
          <BrandingPanel orgs={orgs} canEdit={(id) => canEditBranches(id)} />
        </TabsContent>

        <TabsContent value="directory" className="pt-4">
          <Card className="shadow-card">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Users className="text-primary h-4 w-4" /> Group employee directory
                  </div>
                  <div className="text-muted-foreground text-xs">
                    One row per person across every entity in the group — Org Admin & CXO only.
                  </div>
                </div>
                <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
                  <Select value={activeGroup} onValueChange={setActiveGroup}>
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const rows = directoryRows;
                      exportReportPdf({
                        title: "Group Employee Directory",
                        subtitle: groups.find((g) => g.id === activeGroup)?.name,
                        columns: [
                          "Employee",
                          "Group joining",
                          "Entities",
                          "Group tenure",
                          "Gratuity",
                        ],
                        rows: rows.map((r) => {
                          const g = computeGratuity(r.groupJoiningDate);
                          return [
                            r.name,
                            r.groupJoiningDate,
                            r.records.map((x) => x.orgId).join(", "),
                            `${g.years}y ${g.months}m`,
                            g.eligible ? "Vested" : "Accruing",
                          ];
                        }),
                      });
                    }}
                  >
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                      {[
                        "Employee",
                        "Group joining date",
                        "Employment records",
                        "Group tenure",
                        "Gratuity",
                      ].map((h) => (
                        <th key={h} className="py-2.5 pr-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {directoryRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-muted-foreground py-6 text-center text-xs">
                          No employees to show.
                        </td>
                      </tr>
                    )}
                    {directoryRows.map((r) => {
                      const grat = computeGratuity(r.groupJoiningDate);
                      return (
                        <tr
                          key={r.employeeId}
                          className={`border-border/60 border-b ${clickableRow}`}
                          onClick={() => setTenureDetail(r)}
                        >
                          <td className="py-2.5 pr-3">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-muted-foreground font-mono text-xs">
                              {r.employeeId}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="whitespace-nowrap">{r.groupJoiningDate}</span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="space-y-1">
                              {r.records.map((x, i) => (
                                <div key={i} className="text-xs">
                                  {x.orgId} · {x.designation} ·{" "}
                                  <span className="whitespace-nowrap">{x.joiningDate}</span>
                                  {x.current ? (
                                    <Badge variant="outline" className="ml-2 text-[10px]">
                                      Current
                                    </Badge>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            {grat.years}y {grat.months}m
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge
                              variant="outline"
                              className={
                                grat.eligible ? "bg-primary/10 text-primary border-primary/20" : ""
                              }
                            >
                              {grat.eligible ? "Vested" : "Accruing"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {tenureDetail &&
        (() => {
          const grat = computeGratuity(tenureDetail.groupJoiningDate);
          const orgName = (id) => orgs.find((o) => o.id === id)?.name ?? id;
          return (
            <RecordDetailDialog
              onClose={() => setTenureDetail(null)}
              title={tenureDetail.name}
              subtitle={`${tenureDetail.employeeId} · ${groups.find((g) => g.id === activeGroup)?.name ?? ""}`}
              badges={
                <Badge
                  variant="outline"
                  className={grat.eligible ? "bg-primary/10 text-primary border-primary/20" : ""}
                >
                  {grat.eligible ? "Gratuity vested" : "Gratuity accruing"}
                </Badge>
              }
              record={{
                name: tenureDetail.name,
                employeeId: tenureDetail.employeeId,
                groupJoiningDate: tenureDetail.groupJoiningDate,
                groupTenure: grat.tenureLabel,
                countedYears: grat.countedYears,
                lastDrawnBasic: grat.lastDrawnBasic,
                accrued: grat.accrued,
                nextMilestone: grat.nextMilestone,
                records: tenureDetail.records.map((x) => ({
                  entity: orgName(x.orgId),
                  designation: x.designation,
                  joiningDate: x.joiningDate,
                  current: x.current ? "Current" : "Prior",
                })),
              }}
              labels={{
                employeeId: "Employee ID",
                groupJoiningDate: "Group joining date",
                groupTenure: "Group tenure",
                countedYears: "Counted years (gratuity)",
                lastDrawnBasic: "Last drawn basic (monthly)",
                accrued: "Gratuity accrued",
                nextMilestone: "Next milestone",
                records: "Employment records",
              }}
              sections={[
                {
                  title: "Employee",
                  keys: ["name", "employeeId", "groupJoiningDate", "groupTenure"],
                },
                {
                  title: "Gratuity",
                  keys: ["countedYears", "lastDrawnBasic", "accrued", "nextMilestone"],
                },
                { title: "Employment records across the group", keys: ["records"] },
              ]}
            />
          );
        })()}
    </div>
  );
}

function BrandingPanel({ orgs, canEdit }) {
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const brand = useResolvedBrand(orgId);
  const editable = !!orgId && canEdit(orgId);

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Palette className="text-primary h-4 w-4" /> Entity branding
            </div>
            <div className="text-muted-foreground text-xs">
              Every payslip, letter and report generated inside this entity uses this brand.
            </div>
          </div>
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-border flex items-center gap-4 rounded-xl border p-4">
          <img
            src={brand.logo}
            alt={`${brand.name} logo`}
            className="h-14 w-14 rounded-lg bg-white object-contain"
          />
          <div>
            <div className="font-semibold">{brand.name}</div>
            <div className="text-muted-foreground text-xs">{brand.tagline}</div>
            <div className="text-muted-foreground mt-1 text-xs">{brand.address}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ["name", "Display name"],
            ["tagline", "Tagline"],
            ["logo", "Logo URL"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["website", "Website"],
            ["accent", "Accent colour"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{label}</Label>
              <Input
                value={brand[key]}
                readOnly={!editable}
                onChange={(e) => setOrgBrand(orgId, { [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Registered address</Label>
            <Textarea
              rows={2}
              value={brand.address}
              readOnly={!editable}
              onChange={(e) => setOrgBrand(orgId, { address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Document footer</Label>
            <Textarea
              rows={2}
              value={brand.footer}
              readOnly={!editable}
              onChange={(e) => setOrgBrand(orgId, { footer: e.target.value })}
            />
          </div>
        </div>
        {/* Changes apply as you type (persisted per entity); the button only confirms. */}
        {editable ? (
          <Button
            className="bg-gradient-emerald text-white"
            onClick={() => toast.success("Branding saved for this entity")}
          >
            Save branding
          </Button>
        ) : (
          <div className="text-muted-foreground text-xs">
            Read-only — branding is maintained by the group Super Admin or this company's Admin.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewGroupDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    code: "",
    holdingEntity: "",
    country: "India",
    notes: "",
  });
  const set = (p) => setF((v) => ({ ...v, ...p }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-emerald shadow-premium text-white">
          <Plus className="h-4 w-4" /> New Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create company group</DialogTitle>
          <DialogDescription>
            Group the legal entities your organisation operates.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {[
            ["name", "Group name"],
            ["code", "Group code"],
            ["holdingEntity", "Holding entity"],
            ["country", "Country"],
          ].map(([k, l]) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{l}</Label>
              <Input value={f[k]} onChange={(e) => set({ [k]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Notes</Label>
            <Textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!f.name.trim() || !f.code.trim()}
            className="bg-gradient-emerald text-white"
            onClick={() => {
              if (
                groupsStore.get().some((g) => g.code.toLowerCase() === f.code.trim().toLowerCase())
              ) {
                toast.error(`Group code ${f.code.trim()} already exists`);
                return;
              }
              addGroup({
                ...f,
                name: f.name.trim(),
                code: f.code.trim(),
                holdingEntity: f.holdingEntity.trim(),
                country: f.country.trim() || "India",
              });
              toast.success(`${f.name.trim()} created`);
              setF({ name: "", code: "", holdingEntity: "", country: "India", notes: "" });
              setOpen(false);
            }}
          >
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/** Super Admin: create a company (entity) under the group and issue its Admin login. */
function NewEntityDialog({ groupId, groupName, parentOrgId }) {
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const EMPTY = {
    name: "",
    legalName: "",
    code: "",
    industry: "IT Services & Consulting",
    adminEmail: "",
    adminName: "",
    branch: "",
    city: "",
    state: "Odisha",
  };
  const [f, setF] = useState(EMPTY);
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="bg-gradient-emerald text-white" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add entity
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {groupId
              ? `New entity under ${groupName}`
              : `New entity — creates the ${groupName} group`}
          </DialogTitle>
          <DialogDescription>
            Creates the company, its first branch and an entity Admin login (Admin tab on the
            sign-in page) scoped to this company only.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Company name *</Label>
            <Input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Tech Virtue"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Legal name</Label>
            <Input
              value={f.legalName}
              onChange={(e) => set("legalName", e.target.value)}
              placeholder="Tech Virtue Pvt. Ltd."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Company code *</Label>
            <Input
              value={f.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="TV-001"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Industry</Label>
            <Input value={f.industry} onChange={(e) => set("industry", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">First branch</Label>
            <Input
              value={f.branch}
              onChange={(e) => set("branch", e.target.value)}
              placeholder="Head office"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">City / State</Label>
            <div className="flex gap-1">
              <Input
                value={f.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Bhubaneswar"
              />
              <Input value={f.state} onChange={(e) => set("state", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entity Admin name</Label>
            <Input value={f.adminName} onChange={(e) => set("adminName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entity Admin e-mail *</Label>
            <Input
              value={f.adminEmail}
              onChange={(e) => set("adminEmail", e.target.value)}
              placeholder="admin@techvirtue.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={!f.name.trim() || !f.code.trim() || !/^\S+@\S+\.\S+$/.test(f.adminEmail)}
            onClick={() => {
              const code = f.code.trim();
              if (
                orgsStore
                  .get()
                  .some(
                    (o) =>
                      o.code.toLowerCase() === code.toLowerCase() ||
                      o.id.toLowerCase() === code.toLowerCase(),
                  ) ||
                groupsStore.get().some((g) => g.code.toLowerCase() === code.toLowerCase())
              ) {
                toast.error(`Company code ${code} is already in use`);
                return;
              }
              // A login e-mail must be unique — provisioning replaced any tenant account with the same e-mail, so typing the
              // group Super Admin's own address silently turned that account into this entity's Admin.
              if (userByLogin(f.adminEmail.trim())) {
                toast.error(
                  `${f.adminEmail.trim()} already has a Seereon HRMS login — use a different e-mail`,
                );
                return;
              }
              const parent = orgsStore.get().find((o) => o.id === parentOrgId);
              // Single company → first extra entity: create the group from the company and put the company in it.
              let gid = groupId;
              if (!gid && parent) {
                const g = addGroup({
                  name: `${parent.name} Group`,
                  code: `${parent.code}-GRP`,
                  holdingEntity: parent.legalName,
                  country: parent.country,
                  notes: "Created when the first additional entity was added",
                });
                assignOrgToGroup(parent.id, g.id);
                gid = g.id;
              }
              // New entities get the modules Seereon sold to the client (the parent company), not a hard-coded set that
              // included payroll / performance / exit even when the client never bought them.
              const modules = parent?.modules?.length
                ? [...parent.modules]
                : ["employee", "attendance", "leave"];
              const row = addOrg({
                code,
                name: f.name.trim(),
                legalName: f.legalName.trim() || f.name.trim(),
                groupId: gid,
                industry: f.industry.trim() || "IT Services & Consulting",
                country: parent?.country ?? "India",
                employees: 0,
                status: "Active",
                modules,
                adminEmail: f.adminEmail.trim().toLowerCase(),
                branches: [],
                plan: parent?.plan,
              });
              // Branch ids follow the `${orgId}-BR-nn` convention that addBranch / removeBranch key on (a bare "BR-01" broke the numbering).
              if (f.branch.trim())
                addBranch(row.id, {
                  name: f.branch.trim(),
                  city: f.city,
                  state: f.state,
                  address: "",
                  head: f.adminName || "",
                });
              const cred = provisionEntityAdmin({
                orgId: row.id,
                groupId: gid,
                orgName: row.name,
                email: f.adminEmail,
                name: f.adminName,
                by: me.name,
              });
              toast.success(
                `${row.name} created (${row.id}) · Admin ${cred.user.email} · temp password ${cred.temporaryPassword}`,
                { duration: 15000 },
              );
              setF(EMPTY);
              setOpen(false);
            }}
          >
            Create entity &amp; Admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BranchList({ orgId, branches, editable }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  return (
    <div className="mt-2 space-y-1">
      <div className="text-muted-foreground text-[10px] tracking-wider uppercase">Branches</div>
      {branches.map((b) => (
        <div
          key={b.id}
          className="border-border flex items-center justify-between rounded border px-2 py-1 text-xs"
        >
          <span>
            {b.name}{" "}
            <span className="text-muted-foreground">
              · {b.city}
              {b.state ? `, ${b.state}` : ""}
            </span>
          </span>
          {editable && (
            <button
              type="button"
              aria-label={`Remove branch ${b.name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                const used = branchInUse(orgId, b);
                if (used)
                  return toast.error(
                    `${b.name} still has ${used.staff} employee(s) and ${used.admins} Branch Admin(s) — move them first`,
                  );
                if (!window.confirm(`Remove branch ${b.name}?`)) return;
                removeBranch(orgId, b.id);
                toast.success("Branch removed");
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {branches.length === 0 && (
        <div className="text-muted-foreground text-xs">No branches yet.</div>
      )}
      {editable && (
        <div className="flex gap-1">
          <Input
            className="h-7 text-xs"
            placeholder="Branch name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="h-7 w-28 text-xs"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!name.trim()}
            aria-label="Add branch"
            onClick={() => {
              if (branches.some((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase())) {
                toast.error(`${name.trim()} already exists in this entity`);
                return;
              }
              addBranch(orgId, {
                name: name.trim(),
                city: city.trim(),
                state: "",
                address: "",
                head: "",
              });
              setName("");
              setCity("");
              toast.success("Branch added");
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
