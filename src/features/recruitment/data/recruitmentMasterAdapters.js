// Adapters between the master API files and the UI.
// API files only call endpoints; all field mapping lives here.
import SuperAdmin_branchLookup from "@/api/branch_lookup";
import SuperAdmin_interviewRound from "@/api/interview_round";
import SuperAdmin_jobLocation from "@/api/job_location";
import SuperAdmin_assessmentParameter from "@/api/assessment_parameter";
import SuperAdmin_evaluationParameter from "@/api/evaluation_parameter";
import SuperAdmin_holidayCalendar from "@/api/holiday_calendar";
import SuperAdmin_policyCircular from "@/api/policy_circular";
import SuperAdmin_shift from "@/api/shift";
import SuperAdmin_workdayConfiguration from "@/api/workday_configuration";

const clean = (v) => String(v ?? "").trim();

// page / page_size are optional on the backend (defaults 1 and 10, max 200).
// The UI has no paging, so ask for the maximum page size.
const LIST_PAGE_SIZE = 200;

// Evaluation parameters endpoint allows at most 100 per page (the other masters allow 200).
const EVAL_LIST_PAGE_SIZE = 100;

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

/* ---------- interview rounds ----------
   UI job <-> API job_name. The API returns its own code (IR-001). */
export function createInterviewRoundApi(organizationId) {
  const service = SuperAdmin_interviewRound;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  return {
    list: () => service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE }),
    getById: (id) => service.getById(id, scope),
    create: (payload) => service.create(payload, scope),
    update: (id, payload) => service.update(id, payload, scope),
    patch: (id, payload) => service.patch(id, payload, scope),
    remove: (id) => service.remove(id, scope),

    fromApi: (r) => ({
      id: r.id,
      _apiId: r.id,
      code: r.code,
      name: r.name ?? "",
      job: r.job_name ?? "",
      status: r.status ?? "",
      description: r.description ?? "",
    }),

    toPayload: (form) => ({
      name: clean(form.name),
      job_name: clean(form.job),
      status: form.status || "Active",
      description: clean(form.description),
    }),

    toPatchPayload: (form, existingRow) => {
      const patch = {};
      if (clean(form.name) !== (existingRow?.name ?? "")) patch.name = clean(form.name);
      if (clean(form.job) !== (existingRow?.job ?? "")) patch.job_name = clean(form.job);
      const nextStatus = form.status || "Active";
      if (nextStatus !== (existingRow?.status ?? "")) patch.status = nextStatus;
      if (clean(form.description) !== (existingRow?.description ?? "")) {
        patch.description = clean(form.description);
      }
      return patch;
    },
  };
}

/* ---------- job locations ----------
   UI postal <-> API postal_code, UI remote <-> API remote_work. */
export function createJobLocationApi(organizationId) {
  const service = SuperAdmin_jobLocation;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  return {
    list: () => service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE }),
    getById: (id) => service.getById(id, scope),
    create: (payload) => service.create(payload, scope),
    update: (id, payload) => service.update(id, payload, scope),
    patch: (id, payload) => service.patch(id, payload, scope),
    remove: (id) => service.remove(id, scope),

    fromApi: (r) => ({
      id: r.id,
      _apiId: r.id,
      code: r.code,
      name: r.name ?? "",
      address: r.address ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      country: r.country ?? "",
      postal: r.postal_code ?? "",
      remote: r.remote_work ?? "",
      status: r.status ?? "",
    }),

    toPayload: (form) => ({
      name: clean(form.name),
      address: clean(form.address),
      city: clean(form.city),
      state: clean(form.state),
      country: clean(form.country),
      postal_code: clean(form.postal),
      remote_work: form.remote || "No",
      status: form.status || "Active",
    }),

    toPatchPayload: (form, existingRow) => {
      const patch = {};
      const textFields = [
        ["name", "name"],
        ["address", "address"],
        ["city", "city"],
        ["state", "state"],
        ["country", "country"],
        ["postal", "postal_code"],
      ];
      textFields.forEach(([uiKey, apiKey]) => {
        if (clean(form[uiKey]) !== (existingRow?.[uiKey] ?? "")) patch[apiKey] = clean(form[uiKey]);
      });
      const nextRemote = form.remote || "No";
      if (nextRemote !== (existingRow?.remote ?? "")) patch.remote_work = nextRemote;
      const nextStatus = form.status || "Active";
      if (nextStatus !== (existingRow?.status ?? "")) patch.status = nextStatus;
      return patch;
    },
  };
}

