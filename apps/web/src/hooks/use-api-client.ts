"use client";

import { useMemo } from "react";
import { createApiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

export function useApiClient() {
  const auth = useAuth();
  return useMemo(
    () =>
      createApiClient({
        getAccessToken: auth.getAccessToken,
        getMockUser: () => auth.user
      }),
    [auth.getAccessToken, auth.user]
  );
}
