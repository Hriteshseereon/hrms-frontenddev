import { useEffect, useMemo, useState } from "react";
import { Archive, RotateCcw, Trash2, Download, ShieldAlert, Timer } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  archiveFor,
  archiveStore,
  daysArchived,
  daysUntilPurge,
  purgeExpired,
  purgeRecord,
  restoreRecord,
  restoreThroughHandlers,
  setArchiveConfig,
  useArchive,
  useArchiveConfig,
} from "@/features/administration/data/archive-data";
import { announcementStore } from "@/features/communications/data/announcement-data";
import { restoreRole } from "@/features/auth/data/rbac-store";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import "@/components/common/CrudSection"; // registers the master-data restore handler
import { readList, writeList } from "@/lib/shared-list";
import { GEOFENCE_RULES } from "@/features/organization/data/master-data";
import { exportReportPdf, exportCsv } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";
import { useScope } from "@/features/organization/data/tenancy";

// Fixed zone so the server-rendered markup matches the client (the container renders in UTC, users are in IST).
const fmt = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

/**
 * Puts an archived payload back into the store it was deleted from. Returns false when no module knows how to take
 * the record back — the row then stays in the archive instead of silently disappearing.
 */
function restoreToOrigin(rec) {
  if (
    rec.module === "Master Data" &&
    rec.recordId.startsWith("GEO-") &&
    rec.payload &&
    typeof rec.payload === "object"
  ) {
    const list = readList("geofence-rules", GEOFENCE_RULES);
    if (!list.some((g) => g.id === rec.recordId))
      writeList("geofence-rules", [rec.payload, ...list]);
    return true;
  }
  if (rec.module === "Announcements" && rec.payload && typeof rec.payload === "object") {
    const a = rec.payload;
    if (!announcementStore.get().some((x) => x.id === a.id))
      announcementStore.set((p) => [a, ...p]);
    return true;
  }
  if (rec.module === "Roles & Permissions" && rec.payload && typeof rec.payload === "object")
    return restoreRole(rec.payload);
  return restoreThroughHandlers(rec);
}

