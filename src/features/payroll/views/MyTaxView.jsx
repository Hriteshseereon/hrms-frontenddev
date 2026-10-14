import { useState } from "react";
import { captureFiles, downloadAttachment } from "@/lib/attachments";
import { FileBadge, Download, Upload, History, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentEmployee } from "@/features/auth/data/emp-session";
import {
  FINANCIAL_YEARS,
  TAX_FORM_TYPES,
  addTaxDocument,
  logTaxAction,
  renderForm16Pdf,
  taxTone,
  useTaxDocs,
} from "@/features/payroll/data/tax-data";
import { downloadForm12B } from "@/features/payroll/data/form12b";

function EmpTax() {
  const me = useCurrentEmployee();
  // Employer-generated certificates reach the employee only once HR has signed & issued them; own uploads always show.
  const docs = useTaxDocs().filter(
    (d) => d.empId === me.id && (d.source === "Uploaded" || d.status === "Issued"),
  );
  const [fy, setFy] = useState("All");
  const [history, setHistory] = useState(null);

  const rows = docs.filter((d) => fy === "All" || d.fy === fy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileBadge className="text-primary h-6 w-6" /> Proof of Investment
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your Form 16 issued by payroll and the Form 12BB investment declarations you submit.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <Label className="text-muted-foreground text-xs">Financial year</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All financial years</SelectItem>
                {FINANCIAL_YEARS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <UploadDialog empId={me.id} empName={me.name} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((d) => (
          <Card key={d.id} className="shadow-card">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{d.form}</Badge>
                <Badge variant="outline" className={taxTone(d.status)}>
                  {d.status}
                </Badge>
                <span className="text-muted-foreground ml-auto text-xs">{d.fy}</span>
              </div>
              <div className="text-sm font-semibold">{d.fileName}</div>
              <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                <div>
                  Gross: <span className="text-foreground">{d.grossSalary}</span>
                </div>
                <div>
                  TDS: <span className="text-foreground">{d.taxDeducted}</span>
                </div>
                <div>
                  Issued: <span className="text-foreground">{d.issuedOn}</span>
                </div>
                <div>
                  Source: <span className="text-foreground">{d.source}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const ok = d.working ? renderForm16Pdf(d) : true;
                    if (!d.working) downloadAttachment(d.fileName, `${d.form} · ${d.fy}`);
                    logTaxAction(d.id, me.name, "Downloaded by employee");
                    toast[ok ? "success" : "error"](
                      ok
                        ? d.working
                          ? `${d.form} ready in the print dialog`
                          : `${d.fileName} downloaded`
                        : "Allow pop-ups to download the certificate",
                    );
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHistory(d)}>
                  <History className="h-3.5 w-3.5" /> History
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="shadow-card md:col-span-2">
            <CardContent className="text-muted-foreground p-10 text-center">
              No tax documents for this financial year yet.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="text-primary h-4 w-4" /> Other Documents
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Statutory forms you can download, complete and submit back to payroll.
            </p>
          </div>
          <div className="border-border bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-4">
            <div className="min-w-[240px]">
              <div className="text-sm font-semibold">Form 12B</div>
              <div className="text-muted-foreground text-xs">
                Details of income from previous employment (Rule 26A) — submit on joining mid-year.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => {
                const ok = downloadForm12B(
                  { id: me.id, name: me.name, dept: me.dept, role: me.role },
                  fy === "All" ? FINANCIAL_YEARS[0] : fy,
                );
                toast[ok ? "success" : "error"](
                  ok ? "Form 12B ready — save as PDF" : "Allow pop-ups to download",
                );
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download Form 12B
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Document history</DialogTitle>
            <DialogDescription>
              {history?.form} · {history?.fy}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {history?.history.map((h, i) => (
              <div key={i} className="border-border rounded-lg border p-3">
                <div className="text-sm font-medium">{h.action}</div>
                <div className="text-muted-foreground text-xs">
                  {h.by} · {h.at}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadDialog({ empId, empName }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState("Form 12BB");
  const [fy, setFy] = useState(FINANCIAL_YEARS[0]);
  const [file, setFile] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-emerald shadow-premium ml-auto text-white">
          <Upload className="h-4 w-4" /> Upload document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a tax document</DialogTitle>
          <DialogDescription>
            Submit your investment declaration or a supporting tax document to payroll.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Form *</Label>
            <Select value={form} onValueChange={(v) => setForm(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_FORM_TYPES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Financial year *</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_YEARS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Document *</Label>
            <Input
              type="file"
              onChange={(e) => {
                captureFiles(e.target.files);
                setFile(e.target.files?.[0]?.name ?? "");
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!file}
            className="bg-gradient-emerald text-white"
            onClick={() => {
              addTaxDocument({
                empId,
                employee: empName,
                form,
                fy,
                quarter: "Annual",
                fileName: file,
                grossSalary: "—",
                taxDeducted: "—",
                status: "Uploaded",
                issuedOn: new Date().toISOString().slice(0, 10),
                source: "Uploaded",
                by: empName,
                byId: empId,
              });
              toast.success("Document uploaded and sent to payroll");
              setOpen(false);
              setFile("");
            }}
          >
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EmpTax;
