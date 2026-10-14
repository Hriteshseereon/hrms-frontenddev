// Applies the organisation's colours (Super Admin decides) and the signed-in user's personalisation (font,
// wallpaper) to the document. Rendered once inside each portal shell.
import { useEffect } from "react";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useTheme } from "@/lib/theme";
import {
  FONTS,
  ensureFontLoaded,
  forDarkMode,
  useOrgTheme,
  useUserPrefs,
  wallpaperCss,
  DEFAULT_ORG_THEME,
} from "@/features/administration/data/appearance";

export function useAppearance() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const theme = useOrgTheme(orgId);
  const prefs = useUserPrefs(me.id);
  const mode = useTheme();
  const wallpaper = wallpaperCss(prefs);

  useEffect(() => {
    const root = document.documentElement;
    const isDefault =
      theme.primary.toLowerCase() === DEFAULT_ORG_THEME.primary.toLowerCase() &&
      theme.primaryDark.toLowerCase() === DEFAULT_ORG_THEME.primaryDark.toLowerCase() &&
      theme.gold.toLowerCase() === DEFAULT_ORG_THEME.gold.toLowerCase();
    const vars = isDefault
      ? {
          "--org-primary": "",
          "--org-primary-dark": "",
          "--org-gold": "",
          "--org-primary-dm": "",
          "--org-primary-dark-dm": "",
          "--org-gold-dm": "",
        }
      : {
          "--org-primary": theme.primary,
          "--org-primary-dark": theme.primaryDark,
          "--org-gold": theme.gold,
          "--org-primary-dm": forDarkMode(theme.primary, 0.7),
          "--org-primary-dark-dm": forDarkMode(theme.primaryDark, 0.3),
          "--org-gold-dm": forDarkMode(theme.gold, 0.78),
        };
    Object.entries(vars).forEach(([k, v]) =>
      v ? root.style.setProperty(k, v) : root.style.removeProperty(k),
    );
    root.style.setProperty(
      "--radius",
      theme.radius === "compact" ? "0.5rem" : theme.radius === "rounded" ? "1rem" : "0.75rem",
    );
  }, [theme.primary, theme.primaryDark, theme.gold, theme.radius]);

  useEffect(() => {
    const root = document.documentElement;
    const font = FONTS.find((f) => f.key === prefs.font) ?? FONTS[0];
    ensureFontLoaded(font.key);
    root.style.setProperty("--font-sans", font.family);
  }, [prefs.font]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-wallpaper", wallpaper && prefs.glass ? "on" : "off");
    return () => root.removeAttribute("data-wallpaper");
  }, [wallpaper, prefs.glass]);

  return { prefs, wallpaper, mode };
}

/** Fixed, blurred background behind the whole portal (Apple / Microsoft style). */
export function WallpaperLayer() {
  const { prefs, wallpaper, mode } = useAppearance();
  if (!wallpaper) return null;
  const dark = mode === "dark";
  const dimColor = dark
    ? `rgba(4, 10, 8, ${prefs.dim / 100})`
    : `rgba(255, 255, 255, ${prefs.dim / 100})`;
  return (
    <>
      <div
        className="app-wallpaper"
        style={{
          backgroundImage: wallpaper.css,
          filter: prefs.blur ? `blur(${prefs.blur}px)` : undefined,
        }}
        aria-hidden
      />
      <div className="app-wallpaper-dim" style={{ background: dimColor }} aria-hidden />
    </>
  );
}
