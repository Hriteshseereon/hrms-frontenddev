// -----------------------------------------------------------------------------
// Statutory Compliance Library — the acts, rates, thresholds, due dates, forms,
// registers and penalties Seereon's payroll operates under, aligned to the
// Government of India / Odisha guidelines as understood at build time
// (FY 2026-27), including the four Labour Codes in force from 21 Nov 2025.
// Every entry carries a "verify" note: rates and dates change by notification,
// so Finance confirms them against the latest circular before each FY.
// Each entry also compares itself with the organisation's Statutory Config so
// the screen can flag drift ("Aligned" / "Review").
// -----------------------------------------------------------------------------
import { getStatutoryConfig } from "@/features/payroll/data/statutory-data";

/**
 * @typedef {"Central — Social security" | "Central — Tax" | "Central — Labour law" | "State — Odisha" | "Labour Codes 2025" | "Establishment & workplace"} ComplianceCategory
 */

/**
 * @typedef {Object} ComplianceEntry
 * @property {string} code
 * @property {string} act
 * @property {string} short
 * @property {ComplianceCategory} category
 * @property {string} authority
 * @property {string} applicability
 * @property {string} coverage
 * @property {{ label: string, value: string }[]} rates
 * @property {{ what: string, when: string, frequency: string }[]} dueDates
 * @property {string[]} forms
 * @property {string[]} registers
 * @property {string} penalties
 * @property {{ on: string, note: string }} latest
 * @property {string} verify
 * @property {string} [configuredIn]
 * @property {(cfg: StatutoryConfig) => { ok: boolean, note: string }} [check] - Compares the org config with the statutory value.
 */

