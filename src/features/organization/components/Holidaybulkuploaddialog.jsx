// src/features/organization/components/HolidayBulkUploadDialog.jsx
//
// Mass upload of holiday calendars from an Excel file (.xlsx / .xls only).
// Needs SheetJS once:  npm install xlsx
//
// Flow: choose Excel file → rows are checked in the browser and shown with any
// errors → "Upload" sends the SAME file to
//   POST /attendance/holiday-calendars/upload   (multipart/form-data, field "file")
// The backend reads the file and creates one calendar per Holiday Title + Year.
//
// One Excel row = one holiday. The browser check only catches mistakes early; the
// backend validates the file again and has the final say.

import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/features/recruitment/data/recruitmentMasterAdapters";

export const HOLIDAY_TYPES = ["National", "Regional / State", "Optional / Restricted"];
export const HOLIDAY_PAY_TYPES = ["Paid", "Unpaid"];

// Column headings required in row 1 of the Excel sheet. Matching ignores case,
// spaces, "_" and "-", so "HOLIDAY DATE", "holiday_date", "Holiday-Date" all work.
//   Holiday Title  → name of the calendar (e.g. "National Holidays")
//   Type           → National / Regional / State / Optional / Restricted
//   Year           → e.g. 2026
//   Leave Category → Paid / Unpaid
//   Holiday Date   → the date of the holiday
//   Holiday Name   → name of the holiday (e.g. "Republic Day")
const EXCEL_COLUMNS = [
  "Holiday Title",
  "Type",
  "Year",
  "Leave Category",
  "Holiday Date",
  "Holiday Name",
];

// Other spellings accepted for a heading (compared after keyOf()).
const COLUMN_ALIASES = {
  "Holiday Date": ["date"],
};
const MAX_FILE_MB = 5;
const MAX_ROWS = 2000;

// "Holiday Title" / "holiday_title" / "HOLIDAY TITLE" → "holidaytitle"
const keyOf = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Finds the key used in this row for a heading (main spelling or an alias).
function columnKey(row, col) {
  const keys = [keyOf(col), ...(COLUMN_ALIASES[col] ?? [])];
  return keys.find((k) => k in row) ?? keys[0];
}

// A real Excel file starts with "PK" (.xlsx, a zip) or D0 CF 11 E0 (.xls).
// This catches a CSV / text / other file that was just renamed to .xlsx.
function isExcelBinary(buffer) {
  const b = new Uint8Array(buffer.slice(0, 4));
  const xlsx = b[0] === 0x50 && b[1] === 0x4b;
  const xls = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  return xlsx || xls;
}

// Case / spacing-insensitive match against a fixed list ("national", "STATE", "restricted" ...).
function matchOption(value, options) {
  const v = keyOf(value);
  if (!v) return null;
  return (
    options.find((o) => keyOf(o) === v) ??
    options.find((o) => v.length >= 4 && keyOf(o).includes(v)) ??
    null
  );
}

const pad = (n) => String(n).padStart(2, "0");

function validYmd(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : null;
}

// Accepts a real Excel date, 2026-01-26, 26-01-2026, 26/01/2026, 26.01.2026 → "2026-01-26"
function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // +12h keeps the calendar day correct whatever timezone SheetJS used for the cell
    const d = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    return validYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  const s = String(value ?? "").trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return validYmd(Number(m[3]), Number(m[2]), Number(m[1])); // day first (India)
  return null;
}

