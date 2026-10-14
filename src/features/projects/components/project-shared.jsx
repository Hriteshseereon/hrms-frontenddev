import { findEmployee } from "@/features/employees/data/employee-directory";

/** Seeded employees plus anyone hired during the session (EMPLOYEES alone misses new joiners, who showed as raw ids). */
export const nameOf = (id) => findEmployee(id)?.name ?? id;

export function Kpi({ label, value, icon: Icon }) {
  return (
    <div className="border-border bg-card shadow-card rounded-lg border p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
