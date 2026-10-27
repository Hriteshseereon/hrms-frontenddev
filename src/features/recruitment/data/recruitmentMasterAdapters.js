// Adapters between the recruitment master API files and the CrudSection UI.
// API files only call endpoints; all field mapping lives here.
import SuperAdmin_interviewRound from "@/api/interview_round";
import SuperAdmin_jobLocation from "@/api/job_location";
import SuperAdmin_assessmentParameter from "@/api/assessment_parameter";

const clean = (v) => String(v ?? "").trim();

// page / page_size are optional on the backend (defaults 1 and 10, max 200).
// CrudSection has no paging, so ask for the maximum page size.
const LIST_PAGE_SIZE = 200;

/* ---------- interview rounds ----------
   UI job <-> API job_name.
   The API returns its own code (IR-001), so no codePrefix is used.
   Scope IDs (organization_id, company_id, branch_id) are query params only, never in the body. */
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

    // API record -> table/form row. id and _apiId keep the real UUID.
    fromApi: (r) => ({
      id: r.id,
      _apiId: r.id,
      code: r.code,
      name: r.name ?? "",
      job: r.job_name ?? "",
      status: r.status ?? "",
      description: r.description ?? "",
    }),

    // Form -> request body (POST / PUT)
    toPayload: (form) => ({
      name: clean(form.name),
      job_name: clean(form.job),
      status: form.status || "Active",
      description: clean(form.description),
    }),

    // Form -> only the changed fields (PATCH)
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
   UI postal <-> API postal_code
   UI remote <-> API remote_work
   The API returns its own code (JL-001), so no codePrefix is used.
   Scope IDs are query params only, never in the body. */
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

    // API record -> table/form row. id and _apiId keep the real UUID.
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

    // Form -> request body (POST / PUT)
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

    // Form -> only the changed fields (PATCH)
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
   UI active        <->  API is_active
   Scope IDs are query params only, never in the body. */
const ALL_ROLES = "All roles";

const parseScale = (s) => {
  const n = Number(String(s ?? "").split(/[-–]/).pop());
  return Number.isFinite(n) && n > 0 ? n : 10;
};

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

export function createAssessmentParamApi(organizationId) {
  const service = SuperAdmin_assessmentParameter;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  // API record -> row used by the table / dialog. id and _apiId keep the real UUID.
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

  // Dialog form -> request body (POST / PUT)
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