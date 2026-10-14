import Link from "@/lib/router";
import { useRouter } from "@/lib/router";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { requestPasswordReset, userByLogin } from "@/features/auth/data/auth-session";
import { groupsStore, orgsStore } from "@/features/organization/data/group-data";

function ForgotPassword() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [empCode, setEmpCode] = useState("");
  const back = "/login";

  function submit(e) {
    e.preventDefault();
    const identifier = email.trim() || empCode.trim();
    const user = identifier ? userByLogin(identifier) : null;
    if (!user) {
      toast.error("No account matches that e-mail / employee code");
      return;
    }
    if (empCode.trim() && user.id.toLowerCase() !== empCode.trim().toLowerCase()) {
      toast.error("Employee code does not match this e-mail");
      return;
    }
    // Company / group code must belong to the account (same rule as the sign-in page); blank is accepted.
    const typed = company.trim().toUpperCase();
    if (typed) {
      const org = orgsStore.get().find((o) => o.id === user.orgId);
      const group = groupsStore.get().find((g) => g.id === (user.groupId ?? org?.groupId));
      if (
        ![org?.id, org?.code, group?.id, group?.code]
          .filter(Boolean)
          .some((x) => String(x).toUpperCase() === typed)
      ) {
        toast.error("Company code does not match this account");
        return;
      }
    }
    const r = requestPasswordReset(user.id);
    if (!r.ok || !r.request) {
      toast.error(r.message);
      return;
    }
    // UI-only build: there is no mail server, so the code is shown here instead of being e-mailed.
    toast.success(`${r.message} · demo code ${r.request.otp}`, { duration: 15000 });
    router.push("/reset-password");
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
          <div className="bg-primary/10 text-primary mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-center text-2xl font-bold">Forgot your password?</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            We'll email you a 6-digit verification code to reset it.
          </p>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fp-company">Company Code</Label>
              <Input
                id="fp-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="SRN-001 · ORG-1042 (optional)"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email</Label>
              <Input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@seereon.co.in"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-code">Employee Code</Label>
              <Input
                id="fp-code"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                placeholder="SRN-0006 (optional if e-mail given)"
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={!email.trim() && !empCode.trim()}
              className="bg-gradient-emerald h-11 min-h-11 w-full text-white"
            >
              Send verification code
            </Button>
            <Button asChild type="button" variant="ghost" className="w-full">
              <Link href={back}>
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
