// Recruitment module data layer (mock / in-memory)

export const JOB_TYPES = ["Full Time", "Part Time", "Contract", "Internship"];
export const CANDIDATE_SOURCES = [
  "Referral",
  "LinkedIn",
  "Naukri",
  "Career Portal",
  "Walk-in",
  "Agency",
];
export const INTERVIEW_TYPES = ["Telephonic", "Video Call", "Face to Face", "Technical Test"];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const STATUSES = ["Active", "Inactive"];

export const PIPELINE_STAGES = [
  "Applied",
  "Shortlisted",
  "Interviewing",
  "Finalised",
  "Offered",
  "Onboarding",
];

/**
 * @typedef {(typeof PIPELINE_STAGES)[number]} PipelineStage
 */

/**
 * @typedef {Object} Candidate
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} jobType
 * @property {string} source
 * @property {string} position
 * @property {string} currentCompany
 * @property {string} experience
 * @property {string} currentCtc
 * @property {string} expectedCtc
 * @property {string} skills
 * @property {string} education
 * @property {PipelineStage} stage
 */

export const SEED_CANDIDATES = [
  {
    id: "CND-001",
    name: "Meera Raghavan",
    email: "meera.r@mail.com",
    phone: "+91 98450 11223",
    jobType: "Full Time",
    source: "LinkedIn",
    position: "Senior Engineer",
    currentCompany: "Zeta Labs",
    experience: "6 yrs",
    currentCtc: "₹\u00A018,00,000",
    expectedCtc: "₹\u00A024,00,000",
    skills: "React, Node, AWS",
    education: "B.Tech CSE, NIT Trichy",
    stage: "Interviewing",
  },
  {
    id: "CND-002",
    name: "Sahil Bhatia",
    email: "sahil.b@mail.com",
    phone: "+91 99201 88342",
    jobType: "Full Time",
    source: "Referral",
    position: "Account Executive",
    currentCompany: "Brightsell",
    experience: "4 yrs",
    currentCtc: "₹\u00A011,00,000",
    expectedCtc: "₹\u00A015,00,000",
    skills: "B2B Sales, CRM",
    education: "MBA, SIBM Pune",
    stage: "Applied",
  },
  {
    id: "CND-003",
    name: "Tanvi Sheth",
    email: "tanvi.s@mail.com",
    phone: "+91 90045 77120",
    jobType: "Contract",
    source: "Naukri",
    position: "Financial Analyst",
    currentCompany: "Kotak",
    experience: "3 yrs",
    currentCtc: "₹\u00A09,00,000",
    expectedCtc: "₹\u00A012,50,000",
    skills: "FP&A, Excel, SQL",
    education: "CA, ICAI",
    stage: "Applied",
  },
  {
    id: "CND-004",
    name: "Imran Qureshi",
    email: "imran.q@mail.com",
    phone: "+91 98111 40098",
    jobType: "Full Time",
    source: "Career Portal",
    position: "Ops Manager",
    currentCompany: "Delhivery",
    experience: "8 yrs",
    currentCtc: "₹\u00A021,00,000",
    expectedCtc: "₹\u00A028,00,000",
    skills: "Supply Chain, Lean",
    education: "B.E. Mech, DTU",
    stage: "Finalised",
  },
];

/**
 * @typedef {Object} JobLocation
 * @property {string} id
 * @property {string} name
 * @property {string} address
 * @property {string} city
 * @property {string} state
 * @property {string} country
 * @property {string} postal
 * @property {string} remote
 * @property {string} status
 */

export const JOB_LOCATIONS = [
  {
    id: "JL-001",
    name: "Bhubaneswar HQ",
    address: "Khandagiri",
    city: "Bhubaneswar",
    state: "Odisha",
    country: "India",
    postal: "751003",
    remote: "No",
    status: "Active",
  },
  {
    id: "JL-002",
    name: "Mumbai BKC",
    address: "One BKC, Bandra East",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    postal: "400051",
    remote: "No",
    status: "Active",
  },
  {
    id: "JL-003",
    name: "Remote India",
    address: "Work from anywhere",
    city: "—",
    state: "—",
    country: "India",
    postal: "—",
    remote: "Yes",
    status: "Active",
  },
];

/**
 * @typedef {Object} JobPosting
 * @property {string} id
 * @property {string} title
 * @property {string} jobType
 * @property {string} location
 * @property {string} branch
 * @property {string} positions
 * @property {string} priority
 * @property {string} minExp
 * @property {string} maxExp
 * @property {string} minSalary
 * @property {string} maxSalary
 * @property {string} deadline
 * @property {string} skills
 * @property {string} description
 * @property {string} portalUrl
 */

