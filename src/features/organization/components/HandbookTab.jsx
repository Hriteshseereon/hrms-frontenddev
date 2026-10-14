// Master Data → Documents → Employee Handbook: publish a version (from the Doc Master template or an uploaded PDF),
// require acknowledgement, and track who has signed.
import { useMemo, useState } from "react";
import { BookOpen, Upload, Send, Download, CheckCircle2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { directoryEmployees, useDirectory } from "@/features/employees/data/employee-directory";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { useDocTemplates, renderTemplate } from "@/features/organization/data/doc-master";
import { publishHandbook, useHandbook } from "@/features/organization/data/handbook-data";
import { exportReportPdf } from "@/lib/export-utils";
import { DonutChart, ChartCard } from "@/features/dashboard/components/Charts";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

export function HandbookTab() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  useDirectory();
  const emps = directoryEmployees().filter((e) => e.orgId === orgId && e.status === "Active");
  const { versions, acks } = useHandbook();
  const current = versions[0];
  // Reactive read — templates saved in Doc Master show up here without a reload, and the server / hydration render agree.
  const templates = useDocTemplates().filter((t) => t.docType === "Employee Handbook" && t.active);
  const [source, setSource] = useState("Doc Master template");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [file, setFile] = useState(null);
  const nextVersion = current ? `${(parseFloat(current.version) + 0.1).toFixed(1)}` : "1.0";
  const [version, setVersion] = useState(nextVersion);
  // The persisted version list arrives after hydration and changes again after a publish — re-propose the next number.
  const [seenVersion, setSeenVersion] = useState(current?.version);
  if (seenVersion !== current?.version) {
    setSeenVersion(current?.version);
    setVersion(nextVersion);
  }
  const versionTaken = versions.some((v) => v.version === version.trim());
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [requireAck, setRequireAck] = useState(true);
  const [dueDays, setDueDays] = useState(14);
  const status = useMemo(
    () =>
      emps.map((e) => {
        const a = acks.find((x) => x.empId === e.id && x.version === current?.version);
        return { e, a };
      }),
    [emps, acks, current],
  );
  const done = status.filter((s) => s.a).length;
  const [detail, setDetail] = useState(null);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 font-semibold">
              <BookOpen className="text-primary h-4 w-4" /> Employee Handbook{" "}
              {current && (
                <Badge variant="outline" className="ml-1">
                  current v{current.version} · {current.publishedOn}
                </Badge>
              )}
            </div>
            {current && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <div className="font-medium">
                  {current.fileName}{" "}
                  <span className="text-muted-foreground text-xs">
                    · {current.source} · by {current.publishedBy}
                  </span>
                </div>
                <div className="text-muted-foreground text-xs">{current.summary}</div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const t = templates.find((x) => x.id === current.templateId) ?? templates[0];
                      if (t)
                        renderTemplate(t, {
                          version: current.version,
                          date: current.publishedOn,
                          entity: "Seereon Consulting & IT Services Pvt. Ltd.",
                        });
                      else toast.success(`Opening ${current.fileName}`);
                    }}
                  >
                    <Download className="h-4 w-4" /> Open handbook
                  </Button>
                </div>
              </div>
            )}
            <div className="text-muted-foreground pt-1 text-xs font-semibold tracking-wider uppercase">
              Publish a new version
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Select value={source} onValueChange={(v) => setSource(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Doc Master template">Doc Master template</SelectItem>
                    <SelectItem value="Uploaded file">Upload PDF / DOCX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {source === "Doc Master template" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Template</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} · v{t.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">File</Label>
                  <Input
                    type="file"
                    accept=".pdf,.docx"
                    className="text-xs"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Version</Label>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} />
                {versionTaken && (
                  <p className="text-destructive text-[11px]">
                    v{version.trim()} is already published — use a new version number.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Acknowledgement due (days)</Label>
                <Input
                  type="number"
                  value={dueDays}
                  onChange={(e) => setDueDays(+e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Summary shown to employees</Label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Working hours, leave, code of conduct, POSH, IT security…"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">What changed</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={requireAck} onCheckedChange={setRequireAck} /> Require every
                employee to read &amp; acknowledge
              </label>
              <Button
                className="bg-gradient-emerald text-white"
                disabled={
                  !version.trim() ||
                  versionTaken ||
                  (source === "Uploaded file" ? !file : !templateId)
                }
                onClick={() => {
                  publishHandbook(
                    {
                      version: version.trim(),
                      publishedBy: me.name,
                      source,
                      fileName:
                        source === "Uploaded file"
                          ? file.name
                          : `Seereon-Employee-Handbook-v${version}.pdf`,
                      templateId: source === "Doc Master template" ? templateId : undefined,
                      summary,
                      requireAck,
                      ackDueDays: dueDays,
                      changeNotes: notes,
                    },
                    emps.map((e) => ({ id: e.id, name: e.name })),
                  );
                  toast.success(
                    `Handbook v${version} published${requireAck ? ` — ${emps.length} employees notified to acknowledge` : ""}`,
                  );
                  setSummary("");
                  setNotes("");
                  setFile(null);
                }}
              >
                {source === "Uploaded file" ? (
                  <Upload className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}{" "}
                Publish v{version}
              </Button>
            </div>
          </CardContent>
        </Card>
        <ChartCard
          title="Acknowledgement"
          subtitle={
            current ? `v${current.version} · ${done} of ${emps.length} signed` : "No version"
          }
        >
          <DonutChart
            data={[
              { name: "Acknowledged", value: done },
              { name: "Pending", value: emps.length - done },
            ].filter((d) => d.value)}
            height={200}
          />
        </ChartCard>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-3">
            <div className="text-sm font-semibold">Acknowledgement register</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportReportPdf({
                  title: `Employee Handbook v${current?.version} — acknowledgement register`,
                  columns: [
                    "Employee",
                    "ID",
                    "Department",
                    "Status",
                    "Acknowledged on",
                    "Signature",
                  ],
                  rows: status.map(({ e, a }) => [
                    e.name,
                    e.id,
                    e.dept,
                    a ? "Acknowledged" : "Pending",
                    a?.acknowledgedOn ?? "—",
                    a?.signature ?? "—",
                  ]),
                })
              }
            >
              <Download className="h-4 w-4" /> Report
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                {["Employee", "Department", "Status", "Acknowledged on", "Signature"].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {status.map(({ e, a }) => (
                <tr key={e.id} className={clickableRow} onClick={() => setDetail({ e, a })}>
                  <td className="p-3 font-medium">
                    {e.name}
                    <div className="text-muted-foreground text-xs">{e.id}</div>
                  </td>
                  <td className="p-3">{e.dept}</td>
                  <td className="p-3">
                    {a ? (
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Acknowledged
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold">
                        <Clock3 className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">{a?.acknowledgedOn ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{a?.signature ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="text-muted-foreground text-xs">
        Version history: {versions.map((v) => `v${v.version} (${v.publishedOn})`).join(" · ")}
      </div>
      {detail && (
        <RecordDetailDialog
          onClose={() => setDetail(null)}
          title={detail.e.name}
          subtitle={`${detail.e.id} · ${detail.e.dept} · handbook v${current?.version ?? "—"}`}
          badges={
            detail.a ? (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Acknowledged
              </Badge>
            ) : (
              <Badge variant="outline" className="border-gold/40 bg-gold/15 text-gold">
                Pending
              </Badge>
            )
          }
          record={{
            name: detail.e.name,
            employeeId: detail.e.id,
            department: detail.e.dept,
            designation: detail.e.role,
            branch: detail.e.branch,
            handbookVersion: current ? `v${current.version}` : "—",
            publishedOn: current?.publishedOn ?? "—",
            fileName: current?.fileName ?? "—",
            acknowledgementDue: current ? `${current.ackDueDays} day(s) from publish` : "—",
            status: detail.a ? "Acknowledged" : "Pending",
            acknowledgedOn: detail.a?.acknowledgedOn ?? "—",
            signature: detail.a?.signature ?? "—",
          }}
          labels={{
            employeeId: "Employee ID",
            handbookVersion: "Handbook version",
            fileName: "File",
            acknowledgementDue: "Acknowledgement due",
          }}
          sections={[
            {
              title: "Employee",
              keys: ["name", "employeeId", "department", "designation", "branch"],
            },
            {
              title: "Handbook",
              keys: ["handbookVersion", "publishedOn", "fileName", "acknowledgementDue"],
            },
            { title: "Acknowledgement", keys: ["status", "acknowledgedOn", "signature"] },
          ]}
        />
      )}
    </div>
  );
}
