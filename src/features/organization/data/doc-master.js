// -----------------------------------------------------------------------------
// Document Master (UI-only): every letter, form, handbook and URL-form the
// HRMS emits is a template under a document type. A template combines a
// design style (header, footer, watermark, colours, fonts) with a body that
// uses {{tokens}}. Several templates can exist per type (e.g. offer letters
// per grade / entity). Rendering produces a branded, print-ready PDF.
// -----------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import {
  archiveRecord,
  registerArchiveRestorer,
} from "@/features/administration/data/archive-data";
import { exportLetterPdf, fillTokens } from "@/lib/export-utils";

export const DOC_TYPES = [
  "Offer Letter",
  "Letter of Intent",
  "Appointment Letter",
  "Salary Annexure",
  "Confirmation Letter",
  "Increment Letter",
  "Promotion Letter",
  "Warning Letter",
  "Transfer Letter",
  "Termination Letter",
  "Experience Letter",
  "Relieving Letter",
  "Full & Final Statement",
  "Employee Handbook",
  "Assessment Form",
  "Exit Survey Form",
  "Loan / Advance Form",
  "Candidate URL Form",
  "Self-Appraisal Form",
  "Grievance Form",
  "Retention Discussion Form",
  "Payslip Note",
  "Internship Certificate",
];
/**
 * @typedef {(typeof DOC_TYPES)[number]} DocType
 */

/**
 * @typedef {Object} DesignStyle
 * @property {string} id
 * @property {string} name
 * @property {"Logo left" | "Logo centre" | "Letterhead band" | "Minimal"} headerStyle
 * @property {"Address + CIN" | "Page number only" | "Confidentiality note" | "None"} footerStyle
 * @property {"" | "CONFIDENTIAL" | "DRAFT" | "SEEREON" | "ORIGINAL"} watermark
 * @property {"Calibri" | "Inter" | "Georgia" | "Times New Roman"} font
 * @property {string} accent
 * @property {number} fontSize
 * @property {number} marginMm
 * @property {boolean} showSignatureBlock
 */

export const DEFAULT_STYLES = [
  {
    id: "STY-CORP",
    name: "Corporate letterhead",
    headerStyle: "Letterhead band",
    footerStyle: "Address + CIN",
    watermark: "",
    font: "Calibri",
    accent: "#0f766e",
    fontSize: 11,
    marginMm: 20,
    showSignatureBlock: true,
  },
  {
    id: "STY-CONF",
    name: "Confidential HR",
    headerStyle: "Logo left",
    footerStyle: "Confidentiality note",
    watermark: "CONFIDENTIAL",
    font: "Inter",
    accent: "#7c2d12",
    fontSize: 10.5,
    marginMm: 18,
    showSignatureBlock: true,
  },
  {
    id: "STY-FORM",
    name: "Form / template",
    headerStyle: "Logo centre",
    footerStyle: "Page number only",
    watermark: "",
    font: "Inter",
    accent: "#0f766e",
    fontSize: 10,
    marginMm: 15,
    showSignatureBlock: false,
  },
  {
    id: "STY-HB",
    name: "Handbook",
    headerStyle: "Minimal",
    footerStyle: "Page number only",
    watermark: "SEEREON",
    font: "Georgia",
    accent: "#b8860b",
    fontSize: 11,
    marginMm: 22,
    showSignatureBlock: false,
  },
];

/**
 * @typedef {Object} DocTemplateV2
 * @property {string} id
 * @property {DocType} docType
 * @property {string} name
 * @property {string} styleId
 * @property {"All entities" | string} entity
 * @property {string} subject
 * @property {string} body
 * @property {{ heading: string, body: string }[]} [sections]
 * @property {{ key: string, label: string, type: "text" | "date" | "number" | "select" | "file" | "rating" | "textarea", options?: string[], required: boolean }[]} [fields]
 * @property {string} signatory
 * @property {string} signatoryDesignation
 * @property {number} version
 * @property {boolean} active
 * @property {string} updatedOn
 * @property {string} updatedBy
 */

