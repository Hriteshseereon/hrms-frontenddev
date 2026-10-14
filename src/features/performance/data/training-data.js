// Training module reference data

export const TRAINING_STATUSES = ["Planned", "Ongoing", "Completed", "Cancelled"];

export const TRAINERS = [
  {
    id: "TRN-001",
    name: "Sanjay Rao",
    contact: "+91 98450 22110",
    email: "sanjay.rao@learnwell.in",
    branch: "Whitefield",
    department: "Engineering",
    experience: "12 years",
  },
  {
    id: "TRN-002",
    name: "Meera Suresh",
    contact: "+91 99000 55231",
    email: "meera@peoplefirst.co",
    branch: "BKC",
    department: "Human Resources",
    experience: "8 years",
  },
  {
    id: "TRN-003",
    name: "Aditya Menon",
    contact: "+91 98860 11447",
    email: "aditya.menon@salesedge.in",
    branch: "Koramangala",
    department: "Sales",
    experience: "10 years",
  },
];

export const TRAINING_TYPES = [
  {
    id: "TTP-001",
    name: "Technical Upskilling",
    branch: "Whitefield",
    department: "Engineering",
    description: "Language, framework and platform deep dives",
  },
  {
    id: "TTP-002",
    name: "POSH & Compliance",
    branch: "BKC",
    department: "Human Resources",
    description: "Mandatory annual compliance training",
  },
  {
    id: "TTP-003",
    name: "Sales Enablement",
    branch: "Koramangala",
    department: "Sales",
    description: "Pitching, negotiation and CRM hygiene",
  },
];

export const TRAININGS = [
  {
    id: "TRG-001",
    title: "Advanced React Patterns",
    type: "Technical Upskilling",
    trainer: "Sanjay Rao",
    start: "2026-08-03",
    end: "2026-08-05",
    status: "Planned",
    branch: "Whitefield",
    location: "Training Room A, Block 2",
  },
  {
    id: "TRG-002",
    title: "POSH Awareness FY26",
    type: "POSH & Compliance",
    trainer: "Meera Suresh",
    start: "2026-07-15",
    end: "2026-07-15",
    status: "Completed",
    branch: "BKC",
    location: "Auditorium",
  },
  {
    id: "TRG-003",
    title: "Enterprise Negotiation Lab",
    type: "Sales Enablement",
    trainer: "Aditya Menon",
    start: "2026-07-27",
    end: "2026-07-29",
    status: "Ongoing",
    branch: "Koramangala",
    location: "Meeting Hub 4",
  },
];

export const TRAINING_TYPE_NAMES = TRAINING_TYPES.map((t) => t.name);
export const TRAINER_NAMES = TRAINERS.map((t) => t.name);
