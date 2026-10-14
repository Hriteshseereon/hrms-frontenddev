import { useState } from "react";
import {
  Building2,
  MapPin,
  Layers,
  BadgeCheck,
  Boxes,
  Plus,
  Search,
  Trash2,
  Landmark,
  Building,
  DoorOpen,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useSharedList } from "@/lib/shared-list";
import { ORGANIZATION, can, useCurrentUser } from "@/features/auth/data/auth-session";
import {
  addBranch,
  removeBranch,
  useActiveOrgId,
  useOrgs,
} from "@/features/organization/data/group-data";
import {
  addDepartment,
  removeDepartment,
  setHod,
  useDepartments,
} from "@/features/organization/data/dept-data";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { branchInUse } from "@/features/organization/data/tenancy";
import { useDesignationMaster } from "@/features/employees/data/hr-data";

// ---------------------------------------------------------------------------
// Branches come from the entity record (group-data → org.branches) and departments from the department master
// (dept-data, the one every HOD routing reads). Buildings, blocks, floors and designations have no lib store yet, so
// they live in session-wide shared lists keyed per entity. Everything below is real, editable data — the screen used
// to render static sample rows with dialogs that could not be submitted or even closed.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} BuildingRow
 * @property {string} id
 * @property {string} name
 * @property {string} branch
 * @property {number} floors
 * @property {number} blocks
 * @property {number} capacity
 * @property {string} [notes]
 */
/**
 * @typedef {Object} BlockRow
 * @property {string} id
 * @property {string} name
 * @property {string} branch
 * @property {string} building
 * @property {number} floors
 */
/**
 * @typedef {Object} FloorRow
 * @property {string} id
 * @property {string} name
 * @property {string} branch
 * @property {string} building
 * @property {string} block
 * @property {number} seats
 * @property {number} occupied
 */

/** Demo seed for the head-office entity only — other entities start empty. */
const BUILDINGS_SEED = [
  {
    id: "BLD-01",
    name: "Tower A — Emerald",
    branch: "Bhubaneswar HQ",
    floors: 8,
    blocks: 2,
    capacity: 320,
  },
  {
    id: "BLD-02",
    name: "Tower B — Sapphire",
    branch: "Bhubaneswar HQ",
    floors: 6,
    blocks: 2,
    capacity: 220,
  },
  { id: "BLD-03", name: "Hinjewadi Plaza", branch: "Pune", floors: 3, blocks: 1, capacity: 90 },
];
const BLOCKS_SEED = [
  {
    id: "BLK-A1",
    name: "A-Wing",
    branch: "Bhubaneswar HQ",
    building: "Tower A — Emerald",
    floors: 8,
  },
  {
    id: "BLK-A2",
    name: "B-Wing",
    branch: "Bhubaneswar HQ",
    building: "Tower A — Emerald",
    floors: 8,
  },
  {
    id: "BLK-B1",
    name: "North Block",
    branch: "Bhubaneswar HQ",
    building: "Tower B — Sapphire",
    floors: 6,
  },
  {
    id: "BLK-B2",
    name: "South Block",
    branch: "Bhubaneswar HQ",
    building: "Tower B — Sapphire",
    floors: 6,
  },
];
const FLOORS_SEED = [
  {
    id: "FLR-01",
    name: "Ground Floor",
    branch: "Bhubaneswar HQ",
    building: "Tower A — Emerald",
    block: "A-Wing",
    seats: 42,
    occupied: 38,
  },
  {
    id: "FLR-02",
    name: "1st Floor",
    branch: "Bhubaneswar HQ",
    building: "Tower A — Emerald",
    block: "A-Wing",
    seats: 48,
    occupied: 45,
  },
  {
    id: "FLR-03",
    name: "2nd Floor",
    branch: "Bhubaneswar HQ",
    building: "Tower A — Emerald",
    block: "A-Wing",
    seats: 48,
    occupied: 40,
  },
  {
    id: "FLR-04",
    name: "3rd Floor",
    branch: "Bhubaneswar HQ",
    building: "Tower A — Emerald",
    block: "B-Wing",
    seats: 48,
    occupied: 30,
  },
  {
    id: "FLR-05",
    name: "4th Floor",
    branch: "Bhubaneswar HQ",
    building: "Tower A — Emerald",
    block: "B-Wing",
    seats: 48,
    occupied: 22,
  },
];

const BANDS = ["Entry", "Mid", "Senior", "Executive"];

/** Next free `${prefix}-nn` id — count-based ids collide with surviving rows after a delete. */
const nextId = (rows, prefix) => {
  const n = rows.reduce((m, r) => Math.max(m, Number(r.id.slice(prefix.length + 1)) || 0), 0) + 1;
  return `${prefix}-${String(n).padStart(2, "0")}`;
};
const matches = (q, ...parts) =>
  !q.trim() || parts.join(" ").toLowerCase().includes(q.trim().toLowerCase());

