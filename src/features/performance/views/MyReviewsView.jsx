import { useMemo, useState } from "react";
import { Target, Plus, ShieldCheck, Eye, Pencil, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { EMPLOYEES } from "@/features/employees/data/employee-directory";
import {
  useManagerMap,
  directReports,
  teamReviewStore,
  substituteStore,
} from "@/features/organization/data/manager-data";
import { TeamReviewForms } from "@/features/performance/components/TeamReviewForms";
import { REVIEW_CYCLE_ROWS } from "@/features/performance/data/performance-data";
import { TeamReviewForm, TeamReviewDetail } from "@/features/performance/components/TeamReviewForm";
import { AppraisalApprovals } from "@/features/performance/components/SelfAppraisal";

function EmpReviews() {
  const me = useCurrentEmployee();
  const map = useManagerMap();
  const reviews = teamReviewStore.use();
  const substitutes = substituteStore.use();

  const reports = useMemo(() => directReports(map, me.id), [map, me.id]);
  const delegated = substitutes.filter((s) => s.substituteId === me.id && s.status === "Active");
  const delegatedManagerIds = delegated.map((s) => s.managerId);
  const teamIds = useMemo(() => {
    const ids = new Set(reports.map((r) => r.id));
    delegatedManagerIds.forEach((mid) => directReports(map, mid).forEach((r) => ids.add(r.id)));
    return ids;
  }, [reports, delegatedManagerIds, map]);

  const isManager = teamIds.size > 0;
  const teamReviews = reviews.filter((r) => teamIds.has(r.empId));

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const team = EMPLOYEES.filter((e) => teamIds.has(e.id)).map((e) => ({ id: e.id, name: e.name }));

  if (!isManager) {
    return (
      <Card className="shadow-card">
        <CardContent className="space-y-2 p-10 text-center">
          <ShieldCheck className="text-primary mx-auto h-8 w-8" />
          <div className="font-semibold">Manager access required</div>
          <p className="text-muted-foreground text-sm">
            This screen is available to employees who hold the Manager role and have direct reports
            assigned to them.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Target className="text-primary h-6 w-6" /> Team Reviews
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Run review cycles and record performance reviews for the people reporting to you.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() => {
            setEdit(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New detailed review
        </Button>
      </div>

      <AppraisalApprovals
        step="Manager"
        filter={(a) => teamIds.has(a.empId) || a.managerId === me.id}
      />
      <TeamReviewForms teamIds={[...teamIds]} />

      {delegated.length > 0 && (
        <Card className="shadow-card border-gold/40">
          <CardContent className="p-4 text-sm">
            <span className="font-semibold">Substitute access:</span> you are covering{" "}
            {delegated.map((d) => `${d.manager} (${d.scope}, until ${d.to})`).join(", ")}.
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card border-primary/30">
        <CardContent className="text-muted-foreground p-4 text-sm">
          <span className="text-foreground font-semibold">Visibility:</span> completed reviews are
          visible to HR and administrators. Private remarks stay HR-only; when you tick “share with
          employee”, the employee reads the feedback on My Appraisal and acknowledges it.
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <CardContent className="border-border border-b p-4 font-semibold">
          Active review cycles
        </CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Cycle</th>
                <th className="p-3 text-left">Frequency</th>
                <th className="p-3 text-left">Reviewed</th>
                <th className="p-3 text-left">Pending</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {REVIEW_CYCLE_ROWS.filter((c) => c.status !== "Inactive").map((c) => {
                const done = [...teamIds].filter((id) =>
                  reviews.some(
                    (r) => r.empId === id && r.cycle === c.name && r.status === "Completed",
                  ),
                ).length;
                const pending = teamIds.size - done;
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="text-muted-foreground p-3">{c.frequency}</td>
                    <td className="p-3">
                      {done} / {teamIds.size}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          pending === 0
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-gold/30 bg-gold/10 text-gold"
                        }
                      >
                        {pending} pending
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEdit(null);
                          setOpen(true);
                        }}
                      >
                        Start review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <CardContent className="border-border flex items-center gap-2 border-b p-4 font-semibold">
          <Users className="text-primary h-4 w-4" /> My team ({teamIds.size})
        </CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Designation</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Branch</th>
                <th className="p-3 text-left">Reviews</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {EMPLOYEES.filter((e) => teamIds.has(e.id)).map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">
                    {e.name}
                    <div className="text-muted-foreground text-xs font-normal">{e.id}</div>
                  </td>
                  <td className="text-muted-foreground p-3">{e.role}</td>
                  <td className="text-muted-foreground p-3">{e.dept}</td>
                  <td className="text-muted-foreground p-3">{e.branch}</td>
                  <td className="p-3">{reviews.filter((r) => r.empId === e.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <CardContent className="border-border border-b p-4 font-semibold">
          Review cycles I run
        </CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Ref</th>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Basis / cycle</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Overall</th>
                <th className="p-3 text-left">Recommendation</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {teamReviews.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 align-top">
                  <td className="text-muted-foreground p-3 font-mono text-xs">{r.id}</td>
                  <td className="p-3 font-medium">{r.employee}</td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {r.basis ?? "Performance review"}
                    <div>{r.cycle}</div>
                  </td>
                  <td className="text-muted-foreground p-3">
                    <span className="whitespace-nowrap">{r.date}</span>
                  </td>
                  <td className="p-3">
                    {r.overallScore != null ? <b>{r.overallScore}/5</b> : "—"}
                    <div className="text-muted-foreground text-xs">{r.rating}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {r.recommendation ?? "—"}
                    {r.employeeAck ? (
                      <div className="text-primary">Acknowledged {r.employeeAck.on}</div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        r.status === "Completed"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-gold/30 bg-gold/10 text-gold"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setView(r)}>
                      <Eye className="h-4 w-4" /> View
                    </Button>
                    {r.status !== "Completed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEdit(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="text-primary h-4 w-4" /> Continue
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {teamReviews.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground p-10 text-center">
                    No reviews yet for your team.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEdit(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {edit ? `Continue review ${edit.id}` : "Team member performance review"}
            </DialogTitle>
            <DialogDescription>
              Basis → goals set vs achieved → parameter ratings → feedback, suggestions, development
              plan → documents.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <TeamReviewForm
              key={edit?.id ?? "new"}
              managerId={me.id}
              manager={me.name}
              existing={edit ?? undefined}
              teamOptions={team}
              onDone={() => {
                setOpen(false);
                setEdit(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {view && (
            <TeamReviewDetail r={reviews.find((x) => x.id === view.id) ?? view} mode="manager" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmpReviews;
