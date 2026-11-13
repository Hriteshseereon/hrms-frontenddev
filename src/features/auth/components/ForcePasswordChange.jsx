// Blocking "Set new password" screen for a first login with a temporary password (must_change_password).
// The shells render it instead of the portal, so no dashboard data is fetched until the password is changed:
// the backend answers 403 "Password change required" to everything but /me, the policy, change-password and logout.
import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeMyPassword,
  getMe,
  getPasswordPolicy,
  parseApiError,
  replaceTokens,
  signOutAndRedirect,
} from "@/api/meApi";
import { useSessionStore } from "@/features/auth/data/session-store";

function policyError(p, pw) {
  if (!p || !pw) return "";
  if (pw.length < p.min_length) return `Use at least ${p.min_length} characters.`;
  if (p.require_upper && !/[A-Z]/.test(pw)) return "Add an uppercase letter.";
  if (p.require_lowercase && !/[a-z]/.test(pw)) return "Add a lowercase letter.";
  if (p.require_number && !/[0-9]/.test(pw)) return "Add a number.";
  if (p.require_symbol && !/[^A-Za-z0-9]/.test(pw)) return "Add a symbol.";
  return "";
}

function Field({ id, label, value, onChange, error, autoFocus, autoComplete, disabled }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export function ForcePasswordChange() {
  const router = useRouter();
  const [policy, setPolicy] = useState(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // On every load (login or reload) ask the backend whether the lock still applies, and read the password policy.
  useEffect(() => {
    getMe()
      .then((me) => useSessionStore.getState().applyMe(me))
      .catch(() => {});
    getPasswordPolicy()
      .then(setPolicy)
      .catch(() => {});
  }, []);

  const liveNew = policyError(policy, next);
  const liveConfirm = confirm && next !== confirm ? "New password and confirmation do not match." : "";

  const submit = async (e) => {
    e.preventDefault();
    const local = {
      ...(!cur ? { current_password: "Enter the temporary password you signed in with." } : {}),
      ...(!next ? { new_password: "Enter a new password." } : liveNew ? { new_password: liveNew } : {}),
      ...(!confirm ? { confirm_password: "Confirm the new password." } : liveConfirm ? { confirm_password: liveConfirm } : {}),
    };
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await changeMyPassword({
        current_password: cur,
        new_password: next,
        confirm_password: confirm,
      });
      replaceTokens(res ?? {}); // new tokens, must_change_password = false
      // Refresh modules, roles, permissions and the portal for the new token, then open the dashboard.
      let me = null;
      try {
        me = await getMe();
        useSessionStore.getState().applyMe(me);
      } catch {
        /* the session keeps what login returned */
      }
      toast.success(res?.message || "Password updated.");
      const portal = me?.redirect_portal || useSessionStore.getState().redirectPortal;
      router.replace(portal === "emp" ? "/emp/dashboard" : "/org/dashboard");
    } catch (err) {
      const { status, fields, general } = parseApiError(err);
      if (Object.keys(fields).length) setErrors(fields);
      else if (status === 400 || status === 429) setErrors({ current_password: general });
      else toast.error(general);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-pw-title"
      className="bg-background/95 fixed inset-0 z-[200] grid place-items-center overflow-y-auto p-4 backdrop-blur-sm"
    >
      <Card className="shadow-premium w-full max-w-md">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-xl">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 id="force-pw-title" className="text-lg font-bold">
                Set new password
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                You signed in with a temporary password. Choose a new one to continue.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field
              id="fpc-current"
              label="Current (temporary) password"
              value={cur}
              onChange={setCur}
              error={errors.current_password}
              autoFocus
              autoComplete="current-password"
              disabled={busy}
            />
            <Field
              id="fpc-new"
              label="New password"
              value={next}
              onChange={setNext}
              error={errors.new_password || liveNew}
              autoComplete="new-password"
              disabled={busy}
            />
            <Field
              id="fpc-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              error={errors.confirm_password || liveConfirm}
              autoComplete="new-password"
              disabled={busy}
            />
            <Button type="submit" disabled={busy} className="bg-gradient-emerald shadow-premium w-full text-white">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Saving…" : "Set password and continue"}
            </Button>
          </form>

          <button
            type="button"
            onClick={signOutAndRedirect}
            className="text-muted-foreground hover:text-foreground mx-auto block text-xs underline"
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
