// UI-only shared list state, persisted in the browser — tenant-aware.
//
// Screens used to hold their rows in local `useState`, so anything created in a dialog disappeared as soon as the
// user switched tabs or navigated away. This keeps each list in a module-level registry that is also written to
// localStorage (`seereon.list.<key>`), so records survive navigation AND reloads and stay in sync between the Org
// Admin screens and the Employee portal. The server render (and the hydration pass) always sees the seed, so
// markup is identical on both sides; the stored rows are applied right after hydration.
//
// Lists are namespaced through the same resolver as the persistent stores (see lib/persist.js): master lists are per
// company, or per group when the group Super Admin shares that master across companies; the default tenant keeps
// its original keys.
// import { useSyncExternalStore } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { onNamespaceChange, startingValue } from "@/lib/persist";

let resolver = (key) => ({ storageKey: key, initial: "seed" });
/** Registered by the tenancy layer — `key` is the logical list key, the result names the stored list. */
export function registerListResolver(fn) {
  resolver = fn;
}

const registry = new Map();
const seeds = new Map();
const hydratedKeys = new Set();
const listeners = new Map();
const storageKey = (key) => `seereon.list.${key}`;

function subscribers(key) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

const resolveKey = (key) => resolver(key) ?? { storageKey: key, initial: "seed" };

const readStored = (physical) => {
  if (registry.has(physical) && hydratedKeys.has(physical)) return registry.get(physical);
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(physical));
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

function hydrate(physical, res, seed) {
  if (hydratedKeys.has(physical) || typeof window === "undefined") return;
  hydratedKeys.add(physical);
  const stored = readStored(physical);
  registry.set(physical, stored !== undefined ? stored : startingValue(res, seed, readStored));
}

export function readList(key, seed) {
  if (!seeds.has(key)) seeds.set(key, seed);
  const res = resolveKey(key);
  const physical = res.storageKey;
  if (!registry.has(physical)) registry.set(physical, seed);
  hydrate(physical, res, seed);
  return registry.get(physical);
}

export function writeList(key, next) {
  const physical = resolveKey(key).storageKey;
  registry.set(physical, next);
  hydratedKeys.add(physical);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(physical), JSON.stringify(next));
    } catch (err) {
      console.warn(
        `[shared-list] could not save "${physical}" — browser storage is full; the change will not survive a reload.`,
        err,
      );
    }
  }
  subscribers(key).forEach((l) => l());
}

// A namespace change (sign-in, company switch, sharing toggle) re-renders every mounted list.
if (typeof window !== "undefined") {
  onNamespaceChange(() => listeners.forEach((set) => set.forEach((l) => l())));
}

/** Drop-in replacement for `useState<T[]>(seed)` that survives navigation and reloads. */
// export function useSharedList(key, seed) {
//   if (!seeds.has(key)) seeds.set(key, seed);
//   const value = useSyncExternalStore(
//     (cb) => {
//       subscribers(key).add(cb);
//       return () => subscribers(key).delete(cb);
//     },
//     () => readList(key, seed),
//     // Stable server / hydration snapshot: the first seed registered for this key.
//     () => seeds.get(key),
//   );

//   const set = (next) => {
//     const prev = readList(key, seed);
//     writeList(key, typeof next === "function" ? next(prev) : next);
//   };

//   return [value, set];
// }

/** Drop-in replacement for useState that survives navigation and reloads. */
export function useSharedList(key, seed) {
  if (!seeds.has(key)) seeds.set(key, seed);

  const value = useSyncExternalStore(
    (cb) => {
      subscribers(key).add(cb);
      return () => subscribers(key).delete(cb);
    },
    () => readList(key, seed),
    () => seeds.get(key),
  );

  const set = useCallback(
    (next) => {
      const prev = readList(key, seed);
      writeList(key, typeof next === "function" ? next(prev) : next);
    },
    [key, seed],
  );

  return [value, set];
}
