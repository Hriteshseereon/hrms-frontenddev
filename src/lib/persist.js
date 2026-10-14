// Tiny localStorage-backed reactive store (UI-only persistence, SSR-safe) — tenant-aware.
//
// Every store is namespaced by a resolver registered by the tenancy layer (features/organization/data/tenancy.js):
//   • global stores (sign-in, platform, structure) keep one copy for the whole product;
//   • tenant stores keep one copy per client organisation, so one client can never read or overwrite another's
//     records even if a screen forgets to filter;
//   • master / configuration stores keep one copy per company — or one per group when the group Super Admin has
//     switched that master to "same across all companies".
// The default tenant (Seereon Group, the approved v6 demo) resolves to the original storage keys, so its data and
// behaviour are byte-for-byte what v6 had.
import { useSyncExternalStore } from "react";

/**
 * @typedef {Object} NamespaceResolution
 * @property {string} storageKey - localStorage key for the active namespace.
 * @property {"seed" | "empty" | "inherit" | "value"} [initial] - How a namespace that has never been written starts.
 * @property {string} [inheritKey] - When initial = "inherit": the storage key to copy the starting value from.
 * @property {*} [value] - When initial = "value": the starting value (e.g. a client's own brand defaults).
 */

/** @type {(key: string) => NamespaceResolution} */
let resolver = (key) => ({ storageKey: key, initial: "seed" });
let version = 0;
const nsListeners = new Set();

/** Registered once by the tenancy layer. */
export function registerNamespaceResolver(fn) {
  resolver = fn;
  namespaceChanged();
}
/** Signals that the signed-in tenant / company / sharing toggles changed — every store re-resolves and re-renders. */
export function namespaceChanged() {
  version += 1;
  nsListeners.forEach((l) => l());
}
export const onNamespaceChange = (fn) => {
  nsListeners.add(fn);
  return () => nsListeners.delete(fn);
};
export const namespaceVersion = () => version;

const emptyOf = (v) => (Array.isArray(v) ? [] : v && typeof v === "object" ? { ...v } : v);
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/** Reads raw JSON from localStorage (null when absent or unreadable). */
function readRaw(storageKey) {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Resolves the starting value of a never-written namespace. */
export function startingValue(res, seed, readCurrent) {
  if (res.initial === "value") return clone(res.value);
  if (res.initial === "empty") return emptyOf(seed);
  if (res.initial === "inherit" && res.inheritKey) {
    const inherited = readCurrent ? readCurrent(res.inheritKey) : readRaw(res.inheritKey);
    return inherited === undefined ? clone(seed) : clone(inherited);
  }
  return seed;
}

export function createPersistentStore(key, initial) {
  /** storageKey → { state, hydrated } */
  const slots = new Map();
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  let cachedVersion = -1;
  let cachedRes = null;

  const resolve = () => {
    if (cachedVersion !== version || !cachedRes) {
      cachedRes = resolver(key) ?? { storageKey: key, initial: "seed" };
      cachedVersion = version;
    }
    return cachedRes;
  };

  const slotFor = (storageKey) => {
    let slot = slots.get(storageKey);
    if (!slot) {
      slot = { state: undefined, hydrated: false };
      slots.set(storageKey, slot);
    }
    return slot;
  };

  const peek = (storageKey) => {
    const s = slots.get(storageKey);
    if (s && s.hydrated) return s.state;
    return readRaw(storageKey);
  };

  const current = () => {
    const res = resolve();
    const slot = slotFor(res.storageKey);
    if (!slot.hydrated) {
      if (typeof window === "undefined") return initial;
      slot.hydrated = true;
      const stored = readRaw(res.storageKey);
      slot.state = stored !== undefined ? stored : startingValue(res, initial, peek);
    }
    return slot.state;
  };

  const write = (storageKey, state) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (err) {
      // Quota exceeded (large images) — the change stays in memory for this session only. Say so instead of failing silently.
      console.warn(
        `[persist] could not save "${storageKey}" — browser storage is full; the change will not survive a reload.`,
        err,
      );
    }
  };

  if (typeof window !== "undefined") {
    // Another tab (e.g. the admin portal next to the employee portal) changed this store — pick the change up live.
    window.addEventListener("storage", (e) => {
      if (!e.key || e.storageArea !== window.localStorage) return;
      if (e.key !== key && !e.key.startsWith(`${key}@`) && !e.key.startsWith(`${key}#`)) return;
      try {
        const slot = slotFor(e.key);
        slot.state = e.newValue ? JSON.parse(e.newValue) : startingValue(resolve(), initial, peek);
        slot.hydrated = true;
        if (e.key === resolve().storageKey) emit();
      } catch {
        /* ignore malformed cache */
      }
    });
    onNamespaceChange(() => {
      cachedVersion = -1;
      emit();
    });
  }

  const subscribe = (cb) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  return {
    get: () => current(),
    set: (next) => {
      const prev = current();
      const state = typeof next === "function" ? next(prev) : next;
      const res = resolve();
      const slot = slotFor(res.storageKey);
      slot.state = state;
      slot.hydrated = true;
      write(res.storageKey, state);
      emit();
    },
    /** The storage key the store currently reads and writes (diagnostics, tests). */
    storageKey: () => resolve().storageKey,
    /** Reactive read. Server render always sees `initial` to keep hydration stable. */
    use: () => useSyncExternalStore(subscribe, current, () => initial),
  };
}