export const JOB_POSTINGS = [
  {
    id: "JP-1001",
    title: "Senior Frontend Engineer",
    jobType: "Full Time",
    location: "Bhubaneswar HQ",
    branch: "Whitefield",
    positions: "3",
    priority: "High",
    minExp: "5",
    maxExp: "9",
    minSalary: "1800000",
    maxSalary: "2600000",
    deadline: "2026-09-15",
    skills: "React, TypeScript, Tailwind",
    description: "Own the customer-facing web platform and mentor engineers.",
    portalUrl: "https://careers.seereon.co.in/jobs/JP-1001",
  },
  {
    id: "JP-1002",
    title: "Enterprise Account Executive",
    jobType: "Full Time",
    location: "Mumbai BKC",
    branch: "BKC",
    positions: "2",
    priority: "Urgent",
    minExp: "4",
    maxExp: "8",
    minSalary: "1200000",
    maxSalary: "1800000",
    deadline: "2026-08-30",
    skills: "B2B SaaS, Negotiation",
    description: "Drive new logo acquisition across west India.",
    portalUrl: "https://careers.seereon.co.in/jobs/JP-1002",
  },
  // Posts for the other seeded applicants (Ops Manager, Financial Analyst) — previously every non-engineer /
  // non-sales candidate was filed under the Senior Frontend Engineer post.
  {
    id: "JP-1003",
    title: "Ops Manager",
    jobType: "Full Time",
    location: "Bhubaneswar HQ",
    branch: "Whitefield",
    positions: "1",
    priority: "Medium",
    minExp: "6",
    maxExp: "10",
    minSalary: "2200000",
    maxSalary: "2800000",
    deadline: "2026-09-30",
    skills: "Supply Chain, Lean, Vendor management",
    description: "Run delivery-centre operations, vendor SLAs and shift rosters.",
    portalUrl: "https://careers.seereon.co.in/jobs/JP-1003",
  },
  {
    id: "JP-1004",
    title: "Financial Analyst",
    jobType: "Contract",
    location: "Bhubaneswar HQ",
    branch: "Whitefield",
    positions: "1",
    priority: "Low",
    minExp: "2",
    maxExp: "5",
    minSalary: "900000",
    maxSalary: "1300000",
    deadline: "2026-10-15",
    skills: "FP&A, Excel, SQL",
    description: "Monthly close support, variance analysis and board MIS packs.",
    portalUrl: "https://careers.seereon.co.in/jobs/JP-1004",
  },
];

/**
 * @typedef {Object} InterviewRow
 * @property {string} id
 * @property {string} candidate
 * @property {string} round
 * @property {string} type
 * @property {string} scheduledAt
 * @property {string} duration
 * @property {string} location
 * @property {string} meetingLink
 * @property {string} interviewers
 * @property {string} feedback
 */

export const INTERVIEWS = [
  {
    id: "INT-001",
    candidate: "Meera Raghavan",
    round: "Technical Round 1",
    type: "Video Call",
    scheduledAt: "2026-08-04",
    duration: "60 min",
    location: "Google Meet",
    meetingLink: "https://meet.google.com/xyz-abcd",
    interviewers: "Arjun Kapoor, Priya Nair",
    feedback: "Strong on system design.",
  },
  {
    id: "INT-002",
    candidate: "Sahil Bhatia",
    round: "HR Screening",
    type: "Telephonic",
    scheduledAt: "2026-08-02",
    duration: "30 min",
    location: "Phone",
    meetingLink: "—",
    interviewers: "Priya Nair",
    feedback: "Good communication, salary aligned.",
  },
];

/**
 * @typedef {Object} Assessment
 * @property {string} id
 * @property {string} candidate
 * @property {string} round
 * @property {string} criteria
 * @property {string} score
 * @property {string} rating
 * @property {string} recommendation
 * @property {string} remarks
 */

export const ASSESSMENTS = [
  {
    id: "ASM-001",
    candidate: "Meera Raghavan",
    round: "Technical Round 1",
    criteria: "Problem solving",
    score: "8",
    rating: "Excellent",
    recommendation: "Proceed",
    remarks: "Clear structured thinking.",
  },
  {
    id: "ASM-002",
    candidate: "Sahil Bhatia",
    round: "HR Screening",
    criteria: "Culture fit",
    score: "6",
    rating: "Good",
    recommendation: "Proceed",
    remarks: "Needs a second sales round.",
  },
];

/**
 * @typedef {Object} Offer
 * @property {string} id
 * @property {string} candidate
 * @property {string} position
 * @property {string} department
 * @property {string} salary
 * @property {string} bonus
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} expiryDate
 * @property {string} offerDate
 * @property {string} status
 * @property {string} benefits
 */

export const OFFERS = [
  {
    id: "OFR-001",
    candidate: "Imran Qureshi",
    position: "Ops Manager",
    department: "Operations",
    salary: "₹\u00A027,00,000",
    bonus: "₹\u00A02,00,000",
    startDate: "2026-09-01",
    endDate: "—",
    expiryDate: "2026-08-15",
    offerDate: "2026-07-25",
    status: "Sent",
    benefits: "Health insurance, ESOP, Relocation",
  },
];

/* Master seeds shared by Recruitment Masters (CrudSection) and the forms that read them (Add applicant, Schedule). */
export const SOURCE_MASTER_SEED = [
  { id: "CS-001", name: "Referral", description: "Employee referral programme", status: "Active" },
  {
    id: "CS-002",
    name: "LinkedIn",
    description: "Inbound and outbound sourcing",
    status: "Active",
  },
  {
    id: "CS-003",
    name: "Career Portal",
    description: "Applications from the careers site",
    status: "Active",
  },
  ...CANDIDATE_SOURCES.filter((n) => !["Referral", "LinkedIn", "Career Portal"].includes(n)).map(
    (n, i) => ({
      id: `CS-${String(i + 4).padStart(3, "0")}`,
      name: n,
      description: `${n}`,
      status: "Active",
    }),
  ),
];
export const INTERVIEW_TYPE_MASTER_SEED = [
  { id: "IT-001", name: "Telephonic", description: "Initial screening call", status: "Active" },
  { id: "IT-002", name: "Video Call", description: "Remote panel interview", status: "Active" },
  { id: "IT-003", name: "Face to Face", description: "On-site interview", status: "Active" },
  ...INTERVIEW_TYPES.filter((n) => !["Telephonic", "Video Call", "Face to Face"].includes(n)).map(
    (n, i) => ({
      id: `IT-${String(i + 4).padStart(3, "0")}`,
      name: n,
      description: `${n}`,
      status: "Active",
    }),
  ),
];
