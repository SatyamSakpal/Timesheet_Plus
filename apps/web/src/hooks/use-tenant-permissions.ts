"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { queryKeys } from "@/lib/query-keys";
import type { TenantRole } from "@/lib/types";

export function useTenantPermissions() {
  const apiClient = useApiClient();
  const { activeTenantId, activeMembership } = useActiveTenant();

  const rolesQuery = useQuery({
    queryKey: activeTenantId ? queryKeys.roles(activeTenantId) : ["roles", "none"],
    queryFn: () => apiClient.get<TenantRole[]>(`/v1/tenants/${activeTenantId}/roles`),
    enabled: Boolean(activeTenantId)
  });

  const rolePermissions = useMemo(() => {
    if (!activeMembership) {
      return new Set<string>();
    }
    const roleMap = new Map((rolesQuery.data ?? []).map((role) => [role.id, role]));
    const permissions = new Set<string>();
    for (const roleId of activeMembership.roleIds) {
      const role = roleMap.get(roleId);
      if (!role) {
        continue;
      }
      for (const permission of role.permissionKeys) {
        permissions.add(permission);
      }
    }
    return permissions;
  }, [activeMembership, rolesQuery.data]);

  return {
    permissions: rolePermissions,
    roleResolutionFailed: Boolean(rolesQuery.error),
    isLoading: rolesQuery.isLoading
  };
}
