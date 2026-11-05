import Link from "@/lib/router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_SUMMARY } from "@/features/auth/data/auth-session";

const REASONS = {
  module: {
    title: "Module not available",
    text: "This module is not available for your company.",
  },
  permission: {
    title: "No access",
    text: "You do not have permission to open this. Ask your administrator if you need it.",
  },
};

/**
 * Shown when a signed-in role opens a screen its permissions do not cover.
 * `reason` ("module" | "permission") comes from a 403 answer of the backend.
 */
export function AccessDenied({ role, homeTo, reason, info }) {
  const why = REASONS[reason];
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="shadow-card max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="bg-destructive/10 text-destructive mx-auto grid h-12 w-12 place-items-center rounded-2xl">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{why?.title ?? "Access restricted"}</h1>
            {why ? (
              <p className="text-muted-foreground mt-1.5 text-sm">{why.text}</p>
            ) : (
              <>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Your <span className="text-foreground font-semibold">{role}</span> role does not
                  include this screen.
                </p>
                {ROLE_SUMMARY[role] && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Access scope: {ROLE_SUMMARY[role].scope}
                  </p>
                )}
              </>
            )}
          </div>
          {info && (
            <p className="text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-left font-mono text-[11px] break-all">
              Denied by the server: {info}
            </p>
          )}
          <div className="flex justify-center gap-2">
            <Button asChild className="bg-gradient-emerald shadow-premium text-white">
              <Link href={homeTo}>Go to my dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
