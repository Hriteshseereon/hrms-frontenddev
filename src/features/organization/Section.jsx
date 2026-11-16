// Department Section master (Master Data → Organisation → Department Section).
// Company / branch scope is attached to every request by the axios scope interceptor.
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  X,
  Download,
  Users,
  Network,
  LoaderCircle,
} from "lucide-react";

import sectionApi from "@/api/departmentSectionApi";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { nameError } from "@/lib/name-validation";

const toSection = (raw) => ({
  id: raw.id,
  name: raw.section_name ?? "",
  code: raw.section_code ?? "",
});

const toList = (data) =>
  Array.isArray(data) ? data : (data?.items ?? data?.results ?? data?.data ?? []);

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
  if (typeof detail === "string") return detail;
  return error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
}

const inputClass =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";
const actionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";
const deleteButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-2xl border border-border bg-card text-card-foreground shadow-sm";
const mutedClass = "text-muted-foreground";

function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close popup"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <X size={19} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
        )}
      </section>
    </div>
  );
}

export default function Section() {
  const [items, setItems] = useState([]);
  const [sectionName, setSectionName] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    setPageError("");
    try {
      const res = await sectionApi.list();
      setItems(toList(res.data).map(toSection));
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q),
    );
  }, [items, search]);

  function resetForm() {
    setSectionName("");
    setSectionCode("");
    setEditingId(null);
    setError("");
  }

  function openAddForm() {
    resetForm();
    setPageError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const name = sectionName.trim();
    const code = sectionCode.trim().toUpperCase();

    if (!name) {
      setError("Section name is required.");
      return;
    }
    if (!code) {
      setError("Section code is required.");
      return;
    }

    const nameProblem = nameError(name, "Section name");
    if (nameProblem) {
      setError(nameProblem);
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
      setError("Section code can only contain letters, digits, - and _.");
      return;
    }

    const others = items.filter((i) => String(i.id) !== String(editingId));
    if (others.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      setError("This section name already exists.");
      return;
    }
    if (others.some((i) => i.code.toLowerCase() === code.toLowerCase())) {
      setError("This section code already exists.");
      return;
    }

    const body = { section_name: name, section_code: code };
    setSaving(true);
    setError("");
    setPageError("");
    try {
      if (editingId !== null) await sectionApi.update(editingId, body);
      else await sectionApi.create(body);
      closeForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setSectionName(item.name);
    setSectionCode(item.code);
    setEditingId(item.id);
    setError("");
    setPageError("");
    setViewItem(null);
    setShowForm(true);
  }

  async function handleView(item) {
    setViewItem(null);
    setViewLoading(true);
    setPageError("");
    try {
      const res = await sectionApi.get(item.id);
      setViewItem(toSection(res.data));
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setViewLoading(false);
    }
  }

  async function confirmDelete() {
    const item = deleteTarget;
    setDeleteTarget(null);
    if (!item) return;

    setDeletingId(item.id);
    setPageError("");
    try {
      await sectionApi.remove(item.id);
      setItems((prev) => prev.filter((i) => String(i.id) !== String(item.id)));
      if (String(editingId) === String(item.id)) closeForm();
      if (String(viewItem?.id) === String(item.id)) setViewItem(null);
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  function exportCSV() {
    const rows = [
      ["SL No.", "Section Name", "Section Code"],
      ...filtered.map((i, idx) => [idx + 1, i.name, i.code]),
    ];
    const csv = rows
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sections.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const viewSerial = filtered.findIndex((i) => String(i.id) === String(viewItem?.id)) + 1;

  return (
    <div className="min-h-full space-y-6 bg-background p-5 text-foreground transition-colors sm:p-8">
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete section?"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Network size={30} className="text-primary" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Department Section Management
            </h1>
          </div>
          <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
            Create and manage sections within your departments.
          </p>
        </div>

        <button type="button" onClick={openAddForm} className={buttonClass}>
          <Plus size={17} />
          Add Section
        </button>
      </div>

      {pageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError("")}
            aria-label="Dismiss error"
            className="rounded-md p-1 transition-colors hover:bg-destructive/10"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`${panelClass} p-5`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-medium tracking-wider ${mutedClass}`}>TOTAL SECTIONS</p>
            <Users size={20} className="text-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold">{items.length}</p>
        </div>
      </div>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-semibold">Sections</h2>
            <p className={`mt-1 text-sm ${mutedClass}`}>View and manage section records.</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-[220px] flex-1 sm:w-72">
              <Search
                size={18}
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search section..."
                className={`${inputClass} pl-10`}
              />
            </div>
            <button
              type="button"
              onClick={exportCSV}
              disabled={!items.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-24 px-5 py-4">SL No.</th>
                <th className="px-5 py-4">Section Name</th>
                <th className="px-5 py-4">Section Code</th>
                <th className="w-44 px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={4} className={`px-5 py-12 text-center ${mutedClass}`}>
                    <LoaderCircle size={20} className="mr-2 inline animate-spin text-primary" />
                    Loading sections...
                  </td>
                </tr>
              )}

              {!loading && filtered.map((item, index) => (
                <tr key={item.id} className="transition-colors hover:bg-primary/5">
                  <td className={`px-5 py-4 ${mutedClass}`}>{index + 1}</td>
                  <td className="px-5 py-4 font-medium">{item.name}</td>
                  <td className="px-5 py-4">{item.code}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleView(item)}
                        title="View"
                        aria-label={`View ${item.name}`}
                        disabled={viewLoading}
                        className={actionButtonClass}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        title="Edit"
                        aria-label={`Edit ${item.name}`}
                        className={actionButtonClass}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        title="Delete"
                        aria-label={`Delete ${item.name}`}
                        disabled={deletingId === item.id}
                        className={deleteButtonClass}
                      >
                        {deletingId === item.id ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className={`px-5 py-12 text-center ${mutedClass}`}>
                    {pageError
                      ? "Sections could not be loaded."
                      : search
                        ? "No matching sections found."
                        : "No sections found. Click Add Section to create one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`border-t border-border px-5 py-4 text-right text-xs ${mutedClass}`}>
          Showing {filtered.length} of {items.length} sections
        </div>
      </section>

      {showForm && (
        <Modal
          title={editingId !== null ? "Update Section" : "Add Section"}
          onClose={closeForm}
          footer={
            <>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button type="submit" form="section-form" disabled={saving} className={buttonClass}>
                {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />}
                {saving ? "Saving..." : editingId !== null ? "Save Changes" : "Create Section"}
              </button>
            </>
          }
        >
          <form id="section-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="sectionName" className="mb-2 block text-sm font-medium">
                Section Name <span className="text-destructive">*</span>
              </label>
              <input
                id="sectionName"
                value={sectionName}
                onChange={(e) => {
                  setSectionName(e.target.value.replace(/[^\p{L}\s.&'()/-]/gu, ""));
                  setError("");
                }}
                placeholder="Enter section name"
                className={inputClass}
                maxLength={100}
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="sectionCode" className="mb-2 block text-sm font-medium">
                Section Code <span className="text-destructive">*</span>
              </label>
              <input
                id="sectionCode"
                value={sectionCode}
                onChange={(e) => {
                  setSectionCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")
                  );
                  setError("");
                }}
                placeholder="e.g. SEC01"
                className={inputClass}
                maxLength={30}
                required
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}

      {viewLoading && (
        <Modal title="Section Details" onClose={() => setViewLoading(false)}>
          <div className={`flex items-center gap-3 ${mutedClass}`}>
            <LoaderCircle size={20} className="animate-spin text-primary" />
            Loading section details...
          </div>
        </Modal>
      )}

      {viewItem && (
        <Modal
          title="Section Details"
          onClose={() => setViewItem(null)}
          footer={
            <button type="button" onClick={() => setViewItem(null)} className={buttonClass}>
              Close
            </button>
          }
        >
          <div className="space-y-5">
            <div>
              <p className={`text-sm ${mutedClass}`}>Section Name</p>
              <p className="mt-1 text-base font-semibold">{viewItem.name}</p>
            </div>
            <div>
              <p className={`text-sm ${mutedClass}`}>Section Code</p>
              <p className="mt-1 text-base font-semibold">{viewItem.code}</p>
            </div>
            <div>
              <p className={`text-sm ${mutedClass}`}>SL No.</p>
              <p className="mt-1 text-base font-semibold">{viewSerial > 0 ? viewSerial : "—"}</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