/* ---------- assessment parameters ----------
   UI scale 5 / 10  <->  API "1-5" / "1-10"
   UI appliesTo []  <->  API applies_to ["All roles"]
   UI active        <->  API is_active */
const ALL_ROLES = "All roles";

const parseScale = (s) => {
  const n = Number(String(s ?? "").split(/[-–]/).pop());
  return Number.isFinite(n) && n > 0 ? n : 10;
};

export function createAssessmentParamApi(organizationId) {
  const service = SuperAdmin_assessmentParameter;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const fromApi = (r) => ({
    id: r.id,
    _apiId: r.id,
    code: r.code,
    name: r.name ?? "",
    group: r.group ?? "",
    weight: Number(r.weight ?? 0),
    scale: parseScale(r.scale),
    description: r.description ?? "",
    appliesTo: (Array.isArray(r.applies_to) ? r.applies_to : []).filter((x) => x !== ALL_ROLES),
    mandatory: Boolean(r.mandatory),
    active: r.is_active ?? true,
  });

  const toPayload = (form) => ({
    name: clean(form.name),
    group: form.group,
    weight: Number(form.weight),
    scale: `1-${Number(form.scale)}`,
    applies_to: form.appliesTo?.length ? form.appliesTo : [ALL_ROLES],
    description: clean(form.description),
    mandatory: Boolean(form.mandatory),
    is_active: Boolean(form.active),
  });

  return {
    list: async () => {
      const res = await service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE });
      const data = res?.data;
      const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
      return items.map(fromApi);
    },
    create: (form) => service.create(toPayload(form), scope),
    update: (id, form) => service.update(id, toPayload(form), scope),
    toggleStatus: (id, isActive) => service.toggleStatus(id, { is_active: isActive }, scope),
    remove: (id) => service.remove(id, scope),
  };
}

/* ---------- evaluation parameters ----------
   UI forRoles "All" / "Sales, Tech"  <->  API for_roles ["All"] / ["Sales", "Tech"]
   UI active                          <->  API is_active
   No DELETE endpoint exists. Scope IDs are query params only. */
