import { ORGS_SEED } from "@/features/organization/data/group-data";
import {
  Users,
  Calendar,
  Clock,
  DollarSign,
  GraduationCap,
  Target,
  FileText,
  Briefcase,
  TrendingUp,
  Award,
  Heart,
  Plane,
  Building,
  Shield,
  MessageSquare,
  CreditCard,
  Sparkles,
  Zap,
  Mail,
  Phone,
  Video,
  BarChart3,
  Database,
  Globe,
  Bot,
} from "lucide-react";

/**
 * @typedef {Object} ModuleDef
 * @property {string} key
 * @property {string} name
 * @property {LucideIcon} icon
 * @property {string} description
 * @property {string[]} submodules
 * @property {string[]} permissions
 */

export const MODULES = [
  {
    key: "employee",
    name: "Employee Management",
    icon: Users,
    description: "Full employee lifecycle from onboarding to exit.",
    submodules: ["Directory", "Onboarding", "Profile", "Documents", "Offboarding", "Org Chart"],
    permissions: ["View", "Create", "Edit", "Delete", "Export", "Import"],
  },
  {
    key: "attendance",
    name: "Attendance",
    icon: Clock,
    description: "Track daily attendance, shifts and geo-fenced check-ins.",
    submodules: ["Check-in/out", "Shifts", "Roster", "Geo-fence", "Regularization", "Reports"],
    permissions: ["View Team", "View All", "Approve", "Configure"],
  },
  {
    key: "leave",
    name: "Leave Management",
    icon: Plane,
    description: "Leave policies, balances, approvals and holiday calendars.",
    submodules: [
      "Leave Types",
      "Balances",
      "Apply",
      "Approval Workflow",
      "Holiday Calendar",
      "Comp-off",
    ],
    permissions: ["View", "Apply", "Approve", "Configure Policy"],
  },
  {
    key: "payroll",
    name: "Payroll",
    icon: DollarSign,
    description: "Salary structures, payslips, tax and statutory compliance.",
    submodules: [
      "Salary Structure",
      "Payslips",
      "Tax Declaration",
      "PF/ESI",
      "Loans & Advances",
      "Reimbursements",
    ],
    permissions: ["View Own", "View All", "Process", "Approve", "Configure"],
  },
  {
    key: "performance",
    name: "Performance",
    icon: Target,
    description: "OKRs, goals, reviews and 360° feedback.",
    submodules: ["Goals & OKR", "Review Cycles", "360° Feedback", "1:1s", "Calibration", "PIP"],
    permissions: ["View", "Create", "Review", "Approve"],
  },
  {
    key: "recruitment",
    name: "Recruitment",
    icon: Briefcase,
    description: "Applicant tracking, careers portal and hiring pipeline.",
    submodules: [
      "Job Openings",
      "Candidate Pool",
      "Interviews",
      "Offers",
      "Careers Site",
      "Referrals",
    ],
    permissions: ["View", "Create Job", "Schedule", "Hire"],
  },
  {
    key: "learning",
    name: "Learning & Development",
    icon: GraduationCap,
    description: "Courses, certifications and skill tracking.",
    submodules: [
      "Courses",
      "Learning Paths",
      "Certifications",
      "Skill Matrix",
      "External Trainings",
    ],
    permissions: ["View", "Enroll", "Author", "Approve"],
  },
  {
    key: "engagement",
    name: "Employee Engagement",
    icon: Heart,
    description: "Surveys, pulse, rewards and recognition.",
    submodules: ["Surveys", "Pulse", "Rewards", "Recognition Wall", "Announcements"],
    permissions: ["View", "Publish", "Configure"],
  },
  {
    key: "expense",
    name: "Expense & Reimbursement",
    icon: CreditCard,
    description: "Expense claims, mileage and corporate cards.",
    submodules: ["Claims", "Mileage", "Cards", "Approval Workflow", "Policy"],
    permissions: ["Submit", "Approve", "Reimburse"],
  },
  {
    key: "tours",
    name: "Tours",
    icon: Plane,
    description:
      "Business tour requests with HOD → HR → Finance approval, outcome and proof of visit.",
    submodules: ["My Tours", "All Tours", "Approvals"],
    permissions: ["Request", "Approve", "View"],
  },
  {
    key: "assets",
    name: "Assets",
    icon: Database,
    description: "Asset register, issuance, requests, transfers and software licenses.",
    submodules: ["Asset Register", "Issuance", "Requests", "Transfers", "Licenses", "My Assets"],
    permissions: ["View", "Request", "Assign", "Transfer", "Manage"],
  },
  {
    key: "helpdesk",
    name: "Employee Helpdesk",
    icon: MessageSquare,
    description: "Internal HR tickets and SLA workflows.",
    submodules: ["Tickets", "Categories", "SLA", "Knowledge Base"],
    permissions: ["Raise", "Resolve", "Configure"],
  },
  {
    key: "documents",
    name: "Document Vault",
    icon: FileText,
    description: "Employee & company documents with e-sign.",
    submodules: ["My Docs", "Company Policies", "Templates", "E-sign", "Expiry Alerts"],
    permissions: ["View", "Upload", "Sign", "Manage"],
  },
  {
    key: "compliance",
    name: "Compliance",
    icon: Shield,
    description: "Labour, PF, ESI, PT, LWF and audit trails.",
    submodules: ["PF", "ESI", "PT", "LWF", "Labour Filings", "Audit Reports"],
    permissions: ["View", "File", "Configure"],
  },
  {
    key: "analytics",
    name: "People Analytics",
    icon: BarChart3,
    description: "Dashboards, attrition prediction and DEI insights.",
    submodules: ["Dashboards", "Attrition Model", "DEI", "Custom Reports"],
    permissions: ["View", "Create Report", "Export"],
  },
  {
    key: "exit",
    name: "Exit Management",
    icon: Award,
    description: "Resignations, clearances, F&F and exit interviews.",
    submodules: ["Resignation", "Clearance", "F&F Settlement", "Exit Interview", "Alumni"],
    permissions: ["View", "Process", "Approve"],
  },
];