export const DOC_TOKENS = [
  "employee",
  "candidate",
  "employeeId",
  "position",
  "department",
  "grade",
  "branch",
  "entity",
  "ctc",
  "monthlyGross",
  "basic",
  "hra",
  "joiningDate",
  "expiryDate",
  "date",
  "reportingManager",
  "lastWorkingDay",
  "noticeDays",
  "amount",
  "emi",
  "tenure",
  "gratuity",
  "signatory",
  "signatoryDesignation",
];

const d = "2026-04-01";
export const DEFAULT_TEMPLATES = [
  {
    id: "TPL-OFFER-STD",
    docType: "Offer Letter",
    name: "Standard offer — all grades",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Offer of employment — {{position}}",
    body: "Dear {{candidate}},\n\nWe are pleased to offer you the position of {{position}} in the {{department}} department at {{entity}}, {{branch}}, at grade {{grade}}. Your annual cost to company will be ₹{{ctc}} as detailed in the enclosed Salary Annexure.\n\nYour tentative date of joining is {{joiningDate}}. This offer is valid until {{expiryDate}}; please accept it on the candidate portal and upload the listed documents.\n\nYou will be on probation for six months from your date of joining. Employment is governed by the Employee Handbook.\n\nWe look forward to welcoming you to Seereon.",
    signatory: "Farah Khan",
    signatoryDesignation: "Chief Human Resources Officer",
    version: 3,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-OFFER-MGR",
    docType: "Offer Letter",
    name: "Managerial offer (M1+) with variable pay",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Offer of employment — {{position}}",
    body: "Dear {{candidate}},\n\nWe are pleased to offer you the leadership position of {{position}} ({{department}}) at {{entity}}. Your annual CTC of ₹{{ctc}} includes a 10 % variable component payable on annual performance rating.\n\n{{joiningDate}} is the proposed joining date; the offer is valid until {{expiryDate}}.",
    signatory: "Santosh Nayak",
    signatoryDesignation: "Chief Executive Officer",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-INCR",
    docType: "Increment Letter",
    name: "Increment letter — appraisal outcome",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Revision of compensation — {{employee}}",
    body: "Dear {{employee}},\n\nFollowing the {{grade}} appraisal cycle and the approvals of your reporting manager, HR and the unit head, we are pleased to revise your annual cost to company from ₹{{previous_ctc}} to ₹{{ctc}} ({{hike}} % increase) with effect from {{effective_date}}. Your grade is {{grade}} (previously {{previous_grade}}). The revised salary structure is annexed.\n\nAll other terms of your employment remain unchanged. We thank you for your contribution and look forward to your continued success at Seereon.",
    signatory: "Farah Khan",
    signatoryDesignation: "Chief Human Resources Officer",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-PROMO",
    docType: "Promotion Letter",
    name: "Promotion letter — new grade & designation",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Promotion — {{employee}}",
    body: "Dear {{employee}},\n\nWe are delighted to inform you that, on the recommendation of your reporting manager and the approval of HR and the unit head, you are promoted to {{designation}} in {{department}}, grade {{grade}} (previously {{previous_grade}}), with effect from {{effective_date}}. Your annual cost to company is revised from ₹{{previous_ctc}} to ₹{{ctc}} ({{hike}} %). The revised structure is annexed.\n\nCongratulations on this well-deserved recognition.",
    signatory: "Santosh Nayak",
    signatoryDesignation: "Chief Executive Officer",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-WARN",
    docType: "Warning Letter",
    name: "Warning letter — disciplinary",
    styleId: "STY-CONF",
    entity: "All entities",
    subject: "{{severity}} warning — {{employee}}",
    body: 'Dear {{employee}},\n\nThis letter serves as a formal {{severity}} warning under the category "{{category}}" for the incident of {{incidentDate}}: {{description}}.\n\nThis conduct is in breach of the Code of Conduct set out in the Employee Handbook. You are expected to demonstrate immediate and sustained improvement; the improvement plan is: {{improvementPlan}}. Your progress will be reviewed on {{reviewDate}}. This warning remains on record for {{validityMonths}} months. Failure to improve may lead to further disciplinary action, up to and including termination.\n\nPlease acknowledge receipt of this letter on the employee portal within 3 working days.',
    signatory: "Farah Khan",
    signatoryDesignation: "Chief Human Resources Officer",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-TRANSFER",
    docType: "Transfer Letter",
    name: "Transfer letter — branch / department / entity",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Transfer — {{employee}}",
    body: "Dear {{employee}},\n\nWith reference to the {{transferType}} transfer approved by HR, you are transferred from {{from}} to {{to}} with effect from {{effective_date}}. You will report to {{reportingManager}} in your new role as {{designation}}.\n\nRelocation allowance of ₹{{relocationAllowance}} and joining travel as per policy are approved. Please complete the handover to {{handoverTo}} and return the assets listed in the transfer order before your last day at the current location.\n\nAll other terms of your employment remain unchanged.",
    signatory: "Varen Mishra",
    signatoryDesignation: "Head of Human Resources",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Varen Mishra",
  },
  {
    id: "TPL-TERM",
    docType: "Termination Letter",
    name: "Termination letter — for cause / redundancy",
    styleId: "STY-CONF",
    entity: "All entities",
    subject: "Termination of employment — {{employee}}",
    body: "Dear {{employee}},\n\nFurther to the show-cause notice, your written response and the disciplinary hearing held on {{hearingDate}}, the management has decided to terminate your employment with {{entity}} on grounds of {{terminationType}}: {{reason}}.\n\nYour last working day is {{lastWorkingDay}} ({{noticeMode}}). Your full and final settlement will be processed as per policy{{gratuityNote}}. Please return all company assets and complete the exit formalities on the employee portal. System access will be revoked at close of business on your last working day.\n\nThis decision has been reviewed by HR and the legal function and approved by the unit head.",
    signatory: "Farah Khan",
    signatoryDesignation: "Chief Human Resources Officer",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-LOI",
    docType: "Letter of Intent",
    name: "Letter of Intent — pre-offer",
    styleId: "STY-CONF",
    entity: "All entities",
    subject: "Letter of Intent — {{position}}",
    body: "Dear {{candidate}},\n\nFurther to your interviews, {{entity}} intends to offer you the role of {{position}} in {{department}} at an indicative annual CTC of ₹{{ctc}}, subject to background verification and document check. A formal offer letter will follow within 7 working days.",
    signatory: "Varen Mishra",
    signatoryDesignation: "Head of Human Resources",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Varen Mishra",
  },
  {
    id: "TPL-APPT",
    docType: "Appointment Letter",
    name: "Appointment letter — permanent",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Letter of Appointment",
    body: "Dear {{employee}},\n\nWith reference to your acceptance of our offer, we are pleased to appoint you as {{position}} ({{grade}}) in {{department}}, {{branch}}, with effect from {{joiningDate}}. Your employee ID is {{employeeId}} and you will report to {{reportingManager}}.\n\nYour remuneration is set out in Annexure A. Probation: six months. Notice period: {{noticeDays}} days after confirmation. Working hours, leave, conduct and other conditions are as per the Employee Handbook.",
    signatory: "Farah Khan",
    signatoryDesignation: "Chief Human Resources Officer",
    version: 2,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-ANNEX",
    docType: "Salary Annexure",
    name: "Annexure A — CTC break-up",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Annexure A — Compensation",
    body: "Annual CTC ₹{{ctc}} · Monthly gross ₹{{monthlyGross}} · Basic ₹{{basic}} · HRA ₹{{hra}}\n\nInclusions (paid monthly) and exclusions (employer contributions and benefits) are computed by the salary engine for grade {{grade}} and printed as a table below this note.",
    signatory: "Saras Venkatesh",
    signatoryDesignation: "Chief Financial Officer",
    version: 2,
    active: true,
    updatedOn: d,
    updatedBy: "Saras Venkatesh",
  },
  {
    id: "TPL-CONF",
    docType: "Confirmation Letter",
    name: "Probation confirmation",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Confirmation of employment",
    body: "Dear {{employee}},\n\nWe are pleased to confirm your services as {{position}} with effect from {{date}} on successful completion of probation.",
    signatory: "Varen Mishra",
    signatoryDesignation: "Head of Human Resources",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Varen Mishra",
  },
  {
    id: "TPL-REL",
    docType: "Relieving Letter",
    name: "Relieving letter",
    styleId: "STY-CORP",
    entity: "All entities",
    subject: "Relieving letter",
    body: "This is to certify that {{employee}} ({{employeeId}}), {{position}}, has been relieved from the services of {{entity}} with effect from close of business on {{lastWorkingDay}}. Full and final settlement has been completed.",
    signatory: "Varen Mishra",
    signatoryDesignation: "Head of Human Resources",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Varen Mishra",
  },
  {
    id: "TPL-FNF",
    docType: "Full & Final Statement",
    name: "F&F settlement statement",
    styleId: "STY-CONF",
    entity: "All entities",
    subject: "Full and Final Settlement — {{employee}}",
    body: "Settlement of dues for {{employee}} ({{employeeId}}) on separation effective {{lastWorkingDay}}. Earnings, deductions, gratuity ₹{{gratuity}} and recoveries are tabulated below.",
    signatory: "Saras Venkatesh",
    signatoryDesignation: "Chief Financial Officer",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Saras Venkatesh",
  },
  {
    id: "TPL-LOAN",
    docType: "Loan / Advance Form",
    name: "Salary advance / loan application",
    styleId: "STY-FORM",
    entity: "All entities",
    subject: "Loan / Advance Application",
    body: "Application for {{amount}} repayable over {{tenure}} month(s) at EMI ₹{{emi}}. Recovery from monthly salary and, on separation, from the full & final settlement.",
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        options: ["Salary advance (next month)", "Loan (≤ 3 × gross, ≤ 12 months)"],
        required: true,
      },
      { key: "amount", label: "Amount (₹)", type: "number", required: true },
      { key: "tenure", label: "Tenure (months)", type: "number", required: true },
      { key: "purpose", label: "Purpose", type: "textarea", required: true },
      {
        key: "guarantor",
        label: "Undertaking accepted",
        type: "select",
        options: ["Yes"],
        required: true,
      },
    ],
    signatory: "Saras Venkatesh",
    signatoryDesignation: "Chief Financial Officer",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Saras Venkatesh",
  },
  {
    id: "TPL-ASSESS",
    docType: "Assessment Form",
    name: "Candidate assessment scorecard",
    styleId: "STY-FORM",
    entity: "All entities",
    subject: "Candidate Assessment — {{candidate}}",
    body: "Score each parameter on the configured scale; the weighted total is computed by the system.",
    fields: [
      {
        key: "round",
        label: "Round",
        type: "select",
        options: ["HR Screening", "Technical 1", "Technical 2", "Managerial", "Final"],
        required: true,
      },
      {
        key: "params",
        label: "Parameters (from Assessment Parameter master)",
        type: "rating",
        required: true,
      },
      { key: "remarks", label: "Remarks", type: "textarea", required: false },
      {
        key: "recommendation",
        label: "Recommendation",
        type: "select",
        options: ["Strong hire", "Proceed", "Hold", "Reject"],
        required: true,
      },
    ],
    signatory: "",
    signatoryDesignation: "",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-EXITSURVEY",
    docType: "Exit Survey Form",
    name: "Exit interview & survey",
    styleId: "STY-CONF",
    entity: "All entities",
    subject: "Exit Survey — {{employee}}",
    body: "Confidential. Visible to the HR Head and the Unit / Department Head only.",
    fields: [
      {
        key: "reason",
        label: "Primary reason for leaving",
        type: "select",
        options: [
          "Better opportunity",
          "Compensation",
          "Career growth",
          "Work-life balance",
          "Relocation",
          "Manager / team",
          "Higher studies",
          "Personal",
          "Other",
        ],
        required: true,
      },
      { key: "manager", label: "Rate your reporting manager", type: "rating", required: true },
      { key: "culture", label: "Rate the work culture", type: "rating", required: true },
      { key: "growth", label: "Rate learning & growth", type: "rating", required: true },
      { key: "comp", label: "Rate compensation & benefits", type: "rating", required: true },
      {
        key: "rejoin",
        label: "Would you consider rejoining?",
        type: "select",
        options: ["Yes", "Maybe", "No"],
        required: true,
      },
      {
        key: "recommend",
        label: "Would you recommend Seereon as an employer?",
        type: "select",
        options: ["Yes", "Maybe", "No"],
        required: true,
      },
      {
        key: "feedback",
        label: "What could we have done differently?",
        type: "textarea",
        required: false,
      },
    ],
    signatory: "",
    signatoryDesignation: "",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-CANDURL",
    docType: "Candidate URL Form",
    name: "Candidate acceptance & document upload page",
    styleId: "STY-FORM",
    entity: "All entities",
    subject: "Accept your offer — {{candidate}}",
    body: "Page shown on the secure candidate link: offer summary, e-signature acceptance, mandatory document uploads (PAN, Aadhaar, photo, education, bank proof, address proof, Form 11) and optional documents.",
    fields: [
      { key: "signature", label: "Type full name to e-sign", type: "text", required: true },
      { key: "docs", label: "Document uploads", type: "file", required: true },
    ],
    signatory: "",
    signatoryDesignation: "",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-SELFAPP",
    docType: "Self-Appraisal Form",
    name: "Annual self-appraisal",
    styleId: "STY-FORM",
    entity: "All entities",
    subject: "Self-Appraisal — {{employee}}",
    body: "Justify your appraisal: value created, goals achieved, evidence attached. Rated on the evaluation parameters configured in Master Data.",
    fields: [
      {
        key: "achievements",
        label: "Key achievements & value created (with numbers)",
        type: "textarea",
        required: true,
      },
      { key: "goals", label: "Goal-wise outcome vs target", type: "textarea", required: true },
      {
        key: "params",
        label: "Self-rating on evaluation parameters",
        type: "rating",
        required: true,
      },
      { key: "evidence", label: "Supporting documents", type: "file", required: false },
      {
        key: "ask",
        label: "Why do you merit an appraisal / promotion?",
        type: "textarea",
        required: true,
      },
      {
        key: "development",
        label: "Development needs for next year",
        type: "textarea",
        required: false,
      },
    ],
    signatory: "",
    signatoryDesignation: "",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-GRIEV",
    docType: "Grievance Form",
    name: "Grievance submission",
    styleId: "STY-CONF",
    entity: "All entities",
    subject: "Grievance — {{employee}}",
    body: "Confidential submission routed to the Grievance Redressal Committee.",
    fields: [
      {
        key: "category",
        label: "Category",
        type: "select",
        options: [
          "Harassment / POSH",
          "Discrimination",
          "Compensation",
          "Working conditions",
          "Manager conduct",
          "Policy violation",
          "Other",
        ],
        required: true,
      },
      { key: "details", label: "Details", type: "textarea", required: true },
      { key: "evidence", label: "Evidence", type: "file", required: false },
      {
        key: "anonymous",
        label: "Submit anonymously",
        type: "select",
        options: ["No", "Yes"],
        required: true,
      },
    ],
    signatory: "",
    signatoryDesignation: "",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-RETAIN",
    docType: "Retention Discussion Form",
    name: "Retention discussion record",
    styleId: "STY-CONF",
    entity: "All entities",
    subject: "Retention discussion — {{employee}}",
    body: "Record of the retention conversation after resignation.",
    fields: [
      { key: "reason", label: "Stated reason for resignation", type: "textarea", required: true },
      {
        key: "offer",
        label: "Retention offer (role / pay / project / location)",
        type: "textarea",
        required: true,
      },
      {
        key: "outcome",
        label: "Outcome",
        type: "select",
        options: ["Retained", "Not retained", "Follow-up"],
        required: true,
      },
    ],
    signatory: "",
    signatoryDesignation: "",
    version: 1,
    active: true,
    updatedOn: d,
    updatedBy: "Farah Khan",
  },
  {
    id: "TPL-HANDBOOK",
    docType: "Employee Handbook",
    name: "Seereon Employee Handbook v1.0 (Sep 2026)",
    styleId: "STY-HB",
    entity: "All entities",
    subject: "Employee Handbook",
    body: "This handbook sets out the policies that govern employment at Seereon Consulting & IT Services Pvt. Ltd. and its group entities. It is issued with every appointment letter and acknowledged on joining.",
    sections: [
      {
        heading: "1. Working hours & attendance",
        body: "General shift 09:30–18:30 with 60 minutes lunch, Monday to Friday; 2nd and 4th Saturdays working for delivery teams as per project roster. Attendance is captured by biometric device, geofenced mobile punch or manual regularisation approved by the reporting manager within 7 days.",
      },
      {
        heading: "2. Probation & confirmation",
        body: "Six months from the date of joining, reviewed by the HOD with a confirm / extend / do-not-confirm decision. A reminder reaches the HOD 15 days before the end date.",
      },
      {
        heading: "3. Leave",
        body: "Casual 12, Sick 10, Earned 18 per year, credited pro-rata each quarter. Comp-off is credited automatically for approved work on off-days and must be availed within 7 days. Sick and casual leave may be clubbed with public holidays and earned leave. Unused earned leave is encashed at year end on gross. Leave taken beyond credit is recovered in the full & final settlement.",
      },
      {
        heading: "4. Compensation & payroll",
        body: "Salary is processed on the last working day of the month after attendance cut-off on the 25th and HR-head evaluation. Statutory deductions (PF, ESI, PT, TDS) follow the employee's statutory profile. Salary advances are for the next month only; loans are capped at three months' gross and recovered within twelve months.",
      },
      {
        heading: "5. Performance & appraisal",
        body: "Quarterly goal reviews with self and manager rating; annual appraisal in April with self-appraisal → HOD → HR calibration on the evaluation parameters (communication, technical, behaviour, attitude, aptitude, ownership).",
      },
      {
        heading: "6. Conduct, discipline & grievance",
        body: "Code of conduct, POSH policy and IT security policy apply to all. Grievances are raised through the Grievance Redressal system and answered within 15 working days; POSH matters go to the Internal Committee.",
      },
      {
        heading: "7. Separation",
        body: "Notice period 60 days (90 for managers). Shortfall may be recovered from the final settlement. Gratuity is payable after five years of group service at 15 days' basic per completed year and settled with the final settlement. Exit interview is mandatory.",
      },
    ],
    signatory: "Santosh Nayak",
    signatoryDesignation: "Chief Executive Officer",
    version: 1,
    active: true,
    updatedOn: "2026-09-01",
    updatedBy: "Farah Khan",
  },
];

