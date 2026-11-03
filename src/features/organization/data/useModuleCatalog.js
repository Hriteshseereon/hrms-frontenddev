import { useEffect, useState } from "react";
import { getModuleCatalog } from "@/api/modulesApi";
import { MODULES } from "@/features/platform/data/catalog";

const COLORS = [
  "text-blue-500 bg-blue-500/10",
  "text-amber-500 bg-amber-500/10",
  "text-emerald-500 bg-emerald-500/10",
  "text-purple-500 bg-purple-500/10",
  "text-rose-500 bg-rose-500/10",
  "text-orange-500 bg-orange-500/10",
  "text-indigo-500 bg-indigo-500/10",
  "text-cyan-500 bg-cyan-500/10",
];

const decorate = (items) =>
  items.map((m, i) => {
    const local = MODULES.find((x) => x.key === m.key);
    return {
      key: m.key,
      label: m.name ?? local?.name ?? m.key,
      desc: (m.submodules?.length ? m.submodules : (local?.submodules ?? [])).slice(0, 4).join(", "),
      icon: local?.icon,
      color: COLORS[i % COLORS.length],
    };
  });

/** Module checkboxes for the company form: the backend catalog (never invent keys), static list until it loads. */
export function useModuleCatalog() {
  const [items, setItems] = useState(() => decorate(MODULES.map((m) => ({ key: m.key, name: m.name }))));
  useEffect(() => {
    let alive = true;
    getModuleCatalog()
      .then((list) => {
        if (alive && list.length) setItems(decorate(list));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return items;
}
