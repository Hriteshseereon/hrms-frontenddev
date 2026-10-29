// Adapters between the Attendance & time master API files and the UI.
// API files (src/api/*.js) only call endpoints; all field mapping lives here.
//
// Attendance & time masters: attendance patterns (this file), shift management and
// workday configuration (these two still live in recruitmentMasterAdapters.js for now).
import SuperAdmin_attendancePattern from "@/api/attendance_pattern";

const clean = (v) => String(v ?? "").trim();

/** Readable message from an axios / FastAPI error. */
export function apiErrorMessage(error, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const msg = detail.map((d) => d?.msg).filter(Boolean).join(", ");
    if (msg) return msg;
  }
  if (typeof detail === "string" && detail) return detail;
  return error?.response?.data?.message || fallback;
}

/* ---------- attendance patterns ----------
   UI name          <->  API name
   UI workingDays   <->  API working_days_per_month
   UI paidLeaveDays <->  API paid_absences_per_month
   UI weeklyOffs    <->  API weekly_offs_per_month
   UI lopEnabled    <->  API deduct_beyond_paid_days
   UI description   <->  API description
   UI status        <->  API is_active
   The API also returns its own code and assigned_employee_count (not used by the UI).
   Scope IDs are query params only. */
const PATTERN_LIST_PAGE_SIZE = 100;

export function createAttendancePatternApi(organizationId) {
  const service = SuperAdmin_attendancePattern;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const unwrap = (res) => {
    const body = res?.data;
    return body?.data && !Array.isArray(body.data) ? body.data : body;
  };

  // API record -> the pattern shape the Attendance patterns screen uses.
  // id keeps the real API id (UUID).
  const fromApi = (r) => ({
    id: String(r.id),
    name: r.name ?? "",
    workingDays: Number(r.working_days_per_month ?? 0),
    paidLeaveDays: Number(r.paid_absences_per_month ?? 0),
    lopEnabled: Boolean(r.deduct_beyond_paid_days),
    weeklyOffs: Number(r.weekly_offs_per_month ?? 0),
    description: r.description ?? "",
    status: r.is_active === false ? "Inactive" : "Active",
  });

  const toPayload = (form) => ({
    name: clean(form.name),
    working_days_per_month: Number(form.workingDays),
    paid_absences_per_month: Number(form.paidLeaveDays),
    weekly_offs_per_month: Number(form.weeklyOffs),
    deduct_beyond_paid_days: Boolean(form.lopEnabled),
    description: clean(form.description),
  });

  // Only the fields that changed
  const toPatchPayload = (form, original) => {
    const patch = {};
    if (clean(form.name) !== clean(original?.name)) patch.name = clean(form.name);
    if (Number(form.workingDays) !== Number(original?.workingDays)) {
      patch.working_days_per_month = Number(form.workingDays);
    }
    if (Number(form.paidLeaveDays) !== Number(original?.paidLeaveDays)) {
      patch.paid_absences_per_month = Number(form.paidLeaveDays);
    }
    if (Number(form.weeklyOffs) !== Number(original?.weeklyOffs)) {
      patch.weekly_offs_per_month = Number(form.weeklyOffs);
    }
    if (Boolean(form.lopEnabled) !== Boolean(original?.lopEnabled)) {
      patch.deduct_beyond_paid_days = Boolean(form.lopEnabled);
    }
    if (clean(form.description) !== clean(original?.description)) {
      patch.description = clean(form.description);
    }
    return patch;
  };

  // Use the server record when it comes back, otherwise fall back to what was sent.
  const fromResponse = (res, fallback) => {
    const data = unwrap(res);
    return data && data.id != null ? fromApi(data) : fallback;
  };

  return {
    list: async () => {
      const res = await service.getAll({ ...scope, page: 1, page_size: PATTERN_LIST_PAGE_SIZE });
      const data = unwrap(res);
      const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? []);
      return items.filter((r) => r && typeof r === "object").map(fromApi);
    },

    getById: async (id) => {
      const res = await service.getById(id, scope);
      return fromResponse(res, null);
    },

    create: async (form) => {
      const res = await service.create(toPayload(form), scope);
      const created = fromResponse(res, null);
      if (!created) throw new Error("The server did not return the created pattern.");
      return created;
    },

    // PATCH with only the changed fields; no request when nothing changed.
    patch: async (id, form, original) => {
      const patch = toPatchPayload(form, original);
      if (!Object.keys(patch).length) return { ...form, id: String(id) };
      const res = await service.patch(id, patch, scope);
      return fromResponse(res, { ...form, id: String(id) });
    },

    // Full replace (all fields) via PUT.
    update: async (id, form) => {
      const res = await service.update(id, toPayload(form), scope);
      return fromResponse(res, { ...form, id: String(id) });
    },

    remove: (id) => service.remove(id, scope),
  };
}