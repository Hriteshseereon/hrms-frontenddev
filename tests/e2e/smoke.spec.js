// Every screen renders for its owner without runtime errors or the error boundary.
import { test, expect } from "@playwright/test";
import { ROUTES, signInAs } from "./routes";

for (const r of ROUTES) {
  test(`renders ${r.route}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signInAs(page, r.user);
    const res = await page.goto(r.url, { waitUntil: "networkidle" });
    expect(res?.status() ?? 200).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText("This page didn't load");
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
}
