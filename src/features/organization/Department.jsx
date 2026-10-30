
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

  return (
    data?.items ??
    data?.results ??
    data?.departments ??
    []
  );
}

function normalizeDepartment(item) {
  return {
    ...item,
    id: item.id,
    name: item.department_name ?? item.name ?? "",
    is_active: item.is_active ?? true,
  };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-[#304238] dark:bg-[#0b1511] dark:text-[#eef5f0] dark:placeholder:text-[#71847a] dark:focus:ring-emerald-900";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#14563f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a6a4d] disabled:cursor-not-allowed disabled:opacity-60";

const actionButtonClass =
  "rounded-lg border border-slate-200 bg-white p-2 text-emerald-700 transition hover:bg-emerald-50 dark:border-[#304238] dark:bg-[#101a15] dark:text-emerald-300 dark:hover:bg-[#1b3829] disabled:opacity-50";

const panelClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#25332c] dark:bg-[#101a15]";

const mutedClass = "text-slate-500 dark:text-[#91a49a]";

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
        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-[#304238] dark:bg-[#101a15] dark:text-[#edf4ef]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-[#25332c]">
          <h2 className="text-lg font-semibold">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close popup"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#9aada2] dark:hover:bg-[#1c2b23]"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-6">{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-[#25332c]">
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

  async function loadDepartments() {
    setLoading(true);
    setPageError("");

    try {
      const response = await departmentApi.getDepartments();

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
  }, []);

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
    <div className="min-h-full space-y-6 bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-[#080f0c] dark:text-[#edf4ef] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Building2
              size={30}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Department Management
            </h1>
          </div>

          <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
            Create and manage departments across your organization.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className={buttonClass}
        >
          <Plus size={17} />
          Add Department
        </button>
      </div>

      {pageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{pageError}</span>

          <button
            type="button"
            onClick={() => setPageError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`${panelClass} p-5`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-medium tracking-wider ${mutedClass}`}>
              TOTAL DEPARTMENTS
            </p>
            <Users
              size={20}
              className="text-emerald-600 dark:text-emerald-300"
            />
          </div>

          <p className="mt-3 text-3xl font-bold">
            {departments.length}
          </p>
        </div>
      </div>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-[#25332c]">
          <div>
            <h2 className="text-lg font-semibold">Departments</h2>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              View and manage department records.
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
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

            <button
              type="button"
              onClick={exportCSV}
              disabled={!departments.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-[#293a33] dark:bg-[#101a15] dark:hover:bg-[#14221b]"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-[#15221b] dark:text-[#9aada2]">
              <tr>
                <th className="w-24 px-5 py-4">SL No.</th>
                <th className="px-5 py-4">Department Name</th>
                <th className="w-44 px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-[#25332c]">
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className={`px-5 py-12 text-center ${mutedClass}`}
                  >
                    <LoaderCircle
                      size={20}
                      className="mr-2 inline animate-spin"
                    />
                    Loading departments...
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((department, index) => (
                  <tr
                    key={department.id}
                    className="transition hover:bg-emerald-50/60 dark:hover:bg-[#15221b]"
                  >
                    <td className={`px-5 py-4 ${mutedClass}`}>
                      {index + 1}
                    </td>

                    <td className="px-5 py-4 font-medium">
                      {department.name}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
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

                        <button
                          type="button"
                          onClick={() => handleEdit(department)}
                          title="Edit"
                          aria-label={`Edit ${department.name}`}
                          className={actionButtonClass}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(department)}
                          title="Delete"
                          aria-label={`Delete ${department.name}`}
                          disabled={deletingId === department.id}
                          className="rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-[#49302d] dark:bg-[#101a15] dark:text-red-300 dark:hover:bg-[#38211e]"
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

        <div
          className={`border-t border-slate-200 px-5 py-4 text-right text-xs dark:border-[#25332c] ${mutedClass}`}
        >
          Showing {filteredDepartments.length} of {departments.length} departments
        </div>
      </section>

      {showForm && (
        <Modal
          title={editingId !== null ? "Update Department" : "Add Department"}
          onClose={closeForm}
          footer={
            <>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-100 dark:border-[#293a33] dark:hover:bg-[#18251e]"
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
                  <LoaderCircle size={17} className="animate-spin" />
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
                Department Name <span className="text-red-500">*</span>
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
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}

      {viewLoading && (
        <Modal
          title="Department Details"
          onClose={() => setViewLoading(false)}
        >
          <div className={`flex items-center gap-3 ${mutedClass}`}>
            <LoaderCircle
              size={20}
              className="animate-spin text-emerald-500"
            />
            Loading department details...
          </div>
        </Modal>
      )}

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
              <p className={`text-sm ${mutedClass}`}>Department Name</p>
              <p className="mt-1 text-base font-semibold">
                {viewDepartment.name}
              </p>
            </div>

            <div>
              <p className={`text-sm ${mutedClass}`}>SL No.</p>
              <p className="mt-1 text-base font-semibold">
                {viewSerialNumber > 0 ? viewSerialNumber : "—"}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
