
import { BRAND_LOGO_URL, BRAND_NAME } from "@/config/brand";

export function BrandLogo({ variant = "light" }) {
  const isDark = variant === "dark";

  return (
    <div className="flex items-center gap-2.5">
      <img
        src={BRAND_LOGO_URL}
        alt={`${BRAND_NAME} logo`}
        className="shadow-premium ring-gold/40 h-9 w-9 rounded-xl bg-white object-contain p-0.5 ring-1"
      />

      <div className="leading-tight">
        <div
          className={`text-lg font-bold tracking-tight ${
            isDark ? "text-white" : "text-foreground"
          }`}
        >
          The World <span className="text-gold">HRMS</span>
        </div>

        <div
          className={`text-[10px] font-medium tracking-wider uppercase ${
            isDark ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          Enterprise
        </div>
      </div>
    </div>
  );
}
