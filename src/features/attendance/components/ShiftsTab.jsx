
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Clock, Coffee, Eye, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { OFFICES } from "@/features/employees/data/hr-data";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import {
  createShiftApi,
  loadShiftOffices,
  apiErrorMessage,
} from "@/features/recruitment/data/recruitmentMasterAdapters";

export function ShiftsTab() {
  const orgId = useActiveOrgId();
  const api = useMemo(() => createShiftApi(orgId), [orgId]);

  const [rows, setRows] = useState([]);
  const [offices, setOffices] = useState(OFFICES);
  const [open, setOpen] = useState(false);

  // Shared dialog for viewing and editing a shift.
  const [actionOpen, setActionOpen] = useState(false);
  const [actionMode, setActionMode] = useState("view");
  const [selectedShift, setSelectedShift] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // GET /attendance/shifts
  const reload = useCallback(async () => {
    try {
      setRows(await api.list());
    } catch (error) {
      console.error("Failed to load shifts:", error);
      toast.error(apiErrorMessage(error, "Unable to load shifts."));
    }
  }, [api]);

  useEffect(() => {
    reload();
  }, [reload]);

  // GET /attendance/shifts/offices/dropdown
  useEffect(() => {
    let alive = true;

    loadShiftOffices(orgId)
      .then((list) => {
        if (alive && list.length) setOffices(list);
      })
      .catch((error) => {
        console.error("Failed to load shift offices:", error);
      });

    return () => {
      alive = false;
    };
  }, [orgId]);

  // POST /attendance/shifts
  const handleCreate = async (form) => {
    try {
      const row = await api.create(form);
      setOpen(false);
      toast.success(`Shift "${row.name}" created successfully.`);
      await reload();
    } catch (error) {
      console.error("Failed to create shift:", error);
      toast.error(apiErrorMessage(error, "Unable to create the shift."));
    }
  };

  // GET /attendance/shifts/{shift_id}
  const handleView = async (shift) => {
    setActionMode("view");
    setSelectedShift(shift);
    setActionOpen(true);
    setLoadingDetails(true);

    try {
      const freshShift = await api.getById(shift._apiId);
      setSelectedShift(freshShift);
    } catch (error) {
      console.error("Failed to load shift details:", error);
      toast.error(apiErrorMessage(error, "Unable to load shift details."));
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open the edit form with the selected card's existing values.
  const handleEdit = async (shift) => {
    setActionMode("edit");
    setSelectedShift(shift);
    setActionOpen(true);
    setLoadingDetails(true);

    try {
      const freshShift = await api.getById(shift._apiId);
      setSelectedShift(freshShift);
    } catch (error) {
      console.error("Failed to load shift for editing:", error);
      toast.error(apiErrorMessage(error, "Unable to load shift for editing."));
    } finally {
      setLoadingDetails(false);
    }
  };

  // PUT /attendance/shifts/{shift_id}
  const handleUpdate = async (form) => {
    if (!selectedShift?._apiId) {
      toast.error("The shift ID is missing.");
      return;
    }

    try {
      await api.update(selectedShift._apiId, form);
      setActionOpen(false);
      setSelectedShift(null);
      toast.success("Shift updated successfully.");
      await reload();
    } catch (error) {
      console.error("Failed to update shift:", error);
      toast.error(apiErrorMessage(error, "Unable to update the shift."));
      throw error;
    }
  };

  // DELETE /attendance/shifts/{shift_id}
  const handleDelete = async (shift) => {
    if (!shift?._apiId || deletingId) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${shift.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(shift._apiId);

    try {
      await api.remove(shift._apiId);
      toast.success(`Shift "${shift.name}" deleted successfully.`);
      await reload();
    } catch (error) {
      console.error("Failed to delete shift:", error);
      toast.error(apiErrorMessage(error, "Unable to delete the shift."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="text-muted-foreground text-sm">
            {rows.length} shifts configured ·{" "}
            {rows.filter((s) => s.breakEnabled).length} with scheduled breaks
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-gradient-emerald shadow-premium ml-auto text-white"
              >
                <Plus className="h-4 w-4" /> New Shift
              </Button>
            </DialogTrigger>

            <NewShiftDialog
              existing={rows}
              offices={offices}
              onSubmit={handleCreate}
            />
          </Dialog>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s) => (
         
<Card key={s._apiId ?? s.id} className="shadow-card">
  
<CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
  {/* Shift name and office */}
  <div className="min-w-[150px] flex-1">
    <div className="font-semibold text-sm">{s.name}</div>
    <div className="text-muted-foreground text-xs">
      {s.id} · {s.office}
    </div>
  </div>

  {/* Staff count */}
  <Badge
    variant="outline"
    className="border-primary/30 bg-primary/10 text-primary"
  >
    {s.employees} staff
  </Badge>

  {/* Shift timing */}
  <div className="flex items-center gap-2 text-sm">
    <Clock className="text-primary h-4 w-4 shrink-0" />
    <span className="font-medium whitespace-nowrap">
      {s.start} — {s.end}
    </span>
  </div>

  {/* Break timing */}
  <div className="text-muted-foreground flex items-center gap-2 text-sm">
    <Coffee className="h-4 w-4 shrink-0" />
    <span>
      {s.breakEnabled
        ? `Break ${s.breakStart} — ${s.breakEnd}`
        : "No scheduled break"}
    </span>
  </div>

  {/* View, Edit and Delete buttons */}
  <div className="flex shrink-0 items-center gap-1">
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title="View shift"
      onClick={() => handleView(s)}
    >
      <Eye className="h-4 w-4" />
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title="Edit shift"
      onClick={() => handleEdit(s)}
    >
      <Pencil className="h-4 w-4" />
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
      title="Delete shift"
      disabled={deletingId === s._apiId}
      onClick={() => handleDelete(s)}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
</CardContent>

</Card>

        ))}
      </div>

      {/* Shared View / Edit dialog */}
      <Dialog
        open={actionOpen}
        onOpenChange={(nextOpen) => {
          if (!loadingDetails) {
            setActionOpen(nextOpen);
            if (!nextOpen) setSelectedShift(null);
          }
        }}
      >
        {actionMode === "view" ? (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Shift Details</DialogTitle>
              <DialogDescription>
                View the selected shift configuration.
              </DialogDescription>
            </DialogHeader>

            {loadingDetails ? (
              <p className="text-muted-foreground py-6 text-sm">
                Loading shift details...
              </p>
            ) : selectedShift ? (
              <div className="space-y-4 py-2">
                <DetailRow label="Shift Code / ID" value={selectedShift.id} />
                <DetailRow label="Shift Name" value={selectedShift.name} />
                <DetailRow label="Office" value={selectedShift.office || "—"} />
                <DetailRow
                  label="Start Time"
                  value={selectedShift.start || "—"}
                />
                <DetailRow
                  label="End Time"
                  value={selectedShift.end || "—"}
                />
                <DetailRow
                  label="Break Enabled"
                  value={selectedShift.breakEnabled ? "Yes" : "No"}
                />

                {selectedShift.breakEnabled && (
                  <>
                    <DetailRow
                      label="Break Start"
                      value={selectedShift.breakStart || "—"}
                    />
                    <DetailRow
                      label="Break End"
                      value={selectedShift.breakEnd || "—"}
                    />
                  </>
                )}

                <DetailRow
                  label="Assigned Employees"
                  value={selectedShift.employees ?? 0}
                />
              </div>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setActionOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : (
          !loadingDetails &&
          selectedShift && (
            <NewShiftDialog
              key={selectedShift._apiId}
              mode="edit"
              initial={selectedShift}
              existing={rows.filter(
                (r) => r._apiId !== selectedShift._apiId
              )}
              offices={offices}
              onSubmit={handleUpdate}
            />
          )
        )}
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

const mins = (t) => {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + m;
};

function NewShiftDialog({
  onSubmit,
  existing,
  offices,
  mode = "create",
  initial = null,
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [office, setOffice] = useState(initial?.office ?? "");
  const [start, setStart] = useState(initial?.start ?? "09:30");
  const [end, setEnd] = useState(initial?.end ?? "18:30");
  const [breakEnabled, setBreakEnabled] = useState(
    initial?.breakEnabled ?? true
  );
  const [breakStart, setBreakStart] = useState(
    initial?.breakStart || "13:00"
  );
  const [breakEnd, setBreakEnd] = useState(initial?.breakEnd || "13:45");
  const [saving, setSaving] = useState(false);

  const span =
    start && end ? (mins(end) - mins(start) + 1440) % 1440 : 0;

  const inShift = (t) =>
    (mins(t) - mins(start) + 1440) % 1440 <= span;

  const duplicate = existing.some(
    (x) => x.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const error =
    !start || !end
      ? ""
      : span === 0
        ? "Start and end time cannot be the same."
        : breakEnabled &&
            breakStart &&
            breakEnd &&
            (!inShift(breakStart) ||
              !inShift(breakEnd) ||
              (mins(breakEnd) - mins(breakStart) + 1440) % 1440 >= span ||
              breakStart === breakEnd)
          ? "The break must fall inside the shift and end after it starts."
          : duplicate
            ? "A shift with this name already exists."
            : "";

  const valid =
    name.trim() &&
    office &&
    start &&
    end &&
    (!breakEnabled || (breakStart && breakEnd)) &&
    !error;

  const editing = mode === "edit";

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit Shift" : "Create Shift"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Update the shift timings and break window."
            : "Define shift timings and an optional break window."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">
            Shift name *
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Evening Shift"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">
            Office *
          </Label>
          <Select value={office} onValueChange={setOffice}>
            <SelectTrigger>
              <SelectValue placeholder="Select office" />
            </SelectTrigger>
            <SelectContent>
              {offices.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">
              Start time *
            </Label>
            <Input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">
              End time *
            </Label>
            <Input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="border-border space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Break time</div>
              <div className="text-muted-foreground text-xs">
                Add a break window in between the shift
              </div>
            </div>
            <Switch
              checked={breakEnabled}
              onCheckedChange={setBreakEnabled}
            />
          </div>

          {breakEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">
                  Break start
                </Label>
                <Input
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">
                  Break end
                </Label>
                <Input
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-destructive text-xs">{error}</div>
      )}

      <DialogFooter>
        <Button
          disabled={!valid || saving}
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={async () => {
            setSaving(true);
            try {
              await onSubmit({
                name: name.trim(),
                office,
                start,
                end,
                breakEnabled,
                breakStart: breakEnabled ? breakStart : "",
                breakEnd: breakEnabled ? breakEnd : "",
              });
            } catch {
              // The parent displays the API error. Keep the form open.
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving
            ? "Saving..."
            : editing
              ? "Save Changes"
              : "Create Shift"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
