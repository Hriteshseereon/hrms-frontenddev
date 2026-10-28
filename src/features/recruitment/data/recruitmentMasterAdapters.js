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

/* ---------- holiday calendars ----------
   UI name      <-> API holiday_title
   UI appliesTo <-> API applies_to_branches (UI: "A, B" string | API: ["A", "B"])
   UI holidays  <-> API holidays [{ holiday_date, holiday_name }]
   Scope IDs are query params only. */
const HOLIDAY_LIST_PAGE_SIZE = 100;

export function createHolidayCalendarApi(organizationId) {
  const service = SuperAdmin_holidayCalendar;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const fromApi = (r) => ({
    id: r.id,
    _apiId: r.id,
    name: r.holiday_title ?? "",
    type: r.type ?? "",
    year: Number(r.year ?? new Date().getFullYear()),
    appliesTo: (Array.isArray(r.applies_to_branches) ? r.applies_to_branches : [])
      .map((b) => (typeof b === "string" ? b : (b?.name ?? "")))
      .filter(Boolean)
      .join(", "),
    holidays: (Array.isArray(r.holidays) ? r.holidays : []).map((h) => ({
      date: h.holiday_date ?? "",
      name: h.holiday_name ?? "",
    })),
    uploadedFile: r.csv_file_name ?? "",
    active: true,
  });

  // Turns typed branch names/codes into branch IDs
  const resolveBranchIds = async (appliesTo) => {
    const tokens = clean(appliesTo)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!tokens.length) return [];
    if (tokens.every((t) => UUID_RE.test(t))) return tokens;

    const res = await SuperAdmin_branchLookup.getAll();
    const data = res?.data;
    const branches = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);

    return tokens.map((t) => {
      if (UUID_RE.test(t)) return t;
      const key = t.toLowerCase();
      const hit = branches.find(
        (b) =>
          String(b.name ?? "").toLowerCase() === key ||
          String(b.code ?? "").toLowerCase() === key,
      );
      if (!hit) {
        const msg = `Branch "${t}" not found. Use the exact branch name or code.`;
        const err = new Error(msg);
        err.response = { data: { detail: msg } };
        throw err;
      }
      return hit.id;
    });
  };

  const toPayload = async (cal) => ({
    holiday_title: clean(cal.name),
    type: cal.type,
    year: Number(cal.year),
    applies_to_branches: await resolveBranchIds(cal.appliesTo),
    holidays: (cal.holidays ?? []).map((h) => ({
      holiday_date: h.date,
      holiday_name: clean(h.name),
    })),
  });

  return {
    list: async () => {
      const res = await service.getAll({ ...scope, page: 1, page_size: HOLIDAY_LIST_PAGE_SIZE });
      const data = res?.data;
      const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
      return items.map(fromApi);
    },
    create: async (cal) => service.create(await toPayload(cal), scope),
    update: async (id, cal) => service.update(id, await toPayload(cal), scope),
    remove: (id) => service.remove(id, scope),
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
