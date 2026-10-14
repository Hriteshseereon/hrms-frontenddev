// Responsive audit: every screen × viewport (× every tab on the screen).
// Flags page-level horizontal scroll, elements escaping the viewport, clipped button/label text and
// undersized touch targets. usage: node tests/responsive-audit.mjs [baseUrl] [--only=/org/leave,/emp/leave] [--vp=360,390]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:3100";
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "")
  .slice(7)
  .split(",")
  .filter(Boolean);
const VPARG = (process.argv.find((a) => a.startsWith("--vp=")) || "")
  .slice(5)
  .split(",")
  .filter(Boolean)
  .map(Number);
const DIALOG_VP = (process.argv.find((a) => a.startsWith("--dialogs=")) || "--dialogs=360,1280")
  .slice(10)
  .split(",")
  .map(Number);
const WORKERS = Number(
  (process.argv.find((a) => a.startsWith("--workers=")) || "--workers=4").slice(10),
);
const { PAGES } = await import(new URL("../src/routes/manifest.js", import.meta.url));
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DYN = {
  ":id": { helpdesk: "SRN-TKT-2026-0031" },
  ":token": { candidate: "k3m9x2p7q1w8e5r4" },
};
const USER = { org: "SRN-SUPER", emp: "SRN-0006", helpdesk: "SRN-0004" };
const VIEWPORTS = [
  { w: 360, h: 780, mobile: true },
  { w: 390, h: 844, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1024, h: 768, mobile: false },
  { w: 1280, h: 800, mobile: false },
  { w: 1440, h: 900, mobile: false },
].filter((v) => !VPARG.length || VPARG.includes(v.w));

const list = PAGES.map((p) => p.path)
  .filter((r) => !ONLY.length || ONLY.includes(r))
  .map((r) => {
    const portal = r.split("/")[1];
    let url = r;
    for (const [k, v] of Object.entries(DYN)) if (url.includes(k)) url = url.replace(k, v[portal]);
    return { route: r, url, user: USER[portal] || null };
  });

