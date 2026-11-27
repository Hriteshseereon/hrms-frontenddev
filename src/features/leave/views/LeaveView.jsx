import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { Plane } from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { LeaveApplicationsTab } from "@/features/leave/components/LeaveApplicationsTab";
import { LeaveBalanceTab } from "@/features/leave/components/LeaveBalanceTab";
import { CompOffApprovalsTab } from "@/features/attendance/components/CompOffApprovalsTab";
import { useVisibleTabs } from "@/features/auth/data/module-access";

// Each tab is controlled by its own screen on the role permission screen (RBAC_MODULES "leave").
const LEAVE_TABS = [
  { value: "applications", label: "Leave Applications", screen: "leave.leave.leave-requests", Component: LeaveApplicationsTab },
  { value: "balance", label: "Balance Leave", screen: "leave.leave.leave-balances", Component: LeaveBalanceTab },
  { value: "compoff", label: "Comp-off", screen: "leave.leave.comp-off-approvals", Component: CompOffApprovalsTab },
];

function LeavePage() {
  const tabs = useVisibleTabs(LEAVE_TABS);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Plane className="text-primary h-6 w-6" /> Leave Management
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Approve employee requests and track balances. Leave types, credit rules, clubbing policy
          and holiday calendars live in{" "}
          <Link
            href={buildHref({ to: "/org/masters", hash: "leavemaster" })}
            className="text-primary underline"
          >
            Master Data → Leave
          </Link>
          .
        </p>
      </div>

      {tabs.first ? (
        <Tabs defaultValue={tabs.first}>
          <ScrollTabsList>
            {tabs.list.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </ScrollTabsList>
          {tabs.list.map(({ value, Component }) => (
            <TabsContent key={value} value={value} className="pt-4">
              <Component />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-muted-foreground text-sm">You do not have access to any Leave screen.</p>
      )}
    </div>
  );
}

export default LeavePage;
