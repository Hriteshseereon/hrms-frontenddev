// Master Data → Assets: asset categories / types with serial rule, useful life, custodian department, the
// condition checklist verified on issue and return, default accessories and return period.
import { useState } from "react";
import { Boxes, Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clickableRow } from "@/components/common/RecordDetail";
import { Field, KV } from "@/features/employees/components/CasePieces";
import { exportReportPdf } from "@/lib/export-utils";
import {
  ASSET_KINDS,
  useAssetMaster,
  upsertAssetType,
  deleteAssetType,
  useAssets,
} from "@/features/assets/data/asset-data";

const blank = () => ({
  code: "",
  name: "",
  kind: "Hardware",
  description: "",
  requiresSerial: true,
  usefulLifeYears: 3,
  depreciationPct: 33.33,
  custodianDept: "IT & Systems",
  checklist: [],
  accessories: [],
  defaultReturnDays: 0,
  active: true,
});

export function AssetMasterTab() {
  const rows = useAssetMaster();
  const assets = useAssets();
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const countOf = (name) => assets.filter((a) => a.type === name).length;

  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Asset Master — categories, types & checklists</div>
              <div className="text-muted-foreground text-xs">
                Used by Asset Lifecycle: the register's type list, serial rule, useful life for book
                value, the checklist verified at issue and again at return, and default accessories.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportReportPdf({
                  title: "Asset Master",
                  subtitle: "Asset types with lifecycle rules",
                  columns: [
                    "Code",
                    "Type",
                    "Category",
                    "Serial",
                    "Life (yrs)",
                    "Dep. %",
                    "Custodian",
                    "Checklist items",
                    "Accessories",
                    "Active",
                  ],
                  rows: rows.map((r) => [
                    r.code,
                    r.name,
                    r.kind,
                    r.requiresSerial ? "Required" : "Optional",
                    r.usefulLifeYears,
                    r.depreciationPct,
                    r.custodianDept,
                    r.checklist.length,
                    r.accessories.join(", ") || "—",
                    r.active ? "Yes" : "No",
                  ]),
                })
              }
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-white"
              onClick={() => setEdit("new")}
            >
              <Plus className="h-4 w-4" /> Add asset type
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                {[
                  "Code",
                  "Type",
                  "Category",
                  "Serial",
                  "Life / Dep.",
                  "Custodian",
                  "Checklist",
                  "Accessories",
                  "In register",
                  "Active",
                  "",
                ].map((h) => (
                  <th key={h} className="py-2.5 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-border/60 border-b ${clickableRow}`}
                  onClick={() => setView(r)}
                >
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.code}</td>
                  <td className="py-2.5 pr-3 font-medium">
                    {r.name}
                    <div className="text-muted-foreground text-xs font-normal">{r.description}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge variant="outline">{r.kind}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">
                    {r.requiresSerial ? "Required" : "Optional"}
                  </td>
                  <td className="py-2.5 pr-3 text-xs whitespace-nowrap">
                    {r.usefulLifeYears} yrs · {r.depreciationPct}%
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{r.custodianDept}</td>
                  <td className="py-2.5 pr-3 text-xs">{r.checklist.length} items</td>
                  <td className="py-2.5 pr-3 text-xs">{r.accessories.join(", ") || "—"}</td>
                  <td className="py-2.5 pr-3">{countOf(r.name)}</td>
                  <td className="py-2.5 pr-3" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => upsertAssetType({ ...r, active: v })}
                    />
                  </td>
                  <td className="py-2.5 pr-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEdit(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                        disabled={countOf(r.name) > 0}
                        title={
                          countOf(r.name) > 0
                            ? "Assets exist under this type — deactivate instead"
                            : "Delete"
                        }
                        onClick={() => {
                          deleteAssetType(r.id);
                          toast.success("Asset type removed");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {edit && (
            <TypeForm existing={edit === "new" ? undefined : edit} onDone={() => setEdit(null)} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {view && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {view.name}{" "}
                  <span className="text-muted-foreground font-mono text-sm">· {view.code}</span>
                </DialogTitle>
                <DialogDescription>{view.description}</DialogDescription>
              </DialogHeader>
              <KV
                items={[
                  ["Category", view.kind],
                  ["Serial number", view.requiresSerial ? "Required" : "Optional"],
                  ["Useful life", `${view.usefulLifeYears} years`],
                  ["Depreciation", `${view.depreciationPct}% p.a.`],
                  ["Custodian department", view.custodianDept],
                  [
                    "Default return period",
                    view.defaultReturnDays ? `${view.defaultReturnDays} days` : "Until separation",
                  ],
                  ["Active", view.active ? "Yes" : "No"],
                  ["Assets in register", String(countOf(view.name))],
                ]}
              />
              <div className="space-y-1">
                <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Checklist (verified at issue & return)
                </div>
                <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                  {view.checklist.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
                {view.checklist.length === 0 && (
                  <div className="text-muted-foreground text-sm">None</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Default accessories
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {view.accessories.map((a) => (
                    <Badge key={a} variant="outline">
                      {a}
                    </Badge>
                  ))}
                  {view.accessories.length === 0 && (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEdit(view);
                    setView(null);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TypeForm({ existing, onDone }) {
  const all = useAssetMaster();
  const assets = useAssets();
  const [f, setF] = useState(existing ? { ...existing } : blank());
  const [checklist, setChecklist] = useState(f.checklist.join("\n"));
  const [accessories, setAccessories] = useState(f.accessories.join(", "));
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const clash = all.find(
    (r) =>
      r.id !== existing?.id &&
      (r.code.toLowerCase() === f.code.trim().toLowerCase() ||
        r.name.toLowerCase() === f.name.trim().toLowerCase()),
  );
  // Assets reference their type by name — renaming a type in use orphaned every asset registered under it.
  const renameBlocked =
    !!existing && existing.name !== f.name.trim() && assets.some((a) => a.type === existing.name);
  const valid =
    f.code.trim() &&
    f.name.trim() &&
    !clash &&
    !renameBlocked &&
    f.usefulLifeYears >= 1 &&
    f.depreciationPct >= 0 &&
    f.depreciationPct <= 100;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{existing ? `Edit ${existing.name}` : "Add asset type"}</DialogTitle>
        <DialogDescription>
          Rules here drive the Asset Lifecycle screens — the register, issue form and return check.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Code" required>
          <Input
            value={f.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            placeholder="LT"
          />
        </Field>
        <Field label="Type name" required className="sm:col-span-1 lg:col-span-2">
          <Input
            value={f.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Laptop"
          />
        </Field>
        <Field label="Category">
          <Select value={f.kind} onValueChange={(v) => set({ kind: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description" className="sm:col-span-2 lg:col-span-4">
          <Input value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Useful life (years)">
          <Input
            type="number"
            min={1}
            value={f.usefulLifeYears}
            onChange={(e) =>
              set({
                usefulLifeYears: Number(e.target.value) || 1,
                depreciationPct: Math.round((100 / (Number(e.target.value) || 1)) * 100) / 100,
              })
            }
          />
        </Field>
        <Field label="Depreciation % p.a.">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={f.depreciationPct}
            onChange={(e) => set({ depreciationPct: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Custodian department">
          <Input value={f.custodianDept} onChange={(e) => set({ custodianDept: e.target.value })} />
        </Field>
        <Field label="Default return period (days, 0 = until separation)">
          <Input
            type="number"
            min={0}
            value={f.defaultReturnDays}
            onChange={(e) => set({ defaultReturnDays: Number(e.target.value) || 0 })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Switch checked={f.requiresSerial} onCheckedChange={(v) => set({ requiresSerial: v })} />{" "}
          Serial / IMEI / registration number is mandatory and verified at issue and return
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Switch checked={f.active} onCheckedChange={(v) => set({ active: v })} /> Active
          (available in the register and requests)
        </label>
        <Field
          label="Condition checklist — one item per line"
          className="sm:col-span-2"
          hint="Checked at issue and again at return"
        >
          <Textarea rows={6} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
        </Field>
        <Field label="Default accessories — comma separated" className="sm:col-span-2">
          <Textarea rows={6} value={accessories} onChange={(e) => setAccessories(e.target.value)} />
        </Field>
      </div>
      {(clash || renameBlocked) && (
        <div className="text-destructive text-xs">
          {clash
            ? `Code or name already used by ${clash.name} (${clash.code}).`
            : `Assets are registered under "${existing?.name}" — deactivate it and add a new type instead of renaming.`}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            upsertAssetType({
              ...(existing ? { id: existing.id } : {}),
              ...f,
              code: f.code.trim(),
              name: f.name.trim(),
              checklist: checklist
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              accessories: accessories
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
            toast.success(existing ? "Asset type updated" : "Asset type added");
            onDone();
          }}
        >
          {existing ? "Save" : "Add type"}
        </Button>
      </DialogFooter>
    </>
  );
}
