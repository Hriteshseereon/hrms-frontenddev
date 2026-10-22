import SuperAdmin_axios from "./SuperAdmin_axios";

/**
 * Set to true  -> send multipart/form-data (backend uses Form(...) fields)
 * Set to false -> send application/json    (backend uses a Pydantic body)
 *
 * Check your backend's /docs page for POST /employees/form to confirm.
 * The "/form" path and the input: null 422 error suggest form data.
 */
const SEND_AS_FORM = true;

/** Convert a plain object (or existing FormData) into FormData. */
function toFormData(data) {
  if (data instanceof FormData) return data;

  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });
  return formData;
}

/** Convert FormData (or a plain object) into a plain object. */
function toPlainObject(data) {
  return data instanceof FormData ? Object.fromEntries(data.entries()) : { ...data };
}

/**
 * POST: Hire an employee
 * Endpoint: /employees/form
 */
export async function createEmployee(employeeData) {
  const plain = toPlainObject(employeeData ?? {});

  // Accept camelCase aliases, but always send the backend's snake_case names.
  const payload = {
    ...plain,
    first_name: plain.first_name ?? plain.firstName,
    work_email: plain.work_email ?? plain.workEmail,
    password: plain.password,
  };

  // An empty company_id must be omitted entirely (not sent as ""), so the
  // backend registers an organization-level employee instead of looking up
  // a company that doesn't exist.
  if (!String(payload.company_id ?? "").trim()) {
    delete payload.company_id;
  }

  const requiredFields = ["first_name", "work_email", "password"];
  const missingFields = requiredFields.filter(
    (field) => !String(payload[field] ?? "").trim(),
  );
  if (missingFields.length) {
    throw new Error(
      `Missing required employee fields: ${missingFields.join(", ")}`,
    );
  }

  // No Content-Type header here: axios/browser set it correctly
  // (multipart boundary for FormData, application/json for objects).
  const body = SEND_AS_FORM ? toFormData(payload) : payload;

  const response = await SuperAdmin_axios.post("/employees/form", body);
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