export const styleStore = createPersistentStore("seereon.docmaster.styles", DEFAULT_STYLES);
export const templateStore = createPersistentStore(
  "seereon.docmaster.templates.v3",
  DEFAULT_TEMPLATES,
);
export const useDesignStyles = () => styleStore.use();
export const useDocTemplates = () => templateStore.use();
export const templateById = (id) => templateStore.get().find((t) => t.id === id) ?? null;
/** Active templates of a type. With `entity`, the company's own templates win over "All entities" ones. */
export const templatesOf = (docType, entity) => {
  const all = templateStore.get().filter((t) => t.docType === docType && t.active);
  if (!entity) return all;
  const own = all.filter((t) => t.entity === entity);
  return own.length ? own : all.filter((t) => !t.entity || t.entity === "All entities");
};

/* ------------------------- AI generation & import ------------------------- */

const AI_OPENINGS = {
  "Offer Letter": [
    "We are delighted to offer you the position of {position} with {entity}.",
    "Further to your interviews, {entity} is pleased to offer you the role of {position}.",
  ],
  "Appointment Letter": [
    "With reference to your acceptance of our offer, we confirm your appointment as {position} at {entity}, {branch}, effective {joiningDate}.",
  ],
  "Warning Letter": [
    "This letter serves as a formal warning regarding your conduct / performance, as discussed with you on {date}.",
  ],
  "Relieving Letter": [
    "This is to certify that {employee} ({employeeId}) was employed with {entity} and has been relieved of duties effective {lastWorkingDay}.",
  ],
};

