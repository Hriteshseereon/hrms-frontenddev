// Payroll runs (server-side calculation + approval flow): /payroll/*. Every action returns the refreshed run.
import axios from "./SuperAdmin_axios";

const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== "all"),
  );
const run = (id) => `/payroll/runs/${encodeURIComponent(id)}`;
const unwrap = (res) => res.data;

/** Readable message from {"detail": "<message>"} or FastAPI's {"detail":[{"msg": "..."}]}. */
export function detailText(err, fallback = "Something went wrong.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return err?.message || fallback;
}

/** Fetch with the auth header and save the response as a file (a plain link would not send the token). */
export async function downloadFile(url, params, filename) {
  const res = await axios.get(url, { params: clean(params), responseType: "blob" });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export const payrollRunApi = {
  list: (params) => axios.get("/payroll/runs", { params: clean(params) }).then(unwrap),
  create: (body) => axios.post("/payroll/runs", clean(body)).then(unwrap),
  get: (id, params) => axios.get(run(id), { params: clean(params) }).then(unwrap),
  line: (id, employeeId) =>
    axios.get(`${run(id)}/lines/${encodeURIComponent(employeeId)}`).then(unwrap),
  /** List employees by payment status for a payroll month. */
  paymentRecords: (id, month, status) =>
    axios.get(`${run(id)}/payment-records`, { params: clean({ month, status }) }).then(unwrap),

  runChecks: (id) => axios.post(`${run(id)}/checks`).then(unwrap),
  resolveCheck: (id, checkId, body) =>
    axios.post(`${run(id)}/checks/${encodeURIComponent(checkId)}/resolve`, body).then(unwrap),
  escalateCheck: (id, checkId, body = {}) =>
    axios.post(`${run(id)}/checks/${encodeURIComponent(checkId)}/escalate`, body).then(unwrap),
  acknowledgeWarnings: (id) => axios.post(`${run(id)}/warnings/acknowledge`).then(unwrap),
  submit: (id) => axios.post(`${run(id)}/submit`).then(unwrap),
  decide: (id, decision, remarks = "") =>
    axios.post(`${run(id)}/approvals`, { decision, remarks }).then(unwrap),
  sendBack: (id, remark) => axios.post(`${run(id)}/send-back`, { remark }).then(unwrap),
  process: (id) => axios.post(`${run(id)}/process`).then(unwrap),
  pay: (id, reference) => axios.post(`${run(id)}/payment`, { reference }).then(unwrap),
  /** Upload a bank payment advice workbook; the server validates rows and marks the run paid on success. */
  uploadPaymentAdvice: (id, month, file) => {
    const form = new FormData();
    form.append("month", month);
    form.append("file", file);
    return axios.post(`${run(id)}/payment-upload`, form).then(unwrap);
  },
  publishPayslips: (id) =>
    axios.post(`${run(id)}/payslips/publish`, undefined, { responseType: "blob" }).then((response) => response.data),
  /** Download one generated payslip from its payroll run. */
  payslipPdf: (runId, employeeId) =>
    axios.get(`${run(runId)}/payslips/pdf`, {
      params: { employee_id: employeeId },
      responseType: "blob",
    }).then((response) => response.data),
  myPayslipMonths: (employeeId) =>
    axios.get("/me/payslips/months", { params: employeeId ? { employee_id: employeeId } : {} }).then(unwrap),
  downloadMyPayslip: (month, employeeId) =>
    downloadFile("/me/payslips/download", {
      month,
      ...(employeeId ? { employee_id: employeeId } : {}),
    }, `payslip-${month}.pdf`),
  reopen: (id) => axios.post(`${run(id)}/reopen`).then(unwrap),

  downloadRegister: async (id, period) => {
    const [year, month] = String(period ?? "").split("-");
    const monthName = month
      ? new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString("en-US", {
          month: "long",
          timeZone: "UTC",
        })
      : "Unknown-Month";
    const data = await payrollRunApi.get(id);
    const lines = data?.lines ?? [];
    const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Employee Code", "Employee Name", "Net", "Bank Account", "IFSC"],
      ...lines.map((line) => [
        line.employee_code,
        line.employee_name,
        line.net,
        line.bank?.account_no ?? line.bank?.account_number ?? line.bank?.accountNo,
        line.bank?.ifsc ?? line.bank?.ifsc_code ?? line.bank?.ifscCode,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`;
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `Payroll-${monthName}-${year || "unknown"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  },
  downloadPayslips: (id, period) =>
    downloadFile(`${run(id)}/payslips/export`, { format: "csv" }, `payslips-${period}.csv`),

  listAdjustments: (params) => axios.get("/payroll/adjustments", { params: clean(params) }).then(unwrap),
  addAdjustment: (body) => axios.post("/payroll/adjustments", clean(body)).then(unwrap),
  removeAdjustment: (id) => axios.delete(`/payroll/adjustments/${encodeURIComponent(id)}`).then(unwrap),

  getPolicy: () => axios.get("/payroll/policy").then(unwrap),
  updatePolicy: (body) => axios.put("/payroll/policy", body).then(unwrap),
  /** One-month estimate at full attendance, from the same calculation a run uses. Needs payroll.view. */
  salaryPreview: (body) => axios.post("/payroll/salary-preview", body).then(unwrap),
  getSalaryComponents: (employeeId) =>
    axios.get(`/payroll/employees/${encodeURIComponent(employeeId)}/salary-components`).then(unwrap),
  saveSalaryComponents: (employeeId, components) =>
    axios.put(`/payroll/employees/${encodeURIComponent(employeeId)}/salary-components`, components).then(unwrap),
};
