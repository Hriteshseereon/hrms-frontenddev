import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, UserCircle, KeyRound, ShieldAlert, Trash2, Monitor, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useLogins } from "@/features/auth/data/rbac-store";
import { useTenantUsers } from "@/features/auth/data/tenant-users";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MyRecord } from "@/features/employees/components/MyRecord";
import { DataTable } from "@/features/employees/components/EmployeeDetail";
import { initials } from "@/features/employees/data/employee-directory";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { PersonalisationPanel } from "@/features/profile/components/Personalisation";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { Palette } from "lucide-react";
import {
  changeMyPassword,
  deleteMyPhoto,
  getLoginHistory,
  getMe,
  getMySecurity,
  getPasswordPolicy,
  parseApiError,
  replaceTokens,
  revokeMySession,
  revokeOtherSessions,
  signOutAndRedirect,
  uploadMyPhoto,
} from "@/api/meApi";
import { resolveApiUrl } from "@/api/employeeApi";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");

/** True while the signed-in account still has to replace a temporary / admin-reset password (local fallback when /me is unavailable). */
function usePasswordResetPending(userId) {
  const logins = useLogins();
  const tenants = useTenantUsers();
  return !!logins[userId]?.mustReset || tenants.some((t) => t.user.id === userId && t.forceChange);
}

