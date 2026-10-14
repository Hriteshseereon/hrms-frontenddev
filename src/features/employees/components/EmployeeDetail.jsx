import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  CalendarDays,
  Wallet,
  Clock,
  Target,
  GraduationCap,
  FileText,
  Building2,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Laptop,
  History,
  User,
  Download,
  BadgeCheck,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDirectory, updateEmployeeRecord } from "@/features/employees/data/employee-directory";
import {
  useManagerMap,
  setManager,
  directReports,
  managerName,
  managerStore,
} from "@/features/organization/data/manager-data";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { getEmployeeProfile, initials } from "@/features/employees/data/employee-directory";
import { HierarchyTab } from "@/features/employees/components/HierarchyTab";
import { WorkConfigCard } from "@/features/employees/components/WorkConfigCard";
import { EmployeeCases } from "@/features/employees/components/EmployeeCases";
import { EmployeeLeaveSheet } from "@/features/leave/components/LeavePieces";

import { inr } from "@/features/finance/data/finance-data";
import { exportPayslipPdf, exportLetterPdf } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

export function Stat({ label, value, sub, icon: Icon }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
          {Icon && <Icon className="h-3.5 w-3.5" />} {label}
        </div>
        <div className="mt-1.5 text-xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function Section({ title, icon: Icon, children, action }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {Icon && <Icon className="text-primary h-4 w-4" />} {title}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function KV({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DataTable({ head, rows }) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-3 text-left font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30 transition">
              {r.map((c, j) => (
                <td key={j} className="p-3 align-middle">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Full 360° employee record. Used by the admin dialog and the employee portal. */
export function EmployeeDetail({ employee, selfView = false }) {
  const p = getEmployeeProfile(employee.id);
  const [tab, setTab] = useState("profile");
  const [leaveOpen, setLeaveOpen] = useState(false);

  const totalEarnings = p.payroll.earnings.reduce((s, e) => s + e.amount, 0);
  const totalDeductions = p.payroll.deductions.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-emerald shadow-premium rounded-2xl p-5 text-white">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="border-gold/50 h-16 w-16 border-2">
            <AvatarFallback className="bg-white/10 text-lg font-bold text-white">
              {initials(employee.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-[220px]">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{employee.name}</h2>
              <BadgeCheck className="text-gold h-4 w-4" />
            </div>
            <div className="text-sm text-white/70">
              {employee.role} · {employee.dept}
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {employee.email}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {employee.phone}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {employee.branch}
              </span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-gold/40 text-gold bg-white/10">
              {employee.id}
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              {employee.status}
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Grade {p.job.grade} · {p.job.wageType}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Annual CTC"
          value={inr(p.payroll.ctc)}
          sub={`${inr(p.payroll.monthlyGross)} monthly gross`}
          icon={Wallet}
        />
        <Stat
          label="Attendance (Jul)"
          value={`${p.attendance.present} P · ${p.attendance.absent} A`}
          sub={`${p.attendance.leave} leave · ${p.attendance.halfDays} half-day`}
          icon={Clock}
        />
        <Stat
          label="Overall Rating"
          value={p.performance.overallRating}
          sub={`Next review ${p.performance.nextReview}`}
          icon={Target}
        />
        <Stat
          label="Tenure"
          value={`Since ${p.job.dateOfJoining}`}
          sub={`${p.job.employmentType}`}
          icon={Briefcase}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <ScrollTabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="job">Job & Org</TabsTrigger>
          <TabsTrigger value="hierarchy">Visual Hierarchy</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="attendance">Attendance & Leave</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="documents">Documents & Assets</TabsTrigger>
          <TabsTrigger value="cases">Cases & Letters</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="hierarchy" className="pt-4">
          <HierarchyTab employee={employee} />
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile" className="space-y-4 pt-4">
          <Section title="Personal Information" icon={User}>
            <KV
              items={[
                ["Date of Birth", p.personal.dob],
                ["Gender", p.personal.gender],
                ["Blood Group", p.personal.bloodGroup],
                ["Marital Status", p.personal.maritalStatus],
                ["Nationality", p.personal.nationality],
                ["Personal Email", p.personal.personalEmail],
                ["Emergency Contact", p.personal.emergencyContact],
                ["Current Address", p.personal.currentAddress],
                ["Permanent Address", p.personal.permanentAddress],
              ]}
            />
          </Section>
          <Section title="Education" icon={GraduationCap}>
            <DataTable
              head={["Qualification", "Institute", "Year", "Score"]}
              rows={p.education.map((e) => [e.degree, e.institute, e.year, e.score])}
            />
          </Section>
          <Section title="Previous Experience" icon={Briefcase}>
            <DataTable
              head={["Company", "Role", "From", "To"]}
              rows={p.experience.map((e) => [e.company, e.role, e.from, e.to])}
            />
          </Section>
        </TabsContent>

        {/* Job */}
        <TabsContent value="job" className="space-y-4 pt-4">
          <Section title="Employment Details" icon={Building2}>
            <KV
              items={[
                ["Employee ID", employee.id],
                ["Department", employee.dept],
                ["Designation", employee.role],
                ["Date of Joining", p.job.dateOfJoining],
                ["Confirmation Date", p.job.confirmationDate],
                ["Employment Type", p.job.employmentType],
                ["Work Mode", p.job.workMode],
                ["Salary Grade", p.job.grade],
                ["Wage type", p.job.wageType],
                ["Shift", p.job.shift],
                ["Reporting Manager", p.job.reportingManager],
                ["Probation", `${p.job.probationMonths} months`],
                ["Notice Period", `${p.job.noticePeriodDays} days`],
                ["Work Location", p.job.location],
                ["Status", employee.status],
              ]}
            />
          </Section>
          <ManagerAssignment employee={employee} />
          <WorkConfigCard empId={employee.id} branch={employee.branch} />

          <Section title="Statutory & Compliance" icon={ShieldCheck}>
            <KV
              items={[
                ["PAN", p.payroll.statutory.pan],
                ["UAN", p.payroll.statutory.uan],
                ["PF Number", p.payroll.statutory.pfNo],
                ["ESI Number", p.payroll.statutory.esiNo],
                ...(p.payroll.statutory.aadhaar
                  ? [["Aadhaar", `XXXX XXXX ${p.payroll.statutory.aadhaar.slice(-4)}`]]
                  : []),
              ]}
            />
          </Section>
        </TabsContent>

        {/* Payroll */}
        <TabsContent value="payroll" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title="Earnings (Monthly)" icon={TrendingUp}>
              <DataTable
                head={["Component", "Amount"]}
                rows={[
                  ...p.payroll.earnings.map((e) => [
                    e.label,
                    <span key="k307" className="font-medium">
                      {inr(e.amount)}
                    </span>,
                  ]),
                  [
                    <span key="k310" className="font-semibold">
                      Gross Earnings
                    </span>,
                    <span key="k311" className="text-primary font-bold">
                      {inr(totalEarnings)}
                    </span>,
                  ],
                ]}
              />
            </Section>
            <Section title="Deductions (Monthly)" icon={Landmark}>
              <DataTable
                head={["Component", "Amount"]}
                rows={[
                  ...p.payroll.deductions.map((e) => [
                    e.label,
                    <span key="k322" className="font-medium">
                      {inr(e.amount)}
                    </span>,
                  ]),
                  [
                    <span key="k325" className="font-semibold">
                      Total Deductions
                    </span>,
                    <span key="k326" className="text-destructive font-bold">
                      {inr(totalDeductions)}
                    </span>,
                  ],
                ]}
              />
            </Section>
          </div>
          <Card className="shadow-card border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                  Net Take-home (Monthly)
                </div>
                <div className="text-primary text-2xl font-bold">
                  {inr(totalEarnings - totalDeductions)}
                </div>
              </div>
              <Separator orientation="vertical" className="hidden h-10 sm:block" />
              <div>
                <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                  Annual CTC
                </div>
                <div className="text-lg font-semibold">{inr(p.payroll.ctc)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                  Payment Mode
                </div>
                <div className="text-lg font-semibold">{p.payroll.bank.mode}</div>
              </div>
            </CardContent>
          </Card>
          <Section title="Bank Account" icon={Landmark}>
            <KV
              items={[
                ["Bank", p.payroll.bank.bankName],
                ["Account Number", p.payroll.bank.accountNo],
                ["IFSC", p.payroll.bank.ifsc],
                ["Mode", p.payroll.bank.mode],
              ]}
            />
          </Section>
          <Section title="Payslip History" icon={FileText}>
            <DataTable
              head={["Period", "Gross", "Deductions", "Net Pay", "Status", ""]}
              rows={p.payroll.payslips.map((s) => [
                s.period,
                inr(s.gross),
                inr(s.deductions),
                <span key="k374" className="font-semibold">
                  {inr(s.net)}
                </span>,
                <Badge
                  key="k375"
                  variant="outline"
                  className={
                    s.status === "Paid"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-gold/40 bg-gold/15 text-gold"
                  }
                >
                  {s.status}
                </Badge>,
                <Button
                  key="k385"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const ok = exportPayslipPdf({
                      employee: {
                        name: employee.name,
                        id: employee.id,
                        role: employee.role,
                        dept: employee.dept,
                        branch: employee.branch,
                      },
                      statutory: [
                        { label: "PAN", value: p.payroll.statutory.pan },
                        { label: "UAN", value: p.payroll.statutory.uan },
                        {
                          label: "Bank",
                          value: `${p.payroll.bank.bankName} · ${p.payroll.bank.accountNo}`,
                        },
                      ],
                      period: s.period,
                      earnings: p.payroll.earnings,
                      deductions: p.payroll.deductions,
                      net: s.net,
                      status: s.status,
                    });
                    toast[ok ? "success" : "error"](
                      ok
                        ? `Payslip for ${s.period} ready — save as PDF`
                        : "Allow pop-ups to download the payslip",
                    );
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>,
              ])}
            />
          </Section>
        </TabsContent>

        {/* Attendance & leave */}
        <TabsContent value="attendance" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Avg Hours / Day"
              value={`${p.attendance.avgHours.toFixed(2)} h`}
              sub="Against 8.00 h contracted"
              icon={Clock}
            />
            <Stat
              label="Overtime (Month)"
              value={`${p.attendance.overtimeHours} h`}
              sub="Approved & payable"
              icon={TrendingUp}
            />
            <Stat
              label="Short Hours"
              value={`${p.attendance.shortHours} h`}
              sub="Below contracted hours"
              icon={Clock}
            />
            <Stat
              label="Late Marks"
              value={String(p.attendance.lateMarks)}
              sub={`${p.attendance.halfDays} half-days`}
              icon={CalendarDays}
            />
          </div>
          <Section title="Monthly Attendance Summary" icon={CalendarDays}>
            <DataTable
              head={["Month", "Present", "Absent", "Leave", "Overtime (h)"]}
              rows={p.attendance.monthly.map((m) => [
                m.month,
                m.present,
                m.absent,
                m.leave,
                m.overtime,
              ])}
            />
          </Section>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setLeaveOpen(true)}>
              <CalendarDays className="h-4 w-4" /> Open leave record (ledger, approvals, documents)
            </Button>
          </div>
          <EmployeeLeaveSheet
            empId={leaveOpen ? employee.id : null}
            onClose={() => setLeaveOpen(false)}
          />
          <Section title="Leave Balance" icon={CalendarDays}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {p.leave.map((l) => {
                const pct = Math.round((l.used / l.total) * 100);
                return (
                  <div key={l.type} className="border-border rounded-lg border p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{l.type}</span>
                      <span className="text-muted-foreground">
                        {l.total - l.used} of {l.total} left
                      </span>
                    </div>
                    <Progress value={pct} className="mt-2 h-2" />
                    <div className="text-muted-foreground mt-1 text-xs">
                      {l.used} used · {pct}% consumed
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Overall Rating" value={p.performance.overallRating} icon={Target} />
            <Stat label="Last Review" value={p.performance.lastReview} icon={CalendarDays} />
            <Stat label="Next Review" value={p.performance.nextReview} icon={CalendarDays} />
          </div>
          <Section title="Performance Indicators" icon={Target}>
            <DataTable
              head={["Indicator", "Category", "Target", "Actual", "Attainment"]}
              rows={p.performance.indicators.map((i) => [
                i.name,
                i.category,
                i.target,
                i.actual,
                <div key="k512" className="flex min-w-[140px] items-center gap-2">
                  <Progress value={Math.min(i.attainment, 100)} className="h-2 flex-1" />
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      i.attainment >= 95 ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {i.attainment}%
                  </span>
                </div>,
              ])}
            />
          </Section>
          <Section title="Goals" icon={TrendingUp}>
            <DataTable
              head={["Goal", "Type", "Due", "Progress", "Status"]}
              rows={p.performance.goals.map((g) => [
                g.title,
                g.type,
                g.due,
                <div key="k533" className="flex min-w-[140px] items-center gap-2">
                  <Progress value={g.progress} className="h-2 flex-1" />
                  <span className="text-xs font-semibold">{g.progress}%</span>
                </div>,
                <Badge
                  key="k537"
                  variant="outline"
                  className={
                    g.status === "At Risk"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-primary/30 bg-primary/10 text-primary"
                  }
                >
                  {g.status}
                </Badge>,
              ])}
            />
          </Section>
          <Section title="Review History" icon={FileText}>
            <DataTable
              head={["Cycle", "Reviewer", "Date", "Rating", "Status", "Remarks"]}
              rows={p.performance.reviews.map((r) => [
                r.cycle,
                r.reviewer,
                r.date,
                r.rating,
                <Badge
                  key="k558"
                  variant="outline"
                  className={
                    r.status === "Completed"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }
                >
                  {r.status}
                </Badge>,
                <span key="k568" className="text-muted-foreground text-xs">
                  {r.remarks}
                </span>,
              ])}
            />
          </Section>
        </TabsContent>

        {/* Training */}
        <TabsContent value="training" className="space-y-4 pt-4">
          <Section title="Training & Certifications" icon={GraduationCap}>
            <DataTable
              head={["Programme", "Type", "Trainer", "From", "To", "Status", "Score"]}
              rows={p.training.map((t) => [
                <span key="k580" className="font-medium">
                  {t.title}
                </span>,
                t.type,
                t.trainer,
                t.from,
                t.to,
                <Badge
                  key="k585"
                  variant="outline"
                  className={
                    t.status === "Completed"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : t.status === "Ongoing"
                        ? "border-gold/40 bg-gold/15 text-gold"
                        : "border-border bg-muted text-muted-foreground"
                  }
                >
                  {t.status}
                </Badge>,
                t.score,
              ])}
            />
          </Section>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="space-y-4 pt-4">
          <Section title="Documents" icon={FileText}>
            <DataTable
              head={["Document", "Type", "Uploaded", "Status", ""]}
              rows={p.documents.map((d) => [
                d.name,
                d.type,
                d.uploaded,
                <Badge
                  key="k612"
                  variant="outline"
                  className={
                    d.status === "Verified"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-gold/40 bg-gold/15 text-gold"
                  }
                >
                  {d.status}
                </Badge>,
                <Button
                  key="k622"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const ok = exportLetterPdf({
                      title: d.name,
                      reference: `${d.type} · ${employee.id}`,
                      recipient: {
                        name: employee.name,
                        lines: [employee.role, employee.dept, employee.branch],
                      },
                      bodyHtml: `<p>This is a system-generated copy of the document <b>${d.name}</b> (${d.type}) held on file for ${employee.name} (${employee.id}).</p><p>Uploaded on <b>${d.uploaded}</b> · Verification status <b>${d.status}</b>.</p><p>This copy is issued for record-keeping purposes and reflects the document register as on ${new Date().toLocaleDateString("en-IN")}.</p>`,
                      signatory: { name: "Human Resources", designation: "HR Operations" },
                    });
                    toast[ok ? "success" : "error"](
                      ok
                        ? `${d.name} ready — save as PDF`
                        : "Allow pop-ups to download the document",
                    );
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>,
              ])}
            />
          </Section>
          <Section title="Issued Assets" icon={Laptop}>
            <DataTable
              head={["Asset Tag", "Item", "Issued On", "Condition"]}
              rows={p.assets.map((a) => [a.tag, a.item, a.issued, a.condition])}
            />
          </Section>
          {selfView && (
            <p className="text-muted-foreground text-xs">
              Need a correction? Raise a request from Support Tickets and HR will update your
              record.
            </p>
          )}
        </TabsContent>

        {/* Cases: promotions, transfers, warnings, exits, referrals, insurance, retirement */}
        <TabsContent value="cases" className="pt-4">
          <EmployeeCases empId={employee.id} mode={selfView ? "self" : "hr"} />
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="pt-4">
          <Section title="Employment Timeline" icon={History}>
            <ol className="border-border relative space-y-6 border-l pl-6">
              {p.timeline.map((t, i) => (
                <li key={i}>
                  <span
                    className={cn(
                      "ring-background absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-4",
                      t.kind === "promotion"
                        ? "bg-primary"
                        : t.kind === "award"
                          ? "bg-gold"
                          : t.kind === "warning"
                            ? "bg-destructive"
                            : "bg-muted-foreground",
                    )}
                  />
                  <div className="text-muted-foreground text-xs">{t.date}</div>
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="text-muted-foreground text-sm">{t.detail}</div>
                </li>
              ))}
            </ol>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ManagerAssignment({ employee }) {
  const map = useManagerMap();
  // Candidates: people of the same entity, including new hires (the list offered every entity's seeded staff only).
  const people = useDirectory().filter((e) => e.orgId === employee.orgId && e.id !== employee.id);
  const reports = directReports(map, employee.id);
  const current = map[employee.id] ?? "";

  return (
    <div className="border-border bg-card shadow-card space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <UserCheck className="text-primary h-4 w-4" /> Manager Assignment
      </div>
      <p className="text-muted-foreground text-xs">
        Assigning a manager lets that person run review cycles and approvals for this employee in
        the employee portal.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs">Reports to</div>
          <Select
            value={current}
            onValueChange={(v) => {
              const id = v === "__none" ? "" : v;
              setManager(employee.id, id);
              if (id && managerStore.get()[employee.id] !== id) {
                toast.error(
                  "That would create a reporting loop — the chosen person reports (directly or indirectly) to this employee.",
                );
                return;
              }
              const name = people.find((e) => e.id === id)?.name ?? "";
              // Keep the profile's "Reporting Manager" in step with the hierarchy map (they were two unrelated values).
              updateEmployeeRecord(employee.id, { reportingManager: name || "—" });
              toast.success(id ? `Manager set to ${name}` : "Manager cleared");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="No manager assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No manager</SelectItem>
              {people.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} · {e.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-muted-foreground text-xs">
            Current: {managerName(map, employee.id) || "—"}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs">Direct reports ({reports.length})</div>
          <div className="flex flex-wrap gap-1">
            {reports.length === 0 && (
              <span className="text-muted-foreground text-xs">Not a manager yet</span>
            )}
            {reports.map((r) => (
              <Badge
                key={r.id}
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary"
              >
                {r.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
