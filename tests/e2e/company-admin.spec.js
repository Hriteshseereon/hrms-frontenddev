// Company Admin access from the employee list: a Company Admin (or Super Admin) makes an employee of the company a
// Company Admin, and can take it away again. The API is mocked, so this runs without a backend and changes no data.
import { test, expect } from "@playwright/test";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const ME = "33333333-3333-4333-8333-333333333333"; // the signed-in admin's user id
const ASHA = { id: "44444444-4444-4444-8444-444444444444", user_id: "55555555-5555-4555-8555-555555555555" };
const RAVI = { id: "66666666-6666-4666-8666-666666666666", user_id: "77777777-7777-4777-8777-777777777777" };
const OWN = { id: "88888888-8888-4888-8888-888888888888", user_id: ME };

const EMPLOYEES = [
  { ...ASHA, employee_code: "E-001", first_name: "Asha", last_name: "Verma", work_email: "asha@acme.test", company_id: COMPANY, status: "Active" },
  { ...RAVI, employee_code: "E-002", first_name: "Ravi", last_name: "Nair", work_email: "ravi@acme.test", company_id: COMPANY, status: "Active" },
  { ...OWN, employee_code: "E-003", first_name: "Own", last_name: "Admin", work_email: "me@acme.test", company_id: COMPANY, status: "Active" },
];

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Mocks the whole API. `calls` records the Company Admin requests; `listCalls` counts employee list reads. */
async function mockApi(page, { role = "COMPANY_ADMIN", admin } = {}) {
  const calls = [];
  const state = { listCalls: 0 };
  const user = {
    id: ME,
    email: "me@acme.test",
    full_name: "Own Admin",
    role,
    organization_id: ORG,
    company_id: role === "SUPER_ADMIN" ? null : COMPANY,
  };
  const access = {
    permitted_modules: ["employee", "attendance", "leave", "payroll", "organization", "administration"],
    permissions: ["employee.edit", "employee.view"],
    roles: [],
    branch_scope: "ALL",
    redirect_portal: "org",
    company: { name: "Acme Ltd" },
  };

  // A Super Admin works inside one company chosen in the header (kept in localStorage).
  if (role === "SUPER_ADMIN") {
    await page.addInitScript(
      ([id]) => localStorage.setItem("seereon.scope.company.v1", JSON.stringify({ id, name: "Acme Ltd" })),
      [COMPANY],
    );
  }

  // Anything not listed below answers with an empty list / object, so unrelated widgets stay quiet.
  await page.route(/\/api\/v1\//, (route) =>
    json(route, route.request().method() === "GET" ? { items: [], data: [], total: 0 } : {}),
  );
  await page.route(/\/api\/v1\/auth\/login/, (route) =>
    json(route, { access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer", user, ...access }),
  );
  await page.route(/\/api\/v1\/me(\?|$)/, (route) => json(route, { user, ...access }));
  await page.route(/\/api\/v1\/employees(\?|$)/, (route) => {
    state.listCalls += 1;
    return json(route, { items: EMPLOYEES, total: EMPLOYEES.length, page: 1, limit: 20 });
  });
  await page.route(/\/company-admins/, (route) => {
    const req = route.request();
    calls.push({ method: req.method(), url: new URL(req.url()).pathname, body: req.postDataJSON?.() ?? null });
    if (admin) return admin(route);
    const make = req.method() === "POST";
    return json(
      route,
      {
        success: true,
        data: { employee_id: ASHA.id, employee_code: "E-001", user_id: ASHA.user_id, full_name: "Asha Verma", email: "asha@acme.test", role: make ? "COMPANY_ADMIN" : "EMPLOYEE" },
        message: make
          ? "Company Admin set. The employee signs in again with the same email and password."
          : "Company Admin access removed.",
      },
      make ? 201 : 200,
    );
  });
  return { calls, state };
}

async function openEmployees(page) {
  await page.goto("/login");
  await page.fill("#u", "me@acme.test");
  await page.fill("#p", "Secret@123");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/org\/dashboard/);
  await page.goto("/org/employees");
  // The first visit compiles the screen in the dev server, so allow it time.
  await expect(page.getByText("Asha Verma")).toBeVisible({ timeout: 60_000 });
}

const menuFor = (page, name) => page.getByRole("button", { name: `More actions for ${name}` });

test("a Company Admin makes an employee of the company a Company Admin", async ({ page }) => {
  const { calls, state } = await mockApi(page);
  await openEmployees(page);
  const readsBefore = state.listCalls;

  await menuFor(page, "Asha Verma").click();
  await page.getByRole("menuitem", { name: "Make Company Admin" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Make Asha Verma a Company Admin?");
  await expect(dialog).toContainText("same email and password");
  await dialog.getByRole("button", { name: "Make Company Admin" }).click();

  await expect(page.getByText(/Company Admin set\./)).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe("POST");
  expect(calls[0].url).toBe(`/api/v1/super-admin/companies/${COMPANY}/company-admins`);
  expect(calls[0].body).toEqual({ employee_id: ASHA.id });
  // The list is read again after the change.
  await expect.poll(() => state.listCalls).toBeGreaterThan(readsBefore);
  // The page is usable again: the dropdown did not leave the page locked.
  await menuFor(page, "Ravi Nair").click();
  await expect(page.getByRole("menuitem", { name: "Make Company Admin" })).toBeVisible();
});

test("a Company Admin can take Company Admin access away", async ({ page }) => {
  const { calls } = await mockApi(page);
  await openEmployees(page);

  await menuFor(page, "Asha Verma").click();
  await page.getByRole("menuitem", { name: "Remove Company Admin" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Remove Company Admin access from Asha Verma?");
  await dialog.getByRole("button", { name: "Remove Company Admin" }).click();

  await expect(page.getByText("Company Admin access removed.")).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe("DELETE");
  expect(calls[0].url).toBe(`/api/v1/super-admin/companies/${COMPANY}/company-admins/${ASHA.id}`);
});

test("cancel sends nothing", async ({ page }) => {
  const { calls } = await mockApi(page);
  await openEmployees(page);
  await menuFor(page, "Asha Verma").click();
  await page.getByRole("menuitem", { name: "Make Company Admin" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(calls).toHaveLength(0);
});

test("the admin cannot remove their own Company Admin access", async ({ page }) => {
  await mockApi(page);
  await openEmployees(page);
  await menuFor(page, "Own Admin").click();
  await expect(page.getByRole("menuitem", { name: "Remove Company Admin" })).toHaveAttribute("data-disabled", "");
});

test("a server refusal is shown as a message", async ({ page }) => {
  await mockApi(page, {
    admin: (route) => json(route, { detail: "This employee is already a Company Admin" }, 409),
  });
  await openEmployees(page);
  await menuFor(page, "Ravi Nair").click();
  await page.getByRole("menuitem", { name: "Make Company Admin" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Make Company Admin" }).click();
  await expect(page.getByText("This employee is already a Company Admin")).toBeVisible();
});

test("a Branch Admin does not get the Company Admin actions", async ({ page }) => {
  await mockApi(page, { role: "BRANCH_ADMIN" });
  await openEmployees(page);
  await expect(menuFor(page, "Asha Verma")).toHaveCount(0);
});

test("a Super Admin uses the employee's own company", async ({ page }) => {
  const { calls } = await mockApi(page, { role: "SUPER_ADMIN" });
  await openEmployees(page);
  await menuFor(page, "Asha Verma").click();
  await page.getByRole("menuitem", { name: "Make Company Admin" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Make Company Admin" }).click();
  await expect(page.getByText(/Company Admin set\./)).toBeVisible();
  expect(calls[0].url).toBe(`/api/v1/super-admin/companies/${COMPANY}/company-admins`);
});
