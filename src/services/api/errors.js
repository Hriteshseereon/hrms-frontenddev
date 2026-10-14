/**
 * Error thrown by the API client. Normalises RFC 7807 problem responses
 * (`{ type, title, status, code, detail, errors: [{ field, message }] }`) and
 * Django REST Framework / FastAPI error bodies into one shape.
 */
export class ApiError extends Error {
  /**
   * @param {{ status: number, code?: string, title?: string, detail?: string, fieldErrors?: Record<string,string>, body?: unknown }} p
   */
  constructor({ status, code, title, detail, fieldErrors, body }) {
    super(detail || title || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code || String(status);
    this.title = title;
    this.detail = detail;
    /** field → message, for showing validation errors next to form inputs */
    this.fieldErrors = fieldErrors || {};
    this.body = body;
  }

  get isValidation() {
    return this.status === 422 || this.status === 400;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isConflict() {
    return this.status === 409 || this.status === 412;
  }
}

/** Build an ApiError from any backend error body. */
export function toApiError(status, body) {
  if (!body || typeof body !== "object")
    return new ApiError({ status, detail: typeof body === "string" ? body : undefined });
  const fieldErrors = {};
  // RFC 7807 — { errors: [{ field, message }] }
  if (Array.isArray(body.errors))
    for (const e of body.errors) if (e?.field) fieldErrors[e.field] = e.message;
  // FastAPI — { detail: [{ loc: ["body","pan"], msg }] }
  if (Array.isArray(body.detail))
    for (const e of body.detail) if (e?.loc) fieldErrors[e.loc[e.loc.length - 1]] = e.msg;
  // Django REST Framework — { pan: ["Enter a valid PAN."], non_field_errors: [...] }
  if (!body.type && !body.detail && !body.errors)
    for (const [k, v] of Object.entries(body)) if (Array.isArray(v)) fieldErrors[k] = String(v[0]);
  return new ApiError({
    status,
    code: body.code,
    title: body.title,
    detail:
      typeof body.detail === "string" ? body.detail : body.message || body.non_field_errors?.[0],
    fieldErrors,
    body,
  });
}