function ArchivePage() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const collective = useScope().readOnly;
  const orgs = useOrgs();
  const allRows = useArchive();
  // Tenant scope: an entity Admin sees only that company's deletions (a Super Admin in group view sees the group's).
  const myGroupId = me.groupId ?? orgs.find((o) => o.id === me.orgId)?.groupId;
  const scopeIds = collective
    ? orgs.filter((o) => o.groupId === myGroupId).map((o) => o.id)
    : [orgId];
  const rows = useMemo(() => archiveFor(allRows, scopeIds), [allRows, scopeIds?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = useArchiveConfig();
  const [module, setModule] = useState("all");
  const [q, setQ] = useState("");
  const [days, setDays] = useState(String(cfg.autoDeleteDays));
  const [detail, setDetail] = useState(null);
  // The persisted config only arrives after hydration — keep the draft input in step with it.
  useEffect(() => {
    setDays(String(cfg.autoDeleteDays));
  }, [cfg.autoDeleteDays]);

  // Retention enforcement runs whenever an admin opens the screen.
  useEffect(() => {
    const removed = purgeExpired();
    if (removed > 0)
      toast.success(
        `${removed} archived record(s) auto-deleted past the ${cfg.autoDeleteDays}-day retention window`,
      );
    // Runs once when the screen opens; later retention edits apply on the next visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modules = useMemo(() => [...new Set(rows.map((r) => r.module))].sort(), [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (module === "all" || r.module === module) &&
        (!term ||
          `${r.title} ${r.summary} ${r.recordId} ${r.archivedBy}`.toLowerCase().includes(term)),
    );
  }, [rows, module, q]);

  const expiringSoon = rows.filter((r) => {
    const left = daysUntilPurge(r, cfg);
    return left !== Infinity && left <= cfg.notifyBeforeDays;
  }).length;

  const tableRows = filtered.map((r) => {
    const left = daysUntilPurge(r, cfg);
    return [
      r.module,
      r.recordId,
      r.title,
      r.summary || "—",
      r.reason,
      r.archivedBy,
      fmt(r.archivedOn),
      `${daysArchived(r)} d`,
      left === Infinity ? "Never" : `${Math.max(0, left)} d`,
    ];
  });

  const columns = [
    "Module",
    "Record ID",
    "Title",
    "Details",
    "Reason",
    "Archived by",
    "Archived on",
    "Age",
    "Purge in",
  ];

  function downloadPdf() {
    const ok = exportReportPdf({
      title: "System Archive & Soft Delete Register",
      subtitle: "All records archived from Seereon HRMS modules",
      filters: [
        { label: "Module", value: module === "all" ? "All modules" : module },
        { label: "Search", value: q.trim() || "—" },
        {
          label: "Retention",
          value: cfg.autoDeleteEnabled
            ? `Auto-delete after ${cfg.autoDeleteDays} days`
            : "Auto-delete disabled",
        },
      ],
      summary: [
        { label: "Archived records", value: String(rows.length) },
        { label: "In this view", value: String(filtered.length) },
        { label: "Purging soon", value: String(expiringSoon) },
      ],
      columns,
      rows: tableRows,
    });
    toast[ok ? "success" : "error"](
      ok ? "Archive register ready — save as PDF" : "Allow pop-ups to download the register",
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Archive className="text-primary h-6 w-6" /> System Archive &amp; Soft Delete
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Deleting a record anywhere in Seereon HRMS moves it here instead of destroying it. Restore
          it, purge it, or let the retention policy remove it automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Archived records", String(rows.length), "Across all modules", Archive],
          ["Modules affected", String(modules.length), "Distinct sources", ShieldAlert],
          ["Purging soon", String(expiringSoon), `Within ${cfg.notifyBeforeDays} days`, Timer],
          [
            "Retention window",
            cfg.autoDeleteEnabled ? `${cfg.autoDeleteDays} days` : "Off",
            cfg.autoDeleteEnabled ? "Auto-delete active" : "Records kept forever",
            Timer,
          ],
        ].map(([label, value, sub, Icon]) => {
          const I = Icon;
          return (
            <Card key={label} className="shadow-card">
              <CardContent className="p-4">
                <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
                  <I className="h-3.5 w-3.5" /> {label}
                </div>
                <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
                <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Retention policy</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Archived records are permanently deleted once they exceed the retention window.
              Enforcement runs each time this screen is opened.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="border-border bg-muted/40 flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5">
              <div>
                <div className="text-sm font-medium">Auto-delete archived records</div>
                <div className="text-muted-foreground text-xs">
                  Turn off to keep archived data indefinitely
                </div>
              </div>
              <Switch
                checked={cfg.autoDeleteEnabled}
                onCheckedChange={(v) => {
                  setArchiveConfig({ autoDeleteEnabled: v });
                  toast.success(
                    v
                      ? `Auto-delete enabled — ${cfg.autoDeleteDays} day window`
                      : "Auto-delete disabled",
                  );
                }}
              />
            </div>
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label htmlFor="days" className="text-muted-foreground text-xs">
                Delete after (days)
              </Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-9 w-full sm:w-[140px]"
              />
            </div>
            <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
              <Label htmlFor="notify" className="text-muted-foreground text-xs">
                Warn before (days)
              </Label>
              <Input
                id="notify"
                type="number"
                min={0}
                max={90}
                value={cfg.notifyBeforeDays}
                onChange={(e) =>
                  setArchiveConfig({ notifyBeforeDays: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-9 w-full sm:w-[140px]"
              />
            </div>
            <Button
              className="bg-gradient-emerald text-white"
              onClick={() => {
                const n = Math.max(1, Number(days) || 1);
                setArchiveConfig({ autoDeleteDays: n });
                setDays(String(n));
                const removed = purgeExpired();
                toast.success(
                  `Retention set to ${n} days${removed ? ` — ${removed} record(s) purged immediately` : ""}`,
                );
              }}
            >
              Save retention policy
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const removed = purgeExpired();
                toast[removed ? "success" : "info"](
                  removed
                    ? `${removed} expired record(s) purged`
                    : "Nothing has passed the retention window yet",
                );
              }}
            >
              Run purge now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Module</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label htmlFor="q" className="text-muted-foreground text-xs">
              Search
            </Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, record ID, person…"
              className="h-9 w-full sm:w-[260px]"
            />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportCsv("seereon-archive-register", columns, tableRows);
                toast.success("Archive register exported as CSV");
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPdf}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={filtered.length === 0}>
                  <Trash2 className="h-4 w-4" /> Empty {module === "all" ? "archive" : module}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently delete these records?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {filtered.length} archived record(s) will be destroyed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      // Delete exactly the rows the dialog counted (module + search), not the whole module.
                      const ids = new Set(filtered.map((r) => r.id));
                      archiveStore.set((p) => p.filter((r) => !ids.has(r.id)));
                      toast.success(`${ids.size} record(s) permanently deleted`);
                    }}
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
              <tr>
                <th className="p-3 text-left">Module</th>
                <th className="p-3 text-left">Record</th>
                <th className="p-3 text-left">Archived</th>
                <th className="p-3 text-left">Retention</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((r) => {
                const left = daysUntilPurge(r, cfg);
                const soon = left !== Infinity && left <= cfg.notifyBeforeDays;
                return (
                  <tr
                    key={r.id}
                    className={`${clickableRow} align-top`}
                    onClick={() => setDetail(r)}
                  >
                    <td className="p-3">
                      <Badge variant="outline">{r.module}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.recordId}
                        {r.summary ? ` · ${r.summary}` : ""}
                      </div>
                      <div className="text-muted-foreground text-xs italic">{r.reason}</div>
                    </td>
                    <td className="text-muted-foreground p-3">
                      <div>{fmt(r.archivedOn)}</div>
                      <div className="text-xs">
                        by {r.archivedBy} · {daysArchived(r)} day(s) ago
                      </div>
                    </td>
                    <td className="p-3">
                      {left === Infinity ? (
                        <Badge variant="outline">Kept indefinitely</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            soon
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-primary/30 bg-primary/10 text-primary"
                          }
                        >
                          Purges in {Math.max(0, left)} d
                        </Badge>
                      )}
                    </td>
                    <td
                      className="p-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!restoreToOrigin(r)) {
                            toast.error(
                              `${r.module} cannot take this record back automatically — it stays archived`,
                            );
                            return;
                          }
                          const rec = restoreRecord(r.id);
                          toast.success(
                            rec
                              ? `${rec.title} restored to ${rec.module}`
                              : "Record no longer in the archive",
                          );
                        }}
                      >
                        <RotateCcw className="text-primary h-4 w-4" /> Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            !window.confirm(`Permanently delete ${r.title}? This cannot be undone.`)
                          )
                            return;
                          purgeRecord(r.id);
                          toast.success(`${r.title} permanently deleted`);
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground p-12 text-center">
                    Nothing archived yet. Deleting a record from any module will place it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {detail &&
        (() => {
          const left = daysUntilPurge(detail, cfg);
          const payload =
            detail.payload && typeof detail.payload === "object" && !Array.isArray(detail.payload)
              ? detail.payload
              : { value: detail.payload };
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={detail.title}
              subtitle={`${detail.module} · ${detail.recordId}`}
              badges={
                <>
                  <Badge variant="outline">{detail.module}</Badge>
                  {left === Infinity ? (
                    <Badge variant="outline">Kept indefinitely</Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className={
                        left <= cfg.notifyBeforeDays
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-primary/30 bg-primary/10 text-primary"
                      }
                    >
                      Purges in {Math.max(0, left)} d
                    </Badge>
                  )}
                </>
              }
              record={{
                id: detail.id,
                module: detail.module,
                recordId: detail.recordId,
                title: detail.title,
                summary: detail.summary,
                archivedOn: fmt(detail.archivedOn),
                archivedBy: detail.archivedBy,
                daysArchived: `${daysArchived(detail)} day(s)`,
                reason: detail.reason,
                retention:
                  left === Infinity ? "Kept indefinitely" : `Purges in ${Math.max(0, left)} day(s)`,
                originalRecord: payload,
              }}
              labels={{
                id: "Archive ID",
                recordId: "Original record ID",
                daysArchived: "Archived for",
                originalRecord: "Original record",
              }}
              sections={[
                {
                  title: "Archived record",
                  keys: ["id", "module", "recordId", "title", "summary"],
                },
                {
                  title: "Archive & retention",
                  keys: ["archivedOn", "archivedBy", "daysArchived", "reason", "retention"],
                },
                { title: "Original record", keys: ["originalRecord"] },
              ]}
            />
          );
        })()}
    </div>
  );
}

export default ArchivePage;
