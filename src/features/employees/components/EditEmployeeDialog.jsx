import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Briefcase,
  Landmark,
  FileText,
  Upload,
  Trash2,
  Building2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { patchEmployee, patchEmployeeDocuments } from "@/api/employeeApi";
import { useSessionStore } from "@/features/auth/data/session-store";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";
import Branch_api from "@/api/branch";

const isUuid = (str) =>
  typeof str === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

const DOC_FIELDS = [
  { key: "aadhaar_card", label: "Aadhaar Card", urlKey: "aadhaar_card_url" },
  { key: "pan_card", label: "PAN Card", urlKey: "pan_card_url" },
  { key: "driving_license", label: "Driving License", urlKey: "driving_license_url" },
  { key: "passport", label: "Passport", urlKey: "passport_url" },
  { key: "resume", label: "Resume / CV", urlKey: "resume_url" },
  { key: "offer_letter", label: "Offer Letter", urlKey: "offer_letter_url" },
  { key: "appointment_letter", label: "Appointment Letter", urlKey: "appointment_letter_url" },
  { key: "educational_certificate", label: "Educational Certificate", urlKey: "educational_certificate_url" },
  { key: "address_proof", label: "Address Proof", urlKey: "address_proof_url" },
  { key: "passbook", label: "Cancelled Cheque / Passbook", urlKey: "passbook_url" },
];

