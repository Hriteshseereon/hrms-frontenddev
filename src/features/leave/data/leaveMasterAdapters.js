// Adapter between the Leave type API (Leave master) and the Leave master UI (ConfigHubTabs.jsx).
// The API file (src/api/leave_type.js) only calls endpoints; all field mapping lives here.
import SuperAdmin_leaveType from "@/api/leave_type";

const clean = (v) => String(v ?? "").trim();

// page / page_size are optional query params.
const LEAVE_LIST_PAGE_SIZE = 100;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- leave types ----------
   UI name / code          <->  API name / code (the API generates LT-001 if code is omitted)
   UI annual               <->  API annual_days
   UI creditFrequency      <->  API credit
   UI approvalChain        <->  API approval_chain
   UI maxConsecutive       <->  API max_consecutive
   UI validityDays         <->  API validity_days
   UI attachmentAfterDays  <->  API attachment_after_days   (needsAttachment = days > 0)
   UI maxCarry             <->  API max_carry_forward       (carryForward = value > 0)
   UI encashOn             <->  API encash_on
   UI applicableTo         <->  API applicable_to
   UI encashable           <->  API encashable_at_year_end
   UI clubbable / active   <->  API clubbable / active
   UI paid                 <->  API paid_leave
   The API returns annual_days and max_carry_forward as strings, so they are converted to numbers.
   Scope IDs are query params only. */

// [UI field, API field, how the value is sent]
const FIELDS = [
  ["name", "name", (v) => clean(v)],
  ["code", "code", (v) => clean(v)],
  ["annual", "annual_days", num],
  ["creditFrequency", "credit", (v) => clean(v)],
  ["approvalChain", "approval_chain", (v) => clean(v)],
  ["maxConsecutive", "max_consecutive", num],
  ["validityDays", "validity_days", num],
  ["attachmentAfterDays", "attachment_after_days", num],
  ["maxCarry", "max_carry_forward", num],
  ["encashOn", "encash_on", (v) => clean(v) || "Gross"],
  ["applicableTo", "applicable_to", (v) => clean(v) || "All"],
  ["encashable", "encashable_at_year_end", Boolean],
  ["clubbable", "clubbable", Boolean],
  ["paid", "paid_leave", Boolean],
  ["active", "active", Boolean],
];

export function createLeaveTypeApi(organizationId) {
  const service = SuperAdmin_leaveType;
  const scope = organizationId ? { organization_id: organizationId } : undefined;

  const unwrap = (res) => {
    const body = res?.data;
    return body?.data && !Array.isArray(body.data) ? body.data : body;
  };

  // API record -> the leave type shape the Leave master screen uses.
  // id keeps the real API id (UUID); code is the server's own code.
  const fromApi = (r) => {
    const maxCarry = num(r.max_carry_forward);
    const attachmentAfterDays = num(r.attachment_after_days);

    return {
      id: String(r.id),
      name: r.name ?? "",
      code: r.code ?? "",
      annual: num(r.annual_days),
      creditFrequency: r.credit ?? "",
      carryForward: maxCarry > 0,
      maxCarry,
      encashable: Boolean(r.encashable_at_year_end),
      encashOn: r.encash_on || "Gross",
      clubbable: Boolean(r.clubbable),
      minDays: 0.5,
      maxConsecutive: num(r.max_consecutive),
      needsAttachment: attachmentAfterDays > 0,
      attachmentAfterDays,
      approvalChain: r.approval_chain ?? "",
      validityDays: num(r.validity_days),
      paid: r.paid_leave !== false,
      applicableTo: r.applicable_to || "All",
      active: r.active !== false,
    };
  };

  const toPayload = (form) =>
    Object.fromEntries(FIELDS.map(([ui, api, convert]) => [api, convert(form[ui])]));

  // Only the fields that changed
  const toPatchPayload = (form, original) => {
    const patch = {};
    FIELDS.forEach(([ui, api, convert]) => {
      const next = convert(form[ui]);
      if (next !== convert(original?.[ui])) patch[api] = next;
    });
    return patch;
  };

  // Use the server record when it comes back, otherwise fall back to what was sent.
  const fromResponse = (res, fallback) => {
    const data = unwrap(res);
    return data && data.id != null ? fromApi(data) : fallback;
  };

  // Dropdown responses may be a list of strings or of objects.
  const optionNames = (res) => {
    const data = unwrap(res);
    const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? data?.data ?? []);
    return items
      .map((o) =>
        typeof o === "string"
          ? o
          : (o?.name ?? o?.label ?? o?.value ?? o?.credit ?? o?.approval_chain ?? ""),
      )
      .map(clean)
      .filter(Boolean);
  };

  return {
    // GET /leave-types/credits
    loadCredits: async () => optionNames(await service.getCredits(scope)),

    // GET /leave-types/approval-chains
    loadApprovalChains: async () => optionNames(await service.getApprovalChains(scope)),

    // GET /leave-types
    list: async () => {
      const res = await service.getAll({ ...scope, page: 1, page_size: LEAVE_LIST_PAGE_SIZE });
      const data = unwrap(res);
      const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? []);
      return items.filter((r) => r && typeof r === "object").map(fromApi);
    },

    // GET /leave-types/{id}
    getById: async (id) => fromResponse(await service.getById(id, scope), null),

    // POST /leave-types
    create: async (form) => {
      const res = await service.create(toPayload(form), scope);
      const created = fromResponse(res, null);
      if (!created) throw new Error("The server did not return the created leave type.");
      return created;
    },

    // PATCH /leave-types/{id}: only the changed fields; no request when nothing changed.
    patch: async (id, form, original) => {
      const patch = toPatchPayload(form, original);
      if (!Object.keys(patch).length) return { ...form, id: String(id) };
      const res = await service.patch(id, patch, scope);
      return fromResponse(res, { ...form, id: String(id) });
    },

    // PUT /leave-types/{id}: full replace.
    update: async (id, form) => {
      const res = await service.update(id, toPayload(form), scope);
      return fromResponse(res, { ...form, id: String(id) });
    },

    // DELETE /leave-types/{id}
    remove: (id) => service.remove(id, scope),
  };
}