/**
 * Drafts a full letter template for the document type — deterministic, token-rich text the admin edits before
 * saving. (On the API build this calls the AI service; the screen contract is identical.)
 */
export function aiDraftTemplate(docType, tone = "formal") {
  const opening = (AI_OPENINGS[docType] ?? [
    `This letter is issued by {entity} regarding your ${docType.toLowerCase()}.`,
  ])[0];
  const warm = tone === "warm";
  const body = [
    `Dear {${docType === "Offer Letter" ? "candidate" : "employee"}},`,
    "",
    opening,
    "",
    docType === "Offer Letter" || docType === "Appointment Letter"
      ? "Your annual CTC will be ₹{ctc} (monthly gross ₹{monthlyGross}; basic ₹{basic}, HRA ₹{hra}), payable as per company policy. You will report to {reportingManager} in the {department} department, grade {grade}, based at {branch}."
      : "Please treat this communication with the attention it requires and reach out to the HR department for any clarification.",
    "",
    warm
      ? "We are excited about what you will build with us and look forward to welcoming you to the team."
      : "This letter is issued on {date} and forms part of your employment record with {entity}.",
    "",
    "Sincerely,",
    "{signatory}",
    "{signatoryDesignation}",
  ].join("\n");
  return {
    subject: `${docType} — {${docType === "Offer Letter" ? "candidate" : "employee"}}`,
    body,
  };
}