export function EditEmployeeDialog({ open, onClose, employee, onUpdated }) {
  const session = useSessionStore();
  const sessionRole = String(session.role || "").toUpperCase();
  const isSuperAdmin = sessionRole === "SUPER_ADMIN" || sessionRole === "SUPERADMIN";
  const isCompanyAdmin = sessionRole === "COMPANY_ADMIN";
  const isBranchAdmin = sessionRole === "BRANCH_ADMIN" || sessionRole === "BRANCHADMIN";
  const isEmployeeRole = sessionRole === "EMPLOYEE";

  const [tab, setTab] = useState("personal");
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [form, setForm] = useState({});
  const [initialForm, setInitialForm] = useState({});
  const [docFiles, setDocFiles] = useState({});

  // Backend scope lists
  const [backendCompanies, setBackendCompanies] = useState([]);
  const [backendBranches, setBackendBranches] = useState([]);

  // Initialize form when employee changes
  useEffect(() => {
    if (!employee) return;
    const initial = {
      first_name: employee.first_name || employee.name?.split(" ")[0] || "",
      last_name: employee.last_name || employee.name?.split(" ").slice(1).join(" ") || "",
      personal_email: employee.personal_email || "",
      phone: employee.phone || "",
      date_of_birth: employee.date_of_birth || employee.dob || "",
      gender: employee.gender || "",
      department: employee.department || employee.dept || "",
      department_id: employee.department_id || "",
      designation: employee.designation || employee.role || "",
      role: employee.role || "Employee",
      employment_type: employee.employment_type || "Full-time",
      manager_id: employee.manager_id || "",
      date_of_joining: employee.date_of_joining || employee.doj || "",
      probation_months: employee.probation_months !== undefined ? String(employee.probation_months) : "3",
      status: employee.status || "Active",
      ctc: employee.ctc !== undefined ? String(employee.ctc) : "",
      grade: employee.grade || "",
      wage_type: employee.wage_type || "Salaried",
      attendance_pattern_id: employee.attendance_pattern_id || "",
      pan_number: employee.pan_number || employee.pan || "",
      aadhaar_number: employee.aadhaar_number || employee.aadhaar || "",
      uan_number: employee.uan_number || employee.uan || "",
      esic_number: employee.esic_number || employee.esiNo || "",
      bank_name: employee.bank_name || "",
      bank_account_number: employee.bank_account_number || employee.accountNumber || "",
      ifsc_code: employee.ifsc_code || "",
      company_id: employee.company_id || "",
      branch_id: employee.branch_id || "",
    };
    setForm(initial);
    setInitialForm(initial);
    setDocFiles({});
  }, [employee]);

  // Load companies for Super Admin
  useEffect(() => {
    if (!open || !isSuperAdmin) return;
    let isMounted = true;
    SuperAdmin_auth.getCompanies()
      .then((res) => {
        const data = res?.data ?? res;
        const list = Array.isArray(data) ? data : data?.items ?? data?.companies ?? [];
        if (isMounted) setBackendCompanies(list);
      })
      .catch((err) => console.warn("Failed to load companies:", err));
    return () => {
      isMounted = false;
    };
  }, [open, isSuperAdmin]);

  // Load branches for selected company
  const targetCompanyId = isSuperAdmin ? form.company_id : session.companyId;
  useEffect(() => {
    if (!open || !targetCompanyId || !isUuid(targetCompanyId)) {
      setBackendBranches([]);
      return;
    }
    let isMounted = true;
    Branch_api.getBranches(targetCompanyId)
      .then((res) => {
        const data = res?.data ?? res;
        const list = Array.isArray(data) ? data : data?.items ?? data?.branches ?? [];
        if (isMounted) setBackendBranches(list);
      })
      .catch((err) => console.warn("Failed to load branches:", err));
    return () => {
      isMounted = false;
    };
  }, [open, targetCompanyId]);

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleFileChange = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 5 MB.");
      e.target.value = "";
      return;
    }
    setDocFiles((prev) => ({ ...prev, [field]: file }));
  };

  const removeSelectedFile = (field) => {
    setDocFiles((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!employee?.id) {
      toast.error("Employee profile ID is missing.");
      return;
    }

    if (isEmployeeRole) {
      toast.error("Employees are not authorized to edit employee records.");
      return;
    }

    // 1. Build sanitized PATCH JSON payload with ONLY changed fields
    // FORBIDDEN by EmployeeUpdate schema: work_email, password, organization_id
    const payload = {};

    const stringFields = [
      "first_name",
      "last_name",
      "personal_email",
      "phone",
      "gender",
      "department",
      "designation",
      "role",
      "employment_type",
      "status",
      "grade",
      "wage_type",
      "attendance_pattern_id",
      "pan_number",
      "aadhaar_number",
      "uan_number",
      "esic_number",
      "bank_name",
      "bank_account_number",
      "ifsc_code",
    ];

    stringFields.forEach((key) => {
      if (form[key] !== initialForm[key]) {
        const val = String(form[key] ?? "").trim();
        payload[key] = val || null;
      }
    });

    // Date fields: Pydantic rejects empty strings for date types
    if (form.date_of_birth !== initialForm.date_of_birth) {
      payload.date_of_birth = form.date_of_birth ? String(form.date_of_birth).trim() : null;
    }
    if (form.date_of_joining !== initialForm.date_of_joining) {
      payload.date_of_joining = form.date_of_joining ? String(form.date_of_joining).trim() : null;
    }

    // UUID fields
    if (form.department_id !== initialForm.department_id) {
      payload.department_id = isUuid(form.department_id) ? form.department_id : null;
    }
    if (form.manager_id !== initialForm.manager_id) {
      payload.manager_id = isUuid(form.manager_id) ? form.manager_id : null;
    }

    if (form.probation_months !== initialForm.probation_months) {
      payload.probation_months =
        form.probation_months !== "" ? Number(form.probation_months) || 0 : null;
    }

    if (form.ctc !== initialForm.ctc) {
      payload.ctc = form.ctc !== "" ? Number(form.ctc) || 0 : null;
    }

    // Tenant placement scope updates according to caller permissions
    if (isSuperAdmin) {
      if (form.company_id !== initialForm.company_id) {
        payload.company_id = isUuid(form.company_id) ? form.company_id : null;
      }
      if (form.branch_id !== initialForm.branch_id) {
        payload.branch_id = isUuid(form.branch_id) ? form.branch_id : null;
      }
    } else if (isCompanyAdmin) {
      if (form.branch_id !== initialForm.branch_id) {
        payload.branch_id = isUuid(form.branch_id) ? form.branch_id : null;
      }
    }

    const selectedFileEntries = Object.entries(docFiles).filter(
      ([, f]) => f instanceof File && f.size > 0,
    );

    const hasDataChanges = Object.keys(payload).length > 0;
    const hasDocChanges = selectedFileEntries.length > 0;

    if (!hasDataChanges && !hasDocChanges) {
      toast.info("No changes to save.");
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      let updatedEmployee = employee;

      // Step 1: Update details with JSON PATCH (only if any fields changed)
      if (hasDataChanges) {
        updatedEmployee = await patchEmployee(employee.id, payload);
      }

      // Step 2: Upload/replace documents if any new files were selected
      if (hasDocChanges) {
        const formData = new FormData();
        selectedFileEntries.forEach(([fieldName, file]) => {
          formData.append(fieldName, file);
        });
        const docRes = await patchEmployeeDocuments(employee.id, formData);
        if (docRes && typeof docRes === "object") {
          updatedEmployee = { ...updatedEmployee, ...docRes };
        }
      }

      toast.success("Employee updated successfully");
      if (onUpdated) onUpdated(updatedEmployee);
      onClose();
    } catch (err) {
      console.error("Update employee error:", err);
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        err?.message ??
        "Failed to update employee.";
      toast.error(
        Array.isArray(detail)
          ? detail
              .map((d) => `${(d.loc ?? []).filter((p) => p !== "body").join(".")}: ${d.msg}`)
              .join(", ")
          : String(detail),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <User className="text-primary h-5 w-5" /> Edit Employee
          </DialogTitle>
          <DialogDescription>
            Update employee details and upload/replace documents. Changes are saved to the HRMS backend.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal" className="flex items-center gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" /> Personal
              </TabsTrigger>
              <TabsTrigger value="job" className="flex items-center gap-1.5 text-xs">
                <Briefcase className="h-3.5 w-3.5" /> Job & Org
              </TabsTrigger>
              <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs">
                <Landmark className="h-3.5 w-3.5" /> Statutory & Bank
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Documents
              </TabsTrigger>
            </TabsList>

            {/* TAB: Personal */}
            <TabsContent value="personal" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input
                    value={form.first_name || ""}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input
                    value={form.last_name || ""}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Work Email (Read-only)</Label>
                  <Input
                    value={employee?.work_email || employee?.email || ""}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground">Work email cannot be changed via update.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Personal Email</Label>
                  <Input
                    type="email"
                    value={form.personal_email || ""}
                    onChange={(e) => handleChange("personal_email", e.target.value)}
                    placeholder="personal@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input
                    value={form.phone || ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="9876543210"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={form.date_of_birth || ""}
                    onChange={(e) => handleChange("date_of_birth", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select
                    value={form.gender || ""}
                    onValueChange={(v) => handleChange("gender", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Job & Org */}
            <TabsContent value="job" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input
                    value={form.department || ""}
                    onChange={(e) => handleChange("department", e.target.value)}
                    placeholder="e.g. Engineering, HR"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Designation</Label>
                  <Input
                    value={form.designation || ""}
                    onChange={(e) => handleChange("designation", e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={form.role || "Employee"}
                    onValueChange={(v) => handleChange("role", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Employee">Employee</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="HOD">HOD</SelectItem>
                      <SelectItem value="BranchAdmin">Branch Admin</SelectItem>
                      <SelectItem value="Admin">Company Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Employment Type</Label>
                  <Select
                    value={form.employment_type || "Full-time"}
                    onValueChange={(v) => handleChange("employment_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Employment Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status || "Active"}
                    onValueChange={(v) => handleChange("status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Notice">Notice</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Date of Joining</Label>
                  <Input
                    type="date"
                    value={form.date_of_joining || ""}
                    onChange={(e) => handleChange("date_of_joining", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Probation (Months)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={form.probation_months || ""}
                    onChange={(e) => handleChange("probation_months", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Annual CTC (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.ctc || ""}
                    onChange={(e) => handleChange("ctc", e.target.value)}
                    placeholder="600000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Grade</Label>
                  <Input
                    value={form.grade || ""}
                    onChange={(e) => handleChange("grade", e.target.value)}
                    placeholder="e.g. G1, G2, G3"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Wage Type</Label>
                  <Select
                    value={form.wage_type || "Salaried"}
                    onValueChange={(v) => handleChange("wage_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wage Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Salaried">Salaried</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Scope placement section */}
              {(isSuperAdmin || isCompanyAdmin) && (
                <Card className="bg-muted/30 border">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Building2 className="text-primary h-4 w-4" /> Tenant Placement Scope
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {isSuperAdmin && (
                        <div className="space-y-1.5">
                          <Label>Company</Label>
                          <Select
                            value={form.company_id || ""}
                            onValueChange={(v) => {
                              handleChange("company_id", v);
                              handleChange("branch_id", "");
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Organization-level (No company)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None (Organization level)</SelectItem>
                              {backendCompanies.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name || c.legal_name || c.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label>Branch</Label>
                        <Select
                          value={form.branch_id || ""}
                          onValueChange={(v) => handleChange("branch_id", v)}
                          disabled={!targetCompanyId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All branches / Head office" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None (Company level)</SelectItem>
                            {backendBranches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name || b.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB: Statutory & Bank */}
            <TabsContent value="bank" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>PAN Number</Label>
                  <Input
                    value={form.pan_number || ""}
                    onChange={(e) => handleChange("pan_number", e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Aadhaar Number</Label>
                  <Input
                    value={form.aadhaar_number || ""}
                    onChange={(e) => handleChange("aadhaar_number", e.target.value.replace(/\D/g, ""))}
                    placeholder="12-digit number"
                    maxLength={12}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>UAN Number</Label>
                  <Input
                    value={form.uan_number || ""}
                    onChange={(e) => handleChange("uan_number", e.target.value.replace(/\D/g, ""))}
                    placeholder="12-digit UAN"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ESIC Number</Label>
                  <Input
                    value={form.esic_number || ""}
                    onChange={(e) => handleChange("esic_number", e.target.value)}
                    placeholder="17-digit ESIC"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-3 text-sm font-semibold">Bank Account Details</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Bank Name</Label>
                    <Input
                      value={form.bank_name || ""}
                      onChange={(e) => handleChange("bank_name", e.target.value)}
                      placeholder="e.g. HDFC Bank"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account Number</Label>
                    <Input
                      value={form.bank_account_number || ""}
                      onChange={(e) => handleChange("bank_account_number", e.target.value)}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>IFSC Code</Label>
                    <Input
                      value={form.ifsc_code || ""}
                      onChange={(e) => handleChange("ifsc_code", e.target.value.toUpperCase())}
                      placeholder="HDFC0001234"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Documents */}
            <TabsContent value="docs" className="space-y-4 pt-4">
              <p className="text-muted-foreground text-xs">
                Upload new files to replace existing documents. Existing documents on record remain intact unless a new file is uploaded.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {DOC_FIELDS.map(({ key, label, urlKey }) => {
                  const existingUrl = employee?.[urlKey];
                  const newFile = docFiles[key];

                  return (
                    <Card key={key} className="border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{label}</div>
                          {existingUrl ? (
                            <a
                              href={existingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline mt-0.5 inline-flex items-center gap-1 text-xs"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Current file{" "}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <div className="text-muted-foreground mt-0.5 text-xs">Not uploaded</div>
                          )}
                        </div>

                        {newFile ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-600 truncate max-w-[120px]">
                              {newFile.name}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeSelectedFile(key)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <label className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition">
                            <Upload className="h-3.5 w-3.5" /> Replace
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) => handleFileChange(key, e)}
                            />
                          </label>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-emerald shadow-premium text-white flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditEmployeeDialog;
