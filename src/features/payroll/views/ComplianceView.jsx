import { useState } from "react";
import {
  ShieldCheck,
  BookOpenCheck,
  LayoutDashboard,
  MapPin,
  Settings2,
  CalendarCheck,
  Landmark,
  HeartPulse,
  Receipt,
  Scale,
} from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  OverviewTab,
  StatePolicyTab,
  StatutoryConfigTab,
} from "@/features/payroll/components/PolicyTabs";
import { ContributionsQueue, PatternsTab } from "@/features/payroll/components/PatternsTab";
import { FilingsTab } from "@/features/payroll/components/FilingsTab";
import { StatutoryRegistersTab } from "@/features/payroll/components/StatutoryRegistersTab";
import { ComplianceLibraryTab } from "@/features/payroll/components/ComplianceLibraryTab";

function CompliancePage() {
  const [tab, setTab] = useState("overview");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="text-primary h-6 w-6" /> Statutory Compliance
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Acts &amp; latest government guidelines (incl. the Labour Codes in force from 21 Nov
          2025), state-aware payroll policy, attendance patterns, and the PF (ECR), ESI and TDS
          filing workflows — every figure comes from processed payroll. Tax is computed under the
          New Regime only.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <ScrollTabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="library">
            <Scale className="h-4 w-4" /> Acts &amp; Guidelines
          </TabsTrigger>
          <TabsTrigger value="states">
            <MapPin className="h-4 w-4" /> State Policies
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings2 className="h-4 w-4" /> Statutory Config
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <CalendarCheck className="h-4 w-4" /> Attendance Patterns
          </TabsTrigger>
          <TabsTrigger value="registers">
            <BookOpenCheck className="h-4 w-4" /> Odisha Registers
          </TabsTrigger>
          <TabsTrigger value="ecr">
            <Landmark className="h-4 w-4" /> PF · ECR
          </TabsTrigger>
          <TabsTrigger value="esi">
            <HeartPulse className="h-4 w-4" /> ESI
          </TabsTrigger>
          <TabsTrigger value="tds">
            <Receipt className="h-4 w-4" /> TDS
          </TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="overview" className="pt-4">
          <OverviewTab onGo={setTab} />
        </TabsContent>
        <TabsContent value="library" className="pt-4">
          <ComplianceLibraryTab />
        </TabsContent>
        <TabsContent value="states" className="pt-4">
          <StatePolicyTab />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <StatutoryConfigTab />
        </TabsContent>
        <TabsContent value="patterns" className="space-y-6 pt-4">
          <PatternsTab />
          <ContributionsQueue />
        </TabsContent>
        <TabsContent value="registers" className="pt-4">
          <StatutoryRegistersTab />
        </TabsContent>
        <TabsContent value="ecr" className="pt-4">
          <FilingsTab kind="ECR" />
        </TabsContent>
        <TabsContent value="esi" className="pt-4">
          <FilingsTab kind="ESI" />
        </TabsContent>
        <TabsContent value="tds" className="pt-4">
          <FilingsTab kind="TDS" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CompliancePage;
