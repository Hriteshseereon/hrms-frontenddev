// One-time migration helper: reads the legacy src/app/**/page.jsx wrappers and emits
// src/routes/manifest.js (route path → view module + title). After the migration the
// manifest is maintained by hand; this tool is kept only for reference.
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve("src/app");
const OUT = path.resolve("src/routes/manifest.js");

const SHELL_OF = (route) => {
  if (route.startsWith("/org")) return "org";
  if (route.startsWith("/emp")) return "emp";
  if (route.startsWith("/helpdesk")) return "helpdesk";
  if (route.startsWith("/app")) return "platform";
  return "bare";
};

const rows = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name === "page.jsx") {
      const src = fs.readFileSync(full, "utf8");
      const rel = path.relative(APP, path.dirname(full));
      const segs = rel.split(path.sep).filter((s) => s && !s.startsWith("("));
      const route = "/" + segs.join("/");
      const imp = src.match(/import\s+\w+\s+from\s+"(@\/features[^"]+)"/);
      const title = src.match(/title:\s*"([^"]+)"/);
      rows.push({
        path: route.replace(/\[(\w+)\]/g, ":$1"),
        shell: SHELL_OF(route),
        title: title ? title[1] : null,
        view: imp ? imp[1] : null,
      });
    }
  }
})(APP);

rows.sort((a, b) => a.path.localeCompare(b.path));

const body = rows
  .map(
    (r) =>
      `  { path: ${JSON.stringify(r.path)}, shell: ${JSON.stringify(r.shell)}, title: ${JSON.stringify(
        r.title,
      )}, load: () => import(${JSON.stringify(r.view)}) },`,
  )
  .join("\n");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  `// Route manifest — the single source of truth for every screen in the app.
// Consumed by src/routes/AppRouter.jsx (rendering), tools/gen-feature-catalog.mjs
// (feature catalog) and tests/route-matrix.mjs (verification).
export const PAGES = [
${body}
];
`,
);
console.log(`written ${OUT} (${rows.length} routes)`);
