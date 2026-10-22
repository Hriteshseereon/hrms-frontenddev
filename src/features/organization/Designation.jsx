
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  BriefcaseBusiness,
  Eye,
  X,
  LoaderCircle,
  Download,
} from "lucide-react";
import designationApi from "@/api/designationApi";
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

function extractList(data, keys) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function normalizeDesignation(item) {
  return {
    ...item,
    id: item.id,
    name: item.designation_name ?? item.name ?? "",
    department_id: item.department_id ?? "",
    department_name: item.department_name ?? "",
    is_active: item.is_active ?? true,
  };
}

function normalizeDepartment(item) {
  return {
    ...item,
    id: item.id,
    name: item.department_name ?? item.name ?? "",
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

export default function Designation() {
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designationName, setDesignationName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewDesignation, setViewDesignation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");

  async function loadDesignations() {
    const response = await designationApi.getDesignations();

    const records = extractList(response.data, [
      "items",
      "results",
      "designations",
    ]).map(normalizeDesignation);

    setDesignations(records);
  }

  async function loadDepartments() {
    const response = await departmentApi.getDepartments();

    const records = extractList(response.data, [
      "items",
      "results",
      "departments",
    ]).map(normalizeDepartment);

    setDepartments(records);
  }

  async function loadPageData() {
    setLoading(true);
    setPageError("");

    try {
      const results = await Promise.allSettled([
        loadDesignations(),
        loadDepartments(),
      ]);

      const failures = results.filter(
        (result) => result.status === "rejected"
      );

      if (failures.length) {
        setPageError(
          failures
            .map((result) => getErrorMessage(result.reason))
            .join(" ")
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredDesignations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return designations.filter((item) => {
      const departmentName =
        item.department_name ||
        departments.find(
          (department) =>
            String(department.id) === String(item.department_id)
        )?.name ||
        "";

      return (
        item.name.toLowerCase().includes(query) ||
        departmentName.toLowerCase().includes(query)
      );
    });
  }, [designations, departments, search]);

  function getDepartmentName(designation) {
    return (
      designation.department_name ||
      departments.find(
        (department) =>
          String(department.id) === String(designation.department_id)
      )?.name ||
      "—"
    );
  }

  function resetForm() {
    setDesignationName("");
    setDepartmentId("");
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

    const name = designationName.trim();

    if (!departmentId) {
      setError("Please select a department.");
      return;
    }

    if (!name) {
      setError("Designation name is required.");
      return;
    }

    const duplicate = designations.some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        String(item.department_id) === String(departmentId) &&
        String(item.id) !== String(editingId)
    );

    if (duplicate) {
      setError(
        "This designation already exists in the selected department."
      );
      return;
    }

    setSaving(true);
    setError("");
    setPageError("");

    try {
      const existing = designations.find(
        (item) => String(item.id) === String(editingId)
      );

      const payload = {
        designation_name: name,
        department_id: departmentId,
        is_active: existing?.is_active ?? true,
      };

      if (editingId !== null) {
        await designationApi.updateDesignation(editingId, payload);
      } else {
        await designationApi.createDesignation(payload);
      }

      closeForm();
      await loadPageData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(designation) {
    setDesignationName(designation.name);
    setDepartmentId(String(designation.department_id));
    setEditingId(designation.id);
    setError("");
    setPageError("");
    setViewDesignation(null);
    setShowForm(true);
  }

  async function handleView(designation) {
    setViewDesignation(null);
    setViewLoading(true);
    setPageError("");

    try {
      const response = await designationApi.getDesignationById(
        designation.id
      );

      setViewDesignation(normalizeDesignation(response.data));
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setViewLoading(false);
    }
  }

  async function handleDelete(designation) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${designation.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(designation.id);
    setPageError("");

    try {
      await designationApi.deleteDesignation(designation.id);

      setDesignations((previous) =>
        previous.filter(
          (item) => String(item.id) !== String(designation.id)
        )
      );

      if (String(editingId) === String(designation.id)) {
        closeForm();
      }

      if (String(viewDesignation?.id) === String(designation.id)) {
        setViewDesignation(null);
      }
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  function exportCSV() {
    const rows = [
      ["SL No.", "Designation Name", "Department"],
      ...filteredDesignations.map((item, index) => [
        index + 1,
        item.name,
        getDepartmentName(item),
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
    link.download = "designations.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-full space-y-6 bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-[#080f0c] dark:text-[#edf4ef] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BriefcaseBusiness
              size={30}
              className="text-emerald-600 dark:text-emerald-400"
            />

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Designation Management
            </h1>
          </div>

          <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
            Create and manage designations within your departments.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className={buttonClass}
        >
          <Plus size={17} />
          Add Designation
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
          <p className={`text-xs font-medium tracking-wider ${mutedClass}`}>
            TOTAL DESIGNATIONS
          </p>

          <p className="mt-3 text-3xl font-bold">
            {designations.length}
          </p>
        </div>
      </div>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-[#25332c]">
          <div>
            <h2 className="text-lg font-semibold">Designations</h2>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              View and manage designation records.
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
                placeholder="Search designation or department..."
                className={`${inputClass} pl-10`}
              />
            </div>

            <button
              type="button"
              onClick={exportCSV}
              disabled={!designations.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-[#293a33] dark:bg-[#101a15] dark:hover:bg-[#14221b]"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-[#15221b] dark:text-[#9aada2]">
              <tr>
                <th className="w-24 px-5 py-4">SL No.</th>
                <th className="px-5 py-4">Designation Name</th>
                <th className="px-5 py-4">Department</th>
                <th className="w-44 px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-[#25332c]">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className={`px-5 py-12 text-center ${mutedClass}`}
                  >
                    <LoaderCircle
                      size={20}
                      className="mr-2 inline animate-spin"
                    />
                    Loading designations...
                  </td>
                </tr>
              ) : (
                filteredDesignations.map((designation, index) => (
                  <tr
                    key={designation.id}
                    className="transition hover:bg-emerald-50/60 dark:hover:bg-[#15221b]"
                  >
                    <td className={`px-5 py-4 ${mutedClass}`}>
                      {index + 1}
                    </td>

                    <td className="px-5 py-4 font-medium">
                      {designation.name}
                    </td>

                    <td className="px-5 py-4">
                      {getDepartmentName(designation)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleView(designation)}
                          title="View"
                          aria-label={`View ${designation.name}`}
                          disabled={viewLoading}
                          className={actionButtonClass}
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(designation)}
                          title="Edit"
                          aria-label={`Edit ${designation.name}`}
                          className={actionButtonClass}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(designation)}
                          title="Delete"
                          aria-label={`Delete ${designation.name}`}
                          disabled={deletingId === designation.id}
                          className="rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-[#49302d] dark:bg-[#101a15] dark:text-red-300 dark:hover:bg-[#38211e]"
                        >
                          {deletingId === designation.id ? (
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

              {!loading && filteredDesignations.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className={`px-5 py-12 text-center ${mutedClass}`}
                  >
                    {pageError
                      ? "Designations could not be loaded."
                      : search
                        ? "No matching designations found."
                        : "No designations found. Click Add Designation to create one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className={`border-t border-slate-200 px-5 py-4 text-right text-xs dark:border-[#25332c] ${mutedClass}`}
        >
          Showing {filteredDesignations.length} of {designations.length} designations
        </div>
      </section>

      {showForm && (
        <Modal
          title={editingId !== null ? "Update Designation" : "Add Designation"}
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
                form="designation-form"
                disabled={saving || departments.length === 0}
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
                    : "Create Designation"}
              </button>
            </>
          }
        >
          <form
            id="designation-form"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="departmentId"
                className="mb-2 block text-sm font-medium"
              >
                Department <span className="text-red-500">*</span>
              </label>

              <select
                id="departmentId"
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setError("");
                }}
                className={inputClass}
                required
                autoFocus
              >
                <option value="">Select department</option>

                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>

              {departments.length === 0 && !loading && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                  No departments available. Create a department first.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="designationName"
                className="mb-2 block text-sm font-medium"
              >
                Designation Name <span className="text-red-500">*</span>
              </label>

              <input
                id="designationName"
                value={designationName}
                onChange={(event) => {
                  setDesignationName(event.target.value);
                  setError("");
                }}
                placeholder="Enter designation name"
                className={inputClass}
                maxLength={100}
                required
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
          title="Designation Details"
          onClose={() => setViewLoading(false)}
        >
          <div className={`flex items-center gap-3 ${mutedClass}`}>
            <LoaderCircle
              size={20}
              className="animate-spin text-emerald-500"
            />
            Loading designation details...
          </div>
        </Modal>
      )}

      {viewDesignation && (
        <Modal
          title="Designation Details"
          onClose={() => setViewDesignation(null)}
          footer={
            <button
              type="button"
              onClick={() => setViewDesignation(null)}
              className={buttonClass}
            >
              Close
            </button>
          }
        >
          <div className="space-y-5">
  {/* SL No. */}
  <div>
    <p className={`text-sm ${mutedClass}`}>SL No.</p>
    <p className="mt-1 font-semibold">
      {filteredDesignations.findIndex(
        (item) => String(item.id) === String(viewDesignation.id)
      ) + 1}
    </p>
  </div>

  {/* Department Name */}
  <div>
    <p className={`text-sm ${mutedClass}`}>Department</p>
    <p className="mt-1 font-semibold">
      {getDepartmentName(viewDesignation)}
    </p>
  </div>

  {/* Designation Name */}
  <div>
    <p className={`text-sm ${mutedClass}`}>Designation Name</p>
    <p className="mt-1 font-semibold">
      {viewDesignation.name}
    </p>
  </div>
</div>
        </Modal>
      )}
    </div>
  );
}
