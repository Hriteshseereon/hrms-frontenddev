// Core (always on) and optional module checkboxes for a company. `value` / `onChange` hold the optional keys only.
import { CheckSquare, Lock, Square } from "lucide-react";
import { CORE_MODULES, OPTIONAL_MODULES, moduleLabel } from "@/config/modules";
import { cn } from "@/lib/utils";

export function ModuleChooser({ value, onChange, optional = OPTIONAL_MODULES, core = CORE_MODULES }) {
  const toggle = (key) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  const allOn = optional.length > 0 && optional.every((k) => value.includes(k));

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold">Core modules</div>
        <div className="text-muted-foreground mb-2 text-[11px]">
          Included for every company. They cannot be switched off.
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {core.map((key) => (
            <div
              key={key}
              className="border-primary/40 bg-primary/5 flex items-center gap-2 rounded-xl border px-3 py-2"
            >
              <CheckSquare className="text-primary h-4 w-4 shrink-0 opacity-60" />
              <span className="flex-1 truncate text-xs font-semibold">{moduleLabel(key)}</span>
              <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                <Lock className="h-3 w-3" /> Included
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold">Optional modules</div>
            <div className="text-muted-foreground text-[11px]">
              Only the checked ones are available to this company&apos;s users.
            </div>
          </div>
          <button
            type="button"
            className="text-primary text-xs font-medium hover:underline"
            onClick={() => onChange(allOn ? [] : [...optional])}
          >
            {allOn ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {optional.map((key) => {
            const on = value.includes(key);
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggle(key)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                  on ? "border-primary bg-primary/5" : "border-border/60 bg-card/60 hover:border-border",
                )}
              >
                {on ? (
                  <CheckSquare className="text-primary h-4 w-4 shrink-0" />
                ) : (
                  <Square className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
                <span className="flex-1 truncate text-xs font-semibold">{moduleLabel(key)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
