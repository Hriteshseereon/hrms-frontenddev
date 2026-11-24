import { Plane } from "lucide-react";
import { TourWorkspace } from "@/features/travel/components/TourWorkspace";
import { TourRoiReport } from "@/features/travel/components/TourOutcomes";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useSessionStore } from "@/features/auth/data/session-store";

function OrgTours() {
  const me = useCurrentUser();
  const sessionRoles = useSessionStore((state) => state.userId === me.id ? state.roles : []);
  const roleName = [me.role, ...(me.roles ?? []), ...(sessionRoles ?? [])]
    .map((role) => String(typeof role === "string" ? role : role?.name ?? "").toLowerCase())
    .join(" ");
  const audience = /cfo|finance|accountant|payroll admin/.test(roleName)
    ? "finance"
    : /hr|human resource|chro/.test(roleName)
      ? "hr"
      : "admin";
  const pageCopy = {
    admin: ["Travel administration", "Create company-paid or advance assignments. Finance approves first, then HR sends the assignment to the employee. Employee requests follow HR review, then Finance approval."],
    hr: ["HR travel desk", "Review employee requests and receipts, then send eligible requests to Finance. Finance-approved assignments return here for dispatch to the employee."],
    finance: ["Finance & settlement", "Approve requests forwarded by HR, adjust advances, record bank or payroll payments, and notify HR when settlement is complete."],
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
