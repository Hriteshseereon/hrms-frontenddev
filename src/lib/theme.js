import { useSyncExternalStore } from "react";

/**
 * @typedef {"light" | "dark"} Theme
 */
const KEY = "seereon.theme";

let theme = "light";
const subs = new Set();
const emit = () => subs.forEach((f) => f());

function apply(t) {
  if (typeof document === "undefined") return;
  document.body.style.colorScheme = t;
  // Dialogs, dropdowns, selects and popovers are portalled to <body>, outside the root wrapper that carries the
  // `dark` class — without it on <html> every overlay rendered with light-mode colours in dark mode.
  document.documentElement.classList.toggle("dark", t === "dark");
}

let hydrated = false;

/** Call once after hydration so the stored theme is applied without an SSR mismatch. */
export function initTheme() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const stored = window.localStorage.getItem(KEY);
  theme = stored === "dark" || stored === "light" ? stored : "light";
  apply(theme);
  emit();
}

export function setTheme(t) {
  theme = t;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, t);
  apply(t);
  emit();
}

export function toggleTheme() {
  setTheme(theme === "dark" ? "light" : "dark");
}

function subscribe(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function useTheme() {
  return useSyncExternalStore(
    subscribe,
    () => theme,
    () => "light",
  );
}
