import { Plane } from "lucide-react";
import { TourWorkspace } from "@/features/travel/components/TourWorkspace";
import { TourRoiReport } from "@/features/travel/components/TourOutcomes";
import { useCurrentUser } from "@/features/auth/data/auth-session";

function OrgTours() {
  const me = useCurrentUser();
  const roleName = String(me.role ?? "").toLowerCase();
  const audience = /cfo|finance|accountant|payroll admin/.test(roleName)
    ? "finance"
    : /hr|human resource|chro/.test(roleName)
      ? "hr"
      : "admin";
  const pageCopy = {
    admin: ["Travel administration", "Create a company-paid or advance assignment for Priyanka Das. Finance (Abinash Nayak) approves first; HR (Debasmita Das) then sends it. Employee requests follow HR → Finance."],
    hr: ["HR travel desk", "Debasmita reviews Priyanka’s request and receipts. Employee requests go to Finance after your review; Finance-approved assignments return here for you to send to the employee."],
    finance: ["Finance & settlement", "Abinash approves HR-created assignments before HR sends them. For employee requests, HR verifies first; then approve reimbursement, adjust advances and record payment or refund."],
  }[audience];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Plane className="text-primary h-6 w-6" /> {pageCopy[0]}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {pageCopy[1]}
        </p>
      </div>
      <TourWorkspace audience={audience} />
      <div>
        <h2 className="mb-2 text-lg font-semibold">Tour outcomes &amp; ROI</h2>
        <TourRoiReport />
      </div>
    </div>
  );
}

export default OrgTours;
