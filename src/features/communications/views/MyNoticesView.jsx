import { useState } from "react";
import { Megaphone, Paperclip, CalendarRange, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_TONE,
  announcementsForEmployee,
  useAnnouncements,
} from "@/features/communications/data/announcement-data";
import { acknowledge, hasAcknowledged, useAcks } from "@/features/communications/data/ack-data";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import { exportLetterPdf } from "@/lib/export-utils";

const esc = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function EmpNotices() {
  const me = useCurrentEmployee();
  const [filter, setFilter] = useState("all");
  // Shared with the Org Admin Announcements module — only the employee's own company's notices (tenant scope).
  const all = announcementsForEmployee(useAnnouncements(), me);
  const acks = useAcks();
  const rows = all.filter((a) => filter === "all" || a.type === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Megaphone className="text-primary h-6 w-6" /> Notices &amp; Circulars
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Announcements, notices, events and circulars published for your organization. Acknowledge
          the ones that need it.
        </p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <ScrollTabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {ANNOUNCEMENT_TYPES.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}s
            </TabsTrigger>
          ))}
        </ScrollTabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((a) => {
          const done = hasAcknowledged(a.id, me.id, acks);
          const at = acks.find(
            (x) => x.announcementId === a.id && x.empId === me.id,
          )?.acknowledgedAt;
          return (
            <Card key={a.id} className="shadow-card">
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={ANNOUNCEMENT_TONE[a.type]}>
                    {a.type}
                  </Badge>
                  {done && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Acknowledged
                    </Badge>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs">{a.id}</span>
                </div>
                <h2 className="font-semibold break-words">{a.subject}</h2>
                <p className="text-muted-foreground text-sm">{a.description}</p>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <span className="flex items-center gap-1">
                    <CalendarRange className="h-3.5 w-3.5" /> {a.from} → {a.to}
                  </span>
                  {a.document && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-3.5 w-3.5" /> {a.document}
                    </span>
                  )}
                </div>
                {done && <p className="text-muted-foreground text-xs">Acknowledged on {at}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      // Render the notice as a printable document (previously the button only toasted "downloaded").
                      const ok = exportLetterPdf({
                        title: `${a.type} — ${a.subject}`,
                        reference: a.id,
                        bodyHtml: `<p>${esc(a.description)}</p><p>Valid ${esc(a.from)} → ${esc(a.to)}${a.document ? ` · Attachment: ${esc(a.document)}` : ""}</p>`,
                        signatory: { name: "Human Resources", designation: "People Operations" },
                      });
                      toast[ok ? "success" : "error"](
                        ok
                          ? `${a.document || a.subject} ready — save as PDF`
                          : "Allow pop-ups to download",
                      );
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-emerald flex-1 text-white"
                    disabled={done}
                    onClick={() => {
                      acknowledge(a.id, me.id, me.name);
                      toast.success("Acknowledgement recorded and emailed to HR");
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> {done ? "Acknowledged" : "Acknowledge"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-sm">Nothing published in this category yet.</p>
        )}
      </div>
    </div>
  );
}

export default EmpNotices;