export const COMPLIANCE_LIBRARY = [
  {
    code: "EPF",
    act: "Employees' Provident Funds & Miscellaneous Provisions Act, 1952",
    short: "Provident Fund (EPF / EPS / EDLI)",
    category: "Central — Social security",
    authority: "EPFO — Unified Portal (ECR 2.0)",
    applicability:
      "Every establishment with 20+ employees (voluntary below). Mandatory for employees with PF wages ≤ ₹15,000; optional above (Form 11 declaration) unless already a member.",
    coverage:
      "Basic + DA (+ retaining allowance). Under the Code on Social Security the wage definition treats allowances above 50 % of total remuneration as wages.",
    rates: [
      {
        label: "Employee contribution",
        value: "12 % of PF wages (VPF optional up to 100 % of Basic)",
      },
      {
        label: "Employer contribution",
        value: "12 % — 8.33 % to EPS (on wages ≤ ₹15,000, max ₹1,250) + 3.67 % to EPF",
      },
      {
        label: "EDLI (employer)",
        value: "0.5 % of PF wages (cap ₹15,000) — assurance benefit up to ₹7 lakh",
      },
      { label: "Admin charges (A/c 2)", value: "0.5 % of PF wages, minimum ₹500 per month" },
      {
        label: "Wage ceiling",
        value: "₹15,000 per month (restrict or contribute on actual by policy)",
      },
      { label: "Interest (FY 2025-26 declared)", value: "8.25 % p.a. — credited by EPFO" },
    ],
    dueDates: [
      {
        what: "Contribution deposit + ECR filing",
        when: "15th of the following month",
        frequency: "Monthly",
      },
      {
        what: "Form 2 (nomination) / Form 11 (declaration) for new joiners",
        when: "At joining (UAN generation)",
        frequency: "Event",
      },
      {
        what: "Annual account statement (Form 3A/6A) — auto via ECR",
        when: "By 30 April",
        frequency: "Annual",
      },
      {
        what: "Employee exit (date of exit on portal)",
        when: "Within 7 days of leaving",
        frequency: "Event",
      },
    ],
    forms: [
      "ECR (Electronic Challan-cum-Return)",
      "Form 11 (composite declaration)",
      "Form 2 (nomination)",
      "Form 19 / 10C / 31 (withdrawals — employee, online)",
      "Form 5 / 10 (auto via ECR)",
    ],
    registers: ["PF eligibility register", "Inspection book", "Contribution card (Form 3A)"],
    penalties:
      "Damages u/s 14B: 5 % p.a. (< 2 months) to 25 % p.a. (≥ 6 months) plus interest u/s 7Q at 12 % p.a. on delayed remittance; prosecution for default.",
    latest: {
      on: "2025-11-21",
      note: "Code on Social Security, 2020 in force — PF chapter subsumes the EPF Act; wage definition (50 % rule) applies to contributions. EPFO 3.0 portal with faster claim settlement being rolled out.",
    },
    verify:
      "Confirm the current wage ceiling (proposal to raise to ₹21,000 pending) and the interest rate notified for the year.",
    configuredIn: "Statutory Config → PF",
    check: (cfg) => ({
      ok:
        cfg.pf.employeeRate === 12 &&
        cfg.pf.employerRate === 12 &&
        cfg.pf.epsRate === 8.33 &&
        cfg.pf.edliRate === 0.5 &&
        cfg.pf.wageCeiling === 15000 &&
        cfg.pf.remittanceDueDay === 15,
      note: `Configured: EE ${cfg.pf.employeeRate} % · ER ${cfg.pf.employerRate} % · EPS ${cfg.pf.epsRate} % · EDLI ${cfg.pf.edliRate} % · ceiling ₹${cfg.pf.wageCeiling.toLocaleString("en-IN")} · due ${cfg.pf.remittanceDueDay}th`,
    }),
  },
  {
    code: "ESI",
    act: "Employees' State Insurance Act, 1948",
    short: "ESI (medical & cash benefits)",
    category: "Central — Social security",
    authority: "ESIC — Shram Suvidha / ESIC portal",
    applicability:
      "Establishments with 10+ employees in implemented areas (20+ in some states for shops). Employees with gross wages ≤ ₹21,000 per month (₹25,000 for persons with disability).",
    coverage:
      "Gross wages excluding washing allowance, annual bonus, retrenchment compensation and encashment of leave.",
    rates: [
      { label: "Employee contribution", value: "0.75 % of gross wages (nil if daily wage ≤ ₹176)" },
      { label: "Employer contribution", value: "3.25 % of gross wages" },
      { label: "Wage ceiling", value: "₹21,000 / month (₹25,000 for PWD)" },
      {
        label: "Contribution periods",
        value:
          "Apr–Sep and Oct–Mar — coverage continues to period end once wages cross the ceiling",
      },
      {
        label: "Benefit periods",
        value: "Jan–Jun and Jul–Dec (sickness, maternity, disablement, dependants, medical)",
      },
    ],
    dueDates: [
      {
        what: "Contribution deposit & monthly return",
        when: "15th of the following month",
        frequency: "Monthly",
      },
      {
        what: "Half-yearly return of contributions (Form 5 / RC)",
        when: "11 May and 11 November",
        frequency: "Half-yearly",
      },
      {
        what: "Register new employee (IP number)",
        when: "Within 10 days of joining",
        frequency: "Event",
      },
      {
        what: "Accident report (Form 12)",
        when: "Within 24 hours of the accident",
        frequency: "Event",
      },
    ],
    forms: [
      "Form 1 (declaration — online)",
      "Form 5 / RC (half-yearly)",
      "Form 6 (register of employees)",
      "Form 12 (accident report)",
      "Pehchan card (e-card)",
    ],
    registers: ["Register of employees (Form 6)", "Accident book (Form 11)", "Inspection book"],
    penalties:
      "Interest 12 % p.a. on delayed contribution; damages 5–25 % p.a.; imprisonment up to 3 years for non-payment of deducted contributions.",
    latest: {
      on: "2025-11-21",
      note: "Code on Social Security, 2020 subsumes the ESI Act; pan-India applicability (no longer limited to notified areas) and gig / platform workers brought within scope by notification.",
    },
    verify:
      "Check the ESIC circular for any revision to the ₹21,000 wage ceiling and the daily-wage exemption limit.",
    configuredIn: "Statutory Config → ESI",
    check: (cfg) => ({
      ok:
        cfg.esi.employeeRate === 0.75 &&
        cfg.esi.employerRate === 3.25 &&
        cfg.esi.wageThreshold === 21000 &&
        cfg.esi.disabledThreshold === 25000,
      note: `Configured: EE ${cfg.esi.employeeRate} % · ER ${cfg.esi.employerRate} % · ceiling ₹${cfg.esi.wageThreshold.toLocaleString("en-IN")} / PWD ₹${cfg.esi.disabledThreshold.toLocaleString("en-IN")}`,
    }),
  },
  {
    code: "TDS-192",
    act: "Income-tax Act, 1961 — s.192 (TDS on salary), s.115BAC (New Tax Regime)",
    short: "TDS on salaries — New Tax Regime",
    category: "Central — Tax",
    authority: "CBDT — TRACES / e-filing portal",
    applicability:
      "Every employer paying salary above the basic exemption. Seereon applies the New Tax Regime (s.115BAC) to all employees; no old-regime option.",
    coverage:
      "Projected annual taxable salary incl. previous-employer income (Form 12B) and other income declared (Form 12BB).",
    rates: [
      {
        label: "Slabs FY 2026-27 (new regime)",
        value:
          "0 % ≤ ₹4 L · 5 % to ₹8 L · 10 % to ₹12 L · 15 % to ₹16 L · 20 % to ₹20 L · 25 % to ₹24 L · 30 % above",
      },
      { label: "Standard deduction", value: "₹75,000 u/s 16(ia)" },
      {
        label: "Rebate u/s 87A",
        value: "Full rebate up to ₹12 L taxable (max ₹60,000) with marginal relief",
      },
      { label: "Employer NPS 80CCD(2)", value: "Up to 14 % of Basic + DA" },
      {
        label: "Surcharge / cess",
        value: "10 % > ₹50 L, 15 % > ₹1 Cr, 25 % > ₹2 Cr · Health & Education Cess 4 %",
      },
      { label: "No PAN", value: "Deduct at 20 % u/s 206AA" },
    ],
    dueDates: [
      {
        what: "Deposit TDS (Challan ITNS 281)",
        when: "7th of the following month (30 April for March)",
        frequency: "Monthly",
      },
      {
        what: "Form 24Q quarterly return",
        when: "31 Jul · 31 Oct · 31 Jan · 31 May",
        frequency: "Quarterly",
      },
      { what: "Form 16 (Part A + B) to employees", when: "By 15 June", frequency: "Annual" },
      {
        what: "Collect Form 12BB + proofs",
        when: "Declaration Apr–May; proofs by Jan–Feb",
        frequency: "Annual",
      },
    ],
    forms: [
      "Form 24Q",
      "Form 16 (Part A from TRACES, Part B)",
      "Form 12BB (employee declaration)",
      "Form 12B (previous employer)",
      "Form 12BA (perquisites)",
      "Challan ITNS 281",
    ],
    registers: ["TDS register / salary register", "Form 26AS reconciliation"],
    penalties:
      "Interest u/s 201(1A): 1 % p.m. for non-deduction, 1.5 % p.m. for non-deposit; late-filing fee u/s 234E ₹200/day; penalty u/s 271H ₹10,000–₹1,00,000.",
    latest: {
      on: "2026-02-01",
      note: "Finance Act 2025 slabs and ₹12 L rebate threshold continue for FY 2026-27; new regime is the default u/s 115BAC(1A). Verify Budget 2026 changes before the first payroll of the FY.",
    },
    verify:
      "Re-confirm slab rates, standard deduction and 87A threshold against the Finance Act for the FY; update Statutory Config if changed.",
    configuredIn: "Statutory Config → TDS · Proof of Investment",
    check: (cfg) => ({
      ok:
        cfg.tds.standardDeductionNew === 75000 &&
        cfg.tds.rebate87aLimitNew === 1200000 &&
        cfg.tds.rebate87aMaxNew === 60000 &&
        cfg.tds.cessRate === 4 &&
        cfg.tds.remittanceDueDay === 7,
      note: `Configured: std ₹${cfg.tds.standardDeductionNew.toLocaleString("en-IN")} · 87A ≤ ₹${cfg.tds.rebate87aLimitNew.toLocaleString("en-IN")} (max ₹${cfg.tds.rebate87aMaxNew.toLocaleString("en-IN")}) · cess ${cfg.tds.cessRate} % · due ${cfg.tds.remittanceDueDay}th`,
    }),
  },
  {
    code: "PT-OD",
    act: "Odisha State Tax on Professions, Trades, Callings and Employments Act, 2000",
    short: "Professional Tax — Odisha (and other states)",
    category: "State — Odisha",
    authority: "Commissionerate of CT & GST, Odisha (PTRC / PTEC)",
    applicability:
      "Every employer with employees in Odisha (PTRC) and the entity itself (PTEC). Other branches follow their state's slabs — Karnataka, Maharashtra, Tamil Nadu, Telangana, West Bengal, Gujarat, Andhra Pradesh, Madhya Pradesh, Kerala, Jharkhand, Chhattisgarh.",
    coverage: "Monthly salary / wages as defined by the state act.",
    rates: [
      {
        label: "Odisha slabs (annual income)",
        value:
          "≤ ₹1,60,000: nil · ₹1,60,001–3,00,000: ₹125/month · > ₹3,00,000: ₹200/month (₹300 in one month) — max ₹2,500 p.a.",
      },
      {
        label: "Karnataka",
        value: "₹200/month above ₹25,000 (women & senior citizens exemptions per notification)",
      },
      {
        label: "Maharashtra",
        value:
          "₹175 (₹7,501–10,000) · ₹200 above ₹10,000; ₹300 in February; women exempt ≤ ₹25,000",
      },
      {
        label: "Tamil Nadu",
        value: "Half-yearly slabs up to ₹1,250 per half-year (Chennai Corporation)",
      },
    ],
    dueDates: [
      {
        what: "Odisha PTRC monthly payment & return",
        when: "Last day of the following month",
        frequency: "Monthly",
      },
      { what: "PTEC (entity) payment", when: "30 June", frequency: "Annual" },
      {
        what: "Maharashtra PTRC",
        when: "Last day of the month (annual liability < ₹1 L: 31 March)",
        frequency: "Monthly / annual",
      },
      { what: "Karnataka Form 5A", when: "20th of the following month", frequency: "Monthly" },
    ],
    forms: [
      "Odisha Form V (return)",
      "Form VII (challan)",
      "PTRC / PTEC registration certificates",
    ],
    registers: ["PT deduction register", "Employee-wise PT ledger"],
    penalties:
      "Interest 2 % p.m. on delayed payment; penalty up to 50 % of tax due; late registration fee.",
    latest: {
      on: "2025-04-01",
      note: "Odisha slabs unchanged since the 2020 amendment; several states revising thresholds under the wage-definition of the Code on Wages. Confirm the branch state's current notification.",
    },
    verify:
      "Check each branch state's PT notification at the start of the FY; PT is not deductible under the new tax regime.",
    configuredIn: "State Policies",
  },
  {
    code: "LWF",
    act: "Labour Welfare Fund Acts (state)",
    short: "Labour Welfare Fund",
    category: "State — Odisha",
    authority: "State Labour Welfare Boards",
    applicability:
      "Employees in states with an LWF Act — Karnataka, Maharashtra, Tamil Nadu, Telangana, West Bengal, Gujarat, Andhra Pradesh, Madhya Pradesh, Kerala, Chhattisgarh, Delhi, Haryana. Odisha has no LWF contribution.",
    coverage: "All employees except managerial / supervisory above the state wage limit.",
    rates: [
      { label: "Karnataka", value: "₹20 employee + ₹40 employer — annual (December)" },
      { label: "Maharashtra", value: "₹25 / ₹75 — half-yearly (June & December)" },
      { label: "Tamil Nadu", value: "₹20 / ₹40 — annual (December)" },
      { label: "Telangana", value: "₹2 / ₹5 — annual (December)" },
      { label: "West Bengal", value: "₹3 / ₹15 — half-yearly" },
    ],
    dueDates: [
      {
        what: "Contribution & return",
        when: "15 January / 15 July (Maharashtra); 15 January (annual states)",
        frequency: "Half-yearly / annual",
      },
    ],
    forms: ["Form A-1 (Maharashtra)", "Form D (Karnataka)", "State challan"],
    registers: ["LWF contribution register"],
    penalties: "Interest and fines per state act; disqualification from state welfare schemes.",
    latest: {
      on: "2025-01-01",
      note: "Karnataka revised employee/employer contribution to ₹20/₹40 from 2024; other states unchanged.",
    },
    verify:
      "Confirm each state's contribution amount and cycle for the year — figures are maintained under State Policies.",
    configuredIn: "State Policies → LWF",
  },
  {
    code: "GRATUITY",
    act: "Payment of Gratuity Act, 1972",
    short: "Gratuity",
    category: "Central — Labour law",
    authority: "Controlling Authority — Labour Commissioner",
    applicability:
      "Establishments with 10+ employees. Payable on separation after 5 years of continuous service (not required on death / disablement). Under the Code on Social Security, fixed-term employees qualify after 1 year.",
    coverage: "Last drawn Basic + DA.",
    rates: [
      {
        label: "Formula",
        value: "15 / 26 × last drawn (Basic + DA) × completed years (≥ 6 months rounds up)",
      },
      { label: "Tax-free ceiling", value: "₹20,00,000 (private sector, s.10(10))" },
      {
        label: "Payment timeline",
        value: "Within 30 days of becoming payable; interest thereafter",
      },
    ],
    dueDates: [
      { what: "Pay gratuity", when: "Within 30 days of separation", frequency: "Event" },
      {
        what: "Nomination (Form F)",
        when: "Within 30 days of completing 1 year",
        frequency: "Event",
      },
      {
        what: "Notice of opening (Form A)",
        when: "Within 30 days of the Act applying",
        frequency: "Once",
      },
    ],
    forms: [
      "Form F (nomination)",
      "Form I (application by employee)",
      "Form L (notice of payment)",
      "Form A / B (opening / change)",
    ],
    registers: ["Gratuity nomination register", "Actuarial valuation (AS 15 / Ind AS 19)"],
    penalties:
      "Simple interest for delay; fine up to ₹20,000 and imprisonment up to 2 years for non-payment.",
    latest: {
      on: "2025-11-21",
      note: "Code on Social Security, 2020: 1-year eligibility for fixed-term employees; wage definition (50 % rule) may raise the gratuity base.",
    },
    verify:
      "Re-check the tax-free ceiling and apply the Code's wage definition in F&F computations.",
    configuredIn: "Exit Management → F&F",
  },
  {
    code: "BONUS",
    act: "Payment of Bonus Act, 1965",
    short: "Statutory bonus",
    category: "Central — Labour law",
    authority: "Labour Commissioner",
    applicability:
      "Establishments with 20+ employees; employees with wages ≤ ₹21,000 per month who worked ≥ 30 days in the accounting year.",
    coverage: "Basic + DA, calculated on ₹7,000 or the minimum wage, whichever is higher.",
    rates: [
      {
        label: "Minimum bonus",
        value: "8.33 % of wages (calculation ceiling ₹7,000 / minimum wage)",
      },
      { label: "Maximum bonus", value: "20 % (allocable surplus)" },
      { label: "Eligibility wage ceiling", value: "₹21,000 per month" },
    ],
    dueDates: [
      {
        what: "Pay bonus",
        when: "Within 8 months of the close of the accounting year (by 30 November for Apr–Mar)",
        frequency: "Annual",
      },
      {
        what: "Annual return (Form D)",
        when: "Within 30 days of payment / by 1 February",
        frequency: "Annual",
      },
    ],
    forms: [
      "Form A (computation of allocable surplus)",
      "Form B (set-on / set-off)",
      "Form C (bonus paid register)",
      "Form D (annual return)",
    ],
    registers: ["Form A", "Form B", "Form C"],
    penalties:
      "Fine up to ₹1,000 and imprisonment up to 6 months; under the Code on Wages fines up to ₹50,000 (first) and ₹1 L (repeat).",
    latest: {
      on: "2025-11-21",
      note: "Bonus chapter now under the Code on Wages, 2019 — eligibility wage limit to be notified by the appropriate government; Odisha yet to notify a state-specific limit.",
    },
    verify: "Confirm the notified eligibility limit under the Code on Wages before the bonus run.",
    configuredIn: "Payroll → Bonus run",
  },
  {
    code: "MATERNITY",
    act: "Maternity Benefit Act, 1961 (amended 2017)",
    short: "Maternity benefit",
    category: "Central — Labour law",
    authority: "Labour Commissioner / ESIC (for ESI-covered)",
    applicability:
      "Establishments with 10+ employees; women who worked ≥ 80 days in the 12 months before expected delivery.",
    coverage: "Average daily wage for the period of absence.",
    rates: [
      {
        label: "Paid leave",
        value:
          "26 weeks (up to 8 weeks pre-natal) for the first two children; 12 weeks thereafter; 12 weeks for adoption / commissioning mother",
      },
      { label: "Crèche", value: "Mandatory for establishments with 50+ employees; 4 visits a day" },
      { label: "Work from home", value: "Permissible after the leave by mutual agreement" },
      { label: "Medical bonus", value: "₹3,500 where no pre-natal / post-natal care is provided" },
    ],
    dueDates: [
      {
        what: "Pay maternity benefit",
        when: "Advance for pre-natal on proof; balance within 48 hours of proof of delivery",
        frequency: "Event",
      },
      {
        what: "Annual return (Form L/M/N/O)",
        when: "By 21 January (state rules)",
        frequency: "Annual",
      },
    ],
    forms: [
      "Form A (notice by employee)",
      "Form L–O (annual returns)",
      "Muster roll (Form A rules)",
    ],
    registers: ["Maternity benefit register"],
    penalties:
      "Imprisonment 3 months to 1 year and fine ₹2,000–₹5,000; dismissal during leave is void.",
    latest: {
      on: "2025-11-21",
      note: "Chapter VI of the Code on Social Security, 2020 retains 26-week benefit; leave policy in Seereon HRMS maps 'Maternity Leave' to 182 days.",
    },
    verify: "Check state rules on annual return forms and crèche facility norms.",
    configuredIn: "Leave → Leave types",
  },
  {
    code: "POSH",
    act: "Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013",
    short: "POSH — Internal Committee",
    category: "Establishment & workplace",
    authority: "District Officer / Ministry of Women & Child Development (SHe-Box)",
    applicability:
      "Every workplace with 10+ employees must constitute an Internal Committee (IC) with an external member; policy display and annual awareness mandatory.",
    coverage: "All employees, contract staff, interns and visitors at the workplace.",
    rates: [
      {
        label: "IC composition",
        value:
          "Presiding officer (senior woman), ≥ 2 employee members, 1 external member; ≥ 50 % women",
      },
      {
        label: "Complaint timeline",
        value: "Complaint within 3 months; inquiry completed within 90 days; report within 10 days",
      },
    ],
    dueDates: [
      {
        what: "Annual report to District Officer",
        when: "By 31 January (calendar year)",
        frequency: "Annual",
      },
      { what: "IC reconstitution", when: "Every 3 years", frequency: "Triennial" },
      {
        what: "Awareness programme",
        when: "At least once a year (Seereon: August workshop)",
        frequency: "Annual",
      },
    ],
    forms: [
      "Annual report (s.21)",
      "IC order & policy",
      "Board's report disclosure (Companies Act)",
    ],
    registers: ["Complaint register", "IC minutes"],
    penalties:
      "Fine up to ₹50,000; licence cancellation for repeat non-compliance; disclosure in Board's report.",
    latest: {
      on: "2024-10-01",
      note: "SHe-Box relaunched as a centralised complaints portal; Supreme Court (Aureliano Fernandes) directions on time-bound IC constitution.",
    },
    verify:
      "Confirm IC members' tenure and that the annual report was filed for the previous calendar year (tracked under Grievances → POSH).",
    configuredIn: "Grievances → POSH",
  },
  {
    code: "S&E-OD",
    act: "Odisha Shops & Commercial Establishments Act, 1956",
    short: "Shops & Establishments — Odisha",
    category: "State — Odisha",
    authority: "Labour Commissioner, Odisha (Odisha Labour Portal)",
    applicability:
      "Every shop / commercial establishment in Odisha — registration within 30 days of commencement; IT/ITES exemptions from working-hour limits by notification.",
    coverage:
      "All employees at the Bhubaneswar HQ; other branches under their state S&E Act (Karnataka, Maharashtra, Tamil Nadu…).",
    rates: [
      {
        label: "Working hours",
        value:
          "9 hours/day, 48 hours/week; overtime at twice the ordinary rate (max 50 hours/quarter under OSH Code: 125 hours)",
      },
      {
        label: "Weekly holiday",
        value: "One day; 8 national & festival holidays (Odisha: Utkal Divas, Raja, Nuakhai etc.)",
      },
      {
        label: "Leave",
        value: "15 days earned leave (1 per 20 days worked), casual & sick leave per state rules",
      },
      {
        label: "Women in night shift",
        value: "Permitted with consent, transport and safety measures (2023 amendment)",
      },
    ],
    dueDates: [
      {
        what: "Registration renewal",
        when: "Every 5 years (Odisha) / annual in some states",
        frequency: "Periodic",
      },
      { what: "Annual return (Form D)", when: "By 31 January", frequency: "Annual" },
      { what: "Notice of change", when: "Within 15 days of change", frequency: "Event" },
    ],
    forms: ["Form A (registration)", "Form D (annual return)", "Form B (change)"],
    registers: [
      "Register of employment (Form E)",
      "Register of leave (Form F)",
      "Register of wages",
      "Notice of holidays (Form H)",
    ],
    penalties: "Fine up to ₹5,000 for first offence; higher under the OSH Code (₹2–3 L).",
    latest: {
      on: "2025-11-21",
      note: "OSH Code, 2020 in force — single registration for establishments with 10+ workers via Shram Suvidha; state S&E Acts continue for hours / leave until state rules align.",
    },
    verify:
      "Confirm the Odisha registration expiry and that the Odisha Registers tab is maintained monthly.",
    configuredIn: "Statutory Compliance → Odisha Registers",
  },
  {
    code: "MIN-WAGE",
    act: "Minimum Wages Act, 1948 / Code on Wages, 2019",
    short: "Minimum wages & VDA",
    category: "Central — Labour law",
    authority: "State Labour Departments; Central floor wage",
    applicability:
      "All employees; state schedules by zone and skill (unskilled / semi-skilled / skilled / highly skilled). Payroll checks earned gross against the branch state floor.",
    coverage: "Basic + DA (VDA revised twice a year — April & October).",
    rates: [
      {
        label: "Odisha (Zone A, skilled)",
        value: "Per latest notification — maintained in State Policies",
      },
      {
        label: "Central floor wage",
        value: "Notified under the Code on Wages; states cannot go below",
      },
      { label: "Overtime", value: "Twice the ordinary rate" },
    ],
    dueDates: [
      { what: "VDA revision", when: "1 April and 1 October", frequency: "Half-yearly" },
      { what: "Annual return (Form III)", when: "By 1 February", frequency: "Annual" },
    ],
    forms: ["Form III (annual return)", "Wage slips (Form XI)"],
    registers: [
      "Register of wages (Form X)",
      "Overtime register (Form IV)",
      "Muster roll (Form V)",
    ],
    penalties:
      "Under the Code on Wages: fine up to ₹50,000 (first) and imprisonment up to 3 months / ₹1 L (repeat).",
    latest: {
      on: "2025-11-21",
      note: "Code on Wages, 2019 effective — uniform wage definition (50 % rule), timely payment (by 7th of next month), equal remuneration and floor wage.",
    },
    verify: "Update the minimum-wage floor per branch state after every VDA notification.",
    configuredIn: "State Policies → Minimum wage",
  },
  {
    code: "CLRA",
    act: "Contract Labour (Regulation & Abolition) Act, 1970 / OSH Code, 2020",
    short: "Contract labour & wage-roll workers",
    category: "Central — Labour law",
    authority: "Licensing Officer — Labour Department",
    applicability:
      "Principal employer engaging 20+ contract workers (50+ under the OSH Code) must register; contractors need a licence. Applies to the Daily Wages / Work Orders module.",
    coverage: "Contract & wage-roll staff on the muster (drivers, helpers, security, site crew).",
    rates: [
      {
        label: "Registration threshold",
        value: "50 contract workers (OSH Code) — 20 under the 1970 Act where state rules continue",
      },
      { label: "Principal employer liability", value: "Wages, PF, ESI if the contractor defaults" },
    ],
    dueDates: [
      {
        what: "Half-yearly return (Form XXIV) by contractor",
        when: "30 July / 30 January",
        frequency: "Half-yearly",
      },
      {
        what: "Annual return (Form XXV) by principal employer",
        when: "15 February",
        frequency: "Annual",
      },
    ],
    forms: ["Form I (registration)", "Form IV (licence)", "Form XXIV / XXV"],
    registers: [
      "Register of contractors (Form XII)",
      "Register of workmen (Form XIII)",
      "Muster roll (Form XVI)",
      "Wage register (Form XVII)",
    ],
    penalties: "Fine and imprisonment up to 3 months; licence cancellation.",
    latest: {
      on: "2025-11-21",
      note: "OSH Code, 2020 raises the threshold to 50 and introduces a single all-India licence for contractors.",
    },
    verify:
      "Reconcile the wage-roll headcount and work orders with contractor licences each quarter.",
    configuredIn: "Attendance → Daily Wages / Work Orders",
  },
  {
    code: "LABOUR-CODES",
    act: "Code on Wages 2019 · Industrial Relations Code 2020 · Code on Social Security 2020 · OSH Code 2020",
    short: "Four Labour Codes (in force 21 Nov 2025)",
    category: "Labour Codes 2025",
    authority: "Ministry of Labour & Employment; state rules",
    applicability:
      "All establishments. Replace 29 central labour laws; state rules notified progressively (Odisha draft rules published).",
    coverage: "Wages, social security, industrial relations, occupational safety.",
    rates: [
      {
        label: "Wage definition",
        value:
          "Allowances exceeding 50 % of total remuneration are added back to 'wages' — raises PF, gratuity, bonus and leave-encashment base",
      },
      {
        label: "Fixed-term employment",
        value: "Same benefits as permanent; gratuity after 1 year",
      },
      {
        label: "Working hours",
        value:
          "Up to 12 hours/day within 48 hours/week (4-day week possible); overtime cap 125 hours/quarter",
      },
      {
        label: "Leave",
        value:
          "Earned leave 1 per 20 days worked after 180 days; carry-forward 30 days; encashment of excess",
      },
      {
        label: "Gig & platform workers",
        value: "Social security fund — aggregator contribution 1–2 % of turnover",
      },
      { label: "Women", value: "Night shifts with consent & safety; equal remuneration" },
    ],
    dueDates: [
      {
        what: "Single electronic registration / returns (Shram Suvidha)",
        when: "As notified by state rules",
        frequency: "Annual",
      },
      {
        what: "Salary structure review under the 50 % rule",
        when: "Before the first payroll of the FY",
        frequency: "Annual",
      },
    ],
    forms: ["Unified annual return (Shram Suvidha)", "Appointment letter (mandatory)", "Wage slip"],
    registers: [
      "Employee register",
      "Wage register",
      "Attendance / overtime register — electronic",
    ],
    penalties:
      "Rationalised penalties with compounding; fines ₹50,000–₹3 L; imprisonment for repeat offences.",
    latest: {
      on: "2025-11-21",
      note: "All four Codes brought into force on 21 November 2025; transition period for state rules. Seereon HRMS salary structures keep Basic + DA ≥ 50 % of CTC to stay compliant.",
    },
    verify:
      "Track Odisha's final rules and re-run the 50 % structure check in Compensation for every grade.",
    configuredIn: "Compensation → Salary structures",
  },
  {
    code: "PAY-WAGES",
    act: "Payment of Wages Act, 1936 / Code on Wages, 2019",
    short: "Timely payment & permissible deductions",
    category: "Central — Labour law",
    authority: "Labour Commissioner",
    applicability: "All employees (wage ceiling removed by the Code).",
    coverage: "Monthly wages; deductions limited to those authorised.",
    rates: [
      {
        label: "Pay day",
        value: "By the 7th of the following month (10th for 1,000+ employees under the old Act)",
      },
      { label: "Deductions cap", value: "Total deductions ≤ 50 % of wages (fines ≤ 3 %)" },
      { label: "Final settlement", value: "Within 2 working days of separation (Code on Wages)" },
    ],
    dueDates: [
      {
        what: "Salary disbursement",
        when: "Seereon pay day: 1st (config) — statutory outer limit 7th",
        frequency: "Monthly",
      },
    ],
    forms: ["Wage slip", "Register of fines (Form I)", "Register of deductions (Form II)"],
    registers: ["Register of wages", "Register of fines / deductions"],
    penalties: "Fine up to ₹50,000; compensation up to 10× the withheld amount.",
    latest: {
      on: "2025-11-21",
      note: "Code on Wages: F&F within 2 working days; payroll's Exit → F&F workflow tracks this.",
    },
    verify: "Ensure the configured pay day and F&F timelines respect the Code.",
    configuredIn: "Statutory Config → Payroll",
    check: (cfg) => ({
      ok: cfg.payroll.payDay <= 7,
      note: `Configured pay day: ${cfg.payroll.payDay}${["th", "st", "nd", "rd"][cfg.payroll.payDay % 10 > 3 || Math.floor((cfg.payroll.payDay % 100) / 10) === 1 ? 0 : cfg.payroll.payDay % 10]} of the following month`,
    }),
  },
  {
    code: "NPS",
    act: "PFRDA Act, 2013 — Corporate NPS",
    short: "National Pension System (corporate)",
    category: "Central — Social security",
    authority: "PFRDA / CRA (Protean, KFintech)",
    applicability:
      "Voluntary; employer contribution deductible u/s 80CCD(2) up to 14 % of Basic + DA under the new regime.",
    coverage: "Employees enrolled with a PRAN.",
    rates: [
      { label: "Employee contribution", value: "Voluntary (not deductible under the new regime)" },
      {
        label: "Employer contribution",
        value: "Up to 14 % of Basic + DA — deductible u/s 80CCD(2)",
      },
    ],
    dueDates: [
      {
        what: "Remit contributions to CRA",
        when: "Within 15 days of deduction",
        frequency: "Monthly",
      },
    ],
    forms: ["CSRF (PRAN application)", "Contribution upload file (SCF)"],
    registers: ["NPS contribution register"],
    penalties: "Interest on delayed remittance per PFRDA circular.",
    latest: {
      on: "2025-04-01",
      note: "80CCD(2) limit for private-sector employers raised to 14 % under the new regime (Finance Act 2024).",
    },
    verify: "Confirm the CRA remittance cut-off and the 80CCD(2) cap.",
    configuredIn: "Payroll → Contributions",
    check: (cfg) => ({
      ok: cfg.tds.npsEmployerDeductionCapNewPct === 14,
      note: `Configured 80CCD(2) cap: ${cfg.tds.npsEmployerDeductionCapNewPct} % of Basic`,
    }),
  },
  {
    code: "EQUAL-REM",
    act: "Equal Remuneration Act, 1976 / Code on Wages, 2019 · Rights of Persons with Disabilities Act, 2016 · Apprentices Act, 1961",
    short: "Equal pay, disability & apprenticeship obligations",
    category: "Establishment & workplace",
    authority: "Labour Commissioner; Chief Commissioner for PwD; RDAT / NAPS portal",
    applicability:
      "Equal remuneration for same work; equal-opportunity policy & grievance officer for establishments with 20+ employees (RPwD); apprentices 2.5–15 % of strength for 30+ employees (Apprentices Act).",
    coverage: "All employees and apprentices.",
    rates: [
      {
        label: "Equal-opportunity policy",
        value:
          "Registered with the state commissioner; 4 % reservation applies to government establishments only",
      },
      {
        label: "Apprentices",
        value: "2.5 % minimum (up to 15 %) of total strength; stipend per NAPS bands",
      },
    ],
    dueDates: [
      {
        what: "Apprenticeship return (Form APP-1)",
        when: "Half-yearly on the portal",
        frequency: "Half-yearly",
      },
      {
        what: "RPwD records / policy publication",
        when: "On website; update on change",
        frequency: "Event",
      },
    ],
    forms: ["Equal-opportunity policy", "Apprenticeship contract (NAPS)"],
    registers: ["Register of apprentices", "Register of PwD employees (Form III)"],
    penalties:
      "Fines up to ₹5 L (RPwD, repeat); apprenticeship default fines ₹500 per month per shortfall.",
    latest: {
      on: "2025-01-01",
      note: "NAPS 2.0 with DBT stipend support; apprenticeship obligation extended to establishments with 30+ employees.",
    },
    verify: "Review apprentice headcount against the 2.5 % obligation each half-year.",
    configuredIn: "Recruitment → Apprentices",
  },
];

