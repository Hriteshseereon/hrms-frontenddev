import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
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
import { CompanyScopeSelect, useCompanyScope } from "@/features/organization/components/CompanyScopeSelect";
import designationApi from "@/api/designationApi";
import departmentApi from "@/api/departmentApi";
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

// Designation name: letters and single spaces only (no digits / special characters), starting with a capital.
function validateDesignationName(name) {
  if (!name) return "Designation name is required.";
  if (/\d/u.test(name)) return "Designation name cannot contain digits.";
  if (!/^\p{L}+(?: \p{L}+)*$/u.test(name)) {
    return "Designation name can only contain letters and single spaces (no special characters).";
  }
  const first = name.charAt(0);
  if (first !== first.toUpperCase() || first === first.toLowerCase()) {
    return "Designation name must start with an uppercase letter.";
  }
  return "";
}

// The import endpoint returns every row error in `detail`; its shape can vary, so flatten it into lines.
function getImportErrors(error) {
  const detail = error?.response?.data?.detail ?? error?.response?.data;
  const lines = [];

  const walk = (value, prefix = "") => {
    if (value == null) return;
    if (typeof value === "string") lines.push(prefix + value);
    else if (value && typeof value === "object" && value.row != null && value.error) {
      lines.push(`Row ${value.row}: ${value.column ? `${value.column} — ` : ""}${value.error}`);
    } else if (value && typeof value === "object" && Array.isArray(value.errors)) {
      if (typeof value.message === "string") lines.push(value.message);
      walk(value.errors, prefix);
    }
    else if (Array.isArray(value)) value.forEach((v) => walk(v, prefix));
    else if (typeof value === "object") {
      if (typeof value.msg === "string") {
        const where = Array.isArray(value.loc) ? `${value.loc.join(" → ")}: ` : "";
        lines.push(prefix + where + value.msg);
      } else {
        Object.entries(value).forEach(([k, v]) =>
          typeof v === "object" ? walk(v, prefix) : lines.push(`${prefix}${k}: ${v}`)
        );
      }
    }
  };

  walk(detail);
  return lines.length ? lines : [getErrorMessage(error)];
}

function extractList(data, keys) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

// The API links a designation to a department by NAME (field "department" / "department_name").
function normalizeDesignation(item) {
  const departmentName =
    item.department_name ??
    (typeof item.department === "string"
      ? item.department
      : (item.department?.department_name ?? item.department?.name)) ??
    "";

  return {
    ...item,
    id: item.id,
    name: item.designation_name ?? item.name ?? "",
    department_name: departmentName,
    designation_type: item.designation_type ? String(item.designation_type).toLowerCase() : "",
    designation_code: item.designation_code ?? "",
    designation_year: item.designation_year ?? "",
    is_active: item.is_active ?? true,
  };
}

// Marks who counts as HR / Manager / CEO: the HR and Manager pickers list employees by this type.
const DESIGNATION_TYPES = [
  { value: "hr", label: "HR" },
  { value: "manager", label: "Manager" },
  { value: "ceo", label: "CEO" },
];

const TEMPLATE_HEADERS = [
  "Designation Name",
  "Designation Code",
  "Designation Year",
  "Department Name",
  "Designation Type",
];

const typeLabel =(value) => DESIGNATION_TYPES.find((t) => t.value === value)?.label ?? "—";

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
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

const deleteButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 disabled:cursor-not-allowed disabled:opacity-50";

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
  // Holds the department NAME (the API links designations to departments by name).
  const [departmentName, setDepartmentName] = useState("");
  const [designationType, setDesignationType] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewDesignation, setViewDesignation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [designationCode, setDesignationCode] = useState("");
  const [designationYear, setDesignationYear] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const bulkInputRef = useRef(null);
  const scope = useCompanyScope();
  const scopeParams = scope.companyId ? { company_id: scope.companyId } : undefined;
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");

  // The API is paginated ({ items, page, page_size, total }), so only one page is loaded at a time.
  async function loadDesignations() {
    const response = await designationApi.getDesignations({
      ...scopeParams,
      page,
      page_size: pageSize,
      sort_by: "created_at",
      sort_order: "desc",
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });

    // Newest first, so a freshly added designation lands at the top, not in the middle.
    const time = (item) => Date.parse(item.created_at ?? "") || 0;
    const records = extractList(response.data, [
      "items",
      "results",
      "designations",
    ])
      .map(normalizeDesignation)
      .sort((x, y) => time(y) - time(x));

    setDesignations(records);
    setTotal(Number(response.data?.total ?? records.length));
  }

  // Departments feed the dropdown and bulk-upload matching, so load every page of them.
  async function loadDepartments() {
    const all = [];
    for (let current = 1; current <= 200; current += 1) {
      const response = await departmentApi.getDepartments({
        ...scopeParams,
        page: current,
        page_size: 50,
      });
      const batch = extractList(response.data, ["items", "results", "departments"]);
      all.push(...batch);
      const totalCount = Number(response.data?.total ?? 0);
      if (!batch.length || !totalCount || all.length >= totalCount) break;
    }

    setDepartments(all.map(normalizeDepartment));
  }

  async function loadPageData() {
    setLoading(true);
    setPageError("");

    try {
      await loadDesignations();
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Debounce the search box so the server is not hit on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [scope.companyId, scope.isSuper]);

  useEffect(() => {
    loadPageData();
  }, [scope.companyId, scope.isSuper, page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadDepartments().catch((err) => setPageError(getErrorMessage(err)));
  }, [scope.companyId, scope.isSuper]);

  // Search runs on the server; the current page is shown as returned.
  const filteredDesignations = designations;

  function getDepartmentName(designation) {
    return designation.department_name || "—";
  }

  function resetForm() {
    setDesignationName("");
    setDepartmentName("");
    setDesignationType("");
    setDesignationCode("");
    setDesignationYear("");
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

    const nameError = validateDesignationName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    const code = designationCode.trim();
    const year = Number(designationYear);

    if (!code) {
      setError("Designation code is required.");
      return;
    }

    if (designationYear === "" || !Number.isInteger(year) || year < 0 || year > 99) {
      setError("Designation year must be a whole number of years between 0 and 99.");
      return;
    }

    if (scope.isSuper && editingId === null && !scope.companyId) {
      setError("Select a company first — designations belong to one company.");
      return;
    }

    const duplicate = designations.some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        (item.department_name ?? "").toLowerCase() ===
          departmentName.toLowerCase() &&
        String(item.id) !== String(editingId)
    );

    if (duplicate) {
      setError(
        departmentName
          ? "This designation already exists in the selected department."
          : "This designation already exists without a department."
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

      // Department is optional: send its name, or null when none is selected.
      const payload = {
        designation_name: name,
        department: departmentName || null,
        designation_type: designationType || null,
        designation_code: code,
        designation_year: year,
        is_active: existing?.is_active ?? true,
        ...(scope.isSuper && editingId === null ? { company_id: scope.companyId } : {}),
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
    setDepartmentName(designation.department_name || "");
    setDesignationType(designation.designation_type || "");
    setDesignationCode(designation.designation_code || "");
    setDesignationYear(designation.designation_year ?? "");
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

  function handleDelete(designation) {
    setDeleteTarget(designation);
  }

  async function confirmDelete() {
    const designation = deleteTarget;
    setDeleteTarget(null);
    if (!designation) return;

    setDeletingId(designation.id);
    setPageError("");

    try {
      await designationApi.deleteDesignation(designation.id);

      // Last row of a page removed: step back a page; otherwise just reload this one.
      if (designations.length === 1 && page > 1) setPage(page - 1);
      else await loadPageData();

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

  // Exports every designation (all pages), not just the page on screen.
  async function exportCSV() {
    setExporting(true);
    let all = [];
    try {
      for (let current = 1; current <= 500; current += 1) {
        const response = await designationApi.getDesignations({
          ...scopeParams,
          page: current,
          page_size: 100,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        });
        const batch = extractList(response.data, ["items", "results", "designations"]).map(normalizeDesignation);
        all.push(...batch);
        const totalCount = Number(response.data?.total ?? 0);
        if (!batch.length || !totalCount || all.length >= totalCount) break;
      }
    } catch (err) {
      setPageError(getErrorMessage(err));
      setExporting(false);
      return;
    }
    setExporting(false);

    const rows = [
      ["SL No.", "Designation Name", "Designation Code", "Designation Year", "Department", "Type"],
      ...all.map((item, index) => [
        index + 1,
        item.name,
        item.designation_code,
        item.designation_year,
        getDepartmentName(item),
        typeLabel(item.designation_type),
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

  // Excel template with headers + a sample row, so users only fill in data.
  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ["Software Engineer", "SE-01", 3, "Engineering", "manager"],
    ]);
    sheet["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 24 }));

    const guide = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ["Designation Name", "Yes", "Letters and spaces only, must start with an uppercase letter, max 100 characters"],
      ["Designation Code", "Yes", "e.g. SE-01"],
      ["Designation Year", "Yes", "Whole number of years, 0 to 99 (e.g. 3)"],
      ["Department Name", "No", "Must match an existing department name exactly"],
      ["Designation Type", "No", "hr, manager or ceo (leave blank for none)"],
      [],
      ["Delete the sample row in the Designations sheet before uploading."],
    ]);
    guide["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 60 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Designations");
    XLSX.utils.book_append_sheet(book, guide, "Instructions");
    XLSX.writeFile(book, "designation_template.xlsx");
  }

  function closeBulk() {
    if (bulkUploading) return;
    setShowBulk(false);
    setBulkResult(null);
  }

  // Valid rows are imported; invalid rows are reported and skipped.
  async function handleBulkFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBulkResult(null);

    if (scope.isSuper && !scope.companyId) {
      setBulkResult({ created: 0, errors: ["Select a company first — designations belong to one company."] });
      return;
    }

    setBulkUploading(true);

    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
        header: 1,
        defval: "",
      });

      const [header = [], ...body] = rows;
      const normalized = header.map((h) => String(h).trim().toLowerCase());
      const col = (label) => normalized.indexOf(label.toLowerCase());
      const idx = Object.fromEntries(TEMPLATE_HEADERS.map((h) => [h, col(h)]));

      const missingColumns = TEMPLATE_HEADERS.slice(0, 3).filter((h) => idx[h] === -1);
      if (missingColumns.length) {
        setBulkResult({
          created: 0,
          errors: [`Missing column(s): ${missingColumns.join(", ")}. Please use the template.`],
        });
        return;
      }

      const cell = (row, name) => (idx[name] === -1 ? "" : String(row[idx[name]] ?? "").trim());
      const seen = new Set(
        designations.map((d) => `${d.name.toLowerCase()}|${(d.department_name ?? "").toLowerCase()}`)
      );
      const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.name]));

      const errors = [];
      const valid = [];

      body.forEach((row, i) => {
        if (row.every((c) => String(c).trim() === "")) return;
        const line = i + 2;

        const name = cell(row, "Designation Name");
        const code = cell(row, "Designation Code");
        const yearText = cell(row, "Designation Year");
        const deptInput = cell(row, "Department Name");
        const typeInput = cell(row, "Designation Type").toLowerCase();
        const year = Number(yearText);

        const nameError = validateDesignationName(name);
        if (nameError) return errors.push(`Row ${line}: ${nameError.replace("Designation name", "Designation Name")}`);
        if (name.length > 100) return errors.push(`Row ${line}: Designation Name exceeds 100 characters.`);
        if (!code) return errors.push(`Row ${line}: Designation Code is required.`);
        if (yearText === "" || !Number.isInteger(year) || year < 0 || year > 99) {
          return errors.push(`Row ${line}: Designation Year must be a whole number of years between 0 and 99.`);
        }
        const department = deptInput ? deptByName.get(deptInput.toLowerCase()) : "";
        if (deptInput && !department) {
          return errors.push(`Row ${line}: Department "${deptInput}" does not exist.`);
        }
        if (typeInput && !DESIGNATION_TYPES.some((t) => t.value === typeInput)) {
          return errors.push(`Row ${line}: Designation Type must be hr, manager or ceo.`);
        }
        const key = `${name.toLowerCase()}|${(department || "").toLowerCase()}`;
        if (seen.has(key)) {
          return errors.push(`Row ${line}: "${name}" already exists${department ? ` in ${department}` : ""}.`);
        }
        seen.add(key);
        // null (not "") so optional cells are truly empty in the sheet.
        valid.push([name, code, year, department || null, typeInput || null]);
      });

      let created = 0;

      if (valid.length) {
        // Re-pack only the valid rows into a clean .xlsx and send it to the import API.
        const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...valid]);
        const out = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(out, sheet, "Designations");
        const buffer = XLSX.write(out, { type: "array", bookType: "xlsx" });
        const cleanFile = new File([buffer], "designations.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        try {
          const response = await designationApi.importDesignations(cleanFile, scopeParams);
          created = response.data?.created ?? valid.length;
        } catch (err) {
          errors.push(...getImportErrors(err));
        }
      }

      setBulkResult({ created, errors });
      if (created) await loadPageData();
    } catch (err) {
      setBulkResult({ created: 0, errors: [getErrorMessage(err)] });
    } finally {
      setBulkUploading(false);
    }
  }

  // Keep the current department selectable even if it is not in the departments list.
  const departmentOptions =
    departmentName &&
    !departments.some((department) => department.name === departmentName)
      ? [{ id: "__current", name: departmentName }, ...departments]
      : departments;

  return (
    <div className="min-h-full space-y-6 bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-[#080f0c] dark:text-[#edf4ef] sm:p-8">
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete designation?"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
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

        <div className="flex flex-wrap items-center gap-3">
          <CompanyScopeSelect scope={scope} />
          <button
            type="button"
            onClick={openAddForm}
            className={buttonClass}
          >
            <Plus size={17} />
            Add Designation
          </button>
        </div>
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
            {total}
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
              disabled={!total || exporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-[#293a33] dark:bg-[#101a15] dark:hover:bg-[#14221b]"
            >
              {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkResult(null);
                setShowBulk(true);
              }}
              className={buttonClass}
            >
              <Upload size={16} />
              Bulk Upload
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-[#15221b] dark:text-[#9aada2]">
              <tr>
                <th className="w-24 px-5 py-4">SL No.</th>
                <th className="px-5 py-4">Designation Name</th>
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Year</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Type</th>
                <th className="w-44 px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-[#25332c]">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
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
                      {(page - 1) * pageSize + index + 1}
                    </td>

                    <td className="px-5 py-4 font-medium">
                      {designation.name}
                    </td>

                    <td className="px-5 py-4">
                      {designation.designation_code || "—"}
                    </td>

                    <td className="px-5 py-4">
                      {designation.designation_year !== "" ? designation.designation_year : "—"}
                    </td>

                    <td className="px-5 py-4">
                      {getDepartmentName(designation)}
                    </td>

                    <td className="px-5 py-4">
                      {typeLabel(designation.designation_type)}
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
                          className={deleteButtonClass}
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
                    colSpan={7}
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
          className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-xs dark:border-[#25332c] ${mutedClass}`}
        >
          <span>
            Showing {total ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, total)} of {total} designations
          </span>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Rows
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-[#304238] dark:bg-[#0b1511]"
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-[#293a33] dark:hover:bg-[#14221b]"
            >
              Previous
            </button>
            <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(total / pageSize) || loading}
              className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-[#293a33] dark:hover:bg-[#14221b]"
            >
              Next
            </button>
          </div>
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
                htmlFor="departmentName"
                className="mb-2 block text-sm font-medium"
              >
                Department 
                {/* <span className={mutedClass}>(Optional)</span> */}
              </label>

              <select
                id="departmentName"
                value={departmentName}
                onChange={(event) => {
                  setDepartmentName(event.target.value);
                  setError("");
                }}
                className={inputClass}
                autoFocus
              >
                <option value="">Select department (Optional)</option>

                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name}
                  </option>
                ))}
              </select>

              {departments.length === 0 && !loading && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                  No departments available. You can still create a designation without selecting a department.
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
                placeholder="e.g. Software Engineer"
                pattern="^\p{L}+( \p{L}+)*$"
                title="Letters and spaces only, starting with an uppercase letter"
                className={inputClass}
                maxLength={100}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="designationCode" className="mb-2 block text-sm font-medium">
                  Designation Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="designationCode"
                  value={designationCode}
                  onChange={(event) => {
                    setDesignationCode(event.target.value);
                    setError("");
                  }}
                  placeholder="e.g. SE-01"
                  className={inputClass}
                  maxLength={50}
                  required
                />
              </div>

              <div>
                <label htmlFor="designationYear" className="mb-2 block text-sm font-medium">
                  Designation Year <span className="text-red-500">*</span>
                </label>
                <input
                  id="designationYear"
                  type="number"
                  min={0}
                  max={99}
                  step={1}
                  value={designationYear}
                  onChange={(event) => {
                    setDesignationYear(event.target.value);
                    setError("");
                  }}
                  placeholder="e.g. 3"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="designationType"
                className="mb-2 block text-sm font-medium"
              >
                Designation type <span className={mutedClass}>(Optional)</span>
              </label>

              <select
                id="designationType"
                value={designationType}
                onChange={(event) => setDesignationType(event.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                {DESIGNATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className={`mt-2 text-xs ${mutedClass}`}>
                People with an HR or Manager type are listed in the HR and Manager pickers.
              </p>
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

      {showBulk && (
        <Modal
          title="Bulk Upload Designations"
          onClose={closeBulk}
          footer={
            <button
              type="button"
              onClick={closeBulk}
              disabled={bulkUploading}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-[#293a33] dark:hover:bg-[#18251e]"
            >
              Close
            </button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-[#25332c]">
              <p className="text-sm font-semibold">1. Get the template</p>
              <p className={`mt-1 text-sm ${mutedClass}`}>
                Download the Excel template — headers are ready, just fill in your rows.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-100 dark:border-[#293a33] dark:bg-[#101a15] dark:hover:bg-[#14221b]"
              >
                <FileSpreadsheet size={16} />
                Export Template
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-[#25332c]">
              <p className="text-sm font-semibold">2. Upload the filled Excel</p>
              <p className={`mt-1 text-sm ${mutedClass}`}>
                Valid rows are added to the table; invalid rows are skipped and listed below.
              </p>
              <input
                ref={bulkInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleBulkFile}
                className="hidden"
              />
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
                {bulkUploading ? "Uploading..." : "Choose Excel file"}
              </button>
            </div>

            {bulkResult && (
              <div className="space-y-2 text-sm">
                {bulkResult.created > 0 && (
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    {bulkResult.created} designation(s) added successfully.
                  </p>
                )}
                {bulkResult.errors.length > 0 && (
                  <>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {bulkResult.errors.length} problem(s):
                    </p>
                    <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-red-600 dark:text-red-400">
                      {bulkResult.errors.map((message, i) => (
                        <li key={`${i}-${message}`}>{message}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
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
                {(page - 1) * pageSize +
                  filteredDesignations.findIndex(
                    (item) => String(item.id) === String(viewDesignation.id)
                  ) +
                  1}
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

            <div>
              <p className={`text-sm ${mutedClass}`}>Designation Code</p>
              <p className="mt-1 font-semibold">
                {viewDesignation.designation_code || "—"}
              </p>
            </div>

            <div>
              <p className={`text-sm ${mutedClass}`}>Designation Year</p>
              <p className="mt-1 font-semibold">
                {viewDesignation.designation_year !== "" ? viewDesignation.designation_year : "—"}
              </p>
            </div>

            <div>
              <p className={`text-sm ${mutedClass}`}>Designation type</p>
              <p className="mt-1 font-semibold">
                {typeLabel(viewDesignation.designation_type)}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}