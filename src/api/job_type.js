// job_type.js — Master Data › Recruitment › Job Type (Super Admin)
import SuperAdmin_axios from "./SuperAdmin_axios";

// If your VITE_API_BASE_URL does NOT already end with /api/v1, change this to
// "/api/v1/recruitment/job-types".
const BASE = "/recruitment/job-types";

const SuperAdmin_jobType = {
  // GET /recruitment/job-types
  getAll() {
    return SuperAdmin_axios.get(BASE);
  },

  // GET /recruitment/job-types/{id}
  getById(id) {
    return SuperAdmin_axios.get(`${BASE}/${id}`);
  },

  // POST /recruitment/job-types
  create(payload) {
    return SuperAdmin_axios.post(BASE, payload);
  },

  // PUT /recruitment/job-types/{id}
  update(id, payload) {
    return SuperAdmin_axios.put(`${BASE}/${id}`, payload);
  },

  // PATCH /recruitment/job-types/{id}
  patch(id, payload) {
    return SuperAdmin_axios.patch(`${BASE}/${id}`, payload);
  },

  // DELETE /recruitment/job-types/{id}
  remove(id) {
    return SuperAdmin_axios.delete(`${BASE}/${id}`);
  },
};

/**
 * Config object passed to <CrudSection api={...} />, in the same shape
 * CrudSection already uses for Pay Grade.
 * organizationId is sent only on create (POST), as in the API schema.
 */
export function createJobTypeApi(organizationId) {
  const clean = (v) => String(v ?? "").trim();

  return {
    codePrefix: "JT",

    list: () => SuperAdmin_jobType.getAll(),
    getById: (id) => SuperAdmin_jobType.getById(id),
    create: (payload) =>
      SuperAdmin_jobType.create(
        organizationId ? { ...payload, organization_id: organizationId } : payload,
      ),
    update: (id, payload) => SuperAdmin_jobType.update(id, payload),
    patch: (id, payload) => SuperAdmin_jobType.patch(id, payload),
    remove: (id) => SuperAdmin_jobType.remove(id),

    // API record -> table/form row. id and _apiId keep the real UUID.
    fromApi: (r) => ({
      id: r.id,
      _apiId: r.id,
      name: r.name ?? "",
      description: r.description ?? "",
      status: r.status ?? "",
    }),

    // Form -> request body (POST / PUT)
    toPayload: (form) => ({
      name: clean(form.name),
      description: clean(form.description),
      status: form.status || "Active",
    }),

    // Form -> only the changed fields (PATCH)
    toPatchPayload: (form, existingRow) => {
      const next = {
        name: clean(form.name),
        description: clean(form.description),
        status: form.status || "Active",
      };
      const patch = {};
      Object.keys(next).forEach((k) => {
        if (next[k] !== (existingRow?.[k] ?? "")) patch[k] = next[k];
      });
      return patch;
    },
  };
}

export default SuperAdmin_jobType;