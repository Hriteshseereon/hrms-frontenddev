// Finance & Accounts: shared masters (departments, bank accounts, pay frequencies) and the payslip layout config.
// Payroll runs, payslips and loans live in payroll-engine.ts / loans-data.ts.

export const DEPARTMENT_NAMES = [
  "Engineering",
  "Sales",
  "Human Resources",
  "Finance",
  "Operations",
  "Marketing",
];

export const BANK_ACCOUNTS = [
  "HDFC Bank — Payroll ••4821",
  "ICICI Bank — Operations ••9034",
  "Axis Bank — Reimbursements ••1177",
];

/** The payroll engine computes monthly payslips only — other frequencies were offered but paid a full month. */
export const PAY_FREQUENCIES = ["Monthly"];

/**
 * @typedef {Object} PayslipConfig
 * @property {string} title
 * @property {string} brandName
 * @property {string} brandLogo
 * @property {{ key: string, label: string, enabled: boolean }[]} fields
 */

export const DEFAULT_PAYSLIP_CONFIG = {
  title: "Salary Slip",
  brandName: "Seereon Consulting & IT Services",
  brandLogo: "seereon-logo.png",
  fields: [
    { key: "ctc", label: "Annual CTC", enabled: true },
    { key: "basic", label: "Basic", enabled: true },
    { key: "hra", label: "HRA", enabled: true },
    { key: "allowances", label: "Other Allowances", enabled: true },
    { key: "pf", label: "Provident Fund", enabled: true },
    { key: "pt", label: "Professional Tax", enabled: true },
    { key: "tds", label: "TDS", enabled: false },
    { key: "loan", label: "Loan EMI", enabled: true },
    { key: "net", label: "Net Pay", enabled: true },
  ],
};

export const inr = (n) => `₹\u00A0${n.toLocaleString("en-IN")}`;