/**
 * @typedef {Object} IntegrationDef
 * @property {string} key
 * @property {string} name
 * @property {| "Communication" | "Payments" | "Identity" | "Productivity" | "AI" | "Payroll" | "Storage" | "HRIS"} category
 * @property {LucideIcon} icon
 * @property {string} description
 * @property {boolean} [popular]
 */

export const INTEGRATIONS = [
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    category: "Communication",
    icon: MessageSquare,
    description: "Send OTPs, payslips and notifications on WhatsApp.",
    popular: true,
  },
  {
    key: "slack",
    name: "Slack",
    category: "Communication",
    icon: MessageSquare,
    description: "Post announcements and approvals to Slack channels.",
    popular: true,
  },
  {
    key: "teams",
    name: "Microsoft Teams",
    category: "Communication",
    icon: Video,
    description: "Sync meetings, notifications and directory.",
  },
  {
    key: "gmail",
    name: "Gmail",
    category: "Communication",
    icon: Mail,
    description: "Send transactional email through Gmail workspace.",
  },
  {
    key: "sms",
    name: "SMS Gateway",
    category: "Communication",
    icon: Phone,
    description: "Twilio / MSG91 SMS for OTPs and reminders.",
  },
  {
    key: "razorpay",
    name: "Razorpay",
    category: "Payments",
    icon: CreditCard,
    description: "Collect subscription and disbursement payments.",
    popular: true,
  },
  {
    key: "stripe",
    name: "Stripe",
    category: "Payments",
    icon: CreditCard,
    description: "Global card payments and payouts.",
  },
  {
    key: "paypal",
    name: "PayPal",
    category: "Payments",
    icon: CreditCard,
    description: "International payouts and reimbursements.",
  },
  {
    key: "google-oauth",
    name: "Google Workspace SSO",
    category: "Identity",
    icon: Shield,
    description: "Sign in with Google Workspace.",
    popular: true,
  },
  {
    key: "azure-ad",
    name: "Microsoft Entra ID",
    category: "Identity",
    icon: Shield,
    description: "Enterprise SSO with Azure AD / Entra.",
  },
  {
    key: "okta",
    name: "Okta",
    category: "Identity",
    icon: Shield,
    description: "SAML/SCIM SSO with Okta.",
  },
  {
    key: "gcal",
    name: "Google Calendar",
    category: "Productivity",
    icon: Calendar,
    description: "Sync leaves and interviews to Google Calendar.",
  },
  {
    key: "outlook",
    name: "Outlook Calendar",
    category: "Productivity",
    icon: Calendar,
    description: "Sync with Outlook / M365 calendar.",
  },
  {
    key: "zoom",
    name: "Zoom",
    category: "Productivity",
    icon: Video,
    description: "Auto-create Zoom meetings for interviews.",
  },
  {
    key: "gemini",
    name: "Google Gemini",
    category: "AI",
    icon: Sparkles,
    description: "Power the Seereon HRMS AI copilot with Gemini.",
    popular: true,
  },
  {
    key: "openai",
    name: "OpenAI",
    category: "AI",
    icon: Bot,
    description: "GPT models for smart search and drafting.",
  },
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "AI",
    icon: Bot,
    description: "Claude models for long-form policy drafting.",
  },
  {
    key: "zoho-payroll",
    name: "Zoho Payroll",
    category: "Payroll",
    icon: DollarSign,
    description: "Sync payroll runs with Zoho.",
  },
  {
    key: "quickbooks",
    name: "QuickBooks",
    category: "Payroll",
    icon: DollarSign,
    description: "Export journals to QuickBooks.",
  },
  {
    key: "s3",
    name: "AWS S3",
    category: "Storage",
    icon: Database,
    description: "Store documents and backups on S3.",
  },
  {
    key: "gdrive",
    name: "Google Drive",
    category: "Storage",
    icon: Database,
    description: "Sync employee documents with Drive.",
  },
  {
    key: "workday",
    name: "Workday",
    category: "HRIS",
    icon: Globe,
    description: "Two-way sync with Workday HRIS.",
  },
  {
    key: "sap",
    name: "SAP SuccessFactors",
    category: "HRIS",
    icon: Globe,
    description: "Sync employees and org data with SAP.",
  },
  {
    key: "zapier",
    name: "Zapier",
    category: "Productivity",
    icon: Zap,
    description: "Trigger 5000+ apps from Seereon HRMS events.",
  },
  {
    key: "biometric",
    name: "Biometric Devices",
    category: "Productivity",
    icon: Building,
    description: "Push logs from ZKTeco / Matrix devices.",
  },
  {
    key: "tally",
    name: "Tally Prime",
    category: "Payroll",
    icon: TrendingUp,
    description: "Export payroll journals to Tally.",
  },
];

