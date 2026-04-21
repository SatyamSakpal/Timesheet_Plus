"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";
import type { MeResponse } from "@/lib/types";

export function useMeQuery() {
  const auth = useAuth();
  const apiClient = useApiClient();

  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiClient.get<MeResponse>("/v1/me"),
    enabled: auth.status === "authenticated"
  });
}
