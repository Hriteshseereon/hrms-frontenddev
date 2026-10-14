// ---------------------------------------------------------------------------
// Asset Lifecycle Management — organisation-scoped, UI-only, persisted in the browser.
//
// One shared record set powers every view: the Org Admin register, the employee "My Assets" screen, request
// queues, transfers, returns and condition issues. Assets belong to a single Organization (never to the
// group), which matters for inter-company transfers: assets do NOT follow an employee automatically.
//
// Asset master (categories / types with default checklists) lives here too and is edited from Master Data →
// Assets. The register, issue form and return check all read from it.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";
import { ORGANIZATION, userById, allUsers, can } from "@/features/auth/data/auth-session";
import {
  buildChain,
  decideChain,
  chainStatus,
} from "@/features/administration/data/approval-chain";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { managerStore } from "@/features/organization/data/manager-data";

/**
 * @typedef {"Hardware" | "Software License" | "Access" | "Vehicle" | "Equipment" | "Furniture"} AssetKind
 */
/**
 * @typedef {"In Stock" | "Issued" | "Return Pending" | "Under Maintenance" | "Retired" | "Lost"} AssetStatus
 */
export const ASSET_KINDS = [
  "Hardware",
  "Software License",
  "Access",
  "Vehicle",
  "Equipment",
  "Furniture",
];
export const ASSET_CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Damaged", "Not working"];
/**
 * @typedef {(typeof ASSET_CONDITIONS)[number]} AssetCondition
 */

/* ------------------------------ Asset master ------------------------------ */
/**
 * @typedef {Object} AssetTypeMaster
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {AssetKind} kind
 * @property {string} description
 * @property {boolean} requiresSerial
 * @property {number} usefulLifeYears
 * @property {number} depreciationPct
 * @property {string} custodianDept
 * @property {string[]} checklist - Items verified on issue and again on return.
 * @property {string[]} accessories - Accessories normally issued with the asset.
 * @property {number} defaultReturnDays - Default return period in days (0 = until separation).
 * @property {boolean} active
 */

