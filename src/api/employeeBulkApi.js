// Bulk employee import: POST /employees/bulk (up to 250 rows per call, sent one after another) and
// POST /employees/bulk/send-credentials. The company comes from the login (X-Company-Id for a Super Admin),
// never from a row.
import axios from "./SuperAdmin_axios";

export const BULK_CHUNK_SIZE = 250;

export const employeeBulkApi = {
  /** `{ batch_id, dry_run, on_duplicate, send_credentials, rows }` -> `{ total, created, skipped, failed, results, ... }` */
  importRows: (body) => axios.post("/employees/bulk", body, { timeout: 120000 }).then((res) => res.data),

  /** `{ batch_id }` -> `{ queued, already_queued, already_sent, no_personal_email, email_configured }` */
  sendCredentials: (batchId) =>
    axios.post("/employees/bulk/send-credentials", { batch_id: batchId }, { timeout: 60000 }).then((res) => res.data),
};