/** Turns sheet rows into checked rows: { rowNo, calendarName, type, year, payType, date, name, errors[] } */
function validateRows(rawRows) {
  const seen = new Map(); // "calendar|year" → { type, payType, dates:Set }

  return rawRows.map((raw, i) => {
    const get = (col) => raw[columnKey(raw, col)];
    const errors = [];

    const calendarName = String(get("Holiday Title") ?? "").trim();
    const type = matchOption(get("Type"), HOLIDAY_TYPES);
    const year = Number(String(get("Year") ?? "").trim());
    const payType = matchOption(get("Leave Category"), HOLIDAY_PAY_TYPES);
    const date = normalizeDate(get("Holiday Date"));
    const name = String(get("Holiday Name") ?? "").trim();

    if (!calendarName) errors.push("Holiday title is required");
    if (!type) errors.push(`Type must be one of: ${HOLIDAY_TYPES.join(", ")}`);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.push("Year is invalid");
    if (!payType) errors.push("Leave category must be Paid or Unpaid");
    if (!date) errors.push("Holiday date is invalid (use YYYY-MM-DD or DD-MM-YYYY)");
    if (!name) errors.push("Holiday name is required");
    if (date && Number.isInteger(year) && !date.startsWith(`${year}-`))
      errors.push(`Holiday date is not in ${year}`);

    if (calendarName && Number.isInteger(year)) {
      const k = `${calendarName.toLowerCase()}|${year}`;
      const group = seen.get(k);
      if (!group) {
        seen.set(k, { type, payType, dates: new Set(date ? [date] : []) });
      } else {
        if (type && group.type && type !== group.type)
          errors.push(`Type differs from earlier rows of "${calendarName}"`);
        if (payType && group.payType && payType !== group.payType)
          errors.push(`Leave category differs from earlier rows of "${calendarName}"`);
        if (date && group.dates.has(date)) errors.push("Same date listed twice in this calendar");
        if (date) group.dates.add(date);
      }
    }

    // +2: row 1 is the header, sheet rows are 1-based
    return { rowNo: i + 2, calendarName, type, year, payType, date, name, errors };
  });
}

/** Valid rows → [{ name, type, year, payType, holidays:[{date,name}] }] */
function groupIntoCalendars(rows) {
  const groups = new Map();
  rows
    .filter((r) => r.errors.length === 0)
    .forEach((r) => {
      const k = `${r.calendarName.toLowerCase()}|${r.year}`;
      if (!groups.has(k)) {
        groups.set(k, {
          name: r.calendarName,
          type: r.type,
          year: r.year,
          payType: r.payType,
          holidays: [],
        });
      }
      groups.get(k).holidays.push({ date: r.date, name: r.name });
    });
  return [...groups.values()];
}

/**
 * Reads an Excel file and returns the checked rows (see validateRows).
 * `requiredColumns` lets the calendar form ask only for Holiday Date + Holiday Name.
 * Throws an Error with a user-facing message when the file can't be used.
 */
export async function parseHolidayExcel(file, requiredColumns = EXCEL_COLUMNS) {
  if (!file) throw new Error("Choose an Excel file");
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error("Only Excel files (.xlsx or .xls) can be uploaded");
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`File is larger than ${MAX_FILE_MB} MB`);
  }
  const buffer = await file.arrayBuffer();
  if (!isExcelBinary(buffer)) {
    throw new Error("This is not a valid Excel file. Please upload a .xlsx or .xls file");
  }

  const wb = XLSX.read(buffer, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

  // Normalise header names and drop fully empty rows.
  const raw = json
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [keyOf(k), v])))
    .filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));

  if (raw.length === 0) throw new Error("No data rows found in the first sheet");
  const missing = requiredColumns.filter((c) => !(columnKey(raw[0], c) in raw[0]));
  if (missing.length) throw new Error(`Missing column(s) in row 1: ${missing.join(", ")}`);
  if (raw.length > MAX_ROWS) throw new Error(`Maximum ${MAX_ROWS} rows per upload`);

  return validateRows(raw);
}

