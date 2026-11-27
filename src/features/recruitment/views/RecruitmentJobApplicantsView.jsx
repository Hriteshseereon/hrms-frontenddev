import { useParams } from "@/lib/router";
import { CandidatesWorkspace } from "@/features/recruitment/components/CandidatesWorkspace";

/** Applicants of one job post — opened from "View applicants" on a Step 1 row. */
export default function RecruitmentJobApplicantsView() {
  const { jobId } = useParams();
  return <CandidatesWorkspace key={jobId} lockedJobId={decodeURIComponent(jobId ?? "")} />;
}
