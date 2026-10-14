/** Placeholder shown by the portal shells until the browser session is known (first client render). */
export function WorkspaceLoading() {
  return (
    <div
      className="bg-background text-muted-foreground grid min-h-dvh place-items-center text-sm"
      aria-busy="true"
    >
      Loading your workspace…
    </div>
  );
}
