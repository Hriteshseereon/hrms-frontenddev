import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { initTheme, useTheme } from "@/lib/theme";
// Registers the client organisations, data namespaces and access gates before any screen renders.
import "@/features/organization/data/tenancy";
// Every source of sign-in accounts registers at boot — an account issued at runtime (a client Super Admin, an invited
// user, a new hire) used to resolve only on screens that happened to import its module, so after a reload elsewhere the
// session silently fell back to the default demo identity.
import "@/features/auth/data/tenant-users";
import "@/features/auth/data/rbac-store";
import "@/features/recruitment/data/hiring-data";

/** App-wide client providers: data-fetching cache, theme and toasts. */
export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const theme = useTheme();
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={
          theme === "dark" ? "dark bg-background text-foreground" : "bg-background text-foreground"
        }
      >
        {children}
        <Toaster position="top-right" richColors theme={theme} />
      </div>
    </QueryClientProvider>
  );
}
