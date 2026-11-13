// Reading, ordering and reporting for the bulk employee import. No React here.
import * as XLSX from "xlsx";
import { BULK_CHUNK_SIZE } from "@/api/employeeBulkApi";

/** Columns the server understands, in the order of the downloadable template. */
export const IMPORT_COLUMNS = [
  "employee_code", "first_name", "last_name", "department", "designation", "branch_name", "shift",
  "attendance_pattern", "grade", "wage_type", "ctc", "daily_rate", "personal_email", "phone", "date_of_birth",
  "gender", "marital_status", "blood_group", "nationality", "religion", "employment_type", "work_mode",
  "date_of_joining", "probation_months", "notice_period_days", "skill_category", "pf_applicable",
  "esi_applicable", "pf_member_id", "pt_state", "uan_number", "esic_number", "aadhaar_number", "pan_number",
  "bank_account_holder_name", "bank_name", "bank_account_number", "ifsc_code", "emergency_contact_name",
  "emergency_contact_phone", "current_address", "permanent_address", "qualification", "institution",
  "year_of_passing", "education_score", "manager_employee_code", "hr_partner_employee_code",
];
const KNOWN = new Set([...IMPORT_COLUMNS, "status"]);
const REQUIRED_COLUMNS = ["employee_code", "first_name", "department"];

/** Header spellings from older templates that map onto a server column. */
const ALIASES = { shift_name: "shift", department_name: "department", designation_name: "designation" };
/** Columns the server never takes from a row (company comes from the login, work email is generated). */
const NOT_SENT = new Set([
  "organization_name", "company_name", "company_id", "organization_id", "branch_id", "work_email", "password",
]);
const DIGIT_COLUMNS = new Set([
  "aadhaar_number", "bank_account_number", "uan_number", "esic_number", "phone", "emergency_contact_phone",
]);
const DATE_COLUMNS = new Set(["date_of_birth", "date_of_joining"]);

