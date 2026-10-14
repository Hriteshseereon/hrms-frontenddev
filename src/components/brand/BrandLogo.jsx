import { useResolvedBrand } from "@/features/administration/data/brand-config";
import { activeOrgStore } from "@/features/organization/data/group-data";

export function BrandLogo({ variant = "light" }) {
  const isDark = variant === "dark";
  const brand = useResolvedBrand(activeOrgStore.use());
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={brand.logo}
        alt="Seereon Consulting & IT Services logo"
        className="shadow-premium ring-gold/40 h-9 w-9 rounded-xl bg-white object-contain p-0.5 ring-1"
      />

      <div className="leading-tight">
        <div
          className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-foreground"}`}
        >
          Seereon <span className="text-gold">HRMS</span>
        </div>
        <div
          className={`text-[10px] font-medium tracking-wider uppercase ${isDark ? "text-white/60" : "text-muted-foreground"}`}
        >
          Enterprise
        </div>
      </div>
    </div>
  );
}
