const clean = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const WORK_EMAIL_PREFIX_RE = /^@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

/** The company's work email domain ("@acme.co.in") when it is set and valid, else "". */
export function normalizeWorkEmailPrefix(prefix) {
  const v = String(prefix ?? "").trim().toLowerCase();
  return WORK_EMAIL_PREFIX_RE.test(v) ? v : "";
}

/**
 * Proposed work email.
 * - Company has a work email prefix (`domain`, e.g. "@testcase.co.in"): first-last@testcase.co.in.
 * - Otherwise (no company picked / prefix not set yet): the company Gmail login first.last.org@gmail.com
 *   (org = first word of the organisation name; Gmail rules: a-z, 0-9 and dots, 6–30 characters before the "@").
 * `attempt` > 0 appends 2, 3, … so a taken address can be retried with a slightly different one.
 */
export function generateWorkEmail({ first, last, org, domain, attempt = 0 }) {
  let f = clean(first);
  if (!f) return "";
  const companyDomain = normalizeWorkEmailPrefix(domain);
  if (companyDomain) {
    const suffix = attempt > 0 ? String(attempt + 1) : "";
    const local = [f, clean(last)].filter(Boolean).join("-").slice(0, 64 - suffix.length);
    return `${local}${suffix}${companyDomain}`;
  }
  let l = clean(last);
  let o = clean(String(org ?? "").trim().split(/\s+/)[0]);
  const suffix = attempt > 0 ? String(attempt + 1) : "";
  const max = 30 - suffix.length;
  const join = () => [f, l, o].filter(Boolean).join(".");
  while (join().length > max) {
    if (o.length > 3) o = o.slice(0, -1);
    else if (l.length > 1) l = l.slice(0, -1);
    else if (f.length > 1) f = f.slice(0, -1);
    else break;
  }
  let local = join();
  if (local.length < 6) local = `${local}.emp`.slice(0, max);
  return `${local}${suffix}@gmail.com`;
}

/** True when the backend rejected the create only because this work email is already registered. */
export function isDuplicateWorkEmail(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status !== 409 && status !== 422) return false;
  if (Array.isArray(detail)) {
    return detail.some(
      (d) =>
        (d.loc ?? []).includes("work_email") &&
        (status === 409 || /exist|taken|already|duplicate|registered/i.test(d.msg ?? "")),
    );
  }
  return status === 409 && /e-?mail/i.test(String(detail ?? ""));
}
