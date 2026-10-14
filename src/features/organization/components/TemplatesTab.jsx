import { useState } from "react";
import { FileSignature, Plus, FileDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  templateStore,
  addTemplate,
  updateTemplate,
  TEMPLATE_KINDS,
  TEMPLATE_TOKENS,
} from "@/features/organization/data/doc-templates";
import { brandStore, setBrand } from "@/features/administration/data/brand-config";
import { exportLetterPdf, fillTokens } from "@/lib/export-utils";

const SAMPLE = {
  candidate: "Ishita Verma",
  employee: "Ishita Verma",
  position: "Senior Engineer",
  department: "Engineering",
  branch: "Bhubaneswar HQ",
  salary: "₹\u00A024,00,000",
  bonus: "₹\u00A02,00,000",
  startDate: "01 Sep 2026",
  expiryDate: "20 Aug 2026",
  offerDate: "05 Aug 2026",
  benefits: "Group health insurance, annual wellness allowance, hybrid working.",
  manager: "Manish Patel",
  brand: "",
};
/** Letter date is stamped when the preview is generated (IST), not when the module first loaded on the server. */
const letterDate = () => new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

function empty() {
  return {
    name: "",
    kind: "Offer Letter",
    subject: "",
    body: "",
    signatoryName: "",
    signatoryDesignation: "",
    closingNote: "",
    status: "Draft",
  };
}

export function TemplatesTab() {
  const rows = templateStore.use();
  const brand = brandStore.use();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  function startNew() {
    setEditing(null);
    setForm(empty());
    setOpen(true);
  }
  function startEdit(t) {
    setEditing(t);
    setForm({
      name: t.name,
      kind: t.kind,
      subject: t.subject,
      body: t.body,
      signatoryName: t.signatoryName,
      signatoryDesignation: t.signatoryDesignation,
      closingNote: t.closingNote,
      status: t.status,
    });
    setOpen(true);
  }

  function save() {
    if (editing) {
      updateTemplate(editing.id, form);
      toast.success("Template updated");
    } else {
      addTemplate(form);
      toast.success("Template created");
    }
    setOpen(false);
  }

  function preview(t) {
    const values = { ...SAMPLE, brand: brand.name, date: letterDate() };
    const ok = exportLetterPdf({
      title: t.kind,
      reference: fillTokens(t.subject, values),
      recipient: {
        name: values.employee,
        lines: [values.position, `${values.department} · ${values.branch}`],
      },
      bodyHtml: fillTokens(t.body, values),
      signatory: { name: t.signatoryName, designation: t.signatoryDesignation },
      note: t.closingNote,
    });
    if (!ok) toast.error("Allow pop-ups to preview and download the document");
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-emerald grid h-10 w-10 place-items-center rounded-xl text-white">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Brand & letterhead</div>
              <div className="text-muted-foreground text-xs">
                Applied to every generated PDF — reports, offer letters and certificates
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["name", "Brand name"],
              ["tagline", "Tagline"],
              ["address", "Registered address"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["website", "Website"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">{label}</Label>
                <Input value={brand[k]} onChange={(e) => setBrand({ [k]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Accent colour</Label>
              <Input
                type="color"
                value={brand.accent}
                onChange={(e) => setBrand({ accent: e.target.value })}
                className="h-10 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Logo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setBrand({ logo: String(reader.result) });
                    toast.success("Logo updated");
                  };
                  reader.readAsDataURL(f);
                }}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">Document footer</Label>
              <Textarea
                rows={2}
                value={brand.footer}
                onChange={(e) => setBrand({ footer: e.target.value })}
              />
            </div>
          </div>
          {brand.logo && (
            <img src={brand.logo} alt="Brand logo preview" className="h-12 w-auto object-contain" />
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-semibold">Document templates</div>
              <div className="text-muted-foreground text-xs">
                Use tokens like {"{{"}candidate{"}}"} — available: {TEMPLATE_TOKENS.join(", ")}
              </div>
            </div>
            <Button size="sm" className="bg-gradient-emerald text-white" onClick={startNew}>
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs tracking-wider uppercase">
                <tr>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Template</th>
                  <th className="p-3 text-left">Kind</th>
                  <th className="p-3 text-left">Signatory</th>
                  <th className="p-3 text-left">Updated</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="text-muted-foreground p-3 font-mono text-xs">{t.id}</td>
                    <td className="p-3 font-medium">
                      {t.name}
                      <div className="text-muted-foreground text-xs font-normal">{t.subject}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{t.kind}</td>
                    <td className="text-muted-foreground p-3">
                      {t.signatoryName}
                      <div className="text-xs">{t.signatoryDesignation}</div>
                    </td>
                    <td className="text-muted-foreground p-3">{t.updated}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={
                          t.status === "Active"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => preview(t)}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Compose the letter body with HTML and {"{{tokens}}"}. It renders on the branded
              letterhead.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Template name <span className="text-destructive">*</span>
              </Label>
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Kind</Label>
              <Select value={form.kind} onValueChange={(v) => set({ kind: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">Subject / reference line</Label>
              <Input
                value={form.subject}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="Offer of employment — {{position}}"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">
                Body <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={14}
                className="font-mono text-xs"
                value={form.body}
                onChange={(e) => set({ body: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Signatory name</Label>
              <Input
                value={form.signatoryName}
                onChange={(e) => set({ signatoryName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Signatory designation</Label>
              <Input
                value={form.signatoryDesignation}
                onChange={(e) => set({ signatoryDesignation: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">Closing note</Label>
              <Textarea
                rows={2}
                value={form.closingNote}
                onChange={(e) => set({ closingNote: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Active", "Draft"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name.trim() || !form.body.trim()}
              className="bg-gradient-emerald text-white"
              onClick={save}
            >
              {editing ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
