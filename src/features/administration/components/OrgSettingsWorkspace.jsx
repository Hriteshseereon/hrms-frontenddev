import { useEffect, useRef, useState } from "react";
import {
  Settings,
  Building2,
  Palette,
  ShieldCheck,
  Bell,
  RotateCcw,
  Upload,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useActiveOrgId, useOrgs, updateOrg } from "@/features/organization/data/group-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { createPersistentStore } from "@/lib/persist";
import { OFFICES } from "@/features/employees/data/hr-data";
import {
  useResolvedBrand,
  setOrgBrand,
  setBrand,
} from "@/features/administration/data/brand-config";
import {
  THEME_PRESETS,
  DEFAULT_ORG_THEME,
  useOrgTheme,
  setOrgTheme,
  resetOrgTheme,
  isValidHex,
  forDarkMode,
  fileToDataUrl,
} from "@/features/administration/data/appearance";
import {
  SsoConfigDialog,
  AdConfigDialog,
  BiometricDevicesDialog,
  EmailTicketConfigDialog,
} from "@/features/administration/components/IntegrationConfigDialogs";

/**
 * Security / notification toggles per entity — the switches used to be uncontrolled and remembered nothing.
 * @typedef {Object} OrgToggles
 * @property {boolean} mfa
 * @property {string} sessionTimeout
 * @property {boolean} ipAllowList
 * @property {boolean} email
 * @property {boolean} whatsapp
 * @property {boolean} sms
 * @property {boolean} inApp
 */
const DEFAULT_TOGGLES = {
  mfa: true,
  sessionTimeout: "30 minutes",
  ipAllowList: false,
  email: true,
  whatsapp: true,
  sms: false,
  inApp: true,
};
const togglesStore = createPersistentStore("seereon.org.settings.toggles.v1", {});
const useToggles = (orgId) => ({ ...DEFAULT_TOGGLES, ...(togglesStore.use()[orgId] ?? {}) });
const setToggle = (orgId, patch) =>
  togglesStore.set((p) => ({ ...p, [orgId]: { ...(p[orgId] ?? {}), ...patch } }));

