// Config-driven single-field master page (list + add / view / edit / delete), styled like Department.
// Used by Grade and Category. With `config.api` ({ list, get, create, update, remove } → axios) it is backed by
// the server; without it, records live in component state (UI only).
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
  LoaderCircle,
} from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

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

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  if (typeof detail === "string") return detail;
  return error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
}

/**
 * config: {
 *   api?, fieldKey (API field, needed with api), icon, title, subtitle, singular, plural,
 *   fieldLabel, placeholder, maxLength, normalize?(value)
 * }
 */
export function SimpleMasterPage({ config }) {
  const {
    api,
    fieldKey,
    icon: PageIcon,
    title,
    subtitle,
    singular,
    plural,
    fieldLabel,
    placeholder,
    maxLength = 100,
    normalize = (v) => v,
  } = config;

  const [items, setItems] = useState([]);
  const [value, setValue] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(Boolean(api));
  const [saving, setSaving] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const toItem = (raw) => ({ ...raw, id: raw.id, name: raw[fieldKey] ?? raw.name ?? "" });
  const extract = (data) =>
    Array.isArray(data) ? data : (data?.items ?? data?.results ?? data?.data ?? []);

  async function load() {
    if (!api) return;
    setLoading(true);
    setPageError("");
    try {
      const res = await api.list();
      setItems(extract(res.data).map(toItem));
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  function resetForm() {
    setValue("");
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
    const name = normalize(value.trim());

    if (!name) {
      setError(`${fieldLabel} is required.`);
      return;
    }

    const duplicate = items.some(
      (i) => i.name.toLowerCase() === name.toLowerCase() && String(i.id) !== String(editingId),
    );
    if (duplicate) {
      setError(`This ${fieldLabel.toLowerCase()} already exists.`);
      return;
    }

    if (!api) {
      if (editingId !== null) {
        setItems((prev) => prev.map((i) => (String(i.id) === String(editingId) ? { ...i, name } : i)));
      } else {
        setItems((prev) => [...prev, { id: Date.now(), name }]);
      }
      closeForm();
      return;
    }

    setSaving(true);
    setError("");
    setPageError("");
    try {
      if (editingId !== null) await api.update(editingId, { [fieldKey]: name });
      else await api.create({ [fieldKey]: name });
      closeForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setValue(item.name);
    setEditingId(item.id);
    setError("");
    setPageError("");
    setViewItem(null);
    setShowForm(true);
  }

  async function handleView(item) {
    if (!api) {
      setViewItem(item);
      return;
    }
    setViewItem(null);
    setViewLoading(true);
    setPageError("");
    try {
      const res = await api.get(item.id);
      setViewItem(toItem(res.data));
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

    if (api) {
      setDeletingId(item.id);
      setPageError("");
      try {
        await api.remove(item.id);
      } catch (err) {
        setPageError(getErrorMessage(err));
        return;
      } finally {
        setDeletingId(null);
      }
    }
    setItems((prev) => prev.filter((i) => String(i.id) !== String(item.id)));
    if (String(editingId) === String(item.id)) closeForm();
    if (String(viewItem?.id) === String(item.id)) setViewItem(null);
  }

  function exportCSV() {
    const rows = [["SL No.", fieldLabel], ...filtered.map((i, idx) => [idx + 1, i.name])];
    const csv = rows
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plural.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const viewSerial = filtered.findIndex((i) => String(i.id) === String(viewItem?.id)) + 1;
  const formId = `${singular.toLowerCase()}-form`;

  return (
    <div className="min-h-full space-y-6 bg-background p-5 text-foreground transition-colors sm:p-8">
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete ${singular.toLowerCase()}?`}
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <PageIcon size={30} className="text-primary" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          </div>
          <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={openAddForm} className={buttonClass}>
            <Plus size={17} />
            Add {singular}
          </button>
        </div>
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
            <p className={`text-xs font-medium tracking-wider ${mutedClass}`}>
              TOTAL {plural.toUpperCase()}
            </p>
            <Users size={20} className="text-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold">{items.length}</p>
        </div>
      </div>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-semibold">{plural}</h2>
            <p className={`mt-1 text-sm ${mutedClass}`}>View and manage {singular.toLowerCase()} records.</p>
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
                placeholder={`Search ${singular.toLowerCase()}...`}
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
                <th className="px-5 py-4">{fieldLabel}</th>
                <th className="w-44 px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={3} className={`px-5 py-12 text-center ${mutedClass}`}>
                    <LoaderCircle size={20} className="mr-2 inline animate-spin text-primary" />
                    Loading {plural.toLowerCase()}...
                  </td>
                </tr>
              )}

              {!loading && filtered.map((item, index) => (
                  <tr key={item.id} className="transition-colors hover:bg-primary/5">
                    <td className={`px-5 py-4 ${mutedClass}`}>{index + 1}</td>
                    <td className="px-5 py-4 font-medium">{item.name}</td>
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
                  <td colSpan={3} className={`px-5 py-12 text-center ${mutedClass}`}>
                    {pageError
                      ? `${plural} could not be loaded.`
                      : search
                        ? `No matching ${plural.toLowerCase()} found.`
                        : `No ${plural.toLowerCase()} found. Click Add ${singular} to create one.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`border-t border-border px-5 py-4 text-right text-xs ${mutedClass}`}>
          Showing {filtered.length} of {items.length} {plural.toLowerCase()}
        </div>
      </section>

      {showForm && (
        <Modal
          title={editingId !== null ? `Update ${singular}` : `Add ${singular}`}
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
              <button type="submit" form={formId} disabled={saving} className={buttonClass}>
                {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />}
                {saving ? "Saving..." : editingId !== null ? "Save Changes" : `Create ${singular}`}
              </button>
            </>
          }
        >
          <form id={formId} onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor={`${formId}-field`} className="mb-2 block text-sm font-medium">
                {fieldLabel} <span className="text-destructive">*</span>
              </label>
              <input
                id={`${formId}-field`}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError("");
                }}
                placeholder={placeholder}
                className={inputClass}
                maxLength={maxLength}
                required
                autoFocus
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
        <Modal title={`${singular} Details`} onClose={() => setViewLoading(false)}>
          <div className={`flex items-center gap-3 ${mutedClass}`}>
            <LoaderCircle size={20} className="animate-spin text-primary" />
            Loading {singular.toLowerCase()} details...
          </div>
        </Modal>
      )}

      {viewItem && (
        <Modal
          title={`${singular} Details`}
          onClose={() => setViewItem(null)}
          footer={
            <button type="button" onClick={() => setViewItem(null)} className={buttonClass}>
              Close
            </button>
          }
        >
          <div className="space-y-5">
            <div>
              <p className={`text-sm ${mutedClass}`}>{fieldLabel}</p>
              <p className="mt-1 text-base font-semibold">{viewItem.name}</p>
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
