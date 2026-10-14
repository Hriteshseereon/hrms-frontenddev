// ---------------------------------------------------------------------------
// Ticketing SLA & Delegation.
//
// Severity and an "expected resolution" field already existed on OrgTicket
// but were typed in manually per ticket. This adds: (1) a configurable SLA
// rule engine that computes the expected resolution date automatically from
// severity, so it's calculated, not guessed; (2) a live On Track / At Risk /
// Breached status computed against that target; (3) a delegation/
// reassignment action with a visible history, replacing the single free-text
// `associate` field's silent overwrites.
// ---------------------------------------------------------------------------
import { createPersistentStore } from "@/lib/persist";

/**
 * @typedef {Object} SlaRule
 * @property {string} severity
 * @property {number} targetHours
 */

/** Default SLA targets by severity — configurable by the org. */
export const DEFAULT_SLA_RULES = [
  { severity: "Critical", targetHours: 4 },
  { severity: "High", targetHours: 24 },
  { severity: "Medium", targetHours: 72 },
  { severity: "Low", targetHours: 168 },
];

export const slaRulesStore = createPersistentStore("seereon.support.sla-rules", DEFAULT_SLA_RULES);
export const useSlaRules = () => slaRulesStore.use();

export const updateSlaRule = (severity, targetHours) =>
  slaRulesStore.set((p) => p.map((r) => (r.severity === severity ? { ...r, targetHours } : r)));

export function targetHoursFor(severity, rules = slaRulesStore.get()) {
  return rules.find((r) => r.severity === severity)?.targetHours ?? 72;
}

/** Expected resolution date/time computed from the raised date and the SLA rule for its severity. */
export function computeExpectedResolution(raisedOn, severity, rules) {
  const hours = targetHoursFor(severity, rules);
  const raised = new Date(raisedOn);
  raised.setHours(raised.getHours() + hours);
  return raised.toISOString().slice(0, 10);
}

/**
 * @typedef {"On Track" | "At Risk" | "Breached" | "Resolved"} SlaStatus
 */

/** Live SLA status for a ticket, based on current time vs. its computed target. */
export function slaStatus(raisedOn, severity, status, rules) {
  if (status === "Resolved") return "Resolved";
  const hours = targetHoursFor(severity, rules);
  const raised = new Date(raisedOn);
  const target = new Date(raised);
  target.setHours(target.getHours() + hours);
  const now = new Date();
  const hoursRemaining = (+target - +now) / 3_600_000;

  if (hoursRemaining < 0) return "Breached";
  if (hoursRemaining < hours * 0.25) return "At Risk"; // inside the final quarter of the SLA window
  return "On Track";
}

export const slaStatusTone = {
  "On Track": "border-primary/30 bg-primary/10 text-primary",
  "At Risk": "border-gold/40 bg-gold/15 text-gold",
  Breached: "border-destructive/30 bg-destructive/10 text-destructive",
  Resolved: "border-primary/30 bg-primary/10 text-primary",
};

/* ------------------------------ Routing rules ------------------------------ */

/**
 * @typedef {Object} RoutingRule
 * @property {string} issueType
 * @property {string} defaultOwner
 */

export const DEFAULT_ROUTING_RULES = [
  { issueType: "IT / Hardware", defaultOwner: "IT Helpdesk" },
  { issueType: "Software Access", defaultOwner: "IT Ops" },
  { issueType: "SAP Logon", defaultOwner: "IT Ops" },
  { issueType: "Email", defaultOwner: "IT Helpdesk" },
  { issueType: "HR Query", defaultOwner: "HR Desk" },
  { issueType: "Payroll", defaultOwner: "Payroll Desk" },
  { issueType: "Facilities", defaultOwner: "Admin Team" },
  { issueType: "Other", defaultOwner: "" },
];

export const routingRulesStore = createPersistentStore(
  "seereon.support.routing-rules",
  DEFAULT_ROUTING_RULES,
);
export const useRoutingRules = () => routingRulesStore.use();

export const updateRoutingRule = (issueType, defaultOwner) =>
  routingRulesStore.set((p) =>
    p.map((r) => (r.issueType === issueType ? { ...r, defaultOwner } : r)),
  );

export function defaultOwnerFor(issueType, rules = routingRulesStore.get()) {
  return rules.find((r) => r.issueType === issueType)?.defaultOwner ?? "";
}

/* ------------------------------ Delegation history ------------------------------ */

/**
 * @typedef {Object} DelegationEntry
 * @property {string} id
 * @property {string} ticketId
 * @property {string} from
 * @property {string} to
 * @property {string} reason
 * @property {string} reassignedOn
 */

export const delegationHistoryStore = createPersistentStore("seereon.support.delegations", []);
export const useDelegationHistory = () => delegationHistoryStore.use();

export function useDelegationsFor(ticketId) {
  const all = useDelegationHistory();
  return all.filter((d) => d.ticketId === ticketId);
}

export function delegateTicket(ticketId, from, to, reason) {
  const entry = {
    id: `DLG-${String(delegationHistoryStore.get().length + 1).padStart(4, "0")}`,
    ticketId,
    from,
    to,
    reason,
    reassignedOn: new Date().toISOString().slice(0, 16).replace("T", " "),
  };
  delegationHistoryStore.set((p) => [entry, ...p]);
  return entry;
}
