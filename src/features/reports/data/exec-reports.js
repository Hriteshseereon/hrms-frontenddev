// Executive & finance reporting data (UI-only seed).
// Powers the CEO / CFO revenue, P&L, expense and salary-cost reports.

export const FINANCIAL_YEARS = ["FY 2024-25", "FY 2025-26", "FY 2026-27"];
/**
 * @typedef {(typeof FINANCIAL_YEARS)[number]} FinancialYear
 */

/** Apr → Mar, the Indian financial year. */
export const FY_MONTHS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

/** ISO first-of-month for a FY month index, so date filters work. */
export function fyMonthIso(fy, monthIndex) {
  const startYear = Number(fy.replace(/\D+/g, "").slice(0, 4));
  const month = monthIndex + 4; // Apr = 4
  const year = month > 12 ? startYear + 1 : startYear;
  const m = month > 12 ? month - 12 : month;
  return `${year}-${String(m).padStart(2, "0")}-01`;
}

/**
 * @typedef {Object} RevenueRow
 * @property {string} fy
 * @property {number} monthIndex
 * @property {string} client
 * @property {string} serviceLine
 * @property {string} region
 * @property {number} invoiced
 * @property {number} collected
 */

const CLIENTS = [
  { client: "ZooPlus Germany", serviceLine: "Application Development", region: "India" },
  { client: "Royal Commission for AlUla", serviceLine: "Managed Services", region: "Middle East" },
  { client: "Spotlight Australia", serviceLine: "Data & Analytics", region: "India" },
  { client: "Semtech Corporation", serviceLine: "Cloud & DevOps", region: "APAC" },
  { client: "Infosys", serviceLine: "QA & Automation", region: "Europe" },
  { client: "Mother's Group of Schools", serviceLine: "Consulting", region: "North America" },
];

const seededRandom = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

function buildRevenue() {
  const rows = [];
  FINANCIAL_YEARS.forEach((fy, fyIdx) => {
    const rand = seededRandom(97 + fyIdx * 31);
    CLIENTS.forEach((c, ci) => {
      for (let m = 0; m < 12; m++) {
        const base = 1_800_000 + ci * 420_000 + fyIdx * 650_000;
        const invoiced = Math.round((base * (0.85 + rand() * 0.4)) / 1000) * 1000;
        const collected = Math.round((invoiced * (0.78 + rand() * 0.22)) / 1000) * 1000;
        rows.push({
          fy,
          monthIndex: m,
          client: c.client,
          serviceLine: c.serviceLine,
          region: c.region,
          invoiced,
          collected,
        });
      }
    });
  });
  return rows;
}

export const REVENUE_ROWS = buildRevenue();

export const EXPENSE_HEADS = [
  "Salaries & Wages",
  "Statutory Contributions",
  "Facility & Rent",
  "Cloud & Licences",
  "Travel & Conveyance",
  "Recruitment & Training",
  "Marketing",
  "Professional Fees",
];

/**
 * @typedef {Object} ExpenseRow
 * @property {string} fy
 * @property {number} monthIndex
 * @property {string} head
 * @property {string} costCentre
 * @property {number} amount
 * @property {number} budget
 */

const COST_CENTRES = {
  "Salaries & Wages": "People",
  "Statutory Contributions": "People",
  "Facility & Rent": "Administration",
  "Cloud & Licences": "Technology",
  "Travel & Conveyance": "Operations",
  "Recruitment & Training": "Human Resources",
  Marketing: "Growth",
  "Professional Fees": "Finance",
};

function buildExpenses() {
  const rows = [];
  FINANCIAL_YEARS.forEach((fy, fyIdx) => {
    const rand = seededRandom(541 + fyIdx * 17);
    EXPENSE_HEADS.forEach((head, hi) => {
      for (let m = 0; m < 12; m++) {
        const base = hi === 0 ? 5_600_000 : 380_000 + hi * 145_000;
        const budget = Math.round((base * (1 + fyIdx * 0.09)) / 1000) * 1000;
        const amount = Math.round((budget * (0.82 + rand() * 0.3)) / 1000) * 1000;
        rows.push({
          fy,
          monthIndex: m,
          head,
          costCentre: COST_CENTRES[head] ?? "General",
          amount,
          budget,
        });
      }
    });
  });
  return rows;
}

export const EXPENSE_ROWS = buildExpenses();

export const revenueFor = (fy) => REVENUE_ROWS.filter((r) => r.fy === fy);
export const expensesFor = (fy) => EXPENSE_ROWS.filter((r) => r.fy === fy);

export const sum = (ns) => ns.reduce((a, b) => a + b, 0);