export const ASSET_MASTER_SEED = [
  {
    id: "ATM-01",
    code: "LT",
    name: "Laptop",
    kind: "Hardware",
    description: "Notebook computers issued to staff",
    requiresSerial: true,
    usefulLifeYears: 3,
    depreciationPct: 33.33,
    custodianDept: "IT & Systems",
    checklist: [
      "Powers on and boots",
      "Screen — no cracks / dead pixels",
      "Keyboard & trackpad working",
      "Ports (USB-C, HDMI) working",
      "Battery health ≥ 80%",
      "Body — no dents / scratches",
      "Asset tag sticker intact",
      "Company image / MDM enrolled",
    ],
    accessories: ["Charger / adapter", "Laptop bag", "Mouse"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-02",
    code: "DT",
    name: "Desktop",
    kind: "Hardware",
    description: "Desktop workstation with peripherals",
    requiresSerial: true,
    usefulLifeYears: 4,
    depreciationPct: 25,
    custodianDept: "IT & Systems",
    checklist: [
      "Powers on",
      "Monitor connected & working",
      "Keyboard & mouse working",
      "Cabinet intact",
      "Asset tag intact",
    ],
    accessories: ["Keyboard", "Mouse", "Power cable"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-03",
    code: "MN",
    name: "Monitor",
    kind: "Hardware",
    description: "External displays",
    requiresSerial: true,
    usefulLifeYears: 4,
    depreciationPct: 25,
    custodianDept: "IT & Systems",
    checklist: [
      "Display — no dead pixels / lines",
      "Stand & hinge intact",
      "Cables present",
      "Asset tag intact",
    ],
    accessories: ["Power cable", "HDMI / DP cable"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-04",
    code: "DK",
    name: "Docking Station",
    kind: "Hardware",
    description: "USB-C / Thunderbolt docks",
    requiresSerial: true,
    usefulLifeYears: 3,
    depreciationPct: 33.33,
    custodianDept: "IT & Systems",
    checklist: ["All ports working", "Power adapter present", "Body intact"],
    accessories: ["Power adapter", "USB-C cable"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-05",
    code: "MB",
    name: "Mobile Phone",
    kind: "Hardware",
    description: "Company handsets",
    requiresSerial: true,
    usefulLifeYears: 2,
    depreciationPct: 50,
    custodianDept: "IT & Systems",
    checklist: [
      "Screen — no cracks",
      "Charging port working",
      "Camera working",
      "SIM slot / eSIM active",
      "Factory reset done (on return)",
    ],
    accessories: ["Charger", "Case", "SIM card"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-06",
    code: "ID",
    name: "ID Card",
    kind: "Access",
    description: "Access ID / RFID cards",
    requiresSerial: true,
    usefulLifeYears: 3,
    depreciationPct: 0,
    custodianDept: "Administration",
    checklist: ["Card readable at reader", "Photo & print legible", "Lanyard present"],
    accessories: ["Lanyard", "Card holder"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-07",
    code: "SW-SAP",
    name: "SAP License",
    kind: "Software License",
    description: "SAP SuccessFactors / S/4 seats",
    requiresSerial: false,
    usefulLifeYears: 1,
    depreciationPct: 100,
    custodianDept: "IT & Systems",
    checklist: ["User de-provisioned (on return)", "Data ownership transferred"],
    accessories: [],
    defaultReturnDays: 365,
    active: true,
  },
  {
    id: "ATM-08",
    code: "SW-AWS",
    name: "AWS License",
    kind: "Software License",
    description: "AWS console / IAM seats",
    requiresSerial: false,
    usefulLifeYears: 1,
    depreciationPct: 100,
    custodianDept: "IT & Systems",
    checklist: ["IAM user disabled (on return)", "Access keys rotated"],
    accessories: [],
    defaultReturnDays: 365,
    active: true,
  },
  {
    id: "ATM-09",
    code: "SW-DES",
    name: "Design License",
    kind: "Software License",
    description: "Figma / Adobe seats",
    requiresSerial: false,
    usefulLifeYears: 1,
    depreciationPct: 100,
    custodianDept: "IT & Systems",
    checklist: ["Seat released (on return)", "Files transferred to team"],
    accessories: [],
    defaultReturnDays: 365,
    active: true,
  },
  {
    id: "ATM-10",
    code: "VH",
    name: "Vehicle",
    kind: "Vehicle",
    description: "Company cars and two-wheelers",
    requiresSerial: true,
    usefulLifeYears: 8,
    depreciationPct: 15,
    custodianDept: "Administration",
    checklist: [
      "Body — no dents / scratches",
      "Tyres & spare",
      "Documents (RC, insurance, PUC) in vehicle",
      "Fuel level noted",
      "Odometer reading noted",
      "Toolkit & jack present",
    ],
    accessories: ["Keys (2 sets)", "RC & insurance copy", "FASTag"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-11",
    code: "NW",
    name: "Network Equipment",
    kind: "Equipment",
    description: "Firewalls, switches, access points",
    requiresSerial: true,
    usefulLifeYears: 5,
    depreciationPct: 20,
    custodianDept: "IT & Systems",
    checklist: [
      "Powers on",
      "All ports / LEDs OK",
      "Config backed up (on return)",
      "Rack mounts present",
    ],
    accessories: ["Power cable", "Rack ears", "Console cable"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-12",
    code: "SK",
    name: "Safety Kit",
    kind: "Equipment",
    description: "PPE and site safety kits",
    requiresSerial: false,
    usefulLifeYears: 1,
    depreciationPct: 100,
    custodianDept: "Administration",
    checklist: ["Helmet intact", "Vest & shoes intact", "Kit complete"],
    accessories: ["Helmet", "Vest", "Safety shoes", "Gloves"],
    defaultReturnDays: 0,
    active: true,
  },
  {
    id: "ATM-13",
    code: "FR",
    name: "Furniture",
    kind: "Furniture",
    description: "Chairs, desks, WFH furniture",
    requiresSerial: false,
    usefulLifeYears: 7,
    depreciationPct: 10,
    custodianDept: "Administration",
    checklist: ["Structure intact", "No stains / tears", "All parts present"],
    accessories: [],
    defaultReturnDays: 0,
    active: true,
  },
];

export const assetMasterStore = createPersistentStore(
  "seereon.assets.master.v1",
  ASSET_MASTER_SEED,
);
export const useAssetMaster = () => assetMasterStore.use();
export const assetTypeByName = (name) => assetMasterStore.get().find((t) => t.name === name);
export function upsertAssetType(input) {
  if (input.id) {
    assetMasterStore.set((p) =>
      p.map((t) => (t.id === input.id ? { ...t, ...input, id: t.id } : t)),
    );
    return input.id;
  }
  // Next free number — a count-based id collides with a surviving type after one is deleted.
  const id = `ATM-${String(assetMasterStore.get().reduce((m, t) => Math.max(m, Number(t.id.replace(/^ATM-/, "")) || 0), 0) + 1).padStart(2, "0")}`;
  assetMasterStore.set((p) => [...p, { ...input, id }]);
  return id;
}
export const deleteAssetType = (id) => assetMasterStore.set((p) => p.filter((t) => t.id !== id));

/* ------------------------------ Records ------------------------------ */
/**
 * @typedef {Object} Asset
 * @property {string} id
 * @property {string} orgId
 * @property {string} tag
 * @property {string} name
 * @property {string} type
 * @property {AssetKind} kind
 * @property {string} serial
 * @property {string} purchaseDate
 * @property {string} vendor
 * @property {number} cost
 * @property {string} condition
 * @property {AssetStatus} status
 * @property {string} [licenseKey] - Software/licence assets only.
 * @property {number} [seats]
 * @property {string} [renewalDate]
 * @property {string | null} [holderId] - Current holder.
 * @property {string | null} [issuedOn]
 * @property {string} [notes]
 * @property {string} [model] - Detailed register (v5)
 * @property {string} [specifications]
 * @property {string} [invoiceNo]
 * @property {string} [warrantyTill]
 * @property {string} [location]
 * @property {string} [custodianDept]
 * @property {string[]} [accessories]
 * @property {number} [usefulLifeYears]
 * @property {string[]} [attachments]
 * @property {{ at: string, by: string, action: string }[]} [history]
 */

/**
 * @typedef {Object} ChecklistResult
 * @property {string} item
 * @property {boolean} ok
 * @property {string} [remark]
 */

/**
 * @typedef {Object} AssetIssuance
 * @property {string} id
 * @property {string} assetId
 * @property {string} employeeId
 * @property {string} issuedOn
 * @property {string} conditionOnIssue
 * @property {string | null} [returnedOn]
 * @property {string} [conditionOnReturn]
 * @property {number} [deduction]
 * @property {"Active" | "Returned" | "Transferred"} status
 * @property {string} [notes]
 * @property {string} [issuedBy] - Detailed issue (v5)
 * @property {string} [purpose]
 * @property {string | null} [expectedReturn]
 * @property {string} [location]
 * @property {boolean} [serialVerified]
 * @property {string[]} [accessoriesIssued]
 * @property {ChecklistResult[]} [checklistOnIssue]
 * @property {boolean} [employeeAck]
 * @property {string} [ackOn]
 * @property {"Not started" | "Requested" | "Checked" | "Approved" | "Issue raised"} [returnStatus] - Return (v5)
 * @property {string} [returnRequestedOn]
 * @property {string} [returnRequestedBy]
 * @property {string} [employeeReturnRemarks]
 * @property {ChecklistResult[]} [checklistOnReturn]
 * @property {string[]} [accessoriesReturned]
 * @property {string} [returnRemarks]
 * @property {string} [returnCheckedBy]
 * @property {string} [returnCheckedOn]
 * @property {"OK" | "Damaged" | "Not working" | "Missing accessories" | "Lost"} [returnOutcome]
 * @property {string} [returnApprovedBy]
 * @property {string} [returnApprovedOn]
 * @property {string | null} [issueId]
 */

export const ISSUE_CATEGORIES = [
  "Physical damage",
  "Not working / breakdown",
  "Performance degraded",
  "Missing accessories",
  "Lost / stolen",
  "Software / licence problem",
  "Other",
];
/**
 * @typedef {(typeof ISSUE_CATEGORIES)[number]} IssueCategory
 */
export const ISSUE_SEVERITIES = ["Low", "Medium", "High", "Critical"];
/**
 * @typedef {"Undetermined" | "Employee mishandling" | "Asset fault / breakdown"} IssueCause
 */
/**
 * @typedef {"Open" | "Under assessment" | "Manager review" | "Finance review" | "Repair / replacement" | "Resolved" | "Closed"} IssueStatus
 */
export const ISSUE_RESOLUTIONS = [
  "Repaired",
  "Replaced",
  "Written off",
  "Returned to stock",
  "Retired",
  "Recovered from employee",
];
export const RECOVERY_MODES = ["Salary deduction", "Direct payment", "Insurance claim", "Waived"];

/**
 * Condition issue — raised on a return check (damaged / not working) or by the employee from the portal.
 * @typedef {Object} AssetIssue
 * @property {string} id
 * @property {string} orgId
 * @property {string} assetId
 * @property {string | null} [issuanceId]
 * @property {string} employeeId
 * @property {string} raisedBy
 * @property {string} raisedById
 * @property {string} raisedOn
 * @property {"Return check" | "Employee report" | "Asset manager"} source
 * @property {IssueCategory} category
 * @property {(typeof ISSUE_SEVERITIES)[number]} severity
 * @property {string} description
 * @property {string} [whenNoticed]
 * @property {string[]} evidence
 * @property {IssueStatus} status
 * @property {IssueCause} cause - Assessment (asset manager)
 * @property {string} [causeDetails]
 * @property {string} [assessedBy]
 * @property {string} [assessedOn]
 * @property {number} [estimatedCost]
 * @property {string | null} [managerId] - Manager review (employee's reporting manager) — only when mishandling is suspected
 * @property {string} [managerRemarks]
 * @property {"Agree — employee at fault" | "Disagree — treat as asset fault" | "Partial responsibility"} [managerDecision]
 * @property {string} [managerDecidedOn]
 * @property {string} [financeRemarks] - Finance review — only when mishandling is confirmed
 * @property {"Recover full cost" | "Recover partially" | "Waive"} [financeDecision]
 * @property {number} [recoveryAmount]
 * @property {(typeof RECOVERY_MODES)[number]} [recoveryMode]
 * @property {string} [financeDecidedBy]
 * @property {string} [financeDecidedOn]
 * @property {(typeof ISSUE_RESOLUTIONS)[number]} [resolution] - Resolution
 * @property {string} [repairVendor]
 * @property {number} [repairCost]
 * @property {string} [resolvedBy]
 * @property {string} [resolvedOn]
 * @property {string} [resolutionNotes]
 * @property {{ at: string, by: string, action: string, note?: string }[]} history
 */

/**
 * @typedef {Object} AssetRequest
 * @property {string} id
 * @property {string} orgId
 * @property {string} employeeId
 * @property {string} employeeName
 * @property {string} assetType
 * @property {AssetKind} kind
 * @property {string} reason
 * @property {"Low" | "Normal" | "High" | "Critical"} urgency
 * @property {string} raisedOn
 * @property {ApprovalStep[]} chain
 * @property {"Pending" | "Approved" | "Rejected" | "Issued"} status
 * @property {string | null} [issuedAssetId]
 * @property {string} [neededBy]
 * @property {string} [purpose]
 * @property {string} [specifications]
 * @property {string} [project]
 * @property {string} [duration]
 */

/**
 * @typedef {Object} AssetTransfer
 * @property {string} id
 * @property {string} assetId
 * @property {string} fromId
 * @property {string} toId
 * @property {string} handoverDate
 * @property {string} condition
 * @property {boolean} fromAck
 * @property {boolean} toAck
 * @property {string} [notes]
 */

const ORG = ORGANIZATION.id;

export const ASSETS_SEED = [
  {
    id: "AST-001",
    orgId: ORG,
    tag: "SRN-LT-001",
    name: "MacBook Pro 14 M3",
    model: "MacBook Pro 14-inch (2023) · M3 Pro · 18 GB · 512 GB",
    type: "Laptop",
    kind: "Hardware",
    serial: "C02XK1TQ9GH1",
    purchaseDate: "2024-04-12",
    vendor: "Apple India",
    invoiceNo: "INV-APL-88231",
    warrantyTill: "2027-04-11",
    cost: 214000,
    condition: "Excellent",
    status: "Issued",
    holderId: "SRN-0006",
    issuedOn: "2024-04-20",
    location: "Bhubaneswar HQ",
    custodianDept: "IT & Systems",
    accessories: ["Charger / adapter", "Laptop bag"],
    usefulLifeYears: 3,
  },
  {
    id: "AST-002",
    orgId: ORG,
    tag: "SRN-LT-002",
    name: "Dell Latitude 5450",
    model: "Latitude 5450 · i7-1365U · 16 GB · 512 GB",
    type: "Laptop",
    kind: "Hardware",
    serial: "DL5450X7781",
    purchaseDate: "2023-11-02",
    vendor: "Dell Technologies",
    invoiceNo: "INV-DEL-20431",
    warrantyTill: "2026-11-01",
    cost: 96000,
    condition: "Good",
    status: "Issued",
    holderId: "SRN-0007",
    issuedOn: "2023-11-15",
    location: "Bhubaneswar HQ",
    custodianDept: "IT & Systems",
    accessories: ["Charger / adapter", "Laptop bag", "Mouse"],
    usefulLifeYears: 3,
  },
  {
    id: "AST-003",
    orgId: ORG,
    tag: "SRN-LT-003",
    name: "ThinkPad T14 Gen 4",
    model: "T14 Gen 4 · Ryzen 7 PRO · 16 GB · 1 TB",
    type: "Laptop",
    kind: "Hardware",
    serial: "LNV-T14-90233",
    purchaseDate: "2025-01-18",
    vendor: "Lenovo",
    invoiceNo: "INV-LNV-55102",
    warrantyTill: "2028-01-17",
    cost: 108500,
    condition: "Excellent",
    status: "In Stock",
    location: "Bhubaneswar HQ · IT store",
    custodianDept: "IT & Systems",
    accessories: ["Charger / adapter", "Laptop bag", "Mouse"],
    usefulLifeYears: 3,
  },
  {
    id: "AST-004",
    orgId: ORG,
    tag: "SRN-SW-101",
    name: "SAP SuccessFactors Seat",
    type: "SAP License",
    kind: "Software License",
    serial: "—",
    purchaseDate: "2025-04-01",
    vendor: "SAP India",
    cost: 42000,
    condition: "Active",
    status: "Issued",
    licenseKey: "SAP-SF-8841-XZ",
    seats: 25,
    renewalDate: "2026-03-31",
    holderId: "SRN-0004",
    issuedOn: "2025-04-05",
    custodianDept: "IT & Systems",
  },
  {
    id: "AST-005",
    orgId: ORG,
    tag: "SRN-SW-102",
    name: "AWS Console Seat (Prod)",
    type: "AWS License",
    kind: "Software License",
    serial: "—",
    purchaseDate: "2025-06-01",
    vendor: "Amazon Web Services",
    cost: 18000,
    condition: "Active",
    status: "Issued",
    licenseKey: "AWS-IAM-SRN-PROD-12",
    seats: 10,
    renewalDate: "2026-05-31",
    holderId: "SRN-0015",
    issuedOn: "2025-06-03",
    custodianDept: "IT & Systems",
  },
  {
    id: "AST-006",
    orgId: ORG,
    tag: "SRN-ID-220",
    name: "Access ID Card",
    type: "ID Card",
    kind: "Access",
    serial: "IDC-220",
    purchaseDate: "2022-03-21",
    vendor: "Matrix Security",
    cost: 450,
    condition: "Good",
    status: "Issued",
    holderId: "SRN-0006",
    issuedOn: "2022-03-21",
    custodianDept: "Administration",
    accessories: ["Lanyard"],
  },
  {
    id: "AST-007",
    orgId: ORG,
    tag: "SRN-VH-011",
    name: "Toyota Innova Crysta",
    model: "Innova Crysta 2.4 GX · 2022",
    type: "Vehicle",
    kind: "Vehicle",
    serial: "KA-01-MJ-4411",
    purchaseDate: "2022-08-09",
    vendor: "Toyota Fleet",
    invoiceNo: "INV-TYT-0091",
    warrantyTill: "2025-08-08",
    cost: 2450000,
    condition: "Good",
    status: "Under Maintenance",
    location: "Bhubaneswar HQ · pool",
    custodianDept: "Administration",
    accessories: ["Keys (2 sets)", "RC & insurance copy", "FASTag"],
    usefulLifeYears: 8,
  },
  {
    id: "AST-008",
    orgId: ORG,
    tag: "SRN-EQ-045",
    name: "Network Firewall Appliance",
    model: "FortiGate 100F",
    type: "Network Equipment",
    kind: "Equipment",
    serial: "FG100F-0045",
    purchaseDate: "2024-09-14",
    vendor: "Fortinet (via Ingram)",
    invoiceNo: "INV-ING-77120",
    warrantyTill: "2027-09-13",
    cost: 780000,
    condition: "Excellent",
    status: "In Stock",
    location: "Bhubaneswar HQ · server room",
    custodianDept: "IT & Systems",
    accessories: ["Power cable", "Rack ears", "Console cable"],
    usefulLifeYears: 5,
  },
  {
    id: "AST-009",
    orgId: ORG,
    tag: "SRN-SW-103",
    name: "Figma Organization Seat",
    type: "Design License",
    kind: "Software License",
    serial: "—",
    purchaseDate: "2025-02-01",
    vendor: "Figma Inc.",
    cost: 9600,
    condition: "Active",
    status: "Issued",
    licenseKey: "FIG-ORG-7712",
    seats: 12,
    renewalDate: "2026-01-31",
    holderId: "SRN-0016",
    issuedOn: "2025-02-04",
    custodianDept: "IT & Systems",
  },
  {
    id: "AST-010",
    orgId: ORG,
    tag: "SRN-MN-014",
    name: '27" Monitor — LG UltraFine',
    model: "27UN880 · 4K · USB-C",
    type: "Monitor",
    kind: "Hardware",
    serial: "LG-UF-14002",
    purchaseDate: "2024-02-11",
    vendor: "LG Electronics",
    invoiceNo: "INV-LG-31007",
    warrantyTill: "2027-02-10",
    cost: 48000,
    condition: "Good",
    status: "Issued",
    holderId: "SRN-0005",
    issuedOn: "2024-02-14",
    location: "Bhubaneswar HQ",
    custodianDept: "IT & Systems",
    accessories: ["Power cable", "HDMI / DP cable"],
    usefulLifeYears: 4,
  },
  {
    id: "AST-011",
    orgId: ORG,
    tag: "SRN-MB-031",
    name: "iPhone 15",
    model: "iPhone 15 · 128 GB · Black",
    type: "Mobile Phone",
    kind: "Hardware",
    serial: "IMEI 35-889012-334455-1",
    purchaseDate: "2024-10-05",
    vendor: "Apple India",
    invoiceNo: "INV-APL-90112",
    warrantyTill: "2025-10-04",
    cost: 72000,
    condition: "Good",
    status: "Issued",
    holderId: "SRN-0005",
    issuedOn: "2024-10-08",
    location: "Bhubaneswar HQ",
    custodianDept: "IT & Systems",
    accessories: ["Charger", "Case", "SIM card"],
    usefulLifeYears: 2,
  },
  {
    id: "AST-012",
    orgId: ORG,
    tag: "SRN-LT-004",
    name: "HP EliteBook 840 G10",
    model: "EliteBook 840 G10 · i5-1335U · 16 GB · 512 GB",
    type: "Laptop",
    kind: "Hardware",
    serial: "HP840-G10-55821",
    purchaseDate: "2024-06-20",
    vendor: "HP India",
    invoiceNo: "INV-HP-41220",
    warrantyTill: "2027-06-19",
    cost: 88000,
    condition: "Good",
    status: "Issued",
    holderId: "SRN-0008",
    issuedOn: "2024-06-24",
    location: "Bhubaneswar HQ",
    custodianDept: "IT & Systems",
    accessories: ["Charger / adapter", "Laptop bag"],
    usefulLifeYears: 3,
  },
];

const seedChecklist = (type) =>
  (ASSET_MASTER_SEED.find((t) => t.name === type)?.checklist ?? []).map((item) => ({
    item,
    ok: true,
  }));

export const ISSUANCES_SEED = ASSETS_SEED.filter((a) => a.holderId).map((a, i) => ({
  id: `ISS-${String(i + 1).padStart(3, "0")}`,
  assetId: a.id,
  employeeId: a.holderId,
  issuedOn: a.issuedOn,
  conditionOnIssue: a.condition,
  status: "Active",
  issuedBy: "Seereon Administrator",
  purpose: a.kind === "Software License" ? "Role-based access" : "Regular work",
  expectedReturn: a.kind === "Software License" ? (a.renewalDate ?? null) : null,
  location: a.location,
  serialVerified: true,
  accessoriesIssued: a.accessories ?? [],
  checklistOnIssue: seedChecklist(a.type),
  employeeAck: true,
  ackOn: a.issuedOn,
  returnStatus: "Not started",
}));

// A return in progress + a condition issue under review, so the workflow screens are populated on first load.
ISSUANCES_SEED.push({
  id: "ISS-020",
  assetId: "AST-012",
  employeeId: "SRN-0008",
  issuedOn: "2024-06-24",
  conditionOnIssue: "Good",
  status: "Active",
  issuedBy: "Seereon Administrator",
  purpose: "Regular work",
  expectedReturn: null,
  location: "Bhubaneswar HQ",
  serialVerified: true,
  accessoriesIssued: ["Charger / adapter", "Laptop bag"],
  checklistOnIssue: seedChecklist("Laptop"),
  employeeAck: true,
  ackOn: "2024-06-24",
  returnStatus: "Requested",
  returnRequestedOn: "2026-09-15",
  returnRequestedBy: "Rakesh Menon",
  employeeReturnRemarks:
    "Moving to the new ThinkPad batch — returning the HP with charger and bag.",
});
// Remove the duplicate active issuance for AST-012 created by the map above (keep the detailed one).
const dupIdx = ISSUANCES_SEED.findIndex((i) => i.assetId === "AST-012" && i.id !== "ISS-020");
if (dupIdx >= 0) ISSUANCES_SEED.splice(dupIdx, 1);

export const ISSUES_SEED = [
  {
    id: "AIS-001",
    orgId: ORG,
    assetId: "AST-011",
    issuanceId: "ISS-008",
    employeeId: "SRN-0005",
    raisedBy: "Subh Sahoo",
    raisedById: "SRN-0005",
    raisedOn: "2026-09-10",
    source: "Employee report",
    category: "Physical damage",
    severity: "Medium",
    description:
      "Screen cracked at the bottom-left corner after the phone slipped from the desk. Touch works but the crack is spreading.",
    whenNoticed: "2026-09-09",
    evidence: ["iphone-crack-1.jpg"],
    status: "Manager review",
    cause: "Employee mishandling",
    causeDetails:
      "Drop damage — no manufacturing defect; screen replacement quoted at ₹\u00A018,500 by Apple authorised service.",
    assessedBy: "Seereon Administrator",
    assessedOn: "2026-09-11",
    estimatedCost: 18500,
    managerId: "SRN-0009",
    history: [
      { at: "2026-09-10", by: "Subh Sahoo", action: "Issue reported from the employee portal" },
      {
        at: "2026-09-11",
        by: "Seereon Administrator",
        action: "Assessed — cause: Employee mishandling",
        note: "Sent to the reporting manager for remarks",
      },
    ],
  },
  {
    id: "AIS-002",
    orgId: ORG,
    assetId: "AST-007",
    issuanceId: null,
    employeeId: "SRN-0003",
    raisedBy: "Seereon Administrator",
    raisedById: "SRN-ADMIN",
    raisedOn: "2026-08-28",
    source: "Asset manager",
    category: "Not working / breakdown",
    severity: "High",
    description:
      "Vehicle stalled on the Cuttack highway — battery and alternator failure reported by the driver.",
    whenNoticed: "2026-08-27",
    evidence: ["innova-breakdown-report.pdf"],
    status: "Repair / replacement",
    cause: "Asset fault / breakdown",
    causeDetails: "Alternator worn out — normal wear at 78,000 km; covered under fleet AMC.",
    assessedBy: "Seereon Administrator",
    assessedOn: "2026-08-29",
    estimatedCost: 24000,
    repairVendor: "Toyota Fleet Service — Bhubaneswar",
    repairCost: 24000,
    history: [
      {
        at: "2026-08-28",
        by: "Seereon Administrator",
        action: "Issue logged by the asset manager",
      },
      {
        at: "2026-08-29",
        by: "Seereon Administrator",
        action: "Assessed — cause: Asset fault / breakdown",
        note: "Sent for repair under AMC",
      },
    ],
  },
];

export const assetsStore = createPersistentStore("seereon.assets.v2", ASSETS_SEED);
export const issuanceStore = createPersistentStore("seereon.assets.issuances.v2", ISSUANCES_SEED);
export const transferStore = createPersistentStore("seereon.assets.transfers.v2", []);
export const issueStore = createPersistentStore("seereon.assets.issues.v1", ISSUES_SEED);

const seedRequest = (id, employeeId, assetType, kind, reason, urgency, raisedOn, extra = {}) => {
  const emp = userById(employeeId);
  return {
    id,
    orgId: emp?.orgId ?? ORG,
    employeeId,
    employeeName: emp?.name ?? employeeId,
    assetType,
    kind,
    reason,
    urgency,
    raisedOn,
    chain: buildChain(employeeId, ["HOD", "HRPartner", "Admin"]),
    status: "Pending",
    ...extra,
  };
};

export const requestStore = createPersistentStore("seereon.assets.requests.v2", [
  seedRequest(
    "REQ-001",
    "SRN-0007",
    "Docking Station",
    "Hardware",
    "Dual-monitor setup for QA automation runs.",
    "Normal",
    "2026-07-28",
    {
      neededBy: "2026-08-10",
      purpose: "Regular work",
      specifications: "USB-C dock with 2 × DP, 90 W PD",
    },
  ),
  seedRequest(
    "REQ-002",
    "SRN-0015",
    "AWS License",
    "Software License",
    "Additional production console seat for on-call rotation.",
    "High",
    "2026-08-03",
    {
      neededBy: "2026-08-08",
      purpose: "Role-based access",
      project: "NBB-CLM",
      duration: "12 months",
    },
  ),
]);

export const useAssets = () => assetsStore.use();
export const useIssuances = () => issuanceStore.use();
export const useAssetRequests = () => requestStore.use();
export const useAssetTransfers = () => transferStore.use();
export const useAssetIssues = () => issueStore.use();

// Local calendar date — toISOString() is UTC and records yesterday's date in IST before 05:30.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nextId = (prefix, n) => `${prefix}-${String(n + 1).padStart(3, "0")}`;
/** Next free number for stores that support deletion — a count-based id would reuse a surviving id after a delete. */
const nextFreeId = (prefix, ids) =>
  `${prefix}-${String(ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length + 1)) || 0), 0) + 1).padStart(3, "0")}`;
const nameOf = (id) => (id ? (userById(id)?.name ?? id) : "—");
/** Finance head of the asset's company (its CFO), else the company's administrator — never another organisation's CFO. */
const financeHeadOf = (orgId) =>
  allUsers().find((u) => u.role === "CFO" && u.orgId === orgId)?.id ??
  assetManagersOf(orgId)[0]?.id ??
  "SRN-0002";
/** Who looks after a company's assets: its Company Admins, else its Super Admin (single-company organisations). */
function assetManagersOf(orgId) {
  const users = allUsers().filter((u) => u.orgId === orgId);
  const admins = users.filter((u) => u.role === "Admin");
  return admins.length ? admins : users.filter((u) => u.role === "SuperAdmin");
}
// Reporting line: the live manager map (My Team re-assignments, new joiners) first, then the user record.
const managerOf = (empId) => managerStore.get()[empId] ?? userById(empId)?.managerId ?? null;

/* ----------------------------- register --------------------------- */

export function addAsset(input) {
  const id = nextFreeId(
    "AST",
    assetsStore.get().map((a) => a.id),
  );
  const { by, ...rest } = input;
  const row = {
    ...rest,
    id,
    status: "In Stock",
    holderId: null,
    history: [{ at: today(), by: by ?? "Asset manager", action: "Added to the register" }],
  };
  assetsStore.set((p) => [row, ...p]);
  return row;
}

export const updateAsset = (id, patch) =>
  assetsStore.set((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));

const logAsset = (id, by, action) =>
  assetsStore.set((p) =>
    p.map((a) =>
      a.id === id ? { ...a, history: [{ at: today(), by, action }, ...(a.history ?? [])] } : a,
    ),
  );

export const deleteAsset = (id) => {
  assetsStore.set((p) => p.filter((a) => a.id !== id));
  issuanceStore.set((p) => p.filter((i) => i.assetId !== id));
};

/* ----------------------------- issuance --------------------------- */

/**
 * @typedef {Object} IssueInput
 * @property {string} [purpose]
 * @property {string | null} [expectedReturn]
 * @property {string} [location]
 * @property {boolean} [serialVerified]
 * @property {string[]} [accessoriesIssued]
 * @property {ChecklistResult[]} [checklistOnIssue]
 * @property {string} [issuedBy]
 * @property {string} [notes]
 */

export function issueAsset(assetId, employeeId, conditionOnIssue, notes, detail = {}) {
  const asset = assetsStore.get().find((a) => a.id === assetId);
  // Only stock can be issued — issuing a held asset left two "Active" issuances and orphaned the first holder.
  if (
    !asset ||
    asset.status !== "In Stock" ||
    issuanceStore.get().some((i) => i.assetId === assetId && i.status === "Active")
  )
    return null;
  const iss = {
    id: nextFreeId(
      "ISS",
      issuanceStore.get().map((i) => i.id),
    ),
    assetId,
    employeeId,
    issuedOn: today(),
    conditionOnIssue,
    status: "Active",
    notes,
    issuedBy: detail.issuedBy ?? "Asset manager",
    purpose: detail.purpose ?? "Regular work",
    expectedReturn: detail.expectedReturn ?? null,
    location: detail.location ?? asset?.location,
    serialVerified: detail.serialVerified ?? false,
    accessoriesIssued: detail.accessoriesIssued ?? asset?.accessories ?? [],
    checklistOnIssue: detail.checklistOnIssue ?? [],
    employeeAck: false,
    returnStatus: "Not started",
  };
  issuanceStore.set((p) => [iss, ...p]);
  updateAsset(assetId, {
    status: "Issued",
    holderId: employeeId,
    issuedOn: iss.issuedOn,
    condition: conditionOnIssue,
    location: iss.location,
  });
  logAsset(assetId, iss.issuedBy, `Issued to ${nameOf(employeeId)} (${iss.id})`);
  pushAlert({
    empId: employeeId,
    kind: "general",
    to: "/emp/assets",
    title: `Asset issued — ${asset?.name ?? assetId}`,
    body: `${asset?.tag ?? ""} · ${iss.purpose}${iss.expectedReturn ? ` · return by ${iss.expectedReturn}` : ""}. Please acknowledge receipt on My Assets.`,
  });
  return iss;
}

export const acknowledgeIssuance = (issuanceId) => {
  const iss = issuanceStore.get().find((i) => i.id === issuanceId);
  issuanceStore.set((p) =>
    p.map((i) => (i.id === issuanceId ? { ...i, employeeAck: true, ackOn: today() } : i)),
  );
  // An issuance created by a transfer is the receiving side of that handover — acknowledging it on My Assets
  // (which is what the transfer alert asks for) also completes the receiver's acknowledgement on the transfer.
  if (iss?.issuedBy === "Transfer")
    transferStore.set((p) =>
      p.map((t) =>
        t.assetId === iss.assetId && t.toId === iss.employeeId && !t.toAck
          ? { ...t, toAck: true }
          : t,
      ),
    );
};

/** Employee (or admin on their behalf) starts a return — the asset goes to "Return Pending" until checked. */
export function requestReturn(issuanceId, by, remarks) {
  const iss = issuanceStore.get().find((i) => i.id === issuanceId);
  if (!iss || iss.status !== "Active") return { ok: false, message: "No active issuance" };
  if (iss.returnStatus === "Requested" || iss.returnStatus === "Issue raised")
    return { ok: false, message: "A return is already in progress for this asset" };
  issuanceStore.set((p) =>
    p.map((i) =>
      i.id === issuanceId
        ? {
            ...i,
            returnStatus: "Requested",
            returnRequestedOn: today(),
            returnRequestedBy: by.name,
            employeeReturnRemarks: remarks,
          }
        : i,
    ),
  );
  updateAsset(iss.assetId, { status: "Return Pending" });
  logAsset(iss.assetId, by.name, `Return requested by ${nameOf(iss.employeeId)}`);
  const asset = assetsStore.get().find((a) => a.id === iss.assetId);
  assetManagersOf(asset?.orgId ?? ORG).forEach((a) =>
    pushAlert({
      empId: a.id,
      kind: "general",
      to: "/org/assets",
      title: `Return to check — ${asset?.tag ?? iss.assetId}`,
      body: `${nameOf(iss.employeeId)} is returning ${asset?.name ?? "an asset"}${remarks ? ` — “${remarks.slice(0, 100)}”` : ""}. Run the return check.`,
    }),
  );
  return { ok: true, message: "Return requested — the asset manager will verify the asset" };
}

/**
 * @typedef {Object} ReturnCheckInput
 * @property {ChecklistResult[]} checklist
 * @property {string[]} accessoriesReturned
 * @property {string} condition
 * @property {NonNullable<AssetIssuance["returnOutcome"]>} outcome
 * @property {string} remarks
 * @property {string} checkedBy
 * @property {number} [deduction]
 */

/**
 * Record the physical check on return. Outcome OK → marked returned & back in stock.
 * Damaged / not working / lost → a condition issue is opened and the asset goes under maintenance.
 */
export function recordReturnCheck(issuanceId, input, checker, issueDetail) {
  const iss = issuanceStore.get().find((i) => i.id === issuanceId);
  if (!iss || iss.status !== "Active") return { ok: false, message: "No active issuance" };
  const asset = assetsStore.get().find((a) => a.id === iss.assetId);
  const base = {
    checklistOnReturn: input.checklist,
    accessoriesReturned: input.accessoriesReturned,
    conditionOnReturn: input.condition,
    returnRemarks: input.remarks,
    returnCheckedBy: checker.name,
    returnCheckedOn: today(),
    returnOutcome: input.outcome,
    deduction: input.deduction ?? 0,
  };
  if (input.outcome === "OK") {
    issuanceStore.set((p) =>
      p.map((i) =>
        i.id === issuanceId
          ? {
              ...i,
              ...base,
              status: "Returned",
              returnedOn: today(),
              returnStatus: "Approved",
              returnApprovedBy: checker.name,
              returnApprovedOn: today(),
            }
          : i,
      ),
    );
    updateAsset(iss.assetId, {
      status: "In Stock",
      holderId: null,
      issuedOn: null,
      condition: input.condition,
    });
    logAsset(
      iss.assetId,
      checker.name,
      `Returned by ${nameOf(iss.employeeId)} — checked OK, back in stock`,
    );
    pushAlert({
      empId: iss.employeeId,
      kind: "general",
      to: "/emp/assets",
      title: `Asset return approved — ${asset?.name ?? iss.assetId}`,
      body: `Checked by ${checker.name} on ${today()} · condition ${input.condition}. Nothing further needed.`,
    });
    return { ok: true, message: `${asset?.tag ?? iss.assetId} marked returned and back in stock` };
  }
  // Problem found → open a condition issue and keep the issuance open until the issue is resolved.
  const issueId = raiseAssetIssue(
    {
      assetId: iss.assetId,
      issuanceId,
      employeeId: iss.employeeId,
      source: "Return check",
      category:
        issueDetail?.category ??
        (input.outcome === "Not working"
          ? "Not working / breakdown"
          : input.outcome === "Lost"
            ? "Lost / stolen"
            : input.outcome === "Missing accessories"
              ? "Missing accessories"
              : "Physical damage"),
      severity: issueDetail?.severity ?? (input.outcome === "Lost" ? "Critical" : "High"),
      description:
        issueDetail?.description ?? `${input.outcome} on return check. ${input.remarks}`.trim(),
      evidence: issueDetail?.evidence ?? [],
      whenNoticed: today(),
    },
    checker,
  );
  issuanceStore.set((p) =>
    p.map((i) =>
      i.id === issuanceId ? { ...i, ...base, returnStatus: "Issue raised", issueId } : i,
    ),
  );
  updateAsset(iss.assetId, {
    status: input.outcome === "Lost" ? "Lost" : "Under Maintenance",
    condition: input.condition,
  });
  logAsset(iss.assetId, checker.name, `Return check: ${input.outcome} — issue ${issueId} opened`);
  return {
    ok: true,
    message: `Return check recorded — condition issue ${issueId} opened for tracking`,
    issueId,
  };
}

/** Simple return used by inter-company transfers (no physical check). */
export function returnAsset(assetId, conditionOnReturn, deduction = 0, retire = false) {
  issuanceStore.set((p) =>
    p.map((i) =>
      i.assetId === assetId && i.status === "Active"
        ? {
            ...i,
            status: "Returned",
            returnedOn: today(),
            conditionOnReturn,
            deduction,
            returnStatus: "Approved",
          }
        : i,
    ),
  );
  updateAsset(assetId, {
    status: retire ? "Retired" : "In Stock",
    holderId: null,
    issuedOn: null,
    condition: conditionOnReturn,
  });
}

export function retireAsset(assetId, note, by = "Asset manager") {
  issuanceStore.set((p) =>
    p.map((i) =>
      i.assetId === assetId && i.status === "Active"
        ? {
            ...i,
            status: "Returned",
            returnedOn: today(),
            conditionOnReturn: note,
            returnStatus: "Approved",
          }
        : i,
    ),
  );
  updateAsset(assetId, { status: "Retired", holderId: null, issuedOn: null, notes: note });
  logAsset(assetId, by, `Retired — ${note}`);
}

/* ----------------------------- condition issues ------------------- */

export function raiseAssetIssue(input, by) {
  const asset = assetsStore.get().find((a) => a.id === input.assetId);
  const id = nextId("AIS", issueStore.get().length);
  const row = {
    id,
    orgId: asset?.orgId ?? ORG,
    assetId: input.assetId,
    issuanceId: input.issuanceId ?? null,
    employeeId: input.employeeId,
    raisedBy: by.name,
    raisedById: by.id,
    raisedOn: today(),
    source: input.source,
    category: input.category,
    severity: input.severity,
    description: input.description,
    whenNoticed: input.whenNoticed,
    evidence: input.evidence ?? [],
    status: "Open",
    cause: "Undetermined",
    managerId: managerOf(input.employeeId),
    history: [
      {
        at: today(),
        by: by.name,
        action:
          input.source === "Employee report"
            ? "Issue reported from the employee portal"
            : input.source === "Return check"
              ? "Issue opened from the return check"
              : "Issue logged by the asset manager",
      },
    ],
  };
  issueStore.set((p) => [row, ...p]);
  if (input.source === "Employee report" && asset)
    updateAsset(asset.id, {
      status: asset.status === "Issued" ? "Under Maintenance" : asset.status,
    });
  // Notify the asset managers (Admin) and, for employee reports, confirm to the employee.
  const admins = assetManagersOf(asset?.orgId ?? ORG);
  admins.forEach((a) =>
    pushAlert({
      empId: a.id,
      kind: "general",
      to: "/org/assets",
      title: `Asset issue ${id} — ${asset?.name ?? input.assetId}`,
      body: `${input.category} · ${input.severity} · reported by ${by.name}.`,
    }),
  );
  if (input.source !== "Employee report")
    pushAlert({
      empId: input.employeeId,
      kind: "general",
      to: "/emp/assets",
      title: `Condition issue opened on ${asset?.name ?? input.assetId}`,
      body: `${input.category} — ${input.description.slice(0, 120)}. You can follow it on My Assets.`,
    });
  return id;
}

const logIssue = (id, by, action, note, patch = {}) =>
  issueStore.set((p) =>
    p.map((x) =>
      x.id === id
        ? { ...x, ...patch, history: [...x.history, { at: today(), by, action, note }] }
        : x,
    ),
  );

/** Asset manager assessment — decides the cause and routes the issue. */
export function assessAssetIssue(id, by, input) {
  const issue = issueStore.get().find((x) => x.id === id);
  if (!issue) return { ok: false, message: "Issue not found" };
  if (issue.status !== "Open" && issue.status !== "Under assessment")
    return { ok: false, message: `Issue is already at "${issue.status}" — assessment is closed` };
  if (input.estimatedCost !== undefined && input.estimatedCost < 0)
    return { ok: false, message: "Estimated cost cannot be negative" };
  const asset = assetsStore.get().find((a) => a.id === issue.assetId);
  if (input.cause === "Employee mishandling") {
    const managerId = issue.managerId ?? managerOf(issue.employeeId);
    logIssue(
      id,
      by.name,
      `Assessed — cause: ${input.cause}`,
      "Sent to the reporting manager for remarks",
      {
        cause: input.cause,
        causeDetails: input.causeDetails,
        estimatedCost: input.estimatedCost,
        severity: input.severity ?? issue.severity,
        assessedBy: by.name,
        assessedOn: today(),
        status: "Manager review",
        managerId,
      },
    );
    // Line managers cannot open /org/assets — the review queue lives on My Assets (every portal user has it).
    if (managerId)
      pushAlert({
        empId: managerId,
        kind: "general",
        to: "/emp/assets",
        title: `Asset issue ${id} needs your remarks`,
        body: `${asset?.name ?? issue.assetId} held by ${nameOf(issue.employeeId)} — assessed as employee mishandling (${input.causeDetails.slice(0, 100)}).`,
      });
    pushAlert({
      empId: issue.employeeId,
      kind: "general",
      to: "/emp/assets",
      title: `Asset issue ${id} — under manager review`,
      body: `The asset manager assessed the ${asset?.name ?? "asset"} issue as mishandling; your manager has been asked for remarks.`,
    });
    return { ok: true, message: "Assessment saved — sent to the reporting manager for remarks" };
  }
  if (input.cause === "Asset fault / breakdown") {
    logIssue(id, by.name, `Assessed — cause: ${input.cause}`, "Sent for repair / replacement", {
      cause: input.cause,
      causeDetails: input.causeDetails,
      estimatedCost: input.estimatedCost,
      severity: input.severity ?? issue.severity,
      assessedBy: by.name,
      assessedOn: today(),
      status: "Repair / replacement",
    });
    pushAlert({
      empId: issue.employeeId,
      kind: "general",
      to: "/emp/assets",
      title: `Asset issue ${id} — asset fault confirmed`,
      body: `No action needed from you. The ${asset?.name ?? "asset"} is being repaired / replaced.`,
    });
    return {
      ok: true,
      message: "Assessment saved — asset fault; repair / replacement in progress",
    };
  }
  logIssue(id, by.name, "Assessment started", input.causeDetails, {
    causeDetails: input.causeDetails,
    estimatedCost: input.estimatedCost,
    assessedBy: by.name,
    assessedOn: today(),
    status: "Under assessment",
  });
  return { ok: true, message: "Marked under assessment" };
}

/**
 * Who may give the manager remarks: the employee's reporting manager, or the HOD of the employee's own department in
 * the same company. Only when the employee has no reporting manager does an asset manager stand in. Never the
 * employee, and never the person who assessed the issue (one HR user used to assess, review and decide recovery).
 */
export function canManagerReviewIssue(issue, me) {
  if (!issue || !me || me.id === issue.employeeId || me.name === issue.assessedBy) return false;
  const emp = userById(issue.employeeId);
  if (me.id === issue.managerId) return true;
  if (me.role === "HOD" && emp && emp.dept === me.dept && emp.orgId === me.orgId) return true;
  return (
    !issue.managerId &&
    can(me.role, "asset.manage") &&
    (me.role === "SuperAdmin" || !emp || emp.orgId === me.orgId)
  );
}

/** Finance decision maker: not the employee, the assessor or the manager who reviewed it. */
export function canFinanceReviewIssue(issue, me) {
  if (!issue || !me) return false;
  return (
    me.id !== issue.employeeId &&
    me.name !== issue.assessedBy &&
    me.id !== issue.managerReviewedById &&
    (me.role === "SuperAdmin" || (issue.orgId ?? ORG) === (me.orgId ?? ORG))
  );
}

/** Reporting manager's remarks on a mishandling finding. */
export function managerReviewAssetIssue(id, by, input) {
  const issue = issueStore.get().find((x) => x.id === id);
  if (!issue || issue.status !== "Manager review")
    return { ok: false, message: "Issue is not awaiting manager review" };
  if (!canManagerReviewIssue(issue, by))
    return {
      ok: false,
      message: "Only the employee's manager (not the assessor) can give remarks",
    };
  const asset = assetsStore.get().find((a) => a.id === issue.assetId);
  if (input.decision === "Disagree — treat as asset fault") {
    logIssue(id, by.name, `Manager review: ${input.decision}`, input.remarks, {
      managerReviewedById: by.id,
      managerRemarks: input.remarks,
      managerDecision: input.decision,
      managerDecidedOn: today(),
      cause: "Asset fault / breakdown",
      status: "Repair / replacement",
    });
    pushAlert({
      empId: issue.employeeId,
      kind: "general",
      to: "/emp/assets",
      title: `Asset issue ${id} — manager cleared you`,
      body: `${by.name} reviewed the ${asset?.name ?? "asset"} issue and treated it as an asset fault. No recovery will be raised.`,
    });
    return { ok: true, message: "Recorded — treated as asset fault; no recovery" };
  }
  logIssue(
    id,
    by.name,
    `Manager review: ${input.decision}`,
    "Sent to Finance for recovery decision",
    {
      managerReviewedById: by.id,
      managerRemarks: input.remarks,
      managerDecision: input.decision,
      managerDecidedOn: today(),
      status: "Finance review",
    },
  );
  pushAlert({
    empId: financeHeadOf(asset?.orgId ?? ORG),
    kind: "general",
    to: "/emp/assets",
    title: `Asset issue ${id} — recovery decision needed`,
    body: `${asset?.name ?? issue.assetId} · ${nameOf(issue.employeeId)} · manager: ${input.decision}. Estimated cost ${issue.estimatedCost ? `₹\u00A0${issue.estimatedCost.toLocaleString("en-IN")}` : "—"}.`,
  });
  pushAlert({
    empId: issue.employeeId,
    kind: "general",
    to: "/emp/assets",
    title: `Asset issue ${id} — with Finance`,
    body: `Your manager recorded "${input.decision}". Finance will decide on recovery and inform you.`,
  });
  return { ok: true, message: "Manager remarks saved — sent to Finance" };
}

/** Finance decision on recovery when rough handling is confirmed. */
export function financeReviewAssetIssue(id, by, input) {
  const issue = issueStore.get().find((x) => x.id === id);
  if (!issue || issue.status !== "Finance review")
    return { ok: false, message: "Issue is not awaiting Finance" };
  if (!canFinanceReviewIssue(issue, by))
    return {
      ok: false,
      message: "The assessor or reviewing manager cannot also take the recovery decision",
    };
  if (input.decision !== "Waive" && !(input.recoveryAmount > 0))
    return { ok: false, message: "Enter the amount to recover (or choose Waive)" };
  if (input.recoveryAmount < 0) return { ok: false, message: "Recovery amount cannot be negative" };
  const asset = assetsStore.get().find((a) => a.id === issue.assetId);
  logIssue(
    id,
    by.name,
    `Finance decision: ${input.decision}`,
    `${input.recoveryMode} · ₹\u00A0${input.recoveryAmount.toLocaleString("en-IN")} — ${input.remarks}`,
    {
      financeDecision: input.decision,
      recoveryAmount: input.decision === "Waive" ? 0 : input.recoveryAmount,
      recoveryMode: input.decision === "Waive" ? "Waived" : input.recoveryMode,
      financeRemarks: input.remarks,
      financeDecidedBy: by.name,
      financeDecidedOn: today(),
      status: "Repair / replacement",
    },
  );
  pushAlert({
    empId: issue.employeeId,
    kind: "general",
    to: "/emp/assets",
    title: `Asset issue ${id} — Finance decision`,
    body:
      input.decision === "Waive"
        ? `Recovery waived for the ${asset?.name ?? "asset"} damage.`
        : `${input.decision}: ₹\u00A0${input.recoveryAmount.toLocaleString("en-IN")} via ${input.recoveryMode}. ${input.remarks}`,
  });
  return { ok: true, message: "Finance decision recorded" };
}

/** Close the loop — repaired / replaced / written off; asset goes back to stock or is retired. */
export function resolveAssetIssue(id, by, input) {
  const issue = issueStore.get().find((x) => x.id === id);
  if (!issue) return { ok: false, message: "Issue not found" };
  if (issue.status === "Resolved" || issue.status === "Closed")
    return { ok: false, message: `Issue already ${issue.status.toLowerCase()}` };
  // Resolution closes the loop only after assessment (and, on the mishandling path, manager + Finance) are done.
  if (issue.status !== "Repair / replacement")
    return {
      ok: false,
      message: `Issue is at "${issue.status}" — finish that step before resolving`,
    };
  const asset = assetsStore.get().find((a) => a.id === issue.assetId);
  logIssue(id, by.name, `Resolved — ${input.resolution}`, input.notes, {
    resolution: input.resolution,
    repairVendor: input.repairVendor,
    repairCost: input.repairCost,
    resolvedBy: by.name,
    resolvedOn: today(),
    resolutionNotes: input.notes,
    status: "Resolved",
  });
  const retire = input.resolution === "Written off" || input.resolution === "Retired";
  // Only an issue opened by the return check means the asset has physically come back. Employee / asset-manager
  // reports also carry the active issuance id (for traceability) but the employee still holds the asset, so those
  // follow the "take back into stock?" decision below instead of silently closing the issuance.
  if (issue.issuanceId && issue.source === "Return check") {
    // Return-check issue: the issuance is now closed.
    issuanceStore.set((p) =>
      p.map((i) =>
        i.id === issue.issuanceId
          ? {
              ...i,
              status: "Returned",
              returnedOn: i.returnedOn ?? today(),
              returnStatus: "Approved",
              returnApprovedBy: by.name,
              returnApprovedOn: today(),
              deduction: issue.recoveryAmount ?? i.deduction ?? 0,
            }
          : i,
      ),
    );
    updateAsset(issue.assetId, {
      status: retire ? "Retired" : "In Stock",
      holderId: null,
      issuedOn: null,
      condition: retire ? "Not working" : "Good",
    });
  } else if (asset?.holderId && input.returnToStock) {
    issuanceStore.set((p) =>
      p.map((i) =>
        i.assetId === issue.assetId && i.status === "Active"
          ? {
              ...i,
              status: "Returned",
              returnedOn: today(),
              conditionOnReturn: input.resolution,
              returnStatus: "Approved",
              deduction: issue.recoveryAmount ?? 0,
            }
          : i,
      ),
    );
    updateAsset(issue.assetId, {
      status: retire ? "Retired" : "In Stock",
      holderId: null,
      issuedOn: null,
      condition: retire ? "Not working" : "Good",
    });
  } else {
    updateAsset(issue.assetId, {
      status: retire ? "Retired" : asset?.holderId ? "Issued" : "In Stock",
      condition: retire ? "Not working" : "Good",
    });
  }
  logAsset(issue.assetId, by.name, `Issue ${id} resolved — ${input.resolution}`);
  pushAlert({
    empId: issue.employeeId,
    kind: "general",
    to: "/emp/assets",
    title: `Asset issue ${id} resolved`,
    body: `${input.resolution}${input.repairCost ? ` · cost ₹\u00A0${input.repairCost.toLocaleString("en-IN")}` : ""}. ${input.notes}`,
  });
  return { ok: true, message: `Issue resolved — ${input.resolution}` };
}

export const closeAssetIssue = (id, by) => {
  if (issueStore.get().find((x) => x.id === id)?.status !== "Resolved") return false;
  logIssue(id, by, "Closed", undefined, { status: "Closed" });
  return true;
};

export const ISSUE_FLOW = [
  "Open",
  "Under assessment",
  "Manager review",
  "Finance review",
  "Repair / replacement",
  "Resolved",
  "Closed",
];
/** Steps shown in the tracker for a given issue (manager / finance only when mishandling is in play). */
export function issueSteps(issue) {
  const mish =
    issue.cause === "Employee mishandling" ||
    issue.status === "Manager review" ||
    issue.status === "Finance review" ||
    !!issue.managerDecision;
  return mish
    ? [
        "Open",
        "Under assessment",
        "Manager review",
        "Finance review",
        "Repair / replacement",
        "Resolved",
      ]
    : ["Open", "Under assessment", "Repair / replacement", "Resolved"];
}
export function issueStepIndex(issue) {
  const steps = issueSteps(issue);
  const s = issue.status === "Closed" ? "Resolved" : issue.status;
  const i = steps.indexOf(s);
  return i < 0 ? 0 : i;
}

/* ----------------------------- transfers -------------------------- */

export function transferAsset(assetId, toId, condition, notes) {
  const asset = assetsStore.get().find((a) => a.id === assetId);
  // Only an asset in normal use can change hands (not while a return check or a condition issue is open).
  if (!asset || !asset.holderId || asset.status !== "Issued" || toId === asset.holderId)
    return null;
  const row = {
    id: nextId("TRF", transferStore.get().length),
    assetId,
    fromId: asset.holderId,
    toId,
    handoverDate: today(),
    condition,
    fromAck: false,
    toAck: false,
    notes,
  };
  transferStore.set((p) => [row, ...p]);
  issuanceStore.set((p) =>
    p.map((i) =>
      i.assetId === assetId && i.status === "Active"
        ? { ...i, status: "Transferred", returnedOn: today(), conditionOnReturn: condition }
        : i,
    ),
  );
  issuanceStore.set((p) => [
    {
      id: nextFreeId(
        "ISS",
        p.map((i) => i.id),
      ),
      assetId,
      employeeId: toId,
      issuedOn: today(),
      conditionOnIssue: condition,
      status: "Active",
      issuedBy: "Transfer",
      purpose: "Transferred from " + nameOf(asset.holderId),
      accessoriesIssued: asset.accessories ?? [],
      returnStatus: "Not started",
      employeeAck: false,
    },
    ...p,
  ]);
  updateAsset(assetId, { holderId: toId, issuedOn: today(), condition, status: "Issued" });
  pushAlert({
    empId: toId,
    kind: "general",
    to: "/emp/assets",
    title: `Asset transferred to you — ${asset.name}`,
    body: `${asset.tag} handed over by ${nameOf(row.fromId)}. Please acknowledge on My Assets.`,
  });
  return row;
}

export const acknowledgeTransfer = (id, side) =>
  transferStore.set((p) =>
    p.map((t) => (t.id === id ? { ...t, [side === "from" ? "fromAck" : "toAck"]: true } : t)),
  );

/* ----------------------------- requests --------------------------- */

export function submitAssetRequest(input) {
  const emp = userById(input.employeeId);
  const row = {
    id: nextId("REQ", requestStore.get().length),
    orgId: emp?.orgId ?? ORG,
    employeeId: input.employeeId,
    employeeName: emp?.name ?? input.employeeId,
    assetType: input.assetType,
    kind: input.kind,
    reason: input.reason,
    urgency: input.urgency,
    raisedOn: today(),
    chain: buildChain(input.employeeId, ["HOD", "HRPartner", "Admin"]),
    status: "Pending",
    neededBy: input.neededBy,
    purpose: input.purpose,
    specifications: input.specifications,
    project: input.project,
    duration: input.duration,
  };
  requestStore.set((p) => [row, ...p]);
  notifyNextApprover(row);
  return row;
}

/** Tell whoever holds the current pending step of the HOD → HR → Admin chain that it is their turn. */
function notifyNextApprover(r) {
  const step = r.chain.find((s) => s.status === "Pending");
  if (step?.approverId)
    pushAlert({
      empId: step.approverId,
      kind: "general",
      to: "/org/assets",
      title: `Asset request ${r.id} awaiting your approval`,
      body: `${r.employeeName} · ${r.assetType} · ${r.urgency} urgency${r.neededBy ? ` · needed by ${r.neededBy}` : ""}.`,
    });
}

export function decideAssetRequest(id, userId, decision, note) {
  const current = requestStore.get().find((x) => x.id === id);
  if (current?.status !== "Pending") return false;
  // Never self-approve: the requester cannot decide any step of their own request (an Admin / CEO / CHRO override
  // used to let them approve every step of a request they raised).
  if (!userId || current.employeeId === userId) return false;
  requestStore.set((p) =>
    p.map((r) => {
      if (r.id !== id) return r;
      const chain = decideChain(r.chain, userId, decision, note);
      const status = chainStatus(chain);
      return { ...r, chain, status: status === "Pending" ? "Pending" : status };
    }),
  );
  const r = requestStore.get().find((x) => x.id === id);
  if (r && r.status === "Pending") notifyNextApprover(r);
  if (r && r.status !== "Pending")
    pushAlert({
      empId: r.employeeId,
      kind: "general",
      to: "/emp/assets",
      title: `Asset request ${id} ${r.status.toLowerCase()}`,
      body: `${r.assetType} · ${r.status}${note ? ` — ${note}` : ""}.`,
    });
  // Fully approved → the asset managers fulfil it from stock.
  if (r && r.status === "Approved")
    assetManagersOf(r.orgId).forEach((a) =>
      pushAlert({
        empId: a.id,
        kind: "general",
        to: "/org/assets",
        title: `Asset request ${id} approved — issue from stock`,
        body: `${r.employeeName} · ${r.assetType}. Fulfil it from Asset Lifecycle → Requests.`,
      }),
    );
  return true;
}

/** Link an approved request to the asset that was issued through the detailed issue form. */
export const markRequestFulfilled = (requestId, assetId) =>
  requestStore.set((p) =>
    p.map((r) => (r.id === requestId ? { ...r, status: "Issued", issuedAssetId: assetId } : r)),
  );

/* ----------------------------- selectors -------------------------- */

export const assetsOfEmployee = (employeeId) =>
  assetsStore
    .get()
    .filter(
      (a) =>
        a.holderId === employeeId &&
        (a.status === "Issued" ||
          a.status === "Return Pending" ||
          a.status === "Under Maintenance"),
    );

export function useMyAssets(employeeId) {
  const assets = useAssets();
  return assets.filter(
    (a) =>
      a.holderId === employeeId &&
      (a.status === "Issued" || a.status === "Return Pending" || a.status === "Under Maintenance"),
  );
}

export function useMyAssetRequests(employeeId) {
  const requests = useAssetRequests();
  return requests.filter((r) => r.employeeId === employeeId);
}

export function useMyAssetIssues(employeeId) {
  const issues = useAssetIssues();
  return issues.filter((i) => i.employeeId === employeeId);
}

export const activeIssuanceOf = (assetId) =>
  issuanceStore.get().find((i) => i.assetId === assetId && i.status === "Active");

/** Type names from the master (kept for older call sites). */
export const ASSET_TYPES = ASSET_MASTER_SEED.map((t) => t.name);

/** Straight-line book value today. */
export function bookValue(a) {
  const life = a.usefulLifeYears ?? assetTypeByName(a.type)?.usefulLifeYears ?? 3;
  // Day granularity: a millisecond clock made the server-rendered and hydrated values differ by a rupee
  // (hydration mismatch in the register) whenever a rounding boundary fell between the two renders.
  const years =
    (new Date(`${today()}T00:00:00Z`).getTime() -
      new Date(`${a.purchaseDate}T00:00:00Z`).getTime()) /
    (365.25 * 86400000);
  return Math.max(0, Math.round(a.cost * (1 - Math.min(1, years / life))));
}

/** Cross-org rollup for the group-wide view (org.asset-rollup.tsx), not a Seereon SuperAdmin screen. */
export function assetRollup(orgIds) {
  const assets = assetsStore.get().filter((a) => orgIds.includes(a.orgId));
  const spend = assets.reduce((s, a) => s + a.cost, 0);
  const licenses = assets.filter((a) => a.kind === "Software License");
  const soon = licenses.filter((a) => {
    if (!a.renewalDate) return false;
    const days = (new Date(a.renewalDate).getTime() - Date.now()) / 86400000;
    return days < 240;
  });
  return {
    total: assets.length,
    issued: assets.filter((a) => a.status === "Issued").length,
    inStock: assets.filter((a) => a.status === "In Stock").length,
    spend,
    licenses: licenses.length,
    renewalsDue: soon.length,
    renewals: soon,
  };
}
