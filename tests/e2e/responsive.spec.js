// No screen scrolls sideways and no element escapes the viewport (phone and tablet widths).
import { test, expect } from "@playwright/test";
import { ROUTES, signInAs } from "./routes";

const WIDTHS = [360, 390, 768];

for (const r of ROUTES) {
  for (const width of WIDTHS) {
    test(`${r.route} fits ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signInAs(page, r.user);
      await page.goto(r.url, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(1);
    });
  }
}
