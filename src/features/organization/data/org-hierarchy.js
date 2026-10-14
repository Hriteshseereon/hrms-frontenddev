// Organization-wide reporting hierarchy for the visual org chart (UI-only).
import { directoryEmployees } from "@/features/employees/data/employee-directory";

/**
 * @typedef {Object} OrgNode
 * @property {string} id
 * @property {string} name
 * @property {string} title
 * @property {string} [dept]
 * @property {string} [branch]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {boolean} isEmployee - true when the node is a real employee record
 * @property {OrgNode[]} children
 */

/** Governance tier that sits above the CEO, plus the CEO anchor record. */
const BOARD = { id: "BOARD", name: "Board of Directors", title: "Governance" };
const CEO_ID = "SRN-0001";

const toNode = (e) => ({
  id: e.id,
  name: e.name,
  title: e.role,
  dept: e.dept,
  branch: e.branch,
  email: e.email,
  phone: e.phone,
  isEmployee: true,
  children: [],
});

/**
 * Builds Board → CEO → CXOs → VPs/Heads → managers → reports purely from the
 * manager map, so every seeded reporting line is visible in one tree.
 * Employees with no manager attach directly to the CEO.
 * `orgId` limits the chart to one legal entity (tenant scope); without it every entity's people are shown.
 */
export function buildOrgTree(managerMap, orgId) {
  // Live directory (seeded + hired during the session), optionally scoped to one organisation.
  const people = directoryEmployees().filter((e) => !orgId || e.orgId === orgId);
  const nodes = new Map();
  people.forEach((e) => nodes.set(e.id, toNode(e)));

  const roots = [];
  people.forEach((e) => {
    const mgr = managerMap[e.id];
    const node = nodes.get(e.id);
    if (mgr && nodes.has(mgr) && mgr !== e.id) nodes.get(mgr).children.push(node);
    else roots.push(node);
  });

  const ceo = nodes.get(CEO_ID) ?? {
    id: CEO_ID,
    name: "Chief Executive Officer",
    title: "Chief Executive Officer",
    isEmployee: false,
    children: [],
  };

  // Everyone left without a manager reports into the CEO.
  roots.filter((r) => r.id !== CEO_ID).forEach((r) => ceo.children.push(r));

  return {
    id: BOARD.id,
    name: BOARD.name,
    title: BOARD.title,
    isEmployee: false,
    children: [ceo],
  };
}

/** Ids from the root down to (and including) the target node. */
export function pathToNode(root, targetId) {
  if (root.id === targetId) return [root.id];
  for (const c of root.children) {
    const p = pathToNode(c, targetId);
    if (p.length) return [root.id, ...p];
  }
  return [];
}

/** Finds a node anywhere in the tree. */
export function findNode(root, id) {
  if (root.id === id) return root;
  for (const c of root.children) {
    const n = findNode(c, id);
    if (n) return n;
  }
  return undefined;
}

/** All ids inside a node's subtree (the node itself + everyone reporting under it). */
export function subtreeIds(node) {
  return [node.id, ...node.children.flatMap(subtreeIds)];
}

/**
 * Ids whose contact details the viewer may see: themselves and everyone in
 * their reporting line downwards (a CEO therefore sees the whole company).
 */
export function visibleContactIds(root, viewerId) {
  const node = findNode(root, viewerId);
  return new Set(node ? subtreeIds(node) : [viewerId]);
}
