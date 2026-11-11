import {
  createEmployee as createEmployeeApi,
  getEmployees,
  getEmployeeById,
  getEmployeeDocuments,
  getPayComponents,
  patchEmployeeForm,
  resolveApiUrl,
} from "@/api/employeeApi";
import { organizationApi } from "@/api/organizationApi";
import { generateWorkEmail, isDuplicateWorkEmail } from "@/features/employees/data/workEmail";
import { DocPreviewDialog } from "@/features/employees/components/DocPreviewDialog";
import { useSearch } from "@/lib/navigation";
import { captureFiles } from "@/lib/attachments";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useSessionStore, canCreateEmployee } from "@/features/auth/data/session-store";
import { useCan } from "@/features/auth/data/module-access";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";
import Branch_api from "@/api/branch";
import departmentApi from "@/api/departmentApi";
import designationApi from "@/api/designationApi";
import SuperAdmin_shift from "@/api/shift";
import {
  isUuid,
  listOf,
  staffLabel,
  useEmployeeJobOptions,
} from "@/features/employees/data/useEmployeeJobOptions";
import {
  Users,
  CalendarDays,
  Search,
  Download,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  User,
  Briefcase,
  FileText,
  Landmark,
  Building2,
  Upload,
  Trash2,
  IdCard,
  GraduationCap,
  Link2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pencil,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PromotionsTab } from "@/features/employees/components/PromotionsTab";
import { TransfersTab } from "@/features/employees/components/TransfersTab";
import { ResignationsTab } from "@/features/employees/components/ResignationsTab";
import { TerminationsTab } from "@/features/employees/components/TerminationsTab";
import { WarningsTab } from "@/features/employees/components/WarningsTab";
import { ComplaintsTab } from "@/features/employees/components/ComplaintsTab";
import { ReferralsTab } from "@/features/employees/components/ReferralsTab";
import { InsuranceTab } from "@/features/employees/components/InsuranceTab";
import { RetirementTab } from "@/features/employees/components/RetirementTab";
import {
  useDirectory,
  findEmployee,
  updateBankDetails,
  updatePersonalDetails,
  updateStatutoryIds,
} from "@/features/employees/data/employee-directory";
import { can, hireableRoles, useCurrentUser } from "@/features/auth/data/auth-session";
import { setHrPartner } from "@/features/organization/data/hr-partner";
import { hireEmployee, validateHireInput } from "@/features/recruitment/data/hiring-data";
import { SalaryPreviewPanel } from "@/features/payroll/components/SalaryPreviewPanel";
import { getPayGrades } from "@/api/payGradeApi";
import { Switch } from "@/components/ui/switch";
import { setManager } from "@/features/organization/data/manager-data";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import { exportCsv } from "@/lib/export-utils";
import { inr } from "@/lib/store";
import { EmployeeDetail } from "@/features/employees/components/EmployeeDetail";
import { EmployeeLeaveSheet } from "@/features/leave/components/LeavePieces";
import { HireEmployeeDialog } from "@/features/employees/components/HireEmployeeDialog";
import { useScope, useScopeMatch } from "@/features/organization/data/tenancy";
import * as XLSX from "xlsx";

const BULK_EMPLOYEE_COLUMNS = [
  "first_name", "last_name", "personal_email", "phone", "date_of_birth", "gender",
  "marital_status", "blood_group", "nationality", "religion", "whatsapp_number",
  "emergency_contact_name", "emergency_contact_phone", "current_address", "permanent_address",
  "linkedin_url", "github_url", "twitter_url", "website_url", "aadhaar_number", "pan_number",
  "uan_number", "esic_number", "driving_license_number", "passport_number", "qualification",
  "institution", "year_of_passing", "education_score", "bank_account_holder_name", "bank_name",
  "bank_account_number", "bank_account_number_confirm", "ifsc_code", "bank_branch",
  "bank_account_type", "payment_mode", "date_of_joining", "organization_name", "company_name", "department",
  "designation", "manager_name", "hr_partner_name", "employment_type", "probation_months",
  "ctc", "daily_rate", "grade", "wage_type", "pf_applicable", "esi_applicable", "pf_member_id", "pt_state", "attendance_pattern_id", "notice_period_days", "work_mode",
  "shift_name", "pay_frequency", "prev1_company", "prev1_role", "prev1_from",
  "prev1_to", "prev1_ctc", "prev1_reason",
];
const REQUIRED_BULK_EMPLOYEE_COLUMNS = [
  "first_name", "last_name", "personal_email", "phone", "date_of_birth", "aadhaar_number",
  "pan_number", "bank_account_holder_name", "bank_name", "bank_account_number",
  "bank_account_number_confirm", "ifsc_code", "date_of_joining",
];

function normalizeCsvDate(value, rowNumber, column) {
  const input = String(value ?? "").trim();
  let year, month, day;
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const local = input.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (iso) [, year, month, day] = iso;
  else if (local) [, day, month, year] = local;
  else throw new Error(`Row ${rowNumber}: ${column} must be DD-MM-YYYY or YYYY-MM-DD.`);
  const y = Number(year), m = Number(month), d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Row ${rowNumber}: ${column} is not a valid calendar date.`);
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeAadhaar(value) {
  const input = String(value ?? "").trim().replace(/^'/, "").replace(/\s+/g, "");
  if (/^\d{12}$/.test(input)) return input;
  // Excel can serialize a 12 digit cell in scientific notation when the column
  // was treated as numeric. Accept it only when it round-trips as an exact integer.
  const numeric = Number(input);
  return Number.isSafeInteger(numeric) && /^\d{12}$/.test(String(numeric)) ? String(numeric) : input;
}

function normalizeIntegerDigits(value) {
  const input = String(value ?? "").trim().replace(/^'/, "").replace(/\s+/g, "");
  if (/^\d+$/.test(input)) return input;
  const match = input.match(/^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return input;
  const [, whole, fraction = "", exponentText] = match;
  if (fraction && /[1-9]/.test(fraction) && !exponentText) return input;
  const exponent = Number(exponentText || 0);
  const digits = `${whole}${fraction}`;
  const decimalPosition = whole.length + exponent;
  if (decimalPosition < digits.length && /[1-9]/.test(digits.slice(decimalPosition))) return input;
  if (decimalPosition <= 0) return input;
  return decimalPosition >= digits.length
    ? `${digits}${"0".repeat(decimalPosition - digits.length)}`
    : digits.slice(0, decimalPosition);
}

function validateEmployeeRows(rows) {
  rows = rows.filter((row) => row.some((value) => String(value ?? "").trim()));
  if (rows.length < 2) throw new Error("The file must include a header row and at least one employee.");
  const headers = rows[0].map((h) => String(h ?? "").trim().toLowerCase().replace(/^\uFEFF/, ""));
  for (const required of REQUIRED_BULK_EMPLOYEE_COLUMNS) {
    if (!headers.includes(required)) throw new Error(`Missing required column: ${required}`);
  }
  return rows.slice(1).map((values, index) => {
    const employee = Object.fromEntries(
      headers.map((header, i) => {
        const value = values[i] ?? "";
        return [header, value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim()];
      }),
    );
    const missing = REQUIRED_BULK_EMPLOYEE_COLUMNS.filter((column) => !employee[column]?.trim());
    if (missing.length) throw new Error(`Row ${index + 2}: fill required fields: ${missing.join(", ")}.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.personal_email)) throw new Error(`Row ${index + 2}: personal_email must be a valid email.`);
    if (employee.phone.replace(/\D/g, "").length < 10) throw new Error(`Row ${index + 2}: phone must contain at least 10 digits.`);
    employee.date_of_birth = normalizeCsvDate(employee.date_of_birth, index + 2, "date_of_birth");
    employee.date_of_joining = normalizeCsvDate(employee.date_of_joining, index + 2, "date_of_joining");
    if (employee.date_of_birth >= employee.date_of_joining) throw new Error(`Row ${index + 2}: date_of_birth must be before date_of_joining.`);
    employee.aadhaar_number = normalizeAadhaar(employee.aadhaar_number);
    if (!/^\d{12}$/.test(employee.aadhaar_number)) throw new Error(`Row ${index + 2}: aadhaar_number must be exactly 12 digits. In Excel, format the column as Text before entering it.`);
    if (!/^[A-Z]{5}\d{4}[A-Z]$/i.test(employee.pan_number.trim())) throw new Error(`Row ${index + 2}: pan_number must look like ABCDE1234F.`);
    employee.bank_account_number = normalizeIntegerDigits(employee.bank_account_number);
    employee.bank_account_number_confirm = normalizeIntegerDigits(employee.bank_account_number_confirm);
    if (!/^\d{9,18}$/.test(employee.bank_account_number)) throw new Error(`Row ${index + 2}: bank_account_number must contain 9–18 digits. Format the column as Text in Excel before entering it.`);
    if (employee.bank_account_number !== employee.bank_account_number_confirm) throw new Error(`Row ${index + 2}: bank account confirmation does not match.`);
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(employee.ifsc_code.trim())) throw new Error(`Row ${index + 2}: ifsc_code must look like HDFC0001234.`);
    // Wage type: Monthly (needs ctc) or Daily (needs daily_rate). A blank cell means Monthly.
    const wage = String(employee.wage_type || "Monthly").trim().toLowerCase();
    if (wage !== "monthly" && wage !== "daily") throw new Error(`Row ${index + 2}: wage_type must be Monthly or Daily.`);
    employee.wage_type = wage === "daily" ? "Daily" : "Monthly";
    const amountField = employee.wage_type === "Daily" ? "daily_rate" : "ctc";
    if (!Number.isFinite(Number(employee[amountField])) || Number(employee[amountField]) <= 0)
      throw new Error(`Row ${index + 2}: ${amountField} must be a number greater than zero for a ${employee.wage_type} employee.`);
    // PF / ESI applicability: the template says Yes / No, the server wants true / false (blank = default on).
    for (const key of ["pf_applicable", "esi_applicable"]) {
      if (!employee[key]) continue;
      const answer = employee[key].trim().toLowerCase();
      if (!["yes", "no", "true", "false", "y", "n"].includes(answer)) throw new Error(`Row ${index + 2}: ${key} must be Yes or No.`);
      employee[key] = ["yes", "true", "y"].includes(answer) ? "true" : "false";
    }
    if (employee.uan_number && !/^\d{12}$/.test(employee.uan_number)) throw new Error(`Row ${index + 2}: uan_number must be 12 digits.`);
    if (employee.esic_number && !/^\d{17}$/.test(employee.esic_number)) throw new Error(`Row ${index + 2}: esic_number must be 17 digits.`);
    for (const [key, value] of Object.entries(employee)) {
      if (value && !BULK_EMPLOYEE_COLUMNS.includes(key) && !/^pc_[A-Za-z0-9_]+$/.test(key) && !/^prev\d+_(company|role|from|to|ctc|reason)$/.test(key)) {
        throw new Error(`File has an unsupported column: ${key}`);
      }
    }
    return employee;
  });
}

function parseEmployeeCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
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
  return validateEmployeeRows(rows);
}

function parseEmployeeXlsx(data) {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("The Excel workbook has no worksheets.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    header: 1,
    raw: true,
    defval: "",
  });
  return validateEmployeeRows(rows);
}

async function parseEmployeeFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseEmployeeCsv(await file.text());
  if (extension === "xlsx") return parseEmployeeXlsx(await file.arrayBuffer());
  throw new Error("Choose a CSV or Excel .xlsx file.");
}

