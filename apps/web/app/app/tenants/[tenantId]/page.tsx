"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/loading-state";
import { useActiveTenant } from "@/hooks/use-active-tenant";
import { useApiClient } from "@/hooks/use-api-client";
import { resolveTenantPortalRoute } from "@/lib/portal-routing";
import type { TenantRole } from "@/lib/types";

export default function TenantRootPage() {
  const router = useRouter();
  const apiClient = useApiClient();
  const { activeMembership } = useActiveTenant();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!activeMembership || redirectedRef.current) {
      return;
    }

    const membership = activeMembership;
    redirectedRef.current = true;
    let cancelled = false;

    async function resolveRoute() {
      let permissions = new Set<string>();
      if (!membership.isOwner) {
        try {
          const roles = await apiClient.get<TenantRole[]>(`/v1/tenants/${membership.tenantId}/roles`);
          const roleMap = new Map(roles.map((role) => [role.id, role]));
          permissions = membership.roleIds.reduce((collected, roleId) => {
            const role = roleMap.get(roleId);
            if (!role) {
              return collected;
            }
            role.permissionKeys.forEach((permission) => collected.add(permission));
            return collected;
          }, new Set<string>());
        } catch {
          permissions = new Set<string>();
        }
      }

      if (!cancelled) {
        router.replace(resolveTenantPortalRoute(membership, permissions));
      }
    }

    void resolveRoute();
    return () => {
      cancelled = true;
    };
  }, [activeMembership, apiClient, router]);

  return <LoadingState label="Resolving tenant portal..." />;
}
