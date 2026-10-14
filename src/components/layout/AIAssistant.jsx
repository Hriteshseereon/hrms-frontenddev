import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "@/lib/router";
import { buildHref } from "@/lib/navigation";
import { Sparkles, Send, X, User, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { directoryEmployees } from "@/features/employees/data/employee-directory";
import { canOpenPath, useCurrentUser } from "@/features/auth/data/auth-session";
import { useScopeMatch } from "@/features/organization/data/tenancy";

/**
 * @typedef {Object} Suggestion
 * @property {string} label
 * @property {string} [to]
 */
/**
 * @typedef {Object} Msg
 * @property {"user" | "ai"} role
 * @property {string} text
 * @property {Suggestion[]} [actions]
 */

/** Screens the assistant can route users to, per portal. */
const ORG_SCREENS = [
  { label: "Dashboard", to: "/org/dashboard", keywords: ["dashboard", "overview", "home"] },
  {
    label: "Employees",
    to: "/org/employees",
    keywords: [
      "employee",
      "people",
      "staff",
      "promotion",
      "transfer",
      "resignation",
      "termination",
      "warning",
      "grievance",
    ],
  },
  {
    label: "Roles & Permissions",
    to: "/org/roles",
    keywords: ["role", "permission", "rbac", "access", "user"],
  },
  {
    label: "Role Delegation",
    to: "/org/delegation",
    keywords: ["delegate", "delegation", "handover", "cover"],
  },
  {
    label: "Approval Engine",
    to: "/org/approvals",
    keywords: ["approval", "workflow", "hierarchy", "sign off", "escalation"],
  },
  {
    label: "Attendance",
    to: "/org/attendance",
    keywords: ["attendance", "shift", "present", "absent", "pal"],
  },
  { label: "Leave", to: "/org/leave", keywords: ["leave", "vacation", "time off", "balance"] },
  { label: "Holidays", to: "/org/holidays", keywords: ["holiday", "calendar", "festival"] },
  { label: "Timesheets", to: "/org/timesheets", keywords: ["timesheet", "hours", "log", "effort"] },
  {
    label: "Finance & Accounts",
    to: "/org/finance",
    keywords: ["payroll", "payslip", "salary", "loan", "finance"],
  },
  {
    label: "Proof of Investment",
    to: "/org/tax",
    keywords: ["tax", "form 16", "form 12", "tds", "compliance"],
  },
  {
    label: "Claims & Insurance",
    to: "/org/claims",
    keywords: ["claim", "reimbursement", "insurance", "expense"],
  },
  { label: "Tasks", to: "/org/tasks", keywords: ["task", "assign", "deadline", "rework"] },
  { label: "Goals", to: "/org/goals", keywords: ["goal", "okr", "milestone", "target"] },
  {
    label: "Performance",
    to: "/org/performance",
    keywords: ["performance", "appraisal", "review", "pip", "rating"],
  },
  {
    label: "Training",
    to: "/org/training",
    keywords: ["training", "course", "learning", "trainer", "getting started"],
  },
  {
    label: "Recruitment Pipeline",
    to: "/org/recruitment",
    keywords: ["recruit", "candidate", "interview", "offer", "hiring", "job"],
  },
  {
    label: "Announcements",
    to: "/org/announcements",
    keywords: ["announcement", "notice", "circular", "event", "acknowledge"],
  },
  { label: "Helpdesk", to: "/helpdesk", keywords: ["support", "ticket", "helpdesk", "issue"] },
  {
    label: "Reports",
    to: "/org/reports",
    keywords: ["report", "export", "excel", "pdf", "analytics"],
  },
  {
    label: "Masters",
    to: "/org/masters",
    keywords: ["master", "template", "document", "configuration", "policy"],
  },
  {
    label: "Infrastructure",
    to: "/org/infrastructure",
    keywords: ["block", "floor", "building", "branch", "department", "designation"],
  },
];

const EMP_SCREENS = [
  { label: "My Dashboard", to: "/emp/dashboard", keywords: ["dashboard", "home", "overview"] },
  {
    label: "My Profile",
    to: "/emp/profile",
    keywords: ["profile", "photo", "details", "personal"],
  },
  { label: "Attendance", to: "/emp/attendance", keywords: ["attendance", "shift", "punch"] },
  { label: "Leave", to: "/emp/leave", keywords: ["leave", "vacation", "apply", "balance"] },
  {
    label: "Payroll & Payslips",
    to: "/emp/payroll",
    keywords: ["payroll", "payslip", "salary", "deduction"],
  },
  { label: "Proof of Investment", to: "/emp/tax", keywords: ["tax", "form 16", "form 12", "tds"] },
  { label: "My Timesheets", to: "/emp/timesheets", keywords: ["timesheet", "hours", "log"] },
  { label: "My Tasks", to: "/emp/tasks", keywords: ["task", "assignment", "progress"] },
  { label: "My Goals", to: "/emp/goals", keywords: ["goal", "milestone", "target", "okr"] },
  {
    label: "My Trainings",
    to: "/emp/training",
    keywords: ["training", "course", "learning", "module"],
  },
  {
    label: "Claims & Insurance",
    to: "/emp/reimbursements",
    keywords: ["claim", "reimbursement", "insurance", "expense"],
  },
  {
    label: "Notices & Circulars",
    to: "/emp/notices",
    keywords: ["notice", "circular", "announcement", "acknowledge"],
  },
  { label: "Holiday Calendar", to: "/emp/holidays", keywords: ["holiday", "calendar", "festival"] },
  { label: "Helpdesk", to: "/helpdesk", keywords: ["support", "ticket", "issue", "helpdesk"] },
  {
    label: "Raise a Grievance",
    to: "/emp/complaints",
    keywords: ["grievance", "complaint", "escalate"],
  },
  {
    label: "Refer a Candidate",
    to: "/emp/referrals",
    keywords: ["refer", "referral", "candidate"],
  },
];

const POLICIES = [
  {
    match: ["leave policy", "how many leave", "leave entitlement"],
    answer:
      "Employees accrue 18 earned leaves, 12 casual leaves and 10 sick leaves per year (credited quarterly pro-rata). Earned leave carries forward up to 30 days; casual leave lapses at year end. Applications route through your reporting manager and then HR.",
  },
  {
    match: ["notice period", "resign"],
    answer:
      "The standard notice period is 60 days for confirmed employees and 30 days during probation. Raise the resignation from Career & Exit → Resignation & Exit — your manager and HR review it, and the last working day is confirmed after clearance.",
  },
  {
    match: ["reimbursement", "expense policy", "claim limit"],
    answer:
      "Domestic travel is reimbursed at actuals within the per-diem limits in the travel circular. Claims above the policy limit escalate from your manager to Finance in the approval engine.",
  },
  {
    match: ["form 16", "tax document", "proof of investment"],
    answer:
      "Form 16 is generated from the payroll register after the financial year closes, and Form 12BB is your investment declaration. Both live under Proof of Investment, filtered by financial year.",
  },
  {
    match: ["probation", "confirmation"],
    answer:
      "Probation runs for six months, with a confirmation review by your reporting manager in the month before it ends.",
  },
  {
    match: ["pip", "improvement plan"],
    answer:
      "A PIP is a structured improvement plan with objectives, a timeline and scheduled reviews. Managers create it for their direct reports; HR adds remarks and records the final evaluation.",
  },
];

const HOW_TO = [
  {
    match: ["apply for leave", "raise leave", "book leave"],
    answer:
      "Open Leave, choose the leave type, pick the date range, attach any supporting document and submit. It goes to your reporting manager first, then HR.",
    to: "/emp/leave",
    label: "Open Leave",
  },
  {
    match: ["fill timesheet", "log hours", "submit timesheet"],
    answer:
      "Open My Timesheets, pick daily or weekly, add each task with its start/end time, and submit. Weekly hours must stay within the configured daily and weekly limits, and future dates are blocked.",
    to: "/emp/timesheets",
    label: "Open Timesheets",
  },
  {
    match: ["create task", "assign task"],
    answer:
      "Open Tasks and click Create Task. Pick assignees from your reporting tree, set the deadline, priority and effort estimate, then attach any brief.",
    to: "/org/tasks",
    label: "Open Tasks",
  },
  {
    match: ["create role", "add permission"],
    answer:
      "Open Roles & Permissions → Roles → Create Role. Select modules, submodules and screens, set View/Edit/Delete per screen, choose the branches, then review and submit.",
    to: "/org/roles",
    label: "Open Roles",
  },
  {
    match: ["run payroll", "generate payslip"],
    answer:
      "Open Finance & Accounts → Payroll, create a payroll run with the pay period and bank account, then run it. Payslips are generated automatically for that period.",
    to: "/org/finance",
    label: "Open Finance",
  },
  {
    match: ["approval hierarchy", "configure approval", "change approver"],
    answer:
      "Open the Approval Engine → Workflow Configuration. Each request type has an ordered chain — add or remove levels such as Team Lead, Manager, Department Head, HR, Finance and CEO.",
    to: "/org/approvals",
    label: "Open Approval Engine",
  },
  {
    match: ["delegate", "handover"],
    answer:
      "Open Role Delegation and create a delegation: pick the user, the modules, the permission level and the start/end dates. Access expires automatically on the end date.",
    to: "/org/delegation",
    label: "Open Delegation",
  },
];

function answerFor(q, portal, people, role) {
  const text = q.toLowerCase().trim();
  // Only screens this role may open — otherwise the assistant routed e.g. a Manager to Finance and Access Denied.
  const screens = (portal === "emp" ? EMP_SCREENS : ORG_SCREENS).filter((s) =>
    canOpenPath(role, s.to),
  );

  const person = people.find(
    (e) => text.includes(e.name.toLowerCase().split(" ")[0]) && text.length > 4,
  );
  if (person && /who|find|search|contact|detail|about/.test(text)) {
    // Phone and employment status are HR data — only for roles that can open the employee register.
    const hr = canOpenPath(role, "/org/employees");
    return {
      role: "ai",
      text: hr
        ? `${person.name} (${person.id}) is a ${person.role} in ${person.dept} at ${person.branch}. Email ${person.email}, phone ${person.phone}. Current status: ${person.status}.`
        : `${person.name} is a ${person.role} in ${person.dept} at ${person.branch}. Work email ${person.email}.`,
      actions: hr && portal !== "emp" ? [{ label: "Open Employees", to: "/org/employees" }] : [],
    };
  }

  const how = HOW_TO.find((h) => h.match.some((m) => text.includes(m)));
  if (how)
    return {
      role: "ai",
      text: how.answer,
      actions: how.to && canOpenPath(role, how.to) ? [{ label: how.label, to: how.to }] : [],
    };

  const pol = POLICIES.find((p) => p.match.some((m) => text.includes(m)));
  if (pol) return { role: "ai", text: pol.answer };

  const hits = screens.filter(
    (s) => s.keywords.some((k) => text.includes(k)) || text.includes(s.label.toLowerCase()),
  );
  if (hits.length) {
    return {
      role: "ai",
      text:
        hits.length === 1
          ? `${hits[0].label} is where you handle that. I can take you straight there.`
          : `I found ${hits.length} screens that cover this. Pick the one you need:`,
      actions: hits.slice(0, 4).map((h) => ({ label: h.label, to: h.to })),
    };
  }

  return {
    role: "ai",
    text: "I can search screens, look up an employee, explain an HR policy or walk you through a workflow. Try asking things like “how do I apply for leave”, “where do I configure the approval hierarchy”, or “who is Ananya Sharma”.",
    actions: screens.slice(0, 3).map((s) => ({ label: s.label, to: s.to })),
  };
}

/** Global floating product assistant, mounted on every portal shell. */
export function AIAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const portal = pathname.startsWith("/emp") ? "emp" : "org";
  // Tenant scope for "who is …" look-ups: only people of the company the user works in (the whole group for a
  // Super Admin in group view). The static roster used to answer with any organisation's phone numbers and e-mails.
  const me = useCurrentUser();
  // Never another client organisation's people (the collective view used to match the whole platform directory).
  const scopeMatch = useScopeMatch();
  const people = () => directoryEmployees().filter((e) => scopeMatch(e.orgId, null, e.branch));

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([]);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const starters = useMemo(
    () =>
      portal === "emp"
        ? [
            "How do I apply for leave?",
            "Where are my payslips?",
            "What is the notice period?",
            "Show my trainings",
          ]
        : [
            "Where do I configure the approval hierarchy?",
            "How do I run payroll?",
            "Open goals management",
            "Explain the leave policy",
          ],
    [portal],
  );

  function send(text) {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { role: "user", text: t }, answerFor(t, portal, people(), me.role)]);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open the Seereon HRMS AI assistant"
          className="bg-gradient-emerald shadow-premium ring-gold/40 fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 grid h-12 w-12 place-items-center rounded-2xl text-white ring-1 transition hover:scale-105 sm:right-6 sm:bottom-6 sm:h-14 sm:w-14"
        >
          <Sparkles className="text-gold h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="border-border bg-card shadow-premium fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex max-h-[calc(100dvh-5rem)] w-[min(410px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border sm:right-6 sm:bottom-6">
          <div className="border-border flex items-center gap-3 border-b p-4">
            <div className="bg-gradient-emerald ring-gold/40 grid h-9 w-9 place-items-center rounded-xl ring-1">
              <Sparkles className="text-gold h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Seereon HRMS Assistant</div>
              <div className="text-muted-foreground text-[11px]">
                Search, navigate and complete tasks
              </div>
            </div>
            <Badge variant="outline" className="bg-gold/10 border-gold/30 text-[10px]">
              Beta
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[52vh] min-h-[220px] flex-1 space-y-4 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Ask me where something lives, how a workflow runs, or about an employee or policy.
                </p>
                <div className="grid gap-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="border-border hover:border-primary/40 hover:bg-muted/40 rounded-lg border px-3 py-2 text-left text-sm transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    m.role === "user"
                      ? "bg-muted text-foreground"
                      : "bg-gradient-emerald ring-gold/40 text-white ring-1",
                  )}
                >
                  {m.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="text-gold h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl border px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/40 border-border",
                  )}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.actions.map((a) => (
                        <Button
                          key={a.label}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (a.to) {
                              router.push(buildHref({ to: a.to }));
                              setOpen(false);
                            }
                          }}
                        >
                          {a.label} <ArrowRight className="h-3 w-3" />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="border-border flex gap-2 border-t p-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask the assistant…"
            />

            <Button
              size="icon"
              className="bg-gradient-emerald shrink-0 text-white"
              onClick={() => send(input)}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