async function downloadEmployeeCsvTemplate() {
  let defaultDepartment = null;
  let defaultCompany = null;
  let defaultOrganization = null;
  const session = useSessionStore.getState();
  try {
    const [departmentResponse, companyResponse, organization] = await Promise.all([
      departmentApi.getDepartments(session.companyId ? { company_id: session.companyId } : {}),
      SuperAdmin_auth.getCompanies(),
      organizationApi.getOrganization(),
    ]);
    const companies = listOf(companyResponse, ["items", "companies", "data"]);
    defaultCompany = companies.find((company) => company.id === session.companyId) ?? null;
    defaultOrganization = organization;
    const response = departmentResponse;
    defaultDepartment = listOf(response, ["items", "departments", "data"])[0] ?? null;
  } catch (error) {
    toast.error("Could not load organization options for the sample row. The template will download without them.");
  }
  const sample = {
    first_name: "Asha", last_name: "Patel", personal_email: "asha.patel@example.com", phone: "9876543210",
    date_of_birth: "1995-04-12", gender: "Female", nationality: "Indian", aadhaar_number: "'123456789012",
    pan_number: "ABCDE1234F", bank_account_holder_name: "Asha Patel", bank_name: "HDFC Bank",
    bank_account_number: "'50100123456789", bank_account_number_confirm: "'50100123456789",
    ifsc_code: "HDFC0001234", date_of_joining: "2026-11-15",
    organization_name: defaultOrganization?.name ?? defaultOrganization?.organisation_name ?? defaultOrganization?.organization_name ?? defaultOrganization?.legal_name ?? "",
    company_name: defaultCompany?.company_name ?? defaultCompany?.name ?? "",
    department: defaultDepartment?.department_name ?? defaultDepartment?.name ?? "",
    designation: "", employment_type: "Full-time", probation_months: "3", ctc: "600000", daily_rate: "",
    wage_type: "Monthly", pf_applicable: "true", esi_applicable: "true", bank_account_type: "savings",
  };
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = `${BULK_EMPLOYEE_COLUMNS.join(",")}\n${BULK_EMPLOYEE_COLUMNS.map((column) => csvCell(sample[column])).join(",")}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "employee-onboarding-template.csv"; link.click();
  URL.revokeObjectURL(url);
}

function readableApiError(error) {
  const detail = error?.response?.data?.detail ?? error?.response?.data?.message ?? error?.message;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg ?? item?.message ?? JSON.stringify(item)).join("; ");
  if (detail && typeof detail === "object") return detail.msg ?? detail.message ?? JSON.stringify(detail);
  return String(detail || "Employee creation failed.");
}

function Employees() {
  const { id: presetId } = useSearch(validateSearch);
  const [openAdd, setOpenAdd] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [picked, setPicked] = useState(null);
  const setSelected = setPicked;
  // Global search / deep links open a record directly: /org/employees?id=SRN-0006
  useEffect(() => {
    if (presetId) {
      const e = findEmployee(presetId);
      if (e) {
        setPicked(e);
      } else {
        getEmployeeById(presetId)
          .then((emp) => {
            if (emp) setPicked(emp);
          })
          .catch((err) => {
            console.warn("Could not find employee for presetId:", err);
          });
      }
    }
  }, [presetId]);
  const [leaveFor, setLeaveFor] = useState(null);
  const orgId = useActiveOrgId();
  const inScope = useScopeMatch();
  const collective = useScope().readOnly;
  const me = useCurrentUser();
  const session = useSessionStore();
  const roleUpper = String(session.role || me?.role || "").toUpperCase();
  const isEmployeeRole = roleUpper === "EMPLOYEE";
  // `permissions` from the backend: add / edit need "employee.edit" (module level), admins hold it by scope.
  const canDo = useCan();
  const canManagePeople =
    (can(me.role, "employee.manage") || canCreateEmployee(session.role)) &&
    !isEmployeeRole &&
    canDo("employee.edit");
  const orgName = useOrgs().find((o) => o.id === orgId)?.name ?? "Organization";
  const directory = useDirectory();
  // Always show the live record — the dialog kept the row captured at click time, so a promotion / transfer made from
  // the record's own tabs left the header showing the old designation and branch until it was reopened.
  // A deep link (?id=…) or global-search hit opens a record only inside the working scope — the URL used to open any
  // employee of any company or organisation.
  const pickedLive = picked ? (directory.find((e) => e.id === picked.id) ?? picked) : null;
  const selected = pickedLive;
  /** Row selection — the Export button exports the selection when one exists, otherwise the filtered list. */
  const [checked, setChecked] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [designation, setDesignation] = useState("all");
  const [office, setOffice] = useState("all");
  const [status, setStatus] = useState("all");

  // Backend API Pagination & Data State
  const [backendEmployees, setBackendEmployees] = useState(null);
  const [backendTotal, setBackendTotal] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loadingList, setLoadingList] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Debounce search query by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  // Fetch employees from backend API
  const fetchBackendEmployees = useCallback(async () => {
    setLoadingList(true);
    setApiError(null);
    try {
      const res = await getEmployees({
        page,
        limit,
        search: debouncedQ,
        status: status !== "all" ? status : undefined,
        branch_id: office !== "all" ? office : undefined,
        department_id: designation !== "all" ? designation : undefined,
      });

      if (res && Array.isArray(res.items)) {
        const mapped = res.items.map((e) => ({
          ...e,
          id: e.id,
          user_id: e.user_id,
          name: [e.first_name, e.last_name].filter(Boolean).join(" ") || e.name || e.work_email,
          email: e.work_email || e.email,
          phone: e.phone || "—",
          dept: e.department || e.department_id || "—",
          role: e.designation || e.role || "—",
          branch: e.branch_name || e.branch || "—",
          status: e.status || (e.is_active ? "Active" : "Inactive"),
        }));
        setBackendEmployees(mapped);
        setBackendTotal(res.total ?? mapped.length);
      } else if (Array.isArray(res)) {
        setBackendEmployees(res);
        setBackendTotal(res.length);
      } else {
        setBackendEmployees([]);
        setBackendTotal(0);
      }
    } catch (err) {
      console.warn("Backend getEmployees request failed:", err);
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        "Could not load employees from backend.";
      setApiError(String(detail));
      setBackendEmployees(null);
      setBackendTotal(null);
    } finally {
      setLoadingList(false);
    }
  }, [page, limit, debouncedQ, status, office, designation]);

  useEffect(() => {
    fetchBackendEmployees();
  }, [fetchBackendEmployees]);

  const orgEmployees = useMemo(
    // Working scope: all companies (collective view), one company, or one branch.
    () => directory.filter((e) => inScope(e.orgId, null, e.branch)),
    [directory, inScope],
  );

  const fallbackRows = useMemo(
    () =>
      orgEmployees.filter((e) => {
        const t = q.trim().toLowerCase();
        if (t && !`${e.name} ${e.id} ${e.email} ${e.dept} ${e.role}`.toLowerCase().includes(t))
          return false;
        if (designation !== "all" && e.role !== designation) return false;
        if (office !== "all" && e.branch !== office) return false;
        if (status !== "all" && e.status !== status) return false;
        return true;
      }),
    [orgEmployees, q, designation, office, status],
  );

  const rows = backendEmployees !== null ? backendEmployees : fallbackRows;
  const total = backendTotal !== null ? backendTotal : fallbackRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const branches = new Set(orgEmployees.map((e) => e.branch)).size;
  const departments = new Set(orgEmployees.map((e) => e.dept)).size;
  const designations = useMemo(
    () => Array.from(new Set(orgEmployees.map((e) => e.role))).sort(),
    [orgEmployees],
  );
  const offices = useMemo(
    () => Array.from(new Set(orgEmployees.map((e) => e.branch))).sort(),
    [orgEmployees],
  );
  const chosen = rows.filter((e) => checked.has(e.id));
  const allChecked = rows.length > 0 && chosen.length === rows.length;
  const toggleAll = (on) => setChecked(on ? new Set(rows.map((e) => e.id)) : new Set());
  const toggleOne = (id, on) =>
    setChecked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const exportList = () => {
    const list = chosen.length ? chosen : rows;
    exportCsv(
      "employees",
      ["Emp ID", "Name", "Email", "Phone", "Department", "Designation", "Office", "Status"],
      list.map((e) => [e.id, e.name, e.email, e.phone, e.dept, e.role, e.branch, e.status]),
    );
    toast.success(`${list.length} employees exported`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="text-primary h-6 w-6" /> Employees
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {orgEmployees.length} employees · {branches} branch{branches === 1 ? "" : "es"} ·{" "}
            {departments} departments · {orgName}
          </p>
        </div>
      </div>

      <Tabs defaultValue="all">
        <ScrollTabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="resignations">Resignations</TabsTrigger>
          <TabsTrigger value="terminations">Terminations</TabsTrigger>
          <TabsTrigger value="warnings">Warnings</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="retirement">Retirement</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="all" className="space-y-6 pt-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={exportList}>
              <Download className="h-4 w-4" /> Export
              {chosen.length ? ` (${chosen.length} selected)` : ""}
            </Button>
            {canManagePeople && <HireEmployeeDialog />}
            {canManagePeople && <BulkEmployeeUploadDialog open={openBulk} onOpenChange={setOpenBulk} onCreated={fetchBackendEmployees} orgName={orgName} />}
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              {canManagePeople && (
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
                    <Plus className="h-4 w-4" /> Add Employee (Detailed Form)
                  </Button>
                </DialogTrigger>
              )}
              <AddEmployeeDialog onClose={() => setOpenAdd(false)} onCreated={() => fetchBackendEmployees()} />
            </Dialog>
          </div>
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="border-border bg-muted/40 flex max-w-md min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
                <Search className="text-muted-foreground h-4 w-4" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                  }}
                  placeholder="Search by name, ID, email, department…"
                  className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Select
                value={designation}
                onValueChange={(v) => {
                  setDesignation(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All designations</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={office}
                onValueChange={(v) => {
                  setOffice(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All offices</SelectItem>
                  {offices.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["Active", "On Leave", "Notice", "Inactive", "Suspended"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => fetchBackendEmployees()}
                title="Refresh employee list from backend"
                disabled={loadingList}
              >
                <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
              </Button>
              <div className="text-muted-foreground ml-auto text-xs">
                Showing {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    <th className="w-10 p-3 text-left">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(v) => toggleAll(v === true)}
                        aria-label="Select all employees in view"
                      />
                    </th>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Contact</th>
                    <th className="p-3 text-left">Department</th>
                    <th className="p-3 text-left">Designation</th>
                    <th className="p-3 text-left">Office</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="w-10 p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {loadingList ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-muted-foreground text-sm font-medium">
                            Loading employees from HRMS backend…
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : apiError ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                          <AlertCircle className="h-6 w-6" />
                          <p className="text-sm font-semibold">{apiError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchBackendEmployees()}
                            className="mt-2 text-xs"
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-semibold text-sm">No employees match the current filters.</p>
                          <p className="text-muted-foreground text-xs">
                            Try adjusting search keywords or clearing status/office filters.
                          </p>
                          {(q || status !== "all" || office !== "all" || designation !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 text-xs"
                              onClick={() => {
                                setQ("");
                                setStatus("all");
                                setOffice("all");
                                setDesignation("all");
                                setPage(1);
                              }}
                            >
                              Clear Filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className="hover:bg-muted/30 cursor-pointer transition"
                      >
                        <td className="p-3" onClick={(ev) => ev.stopPropagation()}>
                          <Checkbox
                            checked={checked.has(e.id)}
                            onCheckedChange={(v) => toggleOne(e.id, v === true)}
                            aria-label={`Select ${e.name}`}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="border-gold/30 h-9 w-9 border">
                              <AvatarFallback className="bg-gradient-emerald text-xs font-semibold text-white">
                                {e.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold">{e.name}</div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span title="Employee Code">Emp ID: {e.employee_code || "—"}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3" /> {e.email}
                          </div>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3" /> {e.phone}
                          </div>
                        </td>
                        <td className="p-3">{e.dept}</td>
                        <td className="p-3">{e.role}</td>
                        <td className="text-muted-foreground p-3">{e.branch}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              e.status === "Active"
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : e.status === "Notice"
                                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                                  : "border-gold/30 bg-gold/10 text-gold"
                            }
                          >
                            {e.status}
                          </Badge>
                        </td>
                        <td className="p-3 whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setLeaveFor(e.id)}
                              aria-label={`Leave record of ${e.name}`}
                            >
                              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Leave
                            </Button>
                            {canManagePeople && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-primary font-medium"
                                onClick={() => setEditingEmployee(e)}
                                aria-label={`Edit ${e.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setSelected(e)}
                              aria-label={`View ${e.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="border-t bg-muted/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground">
                Showing <span className="font-medium text-foreground">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{" "}
                <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span> employees
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Rows per page:</span>
                  <Select
                    value={String(limit)}
                    onValueChange={(v) => {
                      setLimit(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[68px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1 || loadingList}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages || loadingList}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="promotions" className="pt-4">
          <PromotionsTab />
        </TabsContent>
        <TabsContent value="transfers" className="pt-4">
          <TransfersTab />
        </TabsContent>
        <TabsContent value="resignations" className="pt-4">
          <ResignationsTab />
        </TabsContent>
        <TabsContent value="terminations" className="pt-4">
          <TerminationsTab />
        </TabsContent>
        <TabsContent value="warnings" className="pt-4">
          <WarningsTab />
        </TabsContent>
        <TabsContent value="complaints" className="pt-4">
          <ComplaintsTab />
        </TabsContent>
        <TabsContent value="referrals" className="pt-4">
          <ReferralsTab />
        </TabsContent>
        <TabsContent value="insurance" className="pt-4">
          <InsuranceTab />
        </TabsContent>
        <TabsContent value="retirement" className="pt-4">
          <RetirementTab />
        </TabsContent>
      </Tabs>

      <EmployeeLeaveSheet empId={leaveFor} onClose={() => setLeaveFor(null)} />

      {/* Details Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected?.name} — Employee record</DialogTitle>
            <DialogDescription>
              Complete employee profile, payroll, attendance, performance and training details.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <EmployeeDetail
              employee={selected}
              onEdit={() => setEditingEmployee(selected)}
              onUpdated={() => fetchBackendEmployees()}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Employee — the onboarding form, pre-filled */}
      <Dialog open={!!editingEmployee} onOpenChange={(o) => !o && setEditingEmployee(null)}>
        {editingEmployee && (
          <EditEmployeeForm
            employee={editingEmployee}
            onClose={() => setEditingEmployee(null)}
            onUpdated={(updated) => {
              fetchBackendEmployees();
              if (selected?.id === updated?.id) {
                setSelected((prev) => ({ ...prev, ...updated }));
              }
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function BulkEmployeeUploadDialog({ open, onOpenChange, onCreated, orgName }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const inputRef = useRef(null);
  const close = () => { if (!busy) { onOpenChange(false); setFile(null); setSummary(null); } };
  const upload = async () => {
    if (!file) { toast.error("Choose a CSV or Excel .xlsx file to continue."); return; }
    let employees;
    try { employees = await parseEmployeeFile(file); }
    catch (error) { toast.error(error.message || "Could not read this employee file."); return; }
    setBusy(true); setSummary(null);
    let succeeded = 0;
    const failures = [];
    let departments = [], designations = [], assignablePeople = [], shifts = [], companies = [], organization = null;
    try {
      const session = useSessionStore.getState();
      const scopeParams = session.companyId ? { company_id: session.companyId } : {};
      const [response, companyResponse, organizationResponse] = await Promise.all([
        departmentApi.getDepartments(scopeParams),
        SuperAdmin_auth.getCompanies().catch(() => null),
        organizationApi.getOrganization(),
      ]);
      departments = listOf(response, ["items", "departments", "data"]).map((department) => ({
        id: department.id,
        name: department.department_name ?? department.name ?? "",
        company_id: department.company_id,
      }));
      companies = listOf(companyResponse, ["items", "companies", "data"]).map((company) => ({
        id: company.id, name: company.company_name ?? company.name ?? "", organization_id: company.organization_id,
      }));
      organization = organizationResponse;
      const [designationResponse, peopleResponse, shiftResponse] = await Promise.all([
        designationApi.getDesignations(scopeParams),
        getEmployees({ page: 1, limit: 100, ...scopeParams }),
        SuperAdmin_shift.getAll({ page: 1, page_size: 100, ...(session.organizationId ? { organization_id: session.organizationId } : {}) }),
      ]);
      designations = listOf(designationResponse, ["items", "results", "designations", "data"]).map((item) => ({
        id: item.id, name: item.designation_name ?? item.name ?? "", department_id: item.department_id,
      }));
      assignablePeople = listOf(peopleResponse, ["items", "employees", "data"]).map((person) => ({
        id: person.id,
        name: [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || person.name || person.work_email,
      }));
      shifts = listOf(shiftResponse, ["items", "shifts", "data"]).map((shift) => ({
        id: shift.id, name: shift.shift_name ?? shift.name ?? "",
      }));
    } catch {
      setBusy(false);
      toast.error("Could not load departments. Refresh the page and try again.");
      return;
    }
    const generatedEmails = new Set();
    const departmentLists = new Map();
    const designationLists = new Map();
    for (const [index, employee] of employees.entries()) {
      const payload = Object.fromEntries(Object.entries(employee).filter(([key, value]) => key !== "bank_account_number_confirm" && value !== "" && (BULK_EMPLOYEE_COLUMNS.includes(key) || /^pc_[A-Za-z0-9_]+$/.test(key) || /^prev\d+_(company|role|from|to|ctc|reason)$/.test(key))));
      const normalizeOptionName = (value) => String(value ?? "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
      const exactName = (list, name) => list.filter((item) => normalizeOptionName(item.name) === normalizeOptionName(name));
      const session = useSessionStore.getState();
      const orgLabel = organization?.name ?? organization?.organisation_name ?? organization?.organization_name ?? organization?.legal_name ?? "";
      const organizationId = organization?.id ?? session.organizationId;
      if (employee.organization_name && normalizeOptionName(employee.organization_name) !== normalizeOptionName(orgLabel)) {
        failures.push({ row: index + 2, email: employee.personal_email, message: `Organization "${employee.organization_name}" does not match the active organization.` });
        continue;
      }
      let companyId = session.companyId || session.scopeCompanyId || "";
      // A company-scoped login already supplies the authoritative tenant ID.
      // Avoid rejecting its uploads because the company-list endpoint omits or
      // differently scopes the current company in its response.
      if (employee.company_name && !session.companyId) {
        const companyMatches = exactName(companies, employee.company_name).filter(
          (company) =>
            !company.organization_id ||
            !organizationId ||
            String(company.organization_id).trim() === String(organizationId).trim(),
        );
        const scopedCompany = companies.find(
          (company) => String(company.id) === String(companyId),
        );
        const scopedCompanyName = scopedCompany?.name || session.companyName || "";
        const matchesCurrentCompany =
          companyId &&
          normalizeOptionName(employee.company_name) === normalizeOptionName(scopedCompanyName);
        if (companyMatches.length !== 1 && !matchesCurrentCompany) {
          failures.push({ row: index + 2, email: employee.personal_email, message: `Company "${employee.company_name}" must match one configured company in the active organization.` });
          continue;
        }
        if (companyMatches.length === 1) companyId = companyMatches[0].id;
      }
      if (organizationId && isUuid(organizationId)) payload.organization_id = organizationId;
      if (companyId && isUuid(companyId)) payload.company_id = companyId;
      if (companyId && companyId === session.companyId && session.branchId && isUuid(session.branchId)) payload.branch_id = session.branchId;

      let departmentOptions = departments;
      if (companyId && companyId !== session.companyId) {
        if (!departmentLists.has(companyId)) {
          departmentLists.set(companyId, departmentApi.getDepartments({ company_id: companyId }).then((response) =>
            listOf(response, ["items", "departments", "data"]).map((department) => ({
              id: department.id, name: department.department_name ?? department.name ?? "", company_id: department.company_id,
            })),
          ));
        }
        try { departmentOptions = await departmentLists.get(companyId); } catch { departmentOptions = departments; }
      }
      let departmentMatch = exactName(departmentOptions, employee.department);
      if (companyId && departmentMatch.length > 1) {
        const companyMatches = departmentMatch.filter((item) => item.company_id === companyId);
        const sharedMatches = departmentMatch.filter((item) => !item.company_id);
        departmentMatch = companyMatches.length ? companyMatches : sharedMatches;
      }
      if (!departmentMatch.length && companyId) {
        try {
          if (!departmentLists.has("all")) {
            departmentLists.set("all", departmentApi.getDepartments().then((allResponse) =>
              listOf(allResponse, ["items", "departments", "data"]).map((department) => ({
                id: department.id, name: department.department_name ?? department.name ?? "", company_id: department.company_id,
              })),
            ));
          }
          const allDepartments = await departmentLists.get("all");
          const companyScopedMatches = exactName(allDepartments, employee.department).filter((item) => !item.company_id || item.company_id === companyId);
          departmentMatch = companyScopedMatches.filter((item) => item.company_id === companyId).length
            ? companyScopedMatches.filter((item) => item.company_id === companyId)
            : companyScopedMatches;
        } catch {
          // Keep the scoped lookup result and report a useful row-level error below.
        }
      }
      if (departmentMatch.length === 1 && companyId && departmentMatch[0].company_id && departmentMatch[0].company_id !== companyId) departmentMatch = [];
      if (departmentMatch.length === 1) payload.department_id = departmentMatch[0].id;
      if (!payload.department_id || !isUuid(payload.department_id)) {
        const detail = departmentMatch.length > 1
          ? `Department name "${employee.department}" matches multiple configured departments; contact an admin to resolve the duplicate names.`
          : `Department name "${employee.department || "(blank)"}" was not found in the configured department list.`;
        failures.push({ row: index + 2, email: employee.personal_email, message: detail });
        continue;
      }
      if (employee.designation) {
        let designationOptions = designations;
        if (companyId && companyId !== session.companyId) {
          if (!designationLists.has(companyId)) {
            designationLists.set(companyId, designationApi.getDesignations({ company_id: companyId }).then((response) =>
              listOf(response, ["items", "results", "designations", "data"]).map((item) => ({
                id: item.id, name: item.designation_name ?? item.name ?? "", department_id: item.department_id,
              })),
            ));
          }
          try { designationOptions = await designationLists.get(companyId); } catch { designationOptions = designations; }
        }
        const designationMatches = exactName(designationOptions, employee.designation).filter((item) => !item.department_id || item.department_id === payload.department_id);
        if (designationMatches.length !== 1) {
          failures.push({ row: index + 2, email: employee.personal_email, message: `Designation "${employee.designation}" must match one configured designation for this department.` });
          continue;
        }
        payload.designation_id = designationMatches[0].id;
      }
      for (const [nameColumn, idField, label] of [["manager_name", "manager_id", "Manager"], ["hr_partner_name", "hr_partner_id", "HR partner"], ["shift_name", "shift_id", "Shift"]]) {
        if (!employee[nameColumn]) continue;
        const matches = exactName(nameColumn === "shift_name" ? shifts : assignablePeople, employee[nameColumn]);
        if (matches.length !== 1) {
          failures.push({ row: index + 2, email: employee.personal_email, message: `${label} name "${employee[nameColumn]}" must match one configured record.` });
          break;
        }
        payload[idField] = matches[0].id;
      }
      if (failures.some((failure) => failure.row === index + 2)) continue;
      delete payload.organization_name;
      delete payload.company_name;
      delete payload.manager_name;
      delete payload.hr_partner_name;
      delete payload.shift_name;
      payload.role = "Employee";
      let emailAttempt = 0;
      payload.work_email = generateWorkEmail({ first: employee.first_name, last: employee.last_name, org: orgName, attempt: emailAttempt });
      while (generatedEmails.has(payload.work_email.toLowerCase())) {
        emailAttempt += 1;
        payload.work_email = generateWorkEmail({ first: employee.first_name, last: employee.last_name, org: orgName, attempt: emailAttempt });
      }
      generatedEmails.add(payload.work_email.toLowerCase());
      payload.password = makeTempPassword();
      payload.status = "ACTIVE";
      payload.probation_months = "3";
      payload.employment_type ||= "Full-time";
      payload.wage_type = employee.wage_type;
      if (payload.wage_type === "Daily") delete payload.ctc; else delete payload.daily_rate;
      try {
        for (;;) {
          try { await createEmployeeApi(payload); break; }
          catch (error) {
            if (!isDuplicateWorkEmail(error) || emailAttempt >= 5) throw error;
            emailAttempt += 1;
            payload.work_email = generateWorkEmail({ first: employee.first_name, last: employee.last_name, org: orgName, attempt: emailAttempt });
            generatedEmails.add(payload.work_email.toLowerCase());
          }
        }
        succeeded += 1;
      }
      catch (error) {
        failures.push({ row: index + 2, email: payload.work_email || employee.personal_email, message: readableApiError(error) });
      }
    }
    setBusy(false); setSummary({ succeeded, failures });
    if (succeeded) { onCreated(); toast.success(`${succeeded} employee${succeeded === 1 ? "" : "s"} onboarded.`); }
    if (!failures.length) { setFile(null); }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) close(); else onOpenChange(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Upload className="h-4 w-4" /> Bulk Upload</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk upload</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={downloadEmployeeCsvTemplate}><Download className="h-4 w-4" /> Download Template</Button>
          <div className="rounded-lg border border-dashed p-5">
            <Label htmlFor="employee-bulk-csv">Employee file (CSV or Excel .xlsx)</Label>
            <Input ref={inputRef} id="employee-bulk-csv" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-2" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setSummary(null); }} />
          </div>
          {file && <p className="text-sm">Selected: <span className="font-medium">{file.name}</span></p>}
          {summary && <div className="max-h-40 space-y-1 overflow-auto rounded-md bg-muted/40 p-3 text-sm"><p>{summary.succeeded} created · {summary.failures.length} failed</p>{summary.failures.map((failure) => <p className="text-destructive" key={`${failure.row}-${failure.email}`}>Row {failure.row} ({failure.email}): {failure.message}</p>)}</div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={busy}>Close</Button>
          <Button type="button" onClick={upload} disabled={busy || !file} className="bg-gradient-emerald text-white">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : "Upload and onboard"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Add Employee — multi-tab premium form
// ============================================================

/** Server validation errors keyed by API field name (see `{detail:[{loc, msg}]}`). */
const FormErrorsContext = createContext({});

// Form input name -> API field name, so a server error can be shown under the right input.
const FORM_TO_API = {
  firstName: "first_name",
  lastName: "last_name",
  dob: "date_of_birth",
  maritalStatus: "marital_status",
  bloodGroup: "blood_group",
  personalEmail: "personal_email",
  workEmail: "work_email",
  whatsapp: "whatsapp_number",
  emergencyName: "emergency_contact_name",
  emergencyPhone: "emergency_contact_phone",
  currentAddress: "current_address",
  permanentAddress: "permanent_address",
  linkedin: "linkedin_url",
  github: "github_url",
  twitter: "twitter_url",
  website: "website_url",
  yearOfPassing: "year_of_passing",
  eduScore: "education_score",
  aadhaar: "aadhaar_number",
  pan: "pan_number",
  uan: "uan_number",
  esiNo: "esic_number",
  drivingLicence: "driving_license_number",
  passport: "passport_number",
  bankHolder: "bank_account_holder_name",
  bankName: "bank_name",
  accountNo: "bank_account_number",
  ifsc: "ifsc_code",
  bankBranch: "bank_branch",
  accountType: "bank_account_type",
  payMode: "payment_mode",
  doj: "date_of_joining",
  employmentType: "employment_type",
  noticeDays: "notice_period_days",
  workMode: "work_mode",
  probationMonths: "probation_months",
  payFrequency: "pay_frequency",
  wageType: "wage_type",
  dailyRate: "daily_rate",
  pfMemberId: "pf_member_id",
  ptState: "pt_state",
};

const PERSONAL_KEYS = new Set([
  "first_name", "last_name", "date_of_birth", "gender", "marital_status", "blood_group", "nationality",
  "religion", "personal_email", "work_email", "phone", "whatsapp_number", "emergency_contact_name",
  "emergency_contact_phone", "current_address", "permanent_address", "linkedin_url", "github_url",
  "twitter_url", "website_url",
]);
const LEGAL_KEYS = new Set([
  "pan_number", "aadhaar_number", "uan_number", "esic_number", "pf_member_id", "driving_license_number", "passport_number",
  "aadhaar_card", "pan_card", "driving_license", "passport", "resume", "offer_letter", "appointment_letter",
  "educational_certificate", "address_proof",
]);
const EDUCATION_KEYS = new Set(["qualification", "institution", "year_of_passing", "education_score"]);

/** Which tab of the form holds an API field — used to jump to the first field the server rejected. */
function tabOfField(key) {
  if (/^prev\d+_/.test(key) || EDUCATION_KEYS.has(key)) return "previous";
  if (PERSONAL_KEYS.has(key)) return "personal";
  if (LEGAL_KEYS.has(key)) return "legal";
  if (/^bank_|^ifsc_code$|^payment_mode$|^passbook$/.test(key)) return "bank";
  return "job";
}

function FieldRow({ children }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

function Field({ label, children, required, field }) {
  const errors = useContext(FormErrorsContext);
  const childName = Children.toArray(children).find((c) => isValidElement(c) && c.props?.name)?.props
    .name;
  const key = FORM_TO_API[field ?? childName] ?? field ?? childName;
  const error = key ? errors[key] : undefined;
  return (
    <div
      className={
        "space-y-1.5" +
        (error
          ? " [&_input]:border-destructive [&_textarea]:border-destructive [&_[role=combobox]]:border-destructive"
          : "")
      }
    >
      <Label className={"text-xs font-medium " + (error ? "text-destructive" : "text-muted-foreground")}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-destructive text-[11px]">{error}</p>}
    </div>
  );
}


/** `name` is the multipart field name sent to the backend (see POST /employees/form). */
function FileUpload({ label, hint, name, file, onSelect, onRemove, existing, onPreviewExisting }) {
  const inputRef = useRef(null);
  const uploadError = useContext(FormErrorsContext)[name];
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Object URL for the chosen file — released when the file changes or the card unmounts.
  useEffect(() => {
    if (!(file instanceof File)) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isPdf = file?.type === "application/pdf" || /\.pdf$/i.test(file?.name ?? "");
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">{label}</Label>
      <label className="border-border bg-muted/30 hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2.5 transition">
        <div className="flex min-w-0 items-center gap-2">
          <div className="bg-gradient-emerald grid h-8 w-8 shrink-0 place-items-center rounded-md text-white">
            <Upload className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {file?.name ?? (existing ? existing.file_name || "Uploaded" : "Click to upload")}
            </div>
            <div className="text-muted-foreground text-[11px]">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Selected`
                : existing
                  ? "Uploaded · click to replace"
                  : (hint ?? "PDF, JPG, PNG · max 5 MB")}
            </div>
          </div>
        </div>
        {file ? (
          <div className="flex items-center">
            <button
              type="button"
              title="Preview"
              onClick={(e) => {
                e.preventDefault();
                setPreviewOpen(true);
              }}
              className="text-muted-foreground hover:text-primary p-1 transition"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Remove"
              onClick={(e) => {
                e.preventDefault();
                if (inputRef.current) inputRef.current.value = "";
                if (onRemove) onRemove(name);
              }}
              className="text-muted-foreground hover:text-destructive p-1 transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : existing ? (
          <button
            type="button"
            title="Preview current file"
            onClick={(e) => {
              e.preventDefault();
              onPreviewExisting?.();
            }}
            className="text-muted-foreground hover:text-primary p-1 transition"
          >
            <Eye className="h-4 w-4" />
          </button>
        ) : (
          <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
            Upload
          </Badge>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 5 * 1024 * 1024) {
                toast.error(`${f.name} exceeds maximum size of 5 MB`);
                if (inputRef.current) inputRef.current.value = "";
                return;
              }
              if (onSelect) onSelect(name, f);
              setPreviewOpen(true);
            }
          }}
        />
      </label>
      {uploadError && <p className="text-destructive text-[11px]">{uploadError}</p>}
      <Dialog open={previewOpen && !!previewUrl} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{file?.name ?? label}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 flex min-h-[50vh] flex-1 items-center justify-center overflow-auto rounded-md border">
            {isPdf ? (
              <iframe title={file?.name} src={previewUrl} className="h-[70vh] w-full" />
            ) : (
              <img src={previewUrl} alt={file?.name} className="max-h-[70vh] object-contain" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3 pb-2">
      <div className="bg-gradient-emerald grid h-9 w-9 place-items-center rounded-lg text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground text-xs">{desc}</div>
      </div>
    </div>
  );
}

