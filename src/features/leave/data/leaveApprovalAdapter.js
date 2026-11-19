// Adapter between the Leave Approvals API (src/api/leave_approval.js) and the Leave Applications screen.
import { Leave_approval_manager, Leave_approval_hr } from "@/api/leave_approval";

const PAGE_SIZE = 100;

const unwrap = (res) => res?.data ?? res;

// Dev only: says which logged-in user the requests were sent as (same token choice as SuperAdmin_axios),
// so an empty list can be compared with Swagger. Only the email, role and company are printed, never the token.
function debugApprovalCaller(summary) {
  try {
    const token = localStorage.getItem("super_admin_access_token") || localStorage.getItem("access_token") || "";
    const raw = token.replace(/^Bearer\s+/i, "").split(".")[1] ?? "";
    const claims = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")));
    console.info(`[leave-approvals] sent as ${claims.sub} (role ${claims.role}, company ${claims.companyId}) → ${summary}`);
  } catch {
    console.info(`[leave-approvals] ${summary}; could not read the login token`);
  }
}

/** API item -> the row shape the Leave Applications screen uses. */
export const fromApproval = (r = {}, level = "manager") => {
  const attachments = Array.isArray(r.attachments) ? r.attachments : [];
  const names = attachments.map((a) => a?.document_name).filter(Boolean);

  return {
    id: r.reference ?? String(r.id ?? ""),
    _apiId: r.id,
    employee: r.employee?.name ?? "",
    empId: r.employee?.employee_code ?? "",
    department: r.employee?.department ?? "",
    designation: r.employee?.designation ?? "",
    leaveType: r.leave_type ?? "",
    from: r.from_date ?? "",
    to: r.to_date ?? "",
    days: Number(r.days ?? 0),
    available: Number.isFinite(Number(r.available)) ? Number(r.available) : null,
    description: r.description ?? "",
    attachment: names[0] ?? "",
    documents: names,
    _attachments: attachments,
    status: r.status ?? "",
    statusLabel: r.status_label ?? "",
    stage: r.stage ?? "", // manager | hr | CLOSED: who has to decide next
    _level: level, // which API this row came from: "manager" | "hr"
    statusNote: r.status_note ?? "",
    decisionReason: r.decision_reason ?? "",
    decidedOn: r.decided_on ? String(r.decided_on).slice(0, 10) : "",
    appliedOn: r.applied_on ?? "",
    canApprove: Boolean(r.actions?.can_approve),
    canReject: Boolean(r.actions?.can_reject),
    actionMessage: r.actions?.message ?? "",
  };
};

const itemsOf = (res) => {
  const body = unwrap(res);
  return {
    body,
    items: Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [],
  };
};

/**
 * Requests the logged-in user reviews, from both steps of the flow:
 *   GET /leave-approvals      first step (manager)
 *   GET /hr-leave-approvals   second step (HR Manager)
 * A person may be only a manager, only an HR Manager or both. The HR list answers 403 to everyone who is not an
 * HR Manager, which is normal and just means there is nothing to show from that step.
 */
export async function listLeaveApprovals(params = {}) {
  const query = { status: "All", page: 1, page_size: PAGE_SIZE, ...params };
  const [mgr, hr] = await Promise.allSettled([
    Leave_approval_manager.getAll(query),
    Leave_approval_hr.getAll(query),
  ]);

  const denied = (r) => r.status === "rejected" && r.reason?.response?.status === 403;
  // Neither list answered with anything usable: surface the real error (not a 403).
  if (mgr.status === "rejected" && hr.status === "rejected" && !(denied(mgr) && denied(hr))) {
    throw (denied(mgr) ? hr : mgr).reason;
  }

  const rows = new Map(); // by request id, so a request seen in both lists appears once
  const add = (result, level) => {
    if (result.status !== "fulfilled") return 0;
    const { items } = itemsOf(result.value);
    items
      .filter((r) => r && typeof r === "object")
      .map((r) => fromApproval(r, level))
      // The HR step only handles what the manager has already approved: a request still waiting for the
      // manager ("Pending at Manager") is not shown in the HR list.
      .filter((row) => !(level === "hr" && row.status === "Pending" && row.stage === "manager"))
      .forEach((row) => {
        const key = row._apiId ?? row.id;
        const seen = rows.get(key);
        // Prefer the copy the user can act on.
        if (!seen || (!seen.canApprove && row.canApprove)) rows.set(key, row);
      });
    return items.length;
  };
  const nMgr = add(mgr, "manager");
  const nHr = add(hr, "hr");

  const items = [...rows.values()].sort((a, b) => String(b.appliedOn).localeCompare(String(a.appliedOn)) || String(b.id).localeCompare(String(a.id)));
  if (import.meta.env.DEV) {
    debugApprovalCaller(
      `manager list: ${mgr.status === "fulfilled" ? `${nMgr} item(s)` : denied(mgr) ? "403 (not a manager)" : "failed"}; ` +
        `HR list: ${hr.status === "fulfilled" ? `${nHr} item(s)` : denied(hr) ? "403 (not an HR Manager)" : "failed"}`,
    );
  }
  return {
    items,
    pendingCount: items.filter((r) => r.status === "Pending").length,
    total: items.length,
  };
}

/** POST {manager | hr}/leave-approvals/{id}/approve | /reject, on the step the row belongs to. */
export async function decideLeaveApproval(row, action, remarks = "") {
  const api = row._level === "hr" ? Leave_approval_hr : Leave_approval_manager;
  const id = row._apiId ?? row.id;
  const payload = { remarks: String(remarks ?? "").trim() };
  const res = action === "Approved" ? await api.approve(id, payload) : await api.reject(id, payload);
  return fromApproval(unwrap(res), row._level);
}
