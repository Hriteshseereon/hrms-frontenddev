// Wiring checks the client team asked for, driven through the UI in one browser profile:
//   1. Roles & permissions: the Super Admin creates a role granting a screen on chosen branches to an
//      employee → that employee can now open the screen (and could not before).
//   2. Tasks: a manager creates tasks for two different employees → each employee sees exactly their own;
//      the assignee posts a progress update → the assigner sees it pending and approves → progress applies.
//   3. Announcements: published by HR → the employee's notices show it.
// usage: node tests/wiring-flows.mjs [baseUrl]
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "http://127.0.0.1:3200";
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SH = "/tmp/claude-0/-home-claude/b1600313-a53e-5fa0-9bdf-292b6933396c/scratchpad";
const browser = await chromium.launch({ executablePath: EXE });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 180)}` : ""}`,
  );
};
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
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

/* --- 1. Role created by the Super Admin grants a screen to an employee ------------------- */

// Before: the employee cannot open Claims (org finance screen).
await signIn("Employee", "subham@seereon.co.in", "Employee@123");
await page.goto(`${BASE}/org/claims`, { waitUntil: "networkidle" });
check(
  "before the role, the employee cannot open Claims",
  (await body()).match(/Access restricted|not available/i),
);

await signIn("Super Admin", "superadmin@seereon.co.in", "Super@123");
await page.goto(`${BASE}/org/roles/new`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
// Step 1 · details
await page.getByPlaceholder("e.g. Regional HR Manager").fill("Claims Desk (test)");
await page.getByRole("button", { name: /^Next/ }).click();
await page.waitForTimeout(300);
// Step 2 · branches — tick the first "whole company" / select-all checkbox
await page.locator('button[role="checkbox"]').first().click();
await page.getByRole("button", { name: /^Next/ }).click();
await page.waitForTimeout(300);
// Step 3 · screens — grant the "Reimbursements" screen (View is set automatically when a screen is ticked)
await page
  .locator("label", { hasText: /^Reimbursements/ })
  .first()
  .locator('button[role="checkbox"]')
  .click();
await page.getByRole("button", { name: /^Next/ }).click();
await page.waitForTimeout(300);
// Step 4 · permissions (defaults) → Next until the user-assignment step appears
for (let i = 0; i < 3; i++) {
  if (await page.getByPlaceholder(/Filter users/i).count()) break;
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.waitForTimeout(300);
}
check("user assignment step reached", (await page.getByPlaceholder(/Filter users/i).count()) === 1);
await page.getByPlaceholder(/Filter users/i).fill("Subham Das");
await page.waitForTimeout(300);
await page
  .locator("tr, label, div.flex", { hasText: "Subham Das" })
  .locator('button[role="checkbox"]')
  .first()
  .click();
// continue to review and submit
for (let i = 0; i < 3; i++) {
  const submit = page.getByRole("button", { name: /Submit Role/ });
  if (await submit.count()) {
    await submit.click();
    break;
  }
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(800);
await page.screenshot({ path: SH + "/w1-role.png" });
check("role submitted", (await body()).includes("Claims Desk (test)"));

// After: the employee can open Claims.
await signIn("Employee", "subham@seereon.co.in", "Employee@123");
await page.goto(`${BASE}/org/claims`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
check(
  "after the role, the employee opens Claims",
  !(await body()).match(/Access restricted|not available for your role/i),
);

/* --- 2. Tasks: assigned per employee, visible only to them, update → approval ------------- */

await signIn("Employee", "subh@seereon.co.in", "Manager@123");
await page.goto(`${BASE}/org/tasks`, { waitUntil: "networkidle" });
await page
  .getByRole("button", { name: /New Task/ })
  .first()
  .click();
await page.waitForTimeout(400);
const dlg = page.getByRole("dialog");
await dlg
  .getByPlaceholder("e.g. Build account-balance reconciliation service")
  .fill("Prepare UAT checklist (wiring test)");
await dlg
  .getByPlaceholder("One or two lines — what needs to be done")
  .fill("Cover payroll, leave and tasks flows.");
await dlg.getByPlaceholder("Filter people…").fill("Subham Das");
await page.waitForTimeout(300);
await dlg.locator("label", { hasText: "Subham Das" }).locator('button[role="checkbox"]').click();
const dates = dlg.locator('input[type="date"]');
const n = await dates.count();
for (let i = 0; i < n; i++) await dates.nth(i).fill("2026-11-30");
await dlg.getByRole("button", { name: /Create & assign/ }).click();
await page.waitForTimeout(700);
check("manager creates and assigns the task", (await body()).includes("Prepare UAT checklist"));

// The assignee sees it; another employee does not.
await signIn("Employee", "subham@seereon.co.in", "Employee@123");
await page.goto(`${BASE}/emp/tasks`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("assignee sees the task on My Tasks", (await body()).includes("Prepare UAT checklist"));

await signIn("Employee", "neha@seereon.co.in", "Employee@123");
await page.goto(`${BASE}/emp/tasks`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("another employee does not see it", !(await body()).includes("Prepare UAT checklist"));

// Assignee posts a progress update.
await signIn("Employee", "subham@seereon.co.in", "Employee@123");
await page.goto(`${BASE}/emp/tasks`, { waitUntil: "networkidle" });
await page.getByText("Prepare UAT checklist", { exact: false }).first().click();
await page.waitForTimeout(500);
const detail = page.getByRole("dialog");
const progressInput = detail.locator('input[type="number"]').first();
if (await progressInput.count()) await progressInput.fill("40");
await detail.getByPlaceholder("What changed on this task?").fill("Drafted the payroll section");
await detail.getByRole("button", { name: /Post update/i }).click();
await page.waitForTimeout(600);
check("assignee posts a progress update", (await body()).match(/Pending|awaiting/i));
await page.keyboard.press("Escape");

// The assigner sees it pending and approves.
await signIn("Employee", "subh@seereon.co.in", "Manager@123");
await page.goto(`${BASE}/org/tasks`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByText("Prepare UAT checklist", { exact: false }).first().click();
await page.waitForTimeout(500);
const d2 = page.getByRole("dialog");
const approveBtn = d2.getByRole("button", { name: /^Approve$/ }).first();
check("assigner sees the pending update", (await approveBtn.count()) > 0);
if (await approveBtn.count()) await approveBtn.click();
await page.waitForTimeout(500);
await page.keyboard.press("Escape");

// The assignee sees the approved progress.
await signIn("Employee", "subham@seereon.co.in", "Employee@123");
await page.goto(`${BASE}/emp/tasks`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("approved progress reflects for the assignee", (await body()).includes("40"));

/* --- 3. Announcement reaches employees ---------------------------------------------------- */

await signIn("Employee", "varen@seereon.co.in", "Hr@123");
await page.goto(`${BASE}/org/announcements`, { waitUntil: "networkidle" });
await page
  .getByRole("button", { name: /New Announcement|Publish/i })
  .first()
  .click();
await page.waitForTimeout(400);
const ad = page.getByRole("dialog");
await ad.getByRole("combobox").first().click();
await page.getByRole("option").first().click();
await ad.getByPlaceholder("e.g. Q3 All-Hands").fill("Diwali holiday schedule (wiring test)");
await ad.getByPlaceholder("Full message body…").fill("Offices remain closed on 29–31 October.");
const adDates = ad.locator('input[type="date"]');
const adN = await adDates.count();
for (let i = 0; i < adN; i++) await adDates.nth(i).fill(i === 0 ? "2026-10-09" : "2026-11-30");
await ad
  .getByRole("button", { name: /Publish/i })
  .last()
  .click();
await page.waitForTimeout(700);
check("HR publishes the announcement", (await body()).includes("Diwali holiday schedule"));

await signIn("Employee", "subham@seereon.co.in", "Employee@123");
await page.goto(`${BASE}/emp/notices`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("employee sees it on Notices", (await body()).includes("Diwali holiday schedule"));

check("no runtime errors across wiring flows", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