/**
 * Parses an uploaded letter (TXT / HTML / PDF chosen by the admin) into a template draft: readable text is kept
 * and names, dates and amounts are replaced with tokens. A binary PDF without a text layer yields a clean stub.
 */
export function parseUploadedTemplate(raw, fileName = "") {
  let text = String(raw ?? "");
  // PDFs: keep only the readable runs; HTML: strip tags.
  if (/\.pdf$/i.test(fileName)) {
    const runs = text.match(/[\x20-\x7E\n]{12,}/g) ?? [];
    text = runs.join("\n");
  }
  text = text
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const usable = text.length > 40;
  const tokenised = usable
    ? text
        .replace(/\b\d{2}[/-]\d{2}[/-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g, "{date}")
        .replace(/₹\s?[\d,]+/g, "₹{amount}")
    : "";
  return {
    ok: usable,
    subject: usable
      ? (text
          .split("\n")
          .find((l) => l.trim().length > 4)
          ?.slice(0, 80) ?? "")
      : "",
    body: usable
      ? tokenised
      : "Dear {employee},\n\n[The uploaded file had no readable text layer — paste the letter text here, or use Generate with AI.]\n\nSincerely,\n{signatory}\n{signatoryDesignation}",
  };
}
export const saveStyle = (s) =>
  styleStore.set((l) =>
    l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? s : x)) : [...l, s],
  );
