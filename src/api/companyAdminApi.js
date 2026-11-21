import SuperAdmin_axios from "./SuperAdmin_axios";

// Make an employee a Company Admin, or take that access away. The employee keeps the same email and password.
// Allowed for a Super Admin (any company of the organisation) and for the Company Admin of that same company.
// The company travels in the path, so these calls need no X-Company-Id header (they are org-level URLs).
const base = (companyId) => `/super-admin/companies/${encodeURIComponent(companyId)}/company-admins`;

/**
 * POST /super-admin/companies/{company_id}/company-admins  { employee_id }
 * `employeeId` may be the employee UUID, the employee code or the work email.
 * -> { success, data: { employee_id, employee_code, user_id, full_name, email, role: "COMPANY_ADMIN" }, message }
 */
export async function makeCompanyAdmin(companyId, employeeId) {
  if (!companyId) throw new Error("Select a company first");
  if (!employeeId) throw new Error("Employee is required");
  const response = await SuperAdmin_axios.post(base(companyId), { employee_id: String(employeeId) });
  return response.data;
}

/**
 * DELETE /super-admin/companies/{company_id}/company-admins/{employee_id}
 * -> same shape with role: "EMPLOYEE", message "Company Admin access removed."
 */
export async function removeCompanyAdmin(companyId, employeeId) {
  if (!companyId) throw new Error("Select a company first");
  if (!employeeId) throw new Error("Employee is required");
  const response = await SuperAdmin_axios.delete(`${base(companyId)}/${encodeURIComponent(employeeId)}`);
  return response.data;
}
