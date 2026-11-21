
import { BRAND_LOGO_URL, BRAND_NAME } from "@/config/brand";
import { useCompanyBranding } from "@/components/brand/company-branding";

/** The signed-in company's logo, falling back to the product logo. */
export function useBrandLogo() {
  return useCompanyBranding().logo || BRAND_LOGO_URL;
}

/** `fixed` = always the product logo (sign-in, reset and public pages), never a company's branding. */
export function BrandLogo({ variant = "light", fixed = false }) {
  const isDark = variant === "dark";
  const branding = useCompanyBranding();
  const logo = fixed ? BRAND_LOGO_URL : branding.logo || BRAND_LOGO_URL;
  const companyName = fixed ? null : branding.name;

  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logo}
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
          className={`max-w-[150px] truncate text-[10px] font-medium tracking-wider uppercase ${
            isDark ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          {companyName || "Enterprise"}
        </div>
      </div>
    </div>
  );
}
