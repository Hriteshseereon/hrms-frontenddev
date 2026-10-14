import { Building2, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MY_BRANCHES,
  setActiveBranch,
  useActiveBranch,
} from "@/features/organization/data/branch-session";

export function BranchSwitcher() {
  const active = useActiveBranch();

  const groups = Array.from(new Set(MY_BRANCHES.map((b) => b.office)));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border-border bg-muted/40 hover:border-primary/40 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition">
        <Building2 className="text-primary h-4 w-4" />
        <span className="hidden font-medium sm:inline">{active.name}</span>
        <span className="text-muted-foreground hidden text-xs xl:inline">· {active.office}</span>
        <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Branches you can manage
        </DropdownMenuLabel>
        {groups.map((office) => (
          <div key={office}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-[11px] tracking-wider uppercase">
              {office}
            </DropdownMenuLabel>
            {MY_BRANCHES.filter((b) => b.office === office).map((b) => (
              <DropdownMenuItem
                key={b.id}
                onSelect={() => {
                  setActiveBranch(b.id);
                  toast.success(`Switched to ${b.name} · ${b.office}`);
                }}
                className="flex items-center justify-between"
              >
                {b.name}
                {b.id === active.id && <Check className="text-primary h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
