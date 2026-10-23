import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { CrudSection } from "@/components/common/CrudSection";
import {
  SOURCE_MASTER_SEED,
  INTERVIEW_TYPE_MASTER_SEED,
} from "@/features/recruitment/data/recruitment-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import {
  Briefcase,
  Users,
  MessagesSquare,
  ListChecks,
  Palette,
  Building,
  FileSignature,
} from "lucide-react";
import { JOB_TYPES, STATUSES } from "@/features/recruitment/data/recruitment-data";
import { createPersistentStore } from "@/lib/persist";
import { useActiveOrgId } from "@/features/organization/data/group-data";
// Job Type API (adjust the path to where you saved job_type.js)
import { createJobTypeApi } from "@/api/job_type";
// Candidate Source API (adjust the path to where you saved candidate_source.js)
import { createCandidateSourceApi } from "@/api/candidate_source";

/**
 * Career-portal settings per entity. The three "Save" buttons below used to toast without storing anything.
 * @typedef {Object} CareerSettings
 * @property {string} title
 * @property {string} footer
 * @property {string} mission
 * @property {string} size
 * @property {string} industry
 * @property {string} offerTemplate
 */
const DEFAULT_TEMPLATE = `Dear {{candidate_name}},

We are delighted to offer you the position of {{position}} in the {{department}} department at {{company_name}}.

Your annual compensation will be {{salary}}, along with a joining bonus of {{bonus}}.
Your expected date of joining is {{start_date}}. This offer is valid until {{expiry_date}}.

Benefits: {{benefits}}

Warm regards,
People Team`;
const DEFAULT_CAREER = {
  title: "Careers at Seereon",
  footer: "© 2026 Seereon Consulting & IT Services. All rights reserved.",
  mission: "Make people operations effortless for growing companies.",
  size: "501-1000",
  industry: "Software & Technology",
  offerTemplate: DEFAULT_TEMPLATE,
};
const careerStore = createPersistentStore("seereon.recruitment.career-settings.v1", {});
const useCareerSettings = (orgId) => ({ ...DEFAULT_CAREER, ...(careerStore.use()[orgId] ?? {}) });
const saveCareerSettings = (orgId, patch) =>
  careerStore.set((p) => ({ ...p, [orgId]: { ...(p[orgId] ?? {}), ...patch } }));

const nameDescStatus = [
  { key: "name", label: "Name", required: true },
  { key: "description", label: "Description", type: "textarea", full: true },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: STATUSES,
    required: true,
    badge: true,
  },
];

