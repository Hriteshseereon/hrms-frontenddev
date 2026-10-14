import { useEffect, useRef, useState } from "react";
import { Camera, UserCircle, KeyRound, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, useCurrentUser } from "@/features/auth/data/auth-session";
import { useLogins } from "@/features/auth/data/rbac-store";
import { useTenantUsers } from "@/features/auth/data/tenant-users";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmployeeDetail } from "@/features/employees/components/EmployeeDetail";
import { initials } from "@/features/employees/data/employee-directory";
import {
  useCurrentEmployee,
  useEmployeeAvatar,
  setEmployeeAvatar,
} from "@/features/auth/data/emp-session";
import { PersonalisationPanel } from "@/features/profile/components/Personalisation";
import { fileToDataUrl } from "@/features/administration/data/appearance";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { Palette } from "lucide-react";

/** True while the signed-in account still has to replace a temporary / admin-reset password (login sends such users here). */
function usePasswordResetPending(userId) {
  const logins = useLogins();
  const tenants = useTenantUsers();
  return !!logins[userId]?.mustReset || tenants.some((t) => t.user.id === userId && t.forceChange);
}

function EmpProfile() {
  const me = useCurrentEmployee();
  const user = useCurrentUser();
  const avatar = useEmployeeAvatar();
  const fileRef = useRef(null);
  const mustReset = usePasswordResetPending(user.id);
  // Login redirects "must change password" users here — open the Sign-in & security tab for them (client-side, after the persisted flags are known).
  const [tab, setTab] = useState("record");
  useEffect(() => {
    if (mustReset) setTab("security");
  }, [mustReset]);

  // Downscaled like the Personalisation uploader — the full-size data URL overflowed the browser storage quota, so the
  // photo showed until reload and was then gone (the write failure is swallowed). Resetting the input lets the same
  // file be picked again.
  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    try {
      setEmployeeAvatar(await fileToDataUrl(file, 512, 0.9));
      toast.success("Profile picture updated");
    } catch {
      toast.error("Could not read that image");
    }
  }

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
              {avatar && <AvatarImage src={avatar} alt={me.name} />}
              <AvatarFallback className="bg-gradient-emerald text-xl font-semibold text-white">
                {initials(me.name)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              className="bg-gradient-emerald shadow-premium absolute -right-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full text-white"
              aria-label="Change profile picture"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPick}
            />
          </div>
          <div>
            <div className="text-lg font-semibold">{me.name}</div>
            <div className="text-muted-foreground text-sm">
              {me.role} · {me.dept} · {me.branch}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {me.email} · {me.phone}
            </div>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" /> Change photo
            </Button>
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
          <EmployeeDetail employee={me} selfView />
        </TabsContent>
        <TabsContent value="personalise" className="pt-4">
          <PersonalisationPanel />
        </TabsContent>
        <TabsContent value="security" className="pt-4">
          <SecurityCard mustReset={mustReset} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Self-service password change (MoM: user self-service incl. change of password). */
function SecurityCard({ mustReset = false }) {
  const user = useCurrentUser();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const submit = () => {
    if (next !== confirm) {
      toast.error("New password and confirmation do not match");
      return;
    }
    const r = changePassword(user.id, cur, next);
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok) {
      setCur("");
      setNext("");
      setConfirm("");
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
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="text-primary h-4 w-4" /> Sign-in &amp; security
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Login {user.email} · {user.role}. Minimum 8 characters with an uppercase letter, a
              number and a symbol.
            </div>
          </div>
          <div className="ml-auto grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Current password</Label>
              <Input
                type="password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">New password</Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Confirm</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              className="bg-gradient-emerald h-9 text-white"
              disabled={!cur || !next || !confirm}
              onClick={submit}
            >
              Change password
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmpProfile;
