import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { Plane } from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { LeaveApplicationsTab } from "@/features/leave/components/LeaveApplicationsTab";
import { LeaveBalanceTab } from "@/features/leave/components/LeaveBalanceTab";
import { CompOffApprovalsTab } from "@/features/attendance/components/CompOffApprovalsTab";

function LeavePage() {
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

      <Tabs defaultValue="applications">
        <ScrollTabsList>
          <TabsTrigger value="applications">Leave Applications</TabsTrigger>
          <TabsTrigger value="balance">Balance Leave</TabsTrigger>
          <TabsTrigger value="compoff">Comp-off</TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="applications" className="pt-4">
          <LeaveApplicationsTab />
        </TabsContent>
        <TabsContent value="balance" className="pt-4">
          <LeaveBalanceTab />
        </TabsContent>
        <TabsContent value="compoff" className="pt-4">
          <CompOffApprovalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LeavePage;