export function RecruitmentMasters() {
  const activeOrgId = useActiveOrgId();
  // Stable adapters, re-created only when the organization changes
  const jobTypeApi = useMemo(() => createJobTypeApi(activeOrgId), [activeOrgId]);
  const candidateSourceApi = useMemo(
    () => createCandidateSourceApi(activeOrgId),
    [activeOrgId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recruitment Master</h1>
        <p className="text-muted-foreground text-sm">
          Configuration that powers job postings, interviews and offers.
        </p>
      </div>

      <Tabs defaultValue="job-type">
        <ScrollTabsList>
          <TabsTrigger value="job-type">
            <Briefcase className="h-4 w-4" /> Job Type
          </TabsTrigger>
          <TabsTrigger value="sources">
            <Users className="h-4 w-4" /> Candidate Sources
          </TabsTrigger>
          <TabsTrigger value="interview-types">
            <MessagesSquare className="h-4 w-4" /> Interview Types
          </TabsTrigger>
          <TabsTrigger value="checklists">
            <ListChecks className="h-4 w-4" /> Onboarding Checklists
          </TabsTrigger>
          <TabsTrigger value="brand">
            <Palette className="h-4 w-4" /> Brand Settings
          </TabsTrigger>
          <TabsTrigger value="about">
            <Building className="h-4 w-4" /> About Company
          </TabsTrigger>
          <TabsTrigger value="offer">
            <FileSignature className="h-4 w-4" /> Offer Letter Template
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="job-type" className="mt-6">
          <CrudSection
            icon={Briefcase}
            title="Job Type"
            desc="Employment types used across job postings."
            addLabel="Add Job Type"
            idPrefix="JT"
            fields={nameDescStatus}
            seed={JOB_TYPES.map((n, i) => ({
              id: `JT-00${i + 1}`,
              name: n,
              description: `${n} engagement`,
              status: "Active",
            }))}
            api={jobTypeApi}
          />
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          <CrudSection
            icon={Users}
            title="Candidate Sources"
            desc="Where your applicants come from."
            addLabel="Add Source"
            idPrefix="CS"
            fields={nameDescStatus}
            seed={SOURCE_MASTER_SEED}
            api={candidateSourceApi}
          />
        </TabsContent>

        <TabsContent value="interview-types" className="mt-6">
          <CrudSection
            icon={MessagesSquare}
            title="Interview Types"
            desc="Modes in which interviews are conducted."
            addLabel="Add Interview Type"
            idPrefix="IT"
            fields={nameDescStatus}
            seed={INTERVIEW_TYPE_MASTER_SEED}
          />
        </TabsContent>

        <TabsContent value="checklists" className="mt-6">
          <CrudSection
            icon={ListChecks}
            title="Onboarding Checklists"
            desc="Tasks completed before a candidate becomes an employee."
            addLabel="Add Checklist"
            idPrefix="OC"
            fields={[
              { key: "name", label: "Checklist Name", required: true },
              {
                key: "items",
                label: "Items (comma separated)",
                type: "textarea",
                full: true,
                required: true,
                placeholder: "Offer signed, BGV, Asset allocation",
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: STATUSES,
                required: true,
                badge: true,
              },
              { key: "description", label: "Description", type: "textarea", full: true },
            ]}
            seed={[
              {
                id: "OC-001",
                name: "Day 0 Documentation",
                items: "Offer signed, ID proofs, BGV initiated",
                status: "Active",
                description: "Completed before joining date.",
              },
              {
                id: "OC-002",
                name: "Day 1 Setup",
                items: "Laptop, Email ID, Access cards",
                status: "Active",
                description: "IT and admin provisioning.",
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="brand" className="mt-6">
          <BrandSettings />
        </TabsContent>
        <TabsContent value="about" className="mt-6">
          <AboutCompany />
        </TabsContent>
        <TabsContent value="offer" className="mt-6">
          <OfferTemplate />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BrandSettings() {
  const orgId = useActiveOrgId();
  const saved = useCareerSettings(orgId);
  const [title, setTitle] = useState(saved.title);
  const [footer, setFooter] = useState(saved.footer);
  useEffect(() => {
    setTitle(saved.title);
    setFooter(saved.footer);
  }, [saved.title, saved.footer]);
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-6">
        <div className="font-semibold">Career Portal Brand Settings</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Logo</Label>
            <Input type="file" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Favicon</Label>
            <Input type="file" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Footer Text</Label>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} />
          </div>
        </div>
        <Button
          className="bg-gradient-emerald text-white"
          disabled={!title.trim()}
          onClick={() => {
            saveCareerSettings(orgId, { title: title.trim(), footer: footer.trim() });
            toast.success("Brand settings saved");
          }}
        >
          Save brand settings
        </Button>
      </CardContent>
    </Card>
  );
}

function AboutCompany() {
  const orgId = useActiveOrgId();
  const saved = useCareerSettings(orgId);
  const [mission, setMission] = useState(saved.mission);
  const [size, setSize] = useState(saved.size);
  const [industry, setIndustry] = useState(saved.industry);
  useEffect(() => {
    setMission(saved.mission);
    setSize(saved.size);
    setIndustry(saved.industry);
  }, [saved.mission, saved.size, saved.industry]);
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-6">
        <div className="font-semibold">About Company</div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Mission</Label>
          <Textarea rows={3} value={mission} onChange={(e) => setMission(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Company Size</Label>
            <Input value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
        </div>
        <Button
          className="bg-gradient-emerald text-white"
          onClick={() => {
            saveCareerSettings(orgId, {
              mission: mission.trim(),
              size: size.trim(),
              industry: industry.trim(),
            });
            toast.success("Company profile saved");
          }}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function OfferTemplate() {
  const orgId = useActiveOrgId();
  const saved = useCareerSettings(orgId);
  const [tpl, setTpl] = useState(saved.offerTemplate);
  useEffect(() => {
    setTpl(saved.offerTemplate);
  }, [saved.offerTemplate]);
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-6">
        <div>
          <div className="font-semibold">Offer Letter Template (careers portal preview)</div>
          <div className="text-muted-foreground text-xs">
            Placeholders:{" "}
            {
              "{{candidate_name}} {{position}} {{department}} {{salary}} {{bonus}} {{start_date}} {{expiry_date}} {{benefits}}"
            }
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            Offers issued from Step 3 / Step 4 render the{" "}
            <Link
              href={buildHref({ to: "/org/masters", hash: "docmaster" })}
              className="text-primary underline"
            >
              Doc Master → Offer Letter
            </Link>{" "}
            templates with the salary annexure; this text is the plain preview shown on the careers
            portal.
          </div>
        </div>
        <Textarea
          rows={16}
          className="font-mono text-xs"
          value={tpl}
          onChange={(e) => setTpl(e.target.value)}
        />
        <Button
          className="bg-gradient-emerald text-white"
          disabled={!tpl.trim()}
          onClick={() => {
            saveCareerSettings(orgId, { offerTemplate: tpl });
            toast.success("Offer letter template saved");
          }}
        >
          Save template
        </Button>
      </CardContent>
    </Card>
  );
}