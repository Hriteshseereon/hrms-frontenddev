// Frontend-only export helpers — CSV, Excel (.xls) and print-to-PDF.
// Nothing here touches a server: documents are composed in the browser and handed to the user through a Blob
// download or the browser's print dialog. Every printed document shares one designed page: brand header band,
// filter chips, KPI tiles, a readable table (numbers right-aligned, zebra rows, repeating header, group bands,
// optional totals), a footer with page numbers, and an on-screen toolbar (Save as PDF / Print / A4 landscape).
import { resolveBrand } from "@/features/administration/data/brand-config";
import { activeOrgStore } from "@/features/organization/data/group-data";
import { getCurrentUser } from "@/features/auth/data/auth-session";

// Quotes are escaped too: brand name / logo URL are interpolated into HTML attributes (alt="…", src="…").
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
/** For CSS string literals (the @page footer) — HTML entities are not decoded inside <style>. */
const cssStr = (v) =>
  String(v ?? "")
    .replace(/[\\"]/g, "\\$&")
    .replace(/[<>\n\r]/g, " ");

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking synchronously cancels the download in Firefox / Safari — release the blob after the browser has picked it up.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Numbers, ₹ amounts, percentages and "12 h" style effort figures are right-aligned and tabular. */
const NUMERIC = /^[₹$€£]?\s?-?[\d,]+(\.\d+)?\s?(%|h|hrs|days?)?$/;
const isNumeric = (v) =>
  typeof v === "number" ||
  (typeof v === "string" &&
    NUMERIC.test(v.trim()) &&
    v.trim() !== "" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(v.trim()));
// Strip currency / thousands / unit suffixes the NUMERIC pattern accepts ("12 hrs", "3 days", "₹ 1,200", "45 %").
const toNumber = (v) =>
  typeof v === "number"
    ? v
    : Number(
        String(v)
          .replace(/(hrs|h|days?|%)\s*$/i, "")
          .replace(/[₹$€£,\s]/g, ""),
      ) || 0;
const fmtNumber = (n, decimals = 2) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
const stamp = () =>
  new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const docId = (prefix = "RPT") => `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

export function exportCsv(filename, columns, rows) {
  // Neutralise spreadsheet formulas (=, +, @, tab/CR, or "-" not followed by a number) — CSV/formula injection.
  const q = (v) => {
    let t = String(v ?? "");
    if (typeof v === "string" && /^[=+@\t\r]|^-(?![\d.])/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const csv = ["\uFEFF" + columns.map(q).join(","), ...rows.map((r) => r.map(q).join(","))].join(
    "\n",
  );
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

/** Excel-compatible spreadsheet (HTML table with Excel namespaces — opens natively in Excel with styling). */
export function exportExcel(filename, sheetName, columns, rows, meta = []) {
  const brand = resolveBrand(activeOrgStore.get());
  const cell = (v) =>
    typeof v === "number"
      ? `<td class="num" x:num>${v}</td>`
      : isNumeric(v)
        ? `<td class="num">${esc(v)}</td>`
        : `<td>${esc(v)}</td>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${esc(sheetName).slice(0, 28)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/><x:FrozenNoSplit/><x:SplitHorizontal>${4 + meta.length}</x:SplitHorizontal><x:TopRowBottomPane>${4 + meta.length}</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
 table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
 th { background: ${brand.accent}; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; white-space: nowrap; }
 td { border: 1px solid #e2e8f0; padding: 5px 10px; vertical-align: top; }
 td.num { text-align: right; mso-number-format: "#,##0.00"; }
 .title { font-size: 16pt; font-weight: bold; color: ${brand.accent}; border: none; }
 .sub { font-size: 12pt; font-weight: bold; border: none; }
 .muted { color: #64748b; border: none; font-size: 9pt; }
 .meta td { border: none; }
 .meta td:first-child { color: #64748b; }
</style></head><body>
<table>
 <tr><td class="title" colspan="${columns.length}">${esc(brand.name)}</td></tr>
 <tr><td class="sub" colspan="${columns.length}">${esc(sheetName)}</td></tr>
 <tr><td class="muted" colspan="${columns.length}">Generated ${stamp()} · ${esc(getCurrentUser().name)} · Seereon HRMS</td></tr>
 <tr><td class="muted" colspan="${columns.length}"></td></tr>
 ${meta.map((m) => `<tr class="meta"><td>${esc(m.label)}</td><td colspan="${Math.max(1, columns.length - 1)}"><b>${esc(m.value)}</b></td></tr>`).join("")}
 <tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>
 ${rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("")}
</table></body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filename}.xls`);
}

/* ------------------------------------------------------------------------------------------------ */
/* Print design                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

const hexToRgb = (hex) => {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "15, 107, 80";
};

const pageStyles = (brand, landscape) => `
  @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm 11mm 16mm; }
  @page { @bottom-left { content: "${cssStr(brand.name)} · Confidential"; font: 8px "Inter", "Segoe UI", Arial, sans-serif; color: #94a3b8; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px "Inter", "Segoe UI", Arial, sans-serif; color: #94a3b8; } }
  :root { --accent: ${brand.accent}; --accent-rgb: ${hexToRgb(brand.accent)}; --gold: #C8A951; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --soft: #f6f8fa; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e9edf1; }
  body { font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: var(--ink); font-size: 10.5px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #0f172a; color: #fff; font-size: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.25); }
  .toolbar .t { font-weight: 600; margin-right: auto; opacity: .9 }
  .toolbar button { border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.08); color: #fff; border-radius: 7px; padding: 6px 12px; font: inherit; cursor: pointer; }
  .toolbar button.primary { background: var(--accent); border-color: var(--accent); font-weight: 600; }
  .toolbar button:hover { filter: brightness(1.1); }
  .toolbar label { display: flex; align-items: center; gap: 6px; opacity: .85; cursor: pointer; }
  .page { background: #fff; width: ${landscape ? "297mm" : "210mm"}; min-height: ${landscape ? "210mm" : "297mm"}; margin: 18px auto; padding: 12mm 11mm 16mm; box-shadow: 0 10px 40px rgba(15,23,42,.18); }
  @media print { .toolbar { display: none !important; } html, body { background: #fff; } .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } }

  header.doc { display: flex; align-items: stretch; justify-content: space-between; gap: 18px; border-radius: 10px; overflow: hidden; margin-bottom: 14px; border: 1px solid var(--line); }
  header.doc .brand { display: flex; gap: 12px; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb), .82)); color: #fff; flex: 1 1 55%; }
  header.doc .brand img { height: 42px; width: 42px; border-radius: 10px; background: #fff; object-fit: contain; padding: 3px; }
  header.doc .brand h1 { font-size: 14.5px; margin: 0; letter-spacing: .2px; font-weight: 700; }
  header.doc .brand p { margin: 2px 0 0; font-size: 9px; opacity: .85; max-width: 360px; }
  header.doc .docmeta { flex: 1 1 45%; padding: 12px 16px; text-align: right; font-size: 9.5px; color: var(--muted); line-height: 1.55; background: #fff; }
  header.doc .docmeta strong { display: block; font-size: 16px; color: var(--ink); letter-spacing: .2px; margin-bottom: 2px; }
  header.doc .docmeta .sub { color: #334155; font-size: 10.5px; }
  header.doc .docmeta .id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9px; color: #94a3b8; }
  .bar { height: 4px; background: linear-gradient(90deg, var(--accent) 0 70%, var(--gold) 70% 100%); border-radius: 2px; margin: -8px 0 14px; }

  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); background: var(--soft); border-radius: 999px; padding: 3px 10px; font-size: 9.5px; color: #334155; }
  .chip b { color: var(--ink); font-weight: 600; }
  .chip i { font-style: normal; color: var(--muted); }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .kpi { border: 1px solid var(--line); border-radius: 9px; padding: 9px 12px; background: #fff; position: relative; overflow: hidden; }
  .kpi::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent); }
  .kpi span { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); margin-bottom: 3px; }
  .kpi b { font-size: 15px; font-weight: 700; letter-spacing: -.2px; font-variant-numeric: tabular-nums; }

  .section { margin: 14px 0 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--accent); display: flex; align-items: center; gap: 8px; }
  .section::after { content: ""; flex: 1; height: 1px; background: var(--line); }

  table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  thead { display: table-header-group; }
  th { background: var(--accent); color: #fff; text-align: left; padding: 7px 9px; font-size: 8.8px; text-transform: uppercase; letter-spacing: .55px; font-weight: 600; white-space: nowrap; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.nowrap, th.nowrap { white-space: nowrap; }
  td { padding: 6px 9px; border-bottom: 1px solid var(--line); font-size: 9.8px; vertical-align: top; }
  td:first-child { font-weight: 500; }
  tbody tr:nth-child(even) td { background: var(--soft); }
  tbody tr:last-child td { border-bottom: 0; }
  tr { page-break-inside: avoid; }
  tr.group td { background: rgba(var(--accent-rgb), .08) !important; color: var(--accent); font-weight: 700; font-size: 9.5px; letter-spacing: .3px; border-top: 1px solid rgba(var(--accent-rgb), .25); }
  tr.total td { background: #fff !important; font-weight: 700; border-top: 2px solid var(--accent); }
  tr.strong td { font-weight: 700; }
  .empty { padding: 26px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; }
  .count { margin-top: 8px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }

  .kv { width: 100%; border: 1px solid var(--line); border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .kv td { padding: 5px 10px; font-size: 9.8px; }
  .kv td:first-child { width: 28%; color: var(--muted); font-weight: 500; background: var(--soft); }
  .kv tr:last-child td { border-bottom: 0; }

  footer.doc { margin-top: 16px; border-top: 1px solid var(--line); padding-top: 8px; font-size: 8.6px; color: #94a3b8; display: flex; justify-content: space-between; gap: 16px; }
  .body-copy { font-size: 11.2px; line-height: 1.75; white-space: pre-wrap; }
  .body-copy h2 { font-size: 12.5px; margin: 16px 0 6px; color: var(--accent); }
  .sig { margin-top: 44px; display: flex; justify-content: space-between; gap: 40px; }
  .sig div { flex: 1; }
  .sig .line { border-top: 1px solid #94a3b8; margin-bottom: 5px; padding-top: 6px; }
  .stamp { display: inline-block; border: 1.5px solid var(--accent); color: var(--accent); border-radius: 5px; padding: 3px 9px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }
  .net { display: flex; align-items: center; justify-content: space-between; border-radius: 10px; padding: 12px 16px; background: linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb), .85)); color: #fff; margin-top: 14px; }
  .net span { font-size: 9px; text-transform: uppercase; letter-spacing: .8px; opacity: .85; }
  .net b { font-size: 20px; font-variant-numeric: tabular-nums; }
`;

const absoluteLogo = (logo) => {
  if (!logo) return "";
  if (/^(data:|https?:)/i.test(logo)) return logo;
  try {
    return new URL(logo, window.location.origin).href;
  } catch {
    return logo;
  }
};

function brandHeader(brand, title, subtitle, id) {
  const logo = brand.logo
    ? `<img src="${esc(absoluteLogo(brand.logo))}" alt="${esc(brand.name)} logo" onerror="this.style.display='none'" />`
    : "";
  return `<header class="doc">
    <div class="brand">${logo}
      <div><h1>${esc(brand.name)}</h1><p>${esc(brand.tagline)}</p><p>${esc(brand.address)}</p>
      <p>${esc(brand.email)} · ${esc(brand.phone)} · ${esc(brand.website)}</p></div>
    </div>
    <div class="docmeta"><strong>${esc(title)}</strong>
      ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ""}
      <div>Generated ${stamp()} · ${esc(getCurrentUser().name)}</div>
      <div class="id">${esc(id ?? docId())} · Seereon HRMS</div>
    </div>
  </header><div class="bar"></div>`;
}

function brandFooter(brand, note) {
  return `<footer class="doc"><span>${esc(note ?? brand.footer)}</span><span>${esc(brand.name)} · Confidential</span></footer>`;
}

/** JSON safe to embed inside an inline <script> (no "</script>" break-out). */
const scriptJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

function printDocument(html, brand, title, landscape = false) {
  const w = window.open("", "_blank", "width=1180,height=860");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style id="page-style">${pageStyles(brand, landscape)}</style></head><body>
    <div class="toolbar"><span class="t">${esc(title)}</span>
      <label><input type="checkbox" id="ls" ${landscape ? "checked" : ""}/> Landscape</label>
      <button onclick="window.print()">Print</button>
      <button class="primary" onclick="window.print()">Save as PDF</button>
      <button onclick="window.close()">Close</button></div>
    <div class="page">${html}</div>
    <script>
      (function(){
        var portrait = ${scriptJson(pageStyles(brand, false))}, land = ${scriptJson(pageStyles(brand, true))};
        var cb = document.getElementById('ls'), st = document.getElementById('page-style');
        cb.addEventListener('change', function(){ st.textContent = cb.checked ? land : portrait; });
        window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 350); };
      })();
    </script>
    </body></html>`);
  w.document.close();
  return true;
}

const numericColumns = (columns, rows) =>
  columns.map((_, ci) => {
    const vals = rows.map((r) => r[ci]).filter((v) => v !== undefined && v !== "" && v !== "—");
    return vals.length > 0 && vals.every(isNumeric);
  });

function tableHtml(columns, rows, opts = {}) {
  if (!rows.length) return `<div class="empty">No records for the selected filters.</div>`;
  const num = numericColumns(columns, rows);
  const dateCol = columns.map((_, ci) =>
    rows.some((r) => /^\d{4}-\d{2}-\d{2}/.test(String(r[ci] ?? ""))),
  );
  const cls = (i) => (num[i] ? "num" : dateCol[i] ? "nowrap" : "");
  const head = `<thead><tr>${columns.map((c, i) => `<th class="${cls(i)}">${esc(c)}</th>`).join("")}</tr></thead>`;
  const cell = (v, i) =>
    `<td class="${cls(i)}">${typeof v === "number" ? fmtNumber(v) : esc(v)}</td>`;
  let body = "";
  if (opts.groupBy !== undefined) {
    const g = opts.groupBy;
    const groups = new Map();
    rows.forEach((r) => {
      const k = String(r[g] ?? "—");
      groups.set(k, [...(groups.get(k) ?? []), r]);
    });
    groups.forEach((list, k) => {
      body += `<tr class="group"><td colspan="${columns.length}">${esc(k)} · ${list.length}</td></tr>`;
      body += list.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("");
    });
  } else {
    body = rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("");
  }
  if (opts.totals) {
    // Do not total percentage / rating columns, id-like columns or years.
    // Whole-word matches only: the previous pattern skipped "Wages", "Average", "Paid" and "Package" columns from totals.
    const skip = columns.map(
      (c, i) =>
        /%|percent|progress|rating|score|\byear\b|\bage\b|\bid$|\bno\.?$|number|serial|phone/i.test(
          c,
        ) || rows.some((r) => typeof r[i] === "string" && /%$/.test(String(r[i]))),
    );
    const which = (
      Array.isArray(opts.totals)
        ? opts.totals
        : num.map((n, i) => (n && i > 0 ? i : -1)).filter((i) => i >= 0)
    ).filter((i) => !skip[i]);
    if (which.length) {
      const sums = columns.map((_, i) =>
        which.includes(i) ? rows.reduce((s, r) => s + toNumber(r[i]), 0) : null,
      );
      body += `<tr class="total">${columns.map((_, i) => (i === 0 ? `<td>Total</td>` : sums[i] !== null ? `<td class="num">${/₹/.test(String(rows[0][i])) ? "₹\u00A0" : ""}${fmtNumber(sums[i])}</td>` : `<td></td>`)).join("")}</tr>`;
    }
  }
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

/** Designed tabular report opened in the print dialog (Save as PDF). */
export function exportReportPdf(opts) {
  const brand = resolveBrand(activeOrgStore.get());
  const landscape = opts.landscape ?? opts.columns.length > 8;
  const body = `
    ${brandHeader(brand, opts.title, opts.subtitle)}
    ${opts.filters?.length ? `<div class="chips">${opts.filters.map((f) => `<span class="chip"><i>${esc(f.label)}</i><b>${esc(f.value)}</b></span>`).join("")}</div>` : ""}
    ${opts.summary?.length ? `<div class="kpis">${opts.summary.map((s) => `<div class="kpi"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join("")}</div>` : ""}
    ${tableHtml(opts.columns, opts.rows, { totals: opts.totals, groupBy: opts.groupBy })}
    <div class="count"><span>${opts.rows.length} record(s)${opts.groupBy !== undefined ? ` · grouped by ${esc(opts.columns[opts.groupBy])}` : ""}</span><span>Figures in ₹\u00A0unless stated · ${esc(stamp())}</span></div>
    ${(opts.sections ?? []).map((s) => `<div class="section">${esc(s.title)}</div>${tableHtml(s.columns, s.rows, { totals: s.totals })}`).join("")}
    ${brandFooter(brand, opts.note)}`;
  return printDocument(body, brand, opts.title, landscape);
}

/** Letter-style document (offer letter, appointment letter, payslip note, …). */
export function exportLetterPdf(opts) {
  const brand = resolveBrand(activeOrgStore.get());
  const body = `
    ${brandHeader(brand, opts.title, opts.reference, opts.reference)}
    ${opts.recipient ? `<div class="body-copy"><b>${esc(opts.recipient.name)}</b><br/>${opts.recipient.lines.map(esc).join("<br/>")}</div><br/>` : ""}
    <div class="body-copy">${opts.bodyHtml}</div>
    ${opts.table ? `<div style="margin-top:16px">${tableHtml(opts.table.columns, opts.table.rows)}</div>` : ""}
    <div class="sig">
      <div><div class="line"></div><b>${esc(opts.signatory?.name ?? "Authorised Signatory")}</b><br/>
        <span style="color:#64748b">${esc(opts.signatory?.designation ?? "Human Resources")}, ${esc(brand.name)}</span></div>
      <div><div class="line"></div><b>Candidate / Employee acceptance</b><br/>
        <span style="color:#64748b">Name, signature &amp; date</span></div>
    </div>
    ${brandFooter(brand, opts.note)}`;
  return printDocument(body, brand, opts.title);
}

/** Fill {{tokens}} in a template body. */
export function fillTokens(body, values) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => values[k] ?? `—`);
}

/**
 * Wide matrix report (YTD summary, PF statement, Form 16 …): a left label column, one column per period and a
 * total column, with optional group header rows.
 */
export function exportMatrixPdf(opts) {
  const brand = resolveBrand(activeOrgStore.get());
  const span = opts.columns.length + (opts.totalLabel ? 2 : 1);
  const fmt = (v) => (typeof v === "number" ? fmtNumber(v) : esc(v));
  const body = `
    ${brandHeader(brand, opts.title, opts.subtitle)}
    ${opts.details?.length ? `<table class="kv"><tbody>${opts.details.map((d) => `<tr><td>${esc(d.label)}</td><td><b>${esc(d.value)}</b></td></tr>`).join("")}</tbody></table>` : ""}
    <table>
      <thead><tr><th>${esc(opts.title)}</th>${opts.columns.map((c) => `<th class="num">${esc(c)}</th>`).join("")}
      ${opts.totalLabel ? `<th class="num">${esc(opts.totalLabel)}</th>` : ""}</tr></thead>
      <tbody>
        ${opts.groups
          .map(
            (g) => `
          ${g.name ? `<tr class="group"><td colspan="${span}">${esc(g.name)}</td></tr>` : ""}
          ${g.rows
            .map(
              (r) => `<tr class="${r.strong ? "strong" : ""}">
              <td>${esc(r.label)}</td>
              ${r.values.map((v) => `<td class="num">${fmt(v)}</td>`).join("")}
              ${opts.totalLabel ? `<td class="num" style="font-weight:700">${fmt(r.total ?? "")}</td>` : ""}
            </tr>`,
            )
            .join("")}`,
          )
          .join("")}
      </tbody>
    </table>
    ${brandFooter(brand, opts.note)}`;
  return printDocument(body, brand, opts.title, opts.columns.length > 7);
}

/** Statutory-style payslip for a single pay period. */
export function exportPayslipPdf(opts) {
  const brand = resolveBrand(activeOrgStore.get());
  return printDocument(payslipBody(opts, brand), brand, `Payslip ${opts.period}`);
}

/** Every payslip of a run in ONE printable document (page break per employee) — Finance's bulk export. */
export function exportPayslipsBundlePdf(optsList, periodTitle) {
  const brand = resolveBrand(activeOrgStore.get());
  const body = optsList
    .map((o) => payslipBody(o, brand))
    .join('<div style="page-break-after:always"></div>');
  return printDocument(body, brand, `Payslips · ${periodTitle} (${optsList.length})`);
}

function payslipBody(opts, brand) {
  const rupee = (n) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gross = opts.earnings.reduce((s, e) => s + e.amount, 0);
  const ded = opts.deductions.reduce((s, e) => s + e.amount, 0);
  const rows = Math.max(opts.earnings.length, opts.deductions.length);
  const cell = (x) =>
    x ? `<td>${esc(x.label)}</td><td class="num">${rupee(x.amount)}</td>` : `<td></td><td></td>`;
  const info = [
    ["Employee", `${opts.employee.name} (${opts.employee.id})`],
    ["Designation", opts.employee.role],
    ["Department", opts.employee.dept],
    ["Location", opts.employee.branch],
    ...(opts.statutory ?? []).map((s) => [s.label, s.value]),
  ];
  const half = Math.ceil(info.length / 2);
  const kv = (list) =>
    `<table class="kv"><tbody>${list.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</tbody></table>`;

  const body = `
    ${brandHeader(brand, "Payslip", `Pay period · ${opts.period}`, `PS-${opts.employee.id}-${opts.period.replace(/\s+/g, "")}`)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${kv(info.slice(0, half))}${kv(info.slice(half))}</div>
    <table>
      <thead><tr><th>Earnings</th><th class="num">Amount (₹)</th><th>Deductions</th><th class="num">Amount (₹)</th></tr></thead>
      <tbody>
        ${Array.from({ length: rows }, (_, i) => `<tr>${cell(opts.earnings[i])}${cell(opts.deductions[i])}</tr>`).join("")}
        <tr class="total"><td>Gross Earnings</td><td class="num">${rupee(gross)}</td><td>Total Deductions</td><td class="num">${rupee(ded)}</td></tr>
      </tbody>
    </table>
    <div class="net"><div><span>Net pay · ${esc(opts.period)}</span><br/><b>₹\u00A0${rupee(opts.net)}</b></div><div style="text-align:right"><span>Status</span><br/><b style="font-size:13px">${esc(opts.status ?? "Paid")}</b></div></div>
    ${brandFooter(brand)}`;
  return body;
}
