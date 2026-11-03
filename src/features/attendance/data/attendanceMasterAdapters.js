// Adapters between the Attendance & time master API files and the UI.
// API files (src/api/*.js) only call endpoints; all field mapping lives here.
//
// Attendance & time masters: attendance patterns, timesheet formats, workday configuration
// and shift management all live in this file.
import attendanceApi from "@/api/attendanceApi";
import SuperAdmin_attendancePattern from "@/api/attendance_pattern";
import SuperAdmin_shift from "@/api/shift";

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
/* ---------- timesheet formats ----------
   UI name   <->  API format_name
   UI active <->  API is_active
   UI frequency / department / fields / description match the API names.
   The table shows the server's own code. Scope IDs are query params only. */
const TIMESHEET_LIST_PAGE_SIZE = 100;

export function createTimesheetFormatApi(organizationId) {
  const service = SuperAdmin_attendancePattern;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const unwrap = (res) => {
    const body = res?.data;
    return body?.data && !Array.isArray(body.data) ? body.data : body;
  };

  // API record -> row used by TimesheetFormatsTab. id = server code, _apiId = real UUID.
  const fromApi = (r) => ({
    id: r.code ?? String(r.id),
    _apiId: r.id,
    name: r.format_name ?? "",
    frequency: r.frequency ?? "",
    department: r.department || "All departments",
    fields: Array.isArray(r.fields) ? r.fields : [],
    description: r.description ?? "",
    active: r.is_active ?? true,
  });

  const toPayload = (f) => ({
    format_name: clean(f.name),
    frequency: f.frequency,
    department: clean(f.department) || "All departments",
    fields: f.fields ?? [],
    description: clean(f.description),
    is_active: f.active ?? true,
  });

    return {
    // GET /attendance-and-time/timesheet-formats
    list: async () => {
      const res = await service.getTimesheetFormats({
        ...scope,
        page: 1,
        page_size: TIMESHEET_LIST_PAGE_SIZE,
      });

      const data = unwrap(res);
      const items = Array.isArray(data)
        ? data
        : data?.items ?? data?.results ?? [];

      return items
        .filter((r) => r && typeof r === "object")
        .map(fromApi);
    },

    // GET /attendance-and-time/timesheet-formats/{id}
    getById: async (id) => {
      const res = await service.getTimesheetFormatById(id, scope);
      return fromApi(unwrap(res));
    },

    // POST /attendance-and-time/timesheet-formats
    create: async (form) => {
      const res = await service.createTimesheetFormat(
        toPayload(form),
        scope
      );

      return fromApi(unwrap(res));
    },

    // PUT /attendance-and-time/timesheet-formats/{id}
    update: async (id, form) => {
      const res = await service.updateTimesheetFormat(
        id,
        toPayload(form),
        scope
      );

      return fromApi(unwrap(res));
    },

    // PATCH /attendance-and-time/timesheet-formats/{id}
    patch: async (id, payload) => {
      const res = await service.patchTimesheetFormat(
        id,
        payload,
        scope
      );

      return fromApi(unwrap(res));
    },

    // PATCH Active status
    setActive: (id, isActive) =>
      service.patchTimesheetFormat(
        id,
        { is_active: isActive },
        scope
      ),

    // DELETE /attendance-and-time/timesheet-formats/{id}
    remove: (id) =>
      service.removeTimesheetFormat(id, scope),
  };
}
/* ---------- workday configuration (weekday × occurrence matrix) ----------
   UI matrix  { Monday: [b,b,b,b,b], ... }  <->  API working_rules { monday: [b,b,b,b,b], ... }
   POST is an upsert. At least one day must be enabled. Scope IDs are query params only. */
const WORKDAY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const WORKDAY_WEEKS = 5;
const WORKDAY_LIST_PAGE_SIZE = 100;

const rulesToMatrix = (rules) =>
  Object.fromEntries(
    WORKDAY_DAYS.map((day) => {
      const arr = Array.isArray(rules?.[day.toLowerCase()]) ? rules[day.toLowerCase()] : [];
      // A single value applies to all five weeks; otherwise pad missing weeks with false.
      const weeks =
        arr.length === 1
          ? Array(WORKDAY_WEEKS).fill(Boolean(arr[0]))
          : Array.from({ length: WORKDAY_WEEKS }, (_, i) => Boolean(arr[i]));
      return [day, weeks];
    }),
  );

const matrixToRules = (matrix) =>
  Object.fromEntries(
    WORKDAY_DAYS.map((day) => [
      day.toLowerCase(),
      Array.from({ length: WORKDAY_WEEKS }, (_, i) => Boolean(matrix?.[day]?.[i])),
    ]),
  );

