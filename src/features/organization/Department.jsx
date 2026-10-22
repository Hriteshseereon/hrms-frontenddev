
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
} from "lucide-react";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  return error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again.";
}

// Supports a direct array or common paginated response shapes.
function extractDepartments(responseData) {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.items)) return responseData.items;
  if (Array.isArray(responseData?.results)) return responseData.results;
  if (Array.isArray(responseData?.departments)) return responseData.departments;

  return [];
}

// Convert the API response to the field names used by this UI.
function normalizeDepartment(item) {
  return {
    ...item,
    id: item.id,
    name: item.department_name ?? item.name ?? "",
    is_active: item.is_active ?? true,
  };
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

  // GET: Load departments from the backend when this page opens.
  async function loadDepartments() {
    setLoading(true);
    setPageError("");

    try {
      const response = await SuperAdmin_auth.getDepartments();
      const records = extractDepartments(response.data).map(
        normalizeDepartment
      );

      setDepartments(records);
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  const filteredDepartments = useMemo(
    () =>
      departments.filter((department) =>
        department.name.toLowerCase().includes(search.toLowerCase())
      ),
    [departments, search]
  );

  function resetForm() {
    setDepartmentName("");
    setEditingId(null);
    setError("");
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  // POST for create; PUT for update.
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
        const existingDepartment = departments.find(
          (item) => String(item.id) === String(editingId)
        );

        const payload = {
          department_name: name,
          // The UI doesn't expose status; preserve the existing API value.
          is_active: existingDepartment?.is_active ?? true,
        };

        await SuperAdmin_auth.updateDepartment(editingId, payload);
      } else {
        const payload = {
          department_name: name,
          is_active: true,
        };

        await SuperAdmin_auth.createDepartment(payload);
      }

      closeForm();

      // Refresh from the backend so the table reflects saved data.
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
    setShowForm(true);
    setViewDepartment(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // GET by ID: fetch the selected record, not just the table copy.
  async function handleView(department) {
    setViewDepartment(null);
    setViewLoading(true);
    setPageError("");

    try {
      const response = await SuperAdmin_auth.getDepartmentById(
        department.id
      );

      setViewDepartment(normalizeDepartment(response.data));
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setViewLoading(false);
    }
  }

  // DELETE by ID.
  async function handleDelete(department) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${department.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(department.id);
    setPageError("");

    try {
      await SuperAdmin_auth.deleteDepartment(department.id);

      setDepartments((previous) =>
        previous.filter(
          (item) => String(item.id) !== String(department.id)
        )
      );

      if (String(editingId) === String(department.id)) {
        closeForm();
      }

      if (
        String(viewDepartment?.id) === String(department.id)
      ) {
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
      ["Department ID", "Department Name"],
      ...filteredDepartments.map((item) => [item.id, item.name]),
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

  const inputClass =
    "w-full rounded-xl border border-[#293a33] bg-[#0b1511] px-4 py-3 text-sm text-[#eef5f0] outline-none transition placeholder:text-[#71847a] focus:border-emerald-600 focus:ring-1 focus:ring-emerald-700";

  const buttonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-[#14563f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a6a4d] disabled:cursor-not-allowed disabled:opacity-60";

  const actionButtonClass =
    "rounded-lg border border-[#304238] p-2 text-emerald-300 hover:bg-[#1b3829] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="min-h-full space-y-6 bg-[#080f0c] p-5 text-[#edf4ef] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Building2 size={30} className="text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Department Management
            </h1>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-[#9aada2]">
            Create and manage departments across your organization.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCSV}
            disabled={departments.length === 0}
            className="rounded-xl border border-[#293a33] px-4 py-2.5 text-sm hover:bg-[#14221b] disabled:opacity-50"
          >
            <Download size={16} className="mr-2 inline" />
            Export CSV
          </button>

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

      {pageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300"
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
        <div className="rounded-2xl border border-[#25332c] bg-[#101a15] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wider text-[#9aada2]">
              TOTAL DEPARTMENTS
            </p>
            <Building2 size={20} className="text-sky-300" />
          </div>
          <p className="mt-3 text-3xl font-bold">{departments.length}</p>
        </div>
      </div>

      {showForm && (
        <section className="rounded-2xl border border-[#25332c] bg-[#101a15] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editingId !== null ? "Update Department" : "Add Department"}
            </h2>

            <button
              type="button"
              onClick={closeForm}
              aria-label="Close form"
              className="rounded-lg p-2 text-[#9aada2] hover:bg-[#1c2b23] hover:text-white"
            >
              <X size={19} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="max-w-xl">
              <label
                htmlFor="departmentName"
                className="mb-2 block text-sm font-medium text-[#d2ded6]"
              >
                Department Name <span className="text-red-400">*</span>
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
              />

              {error && (
                <p role="alert" className="mt-2 text-sm text-red-400">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
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

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl border border-[#293a33] px-4 py-2.5 text-sm font-medium text-[#c4d1c9] hover:bg-[#18251e] disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#25332c] bg-[#101a15]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#25332c] p-5">
          <div>
            <h2 className="text-lg font-semibold">Departments</h2>
            <p className="mt-1 text-sm text-[#91a49a]">
              View and manage your department records.
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8da196]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search department..."
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-[#15221b] text-xs uppercase tracking-wider text-[#9aada2]">
              <tr>
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Department Name</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#25332c]">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-[#91a49a]">
                    <LoaderCircle size={20} className="mr-2 inline animate-spin" />
                    Loading departments...
                  </td>
                </tr>
              ) : filteredDepartments.map((department) => (
                <tr
                  key={department.id}
                  className="transition hover:bg-[#15221b]"
                >
                  <td className="px-5 py-4 text-xs text-[#a9bbb0]">
                    {department.id}
                  </td>

                  <td className="px-5 py-4 font-medium">
                    {department.name}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleView(department)}
                        title="View department"
                        aria-label={`View department ${department.name}`}
                        disabled={viewLoading}
                        className={actionButtonClass}
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(department)}
                        title="Edit department"
                        aria-label={`Edit department ${department.name}`}
                        className={actionButtonClass}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(department)}
                        title="Delete department"
                        aria-label={`Delete department ${department.name}`}
                        disabled={deletingId === department.id}
                        className="rounded-lg border border-[#49302d] p-2 text-red-300 hover:bg-[#38211e] disabled:opacity-50"
                      >
                        {deletingId === department.id ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredDepartments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-[#91a49a]">
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

        <div className="border-t border-[#25332c] px-5 py-4 text-right text-xs text-[#91a49a]">
          Showing {filteredDepartments.length} of {departments.length} departments
        </div>
      </section>

      {viewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#304238] bg-[#101a15] p-5 text-sm">
            <LoaderCircle size={20} className="animate-spin text-emerald-300" />
            Loading department details...
          </div>
        </div>
      )}

      {viewDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-department-title"
            className="w-full max-w-lg rounded-2xl border border-[#304238] bg-[#101a15] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="view-department-title" className="text-lg font-semibold">
                Department Details
              </h2>

              <button
                type="button"
                onClick={() => setViewDepartment(null)}
                aria-label="Close details"
                className="rounded-lg p-2 text-[#9aada2] hover:bg-[#1c2b23] hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[#91a49a]">Department ID</p>
                <p className="mt-1 break-all font-medium">
                  {viewDepartment.id}
                </p>
              </div>

              <div>
                <p className="text-[#91a49a]">Department Name</p>
                <p className="mt-1 font-medium">
                  {viewDepartment.name}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setViewDepartment(null)}
                className={buttonClass}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
