import { useCallback, useMemo, useState } from "react";
import { Network, Crown, Mail, Phone, ArrowUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useManagerMap } from "@/features/organization/data/manager-data";
import {
  buildOrgTree,
  pathToNode,
  visibleContactIds,
} from "@/features/organization/data/org-hierarchy";
import { findEmployee, initials } from "@/features/employees/data/employee-directory";
import { useCurrentUser, userById, allUsers } from "@/features/auth/data/auth-session";
import { useHrPartnerMap } from "@/features/organization/data/hr-partner";
import { hodOfDepartment, useDepartments } from "@/features/organization/data/dept-data";

function NodeCard({ node, highlight, onPath, showContact }) {
  return (
    <div
      className={cn(
        "shadow-card relative inline-flex min-w-[190px] flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition",
        highlight
          ? "border-gold bg-gradient-emerald shadow-premium ring-gold/60 text-white ring-2"
          : onPath
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold",
            highlight ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {node.isEmployee ? initials(node.name) : <Crown className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{node.name}</div>
          <div
            className={cn(
              "truncate text-[11px]",
              highlight ? "text-white/75" : "text-muted-foreground",
            )}
          >
            {node.title}
          </div>
        </div>
      </div>
      {(node.dept || node.branch) && (
        <div
          className={cn("pl-9 text-[10px]", highlight ? "text-white/70" : "text-muted-foreground")}
        >
          {[node.dept, node.branch].filter(Boolean).join(" · ")}
        </div>
      )}
      {showContact && (node.email || node.phone) && (
        <div
          className={cn(
            "mt-1 space-y-0.5 border-t pt-1 pl-9 text-[10px]",
            highlight ? "border-white/25 text-white/85" : "border-border text-muted-foreground",
          )}
        >
          {node.email && (
            <div className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{node.email}</span>
            </div>
          )}
          {node.phone && (
            <div className="flex items-center gap-1 truncate">
              <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{node.phone}</span>
            </div>
          )}
        </div>
      )}
      {highlight && (
        <Badge
          variant="outline"
          className="border-gold bg-gold absolute -top-2 right-2 text-[10px] text-[oklch(0.2_0.02_85)]"
        >
          You are here
        </Badge>
      )}
    </div>
  );
}

function Branch({ node, targetId, path, contactIds }) {
  return (
    <li className="relative flex flex-col items-center">
      <NodeCard
        node={node}
        highlight={node.id === targetId}
        onPath={path.includes(node.id)}
        showContact={contactIds.has(node.id)}
      />

      {node.children.length > 0 && (
        <>
          <span className="bg-border h-5 w-px" />
          <ul className="before:bg-border relative flex gap-6 pt-5 before:absolute before:top-0 before:left-1/2 before:h-px before:w-[calc(100%-11rem)] before:-translate-x-1/2">
            {node.children.map((c) => (
              <div key={c.id} className="relative flex flex-col items-center">
                <span className="bg-border absolute -top-5 h-5 w-px" />
                <ul>
                  <Branch node={c} targetId={targetId} path={path} contactIds={contactIds} />
                </ul>
              </div>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

/**
 * Employee-scoped reporting line: an employee sees only the people who matter to them — their reporting manager, the department head and their HR partner (plus their own direct reports if they manage anyone). The full org chart is reserved for HR, admins and CXOs.
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} name
 * @property {string} [role]
 * @property {string} [designation]
 * @property {string} [dept]
 * @property {string} [branch]
 * @property {string} [email]
 * @property {string} [phone]
 */
const resolvePerson = (id) => (id ? (userById(id) ?? findEmployee(id) ?? null) : null);

function MyReportingLine({ employee }) {
  const map = useManagerMap();
  const partners = useHrPartnerMap();
  const managerOf = useCallback((id) => map[id] ?? userById(id)?.managerId ?? null, [map]);
  /** Item 27 — click upward: the focused person's card shows whom THEY report to, all the way to the top. */
  const [focusId, setFocusId] = useState(employee.id);
  const chainUp = useMemo(() => {
    const out = [];
    let cur = managerOf(focusId);
    const seen = new Set([focusId]);
    while (cur && !seen.has(cur)) {
      const p = resolvePerson(cur);
      if (!p) break;
      out.push(p);
      seen.add(cur);
      cur = managerOf(cur);
    }
    return out;
  }, [focusId, managerOf]);
  const trail = useMemo(() => {
    const out = [];
    let cur = employee.id;
    const seen = new Set();
    while (cur && cur !== focusId && !seen.has(cur)) {
      const p = resolvePerson(cur);
      if (!p) break;
      out.push(p);
      seen.add(cur);
      cur = managerOf(cur);
    }
    return out;
  }, [focusId, employee.id, managerOf]);
  const focus = focusId === employee.id ? employee : resolvePerson(focusId);
  const managerId = managerOf(employee.id);
  const manager = resolvePerson(managerId);
  useDepartments();
  // The department master is the HOD source every approval uses; the role lookup ignored the entity (same-named
  // departments exist in several companies) and ignored reassignments.
  const masterHod = hodOfDepartment(employee.dept, employee.orgId);
  const hod =
    (masterHod && masterHod.id !== employee.id ? masterHod : null) ??
    allUsers().find(
      (u) =>
        u.role === "HOD" &&
        u.dept === employee.dept &&
        u.orgId === employee.orgId &&
        u.id !== employee.id,
    ) ??
    null;
  const partnerId = partners[employee.id] ?? userById(employee.id)?.hrPartnerId ?? null;
  const partner = partnerId ? userById(partnerId) : null;
  const reports = Object.entries(map)
    .filter(([, m]) => m === employee.id)
    .map(([id]) => findEmployee(id) ?? userById(id))
    .filter(Boolean);
  const person = (p, label) => (
    <div className="border-border bg-card shadow-card rounded-xl border p-4">
      <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </div>
      {p ? (
        <div className="flex items-start gap-3">
          <span className="bg-gradient-emerald grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white">
            {initials(p.name)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{p.name}</div>
            <div className="text-muted-foreground truncate text-xs">
              {("designation" in p && p.designation) || p.role} · {p.dept}
            </div>
            {p.email && (
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[11px]">
                <Mail className="h-3 w-3" />
                {p.email}
              </div>
            )}
            {p.phone && (
              <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Phone className="h-3 w-3" />
                {p.phone}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">Not assigned</div>
      )}
    </div>
  );
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Network className="text-primary h-4 w-4" /> My reporting line
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            The people responsible for your approvals and support. The wider organisation chart is
            available to HR.
          </p>
        </div>
        {trail.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setFocusId(employee.id)}
            >
              Back to {employee.name}
            </Button>
            {trail.map((t) => (
              <span key={t.id} className="text-muted-foreground flex items-center gap-1">
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => setFocusId(t.id)}
                >
                  {t.name}
                </button>
                <ChevronRight className="h-3 w-3" />
              </span>
            ))}
            <span className="font-semibold">{focus?.name}</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          {/* Upward chain — top of the organisation first, each card clickable to re-focus */}
          {[...chainUp].reverse().map((p, i, arr) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setFocusId(p.id)}
                className="border-border bg-card shadow-card hover:border-primary/50 hover:bg-primary/5 min-w-[240px] rounded-xl border p-3 text-left transition"
                title="Click to see whom this person reports to"
              >
                <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
                  {i === 0 ? (
                    <>
                      <Crown className="text-gold h-3 w-3" /> Top of organisation
                    </>
                  ) : (
                    `Level ${arr.length - i} up`
                  )}
                  <ArrowUp className="ml-auto h-3 w-3" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-gradient-emerald grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white">
                    {initials(p.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {p.designation || p.role} · {p.dept}
                    </div>
                  </div>
                </div>
              </button>
              <span className="bg-border h-5 w-px" />
            </div>
          ))}
          {chainUp.length === 0 && focusId !== employee.id && (
            <div className="text-muted-foreground text-xs">
              {focus?.name} is at the top of the organisation.
            </div>
          )}
          <div className="border-gold bg-gradient-emerald shadow-premium rounded-xl border-2 px-5 py-3 text-center text-white">
            <div className="text-sm font-semibold">{focus?.name}</div>
            <div className="text-[11px] text-white/75">
              {(focus?.designation || focus?.role) ?? ""} · {focus?.dept}
            </div>
            {focusId === employee.id && manager && (
              <div className="mt-1 text-[10px] text-white/70">
                Click any card above to walk up the reporting line
              </div>
            )}
          </div>
          {reports.length > 0 && (
            <>
              <span className="bg-border h-5 w-px" />
              <div className="flex flex-wrap justify-center gap-2">
                {reports.map(
                  (r) =>
                    r && (
                      <div key={r.id} className="border-border rounded-lg border px-3 py-2 text-xs">
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-muted-foreground">
                          {("designation" in r && r.designation) || r.role}
                        </div>
                      </div>
                    ),
                )}
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {person(hod, "Head of department")}
          {person(partner, "HR business partner")}
        </div>
      </CardContent>
    </Card>
  );
}

/** Full organization chart with the selected employee highlighted (HR / admin / CXO view). */
export function HierarchyTab({ employee }) {
  const me = useCurrentUser();
  const fullChart =
    ["SuperAdmin", "Admin", "CEO", "COO", "CFO", "CTO", "CHRO", "HR"].includes(me.role) &&
    me.id !== employee.id;
  if (!fullChart) return <MyReportingLine employee={employee} />;
  return <FullOrgChart employee={employee} />;
}

function FullOrgChart({ employee }) {
  const map = useManagerMap();
  const tree = useMemo(() => buildOrgTree(map), [map]);
  const path = useMemo(() => pathToNode(tree, employee.id), [tree, employee.id]);
  const contactIds = useMemo(() => visibleContactIds(tree, employee.id), [tree, employee.id]);

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Network className="text-primary h-4 w-4" /> Organization hierarchy
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Reporting line from the Board of Directors down to every team. Contact details are
            visible for {employee.name} and everyone in their reporting line.
            {path.length > 1 && ` ${employee.name} sits at level ${path.length} of the structure.`}
          </p>
        </div>

        {path.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {path.map((id, i) => {
              const label = findLabel(tree, id);
              return (
                <span key={id} className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={
                      i === path.length - 1
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-primary/30 bg-primary/10 text-primary"
                    }
                  >
                    {label}
                  </Badge>
                  {i < path.length - 1 && <span className="text-muted-foreground">›</span>}
                </span>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto pb-4">
          <ul className="flex min-w-max justify-center px-4 pt-2">
            <Branch node={tree} targetId={employee.id} path={path} contactIds={contactIds} />
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function findLabel(node, id) {
  if (node.id === id) return node.name;
  for (const c of node.children) {
    const l = findLabel(c, id);
    if (l) return l;
  }
  return "";
}
