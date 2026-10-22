
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
} from "lucide-react";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";

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
    id: item.id,
    name: item.department_name ?? item.name ?? "",
  };
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

  // GET: Load designations from the API.
  async function loadDesignations() {
    const response = await SuperAdmin_auth.getDesignations();

    const records = extractList(response.data, [
      "items",
      "results",
      "designations",
    ]).map(normalizeDesignation);

    setDesignations(records);
  }

  // GET: Load real departments for the department dropdown.
  async function loadDepartments() {
    const response = await SuperAdmin_auth.getDepartments();

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

    const results = await Promise.allSettled([
      loadDesignations(),
      loadDepartments(),
    ]);

    const failures = results.filter(
      (result) => result.status === "rejected"
    );

    if (failures.length > 0) {
      setPageError(
        failures
          .map((result) => getErrorMessage(result.reason))
          .join(" ")
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredDesignations = useMemo(() => {
    const query = search.toLowerCase().trim();

    return designations.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.department_name.toLowerCase().includes(query)
    );
  }, [designations, search]);

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
    resetForm();
    setShowForm(false);
  }

  // POST: Create; PUT: Update an existing designation.
  async function handleSubmit(event) {
    event.preventDefault();

    const name = designationName.trim();

    if (!name) {
      setError("Designation name is required.");
      return;
    }

    if (!departmentId) {
      setError("Please select a department.");
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
        await SuperAdmin_auth.updateDesignation(editingId, payload);
      } else {
        await SuperAdmin_auth.createDesignation(payload);
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
    setShowForm(true);
    setViewDesignation(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // GET by ID: Fetch the selected designation from the backend.
  async function handleView(designation) {
    setViewDesignation(null);
    setViewLoading(true);
    setPageError("");

    try {
      const response = await SuperAdmin_auth.getDesignationById(
        designation.id
      );

      setViewDesignation(normalizeDesignation(response.data));
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setViewLoading(false);
    }
  }

  // DELETE: Remove a designation by its UUID.
  async function handleDelete(designation) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${designation.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(designation.id);
    setPageError("");

    try {
      await SuperAdmin_auth.deleteDesignation(designation.id);

      setDesignations((previous) =>
        previous.filter(
          (item) => String(item.id) !== String(designation.id)
        )
      );

      if (String(editingId) === String(designation.id)) {
        closeForm();
      }

      if (
        String(viewDesignation?.id) === String(designation.id)
      ) {
        setViewDesignation(null);
      }
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
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
            <BriefcaseBusiness size={30} className="text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Designation Management
            </h1>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-[#9aada2]">
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
          <p className="text-xs font-medium tracking-wider text-[#9aada2]">
            TOTAL DESIGNATIONS
          </p>
          <p className="mt-3 text-3xl font-bold">
            {designations.length}
          </p>
        </div>
      </div>

      {showForm && (
        <section className="rounded-2xl border border-[#25332c] bg-[#101a15] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editingId !== null
                ? "Update Designation"
                : "Add Designation"}
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="designationName"
                  className="mb-2 block text-sm font-medium text-[#d2ded6]"
                >
                  Designation Name <span className="text-red-400">*</span>
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

              <div>
                <label
                  htmlFor="departmentId"
                  className="mb-2 block text-sm font-medium text-[#d2ded6]"
                >
                  Department <span className="text-red-400">*</span>
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
                >
                  <option value="" className="bg-[#0b1511]">
                    Select department
                  </option>

                  {departments.map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                      className="bg-[#0b1511]"
                    >
                      {department.name}
                    </option>
                  ))}
                </select>

                {departments.length === 0 && !loading && (
                  <p className="mt-2 text-xs text-amber-300">
                    No departments available. Create a department first.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
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
            <h2 className="text-lg font-semibold">Designations</h2>
            <p className="mt-1 text-sm text-[#91a49a]">
              View and manage designation records.
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
              placeholder="Search designation or department..."
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[#15221b] text-xs uppercase tracking-wider text-[#9aada2]">
              <tr>
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Designation Name</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#25332c]">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-12 text-center text-[#91a49a]"
                  >
                    <LoaderCircle
                      size={20}
                      className="mr-2 inline animate-spin"
                    />
                    Loading designations...
                  </td>
                </tr>
              ) : (
                filteredDesignations.map((designation) => (
                  <tr
                    key={designation.id}
                    className="transition hover:bg-[#15221b]"
                  >
                    <td className="px-5 py-4 text-xs text-[#a9bbb0]">
                      <span className="block max-w-[180px] truncate" title={designation.id}>
                        {designation.id}
                      </span>
                    </td>

                    <td className="px-5 py-4 font-medium">
                      {designation.name}
                    </td>

                    <td className="px-5 py-4 text-[#c4d1c9]">
                      {designation.department_name ||
                        departments.find(
                          (department) =>
                            String(department.id) ===
                            String(designation.department_id)
                        )?.name ||
                        "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleView(designation)}
                          title="View designation"
                          aria-label={`View designation ${designation.name}`}
                          disabled={viewLoading}
                          className={actionButtonClass}
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(designation)}
                          title="Edit designation"
                          aria-label={`Edit designation ${designation.name}`}
                          className={actionButtonClass}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(designation)}
                          title="Delete designation"
                          aria-label={`Delete designation ${designation.name}`}
                          disabled={deletingId === designation.id}
                          className="rounded-lg border border-[#49302d] p-2 text-red-300 hover:bg-[#38211e] disabled:opacity-50"
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
                    className="px-5 py-12 text-center text-[#91a49a]"
                  >
                    {search
                      ? "No matching designations found."
                      : "No designations found. Click Add Designation to create one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#25332c] px-5 py-4 text-right text-xs text-[#91a49a]">
          Showing {filteredDesignations.length} of {designations.length} designations
        </div>
      </section>

      {viewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#304238] bg-[#101a15] p-5 text-sm">
            <LoaderCircle
              size={20}
              className="animate-spin text-emerald-300"
            />
            Loading designation details...
          </div>
        </div>
      )}

      {viewDesignation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-designation-title"
            className="w-full max-w-lg rounded-2xl border border-[#304238] bg-[#101a15] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2
                id="view-designation-title"
                className="text-lg font-semibold"
              >
                Designation Details
              </h2>

              <button
                type="button"
                onClick={() => setViewDesignation(null)}
                aria-label="Close details"
                className="rounded-lg p-2 text-[#9aada2] hover:bg-[#1c2b23] hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[#91a49a]">Designation ID</p>
                <p className="mt-1 break-all font-medium">
                  {viewDesignation.id}
                </p>
              </div>

              <div>
                <p className="text-[#91a49a]">Designation Name</p>
                <p className="mt-1 font-medium">
                  {viewDesignation.name}
                </p>
              </div>

              <div>
                <p className="text-[#91a49a]">Department</p>
                <p className="mt-1 font-medium">
                  {viewDesignation.department_name ||
                    departments.find(
                      (department) =>
                        String(department.id) ===
                        String(viewDesignation.department_id)
                    )?.name ||
                    "—"}
                </p>
              </div>

              <div>
                <p className="text-[#91a49a]">Department ID</p>
                <p className="mt-1 break-all font-medium">
                  {viewDesignation.department_id || "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setViewDesignation(null)}
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
