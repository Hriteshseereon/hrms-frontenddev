// Appearance: organisation colours (decided by the Super Admin / Admin in Settings → Branding and applied to the
// whole system), and per-user personalisation (font, background wallpaper with blur, profile photo / avatar).
// Users cannot change the colour theme — only their own background, font and photo.
import { createPersistentStore } from "@/lib/persist";

/* ------------------------------ Organisation theme ------------------------------ */
/**
 * @typedef {Object} OrgTheme
 * @property {string} primary
 * @property {string} primaryDark
 * @property {string} gold
 * @property {"compact" | "regular" | "rounded"} radius
 */
export const DEFAULT_ORG_THEME = {
  primary: "#0F6B50",
  primaryDark: "#0B4F3A",
  gold: "#C8A951",
  radius: "regular",
};

export const THEME_PRESETS = [
  { name: "Seereon Emerald", primary: "#0F6B50", primaryDark: "#0B4F3A", gold: "#C8A951" },
  { name: "Royal Blue", primary: "#1D4ED8", primaryDark: "#1E3A8A", gold: "#F59E0B" },
  { name: "Deep Teal", primary: "#0F766E", primaryDark: "#134E4A", gold: "#EAB308" },
  { name: "Indigo Night", primary: "#4F46E5", primaryDark: "#312E81", gold: "#F472B6" },
  { name: "Burgundy", primary: "#9F1239", primaryDark: "#4C0519", gold: "#D4A017" },
  { name: "Graphite", primary: "#334155", primaryDark: "#0F172A", gold: "#22C55E" },
  { name: "Saffron", primary: "#C2410C", primaryDark: "#7C2D12", gold: "#0EA5E9" },
];

export const orgThemeStore = createPersistentStore("seereon.appearance.org.v1", {
  "ORG-1042": { primary: "#7C4A12", primaryDark: "#4A2A08", gold: "#F2B84B", radius: "regular" },
  "ORG-1043": { primary: "#334155", primaryDark: "#0F172A", gold: "#22C55E", radius: "regular" },
});
export const useOrgTheme = (orgId) => ({
  ...DEFAULT_ORG_THEME,
  ...(orgThemeStore.use()[orgId] ?? {}),
});
export const getOrgTheme = (orgId) => ({
  ...DEFAULT_ORG_THEME,
  ...(orgThemeStore.get()[orgId] ?? {}),
});
export const setOrgTheme = (orgId, patch) =>
  orgThemeStore.set((p) => ({
    ...p,
    [orgId]: { ...DEFAULT_ORG_THEME, ...(p[orgId] ?? {}), ...patch },
  }));
export const resetOrgTheme = (orgId) =>
  orgThemeStore.set((p) => {
    const n = { ...p };
    delete n[orgId];
    return n;
  });

/* ------------------------------ Colour helpers ------------------------------ */
export function hexToHsl(hex) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [165, 0.75, 0.24];
  const r = parseInt(m[1], 16) / 255,
    g = parseInt(m[2], 16) / 255,
    b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
export function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
/** Lighter, slightly less saturated version for dark mode so brand colours stay readable on dark surfaces. */
export const forDarkMode = (hex, targetL = 0.68) => {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, Math.min(0.75, s * 0.9), targetL);
};
export const darken = (hex, by = 0.12) => {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0.08, l - by));
};
export const isValidHex = (v) => /^#([0-9a-f]{6})$/i.test(v.trim());

/* ------------------------------ Fonts ------------------------------ */
/**
 * @typedef {"inter" | "manrope" | "plex" | "source" | "roboto" | "nunito" | "dmsans" | "system"} FontKey
 */
export const FONTS = [
  {
    key: "inter",
    label: "Inter",
    family: '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
    note: "Default — neutral, compact, excellent for tables",
  },
  {
    key: "manrope",
    label: "Manrope",
    family: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif',
    note: "Modern geometric, slightly wider",
  },
  {
    key: "plex",
    label: "IBM Plex Sans",
    family: '"IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    note: "Corporate, distinctive letterforms",
  },
  {
    key: "source",
    label: "Source Sans 3",
    family: '"Source Sans 3 Variable", "Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    note: "Classic humanist, very readable at small sizes",
  },
  {
    key: "roboto",
    label: "Roboto",
    family: '"Roboto Variable", "Roboto", ui-sans-serif, system-ui, sans-serif',
    note: "Familiar Android / Google look",
  },
  {
    key: "nunito",
    label: "Nunito Sans",
    family: '"Nunito Sans Variable", "Nunito Sans", ui-sans-serif, system-ui, sans-serif',
    note: "Rounded and friendly",
  },
  {
    key: "dmsans",
    label: "DM Sans",
    family: '"DM Sans Variable", "DM Sans", ui-sans-serif, system-ui, sans-serif',
    note: "Low-contrast geometric, clean UI feel",
  },
  {
    key: "system",
    label: "System UI",
    family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    note: "Whatever your device uses — fastest",
  },
];
/**
 * Fonts are self-hosted (npm @fontsource-variable/*) so the app works offline, inside a mobile WebView and
 * without third-party requests. Inter is bundled with the root layout; the others load on first use.
 */