const rolesToList = (v) => {
  const list = clean(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ["All"];
};

export function createEvaluationParamApi(organizationId) {
  const service = SuperAdmin_evaluationParameter;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const fromApi = (r) => ({
    id: r.id,
    _apiId: r.id,
    name: r.name ?? "",
    description: r.description ?? "",
    weight: Number(r.weight ?? 0),
    forRoles: Array.isArray(r.for_roles) ? r.for_roles.join(", ") : String(r.for_roles ?? "All"),
    active: r.is_active ?? true,
  });

  const toPayload = (form) => ({
    name: clean(form.name),
    description: clean(form.description),
    weight: Number(form.weight),
    for_roles: rolesToList(form.forRoles),
    is_active: Boolean(form.active),
  });

  return {
    list: async () => {
      const res = await service.getAll({ ...scope, page: 1, page_size: EVAL_LIST_PAGE_SIZE });
      const data = res?.data;
      const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
      return items.map(fromApi);
    },
    create: (form) => service.create(toPayload(form), scope),
    update: (id, form) => service.update(id, toPayload(form), scope),
    toggleStatus: (id, isActive) => service.toggleStatus(id, { is_active: isActive }, scope),
  };
}

// ============================================================================
// REPLACE IN  src/features/recruitment/data/recruitmentMasterAdapters.js
// Delete everything from the comment
//     /* ---------- holiday calendars ----------
// down to the closing brace of `export function createHolidayCalendarApi(...) { ... }`
// and paste this block in its place. Nothing else in that file changes.
// (`clean` and `SuperAdmin_holidayCalendar` are already defined/imported there.)
// ============================================================================

/* ---------- holiday calendars ----------
   UI name      <-> API holiday_title
   UI type      <-> API type            ("National" <-> "NATIONAL", ...)
   UI payType   <-> API leave_category  ("Paid" <-> "PAID", "Unpaid" <-> "UNPAID")
   UI holidays  <-> API holidays [{ holiday_date, holiday_name }]
   Excel upload <-> POST /attendance/holiday-calendars/upload (multipart, field "file")
   Scope IDs are query params only. */
const HOLIDAY_LIST_PAGE_SIZE = 100;

const HOLIDAY_TYPE_TO_API = {
  National: "NATIONAL",
  "Regional / State": "REGIONAL_STATE",
  "Optional / Restricted": "OPTIONAL_RESTRICTED",
};
const HOLIDAY_TYPE_FROM_API = Object.fromEntries(
  Object.entries(HOLIDAY_TYPE_TO_API).map(([ui, api]) => [api, ui]),
);

const LEAVE_CATEGORY_TO_API = { Paid: "PAID", Unpaid: "UNPAID" };
const LEAVE_CATEGORY_FROM_API = { PAID: "Paid", UNPAID: "Unpaid" };

export function createHolidayCalendarApi(organizationId) {
  const service = SuperAdmin_holidayCalendar;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const fromApi = (r) => ({
    id: r.id,
    _apiId: r.id,
    name: r.holiday_title ?? "",
    // Unknown / older values are shown as they come.
    type: HOLIDAY_TYPE_FROM_API[String(r.type ?? "").toUpperCase()] ?? r.type ?? "",
    year: Number(r.year ?? new Date().getFullYear()),
    payType: LEAVE_CATEGORY_FROM_API[String(r.leave_category ?? "").toUpperCase()] ?? "Paid",
    holidays: (Array.isArray(r.holidays) ? r.holidays : []).map((h) => ({
      date: h.holiday_date ?? "",
      name: h.holiday_name ?? "",
    })),
    uploadedFile: r.csv_file_name ?? "",
    fileUrl: r.csv_storage_key ?? "",
    active: true,
  });

  const toPayload = (cal) => ({
    holiday_title: clean(cal.name),
    type: HOLIDAY_TYPE_TO_API[cal.type] ?? cal.type,
    // type: cal.type,
    year: Number(cal.year),
    leave_category: LEAVE_CATEGORY_TO_API[cal.payType] ?? "PAID",
    holidays: (cal.holidays ?? []).map((h) => ({
      holiday_date: h.date,
      holiday_name: clean(h.name),
    })),
  });

  // The upload API returns an array of calendars (one per Holiday Title + Year).
  const listFrom = (res) => {
    const data = res?.data;
    const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    return items.map(fromApi);
  };

  const fileForm = (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return formData;
  };

  return {
    list: async () =>
      listFrom(await service.getAll({ ...scope, page: 1, page_size: HOLIDAY_LIST_PAGE_SIZE })),
    getById: async (id) => fromApi((await service.getById(id, scope))?.data ?? {}),
    create: (cal) => service.create(toPayload(cal), scope),
    update: (id, cal) => service.update(id, toPayload(cal), scope),
    remove: (id) => service.remove(id, scope),
    // POST /attendance/holiday-calendars/upload → created calendars (UI shape)
    upload: async (file) => listFrom(await service.createWithFile(fileForm(file), scope)),
    // PUT /attendance/holiday-calendars/{id}/upload → replaces one calendar from a file
    uploadReplace: async (id, file) => {
      const res = await service.updateWithFile(id, fileForm(file), scope);
      return fromApi(res?.data ?? {});
    },
  };
}

/* ---------- policies & circulars ----------
   UI name / category / description  <->  API name / category / description
   UI updated (Effective date)       <->  API effective_date
   UI file (file name)               <->  API file_name (the File itself is sent as "file")
   The API has no PATCH, so CrudSection shows only the PUT button.
   Scope IDs are query params only. */
const POLICY_LIST_PAGE_SIZE = 100;

// CrudSection's file input only keeps the file NAME in the form. Remember the File object
// by name so it can be uploaded. Registered once, even with hot reload.
const pickedPolicyFiles = new Map();
if (typeof window !== "undefined" && !window.__policyFileCapture) {
  window.__policyFileCapture = true;
  document.addEventListener(
    "change",
    (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type === "file" && t.files?.[0]) {
        pickedPolicyFiles.set(t.files[0].name, t.files[0]);
      }
    },
    true,
  );
}

