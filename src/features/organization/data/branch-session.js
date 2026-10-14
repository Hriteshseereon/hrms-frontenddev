import { useSyncExternalStore } from "react";
import { BRANCHES } from "@/features/employees/data/hr-data";

/**
 * @typedef {Object} ManagedBranch
 * @property {string} id
 * @property {string} name
 * @property {string} office
 */

/** Every branch in the organization, flattened from the office → branch map. */
export const ALL_MANAGED_BRANCHES = Object.entries(BRANCHES).flatMap(([office, list]) =>
  list.map((name) => ({ id: `${office}::${name}`, name, office })),
);

/** Branches the signed-in admin is permitted to manage (demo scope). */
export const MY_BRANCH_IDS = [
  "Bhubaneswar HQ::Whitefield",
  "Bhubaneswar HQ::Koramangala",
  "Mumbai::BKC",
  "Pune::Hinjewadi",
  "Chennai::OMR",
];

export const MY_BRANCHES = ALL_MANAGED_BRANCHES.filter((b) => MY_BRANCH_IDS.includes(b.id));

const KEY = "seereon.org.branch";
let current = MY_BRANCHES[0]?.id ?? ALL_MANAGED_BRANCHES[0].id;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

/** Branches created per entity (group-data) are not in the static map — remember their label so the switcher can show them. */
let customLabel = null;
const LABEL_KEY = "seereon.org.branch.label";
if (typeof window !== "undefined") {
  const stored = window.localStorage.getItem(KEY);
  if (stored && MY_BRANCHES.some((b) => b.id === stored)) current = stored;
  else if (stored) {
    // An entity branch picked earlier: restore it with its saved label (it silently fell back to the first HQ branch on reload).
    try {
      const label = JSON.parse(window.localStorage.getItem(LABEL_KEY) ?? "null");
      if (label && label.id === stored) {
        current = stored;
        customLabel = label;
      }
    } catch {
      /* ignore */
    }
  }
}

export function setActiveBranch(id, label) {
  current = id;
  customLabel = label ? { id, ...label } : null;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, id);
    if (customLabel) window.localStorage.setItem(LABEL_KEY, JSON.stringify(customLabel));
    else window.localStorage.removeItem(LABEL_KEY);
  }
  emit();
}

function subscribe(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function useActiveBranch() {
  const id = useSyncExternalStore(
    subscribe,
    () => current,
    () => MY_BRANCHES[0].id,
  );
  return (
    MY_BRANCHES.find((b) => b.id === id) ??
    (customLabel && customLabel.id === id ? customLabel : MY_BRANCHES[0])
  );
}