/** Seeded organisations only — a static snapshot that does NOT include organisations onboarded at runtime.
 *  @deprecated Screens must use `useOrgs()` from group-data (audit-logs / notifications / support were switched). */
export const ORG_LIST = ORGS_SEED.map((o) => ({ code: o.id, name: o.name }));

/**
 * @typedef {Object} PlanFeature
 * @property {string} id
 * @property {string} label
 * @property {boolean} enabled
 */
/**
 * @typedef {Object} PlanDef
 * @property {string} key
 * @property {string} name
 * @property {string} tagline
 * @property {string} price
 * @property {string} period
 * @property {boolean} [featured]
 * @property {PlanFeature[]} features
 * @property {{ employees: string, storage: string, modules: string, support: string }} limits
 */

export const PLANS = [
  {
    key: "growth",
    name: "Growth",
    tagline: "For growing teams getting started.",
    price: "$99",
    period: "/month",
    limits: {
      employees: "Up to 100",
      storage: "10 GB",
      modules: "5 modules",
      support: "Email support",
    },
    features: [
      { id: "core", label: "Core HR & Employee Directory", enabled: true },
      { id: "att", label: "Attendance & Leave", enabled: true },
      { id: "pay", label: "Basic Payroll", enabled: true },
      { id: "perf", label: "Performance Reviews", enabled: false },
      { id: "ai", label: "AI Assistant", enabled: false },
      { id: "sso", label: "Enterprise SSO", enabled: false },
    ],
  },
  {
    key: "business",
    name: "Business",
    tagline: "For scaling companies that need more.",
    price: "$299",
    period: "/month",
    featured: true,
    limits: {
      employees: "Up to 500",
      storage: "50 GB",
      modules: "10 modules",
      support: "Priority support",
    },
    features: [
      { id: "core", label: "Core HR & Employee Directory", enabled: true },
      { id: "att", label: "Attendance & Leave", enabled: true },
      { id: "pay", label: "Advanced Payroll & Compliance", enabled: true },
      { id: "perf", label: "Performance & OKRs", enabled: true },
      { id: "rec", label: "Recruitment & ATS", enabled: true },
      { id: "ai", label: "AI Assistant (basic)", enabled: true },
      { id: "sso", label: "Enterprise SSO", enabled: false },
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    tagline: "For large enterprises with custom needs.",
    price: "Custom",
    period: "",
    limits: {
      employees: "Unlimited",
      storage: "Custom",
      modules: "All modules",
      support: "24×7 dedicated CSM",
    },
    features: [
      { id: "core", label: "Everything in Business", enabled: true },
      { id: "ai", label: "Full AI Copilot & Analytics", enabled: true },
      { id: "sso", label: "Enterprise SSO (SAML/SCIM)", enabled: true },
      { id: "audit", label: "Advanced Audit & Compliance", enabled: true },
      { id: "custom", label: "Custom integrations & workflows", enabled: true },
      { id: "sla", label: "99.99% uptime SLA", enabled: true },
    ],
  },
];