// Only place that knows the multipart field names. Change here if Swagger differs.
// Only place that knows the multipart field names. Change here if Swagger differs.
const buildPolicyFormData = (p) => {
  const fd = new FormData();
  fd.append("document_name", p.name);
  fd.append("category", p.category);
  if (p.effective_date) fd.append("effective_date", p.effective_date);
  fd.append("description", p.description);
  if (p.file) fd.append("file", p.file);
  return fd;
};

// CrudSection shows error.response.data.detail in a toast, and a toast can't render an
// array of objects (FastAPI 422). Turn it into one readable string, then rethrow.
const flattenPolicyError = (error) => {
  const data = error?.response?.data;
  if (data && Array.isArray(data.detail)) {
    data.detail = data.detail
      .map((d) => {
        const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : "";
        return field ? `${field}: ${d?.msg}` : d?.msg;
      })
      .filter(Boolean)
      .join(", ");
  }
  throw error;
};

/** Category names for the Upload Document dropdown. */
export async function loadPolicyCategories(organizationId) {
  const scope = organizationId ? { organization_id: organizationId } : undefined;
  const res = await SuperAdmin_policyCircular.getCategories(scope);
  const data = res?.data;
  const items = Array.isArray(data) ? data : (data?.items ?? []);
  return items.map((c) => c?.name).filter(Boolean);
}

