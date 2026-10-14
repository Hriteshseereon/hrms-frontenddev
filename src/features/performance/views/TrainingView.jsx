import {
  GraduationCap,
  UserCheck,
  Tags,
  CalendarRange,
  ClipboardCheck,
  BookOpen,
} from "lucide-react";
import {
  TrainingAssignmentsTab,
  GettingStartedTab,
} from "@/features/performance/components/TrainingTabs";
import { TrainingCatalogueTab } from "@/features/performance/components/TrainingCatalogue";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { CrudSection } from "@/components/common/CrudSection";
import { BRANCHES } from "@/features/employees/data/hr-data";
import { DEPARTMENT_NAMES } from "@/features/finance/data/finance-data";
import { TRAINERS, TRAINING_TYPES } from "@/features/performance/data/training-data";

const ALL_BRANCHES = Object.values(BRANCHES).flat();

function TrainingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <GraduationCap className="text-primary h-6 w-6" /> Training
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Trainer directory, training categories and the training calendar.
        </p>
      </div>

      <Tabs defaultValue="assignments">
        <ScrollTabsList>
          <TabsTrigger value="assignments">
            <ClipboardCheck className="h-4 w-4" /> Assigned Trainings
          </TabsTrigger>
          <TabsTrigger value="getting-started">
            <BookOpen className="h-4 w-4" /> Getting Started
          </TabsTrigger>
          <TabsTrigger value="trainers">
            <UserCheck className="h-4 w-4" /> Trainer List
          </TabsTrigger>
          <TabsTrigger value="types">
            <Tags className="h-4 w-4" /> Training Type
          </TabsTrigger>
          <TabsTrigger value="trainings">
            <CalendarRange className="h-4 w-4" /> Trainings
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="assignments" className="pt-4">
          <TrainingAssignmentsTab />
        </TabsContent>

        <TabsContent value="getting-started" className="pt-4">
          <GettingStartedTab />
        </TabsContent>

        <TabsContent value="trainers" className="pt-4">
          <CrudSection
            icon={UserCheck}
            title="Trainer List Master"
            desc="Internal and external trainers available to the organization"
            addLabel="Add Trainer"
            idPrefix="TRN"
            seed={TRAINERS}
            fields={[
              { key: "name", label: "Name", required: true },
              { key: "contact", label: "Contact", required: true, placeholder: "+91 ..." },
              { key: "email", label: "Email", required: true, placeholder: "name@example.com" },
              {
                key: "branch",
                label: "Branch",
                type: "select",
                options: ALL_BRANCHES,
                required: true,
              },
              {
                key: "department",
                label: "Department",
                type: "select",
                options: DEPARTMENT_NAMES,
                required: true,
              },
              { key: "experience", label: "Experience", placeholder: "e.g. 8 years" },
            ]}
          />
        </TabsContent>

        <TabsContent value="types" className="pt-4">
          <CrudSection
            icon={Tags}
            title="Training Type Master"
            desc="Categories used when scheduling trainings"
            addLabel="Add Training Type"
            idPrefix="TTP"
            seed={TRAINING_TYPES}
            fields={[
              { key: "name", label: "Name", required: true },
              {
                key: "branch",
                label: "Branch",
                type: "select",
                options: ALL_BRANCHES,
                required: true,
              },
              {
                key: "department",
                label: "Department",
                type: "select",
                options: DEPARTMENT_NAMES,
                required: true,
              },
              { key: "description", label: "Description", type: "textarea" },
            ]}
          />
        </TabsContent>

        <TabsContent value="trainings" className="pt-4">
          <TrainingCatalogueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TrainingPage;
