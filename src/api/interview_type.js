// interview_type.js — Master Data › Recruitment › Interview Types (Super Admin)
import SuperAdmin_axios from "./SuperAdmin_axios";

// If your VITE_API_BASE_URL does NOT already end with /api/v1, change this to
// "/api/v1/recruitment/interview-types".
const BASE = "/recruitment/interview-types";

const SuperAdmin_interviewType = {
  // GET /recruitment/interview-types
  getAll() {
    return SuperAdmin_axios.get(BASE);
  },

  // GET /recruitment/interview-types/{id}
  getById(id) {
    return SuperAdmin_axios.get(`${BASE}/${id}`);
  },

  // POST /recruitment/interview-types
  create(payload) {
    return SuperAdmin_axios.post(BASE, payload);
  },

  // PUT /recruitment/interview-types/{id}
  update(id, payload) {
    return SuperAdmin_axios.put(`${BASE}/${id}`, payload);
  },

  // PATCH /recruitment/interview-types/{id}
  patch(id, payload) {
    return SuperAdmin_axios.patch(`${BASE}/${id}`, payload);
  },

  // DELETE /recruitment/interview-types/{id}
  remove(id) {
    return SuperAdmin_axios.delete(`${BASE}/${id}`);
  },
};

/**
 * Config object passed to <CrudSection api={...} />.
 * organizationId is sent only on create (POST).
 */
export function createInterviewTypeApi(organizationId) {
  const clean = (v) => String(v ?? "").trim();

  return {
    codePrefix: "IT",

    list: () => SuperAdmin_interviewType.getAll(),
    getById: (id) => SuperAdmin_interviewType.getById(id),
    create: (payload) =>
      SuperAdmin_interviewType.create(
        organizationId ? { ...payload, organization_id: organizationId } : payload,
      ),
    update: (id, payload) => SuperAdmin_interviewType.update(id, payload),
    patch: (id, payload) => SuperAdmin_interviewType.patch(id, payload),
    remove: (id) => SuperAdmin_interviewType.remove(id),

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

export default SuperAdmin_interviewType;