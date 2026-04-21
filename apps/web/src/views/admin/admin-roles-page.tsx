"use client";

import { RoleEditor } from "@/components/admin/role-editor";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";

export default function AdminRolesPage() {
  const { activeTenantId } = useActiveTenant();
  if (!activeTenantId) {
    return <TenantRequired />;
  }
  return <RoleEditor tenantId={activeTenantId} />;
}
