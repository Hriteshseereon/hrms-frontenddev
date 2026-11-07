// Shared leave pieces: the detailed apply form (employee self-service / HR on behalf from My Workspace) and the
// employee leave side-sheet (balances, ledger, approvals trail) used by Balance Leave and the Employees list.
import {
  loadLeaveTypeOptions,
  loadReasonCategories,
  loadTeamMembers,
  applyForLeave as submitEmployeeLeaveRequest,
} from "@/features/leave/data/leaveRequestAdapter";

import { getEmployeeLeaveTypes } from "@/features/leave/data/employeeLeaveTypeAdapter";
import { useEffect, useMemo, useState } from "react";
import { leaveApi } from "@/api/leaveApi";
import { AttachmentChips } from "@/components/common/AttachmentViewer";
// import { captureFiles } from "@/lib/attachments";
import { Paperclip, CalendarDays, Wallet, History, FileDown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
// import { LEAVE_REASON_CATEGORIES } from "@/features/leave/data/leave-data";
import {
  LOP_TYPE,
  applicableLeaveTypes,
  chainStepsFor,
  leaveBalances,
  nextLeaveId,
  submitLeaveApplication,
  todayLocal,
  useLeaveApplications,
  useLeaveTypes,
  validateLeaveApplication,
} from "@/features/leave/data/leave-engine";
import { useCompOffBalance, useCompOffLedgerOf } from "@/features/travel/data/compoff-data";
import {
  findEmployee,
  getEmployeeProfile,
  useDirectory,
} from "@/features/employees/data/employee-directory";
import { useCurrentUser, userById } from "@/features/auth/data/auth-session";
import { exportReportPdf } from "@/lib/export-utils";
import {
  Field,
  SectionTitle,
  useScopedEmployees,
} from "@/features/employees/components/CasePieces";

const statusTone = (s) =>
  s === "Approved"
    ? "border-primary/30 bg-primary/10 text-primary"
    : s === "Rejected"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : s === "Cancelled"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/40 bg-gold/15 text-gold";

/** Detailed leave application form. `empId` fixes the applicant (self-service); otherwise HR picks the employee. */
// export function LeaveApplyForm({ empId: fixedEmpId, onDone }) {
//   const me = useCurrentUser();
//   const [allRows] = useLeaveApplications();
//   const [leaveTypes] = useLeaveTypes();
//   const allDir = useDirectory();
//   // HR files on behalf of employees of the active entity only (the picker listed every entity in the group).
//   const scoped = useScopedEmployees();
//   const dir = fixedEmpId ? allDir : scoped;
//   const [empId, setEmpId] = useState(fixedEmpId ?? "");
//   // Signed-in users without a seeded directory row (tenant admins, invited users) can still apply for themselves.
//   const user = userById(empId);
//   const emp =
//     findEmployee(empId) ?? (user ? { id: user.id, name: user.name, orgId: user.orgId } : undefined);
//   const [leaveType, setLeaveType] = useState("");
//   const [from, setFrom] = useState("");
//   const [to, setTo] = useState("");
//   const [dayPart, setDayPart] = useState("Full day");
//   const [reasonCategory, setReasonCategory] = useState(LEAVE_REASON_CATEGORIES[0]);
//   const [description, setDescription] = useState("");
//   const [contact, setContact] = useState("");
//   const [location, setLocation] = useState("");
//   const [handoverTo, setHandoverTo] = useState("");
//   const [handoverNotes, setHandoverNotes] = useState("");
//   const [documents, setDocuments] = useState([]);
//   const [backendCheck, setBackendCheck] = useState(null);
//   const [validating, setValidating] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [uploading, setUploading] = useState(false);

//   const balances = useMemo(() => (empId ? leaveBalances(empId, allRows) : []), [empId, allRows]);

//   // Real-time backend validation debounced on form changes
//   useEffect(() => {
//     if (!leaveType || !from || !to) {
//       setBackendCheck(null);
//       return;
//     }
//     const timer = setTimeout(async () => {
//       setValidating(true);
//       try {
//         const res = await leaveApi.validateApplication({
//           leave_type: leaveType,
//           from_date: from,
//           to_date: to,
//           day_part: dayPart,
//           documents,
//         });
//         if (res && res.data) {
//           setBackendCheck(res.data);
//         }
//       } catch (err) {
//         setBackendCheck(null);
//       } finally {
//         setValidating(false);
//       }
//     }, 300);
//     return () => clearTimeout(timer);
//   }, [leaveType, from, to, dayPart, documents]);

//   // Half days are validated as half days (balance, limits)
//   const localCheck = empId
//     ? validateLeaveApplication(
//         empId,
//         { leaveType, from, to, attachment: documents[0], dayPart },
//         allRows,
//         leaveTypes,
//       )
//     : { ok: false, errors: [], warnings: [], days: 0 };

//   const check = backendCheck
//     ? {
//         ok: backendCheck.ok,
//         errors: backendCheck.errors || [],
//         warnings: backendCheck.warnings || [],
//         days: typeof backendCheck.days === "number" ? backendCheck.days : localCheck.days,
//       }
//     : localCheck;

//   const days = check.days;
//   const needsDoc = /sick|medical/i.test(leaveType) && days > 2 && documents.length === 0;
//   const valid =
//     Boolean(empId && leaveType && from && to && description.trim()) &&
//     check.ok &&
//     !needsDoc &&
//     !submitting &&
//     !uploading;

//   const submit = async () => {
//     if (!check.ok) return toast.error(check.errors[0] ?? "Check the application.");
//     if (needsDoc) return toast.error("Attach a medical certificate for sick leave beyond 2 days.");
//     if (!emp) return toast.error("Choose the employee.");
//     const e = emp;

//     setSubmitting(true);
//     try {
//       const payload = {
//         leave_type: leaveType,
//         from_date: from,
//         to_date: to,
//         day_part: dayPart,
//         reason_category: reasonCategory,
//         description: description.trim(),
//         documents,
//         contact_during_leave: contact,
//         location_during_leave: location,
//         handover_to: handoverTo,
//         handover_notes: handoverNotes,
//       };
//       const res = await leaveApi.applyForLeave(payload);
//       const code = res?.data?.application_code || res?.data?.id || "submitted";
//       toast.success(
//         `Leave request ${code} submitted for approval (${days} day${days === 1 ? "" : "s"})`,
//       );
//       onDone();
//     } catch (err) {
//       console.warn("Backend applyForLeave failed, falling back to local store:", err);
//       const app = {
//         id: nextLeaveId(allRows),
//         employee: e.name,
//         empId: e.id,
//         leaveType,
//         from,
//         to,
//         days,
//         description: description.trim(),
//         attachment: documents[0],
//         documents,
//         status: "Pending",
//         approvalChain: chainStepsFor(leaveType).join(" → "),
//         chainStep: 0,
//         appliedOn: todayLocal(),
//         dayPart,
//         reasonCategory,
//         contactDuringLeave: contact,
//         locationDuringLeave: location,
//         handoverTo,
//         handoverNotes,
//         appliedBy: me.id === e.id ? undefined : me.name,
//       };
//       submitLeaveApplication(app);
//       toast.success(
//         `Leave request ${app.id} submitted for approval (${days} day${days === 1 ? "" : "s"})`,
//       );
//       onDone();
//     } finally {
//       setSubmitting(false);
//     }
//   };
//   const team = dir.filter((d) => d.orgId === (emp?.orgId ?? "") && d.id !== empId);
//   return (
//     <div className="space-y-4">
//       {!fixedEmpId && (
//         <>
//           <SectionTitle n={1} title="Employee" />
//           <Select value={empId} onValueChange={setEmpId}>
//             <SelectTrigger>
//               <SelectValue placeholder="Select employee" />
//             </SelectTrigger>
//             <SelectContent>
//               {dir.map((d) => (
//                 <SelectItem key={d.id} value={d.id}>
//                   {d.name} · {d.id} · {d.dept}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </>
//       )}
//       {empId && balances.length > 0 && (
//         <div className="flex flex-wrap gap-1.5">
//           {balances
//             .filter((b) => Number.isFinite(b.available))
//             .map((b) => (
//               <Badge
//                 key={b.type}
//                 variant="outline"
//                 className={cn(
//                   "font-normal",
//                   b.available <= 0 && "border-destructive/40 text-destructive",
//                 )}
//               >
//                 {b.type}: <b className="ml-1">{b.available}</b>&nbsp;left
//               </Badge>
//             ))}
//         </div>
//       )}
//       <SectionTitle n={fixedEmpId ? 1 : 2} title="Leave & dates" />
//       <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
//         <Field label="Leave type" required className="sm:col-span-2">
//           <Select value={leaveType} onValueChange={setLeaveType}>
//             <SelectTrigger>
//               <SelectValue placeholder="Select leave type" />
//             </SelectTrigger>
//             <SelectContent>
//               {applicableLeaveTypes(leaveTypes)
//                 .filter((t) => t.status === "Active")
//                 .map((t) => {
//                   const b = balances.find((x) => x.type === t.name);
//                   return (
//                     <SelectItem key={t.id} value={t.name}>
//                       {t.name} ·{" "}
//                       {b && Number.isFinite(b.available)
//                         ? `${b.available} available`
//                         : t.name === LOP_TYPE
//                           ? "unpaid"
//                           : `max ${t.maxDays} days`}
//                     </SelectItem>
//                   );
//                 })}
//             </SelectContent>
//           </Select>
//         </Field>
//         <Field label="From" required>
//           <Input
//             type="date"
//             value={from}
//             onChange={(e) => {
//               setFrom(e.target.value);
//               if (!to || to < e.target.value || dayPart !== "Full day") setTo(e.target.value);
//             }}
//           />
//         </Field>
//         <Field label="To" required>
//           <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
//         </Field>
//         <Field label="Day part" className="sm:col-span-2">
//           <RadioGroup
//             value={dayPart}
//             onValueChange={(v) => {
//               setDayPart(v);
//               // A half day is a single date.
//               if (v !== "Full day" && from) setTo(from);
//             }}
//             className="flex flex-wrap gap-4 pt-1"
//           >
//             {["Full day", "First half", "Second half"].map((d) => (
//               <div key={d} className="flex items-center gap-2">
//                 <RadioGroupItem value={d} id={`dp-${d}`} />
//                 <Label htmlFor={`dp-${d}`} className="text-sm font-normal">
//                   {d}
//                 </Label>
//               </div>
//             ))}
//           </RadioGroup>
//         </Field>
//         <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm sm:col-span-2">
//           <div className="text-muted-foreground text-xs">Number of days</div>
//           <div className="text-2xl font-bold">
//             {days || 0}{" "}
//             <span className="text-muted-foreground text-xs font-normal">
//               working day(s) · weekly offs & holidays excluded
//               {dayPart !== "Full day" ? " · half day" : ""}
//             </span>
//           </div>
//         </div>
//       </div>
//       {(check.errors.length > 0 || check.warnings.length > 0) && (leaveType || from || to) && (
//         <div className="space-y-1">
//           {check.errors.map((e) => (
//             <div
//               key={e}
//               className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-1.5 text-xs"
//             >
//               {e}
//             </div>
//           ))}
//           {check.warnings.map((w) => (
//             <div
//               key={w}
//               className="border-gold/40 bg-gold/10 rounded-md border px-3 py-1.5 text-xs"
//             >
//               {w}
//             </div>
//           ))}
//         </div>
//       )}
//       <SectionTitle n={fixedEmpId ? 2 : 3} title="Reason & supporting documents" />
//       <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
//         <Field label="Reason category" required>
//           <Select value={reasonCategory} onValueChange={setReasonCategory}>
//             <SelectTrigger>
//               <SelectValue />
//             </SelectTrigger>
//             <SelectContent>
//               {LEAVE_REASON_CATEGORIES.map((r) => (
//                 <SelectItem key={r} value={r}>
//                   {r}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </Field>
//         <Field label="Description" required className="sm:col-span-2">
//           <Textarea
//             rows={2}
//             value={description}
//             onChange={(e) => setDescription(e.target.value)}
//             placeholder="Reason for the leave"
//           />
//         </Field>
//         <Field
//           label="Supporting documents"
//           hint={
//             needsDoc
//               ? "Medical certificate required for sick leave beyond 2 days"
//               : "Medical certificate, invitation, travel proof…"
//           }
//           className="sm:col-span-3"
//         >
//           <div className="flex flex-wrap items-center gap-2">
//             <label
//               className={cn(
//                 "hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs",
//                 needsDoc ? "border-destructive/50 text-destructive" : "border-border",
//                 uploading && "opacity-60 pointer-events-none",
//               )}
//             >
//               <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Add document"}
//               <input
//                 type="file"
//                 multiple
//                 className="hidden"
//                 disabled={uploading}
//                 onChange={async (e) => {
//                   const files = Array.from(e.target.files ?? []);
//                   if (!files.length) return;
//                   captureFiles(files);
//                   setUploading(true);
//                   try {
//                     for (const file of files) {
//                       try {
//                         const res = await leaveApi.uploadLeaveDocument(file);
//                         const url = res?.data?.url || res?.data?.filename || file.name;
//                         setDocuments((prev) => [...new Set([...prev, url])]);
//                         toast.success(`Attached ${file.name}`);
//                       } catch {
//                         setDocuments((prev) => [...new Set([...prev, file.name])]);
//                       }
//                     }
//                   } finally {
//                     setUploading(false);
//                     e.currentTarget.value = "";
//                   }
//                 }}
//               />
//             </label>
//             {documents.map((d) => (
//               <Badge key={d} variant="outline" className="gap-1 font-normal">
//                 {d}
//                 <button
//                   type="button"
//                   onClick={() => setDocuments(documents.filter((x) => x !== d))}
//                 >
//                   <X className="h-3 w-3" />
//                 </button>
//               </Badge>
//             ))}
//           </div>
//         </Field>
//       </div>
//       <SectionTitle n={fixedEmpId ? 3 : 4} title="Availability & handover" />
//       <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
//         <Field label="Contact during leave">
//           <Input
//             value={contact}
//             onChange={(e) => setContact(e.target.value)}
//             placeholder="Phone / e-mail reachable during leave"
//           />
//         </Field>
//         <Field label="Location during leave">
//           <Input
//             value={location}
//             onChange={(e) => setLocation(e.target.value)}
//             placeholder="City / out of station"
//           />
//         </Field>
//         <Field label="Handover to">
//           <Select value={handoverTo} onValueChange={setHandoverTo}>
//             <SelectTrigger>
//               <SelectValue placeholder="Team member" />
//             </SelectTrigger>
//             <SelectContent>
//               {team.map((t) => (
//                 <SelectItem key={t.id} value={t.name}>
//                   {t.name} · {t.role}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </Field>
//         <Field label="Handover notes">
//           <Input
//             value={handoverNotes}
//             onChange={(e) => setHandoverNotes(e.target.value)}
//             placeholder="Open tickets, client calls, deliverables"
//           />
//         </Field>
//       </div>
//       <div className="text-muted-foreground text-[11px]">
//         Approval chain:{" "}
//         {leaveType ? chainStepsFor(leaveType).join(" → ") : "per leave type (Leave Master)"}
//         {emp ? ` · reporting manager ${getEmployeeProfile(emp.id).job.reportingManager}` : ""}
//       </div>
//       <DialogFooter>
//         <Button variant="outline" onClick={onDone}>
//           Cancel
//         </Button>
//         <Button
//           className="bg-gradient-emerald text-white"
//           disabled={!valid || submitting}
//           onClick={submit}
//         >
//           {submitting ? "Submitting..." : "Submit leave request"}
//         </Button>
//       </DialogFooter>
//     </div>
//   );
// }
/** Detailed leave application form. */
// export function LeaveApplyForm({ empId: fixedEmpId, onDone }) {
//   const me = useCurrentUser();

//   const [allRows] = useLeaveApplications();
//   const [leaveTypes] = useLeaveTypes();

//   const allDir = useDirectory();
//   const scoped = useScopedEmployees();
//   const dir = fixedEmpId ? allDir : scoped;

//   const [empId, setEmpId] = useState(fixedEmpId ?? "");

//   const user = userById(empId);
//   const emp =
//     findEmployee(empId) ??
//     (user
//       ? { id: user.id, name: user.name, orgId: user.orgId }
//       : undefined);

//   const [leaveType, setLeaveType] = useState("");
//   const [from, setFrom] = useState("");
//   const [to, setTo] = useState("");
//   const [dayPart, setDayPart] = useState("Full day");

//   const [reasonCategory, setReasonCategory] = useState("");
//   const [description, setDescription] = useState("");
//   const [contact, setContact] = useState("");
//   const [location, setLocation] = useState("");
//   const [handoverTo, setHandoverTo] = useState("");
//   const [handoverNotes, setHandoverNotes] = useState("");

//   // Actual browser File objects, not previously uploaded filenames.
//   const [documents, setDocuments] = useState([]);

//   // New employee leave-request dropdown data.
//   const [apiLeaveTypes, setApiLeaveTypes] = useState([]);
//   const [reasonCategories, setReasonCategories] = useState([]);
//   const [handoverMembers, setHandoverMembers] = useState([]);
//   const [dropdownLoading, setDropdownLoading] = useState(true);
//   const [dropdownError, setDropdownError] = useState(false);

//   const [backendCheck, setBackendCheck] = useState(null);
//   const [validating, setValidating] = useState(false);
//   const [submitting, setSubmitting] = useState(false);

//   const balances = useMemo(
//     () => (empId ? leaveBalances(empId, allRows) : []),
//     [empId, allRows],
//   );

//   // Load the three dropdowns from the new Employee Leave Request APIs.
//   useEffect(() => {
//     let active = true;

//     const loadDropdowns = async () => {
//       setDropdownLoading(true);
//       setDropdownError(false);

//       const [typesRes, reasonsRes, membersRes] =
//         await Promise.allSettled([
//           loadLeaveTypeOptions(),
//           loadReasonCategories(),
//           loadTeamMembers(),
//         ]);

//       if (!active) return;

//       if (typesRes.status === "fulfilled") {
//         setApiLeaveTypes(typesRes.value);
//       }

//       if (reasonsRes.status === "fulfilled") {
//         setReasonCategories(reasonsRes.value);

//         if (reasonsRes.value.length > 0) {
//           setReasonCategory((previous) =>
//             previous || reasonsRes.value[0].value
//           );
//         }
//       }

//       if (membersRes.status === "fulfilled") {
//         setHandoverMembers(membersRes.value);
//       }

//       const failed =
//         typesRes.status === "rejected" ||
//         reasonsRes.status === "rejected" ||
//         membersRes.status === "rejected";

//       setDropdownError(failed);
//       setDropdownLoading(false);

//       if (failed) {
//         console.warn("Some leave dropdown APIs could not load:", {
//           types: typesRes.status,
//           reasons: reasonsRes.status,
//           members: membersRes.status,
//         });
//       }
//     };

//     loadDropdowns();

//     return () => {
//       active = false;
//     };
//   }, []);

//   // Keep existing backend date validation integration.
//   useEffect(() => {
//     if (!leaveType || !from || !to) {
//       setBackendCheck(null);
//       return;
//     }

//     const timer = setTimeout(async () => {
//       setValidating(true);

//       try {
//         const res = await leaveApi.validateApplication({
//           leave_type: leaveType,
//           from_date: from,
//           to_date: to,
//           day_part: dayPart,
//           documents,
//         });

//         if (res?.data) {
//           setBackendCheck(res.data);
//         }
//       } catch (err) {
//         setBackendCheck(null);
//       } finally {
//         setValidating(false);
//       }
//     }, 300);

//     return () => clearTimeout(timer);
//   }, [leaveType, from, to, dayPart, documents]);

//   // Existing local calculation is retained for the days display.
//   const localCheck = empId
//     ? validateLeaveApplication(
//         empId,
//         {
//           leaveType,
//           from,
//           to,
//           attachment: documents[0]?.name,
//           dayPart,
//         },
//         allRows,
//         leaveTypes,
//       )
//     : { ok: false, errors: [], warnings: [], days: 0 };

//   const check = backendCheck
//     ? {
//         ok: backendCheck.ok,
//         errors: backendCheck.errors || [],
//         warnings: backendCheck.warnings || [],
//         days:
//           typeof backendCheck.days === "number"
//             ? backendCheck.days
//             : localCheck.days,
//       }
//     : localCheck;

//   const days = check.days;

//   const needsDoc =
//     /sick|medical/i.test(leaveType) &&
//     days > 2 &&
//     documents.length === 0;

//   const dateRangeValid =
//     Boolean(from && to) && to >= from;

//   const valid =
//     Boolean(
//       empId &&
//       leaveType &&
//       from &&
//       to &&
//       reasonCategory &&
//       description.trim() &&
//       dateRangeValid
//     ) &&
//     !needsDoc &&
//     !submitting;

//   // Validate actual files before adding them to the request.
//   const handleFileChange = (e) => {
//     const selected = Array.from(e.target.files ?? []);

//     if (!selected.length) return;

//     const allowedTypes = [
//       "application/pdf",
//       "image/jpeg",
//       "image/jpg",
//       "image/png",
//     ];

//     const maxSize = 5 * 1024 * 1024;
//     const maxFiles = 10;

//     const validFiles = [];

//     for (const file of selected) {
//       if (!allowedTypes.includes(file.type)) {
//         toast.error(`${file.name}: Only PDF, JPG, JPEG and PNG are allowed.`);
//         continue;
//       }

//       if (file.size > maxSize) {
//         toast.error(`${file.name}: Maximum file size is 5 MB.`);
//         continue;
//       }

//       validFiles.push(file);
//     }

//     setDocuments((previous) => {
//       const combined = [...previous];

//       for (const file of validFiles) {
//         if (
//           !combined.some(
//             (existing) =>
//               existing.name === file.name &&
//               existing.size === file.size
//           )
//         ) {
//           combined.push(file);
//         }
//       }

//       if (combined.length > maxFiles) {
//         toast.error("You can attach a maximum of 10 documents.");
//         return combined.slice(0, maxFiles);
//       }

//       return combined;
//     });

//     e.target.value = "";
//   };

//   // Submit directly through the new POST /leave-requests API.
//   const submit = async () => {
//     if (!emp) {
//       return toast.error("Choose the employee.");
//     }

//     if (!valid) {
//       if (needsDoc) {
//         return toast.error(
//           "Attach a medical certificate for sick leave beyond 2 days."
//         );
//       }

//       if (!dateRangeValid) {
//         return toast.error("Please select valid leave dates.");
//       }

//       return toast.error("Please complete all required fields.");
//     }

//     if (documents.length > 10) {
//       return toast.error("You can attach a maximum of 10 documents.");
//     }

//     setSubmitting(true);

//     try {
//       const result = await submitEmployeeLeaveRequest(
//         {
//           leaveType,
//           from,
//           to,
//           dayPart,
//           reasonCategory,
//           description: description.trim(),
//           contactDuringLeave: contact,
//           locationDuringLeave: location,
//           handoverTo,
//           handoverNotes,
//         },
//         documents,
//       );

//       const code = result?.id || "submitted";

//       toast.success(
//         `Leave request ${code} submitted successfully.`
//       );

//       onDone?.();
//     } catch (err) {
//       console.error("Employee leave request submission failed:", err);

//       const message =
//         err?.response?.data?.detail;

//       const errorMessage = Array.isArray(message)
//         ? message.map((e) => e.msg).join(", ")
//         : typeof message === "string"
//           ? message
//           : err?.response?.data?.message ||
//             err?.message ||
//             "Could not submit leave request.";

//       toast.error(errorMessage);

//       // IMPORTANT:
//       // Do not save a local/demo application when the API fails.
//       // Otherwise the UI may show a successful request that was
//       // never actually saved in the backend.
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const team = dir.filter(
//     (d) => d.orgId === (emp?.orgId ?? "") && d.id !== empId
//   );

//   return (
//     <div className="space-y-4">
//       {!fixedEmpId && (
//         <>
//           <SectionTitle n={1} title="Employee" />

//           <Select value={empId} onValueChange={setEmpId}>
//             <SelectTrigger>
//               <SelectValue placeholder="Select employee" />
//             </SelectTrigger>

//             <SelectContent>
//               {dir.map((d) => (
//                 <SelectItem key={d.id} value={d.id}>
//                   {d.name} · {d.id} · {d.dept}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </>
//       )}

//       {empId && balances.length > 0 && (
//         <div className="flex flex-wrap gap-1.5">
//           {balances
//             .filter((b) => Number.isFinite(b.available))
//             .map((b) => (
//               <Badge
//                 key={b.type}
//                 variant="outline"
//                 className={cn(
//                   "font-normal",
//                   b.available <= 0 &&
//                     "border-destructive/40 text-destructive",
//                 )}
//               >
//                 {b.type}: <b className="ml-1">{b.available}</b>&nbsp;left
//               </Badge>
//             ))}
//         </div>
//       )}

//       <SectionTitle
//         n={fixedEmpId ? 1 : 2}
//         title="Leave & dates"
//       />

//       <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
//         <Field label="Leave type" required className="sm:col-span-2">
//           <Select
//             value={leaveType}
//             onValueChange={setLeaveType}
//             disabled={dropdownLoading}
//           >
//             <SelectTrigger>
//               <SelectValue
//                 placeholder={
//                   dropdownLoading
//                     ? "Loading leave types..."
//                     : "Select leave type"
//                 }
//               />
//             </SelectTrigger>

//             <SelectContent>
//               {apiLeaveTypes.map((name) => {
//                 const b = balances.find((x) => x.type === name);

//                 return (
//                   <SelectItem key={name} value={name}>
//                     {name}
//                     {b && Number.isFinite(b.available)
//                       ? ` · ${b.available} available`
//                       : ""}
//                   </SelectItem>
//                 );
//               })}
//             </SelectContent>
//           </Select>
//         </Field>

//         <Field label="From" required>
//           <Input
//             type="date"
//             value={from}
//             onChange={(e) => {
//               setFrom(e.target.value);

//               if (
//                 !to ||
//                 to < e.target.value ||
//                 dayPart !== "Full day"
//               ) {
//                 setTo(e.target.value);
//               }
//             }}
//           />
//         </Field>

//         <Field label="To" required>
//           <Input
//             type="date"
//             value={to}
//             min={from}
//             onChange={(e) => setTo(e.target.value)}
//           />
//         </Field>

//         <Field label="Day part" className="sm:col-span-2">
//           <RadioGroup
//             value={dayPart}
//             onValueChange={(v) => {
//               setDayPart(v);

//               if (v !== "Full day" && from) {
//                 setTo(from);
//               }
//             }}
//             className="flex flex-wrap gap-4 pt-1"
//           >
//             {["Full day", "First half", "Second half"].map((d) => (
//               <div key={d} className="flex items-center gap-2">
//                 <RadioGroupItem value={d} id={`dp-${d}`} />
//                 <Label
//                   htmlFor={`dp-${d}`}
//                   className="text-sm font-normal"
//                 >
//                   {d}
//                 </Label>
//               </div>
//             ))}
//           </RadioGroup>
//         </Field>

//         <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm sm:col-span-2">
//           <div className="text-muted-foreground text-xs">
//             Number of days
//           </div>

//           <div className="text-2xl font-bold">
//             {days || 0}{" "}
//             <span className="text-muted-foreground text-xs font-normal">
//               working day(s) · weekly offs & holidays excluded
//               {dayPart !== "Full day" ? " · half day" : ""}
//             </span>
//           </div>
//         </div>
//       </div>

//       {validating && (
//         <p className="text-muted-foreground text-xs">
//           Validating leave dates...
//         </p>
//       )}

//       {(check.errors.length > 0 ||
//         check.warnings.length > 0) &&
//         (leaveType || from || to) && (
//           <div className="space-y-1">
//             {check.errors.map((e) => (
//               <div
//                 key={e}
//                 className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-1.5 text-xs"
//               >
//                 {e}
//               </div>
//             ))}

//             {check.warnings.map((w) => (
//               <div
//                 key={w}
//                 className="border-gold/40 bg-gold/10 rounded-md border px-3 py-1.5 text-xs"
//               >
//                 {w}
//               </div>
//             ))}
//           </div>
//         )}

//       <SectionTitle
//         n={fixedEmpId ? 2 : 3}
//         title="Reason & supporting documents"
//       />

//       <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
//         <Field label="Reason category" required>
//           <Select
//             value={reasonCategory}
//             onValueChange={setReasonCategory}
//             disabled={dropdownLoading}
//           >
//             <SelectTrigger>
//               <SelectValue
//                 placeholder={
//                   dropdownLoading
//                     ? "Loading categories..."
//                     : "Select reason category"
//                 }
//               />
//             </SelectTrigger>

//             <SelectContent>
//               {reasonCategories.map((r) => (
//                 <SelectItem key={r.value} value={r.value}>
//                   {r.label}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </Field>

//         <Field
//           label="Description"
//           required
//           className="sm:col-span-2"
//         >
//           <Textarea
//             rows={2}
//             value={description}
//             onChange={(e) => setDescription(e.target.value)}
//             placeholder="Reason for the leave"
//           />
//         </Field>

//         <Field
//           label="Supporting documents"
//           hint={
//             needsDoc
//               ? "Medical certificate required for sick leave beyond 2 days"
//               : "PDF/JPG/JPEG/PNG · Maximum 5 MB each · Maximum 10 files"
//           }
//           className="sm:col-span-3"
//         >
//           <div className="flex flex-wrap items-center gap-2">
//             <label
//               className={cn(
//                 "hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs",
//                 needsDoc
//                   ? "border-destructive/50 text-destructive"
//                   : "border-border",
//                 documents.length >= 10 &&
//                   "pointer-events-none opacity-50",
//               )}
//             >
//               <Paperclip className="h-3.5 w-3.5" />
//               Add document

//               <input
//                 type="file"
//                 multiple
//                 accept=".pdf,.jpg,.jpeg,.png"
//                 className="hidden"
//                 disabled={documents.length >= 10}
//                 onChange={handleFileChange}
//               />
//             </label>

//             {documents.map((file, index) => (
//               <Badge
//                 key={`${file.name}-${file.size}-${index}`}
//                 variant="outline"
//                 className="gap-1 font-normal"
//               >
//                 {file.name}

//                 <button
//                   type="button"
//                   onClick={() =>
//                     setDocuments((previous) =>
//                       previous.filter((_, i) => i !== index)
//                     )
//                   }
//                 >
//                   <X className="h-3 w-3" />
//                 </button>
//               </Badge>
//             ))}
//           </div>
//         </Field>
//       </div>

//       <SectionTitle
//         n={fixedEmpId ? 3 : 4}
//         title="Availability & handover"
//       />

//       <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
//         <Field label="Contact during leave">
//           <Input
//             value={contact}
//             onChange={(e) => setContact(e.target.value)}
//             placeholder="Phone / e-mail reachable during leave"
//           />
//         </Field>

//         <Field label="Location during leave">
//           <Input
//             value={location}
//             onChange={(e) => setLocation(e.target.value)}
//             placeholder="City / out of station"
//           />
//         </Field>

//         <Field label="Handover to">
//           <Select
//             value={handoverTo}
//             onValueChange={setHandoverTo}
//             disabled={dropdownLoading}
//           >
//             <SelectTrigger>
//               <SelectValue placeholder="Team member" />
//             </SelectTrigger>

//             <SelectContent>
//               {handoverMembers.map((member) => (
//                 <SelectItem
//                   key={member.id}
//                   value={member.name}
//                 >
//                   {member.name}
//                   {member.department
//                     ? ` · ${member.department}`
//                     : ""}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </Field>

//         <Field label="Handover notes">
//           <Input
//             value={handoverNotes}
//             onChange={(e) => setHandoverNotes(e.target.value)}
//             placeholder="Open tickets, client calls, deliverables"
//           />
//         </Field>
//       </div>

//       {dropdownError && (
//         <p className="text-destructive text-xs">
//           Some dropdown data could not be loaded. Please refresh the form
//           or check the employee API permissions.
//         </p>
//       )}

//       <div className="text-muted-foreground text-[11px]">
//         Approval chain:{" "}
//         {leaveType
//           ? chainStepsFor(leaveType).join(" → ")
//           : "per leave type (Leave Master)"}
//         {emp
//           ? ` · reporting manager ${
//               getEmployeeProfile(emp.id).job.reportingManager
//             }`
//           : ""}
//       </div>

//       <DialogFooter>
//         <Button variant="outline" onClick={onDone}>
//           Cancel
//         </Button>

//         <Button
//           className="bg-gradient-emerald text-white"
//           disabled={!valid || submitting || dropdownLoading}
//           onClick={submit}
//         >
//           {submitting ? "Submitting..." : "Submit leave request"}
//         </Button>
//       </DialogFooter>
//     </div>
//   );
// }

/** Detailed leave application form. */
export function LeaveApplyForm({ empId: fixedEmpId, onDone }) {
  const me = useCurrentUser();

  const [allRows] = useLeaveApplications();
  const [leaveTypes] = useLeaveTypes();

  const allDir = useDirectory();
  const scoped = useScopedEmployees();
  const dir = fixedEmpId ? allDir : scoped;

  const [empId, setEmpId] = useState(fixedEmpId ?? "");

  const user = userById(empId);
  const emp =
    findEmployee(empId) ??
    (user
      ? { id: user.id, name: user.name, orgId: user.orgId }
      : undefined);

  const [leaveType, setLeaveType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dayPart, setDayPart] = useState("Full day");

  const [reasonCategory, setReasonCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [handoverTo, setHandoverTo] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");

  // Actual browser File objects.
  const [documents, setDocuments] = useState([]);

  // Dropdown data.
  const [apiLeaveTypes, setApiLeaveTypes] = useState([]);
  const [reasonCategories, setReasonCategories] = useState([]);
  const [handoverMembers, setHandoverMembers] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(true);
  const [dropdownError, setDropdownError] = useState(false);

  // Real balances from GET /leave/balances/me (self-service only).
  const [liveBalances, setLiveBalances] = useState([]);

  const [backendCheck, setBackendCheck] = useState(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // One balance per leave type created in Super Admin, from the backend.
  // A type with no balance line from the backend shows 0 available.
  // (The old local demo balances — "Casual Leave: 5 left" etc. — are no longer shown.)
  const balances = useMemo(() => {
    const key = (v) =>
      String((v && typeof v === "object" ? v.name ?? v.code : v) ?? "")
        .trim()
        .toLowerCase();
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    return apiLeaveTypes.map((name) => {
      const b = liveBalances.find((x) =>
        [x?.type, x?.leave_type, x?.name, x?.code, x?.leave_type_code, x?.leave_type_name].some(
          (v) => key(v) !== "" && key(v) === name.trim().toLowerCase(),
        ),
      );

      const entitled = b ? num(b.entitled ?? b.total ?? b.credited) : 0;
      const used = b ? num(b.used) : 0;
      const pending = b ? num(b.pending) : 0;
      const available =
        b && b.available != null
          ? num(b.available)
          : Math.max(0, entitled - used - pending);

      return { type: name, entitled, used, pending, available };
    });
  }, [apiLeaveTypes, liveBalances]);

  // Load leave types from Super Admin's GET /leave-types API.
  // Reason categories and team members continue using the existing
  // Leave Request APIs. No change to the leave request submission API.
  useEffect(() => {
    let active = true;

    const loadDropdowns = async () => {
      setDropdownLoading(true);
      setDropdownError(false);

      // const [typesRes, reasonsRes, membersRes] =
      //   await Promise.allSettled([
      //     getEmployeeLeaveTypes({ active: true, page: 1, page_size: 100 }),
      //     loadReasonCategories(),
      //     loadTeamMembers(),
      //   ]);
      const [typesRes, reasonsRes, membersRes, balRes] = await Promise.allSettled([
  loadLeaveTypeOptions(),
  loadReasonCategories(),
  loadTeamMembers(),
  // Existing balances API (same one My Leave uses). Only for the employee's own form.
  fixedEmpId ? leaveApi.getMyBalances() : Promise.resolve(null),
]);

      if (!active) return;

      // Balances are optional: if this call fails, every type simply shows 0 available.
      if (balRes.status === "fulfilled" && balRes.value) {
        const d = balRes.value?.data ?? balRes.value;
        const list = Array.isArray(d)
          ? d
          : d?.items ?? d?.balances ?? d?.data ?? [];
        setLiveBalances(Array.isArray(list) ? list : []);
      }

      if (typesRes.status === "fulfilled") {
        // loadLeaveTypeOptions() returns plain names (["Casual Leave", ...]).
        // Objects are also handled in case the response shape changes.
        // The POST request expects the leave type name.
        const names = [
          ...new Set(
            typesRes.value
              .map((item) => (typeof item === "string" ? item : item?.name))
              .filter(Boolean),
          ),
        ];

        setApiLeaveTypes(names);

        // Clear a previously selected type if it is no longer active.
        setLeaveType((previous) =>
          names.includes(previous) ? previous : ""
        );
      } else {
        console.error(
          "Could not load Super Admin leave types:",
          typesRes.reason,
        );
      }

      if (reasonsRes.status === "fulfilled") {
        setReasonCategories(reasonsRes.value);

        if (reasonsRes.value.length > 0) {
          setReasonCategory((previous) =>
            previous || reasonsRes.value[0].value
          );
        }
      }

      if (membersRes.status === "fulfilled") {
        setHandoverMembers(membersRes.value);
      }

      const failed =
        typesRes.status === "rejected" ||
        reasonsRes.status === "rejected" ||
        membersRes.status === "rejected";

      setDropdownError(failed);
      setDropdownLoading(false);

      if (failed) {
        console.warn("Some leave dropdown APIs could not load:", {
          types: typesRes.status,
          reasons: reasonsRes.status,
          members: membersRes.status,
        });
      }
    };

    loadDropdowns();

    return () => {
      active = false;
    };
  }, []);

  // Existing backend date validation integration.
  useEffect(() => {
    if (!leaveType || !from || !to) {
      setBackendCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);

      try {
        const res = await leaveApi.validateApplication({
          leave_type: leaveType,
          from_date: from,
          to_date: to,
          day_part: dayPart,
          documents,
        });

        if (res?.data) {
          setBackendCheck(res.data);
        }
      } catch (err) {
        setBackendCheck(null);
      } finally {
        setValidating(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [leaveType, from, to, dayPart, documents]);

  // Existing local calculation retained.
  const localCheck = empId
    ? validateLeaveApplication(
        empId,
        {
          leaveType,
          from,
          to,
          attachment: documents[0]?.name,
          dayPart,
        },
        allRows,
        leaveTypes,
      )
    : { ok: false, errors: [], warnings: [], days: 0 };

  const check = backendCheck
    ? {
        ok: backendCheck.ok,
        errors: backendCheck.errors || [],
        warnings: backendCheck.warnings || [],
        days:
          typeof backendCheck.days === "number"
            ? backendCheck.days
            : localCheck.days,
      }
    : localCheck;

  const days = check.days;

  const needsDoc =
    /sick|medical/i.test(leaveType) &&
    days > 2 &&
    documents.length === 0;

  const dateRangeValid =
    Boolean(from && to) && to >= from;

  const valid =
    Boolean(
      empId &&
      leaveType &&
      from &&
      to &&
      reasonCategory &&
      description.trim() &&
      dateRangeValid
    ) &&
    !needsDoc &&
    !submitting;

  // Validate files before adding them.
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files ?? []);

    if (!selected.length) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];

    const maxSize = 5 * 1024 * 1024;
    const maxFiles = 10;

    const validFiles = [];

    for (const file of selected) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(
          `${file.name}: Only PDF, JPG, JPEG and PNG are allowed.`
        );
        continue;
      }

      if (file.size > maxSize) {
        toast.error(`${file.name}: Maximum file size is 5 MB.`);
        continue;
      }

      validFiles.push(file);
    }

    setDocuments((previous) => {
      const combined = [...previous];

      for (const file of validFiles) {
        if (
          !combined.some(
            (existing) =>
              existing.name === file.name &&
              existing.size === file.size
          )
        ) {
          combined.push(file);
        }
      }

      if (combined.length > maxFiles) {
        toast.error("You can attach a maximum of 10 documents.");
        return combined.slice(0, maxFiles);
      }

      return combined;
    });

    e.target.value = "";
  };

  // Existing POST /leave-requests submission.
  // Do not change this API integration.
  const submit = async () => {
    if (!emp) {
      return toast.error("Choose the employee.");
    }

    if (!valid) {
      if (needsDoc) {
        return toast.error(
          "Attach a medical certificate for sick leave beyond 2 days."
        );
      }

      if (!dateRangeValid) {
        return toast.error("Please select valid leave dates.");
      }

      return toast.error("Please complete all required fields.");
    }

    if (documents.length > 10) {
      return toast.error("You can attach a maximum of 10 documents.");
    }

    setSubmitting(true);

    try {
      const result = await submitEmployeeLeaveRequest(
        {
          leaveType,
          from,
          to,
          dayPart,
          reasonCategory,
          description: description.trim(),
          contactDuringLeave: contact,
          locationDuringLeave: location,
          handoverTo,
          handoverNotes,
        },
        documents,
      );

      const code = result?.id || "submitted";

      toast.success(
        `Leave request ${code} submitted successfully.`
      );

      onDone?.();
    } catch (err) {
      console.error(
        "Employee leave request submission failed:",
        err
      );

      const message = err?.response?.data?.detail;

      const errorMessage = Array.isArray(message)
        ? message.map((e) => e.msg).join(", ")
        : typeof message === "string"
          ? message
          : err?.response?.data?.message ||
            err?.message ||
            "Could not submit leave request.";

      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const team = dir.filter(
    (d) => d.orgId === (emp?.orgId ?? "") && d.id !== empId
  );

  return (
    <div className="space-y-4">
      {!fixedEmpId && (
        <>
          <SectionTitle n={1} title="Employee" />

          <Select value={empId} onValueChange={setEmpId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>

            <SelectContent>
              {dir.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} · {d.id} · {d.dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {fixedEmpId && balances.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {balances
            .filter((b) => Number.isFinite(b.available))
            .map((b) => (
              <Badge
                key={b.type}
                variant="outline"
                className={cn(
                  "font-normal",
                  b.available <= 0 &&
                    "border-destructive/40 text-destructive",
                )}
              >
                {b.type}: <b className="ml-1">{b.available}</b>&nbsp;left
              </Badge>
            ))}
        </div>
      )}

      <SectionTitle
        n={fixedEmpId ? 1 : 2}
        title="Leave & dates"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Leave type" required className="sm:col-span-2">
          <Select
            value={leaveType}
            onValueChange={setLeaveType}
            disabled={dropdownLoading || apiLeaveTypes.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  dropdownLoading
                    ? "Loading leave types..."
                    : apiLeaveTypes.length === 0
                      ? "No active leave types found"
                      : "Select leave type"
                }
              />
            </SelectTrigger>

            <SelectContent>
              {apiLeaveTypes.map((name) => {
                const b = balances.find((x) => x.type === name);

                return (
                  <SelectItem key={name} value={name}>
                    {name}
                    {fixedEmpId && b && Number.isFinite(b.available)
                      ? ` · ${b.available} available`
                      : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </Field>

        <Field label="From" required>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);

              if (
                !to ||
                to < e.target.value ||
                dayPart !== "Full day"
              ) {
                setTo(e.target.value);
              }
            }}
          />
        </Field>

        <Field label="To" required>
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>

        <Field label="Day part" className="sm:col-span-2">
          <RadioGroup
            value={dayPart}
            onValueChange={(v) => {
              setDayPart(v);

              if (v !== "Full day" && from) {
                setTo(from);
              }
            }}
            className="flex flex-wrap gap-4 pt-1"
          >
            {["Full day", "First half", "Second half"].map((d) => (
              <div key={d} className="flex items-center gap-2">
                <RadioGroupItem value={d} id={`dp-${d}`} />
                <Label
                  htmlFor={`dp-${d}`}
                  className="text-sm font-normal"
                >
                  {d}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>

        <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm sm:col-span-2">
          <div className="text-muted-foreground text-xs">
            Number of days
          </div>

          <div className="text-2xl font-bold">
            {days || 0}{" "}
            <span className="text-muted-foreground text-xs font-normal">
              working day(s) · weekly offs & holidays excluded
              {dayPart !== "Full day" ? " · half day" : ""}
            </span>
          </div>
        </div>
      </div>

      {validating && (
        <p className="text-muted-foreground text-xs">
          Validating leave dates...
        </p>
      )}

      {(check.errors.length > 0 ||
        check.warnings.length > 0) &&
        (leaveType || from || to) && (
          <div className="space-y-1">
            {check.errors.map((e) => (
              <div
                key={e}
                className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-1.5 text-xs"
              >
                {e}
              </div>
            ))}

            {check.warnings.map((w) => (
              <div
                key={w}
                className="border-gold/40 bg-gold/10 rounded-md border px-3 py-1.5 text-xs"
              >
                {w}
              </div>
            ))}
          </div>
        )}

      <SectionTitle
        n={fixedEmpId ? 2 : 3}
        title="Reason & supporting documents"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Reason category" required>
          <Select
            value={reasonCategory}
            onValueChange={setReasonCategory}
            disabled={dropdownLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  dropdownLoading
                    ? "Loading categories..."
                    : "Select reason category"
                }
              />
            </SelectTrigger>

            <SelectContent>
              {reasonCategories.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Description"
          required
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Reason for the leave"
          />
        </Field>

        <Field
          label="Supporting documents"
          hint={
            needsDoc
              ? "Medical certificate required for sick leave beyond 2 days"
              : "PDF/JPG/JPEG/PNG · Maximum 5 MB each · Maximum 10 files"
          }
          className="sm:col-span-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cn(
                "hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs",
                needsDoc
                  ? "border-destructive/50 text-destructive"
                  : "border-border",
                documents.length >= 10 &&
                  "pointer-events-none opacity-50",
              )}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Add document

              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                disabled={documents.length >= 10}
                onChange={handleFileChange}
              />
            </label>

            {documents.map((file, index) => (
              <Badge
                key={`${file.name}-${file.size}-${index}`}
                variant="outline"
                className="gap-1 font-normal"
              >
                {file.name}

                <button
                  type="button"
                  onClick={() =>
                    setDocuments((previous) =>
                      previous.filter((_, i) => i !== index)
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Field>
      </div>

      <SectionTitle
        n={fixedEmpId ? 3 : 4}
        title="Availability & handover"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Contact during leave">
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone / e-mail reachable during leave"
          />
        </Field>

        <Field label="Location during leave">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City / out of station"
          />
        </Field>

        <Field label="Handover to">
          <Select
            value={handoverTo}
            onValueChange={setHandoverTo}
            disabled={dropdownLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Team member" />
            </SelectTrigger>

            <SelectContent>
              {handoverMembers.map((member) => (
                <SelectItem
                  key={member.id}
                  value={member.name}
                >
                  {member.name}
                  {member.department
                    ? ` · ${member.department}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Handover notes">
          <Input
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            placeholder="Open tickets, client calls, deliverables"
          />
        </Field>
      </div>

      {dropdownError && (
        <p className="text-destructive text-xs">
          Some dropdown data could not be loaded. Please refresh the form
          or check the employee API permissions.
        </p>
      )}

      <div className="text-muted-foreground text-[11px]">
        Approval chain:{" "}
        {leaveType
          ? chainStepsFor(leaveType).join(" → ")
          : "per leave type (Leave Master)"}
        {emp
          ? ` · reporting manager ${
              getEmployeeProfile(emp.id).job.reportingManager
            }`
          : ""}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>

        <Button
          className="bg-gradient-emerald text-white"
          disabled={!valid || submitting || dropdownLoading}
          onClick={submit}
        >
          {submitting ? "Submitting..." : "Submit leave request"}
        </Button>
      </DialogFooter>
    </div>
  );
}


/** Side sheet with an employee's balances, leave ledger and approval trail. */
export function EmployeeLeaveSheet({ empId, onClose }) {
  const [apps] = useLeaveApplications();
  const compOff = useCompOffLedgerOf(empId ?? "");
  // Same balance rule as the employee's comp-off card (expired credits excluded) instead of a raw credit − debit sum.
  const compOffBal = useCompOffBalance(empId ?? "");
  const emp = empId ? findEmployee(empId) : undefined;
  const balances = useMemo(() => (empId ? leaveBalances(empId, apps) : []), [empId, apps]);
  const mine = useMemo(
    () => apps.filter((a) => a.empId === empId).sort((a, b) => (a.from < b.from ? 1 : -1)),
    [apps, empId],
  );
  const [filter, setFilter] = useState("all");
  const rows = mine.filter((a) => filter === "all" || a.status === filter);
  const taken = mine.filter((a) => a.status === "Approved").reduce((s, a) => s + a.days, 0);
  return (
    <Sheet open={!!empId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {emp && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <CalendarDays className="text-primary h-5 w-5" /> {emp.name} — leave record
              </SheetTitle>
              <SheetDescription>
                {emp.id} · {emp.role} · {emp.dept} · {emp.branch}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 p-4 pt-0">
              <div className="grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-4">
                {[
                  ["Days taken (approved)", taken],
                  ["Pending requests", mine.filter((a) => a.status === "Pending").length],
                  ["Rejected", mine.filter((a) => a.status === "Rejected").length],
                  ["Comp-off balance", compOffBal.available],
                ].map(([k, v]) => (
                  <div key={String(k)} className="border-border rounded-lg border p-2">
                    <div className="text-muted-foreground">{k}</div>
                    <div className="text-xl font-bold">{v}</div>
                  </div>
                ))}
              </div>
              <Card className="shadow-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Wallet className="text-primary h-4 w-4" /> Balances (leave year, credited to
                    date)
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {balances.map((b) => {
                      const fin = Number.isFinite(b.entitled) && b.entitled > 0;
                      return (
                        <div key={b.type} className="border-border rounded-lg border p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{b.type}</span>
                            <span className="text-muted-foreground">
                              {fin ? `${b.available} of ${b.entitled} left` : `${b.used} used`}
                            </span>
                          </div>
                          {fin && (
                            <Progress
                              value={Math.min(100, (b.used / b.entitled) * 100)}
                              className="mt-2 h-1.5"
                            />
                          )}
                          <div className="text-muted-foreground mt-1 text-[11px]">
                            {b.used} used · {b.pending} pending
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <History className="text-primary h-4 w-4" /> Leave ledger
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger className="ml-auto h-8 w-full sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        exportReportPdf({
                          title: `Leave record — ${emp.name}`,
                          subtitle: `${emp.id} · ${emp.dept} · ${new Date().toLocaleDateString("en-IN")}`,
                          summary: balances
                            .filter((b) => Number.isFinite(b.entitled) && b.entitled > 0)
                            .map((b) => ({
                              label: b.type,
                              value: `${b.available} / ${b.entitled}`,
                            })),
                          columns: [
                            "Ref",
                            "Type",
                            "From",
                            "To",
                            "Days",
                            "Day part",
                            "Reason",
                            "Status",
                            "Decided by",
                            "Documents",
                          ],
                          rows: mine.map((a) => [
                            a.id,
                            a.leaveType,
                            a.from,
                            a.to,
                            a.days,
                            a.dayPart ?? "Full day",
                            a.description,
                            a.status,
                            a.decidedBy ?? "—",
                            (a.documents ?? (a.attachment ? [a.attachment] : [])).join(", ") || "—",
                          ]),
                        })
                      }
                    >
                      <FileDown className="h-4 w-4" /> PDF
                    </Button>
                  </div>
                  {rows.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      No leave applications raised in Seereon HRMS yet.
                      {balances.some((b) => b.used > 0)
                        ? ` Migrated usage before go-live: ${balances
                            .filter((b) => b.used > 0)
                            .map((b) => `${b.type} ${b.used}`)
                            .join(", ")}.`
                        : ""}
                    </p>
                  )}
                  <ol className="border-border relative space-y-4 border-l pl-5">
                    {rows.map((a) => (
                      <li key={a.id} className="relative">
                        <span
                          className={cn(
                            "bg-background absolute top-1 -left-[26px] grid h-3 w-3 place-items-center rounded-full border-2",
                            a.status === "Approved"
                              ? "border-primary"
                              : a.status === "Rejected"
                                ? "border-destructive"
                                : "border-gold",
                          )}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{a.leaveType}</span>
                          <Badge variant="outline" className={statusTone(a.status)}>
                            {a.status}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{a.id}</span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {a.from} → {a.to} · {a.days} day{a.days === 1 ? "" : "s"}
                          {a.dayPart && a.dayPart !== "Full day" ? ` (${a.dayPart})` : ""}
                          {a.appliedOn ? ` · applied ${a.appliedOn}` : ""}
                          {a.appliedBy ? ` by ${a.appliedBy}` : ""}
                        </div>
                        <div className="mt-0.5 text-xs">
                          {a.reasonCategory ? `${a.reasonCategory} — ` : ""}
                          {a.description}
                        </div>
                        {(a.documents?.length || a.attachment) && (
                          <div className="mt-1">
                            <AttachmentChips
                              names={a.documents ?? [a.attachment]}
                              context={`${a.leaveType} · ${a.id}`}
                              size="xs"
                            />
                          </div>
                        )}
                        {a.handoverTo && (
                          <div className="text-muted-foreground text-[11px]">
                            Handover to {a.handoverTo}
                            {a.handoverNotes ? ` — ${a.handoverNotes}` : ""}
                          </div>
                        )}
                        {a.approvalChain && (
                          <div className="text-muted-foreground text-[11px]">
                            Chain {a.approvalChain}
                            {a.status === "Pending" ? ` · at step ${(a.chainStep ?? 0) + 1}` : ""}
                          </div>
                        )}
                        {a.chainLog?.map((l, i) => (
                          <div key={i} className="text-muted-foreground text-[11px]">
                            ✓ {l.step} · {l.by} · {l.on}
                            {l.note ? ` — ${l.note}` : ""}
                          </div>
                        ))}
                        {a.decidedBy && !a.chainLog?.length && (
                          <div className="text-muted-foreground text-[11px]">
                            {a.status} by {a.decidedBy}
                            {a.decidedOn ? ` on ${a.decidedOn}` : ""}
                            {a.decisionReason ? ` — ${a.decisionReason}` : ""}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
              {compOff.length > 0 && (
                <Card className="shadow-card">
                  <CardContent className="p-4">
                    <div className="mb-2 text-sm font-semibold">Comp-off ledger</div>
                    <div className="space-y-1 text-xs">
                      {compOff.map((c) => (
                        <div key={c.id} className="flex flex-wrap gap-2">
                          <span className="w-24 shrink-0 tabular-nums">{c.createdOn}</span>
                          <span className="flex-1">{c.reason}</span>
                          <Badge variant="outline">
                            {c.type} {c.days} d{c.expiresOn ? ` · expires ${c.expiresOn}` : ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}