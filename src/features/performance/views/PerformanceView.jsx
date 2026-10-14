import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import {
  Target,
  ClipboardCheck,
  BadgeIndianRupee,
  UserCheck,
  ClipboardX,
  ClipboardList,
} from "lucide-react";
import { PIPTab } from "@/features/performance/components/PIPTab";
import { AppraisalsTab } from "@/features/performance/components/AppraisalsTab";
import { ManagerReviewsTab } from "@/features/performance/components/ManagerReviewsTab";
import { AppraisalWorkflowTab } from "@/features/performance/components/AppraisalWorkflowTab";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ReviewCycleAdmin } from "@/features/performance/components/ReviewForms";
import {
  AppraisalApprovals,
  ApplyAppraisalPanel,
} from "@/features/performance/components/SelfAppraisal";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { HrReviewsTab } from "@/features/performance/components/HrReviews";
import { useCurrentUser } from "@/features/auth/data/auth-session";

function PerformancePage() {
  const me = useCurrentUser();
  // Managers / HODs only ever see their own reporting tree (PIPTab scopes by manager id); HR, CXOs and admins see the entity.
  const teamScoped = me.role === "Manager" || me.role === "HOD";
  // The self-appraisal approval queues render nothing for a Manager (they act at the Manager step from My Team / Reviews),
  // so that tab is hidden for them and the page opens on Manager Reviews instead of an empty panel.
  const canApproveAppraisals = me.role !== "Manager";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Target className="text-primary h-6 w-6" /> Performance
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Define what good looks like, run review cycles and record employee ratings.
        </p>
      </div>

      <Tabs defaultValue={canApproveAppraisals ? "selfappraisals" : "manager"}>
        <ScrollTabsList>
          <TabsTrigger value="reviews">
            <ClipboardCheck className="h-4 w-4" /> Employee Review
          </TabsTrigger>
          <TabsTrigger value="manager">
            <UserCheck className="h-4 w-4" /> Manager Reviews
          </TabsTrigger>
          <TabsTrigger value="workflow">
            <ClipboardList className="h-4 w-4" /> Appraisal Workflow
          </TabsTrigger>
          <TabsTrigger value="pip">
            <ClipboardX className="h-4 w-4" /> PIP
          </TabsTrigger>
          <TabsTrigger value="appraisals">
            <BadgeIndianRupee className="h-4 w-4" /> Appraisals
          </TabsTrigger>
          <TabsTrigger value="forms">
            <ClipboardCheck className="h-4 w-4" /> Review Forms
          </TabsTrigger>
          {canApproveAppraisals && (
            <TabsTrigger value="selfappraisals">
              <BadgeIndianRupee className="h-4 w-4" /> Self-appraisal Approvals
            </TabsTrigger>
          )}
        </ScrollTabsList>
        <TabsContent value="selfappraisals" className="space-y-4 pt-4">
          <AppraisalApprovals step="HR" />
          <AppraisalApprovals step="Unit Head" />
          <ApplyAppraisalPanel />
        </TabsContent>
        <TabsContent value="forms" className="pt-4">
          <ReviewCycleAdmin />
        </TabsContent>

        <div className="text-muted-foreground pt-2 text-xs">
          Indicators, categories, goal types, review cycles and evaluation parameters are configured
          under{" "}
          <Link
            href={buildHref({ to: "/org/masters", hash: "perfmasters" })}
            className="text-primary underline"
          >
            Master Data → Performance
          </Link>
          .
        </div>
        <TabsContent value="reviews" className="pt-4">
          <HrReviewsTab />
        </TabsContent>

        <TabsContent value="manager" className="pt-4">
          <ManagerReviewsTab />
        </TabsContent>

        <TabsContent value="workflow" className="pt-4">
          <AppraisalWorkflowTab />
        </TabsContent>

        <TabsContent value="pip" className="pt-4">
          <PIPTab managerId={teamScoped ? me.id : undefined} />
        </TabsContent>

        <TabsContent value="appraisals" className="pt-4">
          <AppraisalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformancePage;
