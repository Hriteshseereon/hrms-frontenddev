import { useRouter } from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Brain,
  Users2,
  Wallet,
  ShieldCheck,
  Eye,
  EyeOff,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrganisation } from "@/features/organization/data/tenancy";
import SuperAdmin_auth from "@/api/SuperAdmin_auth";

const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "Seereon HRMS processes employee data solely to run your organisation's HR, payroll, attendance, performance and compliance operations.",
      "Personal data (identity, contact, KYC, bank, salary and statutory identifiers) is visible only to the roles your administrators authorise, and every sensitive screen is permission-gated.",
      "Data is retained for the period required by Indian employment, tax and statutory law (PF, ESI, PT, TDS registers) and is removed or anonymised after the retention period.",
      "Seereon Consulting & IT Services Pvt. Ltd. does not sell or share your data with third parties. Questions: support@seereon.co.in.",
    ],
  },
  terms: {
    title: "Terms of Use",
    body: [
      "Access is restricted to accounts issued by your organisation's administrators. Credentials are personal and must not be shared.",
      "All actions are recorded against the signed-in account; administrators can review sign-ins, approvals and changes in the audit trail.",
      "The organisation remains the owner of its data. Seereon Consulting & IT Services Pvt. Ltd. provides the software and support under the service agreement signed with your organisation.",
      "Misuse — attempting to access another person's data, circumventing permissions, or bulk-extracting records without authorisation — may lead to account suspension and disciplinary action.",
    ],
  },
};

