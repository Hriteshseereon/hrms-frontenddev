// Master data configured by the Seereon Consulting & IT Services org admin.

/**
 * Master data configured by the Seereon Consulting & IT Services org admin.
 * @typedef {Object} MasterItem
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 */

export const DOCUMENT_MASTER = [
  {
    id: "DOC-01",
    name: "Aadhaar Card",
    description: "Government issued identity proof",
    required: true,
  },
  {
    id: "DOC-02",
    name: "PAN Card",
    description: "Mandatory for payroll and tax filing",
    required: true,
  },
  {
    id: "DOC-03",
    name: "Relieving Letter",
    description: "From the most recent employer",
    required: true,
  },
  {
    id: "DOC-04",
    name: "Degree Certificate",
    description: "Highest qualification proof",
    required: true,
  },
  {
    id: "DOC-05",
    name: "Passport",
    description: "Required for onsite client deputation",
    required: false,
  },
  {
    id: "DOC-06",
    name: "Client NDA Acknowledgement",
    description: "Signed before joining a Seereon client project",
    required: true,
  },
  {
    id: "DOC-07",
    name: "Background Verification Consent",
    description: "Consent for the Seereon BGV vendor check",
    required: true,
  },
  {
    id: "DOC-08",
    name: "Skill Certification",
    description: "Cloud, data or security certification proof",
    required: false,
  },
];

export const AWARD_MASTER = [
  {
    id: "AWD-01",
    name: "Seereon Star Performer",
    description: "Outstanding quarterly delivery contribution",
  },
  { id: "AWD-02", name: "Spot Award", description: "Immediate recognition by a delivery manager" },
  {
    id: "AWD-03",
    name: "Long Service Award",
    description: "Awarded on completion of 5 years at Seereon",
  },
  {
    id: "AWD-04",
    name: "Client Delight Award",
    description: "Nominated by a Seereon client sponsor",
  },
  {
    id: "AWD-05",
    name: "Innovation Champion",
    description: "Reusable accelerator or IP built for Seereon practices",
  },
];

export const TERMINATION_TYPE_MASTER = [
  { id: "TTY-01", name: "Voluntary", description: "Initiated by the employee" },
  { id: "TTY-02", name: "Performance", description: "Post PIP, sustained underperformance" },
  { id: "TTY-03", name: "Misconduct", description: "Breach of the code of conduct" },
  { id: "TTY-04", name: "Redundancy", description: "Role no longer required by the business" },
  {
    id: "TTY-05",
    name: "Project Closure",
    description: "Client engagement ended with no redeployment",
  },
  {
    id: "TTY-06",
    name: "Abandonment",
    description: "Absent without approval beyond the policy window",
  },
];

export const WARNING_TYPE_MASTER = [
  { id: "WTY-01", name: "Verbal Warning", description: "Informal, recorded by the manager" },
  { id: "WTY-02", name: "Written Warning", description: "Formal warning filed with HR" },
  { id: "WTY-03", name: "Final Warning", description: "Last step before termination" },
  {
    id: "WTY-04",
    name: "Client Escalation Notice",
    description: "Raised when a client formally escalates conduct or quality",
  },
];

export const COMPLAINT_TYPE_MASTER = [
  { id: "CTY-01", name: "Harassment", description: "Routed to the POSH committee" },
  { id: "CTY-02", name: "Workplace Safety", description: "Hazards, incidents and near misses" },
  {
    id: "CTY-03",
    name: "Payroll Dispute",
    description: "Salary, overtime or reimbursement issues",
  },
  {
    id: "CTY-04",
    name: "Data & Information Security",
    description: "Client data handling or confidentiality concerns",
  },
  {
    id: "CTY-05",
    name: "Discrimination",
    description: "Bias in staffing, appraisal or promotion decisions",
  },
];

/**
 * @typedef {"Allowance" | "Deduction" | "Earning" | "Statutory"} PayComponentKind
 */

/**
 * @typedef {Object} PayComponent
 * @property {string} id
 * @property {string} name
 * @property {string} code
 * @property {PayComponentKind} kind
 * @property {string} calculation
 * @property {string} value
 * @property {string} description
 * @property {boolean} showInEmployeeForm
 */

