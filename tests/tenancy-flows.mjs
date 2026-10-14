// Organisation access & scoping checks: sign-in tabs, company / branch isolation inside the group, the collective
// (read-only) view, Branch Admin lock, and configuration gates (organisation-wide and per-company).
// Server must be running.  usage: node tests/tenancy-flows.mjs [baseUrl]
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "http://127.0.0.1:3200";
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: EXE });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 200)}` : ""}`,
  );
};

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      errors.push(m.text().slice(0, 200));
  });
  return { ctx, page, errors };
}

async function signIn(page, tab, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: new RegExp(`^${tab}$`, "i") })
    .first()
    .click();
  await page.fill("#u", email);
  await page.fill("#p", password);
  await page.getByRole("button", { name: /^Sign in as/ }).click();
  await page.waitForTimeout(1500);
}

const text = async (page) =>
  (await page
    .locator("body")
    .innerText()
    .catch(() => "")) || "";

// 1. Sign-in page: the organisation, the three tabs, working Privacy / Terms
{
  const { ctx, page, errors } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const t = await text(page);
  check("/login shows the organisation", t.includes("Seereon Group"));
  check(
    "three sign-in tabs",
    ["Super Admin", "Admin", "Employee"].every((n) => t.includes(n)),
  );
  await page.getByRole("button", { name: "Privacy", exact: true }).first().click();
  await page.waitForTimeout(300);
  check("Privacy opens a policy dialog", (await text(page)).includes("Privacy Policy"));
  await page.keyboard.press("Escape");
  check("no runtime errors on sign-in page", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 2. Wrong tab and unknown account are refused
{
  const { ctx, page } = await fresh();
  await signIn(page, "Employee", "superadmin@seereon.co.in", "Super@123");
  check("Super Admin on the Employee tab is refused", page.url().includes("/login"), page.url());
  await signIn(page, "Employee", "nobody@nowhere.in", "x");
  check("unknown account is refused", page.url().includes("/login"), page.url());
  await ctx.close();
}

// 3. Super Admin: collective view, scope chip in the sidebar (not the header)
{
  const { ctx, page, errors } = await fresh();
  await signIn(page, "Super Admin", "superadmin@seereon.co.in", "Super@123");
  check("Super Admin lands on the dashboard", page.url().includes("/org/dashboard"), page.url());
  check(
    "no scope dropdown in the header",
    (await page.getByTestId("scope-switcher").count()) === 0,
  );
  const chip = await page
    .getByTestId("scope-switcher-mobile")
    .innerText()
    .catch(() => "");
  check("sidebar scope chip shows all companies", chip.includes("all 4 companies"), chip);
  await page.goto(`${BASE}/org/employees`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check(
    "collective Employees shows the 'choose company' gate",
    (await page.getByTestId("scope-gate").count()) === 1,
  );
  const t = await text(page);
  check(
    "collective Employees list combines companies",
    t.includes("Devraj Solanki") && t.includes("Varen Mishra"),
  );
  check("no runtime errors (collective)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 4. Company Admin: own company only, no Configuration
{
  const { ctx, page, errors } = await fresh();
  await signIn(page, "Admin", "admin@sap.seereon.co.in", "Admin@123");
  await page.goto(`${BASE}/org/employees`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const t = await text(page);
  check("SAP Company Admin sees SAP staff", t.includes("Manjeet Bhati"));
  check("SAP Company Admin does not see the main company's staff", !t.includes("Subham Das"));
  await page.goto(`${BASE}/org/configuration`, { waitUntil: "networkidle" });
  check(
    "Configuration is Super Admin only",
    (await text(page)).match(/Access restricted|not available/i),
  );
  await page.goto(`${BASE}/org/organisation-setup`, { waitUntil: "networkidle" });
  check(
    "Organisation Setup is Super Admin only",
    (await text(page)).match(/Access restricted|not available/i),
  );
  check("no runtime errors (company admin)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 5. Branch Admin: locked to the branch, no payroll
{
  const { ctx, page, errors } = await fresh();
  await signIn(page, "Admin", "pune.admin@seereon.co.in", "Branch@123");
  await page.waitForURL(/\/org\//, { timeout: 10000 }).catch(() => {});
  const chip = await page
    .getByTestId("scope-switcher-mobile")
    .innerText()
    .catch(() => "");
  check("Branch Admin chip is locked to Pune", chip.includes("Pune"), chip);
  await page.goto(`${BASE}/org/employees`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const t = await text(page);
  check("Branch Admin does not see other branches' staff", !t.includes("Subham Das"));
  await page.goto(`${BASE}/org/finance`, { waitUntil: "networkidle" });
  check(
    "Branch Admin cannot open payroll",
    (await text(page)).match(/Access restricted|not available/i),
  );
  check("no runtime errors (branch admin)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 6 + 7. Configuration gates in one browser profile (config lives in this browser's storage):
//   organisation-wide off → blocked for everyone · per-company off → blocked only in that company.
{
  const { ctx, page } = await fresh();
  // Organisation-wide: Performance off
  await signIn(page, "Super Admin", "superadmin@seereon.co.in", "Super@123");
  await page.goto(`${BASE}/org/configuration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByTestId("ent-performance").getByRole("switch").first().click();
  await page.waitForTimeout(400);
  await signIn(page, "Employee", "varen@seereon.co.in", "Hr@123");
  await page.goto(`${BASE}/org/performance`, { waitUntil: "networkidle" });
  check(
    "module switched off organisation-wide is blocked for HR",
    (await text(page)).match(/Access restricted|not available/i),
  );
  // back on
  await signIn(page, "Super Admin", "superadmin@seereon.co.in", "Super@123");
  await page.goto(`${BASE}/org/configuration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByTestId("ent-performance").getByRole("switch").first().click();
  await page.waitForTimeout(400);

  // Per-company: Performance off for the SAP company only
  await page.getByRole("combobox", { name: "Configuration scope" }).click();
  await page.getByRole("option", { name: /Seereon SAP Practice — whole company/ }).click();
  await page.waitForTimeout(300);
  await page.getByTestId("ent-performance").getByRole("switch").first().click();
  await page.waitForTimeout(400);

  await signIn(page, "Employee", "falguni.rathore@sap.seereon.co.in", "Falguni@123");
  await page.goto(`${BASE}/org/performance`, { waitUntil: "networkidle" });
  check(
    "SAP HR is blocked by the company override",
    (await text(page)).match(/Access restricted|not available/i),
  );
  await signIn(page, "Employee", "varen@seereon.co.in", "Hr@123");
  await page.goto(`${BASE}/org/performance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  check("main-company HR still opens Performance", !(await text(page)).match(/Access restricted/i));

  // reset the override
  await signIn(page, "Super Admin", "superadmin@seereon.co.in", "Super@123");
  await page.goto(`${BASE}/org/configuration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("combobox", { name: "Configuration scope" }).click();
  await page.getByRole("option", { name: /Seereon SAP Practice — whole company/ }).click();
  await page.waitForTimeout(300);
  await page.getByTestId("ent-performance").getByRole("switch").first().click();
  await page.waitForTimeout(400);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
