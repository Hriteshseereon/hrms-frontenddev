# Mobile and responsive design

Seereon HRMS is one codebase for desktop browsers, tablets and phones, and is built to be wrapped as a mobile
app (Capacitor, a React Native WebView or an iframe host) without a separate mobile UI. This document covers the
rules every screen follows, how to package the app for mobile, and how layout quality is checked.

## Breakpoints

Tailwind 4 defaults, mobile-first (unprefixed classes are the phone layout):

| Prefix | Min width | Typical device                     | What changes                                                                                          |
| ------ | --------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| —      | 0         | Phones (360–430 px)                | Sidebar is an off-canvas drawer, single-column forms, stacked page headers, icon-only top-bar actions |
| `sm:`  | 640 px    | Large phones / small tablets       | Form fields return to their natural width, two-column grids                                           |
| `md:`  | 768 px    | Tablets (portrait)                 | Page padding 24 px, `useIsMobile()` flips to `false`                                                  |
| `lg:`  | 1024 px   | Tablets (landscape), small laptops | Sidebar is docked (260 px, or 76 px collapsed); drawer and overlay are hidden                         |
| `xl:`  | 1280 px   | Laptops / desktops                 | Full global search box, user name and role in the top bar, "Quick Action" label                       |

Screens are verified at **360, 390, 768, 1024, 1280 and 1440 px**.

## Layout rules (apply to every new screen)

1. **No sideways page scroll, ever.** `html`/`body` clip horizontal overflow and `main.app-main` is
   `min-w-0 max-w-full`. Clipping is a safety net, not a fix: the audit also reports any element that extends past
   the viewport, so content must actually fit.
2. **Page headers** — title block and actions in `flex flex-col gap-3 sm:flex-row sm:items-center
sm:justify-between`. A row with two or more actions (buttons, links, menus, dialog triggers) must be
   `flex flex-wrap gap-2` so buttons wrap instead of overflowing.
3. **Form fields** — fixed widths only from `sm:` up: `w-full sm:w-[300px]`. A field wrapper inside a flex row gets
   `w-full min-w-0 sm:w-auto`. Selects truncate their value (`[&>span]:truncate`), never push the chevron out.
4. **Tables** — always inside a card that scrolls horizontally (`overflow-x-auto` on the wrapper); on phones header
   cells don't wrap and data cells keep a readable `min-width` (7.5 rem) so columns don't collapse into one letter per
   line. IDs, amounts (`font-mono`, `tabular-nums`) and badges never wrap.
5. **Badges and ID links** stay on one line (`whitespace-nowrap shrink-0`), and never shrink their parent's text to
   zero width — put the text in a `min-w-0` span and let it truncate or wrap.
6. **Tabs** — `TabsList` scrolls horizontally with a hidden scrollbar on phones; triggers are `shrink-0`, so labels
   are never squeezed or clipped. Use `flex-wrap` on the list only when every tab must stay visible.
7. **Dialogs** — the shared `Dialog`/`AlertDialog` are `w-[calc(100%-1.5rem)]` and
   `max-h-[calc(100dvh-1.5rem)]` with internal scroll, left-aligned titles (clear of the close button) and a footer
   whose buttons wrap. Tables inside a dialog scroll within the dialog.
8. **Button labels** — never set a fixed width on a button with a text label; use `gap-2` between icon and label and
   `shrink-0` on the icon. Long labels either wrap in a full-width button or collapse to icon + `sr-only` label
   below a breakpoint (`<span className="hidden sm:inline">`).
9. **Touch targets** — interactive elements are at least 36 px (40–44 px preferred for primary actions);
   `touch-action: manipulation` removes the double-tap-zoom delay.
10. **Inputs are 16 px on phones** (`text-base md:text-sm`) so iOS Safari/WKWebView doesn't zoom on focus.
11. **Heights** use `dvh`, not `vh`, so layouts don't jump when mobile browser bars show or hide.
12. **Amounts and dates never break** — write `₹\u00A0{amount}` (or `₹&nbsp;` in JSX text) and wrap a date shown in
    running text in `<span className="whitespace-nowrap">`.

### Checklist for a new screen

- [ ] Opens at 360 px without a horizontal scrollbar and without anything cut at the right edge
- [ ] Every button label fits on its button at 360 px and 1440 px
- [ ] Header actions wrap; filters stack to full width on phones
- [ ] Tables scroll inside their card; badges and amounts stay on one line
- [ ] Every tab and every dialog checked at 360 px (dialog scrolls, footer buttons reachable)
- [ ] `node tests/responsive-audit.mjs --only=/your/route` is clean

## Shells and navigation on mobile

- `OrgShell`, `EmployeeShell`, `PlatformShell` and `HelpdeskShell` (in `src/components/layout`) own the page frame.
  Below `lg` the sidebar becomes a drawer opened from the menu button in the top bar, with a dimmed overlay; route
  changes close it.
- Top bars are `h-[calc(4rem+env(safe-area-inset-top))]` with `pt-safe`, so they sit below a notch or the status
  bar in a full-screen WebView. The sidebar drawer uses `pb-safe` for the home indicator.
- The global search collapses to an icon below `xl`; user name/role hide below `xl`; icons are `shrink-0`.
- The AI assistant panel goes full-width on phones and respects the bottom safe area.

