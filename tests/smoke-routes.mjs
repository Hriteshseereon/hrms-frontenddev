// Route smoke test: opens every screen as the role that owns it and records runtime errors.
// usage: node tests/smoke-routes.mjs [baseUrl]   (server must be running)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:3100";
const { PAGES } = await import(new URL("../src/routes/manifest.js", import.meta.url));
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DYN = {
  ":id": { helpdesk: "SRN-TKT-2026-0031" },
  ":token": { candidate: "k3m9x2p7q1w8e5r4" },
};
const USER = { org: "SRN-SUPER", emp: "SRN-0006", helpdesk: "SRN-0004" };

const list = PAGES.map((p) => p.path).map((r) => {
  const portal = r.split("/")[1];
  let url = r;
  for (const [k, v] of Object.entries(DYN)) if (url.includes(k)) url = url.replace(k, v[portal]);
  return { route: r, url, user: USER[portal] || null };
});

const browser = await chromium.launch({ executablePath: EXE });
const results = [];
for (const r of list) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  if (r.user)
    await ctx.addInitScript((id) => localStorage.setItem("seereon.session.user", id), r.user);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300));
  });
  let status = 0;
  try {
    const resp = await page.goto(BASE + r.url, { waitUntil: "networkidle", timeout: 45000 });
    status = resp ? resp.status() : 0;
    await page.waitForTimeout(600);
  } catch (e) {
    errors.push("goto: " + e.message.slice(0, 200));
  }
  const text = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 4000);
  const flags = [];
  if (/This page didn.t load/.test(text)) flags.push("ERROR-BOUNDARY");
  if (/Access denied|not available for your role/i.test(text)) flags.push("ACCESS-DENIED");
  if (text.trim().length < 40) flags.push("BLANK");
  results.push({
    ...r,
    status,
    finalUrl: page.url().replace(BASE, ""),
    errors: [...new Set(errors)],
    flags,
  });
  await ctx.close();
}
await browser.close();
const bad = results.filter((r) => r.errors.length || r.flags.length || r.status >= 400);
fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync("test-results/smoke-routes.json", JSON.stringify(results, null, 1));
console.log(`routes: ${results.length}  with problems: ${bad.length}`);
for (const b of bad)
  console.log(
    `${b.route} [${b.status}] → ${b.finalUrl} ${b.flags.join(",")}\n   ${b.errors.slice(0, 3).join("\n   ")}`,
  );
