// Employee Handbook: published from Master Data (Doc Master template or uploaded PDF) and acknowledged by every employee.
import { createPersistentStore } from "@/lib/persist";
import { pushAlert } from "@/features/communications/data/employee-alerts";

/**
 * @typedef {Object} HandbookVersion
 * @property {string} version
 * @property {string} publishedOn
 * @property {string} publishedBy
 * @property {"Doc Master template" | "Uploaded file"} source
 * @property {string} fileName
 * @property {string} [templateId]
 * @property {string} summary
 * @property {boolean} requireAck
 * @property {number} ackDueDays
 * @property {string} changeNotes
 */
/**
 * @typedef {Object} HandbookAck
 * @property {string} empId
 * @property {string} employee
 * @property {string} version
 * @property {string} acknowledgedOn
 * @property {string} signature
 */
export const handbookStore = createPersistentStore("seereon.handbook", {
  versions: [
    {
      version: "1.0",
      publishedOn: "2026-09-01",
      publishedBy: "Farah Khan",
      source: "Doc Master template",
      fileName: "Seereon-Employee-Handbook-v1.0.pdf",
      templateId: "TPL-HANDBOOK",
      summary:
        "Working hours, leave, code of conduct, POSH, IT & data security, performance, separation.",
      requireAck: true,
      ackDueDays: 14,
      changeNotes: "First release under Seereon HRMS.",
    },
  ],
  acks: [
    {
      empId: "SRN-0001",
      employee: "Santosh Nayak",
      version: "1.0",
      acknowledgedOn: "2026-09-01",
      signature: "Santosh Nayak",
    },
    {
      empId: "SRN-0010",
      employee: "Farah Khan",
      version: "1.0",
      acknowledgedOn: "2026-09-01",
      signature: "Farah Khan",
    },
    {
      empId: "SRN-0007",
      employee: "Neha Kulkarni",
      version: "1.0",
      acknowledgedOn: "2026-09-03",
      signature: "Neha Kulkarni",
    },
  ],
});
export const useHandbook = () => handbookStore.use();
export const currentHandbook = () => handbookStore.get().versions[0] ?? null;
export function publishHandbook(v, notifyIds) {
  if (handbookStore.get().versions.some((x) => x.version === v.version)) return;
  handbookStore.set((s) => ({
    ...s,
    versions: [{ ...v, publishedOn: new Date().toISOString().slice(0, 10) }, ...s.versions],
  }));
  if (v.requireAck)
    notifyIds.forEach((e) =>
      pushAlert({
        empId: e.id,
        kind: "general",
        to: "/emp/handbook",
        title: `Employee Handbook v${v.version} published`,
        body: `Please read and acknowledge the handbook within ${v.ackDueDays} days. ${v.changeNotes}`,
      }),
    );
}
export function acknowledgeHandbook(empId, employee, version, signature) {
  if (!signature.trim()) return { ok: false, message: "Type your full name to sign." };
  // Any text used to count as the e-signature — it must match the employee's name (same rule as the offer e-sign).
  if (
    signature.trim().toLowerCase().replace(/\s+/g, " ") !==
    employee.trim().toLowerCase().replace(/\s+/g, " ")
  )
    return { ok: false, message: `Type your full name exactly as "${employee}" to sign.` };
  if (!handbookStore.get().versions.some((v) => v.version === version))
    return { ok: false, message: `Handbook v${version} is not published.` };
  handbookStore.set((s) => ({
    ...s,
    acks: [
      {
        empId,
        employee,
        version,
        acknowledgedOn: new Date().toISOString().slice(0, 10),
        signature,
      },
      ...s.acks.filter((a) => !(a.empId === empId && a.version === version)),
    ],
  }));
  return { ok: true, message: `Handbook v${version} acknowledged.` };
}
export const hasAcknowledged = (empId, version) =>
  handbookStore.get().acks.some((a) => a.empId === empId && a.version === version);
