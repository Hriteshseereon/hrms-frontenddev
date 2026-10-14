import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PIPELINE_STAGES } from "@/features/recruitment/data/recruitment-data";
import {
  moveCandidate,
  useCandidates,
  useHires,
} from "@/features/recruitment/data/recruitment-store";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

export function PipelineWorkspace() {
  const candidates = useCandidates();
  const hires = useHires();
  const [detail, setDetail] = useState(null);

  function move(id, dir) {
    const current = candidates.find((c) => c.id === id);
    if (!current) return;
    const idx = PIPELINE_STAGES.indexOf(current.stage);
    const next = PIPELINE_STAGES[idx + dir];
    if (!next) return;
    // Only Applied ⇄ Shortlisted is a manual move; later stages come from interviews, offers and the welcome e-mail.
    const r = moveCandidate(id, next);
    toast[r.ok ? "success" : "info"](r.message);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pipeline board</h2>
        <p className="text-muted-foreground text-sm">
          Shortlist or un-shortlist from here. Later stages follow the flow: interview feedback
          finalises a candidate, the offer composer moves them to{" "}
          <span className="text-foreground font-medium">Offered</span>, and the welcome e-mail from
          Step 4 · Offers creates the employee record and moves them to{" "}
          <span className="text-foreground font-medium">Onboarding</span>.
        </p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const items = candidates.filter((c) => c.stage === stage);
            return (
              <div
                key={stage}
                className="border-border bg-muted/30 w-[260px] shrink-0 rounded-xl border p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">{stage}</div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((c) => (
                    <Card key={c.id} className="shadow-card">
                      <CardContent className="space-y-2 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="text-muted-foreground truncate text-xs">
                            {c.position || c.jobType}
                          </div>
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {c.source} · {c.experience || "—"}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            disabled={stage !== "Shortlisted"}
                            title={
                              stage === "Shortlisted"
                                ? "Move back to Applied"
                                : "Only shortlisting can be undone here"
                            }
                            onClick={() => move(c.id, -1)}
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-gradient-emerald h-7 flex-1 px-2 text-white"
                            disabled={stage === "Onboarding"}
                            onClick={() => move(c.id, 1)}
                          >
                            {stage === "Applied" ? "Shortlist" : "Next step"}{" "}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="text-muted-foreground py-6 text-center text-xs">
                      No candidates
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Converted to Employees</div>
              <div className="text-muted-foreground text-xs">
                Candidates that reached the onboarding stage.
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Employee ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Position</th>
                  <th className="p-3 text-left">From Candidate</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {hires.map((h) => (
                  <tr key={h.joinedFrom} className={clickableRow} onClick={() => setDetail(h)}>
                    <td className="text-muted-foreground p-3 font-mono text-xs">{h.empId}</td>
                    <td className="p-3 font-medium">{h.name}</td>
                    <td className="text-muted-foreground p-3">{h.position || "—"}</td>
                    <td className="text-muted-foreground p-3 font-mono text-xs">{h.joinedFrom}</td>
                  </tr>
                ))}
                {hires.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground p-10 text-center text-sm">
                      No candidates onboarded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {detail &&
        (() => {
          const c = candidates.find((x) => x.id === detail.joinedFrom);
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={`${detail.empId} · ${detail.name}`}
              subtitle={`${detail.position || "—"} · converted from candidate ${detail.joinedFrom}`}
              badges={
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  Onboarding
                </Badge>
              }
              record={{
                empId: detail.empId,
                name: detail.name,
                position: detail.position || "—",
                joinedFrom: detail.joinedFrom,
                email: c?.email ?? "—",
                phone: c?.phone ?? "—",
                source: c?.source ?? "—",
                jobType: c?.jobType ?? "—",
                currentCompany: c?.currentCompany ?? "—",
                experience: c?.experience ?? "—",
                currentCtc: c?.currentCtc ?? "—",
                expectedCtc: c?.expectedCtc ?? "—",
                skills: c?.skills ?? "—",
                education: c?.education ?? "—",
              }}
              labels={{
                empId: "Employee ID",
                joinedFrom: "Candidate ID",
                jobType: "Job type",
                currentCtc: "Current CTC",
                expectedCtc: "Expected CTC",
              }}
              sections={[
                { title: "Employee", keys: ["empId", "name", "position", "joinedFrom"] },
                { title: "Contact & source", keys: ["email", "phone", "source", "jobType"] },
                {
                  title: "Candidate profile",
                  keys: [
                    "currentCompany",
                    "experience",
                    "currentCtc",
                    "expectedCtc",
                    "skills",
                    "education",
                  ],
                },
              ]}
            />
          );
        })()}
    </div>
  );
}
