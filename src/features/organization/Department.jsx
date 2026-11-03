import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Eye,
  X,
  Download,
  LoaderCircle,
  Users,
} from "lucide-react";

import departmentApi from "@/api/departmentApi";

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  if (typeof detail === "string") return detail;

  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

function extractDepartments(data) {
  if (Array.isArray(data)) return data;

  return data?.items ?? data?.results ?? data?.departments ?? [];
}

function normalizeDepartment(item) {
  return {
    ...item,
    id: item.id,
    name: item.department_name ?? item.name ?? "",
    is_active: item.is_active ?? true,
  };
}

/* Theme-aware input styling */
const inputClass =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

/* Theme-aware primary button */
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

/* Icons have no box by default. Hover uses the active organization theme. */
const actionButtonClass =
  "inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

/* Theme-aware panel */
const panelClass =
  "rounded-2xl border border-border bg-card text-card-foreground shadow-sm";

const mutedClass = "text-muted-foreground";

/* Modal */
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
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Department() {
  const [departments, setDepartments] = useState([]);
  const [departmentName, setDepartmentName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewDepartment, setViewDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const scope = useCompanyScope();

  async function loadDepartments() {
    setLoading(true);
    setPageError("");

    try {
      const response = await departmentApi.getDepartments(
        scope.companyId ? { company_id: scope.companyId } : undefined,
      );

      setDepartments(
        extractDepartments(response.data).map(normalizeDepartment)
      );
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, [scope.companyId, scope.isSuper]);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return departments.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
  }, [departments, search]);

  function resetForm() {
    setDepartmentName("");
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

    const name = departmentName.trim();

    if (!name) {
      setError("Department name is required.");
      return;
    }

    const duplicate = departments.some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        String(item.id) !== String(editingId)
    );

    if (duplicate) {
      setError("This department already exists.");
      return;
    }

    if (scope.isSuper && editingId === null && !scope.companyId) {
      setError("Select a company first — departments belong to one company.");
      return;
    }

    setSaving(true);
    setError("");
    setPageError("");

    try {
      if (editingId !== null) {
        const existing = departments.find(
          (item) => String(item.id) === String(editingId)
        );

        await departmentApi.updateDepartment(editingId, {
          department_name: name,
          is_active: existing?.is_active ?? true,
        });
      } else {
        await departmentApi.createDepartment({
          department_name: name,
          is_active: true,
          ...(scope.isSuper ? { company_id: scope.companyId } : {}),
        });
      }

      closeForm();
      await loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(department) {
    setDepartmentName(department.name);
    setEditingId(department.id);
    setError("");
    setPageError("");
    setViewDepartment(null);
    setShowForm(true);
  }

  async function handleView(department) {
    setViewDepartment(null);
    setViewLoading(true);
    setPageError("");

    try {
      const response = await departmentApi.getDepartmentById(
        department.id
      );

      setViewDepartment(normalizeDepartment(response.data));
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setViewLoading(false);
    }
  }

  async function handleDelete(department) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${department.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(department.id);
    setPageError("");

    try {
      await departmentApi.deleteDepartment(department.id);

      setDepartments((previous) =>
        previous.filter(
          (item) => String(item.id) !== String(department.id)
        )
      );

      if (String(editingId) === String(department.id)) {
        closeForm();
      }

      if (String(viewDepartment?.id) === String(department.id)) {
        setViewDepartment(null);
      }
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  function exportCSV() {
    const rows = [
      ["SL No.", "Department Name"],
      ...filteredDepartments.map((item, index) => [
        index + 1,
        item.name,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "departments.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  const viewSerialNumber =
    filteredDepartments.findIndex(
      (department) =>
        String(department.id) === String(viewDepartment?.id)
    ) + 1;

  return (
    <div className="min-h-full space-y-6 bg-background p-5 text-foreground transition-colors sm:p-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Building2
              size={30}
              className="text-primary"
            />

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Department Management
            </h1>
          </div>

          <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
            Create and manage departments across your organization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CompanyScopeSelect scope={scope} />
          <button
            type="button"
            onClick={openAddForm}
            className={buttonClass}
          >
            <Plus size={17} />
            Add Department
          </button>
        </div>
      </div>

      {/* Error Message */}
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

      {/* Department Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`${panelClass} p-5`}>
          <div className="flex items-center justify-between">
            <p
              className={`text-xs font-medium tracking-wider ${mutedClass}`}
            >
              TOTAL DEPARTMENTS
            </p>

            <Users
              size={20}
              className="text-primary"
            />
          </div>

          <p className="mt-3 text-3xl font-bold">
            {departments.length}
          </p>
        </div>
      </div>

      {/* Department Table */}
      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-semibold">
              Departments
            </h2>

            <p className={`mt-1 text-sm ${mutedClass}`}>
              View and manage department records.
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 sm:w-72">
              <Search
                size={18}
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`}
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search department..."
                className={`${inputClass} pl-10`}
              />
            </div>

            {/* Export */}
            <button
              type="button"
              onClick={exportCSV}
              disabled={!departments.length}
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
                <th className="w-24 px-5 py-4">
                  SL No.
                </th>

                <th className="px-5 py-4">
                  Department Name
                </th>

                <th className="w-44 px-5 py-4">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className={`px-5 py-12 text-center ${mutedClass}`}
                  >
                    <LoaderCircle
                      size={20}
                      className="mr-2 inline animate-spin text-primary"
                    />

                    Loading departments...
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((department, index) => (
                  <tr
                    key={department.id}
                    className="transition-colors hover:bg-primary/5"
                  >
                    <td className={`px-5 py-4 ${mutedClass}`}>
                      {index + 1}
                    </td>

                    <td className="px-5 py-4 font-medium">
                      {department.name}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {/* View */}
                        <button
                          type="button"
                          onClick={() => handleView(department)}
                          title="View"
                          aria-label={`View ${department.name}`}
                          disabled={viewLoading}
                          className={actionButtonClass}
                        >
                          <Eye size={16} />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleEdit(department)}
                          title="Edit"
                          aria-label={`Edit ${department.name}`}
                          className={actionButtonClass}
                        >
                          <Pencil size={16} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(department)}
                          title="Delete"
                          aria-label={`Delete ${department.name}`}
                          disabled={deletingId === department.id}
                          className={actionButtonClass}
                        >
                          {deletingId === department.id ? (
                            <LoaderCircle
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}

              {!loading && filteredDepartments.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className={`px-5 py-12 text-center ${mutedClass}`}
                  >
                    {pageError
                      ? "Departments could not be loaded."
                      : search
                        ? "No matching departments found."
                        : "No departments found. Click Add Department to create one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div
          className={`border-t border-border px-5 py-4 text-right text-xs ${mutedClass}`}
        >
          Showing {filteredDepartments.length} of {departments.length} departments
        </div>
      </section>

      {/* Add / Edit Department Modal */}
      {showForm && (
        <Modal
          title={
            editingId !== null
              ? "Update Department"
              : "Add Department"
          }
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

              <button
                type="submit"
                form="department-form"
                disabled={saving}
                className={buttonClass}
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={17} />
                )}

                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "Create Department"}
              </button>
            </>
          }
        >
          <form
            id="department-form"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="departmentName"
                className="mb-2 block text-sm font-medium"
              >
                Department Name{" "}
                <span className="text-destructive">*</span>
              </label>

              <input
                id="departmentName"
                value={departmentName}
                onChange={(event) => {
                  setDepartmentName(event.target.value);
                  setError("");
                }}
                placeholder="Enter department name"
                className={inputClass}
                maxLength={100}
                required
                autoFocus
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}

      {/* Loading Department Details */}
      {viewLoading && (
        <Modal
          title="Department Details"
          onClose={() => setViewLoading(false)}
        >
          <div className={`flex items-center gap-3 ${mutedClass}`}>
            <LoaderCircle
              size={20}
              className="animate-spin text-primary"
            />

            Loading department details...
          </div>
        </Modal>
      )}

      {/* View Department Modal */}
      {viewDepartment && (
        <Modal
          title="Department Details"
          onClose={() => setViewDepartment(null)}
          footer={
            <button
              type="button"
              onClick={() => setViewDepartment(null)}
              className={buttonClass}
            >
              Close
            </button>
          }
        >
          <div className="space-y-5">
            <div>
              <p className={`text-sm ${mutedClass}`}>
                Department Name
              </p>

              <p className="mt-1 text-base font-semibold">
                {viewDepartment.name}
              </p>
            </div>

            <div>
              <p className={`text-sm ${mutedClass}`}>
                SL No.
              </p>

              <p className="mt-1 text-base font-semibold">
                {viewSerialNumber > 0
                  ? viewSerialNumber
                  : "—"}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
} 

