import SuperAdmin_axios from "./SuperAdmin_axios";

/**
 * POST: Hire/Create an employee with optional document uploads
 * Endpoint: /employees/form
 * Content-Type: multipart/form-data (browser sets boundary)
 *
 * Accepts a FormData object or an object that will be converted to FormData.
 * Validates required fields: first_name, work_email, password.
 * Only appends non-empty values and actual File objects.
 */
export async function createEmployee(data) {
  let formData;

  if (data instanceof FormData) {
    formData = data;
  } else if (data && typeof data === "object") {
    formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        if (value instanceof File) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      }
    });
  } else {
    throw new Error("Invalid employee creation payload.");
  }

  // Check required fields
  const required = ["first_name", "work_email", "password"];
  const missing = required.filter((field) => {
    const val = formData.get(field);
    return !val || !String(val).trim();
  });

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  // Post to /employees/form. SuperAdmin_axios removes Content-Type for FormData
  // so the browser automatically sets multipart/form-data with the correct boundary.
  const response = await SuperAdmin_axios.post("/employees/form", formData);
  return response.data;
}

/**
 * GET: List employees with pagination and filters
 * Endpoint: /employees?page=1&limit=20
 * Query params: page, limit, search, status, department_id, company_id, branch_id
 */
export async function getEmployees({
  page = 1,
  limit = 20,
  search = "",
  status = "",
  department_id = "",
  company_id = "",
  branch_id = "",
} = {}) {
  const params = {
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(100, Math.max(1, Number(limit) || 20)),
  };

  if (search && String(search).trim()) {
    params.search = String(search).trim();
  }
  if (status && status !== "all" && String(status).trim()) {
    params.status = String(status).trim();
  }
  if (department_id && department_id !== "all" && String(department_id).trim()) {
    params.department_id = String(department_id).trim();
  }
  if (company_id && company_id !== "all" && String(company_id).trim()) {
    params.company_id = String(company_id).trim();
  }
  if (branch_id && branch_id !== "all" && String(branch_id).trim()) {
    params.branch_id = String(branch_id).trim();
  }

  const response = await SuperAdmin_axios.get("/employees", { params });
  return response.data;
}

/**
 * GET: Fetch complete employee profile by employee profile ID
 * Endpoint: /employees/{employeeId}
 * Note: employeeId is employee.id, NOT employee.user_id.
 */
export async function getEmployeeById(employeeId) {
  if (!employeeId) throw new Error("Employee profile ID is required.");
  const response = await SuperAdmin_axios.get(
    `/employees/${encodeURIComponent(employeeId)}`,
  );
  return response.data;
}

export const getEmployee = getEmployeeById;

/**
 * PUT: Replace/update employee details
 * Endpoint: /employees/{id}
 */
export async function updateEmployee(id, employeeData) {
  if (!id) throw new Error("Employee profile ID is required.");
  const response = await SuperAdmin_axios.put(
    `/employees/${encodeURIComponent(id)}`,
    employeeData,
  );
  return response.data;
}

/**
 * PATCH: Partially update employee details
 * Endpoint: /employees/{id}
 * Content-Type: application/json
 *
 * NOTE: work_email, password, and organization_id are strictly forbidden
 * by the EmployeeUpdate schema and are filtered out.
 */
export async function patchEmployee(id, employeeData) {
  if (!id) throw new Error("Employee profile ID is required.");
  const FORBIDDEN = new Set(["work_email", "password", "organization_id"]);

  const cleanPayload = {};
  if (employeeData && typeof employeeData === "object") {
    Object.entries(employeeData).forEach(([k, v]) => {
      if (!FORBIDDEN.has(k) && v !== undefined) {
        cleanPayload[k] = v;
      }
    });
  }

  const response = await SuperAdmin_axios.patch(
    `/employees/${encodeURIComponent(id)}`,
    cleanPayload,
  );
  return response.data;
}

/**
 * GET: Fetch an employee's documents
 * Endpoint: /employees/{id}/documents
 */
export async function getEmployeeDocuments(id) {
  const response = await SuperAdmin_axios.get(
    `/employees/${encodeURIComponent(id)}/documents`,
  );
  return response.data;
}

/**
 * POST: Upload employee documents (pass a FormData with files)
 * Endpoint: /employees/{id}/documents
 */
export async function uploadEmployeeDocuments(id, documentData) {
  const response = await SuperAdmin_axios.post(
    `/employees/${encodeURIComponent(id)}/documents`,
    documentData,
  );
  return response.data;
}

/**
 * PATCH: Update employee documents
 * Endpoint: /employees/{id}/documents
 */
export async function patchEmployeeDocuments(id, documentData) {
  const response = await SuperAdmin_axios.patch(
    `/employees/${encodeURIComponent(id)}/documents`,
    documentData,
  );
  return response.data;
}

/**
 * POST: Upload one document type
 * Endpoint: /employees/{id}/documents/{document_type}
 */
export async function uploadSingleEmployeeDocument(
  id,
  documentType,
  documentData,
) {
  const response = await SuperAdmin_axios.post(
    `/employees/${encodeURIComponent(id)}/documents/${encodeURIComponent(
      documentType,
    )}`,
    documentData,
  );
  return response.data;
}

/**
 * PATCH: Update one document type
 * Endpoint: /employees/{id}/documents/{document_type}
 */
export async function patchSingleEmployeeDocument(
  id,
  documentType,
  documentData,
) {
  const response = await SuperAdmin_axios.patch(
    `/employees/${encodeURIComponent(id)}/documents/${encodeURIComponent(
      documentType,
    )}`,
    documentData,
  );
  return response.data;
}

export default {
  getEmployees,
  getEmployeeById,
  getEmployee,
  createEmployee,
  updateEmployee,
  patchEmployee,
  getEmployeeDocuments,
  uploadEmployeeDocuments,
  patchEmployeeDocuments,
  uploadSingleEmployeeDocument,
  patchSingleEmployeeDocument,
};