const FONT_LOADERS = {
  manrope: () => import("@fontsource-variable/manrope"),
  plex: () => import("@fontsource-variable/ibm-plex-sans"),
  source: () => import("@fontsource-variable/source-sans-3"),
  roboto: () => import("@fontsource-variable/roboto"),
  nunito: () => import("@fontsource-variable/nunito-sans"),
  dmsans: () => import("@fontsource-variable/dm-sans"),
};
const loadedFonts = new Set();
export function ensureFontLoaded(key) {
  if (typeof document === "undefined" || loadedFonts.has(key) || !FONT_LOADERS[key]) return;
  loadedFonts.add(key);
  FONT_LOADERS[key]().catch(() => loadedFonts.delete(key));
}

/* ------------------------------ Wallpapers ------------------------------ */
/**
 * @typedef {Object} Wallpaper
 * @property {string} id
 * @property {string} name
 * @property {string} css
 * @property {"light" | "dark"} tone
 */
const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;
export const WALLPAPER_PRESETS = [
  {
    id: "emerald-mist",
    name: "Emerald mist",
    tone: "light",
    css: `${noise}, radial-gradient(1200px 700px at 15% 10%, #d9f2e6 0%, transparent 60%), radial-gradient(900px 600px at 85% 20%, #f6e7bd 0%, transparent 55%), radial-gradient(1000px 800px at 60% 100%, #bfe3d3 0%, transparent 60%), linear-gradient(160deg, #eef7f2 0%, #e3efe9 100%)`,
  },
  {
    id: "golden-hour",
    name: "Golden hour",
    tone: "light",
    css: `radial-gradient(1000px 600px at 10% 90%, #ffd89b 0%, transparent 55%), radial-gradient(900px 700px at 90% 10%, #ffb88c 0%, transparent 55%), linear-gradient(135deg, #fff3e0 0%, #ffe0b2 45%, #f8bbd0 100%)`,
  },
  {
    id: "aurora",
    name: "Aurora",
    tone: "dark",
    css: `radial-gradient(900px 600px at 20% 20%, rgba(52, 211, 153, .55) 0%, transparent 60%), radial-gradient(800px 600px at 80% 30%, rgba(129, 140, 248, .5) 0%, transparent 60%), radial-gradient(1100px 700px at 50% 100%, rgba(244, 114, 182, .35) 0%, transparent 60%), linear-gradient(180deg, #0b1220 0%, #111827 100%)`,
  },
  {
    id: "deep-ocean",
    name: "Deep ocean",
    tone: "dark",
    css: `radial-gradient(1000px 700px at 30% 0%, #0e7490 0%, transparent 55%), radial-gradient(900px 600px at 90% 90%, #1e3a8a 0%, transparent 55%), linear-gradient(160deg, #082f49 0%, #0f172a 100%)`,
  },
  {
    id: "slate-dusk",
    name: "Slate dusk",
    tone: "dark",
    css: `radial-gradient(900px 500px at 80% 0%, #475569 0%, transparent 60%), radial-gradient(700px 500px at 0% 100%, #334155 0%, transparent 60%), linear-gradient(180deg, #1e293b 0%, #0f172a 100%)`,
  },
  {
    id: "sand",
    name: "Sandstone",
    tone: "light",
    css: `${noise}, radial-gradient(900px 600px at 80% 10%, #f5e6c8 0%, transparent 55%), linear-gradient(160deg, #faf5ec 0%, #efe6d6 100%)`,
  },
  {
    id: "lilac",
    name: "Lilac haze",
    tone: "light",
    css: `radial-gradient(900px 600px at 20% 20%, #e9d5ff 0%, transparent 55%), radial-gradient(900px 600px at 90% 80%, #bae6fd 0%, transparent 55%), linear-gradient(160deg, #f5f3ff 0%, #eef2ff 100%)`,
  },
  {
    id: "forest",
    name: "Forest canopy",
    tone: "dark",
    css: `radial-gradient(1000px 600px at 20% 100%, #14532d 0%, transparent 60%), radial-gradient(800px 600px at 90% 0%, #365314 0%, transparent 60%), linear-gradient(180deg, #052e16 0%, #0a1f14 100%)`,
  },
];

/* ------------------------------ Per-user preferences ------------------------------ */
/**
 * @typedef {Object} CustomWallpaper
 * @property {string} id
 * @property {string} name
 * @property {string} dataUrl
 * @property {string} addedOn
 */
