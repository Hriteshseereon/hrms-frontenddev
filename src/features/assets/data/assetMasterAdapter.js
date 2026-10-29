// Adapter between the Asset Type API and AssetMasterTab.
// API file only calls endpoints; all field mapping lives here.
import SuperAdmin_assetType from "@/api/asset_type";

const clean = (v) => String(v ?? "").trim();

// Safe page size used on other endpoints; raise it if the backend allows more.
const LIST_PAGE_SIZE = 100;

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

const asList = (res) => {
  const data = res?.data;
  return Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
};

/** Category names for the Category dropdown. Accepts strings or objects. */
export async function loadAssetCategories(organizationId) {
  const scope = organizationId ? { organization_id: organizationId } : undefined;
  const res = await SuperAdmin_assetType.getCategories(scope);
  return asList(res)
    .map((c) => (typeof c === "string" ? c : (c?.name ?? c?.label ?? c?.value ?? c?.category ?? "")))
    .filter(Boolean);
}

export function createAssetTypeApi(organizationId) {
  const service = SuperAdmin_assetType;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  // API record -> row used by AssetMasterTab. id keeps the real UUID.
  const fromApi = (r) => ({
    id: r.id,
    code: r.code ?? "",
    name: r.type_name ?? "",
    kind: r.category ?? "",
    description: r.description ?? "",
    requiresSerial: Boolean(r.serial_number_required),
    usefulLifeYears: Number(r.useful_life_years ?? 1),
    depreciationPct: Number(r.depreciation_percentage ?? 0),
    custodianDept: r.custodian_department ?? "",
    checklist: Array.isArray(r.condition_checklist) ? r.condition_checklist : [],
    accessories: Array.isArray(r.default_accessories) ? r.default_accessories : [],
    defaultReturnDays: Number(r.default_return_period_days ?? 0),
    active: r.is_active ?? true,
    inRegister: Number(r.in_register ?? 0),
  });

  // Form -> request body (POST / PUT)
  const toPayload = (f) => ({
    code: clean(f.code),
    type_name: clean(f.name),
    category: f.kind,
    description: clean(f.description),
    useful_life_years: Number(f.usefulLifeYears),
    depreciation_percentage: Number(f.depreciationPct),
    custodian_department: clean(f.custodianDept),
    default_return_period_days: Number(f.defaultReturnDays) || 0,
    serial_number_required: Boolean(f.requiresSerial),
    is_active: Boolean(f.active),
    condition_checklist: f.checklist ?? [],
    default_accessories: f.accessories ?? [],
  });

  return {
    // GET /assets/asset-types
    list: async () => {
      const res = await service.getAll({ ...scope, page: 1, page_size: LIST_PAGE_SIZE });
      return asList(res).map(fromApi);
    },
    // POST /assets/asset-types
    create: (f) => service.create(toPayload(f), scope),
    // PUT /assets/asset-types/{id}
    update: (id, f) => service.update(id, toPayload(f), scope),
    // PATCH /assets/asset-types/{id}  (Active switch)
    setActive: (id, isActive) => service.patch(id, { is_active: isActive }, scope),
    // DELETE /assets/asset-types/{id}
    remove: (id) => service.remove(id, scope),
  };
}