function StatTile({ icon: Icon, label, value, tone = "emerald" }) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white",
            tone === "emerald" ? "bg-gradient-emerald" : "bg-gold",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <div className="text-muted-foreground truncate text-xs tracking-wider uppercase">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SearchBar({ placeholder, value, onChange }) {
  return (
    <div className="border-border bg-muted/40 flex max-w-md min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
      <Search className="text-muted-foreground h-4 w-4" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

/** Controlled add dialog shell: open state, Cancel closes, the primary button submits when `valid`. */
function AddDialog({
  trigger,
  title,
  icon: Icon,
  description,
  valid,
  submitLabel,
  onSubmit,
  children,
  className,
  canEdit = true,
}) {
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-emerald text-white">
          <Plus className="h-4 w-4" /> {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className={className ?? "max-w-xl"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="text-primary h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={!valid}
            onClick={() => {
              onSubmit();
              setOpen(false);
            }}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Infrastructure() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const org = useOrgs().find((o) => o.id === orgId);
  const branches = org?.branches ?? [];
  const employees = useScopedEmployees();
  const departments = useDepartments().filter((d) => d.orgId === orgId);
  const isHq = orgId === ORGANIZATION.id;
  const [buildings, setBuildings] = useSharedList(
    `infra-buildings:${orgId}`,
    isHq ? BUILDINGS_SEED : [],
  );
  const [blocks, setBlocks] = useSharedList(`infra-blocks:${orgId}`, isHq ? BLOCKS_SEED : []);
  const [floors, setFloors] = useSharedList(`infra-floors:${orgId}`, isHq ? FLOORS_SEED : []);
  // Shared with the employee record form, promotions and transfers (hr-data → useDesignationNames).
  const [designations, setDesignations] = useDesignationMaster(orgId);
  // Org structure (branches, buildings, departments, designations) is edited by roles holding department.manage;
  // other roles that can open Master Data (e.g. COO) get a read-only view — only the Departments tab used to be guarded.
  const canEditDepartments = can(me.role, "department.manage");

  const [tab, setTab] = useState("branches");
  const [q, setQ] = useState({});
  const search = (k) => q[k] ?? "";
  const setSearch = (k, v) => setQ((p) => ({ ...p, [k]: v }));

  const [buildingDetail, setBuildingDetail] = useState(null);
  const [floorDetail, setFloorDetail] = useState(null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [desigDetail, setDesigDetail] = useState(null);

  /* ---------- add forms ---------- */
  const [bf, setBf] = useState({ name: "", address: "", city: "", state: "", pin: "", head: "" });
  const [bld, setBld] = useState({
    name: "",
    branch: "",
    floors: "",
    blocks: "",
    capacity: "",
    notes: "",
  });
  const [blk, setBlk] = useState({ name: "", branch: "", building: "", floors: "" });
  const [flr, setFlr] = useState({
    name: "",
    branch: "",
    building: "",
    block: "",
    seats: "",
    occupied: "",
  });
  const [dep, setDep] = useState({ name: "", code: "", location: "", hodId: "", costCentre: "" });
  const [dsg, setDsg] = useState({
    name: "",
    grade: "",
    department: "",
    level: "",
    band: "",
    description: "",
  });

  // Branches and departments belong to the company: count its people company-wide. With one branch in scope every other
  // branch / department read 0 and could be deleted while still staffed.
  const companyStaff = useDirectory().filter((e) => e.orgId === orgId && e.status !== "Exited");
  const headcount = (branchName) => companyStaff.filter((e) => e.branch === branchName).length;
  const deptCount = (deptName) => companyStaff.filter((e) => e.dept === deptName).length;
  const buildingsOf = (branchName) => buildings.filter((b) => b.branch === branchName).length;

  const visibleBranches = branches.filter((b) =>
    matches(search("branches"), b.name, b.city, b.state, b.address),
  );
  const visibleBuildings = buildings.filter((b) =>
    matches(search("buildings"), b.name, b.id, b.branch),
  );
  const visibleBlocks = blocks.filter((b) =>
    matches(search("blocks"), b.name, b.id, b.building, b.branch),
  );
  const visibleFloors = floors.filter((f) =>
    matches(search("floors"), f.name, f.id, f.building, f.block),
  );
  const visibleDepartments = departments.filter((d) =>
    matches(search("departments"), d.name, d.code, d.location, d.costCentre),
  );
  const visibleDesignations = designations.filter((d) =>
    matches(search("designations"), d.name, d.grade, d.band, d.department),
  );

  const branchSelect = (value, onChange) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.name}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const buildingSelect = (branch, value, onChange) => {
    const list = buildings.filter((b) => !branch || b.branch === branch);
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue
            placeholder={list.length ? "Select building" : "No building in this branch"}
          />
        </SelectTrigger>
        <SelectContent>
          {list.map((b) => (
            <SelectItem key={b.id} value={b.name}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Building2 className="text-primary h-6 w-6" /> Organization Infrastructure
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Central master data — branches, buildings, blocks, floors, departments and designations
            {org ? ` · ${org.name}` : ""}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
        <StatTile icon={Landmark} label="Branches" value={branches.length} />
        <StatTile icon={Building} label="Buildings" value={buildings.length} tone="gold" />
        <StatTile icon={Boxes} label="Blocks" value={blocks.length} />
        <StatTile icon={DoorOpen} label="Floors" value={floors.length} tone="gold" />
        <StatTile icon={Layers} label="Departments" value={departments.length} />
        <StatTile icon={BadgeCheck} label="Designations" value={designations.length} tone="gold" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <ScrollTabsList>
          <TabsTrigger value="branches">
            <Landmark className="h-4 w-4" /> Branches
          </TabsTrigger>
          <TabsTrigger value="buildings">
            <Building className="h-4 w-4" /> Buildings
          </TabsTrigger>
          <TabsTrigger value="blocks">
            <Boxes className="h-4 w-4" /> Blocks
          </TabsTrigger>
          <TabsTrigger value="floors">
            <DoorOpen className="h-4 w-4" /> Floors
          </TabsTrigger>
          <TabsTrigger value="departments">
            <Layers className="h-4 w-4" /> Departments
          </TabsTrigger>
          <TabsTrigger value="designations">
            <BadgeCheck className="h-4 w-4" /> Designations
          </TabsTrigger>
        </ScrollTabsList>

        {/* Branches */}
        <TabsContent value="branches" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <SearchBar
                placeholder="Search branches by name, city…"
                value={search("branches")}
                onChange={(v) => setSearch("branches", v)}
              />
              <div className="ml-auto">
                <AddDialog
                  canEdit={canEditDepartments}
                  trigger="Add Branch"
                  title="Add Branch"
                  icon={Landmark}
                  description="Register a new office location for this organization."
                  valid={
                    !!bf.name.trim() &&
                    !!bf.city.trim() &&
                    !!bf.address.trim() &&
                    !branches.some((b) => b.name.toLowerCase() === bf.name.trim().toLowerCase()) &&
                    (!bf.pin.trim() || /^\d{6}$/.test(bf.pin.trim()))
                  }
                  submitLabel="Create Branch"
                  className="max-w-2xl"
                  onSubmit={() => {
                    addBranch(orgId, {
                      name: bf.name.trim(),
                      city: bf.city.trim(),
                      state: bf.state.trim(),
                      address: [bf.address.trim(), bf.pin.trim()].filter(Boolean).join(", "),
                      head: bf.head.trim(),
                    });
                    toast.success(`${bf.name.trim()} added`);
                    setBf({ name: "", address: "", city: "", state: "", pin: "", head: "" });
                  }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Branch Name" required>
                      <Input
                        value={bf.name}
                        onChange={(e) => setBf({ ...bf, name: e.target.value })}
                        placeholder="Bhubaneswar HQ"
                      />
                    </Field>
                    <Field label="Branch Head">
                      <Input
                        value={bf.head}
                        onChange={(e) => setBf({ ...bf, head: e.target.value })}
                        placeholder="Name of the branch head"
                      />
                    </Field>
                  </div>
                  <Field label="Street Address" required>
                    <Textarea
                      rows={2}
                      value={bf.address}
                      onChange={(e) => setBf({ ...bf, address: e.target.value })}
                      placeholder="Building, street, area"
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="City" required>
                      <Input
                        value={bf.city}
                        onChange={(e) => setBf({ ...bf, city: e.target.value })}
                        placeholder="Bhubaneswar"
                      />
                    </Field>
                    <Field label="State">
                      <Input
                        value={bf.state}
                        onChange={(e) => setBf({ ...bf, state: e.target.value })}
                        placeholder="Odisha"
                      />
                    </Field>
                    <Field label="PIN Code">
                      <Input
                        value={bf.pin}
                        onChange={(e) => setBf({ ...bf, pin: e.target.value })}
                        placeholder="751003"
                      />
                    </Field>
                  </div>
                  {branches.some((b) => b.name.toLowerCase() === bf.name.trim().toLowerCase()) && (
                    <div className="text-destructive text-xs">
                      A branch named {bf.name.trim()} already exists.
                    </div>
                  )}
                  {!!bf.pin.trim() && !/^\d{6}$/.test(bf.pin.trim()) && (
                    <div className="text-destructive text-xs">PIN code must be 6 digits.</div>
                  )}
                </AddDialog>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleBranches.map((b) => (
              <Card key={b.id} className="shadow-card hover:shadow-premium transition">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
                        <Landmark className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{b.name}</CardTitle>
                        <div className="text-muted-foreground text-xs">{b.id}</div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {headcount(b.name)} emp
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="text-muted-foreground flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div>{b.address || "—"}</div>
                      <div>{[b.city, b.state].filter(Boolean).join(", ")}</div>
                      {b.head && <div>Head: {b.head}</div>}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{buildingsOf(b.name)} buildings</span>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={!canEditDepartments || !!branchInUse(orgId, b)}
                        title={
                          branchInUse(orgId, b)
                            ? "Move its employees and Branch Admin to another branch first"
                            : "Remove branch"
                        }
                        onClick={() => {
                          removeBranch(orgId, b.id);
                          toast.success(`${b.name} removed`);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearch("buildings", b.name);
                          setTab("buildings");
                        }}
                      >
                        Manage <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {visibleBranches.length === 0 && (
              <Card className="shadow-card md:col-span-2 xl:col-span-3">
                <CardContent className="text-muted-foreground p-10 text-center text-sm">
                  {branches.length
                    ? "No branch matches the search."
                    : "No branches yet — add the first office location."}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Buildings */}
        <TabsContent value="buildings" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <SearchBar
                placeholder="Search buildings…"
                value={search("buildings")}
                onChange={(v) => setSearch("buildings", v)}
              />
              <div className="ml-auto">
                <AddDialog
                  canEdit={canEditDepartments}
                  trigger="Add Building"
                  title="Add Building"
                  icon={Building}
                  description="Add a tower or building under an existing branch."
                  valid={
                    !!bld.name.trim() &&
                    !!bld.branch &&
                    !buildings.some(
                      (b) => b.name.toLowerCase() === bld.name.trim().toLowerCase(),
                    ) &&
                    [bld.floors, bld.blocks, bld.capacity].every((v) => !v || Number(v) >= 0)
                  }
                  submitLabel="Create Building"
                  className="max-w-2xl"
                  onSubmit={() => {
                    setBuildings((p) => [
                      {
                        id: nextId(p, "BLD"),
                        name: bld.name.trim(),
                        branch: bld.branch,
                        floors: Number(bld.floors) || 0,
                        blocks: Number(bld.blocks) || 0,
                        capacity: Number(bld.capacity) || 0,
                        notes: bld.notes.trim() || undefined,
                      },
                      ...p,
                    ]);
                    toast.success(`${bld.name.trim()} added`);
                    setBld({
                      name: "",
                      branch: "",
                      floors: "",
                      blocks: "",
                      capacity: "",
                      notes: "",
                    });
                  }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Building Name" required>
                      <Input
                        value={bld.name}
                        onChange={(e) => setBld({ ...bld, name: e.target.value })}
                        placeholder="Tower A — Emerald"
                      />
                    </Field>
                    <Field label="Branch" required>
                      {branchSelect(bld.branch, (v) => setBld({ ...bld, branch: v }))}
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Total Floors">
                      <Input
                        type="number"
                        min={0}
                        value={bld.floors}
                        onChange={(e) => setBld({ ...bld, floors: e.target.value })}
                        placeholder="8"
                      />
                    </Field>
                    <Field label="No. of Blocks">
                      <Input
                        type="number"
                        min={0}
                        value={bld.blocks}
                        onChange={(e) => setBld({ ...bld, blocks: e.target.value })}
                        placeholder="2"
                      />
                    </Field>
                    <Field label="Seat Capacity">
                      <Input
                        type="number"
                        min={0}
                        value={bld.capacity}
                        onChange={(e) => setBld({ ...bld, capacity: e.target.value })}
                        placeholder="320"
                      />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <Textarea
                      rows={2}
                      value={bld.notes}
                      onChange={(e) => setBld({ ...bld, notes: e.target.value })}
                      placeholder="Amenities, notes, entrances…"
                    />
                  </Field>
                </AddDialog>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Building</th>
                  <th className="p-3 text-left">Branch</th>
                  <th className="p-3 text-left">Floors</th>
                  <th className="p-3 text-left">Blocks</th>
                  <th className="p-3 text-left">Capacity</th>
                  <th className="w-10 p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {visibleBuildings.map((b) => (
                  <tr key={b.id} className={clickableRow} onClick={() => setBuildingDetail(b)}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-emerald grid h-9 w-9 place-items-center rounded-lg text-white">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold">{b.name}</div>
                          <div className="text-muted-foreground text-xs">{b.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground p-3">{b.branch}</td>
                    <td className="p-3">{b.floors}</td>
                    <td className="p-3">{b.blocks}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
                        {b.capacity} seats
                      </Badge>
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canEditDepartments}
                        aria-label={`Remove ${b.name}`}
                        onClick={() => {
                          setBuildings((p) => p.filter((x) => x.id !== b.id));
                          setBlocks((p) => p.filter((x) => x.building !== b.name));
                          setFloors((p) => p.filter((x) => x.building !== b.name));
                          toast.success(`${b.name} removed with its blocks and floors`);
                        }}
                      >
                        <Trash2 className="text-muted-foreground h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {visibleBuildings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground p-8 text-center">
                      {buildings.length ? "No building matches the search." : "No buildings yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Blocks */}
        <TabsContent value="blocks" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <SearchBar
                placeholder="Search blocks…"
                value={search("blocks")}
                onChange={(v) => setSearch("blocks", v)}
              />
              <div className="ml-auto">
                <AddDialog
                  canEdit={canEditDepartments}
                  trigger="Add Block"
                  title="Add Block / Wing"
                  icon={Boxes}
                  description="Split a building into wings or blocks for finer allocation."
                  valid={!!blk.name.trim() && !!blk.branch && !!blk.building}
                  submitLabel="Create Block"
                  onSubmit={() => {
                    setBlocks((p) => [
                      {
                        id: nextId(p, "BLK"),
                        name: blk.name.trim(),
                        branch: blk.branch,
                        building: blk.building,
                        floors: Number(blk.floors) || 0,
                      },
                      ...p,
                    ]);
                    toast.success(`${blk.name.trim()} added`);
                    setBlk({ name: "", branch: "", building: "", floors: "" });
                  }}
                >
                  <Field label="Block Name" required>
                    <Input
                      value={blk.name}
                      onChange={(e) => setBlk({ ...blk, name: e.target.value })}
                      placeholder="A-Wing"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Branch" required>
                      {branchSelect(blk.branch, (v) => setBlk({ ...blk, branch: v, building: "" }))}
                    </Field>
                    <Field label="Building" required>
                      {buildingSelect(blk.branch, blk.building, (v) =>
                        setBlk({ ...blk, building: v }),
                      )}
                    </Field>
                  </div>
                  <Field label="Floors served">
                    <Input
                      type="number"
                      min={0}
                      value={blk.floors}
                      onChange={(e) => setBlk({ ...blk, floors: e.target.value })}
                      placeholder="8"
                    />
                  </Field>
                </AddDialog>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleBlocks.map((b) => (
              <Card key={b.id} className="shadow-card">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between">
                    <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
                        {b.floors} floors
                      </Badge>
                      <button
                        type="button"
                        disabled={!canEditDepartments}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                        aria-label={`Remove ${b.name}`}
                        onClick={() => {
                          setBlocks((p) => p.filter((x) => x.id !== b.id));
                          toast.success(`${b.name} removed`);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="pt-1 font-semibold">{b.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {b.building} · {b.branch}
                  </div>
                </CardContent>
              </Card>
            ))}
            {visibleBlocks.length === 0 && (
              <Card className="shadow-card md:col-span-2 lg:col-span-3 xl:col-span-4">
                <CardContent className="text-muted-foreground p-10 text-center text-sm">
                  {blocks.length ? "No block matches the search." : "No blocks yet."}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Floors */}
        <TabsContent value="floors" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <SearchBar
                placeholder="Search floors…"
                value={search("floors")}
                onChange={(v) => setSearch("floors", v)}
              />
              <div className="ml-auto">
                <AddDialog
                  canEdit={canEditDepartments}
                  trigger="Add Floor"
                  title="Add Floor"
                  icon={DoorOpen}
                  description="Define a floor with seat capacity for planning."
                  valid={
                    !!flr.name.trim() &&
                    !!flr.branch &&
                    !!flr.building &&
                    Number(flr.seats) > 0 &&
                    Number(flr.occupied || 0) <= Number(flr.seats)
                  }
                  submitLabel="Create Floor"
                  onSubmit={() => {
                    setFloors((p) => [
                      {
                        id: nextId(p, "FLR"),
                        name: flr.name.trim(),
                        branch: flr.branch,
                        building: flr.building,
                        block: flr.block || "—",
                        seats: Number(flr.seats),
                        occupied: Number(flr.occupied) || 0,
                      },
                      ...p,
                    ]);
                    toast.success(`${flr.name.trim()} added`);
                    setFlr({
                      name: "",
                      branch: "",
                      building: "",
                      block: "",
                      seats: "",
                      occupied: "",
                    });
                  }}
                >
                  <Field label="Floor Name" required>
                    <Input
                      value={flr.name}
                      onChange={(e) => setFlr({ ...flr, name: e.target.value })}
                      placeholder="3rd Floor"
                    />
                  </Field>
                  <Field label="Branch" required>
                    {branchSelect(flr.branch, (v) =>
                      setFlr({ ...flr, branch: v, building: "", block: "" }),
                    )}
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Building" required>
                      {buildingSelect(flr.branch, flr.building, (v) =>
                        setFlr({ ...flr, building: v, block: "" }),
                      )}
                    </Field>
                    <Field label="Block">
                      <Select value={flr.block} onValueChange={(v) => setFlr({ ...flr, block: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {blocks
                            .filter((b) => !flr.building || b.building === flr.building)
                            .map((b) => (
                              <SelectItem key={b.id} value={b.name}>
                                {b.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Seat Capacity" required>
                      <Input
                        type="number"
                        min={1}
                        value={flr.seats}
                        onChange={(e) => setFlr({ ...flr, seats: e.target.value })}
                        placeholder="48"
                      />
                    </Field>
                    <Field label="Occupancy">
                      <Input
                        type="number"
                        min={0}
                        value={flr.occupied}
                        onChange={(e) => setFlr({ ...flr, occupied: e.target.value })}
                        placeholder="0"
                      />
                    </Field>
                  </div>
                  {Number(flr.occupied || 0) > Number(flr.seats || 0) && (
                    <div className="text-destructive text-xs">
                      Occupancy cannot exceed the seat capacity.
                    </div>
                  )}
                </AddDialog>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Floor</th>
                  <th className="p-3 text-left">Building</th>
                  <th className="p-3 text-left">Block</th>
                  <th className="p-3 text-left">Seats</th>
                  <th className="p-3 text-left">Occupancy</th>
                  <th className="w-10 p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {visibleFloors.map((f) => {
                  const pct = f.seats ? Math.round((f.occupied / f.seats) * 100) : 0;
                  return (
                    <tr key={f.id} className={clickableRow} onClick={() => setFloorDetail(f)}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-emerald grid h-9 w-9 place-items-center rounded-lg text-white">
                            <DoorOpen className="h-4 w-4" />
                          </div>
                          <div className="font-semibold">{f.name}</div>
                        </div>
                      </td>
                      <td className="text-muted-foreground p-3">{f.building}</td>
                      <td className="text-muted-foreground p-3">{f.block}</td>
                      <td className="p-3">{f.seats}</td>
                      <td className="p-3">
                        <div className="flex min-w-[160px] items-center gap-2">
                          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                            <div
                              className="bg-gradient-emerald h-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-24 text-xs">
                            {f.occupied}/{f.seats} ({pct}%)
                          </span>
                        </div>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!canEditDepartments}
                          aria-label={`Remove ${f.name}`}
                          onClick={() => {
                            setFloors((p) => p.filter((x) => x.id !== f.id));
                            toast.success(`${f.name} removed`);
                          }}
                        >
                          <Trash2 className="text-muted-foreground h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {visibleFloors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground p-8 text-center">
                      {floors.length ? "No floor matches the search." : "No floors yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Departments */}
        <TabsContent value="departments" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <SearchBar
                placeholder="Search departments…"
                value={search("departments")}
                onChange={(v) => setSearch("departments", v)}
              />
              <div className="ml-auto">
                {canEditDepartments && (
                  <AddDialog
                    canEdit={canEditDepartments}
                    trigger="Add Department"
                    title="Add Department"
                    icon={Layers}
                    description="Create a department in the department master — HOD routing, transfers and hiring read from it."
                    valid={
                      !!dep.name.trim() &&
                      !!dep.code.trim() &&
                      !departments.some(
                        (d) =>
                          d.code.toLowerCase() === dep.code.trim().toLowerCase() ||
                          d.name.toLowerCase() === dep.name.trim().toLowerCase(),
                      )
                    }
                    submitLabel="Create Department"
                    onSubmit={() => {
                      addDepartment({
                        name: dep.name.trim(),
                        code: dep.code.trim().toUpperCase(),
                        hodId: dep.hodId || null,
                        costCentre: dep.costCentre.trim() || "—",
                        location: dep.location || branches[0]?.name || "—",
                        orgId,
                      });
                      toast.success(`${dep.name.trim()} added to the department master`);
                      setDep({ name: "", code: "", location: "", hodId: "", costCentre: "" });
                    }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Department Name" required>
                        <Input
                          value={dep.name}
                          onChange={(e) => setDep({ ...dep, name: e.target.value })}
                          placeholder="Engineering"
                        />
                      </Field>
                      <Field label="Department Code" required>
                        <Input
                          value={dep.code}
                          onChange={(e) => setDep({ ...dep, code: e.target.value })}
                          placeholder="ENG"
                        />
                      </Field>
                    </div>
                    {departments.some(
                      (d) => d.code.toLowerCase() === dep.code.trim().toLowerCase(),
                    ) && (
                      <div className="text-destructive text-xs">
                        A department with code {dep.code.trim().toUpperCase()} already exists.
                      </div>
                    )}
                    {departments.some(
                      (d) => d.name.toLowerCase() === dep.name.trim().toLowerCase(),
                    ) && (
                      <div className="text-destructive text-xs">
                        A department named {dep.name.trim()} already exists.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Branch">
                        {branchSelect(dep.location, (v) => setDep({ ...dep, location: v }))}
                      </Field>
                      <Field label="Cost centre">
                        <Input
                          value={dep.costCentre}
                          onChange={(e) => setDep({ ...dep, costCentre: e.target.value })}
                          placeholder="CC-1008"
                        />
                      </Field>
                    </div>
                    <Field label="Department Head">
                      <Select value={dep.hodId} onValueChange={(v) => setDep({ ...dep, hodId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign later" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name} · {e.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </AddDialog>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Department</th>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Branch</th>
                  <th className="p-3 text-left">Head</th>
                  <th className="p-3 text-left">Employees</th>
                  {canEditDepartments && <th className="w-10 p-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {visibleDepartments.map((d) => (
                  <tr key={d.id} className={clickableRow} onClick={() => setDeptDetail(d)}>
                    <td className="p-3 font-semibold">{d.name}</td>
                    <td className="text-muted-foreground p-3">{d.code}</td>
                    <td className="text-muted-foreground p-3">{d.location}</td>
                    <td className="p-3" onClick={(e) => canEditDepartments && e.stopPropagation()}>
                      {/* The HOD could only be chosen when the department was created — there was no way to reassign it. */}
                      {canEditDepartments ? (
                        <Select
                          value={d.hodId ?? "__none"}
                          onValueChange={(v) => {
                            setHod(d.id, v === "__none" ? null : v);
                            toast.success(
                              v === "__none"
                                ? `${d.name}: HOD cleared`
                                : `${employees.find((e) => e.id === v)?.name ?? v} is now HOD of ${d.name}`,
                            );
                          }}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-[200px]">
                            <SelectValue placeholder="Not assigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Not assigned</SelectItem>
                            {employees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name} · {e.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        (employees.find((e) => e.id === d.hodId)?.name ?? (
                          <span className="text-muted-foreground">Not assigned</span>
                        ))
                      )}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        {deptCount(d.name)}
                      </Badge>
                    </td>
                    {canEditDepartments && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${d.name}`}
                          disabled={deptCount(d.name) > 0}
                          title={
                            deptCount(d.name) > 0
                              ? "Move its employees to another department first"
                              : "Remove department"
                          }
                          onClick={() => {
                            removeDepartment(d.id);
                            toast.success(`${d.name} removed`);
                          }}
                        >
                          <Trash2 className="text-muted-foreground h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {visibleDepartments.length === 0 && (
                  <tr>
                    <td
                      colSpan={canEditDepartments ? 6 : 5}
                      className="text-muted-foreground p-8 text-center"
                    >
                      {departments.length
                        ? "No department matches the search."
                        : "No departments yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* Designations */}
        <TabsContent value="designations" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <SearchBar
                placeholder="Search designations…"
                value={search("designations")}
                onChange={(v) => setSearch("designations", v)}
              />
              <div className="ml-auto">
                <AddDialog
                  canEdit={canEditDepartments}
                  trigger="Add Designation"
                  title="Add Designation"
                  icon={BadgeCheck}
                  description="Define a job title mapped to a grade and band."
                  valid={
                    !!dsg.name.trim() &&
                    !!dsg.grade.trim() &&
                    Number(dsg.level) > 0 &&
                    !designations.some(
                      (d) => d.name.toLowerCase() === dsg.name.trim().toLowerCase(),
                    )
                  }
                  submitLabel="Create Designation"
                  onSubmit={() => {
                    setDesignations((p) =>
                      [
                        ...p,
                        {
                          id: nextId(p, "DSG"),
                          level: Number(dsg.level),
                          name: dsg.name.trim(),
                          grade: dsg.grade.trim(),
                          band: dsg.band || "Entry",
                          department: dsg.department || undefined,
                          description: dsg.description.trim() || undefined,
                        },
                      ].sort((a, b) => a.level - b.level),
                    );
                    toast.success(`${dsg.name.trim()} added`);
                    setDsg({
                      name: "",
                      grade: "",
                      department: "",
                      level: "",
                      band: "",
                      description: "",
                    });
                  }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Designation Name" required>
                      <Input
                        value={dsg.name}
                        onChange={(e) => setDsg({ ...dsg, name: e.target.value })}
                        placeholder="Senior Manager"
                      />
                    </Field>
                    <Field label="Grade Code" required>
                      <Input
                        value={dsg.grade}
                        onChange={(e) => setDsg({ ...dsg, grade: e.target.value })}
                        placeholder="M3"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Department">
                      <Select
                        value={dsg.department}
                        onValueChange={(v) => setDsg({ ...dsg, department: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.name}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Band">
                      <Select value={dsg.band} onValueChange={(v) => setDsg({ ...dsg, band: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {BANDS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Level" required>
                    <Input
                      type="number"
                      min={1}
                      value={dsg.level}
                      onChange={(e) => setDsg({ ...dsg, level: e.target.value })}
                      placeholder="5"
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      rows={2}
                      value={dsg.description}
                      onChange={(e) => setDsg({ ...dsg, description: e.target.value })}
                      placeholder="Role scope, expected responsibilities"
                    />
                  </Field>
                </AddDialog>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Level</th>
                  <th className="p-3 text-left">Designation</th>
                  <th className="p-3 text-left">Grade</th>
                  <th className="p-3 text-left">Band</th>
                  <th className="w-10 p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {visibleDesignations.map((d) => (
                  <tr key={d.id} className={clickableRow} onClick={() => setDesigDetail(d)}>
                    <td className="p-3">
                      <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
                        L{d.level}
                      </Badge>
                    </td>
                    <td className="p-3 font-semibold">
                      {d.name}
                      {d.department && (
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          {d.department}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground p-3">{d.grade}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          d.band === "Executive"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : d.band === "Senior"
                              ? "border-gold/30 bg-gold/10 text-gold"
                              : "border-border bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {d.band}
                      </Badge>
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canEditDepartments}
                        aria-label={`Remove ${d.name}`}
                        onClick={() => {
                          setDesignations((p) => p.filter((x) => x.id !== d.id));
                          toast.success(`${d.name} removed`);
                        }}
                      >
                        <Trash2 className="text-muted-foreground h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {visibleDesignations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground p-8 text-center">
                      {designations.length
                        ? "No designation matches the search."
                        : "No designations yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      {buildingDetail && (
        <RecordDetailDialog
          onClose={() => setBuildingDetail(null)}
          title={buildingDetail.name}
          subtitle={`${buildingDetail.id} · ${buildingDetail.branch}`}
          badges={
            <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
              {buildingDetail.capacity} seats
            </Badge>
          }
          record={{
            ...buildingDetail,
            blockList: blocks
              .filter((x) => x.building === buildingDetail.name)
              .map((x) => ({ id: x.id, block: x.name, floors: x.floors })),
            floorList: floors
              .filter((x) => x.building === buildingDetail.name)
              .map((x) => ({
                id: x.id,
                floor: x.name,
                block: x.block,
                seats: x.seats,
                occupied: x.occupied,
              })),
          }}
          labels={{
            id: "Building ID",
            capacity: "Capacity (seats)",
            blockList: "Blocks",
            floorList: "Floors",
          }}
          sections={[
            {
              title: "Building",
              keys: ["id", "name", "branch", "floors", "blocks", "capacity", "notes"],
            },
            { title: "Blocks", keys: ["blockList"] },
            { title: "Floors", keys: ["floorList"] },
          ]}
        />
      )}
      {floorDetail && (
        <RecordDetailDialog
          onClose={() => setFloorDetail(null)}
          title={floorDetail.name}
          subtitle={`${floorDetail.id} · ${floorDetail.building} · ${floorDetail.block}`}
          badges={
            <Badge variant="outline">
              {floorDetail.seats ? Math.round((floorDetail.occupied / floorDetail.seats) * 100) : 0}{" "}
              % occupied
            </Badge>
          }
          record={{
            ...floorDetail,
            vacant: floorDetail.seats - floorDetail.occupied,
            occupancy: `${floorDetail.occupied}/${floorDetail.seats} (${floorDetail.seats ? Math.round((floorDetail.occupied / floorDetail.seats) * 100) : 0} %)`,
          }}
          labels={{ id: "Floor ID" }}
        />
      )}
      {deptDetail && (
        <RecordDetailDialog
          onClose={() => setDeptDetail(null)}
          title={deptDetail.name}
          subtitle={`${deptDetail.code} · ${deptDetail.location}`}
          badges={
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {deptCount(deptDetail.name)} employees
            </Badge>
          }
          record={{
            id: deptDetail.id,
            name: deptDetail.name,
            code: deptDetail.code,
            location: deptDetail.location,
            costCentre: deptDetail.costCentre,
            head: employees.find((e) => e.id === deptDetail.hodId)?.name ?? "Not assigned",
            employees: deptCount(deptDetail.name),
            people: employees
              .filter((e) => e.dept === deptDetail.name)
              .map((e) => ({ id: e.id, name: e.name, designation: e.role, branch: e.branch })),
          }}
          labels={{
            id: "Department ID",
            code: "Department code",
            location: "Branch",
            costCentre: "Cost centre",
            head: "Department head",
            people: "People",
          }}
          sections={[
            {
              title: "Department",
              keys: ["id", "name", "code", "location", "costCentre", "head", "employees"],
            },
            { title: "People", keys: ["people"] },
          ]}
        />
      )}
      {desigDetail && (
        <RecordDetailDialog
          onClose={() => setDesigDetail(null)}
          title={desigDetail.name}
          subtitle={`Level ${desigDetail.level} · grade ${desigDetail.grade}`}
          badges={<Badge variant="outline">{desigDetail.band}</Badge>}
          record={desigDetail}
          labels={{ id: "Designation ID" }}
        />
      )}
    </div>
  );
}
