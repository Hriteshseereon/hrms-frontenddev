// Ends an open browser session the moment the account may no longer be used: suspended, sessions revoked by an
// administrator, or the person has left (exit completed). Sign-in already refused these accounts, but a session that
// was open before the change kept working until the user signed out themselves.
import { useEffect } from "react";
import { toast } from "sonner";
import { signOut, useCurrentUser, useIsSignedIn } from "@/features/auth/data/auth-session";
import { sessionEnded, useLogins } from "@/features/auth/data/rbac-store";
import { findEmployee, useDirectory } from "@/features/employees/data/employee-directory";
import { useTerminations } from "@/features/employees/data/people-cases";

export function useSessionCutoff(hydrated) {
  const me = useCurrentUser();
  const signedIn = useIsSignedIn();
  useLogins();
  useDirectory();
  const terminations = useTerminations();
  const today = new Date().toISOString().slice(0, 10);
  const exited =
    findEmployee(me.id)?.status === "Exited" ||
    terminations.some(
      (c) => c.empId === me.id && c.status === "Effective" && c.lastWorkingDay < today,
    );
  const ended = signedIn && hydrated && (exited || sessionEnded(me.id));
  useEffect(() => {
    if (!ended) return;
    toast.error(
      exited
        ? "Your employment has ended — this account can no longer be used."
        : "Your session was ended by an administrator — sign in again.",
    );
    signOut();
  }, [ended, exited]);
}
