// Global search (⌘K / Ctrl+K) in the top bar — one box that finds employees, screens, projects, tasks, assets,
// helpdesk tickets and document templates and jumps straight to them. Module-level search bars stay inside modules.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import {
  Search,
  Command as CommandIcon,
  Users,
  LayoutGrid,
  FolderKanban,
  ListTodo,
  Boxes,
  LifeBuoy,
  FileText,
  ArrowRight,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser, canOpenPath } from "@/features/auth/data/auth-session";
import { useDirectory } from "@/features/employees/data/employee-directory";
import { ORG_NAV_GROUPS, orgNavVisible } from "@/components/layout/OrgSidebar";
import { EMP_NAV_ITEMS } from "@/components/layout/EmpSidebar";
import { useProjects } from "@/features/projects/data/project-data";
import { useTasks } from "@/features/projects/data/task-data";
import { useAssets } from "@/features/assets/data/asset-data";
import { canViewTicket, useTickets } from "@/features/helpdesk/data/helpdesk-data";
import { templateStore } from "@/features/organization/data/doc-templates";
import { useScopeMatch } from "@/features/organization/data/tenancy";

/**
 * @typedef {Object} Hit
 * @property {string} id
 * @property {string} group
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} to
 * @property {string} [badge]
 */

const flattenEmpNav = () =>
  EMP_NAV_ITEMS.flatMap((i) =>
    "children" in i
      ? i.children.map((c) => ({ to: c.to, label: `${i.label} › ${c.label}` }))
      : [{ to: i.to, label: i.label }],
  );