function Row({ label, hint, children }) {
  return (
    <div className="border-border flex flex-wrap items-start justify-between gap-4 border-b py-4 last:border-0">
      <div className="min-w-[200px]">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function OrgSettings() {
  const me = useCurrentUser();
  // Company-wide configuration (profile, security, channels) is an administrator decision — HR / CHRO can open Settings
  // and used to change the legal name, MFA, IP allow-list and SSO for the whole company.
  const canEdit = me.role === "SuperAdmin" || me.role === "Admin";
  const activeOrgId = useActiveOrgId();
  const orgs = useOrgs();
  const org = orgs.find((o) => o.id === activeOrgId);
  const brand = useResolvedBrand(activeOrgId);
  const toggles = useToggles(activeOrgId);
  const seedProfile = () => ({
    legal: org?.legalName ?? brand.name,
    display: org?.name ?? brand.name,
    address: brand.address,
    tz: "India · Asia/Kolkata",
    fy: "01 April",
    currency: "INR — Indian Rupee",
    email: brand.email,
    phone: brand.phone,
    website: brand.website,
  });
  const [profile, setProfile] = useState(seedProfile);
  // Re-seed the form when the Super Admin switches entity, and when the persisted brand / entity record arrives after
  // hydration (the form opened with the defaults and saving it overwrote the saved profile).
  const seedKey = [
    activeOrgId,
    org?.name,
    org?.legalName,
    brand.name,
    brand.address,
    brand.email,
    brand.phone,
    brand.website,
  ].join("|");
  useEffect(() => {
    setProfile(seedProfile());
  }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p) => setProfile((v) => ({ ...v, ...p }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="text-primary h-6 w-6" /> Workspace Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Organisation profile, branding & colours (applied system-wide), security and notification
          channels{org ? ` — ${org.name}` : ""}.
        </p>
      </div>

      <Tabs defaultValue="brand">
        <ScrollTabsList>
          <TabsTrigger value="general">
            <Building2 className="h-4 w-4" /> Organization
          </TabsTrigger>
          <TabsTrigger value="brand">
            <Palette className="h-4 w-4" /> Branding & colours
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck className="h-4 w-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="notify">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="general" className="pt-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Organization Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Legal Name</Label>
                <Input value={profile.legal} onChange={(e) => set({ legal: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input value={profile.display} onChange={(e) => set({ display: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Registered Address</Label>
                <Input value={profile.address} onChange={(e) => set({ address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>HR email</Label>
                <Input value={profile.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={profile.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={profile.website} onChange={(e) => set({ website: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Country / Timezone</Label>
                <Input value={profile.tz} onChange={(e) => set({ tz: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Financial Year Start</Label>
                <Input value={profile.fy} onChange={(e) => set({ fy: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Default Currency</Label>
                <Input
                  value={profile.currency}
                  onChange={(e) => set({ currency: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 md:col-span-2">
                {!canEdit && (
                  <span className="text-muted-foreground text-xs">
                    Only the Super Admin / Admin can change the organisation profile.
                  </span>
                )}
                {profile.email.trim() && !/^\S+@\S+\.\S+$/.test(profile.email.trim()) && (
                  <span className="text-destructive text-xs">Enter a valid HR e-mail.</span>
                )}
                <Button
                  className="bg-gradient-emerald text-white"
                  disabled={
                    !canEdit ||
                    !profile.display.trim() ||
                    !profile.legal.trim() ||
                    (!!profile.email.trim() && !/^\S+@\S+\.\S+$/.test(profile.email.trim()))
                  }
                  onClick={() => {
                    // Display name → brand (letters, payslips, top bar) and the entity record; legal name → the entity record (was dropped before).
                    const patch = {
                      name: profile.display.trim(),
                      address: profile.address,
                      email: profile.email,
                      phone: profile.phone,
                      website: profile.website,
                    };
                    if (activeOrgId === "ORG-SEEREON") setBrand(patch);
                    else setOrgBrand(activeOrgId, patch);
                    updateOrg(activeOrgId, {
                      name: profile.display.trim(),
                      legalName: profile.legal.trim(),
                    });
                    toast.success(
                      "Organisation profile saved — letters and reports use it immediately",
                    );
                  }}
                >
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keyed by entity so the colour draft never carries one company's palette into another. */}
        <TabsContent value="brand" className="pt-4">
          <BrandingTab key={activeOrgId} orgId={activeOrgId} />
        </TabsContent>

        <TabsContent value="security" className="pt-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
            </CardHeader>
            <CardContent>
              {!canEdit && (
                <div className="text-muted-foreground mb-2 text-xs">
                  Read-only — only the Super Admin / Admin can change security settings.
                </div>
              )}
              <Row label="Enforce MFA for admins" hint="Two-factor mandatory on every admin login.">
                <Switch
                  disabled={!canEdit}
                  checked={toggles.mfa}
                  onCheckedChange={(v) => setToggle(activeOrgId, { mfa: v })}
                />
              </Row>
              <Row label="Session timeout" hint="Idle time before auto sign-out.">
                <Input
                  disabled={!canEdit}
                  value={toggles.sessionTimeout}
                  onChange={(e) => setToggle(activeOrgId, { sessionTimeout: e.target.value })}
                  className="w-full sm:w-40"
                />
              </Row>
              <Row label="IP allow-list" hint="Restrict admin access to trusted networks.">
                <Switch
                  disabled={!canEdit}
                  checked={toggles.ipAllowList}
                  onCheckedChange={(v) => setToggle(activeOrgId, { ipAllowList: v })}
                />
              </Row>
              {canEdit && (
                <>
                  <Row label="Single Sign-On (SSO)" hint="SAML / OIDC integration with your IdP.">
                    <SsoConfigDialog orgId={activeOrgId} />
                  </Row>
                  <Row
                    label="Active Directory"
                    hint="Sync employee records from your AD / Azure AD."
                  >
                    <AdConfigDialog orgId={activeOrgId} />
                  </Row>
                  <Row
                    label="Biometric device registry"
                    hint="Register shift-tracking devices per branch — OEM setup pending."
                  >
                    <BiometricDevicesDialog orgId={activeOrgId} branches={OFFICES} />
                  </Row>
                  <Row
                    label="Email-to-ticket"
                    hint="Route inbound support email into the ticketing system."
                  >
                    <EmailTicketConfigDialog orgId={activeOrgId} />
                  </Row>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notify" className="pt-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Notification Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <Row label="Email notifications" hint="Send transactional emails via SMTP.">
                <Switch
                  disabled={!canEdit}
                  checked={toggles.email}
                  onCheckedChange={(v) => setToggle(activeOrgId, { email: v })}
                />
              </Row>
              <Row label="WhatsApp Business" hint="Payslips, OTPs and announcements.">
                <Switch
                  disabled={!canEdit}
                  checked={toggles.whatsapp}
                  onCheckedChange={(v) => setToggle(activeOrgId, { whatsapp: v })}
                />
              </Row>
              <Row label="SMS gateway" hint="Fallback OTPs and reminders.">
                <Switch
                  disabled={!canEdit}
                  checked={toggles.sms}
                  onCheckedChange={(v) => setToggle(activeOrgId, { sms: v })}
                />
              </Row>
              <Row label="In-app inbox" hint="Bell notifications for every user.">
                <Switch
                  disabled={!canEdit}
                  checked={toggles.inApp}
                  onCheckedChange={(v) => setToggle(activeOrgId, { inApp: v })}
                />
              </Row>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Colours & logo — changes here re-theme the entire system live (buttons, sidebar, badges, reports). */
function BrandingTab({ orgId }) {
  const me = useCurrentUser();
  const theme = useOrgTheme(orgId);
  const brand = useResolvedBrand(orgId);
  const [draft, setDraft] = useState(theme);
  // The saved palette arrives after hydration (server renders the defaults) — follow it until the admin starts editing.
  const themeKey = `${theme.primary}|${theme.primaryDark}|${theme.gold}|${theme.radius}`;
  const [seenTheme, setSeenTheme] = useState(themeKey);
  if (seenTheme !== themeKey) {
    setSeenTheme(themeKey);
    setDraft(theme);
  }
  const [live, setLive] = useState(true);
  const fileRef = useRef(null);
  const canEdit = me.role === "SuperAdmin" || me.role === "Admin";
  const update = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (live && canEdit && [next.primary, next.primaryDark, next.gold].every(isValidHex))
      setOrgTheme(orgId, next);
  };
  const save = () => {
    if (![draft.primary, draft.primaryDark, draft.gold].every(isValidHex)) {
      toast.error("Use 6-digit hex colours, e.g. #0F6B50");
      return;
    }
    setOrgTheme(orgId, draft);
    setOrgBrand(orgId, { accent: draft.primary });
    toast.success("Brand colours applied to the whole system for this company");
  };
  const reset = () => {
    resetOrgTheme(orgId);
    setDraft(DEFAULT_ORG_THEME);
    setOrgBrand(orgId, { accent: DEFAULT_ORG_THEME.primary });
    toast.success("Back to Seereon default colours");
  };
  const applyPreset = (p) =>
    update({ primary: p.primary, primaryDark: p.primaryDark, gold: p.gold });
  const swatch = (label, key, hint) => (
    <div className="border-border space-y-2 rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={isValidHex(draft[key]) ? draft[key] : "#000000"}
          onChange={(e) => update({ [key]: e.target.value })}
          disabled={!canEdit}
          className="border-border h-10 w-12 cursor-pointer rounded-lg border bg-transparent p-0.5"
          aria-label={label}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-muted-foreground text-[11px]">{hint}</div>
        </div>
        <Input
          value={draft[key]}
          onChange={(e) => update({ [key]: e.target.value })}
          disabled={!canEdit}
          className={cn(
            "w-28 font-mono uppercase",
            !isValidHex(draft[key]) && "border-destructive",
          )}
        />
      </div>
      <div className="text-muted-foreground flex gap-1.5 text-[10px]">
        <span className="inline-block h-4 w-8 rounded" style={{ background: draft[key] }} /> light ·{" "}
        <span
          className="inline-block h-4 w-8 rounded"
          style={{
            background: forDarkMode(
              draft[key],
              key === "primaryDark" ? 0.3 : key === "gold" ? 0.78 : 0.7,
            ),
          }}
        />{" "}
        dark mode
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card className="shadow-card">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <Palette className="text-primary h-4 w-4" /> Organisation colours
                </div>
                <div className="text-muted-foreground text-xs">
                  Set by the Super Admin / Admin and applied to everyone in this company — buttons,
                  sidebar, highlights, badges, charts and printed reports. Users can personalise
                  fonts and backgrounds, not colours.
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={live} onCheckedChange={setLive} disabled={!canEdit} /> Live preview
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {swatch("Primary", "primary", "Buttons, links, active states")}
              {swatch("Primary (dark)", "primaryDark", "Sidebar, gradient end")}
              {swatch("Accent", "gold", "Badges, highlights, callouts")}
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Presets
              </div>
              <div className="flex flex-wrap gap-2">
                {THEME_PRESETS.map((p) => {
                  const active =
                    draft.primary.toLowerCase() === p.primary.toLowerCase() &&
                    draft.gold.toLowerCase() === p.gold.toLowerCase();
                  return (
                    <button
                      key={p.name}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => applyPreset(p)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <span className="flex -space-x-1">
                        <span
                          className="ring-card h-5 w-5 rounded-full ring-2"
                          style={{ background: p.primary }}
                        />
                        <span
                          className="ring-card h-5 w-5 rounded-full ring-2"
                          style={{ background: p.primaryDark }}
                        />
                        <span
                          className="ring-card h-5 w-5 rounded-full ring-2"
                          style={{ background: p.gold }}
                        />
                      </span>
                      {p.name}
                      {active && <Check className="text-primary h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Corner radius</Label>
                <Select
                  value={draft.radius}
                  onValueChange={(v) => update({ radius: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="rounded">Rounded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={!canEdit}>
                <RotateCcw className="h-4 w-4" /> Reset to Seereon default
              </Button>
              <Button className="bg-gradient-emerald text-white" onClick={save} disabled={!canEdit}>
                Apply to the whole system
              </Button>
            </div>
            {!canEdit && (
              <div className="text-muted-foreground text-xs">
                Only the Super Admin / Admin can change colours. You can personalise your own font
                and background from My Profile.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <Row
              label="Company logo"
              hint="Shown in the sidebar, letters, payslips and reports. PNG / SVG / JPG, square works best."
            >
              <div className="flex items-center gap-3">
                <img
                  src={brand.logo}
                  alt="logo"
                  className="border-border h-12 w-12 rounded-xl border bg-white object-contain p-1"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    if (!f.type.startsWith("image/")) {
                      toast.error("Choose an image file (PNG, SVG or JPG)");
                      return;
                    }
                    try {
                      const url = await fileToDataUrl(f, 512, 0.9);
                      if (orgId === "ORG-SEEREON") setBrand({ logo: url });
                      else setOrgBrand(orgId, { logo: url });
                      toast.success("Logo updated everywhere");
                    } catch {
                      toast.error("Could not read that image");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> Upload
                </Button>
              </div>
            </Row>
            <Row label="Tagline" hint="Printed under the company name on documents.">
              <Input
                key={`tag-${orgId}-${brand.tagline}`}
                defaultValue={brand.tagline}
                disabled={!canEdit}
                className="w-72 max-w-full"
                onBlur={(e) => {
                  if (orgId === "ORG-SEEREON") setBrand({ tagline: e.target.value });
                  else setOrgBrand(orgId, { tagline: e.target.value });
                }}
              />
            </Row>
            <Row label="Document footer" hint="Legal line at the bottom of every generated PDF.">
              <Input
                key={`foot-${orgId}-${brand.footer}`}
                defaultValue={brand.footer}
                disabled={!canEdit}
                className="w-72 max-w-full"
                onBlur={(e) => {
                  if (orgId === "ORG-SEEREON") setBrand({ footer: e.target.value });
                  else setOrgBrand(orgId, { footer: e.target.value });
                }}
              />
            </Row>
          </CardContent>
        </Card>
      </div>

      {/* Live preview card */}
      <Card className="shadow-card self-start xl:sticky xl:top-4">
        <CardContent className="space-y-3 p-5">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Preview
          </div>
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="flex">
              <div className="w-16 space-y-2 p-2" style={{ background: draft.primaryDark }}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-2 rounded"
                    style={{ background: i === 2 ? draft.gold : "rgba(255,255,255,.25)" }}
                  />
                ))}
              </div>
              <div className="bg-card flex-1 space-y-2 p-3">
                <div className="flex gap-2">
                  <span
                    className="rounded-md px-2 py-1 text-[10px] text-white"
                    style={{
                      background: `linear-gradient(135deg, ${draft.primary}, ${draft.primaryDark})`,
                    }}
                  >
                    Primary button
                  </span>
                  <span
                    className="rounded-md border px-2 py-1 text-[10px]"
                    style={{ borderColor: draft.gold, color: draft.gold }}
                  >
                    Accent badge
                  </span>
                </div>
                <div className="bg-muted h-2 w-3/4 rounded" />
                <div className="bg-muted h-2 w-1/2 rounded" />
                <div className="flex h-10 items-end gap-1">
                  {[40, 70, 55, 90, 65].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{ height: `${h}%`, background: i % 2 ? draft.gold : draft.primary }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Live: primary
            </Badge>
            <Badge variant="outline" className="border-gold/50 text-gold">
              Live: accent
            </Badge>
            <Button size="sm" className="bg-gradient-emerald text-white">
              Live button
            </Button>
          </div>
          <p className="text-muted-foreground text-[11px]">
            The badges and button above use the real system tokens — with live preview on they
            change as you pick colours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
