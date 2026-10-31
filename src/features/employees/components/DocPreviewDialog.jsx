import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/** In-app preview of a document: images inline, PDFs in an iframe. `src` is a signed URL or an object URL. */
export function DocPreviewDialog({ open, onClose, title, src, isPdf }) {
  return (
    <Dialog open={open && !!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription className="sr-only">Document preview</DialogDescription>
        </DialogHeader>
        <div className="bg-muted/30 flex min-h-[50vh] flex-1 items-center justify-center overflow-auto rounded-md border">
          {isPdf ? (
            <iframe title={title} src={src} className="h-[70vh] w-full" />
          ) : (
            <img src={src} alt={title} className="max-h-[70vh] object-contain" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
