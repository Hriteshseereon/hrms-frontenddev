import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * A link the user typed (task / project / training resource) made safe to render: http(s), mailto, tel and in-app
 * paths only. Anything else — `javascript:`, `data:`, `vbscript:` — becomes null so it is never rendered as a link.
 */
export function safeUrl(url) {
  const v = String(url ?? "").trim();
  if (!v) return null;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^\/(?!\/)/.test(v)) return v; // in-app path (not protocol-relative //host)
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // any other scheme
  return `https://${v}`; // bare host such as "docs.example.com/guide"
}