export const normalizeHeader = (h) =>
  String(h ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");

/** Excel can write a long digit cell in scientific notation; recover it only when it is an exact integer. */
export function normalizeDigits(value) {
  const input = String(value ?? "").trim().replace(/^'/, "").replace(/\s+/g, "");
  if (/^\d+$/.test(input)) return input;
  const match = input.match(/^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return input;
  const [, whole, fraction = "", exponentText] = match;
  if (fraction && /[1-9]/.test(fraction) && !exponentText) return input;
  const digits = `${whole}${fraction}`;
  const point = whole.length + Number(exponentText || 0);
  if (point <= 0 || (point < digits.length && /[1-9]/.test(digits.slice(point)))) return input;
  return point >= digits.length ? `${digits}${"0".repeat(point - digits.length)}` : digits.slice(0, point);
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Excel date cells arrive as Date objects a few seconds before local midnight, so cutting the ISO string would
 * give the previous day. Half a day is added first, then the local parts are read.
 */
function dateToIso(date) {
  const d = new Date(date.getTime() + 12 * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeDateText(text) {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const local = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return local ? `${local[3]}-${pad(local[2])}-${pad(local[1])}` : t;
}

const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["no", "n", "false", "0"]);

function normalizeValue(column, value) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return dateToIso(value);
  let v = typeof value === "string" ? value.trim() : value;
  if (v === "") return undefined;
  if (DATE_COLUMNS.has(column) && typeof v === "string") return normalizeDateText(v);
  if (DIGIT_COLUMNS.has(column)) return normalizeDigits(v);
  if (column === "pf_applicable" || column === "esi_applicable") {
    const word = String(v).trim().toLowerCase();
    return YES.has(word) ? true : NO.has(word) ? false : v;
  }
  if (column === "wage_type") {
    const word = String(v).trim().toLowerCase();
    return word === "monthly" ? "Monthly" : word === "daily" ? "Daily" : v;
  }
  if (column === "pan_number" || column === "ifsc_code") return String(v).trim().toUpperCase();
  if (column === "employee_code" || column === "manager_employee_code" || column === "hr_partner_employee_code") return String(v).trim();
  return v;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function readSheetRows(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return parseCsv(await file.text());
  if (ext !== "xlsx") throw new Error("Choose a CSV or Excel .xlsx file.");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  // The data sheet is "Employees" when there is one, otherwise the first sheet.
  const name = workbook.SheetNames.find((n) => n.toLowerCase() === "employees") ?? workbook.SheetNames[0];
  if (!name) throw new Error("The Excel workbook has no worksheets.");
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: "" });
}

/**
 * Reads a file into rows ready for POST /employees/bulk.
 * Returns `{ headers, records, ignoredColumns, notSentColumns }`; each record is
 * `{ fileRow, raw, data, clientErrors }` where `data` is the object sent to the server.
 */
export async function parseImportFile(file) {
  // Keep each row's number in the sheet, so a report can say "row 57" even when blank rows were skipped.
  const all = (await readSheetRows(file))
    .map((values, i) => ({ values, sheetRow: i + 1 }))
    .filter((r) => r.values.some((v) => String(v ?? "").trim() !== ""));
  if (all.length < 2) throw new Error("The file needs a header row and at least one employee.");
  const rawHeaders = all[0].values;
  const columns = rawHeaders.map((h) => {
    const n = normalizeHeader(h);
    return ALIASES[n] ?? n;
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) throw new Error(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);

  const ignoredColumns = [...new Set(columns.filter((c) => c && !KNOWN.has(c) && !NOT_SENT.has(c) && c !== "bank_account_number_confirm"))];
  const notSentColumns = [...new Set(columns.filter((c) => NOT_SENT.has(c)))];

  const records = all.slice(1).map(({ values, sheetRow }) => {
    const data = {};
    columns.forEach((column, idx) => {
      if (!column || NOT_SENT.has(column) || column === "bank_account_number_confirm") return;
      const v = normalizeValue(column, values[idx]);
      if (v !== undefined) data[column] = v;
    });
    const clientErrors = [];
    const confirmIdx = columns.indexOf("bank_account_number_confirm");
    if (confirmIdx >= 0) {
      const confirm = normalizeValue("bank_account_number", values[confirmIdx]);
      if (confirm !== undefined && data.bank_account_number !== undefined && String(confirm) !== String(data.bank_account_number))
        clientErrors.push({ field: "bank_account_number_confirm", msg: "The re-entered account number does not match." });
    }
    return { fileRow: sheetRow, raw: values, data, clientErrors };
  });

  // The same employee_code twice in one file: the first row goes through, the repeats are reported.
  const firstRow = new Map();
  for (const r of records) {
    const code = r.data.employee_code;
    if (code === undefined) continue;
    const key = String(code).toLowerCase();
    if (firstRow.has(key)) r.clientErrors.push({ field: "employee_code", msg: `employee_code repeated in the file (first on row ${firstRow.get(key)}).` });
    else firstRow.set(key, r.fileRow);
  }
  return { headers: rawHeaders, records, ignoredColumns, notSentColumns };
}

/**
 * Managers (and HR partners) must be created before the people who report to them. Rows get a depth:
 * 0 when they name nobody in this file, otherwise one more than the deepest person they name. A circle of
 * names cannot be ordered, so those rows are left at depth 0 and the server reports the unknown code.
 */
export function orderForManagers(records) {
  const byCode = new Map(records.map((r) => [String(r.data.employee_code ?? "").toLowerCase(), r]));
  const depth = new Map();
  const visiting = new Set();
  const depthOf = (r) => {
    if (depth.has(r)) return depth.get(r);
    if (visiting.has(r)) return 0;
    visiting.add(r);
    let d = 0;
    for (const key of ["manager_employee_code", "hr_partner_employee_code"]) {
      const code = r.data[key];
      const boss = code !== undefined ? byCode.get(String(code).toLowerCase()) : undefined;
      if (boss && boss !== r) d = Math.max(d, depthOf(boss) + 1);
    }
    visiting.delete(r);
    depth.set(r, d);
    return d;
  };
  return records
    .map((r, i) => ({ r, i, d: depthOf(r) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.r);
}

export const chunkRecords = (records, size = BULK_CHUNK_SIZE) => {
  const out = [];
  for (let i = 0; i < records.length; i += size) out.push(records.slice(i, i + size));
  return out;
};

/** "field: message" text from a server error body (a string, or FastAPI's list). */
export function apiErrorText(error, fallback = "The import call failed.") {
  const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? JSON.stringify(d)).join("; ");
  return error?.userMessage || error?.message || fallback;
}

/** True when sending the same chunk again is the right answer (network drop, timeout, gateway error). */
export function isRetryable(error) {
  const status = error?.response?.status;
  return !status || status === 502 || status === 503 || status === 504 || error?.code === "ECONNABORTED";
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function saveBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** CSV of every problem: file row, employee_code, field, message. */
export function downloadErrorReport(failed, filename = "employee-import-errors.csv") {
  const lines = ["file_row,employee_code,field,message"];
  for (const f of failed) {
    const errors = f.errors.length ? f.errors : [{ field: "", msg: "Not imported" }];
    for (const e of errors) lines.push([f.fileRow, f.employee_code ?? "", e.field ?? "", e.msg ?? ""].map(csvCell).join(","));
  }
  saveBlob(new Blob([`\uFEFF${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" }), filename);
}

/** The failed rows as an Excel file in the original layout, ready to fix and upload again. */
export function downloadFailedRows(headers, failedRecords, filename = "employee-import-failed-rows.xlsx") {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...failedRecords.map((r) => r.raw)], { cellDates: true });
  sheet["!cols"] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Employees");
  XLSX.writeFile(wb, filename);
}

/* ------------------------------------------------------------------ previous imports (for Send credentials) */
const BATCH_KEY = "seereon.bulk-import.batches.v1";

export function loadBatches() {
  try {
    const list = JSON.parse(window.localStorage.getItem(BATCH_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveBatch(batch) {
  try {
    const list = [batch, ...loadBatches().filter((b) => b.batch_id !== batch.batch_id)].slice(0, 15);
    window.localStorage.setItem(BATCH_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [batch];
  }
}

export function updateBatch(batchId, patch) {
  try {
    const list = loadBatches().map((b) => (b.batch_id === batchId ? { ...b, ...patch } : b));
    window.localStorage.setItem(BATCH_KEY, JSON.stringify(list));
    return list;
  } catch {
    return loadBatches();
  }
}

export const newBatchId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export { BULK_CHUNK_SIZE };
