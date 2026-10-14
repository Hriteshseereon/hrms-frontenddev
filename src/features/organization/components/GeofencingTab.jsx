import { useState } from "react";
import { MapPinned, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSharedList } from "@/lib/shared-list";
import { GEOFENCE_RULES } from "@/features/organization/data/master-data";
import { archiveRecord } from "@/features/administration/data/archive-data";
import { exportReportPdf } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

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

export function GeofencingTab() {
  const [rows, setRows] = useSharedList("geofence-rules", GEOFENCE_RULES);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius: "150",
    appliesTo: "All employees",
    enforced: true,
    allowOverrideWithReason: true,
  });

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  // Coordinates are optional, but when given they must be real ones — an enforced fence at "abc, xyz" blocks every punch.
  const coordOk = (v, max) =>
    !v.trim() || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max);
  const coordsValid =
    coordOk(form.latitude, 90) &&
    coordOk(form.longitude, 180) &&
    !!form.latitude.trim() === !!form.longitude.trim();
  const valid = form.name.trim() && form.address.trim() && Number(form.radius) > 0 && coordsValid;

  function submit() {
    setRows((p) => [
      {
        // Highest existing number + 1 — a count-based id repeated an existing one after a fence was archived.
        id: `GEO-${String(p.reduce((m, r) => Math.max(m, Number(r.id.replace(/^GEO-/, "")) || 0), 0) + 1).padStart(2, "0")}`,
        name: form.name.trim(),
        address: form.address.trim(),
        latitude: form.latitude.trim() || "—",
        longitude: form.longitude.trim() || "—",
        radius: Number(form.radius),
        appliesTo: form.appliesTo,
        enforced: form.enforced,
        allowOverrideWithReason: form.allowOverrideWithReason,
        active: true,
      },
      ...p,
    ]);
    setOpen(false);
    toast.success(
      `Geofence "${form.name.trim()}" created — attendance is now bound to this location`,
    );
    setForm({
      name: "",
      address: "",
      latitude: "",
      longitude: "",
      radius: "150",
      appliesTo: "All employees",
      enforced: true,
      allowOverrideWithReason: true,
    });
  }

  function remove(r) {
    archiveRecord({
      module: "Master Data",
      recordId: r.id,
      title: `Geofence — ${r.name}`,
      summary: `${r.address} · ${r.radius} m radius`,
      reason: "Geofence removed from Master Data",
      payload: r,
    });
    setRows((p) => p.filter((x) => x.id !== r.id));
    toast.success(`${r.name} archived — restore it from System Archive & Soft Delete`);
  }

  function downloadPdf() {
    const ok = exportReportPdf({
      title: "Geofencing Configuration",
      subtitle: "Attendance location fences — Seereon Consulting & IT Services",
      summary: [
        { label: "Fences", value: String(rows.length) },
        { label: "Enforced", value: String(rows.filter((r) => r.enforced).length) },
        { label: "Active", value: String(rows.filter((r) => r.active).length) },
      ],
      columns: [
        "ID",
        "Fence",
        "Address",
        "Latitude",
        "Longitude",
        "Radius (m)",
        "Applies to",
        "Enforced",
        "Override",
        "Status",
      ],
      rows: rows.map((r) => [
        r.id,
        r.name,
        r.address,
        r.latitude,
        r.longitude,
        r.radius,
        r.appliesTo,
        r.enforced ? "Yes" : "No",
        r.allowOverrideWithReason ? "With reason" : "Blocked",
        r.active ? "Active" : "Inactive",
      ]),
    });
    toast[ok ? "success" : "error"](
      ok ? "Geofencing report ready — save as PDF" : "Allow pop-ups to download the report",
    );
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Geofencing</div>
              <div className="text-muted-foreground text-xs">
                Bind attendance marking to approved Seereon offices and client sites, with a radius
                per location
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-emerald text-white">
                  <Plus className="h-4 w-4" /> Add Geofence
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add a geofence</DialogTitle>
                  <DialogDescription>
                    Employees can punch attendance only when they are inside an enforced fence.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Location name" required>
                      <Input
                        value={form.name}
                        onChange={(e) => patch({ name: e.target.value })}
                        placeholder="e.g. Seereon Hyderabad Office"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Address" required>
                      <Input
                        value={form.address}
                        onChange={(e) => patch({ address: e.target.value })}
                        placeholder="Building, area, city, PIN"
                      />
                    </Field>
                  </div>
                  <Field label="Latitude">
                    <Input
                      value={form.latitude}
                      onChange={(e) => patch({ latitude: e.target.value })}
                      placeholder="17.4400"
                    />
                  </Field>
                  <Field label="Longitude">
                    <Input
                      value={form.longitude}
                      onChange={(e) => patch({ longitude: e.target.value })}
                      placeholder="78.3800"
                    />
                  </Field>
                  {!coordsValid && (
                    <p className="text-destructive text-xs sm:col-span-2">
                      Enter both coordinates as decimal degrees (latitude −90…90, longitude
                      −180…180), or leave both blank.
                    </p>
                  )}
                  <Field label="Radius (metres)" required>
                    <Input
                      type="number"
                      min={10}
                      value={form.radius}
                      onChange={(e) => patch({ radius: e.target.value })}
                    />
                  </Field>
                  <Field label="Applies to">
                    <Input
                      value={form.appliesTo}
                      onChange={(e) => patch({ appliesTo: e.target.value })}
                    />
                  </Field>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">Enforce fence</div>
                        <div className="text-muted-foreground text-xs">
                          Block punches made outside the radius
                        </div>
                      </div>
                      <Switch
                        checked={form.enforced}
                        onCheckedChange={(v) => patch({ enforced: v })}
                      />
                    </div>
                    <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">Allow override with reason</div>
                        <div className="text-muted-foreground text-xs">
                          Employee may punch outside, flagged for HR review
                        </div>
                      </div>
                      <Switch
                        checked={form.allowOverrideWithReason}
                        onCheckedChange={(v) => patch({ allowOverrideWithReason: v })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={!valid}
                    className="bg-gradient-emerald text-white"
                    onClick={submit}
                  >
                    Save geofence
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Location</th>
                <th className="p-3 text-left">Coordinates</th>
                <th className="p-3 text-right">Radius</th>
                <th className="p-3 text-left">Applies to</th>
                <th className="p-3 text-left">Enforced</th>
                <th className="p-3 text-left">Active</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.id} className={`${clickableRow} align-top`} onClick={() => setDetail(r)}>
                  <td className="p-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground text-xs">{r.address}</div>
                    {r.allowOverrideWithReason && (
                      <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold mt-1">
                        Override with reason
                      </Badge>
                    )}
                  </td>
                  <td className="text-muted-foreground p-3 font-mono text-xs">
                    {r.latitude}, {r.longitude}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {r.radius ? `${r.radius} m` : "—"}
                  </td>
                  <td className="text-muted-foreground p-3">{r.appliesTo}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={r.enforced}
                      onCheckedChange={(v) => {
                        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, enforced: v } : x)));
                        toast.success(`${r.name} — enforcement ${v ? "enabled" : "disabled"}`);
                      }}
                    />
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => {
                        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: v } : x)));
                        toast.success(`${r.name} is now ${v ? "active" : "inactive"}`);
                      }}
                    />
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive h-8 w-8"
                      aria-label={`Delete ${r.name}`}
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground p-10 text-center">
                    No geofences configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {detail && (
          <RecordDetailDialog
            onClose={() => setDetail(null)}
            title={detail.name}
            subtitle={`${detail.id} · ${detail.address}`}
            badges={
              <>
                <Badge
                  variant="outline"
                  className={detail.active ? "border-primary/30 bg-primary/10 text-primary" : ""}
                >
                  {detail.active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">{detail.enforced ? "Enforced" : "Not enforced"}</Badge>
              </>
            }
            record={{ ...detail, radius: detail.radius ? `${detail.radius} m` : "—" }}
            labels={{
              id: "Geofence ID",
              appliesTo: "Applies to",
              allowOverrideWithReason: "Override allowed with reason",
            }}
            sections={[
              {
                title: "Location",
                keys: ["id", "name", "address", "latitude", "longitude", "radius"],
              },
              {
                title: "Rule",
                keys: ["appliesTo", "enforced", "allowOverrideWithReason", "active"],
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
