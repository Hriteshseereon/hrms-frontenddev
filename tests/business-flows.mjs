// Cross-portal business flows inside the group, driven through the UI in one browser profile:
//   1. Leave: a Pune (Cloud Services) employee applies → the manager approves → the employee sees the decision;
//      the Cloud Company Admin sees it, the main company's HR never does (company isolation inside the group).
//   2. Branch scoping: Super Admin narrows Cloud Services to its other branch → the Pune request disappears.
//   3. Payroll maker–checker in the main company: HR prepares → Super Admin approves → CFO approves → processable.
//   4. Inter-company transfer: SAP HR raises → the group Super Admin confirms → the employee moves.
// usage: node tests/business-flows.mjs [baseUrl]
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "http://127.0.0.1:3200";
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: EXE });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 240)}` : ""}`,
  );
};
// One browser profile shared by every sign-in (the UI build keeps data in this browser's storage).
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
const body = () =>
  page
    .locator("body")
    .innerText()
    .catch(() => "");

async function signIn(tab, email, pw) {
  await page.evaluate(() => localStorage.removeItem("seereon.session.user")).catch(() => {});
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(`^${tab}$`) }).click();
  await page.fill("#u", email);
  await page.fill("#p", pw);
  await page.getByRole("button", { name: /^Sign in as/ }).click();
  await page.waitForURL(/\/(org|emp)\//, { timeout: 15000 }).catch(() => {});
}

// --- 1. Cloud Services (Pune) employee applies for leave
await signIn("Employee", "soumen.ghosh@cloud.seereon.co.in", "Soumen@123");
check("Cloud employee lands in the employee portal", page.url().includes("/emp/"), page.url());
await page.goto(`${BASE}/emp/leave`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Apply for leave$/ }).click();
const dlg = page.getByRole("dialog");
await dlg.getByRole("combobox").first().click();
const opts = page.getByRole("option");
const optTexts = await opts.allInnerTexts();
check("leave types are available", optTexts.length > 0, optTexts.join(" | "));
await page
  .getByRole("option", { name: /Casual/i })
  .first()
  .click()
  .catch(async () => opts.first().click());
const day = new Date();
day.setDate(day.getDate() + ((8 - day.getDay()) % 7 || 7)); // next Monday
const iso = day.toISOString().slice(0, 10);
await dlg.locator('input[type="date"]').first().fill(iso);
await dlg.locator('input[type="date"]').nth(1).fill(iso);
await dlg.getByPlaceholder("Reason for the leave").fill("Family function at village");
await dlg
  .getByRole("button", { name: /submit|apply/i })
  .last()
  .click();
await page.waitForTimeout(800);
check("application recorded as Pending", (await body()).includes("Pending"), iso);

// --- 2. The manager approves it
await signIn("Employee", "pallavi.chatterjee@cloud.seereon.co.in", "Pallavi@123");
await page.goto(`${BASE}/org/leave`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("manager sees the team member's request", (await body()).includes("Soumen Ghosh"));
const row = page.locator("tr", { hasText: "Soumen Ghosh" }).filter({ hasText: "Pending" }).first();
await row.getByRole("button", { name: /Approve/ }).click({ timeout: 5000 });
await page
  .getByRole("dialog")
  .getByRole("button", { name: /Confirm Approval/ })
  .click();
await page.waitForTimeout(700);
check(
  "manager approves",
  (await page.locator("tr", { hasText: "Soumen Ghosh" }).first().innerText()).includes("Approved"),
);

// --- 3. The employee sees the decision; the Company Admin sees it; the main company's HR does not
await signIn("Employee", "soumen.ghosh@cloud.seereon.co.in", "Soumen@123");
await page.goto(`${BASE}/emp/leave`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("employee sees the leave as Approved", (await body()).includes("Approved"));

await signIn("Admin", "admin@cloud.seereon.co.in", "Admin@123");
await page.goto(`${BASE}/org/leave`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("Cloud Company Admin sees the request", (await body()).includes("Soumen Ghosh"));

await signIn("Employee", "varen@seereon.co.in", "Hr@123");
await page.goto(`${BASE}/org/leave`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check(
  "main-company HR does not see another company's leave",
  !(await body()).includes("Soumen Ghosh"),
);

// --- 4. Super Admin: all of Cloud sees it; the Bhubaneswar branch scope hides Pune's request
await signIn("Super Admin", "superadmin@seereon.co.in", "Super@123");
await page.goto(`${BASE}/org/leave`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("Super Admin (collective) sees it", (await body()).includes("Soumen Ghosh"));
await page.getByTestId("scope-switcher-mobile").click();
await page.getByRole("menuitem", { name: /Seereon Cloud Services/ }).click();
await page.waitForTimeout(600);
check("Cloud company scope still shows it", (await body()).includes("Soumen Ghosh"));
await page.getByTestId("scope-switcher-mobile").click();
await page.getByRole("menuitem", { name: /Bhubaneswar HQ/ }).click();
await page.waitForTimeout(600);
check(
  "Bhubaneswar HQ branch scope hides Pune's request",
  !(await page.locator("main").innerText()).includes("Soumen Ghosh"),
);
// back to the collective view for the rest
await page.getByTestId("scope-switcher-mobile").click();
await page.getByRole("menuitem", { name: /All companies — collective view/ }).click();

// --- 5. Payroll maker–checker in the main company: HR → Super Admin → CFO → processable
await signIn("Employee", "varen@seereon.co.in", "Hr@123");
await page.goto(`${BASE}/org/finance`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /New Payroll Run/ }).click();
await page.getByRole("dialog").locator('input[type="month"]').fill("2026-09");
await page.getByRole("button", { name: /Create Draft/ }).click();
await page.waitForTimeout(700);
const lockBtn = page.getByRole("button", { name: /Lock month/ });
if (await lockBtn.count()) await lockBtn.first().click();
await page
  .getByRole("button", { name: /compliance checks/ })
  .first()
  .click();
await page.waitForTimeout(900);
const payroll = await page.locator("main").innerText();
check(
  "Odisha PT applied (state follows the branches)",
  payroll.includes("Odisha Professional Tax"),
);
check("seeded data surfaces a failing statutory check", payroll.includes("Check failed"));
// HR resolves the failing checks exactly as the flow prescribes: open the employee's checks, fix each record.
for (let round = 0; round < 4; round++) {
  const failed = page.getByText("Check failed · click to resolve");
  if (!(await failed.count())) break;
  await failed.first().click();
  await page.waitForTimeout(400);
  const fixDlg = page.getByRole("dialog");
  // Walk every open, HR-fixable error in this employee's dialog.
  for (const code of ["PF-UAN", "PF-NO"]) {
    const tab = fixDlg.getByRole("button", { name: new RegExp(`${code} · Open`) });
    if (!(await tab.count())) continue;
    await tab.click();
    await page.waitForTimeout(300);
    await fixDlg.getByRole("button", { name: "Fix record here" }).click();
    await page.waitForTimeout(300);
    await fixDlg
      .locator("input:visible")
      .first()
      .fill(code === "PF-UAN" ? "101234567890" : "OR/BBS/34721/0000042");
    await fixDlg.getByRole("button", { name: /Save & re-check/ }).click();
    await page.waitForTimeout(600);
    if (!(await page.getByRole("dialog").count())) break; // some saves close the dialog
  }
  if (await page.getByRole("dialog").count())
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Close$/ })
      .click()
      .catch(() => {});
  await page.waitForTimeout(300);
}
await page.getByRole("button", { name: /Re-run compliance checks/ }).click();
await page.waitForTimeout(1200);
check(
  "checks pass after HR fixes the records",
  (await page.locator("main").innerText()).includes("Checks Passed"),
);
const ack = page.getByRole("button", { name: /Acknowledge \d+ warning/ });
if (await ack.count()) await ack.first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Submit for .* approval/ }).click();
await page.waitForTimeout(600);
check(
  "HR submits for approval",
  (await page.locator("main").innerText()).includes("Pending Approval"),
);

