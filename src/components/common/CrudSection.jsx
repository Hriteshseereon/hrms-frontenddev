
import { useEffect, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Plus, Eye, Pencil, Trash2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import { createPersistentStore } from "@/lib/persist";
import {
  archiveRecord,
  registerArchiveRestorer,
} from "@/features/administration/data/archive-data";

/**
 * API support is optional.
 *
 * Without an api prop, CrudSection retains its existing local-storage
 * behavior.
 *
 * With an api prop, it supports:
 * - GET list
 * - GET by ID
 * - POST create
 * - PUT full update
 * - PATCH partial update
 * - DELETE
 */

const sectionStores = new Map();

function sectionStore(key, seed) {
  let store = sectionStores.get(key);

  if (!store) {
    store = createPersistentStore(`seereon.crud.${key}.v1`, seed);
    sectionStores.set(key, store);
  }

  return store;
}

const slugOf = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function useCrudRows(idPrefix, title, seed) {
  return sectionStore(`${idPrefix}.${slugOf(title)}`, seed).use();
}

export function useMasterNames(idPrefix, title, seed) {
  return useCrudRows(idPrefix, title, seed)
    .filter((r) => (r.status ?? "Active") !== "Inactive")
    .map((r) => r.name)
    .filter(Boolean);
}

registerArchiveRestorer((rec) => {
  const p = rec.payload;

  if (
    !p ||
    typeof p !== "object" ||
    typeof p.__crudSection !== "string" ||
    !p.row
  ) {
    return false;
  }

  const store = sectionStore(p.__crudSection, []);

  if (!store.get().some((r) => r.id === p.row.id)) {
    store.set((rows) => [p.row, ...rows]);
  }

  return true;
});

function nextCode(prefix, rows) {
  const n =
    rows.reduce((m, r) => {
      const num = Number(
        r.id.startsWith(`${prefix}-`) ? r.id.slice(prefix.length + 1) : NaN,
      );

      return Number.isFinite(num) ? Math.max(m, num) : m;
    }, 0) + 1;

  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/**
 * Supports common API list response shapes:
 * - [...]
 * - { items: [...] }
 * - { results: [...] }
 * - { data: [...] }
 * - { data: { items: [...] } }
 */
function extractApiRows(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data?.results)) return data.data.results;

  return null;
}

/**
 * Supports detail response shapes:
 * - { id: "...", ... }
 * - { item: { id: "...", ... } }
 * - { data: { id: "...", ... } }
 */
function extractApiRecord(response) {
  const data = response?.data;

  if (!data || typeof data !== "object") return null;
  if (data.data && !Array.isArray(data.data)) return data.data;
  if (data.item && typeof data.item === "object") return data.item;

  return data;
}