/** Runs inside the page. Returns the layout problems visible right now. */
function inspect() {
  const vw = document.documentElement.clientWidth;
  const describe = (el) => {
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 8).join(".");
    const txt = (el.innerText || el.getAttribute("aria-label") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 50);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${txt ? ` "${txt}"` : ""}`;
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // an ancestor that clips or scrolls horizontally contains the overflow legitimately
  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return a;
    }
    return null;
  };
  const decorative = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (
        s.position === "absolute" ||
        s.pointerEvents === "none" ||
        a.getAttribute("aria-hidden") === "true"
      )
        return true;
      if (s.transform && s.transform !== "none") return true; // progress indicators, sliders, marquees
      if (a.getAttribute("role") === "progressbar" || a.getAttribute("role") === "slider")
        return true;
      if (a.tagName === "svg" || a.closest?.("svg")) return true;
    }
    return false;
  };
  // closed off-canvas drawers sit outside the viewport on purpose
  const offCanvas = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.position === "fixed") {
        const r = a.getBoundingClientRect();
        return r.right <= 1 || r.left >= vw - 1;
      }
    }
    return false;
  };
  const out = {
    pageOverflow: document.documentElement.scrollWidth - vw,
    escaping: [],
    cutOff: [],
    clippedText: [],
    smallTargets: 0,
  };
  const scope = document.querySelector("[role=dialog]") || document.body;
  const all = scope.querySelectorAll("*");
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const pr = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
    const sticksOut =
      r.right > vw + 1 || r.left < -1 || (pr && (r.right > pr.right + 2 || r.left < pr.left - 2));
    if (!sticksOut) continue;
    if (el.closest("[data-sonner-toaster], [aria-hidden=true]")) continue;
    const box = clipped(el);
    // content cut off by an overflow:hidden/clip parent (not a scroll container, not decoration or ellipsis text)
    if (box && !decorative(el) && visible(el) && !offCanvas(el)) {
      const bs = getComputedStyle(box);
      if (bs.overflowX === "hidden" || bs.overflowX === "clip") {
        const b = box.getBoundingClientRect();
        const es = getComputedStyle(el);
        if (
          (r.right > b.right + 2 || r.left < b.left - 2) &&
          es.textOverflow !== "ellipsis" &&
          bs.textOverflow !== "ellipsis" &&
          b.width > 40
        ) {
          const p = el.parentElement.getBoundingClientRect();
          if (!(p.right > b.right + 2 || p.left < b.left - 2))
            out.cutOff.push(
              `${describe(el)} [${Math.round(r.left)}→${Math.round(r.right)} in ${Math.round(b.left)}→${Math.round(b.right)}]`,
            );
        }
      }
    }
    if ((r.right > vw + 1 || r.left < -1) && !box && !offCanvas(el) && visible(el)) {
      // report only the outermost escaping element of a subtree
      const parentEscapes =
        el.parentElement &&
        (() => {
          const p = el.parentElement.getBoundingClientRect();
          return p.right > vw + 1 || p.left < -1;
        })();
      if (!parentEscapes)
        out.escaping.push(`${describe(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    // text spilling past the border of its card or tile (overflow visible, so nothing clips it and it overlaps the edge)
    if (
      !decorative(el) &&
      visible(el) &&
      !offCanvas(el) &&
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    ) {
      const card = el.parentElement?.closest(
        ".rounded-xl.border, .rounded-lg.border, .rounded-2xl.border",
      );
      let scrolls = false;
      for (let a = el.parentElement; card && a && a !== card.parentElement; a = a.parentElement)
        if (getComputedStyle(a).overflowX !== "visible") scrolls = true;
      if (card && !scrolls) {
        const c = card.getBoundingClientRect();
        if (r.right > c.right + 1 || r.left < c.left - 1)
          out.cutOff.push(
            `${describe(el)} spills out of its card [${Math.round(r.left)}→${Math.round(r.right)} in ${Math.round(c.left)}→${Math.round(c.right)}]`,
          );
      }
    }
  }
  // Text geometry from the text nodes themselves (absolutely positioned badges/dots are ignored).
  const textBox = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rects = [];
    let wrapped = 0;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      let abs = false;
      for (let a = n.parentElement; a && a !== el; a = a.parentElement) {
        const cs = getComputedStyle(a);
        // absolutely positioned dots/badges and intentionally truncated text (ellipsis / line-clamp) are fine
        if (
          cs.position === "absolute" ||
          cs.textOverflow === "ellipsis" ||
          cs.webkitLineClamp !== "none"
        )
          abs = true;
      }
      if (abs) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const own = [...rg.getClientRects()].filter((q) => q.width > 0.5);
      rects.push(...own);
      // one short text node laid out on several lines = the label wrapped (long descriptions may wrap)
      if (
        new Set(own.map((q) => Math.round(q.top / 4))).size > 1 &&
        n.textContent.trim().length <= 32
      )
        wrapped++;
    }
    if (!rects.length) return null;
    return {
      left: Math.min(...rects.map((q) => q.left)),
      right: Math.max(...rects.map((q) => q.right)),
      lines: wrapped ? 2 : 1,
    };
  };
  const controls = scope.querySelectorAll("button, a[role=button], [role=tab], [data-slot=badge]");
  for (const el of controls) {
    if (!visible(el) || offCanvas(el)) continue;
    const s = getComputedStyle(el);
    const tb = textBox(el);
    const r = el.getBoundingClientRect();
    if (tb) {
      const inL = r.left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth) - 1;
      const inR = r.right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth) + 1;
      const clippedX = (tb.left < inL - 1 || tb.right > inR + 1) && s.textOverflow !== "ellipsis";
      const wraps = tb.lines > 1;
      if (clippedX || wraps)
        out.clippedText.push(
          `${describe(el)} (${clippedX ? "text outside box" : ""}${clippedX && wraps ? ", " : ""}${wraps ? "label wraps" : ""})`,
        );
    }
    if (
      el.matches("button, a[role=button]") &&
      // a checkbox / switch inside its <label> is tapped through the whole label row
      !el.matches("label [role=checkbox], label [role=switch], label [role=radio]") &&
      vw < 800 &&
      (r.height < 32 || r.width < 32) &&
      (el.innerText || "").trim().length < 2
    )
      out.smallTargets++;
  }
  out.escaping = [...new Set(out.escaping)].slice(0, 12);
  out.cutOff = [...new Set(out.cutOff)].slice(0, 12);
  out.clippedText = [...new Set(out.clippedText)].slice(0, 12);
  return out;
}

const OPENERS =
  /^(new|add|apply|create|raise|request|issue|assign|invite|upload|import|record|log|schedule|book|hire|initiate|start|submit claim|claim|declare|refer|report an issue|return)/i;
