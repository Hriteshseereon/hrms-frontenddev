import { useMemo, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  announcementsFor,
  useAnnouncements,
} from "@/features/communications/data/announcement-data";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { rollup, useAcks } from "@/features/communications/data/ack-data";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";

/** Admin view of who has acknowledged each circular / notice. */
export function AcknowledgementsTab() {
  const orgId = useActiveOrgId();
  const announcements = announcementsFor(useAnnouncements(), orgId);
  const acks = useAcks();
  const [id, setId] = useState(announcements[0]?.id ?? "");

  const selected = announcements.find((a) => a.id === id) ?? announcements[0];
  const data = useMemo(
    () =>
      selected
        ? rollup(selected.id, selected.to, acks, selected.orgId ?? orgId, selected.branch)
        : { acknowledged: [], pending: [], overdue: [] },
    [selected, acks, orgId],
  );

  if (!selected) {
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-10 text-center">
          Publish an announcement to start tracking acknowledgements.
        </CardContent>
      </Card>
    );
  }

  const columns = ["Emp ID", "Employee", "Status", "Detail"];
  const reportRows = [
    ...data.acknowledged.map((a) => [a.empId, a.employee, "Acknowledged", a.acknowledgedAt]),
    ...data.pending.map((p) => [p.empId, p.employee, "Pending", "Awaiting acknowledgement"]),
    ...data.overdue.map((p) => [p.empId, p.employee, "Overdue", `Past due ${selected.to}`]),
  ];

  function downloadPdf() {
    const ok = exportReportPdf({
      title: "Acknowledgement Tracker",
      subtitle: `${selected.type} · ${selected.subject}`,
      filters: [
        { label: "Announcement", value: selected.id },
        { label: "Due by", value: selected.to },
      ],
      summary: [
        { label: "Acknowledged", value: String(data.acknowledged.length) },
        { label: "Pending", value: String(data.pending.length) },
        { label: "Overdue", value: String(data.overdue.length) },
      ],
      columns,
      rows: reportRows,
    });
    if (ok) toast.success("Acknowledgement report ready in the print dialog");
    else toast.error("Allow pop-ups to generate the PDF");
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[260px] flex-1 space-y-1.5">
            <Label className="text-muted-foreground text-xs">Announcement</Label>
            <Select value={selected.id} onValueChange={setId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {announcements.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.type} · {a.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-muted-foreground pb-2 text-xs">
            Acknowledgement due by {selected.to}
          </div>
          <div className="flex flex-wrap gap-2 pb-0.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                exportCsv(`acknowledgements-${selected.id}`, columns, reportRows);
                toast.success("CSV exported");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column
          title="Acknowledged"
          icon={CheckCircle2}
          tone="border-primary/30 bg-primary/10 text-primary"
          rows={data.acknowledged.map((a) => ({
            key: a.empId,
            name: a.employee,
            meta: a.acknowledgedAt,
          }))}
        />

        <Column
          title="Pending"
          icon={Clock}
          tone="border-gold/40 bg-gold/15 text-gold"
          rows={data.pending.map((p) => ({
            key: p.empId,
            name: p.employee,
            meta: "Awaiting acknowledgement",
          }))}
        />

        <Column
          title="Overdue"
          icon={AlertTriangle}
          tone="border-destructive/30 bg-destructive/10 text-destructive"
          rows={data.overdue.map((p) => ({
            key: p.empId,
            name: p.employee,
            meta: `Past due ${selected.to}`,
          }))}
        />
      </div>
    </div>
  );
}

function Column({ title, icon: Icon, tone, rows }) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-semibold">{title}</span>
          <Badge variant="outline" className={"ml-auto " + tone}>
            {rows.length}
          </Badge>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="border-border rounded-lg border p-3">
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-muted-foreground text-xs">{r.meta}</div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-muted-foreground text-xs">Nobody in this bucket.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
