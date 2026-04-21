"use client";

import { useTenantPermissions } from "@/hooks/use-tenant-permissions";

export function PermissionGate({
  permission,
  children,
  fallback = null
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { permissions, roleResolutionFailed } = useTenantPermissions();
  if (permissions.has(permission) || roleResolutionFailed) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
