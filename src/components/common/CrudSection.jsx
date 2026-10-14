import { useState } from "react";
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
 * @typedef {Object} CrudField
 * @property {string} key
 * @property {string} label
 * @property {"text" | "textarea" | "select" | "date" | "number" | "file"} [type]
 * @property {string[]} [options]
 * @property {boolean} [required]
 * @property {string} [placeholder]
 * @property {boolean} [hideInTable] - Keep out of the list table (still captured by the form).
 * @property {boolean} [badge] - Render as a badge in the table.
 * @property {boolean} [full]
 */

/**
 * @typedef {Record<string, string> & { id: string }} CrudRow
 */

// Rows used to live in component state, so anything added in a master (job types, trainers, pay grades…) vanished on
// the next tab switch or reload. Each section now owns a browser-persisted store keyed by its id prefix + title; the
// server always renders the seed, so SSR markup stays stable.
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
/**
 * Read a master maintained with CrudSection from another screen (e.g. Candidate Sources in the Add-applicant form).
 * Pass the same idPrefix / title / seed as the master's CrudSection so both share one store.
 */
export function useCrudRows(idPrefix, title, seed) {
  return sectionStore(`${idPrefix}.${slugOf(title)}`, seed).use();
}
/** Active names of a CrudSection master (rows with status other than Inactive). */
export function useMasterNames(idPrefix, title, seed) {
  return useCrudRows(idPrefix, title, seed)
    .filter((r) => (r.status ?? "Active") !== "Inactive")
    .map((r) => r.name)
    .filter(Boolean);
}

/* Soft delete: a deleted master row goes to System Archive with enough context to be restored into its section. */
/**
 * Soft delete: a deleted master row goes to System Archive with enough context to be restored into its section.
 * @typedef {Object} CrudArchivePayload
 * @property {string} __crudSection
 * @property {CrudRow} row
 */
registerArchiveRestorer((rec) => {
  const p = rec.payload;
  if (!p || typeof p !== "object" || typeof p.__crudSection !== "string" || !p.row) return false;
  const store = sectionStore(p.__crudSection, []);
  if (!store.get().some((r) => r.id === p.row.id)) store.set((rows) => [p.row, ...rows]);
  return true;
});

