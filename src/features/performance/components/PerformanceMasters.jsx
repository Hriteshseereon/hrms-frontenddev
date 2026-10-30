// Performance masters (indicators, indicator categories, goal types, review cycles) — configured from Master Data.
import { useMemo } from "react";
import { Target, Layers, Flag, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { CrudSection } from "@/components/common/CrudSection";
import {
  PERF_INDICATORS,
  INDICATOR_CATEGORIES,
  MEASUREMENT_UNITS,
  STATUSES,
  INDICATOR_CATEGORY_ROWS,
  GOAL_TYPE_ROWS,
  REVIEW_CYCLE_ROWS,
  FREQUENCIES,
} from "@/features/performance/data/performance-data";
import { createPerformanceIndicatorApi } from "@/features/performance/data/performanceIndicatorAdapter";

export function PerformanceMastersTab() {
  // useMemo is required: CrudSection reloads whenever the `api` object changes,
  // so a new object on every render would refetch the list endlessly.
  const indicatorApi = useMemo(() => createPerformanceIndicatorApi(), []);

  return (
    <Tabs defaultValue="indicators">
      <ScrollTabsList>
        <TabsTrigger value="indicators">
          <Target className="h-4 w-4" /> Performance indicators
        </TabsTrigger>
        <TabsTrigger value="categories">
          <Layers className="h-4 w-4" /> Indicator categories
        </TabsTrigger>
        <TabsTrigger value="goals">
          <Flag className="h-4 w-4" /> Goal types
        </TabsTrigger>
        <TabsTrigger value="cycles">
          <RefreshCw className="h-4 w-4" /> Review cycles
        </TabsTrigger>
      </ScrollTabsList>
      <TabsContent value="indicators" className="pt-4">
        <CrudSection
          icon={Target}
          title="Performance Indicators"
          desc="Measurable indicators used across review cycles"
          addLabel="Add Indicator"
          idPrefix="PI"
          seed={PERF_INDICATORS}
          api={indicatorApi}
          fields={[
            { key: "name", label: "Name", required: true, placeholder: "e.g. Sprint Velocity" },
            {
              key: "category",
              label: "Category",
              type: "select",
              options: INDICATOR_CATEGORIES,
              required: true,
            },
            {
              key: "unit",
              label: "Measurement Unit",
              type: "select",
              options: MEASUREMENT_UNITS,
              required: true,
            },
            { key: "target", label: "Target Value", required: true, placeholder: "e.g. 38" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: STATUSES,
              required: true,
              badge: true,
            },
            { key: "description", label: "Description", type: "textarea" },
          ]}
        />
      </TabsContent>
      <TabsContent value="categories" className="pt-4">
        <CrudSection
          icon={Layers}
          title="Indicator Categories"
          desc="Group indicators for reporting and weighting"
          addLabel="Add Category"
          idPrefix="IC"
          seed={INDICATOR_CATEGORY_ROWS}
          fields={[
            { key: "name", label: "Name", required: true },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: STATUSES,
              required: true,
              badge: true,
            },
            { key: "description", label: "Description", type: "textarea" },
          ]}
        />
      </TabsContent>
      <TabsContent value="goals" className="pt-4">
        <CrudSection
          icon={Flag}
          title="Goal Types"
          desc="Kinds of goals employees and managers can create"
          addLabel="Add Goal Type"
          idPrefix="GT"
          seed={GOAL_TYPE_ROWS}
          fields={[
            { key: "name", label: "Name", required: true },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: STATUSES,
              required: true,
              badge: true,
            },
            { key: "description", label: "Description", type: "textarea" },
          ]}
        />
      </TabsContent>
      <TabsContent value="cycles" className="pt-4">
        <CrudSection
          icon={RefreshCw}
          title="Review Cycles"
          desc="Quarterly goal reviews and the annual appraisal window"
          addLabel="Add Cycle"
          idPrefix="RC"
          seed={REVIEW_CYCLE_ROWS}
          fields={[
            { key: "name", label: "Name", required: true },
            {
              key: "frequency",
              label: "Frequency",
              type: "select",
              options: FREQUENCIES,
              required: true,
            },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: STATUSES,
              required: true,
              badge: true,
            },
            { key: "description", label: "Description", type: "textarea" },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}