// Adapter between the Performance Indicators API and CrudSection (PerformanceMastersTab.jsx).
// The API file only calls endpoints; all field mapping lives here.
//
// UI field   ->  API field
// name       ->  name
// category   ->  category (+ category_id, looked up from /performance-indicators/categories)
// unit       ->  measurement_unit
// target     ->  target_value (number)
// status     ->  status
// description->  description
import SuperAdmin_performanceIndicator from "@/api/performance_indicator";

// Safe page size used on other endpoints; change it if the list returns a 422 naming another limit.
const LIST_PAGE_SIZE = 100;

const clean = (v) => String(v ?? "").trim();

// API field -> UI label, used to make 422 messages readable.
const FIELD_LABELS = {
  name: "Name",
  category: "Category",
  category_id: "Category",
  measurement_unit: "Measurement Unit",
  target_value: "Target Value",
  status: "Status",
  description: "Description",
};

// CrudSection shows error.response.data.detail in a toast. FastAPI sends 422 detail as an
// array of objects, which a toast cannot render, so convert it to a plain string here.
function readableDetail(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const key = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : "";
        const label = FIELD_LABELS[key] ?? key;
        return label ? `${label}: ${d?.msg}` : d?.msg;
      })
      .filter(Boolean)
      .join(", ");
  }
  if (detail && typeof detail === "object") {
    return detail.message || JSON.stringify(detail);
  }
  return detail;
}

async function call(request) {
  try {
    return await request();
  } catch (error) {
    const data = error?.response?.data;
    if (data && data.detail !== undefined && typeof data.detail !== "string") {
      data.detail = readableDetail(data.detail);
    }
    throw error;
  }
}

// Builds an error CrudSection can show in its toast.
function validationError(message) {
  const error = new Error(message);
  error.response = { data: { detail: message } };
  return error;
}

// Accepts [...], { items }, { results }, { data }, { categories }, { data: { items } }.
function extractList(response) {
  const d = response?.data;
  if (Array.isArray(d)) return d;
  for (const key of ["items", "results", "data", "categories"]) {
    if (Array.isArray(d?.[key])) return d[key];
  }
  if (Array.isArray(d?.data?.items)) return d.data.items;
  return [];
}

// organizationId is optional: the backend resolves scope from the logged-in user's token.
export function createPerformanceIndicatorApi(organizationId) {
  const service = SuperAdmin_performanceIndicator;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  // Finds the category_id for the category name chosen in the dropdown.
  // If the lookup fails, the payload is still sent with the category name only.
  async function resolveCategoryId(categoryName) {
    const wanted = clean(categoryName).toLowerCase();
    if (!wanted) return undefined;

    try {
      const response = await service.getCategories(scope);
      const match = extractList(response).find((item) => {
        if (!item || typeof item !== "object") return false;
        const name = item.name ?? item.category_name ?? item.label;
        return clean(name).toLowerCase() === wanted;
      });
      return match ? (match.id ?? match.category_id ?? match.value) : undefined;
    } catch (error) {
      console.warn("Could not load indicator categories:", error);
      return undefined;
    }
  }

  async function withCategoryId(payload) {
    const categoryId = await resolveCategoryId(payload.category);
    return categoryId ? { ...payload, category_id: categoryId } : payload;
  }

  return {
    // No codePrefix: the Code column shows the server's own `code`.

    // API record -> CrudSection row
    fromApi: (record) => ({
      id: record.id, // row key used by CrudSection
      _apiId: record.id, // real UUID used for GET/PUT/DELETE
      code: record.code || undefined,
      name: record.name ?? "",
      category: record.category_name ?? record.category ?? "",
      unit: record.measurement_unit ?? "",
      target:
        record.target_value === null || record.target_value === undefined
          ? ""
          : String(record.target_value),
      status: record.status ?? "",
      description: record.description ?? "",
    }),

    // CrudSection form -> API body (category_id is added in create/update)
    toPayload: (form) => {
      const target = clean(form.target);
      const targetValue = Number(target);

      if (target === "" || !Number.isFinite(targetValue)) {
        throw validationError("Target Value must be a number, e.g. 38.");
      }

      return {
        name: clean(form.name),
        category: clean(form.category),
        measurement_unit: clean(form.unit),
        target_value: targetValue,
        status: clean(form.status),
        description: clean(form.description),
      };
    },

    // GET /performance-indicators
    list: () =>
      call(() => service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE })),

    // GET /performance-indicators/{indicator_id}
    getById: (id) => call(() => service.getById(id, scope)),

    // POST /performance-indicators
    create: async (payload) => {
      const body = await withCategoryId(payload);
      return call(() => service.create(body, scope));
    },

    // PUT /performance-indicators/{indicator_id}
    update: async (id, payload) => {
      const body = await withCategoryId(payload);
      return call(() => service.update(id, body, scope));
    },

    // DELETE /performance-indicators/{indicator_id}
    remove: (id) => call(() => service.remove(id, scope)),
  };
}