export const saveTemplate = (t, by) =>
  templateStore.set((l) => {
    const exists = l.some((x) => x.id === t.id);
    const row = {
      ...t,
      version: exists ? t.version + 1 : 1,
      updatedOn: new Date().toISOString().slice(0, 10),
      updatedBy: by,
    };
    return exists ? l.map((x) => (x.id === t.id ? row : x)) : [...l, row];
  });
/** Soft delete: the template moves to the System Archive and can be restored from there. */
export const removeTemplate = (id) => {
  const t = templateById(id);
  if (!t) return false;
  archiveRecord({
    module: "Document Master",
    recordId: t.id,
    title: `${t.docType} — ${t.name}`,
    summary: `v${t.version} · ${t.entity}`,
    payload: t,
  });
  templateStore.set((p) => p.filter((x) => x.id !== id));
  return true;
};
registerArchiveRestorer((rec) => {
  if (rec.module !== "Document Master" || !rec.payload?.docType) return false;
  templateStore.set((p) => [rec.payload, ...p.filter((x) => x.id !== rec.payload.id)]);
  return true;
});

export const cloneTemplate = (id, by) => {
  const t = templateById(id);
  if (!t) return null;
  const c = {
    ...t,
    id: `${t.id}-COPY-${Date.now().toString(36).toUpperCase()}`,
    name: `${t.name} (copy)`,
    version: 1,
    active: false,
    updatedOn: new Date().toISOString().slice(0, 10),
    updatedBy: by,
  };
  templateStore.set((l) => [...l, c]);
  return c;
};