export const PAY_COMPONENTS = [
  {
    id: "PC-01",
    name: "Basic",
    code: "BASIC",
    kind: "Earning",
    calculation: "% of CTC",
    value: "40%",
    description: "Base salary component",
    showInEmployeeForm: true,
  },
  {
    id: "PC-02",
    name: "House Rent Allowance",
    code: "HRA",
    kind: "Allowance",
    calculation: "% of Basic",
    value: "40%",
    description: "Rent allowance, partly tax exempt",
    showInEmployeeForm: true,
  },
  {
    id: "PC-03",
    name: "Conveyance",
    code: "CNV",
    kind: "Allowance",
    calculation: "Flat",
    value: "₹\u00A01,600",
    description: "Monthly travel allowance",
    showInEmployeeForm: true,
  },
  {
    id: "PC-04",
    name: "Special Allowance",
    code: "SPL",
    kind: "Allowance",
    calculation: "Balancing",
    value: "Auto",
    description: "Balances the CTC structure",
    showInEmployeeForm: true,
  },
  {
    id: "PC-05",
    name: "Provident Fund",
    code: "PF",
    kind: "Statutory",
    calculation: "% of Basic",
    value: "12%",
    description: "Employee PF contribution",
    showInEmployeeForm: true,
  },
  {
    id: "PC-06",
    name: "Professional Tax",
    code: "PT",
    kind: "Deduction",
    calculation: "Flat",
    value: "₹\u00A0200",
    description: "State professional tax",
    showInEmployeeForm: true,
  },
  {
    id: "PC-07",
    name: "Health Insurance",
    code: "MEDINS",
    kind: "Deduction",
    calculation: "Flat",
    value: "₹\u00A0850",
    description: "Group medical premium share",
    showInEmployeeForm: false,
  },
];

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * @typedef {Object} IpRule
 * @property {string} id
 * @property {string} name
 * @property {string} address
 * @property {boolean} restricted
 */

export const IP_RULES = [
  { id: "IP-01", name: "Seereon Bhubaneswar HQ Wi-Fi", address: "103.21.244.10", restricted: true },
  { id: "IP-02", name: "Seereon Mumbai BKC Office", address: "49.205.12.88", restricted: true },
  { id: "IP-03", name: "Seereon Pune Delivery Centre", address: "115.99.140.22", restricted: true },
  { id: "IP-04", name: "Remote VPN Pool", address: "10.8.0.0/24", restricted: false },
];

/* ------------------------------------------------------------------ */
/* Geofencing — attendance may only be punched inside these fences     */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} GeofenceRule
 * @property {string} id
 * @property {string} name
 * @property {string} address
 * @property {string} latitude
 * @property {string} longitude
 * @property {number} radius - Allowed distance from the centre point, in metres.
 * @property {string} appliesTo
 * @property {boolean} enforced - Enforce the fence when marking attendance.
 * @property {boolean} allowOverrideWithReason - Allow a punch outside the fence, flagged for HR review.
 * @property {boolean} active
 */

export const GEOFENCE_RULES = [
  {
    id: "GEO-01",
    name: "Seereon Bhubaneswar HQ",
    address: "Khandagiri, Bhubaneswar 751003",
    latitude: "20.2528",
    longitude: "85.7791",
    radius: 150,
    appliesTo: "All Bhubaneswar employees",
    enforced: true,
    allowOverrideWithReason: false,
    active: true,
  },
  {
    id: "GEO-02",
    name: "Seereon Mumbai BKC",
    address: "One BKC, Bandra Kurla Complex, Mumbai 400051",
    latitude: "19.0662",
    longitude: "72.8685",
    radius: 120,
    appliesTo: "Mumbai — Sales & Consulting",
    enforced: true,
    allowOverrideWithReason: true,
    active: true,
  },
  {
    id: "GEO-03",
    name: "Seereon Pune Delivery Centre",
    address: "EON IT Park, Kharadi, Pune 411014",
    latitude: "18.5515",
    longitude: "73.9394",
    radius: 200,
    appliesTo: "Pune delivery teams",
    enforced: true,
    allowOverrideWithReason: true,
    active: true,
  },
  {
    id: "GEO-04",
    name: "Client Site — Chennai (Retail Programme)",
    address: "Tidel Park, Taramani, Chennai 600113",
    latitude: "12.9895",
    longitude: "80.2477",
    radius: 250,
    appliesTo: "Deputed consultants only",
    enforced: false,
    allowOverrideWithReason: true,
    active: true,
  },
  {
    id: "GEO-05",
    name: "Work From Home (India)",
    address: "Employee registered home address",
    latitude: "—",
    longitude: "—",
    radius: 0,
    appliesTo: "Approved hybrid employees",
    enforced: false,
    allowOverrideWithReason: true,
    active: true,
  },
];