/** GET /me — header identity, photo and the must-change-password flag. */
function useMeProfile() {
  const [profile, setProfile] = useState(null);
  const reload = useCallback(async () => {
    try {
      setProfile(await getMe());
    } catch {
      // the header falls back to the session identity
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return [profile, reload];
}

function EmpProfile() {
  const fallback = useCurrentEmployee();
  const user = useCurrentUser();
  const [profile, reloadProfile] = useMeProfile();
  const fileRef = useRef(null);
  const retried = useRef(false);
  const localMustReset = usePasswordResetPending(user.id);
  const mustReset = profile ? !!profile.must_change_password : localMustReset;
  const [busy, setBusy] = useState(false);
  // Login redirects "must change password" users here — open the Sign-in & security tab for them.
  const [tab, setTab] = useState("record");
  useEffect(() => {
    if (mustReset) setTab("security");
  }, [mustReset]);

  const name = profile?.full_name || fallback.name;
  const photo = resolveApiUrl(profile?.profile_photo_url);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error("Use a JPG, PNG or WebP image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The photo must be 2 MB or smaller");
      return;
    }
    setBusy(true);
    try {
      await uploadMyPhoto(file);
      retried.current = false;
      await reloadProfile();
      toast.success("Profile picture updated");
    } catch (err) {
      const { fields, general } = parseApiError(err);
      toast.error(fields.photo || general);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await deleteMyPhoto();
      await reloadProfile();
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error(parseApiError(err).general);
    } finally {
      setBusy(false);
    }
  }

  // The signed photo URL expires (~15 min): when the image fails to load, refetch /me once for a fresh one.
  const onPhotoStatus = (status) => {
    if (status === "error" && !retried.current) {
      retried.current = true;
      reloadProfile();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserCircle className="text-primary h-6 w-6" /> My Profile
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your record as maintained by HR, plus your own personalisation — photo or avatar, font,
          light / dark and background. Other record changes go through your HR team.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <div className="relative">
            <Avatar className="border-gold/40 h-20 w-20 border-2">
              {photo && (
                <AvatarImage src={photo} alt={name} onLoadingStatusChange={onPhotoStatus} />
              )}
              <AvatarFallback className="bg-gradient-emerald text-xl font-semibold text-white">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="bg-gradient-emerald shadow-premium absolute -right-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full text-white"
              aria-label="Change profile picture"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPick}
            />
          </div>
          <div>
            <div className="text-lg font-semibold">{name}</div>
            <div className="text-muted-foreground text-sm">
              {[
                profile?.designation || fallback.role,
                profile?.department || fallback.dept,
                profile?.branch_name || fallback.branch,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {[profile?.email || fallback.email, profile?.phone || fallback.phone]
                .filter(Boolean)
                .join(" · ")}
              {profile?.employee_code ? ` · ${profile.employee_code}` : ""}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" /> Change photo
            </Button>
            {photo && (
              <Button variant="outline" size="sm" disabled={busy} onClick={onRemove}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <ScrollTabsList>
          <TabsTrigger value="record">
            <UserCircle className="h-4 w-4" /> My record
          </TabsTrigger>
          <TabsTrigger value="personalise">
            <Palette className="h-4 w-4" /> Personalisation
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="h-4 w-4" /> Sign-in & security
            {mustReset && (
              <span className="bg-gold ml-1 h-2 w-2 rounded-full" aria-label="action required" />
            )}
          </TabsTrigger>
        </ScrollTabsList>
        <TabsContent value="record" className="pt-4">
          <MyRecord />
        </TabsContent>
        <TabsContent value="personalise" className="pt-4">
          <PersonalisationPanel />
        </TabsContent>
        <TabsContent value="security" className="space-y-4 pt-4">
          <SecurityCard mustReset={mustReset} onChanged={reloadProfile} />
          <SessionsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Rules text + live check, both driven by GET /auth/password-policy. */
function policyHint(p) {
  if (!p) return "";
  const parts = [
    p.require_upper && "an uppercase letter",
    p.require_lowercase && "a lowercase letter",
    p.require_number && "a number",
    p.require_symbol && "a symbol",
  ].filter(Boolean);
  return `Minimum ${p.min_length} characters${parts.length ? ` with ${parts.join(", ")}` : ""}.`;
}
function policyError(p, pw) {
  if (!p || !pw) return "";
  if (pw.length < p.min_length) return `Use at least ${p.min_length} characters.`;
  if (p.require_upper && !/[A-Z]/.test(pw)) return "Add an uppercase letter.";
  if (p.require_lowercase && !/[a-z]/.test(pw)) return "Add a lowercase letter.";
  if (p.require_number && !/[0-9]/.test(pw)) return "Add a number.";
  if (p.require_symbol && !/[^A-Za-z0-9]/.test(pw)) return "Add a symbol.";
  return "";
}

function PwField({ label, value, onChange, error, disabled }) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <Input
        type="password"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 ${error ? "border-destructive" : ""}`}
      />
      {error && <p className="text-destructive text-[11px]">{error}</p>}
    </div>
  );
}

/** Self-service password change: POST /auth/change-password (tokens are replaced on success). */
function SecurityCard({ mustReset = false, onChanged }) {
  const user = useCurrentUser();
  const [policy, setPolicy] = useState(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [locked, setLocked] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPasswordPolicy()
      .then(setPolicy)
      .catch(() => {});
  }, []);

  const liveNew = policyError(policy, next);
  const liveConfirm = confirm && next !== confirm ? "New password and confirmation do not match." : "";

  const submit = async () => {
    const local = {
      ...(liveNew ? { new_password: liveNew } : {}),
      ...(liveConfirm ? { confirm_password: liveConfirm } : {}),
    };
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await changeMyPassword({
        current_password: cur,
        new_password: next,
        confirm_password: confirm,
      });
      replaceTokens(res ?? {}); // every other device was signed out — keep this one signed in
      toast.success(res?.message || "Password updated.");
      setCur("");
      setNext("");
      setConfirm("");
      onChanged?.();
    } catch (err) {
      const { status, fields, general } = parseApiError(err);
      if (status === 429) {
        setLocked(fields.current_password || general);
      } else if (Object.keys(fields).length) {
        setErrors(fields);
      } else {
        toast.error(general);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={`shadow-card ${mustReset ? "border-gold/50" : ""}`}>
      <CardContent className="space-y-3 p-5">
        {mustReset && (
          <div className="border-gold/40 bg-gold/10 flex items-start gap-2 rounded-lg border p-3 text-xs">
            <ShieldAlert className="text-gold h-4 w-4 shrink-0" />
            <span>
              You signed in with a temporary password. Enter it as the current password and set a
              new one now — the reminder clears as soon as the change is saved.
            </span>
          </div>
        )}
        {locked && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-xs">
            {locked}
          </div>
        )}
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[220px]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="text-primary h-4 w-4" /> Sign-in &amp; security
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Login {user.email} · {user.role}. {policyHint(policy)}
            </div>
          </div>
          <div className="ml-auto grid grid-cols-1 items-start gap-2 sm:grid-cols-4">
            <PwField
              label="Current password"
              value={cur}
              onChange={setCur}
              error={errors.current_password}
              disabled={!!locked}
            />
            <PwField
              label="New password"
              value={next}
              onChange={setNext}
              error={errors.new_password || liveNew}
              disabled={!!locked}
            />
            <PwField
              label="Confirm"
              value={confirm}
              onChange={setConfirm}
              error={errors.confirm_password || liveConfirm}
              disabled={!!locked}
            />
            <Button
              className="bg-gradient-emerald mt-5 h-9 text-white"
              disabled={!cur || !next || !confirm || saving || !!locked}
              onClick={submit}
            >
              {saving ? "Saving…" : "Change password"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** GET /me/security (password age, last login, active devices) + GET /me/login-history. MFA stays hidden unless enabled. */
function SessionsCard() {
  const [sec, setSec] = useState(null);
  const [history, setHistory] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [s, h] = await Promise.allSettled([getMySecurity(), getLoginHistory(10)]);
    if (s.status === "fulfilled") setSec(s.value);
    if (h.status === "fulfilled") setHistory(Array.isArray(h.value) ? h.value : (h.value?.items ?? []));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const signOutDevice = async (session) => {
    setBusyId(session.id);
    try {
      await revokeMySession(session.id);
      if (session.current) {
        signOutAndRedirect();
        return;
      }
      toast.success("Device signed out");
      await load();
    } catch (err) {
      toast.error(parseApiError(err).general);
    } finally {
      setBusyId(null);
    }
  };

  const signOutOthers = async () => {
    setBusyId("others");
    try {
      await revokeOtherSessions();
      toast.success("Signed out of all other devices");
      await load();
    } catch (err) {
      toast.error(parseApiError(err).general);
    } finally {
      setBusyId(null);
    }
  };

  if (!sec && !history.length) return null;
  const sessions = sec?.active_sessions ?? [];

  return (
    <>
      {sec && (
        <Card className="shadow-card">
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Login email", sec.login_email],
                ["Password last changed", fmtDateTime(sec.password_last_changed_at)],
                ["Password expires", sec.password_expires_at ? fmtDateTime(sec.password_expires_at) : "Never"],
                ["Last sign-in", `${fmtDateTime(sec.last_login_at)}${sec.last_login_ip ? ` · ${sec.last_login_ip}` : ""}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{k}</div>
                  <div className="mt-0.5 font-medium break-words">{v || "—"}</div>
                </div>
              ))}
            </div>
            {sec.mfa?.enabled && (
              <div className="text-xs">
                Two-step verification is on{sec.mfa.method ? ` (${sec.mfa.method})` : ""}.
              </div>
            )}
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Monitor className="text-primary h-4 w-4" /> Active sessions
                </div>
                {sessions.some((s) => !s.current) && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === "others"}
                    onClick={signOutOthers}
                  >
                    Sign out all other devices
                  </Button>
                )}
              </div>
              <DataTable
                head={["Device", "Browser", "IP", "Location", "Last active", ""]}
                rows={sessions.map((s) => [
                  <span key="d">
                    {s.device || "—"}
                    {s.current && (
                      <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-[10px]">
                        This device
                      </span>
                    )}
                  </span>,
                  s.browser || "—",
                  s.ip || "—",
                  s.location || "—",
                  fmtDateTime(s.last_active_at),
                  <Button
                    key="o"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={busyId === s.id}
                    onClick={() => signOutDevice(s)}
                  >
                    Sign out
                  </Button>,
                ])}
              />
            </div>
          </CardContent>
        </Card>
      )}
      {history.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="text-primary h-4 w-4" /> Recent sign-in activity
            </div>
            <DataTable
              head={["When", "IP", "Device", "Result"]}
              rows={history.map((h) => [
                fmtDateTime(h.at),
                h.ip || "—",
                h.device || "—",
                <span
                  key="s"
                  className={h.status === "success" ? "text-primary" : "text-destructive"}
                >
                  {h.status === "success" ? "Success" : "Failed"}
                </span>,
              ])}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default EmpProfile;
