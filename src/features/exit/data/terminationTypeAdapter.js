// Adapters between the Exit, cases & grievance master APIs (Termination Types, Warning Types,
// Complaint Types)
// and MasterTable (MastersView.jsx).
// API files only call endpoints; all field mapping lives here.
// MasterTable fields (name, description) match the API field names, so no renaming is needed.
import SuperAdmin_terminationType from "@/api/termination_type";
import SuperAdmin_warningType from "@/api/warning_type";
import SuperAdmin_complaintType from "@/api/complaint_type";

// Safe page size used on other endpoints; change it if the list returns a 422 naming another limit.
const LIST_PAGE_SIZE = 100;

const clean = (v) => String(v ?? "").trim();

// organizationId is optional: the backend resolves scope from the logged-in user's token.
export function createTerminationTypeApi(organizationId) {
  const service = SuperAdmin_terminationType;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  return {
    // Show the server's own code in the Code column.
    useServerCode: true,

    // GET /termination-types
    list: () => service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE }),

    // GET /termination-types/{id}
    getById: (id) => service.getById(id, scope),

    // POST /termination-types
    create: (p) =>
      service.create({ name: clean(p.name), description: clean(p.description) }, scope),

    // PUT /termination-types/{id}
    update: (id, p) =>
      service.update(id, { name: clean(p.name), description: clean(p.description) }, scope),

    // PATCH /termination-types/{id}  (MasterTable sends only the one changed field)
    patch: (id, p) => {
      const body = {};
      if ("name" in p) body.name = clean(p.name);
      if ("description" in p) body.description = clean(p.description);
      return service.patch(id, body, scope);
    },

    // DELETE /termination-types/{id}
    remove: (id) => service.remove(id, scope),
  };
}

// organizationId is optional: the backend resolves scope from the logged-in user's token.
export function createWarningTypeApi(organizationId) {
  const service = SuperAdmin_warningType;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  return {
    // Show the server's own code in the Code column.
    useServerCode: true,

    // GET /warning-types
    list: () => service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE }),

    // GET /warning-types/{id}
    getById: (id) => service.getById(id, scope),

    // POST /warning-types
    create: (p) =>
      service.create({ name: clean(p.name), description: clean(p.description) }, scope),

    // PUT /warning-types/{id}
    update: (id, p) =>
      service.update(id, { name: clean(p.name), description: clean(p.description) }, scope),

    // PATCH /warning-types/{id}  (MasterTable sends only the one changed field)
    patch: (id, p) => {
      const body = {};
      if ("name" in p) body.name = clean(p.name);
      if ("description" in p) body.description = clean(p.description);
      return service.patch(id, body, scope);
    },

    // DELETE /warning-types/{id}
    remove: (id) => service.remove(id, scope),
  };
}

// organizationId is optional: the backend resolves scope from the logged-in user's token.
export function createComplaintTypeApi(organizationId) {
  const service = SuperAdmin_complaintType;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  return {
    // Show the server's own code in the Code column.
    useServerCode: true,

    // GET /complaint-types
    list: () => service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE }),

    // GET /complaint-types/{id}
    getById: (id) => service.getById(id, scope),

    // POST /complaint-types
    create: (p) =>
      service.create({ name: clean(p.name), description: clean(p.description) }, scope),

    // PUT /complaint-types/{id}
    update: (id, p) =>
      service.update(id, { name: clean(p.name), description: clean(p.description) }, scope),

    // PATCH /complaint-types/{id}  (MasterTable sends only the one changed field)
    patch: (id, p) => {
      const body = {};
      if ("name" in p) body.name = clean(p.name);
      if ("description" in p) body.description = clean(p.description);
      return service.patch(id, body, scope);
    },

    // DELETE /complaint-types/{id}
    remove: (id) => service.remove(id, scope),
  };
}