/** Render a template with a design style into a print-ready document. */
const escHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
export function renderTemplate(t, rawValues, table) {
  // Token values (candidate / employee names, reasons typed by HR or applicants) are escaped before they are written
  // into the print window's HTML — a name such as <img onerror=…> used to execute in the app's origin.
  const values = Object.fromEntries(Object.entries(rawValues).map(([k, v]) => [k, escHtml(v)]));
  const style = styleStore.get().find((s) => s.id === t.styleId) ?? styleStore.get()[0];
  // The template text itself is escaped too (tokens survive — braces are not escaped), so markup typed into a
  // template body or section can never run in the print window.
  const body = fillTokens(escHtml(t.body), values)
    .split("\n")
    .map((p) => (p.trim() ? `<p>${p}</p>` : ""))
    .join("");
  const sections = (t.sections ?? [])
    .map(
      (s) =>
        `<h3 style="color:${escHtml(style.accent)};margin:14px 0 4px">${escHtml(s.heading)}</h3><p>${fillTokens(escHtml(s.body), values)}</p>`,
    )
    .join("");
  const wm = style.watermark
    ? `<div style="position:fixed;top:40%;left:15%;font-size:72px;color:${style.accent};opacity:.08;transform:rotate(-25deg);font-weight:800;letter-spacing:8px">${escHtml(style.watermark)}</div>`
    : "";
  const footer =
    style.footerStyle === "Confidentiality note"
      ? `<p style="font-size:9px;color:#94a3b8;margin-top:24px">CONFIDENTIAL — for the addressee only. ${escHtml(t.docType)} · v${escHtml(t.version)} · style ${escHtml(style.name)}</p>`
      : style.footerStyle === "Address + CIN"
        ? `<p style="font-size:9px;color:#94a3b8;margin-top:24px">Seereon Consulting &amp; IT Services Pvt. Ltd. · Khandagiri, Bhubaneswar 751003 · CIN U72900OR2019PTC031287 · ${t.docType} v${t.version}</p>`
        : "";
  return exportLetterPdf({
    // Title, recipient and signatory are escaped by exportLetterPdf itself — pass the raw values to avoid "&amp;".
    title: fillTokens(t.subject, rawValues),
    reference: `${t.id} · v${t.version} · ${rawValues.date ?? new Date().toISOString().slice(0, 10)}`,
    recipient:
      rawValues.employee || rawValues.candidate
        ? {
            name: rawValues.employee || rawValues.candidate,
            lines: [
              rawValues.employeeId ?? "",
              rawValues.position ?? "",
              rawValues.department ?? "",
            ].filter(Boolean),
          }
        : undefined,
    bodyHtml: `<div style="font-family:${style.font};font-size:${style.fontSize}pt">${wm}${body}${sections}${footer}</div>`,
    table,
    signatory:
      style.showSignatureBlock && t.signatory
        ? { name: fillTokens(t.signatory, rawValues), designation: t.signatoryDesignation }
        : undefined,
  });
}
