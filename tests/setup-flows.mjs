// Organisation administration flows, driven through the UI in one browser profile:
//   1. Organisation Setup wizard — walk the five steps, add a new company with a branch, apply;
//   2. Companies & Branches — the new company is there; issue its Company Admin (temporary password);
//   3. The issued Company Admin signs in and is forced to set an own password;
//   4. Branch view/edit and activate / deactivate (the deactivated branch leaves the pickers).
// usage: node tests/setup-flows.mjs [baseUrl]
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
  await page.waitForTimeout(1500);
}

// --- 1. Organisation Setup wizard
await signIn("Super Admin", "superadmin@seereon.co.in", "Super@123");
await page.goto(`${BASE}/org/organisation-setup`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
check("wizard opens prefilled", (await body()).includes("Seereon Group"));
await page.getByTestId("setup-next").click(); // → modules
await page.waitForTimeout(400);
check("module step shows the catalog", (await body()).includes("Core platform"));
await page.getByTestId("setup-next").click(); // → details
await page.waitForTimeout(300);
await page.getByTestId("setup-next").click(); // → structure
await page.waitForTimeout(400);
await page.getByTestId("setup-add-company").click();
const card = page.locator(".shadow-card", { hasText: "New company" }).last();
const inputs = card.locator("input");
await inputs.nth(0).fill("Seereon Analytics"); // Company name
await inputs.nth(1).fill("SRN-ANLT"); // Code
await inputs.nth(2).fill("Indore"); // City
await card.getByRole("button", { name: /^Branch$/ }).click();
await card
  .getByPlaceholder(/Branch name/)
  .last()
  .fill("Indore Hub");
await page.getByTestId("setup-next").click(); // → review
await page.waitForTimeout(400);
const review = await body();
check("review lists the new company as new", review.includes("Seereon Analytics"));
await page.getByTestId("setup-apply").click();
await page.waitForURL(/\/org\/groups/, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(900);
check("apply lands on Companies & Branches", page.url().includes("/org/groups"), page.url());

// --- 2. The new company exists; issue its Company Admin
const structure = await body();
check("new company card is there", structure.includes("Seereon Analytics"));
check("its branch is there", structure.includes("Indore Hub"));
const anltCard = page.getByTestId("company-SRN-ANLT");
await anltCard.getByRole("button", { name: /Company Admin/ }).click();
const dlg = page.getByRole("dialog");
await dlg.locator("input").nth(0).fill("Asha Patel");
await dlg.locator("input").nth(1).fill("asha@analytics.seereon.co.in");
await dlg.getByRole("button", { name: /Create & issue password/ }).click();
await page.waitForTimeout(700);
const issued = await page.getByRole("dialog").innerText();
const temp = issued.match(/Temporary password\s*\n?\s*(\S+)/)?.[1];
check("temporary password issued", !!temp, temp);
await page
  .getByRole("dialog")
  .getByRole("button", { name: /^Done$/ })
  .click();

// --- 3. The issued Company Admin signs in; must change the temporary password
await signIn("Admin", "asha@analytics.seereon.co.in", temp ?? "");
check(
  "issued admin signs in and is sent to set a new password",
  page.url().includes("/emp/profile"),
  page.url(),
);

// --- 4. Branch edit + deactivate / activate
await signIn("Super Admin", "superadmin@seereon.co.in", "Super@123");
await page.goto(`${BASE}/org/groups`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page
  .getByTestId("company-SRN-ANLT")
  .getByRole("button", { name: /View & edit branch Indore Hub/ })
  .click();
await page.getByRole("dialog").locator("input").first().fill("Indore Hub Office");
await page
  .getByRole("dialog")
  .getByRole("button", { name: /Save changes/ })
  .click();
await page.waitForTimeout(500);
check("branch renamed in place", (await body()).includes("Indore Hub Office"));
await page
  .getByTestId("company-SRN-ANLT")
  .getByRole("button", { name: /Deactivate branch Indore Hub Office/ })
  .click();
await page.waitForTimeout(400);
check(
  "deactivated branch is marked Inactive",
  (await page.getByTestId("company-SRN-ANLT").innerText()).includes("Inactive"),
);
// It must leave the scope picker
await page.getByTestId("scope-switcher-mobile").click();
await page.getByRole("menuitem", { name: /Seereon Analytics/ }).click();
await page.waitForTimeout(500);
await page.getByTestId("scope-switcher-mobile").click();
const menu = await page.locator('[role="menu"]').innerText();
check("inactive branch is out of the scope picker", !menu.includes("Indore Hub Office"), menu);
await page.keyboard.press("Escape");
await page.goto(`${BASE}/org/groups`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page
  .getByTestId("company-SRN-ANLT")
  .getByRole("button", { name: /Activate branch Indore Hub Office/ })
  .click();
await page.waitForTimeout(400);
check(
  "branch reactivated",
  !(await page.getByTestId("company-SRN-ANLT").innerText()).includes("Inactive"),
);

check("no runtime errors across the setup flows", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
