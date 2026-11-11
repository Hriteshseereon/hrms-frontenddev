import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Clock3,
  Shield,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

import { nextId } from "@/lib/store";
import { TIMESHEET_FIELDS } from "@/features/timesheets/data/timesheet-data";
import { useActiveOrgId } from "@/features/organization/data/group-data";

import {
  createTimesheetFormatApi,
  apiErrorMessage,
} from "@/features/attendance/data/attendanceMasterAdapters";

import { DEPARTMENT_NAMES } from "@/features/finance/data/finance-data";

import {
  RecordDetailDialog,
  clickableRow,
} from "@/components/common/RecordDetail";


function Head({ icon: Icon, title, desc, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-muted-foreground text-xs">{desc}</div>
        </div>
      </div>

      {children}
    </div>
  );
}


/** Name + description + status master backed by a shared store. */
export function NamedMasterTab({
  icon = Shield,
  title,
  desc,
  addLabel,
  prefix,
  store,
}) {
  const rows = store.use();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");

  function submit() {
    store.set((p) => [
      {
        id: nextId(prefix, p.length),
        name: name.trim(),
        description: description.trim(),
        status,
      },
      ...p,
    ]);

    setOpen(false);
    setName("");
    setDescription("");
    setStatus("Active");

    toast.success(`${title} entry added`);
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <Head icon={icon} title={title} desc={desc}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald text-white">
                <Plus className="h-4 w-4" />
                {addLabel}
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{addLabel}</DialogTitle>

                <DialogDescription>
                  Adds a new entry to {title.toLowerCase()}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Name <span className="text-destructive">*</span>
                  </Label>

                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Description
                  </Label>

                  <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Status
                  </Label>

                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  disabled={!name.trim()}
                  className="bg-gradient-emerald text-white"
                  onClick={submit}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Head>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="text-muted-foreground p-3 font-mono text-xs">
                    {r.id}
                  </td>

                  <td className="p-3 font-medium">{r.name}</td>

                  <td className="text-muted-foreground p-3">
                    {r.description || "—"}
                  </td>

                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


/* =========================================================
   TIMESHEET FORMATS
   ========================================================= */

export function TimesheetFormatsTab() {
  const orgId = useActiveOrgId();

  const api = useMemo(
    () => createTimesheetFormatApi(orgId),
    [orgId]
  );

  const [rows, setRows] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [department, setDepartment] = useState("");

  const [fields, setFields] = useState([
    "Task Name",
    "Description",
    "Start Time",
    "End Time",
    "Hours",
    "Status",
  ]);

  const [description, setDescription] = useState("");

  const [detail, setDetail] = useState(null);

  // Holds the record currently being edited.
  const [editing, setEditing] = useState(null);


  // GET /attendance-and-time/timesheet-formats
  const reload = useCallback(async () => {
    try {
      const data = await api.list();
      setRows(data);
    } catch (error) {
      console.error("Failed to load timesheet formats:", error);

      toast.error(
        apiErrorMessage(
          error,
          "Unable to load timesheet formats."
        )
      );
    }
  }, [api]);


  useEffect(() => {
    reload();
  }, [reload]);


  // Reset the form for Add Format.
  function resetForm() {
    setEditing(null);

    setName("");
    setFrequency("Daily");
    setDepartment("");

    setFields([
      "Task Name",
      "Description",
      "Start Time",
      "End Time",
      "Hours",
      "Status",
    ]);

    setDescription("");
  }


  // Add or Edit Timesheet Format.
  async function submit() {
    setSaving(true);

    const payload = {
      name: name.trim(),
      frequency,
      department: department || "All departments",
      fields,
      description: description.trim(),
      active: editing ? editing.active : true,
    };

    try {
      if (editing) {
        // PUT /attendance-and-time/timesheet-formats/{id}
        await api.update(editing._apiId, payload);

        toast.success("Timesheet format updated");
      } else {
        // POST /attendance-and-time/timesheet-formats
        await api.create(payload);

        toast.success("Timesheet format created");
      }

      setOpen(false);
      resetForm();

      await reload();
    } catch (error) {
      console.error("Failed to save timesheet format:", error);

      toast.error(
        apiErrorMessage(
          error,
          editing
            ? "Unable to update the timesheet format."
            : "Unable to create the timesheet format."
        )
      );
    } finally {
      setSaving(false);
    }
  }


  // Checkbox fields.
  const toggleField = (field, checked) => {
    setFields((previous) =>
      checked
        ? Array.from(new Set([...previous, field]))
        : previous.filter((item) => item !== field)
    );
  };


  // PATCH /attendance-and-time/timesheet-formats/{id}
  async function toggleActive(r, value) {
    try {
      await api.setActive(r._apiId, value);

      toast.success("Timesheet format status updated");

      await reload();
    } catch (error) {
      console.error("Failed to update status:", error);

      toast.error(
        apiErrorMessage(
          error,
          "Unable to update the status."
        )
      );
    }
  }


  // GET /attendance-and-time/timesheet-formats/{id}
  async function openDetail(r) {
    setDetail(r);

    try {
      const result = await api.getById(r._apiId);
      setDetail(result);
    } catch (error) {
      console.error("Failed to load timesheet format details:", error);

      toast.error(
        apiErrorMessage(
          error,
          "Unable to load timesheet format details."
        )
      );
    }
  }


  // VIEW button.
  async function handleView(r) {
    await openDetail(r);
  }


  // EDIT button.
  function handleEdit(r) {
    setDetail(null);

    setEditing(r);

    setName(r.name || "");
    setFrequency(r.frequency || "Daily");
    setDepartment(
      r.department === "All departments"
        ? ""
        : r.department || ""
    );

    setFields(Array.isArray(r.fields) ? r.fields : []);

    setDescription(r.description || "");

    setOpen(true);
  }


  // DELETE /attendance-and-time/timesheet-formats/{id}
  function handleDelete(r) {
    setDeleteTarget(r);
  }

  async function confirmDelete() {
    const r = deleteTarget;
    setDeleteTarget(null);

    if (!r) {
      return;
    }

    try {
      await api.remove(r._apiId);

      toast.success("Timesheet format deleted");

      await reload();
    } catch (error) {
      console.error("Failed to delete timesheet format:", error);

      toast.error(
        apiErrorMessage(
          error,
          "Unable to delete timesheet format."
        )
      );
    }
  }


  return (
    <Card className="shadow-card">
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete timesheet format?"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
      <CardContent className="p-6">
        <Head
          icon={Clock3}
          title="Timesheet Formats"
          desc="Define what employees must fill in their timesheets"
        >
          <Dialog
            open={open}
            onOpenChange={(value) => {
              setOpen(value);

              if (!value) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-gradient-emerald text-white"
                onClick={resetForm}
              >
                <Plus className="h-4 w-4" />
                Add Format
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>
                  {editing
                    ? "Edit Timesheet Format"
                    : "Add Timesheet Format"}
                </DialogTitle>

                <DialogDescription>
                  Employees will see exactly the fields selected here.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                {/* Format name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">
                    Format name{" "}
                    <span className="text-destructive">*</span>
                  </Label>

                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Daily Engineering Timesheet"
                  />
                </div>

                {/* Frequency */}
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Frequency
                  </Label>

                  <Select
                    value={frequency}
                    onValueChange={setFrequency}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {["Daily", "Weekly", "Monthly"].map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Department
                  </Label>

                  <Select
                    value={department}
                    onValueChange={setDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>

                    <SelectContent>
                      {DEPARTMENT_NAMES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fields */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">
                    Fields shown to employees
                  </Label>

                  <div className="border-border bg-muted/30 grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-3">
                    {TIMESHEET_FIELDS.map((field) => (
                      <label
                        key={field}
                        className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={fields.includes(field)}
                          onCheckedChange={(value) =>
                            toggleField(field, !!value)
                          }
                        />

                        {field}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">
                    Description
                  </Label>

                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  disabled={
                    !name.trim() ||
                    fields.length === 0 ||
                    saving
                  }
                  className="bg-gradient-emerald text-white"
                  onClick={submit}
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Update format"
                      : "Save format"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Head>


        {/* Timesheet Formats table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Frequency</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Fields</th>
                <th className="p-3 text-left">Active</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr
                  key={r._apiId || r.id}
                  className={`${clickableRow} align-top`}
                  onClick={() => openDetail(r)}
                >
                  {/* Code */}
                  <td className="text-muted-foreground p-3 font-mono text-xs">
                    {r.id}
                  </td>

                  {/* Name */}
                  <td className="p-3 font-medium">
                    {r.name}

                    <div className="text-muted-foreground text-xs font-normal">
                      {r.description}
                    </div>
                  </td>

                  {/* Frequency */}
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {r.frequency}
                    </Badge>
                  </td>

                  {/* Department */}
                  <td className="text-muted-foreground p-3">
                    {r.department}
                  </td>

                  {/* Fields */}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.fields || []).map((field) => (
                        <Badge
                          key={field}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </td>

                  {/* Active switch */}
                  <td
                    className="p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={r.active}
                      onCheckedChange={(value) =>
                        toggleActive(r, value)
                      }
                    />
                  </td>

                  {/* Action buttons */}
                  <td
                    className="p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      {/* View */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="View"
                        onClick={() => handleView(r)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Edit */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => handleEdit(r)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => handleDelete(r)}
                        className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted-foreground p-6 text-center"
                  >
                    No timesheet formats found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>


        {/* View details dialog */}
        {detail && (
          <RecordDetailDialog
            onClose={() => setDetail(null)}
            title={detail.name}
            subtitle={`${detail.id} · ${detail.frequency} · ${detail.department}`}
            badges={
              <>
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  {detail.frequency}
                </Badge>

                <Badge variant="outline">
                  {detail.active ? "Active" : "Inactive"}
                </Badge>
              </>
            }
            record={Object.fromEntries(
              Object.entries(detail).filter(
                ([key]) => key !== "_apiId"
              )
            )}
            labels={{
              id: "Code",
              fields: "Fields shown to employees",
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}