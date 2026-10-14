import { useMemo, useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Megaphone, Plus, CalendarRange, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import { AcknowledgementsTab } from "@/features/communications/components/AcknowledgementsTab";

import {
  ANNOUNCEMENT_TYPES as TYPES,
  ANNOUNCEMENT_TONE as typeTone,
  announcementsFor,
  publishAnnouncement,
  removeAnnouncement,
  useAnnouncements,
} from "@/features/communications/data/announcement-data";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import { directoryEmployees } from "@/features/employees/data/employee-directory";
import { pushAlert } from "@/features/communications/data/employee-alerts";
import { archiveRecord } from "@/features/administration/data/archive-data";
import { useScope } from "@/features/organization/data/tenancy";

function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Announcements() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const orgs = useOrgs();
  const all = useAnnouncements();
  // Tenant scope: the active entity's announcements (all of the group's entities in a Super Admin's collective view).
  const scope = useScope();
  const groupView = scope.readOnly;
  // Publishing / retracting is an HR-office action (announcement.manage): Super Admin, Admin, CEO, CHRO and HR for
  // the company; a Branch Admin for their own branch only. Never from the read-only collective view. Every role that
  // can merely open this screen (Managers, HODs, CFO …) used to broadcast to the whole company and retract HR notices.
  const isBranchAdmin = me.role === "BranchAdmin";
  const myBranch = isBranchAdmin ? (scope.branch?.name ?? me.branch ?? null) : null;
  const canPublish =
    !groupView && can(me.role, "announcement.manage") && (!isBranchAdmin || !!myBranch);
  const canRetract = (r) => canPublish && (!isBranchAdmin || (!!r.branch && r.branch === myBranch));
  const myGroupId = me.groupId ?? orgs.find((o) => o.id === me.orgId)?.groupId;
  const rows = useMemo(
    () =>
      announcementsFor(
        all,
        groupView ? orgs.filter((o) => o.groupId === myGroupId).map((o) => o.id) : orgId,
      ),
    [all, groupView, orgs, myGroupId, orgId],
  );
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [document, setDocument] = useState("");

  // "Valid to" must not precede "Valid from" — the two are ISO dates so a string compare is safe.
  const valid = type && subject.trim() && from && to && to >= from;
  const visible = filter === "all" ? rows : rows.filter((r) => r.type === filter);

  function submit() {
    if (!canPublish) {
      toast.error("You cannot publish announcements in this scope");
      return;
    }
    const row = {
      type: type,
      subject: subject.trim(),
      description: description.trim(),
      from,
      to,
      document: document || undefined,
      orgId, // published into the entity being worked in
      branch: myBranch ?? undefined, // Branch Admin notices reach their branch only
      publishedBy: me.name,
      publishedOn: new Date().toISOString().slice(0, 10),
    };
    const id = publishAnnouncement(row);
    // Employees of the entity get it in their alerts bell (nothing reached them before unless they opened Notices).
    const audience = directoryEmployees().filter(
      (e) => e.orgId === orgId && (!row.branch || e.branch === row.branch),
    );
    audience.forEach((e) =>
      pushAlert({
        empId: e.id,
        kind: "general",
        to: "/emp/notices",
        title: `${row.type}: ${row.subject}`,
        body: row.description.slice(0, 160) || `Valid ${from} → ${to}`,
      }),
    );
    setOpen(false);
    setType("");
    setSubject("");
    setDescription("");
    setFrom("");
    setTo("");
    setDocument("");
    toast.success(`${row.type} ${id} published to ${audience.length} employee(s)`);
  }

  /** Soft delete — the row moves to System Archive (restorable) instead of being unrecoverable. */
  function retract(r) {
    if (!canRetract(r)) return;
    archiveRecord({
      module: "Announcements",
      recordId: r.id,
      title: r.subject,
      summary: `${r.type} · ${r.from} → ${r.to}`,
      reason: `Retracted by ${me.name}`,
      payload: r,
      orgId: r.orgId,
    });
    removeAnnouncement(r.id);
    toast.success(`${r.id} retracted — restorable from System Archive`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Megaphone className="text-primary h-6 w-6" /> Announcements
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Publish announcements, notices, events and circulars across your workforce.
          </p>
        </div>
        {canPublish && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-emerald shadow-premium text-white">
                <Plus className="h-4 w-4" /> New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Announcement</DialogTitle>
                <DialogDescription>Broadcast a message to the organization.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Field label="Type" required>
                  <Select value={type} onValueChange={(v) => setType(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Subject" required>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Q3 All-Hands"
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Full message body…"
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Valid from" required>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                  <Field label="Valid to" required>
                    <Input
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={(e) => setTo(e.target.value)}
                    />
                    {from && to && to < from && (
                      <p className="text-destructive text-xs">
                        Valid to must be on or after Valid from.
                      </p>
                    )}
                  </Field>
                </div>
                <Field label="Document upload">
                  <Input
                    type="file"
                    onChange={(e) => {
                      captureFiles(e.target.files);
                      setDocument(e.target.files?.[0]?.name ?? "");
                    }}
                  />
                  {document && <p className="text-muted-foreground text-xs">{document}</p>}
                </Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!valid}
                  className="bg-gradient-emerald shadow-premium text-white"
                  onClick={submit}
                >
                  Publish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v)}>
        <ScrollTabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {TYPES.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}s
            </TabsTrigger>
          ))}
        </ScrollTabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visible.map((r) => (
          <Card key={r.id} className="shadow-card hover:shadow-premium transition">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-semibold break-words">{r.subject}</div>
                <Badge variant="outline" className={typeTone[r.type]}>
                  {r.type}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">{r.description || "—"}</p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span className="flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5" /> {r.from} → {r.to}
                </span>
                {r.document && (
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> {r.document}
                  </span>
                )}
                {r.branch && <Badge variant="outline">{r.branch} only</Badge>}
                <span className="ml-auto font-mono">{r.id}</span>
                {canRetract(r) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-9 w-9 sm:h-7 sm:w-7"
                    title="Retract (moves to archive)"
                    aria-label={`Retract ${r.id}`}
                    onClick={() => retract(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!visible.length && (
          <Card className="shadow-card md:col-span-2">
            <CardContent className="text-muted-foreground p-10 text-center text-sm">
              No {filter === "all" ? "announcements" : `${filter.toLowerCase()}s`} yet.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Acknowledgement tracking
        </h2>
        <AcknowledgementsTab />
      </div>
    </div>
  );
}

export default Announcements;