// organizationId is optional: the backend resolves scope from the logged-in user.
// organizationId is optional: the backend resolves scope from the logged-in user.
export function createPolicyCircularApi(organizationId) {
  const service = SuperAdmin_policyCircular;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  return {
    list: () => service.getAll({ ...scope, page: 1, page_size: POLICY_LIST_PAGE_SIZE }),
    getById: (id) => service.getById(id, scope),
    create: (payload) =>
      service.create(buildPolicyFormData(payload), scope).catch(flattenPolicyError),
    update: (id, payload) =>
      service.update(id, buildPolicyFormData(payload), scope).catch(flattenPolicyError),
    remove: (id) => service.remove(id, scope),

    // API record -> CrudSection row. id and _apiId keep the real UUID.
    fromApi: (r) => ({
      id: r.id,
      _apiId: r.id,
      code: r.code,
      name: r.document_name ?? r.name ?? "",
      category:
        typeof r.category === "object" && r.category
          ? (r.category.name ?? "")
          : (r.category ?? r.category_name ?? ""),
      updated: r.effective_date ?? "",
      file: r.file_name ?? r.original_file_name ?? "",
      description: r.description ?? "",
    }),

    // Form -> plain object (CrudSection calls this synchronously); FormData is built in create/update.
    // The file is attached only if a new one was picked; otherwise the stored file is kept.
    toPayload: (form) => ({
      name: clean(form.name),
      category: clean(form.category),
      effective_date: clean(form.updated),
      description: clean(form.description),
      file: pickedPolicyFiles.get(clean(form.file)) ?? null,
    }),
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
    // Office is optional: company-level users without a branch omit it.
    ...(clean(s.office) ? { office_name: clean(s.office) } : {}),
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

/* ---------- workday configuration (weekday × 5-week matrix) ----------
   UI matrix { Monday: [b,b,b,b,b], ..., Sunday: [...] }
     <->  API working_rules { monday: [b,b,b,b,b], ..., sunday: [...] }
   Index 0..4 = 1st..5th occurrence of that weekday in a month.
   POST is an upsert (creates or updates the configuration for the scope).
   At least one day must be enabled. Scope IDs are query params only. */
const WORKDAY_WEEKS = 5;

// UI day name <-> API working_rules key
const WORKDAY_DAYS = [
  ["Monday", "monday"],
  ["Tuesday", "tuesday"],
  ["Wednesday", "wednesday"],
  ["Thursday", "thursday"],
  ["Friday", "friday"],
  ["Saturday", "saturday"],
  ["Sunday", "sunday"],
];

// API working_rules -> UI matrix. A single value applies to all five weeks;
// otherwise missing weeks are treated as holidays.
const workdayRulesToMatrix = (rules) =>
  Object.fromEntries(
    WORKDAY_DAYS.map(([label, key]) => {
      const arr = Array.isArray(rules?.[key]) ? rules[key] : [];
      const weeks =
        arr.length === 1
          ? Array(WORKDAY_WEEKS).fill(Boolean(arr[0]))
          : Array.from({ length: WORKDAY_WEEKS }, (_, i) => Boolean(arr[i]));
      return [label, weeks];
    }),
  );

// UI matrix -> API working_rules (always 7 days × 5 booleans)
const workdayMatrixToRules = (matrix) =>
  Object.fromEntries(
    WORKDAY_DAYS.map(([label, key]) => [
      key,
      Array.from({ length: WORKDAY_WEEKS }, (_, i) => Boolean(matrix?.[label]?.[i])),
    ]),
  );

export function createWorkdayConfigApi(organizationId) {
  const service = SuperAdmin_workdayConfiguration;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const unwrap = (res) => {
    const body = res?.data;
    return body?.data && !Array.isArray(body.data) ? body.data : body;
  };

  const readItems = (res) => {
    const data = res?.data;
    return Array.isArray(data) ? data : (data?.items ?? data?.results ?? data?.data ?? []);
  };

  const stamp = (r) => Date.parse(r.updated_at ?? r.created_at ?? "") || 0;

  // API record -> { id, matrix, workingDaysPerWeek }
  const fromApi = (r) => ({
    id: r.id,
    matrix: workdayRulesToMatrix(r.working_rules),
    workingDaysPerWeek: Number(r.working_days_per_week ?? 0),
  });

  // Use the server record when it comes back, otherwise what was sent.
  const fromResponse = (res, id, matrix) => {
    const data = unwrap(res);
    return data && data.id != null
      ? fromApi(data)
      : { id: id ?? null, matrix, workingDaysPerWeek: 0 };
  };

  const toBody = (matrix) => ({ working_rules: workdayMatrixToRules(matrix) });

  // Same rule as the backend: at least one day must be enabled.
  const ensureWorkday = (matrix) => {
    const ok = WORKDAY_DAYS.some(([label]) => (matrix?.[label] ?? []).some(Boolean));
    if (!ok) {
      const msg = "At least one working day must be enabled.";
      const err = new Error(msg);
      err.response = { data: { detail: msg } };
      throw err;
    }
  };

  return {
    // GET /attendance/workday-configurations
    // Returns the most recently updated configuration, or null when nothing is saved.
    load: async () => {
      // The list endpoint takes only the optional scope params (no page / page_size).
      const res = await service.getAll(scope);
      const items = readItems(res).filter((r) => r && typeof r === "object");
      if (!items.length) return null;
      const latest = [...items].sort((a, b) => stamp(b) - stamp(a))[0];
      return fromApi(latest);
    },

    // GET /attendance/workday-configurations/{configuration_id}
    getById: async (id) => {
      const res = await service.getById(id, scope);
      const data = unwrap(res);
      return data && data.id != null ? fromApi(data) : null;
    },

    // POST /attendance/workday-configurations (upsert)
    save: async (matrix) => {
      ensureWorkday(matrix);
      const res = await service.create(toBody(matrix), scope);
      return fromResponse(res, null, matrix);
    },

    // PUT /attendance/workday-configurations/{configuration_id}
    update: async (id, matrix) => {
      ensureWorkday(matrix);
      const res = await service.update(id, toBody(matrix), scope);
      return fromResponse(res, id, matrix);
    },

    // PATCH /attendance/workday-configurations/{configuration_id}
    patch: async (id, matrix) => {
      ensureWorkday(matrix);
      const res = await service.patch(id, toBody(matrix), scope);
      return fromResponse(res, id, matrix);
    },

    // DELETE /attendance/workday-configurations/{configuration_id}
    remove: (id) => service.remove(id, scope),
  };
}