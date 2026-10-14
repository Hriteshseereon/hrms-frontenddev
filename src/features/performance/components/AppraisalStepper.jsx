import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  APPRAISAL_STAGES,
  stageIndex,
  stageTone,
} from "@/features/performance/data/appraisal-workflow-data";

export function AppraisalStepper({ stage }) {
  const active = stageIndex(stage);

  return (
    <div className="border-border bg-card shadow-card rounded-xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Appraisal Workflow</div>
        <Badge variant="outline" className={stageTone(stage)}>
          {stage}
        </Badge>
      </div>
      <div className="steps-scroll flex min-w-0 items-start">
        {APPRAISAL_STAGES.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={label} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-full flex-col items-center gap-2">
                <div className="flex w-full items-center">
                  <div
                    className={cn(
                      "h-[2px] flex-1",
                      i === 0 ? "bg-transparent" : done || current ? "bg-primary" : "bg-border",
                    )}
                  />
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : current
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <div
                    className={cn(
                      "h-[2px] flex-1",
                      i === APPRAISAL_STAGES.length - 1
                        ? "bg-transparent"
                        : done
                          ? "bg-primary"
                          : "bg-border",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "text-center text-[11px] leading-tight",
                    current || done ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
