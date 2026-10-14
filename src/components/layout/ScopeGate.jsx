// Shown on module screens while the Super Admin is in the collective (all companies) view: the data is combined and
// view-only, and adding or changing a record starts by choosing the company — and branch — it belongs to.
import { useState } from "react";
import { usePathname } from "@/lib/router";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { visibleBranches } from "@/features/organization/data/group-data";
import {
  setActiveCompany,
  setActiveScopeBranch,
  useScope,
} from "@/features/organization/data/tenancy";
import { screenOf } from "@/features/platform/data/feature-catalog";

/** Screens where the collective view is the point (insights, group set-up) — no banner there. */
const INSIGHT_ROUTES = [
  "/org/dashboard",
  "/org/reports",
  "/org/payroll-reports",
  "/org/asset-rollup",
  "/org/groups",
  "/org/configuration",
  "/org/announcements",
  "/org/notifications",
];

export function ScopeGate() {
  const pathname = usePathname();
  const scope = useScope();
  const [orgId, setOrgId] = useState("");
  const [branchId, setBranchId] = useState("all");
  if (!scope.readOnly) return null;
  if (INSIGHT_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return null;
  if (!pathname.startsWith("/org") || (!screenOf(pathname) && pathname !== "/org/masters"))
    return null;
  const company = scope.companies.find((o) => o.id === orgId);
  const branches = visibleBranches(company);
  const masters = pathname === "/org/masters";
  return (
    <div
      className="border-gold/40 bg-gold/10 mb-5 flex flex-col gap-3 rounded-xl border p-3 text-sm md:flex-row md:items-center"
      data-testid="scope-gate"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Eye className="text-gold mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold">
            Collective view — combined data of {scope.companies.length} companies
          </div>
          <div className="text-muted-foreground text-xs">
            {masters
              ? "Masters shared by the group apply to every company. Per-company masters and every change need a company first."
              : "This screen is view-only here. To add or change a record, choose the company and branch it belongs to."}
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
        <Select
          value={orgId}
          onValueChange={(v) => {
            setOrgId(v);
            setBranchId("all");
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Company">
            <SelectValue placeholder="Choose company" />
          </SelectTrigger>
          <SelectContent>
            {scope.companies.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {branches.length > 0 && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          className="bg-gradient-emerald h-9 text-white"
          disabled={!company}
          onClick={() => {
            setActiveCompany(company.id);
            if (branchId !== "all") setActiveScopeBranch(branchId);
            toast.success(
              `Working in ${company.name}${branchId !== "all" ? ` › ${branches.find((b) => b.id === branchId)?.name}` : ""}`,
            );
          }}
        >
          Work here
        </Button>
      </div>
    </div>
  );
}
