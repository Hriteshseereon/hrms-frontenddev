import Link from "@/lib/router";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  KeyRound,
  UserPlus,
  ShieldCheck,
  Lock,
  Unlock,
  RefreshCw,
  Ban,
  CheckCircle2,
  LogOut,
  Search,
  Download,
  Fingerprint,
  History,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollTabsList } from "@/components/common/ScrollTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clickableRow } from "@/components/common/RecordDetail";
import { Field, KV, EmployeePicker } from "@/features/employees/components/CasePieces";
import {
  useCurrentUser,
  ROLE_ORDER,
  ROLE_SUMMARY,
  SEEREON_USERS,
  userById,
} from "@/features/auth/data/auth-session";
import { useActiveOrgId, useOrgs } from "@/features/organization/data/group-data";
import { useDepartments } from "@/features/organization/data/dept-data";
import { ALL_MANAGED_BRANCHES } from "@/features/organization/data/branch-session";
import { exportCsv, exportReportPdf } from "@/lib/export-utils";
import {
  useRoles,
  useLogins,
  useLoginUsers,
  loginOf,
  resetPassword,
  suspendUser,
  reactivateUser,
  unlockUser,
  revokeSessions,
  setMfa,
  grantRbacRole,
  revokeRbacRole,
  inviteUser,
  resendInvite,
  roleActionGroups,
  roleScreens,
  signInPolicyStore,
} from "@/features/auth/data/rbac-store";
import { useScopeMatch } from "@/features/organization/data/tenancy";

const statusTone = {
  Active: "border-primary/30 bg-primary/10 text-primary",
  Invited: "border-gold/40 bg-gold/15 text-gold",
  Suspended: "border-destructive/30 bg-destructive/10 text-destructive",
  Locked: "border-destructive/30 bg-destructive/10 text-destructive",
};
// Sign-in times are stored as UTC instants; render them in IST so the server and the browser print the same text.
const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "Never";

/** Seeded accounts — the only ones the server knows about. Runtime accounts (invited, hired, tenant admins) are persisted in the browser. */
const SEEDED_IDS = new Set(SEEREON_USERS.map((u) => u.id));
const noopSubscribe = () => () => {};
/** false on the server and during the hydration render, true afterwards. */
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

