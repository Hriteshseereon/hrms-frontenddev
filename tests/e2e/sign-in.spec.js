// Sign-in: each portal tab lands the right role on the right workspace of the organisation.
import { test, expect } from "@playwright/test";

const CASES = [
  {
    tab: "Super Admin",
    user: "superadmin@seereon.co.in",
    pass: "Super@123",
    lands: /\/org\/dashboard/,
  },
  {
    tab: "Admin",
    user: "admin@seereon.co.in",
    pass: "Admin@123",
    lands: /\/org\/dashboard/,
  },
  {
    tab: "Admin",
    user: "pune.admin@seereon.co.in",
    pass: "Branch@123",
    lands: /\/org\/dashboard/,
  },
  {
    tab: "Admin",
    user: "admin@sap.seereon.co.in",
    pass: "Admin@123",
    lands: /\/org\/dashboard/,
  },
  {
    tab: "Employee",
    user: "subham@seereon.co.in",
    pass: "Employee@123",
    lands: /\/emp\/dashboard/,
  },
  {
    tab: "Employee",
    user: "soumen.ghosh@cloud.seereon.co.in",
    pass: "Soumen@123",
    lands: /\/emp\/dashboard/,
  },
];

for (const c of CASES) {
  test(`${c.tab} sign-in (${c.user})`, async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: c.tab, exact: true }).click();
    await page.fill("#u", c.user);
    await page.fill("#p", c.pass);
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(c.lands);
  });
}

test("an unknown account is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Super Admin", exact: true }).click();
  await page.fill("#u", "nobody@nowhere.in");
  await page.fill("#p", "Wrong@123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/login/);
});

test("the wrong tab is refused with guidance", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Employee", exact: true }).click();
  await page.fill("#u", "superadmin@seereon.co.in");
  await page.fill("#p", "Super@123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/login/);
});

test("privacy and terms open from the sign-in page", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Privacy", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Privacy Policy");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Terms", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Terms of Use");
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/org/payroll-reports");
  await expect(page).toHaveURL(/\/login/);
});
