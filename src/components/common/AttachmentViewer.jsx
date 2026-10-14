// One viewer for every uploaded document in the app.
//   <AttachmentChips names={[...]} context="Leave application LV-012" /> — chips with view + download;
//   <AttachmentViewer name onClose /> — the dialog itself (images and PDFs render inline; anything captured
//   can be downloaded; a file with no captured bytes gets a generated document preview so demos never dead-end).
import { useState } from "react";
import { Download, Eye, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  attachmentOf,
  attachmentStore,
  downloadAttachment,
  isImageName,
  isPdfName,
} from "@/lib/attachments";

const fmtSize = (b) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(1)} MB`
    : b >= 1024
      ? `${Math.round(b / 1024)} KB`
      : `${b} B`;

export function AttachmentViewer({ name, context = "", onClose }) {
  attachmentStore.use();
  const file = attachmentOf(name);
  const image = file?.dataUrl && (isImageName(name) || file.type.startsWith("image/"));
  const pdf = file?.dataUrl && (isPdfName(name) || file.type === "application/pdf");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {image ? (
              <ImageIcon className="text-primary h-4 w-4" />
            ) : (
              <FileText className="text-primary h-4 w-4" />
            )}
            <span className="min-w-0 truncate">{name}</span>
          </DialogTitle>
          <DialogDescription>
            {context}
            {file
              ? ` · ${fmtSize(file.size)} · uploaded ${new Date(file.on).toLocaleDateString("en-IN")}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {image ? (
          <img
            src={file.dataUrl}
            alt={name}
            className="border-border max-h-[60dvh] w-full rounded-lg border object-contain"
          />
        ) : pdf ? (
          <iframe
            src={file.dataUrl}
            title={name}
            className="border-border h-[60dvh] w-full rounded-lg border"
          />
        ) : (
          <GeneratedPreview name={name} context={context} captured={!!file} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => downloadAttachment(name, `${context}\n${name}`)}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button className="bg-gradient-emerald text-white" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A clean document-shaped preview for files whose bytes are not in this browser (seeded demo records). */
function GeneratedPreview({ name, context, captured }) {
  return (
    <div className="border-border bg-muted/20 rounded-lg border p-6">
      <div className="bg-card shadow-card mx-auto max-w-md rounded-md p-6">
        <div className="bg-primary/10 text-primary grid h-10 w-10 place-items-center rounded-lg">
          <FileText className="h-5 w-5" />
        </div>
        <div className="mt-3 font-semibold break-all">{name}</div>
        {context && <div className="text-muted-foreground mt-1 text-xs">{context}</div>}
        <div className="mt-4 space-y-2">
          {[100, 92, 96, 70, 88, 40].map((w, i) => (
            <div key={i} className="bg-muted h-2 rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="text-muted-foreground mt-4 text-[11px]">
          {captured
            ? "This file type has no inline preview — use Download."
            : "Document preview (demo build): the original was uploaded in another session, so a placeholder is shown. In production the file is served from document storage."}
        </div>
      </div>
    </div>
  );
}

/** Chips for a record's attachments: click to view, hover shows size; empty list renders nothing. */
export function AttachmentChips({ names = [], context = "", size = "sm" }) {
  const [open, setOpen] = useState(null);
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
  if (!list.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {list.map((n) => (
        <Badge
          key={n}
          variant="outline"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(n);
          }}
          onKeyDown={(e) => e.key === "Enter" && setOpen(n)}
          className={`hover:border-primary/50 hover:text-primary max-w-[240px] cursor-pointer gap-1 font-normal ${size === "xs" ? "text-[10px]" : "text-xs"}`}
          title={`View ${n}`}
        >
          <Paperclip className="h-3 w-3 shrink-0" />
          <span className="truncate">{n}</span>
          <Eye className="h-3 w-3 shrink-0 opacity-60" />
        </Badge>
      ))}
      {open && <AttachmentViewer name={open} context={context} onClose={() => setOpen(null)} />}
    </span>
  );
}
