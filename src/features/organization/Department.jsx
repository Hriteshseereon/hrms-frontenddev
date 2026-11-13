import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Upload,
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

import { CompanyScopeSelect, useCompanyScope } from "@/features/organization/components/CompanyScopeSelect";
import departmentApi from "@/api/departmentApi";
import { nameError } from "@/lib/name-validation";
import departmentGradeApi from "@/api/departmentGradeApi";
import departmentCategoryApi from "@/api/departmentCategoryApi";
import departmentSectionApi from "@/api/departmentSectionApi";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

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

/*
 * Extra department columns shown in the table and the view popup, read from the department API record.
 */
const EXTRA_COLUMNS = [
  { label: "Department Code", get: (d) => d.department_code },
  { label: "Department Grade", get: (d) => d.grade_name },
  { label: "Category", get: (d) => d.category_name },
  { label: "Section Name", get: (d) => d.section_name },
  { label: "Section Code", get: (d) => d.section_code },
];

const TEMPLATE_HEADERS = [
  "Department Grade",
  "Category",
  "Section Name",
  "Section Code",
  "Department Name",
  "Department Code",
];

const showValue = (value) => (value === undefined || value === null || value === "" ? "—" : value);

/* Theme-aware input styling */
const inputClass =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

/* Theme-aware primary button */
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

/* Icons have no box by default. Hover uses the active organization theme. */
const actionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

const deleteButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 disabled:cursor-not-allowed disabled:opacity-50";

/* Theme-aware panel */
const panelClass =
  "rounded-2xl border border-border bg-card text-card-foreground shadow-sm";

const mutedClass = "text-muted-foreground";