## Packaging as a mobile app

The web app is the mobile app; the wrapper only hosts it.

**Required settings (already in place)**

- `viewport`: `width=device-width, initial-scale=1, viewport-fit=cover` (see `src/app/layout.jsx`).
- Safe-area utilities: `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe` (defined in `src/app/globals.css`).
- Fonts are self-hosted (`@fontsource-variable/*`), so the app renders the same offline or behind a firewall.
- `public/manifest.webmanifest` gives name, icons and theme colour for "Add to Home Screen" / PWA installs.

**Iframe host.** The server sends `Content-Security-Policy: frame-ancestors <FRAME_ANCESTORS>`. Set
`FRAME_ANCESTORS` to the origins allowed to embed the app, e.g. `'self' https://app.seereon.co.in capacitor://localhost`.
Leave it at `'self'` if no other origin should frame the app (clickjacking protection).

**Capacitor (recommended for store apps).** Point `server.url` at the deployed HRMS URL (or ship the standalone
build behind a local server), keep `android:windowSoftInputMode="adjustResize"` so the keyboard doesn't cover
inputs, and let the status bar overlay the WebView (`StatusBar.setOverlaysWebView({ overlay: true })`) — the
safe-area padding handles the rest.

**React Native WebView.** Use `contentInsetAdjustmentBehavior="never"` on iOS so the safe-area CSS takes effect, and
enable `sharedCookiesEnabled` if the backend issues cookies. File inputs (documents, photos) work in both wrappers;
downloads (payslips, reports) need the wrapper's download handler.

**Authentication in a wrapper.** The API client sends a Bearer token and refreshes it (see
`docs/API_INTEGRATION.md`). Keep the refresh token in an httpOnly cookie on the API domain, or hand it to the
wrapper's secure storage if the app is shipped from a different origin than the API.

## How layout quality is checked

`tests/responsive-audit.mjs` discovers every route from `src/app`, opens it as a demo user of the role that owns it at all six widths,
clicks through every tab, and at 360 px opens every dialog trigger. On each state it reports:

| Check          | Meaning                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pageOverflow` | The document is wider than the viewport (sideways scroll)                                                                          |
| `escaping`     | An element extends past the viewport edge (would be cut off by the clip)                                                           |
| `cutOff`       | Content clipped by an `overflow: hidden` parent it doesn't fit in, or text spilling past the border of its card                    |
| `clippedText`  | A button/badge/tab label that overflows its own box or is squeezed to wrap letter by letter                                        |
| `smallTargets` | Icon-only buttons smaller than 32 × 32 px on phones and tablets (checkboxes inside a label row are exempt — the row is the target) |

```bash
npm run build && npm start &
node tests/responsive-audit.mjs                            # all routes × 6 widths, dialogs at 360 and 1280
node tests/responsive-audit.mjs --only=/org/payroll --vp=360,390
node tests/responsive-audit.mjs --dialogs=360 --workers=6  # faster full run
```

Results go to `test-results/responsive-audit.json` (and a `.jsonl` written as it runs).

### Results of the v6.0 conversion

96 routes × 6 widths = 576 screen states, plus every tab, and every dialog opened at 360 px.

| Check                                                                | First run on the converted code (before responsive work) | v6.0 release                                                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sideways page scroll (`pageOverflow`)                                | 0 pages — hidden by the body clip, but see next row      | **0**                                                                                                                                                                    |
| Elements running off the screen (`escaping`)                         | 132                                                      | **0**                                                                                                                                                                    |
| Content cut off by its container / spilling out of a card (`cutOff`) | 27                                                       | **0**                                                                                                                                                                    |
| Button, badge or tab labels overflowing or squeezed (`clippedText`)  | 1,199                                                    | **0 overflowing**; 36 notes, all multi-line list/card buttons (title + description) or full-width buttons whose label wraps by design in a narrow side column at 1024 px |
| Icon buttons smaller than 32 px on phones (`smallTargets`)           | 62                                                       | **0**                                                                                                                                                                    |

The first run pre-dates two checks that were added later (text spilling out of a card, and labelled checkboxes),
so the "before" column slightly under-counts.

**What fixed most of it** — shared components and global rules rather than per-screen patches:

- Dialogs, tabs, selects, popovers and menus in `src/components/ui` fit the screen (see rules 6 and 7).
- `Badge` never grows past its container; long plain-text labels end in an ellipsis.
- A full-width `Button` (`w-full`) sizes to its content, so a long label wraps inside the button.
- Rupee amounts use a no-break space (`₹\u00A0`) and dates rendered in text or table cells are wrapped in
  `whitespace-nowrap`, so `₹ 53,46,048` and `2026-07-07` never break across lines.
- Responsive grids start from `grid-cols-1` (`minmax(0, 1fr)`), so one long word can't widen a phone layout.
- IDs, amounts and badges inside table cells stay on one line at every width; the table scrolls in its card.
- `overflow-wrap: break-word` on the body lets long URLs and e-mail addresses break inside their box.
- Grids of 4–6 tiles only go to full column count where the tiles still fit (`xl:` / `2xl:`), or use
  `grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]`.
