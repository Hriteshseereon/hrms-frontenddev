// candidate_source.js — Master Data › Recruitment › Candidate Sources (Super Admin)
import SuperAdmin_axios from "./SuperAdmin_axios";

// If your VITE_API_BASE_URL does NOT already end with /api/v1, change this to
// "/api/v1/recruitment/candidate-sources".
const BASE = "/recruitment/candidate-sources";

const SuperAdmin_candidateSource = {
  // GET /recruitment/candidate-sources
  getAll() {
    return SuperAdmin_axios.get(BASE);
  },

  // GET /recruitment/candidate-sources/{id}
  getById(id) {
    return SuperAdmin_axios.get(`${BASE}/${id}`);
  },

  // POST /recruitment/candidate-sources
  create(payload) {
    return SuperAdmin_axios.post(BASE, payload);
  },

  // PUT /recruitment/candidate-sources/{id}
  update(id, payload) {
    return SuperAdmin_axios.put(`${BASE}/${id}`, payload);
  },

  // PATCH /recruitment/candidate-sources/{id}
  patch(id, payload) {
    return SuperAdmin_axios.patch(`${BASE}/${id}`, payload);
  },

  // DELETE /recruitment/candidate-sources/{id}
  remove(id) {
    return SuperAdmin_axios.delete(`${BASE}/${id}`);
  },
};

/**
 * Config object passed to <CrudSection api={...} />.
 * organizationId is sent only on create (POST), as in the API schema.
 */
export function createCandidateSourceApi(organizationId) {
  const clean = (v) => String(v ?? "").trim();

  return {
    codePrefix: "CS",

    list: () => SuperAdmin_candidateSource.getAll(),
    getById: (id) => SuperAdmin_candidateSource.getById(id),
    create: (payload) =>
      SuperAdmin_candidateSource.create(
        organizationId ? { ...payload, organization_id: organizationId } : payload,
      ),
    update: (id, payload) => SuperAdmin_candidateSource.update(id, payload),
    patch: (id, payload) => SuperAdmin_candidateSource.patch(id, payload),
    remove: (id) => SuperAdmin_candidateSource.remove(id),

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

export default SuperAdmin_candidateSource;