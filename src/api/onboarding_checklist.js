// onboarding_checklist.js — Master Data › Recruitment › Onboarding Checklists (Super Admin)
import SuperAdmin_axios from "./SuperAdmin_axios";

// If your VITE_API_BASE_URL does NOT already end with /api/v1, change this to
// "/api/v1/recruitment/onboarding-checklists".
const BASE = "/recruitment/onboarding-checklists";

const SuperAdmin_onboardingChecklist = {
  // GET /recruitment/onboarding-checklists
  getAll() {
    return SuperAdmin_axios.get(BASE);
  },

  // GET /recruitment/onboarding-checklists/{id}
  getById(id) {
    return SuperAdmin_axios.get(`${BASE}/${id}`);
  },

  // POST /recruitment/onboarding-checklists
  create(payload) {
    return SuperAdmin_axios.post(BASE, payload);
  },

  // PUT /recruitment/onboarding-checklists/{id}
  update(id, payload) {
    return SuperAdmin_axios.put(`${BASE}/${id}`, payload);
  },

  // PATCH /recruitment/onboarding-checklists/{id}
  patch(id, payload) {
    return SuperAdmin_axios.patch(`${BASE}/${id}`, payload);
  },

  // DELETE /recruitment/onboarding-checklists/{id}
  remove(id) {
    return SuperAdmin_axios.delete(`${BASE}/${id}`);
  },
};

/**
 * Config object passed to <CrudSection api={...} />.
 * organizationId is sent only on create (POST), as in the API schema.
 *
 * UI field  <->  API field
 *   name    <->  checklist_name
 *   items   <->  items (UI: "a, b, c" string  |  API: ["a", "b", "c"])
 */
export function createOnboardingChecklistApi(organizationId) {
  const clean = (v) => String(v ?? "").trim();

  // "Offer signed, BGV, Asset allocation" -> ["Offer signed", "BGV", "Asset allocation"]
  const itemsToList = (v) =>
    clean(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  // ["a", "b"] (or an already-joined string) -> "a, b"
  const itemsToText = (v) =>
    Array.isArray(v) ? v.join(", ") : String(v ?? "");

  return {
    codePrefix: "OC",

    list: () => SuperAdmin_onboardingChecklist.getAll(),
    getById: (id) => SuperAdmin_onboardingChecklist.getById(id),
    create: (payload) =>
      SuperAdmin_onboardingChecklist.create(
        organizationId ? { ...payload, organization_id: organizationId } : payload,
      ),
    update: (id, payload) => SuperAdmin_onboardingChecklist.update(id, payload),
    patch: (id, payload) => SuperAdmin_onboardingChecklist.patch(id, payload),
    remove: (id) => SuperAdmin_onboardingChecklist.remove(id),

    // API record -> table/form row. id and _apiId keep the real UUID.
    fromApi: (r) => ({
      id: r.id,
      _apiId: r.id,
      name: r.checklist_name ?? r.name ?? "",
      items: itemsToText(r.items),
      description: r.description ?? "",
      status: r.status ?? "",
    }),

    // Form -> request body (POST / PUT)
    toPayload: (form) => ({
      checklist_name: clean(form.name),
      items: itemsToList(form.items),
      description: clean(form.description),
      status: form.status || "Active",
    }),

    // Form -> only the changed fields (PATCH)
    toPatchPayload: (form, existingRow) => {
      const patch = {};

      if (clean(form.name) !== (existingRow?.name ?? "")) {
        patch.checklist_name = clean(form.name);
      }

      // Compare normalised item lists so spacing differences don't count as a change.
      const nextItems = itemsToList(form.items);
      const oldItems = itemsToList(existingRow?.items);
      if (JSON.stringify(nextItems) !== JSON.stringify(oldItems)) {
        patch.items = nextItems;
      }

      if (clean(form.description) !== (existingRow?.description ?? "")) {
        patch.description = clean(form.description);
      }

      const nextStatus = form.status || "Active";
      if (nextStatus !== (existingRow?.status ?? "")) {
        patch.status = nextStatus;
      }

      return patch;
    },
  };
}

export default SuperAdmin_onboardingChecklist;