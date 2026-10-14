import Link from "@/lib/router";
import { useRouter } from "@/lib/router";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  completePasswordReset,
  passwordPolicyError,
  pendingPasswordReset,
  requestPasswordReset,
  userById,
} from "@/features/auth/data/auth-session";
import { workspaceLoginPath } from "@/features/organization/data/tenancy";

/** 0–4 bars: length, uppercase, number, symbol. */
const strength = (pw) =>
  [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean)
    .length;

function ResetPassword() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  // The pending request lives in the browser — read after hydration so the server and client render the same markup.
  const [request, setRequest] = useState(undefined);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setRequest(pendingPasswordReset());
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Back to the organisation's own login URL.
  const back = request ? workspaceLoginPath(userById(request.userId)) : "/login";
  const remaining = request ? Math.max(0, Math.floor((request.expiresAt - now) / 1000)) : 0;
  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const bars = strength(pw);
  const policy = pw ? passwordPolicyError(pw) : null;

  function submit(e) {
    e.preventDefault();
    if (pw !== confirm) {
      toast.error("New password and confirmation do not match");
      return;
    }
    const r = completePasswordReset(otp, pw);
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) router.push(back);
  }
  function resend() {
    if (!request) return;
    const r = requestPasswordReset(request.userId);
    if (!r.ok || !r.request) {
      toast.error(r.message);
      return;
    }
    setRequest(r.request);
    setOtp("");
    toast.success(`${r.message} · demo code ${r.request.otp}`, { duration: 15000 });
  }

  return (
    <div className="bg-background grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>
        <form
          onSubmit={submit}
          className="border-border bg-card shadow-premium rounded-2xl border p-5 sm:p-8"
        >
          <div className="bg-gold/15 text-gold mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-center text-2xl font-bold">Reset password</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            {request
              ? `Enter the 6-digit code sent to ${request.email} and choose a new password.`
              : request === null
                ? "No reset request is pending for this browser."
                : "Enter the 6-digit code sent to your email and choose a new password."}
          </p>
          {request === null ? (
            <div className="mt-6 space-y-3">
              <Button asChild className="bg-gradient-emerald h-11 min-h-11 w-full text-white">
                <Link href="/forgot-password">Request a verification code</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href={back}>Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-10 w-10 text-lg sm:h-12 sm:w-12"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>{remaining > 0 ? `Expires in ${mmss}` : "Code expired"}</span>
                  <button type="button" className="text-primary font-medium" onClick={resend}>
                    Resend
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-new">New Password</Label>
                <Input
                  id="rp-new"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-confirm">Confirm Password</Label>
                <Input
                  id="rp-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i <= bars ? (bars === 4 ? "bg-primary" : "bg-gold") : "bg-muted"}`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {!pw
                  ? "At least 8 characters with an uppercase letter, a number and a symbol."
                  : (policy ?? "Strong password. Includes uppercase, number and symbol.")}
              </p>
              <Button
                type="submit"
                disabled={otp.length !== 6 || !pw || !confirm}
                className="bg-gradient-emerald h-11 min-h-11 w-full text-white"
              >
                Reset Password
              </Button>
              <Button asChild type="button" variant="ghost" className="w-full">
                <Link href={back}>Back to sign in</Link>
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
