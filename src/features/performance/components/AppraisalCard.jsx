// One combined appraisal record view, used on both the employee's own screen
// and the HOD/HR approval screens. Everyone sees the same stepper and the
// same three stage panels — only the panel matching the current stage (and
// the viewer's role) gets edit controls.
import { useState } from "react";
import { Undo2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoals } from "@/features/performance/data/goals-data";
import { AppraisalStepper } from "@/features/performance/components/AppraisalStepper";
import {
  APPRAISAL_RATINGS,
  submitSelfAppraisal,
  submitHodAppraisal,
  submitHrAppraisal,
  sendBackToSelf,
} from "@/features/performance/data/appraisal-workflow-data";

function StagePanel({ title, record, editable, onSubmit, submitLabel = "Submit" }) {
  const [rating, setRating] = useState(record.rating);
  const [comments, setComments] = useState(record.comments);
  const submitted = Boolean(record.submittedOn);

  if (submitted && !editable) {
    return (
      <div className="border-border rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {record.rating}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{record.comments}</p>
        <div className="text-muted-foreground mt-2 text-xs">
          {record.submittedByName} · <span className="whitespace-nowrap">{record.submittedOn}</span>
        </div>
      </div>
    );
  }

  if (!editable) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {title} — awaiting this stage.
      </div>
    );
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Rating</Label>
        <Select value={rating} onValueChange={setRating}>
          <SelectTrigger>
            <SelectValue placeholder="Select rating" />
          </SelectTrigger>
          <SelectContent>
            {APPRAISAL_RATINGS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Comments</Label>
        <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>
      <Button
        size="sm"
        className="bg-gradient-emerald text-white"
        disabled={!rating || !comments.trim()}
        onClick={() => onSubmit?.(rating, comments.trim())}
      >
        <Send className="h-3.5 w-3.5" /> {submitLabel}
      </Button>
    </div>
  );
}

export function AppraisalCard({ record, viewerId, viewerRole }) {
  const goals = useGoals().filter((g) => g.ownerId === record.employeeId);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackNote, setSendBackNote] = useState("");

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{record.employeeName}</div>
            <div className="text-muted-foreground text-xs">
              {record.id} · {record.cycle} · HOD: {record.hodName}
            </div>
          </div>
        </div>

        <AppraisalStepper stage={record.stage} />

        {record.sentBackNote && record.stage === "Self Appraisal" && (
          <div className="border-gold/30 bg-gold/10 text-gold rounded-lg border px-3 py-2 text-xs">
            Sent back by HOD: {record.sentBackNote}
          </div>
        )}

        {goals.length > 0 && (
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Goals this cycle
            </div>
            <div className="space-y-1.5">
              {goals.map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <span>{g.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {g.progress}% · {g.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StagePanel
            key={`self-${record.stage}`}
            title="Self Appraisal"
            record={record.self}
            editable={viewerRole === "Self" && record.stage === "Self Appraisal"}
            submitLabel="Submit self appraisal"
            onSubmit={(rating, comments) => {
              if (submitSelfAppraisal(record.id, viewerId, rating, comments))
                toast.success("Self appraisal submitted — routed to your HOD");
              else toast.error("This appraisal is no longer at the self-appraisal stage.");
            }}
          />

          <StagePanel
            title="HOD Appraisal"
            record={record.hod}
            editable={viewerRole === "HOD" && record.stage === "HOD Appraisal"}
            submitLabel="Submit HOD appraisal"
            onSubmit={(rating, comments) => {
              if (submitHodAppraisal(record.id, viewerId, rating, comments))
                toast.success("HOD appraisal submitted — routed to HR");
              else
                toast.error(
                  "Cannot submit — the record has moved on, or it is your own appraisal.",
                );
            }}
          />

          <StagePanel
            title="HR Appraisal"
            record={record.hr}
            editable={viewerRole === "HR" && record.stage === "HR Appraisal"}
            submitLabel="Finalize appraisal"
            onSubmit={(rating, comments) => {
              if (submitHrAppraisal(record.id, viewerId, rating, comments))
                toast.success("Appraisal completed");
              else
                toast.error(
                  "Cannot finalise — the record has moved on, or it is your own appraisal.",
                );
            }}
          />
        </div>

        {viewerRole === "HOD" && record.stage === "HOD Appraisal" && (
          <div>
            {!sendBackOpen ? (
              <Button size="sm" variant="outline" onClick={() => setSendBackOpen(true)}>
                <Undo2 className="h-3.5 w-3.5" /> Send back to employee
              </Button>
            ) : (
              <div className="border-border space-y-2 rounded-lg border p-3">
                <Label className="text-muted-foreground text-xs">Reason for sending back</Label>
                <Textarea
                  rows={2}
                  value={sendBackNote}
                  onChange={(e) => setSendBackNote(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSendBackOpen(false);
                      setSendBackNote("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-emerald text-white"
                    disabled={!sendBackNote.trim()}
                    onClick={() => {
                      if (sendBackToSelf(record.id, viewerId, sendBackNote.trim()))
                        toast.success("Sent back to employee for revision");
                      else toast.error("The record is no longer at the HOD stage.");
                      setSendBackOpen(false);
                      setSendBackNote("");
                    }}
                  >
                    Send back
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {record.stage === "Completed" && (
          <div className="text-primary flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Appraisal cycle complete.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
