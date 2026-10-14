import Link from "@/lib/router";
import { usePathname } from "@/lib/router";
import {
  Briefcase,
  Users,
  CalendarClock,
  FileSignature,
  KanbanSquare,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useOrgScopeFilter,
  useScopedApplicants,
  useScopedJobPosts,
} from "@/features/recruitment/data/recruitment-engine";
import { useOffers } from "@/features/recruitment/data/onboarding-data";

/**
 * Recruitment is one streamlined flow: Job post → Candidates → Interviews & assessment → Offer, docs & onboarding → Welcome.
 * Masters (job types, sources, interview rounds, locations, assessment parameters) live in Master Data.
 */

function RecruitmentLayout({ children }) {
  const pathname = usePathname();
  // Counts for the entity in scope (they included every entity's openings, applicants and offers).
  const postings = useScopedJobPosts().filter((p) => (p.status ?? "Open") === "Open");
  const applicants = useScopedApplicants();
  const inScope = useOrgScopeFilter();
  const offers = useOffers().filter((o) => inScope(o.orgId));
  const steps = [
    {
      to: "/org/recruitment/postings",
      n: 1,
      label: "Job posts",
      icon: Briefcase,
      count: postings.length,
      hint: "open",
    },
    {
      to: "/org/recruitment/candidates",
      n: 2,
      label: "Candidates applied",
      icon: Users,
      count: applicants.filter((c) => c.stage === "Applied").length,
      hint: "awaiting shortlist",
    },
    // Finalised candidates (fit for the job, offer not yet created) still sit on this step's "Finalised" tab.
    {
      to: "/org/recruitment/interviews",
      n: 3,
      label: "Interview stages & assessment",
      icon: CalendarClock,
      count: applicants.filter(
        (c) => c.stage === "Shortlisted" || c.stage === "Interviewing" || c.stage === "Finalised",
      ).length,
      hint: "shortlisted / interviewing / finalised",
    },
    {
      to: "/org/recruitment/offers",
      n: 4,
      label: "Offer → docs verified → welcome",
      icon: FileSignature,
      count: offers.filter((o) => !["Joined", "Declined", "Expired"].includes(o.status)).length,
      hint: "in progress",
    },
  ];
  const activeIdx = steps.findIndex((s) => pathname.startsWith(s.to));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KanbanSquare className="text-primary h-6 w-6" /> Recruitment
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            One flow, four steps. Create the job, review who applied, run interview stages, release
            the offer — the candidate signs and uploads documents on their link, HR verifies,
            welcome e-mail goes out and the employee record is created.
          </p>
        </div>
        <Link
          href="/org/recruitment"
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm",
            pathname === "/org/recruitment"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border hover:bg-muted/40",
          )}
        >
          Pipeline board
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => {
          const active = i === activeIdx;
          const done = activeIdx > i;
          const Icon = s.icon;
          return (
            <Link
              href={s.to}
              key={s.to}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border p-3 transition",
                active
                  ? "border-primary bg-primary/5 shadow-card"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold",
                  active
                    ? "bg-gradient-emerald text-white"
                    : done
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="text-primary h-3.5 w-3.5 shrink-0" /> {s.label}
                </div>
                <div className="text-muted-foreground text-xs">
                  {s.count} {s.hint}
                </div>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="text-muted-foreground absolute top-1/2 -right-3 hidden h-4 w-4 -translate-y-1/2 xl:block" />
              )}
            </Link>
          );
        })}
      </div>
      <>{children}</>
    </div>
  );
}

export default RecruitmentLayout;
