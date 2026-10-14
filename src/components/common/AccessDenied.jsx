import Link from "@/lib/router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_SUMMARY } from "@/features/auth/data/auth-session";

/** Shown when a signed-in role opens a screen its permissions do not cover. */
export function AccessDenied({ role, homeTo }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="shadow-card max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="bg-destructive/10 text-destructive mx-auto grid h-12 w-12 place-items-center rounded-2xl">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Access restricted</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Your <span className="text-foreground font-semibold">{role}</span> role does not
              include this screen.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Access scope: {ROLE_SUMMARY[role].scope}
            </p>
          </div>
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