/** Annual compliance calendar — statutory events beyond the monthly remittances. */
export const ANNUAL_COMPLIANCE_CALENDAR = [
  {
    month: "April",
    item: "Form 12BB declarations open; VDA revision; PF annual reconciliation (Form 3A/6A by 30 Apr); TDS for March by 30 Apr",
    code: "TDS-192",
    authority: "CBDT / EPFO",
  },
  {
    month: "May",
    item: "Form 24Q Q4 by 31 May; ESI half-yearly return (Oct–Mar) by 11 May",
    code: "ESI",
    authority: "TRACES / ESIC",
  },
  {
    month: "June",
    item: "Form 16 to all employees by 15 June; Odisha PTEC by 30 June",
    code: "TDS-192",
    authority: "CBDT / CT&GST Odisha",
  },
  {
    month: "July",
    item: "Form 24Q Q1 by 31 July; Maharashtra LWF (Jan–Jun) by 15 July; CLRA half-yearly by 30 July",
    code: "LWF",
    authority: "TRACES / LWF Board",
  },
  {
    month: "August",
    item: "POSH annual awareness session; apprenticeship half-yearly return",
    code: "POSH",
    authority: "IC / NAPS",
  },
  {
    month: "October",
    item: "Form 24Q Q2 by 31 Oct; VDA revision; Diwali bonus planning",
    code: "MIN-WAGE",
    authority: "TRACES / Labour Dept",
  },
  {
    month: "November",
    item: "Statutory bonus payment by 30 Nov (Apr–Mar year); ESI half-yearly return (Apr–Sep) by 11 Nov",
    code: "BONUS",
    authority: "Labour Commissioner / ESIC",
  },
  {
    month: "December",
    item: "Karnataka / Tamil Nadu LWF annual contribution; investment proof collection begins",
    code: "LWF",
    authority: "LWF Boards",
  },
  {
    month: "January",
    item: "Form 24Q Q3 by 31 Jan; POSH annual report & Bonus Form D & S&E annual return by 31 Jan / 1 Feb; Maharashtra LWF by 15 Jan",
    code: "POSH",
    authority: "District Officer / Labour Dept",
  },
  {
    month: "February",
    item: "CLRA annual return by 15 Feb; Minimum Wages Form III by 1 Feb; final proof verification & TDS true-up",
    code: "CLRA",
    authority: "Labour Dept / CBDT",
  },
  {
    month: "March",
    item: "Lock declarations; year-end TDS adjustment; Maharashtra PT ₹300 month (Feb salary); gratuity / leave provisioning",
    code: "PT-OD",
    authority: "Finance",
  },
];

export const complianceStatus = (e, cfg = getStatutoryConfig()) => {
  if (!e.check)
    return {
      label: "Reference",
      ok: true,
      note: e.configuredIn ? `Maintained under ${e.configuredIn}` : "Reference only",
    };
  const r = e.check(cfg);
  return { label: r.ok ? "Aligned" : "Review", ok: r.ok, note: r.note };
};
