import { useSearch } from "@/lib/navigation";
import { captureFiles } from "@/lib/attachments";
import { useRouter } from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { useMemo, useRef, useState } from "react";
import { PlusCircle, Paperclip, X, Users, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import {
  IMPACTS,
  PRIORITIES,
  agentsOf,
  createTicket,
  isHelpdeskAdmin,
  isAgent,
  isConfidential,
  personById,
  slaFor,
  useHelpdeskConfig,
} from "@/features/helpdesk/data/helpdesk-data";
import { PersonPicker } from "@/features/helpdesk/components/TicketPieces";

function NewTicket() {
  const me = useCurrentUser();
  const cfg = useHelpdeskConfig();
  const router = useRouter();
  const { dept: presetDept, cat: presetCat } = useSearch(validateSearch);
  const [deptId, setDeptId] = useState(presetDept ?? "");
  const [catId, setCatId] = useState(presetDept && presetCat ? presetCat : "");
  const [assigneeId, setAssigneeId] = useState("auto");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [impact, setImpact] = useState("Individual");
  const [onBehalf, setOnBehalf] = useState(null);
  const [watchers, setWatchers] = useState([]);
  const [files, setFiles] = useState([]);
  const [tags, setTags] = useState("");
  const [relatedKind, setRelatedKind] = useState("none");
  const [relatedRef, setRelatedRef] = useState("");
  const fileRef = useRef(null);

  const dept = cfg.departments.find((d) => d.id === deptId);
  const cat = dept?.categories.find((c) => c.id === catId);
  const agents = useMemo(() => (dept ? agentsOf(dept.id) : []), [dept]);
  const effPriority = priority || cat?.defaultPriority || "Medium";
  const sla = slaFor(effPriority, cfg);
  const autoOwner = cat ? personById(cat.defaultAgentId ?? dept.headId) : null;
  const confidential = !!cat && isConfidential({ categoryId: cat.id });
  const canRaiseOnBehalf =
    isHelpdeskAdmin(me) || isAgent(me) || ["HR", "Manager", "HOD"].includes(me.role);
  const errors = [
    !deptId && "Choose a service department",
    (!catId || !cat) && "Choose a category",
    files.some((f) => f.size > 10 * 1024 * 1024) && "Attachments are limited to 10 MB each",
    subject.trim().length < 8 && "Subject needs at least 8 characters",
    description.trim().length < 20 && "Describe the issue in at least 20 characters",
  ].filter(Boolean);

  const submit = () => {
    const r = createTicket({
      subject,
      description,
      departmentId: deptId,
      categoryId: catId,
      priority: effPriority,
      impact,
      requester: me,
      onBehalfOfId: onBehalf?.id,
      assigneeId: assigneeId === "auto" || confidential ? null : assigneeId,
      watcherIds: watchers.map((w) => w.id),
      attachments: files,
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      related:
        relatedKind !== "none" && relatedRef.trim()
          ? { kind: relatedKind, ref: relatedRef.trim() }
          : undefined,
    });
    toast[r.ok ? "success" : "error"](r.message);
    if (r.ok && r.id) router.push(buildHref({ to: "/helpdesk/tickets/$id", params: { id: r.id } }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PlusCircle className="text-primary h-6 w-6" /> Raise a Ticket
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick the department that owns the issue, then the category. The concerned person is
          pre-filled from the category — you can choose another agent of that department.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-card">
            <CardContent className="space-y-5 p-6">
              <div className="text-sm font-semibold">1 · Who should handle this?</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cfg.departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDeptId(d.id);
                      setCatId("");
                      setAssigneeId("auto");
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      deptId === d.id
                        ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                        : "border-border hover:bg-muted/30",
                    )}
                  >
                    <div className="text-sm font-semibold">{d.name}</div>
                    <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {d.description}
                    </div>
                    <div className="text-muted-foreground mt-1 text-[10px]">{d.businessHours}</div>
                  </button>
                ))}
              </div>
              {dept && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Category *</Label>
                    <Select
                      value={catId}
                      onValueChange={(v) => {
                        setCatId(v);
                        setAssigneeId("auto");
                        setPriority("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="What is it about?" />
                      </SelectTrigger>
                      <SelectContent>
                        {dept.categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cat && <div className="text-muted-foreground text-xs">{cat.description}</div>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Concerned person</Label>
                    <Select
                      value={assigneeId}
                      onValueChange={setAssigneeId}
                      disabled={!cat || !cfg.allowRequesterPickAgent || confidential}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          Auto — {autoOwner?.name ?? "department owner"}
                        </SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} · {a.designation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-muted-foreground text-xs">
                      Agents of {dept.name}; escalation owner {personById(dept.headId)?.name}.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <div className="text-sm font-semibold">2 · What is the issue?</div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="One line — e.g. July payslip shows LOP despite approved leave"
                  maxLength={140}
                />

                <div className="text-muted-foreground text-right text-[11px]">
                  {subject.length}/140
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Description *</Label>
                <Textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    "What happened, when it started, what you expected, steps to reproduce, error messages, reference IDs (payslip period, leave request, asset tag)…"
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Priority</Label>
                  <Select
                    value={priority || (cat?.defaultPriority ?? "")}
                    onValueChange={(v) => setPriority(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Set by category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-muted-foreground text-[11px]">
                    Respond ≤ {sla.firstResponseHours} h · resolve ≤ {sla.resolveHours} h
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Impact</Label>
                  <Select value={impact} onValueChange={(v) => setImpact(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPACTS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Tags (comma separated)</Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="payroll, lop"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Related item</Label>
                  <div className="flex gap-2">
                    <Select value={relatedKind} onValueChange={(v) => setRelatedKind(v)}>
                      <SelectTrigger className="w-full sm:w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "none",
                          "Employee",
                          "Asset",
                          "Payroll period",
                          "Leave request",
                          "Other",
                        ].map((k) => (
                          <SelectItem key={k} value={k}>
                            {k === "none" ? "None" : k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={relatedRef}
                      onChange={(e) => setRelatedRef(e.target.value)}
                      placeholder="Reference (e.g. PR-202607, LVA-5003, AST-0142)"
                      disabled={relatedKind === "none"}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Attachments (screenshots, PDFs · ≤ 10 MB each)
                  </Label>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      captureFiles(e.target.files);
                      const list = Array.from(e.target.files ?? []).map((f) => ({
                        name: f.name,
                        size: f.size,
                        type: f.type,
                      }));
                      setFiles((p) => [
                        ...p,
                        ...list.filter((f) => !p.some((x) => x.name === f.name)),
                      ]);
                      e.target.value = "";
                    }}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" /> Add files
                  </Button>
                  <div className="flex flex-wrap gap-1.5">
                    {files.map((f) => (
                      <Badge key={f.name} variant="outline" className="gap-1 pr-1">
                        {f.name}{" "}
                        <span className="text-muted-foreground">
                          {Math.round(f.size / 1024)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((p) => p.filter((x) => x.name !== f.name))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="text-primary h-4 w-4" /> 3 · Other people involved
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Watchers / CC (they see every update)
                  </Label>
                  <PersonPicker
                    exclude={[me.id, ...watchers.map((w) => w.id)]}
                    onPick={(p) => setWatchers((w) => [...w, p])}
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {watchers.map((w) => (
                      <Badge key={w.id} variant="outline" className="gap-1 pr-1">
                        {w.name}
                        <button
                          type="button"
                          onClick={() => setWatchers((x) => x.filter((y) => y.id !== w.id))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                {canRaiseOnBehalf && (
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Raise on behalf of (managers / HR / agents)
                    </Label>
                    {onBehalf ? (
                      <div className="border-border flex items-center gap-2 rounded-lg border p-2 text-sm">
                        <span className="font-medium">{onBehalf.name}</span>
                        <span className="text-muted-foreground text-xs">{onBehalf.dept}</span>
                        <button type="button" className="ml-auto" onClick={() => setOnBehalf(null)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <PersonPicker
                        exclude={[me.id]}
                        onPick={setOnBehalf}
                        placeholder="Requester name or ID…"
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="text-sm font-semibold">Routing preview</div>
              <div className="text-muted-foreground text-xs">
                This ticket will be raised by{" "}
                <b className="text-foreground">
                  {onBehalf ? `${onBehalf.name} (via ${me.name})` : me.name}
                </b>
                {dept ? (
                  <>
                    {" "}
                    with <b className="text-foreground">{dept.name}</b>
                  </>
                ) : null}
                {cat ? (
                  <>
                    {" "}
                    under <b className="text-foreground">{cat.name}</b>
                  </>
                ) : null}
                .
              </div>
              <div className="border-border bg-muted/20 rounded-lg border p-3 text-sm">
                <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                  Assigned to
                </div>
                <div className="font-semibold">
                  {assigneeId !== "auto"
                    ? personById(assigneeId)?.name
                    : (autoOwner?.name ?? "— choose a category —")}
                </div>
                {dept && (
                  <div className="text-muted-foreground text-xs">
                    Escalates to {personById(dept.headId)?.name} · mailbox {dept.mailbox}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="border-border rounded-lg border p-2">
                  <div className="text-lg font-bold">{sla.firstResponseHours} h</div>
                  <div className="text-muted-foreground text-[11px]">first response</div>
                </div>
                <div className="border-border rounded-lg border p-2">
                  <div className="text-lg font-bold">{sla.resolveHours} h</div>
                  <div className="text-muted-foreground text-[11px]">resolution target</div>
                </div>
              </div>
              <Badge
                variant="outline"
                className="w-full justify-center text-center whitespace-normal [&>span]:whitespace-normal"
              >
                {effPriority} priority · {impact} impact
              </Badge>
              {errors.length > 0 && (
                <ul className="text-destructive space-y-0.5 text-xs">
                  {errors.map((e) => (
                    <li key={e}>• {e}</li>
                  ))}
                </ul>
              )}
              <Button
                className="bg-gradient-emerald w-full text-white"
                disabled={errors.length > 0}
                onClick={submit}
              >
                Submit ticket
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="text-muted-foreground space-y-2 p-5 text-xs">
              <div className="flex items-start gap-2">
                <Info className="text-primary h-4 w-4 shrink-0" />
                Tickets are visible to you, the assignee, the department's agents, watchers and HR.
              </div>
              <div className="flex items-start gap-2">
                <ShieldAlert className="text-primary h-4 w-4 shrink-0" />
                Grievances go to the HR desk's confidential category and are routed only to the
                CHRO.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Query-string contract of this screen (was the route's validateSearch). */
function validateSearch(s) {
  return {
    dept: typeof s.dept === "string" ? s.dept : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  };
}

export default NewTicket;
