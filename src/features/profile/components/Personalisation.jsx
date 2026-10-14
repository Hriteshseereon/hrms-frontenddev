// My Profile → Personalisation: profile photo or generated avatar, font, and background wallpaper with blur.
// Colours are decided by the organisation (Settings → Branding) and are not user-changeable.
import { useRef, useState } from "react";
import {
  Camera,
  Image as ImageIcon,
  Type,
  Sparkles,
  Trash2,
  Upload,
  Check,
  Wand2,
  SunMoon,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { initials } from "@/features/employees/data/employee-directory";
import { useTheme, setTheme } from "@/lib/theme";
import {
  FONTS,
  WALLPAPER_PRESETS,
  useUserPrefs,
  setUserPrefs,
  addCustomWallpaper,
  removeCustomWallpaper,
  fileToDataUrl,
  generatedAvatar,
  resolveAvatar,
  ensureFontLoaded,
} from "@/features/administration/data/appearance";

export function PersonalisationPanel() {
  const me = useCurrentUser();
  const prefs = useUserPrefs(me.id);
  const mode = useTheme();
  const photoRef = useRef(null);
  const wallRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const avatar = resolveAvatar(me.name, prefs);

  return (
    <div className="space-y-4">
      {/* Photo / avatar */}
      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start gap-5">
            <div className="relative">
              <Avatar className="border-gold/40 h-24 w-24 border-2">
                {avatar && <AvatarImage src={avatar} alt={me.name} />}
                <AvatarFallback className="bg-gradient-emerald text-2xl font-semibold text-white">
                  {initials(me.name)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="bg-gradient-emerald shadow-premium absolute -right-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full text-white"
                aria-label="Upload photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const url = await fileToDataUrl(f, 512, 0.9);
                    setUserPrefs(me.id, { avatar: url, avatarStyle: "photo" });
                    toast.success("Profile photo updated");
                  } catch {
                    toast.error("Could not read that image");
                  }
                }}
              />
            </div>
            <div className="min-w-[240px] flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="text-primary h-4 w-4" /> Profile photo & avatar
                </div>
                <div className="text-muted-foreground text-xs">
                  Upload a photo, or generate an avatar. It appears in the top bar, on your profile
                  and wherever your name is shown.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["photo", "Photo"],
                  ["initials", "Initials"],
                  ["gradient", "Gradient"],
                  ["pattern", "Pattern"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === "photo" && !prefs.avatar) {
                        photoRef.current?.click();
                        return;
                      }
                      setUserPrefs(me.id, { avatarStyle: k });
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition",
                      prefs.avatarStyle === k
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    {k === "photo" ? (
                      prefs.avatar ? (
                        <img
                          src={prefs.avatar}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )
                    ) : k === "initials" ? (
                      <span className="bg-gradient-emerald grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white">
                        {initials(me.name)}
                      </span>
                    ) : (
                      <img
                        src={generatedAvatar(me.name, k, prefs.avatarSeed)}
                        alt=""
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    {label}
                    {prefs.avatarStyle === k && <Check className="text-primary h-3.5 w-3.5" />}
                  </button>
                ))}
                {(prefs.avatarStyle === "gradient" || prefs.avatarStyle === "pattern") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUserPrefs(me.id, { avatarSeed: prefs.avatarSeed + 1 })}
                  >
                    <Wand2 className="h-4 w-4" /> Shuffle
                  </Button>
                )}
                {prefs.avatar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      setUserPrefs(me.id, { avatar: null, avatarStyle: "initials" });
                      toast.success("Photo removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Remove photo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme + font */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardContent className="space-y-3 p-5">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <SunMoon className="text-primary h-4 w-4" /> Light / dark
              </div>
              <div className="text-muted-foreground text-xs">
                Colours themselves are set by your organisation; you choose light or dark.
              </div>
            </div>
            <div className="flex gap-2">
              {["light", "dark"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTheme(m)}
                  className={cn(
                    "flex-1 rounded-xl border p-3 text-left text-sm capitalize transition",
                    mode === m ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  )}
                >
                  <div
                    className={cn(
                      "border-border mb-2 h-10 rounded-lg border",
                      m === "dark" ? "bg-[oklch(0.2_0.014_175)]" : "bg-[#F8FAF8]",
                    )}
                  >
                    <div className="bg-primary m-2 h-2 w-1/2 rounded" />
                  </div>
                  {m} mode{mode === m && <Check className="text-primary ml-2 inline h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="space-y-3 p-5">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Type className="text-primary h-4 w-4" /> Font
              </div>
              <div className="text-muted-foreground text-xs">
                A few professional typefaces — applies to the whole app for you only.
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FONTS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onMouseEnter={() => ensureFontLoaded(f.key)}
                  onClick={() => {
                    setUserPrefs(me.id, { font: f.key });
                    toast.success(`Font set to ${f.label}`);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    prefs.font === f.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                  style={{ fontFamily: f.family }}
                >
                  <div className="flex items-center justify-between text-sm font-semibold">
                    {f.label}
                    {prefs.font === f.key && <Check className="text-primary h-3.5 w-3.5" />}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    The quick brown fox · 0123456789
                  </div>
                  <div className="text-muted-foreground text-[10px]">{f.note}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wallpaper */}
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <ImageIcon className="text-primary h-4 w-4" /> Background wallpaper
              </div>
              <div className="text-muted-foreground text-xs">
                Pick a background or add your own image. It sits behind the app with a blur, and
                panels turn to frosted glass — like macOS / Windows.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={prefs.glass}
                  onCheckedChange={(v) => setUserPrefs(me.id, { glass: v })}
                />{" "}
                Frosted panels
              </label>
              <input
                ref={wallRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  try {
                    const url = await fileToDataUrl(f, 1920, 0.8);
                    addCustomWallpaper(me.id, {
                      name: f.name.replace(/\.[^.]+$/, ""),
                      dataUrl: url,
                    });
                    toast.success("Background added and applied");
                  } catch {
                    toast.error("Could not read that image");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => wallRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Add your own
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <button
              type="button"
              onClick={() => setUserPrefs(me.id, { wallpaper: null })}
              className={cn(
                "relative aspect-[16/10] overflow-hidden rounded-xl border-2 text-xs transition",
                !prefs.wallpaper ? "border-primary" : "border-border hover:border-primary/40",
              )}
            >
              <div className="bg-background absolute inset-0" />
              <div className="bg-muted absolute inset-x-3 top-3 h-2 rounded" />
              <div className="bg-muted absolute inset-x-3 top-7 h-2 w-1/2 rounded" />
              <span className="bg-card/90 absolute bottom-2 left-2 rounded px-1.5 py-0.5 font-medium">
                None (system)
              </span>
              {!prefs.wallpaper && (
                <Check className="text-primary absolute top-2 right-2 h-4 w-4" />
              )}
            </button>
            {WALLPAPER_PRESETS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setUserPrefs(me.id, { wallpaper: w.id });
                  toast.success(`${w.name} applied`);
                }}
                className={cn(
                  "relative aspect-[16/10] overflow-hidden rounded-xl border-2 text-xs transition",
                  prefs.wallpaper === w.id
                    ? "border-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: w.css, backgroundSize: "cover" }}
                />
                <span
                  className={cn(
                    "absolute bottom-2 left-2 rounded px-1.5 py-0.5 font-medium",
                    w.tone === "dark" ? "bg-black/50 text-white" : "bg-white/80 text-slate-800",
                  )}
                >
                  {w.name}
                </span>
                {prefs.wallpaper === w.id && (
                  <Check className="bg-card text-primary absolute top-2 right-2 h-4 w-4 rounded-full p-0.5" />
                )}
              </button>
            ))}
            {prefs.customWallpapers.map((w) => (
              <div
                key={w.id}
                className={cn(
                  "relative aspect-[16/10] overflow-hidden rounded-xl border-2 text-xs transition",
                  prefs.wallpaper === w.id
                    ? "border-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                <button
                  type="button"
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url("${w.dataUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  onClick={() => setUserPrefs(me.id, { wallpaper: w.id })}
                  aria-label={w.name}
                />
                <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded bg-black/50 px-1.5 py-0.5 font-medium text-white">
                  {w.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    removeCustomWallpaper(me.id, w.id);
                    toast.success("Background removed");
                  }}
                  className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {prefs.wallpaper && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>Blur</span>
                  <span>{prefs.blur}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={prefs.blur}
                  onChange={(e) => setUserPrefs(me.id, { blur: Number(e.target.value) })}
                  className="w-full accent-[var(--brand-emerald)]"
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>Dim / brighten overlay</span>
                  <span>{prefs.dim}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={prefs.dim}
                  onChange={(e) => setUserPrefs(me.id, { dim: Number(e.target.value) })}
                  className="w-full accent-[var(--brand-emerald)]"
                />
              </label>
            </div>
          )}
          <div className="text-muted-foreground flex flex-wrap gap-2 text-[11px]">
            <Badge variant="outline">Saved per user</Badge>
            <Badge variant="outline">Colours stay as set by your organisation</Badge>
            <Badge variant="outline">Images are resized and stored in your browser</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
