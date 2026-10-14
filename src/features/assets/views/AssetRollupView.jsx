// Org Admin: asset rollup across every entity in the company group.
import { useEffect, useMemo, useState } from "react";
import { Boxes, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGroups, useOrgs } from "@/features/organization/data/group-data";
import { useAssets } from "@/features/assets/data/asset-data";
import { useCurrentUser } from "@/features/auth/data/auth-session";
import { inr } from "@/lib/store";
import { exportReportPdf } from "@/lib/export-utils";
import { RecordDetailDialog, clickableRow } from "@/components/common/RecordDetail";

/** Same maths as `assetRollup` in asset-data, but over the reactive, hydration-safe asset list. */
function rollupOf(assets, orgIds, now) {
  const list = assets.filter((a) => orgIds.includes(a.orgId));
  const licenses = list.filter((a) => a.kind === "Software License");
  const renewals = now
    ? licenses.filter(
        (a) => a.renewalDate && (new Date(a.renewalDate).getTime() - now) / 86400000 < 240,
      )
    : [];
  return {
    total: list.length,
    issued: list.filter((a) => a.status === "Issued").length,
    inStock: list.filter((a) => a.status === "In Stock").length,
    spend: list.reduce((s, a) => s + a.cost, 0),
    licenses: licenses.length,
    renewalsDue: renewals.length,
    renewals,
  };
}

function AssetRollupPage() {
  const me = useCurrentUser();
  const allOrgs = useOrgs();
  const groups = useGroups();
  const groupName = (id) => (id ? (groups.find((g) => g.id === id)?.name ?? id) : "—");
  // Tenant scope: only the entities of the signed-in user's own company group (platform users see everything).
  const orgs = useMemo(() => {
    // A company Admin ("*" navigation) is locked to their own company — the group rollup is for the Super Admin / CXOs.
    if (me.role === "Admin") return allOrgs.filter((o) => o.id === me.orgId);
    const groupId = me.groupId ?? allOrgs.find((o) => o.id === me.orgId)?.groupId ?? null;
    return groupId
      ? allOrgs.filter((o) => o.groupId === groupId)
      : allOrgs.filter((o) => o.id === me.orgId);
  }, [allOrgs, me.role, me.groupId, me.orgId]);
  const enabled = orgs.filter((o) => o.modules.includes("assets"));
  // `assetRollup()` reads the persisted store non-reactively (and hydrates it from localStorage during render, which
  // makes the server and client markup differ); subscribe through the hook and compute from that list instead.
  const assets = useAssets();
  // "Now" is fixed after mount — Date.now() during render differed between the server and client renders.
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const assetRollup = (ids) => rollupOf(assets, ids, now);
  const all = assetRollup(enabled.map((o) => o.id));
  const [detail, setDetail] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Boxes className="text-primary h-6 w-6" /> Asset Rollup
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Aggregate asset position across every organisation with the Assets module enabled.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportReportPdf({
              title: "Cross-Organisation Asset Rollup",
              columns: [
                "Organisation",
                "Group",
                "Assets module",
                "Assets",
                "Issued",
                "Capital value",
              ],
              rows: orgs.map((o) => {
                const r = assetRollup([o.id]);
                return [
                  o.name,
                  groupName(o.groupId),
                  o.modules.includes("assets") ? "Enabled" : "Disabled",
                  r.total,
                  r.issued,
                  inr(r.spend),
                ];
              }),
            })
          }
        >
          <Download className="h-4 w-4" /> Download
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Orgs with Assets", v: String(enabled.length) },
          { l: "Total assets", v: String(all.total) },
          { l: "Capital value", v: inr(all.spend) },
          { l: "Renewals due", v: String(all.renewalsDue) },
        ].map((s) => (
          <Card key={s.l} className="shadow-card">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-[11px] tracking-wider uppercase">
                {s.l}
              </div>
              <div className="mt-1 text-xl font-bold">{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="overflow-x-auto p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                {[
                  "Organisation",
                  "Group",
                  "Module",
                  "Assets",
                  "Issued",
                  "Licenses",
                  "Capital value",
                ].map((h) => (
                  <th key={h} className="py-2.5 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => {
                const r = assetRollup([o.id]);
                const on = o.modules.includes("assets");
                return (
                  <tr
                    key={o.id}
                    className={`border-border/60 border-b ${clickableRow}`}
                    onClick={() => setDetail(o)}
                  >
                    <td className="py-2.5 pr-3 font-medium">{o.name}</td>
                    <td className="py-2.5 pr-3">{groupName(o.groupId)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant="outline"
                        className={on ? "bg-primary/10 text-primary border-primary/20" : ""}
                      >
                        {on ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3">{r.total}</td>
                    <td className="py-2.5 pr-3">{r.issued}</td>
                    <td className="py-2.5 pr-3">{r.licenses}</td>
                    <td className="py-2.5 pr-3">{inr(r.spend)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {detail &&
        (() => {
          const r = assetRollup([detail.id]);
          const on = detail.modules.includes("assets");
          return (
            <RecordDetailDialog
              onClose={() => setDetail(null)}
              title={detail.name}
              subtitle={`${detail.code} · ${detail.legalName}`}
              badges={
                <Badge
                  variant="outline"
                  className={on ? "bg-primary/10 text-primary border-primary/20" : ""}
                >
                  Assets module {on ? "enabled" : "disabled"}
                </Badge>
              }
              record={{
                organisation: detail.name,
                code: detail.code,
                group: groupName(detail.groupId),
                country: detail.country,
                status: detail.status,
                employees: detail.employees,
                totalAssets: r.total,
                issued: r.issued,
                inStock: r.inStock,
                licenses: r.licenses,
                capitalValue: r.spend,
                renewalsDue: r.renewalsDue,
                renewals: r.renewals.map((a) => ({
                  tag: a.tag,
                  license: a.name,
                  vendor: a.vendor,
                  seats: a.seats,
                  renewalDate: a.renewalDate,
                  cost: a.cost,
                })),
              }}
              labels={{
                totalAssets: "Total assets",
                inStock: "In stock",
                capitalValue: "Capital value",
                renewalsDue: "Renewals due",
                renewals: "Licenses nearing renewal",
              }}
              sections={[
                {
                  title: "Organisation",
                  keys: ["organisation", "code", "group", "country", "status", "employees"],
                },
                {
                  title: "Asset position",
                  keys: [
                    "totalAssets",
                    "issued",
                    "inStock",
                    "licenses",
                    "capitalValue",
                    "renewalsDue",
                  ],
                },
                { title: "Licenses nearing renewal", keys: ["renewals"] },
              ]}
            />
          );
        })()}
    </div>
  );
}

export default AssetRollupPage;