function UsersPage() {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const orgs = useOrgs();
  const allUsers = useLoginUsers();
  // `useLoginUsers` merges browser-persisted accounts through non-reactive store reads, so during hydration the
  // client would list more rows than the server rendered. Render the seeded accounts first and add the persisted
  // ones right after hydration, keeping server and client markup identical.
  const hydrated = useHydrated();
  const users = useMemo(
    () => (hydrated ? allUsers : allUsers.filter((u) => SEEDED_IDS.has(u.id))),
    [allUsers, hydrated],
  );
  const logins = useLogins();
  const roles = useRoles();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [portal, setPortal] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const isSuper = me.role === "SuperAdmin";
  // Same rule as the account actions inside the detail dialog — inviting creates a login and can grant RBAC roles.
  const canManage = isSuper || me.role === "Admin" || me.role === "CHRO";

  // Only this organisation's accounts, narrowed to the working scope (collective view, company or branch). A Super
  // Admin used to see every account of every client organisation on the platform.
  const inScope = useScopeMatch();
  const scoped = useMemo(
    () => users.filter((u) => inScope(u.orgId, null, u.branch)),
    [users, inScope],
  );
  const rows = scoped.filter((u) => {
    const l = logins[u.id] ?? loginOf(u.id);
    return (
      (role === "all" || u.role === role) &&
      (status === "all" || l.status === status) &&
      (portal === "all" || u.portal === portal) &&
      (!q ||
        `${u.name} ${u.id} ${u.email} ${u.designation} ${u.dept} ${u.branch}`
          .toLowerCase()
          .includes(q.toLowerCase()))
    );
  });
  const detail = users.find((u) => u.id === detailId) ?? null;
  const kpi = {
    total: scoped.length,
    active: scoped.filter((u) => (logins[u.id]?.status ?? "Active") === "Active").length,
    invited: scoped.filter((u) => logins[u.id]?.status === "Invited").length,
    locked: scoped.filter(
      (u) => logins[u.id]?.status === "Locked" || logins[u.id]?.status === "Suspended",
    ).length,
    mfa: scoped.filter((u) => logins[u.id]?.mfa).length,
  };
  const cols = [
    "User",
    "Name",
    "Email / login",
    "App role",
    "RBAC roles",
    "Company",
    "Branch",
    "Portal",
    "Status",
    "MFA",
    "Last login",
  ];
  const exportRows = rows.map((u) => {
    const l = logins[u.id] ?? loginOf(u.id);
    return [
      u.id,
      u.name,
      u.email,
      u.role,
      roles
        .filter((r) => (r.assignedUsers[u.id] ?? []).length)
        .map((r) => r.name)
        .join(", ") || "—",
      orgs.find((o) => o.id === u.orgId)?.name ?? u.orgId,
      u.branch,
      u.portal,
      l.status,
      l.mfa ? "On" : "Off",
      fmt(l.lastLogin),
    ];
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="text-primary h-6 w-6" /> Users &amp; Logins
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every account that can sign in to{" "}
            {isSuper ? "the group" : (orgs.find((o) => o.id === orgId)?.name ?? "this company")} —
            app role (what they can do), RBAC roles (which screens), MFA, sessions, lock / suspend,
            password reset and invitations. Roles themselves are designed in{" "}
            <Link href="/org/roles" className="text-primary underline">
              Roles &amp; Permissions
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportCsv("users-logins", cols, exportRows);
              toast.success("CSV exported");
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportReportPdf({
                title: "Users & Logins",
                subtitle: "Accounts, roles, MFA and last sign-in",
                summary: [
                  { label: "Accounts", value: String(kpi.total) },
                  { label: "Active", value: String(kpi.active) },
                  { label: "Invited", value: String(kpi.invited) },
                  { label: "Locked / suspended", value: String(kpi.locked) },
                  { label: "MFA on", value: String(kpi.mfa) },
                ],
                columns: cols,
                rows: exportRows,
              })
            }
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          {canManage && (
            <Button
              size="sm"
              className="bg-gradient-emerald shadow-premium text-white"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Invite user
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Accounts", kpi.total],
          ["Active", kpi.active],
          ["Invited", kpi.invited],
          ["Locked / suspended", kpi.locked],
          ["MFA enforced", kpi.mfa],
        ].map(([l, v]) => (
          <Card key={String(l)} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">{l}</div>
              <div className="mt-1 text-xl font-bold">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users">
        <ScrollTabsList>
          <TabsTrigger value="users">
            <KeyRound className="h-4 w-4" /> Accounts
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History className="h-4 w-4" /> Login activity
          </TabsTrigger>
          <TabsTrigger value="policy">
            <Fingerprint className="h-4 w-4" /> Sign-in policy
          </TabsTrigger>
        </ScrollTabsList>

        <TabsContent value="users" className="space-y-4 pt-4">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, ID, email, department"
                  className="w-full pl-8 sm:w-64"
                />
              </div>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All app roles</SelectItem>
                  {ROLE_ORDER.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["Active", "Invited", "Suspended", "Locked"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={portal} onValueChange={setPortal}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All portals</SelectItem>
                  <SelectItem value="org">Admin portal</SelectItem>
                  <SelectItem value="emp">Employee portal</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-muted-foreground ml-auto text-xs">
                {rows.length} of {scoped.length}
              </span>
            </CardContent>
          </Card>
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {[
                      "User",
                      "Login",
                      "App role",
                      "RBAC roles",
                      "Company · branch",
                      "Portal",
                      "MFA",
                      "Last sign-in",
                      "Status",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((u) => {
                    const l = logins[u.id] ?? loginOf(u.id);
                    const rb = roles.filter((r) => (r.assignedUsers[u.id] ?? []).length);
                    return (
                      <tr key={u.id} className={clickableRow} onClick={() => setDetailId(u.id)}>
                        <td className="p-3">
                          <div className="font-semibold">{u.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {u.id} · {u.designation}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {u.email}
                          {l.mustReset && (
                            <div className="text-gold text-[10px]">password reset pending</div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{u.role}</Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {rb.length ? (
                            rb.map((r) => r.name).join(", ")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          {orgs.find((o) => o.id === u.orgId)?.name ?? u.orgId}
                          <div className="text-muted-foreground">{u.branch}</div>
                        </td>
                        <td className="p-3 text-xs">{u.portal === "org" ? "Admin" : "Employee"}</td>
                        <td className="p-3">
                          {l.mfa ? (
                            <ShieldCheck className="text-primary h-4 w-4" />
                          ) : (
                            <span className="text-muted-foreground text-xs">Off</span>
                          )}
                        </td>
                        <td className="p-3 text-xs whitespace-nowrap">
                          {fmt(l.lastLogin)}
                          {l.lastDevice && (
                            <div className="text-muted-foreground">{l.lastDevice}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={statusTone[l.status]}>
                            {l.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-muted-foreground p-8 text-center text-sm">
                        No accounts match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                  <tr>
                    {["When", "User", "Event", "By", "Device / IP"].map((h) => (
                      <th key={h} className="p-3 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {scoped
                    .flatMap((u) => {
                      const l = logins[u.id] ?? loginOf(u.id);
                      return [
                        ...(l.lastLogin
                          ? [
                              {
                                at: l.lastLogin,
                                user: u,
                                event: "Signed in",
                                by: u.name,
                                dev: `${l.lastDevice ?? "—"} · ${l.lastIp ?? "—"}`,
                              },
                            ]
                          : []),
                        ...l.history.map((h) => ({
                          at: h.at,
                          user: u,
                          event: h.action,
                          by: h.by,
                          dev: "—",
                        })),
                      ];
                    })
                    .sort((a, b) => (a.at < b.at ? 1 : -1))
                    .slice(0, 80)
                    .map((e, i) => (
                      <tr key={i} className={clickableRow} onClick={() => setDetailId(e.user.id)}>
                        <td className="p-3 text-xs whitespace-nowrap">
                          {e.at.length > 10 ? fmt(e.at) : e.at}
                        </td>
                        <td className="p-3 font-medium">
                          {e.user.name}
                          <div className="text-muted-foreground text-xs font-normal">
                            {e.user.id}
                          </div>
                        </td>
                        <td className="p-3">{e.event}</td>
                        <td className="p-3 text-xs">{e.by}</td>
                        <td className="text-muted-foreground p-3 text-xs">{e.dev}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="pt-4">
          <SignInPolicy />
        </TabsContent>
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {detail && <UserDetail user={detail} login={logins[detail.id] ?? loginOf(detail.id)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {inviteOpen && (
            <InviteForm
              onDone={(id) => {
                setInviteOpen(false);
                if (id) setDetailId(id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Who may run account actions (reset, suspend, MFA, grant roles) on whom. */
const PROTECTED = { SuperAdmin: [], Admin: ["SuperAdmin"], CHRO: ["SuperAdmin", "Admin", "CEO"] };
function canManageAccount(actor, target) {
  const blocked = PROTECTED[actor];
  return !!blocked && !blocked.includes(target);
}

function UserDetail({ user, login }) {
  const me = useCurrentUser();
  const roles = useRoles();
  const orgs = useOrgs();
  const [reason, setReason] = useState("");
  const [grantRole, setGrantRole] = useState("");
  const [grantBranches, setGrantBranches] = useState([]);
  const [temp, setTemp] = useState(null);
  const mine = roles.filter((r) => (r.assignedUsers[user.id] ?? []).length);
  const actionGroups = roleActionGroups(user.role);
  // Account actions on this person: an entity Admin / CHRO must not reset the password of (and so take over) the group
  // Super Admin, and a CHRO must not take over an Admin or the CEO — every account in the company used to be fair game.
  const canManage = canManageAccount(me.role, user.role);
  const branchName = (id) =>
    orgs.flatMap((o) => o.branches ?? []).find((b) => b.id === id)?.name ??
    ALL_MANAGED_BRANCHES.find((b) => b.id === id)?.name ??
    id;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="text-primary h-5 w-5" /> {user.name}
        </DialogTitle>
        <DialogDescription>
          {user.id} · {user.designation} · {user.dept} ·{" "}
          {orgs.find((o) => o.id === user.orgId)?.name ?? user.orgId} · {user.branch}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusTone[login.status]}>
            {login.status}
          </Badge>
          <Badge variant="outline">{user.role}</Badge>
          <Badge variant="outline">
            {user.portal === "org" ? "Admin portal" : "Employee portal"}
          </Badge>
          {login.mfa && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              <ShieldCheck className="h-3 w-3" /> MFA
            </Badge>
          )}
          {login.mustReset && (
            <Badge variant="outline" className="border-gold/50 text-gold">
              Password reset pending
            </Badge>
          )}
        </div>
        <KV
          items={[
            ["Login (email)", user.email],
            ["Phone", user.phone || "—"],
            [
              "Reports to",
              user.managerId ? (userById(user.managerId)?.name ?? user.managerId) : "—",
            ],
            [
              "Last sign-in",
              `${fmt(login.lastLogin)}${login.lastDevice ? ` · ${login.lastDevice}` : ""}${login.lastIp ? ` · ${login.lastIp}` : ""}`,
            ],
            ["Active sessions", String(login.sessions)],
            ["Failed attempts", String(login.failedAttempts)],
            ["Password changed", login.passwordChangedOn ?? "—"],
            ["Invited", login.invitedOn ? `${login.invitedOn} by ${login.invitedBy}` : "—"],
          ]}
        />

        {canManage && (
          <div className="border-border space-y-3 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Account actions
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const t = resetPassword(user.id, me.name);
                  if (!t)
                    return toast.error("Could not issue a temporary password for this account");
                  setTemp(t);
                  toast.success("Temporary password issued");
                }}
              >
                <RefreshCw className="h-4 w-4" /> Reset password
              </Button>
              {login.status === "Locked" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    unlockUser(user.id, me.name);
                    toast.success("Unlocked");
                  }}
                >
                  <Unlock className="h-4 w-4" /> Unlock
                </Button>
              )}
              {login.status === "Suspended" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    reactivateUser(user.id, me.name);
                    toast.success("Reactivated");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Reactivate
                </Button>
              ) : (
                login.status !== "Invited" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={!reason.trim() || user.id === me.id}
                    onClick={() => {
                      suspendUser(user.id, me.name, reason.trim());
                      setReason("");
                      toast.success("Suspended — sessions revoked");
                    }}
                  >
                    <Ban className="h-4 w-4" /> Suspend
                  </Button>
                )
              )}
              {login.status === "Invited" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resendInvite(user.id, me.name);
                    toast.success("Invitation re-sent");
                  }}
                >
                  <Mail className="h-4 w-4" /> Resend invite
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!login.sessions}
                onClick={() => {
                  revokeSessions(user.id, me.name);
                  toast.success("All sessions signed out");
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out everywhere
              </Button>
              <label className="ml-auto flex items-center gap-2 text-sm">
                <Switch
                  checked={login.mfa}
                  onCheckedChange={(v) => {
                    setMfa(user.id, v, me.name);
                    toast.success(v ? "MFA enforced" : "MFA relaxed");
                  }}
                />{" "}
                Enforce MFA
              </label>
            </div>
            {login.status !== "Suspended" && login.status !== "Invited" && (
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for suspension (required to suspend)"
                className="h-8"
              />
            )}
            {temp && (
              <div className="bg-gold/10 border-gold/40 rounded-lg border p-3 text-sm">
                Temporary password for {user.name}:{" "}
                <span className="font-mono font-semibold">{temp}</span> — share securely; they must
                change it at next sign-in.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              App role — what {user.name.split(" ")[0]} can do
            </div>
            <div className="text-sm font-medium">
              {user.role}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · {ROLE_SUMMARY[user.role]?.scope}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">{ROLE_SUMMARY[user.role]?.description}</p>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {actionGroups.map((g) => (
                <div key={g.module} className="text-xs">
                  <span className="font-semibold capitalize">{g.module}</span>:{" "}
                  <span className="text-muted-foreground">{g.actions.join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-border space-y-2 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              RBAC roles — which screens
            </div>
            {mine.length === 0 && (
              <div className="text-muted-foreground text-sm">
                No RBAC role granted — screens follow the app role only.
              </div>
            )}
            {mine.map((r) => (
              <div key={r.id} className="border-border rounded-lg border p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground text-xs">
                    · {roleScreens(r).length} screens ·{" "}
                    {(r.assignedUsers[user.id] ?? []).map(branchName).join(", ")}
                  </span>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive ml-auto h-7"
                      onClick={() => {
                        revokeRbacRole(user.id, r.id, me.name);
                        toast.success("Role revoked");
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
                <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {roleScreens(r)
                    .slice(0, 8)
                    .map((s) => `${s.screen} (${s.actions.map((a) => a[0]).join("")})`)
                    .join(", ")}
                  {roleScreens(r).length > 8 ? " …" : ""}
                </div>
              </div>
            ))}
            {canManage && (
              <div className="border-border space-y-2 border-t pt-3">
                <Select value={grantRole} onValueChange={setGrantRole}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Grant an RBAC role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((r) => r.status === "Active" && !mine.some((m) => m.id === r.id))
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} · {r.screens} screens
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {grantRole && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(roles.find((r) => r.id === grantRole)?.branches ?? []).map((b) => (
                      <label key={b} className="flex items-center gap-1.5">
                        <Checkbox
                          checked={grantBranches.includes(b)}
                          onCheckedChange={(v) =>
                            setGrantBranches((p) => (v ? [...p, b] : p.filter((x) => x !== b)))
                          }
                        />
                        {branchName(b)}
                      </label>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  className="bg-gradient-emerald text-white"
                  disabled={!grantRole || !grantBranches.length}
                  onClick={() => {
                    grantRbacRole(user.id, grantRole, grantBranches, me.name);
                    setGrantRole("");
                    setGrantBranches([]);
                    toast.success("Role granted");
                  }}
                >
                  Grant role
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
            <History className="h-3.5 w-3.5" /> Account history
          </div>
          {login.history.map((h, i) => (
            <div key={i} className="border-border rounded-lg border p-2.5 text-sm">
              <div className="text-muted-foreground text-xs">
                {h.at} · {h.by}
              </div>
              <div>{h.action}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function InviteForm({ onDone }) {
  const me = useCurrentUser();
  const orgId = useActiveOrgId();
  const orgs = useOrgs();
  const departments = useDepartments();
  const roles = useRoles();
  const existingUsers = useLoginUsers();
  const [f, setF] = useState({
    name: "",
    email: "",
    role: "Employee",
    designation: "",
    dept: departments.find((d) => d.orgId === orgId)?.name ?? "",
    // The company's own branches (the static demo list — "Whitefield", "BKC" — matched no real branch, so invited
    // people never appeared in branch-scoped views).
    branch: "",
    branchId: "",
    orgId,
    phone: "",
    managerId: "",
    roleIds: [],
    branches: [],
    message: "",
  });
  const set = (p) => setF((v) => ({ ...v, ...p }));
  // The e-mail is the login — a second account on the same address would be unreachable at sign-in.
  const emailTaken = existingUsers.some(
    (u) => u.email.toLowerCase() === f.email.trim().toLowerCase(),
  );
  const companyBranches = (orgs.find((o) => o.id === f.orgId)?.branches ?? []).filter(
    (b) => !b.hidden && b.status !== "Inactive",
  );
  const companyDepartments = departments.filter((d) => d.orgId === f.orgId);
  const valid =
    f.name.trim() &&
    /\S+@\S+\.\S+/.test(f.email) &&
    !emailTaken &&
    f.designation.trim() &&
    // A Branch Admin is locked to one branch — without it they would see the whole company.
    (f.role !== "BranchAdmin" || !!f.branchId);
  // Only roles the inviter could manage afterwards (a CHRO used to be able to invite a new Admin or CEO).
  const allowedRoles = ROLE_ORDER.filter((r) => canManageAccount(me.role, r));
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserPlus className="text-primary h-5 w-5" /> Invite a user
        </DialogTitle>
        <DialogDescription>
          Creates the login, sends a welcome invitation and (optionally) grants RBAC roles on
          selected branches. The person signs in with the temporary password and must reset it.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Full name" required>
          <Input value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field
          label="Work email (login)"
          required
          hint={emailTaken ? "An account already exists for this e-mail" : undefined}
        >
          <Input
            type="email"
            value={f.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="name@seereon.co.in"
          />
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="App role" required hint={ROLE_SUMMARY[f.role]?.scope}>
          <Select value={f.role} onValueChange={(v) => set({ role: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Designation" required>
          <Input value={f.designation} onChange={(e) => set({ designation: e.target.value })} />
        </Field>
        <Field label="Department">
          <Select value={f.dept} onValueChange={(v) => set({ dept: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {companyDepartments.map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Company">
          <Select
            value={f.orgId}
            onValueChange={(v) =>
              set({
                orgId: v,
                branch: "",
                branchId: "",
                branches: [],
                dept: departments.find((d) => d.orgId === v)?.name ?? "",
              })
            }
            disabled={me.role !== "SuperAdmin"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Branch" required={f.role === "BranchAdmin"}>
          <Select
            value={f.branchId}
            onValueChange={(v) =>
              set({ branchId: v, branch: companyBranches.find((b) => b.id === v)?.name ?? "" })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={companyBranches.length ? "Select branch" : "Head office"} />
            </SelectTrigger>
            <SelectContent>
              {companyBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reporting manager">
          <EmployeePicker value={f.managerId} onChange={(id) => set({ managerId: id })} />
        </Field>
        <div className="border-border space-y-2 rounded-lg border p-3 sm:col-span-2 lg:col-span-3">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            RBAC roles (optional) — which screens beyond the app role
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {roles
              .filter((r) => r.status === "Active")
              .map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={f.roleIds.includes(r.id)}
                    onCheckedChange={(v) =>
                      set({
                        roleIds: v ? [...f.roleIds, r.id] : f.roleIds.filter((x) => x !== r.id),
                      })
                    }
                  />
                  {r.name}{" "}
                  <span className="text-muted-foreground text-xs">· {r.screens} screens</span>
                </label>
              ))}
          </div>
          {f.roleIds.length > 0 && (
            <div className="border-border flex flex-wrap gap-2 border-t pt-2 text-xs">
              {(orgs.find((o) => o.id === f.orgId)?.branches ?? [])
                .filter((b) => b.status !== "Inactive")
                .map((b) => (
                  <label key={b.id} className="flex items-center gap-1.5">
                    <Checkbox
                      checked={f.branches.includes(b.id)}
                      onCheckedChange={(v) =>
                        set({
                          branches: v
                            ? [...f.branches, b.id]
                            : f.branches.filter((x) => x !== b.id),
                        })
                      }
                    />
                    {b.hidden ? "Head Office" : b.name}
                  </label>
                ))}
            </div>
          )}
        </div>
        <Field label="Message in the invitation" className="sm:col-span-2 lg:col-span-3">
          <Textarea
            rows={2}
            value={f.message}
            onChange={(e) => set({ message: e.target.value })}
            placeholder="Welcome to Seereon HRMS — sign in with the temporary password and complete your profile."
          />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          disabled={!valid || (f.roleIds.length > 0 && f.branches.length === 0)}
          className="bg-gradient-emerald text-white"
          onClick={() => {
            let u;
            try {
              u = inviteUser(
                {
                  name: f.name.trim(),
                  email: f.email.trim(),
                  role: f.role,
                  designation: f.designation.trim(),
                  dept: f.dept,
                  branch: f.branch || orgs.find((o) => o.id === f.orgId)?.branches?.[0]?.name || "",
                  branchId: f.role === "BranchAdmin" ? f.branchId : undefined,
                  orgId: f.orgId,
                  groupId: orgs.find((o) => o.id === f.orgId)?.groupId ?? undefined,
                  phone: f.phone.trim(),
                  managerId: f.managerId || null,
                  roleIds: f.roleIds,
                  branches: f.branches,
                },
                me.name,
              );
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not create the invitation");
              return;
            }
            toast.success(`Invitation sent to ${u.email} · temporary password Welcome@123`);
            onDone(u.id);
          }}
        >
          Send invitation
        </Button>
      </DialogFooter>
    </>
  );
}

// The saved policy lives in rbac-store: password rules and the lock-out threshold are enforced from it at sign-in,
// password change, forgot-password reset and admin-issued passwords.

function SignInPolicy() {
  const me = useCurrentUser();
  const saved = signInPolicyStore.use();
  const [p, setP] = useState(saved);
  // The persisted policy arrives after hydration (the server renders the defaults) — refresh the draft from it.
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    setP(saved);
  }
  const set = (patch) => setP((v) => ({ ...v, ...patch }));
  // Company sign-in security is an administrator decision (HR could open this tab and relax the password rules).
  const canEdit = me.role === "SuperAdmin" || me.role === "Admin";
  const invalid =
    p.minLen < 6 ||
    p.lockAfter < 3 ||
    p.lockMinutes < 5 ||
    p.sessionMinutes < 5 ||
    p.expiryDays < 0 ||
    p.rememberDays < 0;
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="font-semibold">Sign-in policy</div>
          <div className="text-muted-foreground text-xs">
            Applies to every account in this company. Enforced at sign-in and on password change.
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="border-border space-y-3 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Password rules
            </div>
            <Field label="Minimum length">
              <Input
                type="number"
                min={6}
                value={p.minLen}
                onChange={(e) => set({ minLen: Number(e.target.value) })}
                className="w-28"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={p.upper} onCheckedChange={(v) => set({ upper: v })} /> Require an
              uppercase letter
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={p.number} onCheckedChange={(v) => set({ number: v })} /> Require a
              number
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={p.symbol} onCheckedChange={(v) => set({ symbol: v })} /> Require a
              symbol
            </label>
            <Field label="Expire passwords after (days)">
              <Input
                type="number"
                min={0}
                value={p.expiryDays}
                onChange={(e) => set({ expiryDays: Number(e.target.value) })}
                className="w-28"
              />
            </Field>
          </div>
          <div className="border-border space-y-3 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Lockout, MFA & sessions
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lock after failed attempts">
                <Input
                  type="number"
                  min={3}
                  value={p.lockAfter}
                  onChange={(e) => set({ lockAfter: Number(e.target.value) })}
                />
              </Field>
              <Field label="Lock duration (minutes)">
                <Input
                  type="number"
                  min={5}
                  value={p.lockMinutes}
                  onChange={(e) => set({ lockMinutes: Number(e.target.value) })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={p.mfaAdmins} onCheckedChange={(v) => set({ mfaAdmins: v })} /> MFA
              mandatory for admin-portal roles
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={p.mfaAll} onCheckedChange={(v) => set({ mfaAll: v })} /> MFA
              mandatory for everyone
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Idle session timeout (minutes)">
                <Input
                  type="number"
                  min={5}
                  value={p.sessionMinutes}
                  onChange={(e) => set({ sessionMinutes: Number(e.target.value) })}
                />
              </Field>
              <Field label="Remember device (days)">
                <Input
                  type="number"
                  min={0}
                  value={p.rememberDays}
                  onChange={(e) => set({ rememberDays: Number(e.target.value) })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={p.sso} onCheckedChange={(v) => set({ sso: v })} /> Prefer SSO (SAML /
              OIDC) when configured in Settings → Security
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-muted-foreground text-xs">
            {saved.updatedOn
              ? `Updated ${saved.updatedOn} by ${saved.updatedBy}`
              : "Default policy — not yet saved"}
            {invalid && (
              <span className="text-destructive">
                {" "}
                · check the minimums (length ≥ 6, lock after ≥ 3 attempts, durations ≥ 5 min)
              </span>
            )}
          </div>
          <Button
            className="bg-gradient-emerald text-white"
            disabled={invalid || !canEdit}
            title={
              canEdit ? undefined : "Only the Super Admin / Admin can change the sign-in policy"
            }
            onClick={() => {
              signInPolicyStore.set({
                ...p,
                updatedOn: new Date().toISOString().slice(0, 10),
                updatedBy: me.name,
              });
              toast.success("Sign-in policy saved");
            }}
          >
            <Lock className="h-4 w-4" /> Save policy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default UsersPage;
