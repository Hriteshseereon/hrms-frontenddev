// Standard Form 12B (Income-tax Rules, 1962 — Rule 26A): statement of income
// from a previous employer, handed to the new employer on joining.
import { exportLetterPdf } from "@/lib/export-utils";

/**
 * @typedef {Object} Form12bEmployee
 * @property {string} id
 * @property {string} name
 * @property {string} [dept]
 * @property {string} [role]
 */

/**
 * Opens a print-ready, brand-headed Form 12B with the statutory row structure.
 * Amount cells are left blank for the employee to complete and sign.
 */
export function downloadForm12B(emp, fy) {
  const blank = "";
  return exportLetterPdf({
    title: "FORM NO. 12B",
    reference: `Rule 26A · ${fy} · ${emp.id}`,
    recipient: {
      name: emp.name,
      lines: [
        `Employee ID: ${emp.id}`,
        emp.role ? `Designation: ${emp.role}` : "",
        emp.dept ? `Department: ${emp.dept}` : "",
        `Financial year: ${fy}`,
      ].filter(Boolean),
    },
    bodyHtml: `
      <p><b>Form for furnishing details of income under section 192(2) for the year ending 31st March, of previous employment.</b></p>
      <p>1. Name and address of the employee: <b>${emp.name}</b> (${emp.id})</p>
      <p>2. Permanent Account Number (PAN) of the employee: ____________________</p>
      <p>3. Name and address of the previous employer: ______________________________________________</p>
      <p>4. Permanent Account Number / TAN of the previous employer: ____________________</p>
      <p>5. Period of employment with the previous employer: From ____________ To ____________</p>
      <p>6. Details of salary drawn, deductions claimed and tax deducted by the previous employer:</p>
    `,
    table: {
      columns: ["S. No.", "Particulars", "Amount (₹)"],
      rows: [
        ["1", "Total salary excluding amounts at S. No. 7, 8 and 9 below", blank],
        ["2", "Value of perquisites (as per Form 12BA, where applicable)", blank],
        ["3", "Amount of accretion in employer's Provident Fund contribution", blank],
        ["4", "Total of columns 1, 2 and 3", blank],
        ["5", "Standard deduction claimed under section 16(ia)", blank],
        [
          "6",
          "Total amount of exemption claimed under section 10 (allowances exempt under the new regime)",
          blank,
        ],
        ["7", "Gratuity received", blank],
        ["8", "Compensation on retrenchment / voluntary retirement", blank],
        ["9", "Commuted value of pension", blank],
        ["10", "Deduction u/s 80CCD(2) — employer NPS contribution (new regime)", blank],
        ["11", "Employee's Provident Fund contribution (Recognised PF) — for information", blank],
        [
          "12",
          "Professional tax paid — for information (not deductible under the new regime)",
          blank,
        ],
        ["13", "Total income-tax deducted at source (TDS)", blank],
        ["14", "Total tax deposited and challan / BIN particulars", blank],
      ],
    },
    signatory: { name: emp.name, designation: "Employee declaration" },
    note: "Verification: I declare that the particulars given above are true and complete to the best of my knowledge and belief. Attach the previous employer's Form 16 / salary certificate along with this form.",
  });
}
