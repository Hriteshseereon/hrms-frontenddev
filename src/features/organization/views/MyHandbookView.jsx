import { useState } from "react";
import { BookOpen, CheckCircle2, Download, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useDocTemplates, renderTemplate } from "@/features/organization/data/doc-master";
import { acknowledgeHandbook, useHandbook } from "@/features/organization/data/handbook-data";

function Page() {
  const me = useCurrentUser();
  const { versions, acks } = useHandbook();
  const current = versions[0];
  const mine = current
    ? acks.find((a) => a.empId === me.id && a.version === current.version)
    : null;
  const [sig, setSig] = useState("");
  const [read, setRead] = useState(false);
  // Reactive read (templatesOf() read the store during render: server and client disagreed once the template was edited).
  const handbookTemplates = useDocTemplates().filter(
    (t) => t.docType === "Employee Handbook" && t.active,
  );
  const template =
    handbookTemplates.find((t) => t.id === current?.templateId) ?? handbookTemplates[0];
  const due = current
    ? new Date(new Date(current.publishedOn).getTime() + current.ackDueDays * 86400000)
        .toISOString()
        .slice(0, 10)
    : "";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BookOpen className="text-primary h-6 w-6" /> Employee Handbook
        </h1>
        <p className="text-muted-foreground text-sm">
          Policies you agreed to at joining. Each new version must be read and acknowledged.
        </p>
      </div>
      {!current ? (
        <Card className="shadow-card">
          <CardContent className="text-muted-foreground p-10 text-center">
            No handbook has been published yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-semibold">Employee Handbook v{current.version}</div>
                <Badge variant="outline">Published {current.publishedOn}</Badge>
                {mine ? (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Acknowledged {mine.acknowledgedOn}
                  </Badge>
                ) : (
                  current.requireAck && (
                    <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold">
                      Acknowledgement due by {due}
                    </Badge>
                  )
                )}
              </div>
              <p className="text-muted-foreground text-sm">{current.summary}</p>
              {current.changeNotes && (
                <p className="text-xs">
                  <b>What changed:</b> {current.changeNotes}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-auto min-h-9 max-w-full text-left whitespace-normal"
                  onClick={() => {
                    if (template && current.source === "Doc Master template")
                      renderTemplate(template, {
                        version: current.version,
                        date: current.publishedOn,
                        entity: "Seereon Consulting & IT Services Pvt. Ltd.",
                      });
                    else toast.success(`Opening ${current.fileName}`);
                    setRead(true);
                  }}
                >
                  <Download className="h-4 w-4" /> Open / download ({current.fileName})
                </Button>
              </div>
              {template && template.sections && template.sections.length > 0 && (
                <div className="border-border divide-border divide-y rounded-xl border">
                  {template.sections.map((sec, i) => (
                    <details
                      key={i}
                      className="p-3"
                      open={i === 0}
                      onToggle={(e) => {
                        if (i > 0 && e.currentTarget.open) setRead(true);
                      }}
                    >
                      <summary className="cursor-pointer text-sm font-medium">
                        {i + 1}. {sec.heading}
                      </summary>
                      <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                        {sec.body}
                      </p>
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {!mine && current.requireAck && (
            <Card className="shadow-card border-primary/30">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <FileSignature className="text-primary h-4 w-4" /> Acknowledge
                </div>
                <p className="text-muted-foreground text-sm">
                  I confirm that I have read and understood the Employee Handbook v{current.version}{" "}
                  and agree to abide by its policies.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[240px] flex-1 space-y-1">
                    <Label className="text-xs">Type your full name to e-sign</Label>
                    <Input
                      value={sig}
                      onChange={(e) => setSig(e.target.value)}
                      placeholder={me.name}
                    />
                  </div>
                  <Button
                    className="bg-gradient-emerald text-white"
                    disabled={!sig.trim() || !read}
                    onClick={() => {
                      const r = acknowledgeHandbook(me.id, me.name, current.version, sig);
                      toast[r.ok ? "success" : "error"](r.message);
                    }}
                  >
                    Acknowledge handbook
                  </Button>
                </div>
                {!read && (
                  <div className="text-muted-foreground text-xs">
                    Open the handbook (or expand its sections) before acknowledging.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {versions.length > 1 && (
            <div className="text-muted-foreground text-xs">
              Previous versions:{" "}
              {versions
                .slice(1)
                .map(
                  (v) =>
                    `v${v.version} (${v.publishedOn}${acks.some((a) => a.empId === me.id && a.version === v.version) ? ", acknowledged" : ""})`,
                )
                .join(" · ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Page;
