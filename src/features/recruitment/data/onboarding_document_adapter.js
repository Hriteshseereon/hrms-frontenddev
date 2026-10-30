// Adapter between the onboarding document API file and the Master Data UI.
// The API file (src/api/onboarding_document.js) only calls endpoints;
// all field mapping lives here.
import SuperAdmin_onboardingDocument from "@/api/onboarding_document";

const clean = (v) => String(v ?? "").trim();

// page / page_size are optional on the backend (defaults 1 and 10).
const DOC_LIST_PAGE_SIZE = 100;

/* ---------- onboarding documents ----------
   UI required <-> API is_mandatory. The API generates the code (DOC-001).
   MasterTable passes { name, description, required } (create / PUT) or only the changed
   field (PATCH). Scope IDs are query params only. */
export function createOnboardingDocumentApi(organizationId) {
  const service = SuperAdmin_onboardingDocument;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const toBody = (form) => {
    const body = {};
    if (form.name !== undefined) body.name = clean(form.name);
    if (form.description !== undefined) body.description = clean(form.description);
    if (form.required !== undefined) body.is_mandatory = Boolean(form.required);
    return body;
  };

  return {
    useServerCode: true,
    list: () => service.getAll({ ...scope, page: 1, page_size: DOC_LIST_PAGE_SIZE }),
    getById: (id) => service.getById(id, scope),
    create: (form) => service.create(toBody(form), scope),
    update: (id, form) => service.update(id, toBody(form), scope),
    patch: (id, form) => service.patch(id, toBody(form), scope),
    remove: (id) => service.remove(id, scope),
  };
}