function PrevEmploymentBlock({ index, onRemove, init, docFiles, onSelect, onRemoveFile, onPreviewExisting }) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Employer #{index}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={!onRemove}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
        <FieldRow>
          <Field label="Company Name" required>
            <Input name={`prev${index}_company`} placeholder="e.g. Infosys Ltd." defaultValue={init?.company} />
          </Field>
          <Field label="Designation" required>
            <Input name={`prev${index}_role`} placeholder="e.g. Senior Engineer" defaultValue={init?.role} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="From">
            <Input name={`prev${index}_from`} type="month" defaultValue={init?.from} />
          </Field>
          <Field label="To">
            <Input name={`prev${index}_to`} type="month" defaultValue={init?.to} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="CTC (Annual)">
            <Input name={`prev${index}_ctc`} placeholder="₹\u00A012,00,000" defaultValue={init?.ctc} />
          </Field>
          <Field label="Reason for Leaving">
            <Input name={`prev${index}_reason`} placeholder="Career growth" defaultValue={init?.reason} />
          </Field>
        </FieldRow>
        <Separator />
        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Documents
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            ["relieving_letter", "Relieving Letter"],
            ["experience_letter", "Experience / Service Letter"],
            ["payslip_1", "Payslip — Last Month"],
            ["payslip_2", "Payslip — 2 Months Ago"],
            ["payslip_3", "Payslip — 3 Months Ago"],
            ["form16", "Form 16 (Optional)"],
          ].map(([type, label]) => {
            const name = `prev${index}_${type}`;
            return (
              <FileUpload
                key={type}
                name={name}
                label={label}
                file={docFiles?.[name]}
                onSelect={onSelect}
                onRemove={onRemoveFile}
                existing={init?.documents?.find((d) => d.document_type === type)}
                onPreviewExisting={() => onPreviewExisting?.(type, label)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


/** Random temp password containing upper, lower, digit and symbol. */
function makeTempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@#$!%*"];
  const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const all = sets.join("");
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 12) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Employee form: onboarding when `employee` is absent, the same form pre-filled with the record when present. */
// Radix Select cannot hold an empty value: this stands for "nothing chosen" in optional dropdowns.
const NONE = "__none__";

function AddEmployeeDialog({ onClose, onCreated, employee }) {
  const isEdit = !!employee;
  const me = useCurrentUser();
  const session = useSessionStore();
  const {
    userId: sessionUserId,
    role: sessionRole,
    organizationId: sessionOrgId,
    companyId: sessionCompanyId,
    branchId: sessionBranchId,
  } = session;

  const roleUpper = String(sessionRole || me?.backendRole || me?.role || "").toUpperCase();
  const isSuperAdmin = roleUpper === "SUPER_ADMIN" || roleUpper === "SUPERADMIN";
  const isCompanyAdmin = roleUpper === "COMPANY_ADMIN";
  const isBranchAdmin = roleUpper === "BRANCH_ADMIN" || roleUpper === "BRANCHADMIN";
  const isEmployee = roleUpper === "EMPLOYEE";

  // Values the uncontrolled inputs start with when editing — the full record from GET /employees/{id}.
  const [init] = useState(() => {
    if (!employee) return {};
    const e = employee;
    const edu = e.education?.[0] ?? {};
    return {
      firstName: e.first_name ?? "",
      lastName: e.last_name ?? "",
      dob: e.date_of_birth ?? "",
      gender: e.gender || undefined,
      maritalStatus: e.marital_status || undefined,
      bloodGroup: e.blood_group || undefined,
      nationality: e.nationality || undefined,
      religion: e.religion ?? "",
      personalEmail: e.personal_email ?? "",
      workEmail: e.work_email ?? "",
      phone: e.phone && e.phone !== "—" ? e.phone : "",
      whatsapp: e.whatsapp_number ?? "",
      emergencyName: e.emergency_contact_name ?? "",
      emergencyPhone: e.emergency_contact_phone ?? "",
      currentAddress: e.current_address ?? "",
      permanentAddress: e.permanent_address ?? "",
      linkedin: e.linkedin_url ?? "",
      github: e.github_url ?? "",
      twitter: e.twitter_url ?? "",
      website: e.website_url ?? "",
      qualification: edu.qualification ?? "",
      institution: edu.institution ?? "",
      yearOfPassing: edu.year_of_passing != null ? String(edu.year_of_passing) : "",
      eduScore: edu.score ?? "",
      aadhaar: e.aadhaar_number ?? "",
      pan: e.pan_number ?? "",
      uan: e.uan_number ?? "",
      esiNo: e.esic_number ?? "",
      drivingLicence: e.driving_license_number ?? "",
      passport: e.passport_number ?? "",
      bankHolder: e.bank_account_holder_name ?? "",
      bankName: e.bank_name ?? "",
      accountNo: e.bank_account_number ?? "",
      accountNo2: e.bank_account_number ?? "",
      ifsc: e.ifsc_code ?? "",
      bankBranch: e.bank_branch ?? "",
      accountType: e.bank_account_type || undefined,
      payMode: e.payment_mode || undefined,
      doj: e.date_of_joining ?? "",
      employmentType: e.employment_type || undefined,
      noticeDays: e.notice_period_days != null ? String(e.notice_period_days) : undefined,
      workMode: e.work_mode || undefined,
      ctc: e.ctc != null ? String(Math.round(Number(e.ctc))) : "",
      wageType: e.wage_type === "Monthly" || e.wage_type === "Daily" ? e.wage_type : "",
      dailyRate: e.daily_rate != null ? String(e.daily_rate) : "",
      pfApplicable: e.pf_applicable !== false,
      esiApplicable: e.esi_applicable !== false,
      pfMemberId: e.pf_member_id ?? "",
      ptState: e.pt_state ?? "",
      probationMonths: e.probation_months != null ? String(e.probation_months) : undefined,
      payFrequency: e.pay_frequency || undefined,
      grade: e.grade || undefined,
      experience: (e.previous_employments ?? []).map((x) => ({
        company: x.company_name ?? "",
        role: x.designation ?? "",
        from: x.from_month ?? "",
        to: x.to_month ?? "",
        ctc: x.ctc != null ? String(x.ctc) : "",
        reason: x.reason_for_leaving ?? "",
        documents: x.documents ?? [],
      })),
      payComponents: Object.fromEntries((e.pay_components ?? []).map((c) => [c.code, c.value])),
    };
  });

  const [tab, setTab] = useState("personal");
  const [prevJobs, setPrevJobs] = useState(() =>
    Array.from({ length: Math.max(1, init.experience?.length ?? 0) }, (_, i) => i + 1),
  );
  const formRef = useRef(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const orgId = useActiveOrgId();

  // Scope selection states
  const [backendCompanies, setBackendCompanies] = useState([]);
  const [backendBranches, setBackendBranches] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    isEdit ? employee.company_id || "" : sessionCompanyId || "",
  );
  const [selectedBranchId, setSelectedBranchId] = useState(
    isEdit ? employee.branch_id || "" : sessionBranchId || "",
  );
  const [loadingScope, setLoadingScope] = useState(false);

  // Document files state
  const [docFiles, setDocFiles] = useState({});
  const [existingDocs, setExistingDocs] = useState({});
  const [formErrors, setFormErrors] = useState({});
  // Work email is generated from the organisation + employee name (locked); a duplicate bumps `emailAttempt`.
  const localOrgName = useOrgs().find((o) => o.id === orgId)?.name;
  const [apiOrgName, setApiOrgName] = useState("");
  const [firstNameVal, setFirstNameVal] = useState(init.firstName ?? "");
  const [lastNameVal, setLastNameVal] = useState(init.lastName ?? "");
  const [emailAttempt, setEmailAttempt] = useState(0);
  useEffect(() => {
    if (isEdit) return undefined;
    let alive = true;
    organizationApi
      .getOrganization()
      .then((o) => alive && setApiOrgName(o?.name || o?.organisation_name || o?.organization_name || o?.legal_name || ""))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isEdit]);
  const generatedWorkEmail = generateWorkEmail({
    first: firstNameVal,
    last: lastNameVal,
    org: apiOrgName || localOrgName,
    attempt: emailAttempt,
  });
  const [payComponents, setPayComponents] = useState([]);
  useEffect(() => {
    let alive = true;
    getPayComponents()
      .then((list) => alive && setPayComponents(list))
      .catch((err) => console.warn("Could not load pay components:", err));
    return () => {
      alive = false;
    };
  }, []);
  const [docPreview, setDocPreview] = useState(null);
  useEffect(() => {
    if (!isEdit) return undefined;
    let alive = true;
    getEmployeeDocuments(employee.id)
      .then((res) => {
        if (!alive) return;
        const map = {};
        (res?.documents ?? []).forEach((d) => {
          map[d.document_type] = d;
        });
        setExistingDocs(map);
      })
      .catch((err) => console.warn("Could not load documents:", err));
    return () => {
      alive = false;
    };
  }, [isEdit, employee?.id]);

  // Signed view URLs expire (~15 min), so a fresh one is fetched each time a preview opens.
  const previewExistingDoc = async (type, label) => {
    try {
      const res = await getEmployeeDocuments(employee.id);
      const d = (res?.documents ?? []).find((x) => x.document_type === type);
      const src = resolveApiUrl(d?.view_url);
      if (!src) {
        toast.error("This document is not available to preview.");
        return;
      }
      setDocPreview({
        title: d.file_name || label,
        src,
        isPdf: /pdf/i.test(d.content_type ?? "") || /\.pdf$/i.test(d.file_name ?? ""),
      });
    } catch {
      toast.error("Could not load the document.");
    }
  };
  // Previous-employment documents: fetch the record again for a fresh signed link.
  const previewPrevDoc = async (blockIndex, type, label) => {
    try {
      const rec = await getEmployeeById(employee.id);
      const d = rec?.previous_employments?.[blockIndex - 1]?.documents?.find(
        (x) => x.document_type === type,
      );
      const src = resolveApiUrl(d?.view_url);
      if (!src) {
        toast.error("This document is not available to preview.");
        return;
      }
      setDocPreview({
        title: d.file_name || label,
        src,
        isPdf: /pdf/i.test(d.content_type ?? "") || /\.pdf$/i.test(d.file_name ?? ""),
      });
    } catch {
      toast.error("Could not load the document.");
    }
  };
  const handleDocSelect = (name, file) => setDocFiles((prev) => ({ ...prev, [name]: file }));
  const handleDocRemove = (name) =>
    setDocFiles((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

  // Load backend companies (for SuperAdmin) and branches (for selected/assigned company)
  useEffect(() => {
    let isMounted = true;
    async function loadScope() {
      setLoadingScope(true);
      try {
        if (isSuperAdmin) {
          const res = await SuperAdmin_auth.getCompanies();
          if (isMounted) setBackendCompanies(listOf(res, ["data", "items", "companies"]));
        }

        const compIdForBranches = isSuperAdmin ? selectedCompanyId : sessionCompanyId;
        if (compIdForBranches && isUuid(compIdForBranches)) {
          const bRes = await Branch_api.getBranches(compIdForBranches);
          if (isMounted) setBackendBranches(listOf(bRes, ["data", "items", "branches"]));
        } else {
          if (isMounted) setBackendBranches([]);
        }
      } catch (err) {
        console.warn("Failed to load backend scope options:", err);
      } finally {
        if (isMounted) setLoadingScope(false);
      }
    }
    loadScope();
    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, selectedCompanyId, sessionCompanyId]);

  // Job & Role options — all of them come from the backend masters.
  const [placementMode, setPlacementMode] = useState(
    (isEdit ? employee.company_id : sessionCompanyId) ? "company" : "org",
  );
  const [deptId, setDeptId] = useState(employee?.department_id ?? "");
  const [designationId, setDesignationId] = useState(employee?.designation_id ?? "");
  const [roleName, setRoleName] = useState(employee?.role || "Employee");
  const [managerId, setManagerId] = useState(employee?.manager_id ?? "");
  const [hrId, setHrId] = useState(employee?.hr_partner_id ?? "");
  const [shiftId, setShiftId] = useState(employee?.shift_id ?? "");

  const companyScope = isSuperAdmin ? selectedCompanyId : sessionCompanyId;
  const {
    departments,
    designations,
    roles: apiRoles,
    shifts,
    managers: managerOptions,
    hrs: hrOptions,
  } = useEmployeeJobOptions({
    deptId,
    companyId: isUuid(companyScope) ? companyScope : "",
    orgId: sessionOrgId,
  });

  // Default access role: the one whose name starts with "Employee".
  useEffect(() => {
    if (isEdit) return;
    const def = apiRoles.find((r) => /^employee/i.test(r.name));
    if (def) setRoleName(def.name);
  }, [apiRoles, isEdit]);

  const deptDesignations = designations;
  const roleOptions = apiRoles.length ? apiRoles.map((r) => r.name) : ["Employee"];

  // Compensation: Monthly (annual CTC) or Daily (daily rate). An old row with another wage type starts empty.
  const [wageType, setWageType] = useState(isEdit ? (init.wageType ?? "") : "Monthly");
  const [ctcDraft, setCtcDraft] = useState(Number(init.ctc) || 0);
  const [dailyRateDraft, setDailyRateDraft] = useState(Number(init.dailyRate) || 0);
  const [pfApplicable, setPfApplicable] = useState(init.pfApplicable !== false);
  const [esiApplicable, setEsiApplicable] = useState(init.esiApplicable !== false);
  const [ptStateDraft, setPtStateDraft] = useState(init.ptState ?? "");
  // Grades come from the Pay Grades list (active only); the server rejects any other code.
  const [gradeOptions, setGradeOptions] = useState([]);
  useEffect(() => {
    let alive = true;
    getPayGrades({ status: "Active", page_size: 100 })
      .then((res) => {
        const d = res?.data?.data ?? res?.data ?? [];
        const rows = Array.isArray(d) ? d : (d.items ?? d.pay_grades ?? []);
        if (alive) setGradeOptions(rows.filter((g) => g.grade_code && (g.status ?? "Active") === "Active"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** Reads the form, validates it, creates the employee through the backend API, then mirrors it in the local store. */
  async function create() {
    const root = formRef.current;
    if (!root || submittingRef.current) return;

    if (isEmployee) {
      toast.error("Employees are not authorized to create or onboard employees.");
      return;
    }

    const v = {};
    root.querySelectorAll("[name]").forEach((el) => {
      if (el.type === "file") return;
      v[el.name] = el.value;
    });
    const roleObj = apiRoles.find((r) => r.name === roleName);
    const shiftObj = shifts.find((x) => String(x.id) === String(shiftId));
    v.dept = departments.find((d) => String(d.id) === String(deptId))?.name ?? "";
    v.designation = designations.find((d) => String(d.id) === String(designationId))?.name ?? "";
    v.role = roleName;
    v.managerId = managerId;
    v.hrPartnerId = hrId;

    const required = [
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["dob", "Date of birth"],
      ["personalEmail", "Personal email"],
      ["phone", "Mobile number"],
      ["doj", "Date of joining"],
    ];
    const missing = required.filter(([k]) => !v[k]?.trim()).map(([, l]) => l);
    if (wageType !== "Monthly" && wageType !== "Daily") missing.push("Wage type");
    else if (wageType === "Monthly" && !(Number(v.ctc) > 0)) missing.push("Annual CTC");
    else if (wageType === "Daily" && !(Number(v.dailyRate) > 0)) missing.push("Daily rate");
    if (isSuperAdmin && placementMode === "company" && !isUuid(selectedCompanyId)) {
      missing.push("Company");
    }
    if (missing.length) {
      toast.error(`Complete the required fields: ${missing.join(", ")}`);
      setTab(
        missing.some((m) =>
          ["First name", "Last name", "Date of birth", "Personal email", "Mobile number"].includes(m),
        )
          ? "personal"
          : "job",
      );
      return;
    }

    const fail = (msg, t) => {
      toast.error(msg);
      setTab(t);
    };

    const pan = (v.pan ?? "").trim().toUpperCase();
    const aadhaar = (v.aadhaar ?? "").replace(/\s+/g, "");
    const uan = (v.uan ?? "").replace(/\s+/g, "");
    const acct = (v.accountNo ?? "").replace(/\s+/g, "");
    const ifsc = (v.ifsc ?? "").trim().toUpperCase();

    if (aadhaar && aadhaar !== employee?.aadhaar_number && !/^\d{12}$/.test(aadhaar)) return fail("Aadhaar number must be 12 digits", "legal");
    if (pan && pan !== employee?.pan_number && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))
      return fail("PAN must be in the format ABCDE1234F", "legal");
    if (uan && uan !== employee?.uan_number && !/^\d{12}$/.test(uan)) return fail("UAN must be 12 digits", "legal");
    const esic = (v.esiNo ?? "").replace(/\s+/g, "");
    if (esic && esic !== employee?.esic_number && !/^\d{17}$/.test(esic)) return fail("ESIC number must be 17 digits", "legal");
    if (acct && acct !== employee?.bank_account_number && !/^\d{9,18}$/.test(acct)) return fail("Account number must be 9–18 digits", "bank");
    if (acct && acct !== (v.accountNo2 ?? "").replace(/\s+/g, ""))
      return fail("The re-entered account number does not match", "bank");
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return fail("IFSC must look like HDFC0001234", "bank");

    let workEmail = v.workEmail?.trim() || v.personalEmail.trim();
    if (!workEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
      return fail("Enter a valid work email address", "personal");
    }

    // The local mirror and its validation want an annual figure: a daily rate is stood in at 26 days a month.
    const localCtc = wageType === "Daily" ? Number(v.dailyRate) * 26 * 12 : Number(v.ctc);
    const validationError = validateHireInput({
      firstName: v.firstName,
      lastName: v.lastName,
      personalEmail: v.personalEmail,
      phone: v.phone,
      dob: v.dob,
      doj: v.doj,
      ctc: localCtc,
      workEmail: v.workEmail,
    });
    if (validationError) {
      return fail(
        validationError,
        /ctc|date of joining is required/i.test(validationError) ? "job" : "personal",
      );
    }

    // Determine tenant IDs based on caller's role and placement rules
    const effectiveOrgId = isUuid(sessionOrgId) ? sessionOrgId : (isUuid(orgId) ? orgId : undefined);

    let effectiveCompanyId = undefined;
    if (isBranchAdmin || isCompanyAdmin) {
      if (isUuid(sessionCompanyId)) effectiveCompanyId = sessionCompanyId;
    } else if (isSuperAdmin) {
      if (isUuid(selectedCompanyId)) effectiveCompanyId = selectedCompanyId;
    }

    let effectiveBranchId = undefined;
    if (isBranchAdmin) {
      if (isUuid(sessionBranchId)) effectiveBranchId = sessionBranchId;
    } else if (isCompanyAdmin || isSuperAdmin) {
      if (effectiveCompanyId && isUuid(selectedBranchId)) {
        effectiveBranchId = selectedBranchId;
      }
    }

    const branchIdParam = effectiveBranchId;
    const departmentIdParam = deptId;
    const selectedBranchName = backendBranches.find((b) => b.id === effectiveBranchId)?.name ?? "";

    const tempPassword = isEdit ? "" : makeTempPassword();

    const apiFields = {
      first_name: v.firstName.trim(),
      ...(isEdit ? {} : { password: tempPassword }),
      last_name: v.lastName?.trim() || "",
      work_email: workEmail,
      personal_email: v.personalEmail?.trim() || "",
      phone: v.phone?.trim() || "",
      date_of_birth: v.dob || "",
      gender: v.gender || "",
      department: v.dept || "",
      department_id: isUuid(departmentIdParam) ? departmentIdParam : undefined,
      designation: v.designation || "",
      designation_id: isUuid(designationId) ? designationId : undefined,
      role: v.role || "Employee",
      role_id: isUuid(roleObj?.id) ? roleObj.id : undefined,
      hr_partner_id: isUuid(hrId) ? hrId : undefined,
      shift_id: isUuid(shiftId) ? shiftId : undefined,
      employment_type: v.employmentType || "Full-time",
      manager_id: isUuid(v.managerId) ? v.managerId : undefined,
      date_of_joining: v.doj || "",
      probation_months: v.probationMonths || "3",
      ...(isEdit ? {} : { status: "ACTIVE" }),
      ctc: wageType === "Monthly" && v.ctc ? String(Number(v.ctc)) : "",
      daily_rate: wageType === "Daily" && v.dailyRate ? String(Number(v.dailyRate)) : "",
      grade: v.grade || "",
      wage_type: wageType,
      pf_applicable: String(pfApplicable),
      esi_applicable: String(esiApplicable),
      pf_member_id: v.pfMemberId?.trim() || undefined,
      pt_state: v.ptState?.trim() || undefined,
      attendance_pattern_id: v.patternId || undefined,
      notice_period_days: v.noticeDays || undefined,
      work_mode: v.workMode || undefined,
      pan_number: pan || undefined,
      aadhaar_number: aadhaar || undefined,
      uan_number: uan || undefined,
      esic_number: esic || undefined,
      bank_name: v.bankName?.trim() || undefined,
      bank_account_number: acct || undefined,
      ifsc_code: ifsc || undefined,
      marital_status: v.maritalStatus || undefined,
      blood_group: v.bloodGroup || undefined,
      nationality: v.nationality || undefined,
      religion: v.religion || undefined,
      whatsapp_number: v.whatsapp || undefined,
      emergency_contact_name: v.emergencyName || undefined,
      emergency_contact_phone: v.emergencyPhone || undefined,
      current_address: v.currentAddress || undefined,
      permanent_address: v.permanentAddress || undefined,
      linkedin_url: v.linkedin || undefined,
      github_url: v.github || undefined,
      twitter_url: v.twitter || undefined,
      website_url: v.website || undefined,
      qualification: v.qualification || undefined,
      institution: v.institution || undefined,
      year_of_passing: v.yearOfPassing || undefined,
      education_score: v.eduScore || undefined,
      driving_license_number: v.drivingLicence || undefined,
      passport_number: (v.passport ?? "").trim().toUpperCase() || undefined,
      bank_account_holder_name: v.bankHolder || undefined,
      bank_branch: v.bankBranch || undefined,
      bank_account_type: v.accountType || undefined,
      payment_mode: v.payMode || undefined,
      pay_frequency: v.payFrequency || undefined,
    };

    // Masked values (XXXX1234) come back from the server read-only — never send one back.
    ["pan_number", "aadhaar_number", "bank_account_number", "passport_number", "uan_number"].forEach(
      (k) => {
        if (isEdit && /^X{4,}/i.test(apiFields[k] ?? "")) delete apiFields[k];
      },
    );

    // Previous employment blocks, renumbered from 1 (blank-company blocks are ignored).
    const tv = (k) => (v[k] ?? "").trim();
    const prevBlocks = prevJobs
      .map((n) => ({
        n,
        company: tv(`prev${n}_company`),
        role: tv(`prev${n}_role`),
        from: tv(`prev${n}_from`),
        to: tv(`prev${n}_to`),
        ctc: tv(`prev${n}_ctc`).replace(/[^\d.]/g, ""),
        reason: tv(`prev${n}_reason`),
      }))
      .filter((b) => b.company);
    const prevFiles = Object.entries(docFiles).filter(
      ([k, f]) => /^prev\d+_/.test(k) && f instanceof File && f.size > 0,
    );
    const addPrevBlocks = (fd) => {
      prevBlocks.forEach((b, i) => {
        const idx = i + 1;
        const put = (suffix, val) => val && fd.append(`prev${idx}_${suffix}`, val);
        put("company", b.company);
        put("role", b.role);
        put("from", b.from);
        put("to", b.to);
        put("ctc", b.ctc);
        put("reason", b.reason);
        prevFiles
          .filter(([k]) => k.startsWith(`prev${b.n}_`))
          .forEach(([k, f]) => fd.append(`prev${idx}_${k.slice(`prev${b.n}_`.length)}`, f));
      });
    };

    // Append valid UUIDs only; a branch is never sent without its company.
    if (effectiveOrgId) apiFields.organization_id = effectiveOrgId;
    if (effectiveCompanyId) {
      apiFields.company_id = effectiveCompanyId;
      if (branchIdParam) apiFields.branch_id = branchIdParam;
    }

    // Build FormData from text fields and File objects
    const formData = new FormData();
    if (isEdit) {
      // PATCH carries only what changed. work_email / employee_code / organization_id are not editable.
      const locked = new Set(["work_email", "organization_id", "company_id", "branch_id"]);
      // Optional fields the backend lets us clear with the literal string "null".
      const clearable = new Set([
        "last_name", "personal_email", "phone", "date_of_birth", "gender", "grade", "pan_number",
        "aadhaar_number", "uan_number", "esic_number", "pf_member_id", "pt_state", "bank_name", "bank_account_number", "ifsc_code",
        "marital_status", "blood_group", "nationality", "religion", "whatsapp_number",
        "emergency_contact_name", "emergency_contact_phone", "current_address", "permanent_address",
        "linkedin_url", "github_url", "twitter_url", "website_url", "qualification", "institution",
        "year_of_passing", "education_score", "driving_license_number", "passport_number",
        "bank_account_holder_name", "bank_branch", "bank_account_type", "payment_mode",
        "department", "department_id", "designation", "designation_id", // department / designation are optional
      ]);
      const edu = employee.education?.[0] ?? {};
      const eduPrev = {
        qualification: edu.qualification,
        institution: edu.institution,
        year_of_passing: edu.year_of_passing,
        education_score: edu.score,
      };
      const prevValue = (key) => (key in eduPrev ? eduPrev[key] : employee[key]);

      Object.keys(apiFields)
        .concat([...clearable].filter((k) => !(k in apiFields)))
        .forEach((key) => {
          if (locked.has(key)) return;
          const next = String(apiFields[key] ?? "").trim();
          const prev = String(prevValue(key) ?? "").trim();
          if (next === prev) return;
          if (next !== "" && prev !== "" && !isNaN(next) && !isNaN(prev) && Number(next) === Number(prev)) return;
          if (next === "") {
            if (clearable.has(key) && prev !== "") formData.append(key, "null");
            return;
          }
          formData.append(key, next);
        });
      // A wage type change needs the amount for the new type in the same request (422 otherwise).
      if (formData.has("wage_type")) {
        if (wageType === "Daily") formData.set("daily_rate", String(Number(v.dailyRate)));
        else formData.set("ctc", String(Number(v.ctc)));
      }
      // Optional ids: the string "null" clears them.
      [
        ["manager_id", managerId],
        ["hr_partner_id", hrId],
        ["shift_id", shiftId],
      ].forEach(([key, val]) => {
        const prev = employee[key] || "";
        if ((val || "") === prev) return;
        formData.set(key, isUuid(val) ? val : "null");
      });
      // Placement (not for a Branch Admin, who is locked): company cleared -> organisation level,
      // branch cleared -> company level. A branch is never sent without its company.
      if (!isBranchAdmin) {
        const prevCompany = employee.company_id || "";
        const prevBranch = employee.branch_id || "";
        const newCompany = effectiveCompanyId || "";
        const newBranch = newCompany ? branchIdParam || "" : "";
        if (newCompany !== prevCompany) {
          formData.set("company_id", newCompany || "null");
          if (newCompany && newBranch) formData.set("branch_id", newBranch);
          else if (newCompany && prevBranch) formData.set("branch_id", "null");
        } else if (newCompany && newBranch !== prevBranch) {
          formData.set("branch_id", newBranch || "null");
        }
      }
      // Pay components: pc_<CODE>=<number>; "null" removes the override.
      Object.keys(v)
        .filter((k) => k.startsWith("pc_"))
        .forEach((k) => {
          const code = k.slice(3);
          const next = tv(k);
          const prev = init.payComponents?.[code];
          if (next === "") {
            if (prev !== undefined) formData.set(k, "null");
          } else if (prev === undefined || Number(next) !== Number(prev)) {
            formData.set(k, next);
          }
        });
      // Previous employment: any prevN_* key replaces the whole list, so send it only when it changed.
      const sig = (x) => JSON.stringify([x.company, x.role, x.from, x.to, x.ctc, x.reason]);
      const initSig = (init.experience ?? []).filter((x) => x.company).map(sig);
      const nowSig = prevBlocks.map(sig);
      if (prevFiles.length || (prevBlocks.length && JSON.stringify(initSig) !== JSON.stringify(nowSig))) {
        addPrevBlocks(formData);
      }
    } else {
      Object.entries(apiFields).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          formData.append(key, String(value).trim());
        }
      });
      Object.keys(v)
        .filter((k) => k.startsWith("pc_") && tv(k) !== "")
        .forEach((k) => formData.append(k, tv(k)));
      addPrevBlocks(formData);
    }

    Object.entries(docFiles).forEach(([name, file]) => {
      // previous-employment files were attached (renumbered) with their blocks above
      if (/^prev\d+_/.test(name)) return;
      if (file instanceof File && file.size > 0) {
        formData.append(name, file);
      }
    });

    if (isEdit && ![...formData.keys()].length) {
      toast.info("No changes to save.");
      onClose();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormErrors({});

    try {
      let apiEmployee;
      if (isEdit) {
        apiEmployee = await patchEmployeeForm(employee.id, formData);
      } else {
        // If the generated work email is already registered, regenerate a slightly different one and post again.
        let attempt = emailAttempt;
        for (;;) {
          try {
            apiEmployee = await createEmployeeApi(formData);
            break;
          } catch (err) {
            if (!isDuplicateWorkEmail(err) || attempt >= 5) throw err;
            attempt += 1;
            const taken = workEmail;
            workEmail = generateWorkEmail({
              first: v.firstName,
              last: v.lastName,
              org: apiOrgName || localOrgName,
              attempt,
            });
            formData.set("work_email", workEmail);
            setEmailAttempt(attempt);
            toast.info(`${taken} is already taken — trying ${workEmail}`);
          }
        }
        workEmail = apiEmployee?.work_email || workEmail;
      }

      // Store in Zustand session store distinct from logged-in user scope
      if (!isEdit) useSessionStore.getState().setLastCreatedEmployee(apiEmployee);

      const employeeProfileId = apiEmployee?.id || apiEmployee?.employee_id;

      // Keep existing local directory and profile store in sync
      const row = isEdit
        ? { id: employee.id, firstName: v.firstName.trim(), lastName: v.lastName?.trim() ?? "" }
        : hireEmployee({
        id: employeeProfileId || undefined,
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        personalEmail: v.personalEmail.trim(),
        phone: v.phone.trim(),
        dob: v.dob || "",
        gender: v.gender || "",
        orgId,
        branch: selectedBranchName,
        dept: v.dept,
        designation: v.designation,
        // The local directory only knows the built-in access roles; custom roles live on the backend.
        role: hireableRoles(me.role).includes(v.role) ? v.role : "Employee",
        employmentType: v.employmentType || "Full-time",
        managerId: v.managerId || null,
        doj: v.doj,
        probationMonths: Number(v.probationMonths || 3),
        ctc: localCtc,
        grade: v.grade || undefined,
        workEmail,
      });

      if (v.hrPartnerId) setHrPartner(row.id, v.hrPartnerId);
      if (v.managerId) setManager(row.id, v.managerId);

      updateStatutoryIds(row.id, {
        pan,
        aadhaar,
        uan: uan || undefined,
        esiNo: v.esiNo?.trim() || undefined,
      });

      updateBankDetails(row.id, {
        holder: v.bankHolder?.trim() || "",
        bankName: v.bankName?.trim() || "",
        accountNo: acct,
        ifsc,
        mode: `${v.payMode || "NEFT"} — Salary Account`,
      });

      const t = (k) => (v[k] ?? "").trim();
      const experience = prevJobs
        .map((n) => ({
          company: t(`prev${n}_company`),
          role: t(`prev${n}_role`),
          from: t(`prev${n}_from`),
          to: t(`prev${n}_to`),
          ctc: t(`prev${n}_ctc`),
          reason: t(`prev${n}_reason`),
        }))
        .filter((x) => x.company);

      updatePersonalDetails(row.id, {
        personal: {
          maritalStatus: t("maritalStatus"),
          bloodGroup: t("bloodGroup"),
          nationality: t("nationality"),
          emergencyContact: [t("emergencyName"), t("emergencyPhone")].filter(Boolean).join(" · "),
          currentAddress: t("currentAddress"),
          permanentAddress: t("permanentAddress"),
          personalEmail: t("personalEmail"),
        },
        job: {
          noticePeriodDays: Number(v.noticeDays) || undefined,
          workMode: { office: "On-site", remote: "Remote", hybrid: "Hybrid" }[t("workMode")] ?? "",
          shift: shiftObj
            ? `${shiftObj.name}${shiftObj.start ? ` (${shiftObj.start} – ${shiftObj.end})` : ""}`
            : "",
        },
        education: t("qualification")
          ? [
              {
                degree: t("qualification"),
                institute: t("institution"),
                year: t("yearOfPassing"),
                score: t("eduScore"),
              },
            ]
          : [],
        experience,
        other: Object.fromEntries(
          [
            "religion",
            "whatsapp",
            "linkedin",
            "github",
            "twitter",
            "website",
            "drivingLicence",
            "passport",
            "bankBranch",
            "accountType",
            "payFrequency",
            ...Object.keys(v).filter((k) => k.startsWith("pc_")),
          ]
            .filter((k) => t(k))
            .map((k) => [k, t(k)]),
        ),
      });

      const employeeName = apiEmployee?.first_name
        ? `${apiEmployee.first_name} ${apiEmployee.last_name ?? ""}`.trim()
        : `${row.firstName} ${row.lastName}`;

      if (isEdit) {
        toast.success(`${employeeName} updated successfully`);
      } else toast.success(
        `${employeeName} created successfully (Employee ${apiEmployee?.employee_code || employeeProfileId || row.id}) · Login: ${workEmail}`,
        { duration: 8000 },
      );
      if (isEdit) {
        // nothing to email on edit
      } else if (apiEmployee?.credentials_email_queued) {
        toast.success(`Credentials sent to ${apiEmployee.credentials_email_to || v.personalEmail}`);
      } else {
        toast.warning(`Employee created, but the credentials email was not sent. Temporary password: ${tempPassword}`, {
          duration: 20000,
        });
      }
      if (typeof onCreated === "function") {
        onCreated({ ...employee, ...apiEmployee });
      }
      onClose();
    } catch (error) {
      console.error(`${isEdit ? "Update" : "Create"} employee API failed:`, error);
      const detail =
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        error?.message ??
        `Could not ${isEdit ? "update" : "create"} employee. Please try again.`;
      if (Array.isArray(detail)) {
        // One entry per invalid field: mark them all and jump to the first one's tab.
        const next = {};
        detail.forEach((d) => {
          const field = (d.loc ?? []).filter((x) => x !== "body").pop();
          if (field && !next[field]) next[field] = d.msg;
        });
        setFormErrors(next);
        const first = Object.keys(next)[0];
        if (first) setTab(tabOfField(first));
        toast.error(
          detail.length === 1
            ? detail[0].msg
            : `${detail.length} fields need attention — see the highlighted fields.`,
        );
      } else {
        toast.error(String(detail));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const tabs = [
    { id: "personal", label: "Personal", icon: User },
    { id: "previous", label: "Previous Employment", icon: Briefcase },
    { id: "legal", label: "Legal & Documents", icon: FileText },
    { id: "bank", label: "Bank Details", icon: Landmark },
    { id: "job", label: "Job & Role", icon: Building2 },
  ];

  return (
    <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0">
      <FormErrorsContext.Provider value={formErrors}>
      <form
        ref={formRef}
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-11 w-11 place-items-center rounded-xl text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">{isEdit ? "Edit Employee" : "Add New Employee"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update any detail captured at onboarding, and add or replace documents."
                  : "Onboard a new team member with complete personal, legal and job details."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
          <div className="bg-muted/30 overflow-x-auto border-b px-6 pt-4">
            <TabsList className="inline-flex h-auto w-max flex-nowrap gap-1 bg-transparent p-0">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:border-primary gap-2 rounded-md data-[state=active]:border-b-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Personal */}
            <TabsContent
              value="personal"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={User}
                title="Basic Information"
                desc="Legal name, contact details and identity"
              />

              <FieldRow>
                <Field label="First Name" required>
                  <Input
                    name="firstName"
                    defaultValue={init.firstName}
                    placeholder="Ananya"
                    onChange={(e) => {
                      setFirstNameVal(e.target.value);
                      setEmailAttempt(0);
                    }}
                  />
                </Field>
                <Field label="Last Name" required>
                  <Input
                    name="lastName"
                    defaultValue={init.lastName}
                    placeholder="Sharma"
                    onChange={(e) => {
                      setLastNameVal(e.target.value);
                      setEmailAttempt(0);
                    }}
                  />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Date of Birth" required>
                  <Input name="dob" defaultValue={init.dob} type="date" />
                </Field>
                <Field label="Gender">
                  <Select name="gender" defaultValue={init.gender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Marital Status">
                  <Select name="maritalStatus" defaultValue={init.maritalStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Blood Group">
                  <Select name="bloodGroup" defaultValue={init.bloodGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Nationality">
                  <Input name="nationality" placeholder="Indian" defaultValue={init.nationality ?? "Indian"} />
                </Field>
                <Field label="Religion (Optional)">
                  <Input name="religion" defaultValue={init.religion} placeholder="—" />
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle icon={Phone} title="Contact" desc="How we reach the employee" />
              <FieldRow>
                <Field label="Personal Email" required>
                  <Input name="personalEmail" defaultValue={init.personalEmail} type="email" placeholder="ananya@gmail.com" />
                </Field>
                <Field label="Work Email" field="work_email">
                  {isEdit ? (
                    <Input name="workEmail" defaultValue={init.workEmail} disabled type="email" />
                  ) : (
                    <>
                      <Input
                        name="workEmail"
                        value={generatedWorkEmail}
                        readOnly
                        type="email"
                        placeholder="Generated from the employee name"
                      />
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        Auto-generated — create this Gmail account for the employee. If it is already
                        taken, a similar address is chosen on save.
                      </p>
                    </>
                  )}
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Mobile Number" required>
                  <Input name="phone" defaultValue={init.phone} placeholder="+91 98450 12345" />
                </Field>
                <Field label="WhatsApp Number">
                  <Input name="whatsapp" defaultValue={init.whatsapp} placeholder="+91 98450 12345" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Emergency Contact Name">
                  <Input name="emergencyName" defaultValue={init.emergencyName} placeholder="Full name" />
                </Field>
                <Field label="Emergency Contact Number">
                  <Input name="emergencyPhone" defaultValue={init.emergencyPhone} placeholder="+91 98450 00000" />
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle
                icon={Building2}
                title="Address"
                desc="Current and permanent addresses"
              />
              <Field label="Current Address">
                <Textarea
                  name="currentAddress" defaultValue={init.currentAddress}
                  placeholder="House / street / city / state / PIN"
                  rows={2}
                />
              </Field>
              <Field label="Permanent Address">
                <Textarea
                  name="permanentAddress" defaultValue={init.permanentAddress}
                  placeholder="Same as current, or provide separately"
                  rows={2}
                />
              </Field>

              <Separator />
              <SectionTitle
                icon={Link2}
                title="Social Profiles"
                desc="Optional — enrich the employee profile"
              />

              <FieldRow>
                <Field label="LinkedIn">
                  <Input name="linkedin" defaultValue={init.linkedin} placeholder="linkedin.com/in/…" />
                </Field>
                <Field label="GitHub">
                  <Input name="github" defaultValue={init.github} placeholder="github.com/…" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="X / Twitter">
                  <Input name="twitter" defaultValue={init.twitter} placeholder="x.com/…" />
                </Field>
                <Field label="Personal Website">
                  <Input name="website" defaultValue={init.website} placeholder="https://…" />
                </Field>
              </FieldRow>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setTab("previous")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Previous Employment
                </Button>
              </div>
            </TabsContent>

            {/* Previous Employment */}
            <TabsContent
              value="previous"
              forceMount
              className="mt-0 space-y-4 data-[state=inactive]:hidden"
            >
              <div className="flex items-center justify-between">
                <SectionTitle
                  icon={Briefcase}
                  title="Previous Employment"
                  desc="History, tenure and supporting documents"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPrevJobs([...prevJobs, prevJobs.length + 1])}
                >
                  <Plus className="h-4 w-4" /> Add Employer
                </Button>
              </div>
              {isEdit && init.experience?.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Saving a change to any employer replaces the whole previous-employment list, so
                  re-attach the documents you want to keep.
                </p>
              )}
              <div className="space-y-4">
                {prevJobs.map((n) => (
                  <PrevEmploymentBlock
                    init={init.experience?.[n - 1]}
                    key={n}
                    index={n}
                    docFiles={docFiles}
                    onSelect={handleDocSelect}
                    onRemoveFile={handleDocRemove}
                    onPreviewExisting={(type, label) => previewPrevDoc(n, type, label)}
                    onRemove={
                      prevJobs.length > 1
                        ? () => {
                            setPrevJobs((p) => p.filter((x) => x !== n));
                            setDocFiles((prev) =>
                              Object.fromEntries(
                                Object.entries(prev).filter(([k]) => !k.startsWith(`prev${n}_`)),
                              ),
                            );
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
              <Separator />
              <SectionTitle
                icon={GraduationCap}
                title="Education"
                desc="Highest qualification and certifications"
              />

              <FieldRow>
                <Field label="Highest Qualification">
                  <Input name="qualification" defaultValue={init.qualification} placeholder="B.Tech — Computer Science" />
                </Field>
                <Field label="Institution">
                  <Input name="institution" defaultValue={init.institution} placeholder="IIT Bombay" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Year of Passing">
                  <Input name="yearOfPassing" defaultValue={init.yearOfPassing} placeholder="2019" />
                </Field>
                <Field label="Grade / CGPA">
                  <Input name="eduScore" defaultValue={init.eduScore} placeholder="8.4" />
                </Field>
              </FieldRow>

              <div className="flex flex-wrap justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("personal")}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setTab("legal")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Legal & Documents
                </Button>
              </div>
            </TabsContent>

            {/* Legal & Documents */}
            <TabsContent
              value="legal"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={IdCard}
                title="Government IDs"
                desc="Statutory identity documents (KYC)"
              />

              <FieldRow>
                <Field label="Aadhar Number" required>
                  <Input name="aadhaar" defaultValue={init.aadhaar} inputMode="numeric" placeholder="1234 5678 9012" />
                </Field>
                <Field label="PAN Number" required>
                  <Input name="pan" defaultValue={init.pan} placeholder="ABCDE1234F" className="uppercase" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Driving License No.">
                  <Input name="drivingLicence" defaultValue={init.drivingLicence} placeholder="KA01 20220001234" />
                </Field>
                <Field label="Passport No.">
                  <Input name="passport" defaultValue={init.passport} placeholder="M1234567" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="UAN (12 digits)">
                  <Input name="uan" defaultValue={init.uan} inputMode="numeric" placeholder="1000 1234 5678" />
                </Field>
                <Field label="ESI No. (17 digits)">
                  <Input name="esiNo" defaultValue={init.esiNo} inputMode="numeric" placeholder="—" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="PF member ID">
                  <Input name="pfMemberId" defaultValue={init.pfMemberId} maxLength={30} placeholder="Optional" />
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle
                icon={FileText}
                title="Document Uploads"
                desc="Attach scanned copies — all files stored securely"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FileUpload
                  name="aadhaar_card"
                  label="Aadhar Card"
                  existing={existingDocs["aadhaar_card"]}
                  onPreviewExisting={() => previewExistingDoc("aadhaar_card", "aadhaar_card")}
                  file={docFiles["aadhaar_card"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="pan_card"
                  label="PAN Card"
                  existing={existingDocs["pan_card"]}
                  onPreviewExisting={() => previewExistingDoc("pan_card", "pan_card")}
                  file={docFiles["pan_card"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="driving_license"
                  label="Driving License"
                  existing={existingDocs["driving_license"]}
                  onPreviewExisting={() => previewExistingDoc("driving_license", "driving_license")}
                  file={docFiles["driving_license"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="passport"
                  label="Passport"
                  existing={existingDocs["passport"]}
                  onPreviewExisting={() => previewExistingDoc("passport", "passport")}
                  file={docFiles["passport"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="resume"
                  label="Resume / CV"
                  existing={existingDocs["resume"]}
                  onPreviewExisting={() => previewExistingDoc("resume", "resume")}
                  file={docFiles["resume"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="offer_letter"
                  label="Offer Letter (Signed)"
                  existing={existingDocs["offer_letter"]}
                  onPreviewExisting={() => previewExistingDoc("offer_letter", "offer_letter")}
                  file={docFiles["offer_letter"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="appointment_letter"
                  label="Appointment Letter"
                  existing={existingDocs["appointment_letter"]}
                  onPreviewExisting={() => previewExistingDoc("appointment_letter", "appointment_letter")}
                  file={docFiles["appointment_letter"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="educational_certificate"
                  label="Educational Certificates"
                  existing={existingDocs["educational_certificate"]}
                  onPreviewExisting={() => previewExistingDoc("educational_certificate", "educational_certificate")}
                  file={docFiles["educational_certificate"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="address_proof"
                  label="Address Proof"
                  existing={existingDocs["address_proof"]}
                  onPreviewExisting={() => previewExistingDoc("address_proof", "address_proof")}
                  file={docFiles["address_proof"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
                <FileUpload
                  name="passbook"
                  label="Cancelled Cheque / Passbook"
                  existing={existingDocs["passbook"]}
                  onPreviewExisting={() => previewExistingDoc("passbook", "passbook")}
                  file={docFiles["passbook"]}
                  onSelect={handleDocSelect}
                  onRemove={handleDocRemove}
                />
              </div>

              <div className="flex flex-wrap justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("previous")}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setTab("bank")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Bank Details
                </Button>
              </div>
            </TabsContent>

            {/* Bank */}
            <TabsContent
              value="bank"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={Landmark}
                title="Salary Account"
                desc="Primary bank account for payroll credit"
              />

              <FieldRow>
                <Field label="Account Holder Name" required>
                  <Input name="bankHolder" defaultValue={init.bankHolder} placeholder="As per bank records" />
                </Field>
                <Field label="Bank Name" required>
                  <Input name="bankName" defaultValue={init.bankName} placeholder="HDFC Bank" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Account Number" required>
                  <Input name="accountNo" defaultValue={init.accountNo} inputMode="numeric" placeholder="50100XXXXXXXX" />
                </Field>
                <Field label="Re-enter Account Number" required>
                  <Input name="accountNo2" defaultValue={init.accountNo2} inputMode="numeric" placeholder="Confirm" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="IFSC Code" required>
                  <Input name="ifsc" defaultValue={init.ifsc} placeholder="HDFC0001234" className="uppercase" />
                </Field>
                <Field label="Branch">
                  <Input name="bankBranch" defaultValue={init.bankBranch} placeholder="Khandagiri, Bhubaneswar" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Account Type">
                  <Select name="accountType" defaultValue={init.accountType ?? "savings"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Payment Mode">
                  <Select name="payMode" defaultValue={init.payMode ?? "NEFT"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEFT">NEFT</SelectItem>
                      <SelectItem value="IMPS">IMPS</SelectItem>
                      <SelectItem value="RTGS">RTGS</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <Separator />
              <SectionTitle
                icon={Upload}
                title="Verification"
                desc="Cheque leaf / passbook for verification"
              />

              <FileUpload
                name="passbook"
                label="Cancelled Cheque / Passbook First Page"
                  existing={existingDocs["passbook"]}
                  onPreviewExisting={() => previewExistingDoc("passbook", "passbook")}
                file={docFiles["passbook"]}
                onSelect={handleDocSelect}
                onRemove={handleDocRemove}
              />

              <div className="flex flex-wrap justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("legal")}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setTab("job")}
                  className="bg-gradient-emerald text-white"
                >
                  Continue → Job & Role
                </Button>
              </div>
            </TabsContent>

            {/* Job & Role */}
            <TabsContent
              value="job"
              forceMount
              className="mt-0 space-y-6 data-[state=inactive]:hidden"
            >
              <SectionTitle
                icon={Building2}
                title="Placement"
                desc="Where the employee sits in the organization"
              />

              {/* Placement scope */}
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-950 dark:bg-emerald-950/20">
                {isEmployee && (
                  <p className="text-destructive text-xs font-medium">
                    Access Restricted: Employees cannot create or onboard other employees.
                  </p>
                )}

                {isSuperAdmin && (
                  <FieldRow>
                    <Field label="Company Placement">
                      <Select
                        value={placementMode}
                        onValueChange={(val) => {
                          setPlacementMode(val);
                          if (val === "org") {
                            setSelectedCompanyId("");
                            setSelectedBranchId("");
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="org">Organisation level (No company)</SelectItem>
                          <SelectItem value="company">With company</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    {placementMode === "company" && (
                      <Field label="Company" required>
                        <Select
                          value={selectedCompanyId}
                          onValueChange={(val) => {
                            setSelectedCompanyId(val);
                            setSelectedBranchId("");
                          }}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-900">
                            <SelectValue
                              placeholder={loadingScope ? "Loading companies…" : "Select company"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {backendCompanies.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} {c.code ? `(${c.code})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </FieldRow>
                )}

                {isSuperAdmin && placementMode === "company" && (
                  <FieldRow>
                    <Field label="Branch (Optional)">
                      <Select
                        disabled={!selectedCompanyId || backendBranches.length === 0}
                        value={selectedBranchId || "none"}
                        onValueChange={(val) => setSelectedBranchId(val === "none" ? "" : val)}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue
                            placeholder={
                              !selectedCompanyId
                                ? "Select a company first"
                                : backendBranches.length
                                  ? "Company level (No branch)"
                                  : "No branches registered"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Company level (No branch)</SelectItem>
                          {backendBranches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} {b.code ? `(${b.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldRow>
                )}

                {isCompanyAdmin && (
                  <FieldRow>
                    <Field label="Company (Locked to your session)">
                      <Input
                        value={sessionCompanyId || "Assigned Company"}
                        disabled
                        className="bg-white font-mono text-xs dark:bg-slate-900"
                      />
                    </Field>

                    <Field label="Branch (Optional)">
                      <Select
                        value={selectedBranchId || "none"}
                        onValueChange={(val) => setSelectedBranchId(val === "none" ? "" : val)}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue
                            placeholder={
                              backendBranches.length
                                ? "Company level (No branch)"
                                : "No branches registered"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Company level (No branch)</SelectItem>
                          {backendBranches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} {b.code ? `(${b.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldRow>
                )}

                {isBranchAdmin && (
                  <FieldRow>
                    <Field label="Company (Locked)">
                      <Input
                        value={sessionCompanyId || "Assigned Company"}
                        disabled
                        className="bg-white font-mono text-xs dark:bg-slate-900"
                      />
                    </Field>
                    <Field label="Branch (Locked to your branch)">
                      <Input
                        value={sessionBranchId || "Assigned Branch"}
                        disabled
                        className="bg-white font-mono text-xs dark:bg-slate-900"
                      />
                    </Field>
                  </FieldRow>
                )}
              </div>

              <FieldRow>
                <Field label="Employee ID">
                  <Input placeholder="Auto-assigned on create" disabled />
                </Field>
                <Field label="Date of Joining" required>
                  <Input name="doj" defaultValue={init.doj} type="date" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Department">
                  <Select
                    value={deptId || NONE}
                    onValueChange={(val) => setDeptId(val === NONE ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— None —</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Designation">
                  <Select
                    value={designationId || NONE}
                    onValueChange={(val) => setDesignationId(val === NONE ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          deptDesignations.length ? "Select designation (optional)" : "No designations created yet"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— None —</SelectItem>
                      {deptDesignations.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Role (Access)">
                  <Select value={roleName} onValueChange={setRoleName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Employment Type">
                  <Select name="employmentType" defaultValue={init.employmentType ?? "Full-time"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Reporting Manager (Optional)">
                  <Select
                    value={managerId || "none"}
                    onValueChange={(val) => setManagerId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reporting manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No reporting manager</SelectItem>
                      {managerOptions.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {staffLabel(e)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Assign HR (Optional)">
                  <Select
                    value={hrId || "none"}
                    onValueChange={(val) => setHrId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select HR" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No HR assigned</SelectItem>
                      {hrOptions.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {staffLabel(e)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground mt-1 text-xs">
                    All HR approvals raised by this employee route to their HR.
                  </p>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Notice Period">
                  <Select name="noticeDays" defaultValue={init.noticeDays ?? "60"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Work Location">
                  <Select name="workMode" defaultValue={init.workMode ?? "office"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">On-site</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Shift">
                  <Select value={shiftId} onValueChange={setShiftId}>
                    <SelectTrigger>
                      <SelectValue placeholder={shifts.length ? "Select shift" : "No shifts configured"} />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((x) => (
                        <SelectItem key={x.id} value={String(x.id)}>
                          {x.name}
                          {x.start ? ` (${x.start} – ${x.end})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>

              <Separator />
              <SectionTitle
                icon={Landmark}
                title="Compensation"
                desc="Salary structure — components come from Payroll Configuration in Masters"
              />

              <FieldRow>
                <Field label="Wage type" required field="wageType">
                  <Select name="wageType" value={wageType} onValueChange={setWageType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select wage type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {wageType === "Monthly" && (
                  <Field label="Annual CTC (₹)" required>
                    <Input
                      name="ctc" defaultValue={init.ctc}
                      type="number"
                      min={1}
                      placeholder="1200000"
                      onChange={(e) => setCtcDraft(Number(e.target.value) || 0)}
                    />
                  </Field>
                )}
                {wageType === "Daily" && (
                  <Field label="Daily rate (₹)" required>
                    <Input
                      name="dailyRate" defaultValue={init.dailyRate}
                      type="number"
                      min={0.01}
                      step="any"
                      placeholder="650"
                      onChange={(e) => setDailyRateDraft(Number(e.target.value) || 0)}
                    />
                  </Field>
                )}
              </FieldRow>
              <FieldRow>
                <Field label="Probation Period">
                  <Select name="probationMonths" defaultValue={init.probationMonths ?? "3"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Pay Grade">
                  <Select name="grade" defaultValue={init.grade}>
                    <SelectTrigger>
                      <SelectValue placeholder={gradeOptions.length ? "Select pay grade" : "No pay grades yet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeOptions.map((g) => (
                        <SelectItem key={g.grade_code} value={g.grade_code}>
                          {g.grade_code}
                          {g.grade_name ? ` — ${g.grade_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Provident Fund (PF) applicable">
                  <div className="flex h-9 items-center gap-2">
                    <Switch checked={pfApplicable} onCheckedChange={setPfApplicable} aria-label="PF applicable" />
                    <span className="text-muted-foreground text-xs">{pfApplicable ? "Yes" : "No"}</span>
                  </div>
                </Field>
                <Field label="ESI applicable">
                  <div className="flex h-9 items-center gap-2">
                    <Switch checked={esiApplicable} onCheckedChange={setEsiApplicable} aria-label="ESI applicable" />
                    <span className="text-muted-foreground text-xs">{esiApplicable ? "Yes" : "No"}</span>
                  </div>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Professional tax state">
                  <Input
                    name="ptState" defaultValue={init.ptState}
                    placeholder="e.g. Odisha"
                    onChange={(e) => setPtStateDraft(e.target.value.trim())}
                  />
                </Field>
              </FieldRow>

              {payComponents.length > 0 && (
                <div className="space-y-3">
                  <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Pay components (optional overrides)
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {payComponents.map((c) => (
                      <Field
                        key={c.code}
                        label={`${c.name} (${c.code}) · ${c.calculation_type}`}
                      >
                        <Input
                          name={`pc_${c.code}`}
                          type="number"
                          min={0}
                          max={/percent/i.test(c.calculation_type ?? "") ? 100 : undefined}
                          step="any"
                          defaultValue={init.payComponents?.[c.code]}
                          placeholder={/percent/i.test(c.calculation_type ?? "") ? "% (0–100)" : "₹ amount"}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              <SalaryPreviewPanel
                wageType={wageType}
                ctc={ctcDraft}
                dailyRate={dailyRateDraft}
                pfApplicable={pfApplicable}
                esiApplicable={esiApplicable}
                ptState={ptStateDraft}
              />

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setTab("bank")}>
                  ← Back
                </Button>
                <div className="text-muted-foreground text-xs">
                  {isEdit
                    ? "Only the fields you changed are saved."
                    : "Login credentials are emailed to the personal email automatically."}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="bg-muted/30 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || isEmployee}
            className="bg-gradient-emerald shadow-premium text-white flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{isEdit ? "Saving Changes…" : "Creating Employee…"}</span>
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Employee"
            )}
          </Button>
        </DialogFooter>
      </form>
      </FormErrorsContext.Provider>
      <DocPreviewDialog
        open={!!docPreview}
        onClose={() => setDocPreview(null)}
        title={docPreview?.title}
        src={docPreview?.src}
        isPdf={docPreview?.isPdf}
      />
    </DialogContent>
  );
}

/** Loads the full record (list rows are partial) before showing the pre-filled form. */
function EditEmployeeForm({ employee, onClose, onUpdated }) {
  const [full, setFull] = useState(null);
  useEffect(() => {
    let alive = true;
    getEmployeeById(employee.id)
      .then((data) => alive && setFull({ ...employee, ...data }))
      .catch((err) => {
        console.warn("Could not load employee profile:", err);
        if (alive) setFull(employee);
      });
    return () => {
      alive = false;
    };
  }, [employee]);

  if (!full) {
    return (
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>Loading employee record…</DialogDescription>
        </DialogHeader>
        <div className="grid h-64 place-items-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </DialogContent>
    );
  }
  return <AddEmployeeDialog employee={full} onClose={onClose} onCreated={onUpdated} />;
}

/** Query-string contract of this screen (was the route's validateSearch). */
function validateSearch(s) {
  return typeof s.id === "string" ? { id: s.id } : {};
}

export default Employees;
