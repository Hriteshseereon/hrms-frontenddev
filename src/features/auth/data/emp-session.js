import { useMemo, useSyncExternalStore } from "react";
import {
  CURRENT_EMPLOYEE_ID,
  findEmployee,
  directoryEmployees,
} from "@/features/employees/data/employee-directory";
import { useCurrentUser, getCurrentUser } from "@/features/auth/data/auth-session";
import {
  resolveAvatar,
  setUserPrefs,
  useUserPrefs,
} from "@/features/administration/data/appearance";

const KEY = "seereon.emp.session";

let empId = CURRENT_EMPLOYEE_ID;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  const stored = window.localStorage.getItem(KEY);
  if (stored) empId = stored;
}

export function signInEmployee(email) {
  const match = directoryEmployees().find(
    (e) => e.email.toLowerCase() === email.trim().toLowerCase(),
  );
  empId = match?.id ?? CURRENT_EMPLOYEE_ID;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, empId);
  emit();
  return empId;
}

/** Profile photo lives in the signed-in user's personalisation prefs (per user, persisted). */
export function setEmployeeAvatar(dataUrl) {
  setUserPrefs(getCurrentUser().id, { avatar: dataUrl, avatarStyle: "photo" });
  emit();
}

const snapshot = () => empId;
const subscribe = (cb) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

/**
 * The employee-portal identity follows the signed-in Seereon user so the
 * portal always shows the right person for the role that logged in.
 */
/** Minimal directory record for a signed-in user who has no seeded employee row (tenant admins, invited users). */
const fromUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  dept: u.dept,
  role: u.designation,
  branch: u.branch,
  status: "Active",
  orgId: u.orgId,
});

export function useCurrentEmployee() {
  const user = useCurrentUser();
  // Re-render when the employee session changes; the identity itself always follows the signed-in user so the
  // portal can never show another person's record (the previous fallback was the last stored employee / EMPLOYEES[0]).
  useSyncExternalStore(subscribe, snapshot, () => CURRENT_EMPLOYEE_ID);
  const own = findEmployee(user.id);
  return useMemo(() => own ?? fromUser(user), [own, user]);
}

export function useEmployeeAvatar() {
  const user = useCurrentUser();
  const prefs = useUserPrefs(user.id);
  return resolveAvatar(user.name, prefs);
}
