// A genuinely working hire flow — auto-generated work email and a re-hire
// search step — distinct from the legacy multi-tab "Add Employee" form in
// org.employees.tsx (that form is uncontrolled/presentation-only; this one
// actually creates a record via hiring-data.ts's live store).
import { useState } from "react";
import { UserPlus, Search, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeSalaryBreakup, useSalaryStructures } from "@/features/payroll/data/salary-engine";
import { inr } from "@/lib/store";
import {
  useOrgs,
  useActiveOrgId,
  getOrg,
  accessibleOrgs,
  visibleBranches,
} from "@/features/organization/data/group-data";
import { useDepartments } from "@/features/organization/data/dept-data";
import { allUsers, hireableRoles, useCurrentUser } from "@/features/auth/data/auth-session";
import { useScope } from "@/features/organization/data/tenancy";
import {
  generateWorkEmail,
  hireEmployee,
  searchPastEmployees,
  domainForOrg,
  temporaryPassword,
  validateHireInput,
} from "@/features/recruitment/data/hiring-data";
import { setManager } from "@/features/organization/data/manager-data";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { usePatterns } from "@/features/attendance/data/attendance-pattern";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"];

export function HireEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [rehireOf, setRehireOf] = useState(null);

  const activeOrgId = useActiveOrgId();
  // Only entities the signed-in user may hire into (an entity Admin could create employees in any company of any group).
  useOrgs();
  const orgs = accessibleOrgs();
  const allDepartments = useDepartments();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [orgId, setOrgId] = useState(activeOrgId);
  // Branch the new employee belongs to — the scope's branch by default (a Branch Admin is locked to theirs). A company
  // without branches places everyone at its head office.
  const scope = useScope();
  const me = useCurrentUser();
  const lockedBranch = me.role === "BranchAdmin" ? me.branch : null;
  // Only access roles the hirer could manage themselves.
  const ROLES = hireableRoles(me.role);
  const [branch, setBranch] = useState(scope.branch?.name ?? "");
  const branchOptions = visibleBranches(getOrg(orgId));
  // Departments of the entity chosen in the form (they were those of the entity in the top bar, whatever was selected).
  const departments = allDepartments.filter((d) => d.orgId === orgId);
  const [dept, setDept] = useState("");
  const [designation, setDesignation] = useState("");
  const [role, setRole] = useState("Employee");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [managerId, setManagerId] = useState("");
  const [doj, setDoj] = useState(new Date().toISOString().slice(0, 10));
  const [probationMonths, setProbationMonths] = useState("3");
  const [ctc, setCtc] = useState("");
  const [grade, setGrade] = useState("G3");
  const structures = useSalaryStructures().filter((x) => x.active);
  const structure = structures.find((x) => x.grade === grade);
  const wageType = structure?.wageType ?? "Salaried";
  const preview = ctc && Number(ctc) > 0 ? computeSalaryBreakup(Number(ctc), grade) : null;
  const [patternId, setPatternId] = useState("PAT-01");
  const patterns = usePatterns();
  const [workEmailOverride, setWorkEmailOverride] = useState("");
  const [workEmailTouched, setWorkEmailTouched] = useState(false);

  // Re-hire is for people who have left, within the companies this user may hire into: current staff (or another
  // company's people) used to be offered, creating a second login for an active employee or a hire elsewhere.
  const results = searchPastEmployees(query).filter(
    (r) =>
      orgs.some((o) => o.id === r.orgId) &&
      ["Exited", "Retired"].includes(findEmployee(r.id)?.status ?? ""),
  );

  const suggestedEmail =
    firstName.trim() && lastName.trim() ? generateWorkEmail(firstName, lastName, orgId) : "";
  const effectiveEmail = workEmailTouched ? workEmailOverride : suggestedEmail;

  function reset() {
    setStep("search");
    setQuery("");
    setRehireOf(null);
    setFirstName("");
    setLastName("");
    setPersonalEmail("");
    setPhone("");
    setDob("");
    setGender("");
    setOrgId(activeOrgId);
    setDept("");
    setDesignation("");
    setRole("Employee");
    setEmploymentType("Full-time");
    setManagerId("");
    setDoj(new Date().toISOString().slice(0, 10));
    setProbationMonths("3");
    setCtc("");
    setGrade("G3");
    setPatternId("PAT-01");
    // The branch belonged to the company picked last time — start again from the scope's branch.
    setBranch(scope.branch?.name ?? "");
    setWorkEmailOverride("");
    setWorkEmailTouched(false);
  }

  function startFresh() {
    setRehireOf(null);
    setStep("form");
  }

  function startRehire(match) {
    const [f, ...rest] = match.name.split(" ");
    setRehireOf(match);
    setFirstName(f ?? "");
    setLastName(rest.join(" "));
    setDept(match.dept);
    setOrgId(match.orgId);
    // Directory rows carry a designation in `role` ("Senior Engineer"); casting it to an access role created a login
    // whose role had no navigation entry and crashed the portal. Only real access roles are carried over.
    setRole(ROLES.includes(match.role) ? match.role : "Employee");
    if (!ROLES.includes(match.role)) setDesignation(match.role);
    setStep("form");
  }

  const validationError = validateHireInput({
    firstName,
    lastName,
    personalEmail,
    phone,
    dob,
    doj,
    ctc: Number(ctc),
    workEmail: workEmailTouched ? workEmailOverride : undefined,
  });
  const valid =
    firstName.trim() &&
    lastName.trim() &&
    (branchOptions.length === 0 || !!(lockedBranch || branch)) &&
    dept &&
    designation.trim() &&
    orgId &&
    ctc &&
    Number(ctc) > 0 &&
    !validationError;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="h-4 w-4" /> Hire / Re-hire
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {step === "search" ? (
          <>
            <DialogHeader>
              <DialogTitle>Hire an employee</DialogTitle>
              <DialogDescription>
                First, check whether this person has worked here before — re-hiring preserves their
                prior history instead of creating a duplicate record.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by name or email…"
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {results.length > 0 && (
                <div className="space-y-2">
                  {results.map((r) => (
                    <Card key={r.id} className="shadow-card">
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            {r.name}
                            {r.source === "new-hire" && (
                              <Badge variant="outline" className="text-[10px]">
                                New hire
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {r.email} · {r.dept} · {getOrg(r.orgId)?.name ?? r.orgId}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => startRehire(r)}>
                          <History className="h-3.5 w-3.5" /> Re-hire
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {query.trim().length >= 2 && results.length === 0 && (
                <p className="text-muted-foreground text-xs">No matching past record found.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-emerald shadow-premium text-white"
                onClick={startFresh}
              >
                No match — hire as new employee
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {rehireOf ? `Re-hire ${rehireOf.name}` : "New employee details"}
              </DialogTitle>
              <DialogDescription>
                {rehireOf
                  ? "Prior details are pre-filled from their earlier record. Update anything that's changed."
                  : "Work email is generated automatically from the name and organisation domain."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">First name *</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Last name *</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Personal email</Label>
                  <Input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              {/* Date of birth and gender were sent with every hire but the form had no inputs for them. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Date of birth</Label>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger aria-label="Gender">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Female", "Male", "Other"].map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-primary/20 bg-primary/5 space-y-1.5 rounded-lg border p-3">
                <Label className="text-primary flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5" /> Auto-generated work email
                </Label>
                <Input
                  value={effectiveEmail}
                  onChange={(e) => {
                    setWorkEmailOverride(e.target.value);
                    setWorkEmailTouched(true);
                  }}
                  placeholder={suggestedEmail || "firstname-lastname@domain.com"}
                />

                <p className="text-muted-foreground text-[11px]">
                  Editable — collisions are handled automatically (a number is appended).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Organisation *</Label>
                  <Select
                    value={orgId}
                    onValueChange={(v) => {
                      setOrgId(v);
                      setDept("");
                      setManagerId("");
                      setBranch("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-[11px]">Domain: {domainForOrg(orgId)}</p>
                </div>
                {branchOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Branch *</Label>
                    <Select
                      value={lockedBranch ?? branch}
                      onValueChange={setBranch}
                      disabled={!!lockedBranch}
                    >
                      <SelectTrigger aria-label="Branch">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchOptions.map((b) => (
                          <SelectItem key={b.id} value={b.name}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Department *</Label>
                  <Select value={dept} onValueChange={setDept}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Designation *</Label>
                  <Input
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. SAP ABAP Consultant"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Role (system access)</Label>
                  <Select value={role} onValueChange={(v) => setRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Employment type</Label>
                  <Select value={employmentType} onValueChange={(v) => setEmploymentType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Reporting manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers()
                        .filter(
                          (u) =>
                            u.orgId === orgId && u.role !== "Employee" && u.role !== "BranchAdmin",
                        )
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} — {u.designation}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Date of joining</Label>
                  <Input type="date" value={doj} onChange={(e) => setDoj(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Probation (months)</Label>
                  <Select value={probationMonths} onValueChange={setProbationMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Annual CTC (₹) *</Label>
                  <Input
                    type="number"
                    value={ctc}
                    onChange={(e) => setCtc(e.target.value)}
                    placeholder="1200000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_2fr]">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Grade → salary structure *
                  </Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {structures.map((x) => (
                        <SelectItem key={x.grade} value={x.grade}>
                          {x.grade} · {x.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Wage type (from structure)
                  </Label>
                  <div className="border-border bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm">
                    {wageType}
                  </div>
                </div>
                <div className="border-primary/20 bg-primary/5 rounded-lg border p-2 text-xs">
                  {preview ? (
                    <>
                      <div className="font-semibold">
                        Auto-computed: gross {inr(preview.monthlyGross)}/mo · basic{" "}
                        {inr(preview.basic)}
                        {wageType === "Daily wage" ? ` · ${inr(preview.dailyRate)}/day` : ""}
                      </div>
                      <div className="text-muted-foreground">
                        {preview.earnings.map((x) => `${x.label} ${inr(x.monthly)}`).join(" · ")}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Enter CTC to preview the annexure computed from the grade's structure (Master
                      Data → Salary configuration).
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  Attendance pattern (pay-as-you-go / LOP rule)
                </Label>
                <Select value={patternId} onValueChange={setPatternId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {patterns.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-muted-foreground text-[11px]">
                  {patterns.find((p) => p.id === patternId)?.description}
                </div>
              </div>
            </div>

            {validationError && (firstName || ctc) && (
              <p className="text-destructive text-xs">{validationError}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("search")}>
                ← Back
              </Button>
              <Button
                disabled={!valid}
                className="bg-gradient-emerald shadow-premium text-white"
                onClick={() => {
                  const hire = hireEmployee({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    personalEmail: personalEmail.trim(),
                    phone: phone.trim(),
                    // Branch = the department's location in the entity (it was the company name, e.g. "Seereon SAP Practice").
                    dob,
                    gender,
                    orgId,
                    branch:
                      lockedBranch ||
                      branch ||
                      departments.find((d) => d.name === dept)?.location ||
                      getOrg(orgId)?.branches?.[0]?.name ||
                      getOrg(orgId)?.name ||
                      "",
                    dept,
                    designation: designation.trim(),
                    role,
                    employmentType,
                    managerId: managerId || null,
                    doj,
                    probationMonths: Number(probationMonths),
                    ctc: Number(ctc),
                    patternId,
                    grade,
                    wageType,
                    workEmail: workEmailTouched ? workEmailOverride : undefined,
                    rehireOfId: rehireOf?.id,
                  });
                  if (hire.managerId) setManager(hire.id, hire.managerId);
                  toast.success(
                    `${hire.firstName} ${hire.lastName} ${rehireOf ? "re-hired" : "hired"} as ${hire.id} — login ${hire.workEmail} · temporary password ${temporaryPassword(hire)}`,
                    { duration: 12000 },
                  );
                  setOpen(false);
                  reset();
                }}
              >
                {rehireOf ? "Confirm re-hire" : "Create employee"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
