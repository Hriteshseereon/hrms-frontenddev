// Generic "click a row → see the whole record" popup. Any list in the system can hand a row object to
// <RecordDetailDialog> and get a readable, sectioned view: scalars as key/value pairs, arrays of objects as tables,
// arrays of strings as chips, nested objects as sub-blocks, money-like keys formatted in ₹.
import { Fragment } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * @typedef {Record<string, unknown>} Rec
 */

const MONEY =
  /(amount|cost|ctc|salary|net|gross|deduction|premium|price|value|budget|fee|charge|advance|payable|bonus|emi|principal|balance|encash|gratuity|hike)/i;
const humanise = (k) =>
  k
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\bid\b/i, "ID")
    .replace(/^./, (c) => c.toUpperCase());

const isPlain = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Field names that hold uploaded file names — rendered as viewable attachment chips. */
const FILE_KEY =
  /^(attachment|attachments|documents|document|bills|billFiles|files|cv|resume|cvFile|proofFile|supportingDocs?|letterFile)$/i;
const FILE_NAME = /\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|csv|txt|zip|eml|msg)$/i;

export function formatValue(key, v) {
  if (v === null || v === undefined || v === "")
    return <span className="text-muted-foreground">—</span>;
  if (
    FILE_KEY.test(key) &&
    (typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")))
  )
    return <AttachmentChips names={v} context={humanise(key)} />;
  if (typeof v === "string" && FILE_NAME.test(v.trim()) && !/\s.*\s.*\s/.test(v.trim()))
    return <AttachmentChips names={[v.trim()]} context={humanise(key)} />;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (
      MONEY.test(key) &&
      !/(days|count|hours|pct|percent|rate|score|rating|seats|no$|number)/i.test(key)
    )
      return `₹\u00A0${v.toLocaleString("en-IN")}`;
    return v.toLocaleString("en-IN");
  }
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">—</span>;
    if (v.every((x) => typeof x !== "object"))
      return (
        <div className="flex flex-wrap gap-1">
          {v.map((x, i) => (
            <Badge key={i} variant="outline" className="font-normal">
              {String(x)}
            </Badge>
          ))}
        </div>
      );
    return <ObjectTable rows={v.filter(isPlain)} />;
  }
  if (isPlain(v)) return <SubBlock rec={v} />;
  return String(v);
}

function ObjectTable({ rows }) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) =>
    rows.some((r) => r[c] !== undefined && r[c] !== "" && !isPlain(r[c]) && !Array.isArray(r[c])),
  );
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground text-[10px] tracking-wider uppercase">
          <tr>
            {cols.map((c) => (
              <th key={c} className="p-2 text-left whitespace-nowrap">
                {humanise(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} className="p-2 align-top">
                  {formatValue(c, r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubBlock({ rec }) {
  return (
    <dl className="border-border bg-muted/20 grid grid-cols-1 gap-x-3 gap-y-1 rounded-lg border p-2 text-xs sm:grid-cols-2">
      {Object.entries(rec).map(([k, v]) => (
        <Fragment key={k}>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-28 shrink-0">{humanise(k)}</dt>
            <dd className="min-w-0 break-words">{formatValue(k, v)}</dd>
          </div>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * @typedef {Object} RecordSection
 * @property {string} title
 * @property {string[]} keys
 */

export function RecordView({ record, labels = {}, hide = [], sections, order }) {
  const hidden = new Set(hide);
  const entries = Object.entries(record).filter(([k]) => !hidden.has(k));
  const scalar = entries.filter(([, v]) => !Array.isArray(v) && !isPlain(v));
  const complex = entries.filter(([, v]) => Array.isArray(v) || isPlain(v));
  const label = (k) => labels[k] ?? humanise(k);
  const sortByOrder = (list) =>
    order
      ? [...list].sort(
          (a, b) =>
            (order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0])) -
            (order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0])),
        )
      : list;

  if (sections) {
    const used = new Set(sections.flatMap((s) => s.keys));
    const rest = entries.filter(([k]) => !used.has(k));
    return (
      <div className="space-y-4">
        {sections.map((s) => {
          const items = s.keys
            .map((k) => [k, record[k]])
            .filter(([k]) => !hidden.has(k) && k in record);
          if (!items.length) return null;
          return (
            <div key={s.title} className="border-border space-y-2 rounded-xl border p-4">
              <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {s.title}
              </div>
              <KVGrid items={items} label={label} />
            </div>
          );
        })}
        {rest.length > 0 && (
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Other details
            </div>
            <KVGrid items={rest} label={label} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="border-border rounded-xl border p-4">
        <KVGrid items={sortByOrder(scalar)} label={label} />
      </div>
      {complex.map(([k, v]) => (
        <div key={k} className="border-border space-y-2 rounded-xl border p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {label(k)}
          </div>
          {formatValue(k, v)}
        </div>
      ))}
    </div>
  );
}

function KVGrid({ items, label }) {
  const scalars = items.filter(([, v]) => !Array.isArray(v) && !isPlain(v));
  const complex = items.filter(([, v]) => Array.isArray(v) || isPlain(v));
  return (
    <div className="space-y-3">
      {scalars.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {scalars.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-muted-foreground w-36 shrink-0 pt-0.5 text-xs">{label(k)}</dt>
              <dd className="min-w-0 break-words">{formatValue(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {complex.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <div className="text-muted-foreground text-xs">{label(k)}</div>
          {formatValue(k, v)}
        </div>
      ))}
    </div>
  );
}

export function RecordDetailDialog({
  open = true,
  onClose,
  title,
  subtitle,
  record,
  labels,
  hide,
  sections,
  order,
  badges,
  children,
  footer,
  className,
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-2xl", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="text-primary h-4 w-4" /> {title}
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
        {children}
        <RecordView record={record} labels={labels} hide={hide} sections={sections} order={order} />
        {footer}
      </DialogContent>
    </Dialog>
  );
}

/** Row class to make any table row read as clickable. */
export const clickableRow = "cursor-pointer hover:bg-muted/30 transition";
