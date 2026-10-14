import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  reviewTone,
  useEvalParams,
  useReviews,
  weightedRating,
} from "@/features/performance/data/performance-config";
import {
  LaunchReviewDialog,
  ReviewFormEditor,
} from "@/features/performance/components/ReviewForms";

/** Manager view of the detailed review forms for direct reports: rate goals & parameters after self-appraisal. */
export function TeamReviewForms({ teamIds }) {
  const rows = useReviews().filter((r) => teamIds.includes(r.empId));
  const params = useEvalParams();
  const [open, setOpen] = useState(null);
  const [launch, setLaunch] = useState(false);
  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">
          Detailed review forms — quarterly goals &amp; annual appraisal
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setLaunch(true)}>
          Launch for a report
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              {["Employee", "Kind", "Cycle", "Status", "Self", "Your rating", ""].map((h) => (
                <th key={h} className="p-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground p-6 text-center">
                  No forms for your team yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{r.employee}</td>
                <td className="p-3">{r.kind}</td>
                <td className="p-3">{r.cycle}</td>
                <td className="p-3">
                  <Badge variant="outline" className={reviewTone(r.status)}>
                    {r.status}
                  </Badge>
                </td>
                <td className="p-3">{weightedRating(r.ratings, params, "self") ?? "—"}</td>
                <td className="p-3">{weightedRating(r.ratings, params, "manager") ?? "—"}</td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant={r.status === "Self submitted" ? "default" : "ghost"}
                    className={
                      r.status === "Self submitted" ? "bg-gradient-emerald h-7 text-white" : "h-7"
                    }
                    onClick={() => setOpen(r)}
                  >
                    {r.status === "Self submitted" ? "Rate now" : "Open"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
      <LaunchReviewDialog open={launch} onClose={() => setLaunch(false)} employeeIds={teamIds} />
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {open?.employee} · {open?.kind}
            </DialogTitle>
            <DialogDescription>{open?.cycle} · manager view</DialogDescription>
          </DialogHeader>
          {open && <ReviewFormEditor key={open.id} review={open} who="manager" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
