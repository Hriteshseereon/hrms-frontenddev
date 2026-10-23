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
 * PUT: Replace/update employee details
 * Endpoint: /employees/{id}
 */
export async function updateEmployee(id, employeeData) {
  const response = await SuperAdmin_axios.put(
    `/employees/${encodeURIComponent(id)}`,
    employeeData,
  );
  return response.data;
}

/**
 * PATCH: Partially update employee details
 * Endpoint: /employees/{id}
 */
export async function patchEmployee(id, employeeData) {
  const response = await SuperAdmin_axios.patch(
    `/employees/${encodeURIComponent(id)}`,
    employeeData,
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
  createEmployee,
  updateEmployee,
  patchEmployee,
  getEmployeeDocuments,
  uploadEmployeeDocuments,
  patchEmployeeDocuments,
  uploadSingleEmployeeDocument,
  patchSingleEmployeeDocument,
};