export function createWorkdayMatrixApi(organizationId) {
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const toRecord = (r) => ({ id: r.id, matrix: rulesToMatrix(r.working_rules) });

  return {
    // GET /attendance/workday-configurations → { id, matrix } or null when nothing is saved
    load: async () => {
      const data = await attendanceApi.getWorkdayConfigurations({
        ...scope,
        page: 1,
        page_size: WORKDAY_LIST_PAGE_SIZE,
      });
      const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? data?.data ?? []);
      const first = items.find((r) => r && typeof r === "object");
      return first ? toRecord(first) : null;
    },

    // POST /attendance/workday-configurations (upsert)
    save: async (matrix) => {
      const hasWorkday = WORKDAY_DAYS.some((d) => (matrix?.[d] ?? []).some(Boolean));
      if (!hasWorkday) {
        const msg = "At least one working day must be enabled.";
        const err = new Error(msg);
        err.response = { data: { detail: msg } };
        throw err;
      }
      const data = await attendanceApi.saveWorkdayConfiguration(
        { working_rules: matrixToRules(matrix) },
        scope,
      );
      const body = data?.data && !Array.isArray(data.data) ? data.data : data;
      return body?.id != null ? toRecord(body) : { id: null, matrix };
    },

    // GET /attendance/workday-configurations/{configuration_id}
    getById: async (id) => {
      const data = await attendanceApi.getWorkdayConfigurationById(id, scope);
      const body = data?.data && !Array.isArray(data.data) ? data.data : data;
      return body?.id != null ? toRecord(body) : null;
    },

    // PUT /attendance/workday-configurations/{configuration_id}
    update: async (id, matrix) => {
      const data = await attendanceApi.updateWorkdayConfiguration(
        id,
        { working_rules: matrixToRules(matrix) },
        scope,
      );
      const body = data?.data && !Array.isArray(data.data) ? data.data : data;
      return body?.id != null ? toRecord(body) : { id, matrix };
    },

    // PATCH /attendance/workday-configurations/{configuration_id}
    patch: async (id, matrix) => {
      const data = await attendanceApi.patchWorkdayConfiguration(
        id,
        { working_rules: matrixToRules(matrix) },
        scope,
      );
      const body = data?.data && !Array.isArray(data.data) ? data.data : data;
      return body?.id != null ? toRecord(body) : { id, matrix };
    },

    // DELETE /attendance/workday-configurations/{configuration_id}
    remove: (id) => attendanceApi.deleteWorkdayConfiguration(id, scope),
  };
}

/* ---------- shifts ----------
   UI name / office           <->  API shift_name / office_name
   UI start / end             <->  API start_time / end_time  (UI "09:30" | API "09:30:00")
   UI breakEnabled            <->  API break_time_enabled
   UI breakStart / breakEnd   <->  API break_start_time / break_end_time (sent only when the break is on)
   UI employees               <->  API assigned_employees_count
   The API returns its own code, shown where the card shows the shift id.
   Scope IDs are query params only. */
const SHIFT_LIST_PAGE_SIZE = 100;

const toApiTime = (t) => {
  const v = clean(t);
  return /^\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
};
const fromApiTime = (t) => (t ? String(t).slice(0, 5) : "");

/** Office names for the Create Shift dropdown. Accepts strings or objects. */
export async function loadShiftOffices(organizationId) {
  const scope = organizationId ? { organization_id: organizationId } : undefined;
  const res = await SuperAdmin_shift.getOffices(scope);
  const data = res?.data;
  const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
  return items
    .map((o) =>
      typeof o === "string"
        ? o
        : (o?.office_name ?? o?.name ?? o?.branch_name ?? o?.label ?? ""),
    )
    .filter(Boolean);
}


export function createShiftApi(organizationId) {
  const service = SuperAdmin_shift;
  const scope = organizationId
    ? { organization_id: organizationId }
    : undefined;

  const unwrap = (res) => {
    const body = res?.data;
    return body?.data && !Array.isArray(body.data)
      ? body.data
      : body;
  };

  const fromApi = (r) => {
    if (!r) return null;

    return {
      id: r.code ?? r.id,
      _apiId: r.id,
      name: r.shift_name ?? "",
      office: r.office_name ?? "",
      start: fromApiTime(r.start_time),
      end: fromApiTime(r.end_time),
      breakEnabled: Boolean(r.break_time_enabled),
      breakStart: fromApiTime(r.break_start_time),
      breakEnd: fromApiTime(r.break_end_time),
      employees: Number(r.assigned_employees_count ?? 0),
    };
  };

  const toPayload = (s) => ({
    shift_name: clean(s.name),
    office_name: clean(s.office),
    start_time: toApiTime(s.start),
    end_time: toApiTime(s.end),
    break_time_enabled: Boolean(s.breakEnabled),
    ...(s.breakEnabled
      ? {
          break_start_time: toApiTime(s.breakStart),
          break_end_time: toApiTime(s.breakEnd),
        }
      : {}),
    is_active: true,
  });

  return {
    list: async () => {
      const res = await service.getAll({
        ...scope,
        page: 1,
        page_size: SHIFT_LIST_PAGE_SIZE,
      });

      const data = unwrap(res);
      const items = Array.isArray(data)
        ? data
        : data?.items ?? data?.results ?? [];

      return items.map(fromApi).filter(Boolean);
    },

    getById: async (id) => {
      const res = await service.getById(id, scope);
      return fromApi(unwrap(res));
    },

    create: async (form) => {
      const res = await service.create(toPayload(form), scope);
      return fromApi(unwrap(res));
    },

    update: async (id, form) => {
      const res = await service.update(id, toPayload(form), scope);
      return fromApi(unwrap(res));
    },

    patch: async (id, form) => {
      const res = await service.patch(id, toPayload(form), scope);
      return fromApi(unwrap(res));
    },

    remove: (id) => service.remove(id, scope),
  };
}