import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { makeCompanyAdmin, removeCompanyAdmin } from "@/api/companyAdminApi";
import { companyAdminErrorMessage } from "@/features/employees/data/companyAdmin";

/**
 * Confirm card for "Make Company Admin" / "Remove Company Admin".
 * `action` is `{ employee, mode: "make" | "remove", companyId }` or null (closed). `onDone` runs after a success so the
 * list can refresh. A 401 (the promoted person is the one signed in) is handled by the API client: it goes to login.
 */
export function CompanyAdminDialog({ action, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const employee = action?.employee;
  const make = action?.mode !== "remove";
  const name = employee?.name || employee?.work_email || "this employee";

  const confirm = async () => {
    if (!action || busy) return;
    setBusy(true);
    try {
      const run = make ? makeCompanyAdmin : removeCompanyAdmin;
      const res = await run(action.companyId, employee.id);
      toast.success(res?.message || (make ? "Company Admin set." : "Company Admin access removed."));
      onClose();
      onDone?.(res?.data);
    } catch (error) {
      toast.error(companyAdminErrorMessage(error));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={Boolean(action)} onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {make ? `Make ${name} a Company Admin?` : `Remove Company Admin access from ${name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {make
              ? "They will sign in with the same email and password and will see the full company admin dashboard. They will be signed out of all devices now."
              : "They become an ordinary employee again and will see the employee portal. They will be signed out of all devices now."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant={make ? "default" : "destructive"}
            onClick={confirm}
            disabled={busy}
            data-testid="company-admin-confirm"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {make ? "Make Company Admin" : "Remove Company Admin"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
