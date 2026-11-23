
import Employee_leaveRequest from "@/api/leave_request";

const PAGE_SIZE = 100;

const clean = (v) => String(v ?? "").trim();

/**
 * Handles Axios responses and nested API response formats.
 */
const unwrap = (res) => {
  let data = res?.data ?? res;

  if (data?.data != null) {
    data = data.data;
  }

  return data;
};

/**
 * Reads arrays from different backend response keys.
 */
const readItems = (res) => {
  const d = unwrap(res);

  if (Array.isArray(d)) return d;

  // Common response formats
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.applications)) return d.applications;

  // Employee Leave Request dropdown responses
  if (Array.isArray(d?.leave_types)) return d.leave_types;
  if (Array.isArray(d?.reason_categories)) return d.reason_categories;
  if (Array.isArray(d?.team_members)) return d.team_members;

  return [];
};

const statusLabel = (s) => {
  const v = clean(s).toLowerCase();
  return v ? v[0].toUpperCase() + v.slice(1) : "";
};

const optionName = (o) =>
  typeof o === "string"
    ? o
    : o?.label ??
      o?.name ??
      o?.value ??
      o?.full_name ??
      "";

/**
 * Convert backend leave request into the existing My Leave row format.
 */
export const fromApi = (r = {}) => {
  const docs = Array.isArray(r.supporting_documents)
    ? r.supporting_documents
    : [];

  const docNames = docs
    .map((d) => d?.document_name ?? d?.name ?? "")
    .filter(Boolean);

  return {
    id: r.request_id ?? String(r.id ?? ""),
    _apiId: r.id,

    leaveType: r.leave_type?.name ?? r.leave_type ?? "",

    from: r.from_date ?? "",
    to: r.to_date ?? "",
    days: Number(r.days ?? 0),

    dayPart: r.day_part_label ?? r.day_part ?? "",

    reasonCategory:
      r.reason_category?.label ??
      r.reason_category?.value ??
      r.reason_category ??
      "",

    description: r.description ?? "",

    contactDuringLeave: r.contact_during_leave ?? "",
    locationDuringLeave: r.location_during_leave ?? "",

    handoverTo: r.handover_to?.name ?? r.handover_to ?? "",
    handoverNotes: r.handover_notes ?? "",

    appliedOn: r.applied_on ?? "",
    status: statusLabel(r.status),

    decisionReason: r.decision_reason ?? "",
    decidedBy: r.decided_by?.name ?? r.decided_by ?? "",
    decidedOn: r.decided_on ?? "",

    attachment: docNames[0] ?? "",
    documents: docNames,

    canCancel: Boolean(r.actions?.can_cancel),
  };
};

/**
 * GET /leave-requests
 * Fetch logged-in employee's own leave requests.
 */
export async function listMyLeaveRequests() {
  const res = await Employee_leaveRequest.getAll({
    page: 1,
    page_size: PAGE_SIZE,
  });

  return readItems(res)
    .filter((r) => r && typeof r === "object")
    .map(fromApi);
}

/**
 * GET /leave-requests/{leave_request_id}
 * Fetch one leave request's details.
 */
export async function getMyLeaveRequest(id) {
  const res = await Employee_leaveRequest.getById(id);
  return fromApi(unwrap(res));
}

/**
 * GET /leave-requests/reason-categories
 * Load reason category dropdown options.
 */
export async function loadReasonCategories() {
  const items = readItems(
    await Employee_leaveRequest.getReasonCategories()
  );

  return items
    .map((o) => {
      if (typeof o === "string") {
        return {
          value: clean(o),
          label: clean(o),
        };
      }

      return {
        value: clean(
          o?.value ??
          o?.code ??
          o?.name ??
          o?.label
        ),
        label: clean(
          o?.label ??
          o?.name ??
          o?.value
        ),
      };
    })
    .filter((o) => o.value && o.label);
}

/**
 * GET /leave-requests/team-members
 * Load employees for the Handover To dropdown.
 */
export async function loadTeamMembers() {
  const items = readItems(
    await Employee_leaveRequest.getTeamMembers()
  );

  return items
    .map((o) => {
      if (typeof o === "string") {
        return {
          id: o,
          name: clean(o),
          department: "",
          designation: "",
        };
      }

      return {
        id:
          o?.id ??
          o?.employee_id ??
          o?.value ??
          optionName(o),

        name: clean(
          o?.name ??
          o?.full_name ??
          o?.label ??
          ""
        ),

        department: o?.department ?? "",
        designation: o?.designation ?? "",
      };
    })
    .filter((o) => o.name);
}

