import { useMemo, useState } from "react";
import { Flag, Plus, Users, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useManagerMap, directReports } from "@/features/organization/data/manager-data";
import { goalTone, useGoals } from "@/features/performance/data/goals-data";
import { findEmployee } from "@/features/employees/data/employee-directory";
import { GoalForm, GoalDetail } from "@/features/performance/components/GoalPieces";

function GoalCard({ g, onOpen, showOwner }) {
  const done = g.milestones.filter((m) => m.done).length;
  return (
    <Card
      className="shadow-card hover:border-primary/30 cursor-pointer transition"
      onClick={onOpen}
    >
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{g.level}</Badge>
          <Badge variant="outline" className={goalTone(g.status)}>
            {g.status}
          </Badge>
          {g.priority && <Badge variant="outline">{g.priority}</Badge>}
          <span className="text-muted-foreground ml-auto text-xs">{g.id}</span>
        </div>
        <div>
          <h2 className="font-semibold">{g.title}</h2>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{g.description}</p>
        </div>
        <div className="text-muted-foreground text-xs">
          {showOwner ? `${g.owner} · ` : ""}
          {g.quarter ?? `${g.start} → ${g.due}`} · target {g.target} · weight {g.weight}%
        </div>
        <div className="text-muted-foreground text-xs">
          {g.category ?? "—"}
          {(g.metrics?.length ?? 0) > 0 ? ` · ${g.metrics.length} metric(s)` : ""}
          {g.milestones.length ? ` · ${done}/${g.milestones.length} milestones` : ""} · assigned by{" "}
          {g.createdBy}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{g.progress}%</span>
          </div>
          <Progress value={g.progress} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {g.managerRating
              ? `Manager ${g.managerRating}/5 · ${g.rating}`
              : g.selfRating
                ? `Self ${g.selfRating}/5`
                : "Not rated yet"}
          </span>
          <span className="text-primary inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> Open
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmpGoals() {
  const me = useCurrentEmployee();
  const user = useCurrentUser();
  const map = useManagerMap();
  const all = useGoals();
  const myOrg = findEmployee(me.id)?.orgId ?? user.orgId;
  // Organisation-wide goals of *my* entity only (every entity's organisational goals were listed).
  const goals = all.filter(
    (g) =>
      g.ownerId === me.id ||
      (g.level === "Organizational" && (findEmployee(g.ownerId)?.orgId ?? myOrg) === myOrg),
  );
  const reports = useMemo(() => directReports(map, me.id), [map, me.id]);
  const teamIds = useMemo(() => new Set(reports.map((r) => r.id)), [reports]);
  const teamGoals = all.filter((g) => teamIds.has(g.ownerId));
  const isPeopleOffice = ["HR", "CHRO", "Admin", "SuperAdmin"].includes(user.role);
  // A Manager / HOD with nobody reporting to them had an unrestricted picker (could assign goals to anyone in the entity).
  const canAssign = teamIds.size > 0 || isPeopleOffice;
  const [open, setOpen] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const detail = all.find((g) => g.id === detailId) ?? null;
  const pendingTeam = teamGoals.filter((g) => g.status === "Pending Approval").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Flag className="text-primary h-6 w-6" /> My Goals
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your goals plus organisation-wide goals. Open a goal to update progress and metrics,
            tick milestones, attach evidence and rate yourself.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {canAssign && (
            <Button size="sm" variant="outline" onClick={() => setOpen("assign")}>
              <Users className="h-4 w-4" /> Assign goal to team member
            </Button>
          )}
          <Button
            size="sm"
            className="bg-gradient-emerald shadow-premium text-white"
            onClick={() => setOpen("self")}
          >
            <Plus className="h-4 w-4" /> Create my goal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {goals.map((g) => (
          <GoalCard key={g.id} g={g} onOpen={() => setDetailId(g.id)} />
        ))}
        {goals.length === 0 && (
          <Card className="shadow-card lg:col-span-2">
            <CardContent className="text-muted-foreground p-10 text-center">
              You have no goals yet. Create one and it will be sent to your manager for approval.
            </CardContent>
          </Card>
        )}
      </div>

      {teamIds.size > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="text-primary h-5 w-5" /> My team's goals
            </h2>
            {pendingTeam > 0 && (
              <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold">
                {pendingTeam} awaiting your approval
              </Badge>
            )}
            <span className="text-muted-foreground ml-auto text-xs">
              {reports.length} direct report(s) · {teamGoals.length} goal(s)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {teamGoals.map((g) => (
              <GoalCard key={g.id} g={g} showOwner onOpen={() => setDetailId(g.id)} />
            ))}
            {teamGoals.length === 0 && (
              <Card className="shadow-card lg:col-span-2">
                <CardContent className="text-muted-foreground p-8 text-center text-sm">
                  No goals for your team yet — assign one.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {open === "assign" ? "Assign a goal to a team member" : "Create my goal"}
            </DialogTitle>
            <DialogDescription>
              {open === "assign"
                ? "Same detailed form HR uses — the goal is active immediately and the owner is notified."
                : "Goal, quarter and date range, metrics and evaluation parameters, milestones, links and documents. Sent to your reporting manager for approval."}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <GoalForm
              mode={open}
              restrictTo={open === "assign" && !isPeopleOffice ? [...teamIds] : undefined}
              onDone={() => setOpen(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {detail && (
            <GoalDetail
              goal={detail}
              mode={teamIds.has(detail.ownerId) && detail.ownerId !== me.id ? "manage" : "self"}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmpGoals;
