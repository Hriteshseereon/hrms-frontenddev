// Tiny UI-only reactive store helper (no backend — everything lives in memory).
import { useSyncExternalStore } from "react";

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  const subscribe = (cb) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };
  return {
    get: () => state,
    subscribe,
    set: (next) => {
      state = typeof next === "function" ? next(state) : next;
      emit();
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => state,
        () => initial,
      ),
  };
}

export const nextId = (prefix, count) => `${prefix}-${String(count + 1).padStart(3, "0")}`;

export const inr = (n) => `₹\u00A0${Math.round(n).toLocaleString("en-IN")}`;
