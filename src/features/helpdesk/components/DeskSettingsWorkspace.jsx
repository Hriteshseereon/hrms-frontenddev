import { useEffect, useState } from "react";
import { Settings2, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  PRIORITIES,
  allPeople,
  isHelpdeskAdmin,
  personById,
  saveHelpdeskConfig,
  useHelpdeskConfig,
} from "@/features/helpdesk/data/helpdesk-data";

export function DeskSettings() {
  const me = useCurrentUser();
  const saved = useHelpdeskConfig();
  const [d, setD] = useState(saved);
  const [deptId, setDeptId] = useState(saved.departments[0]?.id ?? "");
  const [addAgent, setAddAgent] = useState("");
  // The persisted config only arrives after hydration (the first render sees the seed) — re-seed the draft from it,
  // otherwise the page opened "dirty" against the stored settings and Discard replaced them with the defaults.
  useEffect(() => {
    setD(saved);
    setDeptId((cur) =>
      saved.departments.some((x) => x.id === cur) ? cur : (saved.departments[0]?.id ?? ""),
    );
  }, [saved]);
  const people = allPeople();
  if (!isHelpdeskAdmin(me))
    return (
      <Card className="shadow-card">
        <CardContent className="text-muted-foreground p-10 text-center">
          Desk settings are limited to helpdesk administrators (Super Admin, Admin, CEO, CTO, CHRO).
        </CardContent>
      </Card>
    );
  const dept = d.departments.find((x) => x.id === deptId);
  const setDept = (patch) =>
    setD({
      ...d,
      departments: d.departments.map((x) => (x.id === deptId ? { ...x, ...patch } : x)),
    });
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  // SLA hours must be positive with resolution no sooner than first response; prefix must be a clean token.
  const slaOk = d.sla.every(
    (x) => x.firstResponseHours > 0 && x.resolveHours > 0 && x.resolveHours >= x.firstResponseHours,
  );
  const prefixOk = /^[A-Z0-9][A-Z0-9-]{1,14}$/.test(d.ticketPrefix.trim());
  const valid =
    slaOk &&
    prefixOk &&
    Number.isFinite(d.autoCloseDays) &&
    d.autoCloseDays >= 1 &&
    d.departments.every(
      (x) =>
        x.name.trim() &&
        x.headId &&
        x.agentIds.length > 0 &&
        x.categories.length > 0 &&
        x.categories.every((c) => c.name.trim()),
    );
  const problems = [
    !slaOk && "SLA hours must be above zero and resolution ≥ first response",
    !prefixOk && "Ticket prefix: 2–15 letters, digits or hyphens",
    !(d.autoCloseDays >= 1) && "Auto-close must be at least 1 day",
    d.departments.some((x) => !x.agentIds.length) && "Every department needs at least one agent",
    d.departments.some((x) => !x.name.trim() || x.categories.some((c) => !c.name.trim())) &&
      "Department and category names are required",
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Settings2 className="text-primary h-6 w-6" /> Desk Settings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Service departments, their agents and categories, and the SLA policy that drives every
            ticket clock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && problems.length > 0 && (
            <span className="text-destructive text-xs">{problems.join(" · ")}</span>
          )}
          <Button variant="outline" size="sm" disabled={!dirty} onClick={() => setD(saved)}>
            Discard
          </Button>
          <Button
            size="sm"
            className="bg-gradient-emerald text-white"
            disabled={!dirty || !valid}
            onClick={() => {
              saveHelpdeskConfig(d);
              toast.success("Desk configuration saved");
            }}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="space-y-3 p-5">
            <div className="text-sm font-semibold">SLA policy (hours)</div>
            {d.sla.map((s) => (
              <div key={s.priority} className="grid grid-cols-3 items-center gap-2 text-sm">
                <Badge variant="outline">{s.priority}</Badge>
                <Input
                  type="number"
                  value={s.firstResponseHours}
                  onChange={(e) =>
                    setD({
                      ...d,
                      sla: d.sla.map((x) =>
                        x.priority === s.priority
                          ? { ...x, firstResponseHours: Number(e.target.value) }
                          : x,
                      ),
                    })
                  }
                  className="h-8"
                />

                <Input
                  type="number"
                  value={s.resolveHours}
                  onChange={(e) =>
                    setD({
                      ...d,
                      sla: d.sla.map((x) =>
                        x.priority === s.priority
                          ? { ...x, resolveHours: Number(e.target.value) }
                          : x,
                      ),
                    })
                  }
                  className="h-8"
                />
              </div>
            ))}
            <div className="text-muted-foreground grid grid-cols-3 text-[10px]">
              <span />
              <span>first response</span>
              <span>resolution</span>
            </div>
            <div className="space-y-1.5 pt-2">
              <Label className="text-muted-foreground text-xs">
                Auto-close resolved tickets after (days)
              </Label>
              <Input
                type="number"
                value={d.autoCloseDays}
                onChange={(e) => setD({ ...d, autoCloseDays: Number(e.target.value) })}
                className="h-8"
              />
            </div>
            <div className="border-border flex items-center justify-between rounded-lg border p-2.5 text-sm">
              <span>Requester may pick the agent</span>
              <Switch
                checked={d.allowRequesterPickAgent}
                onCheckedChange={(v) => setD({ ...d, allowRequesterPickAgent: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Ticket ID prefix</Label>
              <Input
                value={d.ticketPrefix}
                onChange={(e) => setD({ ...d, ticketPrefix: e.target.value.toUpperCase() })}
                className="h-8"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Service departments</div>
              <div className="ml-auto flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className="h-8 w-full sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {d.departments.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    let n = d.departments.length + 1;
                    while (d.departments.some((x) => x.id === `D${n}`)) n++;
                    const id = `D${n}`;
                    setD({
                      ...d,
                      departments: [
                        ...d.departments,
                        {
                          id,
                          name: "New department",
                          description: "",
                          headId: me.id,
                          agentIds: [me.id],
                          mailbox: "",
                          businessHours: "Mon–Fri 09:30–18:30",
                          categories: [
                            {
                              id: `${id}-GEN`,
                              name: "General",
                              description: "",
                              defaultAgentId: null,
                              defaultPriority: "Medium",
                            },
                          ],
                        },
                      ],
                    });
                    setDeptId(id);
                  }}
                >
                  <Plus className="h-4 w-4" /> Department
                </Button>
              </div>
            </div>
            {dept && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Name</Label>
                    <Input
                      value={dept.name}
                      onChange={(e) => setDept({ name: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Head (escalation owner)</Label>
                    <Select value={dept.headId} onValueChange={(v) => setDept({ headId: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.designation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-muted-foreground text-xs">Description</Label>
                    <Input
                      value={dept.description}
                      onChange={(e) => setDept({ description: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      E-mail-to-ticket mailbox
                    </Label>
                    <Input
                      value={dept.mailbox}
                      onChange={(e) => setDept({ mailbox: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Business hours</Label>
                    <Input
                      value={dept.businessHours}
                      onChange={(e) => setDept({ businessHours: e.target.value })}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Agents</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {dept.agentIds.map((a) => (
                      <Badge key={a} variant="outline" className="gap-1 pr-1">
                        {personById(a)?.name ?? a}
                        <button
                          type="button"
                          aria-label={`Remove ${personById(a)?.name ?? a}`}
                          onClick={() =>
                            // Categories defaulting to the removed agent fall back to the department head.
                            setDept({
                              agentIds: dept.agentIds.filter((x) => x !== a),
                              categories: dept.categories.map((c) =>
                                c.defaultAgentId === a ? { ...c, defaultAgentId: null } : c,
                              ),
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={addAgent} onValueChange={setAddAgent}>
                      <SelectTrigger className="h-8 w-full sm:w-[280px]">
                        <SelectValue placeholder="Add agent…" />
                      </SelectTrigger>
                      <SelectContent>
                        {people
                          .filter((p) => !dept.agentIds.includes(p.id))
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} · {p.dept}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={!addAgent}
                      onClick={() => {
                        setDept({ agentIds: [...dept.agentIds, addAgent] });
                        setAddAgent("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-xs">
                      Categories → default owner &amp; priority
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() =>
                        setDept({
                          categories: [
                            ...dept.categories,
                            {
                              id: `${dept.id}-${Date.now().toString(36).toUpperCase()}`,
                              name: "",
                              description: "",
                              defaultAgentId: null,
                              defaultPriority: "Medium",
                            },
                          ],
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Category
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {dept.categories.map((c) => (
                      <div
                        key={c.id}
                        className="border-border grid grid-cols-1 items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1.2fr_1.6fr_1fr_0.7fr_auto]"
                      >
                        <Input
                          value={c.name}
                          placeholder="Category name"
                          onChange={(e) =>
                            setDept({
                              categories: dept.categories.map((x) =>
                                x.id === c.id ? { ...x, name: e.target.value } : x,
                              ),
                            })
                          }
                          className="h-8"
                        />

                        <Input
                          value={c.description}
                          placeholder="Description"
                          onChange={(e) =>
                            setDept({
                              categories: dept.categories.map((x) =>
                                x.id === c.id ? { ...x, description: e.target.value } : x,
                              ),
                            })
                          }
                          className="h-8"
                        />

                        <Select
                          value={c.defaultAgentId ?? "head"}
                          onValueChange={(v) =>
                            setDept({
                              categories: dept.categories.map((x) =>
                                x.id === c.id
                                  ? { ...x, defaultAgentId: v === "head" ? null : v }
                                  : x,
                              ),
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="head">Department head</SelectItem>
                            {dept.agentIds.map((a) => (
                              <SelectItem key={a} value={a}>
                                {personById(a)?.name ?? a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={c.defaultPriority}
                          onValueChange={(v) =>
                            setDept({
                              categories: dept.categories.map((x) =>
                                x.id === c.id ? { ...x, defaultPriority: v } : x,
                              ),
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={dept.categories.length === 1}
                          onClick={() =>
                            setDept({ categories: dept.categories.filter((x) => x.id !== c.id) })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
