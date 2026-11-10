// Super Admin company context: pick the company to work in, see which one is open, and leave it again.
// Company / Branch Admins and employees never see any of this — the server scopes them from their login.
import { useEffect, useState } from "react";
import { Building2, LogOut, Repeat, Search } from "lucide-react";
import Company_api from "@/api/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSessionStore } from "@/features/auth/data/session-store";

const isSuper = (role) => ["SUPER_ADMIN", "SUPERADMIN"].includes(String(role ?? "").toUpperCase());

const listOf = (res) => {
  const d = res?.data?.data ?? res?.data ?? res ?? [];
  return Array.isArray(d) ? d : (d.items ?? d.companies ?? []);
};

export function useIsSuperAdmin() {
  return useSessionStore((s) => s.isAuthenticated && isSuper(s.role));
}

function CompanyPickerDialog({ open, onOpenChange }) {
  const current = useSessionStore((s) => s.scopeCompanyId);
  const selectCompany = useSessionStore((s) => s.selectCompany);
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setError("");
    Company_api.getCompanies()
      .then((res) => alive && setCompanies(listOf(res)))
      .catch(() => alive && (setCompanies([]), setError("Could not load companies.")));
    return () => {
      alive = false;
    };
  }, [open]);

  const shown = (companies ?? []).filter((c) =>
    `${c.name ?? ""} ${c.code ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a company</DialogTitle>
          <DialogDescription>
            Employees, roles, master data, attendance and payroll belong to one company. Pick the one
            you want to work in.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies"
            className="pl-8"
          />
        </div>
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {companies === null && <div className="text-muted-foreground p-4 text-sm">Loading…</div>}
          {error && <div className="text-destructive p-2 text-sm">{error}</div>}
          {companies && !error && shown.length === 0 && (
            <div className="text-muted-foreground p-4 text-center text-sm">
              {companies.length ? "No company matches." : "No companies yet. Create one first."}
            </div>
          )}
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCompany(String(c.id), c.name ?? "")}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition"
            >
              <Building2 className="text-primary h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                {c.code && <span className="text-muted-foreground block text-[11px]">{c.code}</span>}
              </span>
              {String(c.id) === String(current) && (
                <span className="text-primary text-[11px] font-semibold">Current</span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Opens the picker by itself when the API answered 400 "Select a company". */
export function GlobalCompanyPicker() {
  const isSuperAdmin = useIsSuperAdmin();
  const needCompany = useSessionStore((s) => s.needCompany);
  if (!isSuperAdmin) return null;
  return (
    <CompanyPickerDialog
      open={needCompany}
      onOpenChange={(v) => !v && useSessionStore.setState({ needCompany: false })}
    />
  );
}

/** Header control: shows the company being worked in and switches it. */
export function CompanySwitcher() {
  const isSuperAdmin = useIsSuperAdmin();
  const name = useSessionStore((s) => s.scopeCompanyName);
  const id = useSessionStore((s) => s.scopeCompanyId);
  const [open, setOpen] = useState(false);
  if (!isSuperAdmin) return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 max-w-[220px] gap-2"
        onClick={() => setOpen(true)}
        title={id ? "Switch company" : "Select a company"}
      >
        {id ? <Repeat className="h-4 w-4 shrink-0" /> : <Building2 className="h-4 w-4 shrink-0" />}
        <span className="truncate">{id ? name || "Company" : "Select company"}</span>
      </Button>
      <CompanyPickerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Strip under the header while a Super Admin is inside a company. */
export function CompanyBanner() {
  const isSuperAdmin = useIsSuperAdmin();
  const name = useSessionStore((s) => s.scopeCompanyName);
  const id = useSessionStore((s) => s.scopeCompanyId);
  const exitCompany = useSessionStore((s) => s.exitCompany);
  if (!isSuperAdmin || !id) return null;
  return (
    <div className="border-gold/40 bg-gold/10 flex items-center gap-3 border-b px-4 py-1.5 text-sm md:px-6">
      <Building2 className="text-gold h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        Working in: <strong>{name || "this company"}</strong>
      </span>
      <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={exitCompany}>
        <LogOut className="h-3.5 w-3.5" /> Exit company
      </Button>
    </div>
  );
}