for (const [who, tab, email, pw] of [
  ["Super Admin", "Super Admin", "superadmin@seereon.co.in", "Super@123"],
  ["CFO", "Employee", "saras@seereon.co.in", "Cfo@123"],
]) {
  await signIn(tab, email, pw);
  await page.goto(`${BASE}/org/finance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if (who === "Super Admin") {
    // approvals are a company action: step into the main company first
    const gate = page.getByTestId("scope-gate");
    if (await gate.count()) {
      await gate.getByRole("combobox").first().click();
      await page.getByRole("option", { name: /^Seereon$/ }).click();
      await gate.getByRole("button", { name: /Work here/ }).click();
      await page.waitForTimeout(600);
    }
  }
  await page.locator("tr", { hasText: "September 2026 Salary" }).first().click();
  await page.waitForTimeout(400);
  const approve = page.getByRole("button", { name: /^Approve$/ });
  check(`${who} can approve their level`, (await approve.count()) > 0);
  if (await approve.count()) await approve.first().click();
  await page.waitForTimeout(600);
}
const after = await page.locator("main").innerText();
// "Process — generate payslips" is offered only once every approval level has cleared.
check("run is Approved after both levels", after.includes("Process — generate payslips"));

// --- 6. Inter-company transfer: SAP HR raises → the group Super Admin confirms
await signIn("Employee", "falguni.rathore@sap.seereon.co.in", "Falguni@123");
await page.goto(`${BASE}/org/employees`, { waitUntil: "networkidle" });
await page.getByRole("tab", { name: /Transfers/ }).click();
await page.getByRole("tab", { name: /Transfer to Group Company/ }).click();
await page.getByRole("button", { name: /New Group Transfer/ }).click();
const gt = page.getByRole("dialog");
await gt.getByRole("combobox").first().click();
await page.getByRole("option", { name: /Manjeet Bhati/ }).click();
await gt.getByRole("combobox").nth(1).click();
await page.getByRole("option", { name: /Seereon Cloud Services/ }).click();
await gt.locator('input[type="date"]').fill("2026-11-01");
await gt.getByPlaceholder("e.g. Site Engineer").fill("Senior Consultant — Cloud");
await gt
  .getByPlaceholder("Why is this transfer happening?")
  .fill("Project move to the cloud practice");
await gt.getByRole("button", { name: /Submit for confirmation/ }).click();
await page.waitForTimeout(800);
check("transfer raised, pending confirmation", (await body()).includes("Pending Confirmation"));

await signIn("Super Admin", "superadmin@seereon.co.in", "Super@123");
await page.goto(`${BASE}/org/employees`, { waitUntil: "networkidle" });
await page.getByRole("tab", { name: /Transfers/ }).click();
await page.getByRole("tab", { name: /Transfer to Group Company/ }).click();
await page.waitForTimeout(600);
const pendingRow = page.locator("tr", { hasText: "Manjeet Bhati" }).first();
check("Super Admin sees the pending transfer", (await pendingRow.count()) > 0);
await pendingRow.getByRole("button", { name: /^Confirm$/ }).click();
await page.waitForTimeout(800);
check("Super Admin confirms the transfer", (await pendingRow.innerText()).includes("Confirmed"));

check("no runtime errors across the flows", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
