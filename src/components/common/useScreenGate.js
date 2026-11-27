import { useScopedScreenAccess, useScreenScope } from "@/features/auth/data/module-access";
import { actionSlug, findScreen } from "@/features/auth/data/rbac";

/**
 * Button gating for shared components (tables, CRUD sections, config tabs).
 *   const gate = useScreenGate(screen);   // explicit screen, else the nearest <ScreenScope>
 *   {gate.can("Create") && <AddButton />}
 *   {gate.canPrint() && <PdfButton />}    // screen's "Print" action when it lists one, otherwise "Export"
 * With no screen and no scope (a non-RBAC use) every action stays allowed, as before.
 */
export function useScreenGate(screen) {
  const scoped = useScreenScope();
  const ref = screen ?? scoped ?? null;
  const access = useScopedScreenAccess(ref ?? undefined);
  const can = (action) => !ref || access.can(action);
  const lists = (action) =>
    Boolean(findScreen(ref)?.actions?.some((candidate) => actionSlug(candidate) === actionSlug(action)));
  return {
    screen: ref,
    gated: Boolean(ref),
    can,
    canPrint: () => can(lists("Print") ? "Print" : "Export"),
  };
}

export default useScreenGate;