/** Next free code for a prefix — a count-based code would repeat an existing one once a row has been deleted. */
function nextCode(prefix, rows) {
  const n =
    rows.reduce((m, r) => {
      const num = Number(r.id.startsWith(`${prefix}-`) ? r.id.slice(prefix.length + 1) : NaN);
      return Number.isFinite(num) ? Math.max(m, num) : m;
    }, 0) + 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
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
}) {
  const storeKey = `${idPrefix}.${slugOf(title)}`;
  const store = sectionStore(storeKey, seed);
  const rows = store.use();
  const setRows = store.set;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  /** id of the row being edited, or null when adding a new one. */
  const [editingId, setEditingId] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  // Number fields must hold a non-negative number (a negative seat count or fee used to save as typed).
  const badNumber = fields
    .filter((f) => f.type === "number" && (form[f.key] ?? "").trim() !== "")
    .some((f) => !(Number(form[f.key]) >= 0));
  const valid =
    fields.filter((f) => f.required).every((f) => (form[f.key] ?? "").trim() !== "") && !badNumber;

  function submit() {
    if (editingId) {
      setRows((p) =>
        p.map((r) => {
          if (r.id !== editingId) return r;
          const next = { ...r };
          fields.forEach((f) => {
            next[f.key] = (form[f.key] ?? "").trim();
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
    fields.forEach((f) => {
      row[f.key] = (form[f.key] ?? "").trim();
    });
    setRows((p) => [row, ...p]);
    setForm({});
    setOpen(false);
    toast.success(`${title} entry added`);
  }

  function startAdd() {
    setEditingId(null);
    setForm({});
    setOpen(true);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm(Object.fromEntries(fields.map((f) => [f.key, row[f.key] ?? ""])));
    setOpen(true);
  }

  function confirmDelete() {
    if (!deleteRow) return;
    // The System Archive promises every deletion lands there — this used to hard-delete the row.
    const label = deleteRow.name || deleteRow.title || deleteRow.id;
    archiveRecord({
      module: "Master Data",
      recordId: deleteRow.id,
      title: `${title} · ${label}`,
      summary: cols
        .slice(0, 3)
        .map((c) => deleteRow[c.key])
        .filter(Boolean)
        .join(" · "),
      payload: { __crudSection: storeKey, row: deleteRow },
    });
    setRows((p) => p.filter((r) => r.id !== deleteRow.id));
    toast.success(`${deleteRow.id} deleted — restorable from System Archive`);
    setDeleteRow(null);
  }

  const cols = fields.filter((f) => !f.hideInTable);

  const exportColumns = ["Code", ...cols.map((c) => c.label)];
  const exportRows = rows.map((r) => [r.id, ...cols.map((c) => r[c.key] || "—")]);

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
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) {
                  setEditingId(null);
                  setForm({});
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-emerald text-white" onClick={startAdd}>
                  <Plus className="h-4 w-4" /> {addLabel}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? `Edit ${editingId}` : addLabel}</DialogTitle>
                  <DialogDescription>
                    {editingId
                      ? `Updates this ${title.toLowerCase()} record.`
                      : `Adds a new entry to ${title.toLowerCase()}.`}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div
                      key={f.key}
                      className={`space-y-1.5 ${f.type === "textarea" || f.full ? "sm:col-span-2" : ""}`}
                    >
                      <Label className="text-muted-foreground text-xs font-medium">
                        {f.label} {f.required && <span className="text-destructive">*</span>}
                      </Label>
                      {f.type === "textarea" ? (
                        <Textarea
                          rows={3}
                          value={form[f.key] ?? ""}
                          onChange={(e) => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      ) : f.type === "select" ? (
                        <Select value={form[f.key] ?? ""} onValueChange={(v) => set(f.key, v)}>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={f.placeholder ?? `Select ${f.label.toLowerCase()}`}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(f.options ?? []).map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : f.type === "file" ? (
                        <Input
                          type="file"
                          onChange={(e) => {
                            captureFiles(e.target.files);
                            set(f.key, e.target.files?.[0]?.name ?? "");
                          }}
                        />
                      ) : (
                        <Input
                          type={
                            f.type === "date" ? "date" : f.type === "number" ? "number" : "text"
                          }
                          min={f.type === "number" ? 0 : undefined}
                          value={form[f.key] ?? ""}
                          onChange={(e) => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      )}
                    </div>
                  ))}
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
                    {editingId ? "Save changes" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View record */}
        <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{viewRow?.id}</DialogTitle>
              <DialogDescription>{title} record detail</DialogDescription>
            </DialogHeader>
            <dl className="divide-border divide-y text-sm">
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-3 gap-3 py-2">
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    {f.label}
                  </dt>
                  <dd className="col-span-2 break-words">{viewRow?.[f.key] || "—"}</dd>
                </div>
              ))}
            </dl>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewRow(null)}>
                Close
              </Button>
              <Button
                className="bg-gradient-emerald text-white"
                onClick={() => {
                  const r = viewRow;
                  setViewRow(null);
                  if (r) startEdit(r);
                }}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {deleteRow?.id}?</DialogTitle>
              <DialogDescription>
                This removes the record from {title.toLowerCase()} and moves it to System Archive,
                where it can be restored until the retention window purges it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteRow(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Code</th>
                {cols.map((c) => (
                  <th key={c.key} className="p-3 text-left">
                    {c.label}
                  </th>
                ))}
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="p-3">
                      {c.badge && r[c.key] ? (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary"
                        >
                          {r[c.key]}
                        </Badge>
                      ) : (
                        <span
                          className={
                            c.key === "name" || c.key === "title"
                              ? "font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {r[c.key] || "—"}
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
                        onClick={() => setViewRow(r)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Edit"
                        onClick={() => startEdit(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        title="Delete"
                        onClick={() => setDeleteRow(r)}
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
                    {emptyText ?? "Nothing here yet."}
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
