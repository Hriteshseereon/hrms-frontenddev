// Adapter for Employee - Apply for Resignation (My Resignation screen).
// API file only calls endpoints (@/api/resignation_api); all field mapping lives here.
import Employee_resignation from "@/api/resignation_api";

const clean = (v) => String(v ?? "").trim();

// Resignation letter rules from the API: PDF/JPG/JPEG/PNG, max 5 MB.
export const LETTER_MAX_BYTES = 5 * 1024 * 1024;
export const LETTER_ACCEPT = ".pdf,.jpg,.jpeg,.png";
const LETTER_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const unwrap = (res) => {
  let data = res?.data ?? res;
  if (data?.data != null) data = data.data;
  return data;
};

const readItems = (res) => {
  const d = unwrap(res);
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.reasons)) return d.reasons;
  return [];
};

/** Returns an error message for an invalid letter file, or "" when it is fine. */
export function validateLetter(file) {
  if (!file) return "";
  if (!LETTER_TYPES.includes(file.type)) return "Letter must be a PDF, JPG, JPEG or PNG file.";
  if (file.size > LETTER_MAX_BYTES) return "Letter must be 5 MB or smaller.";
  return "";
}

/** Best human-readable message from an API error (401/403/409/422 ...). */
export function resignationErrorMessage(err, fallback = "Something went wrong") {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail ?? err?.response?.data?.message;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => d?.msg ?? d?.message ?? "").filter(Boolean).join(", ") || fallback;
  }
  if (status === 409) return "You already have an active resignation.";
  if (status === 403) return "You are not allowed to do this.";
  return err?.message || fallback;
}

/** Backend resignation -> shape used by the My Resignation screen. */
export const fromApi = (r = {}) => ({
  id: String(r.id ?? ""),
  code: r.resignation_code ?? "",
  employeeName: r.employee?.name ?? "",
  employeeCode: r.employee?.employee_code ?? "",
  designation: r.employee?.designation ?? "",
  department: r.employee?.department ?? "",
  managerName: r.reporting_manager?.name ?? "",
  managerCode: r.reporting_manager?.employee_code ?? "",
  reason: r.reason ?? "",
  requestedLwd: r.requested_last_working_day ?? "",
  note: r.resignation_note ?? "",
  letter: r.resignation_letter
    ? {
        name: r.resignation_letter.file_name ?? "",
        url: r.resignation_letter.file_url ?? "",
        type: r.resignation_letter.file_type ?? "",
        size: r.resignation_letter.file_size_bytes ?? 0,
      }
    : null,
  submittedAt: r.submitted_at ?? "",
  status: r.status ?? "",
  managerStatus: r.manager_approval_status ?? "",
  managerRemarks: r.manager_remarks ?? "",
  hrStatus: r.hr_clearance_status ?? "",
  hrRemarks: r.hr_remarks ?? "",
  noticeDays: r.notice_period?.notice_period_days ?? null,
  noticeStart: r.notice_period?.notice_period_start_date ?? "",
  noticeEnd: r.notice_period?.notice_period_end_date ?? "",
  finalLwd: r.final_last_working_day ?? "",
});

/**
 * GET /resignations/reasons
 * Resignation Reason dropdown -> array of strings (the value is sent back as `reason`).
 */
export async function loadResignationReasons() {
  const items = readItems(await Employee_resignation.getReasons());
  return items
    .map((o) =>
      typeof o === "string" ? clean(o) : clean(o?.value ?? o?.name ?? o?.label ?? o?.reason),
    )
    .filter(Boolean);
}

/**
 * POST /resignations/apply  (multipart/form-data)
 * Employee, manager, organization, company and branch come from the employee's profile.
 */
export async function applyForResignation({ reason, requestedLwd, note, letter }) {
  const fd = new FormData();
  fd.append("reason", clean(reason));
  fd.append("requested_last_working_day", requestedLwd);
  fd.append("resignation_note", clean(note));
  if (letter) fd.append("resignation_letter", letter);

  const res = await Employee_resignation.apply(fd);
  return fromApi(unwrap(res));
}

/**
 * GET /resignations/{resignation_id}
 * View a resignation in the employee portal.
 */
export async function getMyResignation(id) {
  const res = await Employee_resignation.getById(id);
  return fromApi(unwrap(res));
}

// The API has no "my resignation" list endpoint, so the id returned by apply is remembered
// per browser to re-open the live record on the next visit.
const KEY = "hrms.myResignationId";
export const rememberResignationId = (id) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
};
export const recalledResignationId = () => {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};
