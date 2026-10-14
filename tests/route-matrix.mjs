// Route matrix: opens every screen as each role and records (a) whether it rendered or was access-restricted and
// (b) any runtime error. Used to compare a build against the approved baseline.
// usage: node tests/route-matrix.mjs <baseUrl> <out.json> [userIds comma-separated]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:3100";
const OUT = process.argv[3] || "route-matrix.json";
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const { PAGES } = await import(new URL("../src/routes/manifest.js", import.meta.url));

const USERS = (
  process.argv[4] ||
  "SRN-SUPER,SRN-ADMIN,SRN-0004,SRN-0002,SRN-0005,SRN-0017,SRN-0006,SRN-ADMIN-1042"
).split(",");

const DYN = {
  "/helpdesk/tickets/:id": "/helpdesk/tickets/SRN-TKT-2026-0031",
};
const all = PAGES.map((p) => DYN[p.path] ?? p.path).filter(
  (r) => !r.includes(":") && /^\/(org|emp|helpdesk)(\/|$)/.test(r),
);

const portalRoutes = () => all;

const browser = await chromium.launch({ executablePath: EXE });
const result = {};
async function runUser(id) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((uid) => localStorage.setItem("seereon.session.user", uid), id);
  const page = await ctx.newPage();
  let errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|favicon/.test(m.text()))
      errors.push("console: " + m.text().slice(0, 160));
  });
  const rows = {};
  for (const r of portalRoutes(id)) {
    errors = [];
    try {
      await page.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(900);
    } catch (e) {
      errors.push("goto: " + e.message.slice(0, 120));
    }
    const text =
      (await page
        .locator("main")
        .innerText()
        .catch(() => "")) || "";
    const url = new URL(page.url()).pathname;
    rows[r] = {
      landed: url,
      restricted: /Access restricted|not available for your role|You don.t have access/i.test(text),
      empty: text.trim().length < 20,
      errors: [...new Set(errors)],
    };
  }
  result[id] = rows;
  await ctx.close();
  console.log(
    `${id}: ${Object.keys(rows).length} routes, ${Object.values(rows).filter((x) => x.errors.length).length} with errors`,
  );
}
const queue = [...USERS];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) await runUser(queue.shift());
  }),
);
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`written ${OUT}`);