/* Modal */
function Modal({ title, onClose, children, footer, wide = false }) {
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
        className={`my-auto w-full ${wide ? "max-w-3xl" : "max-w-xl"} overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl`}
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

/* Mandatory dropdown fed by another master page's list */
// Names: letters and common punctuation only (no digits). Codes: letters, digits, - and _.
const NAME_INVALID_CHARS = /[^\p{L}\s.&'()/-]/gu;
const CODE_INVALID_CHARS = /[^A-Za-z0-9_-]/g;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

function SelectField({ id, label, value, onChange, options, loading, emptyText, autoFocus }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label} <span className="text-destructive">*</span>
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        disabled={loading}
        autoFocus={autoFocus}
        required
      >
        <option value="">
          {loading ? "Loading..." : options.length ? `Select ${label.toLowerCase()}` : emptyText}
        </option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const toOptions = (rows, labelKey) =>
  rows
    .filter((row) => row?.id && row?.[labelKey])
    .map((row) => ({ value: String(row.id), label: row[labelKey] }));

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const bulkInputRef = useRef(null);
  const scope = useCompanyScope();

  // Add-form fields. Grade / category / section are picked from the lists maintained on their own pages.
  const [gradeId, setGradeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sectionId, setSectionId] = useState(""); // drives both Section Name and Section Code
  const [departmentCode, setDepartmentCode] = useState("");
  const [options, setOptions] = useState({ grades: [], categories: [], sections: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);

  async function loadOptions() {
    setOptionsLoading(true);
    try {
      const [grades, categories, sections] = await Promise.all([
        departmentGradeApi.list(),
        departmentCategoryApi.list(),
        departmentSectionApi.list(),
      ]);
      setOptions({
        grades: extractDepartments(grades.data),
        categories: extractDepartments(categories.data),
        sections: extractDepartments(sections.data),
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setOptionsLoading(false);
    }
  }

  async function loadDepartments() {
    setLoading(true);
    setPageError("");

    try {
      // The API is paginated (default 10 per page), so keep fetching until every department is loaded.
      const base = scope.companyId ? { company_id: scope.companyId } : {};
      const all = [];
      let page = 1;

      for (;;) {
        const response = await departmentApi.getDepartments({
          ...base,
          page,
          page_size: 100,
        });
        const items = extractDepartments(response.data);
        all.push(...items);

        const total = response.data?.total;
        if (!items.length || typeof total !== "number" || all.length >= total || page >= 100) break;
        page += 1;
      }

      setDepartments(all.map(normalizeDepartment));
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
    setGradeId("");
    setCategoryId("");
    setSectionId("");
    setDepartmentCode("");
    setEditingId(null);
    setError("");
  }

  function openAddForm() {
    resetForm();
    setPageError("");
    setShowForm(true);
    loadOptions();
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const name = departmentName.trim();

    const missing = [
      [gradeId, "Department grade"],
      [categoryId, "Category"],
      [sectionId, "Section"],
      [name, "Department name"],
      [departmentCode.trim(), "Department code"],
    ].find(([value]) => !value);

    if (missing) {
      setError(`${missing[1]} is required.`);
      return;
    }

    if (!name) {
      setError("Department name is required.");
      return;
    }

    const nameProblem = nameError(name, "Department name");
    if (nameProblem) {
      setError(nameProblem);
      return;
    }

    if (!CODE_PATTERN.test(departmentCode.trim())) {
      setError("Department code can only contain letters, digits, - and _.");
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
        await departmentApi.updateDepartment(editingId, {
          grade_id: gradeId,
          category_id: categoryId,
          department_code: departmentCode.trim(),
          department_name: name,
          section_code_id: sectionId,
          section_name_id: sectionId,
        });
      } else {
        await departmentApi.createDepartment({
          grade_id: gradeId,
          category_id: categoryId,
          department_code: departmentCode.trim(),
          department_name: name,
          section_code_id: sectionId,
          section_name_id: sectionId,
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
    setGradeId(department.grade_id ?? "");
    setCategoryId(department.category_id ?? "");
    setSectionId(department.section_name_id ?? department.section_code_id ?? "");
    setDepartmentCode(department.department_code ?? "");
    loadOptions();
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

  function handleDelete(department) {
    setDeleteTarget(department);
  }

  async function confirmDelete() {
    const department = deleteTarget;
    setDeleteTarget(null);
    if (!department) return;

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

  // Excel template with the exact headers the import API expects, so users only fill in data.
  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    sheet["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 22 }));

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Departments");
    XLSX.writeFile(book, "department_template.xlsx");
  }

  /*
   * The import API is all-or-nothing per file, so each row is sent as its own
   * one-row file. Valid rows are created; invalid rows are reported with their row number.
   */
  async function handleBulkFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!/\.xlsx$/i.test(file.name)) {
      setBulkResult({ created: 0, total: 0, errors: ["Please choose an .xlsx file."] });
      return;
    }

    if (scope.isSuper && !scope.companyId) {
      setBulkResult({
        created: 0,
        total: 0,
        errors: ["Select a company first — departments belong to one company."],
      });
      return;
    }

    setBulkUploading(true);
    setBulkResult(null);
    setPageError("");

    let created = 0;
    let total = 0;
    const errors = [];

    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
        header: 1,
        defval: "",
        blankrows: false,
      });

      const header = (rows[0] || []).map((h) => String(h).trim().toLowerCase());
      const columnIndex = TEMPLATE_HEADERS.map((h) => header.indexOf(h.toLowerCase()));
      const missing = TEMPLATE_HEADERS.filter((_, i) => columnIndex[i] === -1);

      if (missing.length) {
        errors.push(`Missing column(s): ${missing.join(", ")}. Use the template.`);
      } else {
        const params = scope.isSuper ? { company_id: scope.companyId } : undefined;

        for (let i = 1; i < rows.length; i += 1) {
          const values = columnIndex.map((c) => String(rows[i][c] ?? "").trim());
          if (values.every((v) => !v)) continue;

          total += 1;
          const label = `Row ${i + 1}${values[4] ? ` (${values[4]})` : ""}`;

          try {
            const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, values]);
            const rowBook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(rowBook, sheet, "Departments");
            const bytes = XLSX.write(rowBook, { type: "array", bookType: "xlsx" });
            const rowFile = new File([bytes], "departments.xlsx", {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            await departmentApi.importDepartments(rowFile, params);
            created += 1;
          } catch (err) {
            const detail = err?.response?.data?.detail;
            const messages = Array.isArray(detail)
              ? detail.map((item) => (typeof item === "string" ? item : item?.msg || JSON.stringify(item)))
              : [getErrorMessage(err)];
            errors.push(`${label}: ${messages.join("; ")}`);
          }
        }

        if (total === 0) errors.push("The file has no data rows.");
      }
    } catch (err) {
      errors.push(`Could not read the file: ${err?.message || "invalid Excel file"}`);
    }

    setBulkResult({ created, total, errors });
    setBulkUploading(false);
    if (created > 0) await loadDepartments();
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
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete department?"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
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

            {/* Bulk upload (opens a card with template + upload) */}
            <button
              type="button"
              onClick={() => {
                setBulkResult(null);
                setBulkOpen(true);
              }}
              className={buttonClass}
            >
              <Upload size={16} />
              Bulk Upload
            </button>
          </div>
        </div>


        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-24 px-5 py-4">
                  SL No.
                </th>

                <th className="px-5 py-4">
                  Department Name
                </th>

                {EXTRA_COLUMNS.map((column) => (
                  <th key={column.label} className="px-5 py-4">
                    {column.label}
                  </th>
                ))}

                <th className="w-44 px-5 py-4">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={3 + EXTRA_COLUMNS.length}
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

                    {EXTRA_COLUMNS.map((column) => (
                      <td key={column.label} className="px-5 py-4">
                        {showValue(column.get(department))}
                      </td>
                    ))}

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
                          className={deleteButtonClass}
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
                    colSpan={3 + EXTRA_COLUMNS.length}
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

      {/* Bulk Upload Modal */}
      {bulkOpen && (
        <Modal
          title="Bulk Upload Departments"
          onClose={() => !bulkUploading && setBulkOpen(false)}
          footer={
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              disabled={bulkUploading}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
            >
              Close
            </button>
          }
        >
          <div className="space-y-4">
            <input
              ref={bulkInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleBulkFile}
              className="hidden"
            />

            {/* 1. Upload */}
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">1. Upload Excel file</p>
              <p className={`mt-1 text-xs ${mutedClass}`}>
                Valid rows are added to the existing departments. Invalid rows are skipped and listed below.
              </p>
              <button
                type="button"
                onClick={() => bulkInputRef.current?.click()}
                disabled={bulkUploading}
                className={`${buttonClass} mt-3`}
              >
                {bulkUploading ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                {bulkUploading ? "Uploading..." : "Choose .xlsx file"}
              </button>
            </div>

            {/* 2. Template */}
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">2. Need the format? Export template</p>
              <p className={`mt-1 text-xs ${mutedClass}`}>
                Download an Excel file with all the headers ready — just fill in your data.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <FileSpreadsheet size={16} />
                Export Template
              </button>
            </div>

            {bulkResult && (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                {(bulkResult.created > 0 || bulkResult.errors.length === 0) && (
                  <p className="font-medium text-primary">
                    {bulkResult.created} of {bulkResult.total} department(s) added.
                  </p>
                )}
                {bulkResult.errors.length > 0 && (
                  <>
                    <p className="mt-1 font-medium text-destructive">
                      {bulkResult.errors.length} problem(s):
                    </p>
                    <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-destructive">
                      {bulkResult.errors.map((message, index) => (
                        <li key={`${index}-${message}`}>{message}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add / Edit Department Modal */}
      {showForm && (
        <Modal
          title={
            editingId !== null
              ? "Update Department"
              : "Add Department"
          }
          onClose={closeForm}
          wide
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
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
              <>
                <SelectField
                  id="departmentGrade"
                  label="Department Grade"
                  value={gradeId}
                  onChange={(v) => {
                    setGradeId(v);
                    setError("");
                  }}
                  options={toOptions(options.grades, "grade_code")}
                  loading={optionsLoading}
                  emptyText="No grades created yet"
                  autoFocus
                />

                <SelectField
                  id="departmentCategory"
                  label="Category"
                  value={categoryId}
                  onChange={(v) => {
                    setCategoryId(v);
                    setError("");
                  }}
                  options={toOptions(options.categories, "category_name")}
                  loading={optionsLoading}
                  emptyText="No categories created yet"
                />

                <SelectField
                  id="sectionName"
                  label="Section Name"
                  value={sectionId}
                  onChange={(v) => {
                    setSectionId(v);
                    setError("");
                  }}
                  options={toOptions(options.sections, "section_name")}
                  loading={optionsLoading}
                  emptyText="No sections created yet"
                />

                <SelectField
                  id="sectionCode"
                  label="Section Code"
                  value={sectionId}
                  onChange={(v) => {
                    setSectionId(v);
                    setError("");
                  }}
                  options={toOptions(options.sections, "section_code")}
                  loading={optionsLoading}
                  emptyText="No sections created yet"
                />
              </>

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
                  setDepartmentName(
                    event.target.value.replace(NAME_INVALID_CHARS, "")
                  );
                  setError("");
                }}
                placeholder="Enter department name"
                className={inputClass}
                maxLength={100}
                required
              />
            </div>

            <>
              <div>
                <label
                  htmlFor="departmentCode"
                  className="mb-2 block text-sm font-medium"
                >
                  Department Code{" "}
                  <span className="text-destructive">*</span>
                </label>

                <input
                  id="departmentCode"
                  value={departmentCode}
                  onChange={(event) => {
                    setDepartmentCode(
                      event.target.value
                        .toUpperCase()
                        .replace(CODE_INVALID_CHARS, "")
                    );
                    setError("");
                  }}
                  placeholder="Enter department code"
                  className={inputClass}
                  maxLength={30}
                  required
                />
              </div>
            </>

            {error && (
              <p
                role="alert"
                className="text-sm text-destructive sm:col-span-3"
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

            {EXTRA_COLUMNS.map((column) => (
              <div key={column.label}>
                <p className={`text-sm ${mutedClass}`}>
                  {column.label}
                </p>

                <p className="mt-1 text-base font-semibold">
                  {showValue(column.get(viewDepartment))}
                </p>
              </div>
            ))}

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

