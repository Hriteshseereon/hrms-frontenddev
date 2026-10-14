import { useState } from "react";
import { captureFiles } from "@/lib/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
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
import { useScopedEmployees } from "@/features/employees/components/CasePieces";

/**
 * Shared resignation form.
 * - Org admin view: shows the employee selector.
 * - Employee portal view: pass `selfEmpId` to bind the form to the logged-in employee.
 */
export function ResignationFormDialog({ selfEmpId, onSubmit }) {
  const [emp, setEmp] = useState(selfEmpId ?? "");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [document, setDocument] = useState("");

  // Employees of the entity in scope (was a fixed list of six seeded people from one entity).
  const people = useScopedEmployees();
  const options = people.filter((e) => e.status !== "Notice");
  const self = selfEmpId ? people.find((e) => e.id === selfEmpId) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const lwdPast = !!lastWorkingDay && lastWorkingDay < today;
  const valid = emp && lastWorkingDay && !lwdPast && reason.trim();

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>New Resignation</DialogTitle>
        <DialogDescription>
          {selfEmpId
            ? "Submit your resignation for HR review."
            : "Record a resignation on behalf of an employee."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {selfEmpId ? (
          <div className="border-border bg-muted/40 rounded-lg border px-3 py-2">
            <div className="text-muted-foreground text-xs">Employee</div>
            <div className="text-sm font-semibold">
              {self?.name ?? selfEmpId} · {selfEmpId}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">Employee name *</Label>
            <Select value={emp} onValueChange={setEmp}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {options.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Last working date *</Label>
          <Input
            type="date"
            min={today}
            value={lastWorkingDay}
            onChange={(e) => setLastWorkingDay(e.target.value)}
          />
          {lwdPast && (
            <p className="text-destructive text-xs">The last working day cannot be in the past.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Reason *</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Better opportunity"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Description</Label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional context, handover notes…"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs font-medium">Document</Label>
          <Input
            type="file"
            onChange={(e) => {
              captureFiles(e.target.files);
              setDocument(e.target.files?.[0]?.name ?? "");
            }}
          />
          {document && <p className="text-muted-foreground text-xs">{document}</p>}
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={!valid}
          className="bg-gradient-emerald shadow-premium text-white"
          onClick={() => {
            const e = people.find((x) => x.id === emp);
            onSubmit({
              id: `RSG-${emp}`,
              employee: e?.name ?? emp,
              empId: emp,
              designation: e?.role ?? "—",
              office: e?.branch ?? "—",
              appliedOn: new Date().toISOString().slice(0, 10),
              lastWorkingDay,
              reason: reason.trim(),
              description: description.trim() || undefined,
              document: document || undefined,
              status: "Pending",
            });
          }}
        >
          Submit Resignation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
