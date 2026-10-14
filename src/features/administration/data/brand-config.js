// Branding used by exported PDFs, letters and templates.
//
// Branding is per Organization (legal entity) with a group-level default as the
// fallback, so a payslip or letter generated inside an org always carries that
// org's logo, name, address and footer. UI-only store.
import { createPersistentStore } from "@/lib/persist";
import { SEEREON_LOGO_DATA_URL } from "@/features/administration/data/brand-logo";

/**
 * @typedef {Object} BrandConfig
 * @property {string} name
 * @property {string} tagline
 * @property {string} logo
 * @property {string} address
 * @property {string} email
 * @property {string} phone
 * @property {string} website
 * @property {string} footer
 * @property {string} accent
 */

/** Group-level default brand — used when an org has no override. Persisted: the name, logo, tagline and footer saved in
 *  Settings used to be held in memory only and reverted to the defaults on the next reload. */
export const brandStore = createPersistentStore("seereon.brand.default.v1", {
  name: "Seereon Consulting & IT Services",
  tagline: "ISO 9001:2015 · SAP · Custom ERP · Digital Transformation",
  logo: SEEREON_LOGO_DATA_URL,
  address: "Khandagiri, Bhubaneswar 751003, Odisha, India",
  email: "people@seereon.co.in",
  phone: "+91 90 9070 5533",
  website: "www.seereon.co.in",
  footer:
    "This is a system generated document from Seereon HRMS and does not require a physical signature unless stated otherwise.",
  accent: "#0f766e",
});

export const setBrand = (patch) => brandStore.set((p) => ({ ...p, ...patch }));

/* ------------------------------------------------------------------ */
/* Per-organization overrides                                          */
/* ------------------------------------------------------------------ */

export const orgBrandStore = createPersistentStore("seereon.brand.orgs.v1", {
  "ORG-1042": {
    name: "Seereon SAP Practice",
    tagline: "SAP. Delivered right.",
    address: "Level 3, Cyber Towers, HITEC City, Hyderabad 500081, Telangana, India",
    email: "people@sap.seereon.co.in",
    website: "www.sap.seereon.co.in",
    accent: "#7c4a12",
  },
  "ORG-1043": {
    name: "Seereon Cloud Services",
    tagline: "Cloud-native. Always on.",
    address: "Tower B, Hinjewadi Phase 1, Pune 411057, Maharashtra, India",
    email: "hr@cloud.seereon.co.in",
    website: "www.cloud.seereon.co.in",
    accent: "#334155",
  },
});

/**
 * The accent colour is written into the CSS of every exported PDF / Excel document, so only a real colour value is
 * accepted — free text there (e.g. `</style><script>…`) would run in the window of whoever exports the document.
 */
const safeBrand = (b) => ({
  ...b,
  accent: /^#[0-9a-f]{3,8}$/i.test(String(b.accent ?? "").trim()) ? b.accent.trim() : "#0f766e",
});

/** Merge group default + organization override. */
export function resolveBrand(orgId) {
  const base = brandStore.get();
  if (!orgId) return safeBrand(base);
  return safeBrand({ ...base, ...(orgBrandStore.get()[orgId] ?? {}) });
}

export function useResolvedBrand(orgId) {
  const base = brandStore.use();
  const overrides = orgBrandStore.use();
  if (!orgId) return safeBrand(base);
  return safeBrand({ ...base, ...(overrides[orgId] ?? {}) });
}

export const setOrgBrand = (orgId, patch) =>
  orgBrandStore.set((p) => ({ ...p, [orgId]: { ...(p[orgId] ?? {}), ...patch } }));

export const clearOrgBrand = (orgId) =>
  orgBrandStore.set((p) => {
    const next = { ...p };
    delete next[orgId];
    return next;
  });