export function GlobalSearch({ portal }) {
  const router = useRouter();
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const directory = useDirectory();
  const projects = useProjects();
  const tasks = useTasks();
  const assets = useAssets();
  const tickets = useTickets();
  const templates = templateStore.use();
  // Tenant scope: employees and assets belong to an entity — search must not surface another company's records.
  // Working scope of the signed-in user — never another organisation, and the branch when one is chosen.
  const scopeMatch = useScopeMatch();
  const inScope = scopeMatch; // (recOrgId, empId?, branch?) — the scope filter for every result group

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isOrgUser = me.role !== "Employee";
  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const has = (...parts) => parts.filter(Boolean).join(" ").toLowerCase().includes(term);
    const out = [];
    // Screens (respecting role access)
    const screens = [
      ...(portal === "org" || isOrgUser
        ? ORG_NAV_GROUPS.flatMap((g) =>
            g.items
              .filter((i) => orgNavVisible(me.role, i))
              .map((i) => ({ to: i.to, label: i.label, group: g.label })),
          )
        : []),
      ...flattenEmpNav().map((i) => ({ to: i.to, label: i.label, group: "My workspace" })),
    ];
    screens
      .filter((s) => has(s.label, s.group) && canOpenPath(me.role, s.to))
      .slice(0, 6)
      .forEach((s) =>
        out.push({
          id: `scr:${s.to}`,
          group: "Screens",
          title: s.label,
          subtitle: s.group,
          to: s.to,
        }),
      );
    // Every entity hit links to a screen this role can open — otherwise the org-portal list for roles that have it,
    // or the person's own employee-portal list (filtered to their own records).
    const opens = (path) => isOrgUser && canOpenPath(me.role, path);
    const orgProjects = opens("/org/projects");
    const orgTasks = opens("/org/tasks");
    const orgAssets = opens("/org/assets");
    // Employees
    if (opens("/org/employees"))
      directory
        .filter(
          (e) =>
            inScope(e.orgId, null, e.branch) &&
            has(e.name, e.id, e.email, e.dept, e.role, e.branch),
        )
        .slice(0, 6)
        .forEach((e) =>
          out.push({
            id: `emp:${e.id}`,
            group: "Employees",
            title: e.name,
            subtitle: `${e.id} · ${e.role} · ${e.dept}`,
            to: `/org/employees?id=${e.id}`,
            badge: e.status,
          }),
        );
    // Projects & tasks
    projects
      .filter(
        (p) =>
          (orgProjects ||
            p.managerId === me.id ||
            (p.members ?? []).some((m) => m.empId === me.id)) &&
          has(p.name, p.code, p.client, p.manager),
      )
      .slice(0, 5)
      .forEach((p) =>
        out.push({
          id: `prj:${p.id}`,
          group: "Projects",
          title: p.name,
          subtitle: `${p.code} · ${p.client}`,
          to: orgProjects ? "/org/projects" : "/emp/projects",
          badge: p.status,
        }),
      );
    tasks
      .filter(
        (t) =>
          (orgTasks || t.assignees.includes(me.id)) && has(t.name, t.id, t.description, t.client),
      )
      .slice(0, 5)
      .forEach((t) =>
        out.push({
          id: `tsk:${t.id}`,
          group: "Tasks",
          title: t.name,
          subtitle: `${t.id} · due ${t.dueDate}`,
          to: orgTasks ? "/org/tasks" : "/emp/tasks",
          badge: t.status,
        }),
      );
    // Assets
    assets
      .filter(
        (a) =>
          (orgAssets ? inScope(a.orgId) : a.holderId === me.id) &&
          has(a.name, a.tag, a.serial, a.type, a.model),
      )
      .slice(0, 5)
      .forEach((a) =>
        out.push({
          id: `ast:${a.id}`,
          group: "Assets",
          title: `${a.tag} · ${a.name}`,
          subtitle: `${a.type} · ${a.serial}`,
          to: orgAssets ? "/org/assets" : "/emp/assets",
          badge: a.status,
        }),
      );
    // Tickets — only tickets this person may open (confidential grievances stay with the requester and HR desk).
    tickets
      .filter(
        (t) =>
          canViewTicket(me, t) &&
          (isOrgUser ? !t.orgId || inScope(t.orgId) : true) &&
          has(t.id, t.subject, t.requesterName),
      )
      .slice(0, 5)
      .forEach((t) =>
        out.push({
          id: `tkt:${t.id}`,
          group: "Helpdesk",
          title: t.subject,
          subtitle: `${t.id} · ${t.requesterName}`,
          to: `/helpdesk/tickets/${t.id}`,
          badge: t.status,
        }),
      );
    // Documents / templates
    if (opens("/org/masters"))
      templates
        .filter((d) => has(d.name, d.kind, d.subject))
        .slice(0, 4)
        .forEach((d) =>
          out.push({
            id: `doc:${d.id}`,
            group: "Documents",
            title: d.name,
            subtitle: `${d.kind} · ${d.subject}`,
            to: "/org/masters#docmaster",
          }),
        );
    return out;
  }, [q, directory, projects, tasks, assets, tickets, templates, me, isOrgUser, portal, inScope]);

  const groups = Array.from(new Set(hits.map((h) => h.group)));
  const icon = {
    Screens: LayoutGrid,
    Employees: Users,
    Projects: FolderKanban,
    Tasks: ListTodo,
    Assets: Boxes,
    Helpdesk: LifeBuoy,
    Documents: FileText,
  };
  const go = (h) => {
    setOpen(false);
    setQ("");
    const [pathAndQuery, hash] = h.to.split("#");
    const [path, query] = pathAndQuery.split("?");
    const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
    router.push(buildHref({ to: path, hash: hash || undefined, search: search }));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border bg-muted/40 hover:border-primary/40 hidden w-[260px] shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition xl:flex"
      >
        <Search className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground flex-1 truncate text-sm">Search everything…</span>
        <kbd className="border-border bg-background text-muted-foreground inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]">
          <CommandIcon className="h-3 w-3" />K
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="hover:bg-muted grid h-9 w-9 shrink-0 place-items-center rounded-lg xl:hidden"
      >
        <Search className="text-muted-foreground h-5 w-5" />
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQ("");
        }}
      >
        <DialogContent className="top-[12%] translate-y-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Global search</DialogTitle>
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
          >
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder="Search employees, screens, projects, tasks, assets, tickets, documents…"
            />
            <CommandList className="max-h-[60vh]">
              {q.trim().length < 2 && (
                <div className="text-muted-foreground p-4 text-xs">
                  Type at least two characters. Tip: try a name, an employee ID, an asset tag, a
                  ticket number or a screen name.
                </div>
              )}
              {q.trim().length >= 2 && hits.length === 0 && (
                <CommandEmpty>Nothing matches “{q}”.</CommandEmpty>
              )}
              {groups.map((g) => {
                const Icon = icon[g] ?? ArrowRight;
                return (
                  <CommandGroup key={g} heading={g}>
                    {hits
                      .filter((h) => h.group === g)
                      .map((h) => (
                        <CommandItem
                          key={h.id}
                          value={h.id}
                          onSelect={() => go(h)}
                          className="flex items-center gap-3"
                        >
                          <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{h.title}</div>
                            {h.subtitle && (
                              <div className="text-muted-foreground truncate text-xs">
                                {h.subtitle}
                              </div>
                            )}
                          </div>
                          {h.badge && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {h.badge}
                            </Badge>
                          )}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