export function HolidayBulkUploadDialog({ open, onOpenChange, calApi, onDone }) {
  const [file, setFile] = useState(null); // the original Excel file, sent as-is to the API
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { calendars: [...] } | { error: "..." }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const fileName = file?.name ?? "";

  function reset() {
    setFile(null);
    setRows([]);
    setResult(null);
  }

  async function readFile(picked) {
    if (!picked) return;
    try {
      const checked = await parseHolidayExcel(picked);
      setFile(picked);
      setResult(null);
      setRows(checked);
    } catch (error) {
      console.error("Failed to read holiday file:", error);
      toast.error(error?.message || "Unable to read this Excel file");
    }
  }

  // POST /attendance/holiday-calendars/upload — the backend creates the calendars from the file.
  async function runImport() {
    if (!file || errorRows.length > 0) return;

    setImporting(true);
    try {
      const calendars = await calApi.upload(file);
      setResult({ calendars });
      await onDone?.();
      toast.success(`${calendars.length} holiday calendar(s) uploaded`);
    } catch (error) {
      console.error("Failed to upload holiday calendars:", error);
      const message = apiErrorMessage(error, "Unable to upload the holiday calendars.");
      setResult({ error: message });
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (importing) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="text-primary h-5 w-5" /> Bulk upload holiday calendars
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file with one row per holiday. Row 1 must have the headings:{" "}
            {EXCEL_COLUMNS.join(", ")}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
            <label className="border-border hover:bg-muted/30 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4">
              <Upload className="text-primary h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Choose Excel file</div>
                <div className="text-muted-foreground truncate text-xs">
                  {fileName || `.xlsx or .xls · max ${MAX_FILE_MB} MB`}
                </div>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  readFile(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{rows.length} rows</Badge>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {validRows.length} valid
                </Badge>
                {errorRows.length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-destructive/30 bg-destructive/10 text-destructive"
                  >
                    {errorRows.length} with errors
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  → {groupIntoCalendars(rows).length} calendar(s)
                </span>
              </div>

              <div className="border-border max-h-[320px] overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground sticky top-0 tracking-wider uppercase">
                    <tr>
                      {["Row", "Holiday Title", "Type", "Year", "Leave Category", "Holiday Date", "Holiday Name", "Status"].map(
                        (h) => (
                          <th key={h} className="p-2 text-left">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {rows.map((r) => (
                      <tr key={r.rowNo} className={r.errors.length ? "bg-destructive/5" : ""}>
                        <td className="text-muted-foreground p-2">{r.rowNo}</td>
                        <td className="p-2">{r.calendarName || "—"}</td>
                        <td className="p-2">{r.type || "—"}</td>
                        <td className="p-2">{Number.isInteger(r.year) ? r.year : "—"}</td>
                        <td className="p-2">{r.payType || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.date || "—"}</td>
                        <td className="p-2">{r.name || "—"}</td>
                        <td className="p-2">
                          {r.errors.length ? (
                            <span className="text-destructive flex items-start gap-1">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              {r.errors.join("; ")}
                            </span>
                          ) : (
                            <CheckCircle2 className="text-primary h-4 w-4" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {errorRows.length > 0 && !result && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs">
              Fix the {errorRows.length} row(s) marked in red in your Excel file and choose it again.
              The file is uploaded only when every row is valid.
            </div>
          )}

          {result?.calendars && (
            <div className="border-border bg-muted/30 space-y-1 rounded-lg border p-3 text-sm">
              <div className="font-medium">
                {result.calendars.length} calendar(s) created from {fileName}
              </div>
              {result.calendars.map((c) => (
                <div key={c.id} className="text-muted-foreground text-xs">
                  {c.name} · {c.type} · {c.year} · {c.payType} · {c.holidays.length} holidays
                </div>
              ))}
            </div>
          )}

          {result?.error && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs">
              {result.error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={importing}
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            {result?.calendars ? "Close" : "Cancel"}
          </Button>
          {!result?.calendars && (
            <Button
              className="bg-gradient-emerald text-white"
              disabled={!file || validRows.length === 0 || errorRows.length > 0 || importing}
              onClick={runImport}
            >
              {importing ? "Uploading..." : `Upload ${validRows.length} holiday(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}