export function CrudSection({
  icon: Icon,
  title,
  desc,
  addLabel,
  idPrefix,
  fields,
  seed,
  emptyText,
  api,
}) {
  const storeKey = `${idPrefix}.${slugOf(title)}`;
  const store = sectionStore(storeKey, seed);
  const storedRows = store.use();
  const setStoredRows = store.set;

  const [apiRows, setApiRows] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  // When api is supplied, display server data.
  // Otherwise, use the original browser-persisted data.
  const rows = api ? apiRows : storedRows;
  const setRows = api ? setApiRows : setStoredRows;

  async function loadApiRows(showError = true) {
    if (!api?.list) return;

    setApiLoading(true);

    try {
      const response = await api.list();
      const records = extractApiRows(response);

      if (!records) {
        throw new Error("The API response did not contain a list of records.");
      }

      setApiRows(records.map((record) => api.fromApi(record)));
    } catch (error) {
      console.error(`Failed to load ${title}:`, error);

      if (showError) {
        toast.error(
          error?.response?.data?.detail ||
            error?.response?.data?.message ||
            `Unable to load ${title}.`,
        );
      }
    } finally {
      setApiLoading(false);
    }
  }

  useEffect(() => {
    if (api) {
      loadApiRows();
    }

    // The API configuration is supplied by the parent component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const set = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const badNumber = fields
    .filter(
      (field) =>
        field.type === "number" &&
        String(form[field.key] ?? "").trim() !== "",
    )
    .some((field) => !(Number(form[field.key]) >= 0));

  const valid =
    fields
      .filter((field) => field.required)
      .every((field) => String(form[field.key] ?? "").trim() !== "") &&
    !badNumber;

  /**
   * GET /pay-grades/{id}
   *
   * Triggered when the user clicks the View button.
   * If api.getById is not configured, the existing list row is displayed.
   */
  async function openView(row) {
    setViewRow(row);

    if (!api?.getById) return;

    try {
      const response = await api.getById(row._apiId);
      const record = extractApiRecord(response);

      if (!record) {
        throw new Error("No record returned by the API.");
      }

      setViewRow(api.fromApi(record));
    } catch (error) {
      console.error(`Failed to load ${title} details:`, error);

      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          `Unable to load ${title} details.`,
      );
    }
  }

  /**
   * POST creates a new record.
   * PUT updates the complete record.
   * PATCH updates only the fields returned by api.toPatchPayload().
   */
  async function submit(mode = "put") {
    if (!valid) return;

    try {
      if (api) {
        if (editingId) {
          const existingRow = rows.find((row) => row.id === editingId);

          if (!existingRow) {
            toast.error("The selected record could not be found.");
            return;
          }

          if (mode === "patch") {
            if (!api.patch || !api.toPatchPayload) {
              toast.error("PATCH is not configured for this section.");
              return;
            }

            const payload = api.toPatchPayload(form, existingRow);

            if (Object.keys(payload).length === 0) {
              toast.info("No changes to update.");
              return;
            }

            await api.patch(existingRow._apiId, payload);
            toast.success(`${title} entry partially updated`);
          } else {
            const payload = api.toPayload(form);

            await api.update(existingRow._apiId, payload);
            toast.success(`${title} entry updated`);
          }
        } else {
          const payload = api.toPayload(form);

          await api.create(payload);
          toast.success(`${title} entry added`);
        }

        setOpen(false);
        setForm({});
        setEditingId(null);

        // Reload server data after a successful write.
        await loadApiRows(false);
        return;
      }

      // Original local-store behavior for sections without an API.
      if (editingId) {
        setRows((previous) =>
          previous.map((row) => {
            if (row.id !== editingId) return row;

            const next = { ...row };

            fields.forEach((field) => {
              next[field.key] = String(form[field.key] ?? "").trim();
            });

            return next;
          }),
        );

        setForm({});
        setEditingId(null);
        setOpen(false);
        toast.success(`${title} entry updated`);
        return;
      }

      const row = { id: nextCode(idPrefix, rows) };

      fields.forEach((field) => {
        row[field.key] = String(form[field.key] ?? "").trim();
      });

      setRows((previous) => [row, ...previous]);
      setForm({});
      setOpen(false);
      toast.success(`${title} entry added`);
    } catch (error) {
      console.error(`Failed to save ${title}:`, error);

      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          `Unable to save ${title}. Please try again.`,
      );
    }
  }

  function startAdd() {
    setEditingId(null);
    setForm({});
    setOpen(true);
  }

  function startEdit(row) {
    setEditingId(row.id);

    setForm(
      Object.fromEntries(
        fields.map((field) => [field.key, row[field.key] ?? ""]),
      ),
    );

    setOpen(true);
  }

  async function confirmDelete() {
    if (!deleteRow) return;

    const rowToDelete = deleteRow;

    try {
      if (api) {
        await api.remove(rowToDelete._apiId);

        setRows((previous) =>
          previous.filter((row) => row.id !== rowToDelete.id),
        );

        toast.success(`${title} entry deleted`);
        setDeleteRow(null);
        return;
      }

      const label =
        rowToDelete.name || rowToDelete.title || rowToDelete.id;

      archiveRecord({
        module: "Master Data",
        recordId: rowToDelete.id,
        title: `${title} · ${label}`,
        summary: cols
          .slice(0, 3)
          .map((column) => rowToDelete[column.key])
          .filter(Boolean)
          .join(" · "),
        payload: { __crudSection: storeKey, row: rowToDelete },
      });

      setRows((previous) =>
        previous.filter((row) => row.id !== rowToDelete.id),
      );

      toast.success(
        `${rowToDelete.id} deleted — restorable from System Archive`,
      );

      setDeleteRow(null);
    } catch (error) {
      console.error(`Failed to delete ${title}:`, error);

      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          `Unable to delete ${title}. Please try again.`,
      );
    }
  }

  const cols = fields.filter((field) => !field.hideInTable);

  const exportColumns = ["Code", ...cols.map((column) => column.label)];

  const exportRows = rows.map((row) => [
    row.id,
    ...cols.map((column) => row[column.key] || "—"),
  ]);

  function downloadPdf() {
    const ok = exportReportPdf({
      title,
      subtitle: desc,
      summary: [{ label: "Records", value: String(rows.length) }],
      columns: exportColumns,
      rows: exportRows,
    });

    if (ok) toast.success(`${title} PDF ready in the print dialog`);
    else toast.error("Allow pop-ups to generate the PDF");
  }

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                exportCsv(slugOf(title), exportColumns, exportRows);
                toast.success("CSV exported");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>

            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <FileText className="h-4 w-4" /> PDF
            </Button>

            <Dialog
              open={open}
              onOpenChange={(value) => {
                setOpen(value);

                if (!value) {
                  setEditingId(null);
                  setForm({});
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  onClick={startAdd}
                >
                  <Plus className="h-4 w-4" /> {addLabel}
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? `Edit ${editingId}` : addLabel}
                  </DialogTitle>

                  <DialogDescription>
                    {editingId
                      ? `Updates this ${title.toLowerCase()} record.`
                      : `Adds a new entry to ${title.toLowerCase()}.`}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      className={`space-y-1.5 ${
                        field.type === "textarea" || field.full
                          ? "sm:col-span-2"
                          : ""
                      }`}
                    >
                      <Label className="text-muted-foreground text-xs font-medium">
                        {field.label}{" "}
                        {field.required && (
                          <span className="text-destructive">*</span>
                        )}
                      </Label>

                      {field.type === "textarea" ? (
                        <Textarea
                          rows={3}
                          value={form[field.key] ?? ""}
                          onChange={(event) =>
                            set(field.key, event.target.value)
                          }
                          placeholder={field.placeholder}
                        />
                      ) : field.type === "select" ? (
                        <Select
                          value={form[field.key] ?? ""}
                          onValueChange={(value) =>
                            set(field.key, value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                field.placeholder ??
                                `Select ${field.label.toLowerCase()}`
                              }
                            />
                          </SelectTrigger>

                          <SelectContent>
                            {(field.options ?? []).map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.type === "file" ? (
                        <Input
                          type="file"
                          onChange={(event) => {
                            captureFiles(event.target.files);

                            set(
                              field.key,
                              event.target.files?.[0]?.name ?? "",
                            );
                          }}
                        />
                      ) : (
                        <Input
                          type={
                            field.type === "date"
                              ? "date"
                              : field.type === "number"
                                ? "number"
                                : "text"
                          }
                          min={field.type === "number" ? 0 : undefined}
                          value={form[field.key] ?? ""}
                          onChange={(event) =>
                            set(field.key, event.target.value)
                          }
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <DialogFooter className="flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>

                  {/* PATCH: send only fields that changed */}
                  {editingId && api?.patch && api?.toPatchPayload && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!valid}
                      onClick={() => submit("patch")}
                    >
                      Save changed fields (PATCH)
                    </Button>
                  )}

                  {/* PUT: send the complete record */}
                  <Button
                    type="button"
                    disabled={!valid}
                    className="bg-gradient-emerald text-white"
                    onClick={() => submit("put")}
                  >
                    {editingId ? "Save all changes (PUT)" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View record dialog */}
        <Dialog
          open={!!viewRow}
          onOpenChange={(value) => !value && setViewRow(null)}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{viewRow?.id}</DialogTitle>
              <DialogDescription>
                {title} record detail
              </DialogDescription>
            </DialogHeader>

            <dl className="divide-border divide-y text-sm">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className="grid grid-cols-3 gap-3 py-2"
                >
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    {field.label}
                  </dt>

                  <dd className="col-span-2 break-words">
                    {viewRow?.[field.key] || "—"}
                  </dd>
                </div>
              ))}
            </dl>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setViewRow(null)}
              >
                Close
              </Button>

              <Button
                className="bg-gradient-emerald text-white"
                onClick={() => {
                  const row = viewRow;
                  setViewRow(null);

                  if (row) startEdit(row);
                }}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog
          open={!!deleteRow}
          onOpenChange={(value) => !value && setDeleteRow(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Delete {deleteRow?.id}?
              </DialogTitle>

              <DialogDescription>
                This removes the record from {title.toLowerCase()} and moves it
                to System Archive, where it can be restored until the retention
                window purges it.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteRow(null)}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={confirmDelete}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Records table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Code</th>

                {cols.map((column) => (
                  <th key={column.key} className="p-3 text-left">
                    {column.label}
                  </th>
                ))}

                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-border divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="text-muted-foreground p-3 font-mono text-xs">
                    {row.id}
                  </td>

                  {cols.map((column) => (
                    <td key={column.key} className="p-3">
                      {column.badge && row[column.key] ? (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary"
                        >
                          {row[column.key]}
                        </Badge>
                      ) : (
                        <span
                          className={
                            column.key === "name" ||
                            column.key === "title"
                              ? "font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {row[column.key] || "—"}
                        </span>
                      )}
                    </td>
                  ))}

                  <td className="p-3">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="View"
                        onClick={() => openView(row)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Edit"
                        onClick={() => startEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        title="Delete"
                        onClick={() => setDeleteRow(row)}
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
                    colSpan={cols.length + 2}
                    className="text-muted-foreground p-10 text-center text-sm"
                  >
                    {apiLoading
                      ? "Loading..."
                      : emptyText ?? "Nothing here yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
