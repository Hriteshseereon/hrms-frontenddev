import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import {
  YtdSummary,
  PfYtdStatement,
  EsiYtdStatement,
} from "@/features/payroll/components/YtdReport";

function EmpYtd() {
  const me = useCurrentEmployee();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="text-primary h-6 w-6" /> YTD Reports
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your full year-to-date payroll transparency — income, deductions, days worked, net pay and
          PF contributions.
        </p>
      </div>

      <Tabs defaultValue="ytd">
        <TabsList>
          <TabsTrigger value="ytd">YTD Report</TabsTrigger>
          <TabsTrigger value="pf">PF YTD Statement</TabsTrigger>
          <TabsTrigger value="esi">ESI YTD Statement</TabsTrigger>
        </TabsList>
        <TabsContent value="ytd" className="mt-5">
          <YtdSummary emp={me} />
        </TabsContent>
        <TabsContent value="pf" className="mt-5">
          <PfYtdStatement emp={me} />
        </TabsContent>
        <TabsContent value="esi" className="mt-5">
          <EsiYtdStatement emp={me} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EmpYtd;
