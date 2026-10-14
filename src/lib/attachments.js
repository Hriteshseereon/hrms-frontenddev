// Attachments — one place for every uploaded file in the app.
//
// Screens used to keep only the file NAME, so "view attachment" buttons had nothing to show. Uploads now capture
// the file's bytes (as a data URL) into a capped browser store keyed by file name, and every viewer renders from
// it. Files uploaded in an earlier session (or seeded demo records) have no bytes — the viewer then renders a
// generated document preview so the flow stays demonstrable. In API mode the store is replaced by real object
// storage; see services/api.
import { createPersistentStore } from "@/lib/persist";

/** name → { type, size, dataUrl, on } · capped so localStorage stays well under quota. */
export const attachmentStore = createPersistentStore("seereon.files.v1", {});

const MAX_FILE_BYTES = 1.5 * 1024 * 1024; // files above this are kept by name only
const MAX_FILES = 60; // oldest captured files are dropped first

const readAsDataUrl = (file) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => resolve("");
    r.readAsDataURL(file);
  });

/**
 * Captures the chosen files so they can be viewed later, and returns their names (what screens store on records).
 * @param {FileList | File[]} fileList
 * @returns {Promise<string[]>} the file names, in order
 */
export async function captureFiles(fileList) {
  const files = Array.from(fileList ?? []);
  const entries = {};
  for (const f of files) {
    const dataUrl = f.size <= MAX_FILE_BYTES ? await readAsDataUrl(f) : "";
    entries[f.name] = {
      type: f.type || "application/octet-stream",
      size: f.size,
      dataUrl,
      on: Date.now(),
    };
  }
  attachmentStore.set((prev) => {
    const merged = { ...prev, ...entries };
    const names = Object.keys(merged);
    if (names.length > MAX_FILES) {
      names
        .sort((a, b) => (merged[a].on ?? 0) - (merged[b].on ?? 0))
        .slice(0, names.length - MAX_FILES)
        .forEach((n) => delete merged[n]);
    }
    return merged;
  });
  return files.map((f) => f.name);
}

/** The captured file, or null when only the name is known (seeded data / large file / other browser). */
export const attachmentOf = (name) => attachmentStore.get()[name] ?? null;

export const isImageName = (n) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n ?? "");
export const isPdfName = (n) => /\.pdf$/i.test(n ?? "");

/** Downloads a captured file; falls back to a generated text stub so the button always delivers a file. */
export function downloadAttachment(name, fallbackText = "") {
  const a = document.createElement("a");
  const file = attachmentOf(name);
  if (file?.dataUrl) {
    a.href = file.dataUrl;
  } else {
    const blob = new Blob(
      [
        fallbackText ||
          `${name}\n\nDemo build: the original file was not captured in this browser.`,
      ],
      { type: "text/plain" },
    );
    a.href = URL.createObjectURL(blob);
  }
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
