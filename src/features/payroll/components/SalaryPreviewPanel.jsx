// Live "Estimate at full attendance" for the employee form, from POST /payroll/salary-preview — the same calculation a
// payroll run uses. Hidden when the user lacks payroll.view (403).
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { payrollRunApi, detailText } from "@/api/payrollRunApi";

const inr = (n) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function SalaryPreviewPanel({ wageType, ctc, dailyRate, pfApplicable, esiApplicable, ptState, overrides }) {
  const [state, setState] = useState({ loading: false, data: null, error: "", hidden: false });
  const amount = wageType === "Daily" ? Number(dailyRate) : Number(ctc);
  const ready = (wageType === "Monthly" || wageType === "Daily") && amount > 0;

  useEffect(() => {
    if (!ready) {
      setState((s) => ({ ...s, data: null, error: "", loading: false }));
      return undefined;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(() => {
      payrollRunApi
        .salaryPreview({
          wage_type: wageType,
          ...(wageType === "Daily" ? { daily_rate: amount } : { ctc: amount }),
          ...(wageType === "Monthly" && overrides?.length ? { component_overrides: overrides } : {}),
          pf_applicable: pfApplicable,
          esi_applicable: esiApplicable,
          ...(ptState ? { pt_state: ptState } : {}),
        })
        .then((data) => alive && setState({ loading: false, data, error: "", hidden: false }))
        .catch((e) => {
          if (!alive) return;
          if (e?.response?.status === 403) return setState({ loading: false, data: null, error: "", hidden: true });
          setState({ loading: false, data: null, error: detailText(e, "Could not calculate the preview."), hidden: false });
        });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready, wageType, amount, pfApplicable, esiApplicable, ptState, overrides]);

  if (state.hidden) return null;
  const { data } = state;
  return (
    <Card className="shadow-card bg-muted/30">
      <CardContent className="space-y-3 p-4 text-sm">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Salary preview · Estimate at full attendance
          </div>
          {state.loading && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
        </div>
        {!ready && <div className="text-muted-foreground text-xs">Enter the amount to see the estimate.</div>}
        {state.error && <div className="text-destructive text-xs">{state.error}</div>}
        {data && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground text-xs uppercase">Paid days</div>
                <div className="text-lg font-bold">{data.paid_days ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase">Gross</div>
                <div className="text-lg font-bold">{inr(data.gross)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase">Net take-home</div>
                <div className="text-primary text-lg font-bold">{inr(data.net)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase">Employer cost</div>
                <div className="text-lg font-bold">{inr(data.employer_cost)}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold">Earnings</div>
                {(data.earnings ?? []).map((l) => (
                  <div key={l.label} className="flex justify-between text-xs">
                    <span>{l.label}</span>
                    <span className="tabular-nums">{inr(l.amount)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold">Deductions</div>
                {(data.deductions ?? []).map((l) => (
                  <div key={l.label} className="flex justify-between text-xs">
                    <span>{l.label}</span>
                    <span className="text-destructive tabular-nums">{inr(l.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
