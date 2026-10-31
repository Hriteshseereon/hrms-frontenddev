import { useCallback, useEffect, useState } from "react";
import { Briefcase, Building2, Eye, FileText, GraduationCap, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { getMyDocuments, getMyRecord } from "@/api/meApi";
import { resolveApiUrl } from "@/api/employeeApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { DocPreviewDialog } from "@/features/employees/components/DocPreviewDialog";
import { DataTable, KV, Section } from "@/features/employees/components/EmployeeDetail";
import { initials } from "@/features/employees/data/employee-directory";

const show = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const WORK_MODE = { office: "On-site", remote: "Remote", hybrid: "Hybrid" };
const PREV_DOCS = [
  ["relieving_letter", "Relieving letter"],
  ["experience_letter", "Experience letter"],
  ["payslip_1", "Payslip 1"],
  ["payslip_2", "Payslip 2"],
  ["payslip_3", "Payslip 3"],
  ["form16", "Form 16"],
];
/** Tabs the backend has not built yet — they come back empty, so an empty state is shown instead of an error. */
const EMPTY_TABS = [
  ["payroll", "Payroll"],
  ["attendance", "Attendance & Leave"],
  ["performance", "Performance"],
  ["training", "Training"],
  ["cases", "Cases & Letters"],
  ["timeline", "Timeline"],
  ["assets", "Assets"],
];

function EmptyState({ children }) {
  return (
    <Card className="shadow-card">
      <CardContent className="text-muted-foreground p-8 text-center text-sm">{children}</CardContent>
    </Card>
  );
}

function PersonCard({ person, hint }) {
  return (
    <div className="border-border flex items-center gap-3 rounded-lg border p-3">
      <Avatar className="h-10 w-10">
        {person.photo_url && <AvatarImage src={resolveApiUrl(person.photo_url)} alt={person.name} />}
        <AvatarFallback className="text-xs">{initials(person.name || "?")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{person.name}</div>
        <div className="text-muted-foreground truncate text-xs">
          {[person.designation, person.department].filter(Boolean).join(" · ") || hint}
        </div>
      </div>
    </div>
  );
}

function PersonList({ title, people, empty }) {
  return (
    <Section title={title} icon={User}>
      {people?.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <PersonCard key={p.id} person={p} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm">{empty}</div>
      )}
    </Section>
  );
}

/** Employee-portal "My record": everything comes from GET /me/record (scoped by the token). View only. */
export function MyRecord() {
  const [rec, setRec] = useState(null);
  const [docs, setDocs] = useState([]);
  const [state, setState] = useState("loading"); // loading | ok | missing | error
  const [tab, setTab] = useState("profile");
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getMyRecord();
      setRec(res?.record ?? res);
      setDocs(res?.documents ?? res?.record?.documents ?? []);
      setState("ok");
    } catch (err) {
      setState(err?.response?.status === 404 ? "missing" : "error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDoc = (d) => {
    const src = resolveApiUrl(d?.view_url);
    if (!src) {
      toast.error("This document is not available to preview.");
      return;
    }
    setPreview({
      title: d.file_name || d.label || "Document",
      src,
      isPdf: /pdf/i.test(d.content_type ?? "") || /\.pdf$/i.test(d.file_name ?? ""),
    });
  };

  // view_url is signed (~15 min), so the list is refetched right before every preview.
  const previewDocument = async (type) => {
    try {
      const list = await getMyDocuments();
      const items = Array.isArray(list) ? list : (list?.documents ?? list?.items ?? []);
      setDocs(items);
      openDoc(items.find((d) => d.document_type === type));
    } catch {
      toast.error("Could not load the document.");
    }
  };

  // Previous-employment documents live inside the profile section, so that is what gets refetched.
  const previewPrevDoc = async (index, key, label) => {
    try {
      const res = await getMyRecord(["profile"]);
      const doc = (res?.record ?? res)?.previous_employments?.[index]?.documents?.[key];
      openDoc({ ...doc, label });
    } catch {
      toast.error("Could not load the document.");
    }
  };

  if (state === "loading") return <EmptyState>Loading your record…</EmptyState>;
  if (state === "missing")
    return <EmptyState>No employee profile is linked to your account yet. Please contact HR.</EmptyState>;
  if (state === "error" || !rec)
    return (
      <EmptyState>
        Could not load your record.{" "}
        <Button variant="link" className="h-auto p-0" onClick={load}>
          Try again
        </Button>
      </EmptyState>
    );

  const education = rec.education ?? [];
  const prev = rec.previous_employments ?? [];
  const hier = rec.hierarchy ?? {};
  const placement = { organisation: "Organisation level", company: "Company", branch: "Branch" }[
    rec.company_placement
  ];
  const shift = rec.shift
    ? [rec.shift.name, [rec.shift.start_time, rec.shift.end_time].filter(Boolean).join(" – ")]
        .filter(Boolean)
        .join(" · ")
    : null;
  const manager = rec.reporting_manager;
  const hr = rec.hr_partner;
  const hasUniversity = education.some((e) => e.university);
  const hasSpecialization = education.some((e) => e.specialization);

  const jobItems = [
    ["Employee Code", rec.employee_code],
    ["Company", rec.company_name],
    ["Branch / Office", rec.branch_name],
    ["Placement Level", placement],
    ["Department", rec.department],
    ["Designation", rec.designation],
    ["Date of Joining", rec.date_of_joining],
    ["Confirmation Date", rec.confirmation_date],
    ["Employment Type", rec.employment_type],
    ["Reporting Manager", manager?.name],
    ["HR Partner", hr?.name],
    ["Shift", shift],
    ["Work Mode", WORK_MODE[rec.work_mode] || rec.work_mode],
    ["Work Location", rec.work_location],
    ["Notice Period", rec.notice_period_days != null ? `${rec.notice_period_days} days` : null],
    ["Probation", rec.probation_months != null ? `${rec.probation_months} months` : null],
    ["Salary Grade", rec.grade],
    ["Wage Type", rec.wage_type],
    ["Status", rec.status],
  ];
  // CTC is only returned when the company allows employees to see it.
  if (rec.ctc != null) jobItems.splice(17, 0, ["Annual CTC", `₹ ${Number(rec.ctc).toLocaleString("en-IN")}`]);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <ScrollTabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="job">Job & Org</TabsTrigger>
          <TabsTrigger value="hierarchy">Visual Hierarchy</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {EMPTY_TABS.map(([v, l]) => (
            <TabsTrigger key={v} value={v}>
              {l}
            </TabsTrigger>
          ))}
        </ScrollTabsList>

        <TabsContent value="profile" className="space-y-4 pt-4">
          <Section title="Personal Information" icon={User}>
            <KV
              items={[
                ["Full Name", rec.full_name || [rec.first_name, rec.last_name].filter(Boolean).join(" ")],
                ["Date of Birth", rec.date_of_birth],
                ["Gender", rec.gender],
                ["Marital Status", rec.marital_status],
                ["Blood Group", rec.blood_group],
                ["Nationality", rec.nationality],
                ["Religion", rec.religion],
                ["Work Email", rec.work_email],
                ["Personal Email", rec.personal_email],
                ["Phone Number", rec.phone],
                ["WhatsApp", rec.whatsapp_number],
                [
                  "Emergency Contact",
                  [rec.emergency_contact_name, rec.emergency_contact_relationship, rec.emergency_contact_phone]
                    .filter(Boolean)
                    .join(" · "),
                ],
                ["Current Address", rec.current_address],
                ["Permanent Address", rec.permanent_address],
                ["LinkedIn", rec.linkedin_url],
                ["GitHub", rec.github_url],
                ["Twitter / X", rec.twitter_url],
                ["Website", rec.website_url],
              ].map(([k, v]) => [k, show(v)])}
            />
          </Section>

          <Section title="Education" icon={GraduationCap}>
            {education.length ? (
              <DataTable
                head={[
                  "Qualification",
                  "Institution",
                  ...(hasUniversity ? ["University"] : []),
                  ...(hasSpecialization ? ["Specialization"] : []),
                  "Year",
                  "Percentage",
                ]}
                rows={education.map((e) => [
                  show(e.qualification),
                  show(e.institution),
                  ...(hasUniversity ? [show(e.university)] : []),
                  ...(hasSpecialization ? [show(e.specialization)] : []),
                  show(e.year_of_passing),
                  show(e.percentage),
                ])}
              />
            ) : (
              <div className="text-muted-foreground text-sm">No education details on record.</div>
            )}
          </Section>

          <Section title="Previous Experience" icon={Briefcase}>
            {prev.length ? (
              <DataTable
                head={["Company", "Role", "From", "To", "CTC", "Reason for leaving", "Documents"]}
                rows={prev.map((e, i) => [
                  show(e.company),
                  show(e.role),
                  show(e.from_date),
                  show(e.to_date),
                  show(e.ctc),
                  show(e.reason_for_leaving),
                  <div key="d" className="flex flex-wrap gap-1">
                    {PREV_DOCS.filter(([k]) => e.documents?.[k]).map(([k, l]) => (
                      <Button
                        key={k}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => previewPrevDoc(i, k, l)}
                      >
                        <Eye className="h-3 w-3" /> {l}
                      </Button>
                    ))}
                    {!PREV_DOCS.some(([k]) => e.documents?.[k]) && "—"}
                  </div>,
                ])}
              />
            ) : (
              <div className="text-muted-foreground text-sm">No previous employment on record.</div>
            )}
          </Section>

          <Section title="Statutory & Banking Details" icon={ShieldCheck}>
            <KV
              items={[
                ["PAN Number", rec.pan_number],
                ["Aadhaar Number", rec.aadhaar_number],
                ["UAN Number", rec.uan_number],
                ["ESIC Number", rec.esic_number],
                ["Driving License No.", rec.driving_license_number],
                ["Passport No.", rec.passport_number],
                ["Account Holder", rec.bank_account_holder_name],
                ["Bank Name", rec.bank_name],
                ["Account Number", rec.bank_account_number],
                ["IFSC Code", rec.ifsc_code],
                ["Bank Branch", rec.bank_branch],
                ["Account Type", rec.bank_account_type],
                ["Payment Mode", rec.payment_mode],
                ["Pay Frequency", rec.pay_frequency],
              ].map(([k, v]) => [k, show(v)])}
            />
            {rec.sensitive_masked && (
              <p className="text-muted-foreground mt-3 text-xs">
                Sensitive numbers are masked for your security. Ask HR if a value needs correcting.
              </p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="job" className="space-y-4 pt-4">
          <Section title="Employment Details" icon={Building2}>
            <KV items={jobItems.map(([k, v]) => [k, show(v)])} />
          </Section>
          {(manager || hr) && (
            <Section title="Contacts" icon={User}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {manager && (
                  <div>
                    <div className="text-muted-foreground mb-1 text-[11px] tracking-wider uppercase">
                      Reporting manager
                    </div>
                    <PersonCard person={manager} hint={manager.email} />
                    <div className="text-muted-foreground mt-1 text-xs">
                      {[manager.email, manager.phone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                )}
                {hr && (
                  <div>
                    <div className="text-muted-foreground mb-1 text-[11px] tracking-wider uppercase">
                      HR partner
                    </div>
                    <PersonCard person={hr} hint={hr.email} />
                    <div className="text-muted-foreground mt-1 text-xs">
                      {[hr.email, hr.phone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-4 pt-4">
          <PersonList
            title="Reporting line (direct manager first)"
            people={hier.manager_chain}
            empty="You do not report to anyone."
          />
          <PersonList title="Peers" people={hier.peers} empty="No peers to show." />
          <PersonList title="Direct reports" people={hier.direct_reports} empty="No direct reports." />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 pt-4">
          <Section title="My Documents" icon={FileText}>
            {docs.length ? (
              <DataTable
                head={["Document", "File", "Uploaded", ""]}
                rows={docs.map((d) => [
                  show(d.label || d.document_type),
                  show(d.file_name),
                  d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "—",
                  <Button
                    key="p"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => previewDocument(d.document_type)}
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </Button>,
                ])}
              />
            ) : (
              <div className="text-muted-foreground text-sm">No documents uploaded yet.</div>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              Need a correction? Raise a request from Support Tickets and HR will update your record.
            </p>
          </Section>
        </TabsContent>

        {EMPTY_TABS.map(([v, l]) => (
          <TabsContent key={v} value={v} className="pt-4">
            <EmptyState>{l} details will appear here once they are available.</EmptyState>
          </TabsContent>
        ))}
      </Tabs>

      <DocPreviewDialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title}
        src={preview?.src}
        isPdf={preview?.isPdf}
      />
    </div>
  );
}