/** Single sign-in for every role: the backend decides the role and the portal (redirect_portal). */
function Login() {
  const router = useRouter();
  const ws = useOrganisation();

  const [show, setShow] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [legal, setLegal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Epoch ms until which the form stays disabled (423 locked / 429 too many attempts).
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!blockedUntil) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= blockedUntil) {
        setBlockedUntil(0);
        setError("");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  if (!ws) return null;

  const secondsLeft = blockedUntil ? Math.max(0, Math.ceil((blockedUntil - now) / 1000)) : 0;
  const blocked = secondsLeft > 0;

  async function submit(e) {
    e.preventDefault();
    const identifier = login.trim();
    if (!identifier || !password) {
      setError("Enter your email or employee ID and your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await SuperAdmin_auth.login(identifier, password);
      const user = data?.user;
      if (import.meta.env.DEV)
        console.info("[login] response", {
          role: user?.role,
          portal: data?.redirect_portal,
          company: data?.company?.name,
          permitted_modules: data?.permitted_modules,
          permissions: data?.permissions?.length,
          must_change_password: data?.must_change_password,
        });
      toast.success(`Welcome, ${user?.full_name || user?.name || "back"}`);

      // A temporary password (must_change_password) is handled by the portal itself: it shows a blocking
      // "Set new password" screen and loads no data until the password is changed.
      if (data?.must_change_password ?? user?.must_change_password) {
        toast.info("Please set a new password before you continue");
      }
      const portal =
        data?.redirect_portal || (String(user?.role).toUpperCase() === "EMPLOYEE" ? "emp" : "org");
      router.push(buildHref({ to: portal === "emp" ? "/emp/dashboard" : "/org/dashboard" }));
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data ?? {};
      const detail = body.detail;
      let message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg).filter(Boolean).join(", ")
            : "";
      if (status === 423) {
        const until = body.locked_until ? Date.parse(body.locked_until) : NaN;
        const retry = Number(body.retry_after) || 0;
        const end = !Number.isNaN(until) ? until : Date.now() + retry * 1000;
        if (end > Date.now()) {
          setNow(Date.now());
          setBlockedUntil(end);
        }
        message = `${message || "Account locked"} — locked until ${new Date(end).toLocaleTimeString()}`;
      } else if (status === 429) {
        const retry = Number(body.retry_after || err.response?.headers?.["retry-after"]) || 30;
        setNow(Date.now());
        setBlockedUntil(Date.now() + retry * 1000);
        message = message || "Too many attempts";
      } else if (!status) {
        message = "Cannot reach the server. Check your connection and try again.";
      } else if (!message) {
        message = "Sign in failed. Please try again.";
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-background grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <div className="bg-gradient-emerald relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(200,169,81,0.6), transparent 50%), radial-gradient(circle at 80% 70%, rgba(200,169,81,0.35), transparent 55%)",
          }}
        />
        <div className="bg-gold/20 absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl" />

        <div className="relative">
          <BrandLogo variant="dark" />
        </div>

        <div className="relative max-w-md space-y-6">
          {/* <div className="border-gold/40 text-gold inline-flex items-center gap-2 rounded-full border bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wider uppercase">
            <Sparkles className="h-3 w-3" /> Seereon HRMS · multi-company HRMS
          </div> */}
          <div className="border-gold/40 text-gold inline-flex items-center gap-2 rounded-full border bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wider uppercase">
  <Sparkles className="h-3 w-3" /> WCS HRMS · multi-company HRMS
</div>

          <h1 className="text-4xl leading-[1.1] font-bold tracking-tight">
            Smart Workforce.
            <br />
            <span className="text-gold">
              Intelligent Growth.
            </span>
          </h1>

          <p className="text-[15px] leading-relaxed text-white/70">
            One HR platform for your whole group — group Super Admin,
            company Admins and every employee, with data scoped to the
            company each person belongs to.
          </p>

          <div className="grid gap-3 pt-4">
            {[
              {
                i: Crown,
                t: "Group › Entity › Branch",
                d: "Super Admin sees everything; Admins and employees see only their company",
              },
              {
                i: Brain,
                t: "Role-based access",
                d: "CEO, CFO, HR, HOD, Manager and Employee views",
              },
              {
                i: Users2,
                t: "Full employee lifecycle",
                d: "Hiring to exit, retention, F&F and rejoin",
              },
              {
                i: Wallet,
                t: "Payroll, statutory & tax",
                d: "Payslips, PF/ESI/TDS filings, Odisha registers",
              },
            ].map((f) => (
              <div
                key={f.t}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
              >
                <div className="bg-gold/20 text-gold border-gold/30 grid h-9 w-9 place-items-center rounded-lg border">
                  <f.i className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{f.t}</div>
                  <div className="text-xs text-white/60">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex justify-between text-xs text-white/50">
          {/* <span>
            © 2026 Seereon Consulting &amp; IT Services · Seereon HRMS
          </span> */}
          <span>
  © 2026 Seereon Consulting &amp; IT Services · WCS HRMS
</span>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setLegal("privacy")}
              className="hover:text-gold"
            >
              Privacy
            </button>

            <button
              type="button"
              onClick={() => setLegal("terms")}
              className="hover:text-gold"
            >
              Terms
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="lg:hidden">
              <BrandLogo />
            </div>

            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>

          <div className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold">
            <ShieldCheck className="h-3 w-3" /> Secure Enterprise Access
          </div>

          <h1
            className="mt-3 text-3xl font-bold tracking-tight"
            data-testid="workspace-name"
          >
            {ws.name}
          </h1>

          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to your organisation&apos;s Seereon HRMS workspace.
            Everything after sign-in is scoped to your{" "}
            {ws.kind === "group"
              ? "group, company, branch"
              : "company, branch"}{" "}
            and role.
          </p>

          <form
            onSubmit={submit}
            className="border-border bg-card shadow-premium mt-6 space-y-4 rounded-2xl border p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="u">
                Email or employee ID
              </Label>

              <Input
                id="u"
                type="text"
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="name@company.com or employee ID"
                disabled={busy || blocked}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>

              <div className="relative">
                <Input
                  id="p"
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy || blocked}
                  className="h-11 pr-10"
                />

                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
                {blocked ? ` (${secondsLeft}s)` : ""}
              </p>
            )}

            <Button
              type="submit"
              disabled={busy || blocked}
              size="lg"
              className="bg-gradient-emerald shadow-premium h-11 w-full text-white hover:opacity-95"
            >
              {busy ? "Signing in…" : blocked ? `Try again in ${secondsLeft}s` : "Sign in"}
            </Button>

            <div className="text-muted-foreground flex items-center justify-center gap-4 text-center text-xs">
              <a
                href="/forgot-password"
                className="hover:text-primary"
              >
                Forgot password?
              </a>

              <button
                type="button"
                onClick={() => setLegal("privacy")}
                className="hover:text-primary lg:hidden"
              >
                Privacy
              </button>

              <button
                type="button"
                onClick={() => setLegal("terms")}
                className="hover:text-primary lg:hidden"
              >
                Terms
              </button>
            </div>
          </form>

        </div>
      </div>

      <Dialog
        open={!!legal}
        onOpenChange={(v) => !v && setLegal(null)}
      >
        <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {legal ? LEGAL[legal].title : ""}
            </DialogTitle>

            <DialogDescription>
              Seereon HRMS · {ws.legalName || ws.name} · effective from{" "}
              {ws.createdOn}
            </DialogDescription>
          </DialogHeader>

          <div className="text-muted-foreground space-y-3 text-sm">
            {(legal ? LEGAL[legal].body : []).map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Login;
