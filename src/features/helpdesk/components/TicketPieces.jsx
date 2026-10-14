import { useMemo, useState } from "react";
import Link from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { Search, Clock3, Paperclip, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  STATUSES,
  fmtDate,
  priorityTone,
  slaState,
  slaTone,
  statusTone,
  useHelpdeskConfig,
  allPeople,
} from "@/features/helpdesk/data/helpdesk-data";

export function SlaChip({ t }) {
  const s = slaState(t);
  const label =
    s.resolve === "Met"
      ? "SLA met"
      : s.resolve === "Paused"
        ? "SLA paused"
        : s.resolve === "Breached"
          ? `Breached ${-s.hoursLeft} h ago`
          : `${s.hoursLeft} h left`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", slaTone(s.resolve))}>
      <Clock3 className="h-3 w-3" />
      {label}
    </span>
  );
}

export function TicketTable({
  tickets,
  emptyText = "No tickets.",
  showRequester = true,
  showAssignee = true,
}) {
  const cfg = useHelpdeskConfig();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");
  const [dept, setDept] = useState("all");
  const rows = useMemo(
    () =>
      tickets
        .filter((t) => {
          const s = q.trim().toLowerCase();
          if (
            s &&
            !`${t.id} ${t.subject} ${t.requesterName} ${t.assigneeName ?? ""} ${t.tags.join(" ")}`
              .toLowerCase()
              .includes(s)
          )
            return false;
          if (status === "open" && (t.status === "Closed" || t.status === "Resolved")) return false;
          if (status !== "all" && status !== "open" && t.status !== status) return false;
          if (priority !== "all" && t.priority !== priority) return false;
          if (dept !== "all" && t.departmentId !== dept) return false;
          return true;
        })
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [tickets, q, status, priority, dept],
  );
  const catName = (t) =>
    cfg.departments
      .find((d) => d.id === t.departmentId)
      ?.categories.find((c) => c.id === t.categoryId)?.name ?? t.categoryId;
  const deptName = (id) => cfg.departments.find((d) => d.id === id)?.name ?? id;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="border-border bg-muted/40 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 sm:flex-none">
          <Search className="text-muted-foreground h-4 w-4" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search id, subject, people, tags…"
            className="h-6 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 sm:w-56"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open (all active)</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="h-9 w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {cfg.departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-muted-foreground ml-auto text-xs">
          {rows.length} of {tickets.length}
        </div>
      </div>
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
            <tr>
              {[
                "Ticket",
                "Department / category",
                showRequester ? "Requester" : null,
                showAssignee ? "Assignee" : null,
                "Priority",
                "Status",
                "SLA",
                "Updated",
              ]
                .filter(Boolean)
                .map((h) => (
                  <th key={h} className="p-3 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="max-w-[340px] p-3">
                  <Link
                    href={buildHref({ to: "/helpdesk/tickets/$id", params: { id: t.id } })}
                    className="hover:text-primary line-clamp-1 font-medium hover:underline"
                  >
                    {t.subject}
                  </Link>
                  <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
                    {t.id}
                    {t.attachments.length > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Paperclip className="h-3 w-3" />
                        {t.attachments.length}
                      </span>
                    )}
                    {t.watchers.length > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="h-3 w-3" />
                        {t.watchers.length}
                      </span>
                    )}
                    {t.channel !== "Portal" && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {t.channel}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div>{deptName(t.departmentId)}</div>
                  <div className="text-muted-foreground text-xs">{catName(t)}</div>
                </td>
                {showRequester && (
                  <td className="p-3">
                    {t.requesterName}
                    <div className="text-muted-foreground text-xs">{t.requesterDept}</div>
                  </td>
                )}
                {showAssignee && (
                  <td className="p-3">
                    {t.assigneeName ?? <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                )}
                <td className="p-3">
                  <Badge variant="outline" className={priorityTone(t.priority)}>
                    {t.priority}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={statusTone(t.status)}>
                    {t.status}
                  </Badge>
                </td>
                <td className="p-3">
                  <SlaChip t={t} />
                </td>
                <td className="text-muted-foreground p-3 text-xs whitespace-nowrap">
                  <span className="whitespace-nowrap">{fmtDate(t.updatedAt)}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted-foreground p-10 text-center">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Searchable person picker (requester on behalf of, watchers). */
export function PersonPicker({ exclude = [], onPick, placeholder = "Search people…" }) {
  const [q, setQ] = useState("");
  const people = useMemo(() => allPeople(), []);
  const hits =
    q.trim().length < 2
      ? []
      : people
          .filter(
            (p) =>
              !exclude.includes(p.id) &&
              `${p.name} ${p.id} ${p.dept} ${p.email}`.toLowerCase().includes(q.toLowerCase()),
          )
          .slice(0, 6);
  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />

      {hits.length > 0 && (
        <div className="border-border bg-card shadow-premium absolute z-20 mt-1 w-full rounded-lg border">
          {hits.map((p) => (
            <button
              key={p.id}
              type="button"
              className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              onClick={() => {
                onPick(p);
                setQ("");
              }}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground text-xs">
                {p.designation} · {p.dept}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