/**
 * @typedef {Object} UserPrefs
 * @property {FontKey} font
 * @property {string | null} wallpaper
 * @property {number} blur
 * @property {number} dim
 * @property {boolean} glass
 * @property {CustomWallpaper[]} customWallpapers
 * @property {string | null} avatar
 * @property {"photo" | "initials" | "gradient" | "pattern"} avatarStyle
 * @property {number} avatarSeed
 */
export const DEFAULT_PREFS = {
  font: "inter",
  wallpaper: null,
  blur: 10,
  dim: 15,
  glass: true,
  customWallpapers: [],
  avatar: null,
  avatarStyle: "initials",
  avatarSeed: 1,
};

export const userPrefsStore = createPersistentStore("seereon.appearance.user.v1", {});
export const useUserPrefs = (userId) => ({
  ...DEFAULT_PREFS,
  ...(userPrefsStore.use()[userId] ?? {}),
});
export const getUserPrefs = (userId) => ({
  ...DEFAULT_PREFS,
  ...(userPrefsStore.get()[userId] ?? {}),
});
export const setUserPrefs = (userId, patch) =>
  userPrefsStore.set((p) => ({
    ...p,
    [userId]: { ...DEFAULT_PREFS, ...(p[userId] ?? {}), ...patch },
  }));
export const addCustomWallpaper = (userId, w) => {
  const id = `wp-${Date.now().toString(36)}`;
  setUserPrefs(userId, {
    customWallpapers: [
      ...getUserPrefs(userId).customWallpapers,
      { ...w, id, addedOn: new Date().toISOString().slice(0, 10) },
    ],
    wallpaper: id,
  });
  return id;
};
export const removeCustomWallpaper = (userId, id) => {
  const p = getUserPrefs(userId);
  setUserPrefs(userId, {
    customWallpapers: p.customWallpapers.filter((w) => w.id !== id),
    wallpaper: p.wallpaper === id ? null : p.wallpaper,
  });
};

/** Resolve a wallpaper id to CSS for the background layer. */
export function wallpaperCss(prefs) {
  if (!prefs.wallpaper) return null;
  const preset = WALLPAPER_PRESETS.find((w) => w.id === prefs.wallpaper);
  if (preset) return { css: preset.css, tone: preset.tone };
  const custom = prefs.customWallpapers.find((w) => w.id === prefs.wallpaper);
  if (custom) return { css: `url("${custom.dataUrl}")`, tone: "dark" };
  return null;
}

/** Downscale an image file to a compact JPEG data URL (keeps localStorage small). */
export function fileToDataUrl(file, maxW = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------ Generated avatars ------------------------------ */
const AVATAR_PALETTES = [
  ["#0F6B50", "#C8A951"],
  ["#1D4ED8", "#60A5FA"],
  ["#9F1239", "#FB7185"],
  ["#4F46E5", "#A78BFA"],
  ["#0F766E", "#5EEAD4"],
  ["#C2410C", "#FDBA74"],
  ["#334155", "#94A3B8"],
  ["#7C3AED", "#F0ABFC"],
];
export function generatedAvatar(name, style, seed) {
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const [a, b] = AVATAR_PALETTES[(seed + name.length) % AVATAR_PALETTES.length];
  let svg = "";
  if (style === "gradient")
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='96' height='96' fill='url(#g)'/><text x='48' y='58' text-anchor='middle' font-family='Inter,Arial' font-size='34' font-weight='700' fill='white'>${ini}</text></svg>`;
  else if (style === "pattern") {
    const cells = Array.from({ length: 25 }, (_, i) => {
      const r = Math.sin(seed * 9301 + i * 49297 + name.length * 233) * 0.5 + 0.5;
      return r > 0.5;
    });
    const rects = cells
      .map((on, i) => {
        const x = i % 5,
          y = Math.floor(i / 5);
        const mx = x > 2 ? 4 - x : x;
        const onM = cells[y * 5 + mx];
        return onM
          ? `<rect x='${8 + x * 16}' y='${8 + y * 16}' width='16' height='16' fill='${b}'/>`
          : "";
      })
      .join("");
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' fill='${a}'/>${rects}</svg>`;
  } else
    svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' fill='${a}'/><circle cx='48' cy='48' r='34' fill='none' stroke='${b}' stroke-width='3' opacity='.6'/><text x='48' y='58' text-anchor='middle' font-family='Inter,Arial' font-size='32' font-weight='700' fill='white'>${ini}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
export function resolveAvatar(name, prefs) {
  if (prefs.avatarStyle === "photo") return prefs.avatar;
  if (prefs.avatarStyle === "initials") return null;
  return generatedAvatar(name, prefs.avatarStyle, prefs.avatarSeed);
}
