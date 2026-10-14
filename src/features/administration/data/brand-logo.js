// Default Seereon mark as an inline SVG data URL — renders everywhere (app shell, print pop-ups, PDFs)
// without depending on a hosted asset. Replaced by whatever the Super Admin uploads in Settings → Branding.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0F6B50"/><stop offset="1" stop-color="#0B4F3C"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="22" fill="url(#g)"/>
  <path d="M62 33c-3.4-4.6-9-6.6-15-6.6-9.6 0-16.6 5.2-16.6 12.6 0 6.8 4.8 10.4 15 12.8l4.4 1c6.4 1.5 8.4 3.2 8.4 6.2 0 3.6-3.6 5.9-9.2 5.9-6 0-10.4-2.4-13.6-6.7" fill="none" stroke="#C8A951" stroke-width="7" stroke-linecap="round"/>
  <circle cx="70" cy="26" r="5" fill="#C8A951"/>
</svg>`;

export const SEEREON_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
