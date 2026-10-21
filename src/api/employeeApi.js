
import SuperAdmin_axios from "./SuperAdmin_axios";

/**
 * POST: Hire an employee
 * Endpoint: /employees/form
 * Body: FormData
 */
export async function createEmployee(formData) {
  const response = await SuperAdmin_axios.post(
    "/employees/form",
    formData
  );

  return response.data;
}

/**
 * PUT: Replace/update employee details
 * Endpoint: /employees/{id}
 * Body: employeeData
 */
export async function updateEmployee(id, employeeData) {
  const response = await SuperAdmin_axios.put(
    `/employees/${encodeURIComponent(id)}`,
    employeeData
  );

  return response.data;
}

/**
 * PATCH: Partially update employee details
 * Endpoint: /employees/{id}
 * Body: employeeData
 */
export async function patchEmployee(id, employeeData) {
  const response = await SuperAdmin_axios.patch(
    `/employees/${encodeURIComponent(id)}`,
    employeeData
  );

  return response.data;
}

/**
 * GET: Fetch an employee's documents
 * Endpoint: /employees/{id}/documents
 */
export async function getEmployeeDocuments(id) {
  const response = await SuperAdmin_axios.get(
    `/employees/${encodeURIComponent(id)}/documents`
  );

  return response.data;
}

/**
 * POST: Upload employee documents
 * Endpoint: /employees/{id}/documents
 * Body: FormData or the body format required by Swagger
 */
export async function uploadEmployeeDocuments(id, documentData) {
  const response = await SuperAdmin_axios.post(
    `/employees/${encodeURIComponent(id)}/documents`,
    documentData
  );

  return response.data;
}

/**
 * PATCH: Update employee documents
 * Endpoint: /employees/{id}/documents
 * Body: documentData
 */
export async function patchEmployeeDocuments(id, documentData) {
  const response = await SuperAdmin_axios.patch(
    `/employees/${encodeURIComponent(id)}/documents`,
    documentData
  );

  return response.data;
}

/**
 * POST: Upload one document type for an employee
 * Endpoint: /employees/{id}/documents/{document_type}
 * Body: documentData
 */
export async function uploadSingleEmployeeDocument(
  id,
  documentType,
  documentData
) {
  const response = await SuperAdmin_axios.post(
    `/employees/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentType)}`,
    documentData
  );

  return response.data;
}

/**
 * PATCH: Update one document type for an employee
 * Endpoint: /employees/{id}/documents/{document_type}
 * Body: documentData
 */
export async function patchSingleEmployeeDocument(
  id,
  documentType,
  documentData
) {
  const response = await SuperAdmin_axios.patch(
    `/employees/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentType)}`,
    documentData
  );

  return response.data;
}
