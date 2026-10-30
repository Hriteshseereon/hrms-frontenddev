import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Network,
  UserCheck,
  Users,
  AlertTriangle,
  Check,
  Save,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rbacApi, extractErrorMessage } from "@/api/rbacApi";
import { useCurrentUser, can } from "@/features/auth/data/auth-session";
import { useScopedEmployees } from "@/features/employees/components/CasePieces";
import { setManager } from "@/features/organization/data/manager-data";

export function ReportingHierarchyCard({ employee }) {
  const me = useCurrentUser();
  const allEmployees = useScopedEmployees();
  const canEdit =
    can(me.role, "role.manage") ||
    ["SuperAdmin", "Admin", "HR", "CHRO", "CEO"].includes(me.role);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportingData, setReportingData] = useState(null);
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [functionalManagerId, setFunctionalManagerId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const empId = employee?.id;

  const loadReportingLines = useCallback(async () => {
    if (!empId) return;
    try {
      setLoading(true);
      setErrorMessage("");
      const res = await rbacApi.getReportingLines(empId);
      if (res) {
        setReportingData(res);
        setReportingManagerId(res.reporting_manager_id || "");
        setFunctionalManagerId(res.functional_manager_id || "");
      }
    } catch {
      // Fallback: use existing employee fields
      setReportingManagerId(employee.manager_id || employee.managerId || "");
    } finally {
      setLoading(false);
    }
  }, [empId]);

  useEffect(() => {
    loadReportingLines();
  }, [loadReportingLines]);

  // Candidates for manager (exclude self)
  const managerCandidates = useMemo(() => {
    return allEmployees.filter((e) => e.id !== empId);
  }, [allEmployees, empId]);

  const handleSave = async () => {
    setErrorMessage("");

    // 1. Client-side self-reporting check
    if (reportingManagerId && reportingManagerId === empId) {
      setErrorMessage("An employee cannot report to themselves.");
      return;
    }
    if (functionalManagerId && functionalManagerId === empId) {
      setErrorMessage("An employee cannot be their own functional manager.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        direct_manager_id: reportingManagerId || null,
        reporting_manager_id: reportingManagerId || null,
        functional_manager_id: functionalManagerId || null,
      };

      const res = await rbacApi.updateReportingLines(empId, payload);
      setReportingData(res);
      // Synchronize with local managerStore for instant UI graph updates
      if (reportingManagerId) {
        setManager(empId, reportingManagerId);
      }
      toast.success("Reporting hierarchy updated successfully.");
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const reportingManagerObj = managerCandidates.find(
    (e) => e.id === reportingManagerId,
  );
  const functionalManagerObj = managerCandidates.find(
    (e) => e.id === functionalManagerId,
  );

  return (
    <Card className="shadow-card border-border">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Network className="text-primary h-5 w-5" /> Reporting Hierarchy Engine
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">
              Configure direct reporting lines and functional leadership for approval routing and reviews.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {employee.designation || employee.role || "Employee"}
          </Badge>
        </div>

        {/* Error Callout Banner (Circular Loop or Self-Reporting Warning) */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-semibold text-sm">Hierarchy Rule Conflict</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Direct Reporting Manager */}
            <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <UserCheck className="text-primary h-4 w-4" /> Direct Reporting Manager
                </Label>
                <span className="text-[10px] text-muted-foreground">Primary Approver</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                First level of approval for leave, attendance regularization, and appraisals.
              </p>

              {canEdit ? (
                <Select
                  value={reportingManagerId || "none"}
                  onValueChange={(val) => {
                    setErrorMessage("");
                    setReportingManagerId(val === "none" ? "" : val);
                  }}
                >
                  <SelectTrigger className="text-xs bg-background">
                    <SelectValue placeholder="Select direct reporting manager" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">-- No Direct Manager --</SelectItem>
                    {managerCandidates.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name} ({m.role || m.designation || m.dept || "Manager"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-medium text-xs p-2 rounded border bg-background">
                  {reportingManagerObj
                    ? `${reportingManagerObj.name} (${reportingManagerObj.role || reportingManagerObj.dept})`
                    : "No manager assigned"}
                </div>
              )}
            </div>

            {/* Functional / Secondary Manager */}
            <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <Users className="text-sky-500 h-4 w-4" /> Functional / Secondary Manager
                </Label>
                <span className="text-[10px] text-muted-foreground">Matrix Lead</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Secondary supervisor for matrix reporting, project feedback, or department oversight.
              </p>

              {canEdit ? (
                <Select
                  value={functionalManagerId || "none"}
                  onValueChange={(val) => {
                    setErrorMessage("");
                    setFunctionalManagerId(val === "none" ? "" : val);
                  }}
                >
                  <SelectTrigger className="text-xs bg-background">
                    <SelectValue placeholder="Select functional manager" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">-- No Functional Manager --</SelectItem>
                    {managerCandidates.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name} ({m.role || m.designation || m.dept || "Lead"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-medium text-xs p-2 rounded border bg-background">
                  {functionalManagerObj
                    ? `${functionalManagerObj.name} (${functionalManagerObj.role || functionalManagerObj.dept})`
                    : "No functional manager assigned"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Controls */}
        {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-white text-xs"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save Hierarchy Line
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReportingHierarchyCard;
