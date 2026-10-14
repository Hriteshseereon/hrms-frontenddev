import { useMemo, useState } from "react";
import { Search, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { useTeamScope } from "@/features/attendance/data/attendance-live";
import { leaveBalances, useLeaveApplications } from "@/features/leave/data/leave-engine";
import { EmployeeLeaveSheet } from "@/features/leave/components/LeavePieces";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportReportPdf } from "@/lib/export-utils";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const TYPES = ["Casual Leave", "Sick Leave", "Earned Leave"];

export function LeaveBalanceTab() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const inScope = useScopeMatch();
  const team = useTeamScope();
  const directory = useDirectory();
  const [apps] = useLeaveApplications();
  const rows = useMemo(
    () =>
      directory
        .filter(
          (e) =>
            inScope(e.orgId, null, e.branch) &&
            (!team || team.has(e.id)) &&
            (e.name.toLowerCase().includes(query.toLowerCase()) ||
              e.id.toLowerCase().includes(query.toLowerCase())),
        )
        .map((e) => {
          const lines = leaveBalances(e.id, apps);
          const balances = {};
          TYPES.forEach((t) => {
            const l = lines.find((x) => x.type === t);
            balances[t] = { used: (l?.used ?? 0) + (l?.pending ?? 0), total: l?.entitled ?? 0 };
          });
          return { empId: e.id, employee: e.name, designation: e.role, office: e.branch, balances };
        }),
    [query, directory, inScope, team, apps],
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="border-border bg-muted/40 flex max-w-md min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee…"
              className="h-6 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Balances credited to date for the leave year ·
              click an employee for the leave record
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportReportPdf({
                  title: "Leave balance report",
                  subtitle: `${rows.length} employees · leave year credited to date`,
                  columns: [
                    "Employee",
                    "Emp ID",
                    "Office",
                    ...TYPES.flatMap((t) => [`${t} used`, `${t} left`]),
                    "Total remaining",
                  ],
                  rows: rows.map((b) => [
                    b.employee,
                    b.empId,
                    b.office,
                    ...TYPES.flatMap((t) => [
                      b.balances[t].used,
                      b.balances[t].total - b.balances[t].used,
                    ]),
                    TYPES.reduce((s, t) => s + (b.balances[t].total - b.balances[t].used), 0),
                  ]),
                })
              }
            >
              <Download className="h-4 w-4" /> Balance report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Office</th>
                {TYPES.map((t) => (
                  <th key={t} className="p-3 text-left">
                    {t}
                  </th>
                ))}
                <th className="p-3 text-left">Total Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((b) => {
                const remaining = TYPES.reduce(
                  (s, t) => s + (b.balances[t].total - b.balances[t].used),
                  0,
                );
                return (
                  <tr
                    key={b.empId}
                    className="hover:bg-muted/30 cursor-pointer align-top transition"
                    onClick={() => setOpenId(b.empId)}
                  >
                    <td className="p-3">
                      <div className="text-primary font-semibold underline-offset-2 hover:underline">
                        {b.employee}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {b.empId} · {b.designation}
                      </div>
                    </td>
                    <td className="text-muted-foreground p-3">{b.office}</td>
                    {TYPES.map((t) => {
                      const { used, total } = b.balances[t];
                      const left = total - used;
                      return (
                        <td key={t} className="min-w-[150px] p-3">
                          <div className="mb-1 text-xs font-medium">
                            {left} left <span className="text-muted-foreground">/ {total}</span>
                          </div>
                          <Progress
                            value={total > 0 ? Math.min(100, (used / total) * 100) : 0}
                            className="h-1.5"
                          />
                          <div className="text-muted-foreground mt-1 text-[11px]">{used} used</div>
                        </td>
                      );
                    })}
                    <td className="text-primary p-3 font-semibold">{remaining} days</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <EmployeeLeaveSheet empId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
