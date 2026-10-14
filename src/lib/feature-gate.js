// Feature (tab) gate — lets the tenancy layer hide a tab that the organisation has switched off, without the
// screens knowing about configuration. The shared <TabsTrigger> / <TabsContent> primitives consult it.
import { useSyncExternalStore } from "react";

let gate = () => true;
let version = 0;
const listeners = new Set();

/** `fn(pathname, tabValue)` → false hides the tab. Registered by features/organization/data/tenancy.js. */
export function registerTabGate(fn) {
  gate = fn;
  bumpFeatureGate();
}
export function bumpFeatureGate() {
  version += 1;
  listeners.forEach((l) => l());
}
const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Reactive: re-renders when configuration, the signed-in user or the organisation changes. */
export function useTabEnabled(pathname, value) {
  const v = useSyncExternalStore(
    subscribe,
    () => version,
    () => -1,
  );
  // Server and hydration render show every tab (the configuration lives in the browser until the API is wired).
  if (v === -1 || !pathname || value == null) return true;
  try {
    return gate(pathname, String(value)) !== false;
  } catch {
    return true;
  }
}
