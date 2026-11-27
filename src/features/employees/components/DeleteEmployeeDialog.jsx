import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteEmployee } from "@/api/employeeApi";
import { companyAdminErrorMessage } from "@/features/employees/data/companyAdmin";

/**
 * Confirm card for deleting one employee. `employee` is the list row, or null (closed).
 * `onDone(employee)` runs after a successful delete so the list can refresh.
 */
export function DeleteEmployeeDialog({ employee, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const name = employee?.name || employee?.work_email || "this employee";

  const confirm = async () => {
    if (!employee || busy) return;
    setBusy(true);
    try {
      const res = await deleteEmployee(employee.id);
      toast.success(res?.message || `${name} deleted`);
      onClose();
      onDone?.(employee);
    } catch (error) {
      toast.error(companyAdminErrorMessage(error, "Could not delete the employee."));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={Boolean(employee)} onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the employee
            {employee?.employee_code ? ` (Emp ID: ${employee.employee_code})` : ""}, their sign-in account and
            everything recorded against them: attendance, leave, payroll, documents and cases. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={busy} data-testid="delete-employee-confirm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
