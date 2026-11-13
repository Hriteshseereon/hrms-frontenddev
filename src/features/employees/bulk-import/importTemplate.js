// The downloadable Excel template: a header + sample row, and a "Valid values" sheet filled from the company's own
// master lists, so the names a user types match the names the server looks up.
import * as XLSX from "xlsx";
import departmentApi from "@/api/departmentApi";
import designationApi from "@/api/designationApi";
import Branch_api from "@/api/branch";
import SuperAdmin_shift from "@/api/shift";
import SuperAdmin_attendancePattern from "@/api/attendance_pattern";
import { getPayGrades } from "@/api/payGradeApi";
import { IMPORT_COLUMNS } from "./bulkImport";

const listOf = (res) => {
  const d = res?.data?.data ?? res?.data ?? res ?? [];
  if (Array.isArray(d)) return d;
  for (const k of ["items", "results", "departments", "designations", "branches", "shifts", "patterns", "pay_grades", "data"])
    if (Array.isArray(d?.[k])) return d[k];
  return [];
};
const first = (o, ...keys) => {
  for (const k of keys) if (o?.[k]) return String(o[k]);
  return "";
};

const SAMPLE = {
  employee_code: "EMP-0001", first_name: "Asha", last_name: "Patel", wage_type: "Monthly", ctc: 600000,
  personal_email: "asha.patel@example.com", phone: "9876543210", date_of_birth: "1995-04-12", gender: "Female",
  employment_type: "Full-time", work_mode: "office", date_of_joining: "2026-12-01", pf_applicable: "Yes",
  esi_applicable: "No", aadhaar_number: "123412341234", pan_number: "ABCDE1234F",
  bank_account_holder_name: "Asha Patel", bank_name: "HDFC Bank", bank_account_number: "50100123456789",
  ifsc_code: "HDFC0001234",
};

const FIXED_VALUES = {
  wage_type: ["Monthly", "Daily"],
  gender: ["Male", "Female", "Other", "Prefer not to say"],
  employment_type: ["Full-time", "Part-time", "Contract", "Intern"],
  work_mode: ["office", "remote", "hybrid"],
  skill_category: ["Unskilled", "Semi-skilled", "Skilled", "Highly skilled"],
  pf_applicable: ["Yes", "No"],
  esi_applicable: ["Yes", "No"],
};

/** Returns the list of master lists that could not be loaded, so the caller can tell the user. */
export async function downloadImportTemplate() {
  const [departments, designations, branches, shifts, patterns, grades] = await Promise.allSettled([
    departmentApi.getDepartments(),
    designationApi.getDesignations(),
    Branch_api.getBranches(),
    SuperAdmin_shift.getAll({ page: 1, page_size: 100 }),
    SuperAdmin_attendancePattern.getAll(),
    getPayGrades({ status: "Active", page_size: 100 }),
  ]);
  const rows = (r) => (r.status === "fulfilled" ? listOf(r.value) : []);
  const failed = [
    ["departments", departments], ["designations", designations], ["branches", branches],
    ["shifts", shifts], ["attendance patterns", patterns], ["pay grades", grades],
  ].filter(([, r]) => r.status === "rejected").map(([name]) => name);

  const deptName = new Map(rows(departments).map((d) => [String(d.id), first(d, "department_name", "name")]));
  const lists = {
    department: rows(departments).map((d) => first(d, "department_name", "name")),
    designation: rows(designations).map((d) => first(d, "designation_name", "name")),
    designation_department: rows(designations).map((d) => deptName.get(String(d.department_id)) ?? ""),
    branch_name: rows(branches).map((b) => first(b, "branch_name", "name")),
    shift: rows(shifts).map((s) => first(s, "shift_name", "name")),
    attendance_pattern: rows(patterns).map((p) => first(p, "pattern_name", "name", "attendance_pattern_name")),
    grade: rows(grades).filter((g) => g.grade_code).map((g) => String(g.grade_code)),
    ...FIXED_VALUES,
  };
  const columns = Object.keys(lists);
  const depth = Math.max(...columns.map((c) => lists[c].length), 1);
  const valid = [columns, ...Array.from({ length: depth }, (_, i) => columns.map((c) => lists[c][i] ?? ""))];

  const main = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS, IMPORT_COLUMNS.map((c) => SAMPLE[c] ?? "")]);
  main["!cols"] = IMPORT_COLUMNS.map((c) => ({ wch: Math.max(c.length + 2, 18) }));
  const validSheet = XLSX.utils.aoa_to_sheet(valid);
  validSheet["!cols"] = columns.map((c) => ({ wch: Math.max(c.length + 2, 20) }));
  const notes = XLSX.utils.aoa_to_sheet([
    ["How to fill"],
    ["Row 1 is the header: do not rename or reorder it. Row 2 is a sample: replace it with your first employee."],
    ["Required on every row: employee_code, first_name, department, and the pay for the wage type (Monthly needs ctc, Daily needs daily_rate)."],
    ["department, designation, branch_name, shift, attendance_pattern and grade must match a name on the 'Valid values' sheet."],
    ["A designation must belong to the department on the same row."],
    ["Dates are yyyy-mm-dd. Format phone, Aadhaar, account numbers, UAN and ESIC columns as Text so Excel keeps every digit."],
    ["manager_employee_code and hr_partner_employee_code are employee codes of people in this file or already in the system."],
  ]);
  notes["!cols"] = [{ wch: 130 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, main, "Employees");
  XLSX.utils.book_append_sheet(wb, validSheet, "Valid values");
  XLSX.utils.book_append_sheet(wb, notes, "How to fill");
  XLSX.writeFile(wb, "employee-import-template.xlsx");
  return failed;
}
