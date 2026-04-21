"use client";

import { useEffect, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { useMeQuery } from "@/hooks/use-me";

export function useActiveTenant() {
  const { data } = useMeQuery();
  const activeTenantId = useAppStore((state) => state.activeTenantId);
  const setActiveTenantId = useAppStore((state) => state.setActiveTenantId);

  const memberships = useMemo(() => data?.memberships ?? [], [data?.memberships]);

  useEffect(() => {
    if (memberships.length === 0) {
      return;
    }
    const activeMemberships = memberships.filter((membership) => membership.status === "active");
    const defaultMembership = activeMemberships[0] ?? memberships[0];
    const hasCurrent = activeTenantId
      ? memberships.some(
          (membership) => membership.tenantId === activeTenantId && membership.status === "active"
        )
      : false;
    if (!hasCurrent) {
      setActiveTenantId(defaultMembership.tenantId);
    }
  }, [activeTenantId, memberships, setActiveTenantId]);

  const activeMembership = useMemo(() => {
    if (!activeTenantId) {
      return null;
    }
    return memberships.find((membership) => membership.tenantId === activeTenantId) ?? null;
  }, [activeTenantId, memberships]);

  return {
    activeTenantId,
    activeMembership,
    memberships
  };
}
