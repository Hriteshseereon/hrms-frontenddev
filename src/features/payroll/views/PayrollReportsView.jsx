import { useState } from "react";
import { FileBarChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import {
  PfYtdStatement,
  YtdSummary,
  EsiYtdStatement,
} from "@/features/payroll/components/YtdReport";
import { ItDeclaration, ItStatement } from "@/features/payroll/components/ItReports";

function PayrollReports() {
  // Tenant-scoped, reactive roster (the static EMPLOYEES seed listed every entity's people and missed new hires).
  const SEEREON = useScopedEmployees();
  const [empId, setEmpId] = useState(SEEREON[5]?.id ?? SEEREON[0]?.id ?? "");
  const emp = SEEREON.find((e) => e.id === empId) ?? SEEREON[0];

  if (!emp) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileBarChart className="text-primary h-6 w-6" /> Payroll Reports
          </h1>
        </div>
        <Card className="shadow-card">
          <CardContent className="text-muted-foreground p-10 text-center text-sm">
            No employees in this organisation yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileBarChart className="text-primary h-6 w-6" /> Payroll Reports
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick an employee to review their YTD payroll, PF contributions, IT statement and
          investment declaration.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-4 p-5">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label htmlFor="emp">Employee</Label>
            <Select value={emp.id} onValueChange={setEmpId}>
              <SelectTrigger id="emp" className="w-full sm:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEEREON.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.id} · {e.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-muted-foreground text-sm">
            {emp.dept} · {emp.branch} · {emp.status}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ytd">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ytd">YTD Report</TabsTrigger>
          <TabsTrigger value="pf">PF YTD Statement</TabsTrigger>
          <TabsTrigger value="esi">ESI YTD Statement</TabsTrigger>
          <TabsTrigger value="its">IT Statement</TabsTrigger>
          <TabsTrigger value="itd">IT Declaration</TabsTrigger>
        </TabsList>
        <TabsContent value="ytd" className="mt-5">
          <YtdSummary emp={emp} />
        </TabsContent>
        <TabsContent value="pf" className="mt-5">
          <PfYtdStatement emp={emp} />
        </TabsContent>
        <TabsContent value="esi" className="mt-5">
          <EsiYtdStatement emp={emp} />
        </TabsContent>
        <TabsContent value="its" className="mt-5">
          <ItStatement emp={emp} />
        </TabsContent>
        <TabsContent value="itd" className="mt-5">
          <ItDeclaration emp={emp} readOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PayrollReports;
