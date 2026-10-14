import { useEffect, useMemo, useState } from "react";
import { BellRing, Save, Mail, CalendarClock, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { can, useCurrentUser } from "@/features/auth/data/auth-session";
import { useActiveOrgId } from "@/features/organization/data/group-data";
import { saveHrPolicy, useHrPolicy, useOutbox } from "@/features/exit/data/hr-policy";

const KINDS = [
  "Birthday",
  "Work anniversary",
  "Retirement approaching",
  "Probation ending (HOD)",
  "Retirement processed",
];

export function NotificationCentre() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const outbox = useOutbox(orgId);
  const policy = useHrPolicy();
  const [d, setD] = useState(policy);
  // The persisted policy only arrives after hydration — re-seed the draft so the form does not open "dirty" with defaults.
  useEffect(() => {
    setD(policy);
  }, [policy]);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState(null);
  // Company HR policy (retirement age, notice lead times) — HR / CHRO / administrators. It was keyed on employee.manage,
  // which also let every HOD rewrite the organisation's retirement age.
  const editable = can(me.role, "exit.notice.configure");
  const rows = useMemo(
    () =>
      outbox.filter(
        (n) => (kind === "all" || n.kind === kind) && (status === "all" || n.status === status),
      ),
    [outbox, kind, status],
  );
  const dirty = JSON.stringify(d) !== JSON.stringify(policy);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  // Lead times must be whole, non-negative numbers; retirement age within the statutory band.
  const NUMERIC = [
    "retirementNoticeDays",
    "probationReminderDays",
    "birthdayNoticeDays",
    "anniversaryNoticeDays",
    "contractExtensionMonths",
  ];
  const invalid =
    !Number.isFinite(d.retirementAge) ||
    d.retirementAge < 50 ||
    d.retirementAge > 75 ||
    NUMERIC.some((k) => {
      const v = d[k];
      return !Number.isFinite(v) || v < 0 || !Number.isInteger(v);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BellRing className="text-primary h-6 w-6" /> Notification Centre
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Automated triggers computed from employee data and HR policy. Delivery over e-mail /
          WhatsApp needs the messaging integration; every trigger is logged here with its
          recipients.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {KINDS.map((k) => {
          const n = outbox.filter((x) => x.kind === k);
          return (
            <Card
              key={k}
              className="shadow-card cursor-pointer"
              onClick={() => setKind(k === kind ? "all" : k)}
            >
              <CardContent className="p-4">
                <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                  {k}
                </div>
                <div className="mt-1 text-2xl font-bold">{n.length}</div>
                <div className="text-muted-foreground text-[11px]">
                  {n.filter((x) => x.status === "Sent").length} sent ·{" "}
                  {n.filter((x) => x.status === "Scheduled").length} scheduled
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <Mail className="text-primary h-4 w-4" /> Outbox
              </div>
              <div className="ml-auto flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="w-[200px] max-w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All triggers</SelectItem>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "Trigger",
                      "Recipient",
                      "Subject",
                      "Event",
                      "Fires on",
                      "Channel",
                      "Status",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((n) => (
                    <tr
                      key={n.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setView(n)}
                    >
                      <td className="p-3 font-medium">{n.kind}</td>
                      <td className="p-3">
                        {n.to}
                        <div className="text-muted-foreground max-w-[220px] truncate text-xs">
                          {n.toEmail}
                        </div>
                      </td>
                      <td className="max-w-[260px] truncate p-3">{n.subject}</td>
                      <td className="text-muted-foreground p-3 whitespace-nowrap">
                        <span className="whitespace-nowrap">{n.triggerDate}</span>
                      </td>
                      <td className="text-muted-foreground p-3 whitespace-nowrap">
                        <span className="whitespace-nowrap">{n.dueOn}</span>
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">{n.channel}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            n.status === "Sent"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-gold/40 bg-gold/15 text-gold",
                          )}
                        >
                          {n.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-muted-foreground p-8 text-center">
                        No notifications match — widen the lead times in the policy or change the
                        filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 font-semibold">
              <Settings2 className="text-primary h-4 w-4" /> HR policy parameters
            </div>
            <div className="text-muted-foreground text-xs">
              Updated <span className="whitespace-nowrap">{policy.updatedOn}</span> by{" "}
              {policy.updatedBy}
            </div>
            {[
              ["retirementAge", "Retirement age (years)"],
              ["retirementNoticeDays", "Retirement notice lead (days)"],
              ["probationReminderDays", "Probation reminder to HOD (days before end)"],
              ["birthdayNoticeDays", "Birthday look-ahead (days)"],
              ["anniversaryNoticeDays", "Anniversary look-ahead (days)"],
              ["contractExtensionMonths", "Default contract on re-hire (months)"],
            ].map(([k, l]) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">{l}</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!editable}
                  value={d[k]}
                  onChange={(e) => set(k, Number(e.target.value))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Channels</Label>
              <div className="flex flex-wrap gap-1.5">
                {["Email", "In-app", "WhatsApp"].map((c) => {
                  const on = d.notifyChannels.includes(c);
                  return (
                    <Button
                      key={c}
                      size="sm"
                      variant={on ? "default" : "outline"}
                      disabled={!editable}
                      className={on ? "bg-gradient-emerald h-7 text-white" : "h-7"}
                      onClick={() =>
                        setD({
                          ...d,
                          notifyChannels: on
                            ? d.notifyChannels.filter((x) => x !== c)
                            : [...d.notifyChannels, c],
                        })
                      }
                    >
                      {c}
                    </Button>
                  );
                })}
              </div>
            </div>
            {invalid && (
              <div className="text-destructive text-xs">
                Retirement age must be 50–75 and every lead time a whole number of 0 or more.
              </div>
            )}
            <Button
              className="bg-gradient-emerald w-full text-white"
              disabled={!dirty || !editable || invalid || d.notifyChannels.length === 0}
              onClick={() => {
                saveHrPolicy(d, me.name);
                toast.success("HR policy saved — triggers recomputed");
              }}
            >
              <Save className="h-4 w-4" /> Save policy
            </Button>
            <div className="border-border bg-muted/20 text-muted-foreground flex gap-2 rounded-lg border p-3 text-xs">
              <CalendarClock className="h-4 w-4 shrink-0" />
              Retirement notices go to the employee and HR; probation reminders go to the department
              HOD; birthdays go to everyone; anniversaries to the employee.
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{view?.subject}</DialogTitle>
            <DialogDescription>
              {view?.kind} · fires {view?.dueOn} · {view?.channel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">To:</span> {view?.to}{" "}
              <span className="text-muted-foreground text-xs">({view?.toEmail})</span>
            </div>
            <div className="border-border bg-muted/20 rounded-lg border p-3 whitespace-pre-wrap">
              {view?.body}
            </div>
            <div className="text-muted-foreground text-xs">
              Status: {view?.status}
              {view?.sentOn ? ` · sent ${view.sentOn}` : ""}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
