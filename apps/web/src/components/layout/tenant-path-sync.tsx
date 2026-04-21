"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

export function TenantPathSync({
  tenantId,
  children
}: {
  tenantId: string;
  children: React.ReactNode;
}) {
  const setActiveTenantId = useAppStore((state) => state.setActiveTenantId);

  useEffect(() => {
    setActiveTenantId(tenantId);
  }, [setActiveTenantId, tenantId]);

  return <>{children}</>;
}

