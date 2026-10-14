import { useEffect } from "react";
import { useRouter } from "@/lib/router";

/** Client-side redirect for conditional cases inside a rendered screen (e.g. wrong portal). */
export function Navigate({ to, replace = true }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return null;
}
