// Every screen of the app with the demo user that owns it (shared by the e2e specs).
// Routes come from src/routes/manifest.js — the same source the router renders from.
import { PAGES } from "../../src/routes/manifest.js";

const DYN = {
  "/helpdesk/tickets/:id": "/helpdesk/tickets/SRN-TKT-2026-0031",
  "/candidate/:token": "/candidate/k3m9x2p7q1w8e5r4",
};
export const USER = { org: "SRN-SUPER", emp: "SRN-0006", helpdesk: "SRN-0004" };

export const ROUTES = PAGES.map(({ path }) => {
  const portal = path.split("/")[1];
  return { route: path, url: DYN[path] ?? path, user: USER[portal] || null };
}).filter((r) => !r.url.includes(":"));

/** Sign in a demo user by id (demo mode keeps the session in localStorage). */
export async function signInAs(page, userId) {
  if (userId)
    await page.addInitScript((id) => localStorage.setItem("seereon.session.user", id), userId);
}
