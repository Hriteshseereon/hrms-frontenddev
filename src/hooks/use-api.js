import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Read data from the API with caching (TanStack Query).
 * @example const { data, isLoading } = useApiQuery(["leave", "applications", filters], () => timeApi.listLeaveApplications(filters));
 */
export function useApiQuery(key, fn, options = {}) {
  return useQuery({ queryKey: key, queryFn: ({ signal }) => fn({ signal }), ...options });
}

/**
 * Change data through the API; shows the backend's error message and refreshes the given query keys.
 * @example const apply = useApiMutation((body) => timeApi.applyLeave(body), { invalidate: [["leave"]], success: "Leave applied" });
 */
export function useApiMutation(fn, { invalidate = [], success, onSuccess, onError } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (success) toast.success(typeof success === "function" ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      toast.error(err?.detail || err?.message || "Something went wrong");
      onError?.(err, vars);
    },
  });
}