/**
 * POST /leave-requests/{id}/withdraw
 * The employee withdraws their own Pending request with a remark (Pending -> Cancelled, days go back to the
 * balance). The remark is stored as the request's decision_reason, so managers and HR see it too.
 */
export async function withdrawLeaveRequest(id, remarks) {
  const res = await Employee_leaveRequest.withdraw(id, { remarks: clean(remarks) });
  return fromApi(unwrap(res));
}

/**
 * GET /leave-requests/leave-types
 * Active leave types created by the company admin (read-only for employees).
 * Works with plain names or full leave-type objects.
 */
export async function loadEmployeeLeaveTypes() {
  const items = readItems(await Employee_leaveRequest.getLeaveTypes());
  const seen = new Set();

  return items
    .map((o) => {
      if (typeof o === "string") {
        return { id: clean(o), name: clean(o), code: "", paid: null, annual: null, creditFrequency: "", applicableTo: "", maxConsecutive: 0, attachmentAfterDays: 0, active: true };
      }

      const annual = Number(o?.annual_days ?? o?.annual);
      const rawBalance = o?.leave_balance;
      const leaveBalance =
        rawBalance === null || rawBalance === undefined || rawBalance === ""
          ? NaN
          : Number(rawBalance);
      const maxConsecutive = Number(o?.max_consecutive);
      const attachmentAfterDays = Number(o?.attachment_after_days);

      return {
        id: clean(o?.id ?? o?.code ?? optionName(o)),
        name: clean(optionName(o)),
        code: clean(o?.code),
        paid: o?.paid_leave ?? o?.paid ?? null,
        annual: Number.isFinite(annual) ? annual : null,
        leaveBalance: Number.isFinite(leaveBalance) ? leaveBalance : null,
        creditFrequency: o?.credit ?? o?.credit_frequency ?? "",
        applicableTo: o?.applicable_to ?? "",
        maxConsecutive: Number.isFinite(maxConsecutive) ? maxConsecutive : 0,
        attachmentAfterDays: Number.isFinite(attachmentAfterDays) ? attachmentAfterDays : 0,
        active: o?.active,
      };
    })
    .filter((t) => {
      if (!t.name || t.active === false) return false;
      const key = t.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Leave type names only (the POST /leave-requests body takes the name). */
export async function loadLeaveTypeOptions() {
  return (await loadEmployeeLeaveTypes()).map((t) => t.name);
}

/**
 * Convert frontend day part values into backend enum values.
 */
const DAY_PARTS = {
  "full day": "FULL_DAY",
  full_day: "FULL_DAY",

  "first half": "FIRST_HALF",
  first_half: "FIRST_HALF",

  "second half": "SECOND_HALF",
  second_half: "SECOND_HALF",
};

export const dayPartToApi = (v) =>
  DAY_PARTS[clean(v).toLowerCase()] ?? "FULL_DAY";

/**
 * POST /leave-requests
 * Sends actual File objects using multipart/form-data.
 */
export async function applyForLeave(form, files = []) {
  const fd = new FormData();

  fd.append("leave_type", clean(form.leaveType));
  fd.append("from_date", form.from);
  fd.append("to_date", form.to);
  fd.append("day_part", dayPartToApi(form.dayPart));
  fd.append("reason_category", clean(form.reasonCategory));
  fd.append("description", clean(form.description));

  if (clean(form.contactDuringLeave)) {
    fd.append(
      "contact_during_leave",
      clean(form.contactDuringLeave)
    );
  }

  if (clean(form.locationDuringLeave)) {
    fd.append(
      "location_during_leave",
      clean(form.locationDuringLeave)
    );
  }

  if (clean(form.handoverTo)) {
    fd.append(
      "handover_to_employee",
      clean(form.handoverTo)
    );
  }

  if (clean(form.handoverNotes)) {
    fd.append(
      "handover_notes",
      clean(form.handoverNotes)
    );
  }

  // Multiple files use the same field name.
  files.forEach((file) => {
    fd.append("supporting_documents", file);
  });

  const res = await Employee_leaveRequest.create(fd);

  return fromApi(unwrap(res));
}