/** Open dialogs launched from buttons on the screen, inspect them, close with Escape. */
async function probeDialogs(page, findings, state, max) {
  const buttons = page.locator("main button:visible, main a[role=button]:visible");
  const count = Math.min(await buttons.count().catch(() => 0), 60);
  let opened = 0;
  const seen = new Set();
  for (let i = 0; i < count && opened < max; i++) {
    const b = buttons.nth(i);
    const label = ((await b.innerText().catch(() => "")) || "").trim().replace(/\s+/g, " ");
    if (!label || !OPENERS.test(label) || seen.has(label)) continue;
    seen.add(label);
    const before = page.url();
    await b.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(350);
    if (page.url() !== before) {
      await page.goBack().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.locator("[role=dialog]").count()) {
      opened++;
      const f = await page.evaluate(inspect);
      if (f.pageOverflow > 1 || f.escaping.length || f.cutOff.length || f.clippedText.length)
        findings.push({ state: `${state} › dialog: ${label.slice(0, 40)}`, ...f });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      if (await page.locator("[role=dialog]").count()) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }
  }
}

async function auditPage(browser, r, vp) {
  return Promise.race([
    auditPageInner(browser, r, vp),
    new Promise((res) =>
      setTimeout(
        () => res([{ route: r.route, vp: vp.w, state: "error", error: "timeout (300 s)" }]),
        300000,
      ),
    ),
  ]);
}
async function auditPageInner(browser, r, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
  });
  if (r.user)
    await ctx.addInitScript((id) => localStorage.setItem("seereon.session.user", id), r.user);
  const page = await ctx.newPage();
  const findings = [];
  try {
    await page.goto(BASE + r.url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(500);
    const base = await page.evaluate(inspect);
    findings.push({ state: "page", ...base });
    // every tab on the screen (top-level tablists first)
    const tabs = page.locator("[role=tablist] [role=tab]");
    const n = Math.min(await tabs.count(), 24);
    for (let i = 0; i < n; i++) {
      const t = tabs.nth(i);
      if (!(await t.isVisible().catch(() => false))) continue;
      if ((await t.getAttribute("data-state")) === "active") continue;
      const label = ((await t.innerText().catch(() => "")) || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      await t.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);
      const f = await page.evaluate(inspect);
      findings.push({ state: `tab: ${label}`, ...f });
      if (DIALOG_VP.includes(vp.w)) await probeDialogs(page, findings, `tab: ${label}`, 2);
    }
    if (DIALOG_VP.includes(vp.w)) {
      await page.goto(BASE + r.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await probeDialogs(page, findings, "page", 8);
    }
  } catch (e) {
    findings.push({ state: "error", error: e.message.slice(0, 200) });
  }
  await ctx.close();
  return findings
    .filter(
      (f) =>
        f.error ||
        f.pageOverflow > 1 ||
        f.escaping?.length ||
        f.cutOff?.length ||
        f.clippedText?.length,
    )
    .map((f) => ({ route: r.route, vp: vp.w, ...f }));
}

const browser = await chromium.launch({ executablePath: EXE });
const jobs = [];
for (const r of list) for (const vp of VIEWPORTS) jobs.push([r, vp]);
const results = [];
let done = 0;
fs.mkdirSync("test-results", { recursive: true });
const partialFile = `test-results/responsive-audit${ONLY.length || VPARG.length ? "-partial" : ""}.jsonl`;
fs.writeFileSync(partialFile, "");
async function worker() {
  while (jobs.length) {
    const [r, vp] = jobs.shift();
    const found = await auditPage(browser, r, vp);
    results.push(...found);
    for (const f of found) fs.appendFileSync(partialFile, JSON.stringify(f) + "\n");
    if (++done % 25 === 0) process.stderr.write(`${done} checked\n`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await browser.close();
fs.mkdirSync("test-results", { recursive: true });
const file = `test-results/responsive-audit${ONLY.length || VPARG.length ? "-partial" : ""}.json`;
fs.writeFileSync(file, JSON.stringify(results, null, 1));
const overflow = results.filter((r) => r.pageOverflow > 1);
console.log(
  `screens×viewports: ${list.length * VIEWPORTS.length}  findings: ${results.length}  page-overflow: ${overflow.length}  escaping: ${results.filter((r) => r.escaping?.length).length}  cut-off: ${results.filter((r) => r.cutOff?.length).length}  text: ${results.filter((r) => r.clippedText?.length).length}  → ${file}`,
);
