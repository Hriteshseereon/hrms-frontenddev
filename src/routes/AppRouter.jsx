import { Suspense, lazy, useEffect, useMemo } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import OrgShell from "@/components/layout/OrgShell";
import EmployeeShell from "@/components/layout/EmployeeShell";
import HelpdeskShell from "@/components/layout/HelpdeskShell";
import RecruitmentLayout from "@/features/recruitment/components/RecruitmentLayout";
import NotFoundScreen from "./NotFoundScreen";
import { PAGES } from "./manifest";

import MasterAdminLogin from "@/features/master-admin/pages/MasterAdminLogin";
import MasterAdminDashboard from "@/features/master-admin/pages/MasterAdminDashboard";


const APP_NAME = "Seereon HRMS";

/** Legacy and alias URLs kept from earlier versions so bookmarks keep working. */
const REDIRECTS = {
  "/": "/login",
  "/org": "/org/dashboard",
  "/emp": "/emp/dashboard",
  "/org-login": "/login",
  "/emp-login": "/login",
  "/emp/payroll": "/emp/payslips",
  "/org/payroll": "/org/finance",
  "/emp/support": "/helpdesk",
  "/org/support": "/helpdesk",
  "/org/infrastructure": "/org/masters#infrastructure",
  "/org/recruitment/assessments": "/org/recruitment/interviews",
  "/org/recruitment/locations": "/org/masters#locations",
  "/org/recruitment/masters": "/org/masters#recmasters",
  "/org/recruitment/rounds": "/org/masters#rounds",
};

/** Sets the browser-tab title for the active screen. */
function PageTitle({ title }) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
  return null;
}

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-busy="true">
      <div className="border-primary size-7 animate-spin rounded-full border-2 border-t-transparent" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Scrolls back to the top on route change (hash links keep their anchor behaviour). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

const SHELLS = {
  org: () => (
    <OrgShell>
      <Outlet />
    </OrgShell>
  ),
  emp: () => (
    <EmployeeShell>
      <Outlet />
    </EmployeeShell>
  ),
  helpdesk: () => (
    <HelpdeskShell>
      <Outlet />
    </HelpdeskShell>
  ),
  bare: () => <Outlet />,
};

function routeFor(page) {
  const View = lazy(page.load);
  return (
    <Route
      key={page.path}
      path={page.path}
      element={
        <>
          <PageTitle title={page.title} />
          <View />
        </>
      }
    />
  );
}

export default function AppRouter() {
  const byShell = useMemo(() => {
    const groups = { org: [], emp: [], helpdesk: [], bare: [] };
    for (const p of PAGES) (groups[p.shell] ?? groups.bare).push(p);
    return groups;
  }, []);

  // /org/recruitment/* shares the recruitment sub-navigation inside the org shell.
  const recruitment = byShell.org.filter((p) => p.path.startsWith("/org/recruitment"));
  const org = byShell.org.filter((p) => !p.path.startsWith("/org/recruitment"));

  return (
    <Suspense fallback={<PageFallback />}>
      <ScrollToTop />
      <Routes>
        {Object.entries(REDIRECTS).map(([from, to]) => {
          const [pathname, hash] = to.split("#");
          return (
            <Route
              key={from}
              path={from}
              element={<Navigate to={hash ? { pathname, hash: `#${hash}` } : to} replace />}
            />
          );
        })}

        <Route element={<SHELLS.org />}>
          {org.map(routeFor)}
          <Route
            element={
              <RecruitmentLayout>
                <Outlet />
              </RecruitmentLayout>
            }
          >
            {recruitment.map(routeFor)}
          </Route>
        </Route>

                <Route element={<SHELLS.emp />}>{byShell.emp.map(routeFor)}</Route>
        <Route element={<SHELLS.helpdesk />}>{byShell.helpdesk.map(routeFor)}</Route>
        {byShell.bare.map(routeFor)}

        {/* New Master Admin routes */}
        <Route
          path="/master-admin/login"
          element={<MasterAdminLogin />}
        />

        <Route
          path="/master-admin/dashboard"
          element={<MasterAdminDashboard />}
        />

        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Suspense>
  );
}
